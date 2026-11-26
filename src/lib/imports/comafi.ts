import { cents, decimalFromCents } from '@/lib/workspace/format';
export type ComafiAccount={number:string;currency:'ARS'|'USD';opening_on:string;closing_on:string;opening:string;closing:string;no_movements:boolean};
const date=(text:string)=>{const m=text.match(/(\d{2})\/(\d{2})\/(\d{2}|\d{4})(?!\d)/);if(!m)throw new Error('No se pudo reconocer la fecha del saldo.');const iso=`${m[3].length===2?'20'+m[3]:m[3]}-${m[2]}-${m[1]}`;if(new Date(iso+'T00:00:00Z').toISOString().slice(0,10)!==iso)throw new Error('Fecha bancaria inválida.');return iso;};
const balance=(line:string)=>{const m=line.match(/-?\d[\d.]*,\d{2}\s*-?\s*$/);if(!m)throw new Error('No se pudo reconocer el importe del saldo.');let value=m[0].trim();if(value.endsWith('-'))value='-'+value.slice(0,-1).trim();value=value.replaceAll('.','').replace(',','.');if(!/^-?\d{1,14}\.\d{2}$/.test(value))throw new Error('Saldo fuera de formato.');return value;};
export function parseComafiLines(lines:string[]) {
 lines=lines.map(l=>l.replace(/\s+/g,' ').trim());
 if(!lines.some(l=>/COMAFI/i.test(l)))throw new Error('No se reconoce un resumen Comafi.');
 const accounts:ComafiAccount[]=[];let current:Partial<ComafiAccount>|null=null,inside=false;
 const finish=()=>{if(!current)return;if(!current.number||!current.opening_on||!current.closing_on||current.opening===undefined||current.closing===undefined)throw new Error('Faltan datos de una cuenta. Revisá el PDF original.');if(!current.no_movements)throw new Error('Este resumen contiene movimientos o no declara su ausencia. Falta validar ese diseño con una muestra; no se calcularon impuestos.');if(cents(current.opening)!==cents(current.closing))throw new Error('El resumen declara sin movimientos pero sus saldos difieren.');accounts.push(current as ComafiAccount);};
 for(const line of lines){
  if(/COMAFI PYME.*CUENTA.*(?:PESOS|DOLARES)/i.test(line)){finish();current={currency:/DOLARES/i.test(line)?'USD':'ARS',no_movements:false};inside=false;continue;}
  if(!current)continue;
  if(!current.number){const m=line.match(/N(?:RO\.?|[ÚU]MERO)\s*[:.]?\s*(\d{3,5}-\d{4,12}-\d)/i);if(m)current.number=m[1];}
  if(/DETALLE DE MOVIMIENTOS/i.test(line)){inside=true;continue;}
  if(!inside)continue;
  if(/Saldo Anterior/i.test(line)){current.opening_on=date(line);current.opening=balance(line);}
  else if(/\d{2}\/\d{2}/.test(line)&&!/Saldo al:/i.test(line))throw new Error('Se encontró un movimiento dentro del detalle. Falta validar su formato; no se calcularon impuestos.');
  if(/SIN MOVIMIENTOS/i.test(line))current.no_movements=true;
  if(/Saldo al:/i.test(line)){current.closing_on=date(line);current.closing=balance(line);inside=false;}
 }
 finish();if(!accounts.length)throw new Error('No se encontraron cuentas con saldos verificables.');
 if(new Set(accounts.map(a=>a.number)).size!==accounts.length)throw new Error('Se repite una cuenta en el resumen.');
 const months=[...new Set(accounts.map(a=>a.closing_on.slice(0,7)))];if(months.length!==1)throw new Error('Las cuentas no corresponden al mismo mes.');
 if(accounts.some(a=>a.opening_on>=a.closing_on))throw new Error('El saldo inicial debe ser anterior al cierre.');
 return {month:months[0],accounts,bankTaxes:decimalFromCents(0n),warning:'Se verificaron únicamente secciones SIN MOVIMIENTOS. Rechazos, adhesiones y avisos de débitos directos no se contabilizan como pagos. El IVA bancario requiere revisar si existe factura electrónica para evitar duplicación.'};
}
export async function readComafiPdf(buffer:ArrayBuffer) {
 if(!buffer.byteLength||buffer.byteLength>3*1024*1024)throw new Error('Elegí un PDF de texto de hasta 3 MiB.');
 const {getDocumentProxy}=await import('unpdf');
 const pdf=await getDocumentProxy(new Uint8Array(buffer),{maxImageSize:1000000,disableFontFace:true});
 try{
  if(pdf.numPages>50)throw new Error('El PDF supera las 50 páginas.');
  const lines:string[]=[];
  for(let p=1;p<=pdf.numPages;p++){
   const page=await pdf.getPage(p),content=await page.getTextContent();if(content.items.length>20000)throw new Error('Demasiados elementos de texto en la página.');
   const items=content.items.flatMap(item=>'str'in item&&item.str.trim()?[{text:item.str,x:item.transform[4],y:item.transform[5]}]:[]).sort((a,b)=>b.y-a.y||a.x-b.x);
   const groups:{y:number;items:typeof items}[]=[];
   for(const item of items){let group=groups.at(-1);if(!group||Math.abs(group.y-item.y)>=2){group={y:item.y,items:[]};groups.push(group);}group.items.push(item);}
   for(const group of groups)lines.push(group.items.sort((a,b)=>a.x-b.x).map(i=>i.text).join('  '));
   if(lines.reduce((s,l)=>s+l.length,0)>500000)throw new Error('El texto extraído supera el límite.');
   page.cleanup();
  }
  return parseComafiLines(lines);
 }finally{await pdf.loadingTask.destroy();}
}
