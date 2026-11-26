import {expect,test} from '@playwright/test';
import {utils,write} from 'xlsx';
import {todayIn} from '../../src/lib/workspace/format';

test('importa el formato recibido ARCA y rechaza el CUIT de otra empresa',async({page})=>{
 const month=todayIn().slice(0,7);
 function file(cuit:string){
  const book=utils.book_new();utils.book_append_sheet(book,utils.aoa_to_sheet([
   [`Mis Comprobantes Recibidos - CUIT ${cuit}`],
   ['Fecha','Tipo','Punto de Venta','Número Desde','Número Hasta','Nro. Doc. Emisor','Denominación Emisor','Tipo Cambio','Moneda','Neto Gravado Total','Neto No Gravado','Op. Exentas','Otros Tributos','Total IVA','IVA 21%','Imp. Total'],
   [`${month}-05`,'1 - Factura A',1,9786,9786,'30711111111','Proveedor sintético ARCA',1,'$',100,0,0,0,21,21,121],
  ]),'Recibidos');
  return {name:'arca-sintetico.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(write(book,{type:'array',bookType:'xlsx',compression:true}))};
 }
 await page.goto(`/preparacion?empresa=10000000-0000-4000-8000-000000000010&mes=${month}&tipo=compras`);
 const panel=page.getByRole('region',{name:'Importar datos'}),input=panel.locator('input[type=file]');
 await input.setInputFiles(file('30700000001'));
 await expect(panel.getByText('Proveedor sintético ARCA',{exact:true})).toBeVisible();
 await panel.getByRole('checkbox',{name:'Verifiqué la asignación y los datos del archivo'}).check();
 await panel.getByRole('button',{name:'Confirmar importación'}).click();
 await expect(panel.getByText('El CUIT del archivo ARCA no coincide con la empresa seleccionada.')).toBeVisible();
 await input.setInputFiles(file('30719990017'));
 await panel.getByRole('checkbox',{name:'Verifiqué la asignación y los datos del archivo'}).check();
 await panel.getByRole('button',{name:'Confirmar importación'}).click();
 await expect(panel.getByText('Se guardó 1 fila. Se omitieron 0 duplicados.')).toBeVisible();
});
