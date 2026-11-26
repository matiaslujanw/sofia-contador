"use client";

import { useState } from 'react';
import { readComafiPdf } from '@/lib/imports/comafi';
import { money, monthLabel } from '@/lib/workspace/format';

export function ComafiReview({file,month,locale}:{file:File;month:string;locale:string}) {
 const [result,setResult]=useState<Awaited<ReturnType<typeof readComafiPdf>>|null>(null);
 const [reading,setReading]=useState(false),[error,setError]=useState('');
 return <div className="mb-3">
  <button className="button button-secondary" type="button" disabled={reading} onClick={async()=>{
   setReading(true);setError('');setResult(null);
   try {setResult(await readComafiPdf(await file.arrayBuffer()));}
   catch(reason){setError(reason instanceof Error?reason.message:'No se pudo analizar el PDF.');}
   finally{setReading(false);}
  }}>{reading?'Leyendo resumen…':'Analizar PDF Comafi'}</button>
  {error&&<p className="notice notice-error mt-3" role="alert">{error}</p>}
  {result&&<div className="mt-3" aria-live="polite">
   <h3>Resultado de lectura · {monthLabel(result.month,locale)}</h3>
   {result.month!==month&&<p className="notice notice-warning">El resumen corresponde a otro mes. Seleccioná {monthLabel(result.month,locale)} antes de guardarlo.</p>}
   <div className="table-wrap"><table><thead><tr><th>Cuenta</th><th>Moneda</th><th>Saldo anterior</th><th>Saldo final</th><th>Actividad</th></tr></thead><tbody>{result.accounts.map(a=><tr key={a.number}><td>…{a.number.slice(-4)}</td><td>{a.currency}</td><td>{money(a.opening,a.currency,locale)}</td><td>{money(a.closing,a.currency,locale)}</td><td>Sin movimientos</td></tr>)}</tbody></table></div>
   <p className="notice notice-warning mt-3">{result.warning}</p>
   <p className="muted text-sm">Lectura de control: no registra asientos ni modifica el papel de IVA. Guardá el original como respaldo del mes. La clasificación de cargos necesita un resumen con movimientos para validar su formato.</p>
  </div>}
 </div>;
}
