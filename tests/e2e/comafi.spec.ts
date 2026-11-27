import {expect,test} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';
import {readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {syntheticComafiPdf} from '../fixtures/comafi';
import {todayIn} from '../../src/lib/workspace/format';

// PDF de texto íntegramente sintético, sin fuentes ni documentos de clientes.
function pdf(movements=false){
 const lines=['COMAFI PYME CUENTA CORRIENTE BANCARIA EN PESOS','Nro. 0001-00001-1','DETALLE DE MOVIMIENTOS','30/09/26 Saldo Anterior 1.234,56',...(movements?['03/10/26 COMISION 10,00']:['SIN MOVIMIENTOS']),`Saldo al: 31/10/2026 ${movements?'1.224,56':'1.234,56'}`,'DEBITOS DIRECTOS RECHAZADOS','04/10/26 IVA 100,00'];
 const stream=lines.map((line,i)=>`BT /F1 10 Tf 30 ${760-i*20} Td (${line}) Tj ET`).join('\n');
 const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 600 800] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`];
 let result='%PDF-1.4\n';const offsets=[0];
 for(const [i,object] of objects.entries()){offsets.push(Buffer.byteLength(result));result+=`${i+1} 0 obj\n${object}\nendobj\n`;}
 const xref=Buffer.byteLength(result);result+=`xref\n0 6\n0000000000 65535 f \n${offsets.slice(1).map(n=>`${String(n).padStart(10,'0')} 00000 n \n`).join('')}trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`;
 return {name:'comafi-sintetico.pdf',mimeType:'application/pdf',buffer:Buffer.from(result)};
}

test('lee PDF Comafi en tablet y no presume impuestos cero en un formato con movimientos',async({page})=>{
 await page.setViewportSize({width:820,height:1180});
 await page.goto('/preparacion?empresa=10000000-0000-4000-8000-000000000011&tipo=banco');
 const input=page.getByLabel('Resumen Comafi en PDF');
 await input.setInputFiles(pdf());await page.getByRole('button',{name:'Analizar PDF Comafi',exact:true}).click();
 await expect(page.getByRole('heading',{name:'Resultado de lectura · Octubre de 2026'})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Sin movimientos',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'ARS',exact:true})).toBeVisible();
 await expect(page.getByText('El resumen corresponde a otro mes.',{exact:false})).toBeVisible();
 await page.getByRole('checkbox',{name:'Revisé que el resumen corresponde a esta empresa, las clasificaciones y los importes'}).check();
 await expect(page.getByRole('button',{name:'Guardar PDF y papel bancario',exact:true})).toBeDisabled();
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await input.setInputFiles(pdf(true));await page.getByRole('button',{name:'Analizar PDF Comafi',exact:true}).click();
 await expect(page.getByRole('main').getByRole('alert')).toContainText('movimiento dentro del detalle');
 await expect(page.getByRole('heading',{name:/Resultado de lectura/})).toHaveCount(0);
});

test('analiza PDF de texto en el portable sin red',async({page,context},testInfo)=>{
 const builtFile=testInfo.outputPath('Sofia-demo.html');
 await promisify(execFile)(process.execPath,['portable/build.mjs',builtFile]);
 await context.setOffline(true);await page.goto(pathToFileURL(builtFile).href);
 await page.evaluate(()=>{location.hash='/preparacion?empresa=10000000-0000-4000-8000-000000000011&tipo=banco';});
 await page.getByLabel('Resumen Comafi en PDF').setInputFiles(pdf());
 await page.getByRole('button',{name:'Analizar PDF Comafi',exact:true}).click();
 await expect(page.getByRole('cell',{name:'Sin movimientos',exact:true})).toBeVisible();
});

test('revisa movimientos, corrige clasificación y conserva PDF y papel en la empresa',async({page})=>{
 const month=todayIn().slice(0,7),company='10000000-0000-4000-8000-000000000011';
 await page.setViewportSize({width:820,height:1180});
 await page.goto(`/preparacion?empresa=${company}&mes=${month}&tipo=banco`);
 const file=syntheticComafiPdf(month);
 await page.getByLabel('Resumen Comafi en PDF').setInputFiles(file);
 await page.getByRole('button',{name:'Analizar PDF Comafi',exact:true}).click();
 await expect(page.getByRole('cell',{name:'12 movimientos · saldos verificados',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'Impuesto a los créditos',exact:true})).toBeVisible();
 await expect(page.getByRole('cell',{name:'IVA bancario · alícuota general',exact:true})).toBeVisible();
 const save=page.getByRole('button',{name:'Guardar PDF y papel bancario',exact:true});
 await expect(save).toBeDisabled();
 await page.getByText('Revisar 12 movimientos y su clasificación',{exact:true}).click();
 const review=page.getByRole('checkbox',{name:'Revisé que el resumen corresponde a esta empresa, las clasificaciones y los importes'});
 await review.check();await expect(save).toBeEnabled();
 await page.getByLabel(/Clasificación COMAFI:.*:12$/).selectOption('stamp_tax');
 await expect(review).not.toBeChecked();await expect(save).toBeDisabled();
 await review.check();
 const [download]=await Promise.all([page.waitForEvent('download'),page.getByRole('button',{name:'Descargar papel bancario CSV'}).click()]);
 const csv=await readFile(await download.path(),'utf8');expect(csv).toContain('Revisado por usuario');expect(csv).toContain('sha256_original');expect(csv).toContain('comafi-movimientos-sinteticos.pdf');
 expect(csv).toContain(createHash('sha256').update(file.buffer).digest('hex'));expect(csv).toContain('sin_movimientos');
 expect(csv).not.toContain('rechazo no contabilizado');
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
 await save.click();await expect(page.getByText('PDF original y papel bancario guardados en Documentación de esta empresa y mes.')).toBeVisible();
 await page.reload();await expect(page.getByRole('main').getByText(file.name,{exact:true})).toBeVisible();
 await page.getByRole('link',{name:'Volver a la empresa',exact:true}).click();
 await page.getByRole('link',{name:'Comenzar preparación del mes',exact:true}).click();
 await page.getByRole('link',{name:'3. Resumen bancario',exact:true}).click();
 await page.getByRole('button',{name:`Abrir análisis ${file.name}`,exact:true}).click();
 await expect(page.getByText('Trabajo recuperado del PDF y del papel bancario guardados.',{exact:true})).toBeVisible();
 await page.getByText('Revisar 12 movimientos y su clasificación',{exact:true}).click();
 await expect(page.getByLabel(/Clasificación COMAFI:.*:12$/)).toHaveValue('stamp_tax');
 await expect(page.getByRole('button',{name:'PDF y papel guardados',exact:true})).toBeDisabled();
 // A correction after reopening saves a new paper, without uploading the original again.
 await page.getByLabel(/Clasificación COMAFI:.*:12$/).selectOption('other');
 await page.getByRole('checkbox',{name:'Revisé que el resumen corresponde a esta empresa, las clasificaciones y los importes'}).check();
 await page.getByRole('button',{name:'Guardar PDF y papel bancario',exact:true}).click();
 await expect(page.getByRole('button',{name:'PDF y papel guardados',exact:true})).toBeDisabled();
 await page.reload();
 await expect(page.getByRole('region',{name:'Extractos guardados'}).getByRole('button',{name:/Abrir análisis /})).toHaveCount(1);
 await page.getByRole('button',{name:`Abrir análisis ${file.name}`,exact:true}).click();
 await page.getByText('Revisar 12 movimientos y su clasificación',{exact:true}).click();
 await expect(page.getByLabel(/Clasificación COMAFI:.*:12$/)).toHaveValue('other');
 await page.getByRole('link',{name:'Ver respaldos del mes'}).click();
 await page.getByRole('button',{name:'Archivos',exact:true}).click();
 const papers=page.getByRole('button',{name:`Descargar comafi-${month}-papel-bancario.csv`});
 await expect(papers).toHaveCount(2);
 const [stored]=await Promise.all([page.waitForEvent('download'),papers.first().click()]);
 expect(await readFile(await stored.path(),'utf8')).toContain('Revisado por usuario');
 await page.goto(`/documentacion?empresa=10000000-0000-4000-8000-000000000010&mes=${month}`);
 await page.getByRole('button',{name:'Archivos',exact:true}).click();
 await expect(page.getByRole('button',{name:`Descargar comafi-${month}-papel-bancario.csv`})).toHaveCount(0);
});
