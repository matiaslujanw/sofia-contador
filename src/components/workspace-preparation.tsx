"use client";

import { useState } from "react";
import Link from "next/link";
import { NoActivityControl } from "./no-activity-control";
import { companyName, monthLabel } from "@/lib/workspace/format";
import { BankPreparation } from "./bank-preparation";
import { PreparationImports } from "./preparation-imports";
import { ImportPanel } from "./import-panel";
import { ManualVoucher } from "./manual-voucher";
import { useWorkspace } from "./workspace-context";
import { CompanyRequired, PeriodRequired } from "./workspace-operations";
import { Badge, Heading, SectionHeading } from "./workspace-ui";

const steps = { compras: "1. Compras", ventas: "2. Ventas", banco: "3. Resumen bancario", impuestos: "4. Papel impositivo" } as const;
export function PreparationPage({ step: rawStep }: { step?: string }) {
 const {state,company,period,month,locale,canEdit,href,confirmImport}=useWorkspace();
 const [manual,setManual]=useState(false);
 const step=(rawStep&&Object.hasOwn(steps,rawStep)?rawStep:'compras') as keyof typeof steps;
 if(!company)return <><Heading title="Preparar mes"/><CompanyRequired/></>;
 if(!period)return <><Heading title="Preparar mes"/><PeriodRequired/></>;
 const editable=canEdit&&company.status==='active'&&period.status==='open';
 const accountCount=state.accounts.filter(a=>a.company_id===company.id&&a.status==='active').length;
 const direction=step==='ventas'?'sale':'purchase';
 const vouchers=state.vouchers.filter(v=>v.company_id===company.id&&v.period_id===period.id&&v.direction===direction);
 const title=direction==='sale'?'Recepción de comprobantes emitidos':'Recepción de comprobantes recibidos';
 const task=state.tasks.find(t=>t.period_id===period.id&&t.title===title);
 const noActivity=task?.status==='not_applicable'&&!vouchers.length;
 const keys=Object.keys(steps) as (keyof typeof steps)[],index=keys.indexOf(step);
 return <>
 <Heading title="Preparar mes" description={`${companyName(company)} · ${monthLabel(month,locale)}`} actions={<Link className="button button-secondary" href={href('inicio')}>Volver a la empresa</Link>}/>
 <p className="muted text-sm mb-3">El plan de cuentas es permanente para esta empresa: {accountCount} cuentas activas. <Link className="text-button" href={href('cuentas')}>Ver o modificar plan de cuentas</Link></p>
 <nav className="segments" aria-label="Pasos para preparar el mes">{Object.entries(steps).map(([key,label])=><Link className="segment" aria-current={step===key?'step':undefined} style={step===key?{borderColor:'var(--brand)',color:'var(--accent)'}:undefined} key={key} href={href('preparacion',{}, {tipo:key})}>{label}</Link>)}</nav>
 {(step==='compras'||step==='ventas')&&<section className="panel"><SectionHeading title={step==='compras'?'Compras del mes':'Ventas del mes'} subtitle="Importá el archivo de ARCA y completá manualmente los comprobantes que falten." action={<Badge tone={noActivity?'positive':'neutral'}>{noActivity?`Mes sin actividad declarado`:`${vouchers.length} comprobantes cargados`}</Badge>}/>
 {!accountCount&&<p className="notice notice-warning mb-3">El plan de cuentas todavía no tiene cuentas activas. Cargalo una sola vez en Plan de cuentas para poder imputar los comprobantes.</p>}
 {task?.status==='not_applicable'&&vouchers.length>0&&<p className="notice notice-warning mb-3">Hay comprobantes cargados y una marca de mes sin actividad. Revisá la recepción en el checklist del mes.</p>}
 <div className="heading-actions mb-3">{editable&&<><button className="button button-primary" type="button" onClick={()=>setManual(true)}>Cargar comprobante manual</button></>}<Link className="button button-secondary" href={href('comprobantes',{}, {tipo:step})}>Revisar comprobantes cargados</Link></div>
 <NoActivityControl key={direction} direction={direction}/>
 <ImportPanel lockedKind key={step} month={month} disabled={!editable} initialKind={direction==='purchase'?'purchases':'sales'} onConfirm={confirmImport}/>
 <p className="muted text-sm mt-3">La ausencia de archivos no se toma como cero. La marca de mes sin actividad queda guardada para esta empresa y período. Los archivos importados se controlan por identidad para evitar duplicados.</p>
 </section>}
 {(step==='compras'||step==='ventas')&&<PreparationImports kind={step==='compras'?'purchase':'sale'}/>}
 {step==='banco'&&<BankPreparation key={`${company.id}:${period.id}`}/>}
 {step==='impuestos'&&<section className="panel"><SectionHeading title="Revisar el papel de trabajo" subtitle="IVA de compras y ventas, cargos bancarios y créditos fiscales requieren controles separados antes de liquidar."/><p className="muted mb-3">El cálculo actual muestra subtotales de comprobantes revisados. Para determinar el impuesto a pagar o saldo a favor faltan saldos anteriores, retenciones, percepciones y ajustes verificados. No se presume que todo el IVA bancario sea computable.</p><div className="heading-actions"><Link className="button button-primary" href={href('control')+'#iva-worksheet'}>Abrir papel de IVA</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'accrual'})}>Control de impuestos bancarios</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'journal'})}>Preparar asientos</Link></div></section>}
 <div className="heading-actions"><Link className="button button-secondary" href={href('xubio')}>Continuar con auditoría de Xubio</Link>{index>0&&<Link className="button button-secondary" href={href('preparacion',{}, {tipo:keys[index-1]})}>Anterior</Link>}{index<keys.length-1&&<Link className="button button-primary" href={href('preparacion',{}, {tipo:keys[index+1]})}>Siguiente: {steps[keys[index+1]].slice(3)}</Link>}</div>
 {manual&&<ManualVoucher direction={direction} close={()=>setManual(false)}/>}
 </>;
}
