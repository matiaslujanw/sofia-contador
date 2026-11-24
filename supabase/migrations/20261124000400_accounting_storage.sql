insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'accounting-documents',
  'accounting-documents',
  false,
  10485760,
  array[
    'application/pdf', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'image/png', 'image/jpeg', 'application/octet-stream'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

create function accounting_private.can_access_object(object_path text, object_owner text, operation text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  scope record;
  membership text;
  registered boolean;
  uuid_segment constant text := '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
begin
  if auth.uid() is null or object_path is null
      or object_path !~ ('^' || uuid_segment || '(/' || uuid_segment || '){3}$') then
    return false;
  end if;

  select period.organization_id, period.status as period_status, company.status as company_status
  into scope
  from public.periods as period
  join public.companies as company on company.id = period.company_id
    and company.organization_id = period.organization_id
  where period.organization_id = split_part(object_path, '/', 1)::uuid
    and period.company_id = split_part(object_path, '/', 2)::uuid
    and period.id = split_part(object_path, '/', 3)::uuid;

  if not found then
    return false;
  end if;

  membership := accounting_private.organization_role(scope.organization_id);
  if membership is null then
    return false;
  end if;

  if operation = 'upload' then
    return membership in ('owner', 'editor')
      and object_owner = auth.uid()::text
      and scope.period_status = 'open'
      and scope.company_status = 'active';
  end if;

  select exists (select 1 from public.documents where storage_path = object_path) into registered;
  if operation = 'read' then
    return registered or (membership in ('owner', 'editor') and object_owner = auth.uid()::text);
  end if;

  if operation = 'cleanup' then
    return not registered and membership in ('owner', 'editor') and object_owner = auth.uid()::text;
  end if;

  return false;
end
$$;

revoke execute on function accounting_private.can_access_object(text, text, text) from public, anon, authenticated;
grant execute on function accounting_private.can_access_object(text, text, text) to authenticated;

create policy accounting_objects_insert on storage.objects for insert to authenticated
with check (
  bucket_id = 'accounting-documents' and accounting_private.can_access_object(name, owner_id, 'upload')
);

create policy accounting_objects_read on storage.objects for select to authenticated
using (
  bucket_id = 'accounting-documents' and accounting_private.can_access_object(name, owner_id, 'read')
);

create policy accounting_unregistered_object_cleanup on storage.objects for delete to authenticated
using (
  bucket_id = 'accounting-documents' and accounting_private.can_access_object(name, owner_id, 'cleanup')
);

create function accounting_private.guard_document_object()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform 1 from storage.objects
  where bucket_id = 'accounting-documents' and name = new.storage_path
    and (auth.uid() is null or owner_id = auth.uid()::text)
    and metadata ->> 'size' = new.size_bytes::text
    and lower(split_part(metadata ->> 'mimetype', ';', 1)) = new.mime_type
  for key share;

  if not found then
    raise exception using message = 'El archivo original no está disponible o sus metadatos no coinciden.', errcode = '22023';
  end if;

  return new;
end
$$;

revoke execute on function accounting_private.guard_document_object() from public, anon, authenticated;

create trigger b_guard_document_object before insert on public.documents
for each row execute function accounting_private.guard_document_object();
