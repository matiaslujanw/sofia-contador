import type { SourceTable } from "@/lib/imports";
import type { Account } from "@/lib/workspace/model";
import { bookSchema, type BookValues } from "./model";

export const bookFields = {
 opening: ['date','reference','description','role','cuit','name','amount','control_account_code','offset_account_code'],
 statement: ['date','reference','description','amount','cash_account_code'],
} as const;
export const bookFieldLabels:Record<string,string>={date:'Fecha',reference:'Referencia única',description:'Concepto',role:'Cliente/proveedor',cuit:'CUIT',name:'Nombre',amount:'Importe',control_account_code:'Código cuenta corriente',offset_account_code:'Código contrapartida apertura',cash_account_code:'Código cuenta bancaria'};
export function parseBookAmount(input:string,decimal:'comma'|'point',numeric=false) {
 const value=input.trim();
 if(numeric) {if(!/^-?\d+(\.\d{1,2})?$/.test(value))throw new Error('Importe numérico con más de dos decimales');return value;}
 const thousands=decimal==='comma'?'.':',',fraction=decimal==='comma'?',':'.';
 const unsigned=value.startsWith('-')?value.slice(1):value;
 const parts=unsigned.split(fraction);
 if(parts.length>2 || (parts.length===2&&!/^\d{1,2}$/.test(parts[1])) || !(new RegExp(`^(?:\\d+|\\d{1,3}(?:\\${thousands}\\d{3})+)$`)).test(parts[0]))throw new Error('Importe inválido para el separador elegido');
 return (value.startsWith('-')?'-':'')+parts[0].split(thousands).join('')+(parts.length===2?'.'+parts[1]:'');
}
export function previewBookImport(kind:keyof typeof bookFields,table:SourceTable,mapping:Record<string,number>,accounts:Account[],currency:string,documentId:string,decimal:'comma'|'point') {
 const errors:string[]=[],values:BookValues[]=[];
 if(table.rows.length>500)return {errors:['Se admiten hasta 500 movimientos por lote.'],values};
 const byCode=new Map(accounts.filter(a=>a.status==='active').map(a=>[a.code,a.id]));
 const references=new Set<string>();
 for(const row of table.rows){try{
  if(Object.values(mapping).some(i=>row.invalidCells?.includes(i)))throw new Error("Convertí las fórmulas a valores verificados antes de importar");
  const get=(key:string)=>row.cells[mapping[key]]?.trim()??'';
  let date=get('date');if(/^\d{2}\/\d{2}\/\d{4}$/.test(date))date=date.slice(6)+'-'+date.slice(3,5)+'-'+date.slice(0,2);
  const base={kind,date,reference:get('reference'),description:get('description'),currency,document_id:documentId,amount:parseBookAmount(get('amount'),decimal,row.numericCells?.includes(mapping.amount))};
  const account=(key:string)=>{const id=byCode.get(get(key));if(!id)throw new Error(`No existe la cuenta activa ${get(key)}`);return id;};
  const role=get('role').toLowerCase();
  const value=bookSchema.parse(kind==='opening'?{...base,kind:'opening',role:['cliente','customer'].includes(role)?'customer':['proveedor','supplier'].includes(role)?'supplier':role,cuit:get('cuit').replace(/[\s-]/g,''),name:get('name'),control_account_id:account('control_account_code'),offset_account_id:account('offset_account_code')}:{...base,kind:'statement',cash_account_id:account('cash_account_code'),match_id:null});
  if(references.has(value.reference))throw new Error('Referencia repetida dentro del archivo');references.add(value.reference);values.push(value);
 }catch(e){errors.push(`Fila ${row.row}: ${e instanceof Error?e.message:'Datos inválidos'}`);}}
 return {errors,values};
}
