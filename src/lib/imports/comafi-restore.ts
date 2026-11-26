import {readSource} from './source';
import {comafiCategories,comafiWorksheetCsv,type ComafiCategory,type ComafiResult} from './comafi';

// Only classifications are restored. Every amount and source identifier must match the original PDF.
export async function restoreComafiWorksheet(result:ComafiResult,companyCuit:string,sourceName:string,file:File){
 const saved=await readSource(await file.arrayBuffer(),file.name);
 const expected=await readSource(new TextEncoder().encode(comafiWorksheetCsv(result,companyCuit,sourceName)).buffer,'expected.csv');
 if(JSON.stringify(saved.headers)!==JSON.stringify(expected.headers)||saved.rows.length!==expected.rows.length)throw new Error('El papel guardado tiene otro formato o cantidad de registros.');
 const categoryColumn=expected.headers.indexOf('clasificacion_revisable'),reviewColumn=expected.headers.indexOf('revision'),idColumn=expected.headers.indexOf('identificador');
 const categories=new Map<string,ComafiCategory>(Object.entries(comafiCategories).map(([key,label])=>[label,key as ComafiCategory]));
 const changes=new Map<string,ComafiCategory>();
 let reviewed:boolean|undefined;
 for(const [i,row] of saved.rows.entries()){
  const baseline=expected.rows[i];
  if(row.cells.length!==baseline.cells.length||row.cells.some((value,col)=>col!==categoryColumn&&col!==reviewColumn&&value!==baseline.cells[col]))throw new Error('El papel no coincide con esta empresa, PDF o sus importes.');
  const status=row.cells[reviewColumn];
  if(!['Revisado por usuario','Clasificación sugerida sin confirmar'].includes(status))throw new Error('No se reconoce la revisión del papel guardado.');
  const value=status==='Revisado por usuario';
  if(reviewed!==undefined&&reviewed!==value)throw new Error('El papel tiene estados de revisión distintos.');reviewed=value;
  const id=row.cells[idColumn];
  if(!id){if(row.cells[categoryColumn]!=='Sin movimientos')throw new Error('La cuenta sin actividad tiene una clasificación inválida.');continue;}
  const category=categories.get(row.cells[categoryColumn]);
  if(!category||changes.has(id))throw new Error('Clasificación desconocida o movimiento duplicado en el papel.');changes.set(id,category);
 }
 return {result:{...result,accounts:result.accounts.map(a=>({...a,movements:a.movements.map(m=>({...m,category:changes.get(m.id)??m.category}))}))},reviewed:reviewed??false};
}
