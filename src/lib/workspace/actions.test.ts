import {beforeEach,expect,test,vi} from 'vitest';
import {confirmWorkspaceImport,mutateWorkspace,uploadWorkspaceDocument,listWorkspaceDocuments} from './actions';
import {readSource,suggestMapping} from '@/lib/imports';
const mocks=vi.hoisted(()=>({access:vi.fn(),invalidate:vi.fn(),upload:vi.fn(),remove:vi.fn(),rpc:vi.fn(),fail:false,existingPlan:false,filters:[] as {table:string;column:string;value:unknown}[]}));
vi.mock('next/cache',()=>({revalidatePath:mocks.invalidate}));
vi.mock('@/lib/supabase/access',()=>({getWorkspaceAccess:mocks.access}));
vi.mock('./queries',()=>({loadWorkspace:vi.fn()}));
const companyId='10000000-0000-4000-8000-000000000010',periodId='10000000-0000-4000-8000-000000000100',org='10000000-0000-4000-8000-000000000001';
beforeEach(()=>{
 vi.clearAllMocks();mocks.fail=false;mocks.existingPlan=false;mocks.filters=[];
 mocks.upload.mockResolvedValue({error:null});mocks.remove.mockResolvedValue({error:null});
 mocks.rpc.mockResolvedValue({data:{row_count:1,duplicate_count:0,reused:false},error:null});
 mocks.access.mockResolvedValue({mode:'auth',userId:'user',supabase:{rpc:mocks.rpc,storage:{from:()=>({upload:mocks.upload,remove:mocks.remove})},from:(table:string)=>{
  const query={select:()=>query,eq:(column:string,value:unknown)=>{mocks.filters.push({table,column,value});return query;},limit:()=>query,insert:()=>query,update:()=>query,
   single:async()=>({data:table==='periods'?{id:periodId,company_id:companyId,organization_id:org,status:'open',month:'2026-11-01'}:{id:companyId},error:mocks.fail?{message:'synthetic failure'}:null}),
   maybeSingle:async()=>({data:mocks.existingPlan&&table==='imports'?{row_count:1,duplicate_count:0}:null,error:null})};return query;
 }}});
});
function documentForm(){const form=new FormData();form.set('file',new File(['%PDF-1.4\n%%EOF'],'synthetic.pdf',{type:'application/pdf'}));form.set('context',JSON.stringify({companyId,periodId,category:'Extractos bancarios'}));return form;}
test('una subida confirmada invalida todas las pantallas del workspace antes de devolver éxito',async()=>{
 expect((await uploadWorkspaceDocument(documentForm())).ok).toBe(true);
 expect(mocks.upload).toHaveBeenCalledOnce();expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith('/[section]','page');
});
test('un cambio confirmado también refresca las pantallas visitadas; el fallo no anuncia guardado',async()=>{
 expect((await mutateWorkspace({type:'company.status',id:companyId,status:'active'})).ok).toBe(true);
 expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith('/[section]','page');
 mocks.invalidate.mockClear();mocks.fail=true;
 expect((await uploadWorkspaceDocument(documentForm())).ok).toBe(false);expect(mocks.invalidate).not.toHaveBeenCalled();
});
test('compras se confirma mediante RPC y después se invalidan las otras vistas',async()=>{
 const csv='date;receipt_type;point_of_sale;receipt_number;counterparty_cuit;counterparty_name;currency;exchange_rate;taxable;untaxed;exempt;vat;other_taxes;total\n2026-11-05;001;1;100;30711111111;Proveedor sintetico;ARS;1;100;0;0;21;0;121';
 const file=new File([csv],'compras-sinteticas.csv',{type:'text/csv'}),table=await readSource(await file.arrayBuffer(),file.name);
 const form=new FormData();form.set('file',file);form.set('context',JSON.stringify({companyId,periodId,kind:'purchases',mapping:suggestMapping('purchases',table.headers),decimal:'point'}));
 const result=await confirmWorkspaceImport(form);expect(result.ok).toBe(true);
 expect(mocks.rpc).toHaveBeenCalledWith('confirm_import',expect.objectContaining({target_period:periodId,import_kind:'purchase'}));
 expect(mocks.invalidate).toHaveBeenCalledExactlyOnceWith('/[section]','page');
});

test('el mismo plan se reconoce por empresa aunque el archivo se haya archivado en otro mes',async()=>{
 mocks.existingPlan=true;
 const file=new File(['code;name;kind;status\n001;Caja sintetica;asset;active'],'plan.csv',{type:'text/csv'}),table=await readSource(await file.arrayBuffer(),file.name);
 const form=new FormData();form.set('file',file);form.set('context',JSON.stringify({companyId,periodId,kind:'accounts',mapping:suggestMapping('accounts',table.headers),decimal:'point'}));
 const result=await confirmWorkspaceImport(form);
 expect(result).toMatchObject({ok:true,data:{reused:true}});
 expect(mocks.filters).toContainEqual({table:'imports',column:'company_id',value:companyId});
 expect(mocks.filters.filter(f=>f.table==='imports'&&f.column==='period_id')).toEqual([]);
 expect(mocks.upload).not.toHaveBeenCalled();expect(mocks.rpc).not.toHaveBeenCalled();
});

test('la consulta fresca de respaldos rechaza una empresa distinta de la del período',async()=>{
 const result=await listWorkspaceDocuments('10000000-0000-4000-8000-000000000099',periodId);
 expect(result).toMatchObject({ok:false,message:'Empresa y período incompatibles.'});
 expect(mocks.filters.some(f=>f.table==='documents')).toBe(false);
});
