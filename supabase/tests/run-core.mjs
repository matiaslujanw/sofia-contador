// Requires an explicitly selected disposable local PostgreSQL cluster; never accepts a remote host.
import pg from 'pg';
import fs from 'node:fs/promises';
import assert from 'node:assert/strict';
const host=process.env.ACCOUNTING_TEST_PGHOST;
if(!host||!(['localhost','127.0.0.1','/tmp'].includes(host)||host.startsWith('/tmp/')))throw new Error('Definí ACCOUNTING_TEST_PGHOST con un socket /tmp o un PostgreSQL local de pruebas.');
const options={host,user:process.env.ACCOUNTING_TEST_PGUSER??process.env.USER,port:Number(process.env.ACCOUNTING_TEST_PGPORT??5432)};
const admin=new pg.Client({...options,database:'postgres'});await admin.connect();
const database=`vigia_test_${Date.now()}_${process.pid}`;await admin.query(`create database ${database}`);
const client=new pg.Client({...options,database});const connections=[client];await client.connect();
const root=new URL('../../',import.meta.url);
const coreOnly=process.env.ACCOUNTING_TEST_CORE_ONLY==='1',deletionOnly=process.env.ACCOUNTING_TEST_DELETION_ONLY==='1';
client.on('notice',n=>{if(n.message.startsWith('CINCO')||n.message.startsWith('RESTRICCIONES')||n.message.startsWith('ELIMINACIÓN'))process.stdout.write(n.message+'\n');});
try{
 for(const role of ['anon','authenticated'])if(!(await admin.query('select 1 from pg_roles where rolname=$1',[role])).rowCount)await admin.query(`create role ${role} nologin`);
 const stub=(await fs.readFile(new URL('supabase/tests/platform_stub.sql',root),'utf8')).replace('create role anon nologin;','').replace('create role authenticated nologin;','');
 await client.query(stub);
 for(const file of(await fs.readdir(new URL('supabase/migrations/',root))).filter(f=>f.endsWith('.sql')&&(!coreOnly||!f.startsWith('20261126'))&&(!deletionOnly||f.startsWith('20261124')||f.startsWith('20261128'))).sort()){await client.query(await fs.readFile(new URL('supabase/migrations/'+file,root),'utf8'));process.stdout.write('Migración OK: '+file+'\n');}
 for(const file of (deletionOnly?['workflows.sql','company-deletion.sql']:coreOnly?['workflows.sql','accounting-core.sql','company-deletion.sql']:['workflows.sql','operating-book.sql','accounting-core.sql','company-deletion.sql'])){await client.query(await fs.readFile(new URL('supabase/tests/'+file,root),'utf8'));process.stdout.write('Pruebas SQL OK: '+file+'\n');}
 if(!deletionOnly){
 const user='49000000-0000-4000-8000-000000000001';await client.query('insert into auth.users(id) values($1)',[user]);await client.query('set role authenticated');await client.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);
 const org=(await client.query("select (public.create_organization('Concurrencia ficticia')).id")).rows[0].id;
 const company=(await client.query("insert into companies(organization_id,legal_name,cuit) values($1,'Sociedad ficticia','30719990017') returning id",[org])).rows[0].id;
 const period=(await client.query("select (public.ensure_period($1,'2026-11-01')).id",[company])).rows[0].id;
 const exercise=(await client.query("select public.create_accounting_exercise($1,'Ejercicio ficticio','2026-01-01','2026-12-31') id",[company])).rows[0].id;
 const accounts=(await client.query("insert into accounts(organization_id,company_id,code,name,kind) values($1,$2,'1','Banco ficticio','asset'),($1,$2,'3','Capital ficticio','equity') returning id,code",[org,company])).rows;
 const bank=accounts.find(a=>a.code==='1').id,capital=accounts.find(a=>a.code==='3').id;
 async function connection(){const c=new pg.Client({...options,database});await c.connect();connections.push(c);await c.query('set role authenticated');await c.query("select set_config('request.jwt.claim.sub',$1,false)",[user]);return c;}
 const one=await connection(),two=await connection();
 async function post(c,key,amount,date='2026-11-01'){
  await c.query('begin');try{const lines=[{account_id:bank,debit:amount,credit:'0.00'},{account_id:capital,debit:'0.00',credit:amount}];const r=await c.query('select public.post_accounting_entry($1,$2,$3,$4,$5,$6::jsonb) id',[period,exercise,date,'Prueba concurrente',key,JSON.stringify(lines)]);await c.query('commit');return r.rows[0].id;}catch(e){await c.query('rollback');throw e;}
 }
 const same=await Promise.all([post(one,'concurrency:same','10.00'),post(two,'concurrency:same','10.00')]);assert.equal(same[0],same[1]);
 await Promise.all([post(one,'concurrency:two','20.00','2026-11-02'),post(two,'concurrency:three','30.00','2026-11-03')]);
 const result=await client.query('select number from accounting_journal_entries where company_id=$1 order by number',[company]);assert.deepEqual(result.rows.map(r=>Number(r.number)),[1,2,3]);
 assert.equal((await client.query('select count(*)::int n from accounting_journal_lines where company_id=$1',[company])).rows[0].n,6);
 await client.query('reset role');
 const beforeReapply=(await client.query('select count(*)::int n from accounting_journal_entries')).rows[0].n;
 await client.query(await fs.readFile(new URL('supabase/migrations/20261128000100_company_deletion.sql',root),'utf8'));
 assert.equal((await client.query('select count(*)::int n from accounting_journal_entries')).rows[0].n,beforeReapply);
 process.stdout.write('REAPLICACIÓN OK: la migración de eliminación se puede repetir sin eliminar asientos ni datos.\n');
 process.stdout.write('CONCURRENCIA OK: misma clave = un asiento; claves distintas = correlativos 1, 2, 3 sin líneas parciales.\n');
 }
}catch(e){process.stderr.write('FALLO SQL: '+e.message+'\n'+(e.where??'')+'\n');process.exitCode=1;}
finally{await Promise.all(connections.map(c=>c.end()));await admin.query(`drop database ${database}`);await admin.end();}
