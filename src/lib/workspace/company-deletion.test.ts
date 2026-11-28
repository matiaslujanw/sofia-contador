import {expect,test} from 'vitest';
import {createDemoWorkspace} from './demo';
import {localDeletionPreview,removeLocalCompany,deletionScope} from './company-deletion';
import {coreScenario} from '../../../tests/fixtures/core';
import {applyCoreCommand} from '@/lib/accounting/core/local';

test('elimina solo la empresa elegida y libera su CUIT sin borrar la auditoría',async()=>{
 const state=createDemoWorkspace('2026-11'),company=state.companies[0],other=state.companies[1];state.bookRecords=[];
 const before=JSON.stringify(state),preview=await localDeletionPreview(state,company.id),next=removeLocalCompany(state,company,preview.signature);
 expect(next.companies.some(c=>c.id===company.id)).toBe(false);expect(next.companies.find(c=>c.id===other.id)).toEqual(other);
 for(const key of ['vouchers','accounts','periods','tasks','documents','imports','obligations'] as const){expect(next[key].some(r=>r.company_id===company.id)).toBe(false);expect(next[key].filter(r=>r.company_id===other.id)).toEqual(state[key].filter(r=>r.company_id===other.id));}
 expect(next.activity[0].entity).toBe('company_deletion');expect(next.companyDeletions?.[0]).toMatchObject({company_id:company.id,cuit:company.cuit,status:'files_pending'});expect(JSON.stringify(state)).toBe(before);
 expect(next.companies.some(c=>c.cuit===company.cuit)).toBe(false);
});
test('la vista previa cambia si se modifican cargas o datos aunque la cantidad sea igual',async()=>{
 const s=createDemoWorkspace('2026-11'),c=s.companies[0],a=await localDeletionPreview(s,c.id);s.vouchers.find(v=>v.company_id===c.id)!.counterparty_name='Nueva descripción';expect((await localDeletionPreview(s,c.id)).signature).not.toBe(a.signature);
 const b=await localDeletionPreview(s,c.id);s.companies[1].trade_name='Cambio de otra empresa';expect((await localDeletionPreview(s,c.id)).signature).toBe(b.signature);
});
test('solo propietaria puede revisar o eliminar empresas de su organización',()=>{const s=createDemoWorkspace('2026-11'),c=s.companies[0];s.organization!.role='editor';expect(()=>deletionScope(s,c.id)).toThrow(/propietaria/);s.organization!.role='owner';c.organization_id='otra';expect(()=>deletionScope(s,c.id)).toThrow(/propietaria/);});
test('un asiento confirmado no puede borrarse por eliminar la empresa',async()=>{const f=coreScenario(),s=applyCoreCommand(f.state,f.operations[0],'90000000-0000-4000-8000-000000000001');const p=await localDeletionPreview(s,f.company.id);expect(p.blocked.join()).toContain('asientos confirmados');expect(()=>removeLocalCompany(s,f.company,p.signature)).toThrow(/confirmados/);});
test('también conserva los movimientos contables del libro operativo anterior',()=>{const s=createDemoWorkspace('2026-11'),c=s.companies[0],p=s.periods.find(p=>p.company_id===c.id)!;s.bookRecords=[{id:'movement',company_id:c.id,organization_id:c.organization_id,period_id:p.id,payload:{kind:'journal',date:'2026-11-01',description:'Asiento sintético',reference:'TEST',currency:'ARS',document_id:null,source_key:'test',lines:[]}}];expect(()=>removeLocalCompany(s,c,'signature')).toThrow(/libro operativo/);});
