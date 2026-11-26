"use client";

import {useState} from 'react';
import Link from 'next/link';
import {readComafiPdf} from '@/lib/imports/comafi';
import {restoreComafiWorksheet} from '@/lib/imports/comafi-restore';
import type {Document} from '@/lib/workspace/model';
import {ComafiReview,type SavedComafiAnalysis} from './comafi-review';
import {useWorkspace} from './workspace-context';
import {Badge,Field,Input,SectionHeading} from './workspace-ui';

export function BankPreparation(){
 const {state,company,period,month,locale,canEdit,upload,readDocument,download,href}=useWorkspace();
 const [file,setFile]=useState<File|null>(null),[initial,setInitial]=useState<SavedComafiAnalysis|undefined>();
 const [version,setVersion]=useState(0),[busy,setBusy]=useState(false),[error,setError]=useState('');
 if(!company||!period)return null;
 const editable=canEdit&&company.status==='active'&&period.status==='open';
 const docs=state.documents.filter(d=>d.organization_id===company.organization_id&&d.company_id===company.id&&d.period_id===period.id).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const bankDocs=docs.filter(d=>d.category==='Extractos bancarios');
 const papers=docs.filter(d=>d.category==='Papeles de trabajo'&&d.name===`comafi-${month}-papel-bancario.csv`);
 async function open(doc:Document){
  if(!company||busy)return;setBusy(true);setError('');setFile(null);setInitial(undefined);
  try{
   const original=await readDocument(doc),result=await readComafiPdf(await original.arrayBuffer());
   let analysis:SavedComafiAnalysis={result,reviewed:false,paperSaved:false};
   for(const paper of papers){
    try{const restored=await restoreComafiWorksheet(result,company.cuit,original.name,await readDocument(paper));analysis={...restored,paperSaved:true};break;}
    catch{/* Other PDFs or incompatible revisions never overwrite this PDF's classifications. */}
   }
   setInitial(analysis);setVersion(v=>v+1);setFile(original);
  }catch(reason){setError(reason instanceof Error?reason.message:'No se pudo recuperar el trabajo guardado.');}
  finally{setBusy(false);}
 }
 return <section className="panel"><SectionHeading title="Resumen Comafi y cargos impositivos" subtitle="Los archivos guardados se conservan por empresa y mes. Podés reabrirlos para continuar." action={<Badge>{bankDocs.length} extractos guardados</Badge>}/>
 {editable&&<form className="form-grid mb-3" onSubmit={async e=>{e.preventDefault();if(!file||busy)return;setBusy(true);setError('');try{await upload('Extractos bancarios',file);setFile(null);setInitial(undefined);}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar el PDF.');}finally{setBusy(false);}}}>
 <Field label="Resumen Comafi en PDF"><Input type="file" accept=".pdf,application/pdf" disabled={busy} onChange={e=>{setFile(e.target.files?.[0]??null);setInitial(undefined);setVersion(v=>v+1);setError('');}}/></Field>
 <button className="button button-primary" type="submit" disabled={!file||busy||!!initial}>{busy?'Procesando…':initial?'Original ya guardado':'Guardar resumen del mes'}</button></form>}
 {error&&<p className="notice notice-error mb-3" role="alert">{error}</p>}
 {bankDocs.length>0&&<section className="mb-3" aria-label="Extractos guardados"><h3>Documentos ya guardados en este mes</h3><p className="muted text-sm mb-3">Abrí el análisis para recuperar los movimientos y las clasificaciones del último papel compatible guardado.</p><ul>{bankDocs.map(doc=><li className="mb-3" key={doc.id}><span>{doc.name}</span><div className="heading-actions"><button className="button button-secondary" type="button" disabled={busy} onClick={()=>void open(doc)} aria-label={`Abrir análisis ${doc.name}`}>Abrir análisis guardado</button><button className="button button-secondary" type="button" disabled={busy} onClick={()=>void download(doc).catch(reason=>setError(reason.message))} aria-label={`Descargar ${doc.name}`}>Descargar original</button></div></li>)}</ul></section>}
 {papers.length>0&&<details className="mb-3"><summary>{papers.length} papeles bancarios guardados</summary><ul>{papers.map(doc=><li key={doc.id}><button className="text-button" type="button" onClick={()=>void download(doc).catch(reason=>setError(reason.message))}>Descargar {doc.name}</button></li>)}</ul></details>}
 {file&&<ComafiReview key={version} file={file} month={month} locale={locale} initial={initial}/>}
 <div className="heading-actions"><Link className="button button-secondary" href={href('documentacion')}>Ver respaldos del mes</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'cash'})}>Registrar cargos y movimientos</Link><Link className="button button-secondary" href={href('contabilidad',{}, {tipo:'accrual'})}>Ver control fiscal bancario</Link></div>
 <p className="muted mt-3">Analizar muestra una vista previa. Guardar resumen conserva el original; Guardar PDF y papel bancario conserva también las clasificaciones revisadas. Los asientos y el IVA computable se revisan después.</p>
 </section>;
}
