"use client";
import { useState } from "react";
import { cents } from "@/lib/workspace/format";
import { voucherJournal } from "@/lib/accounting/engine";
import { useWorkspace } from "./workspace-context";
import { ActionForm, Field, Modal, Select, fieldValue } from "./workspace-ui";

export function VoucherJournal({close}:{close:()=>void}) {
 const {state,company,period,mutate}=useWorkspace();
 const [voucherId,setVoucherId]=useState('');
 if(!company||!period)return null;
 const accounts=state.accounts.filter(a=>a.company_id===company.id&&a.status==='active');
 const vouchers=state.vouchers.filter(v=>v.company_id===company.id&&v.period_id===period.id&&v.currency===company.currency&&v.review_status==='approved'&&v.account_id&&!(state.bookRecords??[]).some(r=>r.payload.kind==='journal'&&r.payload.source_key===`voucher:${v.id}`));
 const voucher=vouchers.find(v=>v.id===voucherId);
 const field=(name:string,label:string)=><Field label={label}><Select name={name} required><option value="">Elegí una cuenta</option>{accounts.map(a=><option value={a.id} key={a.id}>{a.code} · {a.name}</option>)}</Select></Field>;
 return <Modal title="Asiento de comprobante" description="Elegí las cuentas fiscales y de cuenta corriente. El cobro/pago se registra por separado y no duplica el ingreso o gasto." close={close}><ActionForm close={close} label="Registrar asiento de comprobante" submit={async data=>{
  if(!voucher)throw new Error('Elegí un comprobante.');
  const values=voucherJournal(voucher,{control:fieldValue(data,'control'),vat:fieldValue(data,'vat'),other:fieldValue(data,'other')});
  await mutate({type:'book.save',periodId:period.id,values},'Asiento de comprobante registrado.');
 }}><Field label="Comprobante aprobado" span><Select value={voucherId} onChange={e=>setVoucherId(e.target.value)} required><option value="">Elegí un comprobante</option>{vouchers.map(v=><option value={v.id} key={v.id}>{v.direction==='sale'?'Venta':'Compra'} · {v.counterparty_name} · {v.receipt_number} · {v.total}</option>)}</Select></Field>
 {field('control',voucher?.direction==='sale'?'Créditos por ventas / clientes':'Deudas comerciales / proveedores')}
 {voucher&&cents(voucher.vat)!==0n&&field('vat',voucher.direction==='sale'?'IVA débito fiscal':'IVA crédito fiscal computable')}
 {voucher&&cents(voucher.other_taxes)!==0n&&field('other','Otros tributos (cuenta según respaldo)')}
 {voucher?.direction==='purchase'&&voucher.deductible_vat===null&&<p className="notice notice-warning field-wide">Definí primero el IVA computable en la revisión de la compra, aunque sea cero. El IVA no computable se incorpora a su cuenta de imputación.</p>}
 <p className="muted field-wide">Solo aparecen comprobantes aprobados, imputados, en la moneda de la empresa y todavía sin asiento. Los demás tributos requieren desglose y revisión si corresponden a distintas cuentas.</p>
 </ActionForm></Modal>;
}
