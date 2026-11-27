"use client";

import {useState} from 'react';
import {useWorkspace} from './workspace-context';
import {ActionForm,Badge,Modal} from './workspace-ui';
import {companyName,monthLabel} from '@/lib/workspace/format';

export function NoActivityControl({direction}:{direction:'purchase'|'sale'}){
 const {state,company,period,month,locale,canEdit,mutate}=useWorkspace();
 const [open,setOpen]=useState(false);
 if(!company||!period)return null;
 const word=direction==='purchase'?'compras':'ventas',title=direction==='purchase'?'Recepción de comprobantes recibidos':'Recepción de comprobantes emitidos';
 const rows=state.vouchers.filter(v=>v.company_id===company.id&&v.organization_id===company.organization_id&&v.period_id===period.id&&v.direction===direction);
 const task=state.tasks.find(t=>t.company_id===company.id&&t.organization_id===company.organization_id&&t.period_id===period.id&&t.title===title);
 const declared=task?.status==='not_applicable',editable=canEdit&&company.status==='active'&&period.status==='open';
 return <div className="activity-declaration mb-3">
  <div><strong>{declared&&!rows.length?`Sin ${word} confirmado`:`¿Este mes no hubo ${word}?`}</strong><p className="muted text-sm">{rows.length?`Hay ${rows.length} comprobantes de ${word} en este mes. La búsqueda y los filtros no cambian este control.`:declared?'La confirmación está guardada para esta empresa y mes y se incluye en la auditoría.':'Podés dejarlo confirmado sin subir un archivo vacío.'}</p>{declared&&rows.length>0&&<Badge tone="warning">Hay comprobantes: revisá la declaración</Badge>}</div>
  {editable&&<button className="button button-secondary" type="button" disabled={rows.length>0&&!declared} onClick={()=>setOpen(true)}>{declared?`Deshacer sin ${word}`:`Este mes no hubo ${word}`}</button>}
  {open&&<Modal title={declared?`Deshacer mes sin ${word}`:`Confirmar mes sin ${word}`} description={`${companyName(company)} · ${monthLabel(month,locale)}`} close={()=>setOpen(false)}><ActionForm label={declared?'Deshacer confirmación':`Confirmar sin ${word}`} close={()=>setOpen(false)} submit={async()=>{
   if(!declared&&rows.length)throw new Error('Ya hay comprobantes en este período.');
   await mutate({type:'task.save',periodId:period.id,id:task?.id,title,status:declared?'pending':'not_applicable',notes:declared?`Se reabrió la recepción de ${word}.`:`Mes sin ${word} confirmado por la persona responsable.`,documentId:task?.document_id??null},declared?'Confirmación deshecha.':`Mes sin ${word} confirmado.`);
  }}><p className="field-wide">{declared?`Se quitará la declaración de ausencia de ${word}, conservando su historial.`:`Confirmás que esta empresa no tuvo ${word} en el mes. La decisión queda guardada en el checklist y la auditoría.`}</p></ActionForm></Modal>}
 </div>;
}
