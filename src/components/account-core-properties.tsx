"use client";
import type {Account} from '@/lib/workspace/model';
import {accountProperties,coreState} from '@/lib/accounting/core/engine';
import {useWorkspace} from './workspace-context';
import {Modal,ActionForm,Field,Input,Select,fieldValue} from './workspace-ui';
export function AccountCoreProperties({account,close}:{account:Account;close:()=>void}){
 const {state,mutate}=useWorkspace(),properties=accountProperties(state,account),mapping=coreState(state).equivalences.find(e=>e.account_id===account.id&&e.company_id===account.company_id);
 return <Modal title="Propiedades del plan contable" description={`${account.code} · ${account.name} · Nivel ${properties.level}`} close={close}><ActionForm close={close} submit={async d=>{
  await mutate({type:'core.profile',accountId:account.id,heading:fieldValue(d,'heading'),subheading:fieldValue(d,'subheading'),nature:fieldValue(d,'nature') as 'debit'|'credit',postable:fieldValue(d,'postable')==='true',xubioCode:fieldValue(d,'xubio')||null},'Propiedades contables guardadas.');
 }}><Field label="Rubro"><Input name="heading" defaultValue={properties.heading} maxLength={120}/></Field><Field label="Subrubro"><Input name="subheading" defaultValue={properties.subheading} maxLength={120}/></Field><Field label="Naturaleza contable"><Select name="nature" defaultValue={properties.nature}><option value="debit">Deudora</option><option value="credit">Acreedora</option></Select></Field><Field label="Imputación directa"><Select name="postable" defaultValue={properties.postable?'true':'false'}><option value="true">Cuenta de movimiento</option><option value="false">Agrupadora</option></Select></Field><Field label="Código equivalente en Xubio" span><Input name="xubio" defaultValue={mapping?.external_code??''} maxLength={80}/></Field><p className="muted field-wide">El nivel se calcula desde la cuenta superior del plan existente. Una cuenta con hijas siempre es agrupadora. La clasificación usada en asientos confirmados se conserva; una equivalencia identifica la misma cuenta en Xubio, sin crear otra cuenta.</p></ActionForm></Modal>;
}
