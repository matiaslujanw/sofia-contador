import type { SourceTable, SourceRow } from './source';
const normalize=(s:string)=>s.normalize('NFD').replace(/[\u0300-\u036f]/g,'').trim().toLowerCase();
function internalCode(name:string){let hash=14695981039346656037n;for(const c of normalize(name))hash=BigInt.asUintN(64,(hash^BigInt(c.charCodeAt(0)))*1099511628211n);return `SIN-CODIGO-${hash.toString(16).padStart(16,'0')}`;}
export function adaptNativeTable(input:SourceTable):SourceTable {
 let table=input;
 const title=input.headers.find(h=>/^Mis Comprobantes (Recibidos|Emitidos)/i.test(h));
 if(title){const header=input.rows[0];if(!header||normalize(header.cells[0])!=='fecha')return input;table={headers:header.cells,rows:input.rows.slice(1),source:'arca',owner_cuit:title.match(/CUIT\s*(\d{11})/i)?.[1],direction:/recibidos/i.test(title)?'purchases':'sales'};}
 const headers=table.headers.map(normalize),index=(key:string)=>headers.indexOf(key);
 if(index('codigo')>=0&&index('nombre')>=0&&index('rama')>=0&&index('categoria')>=0&&index('activo')>=0){
  const kindColumn=table.headers.length;let missing=0;
  const rows=table.rows.map(row=>{const cells=[...row.cells],name=cells[index('nombre')]??'',category=normalize(cells[index('categoria')]??'');
   if(!cells[index('codigo')]?.trim()&&name){cells[index('codigo')]=internalCode(name);missing++;}
   cells[index('activo')]=['si','sí','true'].includes(normalize(cells[index('activo')]??''))?'active':['no','false'].includes(normalize(cells[index('activo')]??''))?'inactive':cells[index('activo')];
   const root=category.split('>')[0].trim();cells[kindColumn]=root.startsWith('activo')?'asset':root.startsWith('pasivo')?'liability':root==='patrimonio neto'?'equity':root==='ingresos'?'revenue':root==='egresos'?(category.includes('costo de los bienes')?'cost':'expense'):'';
   return {...row,cells};
  });
  return {...table,source:'xubio',headers:[...table.headers,'kind'],rows,warnings:missing?[`${missing} cuentas sin código original: se identifican internamente como SIN-CODIGO-…; sus nombres se conservan para Xubio.`]:[]};
 }
 if(table.source==='arca')return {...table,rows:table.rows.map((row):SourceRow=>{const cells=[...row.cells],type=index('tipo'),currency=index('moneda');if(type>=0){const match=cells[type]?.match(/^(\d{1,3})\s*-/);if(match)cells[type]=match[1].padStart(3,'0');}if(currency>=0&&cells[currency]==='$')cells[currency]='ARS';return {...row,cells};})};
 return table;
}
