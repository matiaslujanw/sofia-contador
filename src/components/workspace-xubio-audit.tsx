"use client";

import {useEffect,useEffectEvent,useMemo,useState} from 'react';
import Link from 'next/link';
import type {Document} from '@/lib/workspace/model';
import {companyName,monthLabel,money} from '@/lib/workspace/format';
import {readComafiPdf,comafiCategories,type ComafiResult} from '@/lib/imports/comafi';
import {restoreComafiWorksheet} from '@/lib/imports/comafi-restore';
import {readXubioReport,reportLabels,emptyAuditMapping,makeCandidates,auditXubio,auditCsv,exportAuditRecords,digest,journalEntries,type XubioReportKind,type XubioReport,type AuditMapping} from '@/lib/accounting/xubio-audit';
import {auditSourcePrefix,auditSourceName,auditSettingsCsv,restoreAuditSettings,auditManifestCsv,auditExportHistory} from '@/lib/accounting/audit-archive';
import {xubioWorkbook} from '@/lib/accounting/xubio';
import {useWorkspace} from './workspace-context';
import {CompanyRequired,PeriodRequired} from './workspace-operations';
import {Badge,Field,Heading,Input,SectionHeading,Select} from './workspace-ui';

type Source={file:File;report:XubioReport;saved:boolean};
const kinds=Object.keys(reportLabels) as XubioReportKind[];
const statusLabels={matched:'Coincidencia contable · revisar',ambiguous:'Coincidencia ambigua o agrupada',missing:'Sin coincidencia · posible faltante',blocked:'Falta preparar / identificar',exported:'Lote generado · verificar importación'};
function downloadFile(file:Blob,name:string){const url=URL.createObjectURL(file),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),10000);}

export function XubioAuditPage(){
 const {state,company,period,month,locale,canEdit,href,upload,readDocument,currentDocuments,download}=useWorkspace();
 const [sources,setSources]=useState<Partial<Record<XubioReportKind,Source>>>({});
 const [banks,setBanks]=useState<ComafiResult[]>([]),[mapping,setMapping]=useState<AuditMapping>({...emptyAuditMapping,bank:{},categories:{}});
 const [coverage,setCoverage]=useState(false),[selected,setSelected]=useState<Set<string>>(new Set()),[exported,setExported]=useState<Set<string>>(new Set());
 const [busy,setBusy]=useState(true),[error,setError]=useState(''),[notice,setNotice]=useState(''),[historyReady,setHistoryReady]=useState(false),[loadIssues,setLoadIssues]=useState<string[]>([]);
 const [circuit,setCircuit]=useState(''),[approved,setApproved]=useState(false),[lots,setLots]=useState<Document[]>([]),[partialLots,setPartialLots]=useState<string[]>([]);
 const accounts=state.accounts.filter(a=>a.company_id===company?.id&&a.organization_id===company?.organization_id);
 const ownDocs=state.documents.filter(d=>d.company_id===company?.id&&d.period_id===period?.id).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 const reports=Object.fromEntries(Object.entries(sources).map(([kind,s])=>[kind,s.report])) as Partial<Record<XubioReportKind,XubioReport>>;
 const candidates=useMemo(()=>company&&period?makeCandidates(state,company,period.id,mapping,banks):[],[state,company,period,mapping,banks]);
 const audit=useMemo(()=>{
  const result=auditXubio(candidates,reports,accounts,month,coverage,exported);
  if(loadIssues.length)return {...result,ready:false,issues:[...result.issues,...loadIssues]};return result;
 // Reports and account lists are inexpensive deterministic inputs; recompute when the workspace changes.
 },[candidates,sources,state,month,coverage,exported,loadIssues]); // eslint-disable-line react-hooks/exhaustive-deps
 const eligibleSelected=new Set(audit.findings.filter(f=>f.status==='missing'&&selected.has(f.candidate.id)).map(f=>f.candidate.id));
 const editable=canEdit&&company?.status==='active'&&period?.status==='open';
 function invalidate(){setSelected(new Set());setApproved(false);setNotice('');}
 function changeMapping(next:AuditMapping){setMapping(next);invalidate();}
 async function sourceFingerprint(nextSources:typeof sources,nextBanks:ComafiResult[]){return digest(JSON.stringify({
  company:company?.id,cuit:company?.cuit,month,
  reports:Object.entries(nextSources).map(([kind,s])=>[kind,s.report.sha256]).sort(),
  banks:nextBanks.map(b=>[b.source_sha256,b.accounts.map(a=>[a.number,a.movements.map(m=>[m.id,m.category])])]),
  accounts:accounts.map(a=>[a.id,a.code,a.name,a.kind,a.status]).sort(),
  vouchers:state.vouchers.filter(v=>v.company_id===company?.id&&v.period_id===period?.id),
  book:state.bookRecords.filter(b=>b.company_id===company?.id&&b.period_id===period?.id),
 }));}
 async function recover(alive=()=>true){
  if(!company||!period)return;setBusy(true);setError('');setNotice('');setHistoryReady(false);setApproved(false);
  try{
   const docs=(await currentDocuments()).filter(d=>d.company_id===company.id&&d.period_id===period.id).sort((a,b)=>b.created_at.localeCompare(a.created_at));
   const nextSources:typeof sources={},issues:string[]=[],nextBanks:ComafiResult[]=[];
   for(const kind of kinds){const doc=docs.find(d=>d.category==='Respaldos'&&d.name.startsWith(auditSourcePrefix(kind,month)));if(doc){try{const file=await readDocument(doc);nextSources[kind]={file,report:await readXubioReport(kind,file),saved:true};}catch{issues.push('No se pudo recuperar '+reportLabels[kind]+'. Revisá su respaldo.');}}}
   const seen=new Set<string>();
   for(const doc of docs.filter(d=>d.category==='Extractos bancarios')){
    if(!doc.name.toLowerCase().endsWith('.pdf')){issues.push('Hay extractos no PDF pendientes de analizar; el alcance bancario está incompleto.');continue;}
    try{const file=await readDocument(doc);let bank:ComafiResult=await readComafiPdf(await file.arrayBuffer());if(bank.month!==month){issues.push('Un extracto guardado corresponde a otro mes.');continue;}if(seen.has(bank.source_sha256!))continue;seen.add(bank.source_sha256!);
     for(const paper of docs.filter(d=>d.category==='Papeles de trabajo'&&d.name===`comafi-${month}-papel-bancario.csv`)){try{bank=(await restoreComafiWorksheet(bank,company.cuit,file.name,await readDocument(paper))).result;break;}catch{/* Only a compatible paper can change the suggested categories. */}}
     nextBanks.push(bank);
    }catch{issues.push('Un extracto bancario no se pudo verificar. Abrilo en Preparar mes → Banco.');}
   }
   const history=await auditExportHistory(docs,readDocument,company,month,period.id);
   let settings:{mapping:AuditMapping;coverage:boolean;selected:Set<string>;circuit:string}|undefined;
   const fingerprint=await sourceFingerprint(nextSources,nextBanks);
   for(const doc of docs.filter(d=>d.name===`xubio-auditoria-${month}-revision.csv`)){try{settings=await restoreAuditSettings(await readDocument(doc),company,month,fingerprint);break;}catch{/* Older revisions are kept as evidence, never silently applied to new inputs. */}}
   if(!alive())return;
   setSources(nextSources);setBanks(nextBanks);setMapping(settings?.mapping??{...emptyAuditMapping,bank:{},categories:{}});setCoverage(settings?.coverage??false);setSelected(settings?.selected??new Set());setCircuit(settings?.circuit??'');setExported(history.ids);setLots(history.files);setPartialLots(history.incomplete);setLoadIssues(issues);setHistoryReady(true);
   setNotice(settings?'Auditoría y revisión recuperadas para esta empresa y mes.':'Respaldos del mes consultados. Revisá el alcance y las cuentas antes de exportar.');
  }catch(reason){if(alive())setError(reason instanceof Error?reason.message:'No se pudo recuperar la auditoría.');}
  finally{if(alive())setBusy(false);}
 }
 const recoverOnMount=useEffectEvent((alive:()=>boolean)=>recover(alive));
 useEffect(()=>{let active=true;const timer=setTimeout(()=>void recoverOnMount(()=>active),0);return()=>{active=false;clearTimeout(timer);};},[]);
 if(!company)return <><Heading title="Auditoría de Xubio"/><CompanyRequired/></>;
 if(!period)return <><Heading title="Auditoría de Xubio"/><PeriodRequired/></>;
 const accountSelect=(label:string,value:string,onChange:(value:string)=>void,kind?:string)=><Field label={label}><Select value={value} disabled={busy||!editable} onChange={e=>onChange(e.target.value)}><option value="">Elegí una cuenta de esta empresa</option>{accounts.filter(a=>a.status==='active'&&(!kind||a.kind===kind)).map(a=><option key={a.id} value={a.id}>{a.code} · {a.name}</option>)}</Select></Field>;
 return <>
 <Heading title="Auditoría de Xubio" description={`${companyName(company)} · ${monthLabel(month,locale)}`} actions={<Link className="button button-secondary" href={href('inicio')}>Volver a la empresa</Link>}/>
 <p className="notice">Compara las fuentes cargadas con Xubio. Una coincidencia contable requiere revisión; la ausencia de coincidencia se trata como posible faltante. Incluí asientos automáticos y manuales, todos los circuitos, sin agrupar compras/ventas. Este control no certifica documentación que todavía no fue cargada.</p>
 <div className="heading-actions"><button type="button" className="button button-secondary" disabled={busy} onClick={()=>void recover()}>{busy?'Leyendo respaldos…':'Recuperar auditoría del mes'}</button><Link className="button button-secondary" href={href('preparacion',{}, {tipo:'banco'})}>Cargar o revisar resumen bancario</Link><Link className="button button-secondary" href={href('cuentas')}>Plan permanente de la empresa</Link><Link className="button button-secondary" href={href('documentacion')}>Ver respaldos y lotes</Link></div>
 {error&&<p className="notice notice-error" role="alert">{error}</p>}{notice&&<p className="notice notice-success" role="status">{notice}</p>}
 {partialLots.length>0&&<p className="notice notice-warning">Hay un XLS de lote parcial guardado. Solo se puede completar con la misma selección, fuentes, cuentas y circuito. Consultá sus respaldos antes de intentar otra generación.</p>}
 <section className="panel"><SectionHeading title="1. Reportes mensuales de Xubio" subtitle="Cada archivo queda archivado por empresa y mes. El plan de cuentas ya existente se reutiliza."/>
 <div className="form-grid">{kinds.map(kind=>{const source=sources[kind],saved=ownDocs.find(d=>d.name.startsWith(auditSourcePrefix(kind,month))),entries=source?journalEntries(source.report):[];return <div key={kind} className="field-wide mb-3"><Field label={reportLabels[kind]}><Input type="file" accept=".xlsx,.xls,.csv" disabled={!editable||busy} onChange={async e=>{const file=e.target.files?.[0];if(!file)return;setBusy(true);setError('');try{const report=await readXubioReport(kind,file);setSources({...sources,[kind]:{file,report,saved:false}});setCoverage(false);invalidate();}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo leer el reporte.');}finally{setBusy(false);}}}/></Field>
 {source?<><p>{source.report.filename} · {source.report.mode==='summary'?`${source.report.summaries.length} asientos sin detalle`:`${source.report.lines.length||source.report.balances.length} filas`} · {source.saved?'Guardado':'Vista previa sin guardar'}</p>
 {source.report.dates.length>0&&<p className="muted text-sm">Fechas: {source.report.dates[0]} a {source.report.dates.at(-1)} · {source.report.accounts.length} cuenta(s). Se cruza solamente el mes seleccionado; Sumas y Saldos requiere sus filtros confirmados.</p>}
 {kind==='diario'&&source.report.mode==='detail'&&<div className="notice mt-3" role="region" aria-label="Detalle del Diario por mes"><p>Asientos en el archivo: {entries.length} · Asientos del mes seleccionado: {entries.filter(e=>e.date.startsWith(month)).length} · Renglones del mes: {source.report.lines.filter(l=>l.date.startsWith(month)).length}</p><ul>{[...new Set(source.report.lines.map(l=>l.date.slice(0,7)))].sort().map(m=><li key={m}>{monthLabel(m,locale)} · Asientos: {entries.filter(e=>e.date.startsWith(m)).length} · Renglones: {source.report.lines.filter(l=>l.date.startsWith(m)).length}</li>)}</ul><p className="text-sm">Solo se cruza {monthLabel(month,locale)}. El equilibrio Debe/Haber no demuestra por sí solo que estén registradas todas las operaciones.</p></div>}
 {[...source.report.warnings,...source.report.errors].map((message,i)=><p key={i} className="notice notice-warning text-sm">{message}</p>)}
 <button className="button button-secondary mt-3" type="button" disabled={busy||!editable||source.saved} onClick={async()=>{setBusy(true);setError('');try{const file=new File([await source.file.arrayBuffer()],auditSourceName(kind,month,source.file),{type:source.file.type});await upload('Respaldos',file);setSources({...sources,[kind]:{...source,saved:true}});setNotice('Reporte guardado. Podés salir y recuperarlo en esta empresa y mes.');}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar el original.');}finally{setBusy(false);}}}>{source.saved?'Reporte guardado':'Guardar reporte mensual'}</button></>:<p className="muted">{saved?`Guardado: ${saved.name}`:'Pendiente de carga.'}</p>}</div>;})}</div>
 </section>
 <section className="panel"><SectionHeading title="2. Fuentes y cuentas a revisar" subtitle={`${banks.length} resumen(es) Comafi recuperados · ${candidates.length} operaciones propuestas desde comprobantes, banco y libro de Sofía.`}/>
 <p className="muted mb-3">Las transferencias, pagos comerciales y otros movimientos sin contraparte se completan en Contabilidad. Devengamientos y amortizaciones se comparan si sus asientos están preparados allí; faltan soportes si todavía no se cargaron sus liquidaciones o bienes.</p>
 <details><summary>Vincular cuentas del plan para preparar propuestas</summary><div className="form-grid mt-3">
 {banks.flatMap(b=>b.accounts).filter((a,i,all)=>all.findIndex(x=>x.number===a.number)===i).map(a=><div key={a.number}>{accountSelect(`Cuenta bancaria …${a.number.slice(-4)} · ${a.currency}`,mapping.bank[a.number]??'',value=>changeMapping({...mapping,bank:{...mapping.bank,[a.number]:value}}),'asset')}</div>)}
 {[...new Set(banks.flatMap(b=>b.accounts.flatMap(a=>a.movements.map(m=>m.category))))].map(category=><div key={category}>{accountSelect(`Contrapartida · ${comafiCategories[category]}`,mapping.categories[category]??'',value=>changeMapping({...mapping,categories:{...mapping.categories,[category]:value}}))}</div>)}
 {accountSelect('IVA compras',mapping.purchaseVat,value=>changeMapping({...mapping,purchaseVat:value}))}{accountSelect('IVA ventas',mapping.saleVat,value=>changeMapping({...mapping,saleVat:value}))}
 {accountSelect('Proveedores · cuenta de control',mapping.suppliers,value=>changeMapping({...mapping,suppliers:value}),'liability')}{accountSelect('Clientes · cuenta de control',mapping.customers,value=>changeMapping({...mapping,customers:value}),'asset')}
 </div></details>
 <label className="check-field mt-3"><input type="checkbox" checked={coverage} disabled={busy||!editable} onChange={e=>{setCoverage(e.target.checked);invalidate();}}/>Verifiqué la empresa, la moneda ARS, el Diario completo del mes con todos los circuitos y sin agrupación, y el rango mensual de Sumas y Saldos</label>
 <p className="muted text-sm mt-3">Si un cargo bancario tiene factura en ARCA, revisá si el débito cancela al proveedor en lugar de generar nuevamente gasto e IVA. Las percepciones, IVA no computable, impuesto a los débitos/créditos y sellos requieren criterio fiscal. La asignación de una cuenta no determina por sí sola su cómputo impositivo. Los pagos y transferencias no se presumen compras o ventas.</p>
 </section>
 <section className="panel"><SectionHeading title="3. Hallazgos y faltantes revisables" action={<Badge tone={audit.ready?'positive':'warning'}>{audit.ready?'Cruce habilitado':'Alcance incompleto'}</Badge>}/>
 {audit.issues.length>0&&<ul className="notice notice-warning mb-3">{audit.issues.map((issue,i)=><li key={i}>{issue}</li>)}</ul>}
 <div className="table-wrap"><table aria-label="Hallazgos de Xubio"><thead><tr><th>Revisar faltante</th><th>Fecha / operación</th><th>Estado</th><th>Evidencia / pendientes</th><th>Propuesta contable</th></tr></thead><tbody>{audit.findings.map(f=><tr key={f.candidate.id}><td><input type="checkbox" aria-label={`Confirmar faltante ${f.candidate.id}`} disabled={busy||!editable||!audit.ready||f.status!=='missing'} checked={f.status==='missing'&&selected.has(f.candidate.id)} onChange={e=>{const next=new Set(selected);if(e.target.checked)next.add(f.candidate.id);else next.delete(f.candidate.id);setSelected(next);setApproved(false);}}/></td><td>{f.candidate.date}<small>{f.candidate.description}</small></td><td>{statusLabels[f.status]}</td><td>{[...f.evidence,...f.candidate.blocked].join(' · ')||'Sin coincidencia en el Diario cargado: revisar documento, cuentas y posibles agrupaciones antes de confirmar.'}</td><td>{f.candidate.lines.map((l,i)=><small key={i}>{accounts.find(a=>a.id===l.account_id)?.name??'Cuenta pendiente'} · Debe {money(l.debit,f.candidate.currency,locale)} / Haber {money(l.credit,f.candidate.currency,locale)}</small>)}</td></tr>)}</tbody></table></div>
 {!candidates.length&&<p className="notice mt-3">Todavía no hay operaciones esperadas para comparar. Cargá comprobantes/respaldos bancarios o prepará los asientos de devengamientos y amortizaciones en Contabilidad.</p>}
 <div className="heading-actions mt-3"><button type="button" className="button button-secondary" disabled={busy} onClick={()=>downloadFile(new Blob([auditCsv(audit,company,month)],{type:'text/csv;charset=utf-8'}),`xubio-auditoria-${month}-hallazgos.csv`)}>Descargar informe de auditoría</button>
 <button type="button" className="button button-secondary" disabled={busy||!editable||!historyReady||Object.values(sources).some(s=>!s.saved)} onClick={async()=>{setBusy(true);setError('');try{const fingerprint=await sourceFingerprint(sources,banks);await upload('Papeles de trabajo',new File([auditSettingsCsv(company,month,fingerprint,mapping,coverage,eligibleSelected,circuit)],`xubio-auditoria-${month}-revision.csv`,{type:'text/csv'}));setNotice('Revisión de auditoría guardada para continuar después.');}catch(reason){setError(reason instanceof Error?reason.message:'No se pudo guardar la revisión.');}finally{setBusy(false);}}}>Guardar revisión y cuentas</button></div>
 </section>
 <section className="panel"><SectionHeading title="4. Archivo para importar a Xubio" subtitle="Solo los posibles faltantes completos y confirmados. Coincidencias, dudas y lotes anteriores quedan excluidos."/>
 <Field label="Circuito contable exacto en Xubio"><Input value={circuit} disabled={busy||!editable} onChange={e=>{setCircuit(e.target.value);setApproved(false);}} maxLength={100}/></Field>
 <label className="check-field mt-3"><input type="checkbox" checked={approved} disabled={busy||!editable} onChange={e=>setApproved(e.target.checked)}/>Revisé cada faltante seleccionado, cuentas, contrapartes, facturas bancarias, posibles agrupaciones y lotes previos; nadie lo registró en Xubio desde esta consulta</label>
 <button className="button button-primary mt-3" type="button" disabled={busy||!editable||!historyReady||!audit.ready||!eligibleSelected.size||!approved||!circuit.trim()||Object.values(sources).some(s=>!s.saved)} onClick={async()=>{
  setBusy(true);setError('');try{
   const docs=await currentDocuments();const history=await auditExportHistory(docs,readDocument,company,month,period.id);
   if([...eligibleSelected].some(id=>history.ids.has(id)))throw new Error('Una selección ya pertenece a un lote generado. Recuperá la auditoría y descargá el lote guardado.');
   const fresh=auditXubio(candidates,reports,accounts,month,coverage,history.ids);if(loadIssues.length)throw new Error('Hay respaldos pendientes de verificar.');
   const records=exportAuditRecords(fresh,eligibleSelected,company,period.id,accounts,month),fingerprint=await sourceFingerprint(sources,banks);
   const batch=(await digest(JSON.stringify({company:company.id,month,fingerprint,records,circuit}))).slice(0,16),xlsName=`xubio-asientos-${month}-${batch}.xls`;
   if(history.incomplete.some(name=>name!==xlsName))throw new Error('Hay otro lote incompleto. Revisá sus respaldos antes de generar más asientos.');
   await upload('Papeles de trabajo',new File([auditSettingsCsv(company,month,fingerprint,mapping,coverage,eligibleSelected,circuit)],`xubio-auditoria-${month}-revision.csv`,{type:'text/csv'}));
   let bytes=await xubioWorkbook(records,accounts,state.vouchers,circuit);
   const prior=docs.filter(d=>d.name===xlsName&&d.category==='Papeles de trabajo');
   if(prior.length>1)throw new Error('Hay copias del lote: revisá Documentación.');
   if(prior[0]){const stored=await (await readDocument(prior[0])).arrayBuffer();if(await digest(stored)!==await digest(bytes))throw new Error('El lote parcial no coincide con la propuesta. Conservá el original para revisar.');bytes=stored;}
   else await upload('Papeles de trabajo',new File([bytes],xlsName,{type:'application/vnd.ms-excel'}));
   const manifest=auditManifestCsv(company,month,fingerprint,xlsName,await digest(bytes),eligibleSelected);
   await upload('Papeles de trabajo',new File([manifest],`xubio-lote-${month}-${batch}.csv`,{type:'text/csv'}));
   setExported(new Set([...history.ids,...eligibleSelected]));setSelected(new Set());setApproved(false);setPartialLots([]);
   setLots((await currentDocuments()).filter(d=>d.name.startsWith(`xubio-asientos-${month}-`)&&d.category==='Papeles de trabajo'));
   downloadFile(new Blob([bytes],{type:'application/vnd.ms-excel'}),xlsName);
   setNotice('Lote XLS y control guardados. Importalo en Xubio y cargá un Diario actualizado para verificar la registración. La descarga no confirma la importación.');
  }catch(reason){setError(reason instanceof Error?reason.message:'No se pudo generar el lote.');}finally{setBusy(false);}
 }}>Generar XLS de faltantes revisados</button>
 <p className="muted text-sm mt-3">El XLS usa el modelo de asientos manuales de Xubio: cabecera por asiento, nombres exactos de cuentas y líneas Debe/Haber. Probalo primero en una empresa de prueba. No modifica Xubio ni marca operaciones como importadas. El historial reduce reenvíos, pero los operadores deben coordinarse si trabajan simultáneamente.</p>
 {lots.length>0&&<ul className="mt-3">{lots.map(doc=><li key={doc.id}><button className="text-button" type="button" onClick={()=>void download(doc).catch(reason=>setError(reason.message))}>Descargar lote guardado {doc.name}</button></li>)}</ul>}
 </section>
 </>;
}
