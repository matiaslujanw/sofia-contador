import {expect,test} from '@playwright/test';
import {createDemoWorkspace} from '../../src/lib/workspace/demo';
import {coreScenario} from '../fixtures/core';
import {applyCoreCommand} from '../../src/lib/accounting/core/local';
const month='2026-11',company='10000000-0000-4000-8000-000000000011';

test('elimina empresa y archivo, conserva otra y permite recrear el mismo CUIT en iPad',async({page})=>{
 const s=createDemoWorkspace(month);s.organization!.name='VIG.IA';const selected=s.companies.find(c=>c.id===company)!;
 await page.addInitScript(s=>{if(!localStorage.getItem('sofia-contable-demo-v1'))localStorage.setItem('sofia-contable-demo-v1',JSON.stringify(s));},s);
 await page.setViewportSize({width:820,height:1180});
 await page.goto(`/documentacion?empresa=${company}&mes=${month}`);
 await page.getByRole('button',{name:'Subir documento',exact:true}).click();const upload=page.getByRole('dialog');
 await upload.getByLabel(/^Archivo/).setInputFiles({name:'respaldo-para-eliminar.csv',mimeType:'text/csv',buffer:Buffer.from('concepto;importe\nPrueba;10\n')});
 await upload.getByRole('button',{name:'Subir documento',exact:true}).click();await expect(upload).toHaveCount(0);
 await page.goto(`/empresas?mes=${month}`);
 await page.getByRole('button',{name:'Eliminar Lumen Estudio',exact:true}).click();let d=page.getByRole('dialog');
 await expect(d.getByRole('list',{name:'Datos que se eliminarían'})).toContainText('Documentos: 1');
 const confirm=d.getByRole('button',{name:'Eliminar definitivamente',exact:true});await expect(confirm).toBeDisabled();
 await d.getByLabel('Escribí el CUIT de la empresa para eliminarla').fill(s.companies[0].cuit);
 await d.getByRole('checkbox').check();await expect(confirm).toBeDisabled();
 await d.getByRole('button',{name:'Cancelar',exact:true}).click();await expect(page.getByRole('row').filter({hasText:'Lumen Estudio S.R.L.'})).toBeVisible();
 await page.getByRole('button',{name:'Eliminar Lumen Estudio',exact:true}).click();d=page.getByRole('dialog');
 await d.getByLabel('Escribí el CUIT de la empresa para eliminarla').fill(selected.cuit);await d.getByRole('checkbox').check();
 await d.getByRole('button',{name:'Eliminar definitivamente',exact:true}).click();await expect(d).toHaveCount(0);
 await expect(page.getByRole('row').filter({hasText:'Lumen Estudio S.R.L.'})).toHaveCount(0);await expect(page.getByRole('row').filter({hasText:'Nexo Custodia S.A.S.'})).toBeVisible();
 await page.reload();await expect(page.getByRole('row').filter({hasText:'Lumen Estudio S.R.L.'})).toHaveCount(0);
 const result=await page.evaluate(async company=>{
  const s=JSON.parse(localStorage.getItem('sofia-contable-demo-v1')!);const j=s.companyDeletions.find((j:{company_id:string})=>j.company_id===company);
  const db=await new Promise<IDBDatabase>((resolve,reject)=>{const r=indexedDB.open('sofia-demo-files',1);r.onsuccess=()=>resolve(r.result);r.onerror=()=>reject(r.error);});
  const bytes=await new Promise(resolve=>{const r=db.transaction('documents').objectStore('documents').get(j.storage_paths[0]);r.onsuccess=()=>resolve(r.result);});db.close();
  return {status:j.status,fileGone:bytes===undefined,documents:s.documents.filter((d:{company_id:string})=>d.company_id===company).length,otherExists:s.companies.some((c:{id:string})=>c.id==='10000000-0000-4000-8000-000000000010')};
 },company);
 expect(result).toEqual({status:'completed',fileGone:true,documents:0,otherExists:true});
 await page.getByRole('button',{name:'Nueva empresa',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Razón social',{exact:true}).fill('Lumen reiniciada');await d.getByLabel('CUIT',{exact:true}).fill(selected.cuit);await d.getByRole('button',{name:'Crear empresa',exact:true}).click();await expect(d).toHaveCount(0);await expect(page.getByRole('row').filter({hasText:'Lumen reiniciada'})).toBeVisible();
 await page.getByRole('button',{name:'Abrir menú',exact:true}).click();const profile=page.getByRole('dialog',{name:'Menú de navegación'}).getByLabel('Perfil profesional');await expect(profile).toContainText('Sofía Luján');await expect(profile).not.toContainText('VIG.IA');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);await page.screenshot({path:'/tmp/sofia-eliminar-empresa-ipad.png'});
});

test('sin propietaria no hay botón eliminar y un Diario confirmado bloquea el borrado',async({page})=>{
 const f=coreScenario(month);const s=applyCoreCommand(f.state,f.operations[0],'90000000-0000-4000-8000-000000000001');
 await page.addInitScript(s=>{if(!localStorage.getItem('sofia-contable-demo-v1'))localStorage.setItem('sofia-contable-demo-v1',JSON.stringify(s));},s);
 await page.goto('/empresas');await page.getByRole('button',{name:'Eliminar Nexo Custodia',exact:true}).click();const d=page.getByRole('dialog');await expect(d).toContainText('La empresa tiene asientos confirmados.');await expect(d.getByRole('button',{name:'Eliminar definitivamente'})).toHaveCount(0);await d.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.evaluate(()=>{const k='sofia-contable-demo-v1',s=JSON.parse(localStorage.getItem(k)!);s.organization.role='editor';localStorage.setItem(k,JSON.stringify(s));});await page.reload();await expect(page.getByRole('button',{name:/^Eliminar /})).toHaveCount(0);
});


test('permite reintentar una limpieza pendiente sin recuperar la empresa eliminada',async({page})=>{
 const s=createDemoWorkspace(month);s.companyDeletions=[{id:'80000000-0000-4000-8000-000000000001',organization_id:s.organization!.id,company_id:'80000000-0000-4000-8000-000000000002',company_name:'Empresa ya eliminada',cuit:'30719990041',counts:{documents:1},storage_paths:['80000000-0000-4000-8000-000000000003'],status:'files_pending',created_at:'2026-11-28T00:00:00Z'}];
 await page.addInitScript(s=>{if(!localStorage.getItem('sofia-contable-demo-v1'))localStorage.setItem('sofia-contable-demo-v1',JSON.stringify(s));},s);
 await page.goto('/empresas');await expect(page.getByRole('heading',{name:'Archivos pendientes de eliminación'})).toBeVisible();await page.getByRole('button',{name:'Reintentar limpieza de archivos',exact:true}).click();await expect(page.getByRole('heading',{name:'Archivos pendientes de eliminación'})).toHaveCount(0);await page.reload();await expect(page.getByRole('heading',{name:'Archivos pendientes de eliminación'})).toHaveCount(0);await expect(page.getByRole('row').filter({hasText:'Empresa ya eliminada'})).toHaveCount(0);
});
