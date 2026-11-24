create function accounting_private.organization_role(target_organization uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select role
  from public.organization_members
  where organization_id = target_organization and user_id = (select auth.uid())
    and (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
$$;

revoke execute on function accounting_private.organization_role(uuid) from public, anon, authenticated;
grant execute on function accounting_private.organization_role(uuid) to authenticated;

create function accounting_private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := statement_timestamp();
  return new;
end
$$;

create function accounting_private.validate_timezone()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
    raise exception using message = 'La zona horaria debe ser un identificador IANA válido.', errcode = '22023';
  end if;
  return new;
end
$$;

create trigger valid_organization_timezone
before insert or update of timezone on public.organizations
for each row execute function accounting_private.validate_timezone();

create function accounting_private.audit_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  before_values jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) - 'updated_at' end;
  after_values jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) - 'updated_at' end;
  entry jsonb := coalesce(after_values, before_values);
  event_details jsonb := '{}'::jsonb;
  event_action text := lower(tg_op);
begin
  if before_values is not distinct from after_values then
    return null;
  end if;

  if tg_op = 'UPDATE' then
    select jsonb_build_object('fields', jsonb_agg(changed.key order by changed.key))
    into event_details
    from jsonb_each(after_values) as changed
    where changed.value is distinct from before_values -> changed.key;
  end if;

  if tg_table_name = 'periods' and
    tg_op = 'UPDATE' and before_values ->> 'status' is distinct from after_values ->> 'status' then
    event_action := case when after_values ->> 'status' = 'closed' then 'close' else 'reopen' end;
    event_details := jsonb_build_object('reason', after_values ->> 'status_reason');
  elsif entry ? 'status' then
    event_details := event_details || jsonb_build_object('status', entry ->> 'status');
  elsif tg_table_name = 'organization_members' then
    event_details := event_details || jsonb_build_object('role', entry ->> 'role');
  end if;

  insert into public.audit_events (
    organization_id, company_id, period_id, actor_id, action, entity, entity_id, details
  ) values (
    coalesce(entry ->> 'organization_id', entry ->> 'id')::uuid,
    coalesce(entry ->> 'company_id', case when tg_table_name = 'companies' then entry ->> 'id' end)::uuid,
    coalesce(entry ->> 'period_id', case when tg_table_name = 'periods' then entry ->> 'id' end)::uuid,
    auth.uid(), event_action, tg_table_name, coalesce(entry ->> 'id', entry ->> 'user_id')::uuid,
    event_details
  );
  return null;
end
$$;

-- Scope keys are immutable via the column grants below. Sharing locks make closure and
-- archiving wait for in-flight writes, including cross-client and direct Data API writes.
create function accounting_private.lock_active_company(target_company uuid, target_organization uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_status text;
begin
  select status into company_status
  from public.companies
  where id = target_company and organization_id = target_organization
  for share;

  if company_status is distinct from 'active' then
    raise exception using message = 'La empresa está archivada o no está disponible.', errcode = '55000';
  end if;
end
$$;

create function accounting_private.lock_open_period(target_period uuid, target_company uuid, target_organization uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  period_status text;
begin
  perform accounting_private.lock_active_company(target_company, target_organization);

  select status into period_status
  from public.periods
  where id = target_period and company_id = target_company and organization_id = target_organization
  for share;

  if period_status is distinct from 'open' then
    raise exception using message = 'El período está cerrado o no está disponible.', errcode = '55000';
  end if;
end
$$;

create function accounting_private.guard_period_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(accounting_private.organization_role(new.organization_id), '') not in ('owner', 'editor')
      and auth.uid() is not null then
    raise exception using message = 'No tenés permiso para editar este período.', errcode = '42501';
  end if;
  perform accounting_private.lock_open_period(new.period_id, new.company_id, new.organization_id);
  return new;
end
$$;

create function accounting_private.guard_company_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(accounting_private.organization_role(new.organization_id), '') not in ('owner', 'editor')
      and auth.uid() is not null then
    raise exception using message = 'No tenés permiso para editar esta empresa.', errcode = '42501';
  end if;
  perform accounting_private.lock_active_company(new.company_id, new.organization_id);
  return new;
end
$$;

create function accounting_private.guard_account_row()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  company_status text;
begin
  if coalesce(accounting_private.organization_role(new.organization_id), '') not in ('owner', 'editor')
      and auth.uid() is not null then
    raise exception using message = 'No tenés permiso para editar el plan de cuentas.', errcode = '42501';
  end if;

  if tg_op = 'UPDATE' then
    if (old.kind, old.category) is distinct from (new.kind, new.category) then
      -- All period writes and closure take a shared company lock. This change must
      -- also wait for any new voucher assignments that could become historical.
      select status into company_status from public.companies
      where id = new.company_id and organization_id = new.organization_id
      for no key update;

      if company_status is distinct from 'active' then
        raise exception using message = 'La empresa está archivada o no está disponible.', errcode = '55000';
      end if;
      if exists (
        select 1 from public.vouchers as voucher
        join public.periods as period on period.id = voucher.period_id
        where voucher.account_id = old.id and period.status = 'closed'
      ) then
        raise exception using message = 'La cuenta tiene comprobantes en períodos cerrados.', errcode = '55000';
      end if;
      return new;
    end if;
  end if;

  perform accounting_private.lock_active_company(new.company_id, new.organization_id);
  return new;
end
$$;

create function accounting_private.guard_voucher_date()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.periods as period
    where period.id = new.period_id and period.company_id = new.company_id
      and period.organization_id = new.organization_id
      and new.date >= period.month and new.date < period.month + interval '1 month'
  ) then
    raise exception using message = 'La fecha del comprobante está fuera del período seleccionado.', errcode = '22023';
  end if;
  return new;
end
$$;

create function accounting_private.validate_vat_breakdown()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  breakdown_total numeric;
begin
  if new.vat_breakdown = '{}'::jsonb then
    return new;
  end if;

  if jsonb_typeof(new.vat_breakdown) <> 'object' or exists (
    select 1 from jsonb_each_text(new.vat_breakdown) as entry
    where entry.key !~ '^(0|[1-9][0-9]{0,2})([.][0-9]{1,4})?$'
      or entry.value is null or entry.value !~ '^-?[0-9]{1,16}([.][0-9]{1,2})?$'
  ) then
    raise exception using message = 'El detalle de IVA contiene alícuotas o importes inválidos.', errcode = '22023';
  end if;

  select sum(entry.value::numeric), jsonb_object_agg(entry.key, entry.value)
  into breakdown_total, new.vat_breakdown
  from jsonb_each_text(new.vat_breakdown) as entry;
  if breakdown_total is distinct from new.vat::numeric then
    raise exception using message = 'El detalle por alícuota no coincide con el IVA total.', errcode = '22023';
  end if;
  return new;
end
$$;

create function accounting_private.lock_account_hierarchy()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Serialize chart changes for a given company, including concurrent reparenting.
  perform pg_advisory_xact_lock(hashtextextended(new.company_id::text, 0));
  return new;
end
$$;

create function accounting_private.validate_account_hierarchy()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    with recursive path as (
      select account.code, account.parent_code, array[account.code] as visited, false as cycle
      from public.accounts as account
      where account.id = new.id
      union all
      select parent.code, parent.parent_code, path.visited || parent.code, parent.code = any(path.visited)
      from path
      join public.accounts as parent on parent.company_id = new.company_id and parent.code = path.parent_code
      where not path.cycle
    )
    select 1 from path where cycle
  ) then
    raise exception using message = 'La jerarquía del plan de cuentas tiene un ciclo.', errcode = '23514';
  end if;
  return null;
end
$$;

do $$
declare
  relation text;
begin
  foreach relation in array array[
    'organizations', 'organization_members', 'companies', 'periods', 'close_tasks', 'accounts',
    'vouchers', 'classification_rules', 'tax_obligations'
  ] loop
    execute format(
      'create trigger set_updated_at before update on public.%I for each row
       execute function accounting_private.touch_updated_at()', relation
    );
  end loop;

  foreach relation in array array[
    'organizations', 'organization_members', 'companies', 'periods', 'close_tasks', 'documents',
    'accounts', 'vouchers', 'classification_rules', 'tax_obligations'
  ] loop
    execute format(
      'create trigger write_audit_event after insert or update or delete on public.%I for each row
       execute function accounting_private.audit_row()', relation
    );
  end loop;

  foreach relation in array array['close_tasks', 'documents', 'vouchers', 'tax_obligations'] loop
    execute format(
      'create trigger a_guard_period before insert or update on public.%I for each row
       execute function accounting_private.guard_period_row()', relation
    );
  end loop;

end
$$;

create trigger a_guard_company before insert or update on public.classification_rules
for each row execute function accounting_private.guard_company_row();

create trigger a_guard_account before insert or update on public.accounts
for each row execute function accounting_private.guard_account_row();

create trigger b_guard_voucher_date before insert or update of date on public.vouchers
for each row execute function accounting_private.guard_voucher_date();

create trigger c_validate_voucher_vat before insert or update of vat, vat_breakdown on public.vouchers
for each row execute function accounting_private.validate_vat_breakdown();

create trigger b_lock_account_hierarchy before insert or update of parent_code on public.accounts
for each row execute function accounting_private.lock_account_hierarchy();

create constraint trigger validate_account_hierarchy after insert or update of parent_code on public.accounts
deferrable initially deferred for each row
when (new.parent_code is not null)
execute function accounting_private.validate_account_hierarchy();

do $$
declare
  relation text;
begin
  foreach relation in array array[
    'organizations', 'organization_members', 'companies', 'periods', 'close_tasks', 'documents', 'imports',
    'accounts', 'vouchers', 'classification_rules', 'tax_obligations', 'audit_events'
  ] loop
    execute format('alter table public.%I enable row level security', relation);
    execute format('revoke all on table public.%I from public, anon, authenticated', relation);
    execute format('grant select on table public.%I to authenticated', relation);
  end loop;

  foreach relation in array array[
    'companies', 'periods', 'close_tasks', 'documents', 'imports', 'accounts',
    'vouchers', 'classification_rules', 'tax_obligations', 'audit_events'
  ] loop
    execute format(
      'create policy organization_read on public.%I for select to authenticated
        using (accounting_private.organization_role(organization_id) is not null)', relation
    );
  end loop;

  foreach relation in array array['companies', 'close_tasks', 'documents', 'accounts', 'tax_obligations'] loop
    execute format(
      'create policy editor_insert on public.%I for insert to authenticated
       with check (accounting_private.organization_role(organization_id) in (''owner'', ''editor''))', relation
    );
  end loop;

  foreach relation in array array['companies', 'close_tasks', 'accounts', 'vouchers', 'tax_obligations'] loop
    execute format(
      'create policy editor_update on public.%I for update to authenticated
       using (accounting_private.organization_role(organization_id) in (''owner'', ''editor''))
       with check (accounting_private.organization_role(organization_id) in (''owner'', ''editor''))', relation
    );
  end loop;
end
$$;

create policy own_organizations_read on public.organizations for select to authenticated
using (accounting_private.organization_role(id) is not null);

create policy owner_organization_update on public.organizations for update to authenticated
using (accounting_private.organization_role(id) = 'owner')
with check (accounting_private.organization_role(id) = 'owner');

create policy membership_read on public.organization_members for select to authenticated
using (
  (select auth.jwt() ->> 'is_anonymous') is distinct from 'true'
  and (user_id = (select auth.uid()) or accounting_private.organization_role(organization_id) = 'owner')
);

grant update (name, locale, currency, timezone) on public.organizations to authenticated;
grant insert (
  id, organization_id, legal_name, trade_name, cuit, entity_type, activity, tax_address,
  province, vat_status, gross_income_regime, start_date, fiscal_year_end, employee_count,
  currency, tax_obligations, notes, status
) on public.companies to authenticated;
grant update (
  legal_name, trade_name, cuit, entity_type, activity, tax_address, province, vat_status, gross_income_regime,
  start_date, fiscal_year_end, employee_count, currency, tax_obligations, notes, status
) on public.companies to authenticated;
grant insert (
  id, organization_id, company_id, period_id, title, position, status, notes, document_id
) on public.close_tasks to authenticated;
grant update (title, position, status, notes, document_id) on public.close_tasks to authenticated;
grant insert (
  id, organization_id, company_id, period_id, name, category, storage_path, mime_type, size_bytes
) on public.documents to authenticated;
grant insert (id, organization_id, company_id, code, name, kind, parent_code, category, status)
on public.accounts to authenticated;
grant update (name, kind, parent_code, category, status) on public.accounts to authenticated;
grant update (
  account_id, category, concept, cost_center, payment_status, payment_method,
  deductible_vat, notes, review_status, xubio_status, document_id
) on public.vouchers to authenticated;
grant insert (
  id, organization_id, company_id, period_id, title, due_on, amount, status, filed_on, paid_on, document_id, notes
) on public.tax_obligations to authenticated;
grant update (title, due_on, amount, status, filed_on, paid_on, document_id, notes)
on public.tax_obligations to authenticated;

revoke execute on function accounting_private.touch_updated_at() from public, anon, authenticated;
revoke execute on function accounting_private.validate_timezone() from public, anon, authenticated;
revoke execute on function accounting_private.audit_row() from public, anon, authenticated;
revoke execute on function accounting_private.lock_active_company(uuid, uuid) from public, anon, authenticated;
revoke execute on function accounting_private.lock_open_period(uuid, uuid, uuid) from public, anon, authenticated;
revoke execute on function accounting_private.guard_period_row() from public, anon, authenticated;
revoke execute on function accounting_private.guard_company_row() from public, anon, authenticated;
revoke execute on function accounting_private.guard_account_row() from public, anon, authenticated;
revoke execute on function accounting_private.guard_voucher_date() from public, anon, authenticated;
revoke execute on function accounting_private.validate_vat_breakdown() from public, anon, authenticated;
revoke execute on function accounting_private.lock_account_hierarchy() from public, anon, authenticated;
revoke execute on function accounting_private.validate_account_hierarchy() from public, anon, authenticated;
