import {expect,test} from '@playwright/test';
import {coreScenario} from '../fixtures/core';
const month='2026-11',fixture=coreScenario(month),company=fixture.company.id;

test.beforeEach(async({page})=>{const s=structuredClone(fixture.state);s.core!.exercises=[];await page.addInitScript(s=>{if(!localStorage.getItem('sofia-contable-demo-v1'))localStorage.setItem('sofia-contable-demo-v1',JSON.stringify(s));},s);});

test('configura ejercicio, confirma las cinco operaciones, verifica libros y revierte sin borrar',async({page})=>{
 test.setTimeout(90000);await page.setViewportSize({width:820,height:1180});
 await page.goto(`/nucleo?empresa=${company}&mes=${month}`);
 await page.getByRole('button',{name:'Configurar ejercicio',exact:true}).click();let d=page.getByRole('dialog');
 await d.getByLabel('Nombre del ejercicio').fill('Ejercicio sintético 2026');await d.getByLabel('Inicio del ejercicio').fill('2026-01-01');await d.getByLabel('Cierre del ejercicio').fill('2026-12-31');await d.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(d).toHaveCount(0);
 await page.goto(`/diario?empresa=${company}&mes=${month}`);
 for(const op of fixture.operations){
  await page.getByRole('button',{name:'Nuevo asiento',exact:true}).click();d=page.getByRole('dialog');
  await d.getByLabel('Fecha del asiento',{exact:true}).fill(op.date);await d.getByLabel('Concepto del asiento').fill(op.description);
  for(let i=2;i<op.lines.length;i++)await d.getByRole('button',{name:'Agregar línea',exact:true}).click();
  for(const [i,line]of op.lines.entries()){
   await d.getByLabel(`Cuenta línea ${i+1}`,{exact:true}).selectOption(line.account_id);
   if(line.debit!=='0.00')await d.getByLabel(`Debe línea ${i+1}`,{exact:true}).fill(line.debit.replace('.',','));
   if(line.credit!=='0.00')await d.getByLabel(`Haber línea ${i+1}`,{exact:true}).fill(line.credit.replace('.',','));
  }
  if(op.sourceKey==='scenario:0'){
   await d.getByLabel('Subir respaldo del asiento').setInputFiles({name:'respaldo-core-sintetico.csv',mimeType:'text/csv',buffer:Buffer.from('concepto;importe\nAporte ficticio;5000000\n')});
   await expect(d.getByRole('status')).toContainText('Respaldo guardado.');
   await d.getByLabel('Documento adjunto').selectOption({label:'respaldo-core-sintetico.csv'});
  }
  await d.getByRole('button',{name:'Confirmar asiento',exact:true}).click();await expect(d).toHaveCount(0);
 }
 await page.reload();await expect(page.getByRole('table',{name:'Libro Diario'}).locator('tbody tr')).toHaveCount(5);
 await page.getByRole('button',{name:'Ver asiento #1',exact:true}).click();await expect(page.getByRole('dialog').getByRole('link',{name:'Consultar documentación vinculada'})).toBeVisible();await page.getByRole('dialog').getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.getByRole('button',{name:'Ver asiento #2',exact:true}).click();d=page.getByRole('dialog');await expect(d.getByRole('table',{name:'Detalle de asiento'})).toContainText('210.000,00');await d.getByRole('button',{name:'Cerrar',exact:true}).click();
 await page.goto(`/balance?empresa=${company}&mes=${month}`);
 const balance=page.getByRole('table',{name:'Balance de sumas y saldos'});
 await expect(balance.getByRole('row').filter({hasText:'Banco de prueba'})).toContainText('4.427.000,00');
 await expect(balance.getByRole('row').filter({hasText:'Deudores por servicios'})).toContainText('1.420.000,00');
 await expect(balance.getByRole('row').filter({hasText:'IVA crédito fiscal'})).toContainText('273.000,00');
 await expect(balance.getByRole('row').filter({hasText:'IVA débito fiscal'})).toContainText('420.000,00');
 await expect(balance.locator('tfoot')).toContainText('9.993.000,00');await expect(balance.locator('tfoot')).toContainText('7.420.000,00');
 await expect(page.getByText('Diario, Mayor y sumas/saldos coinciden en el alcance.',{exact:true})).toBeVisible();
 const [csv]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Descargar sumas y saldos CSV'}).click()]);expect(csv.suggestedFilename()).toMatch(/vigia-sumas-saldos/);
 for(const width of [1440,390,820]){await page.setViewportSize({width,height:1180});expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);}
 await page.screenshot({path:'/tmp/vigia-balance-ipad.png'});
 await page.goto(`/mayor?empresa=${company}&mes=${month}`);await page.getByLabel('Cuenta del Mayor').selectOption(fixture.accounts[0].id);
 const mayor=page.getByRole('table',{name:'Libro Mayor'});await expect(mayor.locator('tbody tr')).toHaveCount(4);await expect(mayor.locator('tbody tr').last()).toContainText('4.427.000,00');
 await page.goto(`/diario?empresa=${company}&mes=${month}`);await page.getByRole('button',{name:'Revertir #5',exact:true}).click();d=page.getByRole('dialog');await d.getByLabel('Fecha de reversión').fill('2026-11-06');await d.getByLabel('Motivo de reversión').fill('Corrección de prueba trazable');await d.getByRole('button',{name:'Confirmar reversión'}).click();await expect(d).toHaveCount(0);await expect(page.getByRole('table',{name:'Libro Diario'}).locator('tbody tr')).toHaveCount(6);await expect(page.getByText('Con reversión vinculada',{exact:true})).toBeVisible();await page.reload();await expect(page.getByRole('table',{name:'Libro Diario'}).locator('tbody tr')).toHaveCount(6);
});

test('el plan conserva sus datos y guarda rubro, naturaleza y equivalencia sin duplicar cuentas',async({page})=>{
 await page.goto(`/cuentas?empresa=${company}&mes=${month}`);await page.getByRole('button',{name:'Propiedades de Banco de prueba',exact:true}).click();const d=page.getByRole('dialog');await d.getByLabel('Rubro',{exact:true}).fill('Disponibilidades');await d.getByLabel('Subrubro',{exact:true}).fill('Banco operativo');await d.getByLabel('Código equivalente en Xubio').fill('1.1.01');await d.getByRole('button',{name:'Guardar cambios',exact:true}).click();await expect(d).toHaveCount(0);await page.reload();const row=page.getByRole('table',{name:'Plan permanente'}).getByRole('row').filter({hasText:'Banco de prueba'});await expect(row).toContainText('Disponibilidades');await expect(row).toContainText('1.1.01');await expect(page.getByRole('table',{name:'Plan permanente'}).locator('tbody tr')).toHaveCount(9);
});

test('una migración ausente no simula libros disponibles ni impide consultar comprobantes existentes',async({page})=>{
 await page.goto(`/nucleo?empresa=${company}&mes=${month}`);await page.evaluate(()=>{const key='sofia-contable-demo-v1',s=JSON.parse(localStorage.getItem(key)!);s.core.ready=false;localStorage.setItem(key,JSON.stringify(s));});await page.reload();await expect(page.getByText('El núcleo contable requiere activar la migración de base de datos.',{exact:false})).toBeVisible();await expect(page.getByRole('button',{name:'Configurar ejercicio',exact:true})).toHaveCount(0);await page.goto(`/comprobantes?empresa=${company}&mes=${month}`);await expect(page.getByRole('heading',{name:'Compras y ventas',exact:true})).toBeVisible();await expect(page.getByRole('button',{name:'Nuevo comprobante',exact:true})).toBeEnabled();
});
