begin;
-- Additive core: existing companies, periods, accounts, vouchers and documents are retained.
create unique index core_document_scope on public.documents(id,company_id,organization_id);
create unique index core_voucher_scope on public.vouchers(id,company_id,organization_id);
create table public.accounting_exercises (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null,
 name text not null check(length(btrim(name)) between 1 and 120), starts_on date not null, ends_on date not null,
 status text not null default 'open' check(status in ('open','closed')), status_reason text not null default '',
 created_at timestamptz not null default now(), check(ends_on>=starts_on),
 foreign key(company_id,organization_id) references public.companies(id,organization_id),
 unique(id,company_id,organization_id),unique(company_id,starts_on,ends_on)
);
create table public.accounting_account_profiles (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null, company_id uuid not null, account_id uuid not null,
 heading text not null default '' check(length(heading)<=120), subheading text not null default '' check(length(subheading)<=120),
 nature text not null check(nature in ('debit','credit')), postable boolean not null default true,
 foreign key(account_id,company_id,organization_id) references public.accounts(id,company_id,organization_id),unique(account_id)
);
create table public.accounting_equivalences (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,account_id uuid not null,
 external_code text not null check(length(btrim(external_code)) between 1 and 80), external_system text not null default 'Xubio' check(external_system='Xubio'),
 foreign key(account_id,company_id,organization_id) references public.accounts(id,company_id,organization_id),unique(company_id,external_system,external_code),unique(account_id,external_system)
);
create table public.accounting_parties (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,cuit text not null check(cuit ~ '^\d{11}$'),
 name text not null check(length(btrim(name)) between 1 and 180),customer boolean not null default false,supplier boolean not null default false,
 active boolean not null default true,check(customer or supplier),
 foreign key(company_id,organization_id) references public.companies(id,organization_id),unique(id,company_id,organization_id),unique(company_id,cuit)
);
create table public.accounting_voucher_parties (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,voucher_id uuid not null,party_id uuid not null,
 foreign key(voucher_id,company_id,organization_id) references public.vouchers(id,company_id,organization_id),
 foreign key(party_id,company_id,organization_id) references public.accounting_parties(id,company_id,organization_id),unique(voucher_id)
);
create table public.accounting_bank_accounts (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,account_id uuid not null,
 bank text not null check(length(btrim(bank)) between 1 and 120),number text not null check(length(number) between 1 and 80),
 currency text not null check(currency ~ '^[A-Z]{3}$'),active boolean not null default true,
 foreign key(account_id,company_id,organization_id) references public.accounts(id,company_id,organization_id),unique(id,company_id,organization_id),unique(company_id,bank,number,currency)
);
create table public.accounting_journal_entries (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,period_id uuid not null,exercise_id uuid not null,
 number bigint not null check(number>0),date date not null,description text not null check(length(btrim(description)) between 1 and 500),
 currency text not null check(currency ~ '^[A-Z]{3}$'),status text not null default 'confirmed' check(status='confirmed'),
 source_key text not null check(length(source_key) between 1 and 200),duplicate_reviewed boolean not null default false,request_hash text not null,content_hash text not null,
 voucher_id uuid,document_id uuid,reversal_of uuid,created_by uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(period_id,company_id,organization_id) references public.periods(id,company_id,organization_id),
 foreign key(exercise_id,company_id,organization_id) references public.accounting_exercises(id,company_id,organization_id),
 foreign key(voucher_id,company_id,organization_id) references public.vouchers(id,company_id,organization_id),
 foreign key(document_id,company_id,organization_id) references public.documents(id,company_id,organization_id),
 unique(id,company_id,organization_id),unique(company_id,source_key),unique(exercise_id,number),unique(reversal_of),
 foreign key(reversal_of,company_id,organization_id) references public.accounting_journal_entries(id,company_id,organization_id)
);
create table public.accounting_journal_lines (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,entry_id uuid not null,
 position integer not null check(position between 1 and 200),account_id uuid not null,party_id uuid,
 debit numeric(18,2) not null check(debit>=0),credit numeric(18,2) not null check(credit>=0),
 check((debit>0)<>(credit>0)),
 foreign key(entry_id,company_id,organization_id) references public.accounting_journal_entries(id,company_id,organization_id),
 foreign key(account_id,company_id,organization_id) references public.accounts(id,company_id,organization_id),
 foreign key(party_id,company_id,organization_id) references public.accounting_parties(id,company_id,organization_id),unique(entry_id,position)
);
create table public.accounting_bank_movements (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,company_id uuid not null,period_id uuid not null,bank_account_id uuid not null,
 date date not null,reference text not null,description text not null,amount numeric(18,2) not null check(amount<>0),
 source_key text not null,entry_id uuid,document_id uuid,
 foreign key(period_id,company_id,organization_id) references public.periods(id,company_id,organization_id),
 foreign key(bank_account_id,company_id,organization_id) references public.accounting_bank_accounts(id,company_id,organization_id),
 foreign key(entry_id,company_id,organization_id) references public.accounting_journal_entries(id,company_id,organization_id),
 foreign key(document_id,company_id,organization_id) references public.documents(id,company_id,organization_id),unique(bank_account_id,source_key)
);
create index accounting_entry_scope on public.accounting_journal_entries(organization_id,company_id,date,number);
create index accounting_content_check on public.accounting_journal_entries(company_id,content_hash);
create index accounting_lines_account on public.accounting_journal_lines(organization_id,company_id,account_id,entry_id);

create table public.accounting_change_history (
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),company_id uuid not null,
 actor_id uuid references auth.users(id),entity text not null,entity_id uuid not null,action text not null check(action in ('INSERT','UPDATE','DELETE')),
 before_data jsonb,after_data jsonb,recorded_at timestamptz not null default now(),
 foreign key(company_id,organization_id) references public.companies(id,organization_id)
);
create index accounting_history_scope on public.accounting_change_history(organization_id,company_id,entity_id,recorded_at);
alter table public.accounting_change_history enable row level security;
revoke all on public.accounting_change_history from public,anon,authenticated;
grant select on public.accounting_change_history to authenticated;
create policy core_history_read on public.accounting_change_history for select to authenticated using(accounting_private.organization_role(organization_id) is not null);
create function accounting_private.core_history() returns trigger language plpgsql security definer set search_path='' as $$
declare before_row jsonb:=case when tg_op<>'INSERT' then to_jsonb(old) end;after_row jsonb:=case when tg_op<>'DELETE' then to_jsonb(new) end;scope jsonb:=coalesce(after_row,before_row);begin
 if before_row is not distinct from after_row then return null;end if;
 insert into public.accounting_change_history(organization_id,company_id,actor_id,entity,entity_id,action,before_data,after_data)
 values((scope->>'organization_id')::uuid,(scope->>'company_id')::uuid,auth.uid(),tg_table_name,(scope->>'id')::uuid,tg_op,before_row,after_row);return null;
end $$;
create trigger core_account_history after insert or update or delete on public.accounts for each row execute function accounting_private.core_history();

-- Only controlled RPCs may write. Existing audit captures changes and actor.
do $$ declare t text; begin
 foreach t in array array['accounting_exercises','accounting_account_profiles','accounting_equivalences','accounting_parties','accounting_voucher_parties','accounting_bank_accounts','accounting_journal_entries','accounting_journal_lines','accounting_bank_movements'] loop
  execute format('alter table public.%I enable row level security',t);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('grant select on public.%I to authenticated',t);
  execute format('create policy core_read on public.%I for select to authenticated using (accounting_private.organization_role(organization_id) is not null)',t);
  execute format('create trigger core_audit after insert or update or delete on public.%I for each row execute function accounting_private.audit_row()',t);
  execute format('create trigger core_snapshot after insert or update or delete on public.%I for each row execute function accounting_private.core_history()',t);
 end loop;
end $$;

create function accounting_private.core_immutable() returns trigger language plpgsql set search_path='' as $$ begin
 raise exception using message='Asiento confirmado inmutable. Generá una reversión.',errcode='55000';
end $$;
create trigger core_history_immutable before update or delete on public.accounting_change_history for each row execute function accounting_private.core_immutable();
create trigger core_entry_immutable before update or delete on public.accounting_journal_entries for each row execute function accounting_private.core_immutable();
create trigger core_line_immutable before update or delete on public.accounting_journal_lines for each row execute function accounting_private.core_immutable();
create trigger core_bank_immutable before update or delete on public.accounting_bank_movements for each row execute function accounting_private.core_immutable();

create function public.create_accounting_exercise(target_company uuid,exercise_name text,start_date date,end_date date) returns uuid
language plpgsql security definer set search_path='' as $$ declare c public.companies;r uuid; begin
 select * into c from public.companies where id=target_company;
 if c.id is null or coalesce(accounting_private.organization_role(c.organization_id),'') not in ('owner','editor') then raise exception using errcode='42501',message='Sin permiso.';end if;
 perform accounting_private.lock_active_company(c.id,c.organization_id);
 perform pg_advisory_xact_lock(hashtextextended(c.id::text,27));
 if exists(select 1 from public.accounting_exercises where company_id=c.id and starts_on<=end_date and ends_on>=start_date) then raise exception using errcode='23514',message='El ejercicio se superpone con otro existente.';end if;
 insert into public.accounting_exercises(organization_id,company_id,name,starts_on,ends_on) values(c.organization_id,c.id,exercise_name,start_date,end_date) returning id into r;return r;
end $$;

create function public.save_accounting_profile(target_account uuid,heading text,subheading text,nature text,postable boolean,xubio_code text default null) returns uuid
language plpgsql security definer set search_path='' as $$ declare a public.accounts;r uuid;p public.accounting_account_profiles;begin
 select * into a from public.accounts where id=target_account;
 if a.id is null or coalesce(accounting_private.organization_role(a.organization_id),'') not in ('owner','editor') then raise exception using errcode='42501',message='Sin permiso.';end if;
 perform accounting_private.lock_active_company(a.company_id,a.organization_id);
 perform pg_advisory_xact_lock(hashtextextended(a.company_id::text,27));
 select * into p from public.accounting_account_profiles where account_id=a.id;
 if exists(select 1 from public.accounting_journal_lines where account_id=a.id) and (coalesce(p.nature,case when a.kind in ('asset','cost','expense') then 'debit' else 'credit' end),coalesce(p.postable,true)) is distinct from (nature,postable) then
 raise exception using errcode='55000',message='La cuenta tiene movimientos confirmados. Conservá su clasificación histórica.';end if;
 insert into public.accounting_account_profiles(organization_id,company_id,account_id,heading,subheading,nature,postable) values(a.organization_id,a.company_id,a.id,heading,subheading,nature,postable)
 on conflict(account_id) do update set heading=excluded.heading,subheading=excluded.subheading,nature=excluded.nature,postable=excluded.postable returning id into r;
 if nullif(btrim(xubio_code),'') is null then delete from public.accounting_equivalences where account_id=a.id;
 else insert into public.accounting_equivalences(organization_id,company_id,account_id,external_code) values(a.organization_id,a.company_id,a.id,btrim(xubio_code))
 on conflict(account_id,external_system) do update set external_code=excluded.external_code;end if;
 return r;
end $$;

create function accounting_private.core_digest(value jsonb) returns text language sql immutable set search_path='' as $$ select encode(sha256(convert_to(value::text,'UTF8')),'hex') $$;

create function accounting_private.post_core_entry(target_period uuid,target_exercise uuid,entry_date date,concept text,source text,entry_lines jsonb,related_voucher uuid,related_document uuid,reverse_entry uuid,allow_duplicate boolean)
returns uuid language plpgsql security definer set search_path='' as $$
declare p public.periods;e public.accounting_exercises;c public.companies;old public.accounting_journal_entries;a public.accounts; l jsonb; r uuid; n bigint; d numeric:=0; h numeric:=0; fingerprint text; contents text;pos int:=0; begin
 select * into p from public.periods where id=target_period;
 if p.id is null or coalesce(accounting_private.organization_role(p.organization_id),'') not in ('owner','editor') then raise exception using errcode='42501',message='Sin permiso de contabilizar.';end if;
 if jsonb_typeof(entry_lines) is distinct from 'array' or jsonb_array_length(entry_lines) not between 2 and 200 or length(btrim(concept)) not between 1 and 500 or source is null or length(source) not between 1 and 200 then raise exception using errcode='23514',message='Cabecera o líneas inválidas.';end if;
 contents:=accounting_private.core_digest(jsonb_build_object('date',entry_date,'lines',(select jsonb_agg(jsonb_build_array(x->>'account_id',x->>'party_id',(x->>'debit')::numeric(18,2),(x->>'credit')::numeric(18,2)) order by x->>'account_id',x->>'party_id',(x->>'debit')::numeric(18,2),(x->>'credit')::numeric(18,2)) from jsonb_array_elements(entry_lines) x)));
 fingerprint:=accounting_private.core_digest(jsonb_build_object('period',target_period,'exercise',target_exercise,'date',entry_date,'concept',concept,'content',contents,'voucher',related_voucher,'document',related_document,'reverse',reverse_entry));
 select * into old from public.accounting_journal_entries where company_id=p.company_id and source_key=source;
 if old.id is not null then
  if old.request_hash<>fingerprint then raise exception using errcode='23514',message='La clave ya pertenece a otro asiento.';end if;return old.id;
 end if;
 perform accounting_private.lock_open_period(p.id,p.company_id,p.organization_id);
 perform pg_advisory_xact_lock(hashtextextended(p.company_id::text,27));
 select * into old from public.accounting_journal_entries where company_id=p.company_id and source_key=source;
 if old.id is not null then if old.request_hash<>fingerprint then raise exception using errcode='23514',message='Clave reutilizada con otros datos.';end if;return old.id;end if;
 select * into e from public.accounting_exercises where id=target_exercise and company_id=p.company_id and organization_id=p.organization_id for share;
 select * into c from public.companies where id=p.company_id;
 if e.id is null or e.status<>'open' or entry_date is null or entry_date<e.starts_on or entry_date>e.ends_on or entry_date<p.month or entry_date>=p.month+interval '1 month' then raise exception using errcode='23514',message='Fecha fuera del ejercicio/período abierto.';end if;
 if related_voucher is not null and not exists(select 1 from public.vouchers where id=related_voucher and company_id=p.company_id and organization_id=p.organization_id and currency=c.currency and date<=entry_date) then raise exception using errcode='23514',message='Comprobante fuera de alcance.';end if;
 if related_document is not null and not exists(select 1 from public.documents where id=related_document and company_id=p.company_id and organization_id=p.organization_id) then raise exception using errcode='23514',message='Documento fuera de alcance.';end if;
 if reverse_entry is null and not allow_duplicate and exists(select 1 from public.accounting_journal_entries where company_id=p.company_id and content_hash=contents) then raise exception using errcode='23505',message='Posible asiento duplicado. Revisá el Diario y confirmá la excepción.';end if;
 for l in select * from jsonb_array_elements(entry_lines) loop
  if jsonb_typeof(l->'debit') is distinct from 'string' or jsonb_typeof(l->'credit') is distinct from 'string' or coalesce(l->>'debit','')!~ '^[0-9]{1,14}([.][0-9]{1,2})?$' or coalesce(l->>'credit','')!~ '^[0-9]{1,14}([.][0-9]{1,2})?$' or ((l->>'debit')::numeric>0)=((l->>'credit')::numeric>0) then raise exception using errcode='23514',message='Cada línea requiere Debe o Haber exacto y positivo.';end if;
  select * into a from public.accounts where id=(l->>'account_id')::uuid and company_id=p.company_id and organization_id=p.organization_id for share;
  if a.id is null or (a.status<>'active' and reverse_entry is null) or exists(select 1 from public.accounts where company_id=p.company_id and parent_code=a.code) or exists(select 1 from public.accounting_account_profiles where account_id=a.id and not postable) then raise exception using errcode='23514',message='Cuenta ajena, inactiva o agrupadora.';end if;
  if l->>'party_id' is not null and not exists(select 1 from public.accounting_parties where id=(l->>'party_id')::uuid and company_id=p.company_id and organization_id=p.organization_id and active) then raise exception using errcode='23514',message='Contraparte fuera de alcance.';end if;
  d:=d+(l->>'debit')::numeric;h:=h+(l->>'credit')::numeric;
 end loop;
 if d<>h or d<=0 or (select count(distinct x->>'account_id') from jsonb_array_elements(entry_lines) x)<2 then raise exception using errcode='23514',message='El asiento no balancea o no tiene cuentas distintas.';end if;
 select coalesce(max(number),0)+1 into n from public.accounting_journal_entries where exercise_id=e.id;
 insert into public.accounting_journal_entries(organization_id,company_id,period_id,exercise_id,number,date,description,currency,source_key,duplicate_reviewed,request_hash,content_hash,voucher_id,document_id,reversal_of,created_by)
 values(p.organization_id,p.company_id,p.id,e.id,n,entry_date,concept,c.currency,source,(coalesce(allow_duplicate,false) and reverse_entry is null),fingerprint,contents,related_voucher,related_document,reverse_entry,auth.uid()) returning id into r;
 for l in select * from jsonb_array_elements(entry_lines) loop
  pos:=pos+1;
  insert into public.accounting_journal_lines(organization_id,company_id,entry_id,position,account_id,party_id,debit,credit) values(p.organization_id,p.company_id,r,pos,(l->>'account_id')::uuid,(l->>'party_id')::uuid,(l->>'debit')::numeric,(l->>'credit')::numeric);
 end loop;
 return r;
end $$;

create function public.post_accounting_entry(target_period uuid,target_exercise uuid,entry_date date,concept text,source text,entry_lines jsonb,related_voucher uuid default null,related_document uuid default null,allow_duplicate boolean default false) returns uuid
language sql security invoker set search_path='' as $$ select accounting_private.post_core_entry(target_period,target_exercise,entry_date,concept,source,entry_lines,related_voucher,related_document,null,allow_duplicate) $$;
-- The private implementation is only callable through security-definer public wrappers.
alter function public.post_accounting_entry(uuid,uuid,date,text,text,jsonb,uuid,uuid,boolean) security definer;
create function public.reverse_accounting_entry(target_entry uuid,target_period uuid,target_exercise uuid,entry_date date,reason text,source text) returns uuid
language plpgsql security definer set search_path='' as $$ declare original public.accounting_journal_entries;lines jsonb;p public.periods;begin
 select * into original from public.accounting_journal_entries where id=target_entry;
 select * into p from public.periods where id=target_period;
 if original.id is null or p.id is null or p.company_id<>original.company_id or p.organization_id<>original.organization_id or coalesce(accounting_private.organization_role(original.organization_id),'') not in ('owner','editor') then raise exception using errcode='42501',message='Reversión fuera de alcance.';end if;
 if original.reversal_of is not null or entry_date<original.date or length(btrim(reason))<5 then raise exception using errcode='23514',message='Revisá fecha, asiento original y motivo de reversión.';end if;
 select jsonb_agg(jsonb_build_object('account_id',account_id,'party_id',party_id,'debit',credit::text,'credit',debit::text) order by position) into lines from public.accounting_journal_lines where entry_id=original.id;
 return accounting_private.post_core_entry(p.id,target_exercise,entry_date,'Reversión #'||original.number||': '||reason,source,lines,original.voucher_id,original.document_id,original.id,true);
end $$;

create function public.set_accounting_exercise_status(target_exercise uuid,new_status text,reason text) returns uuid language plpgsql security definer set search_path='' as $$ declare e public.accounting_exercises;begin
 select * into e from public.accounting_exercises where id=target_exercise;
 if e.id is null or coalesce(accounting_private.organization_role(e.organization_id),'') not in ('owner','editor') then raise exception using errcode='42501',message='Sin permiso.';end if;
 perform accounting_private.lock_active_company(e.company_id,e.organization_id);perform pg_advisory_xact_lock(hashtextextended(e.company_id::text,27));
 if new_status not in ('open','closed') or length(btrim(reason))<5 then raise exception using errcode='23514',message='Ingresá estado y motivo.';end if;
 if new_status='closed' and exists(select 1 from public.periods where company_id=e.company_id and month<=e.ends_on and month+interval '1 month'>e.starts_on and status='open') then raise exception using errcode='55000',message='Primero cerrá los períodos abiertos del ejercicio.';end if;
 update public.accounting_exercises set status=new_status,status_reason=reason where id=e.id;return e.id;
end $$;

create function accounting_private.guard_core_account() returns trigger language plpgsql security definer set search_path='' as $$ begin
 if tg_op='UPDATE' and (old.kind,old.parent_code) is distinct from (new.kind,new.parent_code) and exists(select 1 from public.accounting_journal_lines where account_id=old.id) then raise exception using errcode='55000',message='Clasificación histórica de cuenta con Diario confirmado.';end if;
 if new.parent_code is not null and exists(select 1 from public.accounts a join public.accounting_journal_lines l on l.account_id=a.id where a.company_id=new.company_id and a.code=new.parent_code) then raise exception using errcode='55000',message='La cuenta superior ya tiene movimientos confirmados.';end if;
 return new;
end $$;
create trigger c_guard_core_account before insert or update on public.accounts for each row execute function accounting_private.guard_core_account();

-- Enforce complete entries even for privileged maintenance/import scripts.
create function accounting_private.core_balance_constraint() returns trigger language plpgsql security definer set search_path='' as $$ declare target uuid:=(to_jsonb(new)->>(case when tg_table_name='accounting_journal_entries' then 'id' else 'entry_id' end))::uuid;d numeric;h numeric;n int;begin
 select count(*),sum(debit),sum(credit) into n,d,h from public.accounting_journal_lines where entry_id=target;
 if n<2 or coalesce(d,0)<=0 or d<>h then raise exception using errcode='23514',message='Asiento incompleto o desbalanceado.';end if;return null;
end $$;
create constraint trigger core_balanced_entry after insert on public.accounting_journal_entries deferrable initially deferred for each row execute function accounting_private.core_balance_constraint();
create constraint trigger core_balanced_lines after insert on public.accounting_journal_lines deferrable initially deferred for each row execute function accounting_private.core_balance_constraint();

do $$ declare r record;begin
 for r in select p.oid::regprocedure as signature,p.pronamespace::regnamespace::text as ns from pg_proc p where p.proname in ('create_accounting_exercise','save_accounting_profile','post_accounting_entry','reverse_accounting_entry','set_accounting_exercise_status','post_core_entry','core_history','core_digest','core_immutable','guard_core_account','core_balance_constraint') and p.pronamespace in ('public'::regnamespace,'accounting_private'::regnamespace) loop
  execute format('revoke execute on function %s from public,anon,authenticated',r.signature);
  if r.ns='public' then execute format('grant execute on function %s to authenticated',r.signature);end if;
 end loop;
end $$;
notify pgrst,'reload schema';

commit;
