create function public.create_organization(organization_name text)
returns public.organizations
language plpgsql
security definer
set search_path = ''
as $$
declare
  organization public.organizations;
begin
  if auth.uid() is null or auth.jwt() ->> 'is_anonymous' = 'true' then
    raise exception using message = 'Necesitás iniciar sesión.', errcode = '42501';
  end if;

  insert into public.organizations (name) values (btrim(organization_name)) returning * into organization;
  insert into public.organization_members (organization_id, user_id, role)
  values (organization.id, auth.uid(), 'owner');

  return organization;
end
$$;

create function public.set_organization_member(target_organization uuid, target_user uuid, member_role text)
returns public.organization_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  membership public.organization_members;
begin
  if accounting_private.organization_role(target_organization) is distinct from 'owner' then
    raise exception using message = 'Solo un propietario puede gestionar integrantes.', errcode = '42501';
  end if;

  perform 1 from public.organizations where id = target_organization for update;
  if accounting_private.organization_role(target_organization) is distinct from 'owner' then
    raise exception using message = 'Solo un propietario puede gestionar integrantes.', errcode = '42501';
  end if;

  select * into membership
  from public.organization_members
  where organization_id = target_organization and user_id = target_user;

  if membership.role = 'owner' and member_role is distinct from 'owner' and not exists (
    select 1 from public.organization_members
    where organization_id = target_organization and role = 'owner' and user_id <> target_user
  ) then
    raise exception using message = 'La organización necesita al menos un propietario.', errcode = '55000';
  end if;

  if member_role is null then
    delete from public.organization_members where organization_id = target_organization and user_id = target_user;
  else
    if exists (select 1 from auth.users where id = target_user and is_anonymous) then
      raise exception using message = 'La persona debe tener una cuenta permanente.', errcode = '42501';
    end if;

    insert into public.organization_members (organization_id, user_id, role)
    values (target_organization, target_user, member_role)
    on conflict (organization_id, user_id) do update set role = excluded.role
    returning * into membership;
  end if;

  return membership;
end
$$;

create function public.ensure_period(target_company uuid, target_month date)
returns public.periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  company public.companies;
  period public.periods;
  membership_role text;
  previous_period_id uuid;
begin
  if target_month is null or target_month < date '1900-01-01' or target_month > date '2200-12-01'
      or extract(day from target_month) <> 1 then
    raise exception using message = 'El período debe indicar el primer día de un mes válido.', errcode = '22023';
  end if;

  select * into company from public.companies where id = target_company;
  membership_role := accounting_private.organization_role(company.organization_id);
  if membership_role is null then
    raise exception using message = 'No tenés acceso a la empresa.', errcode = '42501';
  end if;

  select * into period from public.periods where company_id = company.id and month = target_month;
  if found then
    return period;
  end if;

  if membership_role not in ('owner', 'editor') then
    raise exception using message = 'No tenés permiso para iniciar este período.', errcode = '42501';
  end if;

  perform accounting_private.lock_active_company(company.id, company.organization_id);

  insert into public.periods (organization_id, company_id, month)
  values (company.organization_id, company.id, target_month)
  on conflict (company_id, month) do nothing
  returning * into period;

  if not found then
    select * into period from public.periods where company_id = company.id and month = target_month;
    return period;
  end if;

  select earlier.id into previous_period_id
  from public.periods as earlier
  where earlier.company_id = company.id and earlier.month < target_month
  order by earlier.month desc
  limit 1;

  if previous_period_id is not null then
    insert into public.close_tasks (organization_id, company_id, period_id, title, position)
    select period.organization_id, period.company_id, period.id, previous.title, previous.position
    from public.close_tasks as previous
    where previous.period_id = previous_period_id;

    if found then
      return period;
    end if;
  end if;

  insert into public.close_tasks (organization_id, company_id, period_id, title, position)
  select period.organization_id, period.company_id, period.id, templates.title, templates.position
  from unnest(array[
    'Recepción de comprobantes emitidos',
    'Recepción de comprobantes recibidos',
    'Recepción de extractos bancarios',
    'Control de movimientos bancarios',
    'Clasificación contable de compras y ventas',
    'Verificación de pagos y cobros',
    'Conciliación bancaria',
    'Control de cuentas de socios',
    'Liquidación de IVA',
    'Liquidación de Ingresos Brutos',
    'Generación de asientos contables',
    'Registración en Xubio',
    'Control de declaraciones juradas',
    'Control de pagos fiscales',
    'Estado de resultados',
    'Cierre mensual'
  ]) with ordinality as templates(title, position);

  return period;
end
$$;

create function public.set_period_status(target_period uuid, target_status text, reason text default null)
returns public.periods
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.periods;
  normalized_reason text := nullif(btrim(reason), '');
begin
  if target_status is null or target_status not in ('open', 'closed') then
    raise exception using message = 'El estado del período no es válido.', errcode = '22023';
  end if;

  select * into period from public.periods where id = target_period;
  if coalesce(accounting_private.organization_role(period.organization_id), '') not in ('owner', 'editor') then
    raise exception using message = 'No tenés permiso para cambiar el estado de este período.', errcode = '42501';
  end if;

  perform accounting_private.lock_active_company(period.company_id, period.organization_id);
  select * into period from public.periods where id = target_period for update;

  if period.status = target_status then
    return period;
  end if;

  if normalized_reason is null then
    if target_status = 'open' then
      raise exception using message = 'Ingresá el motivo de reapertura.', errcode = '22023';
    end if;
    if exists (
      select 1 from public.close_tasks
      where period_id = period.id and status not in ('completed', 'not_applicable')
    ) then
      raise exception using message = 'Hay tareas pendientes. Ingresá un motivo para confirmar el cierre.', errcode = '22023';
    end if;
  end if;

  update public.periods set status = target_status, status_reason = normalized_reason
  where id = target_period returning * into period;
  return period;
end
$$;

create function public.confirm_import(
  target_period uuid,
  source_document uuid,
  import_kind text,
  file_sha256 text,
  normalized_rows jsonb,
  source_duplicates integer default 0
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  period public.periods;
  import_entry public.imports;
  normalized_count integer;
  input_rows integer;
  inserted_rows integer;
begin
  select * into period from public.periods where id = target_period;
  if coalesce(accounting_private.organization_role(period.organization_id), '') not in ('owner', 'editor') then
    raise exception using message = 'No tenés permiso para importar en este período.', errcode = '42501';
  end if;

  if import_kind is null or import_kind not in ('purchase', 'sale', 'accounts')
      or file_sha256 is null or file_sha256 !~ '^[0-9a-f]{64}$'
      or jsonb_typeof(normalized_rows) is distinct from 'array' then
    raise exception using message = 'Los datos de importación no son válidos.', errcode = '22023';
  end if;
  normalized_count := jsonb_array_length(normalized_rows);
  if normalized_count not between 1 and 5000 or source_duplicates is null
    or source_duplicates not between 0 and 5000 - normalized_count or exists (
    select 1 from jsonb_array_elements(normalized_rows) as item
    where jsonb_typeof(item) <> 'object'
  ) then
    raise exception using message = 'La importación debe incluir entre 1 y 5.000 filas válidas.', errcode = '22023';
  end if;
  input_rows := normalized_count + source_duplicates;
  if not exists (
    select 1 from public.documents where id = source_document and period_id = period.id
      and company_id = period.company_id and organization_id = period.organization_id
  ) then
    raise exception using message = 'El archivo original debe estar registrado en este período.', errcode = '22023';
  end if;

  select * into import_entry
  from public.imports as prior
  where prior.period_id = period.id and prior.kind = import_kind and prior.file_sha256 = confirm_import.file_sha256;
  if found then
    return jsonb_build_object(
      'id', import_entry.id, 'row_count', import_entry.row_count,
      'duplicate_count', import_entry.duplicate_count, 'reused', true
    );
  end if;

  perform accounting_private.lock_open_period(period.id, period.company_id, period.organization_id);

  insert into public.imports (organization_id, company_id, period_id, document_id, kind, file_sha256, input_count)
  values (period.organization_id, period.company_id, period.id, source_document, import_kind, file_sha256, input_rows)
  on conflict on constraint imports_period_id_kind_file_sha256_key do nothing
  returning * into import_entry;

  if not found then
    select * into import_entry
    from public.imports as prior
    where prior.period_id = period.id and prior.kind = import_kind and prior.file_sha256 = confirm_import.file_sha256;
    return jsonb_build_object(
      'id', import_entry.id, 'row_count', import_entry.row_count,
      'duplicate_count', import_entry.duplicate_count, 'reused', true
    );
  end if;

  if import_kind = 'accounts' then
    insert into public.accounts (organization_id, company_id, code, name, kind, parent_code, category, status)
    select period.organization_id, period.company_id, btrim(row.code), btrim(row.name),
           row.kind, nullif(btrim(row.parent_code), ''), nullif(btrim(row.category), ''), coalesce(row.status, 'active')
    from jsonb_to_recordset(normalized_rows) as row (
      code text, name text, kind text, parent_code text, category text, status text
    )
    on conflict (company_id, code) do nothing;
    get diagnostics inserted_rows = row_count;
  else
    if exists (
      select 1 from jsonb_array_elements(normalized_rows) as item
      where item ? 'direction' and item ->> 'direction' is distinct from import_kind
    ) then
      raise exception using message = 'La dirección de los comprobantes no coincide con la importación.', errcode = '22023';
    end if;

    insert into public.vouchers (
      organization_id, company_id, period_id, source_import_id, document_id, direction, date, receipt_type,
      point_of_sale, receipt_number, counterparty_cuit, counterparty_name, currency, exchange_rate,
      taxable, untaxed, exempt, vat, other_taxes, total, vat_breakdown
    )
    select period.organization_id, period.company_id, period.id, import_entry.id, source_document,
           import_kind, row.date, btrim(row.receipt_type), row.point_of_sale, row.receipt_number,
           nullif(btrim(row.counterparty_cuit), ''), btrim(row.counterparty_name), row.currency,
           row.exchange_rate, row.taxable, row.untaxed, row.exempt, row.vat, row.other_taxes, row.total,
           coalesce(row.vat_breakdown, '{}'::jsonb)
    from jsonb_to_recordset(normalized_rows) as row (
      date date, receipt_type text, point_of_sale integer, receipt_number integer,
      counterparty_cuit text, counterparty_name text, currency text, exchange_rate numeric,
      taxable numeric, untaxed numeric, exempt numeric, vat numeric, other_taxes numeric, total numeric, vat_breakdown jsonb
    )
    on conflict do nothing;
    get diagnostics inserted_rows = row_count;
  end if;

  update public.imports set row_count = inserted_rows, duplicate_count = input_rows - inserted_rows
  where id = import_entry.id returning * into import_entry;

  insert into public.audit_events (organization_id, company_id, period_id, actor_id, action, entity, entity_id, details)
  values (
    period.organization_id, period.company_id, period.id, auth.uid(), 'confirm', 'imports', import_entry.id,
    jsonb_build_object('kind', import_kind, 'rows', inserted_rows, 'duplicates', input_rows - inserted_rows)
  );

  return jsonb_build_object(
    'id', import_entry.id, 'row_count', import_entry.row_count,
    'duplicate_count', import_entry.duplicate_count, 'reused', false
  );
end
$$;

create function public.save_classification_rule(target_voucher uuid)
returns public.classification_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  voucher public.vouchers;
  rule public.classification_rules;
begin
  select * into voucher from public.vouchers where id = target_voucher;
  if coalesce(accounting_private.organization_role(voucher.organization_id), '') not in ('owner', 'editor') then
    raise exception using message = 'No tenés permiso para guardar esta regla.', errcode = '42501';
  end if;

  if voucher.review_status <> 'approved' or voucher.counterparty_cuit is null or (
    voucher.account_id is null and nullif(btrim(voucher.category), '') is null
    and nullif(btrim(voucher.concept), '') is null and nullif(btrim(voucher.cost_center), '') is null
  ) then
    raise exception using message = 'La regla requiere un comprobante aprobado, CUIT y una imputación.', errcode = '22023';
  end if;

  insert into public.classification_rules (
    organization_id, company_id, direction, counterparty_cuit, account_id, category, concept, cost_center
  ) values (
    voucher.organization_id, voucher.company_id, voucher.direction, voucher.counterparty_cuit,
    voucher.account_id, nullif(btrim(voucher.category), ''), nullif(btrim(voucher.concept), ''),
    nullif(btrim(voucher.cost_center), '')
  )
  on conflict (company_id, direction, counterparty_cuit) do update
  set account_id = excluded.account_id,
      category = excluded.category,
      concept = excluded.concept,
      cost_center = excluded.cost_center
  returning * into rule;
  return rule;
end
$$;

create function public.update_voucher_classification(
  target_voucher uuid,
  classification jsonb,
  save_rule boolean default false
)
returns uuid
language plpgsql
security invoker
set search_path = ''
as $$
declare
  updated_id uuid;
  editable_fields constant text[] := array[
    'account_id', 'category', 'concept', 'cost_center', 'payment_status', 'payment_method',
    'deductible_vat', 'notes', 'review_status', 'xubio_status', 'document_id'
  ];
begin
  if jsonb_typeof(classification) is distinct from 'object'
      or not (classification ?& editable_fields)
      or classification - editable_fields <> '{}'::jsonb then
    raise exception using message = 'Los campos de imputación no son válidos.', errcode = '22023';
  end if;

  update public.vouchers as voucher
  set account_id = proposal.account_id,
      category = proposal.category,
      concept = proposal.concept,
      cost_center = proposal.cost_center,
      payment_status = proposal.payment_status,
      payment_method = proposal.payment_method,
      deductible_vat = proposal.deductible_vat,
      notes = proposal.notes,
      review_status = proposal.review_status,
      xubio_status = proposal.xubio_status,
      document_id = proposal.document_id
  from jsonb_to_record(classification) as proposal (
    account_id uuid, category text, concept text, cost_center text, payment_status text,
    payment_method text, deductible_vat numeric, notes text, review_status text, xubio_status text, document_id uuid
  )
  where voucher.id = target_voucher
  returning voucher.id into updated_id;

  if not found then
    raise exception using message = 'No tenés permiso para imputar este comprobante.', errcode = '42501';
  end if;

  if save_rule is true then
    perform public.save_classification_rule(updated_id);
  end if;

  return updated_id;
end
$$;

revoke execute on function public.create_organization(text) from public, anon, authenticated;
revoke execute on function public.set_organization_member(uuid, uuid, text) from public, anon, authenticated;
revoke execute on function public.ensure_period(uuid, date) from public, anon, authenticated;
revoke execute on function public.set_period_status(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.confirm_import(uuid, uuid, text, text, jsonb, integer) from public, anon, authenticated;
revoke execute on function public.save_classification_rule(uuid) from public, anon, authenticated;
revoke execute on function public.update_voucher_classification(uuid, jsonb, boolean) from public, anon, authenticated;

grant execute on function public.create_organization(text) to authenticated;
grant execute on function public.set_organization_member(uuid, uuid, text) to authenticated;
grant execute on function public.ensure_period(uuid, date) to authenticated;
grant execute on function public.set_period_status(uuid, text, text) to authenticated;
grant execute on function public.confirm_import(uuid, uuid, text, text, jsonb, integer) to authenticated;
grant execute on function public.save_classification_rule(uuid) to authenticated;
grant execute on function public.update_voucher_classification(uuid, jsonb, boolean) to authenticated;
