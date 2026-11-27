import {z} from 'zod';
import type {Obligation,WorkspaceState} from './model';
import {shiftMonth} from './format';

const marker='\n\n[SOFIA_VENCIMIENTO_MENSUAL_V1]\n';
export const fiscalRuleSchema=z.object({seriesId:z.uuid(),day:z.number().int().min(1).max(31),offset:z.number().int().min(0).max(1),from:z.string().regex(/^20\d{2}-(0[1-9]|1[0-2])$/),active:z.boolean()});
export type FiscalRule=z.infer<typeof fiscalRuleSchema>;
export function fiscalNotes(notes:string|null|undefined):{text:string;rule?:FiscalRule}{
 notes=notes??'';
 const at=notes.lastIndexOf(marker);if(at<0)return {text:notes};
 try{const parsed=fiscalRuleSchema.safeParse(JSON.parse(notes.slice(at+marker.length)));if(parsed.success)return {text:notes.slice(0,at),rule:parsed.data};}catch{/* Invalid metadata remains visible as ordinary notes. */}
 return {text:notes};
}
export function withFiscalRule(notes:string,rule?:FiscalRule){
 const result=fiscalNotes(notes).text+(rule?marker+JSON.stringify(fiscalRuleSchema.parse(rule)):'');
 if(result.length>4000)throw new Error('Acortá las observaciones para guardar la fecha habitual.');
 return result;
}
export function fiscalDate(month:string,rule:Pick<FiscalRule,'day'|'offset'>){
 const dueMonth=shiftMonth(month,rule.offset),[year,number]=dueMonth.split('-').map(Number),last=new Date(Date.UTC(year,number,0)).getUTCDate();
 return `${dueMonth}-${String(Math.min(rule.day,last)).padStart(2,'0')}`;
}
export function ruleFromDate(seriesId:string,month:string,date:string,active:boolean,previous?:FiscalRule,previousDate?:string):FiscalRule{
 const offset=(Number(date.slice(0,4))-Number(month.slice(0,4)))*12+Number(date.slice(5,7))-Number(month.slice(5,7));
 if(offset<0||offset>1)throw new Error('El vencimiento habitual debe caer en el mes seleccionado o en el siguiente.');
 return fiscalRuleSchema.parse({seriesId,day:previous&&date===previousDate?previous.day:Number(date.slice(8,10)),offset,from:month,active});
}
export function fiscalRules(state:WorkspaceState,companyId?:string,through?:string){
 const own=new Set(state.companies.filter(c=>(!companyId||c.id===companyId)&&c.organization_id===state.organization?.id).map(c=>c.id));
 const periods=new Map(state.periods.filter(p=>own.has(p.company_id)&&p.organization_id===state.organization?.id).map(p=>[p.id,p]));
 const versions=new Map<string,{source:Obligation;rule:FiscalRule}>();
 for(const source of state.obligations){const p=periods.get(source.period_id),rule=fiscalNotes(source.notes).rule;if(!p||p.company_id!==source.company_id||!rule||through&&rule.from>through)continue;
  const key=source.company_id+':'+rule.seriesId,prior=versions.get(key);
  if(!prior||rule.from>prior.rule.from||rule.from===prior.rule.from&&p.month>(periods.get(prior.source.period_id)?.month??''))versions.set(key,{source,rule});
 }
 return [...versions.values()];
}
export function fiscalCalendar(state:WorkspaceState,month:string,companyId?:string):Obligation[]{
 const companyIds=new Set(state.companies.filter(c=>(!companyId||c.id===companyId)&&c.organization_id===state.organization?.id).map(c=>c.id));
 const periods=state.periods.filter(p=>p.month.startsWith(month)&&companyIds.has(p.company_id)&&p.organization_id===state.organization?.id);
 const ids=new Set(periods.map(p=>p.id));
 const result=state.obligations.filter(o=>ids.has(o.period_id)&&companyIds.has(o.company_id));
 for(const {source,rule}of fiscalRules(state,companyId,month)){
  const period=periods.find(p=>p.company_id===source.company_id);
  if(!rule.active||period?.status==='closed'||result.some(o=>o.company_id===source.company_id&&fiscalNotes(o.notes).rule?.seriesId===rule.seriesId))continue;
  result.push({...source,id:`recurring:${source.company_id}:${rule.seriesId}:${month}`,period_id:period?.id??'',due_on:fiscalDate(month,rule),amount:null,status:'pending',filed_on:null,paid_on:null,document_id:null,notes:withFiscalRule(fiscalNotes(source.notes).text,rule)});
 }
 return result;
}
