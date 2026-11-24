create schema if not exists accounting_private;
revoke all on schema accounting_private from public, anon, authenticated;
grant usage on schema accounting_private to authenticated;

create domain public.accounting_money as numeric
  check (scale(value) <= 2 and value between -9999999999999999.99 and 9999999999999999.99);

create domain public.accounting_exchange_rate as numeric
  check (scale(value) <= 6 and value > 0 and value < 1000000000000);

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(btrim(name)) between 1 and 150),
  locale text not null default 'es-AR' check (locale ~ '^[a-z]{2,3}(-[A-Z]{2})?$'),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  timezone text not null default 'America/Argentina/Tucuman' check (char_length(timezone) between 1 and 100),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.organization_members (
  organization_id uuid not null references public.organizations(id),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('owner', 'editor', 'viewer')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (organization_id, user_id)
);

create index organization_members_by_user on public.organization_members(user_id, organization_id);

create table public.companies (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  legal_name text not null check (char_length(btrim(legal_name)) between 1 and 180),
  trade_name text check (char_length(trade_name) <= 180),
  cuit text not null check (cuit ~ '^[0-9]{11}$'),
  entity_type text check (char_length(entity_type) <= 100),
  activity text check (char_length(activity) <= 300),
  tax_address text check (char_length(tax_address) <= 500),
  province text check (char_length(province) <= 100),
  vat_status text check (char_length(vat_status) <= 100),
  gross_income_regime text check (char_length(gross_income_regime) <= 150),
  start_date date,
  fiscal_year_end text check (
    fiscal_year_end is null or case when fiscal_year_end ~ '^(0[1-9]|1[0-2])-(0[1-9]|[12][0-9]|3[01])$'
      then to_char(('2000-' || fiscal_year_end)::date, 'MM-DD') = fiscal_year_end
      else false
    end
  ),
  employee_count integer default 0 check (employee_count >= 0),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  tax_obligations text check (char_length(tax_obligations) <= 4000),
  notes text check (char_length(notes) <= 4000),
  status text not null default 'active' check (status in ('active', 'archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, organization_id),
  unique (organization_id, cuit)
);

create index companies_by_org_status on public.companies(organization_id, status, legal_name);

create table public.periods (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  month date not null check (month between date '1900-01-01' and date '2200-12-01' and extract(day from month) = 1),
  status text not null default 'open' check (status in ('open', 'closed')),
  status_reason text check (char_length(status_reason) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, organization_id) references public.companies(id, organization_id),
  unique (id, company_id, organization_id),
  unique (company_id, month)
);

create index periods_by_org_month on public.periods(organization_id, month desc);

create table public.documents (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  period_id uuid not null,
  name text not null check (
    char_length(btrim(name)) between 1 and 255 and name !~ '[[:cntrl:]]' and strpos(name, '/') = 0 and strpos(name, chr(92)) = 0
  ),
  category text not null default 'general' check (char_length(btrim(category)) between 1 and 100),
  storage_path text not null unique check (
    storage_path = organization_id::text || '/' || company_id::text || '/' || period_id::text || '/' || id::text
  ),
  mime_type text not null check (mime_type in (
    'application/pdf', 'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'text/csv', 'image/png', 'image/jpeg', 'application/octet-stream'
  )),
  size_bytes integer not null check (size_bytes between 1 and 10485760),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  foreign key (period_id, company_id, organization_id) references public.periods(id, company_id, organization_id),
  unique (id, period_id, company_id, organization_id)
);

create index documents_by_period on public.documents(organization_id, company_id, period_id, created_at desc);

create table public.close_tasks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  period_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  position integer not null default 0 check (position >= 0),
  status text not null default 'pending' check (status in (
    'pending', 'in_progress', 'waiting', 'review', 'completed', 'not_applicable'
  )),
  notes text check (char_length(notes) <= 4000),
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (period_id, company_id, organization_id) references public.periods(id, company_id, organization_id),
  foreign key (document_id, period_id, company_id, organization_id)
    references public.documents(id, period_id, company_id, organization_id)
);

create index close_tasks_by_period on public.close_tasks(organization_id, company_id, period_id, position, id);

create table public.imports (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  period_id uuid not null,
  document_id uuid not null,
  kind text not null check (kind in ('purchase', 'sale', 'accounts')),
  file_sha256 text not null check (file_sha256 ~ '^[0-9a-f]{64}$'),
  input_count integer not null check (input_count between 1 and 5000),
  row_count integer not null default 0 check (row_count >= 0),
  duplicate_count integer not null default 0 check (duplicate_count >= 0 and row_count + duplicate_count <= input_count),
  created_at timestamptz not null default now(),
  created_by uuid default auth.uid(),
  foreign key (document_id, period_id, company_id, organization_id)
    references public.documents(id, period_id, company_id, organization_id),
  unique (id, period_id, company_id, organization_id),
  unique (period_id, kind, file_sha256)
);

create index imports_by_period on public.imports(organization_id, company_id, period_id, created_at desc);

create table public.accounts (
  id uuid primary key default gen_random_uuid(),
  company_id uuid not null,
  organization_id uuid not null,
  code text not null check (code = btrim(code) and char_length(code) between 1 and 80),
  name text not null check (char_length(btrim(name)) between 1 and 180),
  kind text not null check (kind in ('asset', 'liability', 'equity', 'revenue', 'cost', 'expense')),
  parent_code text check (parent_code <> code),
  category text check (char_length(category) <= 150),
  status text not null default 'active' check (status in ('active', 'inactive')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, organization_id) references public.companies(id, organization_id),
  unique (id, company_id, organization_id),
  unique (company_id, code),
  foreign key (company_id, parent_code) references public.accounts(company_id, code) deferrable initially deferred
);

create index accounts_by_org_company on public.accounts(organization_id, company_id, code);

create table public.vouchers (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  period_id uuid not null,
  source_import_id uuid,
  direction text not null check (direction in ('purchase', 'sale')),
  date date not null,
  receipt_type text not null check (char_length(btrim(receipt_type)) between 1 and 120),
  point_of_sale integer not null check (point_of_sale between 1 and 99999),
  receipt_number integer not null check (receipt_number between 1 and 99999999),
  counterparty_cuit text check (counterparty_cuit ~ '^[0-9]{11}$'),
  counterparty_name text not null check (char_length(btrim(counterparty_name)) between 1 and 250),
  currency text not null default 'ARS' check (currency ~ '^[A-Z]{3}$'),
  exchange_rate public.accounting_exchange_rate not null default 1,
  taxable public.accounting_money not null default 0,
  untaxed public.accounting_money not null default 0,
  exempt public.accounting_money not null default 0,
  vat public.accounting_money not null default 0,
  other_taxes public.accounting_money not null default 0,
  total public.accounting_money not null,
  vat_breakdown jsonb not null default '{}'::jsonb check (jsonb_typeof(vat_breakdown) = 'object'),
  account_id uuid,
  category text check (char_length(category) <= 150),
  concept text check (char_length(concept) <= 300),
  cost_center text check (char_length(cost_center) <= 150),
  payment_status text not null default 'pending' check (payment_status in ('pending', 'partial', 'settled')),
  payment_method text check (char_length(payment_method) <= 150),
  deductible_vat public.accounting_money,
  notes text check (char_length(notes) <= 4000),
  review_status text not null default 'pending' check (review_status in ('pending', 'review', 'approved')),
  xubio_status text not null default 'pending' check (xubio_status in ('pending', 'registered')),
  document_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (direction <> 'purchase' or counterparty_cuit is not null),
  constraint vouchers_ars_single_rate check (currency <> 'ARS' or exchange_rate = 1),
  constraint vouchers_total_matches_components check (total = taxable + untaxed + exempt + vat + other_taxes),
  check (deductible_vat is null or (
    direction = 'purchase' and deductible_vat between least(0, vat) and greatest(0, vat)
  )),
  foreign key (period_id, company_id, organization_id) references public.periods(id, company_id, organization_id),
  foreign key (source_import_id, period_id, company_id, organization_id)
    references public.imports(id, period_id, company_id, organization_id),
  foreign key (account_id, company_id, organization_id) references public.accounts(id, company_id, organization_id),
  foreign key (document_id, period_id, company_id, organization_id)
    references public.documents(id, period_id, company_id, organization_id)
);

create unique index vouchers_purchase_identity on public.vouchers(
  company_id, lower(btrim(receipt_type)), point_of_sale, receipt_number, counterparty_cuit
) where direction = 'purchase';

create unique index vouchers_sale_identity on public.vouchers(
  company_id, lower(btrim(receipt_type)), point_of_sale, receipt_number
) where direction = 'sale';

create index vouchers_by_period on public.vouchers(organization_id, company_id, period_id, direction, date desc);
create index vouchers_by_account_period on public.vouchers(account_id, period_id) where account_id is not null;

create table public.classification_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  direction text not null check (direction in ('purchase', 'sale')),
  counterparty_cuit text not null check (counterparty_cuit ~ '^[0-9]{11}$'),
  account_id uuid,
  category text check (char_length(category) <= 150),
  concept text check (char_length(concept) <= 300),
  cost_center text check (char_length(cost_center) <= 150),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (company_id, organization_id) references public.companies(id, organization_id),
  foreign key (account_id, company_id, organization_id) references public.accounts(id, company_id, organization_id),
  unique (company_id, direction, counterparty_cuit)
);

create index classification_rules_by_org_company on public.classification_rules(organization_id, company_id);

create table public.tax_obligations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null,
  company_id uuid not null,
  period_id uuid not null,
  title text not null check (char_length(btrim(title)) between 1 and 180),
  due_on date not null,
  amount public.accounting_money,
  status text not null default 'pending' check (status in ('pending', 'filed', 'paid', 'not_applicable')),
  filed_on date,
  paid_on date,
  document_id uuid,
  notes text check (char_length(notes) <= 4000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  foreign key (period_id, company_id, organization_id) references public.periods(id, company_id, organization_id),
  foreign key (document_id, period_id, company_id, organization_id)
    references public.documents(id, period_id, company_id, organization_id),
  check (amount is null or amount >= 0)
);

create index tax_obligations_by_org_due_on on public.tax_obligations(organization_id, due_on);
create index tax_obligations_by_period on public.tax_obligations(organization_id, company_id, period_id, due_on);

create table public.audit_events (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations(id),
  company_id uuid,
  period_id uuid,
  actor_id uuid,
  action text not null check (action in ('insert', 'update', 'delete', 'close', 'reopen', 'confirm')),
  entity text not null,
  entity_id uuid not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index audit_events_by_org on public.audit_events(organization_id, created_at desc, id desc);
create index audit_events_by_period on public.audit_events(organization_id, company_id, period_id, created_at desc);
