"use client";

import { useState } from 'react';
import { readComafiPdf, comafiCategories, comafiTotals, comafiWorksheetCsv, type ComafiCategory, type ComafiResult } from '@/lib/imports/comafi';
import { cents, decimalFromCents, money, monthLabel } from '@/lib/workspace/format';
import { useWorkspace } from './workspace-context';

export function ComafiReview({file,month,locale}:{file:File;month:string;locale:string}) {
 const {company,period,canEdit,upload}=useWorkspace();
 const [result,setResult]=useState<ComafiResult|null>(null);
 const [reading,setReading]=useState(false),[error,setError]=useState('');
 const [reviewed,setReviewed]=useState(false),[saving,setSaving]=useState(false),[saved,setSaved]=useState(false),[originalSaved,setOriginalSaved]=useState(false);
 const filename=`comafi-${result?.month??month}-papel-bancario.csv`;
 const editable=canEdit&&company?.status==='active'&&period?.status==='open'&&result?.month===month;
 const csv=()=>result?comafiWorksheetCsv(result,company?.cuit??'',file.name,reviewed):'';
 return <div className="mb-3">
  <button className="button button-secondary" type="button" disabled={reading||saving} onClick={async()=>{
   setReading(true);setError('');setResult(null);setReviewed(false);setSaved(false);
   try {setResult(await readComafiPdf(await file.arrayBuffer()));}
   catch(reason){setError(reason instanceof Error?reason.message:'No se pudo analizar el PDF.');}
   finally{setReading(false);}
  }}>{reading?'Leyendo resumen…':'Analizar PDF Comafi'}</button>
  {error&&<p className="notice notice-error mt-3" role="alert">{error}</p>}
  {result&&<div className="mt-3" aria-live="polite">
   <h3>Resultado de lectura · {monthLabel(result.month,locale)}</h3>
   {result.month!==month&&<p className="notice notice-warning">El resumen corresponde a otro mes. Seleccioná {monthLabel(result.month,locale)} antes de guardarlo.</p>}
   <div className="table-wrap"><table><thead><tr><th>Cuenta</th><th>Moneda</th><th>Saldo anterior</th><th>Débitos</th><th>Créditos</th><th>Saldo final</th><th>Actividad</th></tr></thead><tbody>{result.accounts.map(a=><tr key={a.number}><td>…{a.number.slice(-4)}</td><td>{a.currency}</td><td>{money(a.opening,a.currency,locale)}</td><td>{money(a.movements.reduce((s,m)=>s+cents(m.debit),0n),a.currency,locale)}</td><td>{money(a.movements.reduce((s,m)=>s+cents(m.credit),0n),a.currency,locale)}</td><td>{money(a.closing,a.currency,locale)}</td><td>{a.no_movements?'Sin movimientos':`${a.movements.length} movimientos · saldos verificados`}</td></tr>)}</tbody></table></div>
   {result.accounts.filter(a=>a.movements.length>0).map(a=><section className="mt-3" key={a.number} aria-label={`Detalle de cuenta ${a.number.slice(-4)}`}>
    <h4>Cuenta …{a.number.slice(-4)} · {a.currency}</h4>
    <p className="muted text-sm">Saldo inicial + créditos − débitos = saldo final. Diferencia: {money(decimalFromCents(cents(a.opening)+a.movements.reduce((s,m)=>s+cents(m.amount),0n)-cents(a.closing)),a.currency,locale)}. Se verificaron también los saldos intermedios informados.</p>
    <div className="table-wrap mt-3"><table><caption>Clasificación bancaria sugerida</caption><thead><tr><th>Concepto</th><th>Débitos</th><th>Créditos / reversos</th><th>Neto debitado</th></tr></thead><tbody>{comafiTotals(a).map(t=><tr key={t.category}><td>{comafiCategories[t.category]}</td><td>{money(t.debit,a.currency,locale)}</td><td>{money(t.credit,a.currency,locale)}</td><td>{money(t.net,a.currency,locale)}</td></tr>)}</tbody></table></div>
    <details className="mt-3"><summary>Revisar {a.movements.length} movimientos y su clasificación</summary><div className="table-wrap mt-3"><table><thead><tr><th>Fecha / origen</th><th>Concepto y referencia bancaria</th><th>Clasificación revisable</th><th>Débito</th><th>Crédito</th><th>Saldo informado</th></tr></thead><tbody>{a.movements.map(m=><tr key={m.id}><td>{m.date}<small>Pág. {m.page} · renglón {m.line}</small></td><td>{m.description}<small>{m.reference}</small></td><td><select className="control" aria-label={`Clasificación ${m.id}`} value={m.category} disabled={saving} onChange={e=>{
     const category=e.target.value as ComafiCategory;
     setResult({...result,accounts:result.accounts.map(account=>account.number!==a.number?account:{...account,movements:account.movements.map(movement=>movement.id===m.id?{...movement,category}:movement)})});setReviewed(false);setSaved(false);
    }}>{Object.entries(comafiCategories).map(([key,label])=><option key={key} value={key}>{label}</option>)}</select></td><td>{money(m.debit,a.currency,locale)}</td><td>{money(m.credit,a.currency,locale)}</td><td>{m.balance===null?'—':money(m.balance,a.currency,locale)}</td></tr>)}</tbody></table></div></details>
   </section>)}
   <p className="notice notice-warning mt-3">{result.warning}</p>
   <p className="muted text-sm">Este papel no registra asientos ni modifica el IVA computable. Los impuestos bancarios quedan discriminados para revisar su tratamiento; las transferencias necesitan identificar su contraparte. El CSV es un papel de trabajo de Sofía. Los asientos para Xubio se preparan después, con las cuentas contables y la revisión fiscal.</p>
   <label className="check-field mt-3"><input type="checkbox" checked={reviewed} disabled={saving} onChange={e=>{setReviewed(e.target.checked);setSaved(false);}}/>Revisé que el resumen corresponde a esta empresa, las clasificaciones y los importes</label>
   <div className="heading-actions mt-3"><button className="button button-secondary" type="button" disabled={saving} onClick={()=>{const url=URL.createObjectURL(new Blob([csv()],{type:'text/csv;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download=filename;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}}>Descargar papel bancario CSV</button>
   <button className="button button-primary" type="button" disabled={!editable||!reviewed||saving||saved} onClick={async()=>{
    if(!editable||!reviewed)return;setSaving(true);setError('');
    try{if(!originalSaved){await upload('Extractos bancarios',file);setOriginalSaved(true);}await upload('Papeles de trabajo',new File([csv()],filename,{type:'text/csv'}));setSaved(true);}
    catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar el papel bancario.');}
    finally{setSaving(false);}
   }}>{saving?'Guardando respaldos…':saved?'PDF y papel guardados':'Guardar PDF y papel bancario'}</button></div>
   {saved&&<p className="notice mt-3" role="status">PDF original y papel bancario guardados en Documentación de esta empresa y mes.</p>}
  </div>}
 </div>;
}
