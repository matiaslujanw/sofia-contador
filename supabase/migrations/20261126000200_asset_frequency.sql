-- Extend the book validation with monthly/annual schedules; retain prior history.
create or replace function public.save_book_record(target_period uuid, record_payload jsonb, target_id uuid default null)
returns uuid language plpgsql security definer set search_path='' as $$
declare
 p public.periods; c public.companies; old_row public.book_records; related public.book_records;
 v public.vouchers; k text:=record_payload->>'kind'; item record; l jsonb; account_ids uuid[]:='{}';
 total_debit numeric:=0; total_credit numeric:=0; paid numeric:=0; amt numeric; cash_signed numeric;
 result_id uuid:=coalesce(target_id,gen_random_uuid()); asset_months int; asset_stop int; current_count int; previous_count int; expected numeric;
begin
 select * into p from public.periods where id=target_period;
 if p.id is null or coalesce(accounting_private.organization_role(p.organization_id),'') not in ('owner','editor') then raise exception using message='Sin permiso de escritura.',errcode='42501'; end if;
 perform accounting_private.lock_open_period(p.id,p.company_id,p.organization_id);
 perform pg_advisory_xact_lock(hashtextextended(p.company_id::text,1));
 select * into c from public.companies where id=p.company_id;
 if jsonb_typeof(record_payload)<>'object' or k is null or k not in ('opening','cash','accrual','statement','bank_balance','asset','journal')
 or coalesce(length(record_payload->>'description'),0) not between 1 and 180
 or coalesce(length(record_payload->>'reference'),0) not between 1 and 180
 or (record_payload->>'currency') is distinct from c.currency
 or coalesce(record_payload->>'date','') !~ '^\d{4}-\d{2}-\d{2}$'
 or (record_payload->>'date')::date<p.month or (record_payload->>'date')::date>=p.month+interval '1 month'
 then raise exception using message='Datos, moneda o fecha inválidos.',errcode='22023'; end if;
 if record_payload->>'document_id' is not null and not exists(select 1 from public.documents where id=(record_payload->>'document_id')::uuid and period_id=p.id and company_id=p.company_id and organization_id=p.organization_id) then raise exception using message='Respaldo fuera de alcance.',errcode='23514'; end if;
 if target_id is not null then
   select * into old_row from public.book_records where id=target_id and period_id=p.id and company_id=p.company_id and not voided for update;
   if old_row.id is null or k<>'statement' or old_row.payload->>'kind'<>'statement' or (old_row.payload-'match_id') is distinct from (record_payload-'match_id') then raise exception using message='Registro inmutable; anular y volver a cargar.',errcode='23514'; end if;
 end if;
 for item in select key,value from jsonb_each_text(record_payload) loop
   if item.key not in ('lines','life_months') and jsonb_typeof(record_payload->item.key) not in ('string','null') then raise exception using message='Los textos e importes deben conservarse como texto.',errcode='23514'; end if;
   if item.key in ('amount','cost','residual','opening_balance','closing_balance') and (item.value is null or item.value !~ '^-?[0-9]{1,14}([.][0-9]{1,2})?$') then raise exception using message='Importe inválido.',errcode='22023'; end if;
   if item.key like '%\_account_id' escape '\' and item.value is not null then account_ids:=array_append(account_ids,item.value::uuid); end if;
 end loop;
 if k='journal' then
   if jsonb_typeof(record_payload->'lines') is distinct from 'array' or jsonb_array_length(record_payload->'lines') not between 2 and 100 or coalesce(length(record_payload->>'source_key'),0) not between 1 and 200 then raise exception using message='Líneas inválidas.',errcode='23514'; end if;
   for l in select * from jsonb_array_elements(record_payload->'lines') loop
     if jsonb_typeof(l->'debit') is distinct from 'string' or jsonb_typeof(l->'credit') is distinct from 'string' or jsonb_typeof(l->'account_id') is distinct from 'string' or coalesce(l->>'debit','') !~ '^[0-9]{1,14}([.][0-9]{1,2})?$' or coalesce(l->>'credit','') !~ '^[0-9]{1,14}([.][0-9]{1,2})?$' or ((l->>'debit')::numeric>0)=((l->>'credit')::numeric>0) or l->>'account_id' is null then raise exception using message='Línea inválida.',errcode='23514'; end if;
     account_ids:=array_append(account_ids,(l->>'account_id')::uuid);
     total_debit:=total_debit+(l->>'debit')::numeric; total_credit:=total_credit+(l->>'credit')::numeric;
   end loop;
   if total_debit<>total_credit or total_debit<=0 then raise exception using message='Asiento desbalanceado.',errcode='23514'; end if;
 elsif k='bank_balance' then
   if record_payload->>'opening_balance' is null or record_payload->>'closing_balance' is null then raise exception using message='Faltan saldos.',errcode='23514'; end if;
 elsif k='asset' then
   if record_payload->>'cost' is null or record_payload->>'residual' is null or (record_payload->>'cost')::numeric<=0 or (record_payload->>'residual')::numeric<0 or (record_payload->>'residual')::numeric >= (record_payload->>'cost')::numeric
    or coalesce(record_payload->>'life_months','') !~ '^[0-9]+$' or (record_payload->>'life_months')::int not between 1 and 1200 or record_payload->>'service_on' is null
    or ((record_payload->>'disposal_on') is not null and (record_payload->>'disposal_on')::date<(record_payload->>'service_on')::date)
    then raise exception using message='Bien de uso inválido.',errcode='23514'; end if;
   if not exists(select 1 from public.accounts where id=(record_payload->>'expense_account_id')::uuid and kind in ('cost','expense')) or not exists(select 1 from public.accounts where id=(record_payload->>'accumulated_account_id')::uuid and kind='asset') then raise exception using message='Cuentas de amortización inválidas.',errcode='23514'; end if;
 else
   if record_payload->>'amount' is null then raise exception using message='Falta importe.',errcode='23514'; end if;
   amt:=(record_payload->>'amount')::numeric;
   if amt=0 or (k in ('cash','accrual') and amt<0) then raise exception using message='Importe inválido.',errcode='23514'; end if;
 end if;
 if k in ('cash','statement','bank_balance') then
   if record_payload->>'cash_account_id' is null or not exists(select 1 from public.accounts where id=(record_payload->>'cash_account_id')::uuid and kind='asset') then raise exception using message='Caja o banco debe ser activo.',errcode='23514'; end if;
 end if;
 if k='opening' then
   if coalesce(record_payload->>'role','') not in ('customer','supplier') or coalesce(record_payload->>'cuit','') !~ '^[0-9]{11}$' or coalesce(length(record_payload->>'name'),0)=0 or record_payload->>'control_account_id' is null or record_payload->>'offset_account_id' is null then raise exception using message='Saldo inicial inválido.',errcode='23514'; end if;
 elsif k='accrual' then
   if coalesce(record_payload->>'tax','') not in ('IVA','IIBB','TEM','Sueldos','Cargas sociales') or record_payload->>'due_on' is null or record_payload->>'debit_account_id' is null or record_payload->>'credit_account_id' is null then raise exception using message='Devengamiento inválido.',errcode='23514'; end if;
   perform (record_payload->>'due_on')::date;
 elsif k='cash' then
   if coalesce(record_payload->>'flow','') not in ('in','out') or coalesce(record_payload->>'role','') not in ('customer','supplier','other') or record_payload->>'counterpart_account_id' is null or coalesce(record_payload->>'category','') not in ('commercial','commission','interest','vat','vat_withholding','vat_perception','iibb_withholding','iibb_perception','transfer','partners','tax','other') then raise exception using message='Movimiento inválido.',errcode='23514'; end if;
   if (record_payload->>'role'='customer' and record_payload->>'flow'<>'in') or (record_payload->>'role'='supplier' and record_payload->>'flow'<>'out') or (record_payload->>'role'<>'other' and coalesce(record_payload->>'cuit','') !~ '^[0-9]{11}$') then raise exception using message='Contraparte inválida.',errcode='23514'; end if;
   if record_payload->>'voucher_id' is not null then
     select * into v from public.vouchers where id=(record_payload->>'voucher_id')::uuid and company_id=p.company_id and organization_id=p.organization_id;
     if v.id is null or v.currency<>c.currency or v.counterparty_cuit is distinct from record_payload->>'cuit' or v.date>(record_payload->>'date')::date or v.total<=0 or (case when v.direction='sale' then 'customer' else 'supplier' end)<>record_payload->>'role' then raise exception using message='Comprobante incompatible.',errcode='23514'; end if;
     select coalesce(sum((payload->>'amount')::numeric),0) into paid from public.book_records where company_id=p.company_id and not voided and payload->>'kind'='cash' and payload->>'voucher_id'=v.id::text;
     if paid+amt>v.total then raise exception using message='Pago superior al saldo.',errcode='23514'; end if;
   end if;
   if record_payload->>'settles_id' is not null then
     select * into related from public.book_records where id=(record_payload->>'settles_id')::uuid and company_id=p.company_id and organization_id=p.organization_id and not voided;
     if related.id is null or related.payload->>'kind'<>'accrual' or record_payload->>'flow'<>'out' or related.payload->>'credit_account_id' is distinct from record_payload->>'counterpart_account_id' or (related.payload->>'date')::date>(record_payload->>'date')::date or record_payload->>'voucher_id' is not null then raise exception using message='Obligación incompatible.',errcode='23514'; end if;
     select coalesce(sum((payload->>'amount')::numeric),0) into paid from public.book_records where company_id=p.company_id and not voided and payload->>'kind'='cash' and payload->>'settles_id'=related.id::text;
     if paid+amt>(related.payload->>'amount')::numeric then raise exception using message='Pago superior a la obligación.',errcode='23514'; end if;
   end if;
 elsif k='statement' and record_payload->>'match_id' is not null then
   select * into related from public.book_records where id=(record_payload->>'match_id')::uuid and company_id=p.company_id and organization_id=p.organization_id and not voided;
   if related.id is null or related.payload->>'kind'<>'cash' or (related.payload->>'cash_account_id' is distinct from record_payload->>'cash_account_id' and not (related.payload->>'category'='transfer' and related.payload->>'counterpart_account_id'=record_payload->>'cash_account_id')) or related.payload->>'currency' is distinct from record_payload->>'currency' or left(related.payload->>'date',7)>left(record_payload->>'date',7) then raise exception using message='Conciliación incompatible.',errcode='23514'; end if;
   cash_signed:=(case when related.payload->>'flow'='in' then 1 else -1 end)*(case when related.payload->>'cash_account_id'=record_payload->>'cash_account_id' then 1 else -1 end)*(related.payload->>'amount')::numeric;
   if cash_signed<>amt then raise exception using message='Diferencia de conciliación.',errcode='23514'; end if;
 end if;
 if cardinality(account_ids)=0 or exists(select 1 from unnest(account_ids) a(id) where not exists(select 1 from public.accounts ac where ac.id=a.id and ac.company_id=p.company_id and ac.organization_id=p.organization_id and ac.status='active')) then raise exception using message='Cuenta fuera de alcance o inactiva.',errcode='23514'; end if;
 if k not in ('asset','statement','bank_balance') and (select count(distinct x) from unnest(account_ids) x)<2 then raise exception using message='Usá cuentas distintas.',errcode='23514'; end if;
 if k='opening' and not exists(select 1 from public.accounts where id=(record_payload->>'control_account_id')::uuid and kind=(case when record_payload->>'role'='customer' then 'asset' else 'liability' end)) then raise exception using message='Cuenta corriente inválida.',errcode='23514'; end if;
 if k='cash' then
   if record_payload->>'role'<>'other' and not exists(select 1 from public.accounts where id=(record_payload->>'counterpart_account_id')::uuid and kind=(case when record_payload->>'role'='customer' then 'asset' else 'liability' end)) then raise exception using message='Contrapartida comercial inválida.',errcode='23514'; end if;
   if record_payload->>'category'='transfer' and (record_payload->>'role'<>'other' or not exists(select 1 from public.accounts where id=(record_payload->>'counterpart_account_id')::uuid and kind='asset')) then raise exception using message='Transferencia inválida.',errcode='23514'; end if;
 end if;
 if k='journal' and record_payload->>'source_key' like 'voucher:%' then
   select * into v from public.vouchers where id=substr(record_payload->>'source_key',9)::uuid and company_id=p.company_id and organization_id=p.organization_id and period_id=p.id and currency=c.currency and review_status='approved' and account_id is not null;
   if v.id is null or total_debit<>abs(v.total) then raise exception using message='Asiento incompatible con comprobante.',errcode='23514'; end if;
 end if;
 if k='asset' and (coalesce(record_payload->>'frequency','monthly') not in ('monthly','annual') or (record_payload->>'frequency'='annual' and coalesce(record_payload->>'annual_month','') !~ '^(0[1-9]|1[0-2])$')) then raise exception using message='Frecuencia o mes anual inválido.',errcode='23514'; end if;
 if k='journal' and record_payload->>'source_key' like 'asset:%' then
   select * into related from public.book_records where id=split_part(record_payload->>'source_key',':',2)::uuid and company_id=p.company_id and not voided and payload->>'kind'='asset';
   asset_months:=(extract(year from p.month)::int-extract(year from (related.payload->>'service_on')::date)::int)*12+extract(month from p.month)::int-extract(month from (related.payload->>'service_on')::date)::int;
   if related.id is null or record_payload->>'source_key' is distinct from 'asset:'||related.id::text||':'||to_char(p.month,'YYYY-MM') then raise exception using message='Cuota fuera de vigencia.',errcode='23514'; end if;
   asset_stop:=case when related.payload->>'disposal_on' is not null then (extract(year from (related.payload->>'disposal_on')::date)::int-extract(year from (related.payload->>'service_on')::date)::int)*12+extract(month from (related.payload->>'disposal_on')::date)::int-extract(month from (related.payload->>'service_on')::date)::int-1 else (related.payload->>'life_months')::int-1 end;
   current_count:=greatest(0,least((related.payload->>'life_months')::int,asset_months+1,asset_stop+1));
   previous_count:=greatest(0,least((related.payload->>'life_months')::int,asset_months-(case when related.payload->>'frequency'='annual' then 12 else 1 end)+1,asset_stop+1));
   expected:=(floor(((related.payload->>'cost')::numeric-(related.payload->>'residual')::numeric)*100*current_count/(related.payload->>'life_months')::int)-floor(((related.payload->>'cost')::numeric-(related.payload->>'residual')::numeric)*100*previous_count/(related.payload->>'life_months')::int))/100;
   if (related.payload->>'frequency'='annual' and related.payload->>'annual_month'<>to_char(p.month,'MM')) or total_debit<>expected or jsonb_array_length(record_payload->'lines')<>2 or record_payload->'lines'->0->>'account_id' is distinct from related.payload->>'expense_account_id' or record_payload->'lines'->1->>'account_id' is distinct from related.payload->>'accumulated_account_id' or (record_payload->'lines'->0->>'debit')::numeric<>expected or (record_payload->'lines'->1->>'credit')::numeric<>expected then raise exception using message='Cuota incorrecta.',errcode='23514'; end if;
 end if;
 if target_id is null then insert into public.book_records(id,organization_id,company_id,period_id,payload) values(result_id,p.organization_id,p.company_id,p.id,record_payload);
 else update public.book_records set payload=record_payload where id=result_id; end if;
 return result_id;
end $$;

notify pgrst, 'reload schema';
