import {expect,test} from '@playwright/test';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {pathToFileURL} from 'node:url';

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
