import {z} from 'zod';
import {readSource} from '@/lib/imports';
import {IMPORT_MAX_ROWS} from '@/lib/imports/source';
import {worksheetCsv} from '@/lib/workspace/monthly-control';
import type {Company,Document} from '@/lib/workspace/model';
import {emptyAuditMapping,type AuditMapping,type XubioReportKind,digest} from './xubio-audit';
export const auditSourcePrefix=(kind:XubioReportKind,month:string)=>`xubio-${kind}-${month}-`;
export function auditSourceName(kind:XubioReportKind,month:string,file:File){return auditSourcePrefix(kind,month)+file.name.replace(/[\u0000-\u001f\u007f]/g,'').slice(-160);}
const headers=['version','empresa_id','empresa_cuit','periodo','huella_fuentes','tipo','clave','valor'];
const base=(company:Company,month:string,sourceDigest:string)=>['1',company.id,company.cuit,month,sourceDigest];
export function auditSettingsCsv(company:Company,month:string,sourceDigest:string,mapping:AuditMapping,coverage:boolean,selected:Set<string>,circuit=''){
 const rows:string[][]=[headers];
 for(const key of ['purchaseVat','saleVat','suppliers','customers','otherTaxes'] as const)rows.push([...base(company,month,sourceDigest),'mapping',key,mapping[key]]);
 for(const key of ['bank','categories'] as const)for(const [id,value]of Object.entries(mapping[key]))rows.push([...base(company,month,sourceDigest),key,id,value]);
 rows.push([...base(company,month,sourceDigest),'coverage','all',String(coverage)]);
 rows.push([...base(company,month,sourceDigest),'configuration','circuit',circuit]);
 for(const id of selected)rows.push([...base(company,month,sourceDigest),'selected',id,'true']);if(rows.length-1>IMPORT_MAX_ROWS)throw new Error('La revisión supera el máximo de filas. Dividí la selección en lotes más pequeños.');return worksheetCsv(rows);
}
async function archiveRows(file:File,company:Company,month:string){const table=await readSource(await file.arrayBuffer(),file.name);if(JSON.stringify(table.headers)!==JSON.stringify(headers))throw new Error('Formato de control de auditoría desconocido.');
 for(const r of table.rows)if(r.invalidCells?.length||r.cells.length<7||r.cells.length>headers.length||r.cells[0]!=='1'||r.cells[1]!==company.id||r.cells[2]!==company.cuit||r.cells[3]!==month)throw new Error('El control no corresponde a esta empresa y período.');return table.rows.map(r=>Array.from({length:headers.length},(_,i)=>r.cells[i]??''));
}
export async function restoreAuditSettings(file:File,company:Company,month:string,sourceDigest:string){
 const rows=await archiveRows(file,company,month),mapping:AuditMapping={...emptyAuditMapping,bank:{},categories:{}},selected=new Set<string>();let coverage=false,circuit='';
 const seen=new Set<string>();
 for(const row of rows){if(row[4]!==sourceDigest)throw new Error('Las fuentes o el plan cambiaron: revisá nuevamente la auditoría.');const [, , , , ,type,key,value]=row;
  if(seen.has(type+':'+key))throw new Error('Clave duplicada en el control.');seen.add(type+':'+key);
  if(type==='mapping'&&['purchaseVat','saleVat','suppliers','customers','otherTaxes'].includes(key))mapping[key as 'purchaseVat']=value;
  else if(type==='bank'||type==='categories'){if(['__proto__','prototype','constructor'].includes(key))throw new Error('Clave inválida');mapping[type][key]=value;}
  else if(type==='selected'){if(value!=='true')throw new Error('Selección inválida');selected.add(key);}
  else if(type==='configuration'&&key==='circuit'){if(value.length>100)throw new Error('Circuito inválido');circuit=value;}
  else if(type==='coverage'&&key==='all'){if(!['true','false'].includes(value))throw new Error('Alcance inválido');coverage=value==='true';}
  else throw new Error('Campo de control inválido');
 }return {mapping,selected,coverage,circuit};
}
export function auditManifestCsv(company:Company,month:string,sourceDigest:string,xlsName:string,xlsHash:string,ids:Set<string>){if(ids.size>IMPORT_MAX_ROWS)throw new Error('El control del lote supera el máximo de filas.');return worksheetCsv([headers,...[...ids].map(id=>[...base(company,month,sourceDigest),'batch',id,JSON.stringify({xlsName,xlsHash})])]);}
export async function auditExportHistory(docs:Document[],read:(doc:Document)=>Promise<File>,company:Company,month:string,periodId:string){
 const own=docs.filter(d=>d.company_id===company.id&&d.organization_id===company.organization_id&&d.period_id===periodId&&d.category==='Papeles de trabajo');
 const manifests=own.filter(d=>d.name.startsWith(`xubio-lote-${month}-`)&&d.name.endsWith('.csv'));
 const ids=new Set<string>(),verifiedFiles=new Set<string>();const incomplete:string[]=[];
 for(const doc of manifests){const rows=await archiveRows(await read(doc),company,month);
  if(!rows.length)throw new Error('Lote vacío: falta verificar el historial de exportaciones.');
  for(const row of rows){if(row[5]!=='batch')throw new Error('Lote inválido.');const info=z.object({xlsName:z.string().regex(/^xubio-asientos-20\d{2}-\d{2}-[a-f0-9]{16}\.xls$/),xlsHash:z.string().regex(/^[a-f0-9]{64}$/)}).parse(JSON.parse(row[7]));
   const files=own.filter(d=>d.name===info.xlsName);if(files.length!==1)throw new Error('Falta el XLS del lote o está repetido.');
   if(!verifiedFiles.has(info.xlsName)){if(await digest(await (await read(files[0])).arrayBuffer())!==info.xlsHash)throw new Error('El XLS del lote no coincide con su huella.');verifiedFiles.add(info.xlsName);}ids.add(row[6]);
  }
 }
 for(const doc of own.filter(d=>d.name.startsWith(`xubio-asientos-${month}-`)&&d.name.endsWith('.xls')))if(!verifiedFiles.has(doc.name))incomplete.push(doc.name);
 return {ids,incomplete,files:own.filter(d=>verifiedFiles.has(d.name))};
}
