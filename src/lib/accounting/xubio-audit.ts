import {readSource,type SourceTable} from '@/lib/imports';
import {cents,decimalFromCents} from '@/lib/workspace/format';
import {worksheetCsv} from '@/lib/workspace/monthly-control';
import type {Account,Voucher,Company,WorkspaceState} from '@/lib/workspace/model';
import {journalLines,pair} from './engine';
import {bookSchema,type BookRecord,type JournalLine} from './model';
import type {ComafiResult,ComafiCategory} from '@/lib/imports/comafi';

export type XubioReportKind='diario'|'mayor'|'saldos';
export const reportLabels={diario:'Libro Diario / asientos detallados',mayor:'Libro Mayor',saldos:'Sumas y Saldos'};
export type XubioLine={entry?:string;row:number;date:string;document:string;code:string;account:string;debit:string;credit:string;balance?:string;circuit:string;description:string};
export type XubioBalance={row:number;code:string;account:string;opening:string;debit:string;credit:string;closing:string;adjustedDebit:string;adjustedCredit:string;adjustedClosing:string;valid:boolean};
export type XubioReport={kind:XubioReportKind;filename:string;sha256:string;mode:'detail'|'summary';lines:XubioLine[];balances:XubioBalance[];warnings:string[];errors:string[];dates:string[];accounts:string[];summaries:{date:string;document:string;description:string}[]};
export const normalizeAccount=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/\s+/g,' ').trim().toLowerCase();
export async function digest(text:string|ArrayBuffer){const bytes=typeof text==='string'?new TextEncoder().encode(text):text;return Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)),b=>b.toString(16).padStart(2,'0')).join('');}
function reportDate(text:string){
 let value=text.trim();
 if(/^\d+(\.0+)?$/.test(value)){const n=Number(value);if(n>=20000&&n<=80000)value=new Date(Date.UTC(1899,11,30)+n*86400000).toISOString().slice(0,10);}
 if(/^\d{2}\/\d{2}\/\d{4}$/.test(value))value=value.slice(6)+'-'+value.slice(3,5)+'-'+value.slice(0,2);
 if(!/^20\d{2}-\d{2}-\d{2}$/.test(value)||!Number.isFinite(Date.parse(value+'T00:00:00Z'))||new Date(value+'T00:00:00Z').toISOString().slice(0,10)!==value)throw new Error('Fecha inválida');return value;
}
function reportMoney(value:string,numeric:boolean,blank=true){
 if(!value.trim()&&blank)return '0.00';let s=value.trim();
 if(!numeric){if(s.includes(','))s=s.replaceAll('.','').replace(',','.');if(/^\(.*\)$/.test(s))s='-'+s.slice(1,-1);}
 if(!/^-?\d{1,14}(\.\d{1,2})?$/.test(s))throw new Error('Importe inválido o con más de dos decimales');return decimalFromCents(cents(s));
}
export function parseXubioReport(kind:XubioReportKind,table:SourceTable,filename='',sha256=''):XubioReport{
 const result:XubioReport={kind,filename,sha256,mode:'detail',lines:[],balances:[],warnings:[],errors:[],dates:[],accounts:[],summaries:[]};
 const headers=table.headers.map(normalizeAccount);
 const index=(...keys:string[])=>{const indices=headers.flatMap((h,i)=>keys.includes(h)?[i]:[]);if(indices.length>1)throw new Error('Hay columnas duplicadas o ambiguas: '+keys[0]);return indices[0]??-1;};
 const columns={date:index('fecha'),document:index('documento','comprobante','documento/concepto'),number:index('numero','n°','nº','nro','numero de asiento'),account:index('cuenta'),code:index('codigo'),debit:index('debe','debitos'),credit:index('haber','creditos'),balance:index('saldo'),description:index('descripcion','concepto','documento/concepto'),circuit:index('circuito contable','circuitocontable','circuito'),opening:index('saldo anterior'),closing:index('saldo final'),adjustedDebit:index('debitos ajustados'),adjustedCredit:index('creditos ajustados'),adjustedClosing:index('saldo final ajustado')};
 const summary=kind==='diario'&&columns.date>=0&&columns.description>=0&&columns.account<0&&columns.debit<0&&columns.credit<0;
 result.mode=summary?'summary':'detail';
 const required=kind==='saldos'?['account','opening','debit','credit','closing']:(summary?['date','description']:['date','account','debit','credit']) as (keyof typeof columns)[];
 if(required.some(key=>columns[key as keyof typeof columns]<0))throw new Error('El archivo no tiene las columnas del reporte elegido. Revisá que sea '+reportLabels[kind]+'.');
 if(kind==='diario'&&!summary&&columns.document<0&&columns.number<0)throw new Error('El Diario necesita Documento o Número de asiento para agrupar sus líneas.');
 let lastDate='',lastNumber='',lastDocument='',lastCircuit='',lastDescription='';
 for(const row of table.rows){try{
  if(row.invalidCells?.length)throw new Error('Convertí las fórmulas a valores verificados antes de usar el reporte');
  const get=(key:keyof typeof columns)=>row.cells[columns[key]]?.trim()??'';
  const money=(key:keyof typeof columns)=>reportMoney(get(key),row.numericCells?.includes(columns[key])??false);
  if(kind==='saldos'){
   if(!get('account'))throw new Error('Falta el nombre de cuenta');
   const opening=money('opening'),debit=money('debit'),rawCredit=money('credit'),closing=money('closing');
   // Xubio Sumas y Saldos may show credits signed negative, unlike the Mayor.
   const credit=decimalFromCents(cents(rawCredit)<0n?-cents(rawCredit):cents(rawCredit));
   const adjustedDebit=columns.adjustedDebit<0?debit:money('adjustedDebit'),rawAdjusted=columns.adjustedCredit<0?credit:money('adjustedCredit');
   const adjustedCredit=decimalFromCents(cents(rawAdjusted)<0n?-cents(rawAdjusted):cents(rawAdjusted));
   const adjustedClosing=columns.adjustedClosing<0?closing:money('adjustedClosing');
   const valid=cents(opening)+cents(debit)-cents(credit)===cents(closing)&&cents(opening)+cents(adjustedDebit)-cents(adjustedCredit)===cents(adjustedClosing);
   if(cents(debit)<0n||cents(adjustedDebit)<0n)throw new Error('Débitos negativos requieren revisar la convención del reporte');
   result.balances.push({row:row.row,code:get('code'),account:get('account'),opening,debit,credit,closing,adjustedDebit,adjustedCredit,adjustedClosing,valid});
   if(!valid)result.errors.push(`Fila ${row.row}: los saldos no coinciden con sus movimientos.`);
   continue;
  }
  if(summary){result.summaries.push({date:reportDate(get('date')),document:get('document'),description:get('description')});continue;}
  const nextDate=get('date')?reportDate(get('date')):lastDate;if(!nextDate)throw new Error('Falta la fecha');
  const number=get('number'),document=get('document'),circuit=get('circuit');
  const changedDate=!!lastDate&&nextDate!==lastDate,changedCircuit=!!circuit&&circuit!==lastCircuit;
  if((changedDate||changedCircuit)&&!number&&!document)throw new Error('Nueva fecha o circuito sin documento o número de asiento');
  if(number&&number===lastNumber&&!changedDate&&!changedCircuit&&document&&lastDocument&&document!==lastDocument)throw new Error('Número repetido con documento distinto en la misma fecha y circuito');
  const newEntry=!lastDate||changedDate||changedCircuit||!!(number&&number!==lastNumber)||!!(!number&&document&&document!==lastDocument);
  if(newEntry){lastNumber=number;lastDocument=document;lastCircuit=circuit;lastDescription=get('description');}
  else{if(number)lastNumber=number;if(!lastDocument&&document)lastDocument=document;if(circuit)lastCircuit=circuit;if(!lastDescription&&get('description'))lastDescription=get('description');}
  lastDate=nextDate;
  if(!lastNumber&&!lastDocument)throw new Error('Falta el documento o número de asiento');
  const identifier=[lastNumber,lastDocument].filter(Boolean).join(' · '),entry=lastNumber?'number:'+lastNumber:'document:'+lastDocument;
  if(!get('account'))throw new Error('Falta la cuenta contable');
  const debit=money('debit'),credit=money('credit');
  if(cents(debit)<0n||cents(credit)<0n)throw new Error('Debe/Haber negativos requieren revisar el formato detallado');
  if(cents(debit)!==0n&&cents(credit)!==0n)throw new Error('Una línea lleva Debe o Haber, no ambos');
  const balance=columns.balance<0||!get('balance')?undefined:money('balance');
  result.lines.push({entry,row:row.row,date:lastDate,document:identifier,code:get('code'),account:get('account'),debit,credit,balance,circuit:lastCircuit,description:get('description')||lastDescription});
 }catch(error){result.errors.push(`Fila ${row.row}: ${error instanceof Error?error.message:'Datos inválidos'}.`);}}
 result.dates=[...new Set([...result.lines.map(l=>l.date),...result.summaries.map(s=>s.date)])].sort();
 result.accounts=[...new Set([...result.lines.map(l=>l.account),...result.balances.map(l=>l.account)])];
 if(summary)result.warnings.push('Este archivo es un listado de asientos sin líneas contables. Hace falta el Libro Diario detallado para concluir faltantes y exportar.');
 if(kind==='diario'&&!summary){for(const entry of journalEntries(result))if(!entry.balanced)result.errors.push(`Asiento iniciado en fila ${entry.row}: líneas incompletas, sin importes o Debe/Haber desbalanceados.`);}
 if(kind==='mayor'){
  result.warnings.push(`El Mayor cubre ${result.accounts.length} cuenta(s); no sustituye el Diario completo.`);
  const running=new Map<string,bigint>();
  for(const line of result.lines){const key=normalizeAccount(line.account);if(/saldo inicial|saldo anterior/i.test(line.document)){
   if(running.has(key)||line.balance===undefined)result.errors.push(`Fila ${line.row}: saldo inicial repetido o ausente.`);
   else running.set(key,cents(line.balance));continue;
  }if(running.has(key)){const total=running.get(key)!+cents(line.debit)-cents(line.credit);if(line.balance!==undefined&&total!==cents(line.balance))result.errors.push(`Fila ${line.row}: diferencia en saldo del Mayor.`);running.set(key,total);}else result.warnings.push(`Fila ${line.row}: sin saldo inicial para verificar el Mayor.`);}
 }
 return result;
}
export function journalEntries(report:XubioReport){
 const groups=new Map<string,{id:string;row:number;date:string;reference:string;lines:number;debit:bigint;credit:bigint}>();
 if(report.kind!=='diario'||report.mode!=='detail')return [];
 for(const line of report.lines){const id=line.date+'|'+line.circuit+'|'+(line.entry??line.document),g=groups.get(id)??{id,row:line.row,date:line.date,reference:line.document,lines:0,debit:0n,credit:0n};g.lines++;g.debit+=cents(line.debit);g.credit+=cents(line.credit);groups.set(id,g);}
 return [...groups.values()].map(g=>({...g,debit:decimalFromCents(g.debit),credit:decimalFromCents(g.credit),balanced:g.lines>=2&&g.debit>0n&&g.debit===g.credit}));
}

export async function readXubioReport(kind:XubioReportKind,file:File){const buffer=await file.arrayBuffer();return parseXubioReport(kind,await readSource(buffer,file.name),file.name,await digest(buffer));}

export type Candidate={id:string;date:string;description:string;reference:string;currency:string;source:'book'|'voucher'|'bank';lines:JournalLine[];blocked:string[];voucher?:Voucher;record?:BookRecord;bankKey?:string};
export type AuditMapping={bank:Record<string,string>;categories:Record<string,string>;purchaseVat:string;saleVat:string;suppliers:string;customers:string;otherTaxes:string};
export const emptyAuditMapping:AuditMapping={bank:{},categories:{},purchaseVat:'',saleVat:'',suppliers:'',customers:'',otherTaxes:''};
const feeCategories=new Set<ComafiCategory>(['commission','interest','vat_general','vat_reduced','vat','vat_perception','vat_withholding','iibb_withholding','iibb_perception','debit_tax','credit_tax','stamp_tax']);
function sumLines(lines:JournalLine[]){const sums=new Map<string,bigint>();for(const l of lines)sums.set(l.account_id,(sums.get(l.account_id)??0n)+cents(l.debit)-cents(l.credit));return sums;}
export function vector(lines:JournalLine[]){return [...sumLines(lines)].filter(([,n])=>n!==0n).sort(([a],[b])=>a.localeCompare(b)).map(([a,n])=>a+':'+n).join('|');}
export function makeCandidates(state:WorkspaceState,company:Company,periodId:string,mapping:AuditMapping,banks:ComafiResult[]):Candidate[]{
 const period=state.periods.find(p=>p.id===periodId&&p.company_id===company.id&&p.organization_id===company.organization_id);if(!period)return [];
 const month=period.month.slice(0,7),accounts=state.accounts.filter(a=>a.company_id===company.id&&a.organization_id===company.organization_id);
 const byId=new Map(accounts.map(a=>[a.id,a]));const result:Candidate[]=[];
 const scope=state.bookRecords.filter(r=>r.company_id===company.id&&r.organization_id===company.organization_id&&r.period_id===periodId);
 for(const r of scope){const lines=journalLines(r.payload);if(!lines.length)continue;const blocked:string[]=[];if(r.payload.kind==='journal'&&r.payload.source_key.startsWith('voucher:')){const key=r.payload.source_key.slice(8),origin=state.vouchers.find(v=>v.id===key&&v.company_id===company.id&&v.period_id===periodId);if(!origin||origin.review_status!=='approved'||!origin.counterparty_name||!origin.counterparty_cuit)blocked.push('El comprobante de origen necesita revisión e identificación de contraparte.');if(origin?.cost_center)blocked.push('Este exportador requiere revisar el centro de costo del comprobante.');}result.push({id:'book:'+r.id,date:r.payload.date,description:r.payload.description,reference:r.payload.reference,currency:r.payload.currency,source:'book',lines,blocked,record:r});}
 const journalVouchers=new Set(scope.flatMap(r=>r.payload.kind==='journal'&&r.payload.source_key.startsWith('voucher:')?[r.payload.source_key.slice(8)]:[]));
 for(const v of state.vouchers.filter(v=>v.company_id===company.id&&v.organization_id===company.organization_id&&v.period_id===periodId&&!journalVouchers.has(v.id))){
  const purchase=v.direction==='purchase',lines:JournalLine[]=[];const blocked:string[]=[];
  const add=(id:string|undefined,n:bigint,reason:string)=>{if(!n)return;if(!id){blocked.push(reason);return;}lines.push(...pair(id,'__TEMP__',n).filter(l=>l.account_id!=='__TEMP__'));};
  const sign=purchase?1n:-1n;
  add(v.account_id??'',sign*(cents(v.taxable)+cents(v.untaxed)+cents(v.exempt)),'Asigná la cuenta del comprobante.');
  if(purchase&&v.deductible_vat===null&&cents(v.vat)!==0n)blocked.push('Definí el IVA computable de la compra.');
  const deductible=purchase?cents(v.deductible_vat??'0'):cents(v.vat);
  if(purchase&&deductible!==cents(v.vat))blocked.push('IVA no computable/parcial: prepará y revisá su asiento en Contabilidad antes de exportar.');
  add(purchase?mapping.purchaseVat:mapping.saleVat,sign*deductible,'Asigná la cuenta de IVA.');
  add(mapping.otherTaxes,sign*cents(v.other_taxes),'Otros tributos requieren discriminación y cuenta revisada.');
  if(cents(v.other_taxes)!==0n)blocked.push('Discriminá otros tributos en un asiento revisado antes de exportar.');
  add(purchase?mapping.suppliers:mapping.customers,-sign*cents(v.total),'Asigná la cuenta de proveedores/clientes.');
  if(v.review_status!=='approved')blocked.push('El comprobante no está aprobado.');
  if(!v.counterparty_name||!v.counterparty_cuit)blocked.push('Falta identificar la contraparte.');
  if(v.cost_center)blocked.push('El centro de costo debe revisarse en un asiento manual antes de este exportador.');
  result.push({id:'voucher:'+v.id,date:v.date,description:`${purchase?'Compra':'Venta'} ${v.receipt_type} ${v.point_of_sale}-${v.receipt_number} · ${v.counterparty_name??''}`,reference:`${v.receipt_type}:${v.point_of_sale}:${v.receipt_number}:${v.counterparty_cuit??''}`,currency:v.currency,source:'voucher',lines,blocked,voucher:v});
 }
 const seenBank=new Set<string>();
 const variants=new Map<string,Set<string>>();for(const b of banks.filter(b=>b.month===month))for(const a of b.accounts){const key=a.number,signature=JSON.stringify([a.currency,a.opening,a.closing,a.movements]);const set=variants.get(key)??new Set<string>();set.add(signature);variants.set(key,set);}
 for(const bank of banks){if(bank.month!==month)continue;for(const account of bank.accounts){for(const movement of account.movements){
  // Account/date/ordinal IDs stay stable across a re-export of the same statement.
  const key=movement.id;if(seenBank.has(key))continue;seenBank.add(key);
  const cash=mapping.bank[account.number],counterpart=mapping.categories[movement.category];const blocked:string[]=[];
  if((variants.get(account.number)?.size??0)>1)blocked.push('Hay versiones distintas del mismo extracto: revisá cuál corresponde.');
  if(!cash)blocked.push('Vinculá la cuenta bancaria del plan.');if(!counterpart)blocked.push('Asigná la contrapartida contable de esta categoría.');
  if(!feeCategories.has(movement.category))blocked.push('Transferencia u otro movimiento: identificá contraparte y obligación en Contabilidad.');
  const amount=cents(movement.amount),lines=cash&&counterpart?pair(amount<0n?counterpart:cash,amount<0n?cash:counterpart,amount<0n?-amount:amount):[];
  const already=scope.filter(r=>r.payload.kind==='cash'&&r.payload.date===movement.date&&r.payload.cash_account_id===cash&&((r.payload.flow==='in'?1n:-1n)*cents(r.payload.amount))===amount);
  if(already.length){blocked.push('Hay movimiento(s) similares del libro: revisá su vínculo para no duplicar propuestas.');}
  result.push({id:'bank:'+key,date:movement.date,description:movement.description,reference:key,currency:account.currency,source:'bank',lines,blocked,bankKey:account.number});
 }}}
 for(const c of result){
  if(c.record?.payload.kind==='cash'&&c.record.payload.role!=='other'&&!c.record.payload.name.trim())c.blocked.push('Falta el nombre de organización de Xubio para la contraparte.');
  if(c.voucher&&byId.get(c.voucher.direction==='purchase'?mapping.suppliers:mapping.customers)?.kind!==(c.voucher.direction==='purchase'?'liability':'asset'))c.blocked.push('La cuenta de control no corresponde a proveedores/clientes.');
  if(c.date.slice(0,7)!==month)c.blocked.push('Fecha fuera del período.');if(c.currency!=='ARS')c.blocked.push('El modelo XLS verificado solo permite ARS.');
  if(c.lines.some(l=>!byId.has(l.account_id)||byId.get(l.account_id)!.status!=='active'))c.blocked.push('Hay cuentas ajenas o inactivas.');
  if(c.lines.some(l=>{const account=byId.get(l.account_id);return account&&accounts.filter(a=>normalizeAccount(a.name)===normalizeAccount(account.name)).length!==1;}))c.blocked.push('Nombre de cuenta ambiguo para importar en Xubio.');
  if(c.lines.length<2||!vector(c.lines)||c.lines.reduce((s,l)=>s+cents(l.debit)-cents(l.credit),0n)!==0n)c.blocked.push('Falta un asiento completo y balanceado.');
  if(c.source==='bank'&&c.bankKey&&byId.get(mapping.bank[c.bankKey])?.kind!=='asset')c.blocked.push('La cuenta bancaria debe ser de activo.');
 }
 return result;
}
export type Finding={candidate:Candidate;status:'matched'|'ambiguous'|'missing'|'blocked'|'exported';evidence:string[]};
export type AuditResult={findings:Finding[];issues:string[];groups:{id:string;date:string;reference:string;lines:JournalLine[]}[];ready:boolean};
export function auditXubio(candidates:Candidate[],reports:Partial<Record<XubioReportKind,XubioReport>>,accounts:Account[],month:string,coverage:boolean,exported:Set<string>=new Set()):AuditResult{
 const issues:string[]=[],groups:AuditResult['groups']=[];const diary=reports.diario;
 if(!diary||diary.mode!=='detail')issues.push('Falta Libro Diario detallado con todas las líneas de los asientos.');
 if(!reports.mayor)issues.push('Falta Libro Mayor.');if(!reports.saldos)issues.push('Falta Sumas y Saldos.');
 if(!coverage)issues.push('Confirmá empresa, moneda ARS, período y cobertura de todos los circuitos del Diario y los filtros de Sumas y Saldos.');
 for(const report of Object.values(reports)){issues.push(...report.errors.map(e=>`${reportLabels[report.kind]}: ${e}`));}
 function resolve(code:string,name:string){const matches=accounts.filter(a=>code?a.code===code:normalizeAccount(a.name)===normalizeAccount(name));if(matches.length!==1||(code&&normalizeAccount(matches[0].name)!==normalizeAccount(name)))return undefined;return matches[0].id;}
 if(diary?.mode==='detail'){
  const grouped=new Map<string,{id:string;date:string;reference:string;lines:JournalLine[]}>();
  for(const l of diary.lines){if(l.date.slice(0,7)!==month)continue;const id=l.date+'|'+l.circuit+'|'+(l.entry??l.document);let group=grouped.get(id);if(!group){group={id,date:l.date,reference:l.document,lines:[]};grouped.set(id,group);}
   const account=resolve(l.code,l.account);if(!account){issues.push(`Diario fila ${l.row}: cuenta desconocida o ambigua respecto del plan de la empresa.`);continue;}
   if(cents(l.debit)||cents(l.credit))group.lines.push({account_id:account,debit:l.debit,credit:l.credit});
  }
  for(const group of grouped.values()){if(group.lines.length<2||group.lines.reduce((s,l)=>s+cents(l.debit)-cents(l.credit),0n)!==0n)issues.push(`Asiento ${group.reference}: incompleto o desbalanceado.`);else groups.push(group);}
  if(diary.lines.length&&!diary.lines.some(l=>l.date.slice(0,7)===month))issues.push('El Diario no contiene movimientos del mes elegido.');
 }
 // Account-level totals must reconcile with Sumas y Saldos before any "missing" proposal can be exported.
 if(diary?.mode==='detail'&&reports.saldos){
  const totals=new Map<string,{debit:bigint;credit:bigint}>();for(const g of groups)for(const l of g.lines){const t=totals.get(l.account_id)??{debit:0n,credit:0n};t.debit+=cents(l.debit);t.credit+=cents(l.credit);totals.set(l.account_id,t);}
  const covered=new Set<string>();for(const b of reports.saldos.balances){const id=resolve(b.code,b.account);if(!id){issues.push(`Sumas y Saldos fila ${b.row}: cuenta desconocida o ambigua.`);continue;}if(covered.has(id))issues.push(`Sumas y Saldos fila ${b.row}: cuenta repetida.`);covered.add(id);const t=totals.get(id)??{debit:0n,credit:0n};if(t.debit!==cents(b.debit)||t.credit!==cents(b.credit))issues.push(`Sumas y Saldos fila ${b.row}: los débitos/créditos no coinciden con el Diario del mes.`);}
  if([...totals.keys()].some(id=>!covered.has(id)))issues.push('Hay cuentas del Diario ausentes en Sumas y Saldos.');
 }
 if(diary?.mode==='detail'&&reports.mayor){
  const ledgerTotals=new Map<string,{debit:bigint;credit:bigint}>();
  for(const l of reports.mayor.lines){const id=resolve(l.code,l.account);if(!id){issues.push(`Mayor fila ${l.row}: cuenta desconocida o ambigua.`);continue;}if(!ledgerTotals.has(id))ledgerTotals.set(id,{debit:0n,credit:0n});if(l.date.slice(0,7)!==month||/saldo inicial|saldo anterior/i.test(l.document))continue;const t=ledgerTotals.get(id)!;t.debit+=cents(l.debit);t.credit+=cents(l.credit);}
  for(const [id,total]of ledgerTotals){const lines=groups.flatMap(g=>g.lines).filter(l=>l.account_id===id);if(lines.reduce((s,l)=>s+cents(l.debit),0n)!==total.debit||lines.reduce((s,l)=>s+cents(l.credit),0n)!==total.credit)issues.push('El Mayor de '+(accounts.find(a=>a.id===id)?.name??'una cuenta')+' no coincide con el Diario del mes. Revisá filtros y cobertura.');}
 }
 const byVector=new Map<string,AuditResult['groups']>(),byDayVector=new Map<string,AuditResult['groups']>(),overlap=new Set<string>();
 for(const group of groups){const signature=vector(group.lines),dayKey=group.date+'|'+signature;byVector.set(signature,[...(byVector.get(signature)??[]),group]);byDayVector.set(dayKey,[...(byDayVector.get(dayKey)??[]),group]);for(const [id,amount]of sumLines(group.lines))if(amount!==0n)overlap.add(group.date+'|'+id+'|'+amount);}
 const signatures=new Map<string,Candidate[]>();for(const c of candidates){const key=c.date+'|'+vector(c.lines);signatures.set(key,[...(signatures.get(key)??[]),c]);}
 const findings:Finding[]=candidates.map(candidate=>{
  const evidence:string[]=[];let status:Finding['status']='missing';
  const matches=byDayVector.get(candidate.date+'|'+vector(candidate.lines))??[];
  if(matches.length){status=matches.length===1&&(signatures.get(candidate.date+'|'+vector(candidate.lines))?.length??0)===1?'matched':'ambiguous';evidence.push(...matches.map(g=>g.reference));}
  else if(byVector.has(vector(candidate.lines))){status='ambiguous';evidence.push('Coincidencia contable en otra fecha: revisar devengamiento y fecha de registración.');}
  if(status==='missing'){
   const expected=sumLines(candidate.lines);
   if([...expected].some(([id,amount])=>amount!==0n&&overlap.has(candidate.date+'|'+id+'|'+amount))){status='ambiguous';evidence.push('Hay importes iguales en alguna de las mismas cuentas. Revisá documento e imputación antes de proponer otro asiento.');}
  }
  if(candidate.blocked.length&&status!=='matched')status='blocked';
  if(exported.has(candidate.id)&&status!=='matched'){status='exported';evidence.push('Incluido en un lote guardado. Reutilizá ese archivo y verificá la importación con un Diario actualizado.');}
  return {candidate,status,evidence};
 });
 // Flag common consolidated postings instead of falsely treating their components as missing.
 const buckets=new Map<string,Candidate[]>();for(const f of findings.filter(f=>f.status==='missing'&&(f.candidate.source==='bank'||!!f.candidate.voucher))){const c=f.candidate,key=c.source==='bank'?'bank:'+(c.bankKey??''):'vouchers:'+c.voucher!.direction;buckets.set(key,[...(buckets.get(key)??[]),c]);}
 for(const bucket of buckets.values()){if(bucket.length<2)continue;const signature=vector(bucket.flatMap(c=>c.lines)),matches=byVector.get(signature)??[];if(matches.length)for(const f of findings.filter(f=>bucket.includes(f.candidate))){f.status='ambiguous';f.evidence.push('Posible asiento agrupado: '+matches.map(g=>g.reference).join(', '));}}
 return {findings,issues:[...new Set(issues)],groups,ready:issues.length===0};
}
export function auditCsv(result:AuditResult,company:Company,month:string){return worksheetCsv([
 ['empresa_cuit','periodo','origen','identificador','fecha','concepto','estado','evidencia','pendientes'],
 ...result.findings.map(f=>[company.cuit,month,f.candidate.source,f.candidate.id,f.candidate.date,f.candidate.description,f.status,f.evidence.join(' | '),f.candidate.blocked.join(' | ')]),
 ...result.issues.map(issue=>[company.cuit,month,'control','','','','alcance_incompleto','',issue]),
]);}
export function exportAuditRecords(result:AuditResult,selected:Set<string>,company:Company,periodId:string,accounts:Account[],month:string):BookRecord[]{
 if(selected.size>5000)throw new Error('Dividí la selección en lotes de hasta 5.000 operaciones.');
 if(!result.ready)throw new Error('La auditoría está incompleta. Corregí las observaciones antes de generar el XLS.');
 const eligible=result.findings.filter(f=>selected.has(f.candidate.id));
 if(!eligible.length||eligible.length!==selected.size||eligible.some(f=>f.status!=='missing'||f.candidate.blocked.length))throw new Error('Seleccioná solamente faltantes revisados y completos.');
 return eligible.map(f=>{const c=f.candidate;if(c.date.slice(0,7)!==month||c.currency!=='ARS'||c.lines.some(l=>!accounts.some(a=>a.id===l.account_id&&a.company_id===company.id&&a.organization_id===company.organization_id&&a.status==='active')))throw new Error('Propuesta fuera de empresa, período, moneda o cuentas activas.');
  if(c.record){bookSchema.parse(c.record.payload);return c.record;}
  const payload=bookSchema.parse({kind:'journal',date:c.date,currency:c.currency,reference:c.reference.slice(0,180),description:c.description.slice(0,180),document_id:null,source_key:c.voucher?'voucher:'+c.voucher.id:'audit:'+c.id,lines:c.lines});
  if(payload.kind!=='journal')throw new Error('Tipo inválido');return {id:c.id,company_id:company.id,organization_id:company.organization_id,period_id:periodId,payload};
 });
}
