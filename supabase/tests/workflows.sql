begin;

create function pg_temp.assert_true(condition boolean, label text)
returns void language plpgsql as $$
begin
  if condition is not true then
    raise exception 'Assertion failed: %', label;
  end if;
end
$$;

create function pg_temp.assert_throws(statement text, expected_sqlstate text)
returns void language plpgsql as $$
begin
  begin
    execute statement;
  exception when others then
    if sqlstate = expected_sqlstate then
      return;
    end if;
    raise;
  end;
  raise exception 'Expected SQLSTATE % for %', expected_sqlstate, statement;
end
$$;

select pg_temp.assert_true(
  not has_table_privilege('anon', 'public.companies', 'select')
  and not has_function_privilege('anon', 'public.ensure_period(uuid,date)', 'execute')
  and not has_function_privilege('anon', 'public.create_organization(text)', 'execute'),
  'anonymous calls are denied by grants'
);
select pg_temp.assert_true(
  (select not public and file_size_limit = 10485760 from storage.buckets where id = 'accounting-documents'),
  'the accounting bucket is private and size-limited'
);

insert into auth.users (id) values
  ('00000000-0000-4000-8000-000000000001'),
  ('00000000-0000-4000-8000-000000000002'),
  ('00000000-0000-4000-8000-000000000003'),
  ('00000000-0000-4000-8000-000000000004');
insert into auth.users (id, is_anonymous) values ('00000000-0000-4000-8000-000000000005', true);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-000000000005","is_anonymous":true}', true);
select pg_temp.assert_throws('select public.create_organization(''Acceso temporal'')', '42501');
select set_config('request.jwt.claims', '', true);
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
select set_config('test.org_a', (public.create_organization('Estudio A')).id::text, true);

select pg_temp.assert_throws(format(
  'select public.set_organization_member(%L, %L, null)',
  current_setting('test.org_a'), current_setting('request.jwt.claim.sub')
), '55000');
select pg_temp.assert_throws(format(
  'select public.set_organization_member(%L, %L, ''viewer'')',
  current_setting('test.org_a'), '00000000-0000-4000-8000-000000000005'
), '42501');

select (public.set_organization_member(
  current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000002', 'editor'
)).role;
select (public.set_organization_member(
  current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000003', 'viewer'
)).role;

update public.organizations set timezone = 'America/Argentina/Tucuman'
where id = current_setting('test.org_a')::uuid;
select pg_temp.assert_throws(
  'update public.organizations set timezone = ''Invalid/Zone''', '22023'
);

insert into public.companies (id, organization_id, legal_name, cuit, fiscal_year_end) values
  ('00000000-0000-4000-8000-000000000011', current_setting('test.org_a')::uuid, 'Primera SAS', '30700000001', '12-31'),
  ('00000000-0000-4000-8000-000000000012', current_setting('test.org_a')::uuid, 'Segunda SAS', '30700000002', null);

select set_config('test.period_a', (public.ensure_period('00000000-0000-4000-8000-000000000011', '2026-11-01')).id::text, true);
select set_config('test.period_b', (public.ensure_period('00000000-0000-4000-8000-000000000012', '2026-11-01')).id::text, true);
select pg_temp.assert_true(
  (public.ensure_period('00000000-0000-4000-8000-000000000011', '2026-11-01')).id = current_setting('test.period_a')::uuid,
  'ensure period is idempotent'
);
select pg_temp.assert_true(
  (select count(*) = 16 from public.close_tasks where period_id = current_setting('test.period_a')::uuid),
  'new period has one copy of the standard checklist'
);
select pg_temp.assert_throws(
  'select public.ensure_period(''00000000-0000-4000-8000-000000000011'', ''2026-11-02'')', '22023'
);

insert into public.close_tasks (organization_id, company_id, period_id, title, position)
values (current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000011', current_setting('test.period_a')::uuid, 'Tarea adicional', 17);
select pg_temp.assert_throws(
  'update public.close_tasks set organization_id = gen_random_uuid()', '42501'
);
select pg_temp.assert_throws(
  'insert into public.audit_events (organization_id, action, entity, entity_id) values (gen_random_uuid(), ''update'', ''fake'', gen_random_uuid())',
  '42501'
);

select set_config('test.doc_a', '00000000-0000-4000-8000-000000000021', true);
select set_config('test.doc_b', '00000000-0000-4000-8000-000000000022', true);
select set_config('test.storage_prefix', concat(
  current_setting('test.org_a'), '/00000000-0000-4000-8000-000000000011/', current_setting('test.period_a'), '/'
), true);
select set_config('test.storage_path', concat(current_setting('test.storage_prefix'), current_setting('test.doc_a')), true);
select set_config('test.unregistered_path', concat(current_setting('test.storage_prefix'), '00000000-0000-4000-8000-000000000023'), true);

select pg_temp.assert_throws($storage$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('accounting-documents', 'invalid/path', current_setting('request.jwt.claim.sub'), '{"size":123,"mimetype":"text/csv"}')
$storage$, '42501');
select pg_temp.assert_throws($storage$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values ('accounting-documents', current_setting('test.storage_path'), '00000000-0000-4000-8000-000000000002', '{"size":123,"mimetype":"text/csv"}')
$storage$, '42501');

insert into storage.objects (bucket_id, name, owner_id, metadata) values
  ('accounting-documents', current_setting('test.storage_path'), current_setting('request.jwt.claim.sub'), '{"size":123,"mimetype":"text/csv"}'),
  ('accounting-documents', current_setting('test.unregistered_path'), current_setting('request.jwt.claim.sub'), '{"size":123,"mimetype":"text/csv"}'),
  (
    'accounting-documents',
    concat(current_setting('test.org_a'), '/00000000-0000-4000-8000-000000000012/', current_setting('test.period_b'), '/', current_setting('test.doc_b')),
    current_setting('request.jwt.claim.sub'),
    '{"size":123,"mimetype":"text/csv"}'
  );

select pg_temp.assert_throws($document$
  insert into public.documents (id, organization_id, company_id, period_id, name, storage_path, mime_type, size_bytes)
  values (
    current_setting('test.doc_a')::uuid, current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000011',
    current_setting('test.period_a')::uuid, 'archivo.csv', current_setting('test.storage_path'), 'text/csv', 100
  )
$document$, '22023');

insert into public.documents (id, organization_id, company_id, period_id, name, storage_path, mime_type, size_bytes) values
  (
    current_setting('test.doc_a')::uuid, current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000011',
    current_setting('test.period_a')::uuid, 'archivo.csv', current_setting('test.storage_path'), 'text/csv', 123
  ), (
    current_setting('test.doc_b')::uuid, current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000012',
    current_setting('test.period_b')::uuid, 'segundo.csv',
    concat(current_setting('test.org_a'), '/00000000-0000-4000-8000-000000000012/', current_setting('test.period_b'), '/', current_setting('test.doc_b')),
    'text/csv', 123
  );

update public.close_tasks set document_id = current_setting('test.doc_a')::uuid
where period_id = current_setting('test.period_a')::uuid and position = 17;
select pg_temp.assert_throws($link$
  update public.close_tasks set document_id = current_setting('test.doc_b')::uuid
  where period_id = current_setting('test.period_a')::uuid
$link$, '23503');

update public.close_tasks set notes = 'Observación privada de noviembre', status = 'review'
where period_id = current_setting('test.period_a')::uuid and position = 17;
select set_config('test.period_next', (
  public.ensure_period('00000000-0000-4000-8000-000000000011', '2026-12-01')
).id::text, true);
select pg_temp.assert_true(
  (select count(*) = 17 from public.close_tasks where period_id = current_setting('test.period_next')::uuid)
  and (
    select title = 'Tarea adicional' and status = 'pending' and notes is null and document_id is null
    from public.close_tasks where period_id = current_setting('test.period_next')::uuid and position = 17
  ),
  'the next month carries the customized structure and resets status and evidence'
);

delete from storage.objects where name = current_setting('test.storage_path');
select pg_temp.assert_true(
  exists(select 1 from storage.objects where name = current_setting('test.storage_path')),
  'a registered object remains immutable'
);

select set_config('test.voucher', '{
  "direction":"purchase", "date":"2026-11-05", "receipt_type":"Factura A", "point_of_sale":"0001",
  "receipt_number":"00000001", "counterparty_cuit":"30700000099", "counterparty_name":"Proveedor de ejemplo",
  "currency":"ARS", "exchange_rate":"1", "taxable":"100.00", "untaxed":"0.00", "exempt":"0.00",
  "vat":"21.00", "other_taxes":"0.00", "total":"121.00", "vat_breakdown":{"21":"21.00"}
}', true);

select pg_temp.assert_true(
  (public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('a', 64), jsonb_build_array(current_setting('test.voucher')::jsonb, current_setting('test.voucher')::jsonb), 2)
  ) @> '{"row_count":1,"duplicate_count":3,"reused":false}',
  'initial import combines duplicate identities and the pre-validated source duplicate count'
);
select pg_temp.assert_true(
  (public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('a', 64), jsonb_build_array(current_setting('test.voucher')::jsonb))
  ) @> '{"row_count":1,"duplicate_count":3,"reused":true}',
  'same file hash returns the original result'
);
select pg_temp.assert_true(
  (public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('b', 64), jsonb_build_array(current_setting('test.voucher')::jsonb || '{"receipt_type":" FACTURA A "}'::jsonb))
  ) @> '{"row_count":0,"duplicate_count":1,"reused":false}',
  'a different file cannot create a duplicate voucher'
);
select pg_temp.assert_true(
  (public.confirm_import(current_setting('test.period_b')::uuid, current_setting('test.doc_b')::uuid, 'purchase',
    repeat('b', 64), jsonb_build_array(current_setting('test.voucher')::jsonb || '{"vat_breakdown":{"21":21}}'::jsonb))
  ) @> '{"row_count":1,"duplicate_count":0}',
  'the same fiscal identity can exist in a different company'
);
select pg_temp.assert_true(
  (select vat_breakdown = '{"21":"21"}'::jsonb from public.vouchers where period_id = current_setting('test.period_b')::uuid),
  'IVA detail amounts are stored as decimal text in JSON'
);

select pg_temp.assert_throws($import$
  select public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_b')::uuid, 'purchase',
    repeat('c', 64), jsonb_build_array(current_setting('test.voucher')::jsonb))
$import$, '22023');
select pg_temp.assert_throws($import$
  select public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('c', 64), jsonb_build_array(current_setting('test.voucher')::jsonb || '{"receipt_number":"2","date":"2026-12-01"}'))
$import$, '22023');
select pg_temp.assert_throws($import$
  select public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('c', 64), jsonb_build_array(
      current_setting('test.voucher')::jsonb || '{"receipt_number":"2"}'::jsonb,
      current_setting('test.voucher')::jsonb || '{"receipt_number":"3","total":"12.345"}'::jsonb
    ))
$import$, '23514');
select pg_temp.assert_throws($import$
  select public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('c', 64), jsonb_build_array(current_setting('test.voucher')::jsonb || '{"receipt_number":"2","total":"999.99"}'))
$import$, '23514');
select pg_temp.assert_throws($import$
  select public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('c', 64), jsonb_build_array(current_setting('test.voucher')::jsonb || '{"receipt_number":"2","vat_breakdown":{"21":"12.00"}}'))
$import$, '22023');
select pg_temp.assert_true(
  not exists(select 1 from public.imports where file_sha256 = repeat('c', 64))
  and not exists(select 1 from public.vouchers where receipt_number in (2, 3)),
  'an invalid row rolls back the entire batch and import history'
);

select pg_temp.assert_true(
  (public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'accounts',
    repeat('d', 64), '[
      {"code":"1.1","name":"Equipamiento","kind":"asset","parent_code":"1"},
      {"code":"1","name":"Activo","kind":"asset"}
    ]'::jsonb)) @> '{"row_count":2,"duplicate_count":0}',
  'an account import accepts child codes before parents in the same batch'
);
set constraints all immediate;
select pg_temp.assert_throws(
  'update public.accounts set parent_code = ''1.1'' where code = ''1''', '23514'
);
select set_config('test.account_a', (
  select id::text from public.accounts where code = '1.1'
), true);
select set_config('test.voucher_a', (
  select id::text from public.vouchers where period_id = current_setting('test.period_a')::uuid
), true);
select pg_temp.assert_throws(
  'select public.save_classification_rule(current_setting(''test.voucher_a'')::uuid)', '22023'
);
select set_config('test.classification', '{
  "account_id":null,"category":null,"concept":null,"cost_center":null,"payment_status":"pending","payment_method":null,
  "deductible_vat":"21.00","notes":null,"review_status":"approved","xubio_status":"pending","document_id":null
}', true);
select pg_temp.assert_throws($classification$
  select public.update_voucher_classification(
    current_setting('test.voucher_a')::uuid, current_setting('test.classification')::jsonb, true
  )
$classification$, '22023');
select pg_temp.assert_true(
  (select review_status = 'pending' and deductible_vat is null
    from public.vouchers where id = current_setting('test.voucher_a')::uuid),
  'an invalid optional classification rule rolls back all voucher changes'
);
select pg_temp.assert_throws($classification$
  select public.update_voucher_classification(
    current_setting('test.voucher_a')::uuid, current_setting('test.classification')::jsonb || '{"total":"0"}'::jsonb
  )
$classification$, '22023');
select pg_temp.assert_true(
  public.update_voucher_classification(
    current_setting('test.voucher_a')::uuid,
    current_setting('test.classification')::jsonb || jsonb_build_object(
      'account_id', current_setting('test.account_a'), 'category', 'Bienes de uso'
    ),
    true
  ) = current_setting('test.voucher_a')::uuid,
  'the application receives the ID of the updated voucher'
);
select pg_temp.assert_true(
  (select category = 'Bienes de uso' and account_id = current_setting('test.account_a')::uuid
    from public.classification_rules where company_id = '00000000-0000-4000-8000-000000000011'),
  'a classification rule is stored in the same transaction'
);
select pg_temp.assert_throws('update public.vouchers set total = 1', '42501');
select pg_temp.assert_throws(
  'update public.vouchers set deductible_vat = 22 where id = current_setting(''test.voucher_a'')::uuid', '23514'
);

insert into public.tax_obligations (organization_id, company_id, period_id, title, due_on, amount)
values (
  current_setting('test.org_a')::uuid, '00000000-0000-4000-8000-000000000011',
  current_setting('test.period_a')::uuid, 'IVA noviembre', '2026-12-10', 1234567890123456.01
);
select pg_temp.assert_true(
  (select amount::text = '1234567890123456.01' from public.tax_obligations where title = 'IVA noviembre'),
  'a monetary value is stored exactly beyond JavaScript safe integer cents'
);

select pg_temp.assert_throws(
  'select public.set_period_status(current_setting(''test.period_a'')::uuid, ''closed'')', '22023'
);
select pg_temp.assert_true(
  (public.set_period_status(current_setting('test.period_a')::uuid, 'closed', 'Pendientes revisados')).status = 'closed',
  'closing with pending tasks records the authorized override'
);
select pg_temp.assert_throws(
  'update public.close_tasks set status = ''completed'' where period_id = current_setting(''test.period_a'')::uuid', '55000'
);
select pg_temp.assert_throws(
  'update public.tax_obligations set status = ''paid'' where period_id = current_setting(''test.period_a'')::uuid', '55000'
);
select pg_temp.assert_throws(
  'update public.accounts set category = ''Otro rubro'' where id = current_setting(''test.account_a'')::uuid', '55000'
);
update public.accounts set name = 'Equipos' where id = current_setting('test.account_a')::uuid;
select pg_temp.assert_throws(
  'select public.set_period_status(current_setting(''test.period_a'')::uuid, ''open'')', '22023'
);
select pg_temp.assert_true(
  (public.set_period_status(current_setting('test.period_a')::uuid, 'open', 'Verificar recibo')).status = 'open',
  'reopening with a reason allows corrections'
);
update public.accounts set category = 'Bienes' where id = current_setting('test.account_a')::uuid;
select pg_temp.assert_true((
  select count(*) = 2 from public.audit_events where period_id = current_setting('test.period_a')::uuid
    and actor_id = current_setting('request.jwt.claim.sub')::uuid
    and ((action = 'close' and details ->> 'reason' = 'Pendientes revisados')
      or (action = 'reopen' and details ->> 'reason' = 'Verificar recibo'))
), 'close and reopen events identify actor and reasons');

update public.companies set status = 'archived' where id = '00000000-0000-4000-8000-000000000011';
select pg_temp.assert_true(
  (public.ensure_period('00000000-0000-4000-8000-000000000011', '2026-11-01')).id = current_setting('test.period_a')::uuid,
  'existing history stays readable for an archived company'
);
select pg_temp.assert_throws(
  'select public.ensure_period(''00000000-0000-4000-8000-000000000011'', ''2027-01-01'')', '55000'
);
select pg_temp.assert_throws(
  'update public.close_tasks set status = ''completed'' where period_id = current_setting(''test.period_a'')::uuid', '55000'
);
update public.companies set status = 'active' where id = '00000000-0000-4000-8000-000000000011';

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000002', true);
select pg_temp.assert_throws(
  'select public.set_organization_member(current_setting(''test.org_a'')::uuid, ''00000000-0000-4000-8000-000000000002'', ''owner'')',
  '42501'
);
update public.close_tasks set status = 'completed' where period_id = current_setting('test.period_a')::uuid and position = 17;
select pg_temp.assert_true(
  (select count(*) = 1 from public.close_tasks where period_id = current_setting('test.period_a')::uuid and status = 'completed'),
  'the editor can update owned organization data'
);
select pg_temp.assert_true(
  not exists(select 1 from storage.objects where name = current_setting('test.unregistered_path')),
  'other editors cannot read an unregistered upload'
);

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select pg_temp.assert_true((
  select count(*) = 2 from public.companies where organization_id = current_setting('test.org_a')::uuid
), 'a viewer can read organizations they belong to');
select pg_temp.assert_true((
  select count(*) = 2 from storage.objects where bucket_id = 'accounting-documents'
), 'a viewer reads registered objects only');
select pg_temp.assert_throws($viewer$
  insert into public.companies (organization_id, legal_name, cuit)
  values (current_setting('test.org_a')::uuid, 'Unauthorized SAS', '30700000014')
$viewer$, '42501');
select pg_temp.assert_throws(
  'select public.ensure_period(''00000000-0000-4000-8000-000000000011'', ''2027-01-01'')', '42501'
);
select pg_temp.assert_throws($viewer$
  select public.update_voucher_classification(
    current_setting('test.voucher_a')::uuid, current_setting('test.classification')::jsonb
  )
$viewer$, '42501');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000004', true);
select set_config('test.org_b', (public.create_organization('Estudio B')).id::text, true);
select pg_temp.assert_true((
  select count(*) = 1 from public.organizations
), 'only the own organization is visible');
select pg_temp.assert_true(
  not exists(select 1 from public.companies)
  and not exists(select 1 from public.close_tasks)
  and not exists(select 1 from public.documents)
  and not exists(select 1 from public.vouchers)
  and not exists(select 1 from public.imports)
  and not exists(select 1 from public.tax_obligations)
  and not exists(select 1 from storage.objects),
  'a different organization cannot read data or documents'
);
select pg_temp.assert_throws(
  'select public.ensure_period(''00000000-0000-4000-8000-000000000011'', ''2026-11-01'')', '42501'
);
select pg_temp.assert_throws($isolated$
  insert into storage.objects (bucket_id, name, owner_id, metadata)
  values (
    'accounting-documents', concat(current_setting('test.storage_prefix'), gen_random_uuid()::text),
    current_setting('request.jwt.claim.sub'), '{"size":123,"mimetype":"text/csv"}'
  )
$isolated$, '42501');
select pg_temp.assert_throws($isolated$
  select public.confirm_import(current_setting('test.period_a')::uuid, current_setting('test.doc_a')::uuid, 'purchase',
    repeat('a', 64), jsonb_build_array(current_setting('test.voucher')::jsonb))
$isolated$, '42501');

select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);
delete from storage.objects where name = current_setting('test.unregistered_path');
select pg_temp.assert_true(
  not exists(select 1 from storage.objects where name = current_setting('test.unregistered_path')),
  'the creator can clean up their unregistered upload'
);

rollback;
