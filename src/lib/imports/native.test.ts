import {expect,test} from 'vitest';
import {utils,write} from 'xlsx';
import {readSource,suggestMapping,previewImport} from './index';

async function workbook(rows:(string|number)[][]){const book=utils.book_new();utils.book_append_sheet(book,utils.aoa_to_sheet(rows),'Datos');return readSource(write(book,{type:'array',bookType:'xlsx',compression:true}),'sintetico.xlsx');}

test('Xubio conserva códigos y nombres; deriva rubro de Categoría y alerta por códigos faltantes',async()=>{
 const rows=[['Código','Nombre','Rama','Categoría','CBU','Tipo de Cuenta','Banco Asociado','Activo'],['01','Caja de prueba','Sin rama','Activo Corriente > Caja','','Cuenta Corriente','','Si'],['','Comisiones sintéticas','Sin rama','Egresos > Gastos bancarios','','','','No'],['02','Costo de prueba','Sin rama','Egresos > Costo de los Bienes Vendidos y servicios Prestados','','','','Si']];
 const table=await workbook(rows),preview=previewImport('accounts',table,suggestMapping('accounts',table.headers),{month:'2026-10'});
 expect(preview.issues.filter(i=>i.severity==='error')).toEqual([]);
 expect(preview.issues.filter(i=>i.severity==='warning')).toHaveLength(1);
 expect(preview.accounts[0]).toMatchObject({code:'01',name:'Caja de prueba',kind:'asset',status:'active'});
 expect(preview.accounts[1]).toMatchObject({code:expect.stringMatching(/^SIN-CODIGO-[0-9a-f]{16}$/),kind:'expense',status:'inactive'});
 expect(preview.accounts[2].kind).toBe('cost');
 const again=await workbook([rows[0],rows[2]]);
 expect(again.rows[0].cells[0]).toBe(preview.accounts[1].code);
});

test('ARCA reconoce título, CUIT propietario, tipos numéricos e IVA y bloquea dirección incorrecta',async()=>{
 const table=await workbook([
 ['Mis Comprobantes Recibidos - CUIT 30700000001'],
 ['Fecha','Tipo','Punto de Venta','Número Desde','Número Hasta','Nro. Doc. Emisor','Denominación Emisor','Tipo Cambio','Moneda','Neto Gravado Total','Neto No Gravado','Op. Exentas','Otros Tributos','Total IVA','IVA 21%','Imp. Total'],
 ['05/10/2026','1 - Factura A',1,10,10,'30711111111','Proveedor sintético',1,'$',100,0,0,0,21,21,121],
 ]);
 expect(table).toMatchObject({source:'arca',owner_cuit:'30700000001',direction:'purchases'});
 const preview=previewImport('purchases',table,suggestMapping('purchases',table.headers),{month:'2026-10'});
 expect(preview.issues).toEqual([]);
 expect(preview.vouchers[0]).toMatchObject({receipt_type:'001',currency:'ARS',taxable:'100.00',vat:'21.00',total:'121.00',vat_breakdown:{'21':'21.00'}});
 expect(table.rows[0].row).toBe(3);
 const wrong=previewImport('sales',table,suggestMapping('sales',table.headers),{month:'2026-10'});
 expect(wrong.issues).toContainEqual(expect.objectContaining({field:'direction',severity:'error'}));
 expect(wrong.vouchers).toEqual([]);
});
