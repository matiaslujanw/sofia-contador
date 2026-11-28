"use client";
import {useEffect,useEffectEvent,useState} from 'react';
import {useRouter} from 'next/navigation';
import type {Company} from '@/lib/workspace/model';
import {deletionLabels,type DeletionPreview} from '@/lib/workspace/company-deletion';
import {previewWorkspaceCompanyDeletion} from '@/lib/workspace/actions';
import {previewLocalCompanyDeletion} from '@/lib/workspace/local';
import {useWorkspace} from './workspace-context';
import {Modal,Field,Input,SectionHeading} from './workspace-ui';

export function CompanyDeletionModal({company,close}:{company:Company;close:()=>void}){
 const {state,mode,mutate,href}=useWorkspace(),router=useRouter();
 const [preview,setPreview]=useState<DeletionPreview|null>(null),[loading,setLoading]=useState(true),[busy,setBusy]=useState(false),[error,setError]=useState(''),[cuit,setCuit]=useState(''),[ack,setAck]=useState(false);
 async function load(alive:()=>boolean){
  try{const result=mode==='demo'?await previewLocalCompanyDeletion(state,company.id):await(async()=>{const r=await previewWorkspaceCompanyDeletion(company.id);if(!r.ok)throw new Error(r.message);return r.data;})();if(alive())setPreview(result);}
  catch(e){if(alive())setError(e instanceof Error?e.message:'No se pudo revisar la empresa.');}finally{if(alive())setLoading(false);}
 }
 const loadOnMount=useEffectEvent((alive:()=>boolean)=>load(alive));
 useEffect(()=>{let active=true;const t=setTimeout(()=>void loadOnMount(()=>active),0);return()=>{active=false;clearTimeout(t);};},[]);
 const normalized=cuit.replace(/[\s-]/g,'');
 return <Modal title="Eliminar empresa definitivamente" description={`${preview?.company_name??(company.trade_name||company.legal_name)} · CUIT ${preview?.cuit??company.cuit}`} close={()=>{if(!busy)close();}}>
  <p className="notice notice-error mb-3">Esta acción elimina la empresa y sus cargas. No se puede deshacer. Archivar permite conservarla; eliminar permite volver a crearla con el mismo CUIT.</p>
  {loading&&<p role="status">Revisando los datos de esta empresa…</p>}
  {preview&&<><ul className="grid gap-2 mb-3" aria-label="Datos que se eliminarían">{Object.entries(preview.counts).map(([key,n])=><li key={key}>{deletionLabels[key]??key}: <strong>{n}</strong></li>)}</ul><p className="muted mb-3">Se retira también el plan de cuentas, los comprobantes, los respaldos y las configuraciones de esta empresa. Se conserva el historial de auditoría. Las otras empresas y la cuenta de Sofía Luján permanecen.</p>{preview.blocked.map(b=><p key={b} className="notice notice-warning mb-3">{b}</p>)}</>}
  {error&&<p className="notice notice-error mb-3" role="alert">{error}</p>}
  {error.includes('activar')&&<div className="heading-actions mb-3"><a className="text-button" href="/activar-eliminacion-empresas.sql" download>Descargar migración de eliminación</a><a className="text-button" href="https://github.com/matiaslujanw/sofia-contador/blob/main/docs/COMPANY_DELETION.md" target="_blank" rel="noreferrer">Ver pasos de activación</a></div>}
  {preview&&!preview.blocked.length&&<form onSubmit={async e=>{
   e.preventDefault();if(busy||normalized!==preview.cuit||!ack)return;setBusy(true);setError('');
   try{await mutate({type:'company.delete',companyId:company.id,cuit:normalized,signature:preview.signature});close();router.replace(href('empresas',{companyId:undefined}));}
   catch(e){setError(e instanceof Error?e.message:'No se pudo eliminar la empresa.');setAck(false);setCuit('');setPreview(null);setLoading(true);await load(()=>true);}finally{setBusy(false);}
  }}><fieldset disabled={busy} className="grid gap-3"><Field label="Escribí el CUIT de la empresa para eliminarla"><Input value={cuit} onChange={e=>setCuit(e.target.value)} inputMode="numeric" autoComplete="off" required/></Field><label className="check-field"><input type="checkbox" checked={ack} onChange={e=>setAck(e.target.checked)}/>Entiendo que se borrarán la empresa y sus cargas y que no puedo deshacerlo</label></fieldset><div className="form-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={close}>Cancelar</button><button className="button button-danger" type="submit" disabled={busy||!ack||normalized!==preview.cuit}>{busy?'Eliminando…':'Eliminar definitivamente'}</button></div></form>}
 </Modal>;
}
export function PendingCompanyDeletionFiles(){
 const {state,mutate}=useWorkspace(),[busy,setBusy]=useState(''),[error,setError]=useState('');
 const jobs=state.companyDeletions?.filter(j=>j.organization_id===state.organization?.id&&j.status==='files_pending')??[];
 if(!jobs.length||state.organization?.role!=='owner')return null;
 return <section className="panel"><SectionHeading title="Archivos pendientes de eliminación" subtitle="La empresa ya fue quitada. Estos reintentos completan la limpieza de sus archivos originales."/>{jobs.map(j=><div className="heading-actions mb-3" key={j.id}><span>{j.company_name} · CUIT {j.cuit}</span><button type="button" className="button button-secondary" disabled={!!busy} onClick={async()=>{setBusy(j.id);setError('');try{await mutate({type:'company.deletion.cleanup',deletionId:j.id});}catch(e){setError(e instanceof Error?e.message:'No se pudo completar la limpieza.');}finally{setBusy('');}}}>{busy===j.id?'Retirando archivos…':'Reintentar limpieza de archivos'}</button></div>)}{error&&<p className="notice notice-error" role="alert">{error}</p>}</section>;
}
