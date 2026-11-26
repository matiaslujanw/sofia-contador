import { cents } from "@/lib/workspace/format";
import type { Account, Voucher } from "@/lib/workspace/model";
import { journalLines } from "./engine";
import type { BookRecord } from "./model";

// Official model retrieved from Xubio's Argentina help center, filedownload/3043.
// Header rows and item rows are deliberately separate, as required by the model.
export const xubioHeaders=['FECHA','CONCEPTO','CIRCUITOCONTABLE','CUENTA','DEBE','HABER','ORGANIZACION','CENTRODECOSTO','DESCRIPCION'];
export function xubioRows(records:BookRecord[],accounts:Account[],vouchers:Voucher[],circuit:string) {
 if(!circuit.trim())throw new Error('Indicá el circuito contable tal como existe en Xubio.');
 const byId=new Map(accounts.map(a=>[a.id,a]));
 const result:(string|number)[][]=[[...xubioHeaders]];
 for(const record of records){const v=record.payload,lines=journalLines(v);if(!lines.length)continue;
  if(v.currency!=='ARS')throw new Error('El modelo verificado no incluye moneda/cotización. Revisá las operaciones de otras monedas antes de exportar a Xubio.');
  const [year,month,day]=v.date.split('-').map(Number),serial=(Date.UTC(year,month-1,day)-Date.UTC(1899,11,30))/86400000;
  result.push([serial,v.description,circuit.trim(),'','','','','','']);
  for(const l of lines){const account=byId.get(l.account_id);if(!account)throw new Error('Falta una cuenta del plan de origen.');
   let organization='';
   if(v.kind==='opening' && l.account_id===v.control_account_id)organization=v.name;
   if(v.kind==='cash' && v.role!=='other' && l.account_id===v.counterpart_account_id)organization=v.name;
   if(v.kind==='journal' && v.source_key.startsWith('voucher:')){const invoice=vouchers.find(x=>x.id===v.source_key.slice(8));if(invoice && l.account_id!==invoice.account_id && (cents(l.debit)===(cents(invoice.total)<0n?-cents(invoice.total):cents(invoice.total))||cents(l.credit)===(cents(invoice.total)<0n?-cents(invoice.total):cents(invoice.total))))organization=invoice.counterparty_name??'';}
   result.push(['','','',account.name,l.debit==='0.00'?'':l.debit,l.credit==='0.00'?'':l.credit,organization,'',v.reference]);
  }
 }
 return result;
}
export async function xubioWorkbook(records:BookRecord[],accounts:Account[],vouchers:Voucher[],circuit:string) {
 const XLSX=await import('xlsx');
 const rows=xubioRows(records,accounts,vouchers,circuit),sheet=XLSX.utils.aoa_to_sheet(rows);
 for(let r=1;r<rows.length;r++){if(typeof rows[r][0]==='number'){sheet[XLSX.utils.encode_cell({r,c:0})].z='dd/mm/yyyy';}}
 const book=XLSX.utils.book_new();XLSX.utils.book_append_sheet(book,sheet,'Hoja1');
 return XLSX.write(book,{bookType:'biff8',type:'array'}) as ArrayBuffer;
}
