import type {WorkspaceState,Company} from './model';
import {coreState} from '@/lib/accounting/core/engine';
export type DeletionPreview={company_id:string;company_name:string;cuit:string;counts:Record<string,number>;blocked:string[];signature:string};
export type CompanyDeletion={id:string;organization_id:string;company_id:string;company_name:string;cuit:string;counts:Record<string,number>;storage_paths:string[];status:'files_pending'|'completed';created_at:string};
export const deletionLabels:Record<string,string>={periods:'Períodos',accounts:'Cuentas del plan',vouchers:'Compras y ventas',documents:'Documentos',imports:'Importaciones',tasks:'Tareas',obligations:'Vencimientos',book:'Registros del libro operativo',entries:'Asientos confirmados',bank_movements:'Movimientos bancarios del núcleo'};
export function deletionScope(state:WorkspaceState,companyId:string){
 const company=state.companies.find(c=>c.id===companyId&&c.organization_id===state.organization?.id);
 if(!company||state.organization?.role!=='owner')throw new Error('Solo la propietaria del estudio puede eliminar una empresa.');
 const own=(r:{company_id:string;organization_id?:string})=>r.company_id===company.id&&(!r.organization_id||r.organization_id===company.organization_id),core=coreState(state);
 const records={periods:state.periods.filter(own),accounts:state.accounts.filter(own),vouchers:state.vouchers.filter(own),documents:state.documents.filter(own),imports:state.imports.filter(own),tasks:state.tasks.filter(own),obligations:state.obligations.filter(own),book:state.bookRecords.filter(own),entries:core.entries.filter(own),bank_movements:[]};
 const counts=Object.fromEntries(Object.entries(records).map(([key,rows])=>[key,rows.length]));
 const blocked:string[]=[];
 if(records.entries.length)blocked.push('La empresa tiene asientos confirmados. Se conserva su historial; podés archivarla, pero no eliminarla por esta vía.');
 if(records.book.some(r=>['journal','cash','accrual','opening'].includes(r.payload.kind)))blocked.push('La empresa tiene movimientos contables en el libro operativo. Su historial debe conservarse.');
 return {company,records,counts,blocked,own};
}
function stable(value:unknown):unknown{if(Array.isArray(value))return value.map(stable);if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).sort(([a],[b])=>a.localeCompare(b)).map(([k,v])=>[k,stable(v)]));return value;}
export async function localDeletionPreview(state:WorkspaceState,companyId:string):Promise<DeletionPreview>{
 const {company,records,counts,blocked}=deletionScope(state,companyId),core=coreState(state);
 const payload=JSON.stringify(stable({company,records,core:{exercises:core.exercises.filter(r=>r.company_id===company.id),profiles:core.profiles.filter(r=>r.company_id===company.id),equivalences:core.equivalences.filter(r=>r.company_id===company.id),parties:core.parties.filter(r=>r.company_id===company.id)},events:state.activity.filter(e=>e.company_id===company.id)}));
 const signature=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(payload))),b=>b.toString(16).padStart(2,'0')).join('');
 return {company_id:company.id,company_name:company.trade_name||company.legal_name,cuit:company.cuit,counts,blocked,signature};
}
export function removeLocalCompany(state:WorkspaceState,company:Company,signature:string):WorkspaceState{
 const {records,counts,own,blocked}=deletionScope(state,company.id);if(blocked.length)throw new Error(blocked.join(' '));
 const core=coreState(state),job:CompanyDeletion={id:crypto.randomUUID(),organization_id:company.organization_id,company_id:company.id,company_name:company.trade_name||company.legal_name,cuit:company.cuit,counts,storage_paths:records.documents.map(d=>d.id),status:'files_pending',created_at:new Date().toISOString()};
 const next={...state,companies:state.companies.filter(c=>c.id!==company.id),periods:state.periods.filter(r=>!own(r)),accounts:state.accounts.filter(r=>!own(r)),vouchers:state.vouchers.filter(r=>!own(r)),documents:state.documents.filter(r=>!own(r)),imports:state.imports.filter(r=>!own(r)),tasks:state.tasks.filter(r=>!own(r)),obligations:state.obligations.filter(r=>!own(r)),rules:state.rules.filter(r=>!own(r)),bookRecords:state.bookRecords.filter(r=>!own(r)),core:{...core,exercises:core.exercises.filter(r=>!own(r)),profiles:core.profiles.filter(r=>!own(r)),equivalences:core.equivalences.filter(r=>!own(r)),parties:core.parties.filter(r=>!own(r))},companyDeletions:[...(state.companyDeletions??[]),job]};
 return {...next,activity:[{id:crypto.randomUUID(),company_id:company.id,period_id:null,action:'DELETE',entity:'company_deletion',entity_id:job.id,details:{company_name:job.company_name,cuit:job.cuit,counts,signature},created_at:job.created_at},...state.activity]};
}
