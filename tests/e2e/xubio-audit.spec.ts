import {expect,test} from '@playwright/test';
import {utils,write,read} from 'xlsx';
import {readFile} from 'node:fs/promises';
import {createDemoWorkspace} from '../../src/lib/workspace/demo';
import {todayIn,shiftMonth} from '../../src/lib/workspace/format';
import {pair} from '../../src/lib/accounting/engine';
import type {Account} from '../../src/lib/workspace/model';
const companyId='10000000-0000-4000-8000-000000000010',month=todayIn().slice(0,7);
const bank='00000000-0000-4000-8000-000000000001',expense='00000000-0000-4000-8000-000000000002',expected='00000000-0000-4000-8000-000000000003';
function seed(){const s=createDemoWorkspace(month),company=s.companies.find(c=>c.id===companyId)!,period=s.periods.find(p=>p.company_id===companyId&&p.status==='open')!;
 s.accounts=[{id:bank,code:'101',name:'Banco sintético',kind:'asset'},{id:expense,code:'501',name:'Gastos sintéticos',kind:'expense'}].map(a=>({...a,kind:a.kind as Account['kind'],company_id:companyId,organization_id:company.organization_id,parent_code:null,category:null,status:'active'}));
 s.vouchers=[];s.bookRecords=[{id:expected,company_id:companyId,organization_id:company.organization_id,period_id:period.id,payload:{kind:'journal',date:`${month}-06`,reference:'AUDIT-TEST',description:'Comisión faltante sintética',currency:'ARS',document_id:null,source_key:'test',lines:pair(expense,bank,1100n)}}];return s;}
function xlsx(name:string,rows:(string|number)[][]){const book=utils.book_new();utils.book_append_sheet(book,utils.aoa_to_sheet(rows),'Datos');return {name,mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:write(book,{type:'buffer',bookType:'xlsx',compression:true}) as Buffer};}
const sources={
 'Libro Diario / asientos detallados':xlsx('diario-sintetico.xlsx',[
 ['N°','Fecha','Documento/Concepto','Código','Cuenta','Año','Mes','Debe','Haber'],
 ['1',`${shiftMonth(month,-1)}-05`,'Prueba mes anterior','501','Gastos sintéticos','','',30,0],['',`${shiftMonth(month,-1)}-05`,'','101','Banco sintético','','',0,30],
 ['2',`${month}-05`,'Asiento de prueba','501','Gastos sintéticos','','',10,0],['',`${month}-05`,'','101','Banco sintético','','',0,10],
 ['3',`${shiftMonth(month,1)}-05`,'Prueba mes siguiente','501','Gastos sintéticos','','',20,0],['',`${shiftMonth(month,1)}-05`,'','101','Banco sintético','','',0,20],
 ]),
 'Libro Mayor':xlsx('mayor-sintetico.xlsx',[
 ['Fecha','Documento','Cuenta','Debe','Haber','Saldo'],[`${month}-01`,'Saldo Inicial','Banco sintético',0,0,1000],[`${month}-05`,'Asiento de prueba','Banco sintético',0,10,990],
 ]),
 'Sumas y Saldos':xlsx('saldos-sinteticos.xlsx',[
 ['Código','Cuenta','Saldo Anterior','Débitos','Créditos','Saldo Final','Débitos Ajustados','Créditos Ajustados','Saldo Final Ajustado'],['101','Banco sintético',1000,0,-10,990,0,-10,990],['501','Gastos sintéticos',0,10,0,10,10,0,10],
 ]),
};
test.beforeEach(async({page})=>{await page.addInitScript(s=>{if(!localStorage.getItem('sofia-contable-demo-v1'))localStorage.setItem('sofia-contable-demo-v1',JSON.stringify(s));},seed());});

test('guarda reportes mensuales, cruza, exporta XLS y conserva el lote sin reenviarlo',async({page})=>{
 await page.setViewportSize({width:820,height:1180});
 // Seed once; keep subsequent reloads from replacing persisted test data.
 await page.goto(`/xubio?empresa=${companyId}&mes=${month}`);
 await expect(page.getByText('Respaldos del mes consultados.',{exact:false})).toBeVisible();
 for(const [label,file]of Object.entries(sources)){
  const input=page.getByLabel(label,{exact:true});await expect(input).toBeEnabled();await input.setInputFiles(file);
  await page.getByRole('button',{name:'Guardar reporte mensual',exact:true}).click();
  await expect(page.getByText('Reporte guardado. Podés salir y recuperarlo en esta empresa y mes.',{exact:true})).toBeVisible();
 }
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await expect(page.getByRole('region',{name:'Detalle del Diario por mes'})).toContainText('Asientos en el archivo: 3 · Asientos del mes seleccionado: 1 · Renglones del mes: 2');
 await page.getByRole('checkbox',{name:/Verifiqué la empresa, la moneda ARS/}).check();
 await expect(page.getByText('Cruce habilitado',{exact:true})).toBeVisible();
 const selection=page.getByRole('checkbox',{name:`Confirmar faltante book:${expected}`,exact:true});await expect(selection).toBeEnabled();await selection.check();
 await page.getByLabel('Circuito contable exacto en Xubio').fill('Default');
 await page.getByRole('button',{name:'Guardar revisión y cuentas',exact:true}).click();
 await expect(page.getByText('Revisión de auditoría guardada para continuar después.',{exact:true})).toBeVisible();
 await page.getByRole('checkbox',{name:/Revisé cada faltante seleccionado/}).check();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Generar XLS de faltantes revisados',exact:true}).click()]);
 expect(download.suggestedFilename()).toMatch(/^xubio-asientos-.*\.xls$/);
 const bytes=await readFile(await download.path()),book=read(bytes,{type:'buffer'}),rows=utils.sheet_to_json(book.Sheets[book.SheetNames[0]],{header:1,defval:''}) as unknown[][];
 expect(rows[0]).toEqual(['FECHA','CONCEPTO','CIRCUITOCONTABLE','CUENTA','DEBE','HABER','ORGANIZACION','CENTRODECOSTO','DESCRIPCION']);
 expect(rows).toHaveLength(4);expect(rows[2][4]).toBe('11.00');expect(rows[3][5]).toBe('11.00');
 await expect(page.getByRole('button',{name:/Descargar lote guardado/})).toHaveCount(1);
 await page.reload();await expect(page.getByText('Auditoría y revisión recuperadas para esta empresa y mes.',{exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Lote generado · verificar importación',exact:true})).toBeVisible();
 await expect(page.getByRole('button',{name:'Generar XLS de faltantes revisados',exact:true})).toBeDisabled();
 await expect(page.getByLabel('Circuito contable exacto en Xubio')).toHaveValue('Default');
});

test('un listado de asientos manuales no habilita exportar faltantes',async({page})=>{
 await page.goto(`/xubio?empresa=${companyId}&mes=${month}`);
 await expect(page.getByLabel('Libro Diario / asientos detallados',{exact:true})).toBeEnabled();
 await page.getByLabel('Libro Diario / asientos detallados',{exact:true}).setInputFiles(xlsx('AsientoManual-sintetico.xlsx',[
 ['Fecha','Documento','Concepto',''],[`${month}-05`,'Asiento Manual N° 1','Asiento sintético',''],
 ]));
 await expect(page.getByText('1 asientos sin detalle',{exact:false})).toBeVisible();
 await expect(page.getByText('Este archivo es un listado de asientos sin líneas contables.',{exact:false})).toBeVisible();
 await page.getByRole('checkbox',{name:/Verifiqué la empresa, la moneda ARS/}).check();
 await expect(page.getByRole('button',{name:'Generar XLS de faltantes revisados',exact:true})).toBeDisabled();
});
