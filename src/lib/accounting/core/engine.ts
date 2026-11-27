import type {Account,Company,WorkspaceState} from '@/lib/workspace/model';
import {cents,decimalFromCents} from '@/lib/workspace/format';
import {worksheetCsv} from '@/lib/workspace/monthly-control';
import {emptyCore,entrySchema,type EntryInput,type EntryLine,type Entry} from './model';

export const coreState=(state:WorkspaceState)=>state.core??emptyCore;
export function accountProperties(state:WorkspaceState,account:Account){
 const profile=coreState(state).profiles.find(p=>p.account_id===account.id&&p.company_id===account.company_id&&p.organization_id===account.organization_id);
 const parents=new Map(state.accounts.filter(a=>a.company_id===account.company_id&&a.organization_id===account.organization_id).map(a=>[a.code,a]));
 let level=1,parent=account.parent_code,hierarchyValid=true;const seen=new Set([account.code]);
 while(parent){if(seen.has(parent)||!parents.has(parent)){hierarchyValid=false;break;}seen.add(parent);level++;parent=parents.get(parent)!.parent_code;}
 const grouping=state.accounts.some(a=>a.company_id===account.company_id&&a.organization_id===account.organization_id&&a.parent_code===account.code);
 return {level,hierarchyValid,heading:profile?.heading??'',subheading:profile?.subheading??'',nature:profile?.nature??(['asset','cost','expense'].includes(account.kind)?'debit':'credit'),postable:hierarchyValid&&!grouping&&(profile?.postable??true)};
}
export function journalScope(state:WorkspaceState,company:Company){const core=coreState(state);const entries=core.entries.filter(e=>e.company_id===company.id&&e.organization_id===company.organization_id&&e.status==='confirmed'&&e.currency===company.currency);const ids=new Set(entries.map(e=>e.id));return {entries,lines:core.lines.filter(l=>ids.has(l.entry_id)&&l.company_id===company.id&&l.organization_id===company.organization_id)};}
export function validateEntry(state:WorkspaceState,company:Company,input:EntryInput){
 const v=entrySchema.parse(input),core=coreState(state),period=state.periods.find(p=>p.id===v.periodId&&p.company_id===company.id&&p.organization_id===company.organization_id),exercise=core.exercises.find(e=>e.id===v.exerciseId&&e.company_id===company.id&&e.organization_id===company.organization_id);
 if(!core.ready)throw new Error('El núcleo requiere activación de base de datos.');
 if(company.status!=='active'||period?.status!=='open'||exercise?.status!=='open')throw new Error('Empresa, ejercicio y período deben estar abiertos.');
 if(v.date.slice(0,7)!==period.month.slice(0,7)||v.date<exercise.starts_on||v.date>exercise.ends_on)throw new Error('Fecha fuera del período o ejercicio.');
 let debit=0n,credit=0n;
 for(const l of v.lines){const a=state.accounts.find(a=>a.id===l.account_id&&a.company_id===company.id&&a.organization_id===company.organization_id);if(!a||a.status!=='active'||!accountProperties(state,a).postable)throw new Error('Elegí cuentas imputables, activas y de esta empresa.');if((cents(l.debit)>0n)===(cents(l.credit)>0n))throw new Error('Cada línea debe tener solo Debe o Haber.');if(l.party_id&&!core.parties.some(p=>p.id===l.party_id&&p.company_id===company.id&&p.organization_id===company.organization_id&&p.active))throw new Error('Contraparte ajena o inactiva.');debit+=cents(l.debit);credit+=cents(l.credit);}
 if(debit!==credit||debit<=0n||new Set(v.lines.map(l=>l.account_id)).size<2)throw new Error('El asiento debe balancear, tener importe y usar cuentas distintas.');
 if(v.voucherId&&!state.vouchers.some(x=>x.id===v.voucherId&&x.company_id===company.id&&x.organization_id===company.organization_id&&x.currency===company.currency&&x.date<=v.date))throw new Error('Comprobante fuera de alcance.');
 if(v.documentId&&!state.documents.some(d=>d.id===v.documentId&&d.company_id===company.id&&d.organization_id===company.organization_id))throw new Error('Documento fuera de alcance.');
 return v;
}
export function entrySignature(date:string,lines:Pick<EntryLine,'account_id'|'party_id'|'debit'|'credit'>[]){return JSON.stringify([date,lines.map(l=>[l.account_id,l.party_id??null,cents(l.debit).toString(),cents(l.credit).toString()]).sort((a,b)=>JSON.stringify(a).localeCompare(JSON.stringify(b)))]);}
export function duplicateEntries(state:WorkspaceState,company:Company,date:string,lines:Pick<EntryLine,'account_id'|'party_id'|'debit'|'credit'>[]){
 const scope=journalScope(state,company),signature=entrySignature(date,lines),byEntry=new Map<string,EntryLine[]>();
 for(const line of scope.lines){const group=byEntry.get(line.entry_id)??[];group.push(line);byEntry.set(line.entry_id,group);}
 return scope.entries.filter(e=>e.date===date&&entrySignature(e.date,byEntry.get(e.id)??[])===signature);
}
export function reportRange(exercise:{starts_on:string;ends_on:string},month:string,range:'month'|'quarter'|'exercise'){
 let start=month+'-01',end=new Date(Date.UTC(Number(month.slice(0,4)),Number(month.slice(5,7)),0)).toISOString().slice(0,10);
 if(range==='quarter'){const quarter=Math.floor((Number(month.slice(5,7))-1)/3)*3;start=`${month.slice(0,4)}-${String(quarter+1).padStart(2,'0')}-01`;end=new Date(Date.UTC(Number(month.slice(0,4)),quarter+3,0)).toISOString().slice(0,10);}
 if(range==='exercise')return {start:exercise.starts_on,end:exercise.ends_on};
 return {start:start<exercise.starts_on?exercise.starts_on:start,end:end>exercise.ends_on?exercise.ends_on:end};
}
export function accountingBooks(state:WorkspaceState,company:Company,start:string,end:string,exerciseId:string){
 const all=journalScope(state,company),exercise=coreState(state).exercises.find(e=>e.id===exerciseId&&e.company_id===company.id&&e.organization_id===company.organization_id);
 const entries=all.entries.filter(e=>e.exercise_id===exerciseId&&e.date>=start&&e.date<=end).sort((a,b)=>a.date.localeCompare(b.date)||a.number-b.number),ids=new Set(entries.map(e=>e.id));
 const openingIds=new Set(all.entries.filter(e=>e.exercise_id===exerciseId&&e.date<(start)&&(!exercise||e.date>=exercise.starts_on)).map(e=>e.id));
 const lines=all.lines.filter(l=>ids.has(l.entry_id)),opening=all.lines.filter(l=>openingIds.has(l.entry_id));
 const byAccount=new Map<string,EntryLine[]>(),openingByAccount=new Map<string,bigint>(),entryTotals=new Map<string,{debit:bigint;credit:bigint;count:number}>();
 const entryIndex=new Map(entries.map((e,i)=>[e.id,i])),entryById=new Map(entries.map(e=>[e.id,e]));
 for(const line of lines){const group=byAccount.get(line.account_id)??[];group.push(line);byAccount.set(line.account_id,group);const total=entryTotals.get(line.entry_id)??{debit:0n,credit:0n,count:0};total.debit+=cents(line.debit);total.credit+=cents(line.credit);total.count++;entryTotals.set(line.entry_id,total);}
 for(const line of opening)openingByAccount.set(line.account_id,(openingByAccount.get(line.account_id)??0n)+cents(line.debit)-cents(line.credit));
 const rows=state.accounts.filter(a=>a.company_id===company.id&&a.organization_id===company.organization_id).sort((a,b)=>a.code.localeCompare(b.code)).map(a=>{
  const properties=accountProperties(state,a),own=byAccount.get(a.id)??[],initial=openingByAccount.get(a.id)??0n,debit=own.reduce((n,l)=>n+cents(l.debit),0n),credit=own.reduce((n,l)=>n+cents(l.credit),0n),net=initial+debit-credit;
  let running=initial;const ledger=own.slice().sort((a,b)=>(entryIndex.get(a.entry_id)!-entryIndex.get(b.entry_id)!)||a.position-b.position).map(l=>{running+=cents(l.debit)-cents(l.credit);return {entry:entryById.get(l.entry_id)!,line:l,net:running,balance:properties.nature==='debit'?running:-running};});
  return {account:a,...properties,initial,debit,credit,net,balance:properties.nature==='debit'?net:-net,debtor:net>0n?net:0n,creditor:net<0n?-net:0n,abnormal:properties.nature==='debit'?net<0n:net>0n,withoutMovements:own.length===0,ledger};
 });
 const debit=lines.reduce((n,l)=>n+cents(l.debit),0n),credit=lines.reduce((n,l)=>n+cents(l.credit),0n),debtor=rows.reduce((n,r)=>n+r.debtor,0n),creditor=rows.reduce((n,r)=>n+r.creditor,0n);
 const valid=debit===credit&&debtor===creditor&&rows.reduce((n,r)=>n+r.debit,0n)===debit&&rows.reduce((n,r)=>n+r.credit,0n)===credit&&entries.every(e=>{const total=entryTotals.get(e.id);return !!total&&total.count>=2&&total.debit>0n&&total.debit===total.credit;});
 return {entries,lines,rows,entryTotals,debit,credit,debtor,creditor,valid};
}
export function booksCsv(books:ReturnType<typeof accountingBooks>,company:Company,start:string,end:string){return worksheetCsv([['CUIT','desde','hasta','codigo','cuenta','saldo_inicial_neto','debe','haber','saldo_deudor','saldo_acreedor','naturaleza','saldo_anormal'],...books.rows.map(r=>[company.cuit,start,end,r.account.code,r.account.name,decimalFromCents(r.initial),decimalFromCents(r.debit),decimalFromCents(r.credit),decimalFromCents(r.debtor),decimalFromCents(r.creditor),r.nature,r.abnormal?'Revisar':''])]);}
export function entryLinesForReverse(entry:Entry,lines:EntryLine[]){return lines.filter(l=>l.entry_id===entry.id).sort((a,b)=>a.position-b.position).map(l=>({account_id:l.account_id,party_id:l.party_id,debit:l.credit,credit:l.debit}));}
