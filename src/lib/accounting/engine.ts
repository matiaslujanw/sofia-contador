import { cents, decimalFromCents } from "@/lib/workspace/format";
import type { Account, Company, Voucher, WorkspaceState } from "@/lib/workspace/model";
import { worksheetCsv } from "@/lib/workspace/monthly-control";
import { bookSchema, type BookRecord, type BookValues, type JournalLine } from "./model";

export function bookScope(state: WorkspaceState, company: Company, month: string) {
  const periods = new Map(state.periods.filter(p => p.company_id === company.id && p.organization_id === company.organization_id && p.month.slice(0,7) <= month).map(p => [p.id,p]));
  return (state.bookRecords ?? []).filter(r => r.company_id === company.id && r.organization_id === company.organization_id && periods.has(r.period_id));
}
export function pair(debit: string, credit: string, amount: bigint): JournalLine[] {
  if (amount < 0n) return pair(credit, debit, -amount);
  if (!amount) return [];
  return [{account_id:debit,debit:decimalFromCents(amount),credit:"0.00"},{account_id:credit,debit:"0.00",credit:decimalFromCents(amount)}];
}
export function journalLines(v: BookValues): JournalLine[] {
  if (v.kind === "journal") return v.lines;
  if (v.kind === "cash") return pair(v.flow === "in" ? v.cash_account_id : v.counterpart_account_id, v.flow === "in" ? v.counterpart_account_id : v.cash_account_id, cents(v.amount));
  if (v.kind === "accrual") return pair(v.debit_account_id,v.credit_account_id,cents(v.amount));
  if (v.kind === "opening") return pair(v.role === "customer" ? v.control_account_id : v.offset_account_id, v.role === "customer" ? v.offset_account_id : v.control_account_id,cents(v.amount));
  return [];
}
export function depreciation(v: Extract<BookValues,{kind:"asset"}>, month: string) {
  const months = (m:string) => Number(m.slice(0,4))*12+Number(m.slice(5,7));
  const elapsed=months(month)-months(v.service_on);
  const stop=v.disposal_on?months(v.disposal_on)-months(v.service_on)-1:v.life_months-1;
  const base=cents(v.cost)-cents(v.residual), life=BigInt(v.life_months);
  const earned=(n:number)=>base*BigInt(Math.max(0,Math.min(v.life_months,n+1,stop+1)))/life;
  if(v.frequency==='annual')return month.slice(5,7)===v.annual_month?earned(elapsed)-earned(elapsed-12):0n;
  return earned(elapsed)-earned(elapsed-1);
}
export function validateBook(state: WorkspaceState, company: Company, periodId: string, input: unknown, ownId?: string) {
  const v=bookSchema.parse(input);
  const period=state.periods.find(p=>p.id===periodId && p.company_id===company.id && p.organization_id===company.organization_id);
  if(!period || period.status!=="open" || company.status!=="active") throw new Error("Seleccioná un período abierto de una empresa activa.");
  if(v.date.slice(0,7)!==period.month.slice(0,7)) throw new Error("La fecha debe pertenecer al período.");
  if(v.currency!==company.currency) throw new Error("Registrá en la moneda de la empresa. Las conversiones requieren revisión previa.");
  if(v.document_id && !state.documents.some(d=>d.id===v.document_id && d.company_id===company.id && d.period_id===periodId)) throw new Error("El respaldo no pertenece al período.");
  const records=(state.bookRecords??[]).filter(r=>r.company_id===company.id && r.organization_id===company.organization_id && r.id!==ownId);
  if(records.some(r=>r.period_id===periodId && r.payload.kind===v.kind && r.payload.reference===v.reference)) throw new Error("Ya existe esa referencia en el mes.");
  if(v.kind==="bank_balance" && records.some(r=>r.period_id===periodId&&r.payload.kind==="bank_balance"&&r.payload.cash_account_id===v.cash_account_id))throw new Error("Ya cargaste los saldos de esta cuenta en el mes.");
  if(v.kind==="opening" && records.some(r=>r.payload.kind==="opening" && r.payload.role===v.role && r.payload.cuit===v.cuit)) throw new Error("Ya existe una apertura para esa contraparte.");
  if(v.kind==="accrual" && records.some(r=>r.period_id===periodId && r.payload.kind==="accrual" && r.payload.tax===v.tax)) throw new Error("Ese concepto ya está devengado en el mes.");
  if(v.kind==="journal" && v.source_key.startsWith("asset:")) {
    const id=v.source_key.split(':')[1],asset=records.find(r=>r.id===id)?.payload;
    if(!asset || asset.kind!=='asset' || v.source_key!==`asset:${id}:${period.month.slice(0,7)}`)throw new Error("Origen de amortización inválido.");
    const expected=pair(asset.expense_account_id,asset.accumulated_account_id,depreciation(asset,period.month.slice(0,7)));
    if(!expected.length || JSON.stringify(v.lines)!==JSON.stringify(expected))throw new Error("La cuota o las cuentas no corresponden al bien de uso.");
  }
  if(v.kind==="journal" && v.source_key.startsWith("voucher:")) {
    const voucher=state.vouchers.find(x=>x.id===v.source_key.slice(8)&&x.company_id===company.id&&x.period_id===periodId&&x.currency===v.currency&&x.review_status==='approved');
    const total=v.lines.reduce((s,l)=>s+cents(l.debit),0n);
    if(!voucher || total!==(cents(voucher.total)<0n?-cents(voucher.total):cents(voucher.total)))throw new Error("El asiento no coincide con el comprobante aprobado.");
  }
  if(v.kind==="journal" && records.some(r=>r.payload.kind==="journal" && r.payload.source_key===v.source_key)) throw new Error("El origen ya tiene un asiento.");
  const accounts = new Map(state.accounts.filter(a=>a.company_id===company.id && a.organization_id===company.organization_id && a.status==="active").map(a=>[a.id,a]));
  const accountIds=[...journalLines(v).map(l=>l.account_id),...((v.kind==="statement"||v.kind==="bank_balance")?[v.cash_account_id]:[]),...(v.kind==="asset"?[v.expense_account_id,v.accumulated_account_id]:[])];
  if(accountIds.some(id=>!accounts.has(id))) throw new Error("Las cuentas deben estar activas y pertenecer a la empresa.");
  if(v.kind!=="asset" && journalLines(v).length && new Set(journalLines(v).map(l=>l.account_id)).size<2) throw new Error("Usá al menos dos cuentas distintas.");
  if((v.kind==="cash" || v.kind==="statement" || v.kind==="bank_balance") && accounts.get(v.cash_account_id)?.kind!=="asset") throw new Error("Caja/banco debe ser una cuenta de activo.");
  if(v.kind==="asset" && (!['expense','cost'].includes(accounts.get(v.expense_account_id)?.kind??'') || accounts.get(v.accumulated_account_id)?.kind!=="asset" || v.expense_account_id===v.accumulated_account_id)) throw new Error("Elegí gasto de amortización y amortización acumulada de activo.");
  if(v.kind==="opening" && accounts.get(v.control_account_id)?.kind!==(v.role==='customer'?'asset':'liability')) throw new Error("Clientes requieren cuenta de activo y proveedores de pasivo.");
  if(v.kind==="cash") {
    if(v.role!=="other" && accounts.get(v.counterpart_account_id)?.kind!==(v.role==='customer'?'asset':'liability')) throw new Error("Usá la cuenta de clientes (activo) o proveedores (pasivo), sin duplicar el ingreso/gasto.");
    if(v.category==='transfer' && (v.role!=='other'||accounts.get(v.counterpart_account_id)?.kind!=='asset'))throw new Error("La transferencia propia requiere dos cuentas de activo y Otro movimiento.");
    if(v.role==="customer" && v.flow!=="in" || v.role==="supplier" && v.flow!=="out") throw new Error("Clientes: cobros. Proveedores: pagos. Para reintegros usá un asiento con respaldo.");
    if(v.voucher_id) {
      const voucher=state.vouchers.find(x=>x.id===v.voucher_id && x.company_id===company.id && x.organization_id===company.organization_id);
      if(!voucher || voucher.currency!==v.currency || voucher.counterparty_cuit!==v.cuit || voucher.date>v.date || (voucher.direction==='sale'?'customer':'supplier')!==v.role || cents(voucher.total)<=0n) throw new Error("El comprobante no es compatible con este cobro/pago.");
      const settled=records.reduce((s,r)=>s+(r.payload.kind==='cash'&&r.payload.voucher_id===v.voucher_id?cents(r.payload.amount):0n),0n);
      if(settled+cents(v.amount)>cents(voucher.total)) throw new Error("El pago supera el saldo del comprobante.");
    }
    if(v.settles_id) {
      const debt=records.find(r=>r.id===v.settles_id)?.payload;
      if(!debt || debt.kind!=="accrual" || debt.currency!==v.currency || v.flow!=="out" || debt.date>v.date || v.counterpart_account_id!==debt.credit_account_id) throw new Error("La obligación no es compatible con el pago.");
      const settled=records.reduce((s,r)=>s+(r.payload.kind==='cash'&&r.payload.settles_id===v.settles_id?cents(r.payload.amount):0n),0n);
      if(settled+cents(v.amount)>cents(debt.amount)) throw new Error("El pago supera el saldo de la obligación.");
    }
  }
  if(v.kind==="statement" && v.match_id) {
    const match=records.find(r=>r.id===v.match_id)?.payload;
    if(!match || match.kind!=="cash" || match.date>period.month.slice(0,7)+'-31' || match.currency!==v.currency || (match.cash_account_id!==v.cash_account_id && !(match.category==='transfer'&&match.counterpart_account_id===v.cash_account_id)) || (match.flow==='in'?1n:-1n)*(match.cash_account_id===v.cash_account_id?1n:-1n)*cents(match.amount)!==cents(v.amount)) throw new Error("La coincidencia debe tener la misma cuenta, moneda e importe con signo.");
    if(records.some(r=>r.payload.kind==='statement' && r.payload.cash_account_id===v.cash_account_id && r.payload.match_id===v.match_id)) throw new Error("El movimiento ya está conciliado.");
  }
  return v;
}
export function currentAccounts(state: WorkspaceState, company: Company, month: string) {
  const records=bookScope(state,company,month);
  const vouchers=state.vouchers.filter(v=>v.company_id===company.id && v.organization_id===company.organization_id && v.date.slice(0,7)<=month && v.currency===company.currency);
  const result=new Map<string,{role:string;cuit:string;name:string;opening:bigint;charges:bigint;settled:bigint;balance:bigint}>();
  function entry(role:string,cuit:string,name:string){const key=role+':'+cuit; if(!result.has(key))result.set(key,{role,cuit,name,opening:0n,charges:0n,settled:0n,balance:0n});return result.get(key)!;}
  for(const voucher of vouchers){if(voucher.counterparty_cuit){const opening=records.find(r=>r.payload.kind==='opening'&&r.payload.cuit===voucher.counterparty_cuit&&r.payload.role===(voucher.direction==='sale'?'customer':'supplier'));if(opening&&voucher.date<opening.payload.date)continue;const e=entry(voucher.direction==='sale'?'customer':'supplier',voucher.counterparty_cuit,voucher.counterparty_name??'');e.charges+=cents(voucher.total);}}
  for(const {payload:v} of records){if(v.kind==='opening'){entry(v.role,v.cuit,v.name).opening+=cents(v.amount);} if(v.kind==='cash' && v.role!=='other' && v.cuit){const opening=records.find(r=>r.payload.kind==='opening'&&r.payload.cuit===v.cuit&&r.payload.role===v.role);if(!opening||v.date>=opening.payload.date)entry(v.role,v.cuit,v.name).settled+=cents(v.amount);}}
  return [...result.values()].map(e=>({...e,balance:e.opening+e.charges-e.settled}));
}
export function accountingReport(records: BookRecord[], accounts: Account[], month:string) {
  const period=records.filter(r=>r.payload.date.slice(0,7)===month);
  const kinds=new Map(accounts.map(a=>[a.id,a.kind]));
  let income=0n,expense=0n,inflow=0n,outflow=0n;
  const distribution=new Map<string,bigint>();
  for(const {payload:v} of period){
    if(v.kind==='cash' && v.category!=='transfer'){if(v.flow==='in')inflow+=cents(v.amount);else outflow+=cents(v.amount);}
    if(v.kind==='opening')continue;
    for(const l of journalLines(v)){const net=cents(l.debit)-cents(l.credit),kind=kinds.get(l.account_id);if(kind==='revenue')income-=net;if(kind==='cost'||kind==='expense'){expense+=net;distribution.set(l.account_id,(distribution.get(l.account_id)??0n)+net);}}
  }
  return {income,expense,result:income-expense,inflow,outflow,distribution:[...distribution].map(([id,value])=>({id,name:accounts.find(a=>a.id===id)?.name??id,value}))};
}
export function bookCsv(records:BookRecord[],accounts:Account[]) {
  return worksheetCsv([['origen_sofia','fecha','referencia','concepto','moneda','codigo_cuenta','cuenta','debe','haber'],...records.flatMap(r=>journalLines(r.payload).map(l=>[r.id,r.payload.date,r.payload.reference,r.payload.description,r.payload.currency,accounts.find(a=>a.id===l.account_id)?.code??'',accounts.find(a=>a.id===l.account_id)?.name??'',l.debit,l.credit]))]);
}

export function voucherJournal(v:Voucher, mapping:{control:string;vat:string;other:string}):BookValues {
 if(v.review_status!=="approved" || !v.account_id)throw new Error("El comprobante debe estar aprobado e imputado.");
 if(v.direction==='purchase' && v.deductible_vat===null)throw new Error("Definí el IVA computable, incluso si es cero.");
 const base=cents(v.taxable)+cents(v.untaxed)+cents(v.exempt), vat=cents(v.vat), other=cents(v.other_taxes), total=cents(v.total);
 const credit=v.direction==='purchase'?cents(v.deductible_vat!):vat;
 const lines:JournalLine[]=[];
 const add=(account_id:string,value:bigint,debit:boolean)=>{if(!value)return;if(!account_id)throw new Error("Faltan cuentas fiscales.");lines.push({account_id,debit:decimalFromCents((debit?value:-value)>0n?(debit?value:-value):0n),credit:decimalFromCents((debit?-value:value)>0n?(debit?-value:value):0n)});};
 const purchase=v.direction==='purchase';
 add(v.account_id,base+(purchase?vat-credit:0n),purchase);add(mapping.vat,credit,purchase);add(mapping.other,other,purchase);add(mapping.control,total,!purchase);
 return bookSchema.parse({kind:'journal',date:v.date,reference:`COMP-${v.id}`,description:`${v.receipt_type} ${v.point_of_sale}-${v.receipt_number} · ${v.counterparty_name??''}`.slice(0,180),currency:v.currency,document_id:v.document_id,source_key:`voucher:${v.id}`,lines});
}

export function bookObligations(state:WorkspaceState) {
 const records=state.bookRecords??[];
 return records.flatMap(r=>{
  const v=r.payload;if(v.kind!=='accrual')return [];
  const payments=records.filter(p=>p.company_id===r.company_id && p.organization_id===r.organization_id && p.payload.kind==='cash' && p.payload.settles_id===r.id);
  const paid=payments.reduce((sum,p)=>sum+(p.payload.kind==='cash'?cents(p.payload.amount):0n),0n);
  return [{id:`book:${r.id}`,company_id:r.company_id,period_id:r.period_id,title:`[Devengado] ${v.tax}`,due_on:v.due_on,amount:decimalFromCents(cents(v.amount)-paid),status:paid>=cents(v.amount)?'paid' as const:'pending' as const,filed_on:null,paid_on:paid>=cents(v.amount)?payments.map(p=>p.payload.date).sort().at(-1)??null:null,document_id:v.document_id,notes:`Devengado: ${v.amount}. Pagado: ${decimalFromCents(paid)}. ${v.description}. Se administra desde Contabilidad operativa; no acredita presentación de DDJJ.`}];
 });
}

export function partyLedger(state:WorkspaceState,company:Company,month:string,role:'customer'|'supplier',cuit:string) {
 const records=bookScope(state,company,month);
 const opening=records.find(r=>r.payload.kind==='opening'&&r.payload.role===role&&r.payload.cuit===cuit);
 const cutoff=opening?.payload.date??'0000-00-00';
 const rows:{id:string;date:string;type:string;reference:string;description:string;delta:bigint;method:string;order:number}[]=[];
 if(opening&&opening.payload.kind==='opening')rows.push({id:opening.id,date:opening.payload.date,type:'Saldo inicial',reference:opening.payload.reference,description:opening.payload.description,delta:cents(opening.payload.amount),method:'',order:0});
 for(const v of state.vouchers){if(v.company_id===company.id&&v.organization_id===company.organization_id&&v.currency===company.currency&&v.counterparty_cuit===cuit&&v.direction===(role==='customer'?'sale':'purchase')&&v.date>=cutoff&&v.date.slice(0,7)<=month)rows.push({id:v.id,date:v.date,type:v.receipt_type,reference:`${v.point_of_sale}-${v.receipt_number}`,description:v.counterparty_name??'',delta:cents(v.total),method:'',order:1});}
 for(const r of records){const v=r.payload;if(v.kind==='cash'&&v.role===role&&v.cuit===cuit&&v.date>=cutoff)rows.push({id:r.id,date:v.date,type:role==='customer'?'Cobro':'Pago',reference:v.reference,description:v.description,delta:-cents(v.amount),method:v.payment_method??'Sin informar',order:2});}
 let balance=0n;
 return rows.sort((a,b)=>a.date.localeCompare(b.date)||a.order-b.order||a.id.localeCompare(b.id)).map(row=>({...row,balance:balance+=row.delta}));
}
