import { cents, decimalFromCents } from '@/lib/workspace/format';
import { worksheetCsv } from '@/lib/workspace/monthly-control';

export const comafiCategories = {
 commission:'Comisiones bancarias', interest:'Intereses por descubierto',
 vat_general:'IVA bancario · alícuota general', vat_reduced:'IVA bancario · alícuota reducida', vat:'IVA bancario · revisar alícuota',
 vat_perception:'Percepción IVA', vat_withholding:'Retención IVA',
 iibb_withholding:'Retención IIBB / SIRCREB', iibb_perception:'Percepción IIBB',
 debit_tax:'Impuesto a los débitos', credit_tax:'Impuesto a los créditos', stamp_tax:'Sellos',
 transfer:'Transferencia · identificar destino/origen', other:'Otro movimiento · revisar',
} as const;
export type ComafiCategory=keyof typeof comafiCategories;
export type ComafiMovement={id:string;date:string;description:string;reference:string;debit:string;credit:string;amount:string;balance:string|null;category:ComafiCategory;page:number;line:number};
export type ComafiAccount={number:string;currency:'ARS'|'USD';opening_on:string;closing_on:string;opening:string;closing:string;no_movements:boolean;movements:ComafiMovement[]};
export type ComafiLine={text:string;page:number;line:number;items:{text:string;x:number;width:number}[]};
export type ComafiResult={source_sha256?:string;month:string;accounts:ComafiAccount[];warning:string};
const normalized=(text:string)=>text.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();
export function classifyComafi(description:string):ComafiCategory {
 const s=normalized(description);
 if(/(?:percep.*iva|iva.*percep)/.test(s))return 'vat_perception';
 if(/(?:reten.*iva|iva.*reten)/.test(s))return 'vat_withholding';
 if(/sircreb|(?:reten.*(?:iibb|ingresos brutos))/.test(s))return 'iibb_withholding';
 if(/percep.*(?:iibb|ingresos brutos)/.test(s))return 'iibb_perception';
 if(/impuesto a los debitos/.test(s))return 'debit_tax';
 if(/impuesto a los creditos/.test(s))return 'credit_tax';
 if(/impuesto a los sellos/.test(s))return 'stamp_tax';
 if(/\biva\b|i\.v\.a/.test(s))return /general/.test(s)?'vat_general':/reducida/.test(s)?'vat_reduced':'vat';
 if(/comision/.test(s))return 'commission';
 if(/interes/.test(s))return 'interest';
 if(/transf/.test(s))return 'transfer';
 return 'other';
}
const date=(text:string)=>{
 const m=text.match(/(\d{2})\/(\d{2})\/(\d{2}|\d{4})(?!\d)/);
 if(!m)throw new Error('No se pudo reconocer la fecha del saldo o movimiento.');
 const iso=`${m[3].length===2?'20'+m[3]:m[3]}-${m[2]}-${m[1]}`,value=new Date(iso+'T00:00:00Z');
 if(!Number.isFinite(value.getTime())||value.toISOString().slice(0,10)!==iso)throw new Error('Fecha bancaria inválida.');return iso;
};
const moneyPattern=/^-?\d[\d.]*,\d{2}\s*-?$/;
function amount(text:string){
 let value=text.trim();if(!moneyPattern.test(value))throw new Error('Importe bancario fuera de formato.');
 if(value.endsWith('-'))value='-'+value.slice(0,-1).trim();
 if(!/^-?(?:\d+|\d{1,3}(?:\.\d{3})+),\d{2}$/.test(value))throw new Error('Separador bancario inválido.');
 value=value.replaceAll('.','').replace(',','.');if(!/^-?\d{1,14}\.\d{2}$/.test(value))throw new Error('Saldo fuera de formato.');return value;
}
const balance=(line:string)=>{const m=line.match(/-?\d[\d.]*,\d{2}\s*-?\s*$/);if(!m)throw new Error('No se pudo reconocer el importe del saldo.');return amount(m[0]);};

// Strings alone cannot distinguish a debit from a credit. Movement extraction requires PDF coordinates.
export function parseComafiLines(lines:string[]){return parseComafiRows(lines.map((text,i)=>({text,page:1,line:i+1,items:[]})));}
export function parseComafiRows(rows:ComafiLine[]):ComafiResult {
 rows=rows.map(row=>({...row,text:row.text.replace(/\s+/g,' ').trim()}));
 if(!rows.some(l=>/COMAFI/i.test(l.text)))throw new Error('No se reconoce un resumen Comafi.');
 const accounts:ComafiAccount[]=[];
 let current:Partial<ComafiAccount>|null=null,inside=false,pending:ComafiMovement|null=null;
 let columns:{debit:number;credit:number;balance:number;description:number;reference:number}|null=null;
 let running=0n,lastDate='';
 function flush(){
  if(!pending||!current)return;
  const delta=cents(pending.credit)-cents(pending.debit);
  if(delta===0n || (cents(pending.credit)!==0n&&cents(pending.debit)!==0n))throw new Error('Movimiento sin importe único de débito o crédito. Revisá el original.');
  if(!current.opening_on||!current.number)throw new Error('Falta saldo inicial o número de cuenta antes del movimiento.');
  if(pending.date<=current.opening_on||pending.date<lastDate)throw new Error('Fechas bancarias fuera de orden o anteriores al saldo inicial.');
  if(!pending.description.trim())throw new Error('Falta el concepto de un movimiento.');
  lastDate=pending.date;running+=delta;
  if(pending.balance!==null&&running!==cents(pending.balance))throw new Error(`El saldo intermedio no coincide en página ${pending.page}, renglón ${pending.line}. No se confirmó la lectura.`);
  pending.amount=decimalFromCents(delta);pending.category=classifyComafi(pending.description);
  current.movements!.push(pending);pending=null;
 }
 function finish(){
  if(!current)return;flush();
  if(inside||!current.number||!current.opening_on||!current.closing_on||current.opening===undefined||current.closing===undefined)throw new Error('Faltan datos o el cierre de una cuenta. Revisá el PDF original.');
  if(current.opening_on>=current.closing_on||current.movements!.some(m=>m.date>current!.closing_on!||m.date.slice(0,7)!==current!.closing_on!.slice(0,7)))throw new Error('El detalle no corresponde al mes de cierre.');
  if(current.no_movements&&current.movements!.length)throw new Error('El detalle declara SIN MOVIMIENTOS pero contiene operaciones.');
  if(!current.no_movements&&!current.movements!.length)throw new Error('El detalle no contiene movimientos ni declara SIN MOVIMIENTOS.');
  if(running!==cents(current.closing))throw new Error('El saldo inicial más créditos menos débitos no coincide con el saldo final.');
  accounts.push(current as ComafiAccount);
 }
 for(const row of rows){const line=row.text;
  if(/COMAFI PYME.*CUENTA.*(?:PESOS|DOLARES)/i.test(line)){
   // A repeated account heading may continue an open table on another page.
   if(current&&inside)continue;
   finish();current={currency:/DOLARES/i.test(line)?'USD':'ARS',no_movements:false,movements:[]};inside=false;columns=null;running=0n;lastDate='';continue;
  }
  if(!current)continue;
  if(!current.number){const m=line.match(/N(?:RO\.?|[ÚU]MERO)\s*[:.]?\s*(\d{3,5}-\d{4,12}-\d)/i);if(m)current.number=m[1];}
  if(/DETALLE DE MOVIMIENTOS/i.test(line)){inside=true;continue;}
  if(!inside)continue;
  if(/Fecha.*Conceptos.*Referencias.*D[eé]bitos.*Cr[eé]ditos.*Saldo/i.test(line)){
   const x=(label:string)=>row.items.find(i=>normalized(i.text.trim())===label)?.x;
   const debit=x('debitos'),credit=x('creditos'),saldo=x('saldo'),reference=x('referencias'),description=x('conceptos');
   if(debit!==undefined&&credit!==undefined&&saldo!==undefined&&reference!==undefined&&description!==undefined&&description<reference&&reference<debit&&debit<credit&&credit<saldo)columns={debit:(reference+debit)/2,credit:(debit+credit)/2,balance:(credit+saldo)/2,description,reference};
   else columns=null;
   continue;
  }
  if(/Saldo Anterior/i.test(line)){
   if(current.opening!==undefined)throw new Error('Se repite el saldo inicial de la cuenta.');
   current.opening_on=date(line);current.opening=balance(line);running=cents(current.opening);continue;
  }
  if(/Saldo al:/i.test(line)){flush();current.closing_on=date(line);current.closing=balance(line);inside=false;continue;}
  if(/SIN MOVIMIENTOS/i.test(line)){current.no_movements=true;continue;}
  if(!line||/^-+$/.test(line))continue;
  const startsDate=/^\d{2}\/\d{2}\/\d{2}(?:\d{2})?\b/.test(line);
  if(/^\d{2}\/\d{2}/.test(line)&&!startsDate)throw new Error('Fecha de movimiento fuera del formato validado.');
  if(startsDate){
   if(!columns)throw new Error('Se encontró un movimiento dentro del detalle sin columnas PDF verificables. No se pudo confirmar su lectura.');
   flush();pending={id:`COMAFI:${current.number}:${date(line)}:${current.movements!.length+1}`,date:date(line),description:'',reference:'',debit:'0.00',credit:'0.00',amount:'0.00',balance:null,category:'other',page:row.page,line:row.line};
  }
  if(pending&&columns){
   const descriptions:string[]=[],references:string[]=[];
   for(const item of row.items){
    const text=item.text.trim();if(!text||/^\d{2}\/\d{2}\/\d{2}(?:\d{2})?$/.test(text))continue;
    const center=item.x+item.width/2;
    if(item.x>=columns.debit){
     if(!moneyPattern.test(text))throw new Error(`Importe no reconocido en página ${row.page}, renglón ${row.line}.`);
     const key=center>=columns.balance?'balance':center>=columns.credit?'credit':'debit';
     if((key==='balance'&&pending.balance!==null)||(key!=='balance'&&pending[key]!=='0.00'))throw new Error('Más de un importe en la misma columna de un movimiento.');
     pending[key]=amount(text);
    }else if(item.x>=columns.reference-2)references.push(text);
    else if(item.x>=columns.description-2)descriptions.push(text);
   }
   if(descriptions.length)pending.description=[pending.description,descriptions.join(' ')].filter(Boolean).join(' ');
   if(references.length)pending.reference=[pending.reference,references.join(' ')].filter(Boolean).join(' ');
  }else if(startsDate||(/\d+,\d{2}/.test(line)))throw new Error('Renglón con importes o fecha fuera de un movimiento reconocido.');
 }
 finish();if(!accounts.length)throw new Error('No se encontraron cuentas con saldos verificables.');
 if(new Set(accounts.map(a=>a.number)).size!==accounts.length)throw new Error('Se repite una cuenta en el resumen.');
 const months=[...new Set(accounts.map(a=>a.closing_on.slice(0,7)))];if(months.length!==1)throw new Error('Las cuentas no corresponden al mismo mes.');
 return {month:months[0],accounts,warning:'Clasificación sugerida por el concepto, pendiente de revisión. Transferencias no equivalen a ventas ni a pagos de proveedores identificados. Rechazos, adhesiones y avisos fuera del detalle no se contabilizan. Revisá la factura bancaria para evitar duplicar IVA; sellos e impuesto a los débitos/créditos se muestran separados y no se presumen crédito fiscal.'};
}

export function comafiTotals(account:ComafiAccount){
 const groups=new Map<ComafiCategory,{debit:bigint;credit:bigint}>();
 for(const m of account.movements){const g=groups.get(m.category)??{debit:0n,credit:0n};g.debit+=cents(m.debit);g.credit+=cents(m.credit);groups.set(m.category,g);}
 return [...groups].map(([category,g])=>({category,debit:decimalFromCents(g.debit),credit:decimalFromCents(g.credit),net:decimalFromCents(g.debit-g.credit)}));
}
export function comafiWorksheetCsv(result:ComafiResult,companyCuit:string,sourceName:string,reviewed=false){
 return worksheetCsv([
  ['empresa_cuit','periodo','archivo','sha256_original','revision','cuenta_bancaria','moneda','tipo_registro','fecha_saldo_inicial','saldo_inicial_cuenta','fecha_cierre','saldo_final_cuenta','fecha','identificador','referencia_bancaria','concepto','clasificacion_revisable','debito','credito','importe_con_signo','saldo_informado','pagina','renglon','alcance'],
  ...result.accounts.flatMap(a=>(a.movements.length?a.movements:[null]).map(m=>[
   companyCuit,result.month,sourceName,result.source_sha256??'',reviewed?'Revisado por usuario':'Clasificación sugerida sin confirmar',a.number,a.currency,m?'movimiento':'sin_movimientos',a.opening_on,a.opening,a.closing_on,a.closing,
   m?.date??a.closing_on,m?.id??'',m?.reference??'',m?.description??'Cuenta sin movimientos',m?comafiCategories[m.category]:'Sin movimientos',m?.debit??'',m?.credit??'',m?.amount??'',m?.balance??'',m?String(m.page):'',m?String(m.line):'','Papel bancario; no es DDJJ ni asiento Xubio',
  ])),
 ]);
}

export async function readComafiPdf(buffer:ArrayBuffer) {
 if(!buffer.byteLength||buffer.byteLength>3*1024*1024)throw new Error('Elegí un PDF de texto de hasta 3 MiB.');
 const source_sha256=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)),b=>b.toString(16).padStart(2,'0')).join('');
 const {getDocumentProxy}=await import('unpdf');
 const pdf=await getDocumentProxy(new Uint8Array(buffer),{maxImageSize:1000000,disableFontFace:true});
 try{
  if(pdf.numPages>50)throw new Error('El PDF supera las 50 páginas.');
  const lines:ComafiLine[]=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),content=await page.getTextContent();if(content.items.length>20000)throw new Error('Demasiados elementos de texto en la página.');
   const items=content.items.flatMap(item=>'str'in item&&item.str.trim()?[{text:item.str,x:item.transform[4],y:item.transform[5],width:item.width}]:[]).sort((a,b)=>b.y-a.y||a.x-b.x);
   const groups:{y:number;items:typeof items}[]=[];
   for(const item of items){let group=groups.at(-1);if(!group||Math.abs(group.y-item.y)>=2){group={y:item.y,items:[]};groups.push(group);}group.items.push(item);}
   for(const [index,group] of groups.entries()){const sorted=group.items.sort((a,b)=>a.x-b.x);lines.push({text:sorted.map(i=>i.text).join('  '),items:sorted,page:p,line:index+1});}
   if(lines.reduce((s,l)=>s+l.text.length,0)>500000)throw new Error('El texto extraído supera el límite.');
   page.cleanup();
  }
  return {...parseComafiRows(lines),source_sha256};
 }finally{await pdf.loadingTask.destroy();}
}
