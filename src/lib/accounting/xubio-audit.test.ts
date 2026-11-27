import {expect,test} from 'vitest';
import {utils,write} from 'xlsx';
import {createDemoWorkspace} from '@/lib/workspace/demo';
import type {Account} from '@/lib/workspace/model';
import type {SourceTable} from '@/lib/imports';
import {pair} from './engine';
import {parseXubioReport,readXubioReport,journalEntries,auditXubio,exportAuditRecords,makeCandidates,emptyAuditMapping,type Candidate,type XubioReport} from './xubio-audit';
import {auditSettingsCsv,restoreAuditSettings,auditManifestCsv,auditExportHistory} from './audit-archive';
import {xubioWorkbook,xubioRows} from './xubio';
import {digest} from './xubio-audit';
const state=createDemoWorkspace('2026-09'),company=state.companies[0],period=state.periods.find(p=>p.company_id===company.id&&p.status==='open')!;
const accounts:Account[]=[['00000000-0000-4000-8000-000000000001','101','Banco sintético','asset'],['00000000-0000-4000-8000-000000000002','501','Comisiones sintéticas','expense']].map(([id,code,name,kind])=>({id,code,name,kind:kind as Account['kind'],organization_id:company.organization_id,company_id:company.id,parent_code:null,category:null,status:'active'}));
function table(rows:(string|number)[][]):SourceTable{return {headers:rows[0].map(String),rows:rows.slice(1).map((r,i)=>({row:i+2,cells:r.map(String),numericCells:r.flatMap((v,j)=>typeof v==='number'?[j]:[])}))};}
const report=(kind:XubioReport['kind'],rows:(string|number)[][])=>parseXubioReport(kind,table(rows));
function reports(amount=0){return {diario:report('diario',[
 ['Fecha','Documento','Código','Cuenta','Debe','Haber'],
 ['05/09/2026','Asiento sintético','501','Comisiones sintéticas',amount,0],['05/09/2026','Asiento sintético','101','Banco sintético',0,amount],
 ]),mayor:report('mayor',[['Fecha','Documento','Cuenta','Debe','Haber','Saldo'],['31/08/2026','Saldo Inicial','Banco sintético',0,0,0],['05/09/2026','Asiento sintético','Banco sintético',0,amount,-amount]]),saldos:report('saldos',[
 ['Código','Cuenta','Saldo Anterior','Débitos','Créditos','Saldo Final','Débitos Ajustados','Créditos Ajustados','Saldo Final Ajustado'],
 ['501','Comisiones sintéticas',0,amount,0,amount,amount,0,amount],['101','Banco sintético',0,0,-amount,-amount,0,-amount,-amount],
 ])};}
const candidate=(id='expected',amount=10,date='2026-09-06'):Candidate=>({id,date,description:'Comisión sintética',reference:id,currency:'ARS',source:'bank',bankKey:'test',lines:pair(accounts[1].id,accounts[0].id,BigInt(amount)*100n),blocked:[]});

test('reconoce un listado manual sin detalle y el Mayor de una cuenta con rango de varios meses',()=>{
 const summary=report('diario',[['Fecha','Documento','Concepto',''],[46283,'Asiento Manual N° 3','Concepto sintético','']]);
 expect(summary.mode).toBe('summary');expect(summary.warnings[0]).toContain('sin líneas');
 const mayor=report('mayor',[['Fecha','Documento','Cuenta','Debe','Haber','Saldo'],['31/12/2025','Saldo Inicial','Banco sintético',0,0,0],['18/09/2026','Asiento Manual N° 3','Banco sintético',0,100,-100],['28/10/2026','Comprobante sintético','Banco sintético',0,50,-150]]);
 expect(mayor.errors).toEqual([]);expect(mayor.accounts).toHaveLength(1);expect(mayor.dates.at(-1)).toBe('2026-10-28');
 const audited=auditXubio([candidate()],{...reports(10),diario:summary},accounts,'2026-09',true);expect(audited.ready).toBe(false);
 expect(()=>exportAuditRecords(audited,new Set(['expected']),company,period.id,accounts,'2026-09')).toThrow(/incompleta/);
});

test('normaliza créditos firmados en Sumas y Saldos sin cambiar el signo de su saldo',()=>{
 const r=reports(10).saldos;expect(r.errors).toEqual([]);expect(r.balances[1]).toMatchObject({credit:'10.00',closing:'-10.00',adjustedCredit:'10.00',valid:true});
});

test('exige Diario completo, saldos coherentes, cuentas conocidas y confirmación de alcance',()=>{
 expect(auditXubio([candidate()],reports(10),accounts,'2026-09',false).ready).toBe(false);
 const r=reports(10);r.saldos.balances[0].debit='11.00';expect(auditXubio([candidate()],r,accounts,'2026-09',true).ready).toBe(false);
 const bad=reports(10);bad.diario.lines[0].code='BAD';expect(auditXubio([candidate()],bad,accounts,'2026-09',true).ready).toBe(false);
 const unbalanced=reports(10);unbalanced.diario.lines[0].debit='9.00';expect(auditXubio([candidate()],unbalanced,accounts,'2026-09',true).ready).toBe(false);
});

test('distingue coincidencia, otra fecha, multiplicidad y un asiento agrupado',()=>{
 const exact=candidate('a',10,'2026-09-05');expect(auditXubio([exact],reports(10),accounts,'2026-09',true).findings[0].status).toBe('matched');
 expect(auditXubio([candidate()],reports(10),accounts,'2026-09',true).findings[0].status).toBe('ambiguous');
 expect(auditXubio([exact,{...exact,id:'b'}],reports(10),accounts,'2026-09',true).findings.map(f=>f.status)).toEqual(['ambiguous','ambiguous']);
 const grouped=auditXubio([candidate('a',10),candidate('b',20)],reports(30),accounts,'2026-09',true);expect(grouped.findings.every(f=>f.status==='ambiguous')).toBe(true);
 const invoices=[{...candidate('a',10),source:'voucher' as const,voucher:state.vouchers[0]},{...candidate('b',20),source:'voucher' as const,voucher:state.vouchers[0]}];expect(auditXubio(invoices,reports(30),accounts,'2026-09',true).findings.every(f=>f.status==='ambiguous')).toBe(true);
});

test('exporta solo faltantes elegibles y bloquea repetidos, otra moneda o empresa',async()=>{
 const ready=auditXubio([candidate('a',11)],reports(10),accounts,'2026-09',true);expect(ready.ready).toBe(true);expect(ready.findings[0].status).toBe('missing');
 const records=exportAuditRecords(ready,new Set(['a']),company,period.id,accounts,'2026-09');const bytes=await xubioWorkbook(records,accounts,[],'Default');expect(bytes.byteLength).toBeGreaterThan(1000);expect(await digest(await xubioWorkbook(records,accounts,[],'Default'))).toBe(await digest(bytes));
 expect(()=>exportAuditRecords(ready,new Set(['a']),company,period.id,accounts.map(a=>({...a,company_id:'other'})),'2026-09')).toThrow(/fuera/);
 const prior=auditXubio([candidate('a',11)],reports(10),accounts,'2026-09',true,new Set(['a']));expect(prior.findings[0].status).toBe('exported');expect(()=>exportAuditRecords(prior,new Set(['a']),company,period.id,accounts,'2026-09')).toThrow(/solamente/);
 const wrong=structuredClone(ready);wrong.findings[0].candidate.currency='USD';expect(()=>exportAuditRecords(wrong,new Set(['a']),company,period.id,accounts,'2026-09')).toThrow(/fuera/);
});

test('prepara desde el libro y evita sumar otra propuesta de comprobante ya contabilizado',()=>{
 const s={...state,accounts,vouchers:[],bookRecords:[{id:'book-id',company_id:company.id,organization_id:company.organization_id,period_id:period.id,payload:{kind:'journal' as const,date:'2026-09-06',description:'Cargo sintético',reference:'REF',currency:'ARS',document_id:null,source_key:'manual',lines:pair(accounts[1].id,accounts[0].id,100n)}}]};
 expect(makeCandidates(s,company,period.id,emptyAuditMapping,[])).toHaveLength(1);
 expect(makeCandidates(s,{...company,id:'another'},period.id,emptyAuditMapping,[])).toEqual([]);
});

test('recupera revisión/circuito y comprueba empresa, huella y XLS del historial antes de bloquear reenvíos',async()=>{
 const hash='a'.repeat(64),mapping={...emptyAuditMapping,bank:{test:accounts[0].id},categories:{commission:accounts[1].id}};
 const file=new File([auditSettingsCsv(company,'2026-09',hash,mapping,true,new Set(['x']),'Default')],'revision.csv');
 expect(()=>auditSettingsCsv(company,'2026-09',hash,mapping,true,new Set(Array.from({length:5000},(_,i)=>String(i))))).toThrow(/máximo/);
 const restored=await restoreAuditSettings(file,company,'2026-09',hash);expect(restored.mapping).toEqual(mapping);expect(restored.circuit).toBe('Default');expect(restored.selected.has('x')).toBe(true);
 await expect(restoreAuditSettings(file,company,'2026-09','b'.repeat(64))).rejects.toThrow(/fuentes/);
 await expect(restoreAuditSettings(file,{...company,id:'another'},'2026-09',hash)).rejects.toThrow(/empresa/);
 const bytes=new Uint8Array([1,2,3]),xlsName='xubio-asientos-2026-09-aaaaaaaaaaaaaaaa.xls',manifest=new File([auditManifestCsv(company,'2026-09',hash,xlsName,await digest(bytes.buffer),new Set(['x']))],'xubio-lote-2026-09-aaaaaaaaaaaaaaaa.csv');
 const docs=[{id:'csv',name:manifest.name},{id:'xls',name:xlsName}].map(d=>({...d,company_id:company.id,organization_id:company.organization_id,period_id:period.id,category:'Papeles de trabajo',created_at:'2026-09-30',storage_path:d.id,mime_type:'',size_bytes:1}));
 const history=await auditExportHistory(docs,async d=>d.id==='csv'?manifest:new File([bytes],xlsName),company,'2026-09',period.id);expect(history.ids.has('x')).toBe(true);
 await expect(auditExportHistory(docs,async d=>d.id==='csv'?manifest:new File(['changed'],xlsName),company,'2026-09',period.id)).rejects.toThrow(/huella/);
});


test('un comprobante aprobado propone IVA/proveedor y conserva la organización; IVA parcial requiere asiento revisado',()=>{
 const supplier:Account={...accounts[0],id:'00000000-0000-4000-8000-000000000004',code:'201',name:'Proveedores sintéticos',kind:'liability'};
 const vat:Account={...accounts[0],id:'00000000-0000-4000-8000-000000000005',code:'102',name:'IVA crédito sintético'};
 const plan=[...accounts,supplier,vat],v={...state.vouchers[0],account_id:accounts[1].id,taxable:'100.00',untaxed:'0.00',exempt:'0.00',vat:'21.00',other_taxes:'0.00',total:'121.00',deductible_vat:'21.00',review_status:'approved' as const,cost_center:null};
 const s={...state,accounts:plan,vouchers:[v],bookRecords:[]};const mapping={...emptyAuditMapping,purchaseVat:vat.id,suppliers:supplier.id};
 const c=makeCandidates(s,company,period.id,mapping,[]);expect(c).toHaveLength(1);expect(c[0].blocked).toEqual([]);expect(c[0].lines.reduce((n,l)=>n+Number(l.debit)-Number(l.credit),0)).toBe(0);
 const ready=auditXubio(c,reports(10),plan,'2026-09',true);const records=exportAuditRecords(ready,new Set([c[0].id]),company,period.id,plan,'2026-09');
 const output=xubioRows(records,plan,[v],'Default');expect(output.some(row=>row[3]===supplier.name&&row[6]===v.counterparty_name)).toBe(true);
 expect(makeCandidates({...s,vouchers:[{...v,deductible_vat:'10.00'}]},company,period.id,mapping,[])[0].blocked.join(' ')).toContain('IVA no computable/parcial');
 expect(makeCandidates({...s,vouchers:[{...v,deductible_vat:null}]},company,period.id,mapping,[])[0].blocked.join(' ')).toContain('Definí el IVA computable');
});

test('una misma salida de banco con otra imputación queda en duda, no como faltante exportable',()=>{
 const alternate={...accounts[1],id:'00000000-0000-4000-8000-000000000099',code:'599',name:'Otra imputación sintética'};
 const c={...candidate('other',11,'2026-09-05'),lines:pair(alternate.id,accounts[0].id,1100n)};
 const result=auditXubio([c],reports(11),[...accounts,alternate],'2026-09',true);
 expect(result.findings[0].status).toBe('ambiguous');expect(result.findings[0].evidence.join(' ')).toContain('imputación');
 expect(()=>exportAuditRecords(result,new Set(['other']),company,period.id,[...accounts,alternate],'2026-09')).toThrow(/solamente/);
});


test('lee Diario nativo N° y Documento/Concepto, conserva la cabecera y separa meses',async()=>{
 const rows=[['N°','Fecha','Documento/Concepto','Código','Cuenta','Año','Mes','Debe','Haber',''],
 ['1',46177,'Ejemplo de junio','501','Comisiones sintéticas','2026','Junio',30,'',''],['',46177,'','101','Banco sintético','2026','Junio','',30,''],
 ['2',46270,'Cargo de prueba','501','Comisiones sintéticas','2026','Septiembre',10,'',''],['2',46270,'','101','Banco sintético','2026','Septiembre','',10,''],
 ['3',46300,'Ejemplo de octubre','501','Comisiones sintéticas','2026','Octubre',20,'',''],['',46300,'','101','Banco sintético','2026','Octubre','',20,'']];
 // Use actual Excel date cell formats; the sample is entirely synthetic.
 const sheet=utils.aoa_to_sheet(rows);for(let row=1;row<rows.length;row++)sheet[utils.encode_cell({r:row,c:1})].z='dd/mm/yyyy';
 const book=utils.book_new();utils.book_append_sheet(book,sheet,'Diario');
 const result=await readXubioReport('diario',new File([write(book,{type:'array',bookType:'xlsx',compression:true})],'diario-sintetico.xlsx'));
 expect(result.errors).toEqual([]);const entries=journalEntries(result);expect(entries).toHaveLength(3);expect(entries.every(e=>e.balanced)).toBe(true);
 expect(result.lines[3].document).toBe('2 · Cargo de prueba');expect(result.lines[3].description).toBe('Cargo de prueba');
 expect(result.lines[3].entry).toBe(result.lines[2].entry);
 expect(entries.filter(e=>e.date.startsWith('2026-09'))).toHaveLength(1);
 const audit=auditXubio([], {...reports(10),diario:result},accounts,'2026-09',true);expect(audit.groups).toHaveLength(1);expect(audit.ready).toBe(true);
});

test('observa errores de cabecera y balance antes de cruzar el Diario con otros reportes',()=>{
 const header=['N°','Fecha','Documento/Concepto','Código','Cuenta','Debe','Haber'];
 const valid=[['1','2026-09-05','Asiento de prueba','501','Comisiones sintéticas',10,0],['','2026-09-05','','101','Banco sintético',0,10]];
 expect(report('diario',[header,...valid]).errors).toEqual([]);
 const wrong=structuredClone(valid);wrong[1][6]=9;expect(report('diario',[header,...wrong]).errors.join(' ')).toContain('desbalanceados');
 const date=structuredClone(valid);date[1][1]='2026-09-06';expect(report('diario',[header,...date]).errors.join(' ')).toContain('Nueva fecha');
 const reference=structuredClone(valid);reference[1][0]='1';reference[1][2]='Otro documento';expect(report('diario',[header,...reference]).errors.join(' ')).toContain('Número repetido');
});
