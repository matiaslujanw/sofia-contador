"use client";

import Link from 'next/link';
import {money} from '@/lib/workspace/format';
import {auditControlLabels,type AuditControl,type MonthlyAuditReview} from '@/lib/accounting/monthly-audit';
import {useWorkspace} from './workspace-context';
import {Badge,SectionHeading} from './workspace-ui';

export function MonthlyAuditReviewPanel({review,download}:{review:MonthlyAuditReview;download:()=>void}){
 const {href,locale}=useWorkspace();
 const target=(c:AuditControl)=>href(c.section,{},c.purpose?{tipo:c.purpose}:undefined)+(c.anchor?'#'+c.anchor:'');
 const tone=(status:AuditControl['status'])=>status==='difference'?'negative':status==='checked'?'positive':status==='not_applicable'?'neutral':'warning';
 return <section className="panel" id="plan-trabajo-mensual" aria-label="Diagnóstico mensual">
  <SectionHeading title="Qué falta para cerrar el mes" subtitle={review.title} action={<button type="button" className="button button-secondary" onClick={download}>Descargar plan de trabajo</button>}/>
  <div className="heading-actions mb-3"><Badge tone={review.differences?'negative':'neutral'}>{review.differences} diferencias</Badge><Badge tone={review.pending?'warning':'neutral'}>{review.pending} controles pendientes</Badge><Badge tone="positive">{review.checked} controles revisados</Badge></div>
  <p className="muted mb-3">Diagnóstico de esta empresa y mes según las fuentes cargadas. Un control declarado en el checklist requiere tu revisión y respaldo. Que Debe y Haber cuadren no demuestra que esté todo registrado.</p>
  {review.next.length>0&&<div className="notice mb-3"><h3>Próximas tareas</h3><ol>{review.next.slice(0,3).map(c=><li key={c.id}><strong>{c.title}.</strong> {c.detail} <Link className="text-button" href={target(c)}>Ir a resolver</Link></li>)}</ol></div>}
  {review.banks.length>0&&<details open><summary>Saldos bancarios y efecto de los faltantes seleccionados</summary><p className="muted mt-3 mb-3">Diferencia = banco menos Xubio. La proyección suma a Xubio solo los faltantes ARS seleccionados y habilitados: no confirma importación ni genera un ajuste. Las partidas conciliatorias pueden explicar diferencias y deben documentarse.</p>
   <div className="table-wrap"><table aria-label="Comparación de saldos bancarios"><thead><tr><th>Cuenta / moneda</th><th>Saldo inicial banco / Xubio</th><th>Diferencia inicial</th><th>Saldo final banco / Xubio</th><th>Diferencia final</th><th>Saldo Xubio proyectado</th><th>Diferencia restante</th></tr></thead><tbody>{review.banks.map(b=>{const amount=(v:string|null)=>v===null?'Sin verificar':money(v,b.currency,locale);return <tr key={b.key}><td>…{b.number.slice(-4)} · {b.currency}<small>{b.account||'Cuenta por vincular'}</small><Badge tone={tone(b.status)}>{auditControlLabels[b.status]}</Badge><small>{b.detail}</small></td><td>{amount(b.bankOpening)}<small>{amount(b.xubioOpening)}</small></td><td>{amount(b.openingDifference)}</td><td>{amount(b.bankClosing)}<small>{amount(b.xubioClosing)}</small></td><td>{amount(b.closingDifference)}</td><td>{amount(b.projectedClosing)}</td><td>{amount(b.remainingDifference)}</td></tr>;})}</tbody></table></div><p className="muted text-sm mt-3">En iPad o teléfono, deslizá la tabla hacia los costados para ver la proyección y la diferencia restante.</p>
  </details>}
  <details className="mt-3"><summary>Ver todos los controles del mes ({review.controls.length})</summary><div className="table-wrap mt-3"><table aria-label="Plan de trabajo mensual"><thead><tr><th>Control</th><th>Estado / base</th><th>Qué se encontró</th><th>Qué hacer</th></tr></thead><tbody>{review.controls.map(c=><tr key={c.id}><td>{c.title}</td><td><Badge tone={tone(c.status)}>{auditControlLabels[c.status]}</Badge><small>{c.basis==='automatic'?'Comparación de datos':c.basis==='declared'?'Declaración / checklist':'Alcance por verificar'}</small></td><td>{c.detail}</td><td>{c.action}<small><Link className="text-button" href={target(c)}>Abrir control</Link></small></td></tr>)}</tbody></table></div></details>
 </section>;
}
