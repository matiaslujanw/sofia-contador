import type {WorkspaceState} from '@/lib/workspace/model';
import type {ParsedCommand} from '@/lib/workspace/validation';
import {coreState,validateEntry,duplicateEntries,entryLinesForReverse,accountProperties} from './engine';
import {entrySchema,type Entry} from './model';

export function applyCoreCommand(state:WorkspaceState,c:ParsedCommand,id:string):WorkspaceState{
 const org=state.organization;if(!org||org.role==='viewer')throw new Error('Sin permiso.');
 const core=structuredClone(coreState(state));if(!core.ready)throw new Error('El núcleo requiere activación.');
 const company=(companyId:string)=>{const a=state.companies.find(x=>x.id===companyId&&x.organization_id===org.id&&x.status==='active');if(!a)throw new Error('Empresa no disponible.');return a;};
 if(c.type==='core.exercise'){
  const co=company(c.companyId);if(core.exercises.some(e=>e.company_id===co.id&&e.starts_on<=c.endsOn&&e.ends_on>=c.startsOn))throw new Error('El ejercicio se superpone con uno existente.');
  core.exercises.push({id,organization_id:org.id,company_id:co.id,name:c.name,starts_on:c.startsOn,ends_on:c.endsOn,status:'open',status_reason:''});
 }else if(c.type==='core.profile'){
  const a=state.accounts.find(a=>a.id===c.accountId&&a.organization_id===org.id);if(!a)throw new Error('Cuenta no disponible.');company(a.company_id);
  const prior=accountProperties(state,a);if(core.lines.some(l=>l.account_id===a.id)&&[prior.nature,prior.postable].join('|')!==[c.nature,c.postable].join('|'))throw new Error('La cuenta tiene movimientos confirmados.');
  const profile={id:core.profiles.find(p=>p.account_id===a.id)?.id??id,organization_id:org.id,company_id:a.company_id,account_id:a.id,heading:c.heading,subheading:c.subheading,nature:c.nature,postable:c.postable};core.profiles=[...core.profiles.filter(p=>p.account_id!==a.id),profile];
  if(c.xubioCode&&core.equivalences.some(e=>e.company_id===a.company_id&&e.external_code===c.xubioCode&&e.account_id!==a.id))throw new Error('Código Xubio ya vinculado.');
  core.equivalences=core.equivalences.filter(e=>e.account_id!==a.id);if(c.xubioCode)core.equivalences.push({id:crypto.randomUUID(),organization_id:org.id,company_id:a.company_id,account_id:a.id,external_code:c.xubioCode,external_system:'Xubio'});
 }else if(c.type==='core.exercise.status'){
  const e=core.exercises.find(e=>e.id===c.exerciseId&&e.organization_id===org.id);if(!e)throw new Error('Ejercicio no disponible.');company(e.company_id);
  if(c.status==='closed'&&state.periods.some(p=>p.company_id===e.company_id&&p.status==='open'&&p.month<=e.ends_on&&p.month.slice(0,7)>=e.starts_on.slice(0,7)))throw new Error('Primero cerrá los períodos abiertos del ejercicio.');e.status=c.status;e.status_reason=c.reason;
 }else if(c.type==='core.post'||c.type==='core.reverse'){
  const p=state.periods.find(p=>p.id===c.periodId&&p.organization_id===org.id);if(!p)throw new Error('Período no disponible.');const co=company(p.company_id);
  const original=c.type==='core.reverse'?core.entries.find(e=>e.id===c.entryId&&e.company_id===co.id&&e.organization_id===org.id):undefined;
  if(c.type==='core.reverse'&&(!original||original.reversal_of||c.date<original.date))throw new Error('Revisá el asiento y fecha de reversión.');
  const v=entrySchema.parse(c.type==='core.post'?c:{periodId:p.id,exerciseId:c.exerciseId,date:c.date,description:`Reversión #${original!.number}: ${c.reason}`,sourceKey:c.sourceKey,voucherId:original!.voucher_id,documentId:original!.document_id,allowDuplicate:true,lines:entryLinesForReverse(original!,core.lines)});
  const request=JSON.stringify({...v,allowDuplicate:undefined});const previous=core.entries.find(e=>e.company_id===co.id&&e.source_key===v.sourceKey);
  if(previous){if(previous.request_hash!==request)throw new Error('Clave reutilizada con otros datos.');return state;}
  if(original&&core.entries.some(e=>e.reversal_of===original.id))throw new Error('El asiento ya tiene reversión.');
  validateEntry(original?{...state,accounts:state.accounts.map(a=>v.lines.some(l=>l.account_id===a.id)?{...a,status:'active'}:a)}:state,co,v);
  if(!original&&!v.allowDuplicate&&duplicateEntries(state,co,v.date,v.lines).length)throw new Error('Posible asiento duplicado. Revisá el Diario.');
  const entry:Entry={id,organization_id:org.id,company_id:co.id,period_id:p.id,exercise_id:v.exerciseId,number:core.entries.filter(e=>e.exercise_id===v.exerciseId).reduce((n,e)=>Math.max(n,e.number),0)+1,date:v.date,description:v.description,currency:co.currency,status:'confirmed',source_key:v.sourceKey,duplicate_reviewed:!original&&v.allowDuplicate,request_hash:request,content_hash:'',voucher_id:v.voucherId,document_id:v.documentId,reversal_of:original?.id??null,created_by:'demo',created_at:new Date().toISOString()};
  core.entries.push(entry);core.lines.push(...v.lines.map((l,i)=>({...l,id:crypto.randomUUID(),organization_id:org.id,company_id:co.id,entry_id:id,position:i+1})));
 }else throw new Error('Comando ajeno al núcleo.');
 return {...state,core};
}
