"use client";
import { cents, decimalFromCents } from "@/lib/workspace/format";
import { worksheetCsv } from "@/lib/workspace/monthly-control";
import { useWorkspace } from "./workspace-context";
import { ActionForm, Field, Input, Modal, fieldValue } from "./workspace-ui";

export function ManualVoucher({direction,close}:{direction:'purchase'|'sale';close:()=>void}) {
 const {company,month,confirmImport}=useWorkspace();
 if(!company)return null;
 const amountFields={taxable:'Neto gravado',untaxed:'No gravado',exempt:'Exento',vat:'IVA',other_taxes:'Otros tributos'};
 return <Modal title="Comprobante manual" description="Para comprobantes que no figuran en el archivo de ARCA. Se conserva una ficha CSV del alta y se controla la identidad para evitar duplicados." close={close}><ActionForm close={close} label="Guardar comprobante" submit={async data=>{
  const get=(key:string)=>fieldValue(data,key);
  const amounts=Object.keys(amountFields).map(key=>get(key).replace(",","."));
  if(amounts.some(v=>!/^[-]?\d{1,14}(?:\.\d{1,2})?$/.test(v)))throw new Error('Usá punto decimal y hasta dos decimales.');
  const headers=['date','receipt_type','point_of_sale','receipt_number','counterparty_cuit','counterparty_name','currency','exchange_rate',...Object.keys(amountFields),'total'];
  const values=[get('date'),get('receipt_type'),get('point_of_sale'),get('receipt_number'),get('counterparty_cuit').replace(/[\s-]/g,''),get('counterparty_name'),company.currency,'1',...amounts,decimalFromCents(amounts.reduce((s,v)=>s+cents(v),0n))];
  const csv=worksheetCsv([headers,values]);
  const result=await confirmImport({file:new File([csv],`manual-${direction}-${get('receipt_number')}.csv`,{type:'text/csv'}),kind:direction==='purchase'?'purchases':'sales',mapping:Object.fromEntries(headers.map((key,i)=>[key,i])),decimal:'point'});
  if(result.duplicate_count)throw new Error('Ya existe un comprobante con esa identidad; no se duplicó.');
 }}>
 <Field label="Fecha de emisión"><Input name="date" type="date" defaultValue={`${month}-01`} required/></Field><Field label="Tipo"><Input name="receipt_type" placeholder="Factura A / Nota de crédito A" required maxLength={80}/></Field><Field label="Punto de venta"><Input name="point_of_sale" type="number" min={0} max={99999} required defaultValue="1"/></Field><Field label="Número"><Input name="receipt_number" type="number" min={1} max={99999999} required/></Field><Field label={direction==='purchase'?'CUIT proveedor':'CUIT cliente'}><Input name="counterparty_cuit" required={direction==='purchase'} /></Field><Field label="Nombre de contraparte"><Input name="counterparty_name" required maxLength={180}/></Field>
 {Object.entries(amountFields).map(([key,label])=><Field label={label} key={key}><Input name={key} defaultValue="0.00" inputMode="decimal" required/></Field>)}
 <p className="notice field-wide">Moneda {company.currency}, cotización 1. Para otras monedas usá la importación con cotización verificada. Las notas de crédito llevan importes negativos. El total se calcula sumando los componentes; luego revisá e imputá el comprobante.</p>
 </ActionForm></Modal>;
}
