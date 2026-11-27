import {createDemoWorkspace} from '../../src/lib/workspace/demo';
import {emptyCore} from '../../src/lib/accounting/core/model';
import type {ParsedCommand} from '../../src/lib/workspace/validation';
import type {Account} from '../../src/lib/workspace/model';
export function coreScenario(month='2026-11'){
 const state=createDemoWorkspace(month),company=state.companies[0],period=state.periods.find(p=>p.company_id===company.id&&p.month.startsWith(month))!;
 state.vouchers=[];state.bookRecords=[];state.tasks=[];
 const names=[['Banco de prueba','asset'],['Capital integrado','equity'],['Equipamiento de seguridad','asset'],['IVA crédito fiscal','asset'],['Deudores por servicios','asset'],['Servicios de vigilancia','revenue'],['IVA débito fiscal','liability'],['Gastos administrativos','expense'],['Proveedores','liability']];
 state.accounts=names.map(([name,kind],i)=>({id:`70000000-0000-4000-8000-${String(i+1).padStart(12,'0')}`,company_id:company.id,organization_id:company.organization_id,code:String(i+1).padStart(3,'0'),name,kind:kind as Account['kind'],parent_code:null,category:null,status:'active'}));
 const exercise={id:'70000000-0000-4000-8000-000000000100',organization_id:company.organization_id,company_id:company.id,name:'Ejercicio sintético',starts_on:month.slice(0,4)+'-01-01',ends_on:month.slice(0,4)+'-12-31',status:'open' as const,status_reason:''};state.core={...structuredClone(emptyCore),exercises:[exercise]};
 const accounts=state.accounts;
 const data:[string,[number,string,string][]][]=[['Aporte de capital por banco',[[0,'5000000.00','0.00'],[1,'0.00','5000000.00']]],['Equipamiento + IVA 21%',[[2,'1000000.00','0.00'],[3,'210000.00','0.00'],[0,'0.00','1210000.00']]],['Servicios + IVA 21% a cobrar',[[4,'2420000.00','0.00'],[5,'0.00','2000000.00'],[6,'0.00','420000.00']]],['Cobro parcial por banco',[[0,'1000000.00','0.00'],[4,'0.00','1000000.00']]],['Gasto administrativo + IVA por banco',[[7,'300000.00','0.00'],[3,'63000.00','0.00'],[0,'0.00','363000.00']]]];
 const operations:Extract<ParsedCommand,{type:'core.post'}>[]=data.map(([description,lines],i)=>({type:'core.post',periodId:period.id,exerciseId:exercise.id,date:`${month}-0${i+1}`,description,sourceKey:`scenario:${i}`,voucherId:null,documentId:null,allowDuplicate:false,lines:lines.map(([account,debit,credit])=>({account_id:accounts[account].id,party_id:null,debit,credit}))}));
 return {state,company,period,exercise,accounts,operations};
}
