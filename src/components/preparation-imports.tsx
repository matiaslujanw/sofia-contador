"use client";
import {useState} from 'react';
import Link from 'next/link';
import {useWorkspace} from './workspace-context';
import {dayLabel} from '@/lib/workspace/format';

export function PreparationImports({kind}:{kind:'accounts'|'purchase'|'sale'}){
 const {state,company,period,locale,download,href}=useWorkspace();
 const [error,setError]=useState('');
 if(!company||(kind!=='accounts'&&!period))return null;
 const entries=state.imports.filter(i=>i.company_id===company.id&&i.kind===kind&&(kind==='accounts'||i.period_id===period?.id)).sort((a,b)=>b.created_at.localeCompare(a.created_at));
 return <section className="panel" aria-label="Cargas confirmadas"><h3>Cargas confirmadas y guardadas</h3>
 <p className="muted text-sm mb-3">{kind==='accounts'?'El plan pertenece a esta empresa y se conserva entre meses.':'Los comprobantes y sus originales quedan guardados en esta empresa y mes.'} Elegir un archivo muestra una vista previa; las filas se guardan al confirmar la importación.</p>
 {error&&<p role="alert" className="notice notice-error">{error}</p>}
 {entries.length>0?<div className="table-wrap"><table><thead><tr><th>Original guardado</th><th>Fecha</th><th>Filas guardadas</th><th>Acción</th></tr></thead><tbody>{entries.map(i=>{const doc=state.documents.find(d=>d.id===i.document_id&&d.company_id===company.id);return <tr key={i.id}><td>{doc?.name??'Original de la importación'}</td><td>{dayLabel(i.created_at,{dateStyle:'short'},locale)}</td><td>{i.row_count}</td><td>{doc&&<button className="button button-secondary" type="button" onClick={()=>void download(doc).catch(reason=>setError(reason.message))}>Descargar original</button>}</td></tr>;})}</tbody></table></div>:<p className="muted">Todavía no hay importaciones confirmadas para esta selección.</p>}
 <Link className="text-button mt-3" href={kind==='accounts'?href('cuentas'):href('comprobantes',{}, {tipo:kind==='purchase'?'compras':'ventas'})}>Ver datos guardados</Link>
 </section>;
}
