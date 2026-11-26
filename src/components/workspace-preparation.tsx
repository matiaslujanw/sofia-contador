"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { companyName, monthLabel } from "@/lib/workspace/format";
import { ImportPanel } from "./import-panel";
import { ManualVoucher } from "./manual-voucher";
import { useWorkspace } from "./workspace-context";
import { CompanyRequired, PeriodRequired } from "./workspace-operations";
import { Badge, Heading, Modal, ActionForm, SectionHeading, Field, Input } from "./workspace-ui";

const steps = { cuentas: "1. Plan de cuentas", compras: "2. Compras", ventas: "3. Ventas", banco: "4. Resumen bancario", impuestos: "5. Papel impositivo" } as const;
export function PreparationPage({ step: rawStep }: { step?: string }) {
 const {state,company,period,month,locale,canEdit,href,mutate,confirmImport,upload}=useWorkspace();
 const router=useRouter();
 const [bankFile,setBankFile]=useState<File|null>(null),[uploading,setUploading]=useState(false),[uploadError,setUploadError]=useState('');
 const [manual,setManual]=useState(false),[absence,setAbsence]=useState(false);
 const step=(rawStep&&Object.hasOwn(steps,rawStep)?rawStep:'cuentas') as keyof typeof steps;
 if(!company)return <><Heading title="Preparar mes"/><CompanyRequired/></>;
 if(!period)return <><Heading title="Preparar mes"/><PeriodRequired/></>;
 const editable=canEdit&&company.status==='active'&&period.status==='open';
 const accountCount=state.accounts.filter(a=>a.company_id===company.id&&a.status==='active').length;
 const direction=step==='ventas'?'sale':'purchase';
 const vouchers=state.vouchers.filter(v=>v.company_id===company.id&&v.period_id===period.id&&v.direction===direction);
 const title=direction==='sale'?'Recepción de comprobantes emitidos':'Recepción de comprobantes recibidos';
 const task=state.tasks.find(t=>t.period_id===period.id&&t.title===title);
 const noActivity=task?.status==='not_applicable'&&!vouchers.length;
 const bankDocs=state.documents.filter(d=>d.period_id===period.id&&d.category==='Extractos bancarios');
 const keys=Object.keys(steps) as (keyof typeof steps)[],index=keys.indexOf(step);
 return <>
 <Heading title="Preparar mes" description={`${companyName(company)} · ${monthLabel(month,locale)}`} actions={<Link className="button button-secondary" href={href('inicio')}>Volver a la empresa</Link>}/>
 <nav className="segments" aria-label="Pasos para preparar el mes">{Object.entries(steps).map(([key,label])=><Link className="segment" aria-current={step===key?'step':undefined} style={step===key?{borderColor:'var(--brand)',color:'var(--accent)'}:undefined} key={key} href={href('preparacion',{}, {tipo:key})}>{label}</Link>)}</nav>
 {step==='cuentas'&&<section className="panel"><SectionHeading title="Primero, el plan de cuentas de esta empresa" subtitle="Conservá los códigos y nombres de Xubio para utilizarlos después en cada asiento." action={<Badge>{accountCount} cuentas activas</Badge>}/><p className="muted mb-3">El plan se guarda por empresa y se reutiliza en los meses siguientes. Si ya está cargado, revisalo y continuá. La vista previa permite asignar las columnas del archivo de Xubio; verificá el rubro contable y el estado de cada cuenta.</p><ImportPanel lockedKind month={month} disabled={!editable} initialKind="accounts" onConfirm={confirmImport}/><Link className="text-button mt-3" href={href('cuentas')}>Consultar el plan cargado</Link></section>}
 {(step==='compras'||step==='ventas')&&<section className="panel"><SectionHeading title={step==='compras'?'Compras del mes':'Ventas del mes'} subtitle="Importá el archivo de ARCA y completá manualmente los comprobantes que falten." action={<Badge tone={noActivity?'positive':'neutral'}>{noActivity?`Sin ${step} confirmado`:`${vouchers.length} comprobantes cargados`}</Badge>}/>
 {!accountCount&&<p className="notice notice-warning mb-3">El plan de cuentas todavía no tiene cuentas activas. Cargalo en el primer paso para poder imputar los comprobantes.</p>}
 {task?.status==='not_applicable'&&vouchers.length>0&&<p className="notice notice-warning mb-3">Hay comprobantes cargados y una marca de mes sin actividad. Revisá la recepción en el checklist del mes.</p>}
 <div className="heading-actions mb-3">{editable&&<><button className="button button-primary" type="button" onClick={()=>setManual(true)}>Cargar comprobante manual</button><button className="button button-secondary" type="button" disabled={vouchers.length>0||noActivity} onClick={()=>setAbsence(true)}>Este mes no hubo {step}</button></>}<Link className="button button-secondary" href={href('comprobantes',{}, {tipo:step})}>Revisar comprobantes cargados</Link></div>
 <ImportPanel lockedKind key={step} month={month} disabled={!editable} initialKind={direction==='purchase'?'purchases':'sales'} onConfirm={confirmImport}/>
 <p className="muted text-sm mt-3">La ausencia de archivos no se toma como cero. La marca de mes sin actividad queda guardada para esta empresa y período. Los archivos importados se controlan por identidad para evitar duplicados.</p>
 </section>}
 {step==='banco'&&<section className="panel"><SectionHeading title="Resumen Comafi y cargos impositivos" subtitle="Conservá el PDF original como respaldo del mes." action={<Badge>{bankDocs.length} extractos guardados</Badge>}/><p className="muted mb-3">Los conceptos a separar son comisiones e intereses, IVA bancario, retenciones y percepciones de IVA, e IIBB/SIRCREB. Cada importe debe vincularse con su renglón de origen y revisarse para evitar duplicarlo con una factura bancaria.</p>{editable&&<form className="form-grid mb-3" onSubmit={async e=>{e.preventDefault();if(!bankFile||uploading)return;setUploading(true);setUploadError('');try{await upload('Extractos bancarios',bankFile);setBankFile(null);}catch(reason){setUploadError(reason instanceof Error?reason.message:'No se pudo guardar el PDF.');}finally{setUploading(false);}}}><Field label="Resumen Comafi en PDF"><Input type="file" accept=".pdf,application/pdf" disabled={uploading} onChange={e=>setBankFile(e.target.files?.[0]??null)}/></Field><button className="button button-primary" type="submit" disabled={!bankFile||uploading}>{uploading?'Guardando PDF…':'Guardar resumen del mes'}</button>{uploadError&&<p className="notice notice-error field-wide" role="alert">{uploadError}</p>}</form>}{bankDocs.length>0&&<ul className="text-sm mb-3">{bankDocs.map(d=><li key={d.id}>{d.name}</li>)}</ul>}<div className="heading-actions"><Link className="button button-secondary" href={href('documentacion')}>Ver respaldos del mes</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'cash'})}>Registrar cargos y movimientos</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'accrual'})}>Ver control fiscal bancario</Link></div><p className="notice notice-warning mt-3">La lectura automática del PDF de Comafi todavía necesita validarse con un resumen de muestra. Por ahora guardar el PDF no extrae ni clasifica sus movimientos.</p></section>}
 {step==='impuestos'&&<section className="panel"><SectionHeading title="Revisar el papel de trabajo" subtitle="IVA de compras y ventas, cargos bancarios y créditos fiscales requieren controles separados antes de liquidar."/><p className="muted mb-3">El cálculo actual muestra subtotales de comprobantes revisados. Para determinar el impuesto a pagar o saldo a favor faltan saldos anteriores, retenciones, percepciones y ajustes verificados. No se presume que todo el IVA bancario sea computable.</p><div className="heading-actions"><Link className="button button-primary" href={href('control')+'#iva-worksheet'}>Abrir papel de IVA</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'accrual'})}>Control de impuestos bancarios</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'journal'})}>Preparar asientos</Link></div></section>}
 <div className="heading-actions">{index>0&&<Link className="button button-secondary" href={href('preparacion',{}, {tipo:keys[index-1]})}>Anterior</Link>}{index<keys.length-1&&<Link className="button button-primary" href={href('preparacion',{}, {tipo:keys[index+1]})}>Siguiente: {steps[keys[index+1]].slice(3)}</Link>}</div>
 {manual&&<ManualVoucher direction={direction} close={()=>setManual(false)}/>}
 {absence&&<Modal title={`Confirmar mes sin ${step}`} description={`${companyName(company)} · ${monthLabel(month,locale)}`} close={()=>setAbsence(false)}><ActionForm label={`Confirmar sin ${step}`} close={()=>setAbsence(false)} submit={async()=>{if(vouchers.length)throw new Error('Ya hay comprobantes en este período.');await mutate({type:'task.save',periodId:period.id,id:task?.id,title,status:'not_applicable',notes:`Mes sin ${step} confirmado por la persona responsable.`,documentId:task?.document_id??null},`Mes sin ${step} confirmado.`);router.refresh();}}><p className="field-wide">Confirmás que esta empresa no tuvo {step} en el mes. La decisión queda en el checklist y su historial.</p></ActionForm></Modal>}
 </>;
}
