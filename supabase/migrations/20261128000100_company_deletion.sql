begin;
-- No company is removed by applying this migration. Deletion is an explicit owner-only RPC.
create table if not exists public.company_deletions (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 company_id uuid not null unique,company_name text not null,cuit text not null,counts jsonb not null,
 preview_signature text not null,storage_paths text[] not null default '{}',
 status text not null default 'files_pending' check(status in ('files_pending','completed')),
 requested_by uuid not null references auth.users(id),created_at timestamptz not null default now(),completed_at timestamptz
);
alter table public.company_deletions enable row level security;
revoke all on public.company_deletions from public,anon,authenticated;
grant select on public.company_deletions to authenticated;
drop policy if exists company_deletion_owner_read on public.company_deletions;
create policy company_deletion_owner_read on public.company_deletions for select to authenticated using(accounting_private.organization_role(organization_id)='owner');
-- Audit snapshots retain their historical company UUID after the live company is removed.
-- Neither confirmed entries nor immutable history rows are changed/deleted.
do $$ declare constraint_name text;begin
 if to_regclass('public.accounting_change_history') is not null then
  for constraint_name in select conname from pg_constraint where conrelid='public.accounting_change_history'::regclass and confrelid='public.companies'::regclass and contype='f' loop
   execute format('alter table public.accounting_change_history drop constraint %I',constraint_name);
  end loop;
 end if;
end $$;

create or replace function accounting_private.company_deletion_snapshot(target_company uuid) returns jsonb
language plpgsql security definer set search_path='' as $$
declare c public.companies;counts jsonb:='{}';blocked jsonb:='[]';paths text[];n bigint;relation text;signature text;audit_ids text;begin
 select * into c from public.companies where id=target_company;
 if c.id is null or accounting_private.organization_role(c.organization_id) is distinct from 'owner' then raise exception using errcode='42501',message='Solo la propietaria puede eliminar esta empresa.';end if;
 foreach relation in array array['periods','accounts','vouchers','documents','imports','close_tasks','tax_obligations','book_records','accounting_journal_entries','accounting_bank_movements'] loop
  n:=0;if to_regclass('public.'||relation) is not null then execute format('select count(*) from public.%I where company_id=$1 and organization_id=$2',relation) into n using c.id,c.organization_id;end if;
  counts:=counts||jsonb_build_object(case relation when 'close_tasks' then 'tasks' when 'tax_obligations' then 'obligations' when 'book_records' then 'book' when 'accounting_journal_entries' then 'entries' when 'accounting_bank_movements' then 'bank_movements' else relation end,n);
 end loop;
 if (counts->>'entries')::bigint>0 then blocked:=blocked||jsonb_build_array('La empresa tiene asientos confirmados. Se conserva su historial; podés archivarla, pero no eliminarla por esta vía.');end if;
 if (counts->>'bank_movements')::bigint>0 then blocked:=blocked||jsonb_build_array('La empresa tiene movimientos bancarios inmutables del núcleo. Su historial debe conservarse.');end if;
 if to_regclass('public.book_records') is not null then
  execute 'select count(*) from public.book_records where company_id=$1 and organization_id=$2 and payload->>''kind'' in (''journal'',''cash'',''accrual'',''opening'')' into n using c.id,c.organization_id;
  if n>0 then blocked:=blocked||jsonb_build_array('La empresa tiene movimientos contables en el libro operativo. Su historial debe conservarse.');end if;
 end if;
 select coalesce(array_agg(path order by path),'{}'::text[]) into paths from(
  select storage_path path from public.documents where company_id=c.id and organization_id=c.organization_id
  union select name from storage.objects where bucket_id='accounting-documents' and starts_with(name,c.organization_id::text||'/'||c.id::text||'/')
 )p;
 if exists(select 1 from unnest(paths)p where not starts_with(p,c.organization_id::text||'/'||c.id::text||'/')) then raise exception using errcode='23514',message='Un archivo no corresponde a esta empresa.';end if;
 select coalesce(string_agg(id::text,',' order by id),'') into audit_ids from public.audit_events where company_id=c.id and organization_id=c.organization_id;
 signature:=encode(sha256(convert_to(jsonb_build_object('company',to_jsonb(c),'counts',counts,'paths',paths,'audit',audit_ids)::text,'UTF8')),'hex');
 return jsonb_build_object('company_id',c.id,'company_name',coalesce(nullif(c.trade_name,''),c.legal_name),'cuit',c.cuit,'counts',counts,'blocked',blocked,'signature',signature);
end $$;

create or replace function public.preview_company_deletion(target_company uuid) returns jsonb language sql security definer set search_path='' as $$ select accounting_private.company_deletion_snapshot(target_company) $$;
create or replace function public.delete_workspace_company(target_company uuid,confirmation_cuit text,expected_signature text) returns uuid
language plpgsql security definer set search_path='' as $$
declare c public.companies;s jsonb;r uuid;paths text[];relation text;j public.company_deletions;begin
 select * into c from public.companies where id=target_company for update;
 if c.id is null then
  select * into j from public.company_deletions where company_id=target_company and cuit=confirmation_cuit and preview_signature=expected_signature;
  if j.id is not null and accounting_private.organization_role(j.organization_id)='owner' then return j.id;end if;
  raise exception using errcode='42501',message='La empresa no está disponible.';
 end if;
 if accounting_private.organization_role(c.organization_id) is distinct from 'owner' then raise exception using errcode='42501',message='Solo la propietaria puede eliminar una empresa.';end if;
 if confirmation_cuit is distinct from c.cuit then raise exception using errcode='22023',message='Escribí el CUIT exacto de la empresa.';end if;
 s:=accounting_private.company_deletion_snapshot(c.id);
 if s->>'signature' is distinct from expected_signature then raise exception using errcode='40001',message='Las cargas cambiaron. Volvé a revisar el detalle antes de eliminar.';end if;
 if jsonb_array_length(s->'blocked')>0 then raise exception using errcode='55000',message=(s->'blocked'->>0);end if;
 select coalesce(array_agg(path order by path),'{}'::text[]) into paths from(
  select storage_path path from public.documents where company_id=c.id and organization_id=c.organization_id
  union select name from storage.objects where bucket_id='accounting-documents' and starts_with(name,c.organization_id::text||'/'||c.id::text||'/')
 )p;
 insert into public.company_deletions(organization_id,company_id,company_name,cuit,counts,preview_signature,storage_paths,requested_by)
 values(c.organization_id,c.id,s->>'company_name',c.cuit,s->'counts',expected_signature,paths,auth.uid()) returning id into r;
 -- Explicit list: future unknown relations cause FK rollback, never an uncontrolled cascade.
 foreach relation in array array['accounting_voucher_parties','accounting_bank_accounts','accounting_parties','accounting_account_profiles','accounting_equivalences','accounting_exercises','book_records','classification_rules','tax_obligations','close_tasks','vouchers','imports','documents','accounts','periods'] loop
  if to_regclass('public.'||relation) is not null then execute format('delete from public.%I where company_id=$1 and organization_id=$2',relation) using c.id,c.organization_id;end if;
 end loop;
 delete from public.companies where id=c.id and organization_id=c.organization_id;
 insert into public.audit_events(organization_id,company_id,actor_id,action,entity,entity_id,details)
 values(c.organization_id,c.id,auth.uid(),'delete','company_deletion',r,jsonb_build_object('company_name',s->>'company_name','cuit',c.cuit,'counts',s->'counts','files_pending',cardinality(paths)));
 return r;
end $$;

create or replace function accounting_private.can_cleanup_deleted_company_object(object_bucket text,object_name text) returns boolean
language sql stable security definer set search_path='' as $$
 select object_bucket='accounting-documents' and exists(select 1 from public.company_deletions j where j.status='files_pending' and accounting_private.organization_role(j.organization_id)='owner' and object_name=any(j.storage_paths) and starts_with(object_name,j.organization_id::text||'/'||j.company_id::text||'/'))
$$;
drop policy if exists company_deleted_files_read on storage.objects;
drop policy if exists company_deleted_files_delete on storage.objects;
create policy company_deleted_files_read on storage.objects for select to authenticated using(accounting_private.can_cleanup_deleted_company_object(bucket_id,name));
create policy company_deleted_files_delete on storage.objects for delete to authenticated using(accounting_private.can_cleanup_deleted_company_object(bucket_id,name));

create or replace function public.complete_company_deletion(target_deletion uuid) returns uuid language plpgsql security definer set search_path='' as $$declare j public.company_deletions;begin
 select * into j from public.company_deletions where id=target_deletion for update;
 if j.id is null or accounting_private.organization_role(j.organization_id) is distinct from 'owner' then raise exception using errcode='42501',message='Sin permiso para completar la limpieza.';end if;
 if exists(select 1 from storage.objects where bucket_id='accounting-documents' and name=any(j.storage_paths)) then raise exception using errcode='55000',message='Quedan archivos por retirar de Storage.';end if;
 update public.company_deletions set status='completed',completed_at=coalesce(completed_at,now()) where id=j.id;return j.id;
end $$;
-- Serialize uploads with company removal, including uploads whose document metadata is not yet registered.
create or replace function accounting_private.guard_company_storage_upload() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.bucket_id='accounting-documents' and new.name ~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}(/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}){3}$' then
  perform 1 from public.companies where id=split_part(new.name,'/',2)::uuid and organization_id=split_part(new.name,'/',1)::uuid and status='active' for share;
  if not found then raise exception using errcode='55000',message='La empresa no está disponible para subir archivos.';end if;
 end if;return new;
end $$;
drop trigger if exists company_storage_upload_lock on storage.objects;
create trigger company_storage_upload_lock before insert on storage.objects for each row execute function accounting_private.guard_company_storage_upload();
revoke execute on function accounting_private.company_deletion_snapshot(uuid) from public,anon,authenticated;
revoke execute on function accounting_private.guard_company_storage_upload() from public,anon,authenticated;
revoke execute on function accounting_private.can_cleanup_deleted_company_object(text,text) from public,anon;
grant execute on function accounting_private.can_cleanup_deleted_company_object(text,text) to authenticated;
revoke execute on function public.preview_company_deletion(uuid),public.delete_workspace_company(uuid,text,text),public.complete_company_deletion(uuid) from public,anon;
grant execute on function public.preview_company_deletion(uuid),public.delete_workspace_company(uuid,text,text),public.complete_company_deletion(uuid) to authenticated;
notify pgrst,'reload schema';
commit;
