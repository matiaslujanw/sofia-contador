import {expect,test} from 'vitest';
import {parseComafiRows,comafiWorksheetCsv} from './comafi';
import {restoreComafiWorksheet} from './comafi-restore';
import {syntheticComafiRows} from '../../../tests/fixtures/comafi';
const original=()=>({...parseComafiRows(syntheticComafiRows()),source_sha256:'a'.repeat(64)});
test('recupera clasificación revisada sin reemplazar importes ni generar asientos',async()=>{
 const changed=original();changed.accounts[0].movements[11].category='stamp_tax';
 const file=new File([comafiWorksheetCsv(changed,'30700000001','original.pdf',true)],'papel.csv');
 const restored=await restoreComafiWorksheet(original(),'30700000001','original.pdf',file);
 expect(restored.reviewed).toBe(true);expect(restored.result.accounts[0].movements[11].category).toBe('stamp_tax');expect(restored.result.accounts[0].closing).toBe('1260.00');
});
test('rechaza un papel de otra empresa, PDF o importes alterados',async()=>{
 const csv=comafiWorksheetCsv(original(),'30700000001','original.pdf',true),file=(s:string)=>new File([s],'papel.csv');
 await expect(restoreComafiWorksheet(original(),'30700000002','original.pdf',file(csv))).rejects.toThrow(/no coincide/);
 await expect(restoreComafiWorksheet({...original(),source_sha256:'b'.repeat(64)},'30700000001','original.pdf',file(csv))).rejects.toThrow(/no coincide/);
 await expect(restoreComafiWorksheet(original(),'30700000001','original.pdf',file(csv.replace('"-3.00"','"-4.00"')))).rejects.toThrow(/no coincide/);
});
