import {expect,test} from 'vitest';
import {parseComafiLines,parseComafiRows,comafiTotals,comafiWorksheetCsv,classifyComafi} from './comafi';
import {syntheticComafiRows} from '../../../tests/fixtures/comafi';

const account=(number='0001-00001-1',currency='PESOS')=>[
 `COMAFI PYME CUENTA CORRIENTE BANCARIA EN ${currency}`,
 `Número ${number}`, 'DETALLE DE MOVIMIENTOS',
 '30/09/26 Saldo Anterior 1.234,56', 'SIN MOVIMIENTOS',
 'Saldo al: 31/10/2026 1.234,56',
];
test('Comafi separa cuentas y monedas sin interpretar avisos ni rechazos como pagos',()=>{
 const result=parseComafiLines([...account(),...account('0001-00002-1'),...account('0001-00003-1','DOLARES'),
 'DEBITOS DIRECTOS RECHAZADOS','04/10/26 IMPUESTO IVA 250,00','Adhesiones 13/10/26 100,00']);
 expect(result.month).toBe('2026-10');expect(result.accounts).toHaveLength(3);
 expect(result.accounts.map(a=>a.currency)).toEqual(['ARS','ARS','USD']);
 expect(result.accounts[0]).toMatchObject({opening:'1234.56',closing:'1234.56',opening_on:'2026-09-30',closing_on:'2026-10-31',no_movements:true});
 expect(comafiTotals(result.accounts[0])).toEqual([]);
});
test('no presume cero si el detalle no declara sin movimientos o si solo hay avisos',()=>{
 expect(()=>parseComafiLines(account().filter(l=>l!=='SIN MOVIMIENTOS'))).toThrow(/no contiene movimientos/);
 expect(()=>parseComafiLines(['COMAFI','DEBITOS RECHAZADOS','01/10/26 IVA 100,00'])).toThrow(/No se encontraron/);
});
test('rechaza saldos incoherentes, cuentas repetidas y movimientos dentro de la tabla',()=>{
 expect(()=>parseComafiLines(account().map(l=>l.startsWith('Saldo al:')?'Saldo al: 31/10/2026 1.200,00':l))).toThrow(/saldo final/);
 expect(()=>parseComafiLines([...account(),...account()])).toThrow(/Se repite/);
 const lines=account();lines.splice(4,0,'03/10/26 COMISION 34,56');
 expect(()=>parseComafiLines(lines)).toThrow(/movimiento dentro/);
});


test('lee columnas y continuaciones, verifica saldos y conserva reversos sin inferir ingresos',()=>{
 const result=parseComafiRows(syntheticComafiRows());
 expect(result.month).toBe('2026-09');expect(result.accounts.map(a=>a.movements.length)).toEqual([12,0,0]);
 const a=result.accounts[0];expect(a.movements[0]).toMatchObject({credit:'500.00',debit:'0.00',amount:'500.00',reference:'REF-SINTETICA',balance:'1500.00',category:'transfer'});
 expect(a.movements[1]).toMatchObject({category:'credit_tax',debit:'3.00',credit:'0.00',amount:'-3.00'});
 expect(a.movements[11].category).toBe('other');expect(a.closing).toBe('1260.00');
 expect(comafiTotals(a)).toContainEqual({category:'commission',debit:'10.00',credit:'2.00',net:'8.00'});
 expect(result.accounts[2].currency).toBe('USD');
});

test('no acepta lecturas con saldo intermedio incoherente, columna ausente o monto huérfano',()=>{
 const rows=syntheticComafiRows();const bad=structuredClone(rows);bad.find(r=>r.text.includes('Impuesto a los creditos'))!.items.at(-1)!.text='1.498,00';
 expect(()=>parseComafiRows(bad)).toThrow(/saldo intermedio/);
 expect(()=>parseComafiRows(rows.filter(r=>!r.text.startsWith('Fecha')))).toThrow(/columnas PDF/);
 const missing=structuredClone(rows);missing.splice(missing.findIndex(r=>r.text.includes('REF-SINTETICA')),1);
 expect(()=>parseComafiRows(missing)).toThrow(/sin importe/);
 const period=structuredClone(rows),first=period.find(r=>r.text.includes('Transferencia recibida'))!;first.text='01/10/2026 Transferencia recibida';first.items[0].text='01/10/2026';
 expect(()=>parseComafiRows(period)).toThrow(/Fechas bancarias|mes de cierre/);
});

test('clasifica percepciones y retenciones separadas del IVA, conserva otros y neutraliza CSV',()=>{
 expect(classifyComafi('Percepcion IVA RG 2408')).toBe('vat_perception');expect(classifyComafi('Retencion IVA')).toBe('vat_withholding');
 expect(classifyComafi('SIRCREB')).toBe('iibb_withholding');expect(classifyComafi('Percepcion IIBB')).toBe('iibb_perception');
 expect(classifyComafi('Impuesto desconocido')).toBe('other');
 const r=parseComafiRows(syntheticComafiRows());r.accounts[0].movements[0].description='=CMD()';r.source_sha256='a'.repeat(64);
 const csv=comafiWorksheetCsv(r,'30700000001','prueba.pdf');
 expect(csv).toContain(`"'=CMD()"`);expect(csv).toContain('Clasificación sugerida sin confirmar');expect(csv).toContain('"-3.00"');expect(csv).toContain('a'.repeat(64));
 expect(comafiWorksheetCsv(r,'30700000001','prueba.pdf',true)).toContain('Revisado por usuario');
});
