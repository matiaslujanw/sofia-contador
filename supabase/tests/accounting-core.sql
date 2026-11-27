begin;
insert into auth.users(id) values('40000000-0000-4000-8000-000000000001'),('40000000-0000-4000-8000-000000000002'),('40000000-0000-4000-8000-000000000003');
set local role authenticated;
select set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
do $$
declare org uuid;co uuid;other uuid;p uuid;ex uuid;bank uuid;capital uuid;equipment uuid;vat_in uuid;customer uuid;services uuid;vat_out uuid;expense uuid;grouping uuid;inactive uuid;foreign_account uuid;entry_id uuid;reversed uuid;j jsonb;d numeric;h numeric;v numeric;ids uuid[]:='{}';before_count int;begin
 org:=(public.create_organization('VIGIA pruebas ficticias')).id;
 insert into public.companies(organization_id,legal_name,cuit) values(org,'Seguridad sintética SAS','30719990017') returning id into co;
 insert into public.companies(organization_id,legal_name,cuit) values(org,'Otra empresa sintética','30719990025') returning id into other;
 p:=(public.ensure_period(co,'2026-11-01')).id;
 ex:=public.create_accounting_exercise(co,'Ejercicio de prueba','2026-01-01','2026-12-31');
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'1','Activo agrupador','asset') returning id into grouping;
 insert into public.accounts(organization_id,company_id,code,name,kind,parent_code) values(org,co,'1.1','Banco sintético','asset','1') returning id into bank;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'3.1','Capital suscripto integrado','equity') returning id into capital;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'1.2','Equipamiento de seguridad','asset') returning id into equipment;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'1.3','IVA crédito fiscal','asset') returning id into vat_in;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'1.4','Deudores por servicios','asset') returning id into customer;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'4.1','Servicios de vigilancia','revenue') returning id into services;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'2.1','IVA débito fiscal','liability') returning id into vat_out;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,co,'5.1','Gastos administrativos','expense') returning id into expense;
 insert into public.accounts(organization_id,company_id,code,name,kind,status) values(org,co,'9','Inactiva','expense','inactive') returning id into inactive;
 insert into public.accounts(organization_id,company_id,code,name,kind) values(org,other,'1','Cuenta ajena','asset') returning id into foreign_account;
 perform public.save_accounting_profile(bank,'Disponibilidades','Bancos','debit',true,'BANCO-X');
 -- The user explicitly chose bank for capital and the administrative payment.
 for j in select * from jsonb_array_elements(jsonb_build_array(
  jsonb_build_object('date','2026-11-01','description','Aporte de capital ficticio','lines',jsonb_build_array(jsonb_build_object('account_id',bank,'debit','5000000.00','credit','0.00'),jsonb_build_object('account_id',capital,'debit','0.00','credit','5000000.00'))),
  jsonb_build_object('date','2026-11-02','description','Equipamiento + IVA 21% desde banco','lines',jsonb_build_array(jsonb_build_object('account_id',equipment,'debit','1000000.00','credit','0.00'),jsonb_build_object('account_id',vat_in,'debit','210000.00','credit','0.00'),jsonb_build_object('account_id',bank,'debit','0.00','credit','1210000.00'))),
  jsonb_build_object('date','2026-11-03','description','Servicios + IVA 21% a cobrar','lines',jsonb_build_array(jsonb_build_object('account_id',customer,'debit','2420000.00','credit','0.00'),jsonb_build_object('account_id',services,'debit','0.00','credit','2000000.00'),jsonb_build_object('account_id',vat_out,'debit','0.00','credit','420000.00'))),
  jsonb_build_object('date','2026-11-04','description','Cobro parcial por banco','lines',jsonb_build_array(jsonb_build_object('account_id',bank,'debit','1000000.00','credit','0.00'),jsonb_build_object('account_id',customer,'debit','0.00','credit','1000000.00'))),
  jsonb_build_object('date','2026-11-05','description','Gasto administrativo + IVA 21% desde banco','lines',jsonb_build_array(jsonb_build_object('account_id',expense,'debit','300000.00','credit','0.00'),jsonb_build_object('account_id',vat_in,'debit','63000.00','credit','0.00'),jsonb_build_object('account_id',bank,'debit','0.00','credit','363000.00')))
 )) loop
  entry_id:=public.post_accounting_entry(p,ex,(j->>'date')::date,j->>'description','scenario:'||(j->>'date'),j->'lines');ids:=array_append(ids,entry_id);
  if public.post_accounting_entry(p,ex,(j->>'date')::date,j->>'description','scenario:'||(j->>'date'),j->'lines')<>entry_id then raise exception 'Reintento no idempotente';end if;
 end loop;
 set constraints all immediate;
 if (select count(*) from public.accounting_journal_entries where company_id=co)<>5 then raise exception 'Cantidad de asientos incorrecta';end if;
 if (select array_agg(number order by number) from public.accounting_journal_entries where company_id=co)<>array[1,2,3,4,5]::bigint[] then raise exception 'Numeración incorrecta';end if;
 select sum(debit),sum(credit) into d,h from public.accounting_journal_lines where company_id=co;
 if d<>9993000 or h<>9993000 then raise exception 'Sumas incorrectas: % / %',d,h;end if;
 select sum(debit-credit) into v from public.accounting_journal_lines where account_id=bank;if v<>4427000 then raise exception 'Banco incorrecto: %',v;end if;
 select sum(debit-credit) into v from public.accounting_journal_lines where account_id=customer;if v<>1420000 then raise exception 'Clientes incorrectos: %',v;end if;
 select sum(debit-credit) into v from public.accounting_journal_lines where account_id=vat_in;if v<>273000 then raise exception 'IVA crédito incorrecto: %',v;end if;
 select sum(credit-debit) into v from public.accounting_journal_lines where account_id=vat_out;if v<>420000 then raise exception 'IVA débito incorrecto: %',v;end if;
 select sum(greatest(net,0)),sum(greatest(-net,0)) into d,h from(select sum(debit-credit) net from public.accounting_journal_lines where company_id=co group by account_id)s;
 if d<>7420000 or h<>7420000 then raise exception 'Saldos incorrectos: % / %',d,h;end if;
 if exists(select 1 from public.accounting_journal_entries where company_id=co and length(request_hash)<>64) then raise exception 'Huella SHA-256 inválida';end if;
 raise notice 'CINCO OPERACIONES: 5 asientos, 13 líneas; Debe/Haber 9993000; saldos deudor/acreedor 7420000; Banco 4427000; Clientes 1420000; CF 273000; DF 420000. Proveedores 0: no se registraron compras a crédito.';
 -- Leave deferred validation enabled for subsequent atomic calls.
 set constraints all deferred;
 j:=jsonb_build_array(jsonb_build_object('account_id',bank,'debit','10.00','credit','0.00'),jsonb_build_object('account_id',capital,'debit','0.00','credit','9.00'));
 before_count:=(select count(*) from public.accounting_journal_entries where company_id=co);
 begin perform public.post_accounting_entry(p,ex,'2026-11-06','No balancea','bad:1',j);raise exception 'Desbalance aceptado';exception when check_violation then null;end;
 if(select count(*) from public.accounting_journal_entries where company_id=co)<>before_count then raise exception 'Escritura parcial';end if;
 j:=jsonb_set(j,'{1,credit}','"10.00"');
 begin perform public.post_accounting_entry(p,ex,'2026-11-06','Agrupadora','bad:group',jsonb_set(j,'{0,account_id}',to_jsonb(grouping)));raise exception 'Agrupadora aceptada';exception when check_violation then null;end;
 begin perform public.post_accounting_entry(p,ex,'2026-11-06','Ajena','bad:foreign',jsonb_set(j,'{0,account_id}',to_jsonb(foreign_account)));raise exception 'Cuenta ajena aceptada';exception when check_violation then null;end;
 begin perform public.post_accounting_entry(p,ex,'2026-11-06','Inactiva','bad:inactive',jsonb_set(j,'{0,account_id}',to_jsonb(inactive)));raise exception 'Inactiva aceptada';exception when check_violation then null;end;
 begin perform public.post_accounting_entry(p,ex,'2026-12-01','Fecha ajena','bad:date',j);raise exception 'Fecha ajena aceptada';exception when check_violation then null;end;
 begin perform public.post_accounting_entry(p,ex,'2026-11-01','Duplicado','duplicate',jsonb_build_array(jsonb_build_object('account_id',bank,'debit','5000000.00','credit','0.00'),jsonb_build_object('account_id',capital,'debit','0.00','credit','5000000.00')));raise exception 'Duplicado aceptado';exception when unique_violation then null;end;
 begin update public.accounting_journal_entries set description='Alterado' where id=ids[1];raise exception 'Actualización directa aceptada';exception when insufficient_privilege then null;end;
 begin delete from public.accounting_journal_lines l where l.entry_id=ids[1];raise exception 'Eliminación aceptada';exception when insufficient_privilege then null;end;
 begin perform public.save_accounting_profile(bank,'Otro','Otro','credit',true,'BANCO-X');raise exception 'Naturaleza histórica alterada';exception when object_not_in_prerequisite_state then null;end;
 begin perform public.save_accounting_profile(equipment,'Equipos','Seguridad','debit',true,'BANCO-X');raise exception 'Equivalencia duplicada aceptada';exception when unique_violation then null;end;
 if exists(select 1 from public.accounting_account_profiles where account_id=equipment) then raise exception 'Perfil parcial tras error';end if;
 begin perform public.create_accounting_exercise(co,'Superpuesto','2026-11-01','2027-10-31');raise exception 'Superposición aceptada';exception when check_violation then null;end;
 reversed:=public.reverse_accounting_entry(ids[5],p,ex,'2026-11-06','Corrección ficticia verificada','reverse:test');
 if public.reverse_accounting_entry(ids[5],p,ex,'2026-11-06','Corrección ficticia verificada','reverse:test')<>reversed then raise exception 'Reversión no idempotente';end if;
 begin perform public.reverse_accounting_entry(ids[5],p,ex,'2026-11-06','Otra corrección ficticia','reverse:duplicate');raise exception 'Doble reversión aceptada';exception when unique_violation then null;end;
 if not exists(select 1 from public.accounting_journal_entries where id=ids[5]) then raise exception 'Original eliminado';end if;
 if not exists(select 1 from public.audit_events where entity='accounting_journal_entries' and entity_id=reversed) then raise exception 'Falta historial';end if;
 if not exists(select 1 from public.accounting_change_history where entity='accounting_journal_entries' and entity_id=reversed and after_data->>'reversal_of'=ids[5]::text) then raise exception 'Falta snapshot trazable';end if;
 begin delete from public.accounting_change_history where entity_id=reversed;raise exception 'Historial eliminable';exception when insufficient_privilege then null;end;
 perform public.set_organization_member(org,'40000000-0000-4000-8000-000000000002','viewer');
 perform set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000002',true);
 begin perform public.post_accounting_entry(p,ex,'2026-11-06','No permitido','viewer',j);raise exception 'Viewer contabilizó';exception when insufficient_privilege then null;end;
 perform set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000003',true);
 if exists(select 1 from public.accounting_journal_entries where company_id=co) or exists(select 1 from public.accounting_change_history where company_id=co) then raise exception 'Filtración entre estudios';end if;
 perform set_config('request.jwt.claim.sub','40000000-0000-4000-8000-000000000001',true);
 perform public.set_period_status(p,'closed','Cierre sintético para probar restricciones');
 begin perform public.post_accounting_entry(p,ex,'2026-11-06','Período cerrado','closed',j);raise exception 'Contabilizó en cerrado';exception when object_not_in_prerequisite_state then null;end;
 perform public.set_accounting_exercise_status(ex,'closed','Cierre de ejercicio de prueba');
 entry_id:=(public.ensure_period(co,'2026-12-01')).id;
 begin perform public.post_accounting_entry(entry_id,ex,'2026-12-01','Ejercicio cerrado','closed:exercise',j);raise exception 'Contabilizó en ejercicio cerrado';exception when check_violation then null;end;
 perform public.set_accounting_exercise_status(ex,'open','Reapertura de ejercicio para prueba');
 perform public.post_accounting_entry(entry_id,ex,'2026-12-01','Ejercicio reabierto','reopened:exercise',j);
 perform public.reverse_accounting_entry(ids[4],entry_id,ex,'2026-12-02','Corrección de período anterior cerrado','reverse:closed-original');
 begin perform public.set_accounting_exercise_status(ex,'closed','Cierre con período abierto');raise exception 'Cerró con período abierto';exception when object_not_in_prerequisite_state then null;end;
 set constraints all immediate;
 raise notice 'RESTRICCIONES: balance, atomicidad, agrupadoras, cuentas ajenas/inactivas, fechas, duplicados, inmutabilidad, perfil histórico, ejercicio, reversión, auditoría, viewer, aislamiento y cierre OK';
end $$;
reset role;
do $$ declare base public.accounting_journal_entries;begin
 select * into base from public.accounting_journal_entries order by created_at limit 1;
 begin
  insert into public.accounting_journal_entries(organization_id,company_id,period_id,exercise_id,number,date,description,currency,source_key,request_hash,content_hash,created_by)
  values(base.organization_id,base.company_id,base.period_id,base.exercise_id,999,base.date,'Cabecera incompleta','ARS','bad:orphan','test','test',base.created_by);
  set constraints all immediate;
  raise exception 'Se admitió cabecera sin líneas';
 exception when check_violation then null;end;
 begin update public.accounting_journal_entries set description='Alterado' where id=base.id;raise exception 'Owner alteró asiento confirmado';exception when object_not_in_prerequisite_state then null;end;
 begin delete from public.accounting_journal_lines where entry_id=base.id;raise exception 'Owner eliminó líneas';exception when object_not_in_prerequisite_state then null;end;
 raise notice 'RESTRICCIONES FÍSICAS: cabeceras sin líneas y edición/eliminación de confirmados rechazadas incluso con rol de mantenimiento';
end $$;
rollback;
