import {expect,test} from 'vitest';
import {parseComafiLines} from './comafi';

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
 expect(result.bankTaxes).toBe('0.00');
});
test('no presume cero si el detalle no declara sin movimientos o si solo hay avisos',()=>{
 expect(()=>parseComafiLines(account().filter(l=>l!=='SIN MOVIMIENTOS'))).toThrow(/contiene movimientos/);
 expect(()=>parseComafiLines(['COMAFI','DEBITOS RECHAZADOS','01/10/26 IVA 100,00'])).toThrow(/No se encontraron/);
});
test('rechaza saldos incoherentes, cuentas repetidas y movimientos dentro de la tabla',()=>{
 expect(()=>parseComafiLines(account().map(l=>l.startsWith('Saldo al:')?'Saldo al: 31/10/2026 1.200,00':l))).toThrow(/saldos difieren/);
 expect(()=>parseComafiLines([...account(),...account()])).toThrow(/Se repite/);
 const lines=account();lines.splice(4,0,'03/10/26 COMISION 34,56');
 expect(()=>parseComafiLines(lines)).toThrow(/movimiento dentro/);
});
