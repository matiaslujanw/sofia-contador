import {expect,test} from 'vitest';
import {createDemoWorkspace} from '@/lib/workspace/demo';
import type {Account,Task} from '@/lib/workspace/model';
import type {BookValues} from './model';
import {emptyAuditMapping} from './xubio-audit';
import {reviewAccountingMonth,monthlyAuditCsv,type MonthlyAuditInput} from './monthly-audit';
import {pair} from './engine';

function setup():MonthlyAuditInput{
 const state=createDemoWorkspace('2026-09'),company=state.companies[0];
 state.tasks=[];state.vouchers=[];state.bookRecords=[];
 state.accounts=[{id:'bank',code:'101',name:'Banco sintético',kind:'asset'},{id:'expense',code:'501',name:'Gasto sintético',kind:'expense'}].map(a=>({...a,kind:a.kind as Account['kind'],company_id:company.id,organization_id:company.organization_id,status:'active',parent_code:null,category:null}));
 return {state,company,month:'2026-09',reports:{},audit:{ready:false,findings:[],issues:['Faltan reportes'],groups:[]},banks:[],mapping:{...emptyAuditMapping,bank:{'1234':'bank'},categories:{}},coverage:false,selected:new Set()};
}
function addTask(i:MonthlyAuditInput,title:string,status:Task['status']){
 const period=i.state.periods.find(p=>p.company_id===i.company.id&&p.month.startsWith(i.month))!;
 const template=createDemoWorkspace(i.month).tasks[0];
 i.state.tasks.push({...template,id:title,company_id:i.company.id,organization_id:i.company.organization_id,period_id:period.id,title,status});
}
function bank(i:MonthlyAuditInput,opening='1000.00',closing='979.00'){
 i.banks=[{month:i.month,accounts:[{number:'1234',currency:'ARS',opening_on:'2026-08-31',closing_on:'2026-09-30',opening,closing,no_movements:false,movements:[]}],warning:''}];
 i.reports.saldos={kind:'saldos',filename:'sintetico',sha256:'test',mode:'detail',lines:[],balances:[{row:2,code:'101',account:'Banco sintético',opening:'1000.00',debit:'0.00',credit:'10.00',closing:'990.00',adjustedDebit:'0.00',adjustedCredit:'10.00',adjustedClosing:'990.00',valid:true}],warnings:[],errors:[],dates:[],accounts:['Banco sintético'],summaries:[]};
}
const control=(i:MonthlyAuditInput,id:string)=>reviewAccountingMonth(i).controls.find(c=>c.id===id)!;
function record(i:MonthlyAuditInput,id:string,payload:BookValues){const period=i.state.periods.find(p=>p.company_id===i.company.id&&p.month.startsWith(i.month))!;i.state.bookRecords.push({id,company_id:i.company.id,organization_id:i.company.organization_id,period_id:period.id,payload});}
const base={date:'2026-09-01',reference:'SINTETICO',description:'Prueba sintética',currency:'ARS',document_id:null};

test('un mes sin fuentes nunca se presenta como completo y no presume ventas cero',()=>{
 const i=setup(),r=reviewAccountingMonth(i);expect(r.status).toBe('pending');expect(control(i,'sale').status).toBe('pending');expect(control(i,'report-diario').status).toBe('pending');
 addTask(i,'Recepción de comprobantes emitidos','not_applicable');expect(control(i,'sale').status).toBe('not_applicable');
 const template=createDemoWorkspace(i.month).vouchers[0],period=i.state.periods.find(p=>p.company_id===i.company.id&&p.month.startsWith(i.month))!;
 i.state.vouchers.push({...template,company_id:i.company.id,organization_id:i.company.organization_id,period_id:period.id,direction:'sale'});expect(control(i,'sale').status).toBe('difference');
});

test('no acepta declaraciones ni comprobantes de otra empresa, organización o mes',()=>{
 const i=setup();addTask(i,'Recepción de comprobantes emitidos','not_applicable');
 i.state.tasks[0].organization_id='otro-estudio';expect(control(i,'sale').status).toBe('pending');
 i.state.tasks[0].organization_id=i.company.organization_id;i.state.tasks[0].company_id='otra-empresa';expect(control(i,'sale').status).toBe('pending');
 i.state.tasks[0].company_id=i.company.id;i.state.tasks[0].period_id='otro-periodo';expect(control(i,'sale').status).toBe('pending');
});

test('proyecta exactamente faltantes seleccionados sin afirmar que fueron importados',()=>{
 const i=setup();bank(i);i.coverage=true;i.audit={ready:true,issues:[],groups:[],findings:[{status:'missing',evidence:[],candidate:{id:'fee',date:'2026-09-06',description:'Cargo sintético',reference:'TEST',currency:'ARS',source:'bank',lines:pair('expense','bank',1100n),blocked:[]}}]};
 i.selected=new Set(['fee']);let r=reviewAccountingMonth(i);
 expect(r.banks[0]).toMatchObject({closingDifference:'-11.00',selectedDelta:'-11.00',projectedClosing:'979.00',remainingDifference:'0.00',status:'difference'});
 expect(r.status).toBe('difference');expect(control(i,'findings-missing').status).toBe('pending');
 i.audit.findings[0].status='exported';r=reviewAccountingMonth(i);expect(r.banks[0].selectedDelta).toBe('0.00');expect(control(i,'findings-exported').status).toBe('pending');
 addTask(i,'Validación de importación y saldos en Xubio','completed');expect(reviewAccountingMonth(i).status).toBe('difference');
});

test('controla saldo inicial aunque coincida el cierre y evita mezclar dólares',()=>{
 const i=setup();bank(i,'999.00','990.00');i.audit.ready=true;i.coverage=true;
 expect(reviewAccountingMonth(i).banks[0]).toMatchObject({openingDifference:'-1.00',closingDifference:'0.00',status:'difference'});
 i.banks[0].accounts[0].opening='1000.00';expect(reviewAccountingMonth(i).banks[0].status).toBe('checked');
 i.banks[0].accounts[0].currency='USD';expect(reviewAccountingMonth(i).banks[0]).toMatchObject({status:'review',xubioClosing:null,projectedClosing:null});
 i.banks[0].accounts[0].currency='ARS';i.state.accounts[0].company_id='otra';expect(reviewAccountingMonth(i).banks[0].xubioClosing).toBeNull();
});

test('exige guardar los reportes y explica las limitaciones del libro operativo',()=>{
 const i=setup();bank(i);expect(control(i,'report-saldos').status).toBe('pending');i.savedReports={saldos:true};expect(control(i,'report-saldos').status).toBe('checked');
 i.state.accountingReady=false;expect(control(i,'ledger-scope')).toMatchObject({status:'review',basis:'scope'});
});

test('recuerda la amortización anual solo cuando vence y detecta una cuota equivocada',()=>{
 const i=setup();record(i,'asset',{...base,kind:'asset',cost:'1200.00',residual:'0.00',life_months:12,service_on:'2026-09-01',disposal_on:null,frequency:'annual',annual_month:'12',expense_account_id:'expense',accumulated_account_id:'bank'});
 expect(control(i,'assets').status).toBe('checked');
 const asset=i.state.bookRecords[0].payload;if(asset.kind!=='asset')throw Error();asset.frequency='monthly';expect(control(i,'assets').status).toBe('pending');
 record(i,'quota',{...base,kind:'journal',source_key:'asset:asset:2026-09',lines:pair('expense','bank',9900n)});expect(control(i,'assets').status).toBe('difference');
 const quota=i.state.bookRecords[1].payload;if(quota.kind!=='journal')throw Error();quota.lines=pair('expense','bank',10000n);expect(control(i,'assets').status).toBe('checked');
});

test('la declaración de cero empleados no oculta devengamientos de personal',()=>{
 const i=setup();i.company.employee_count=0;expect(control(i,'payroll').status).toBe('not_applicable');
 record(i,'payroll',{...base,kind:'accrual',tax:'Sueldos',amount:'100.00',debit_account_id:'expense',credit_account_id:'bank',due_on:'2026-09-10'});
 addTask(i,'Devengamiento de sueldos y cargas sociales','completed');expect(control(i,'payroll').status).toBe('difference');
 expect(control(i,'payments').status).toBe('review');
});

test('el plan descargable conserva diferencias, acciones y proyecciones por empresa y mes',()=>{
 const i=setup();bank(i);const csv=monthlyAuditCsv(reviewAccountingMonth(i),i.company,i.month);
 expect(csv).toContain(i.company.cuit);expect(csv).toContain('2026-09');expect(csv).toContain('diferencia_restante');expect(csv).toContain('No se genera un asiento de ajuste');expect(csv).toContain('-11.00');
});
