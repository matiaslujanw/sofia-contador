import {applyCoreCommand} from "@/lib/accounting/core/local";
import {coreState} from "@/lib/accounting/core/engine";
import {withFiscalRule} from "./fiscal-recurrence";
import { validateBook } from "@/lib/accounting/engine";
import { previewImport, readSource, type ColumnMapping, type ImportKind } from "@/lib/imports";
import { readDemoStorage, writeDemoStorage } from "./demo-storage";
import { verifyDocument } from "./documents";
import { cents, taskProgress } from "./format";
import { defaultClassification, defaultTaskTitles, type AuditEvent, type Document, type Period, type WorkspaceState } from "./model";
import { absenceDirection, commandSchema, type Command } from "./validation";

const key = "sofia-contable-demo-v1";
const changed = "sofia-workspace-change";

export function subscribeLocal(callback: () => void) {
  window.addEventListener("storage", callback);
  window.addEventListener(changed, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(changed, callback);
  };
}

export const localSnapshot = () => readDemoStorage(key);
export const emptyLocalSnapshot = () => null;

export function decodeLocal(snapshot: string | null, initial: WorkspaceState): WorkspaceState {
  try { return snapshot ? { ...initial, ...JSON.parse(snapshot), bookRecords: JSON.parse(snapshot).bookRecords ?? [] } as WorkspaceState : initial; }
  catch { return initial; }
}

function changeLocal(initial: WorkspaceState, update: (state: WorkspaceState) => WorkspaceState) {
  const data = update(decodeLocal(localSnapshot(), initial));
  writeDemoStorage(key, JSON.stringify(data));
  window.dispatchEvent(new Event(changed));
}

function withEvent(state: WorkspaceState, entity: string, entityId: string, companyId: string | null, periodId: string | null, action: string) {
  const event: AuditEvent = {
    id: crypto.randomUUID(), entity, entity_id: entityId, company_id: companyId, period_id: periodId,
    action, details: {}, created_at: new Date().toISOString(),
  };
  return { ...state, activity: [event, ...state.activity].slice(0, 75) };
}

function requireEntry<T>(entry: T | null | undefined, message = "El registro no está disponible."): T {
  if (!entry) throw new Error(message);
  return entry;
}

function openPeriod(state: WorkspaceState, periodId: string) {
  const period = requireEntry(state.periods.find((entry) => entry.id === periodId));
  if (period.status !== "open") throw new Error("El período está cerrado. Reabrilo para hacer cambios.");
  if (state.companies.find((entry) => entry.id === period.company_id)?.status !== "active") throw new Error("La empresa está archivada.");
  return period;
}

function reorder<T extends { id: string }>(entries: T[], row: T) {
  return entries.some((entry) => entry.id === row.id) ? entries.map((entry) => entry.id === row.id ? row : entry) : [...entries, row];
}

export function mutateLocal(initial: WorkspaceState, input: Command) {
  const parsed = commandSchema.safeParse(input);
  if (!parsed.success) throw new Error(parsed.error.issues[0].message);
  const command = parsed.data;
  let id = "id" in command && command.id ? command.id : crypto.randomUUID();

  changeLocal(initial, (state) => {
    const org = requireEntry(state.organization);
    const action = "id" in command && command.id ? "UPDATE" : "INSERT";
    if (org.role === "viewer") throw new Error("No tenés permiso para modificar registros.");
    if(command.type.startsWith('core.')){
      const result=applyCoreCommand(state,command,id);
      const periodId='periodId' in command?command.periodId:null;
      const companyId='companyId' in command?command.companyId:periodId?state.periods.find(p=>p.id===periodId)?.company_id??null:null;
      if(result===state){if('sourceKey' in command)id=coreState(state).entries.find(e=>e.source_key===command.sourceKey&&e.period_id===periodId)?.id??id;return state;}
      return withEvent(result,'accounting_core',id,companyId,periodId,action);
    }
    switch (command.type) {
      case "book.import": {
        const period=openPeriod(state,command.periodId),company=requireEntry(state.companies.find(c=>c.id===period.company_id));
        const next={...state,bookRecords:[...(state.bookRecords??[])]};
        for(const input of command.values) {
          if(!input.document_id || !["opening","statement"].includes(input.kind))throw new Error("El lote requiere respaldo y un tipo admitido.");
          const payload=validateBook(next,company,period.id,input);
          next.bookRecords.push({id:crypto.randomUUID(),organization_id:org.id,company_id:company.id,period_id:period.id,payload});
        }
        return withEvent(next,"book_records",id,company.id,period.id,"IMPORT");
      }
      case "book.save": {
        const period = openPeriod(state, command.periodId);
        const company = requireEntry(state.companies.find(c=>c.id===period.company_id));
        if(command.id) {
          const previous = requireEntry(state.bookRecords.find(r=>r.id===command.id && r.period_id===period.id));
          if(previous.payload.kind!=="statement" || command.values.kind!=="statement" || JSON.stringify({...previous.payload,match_id:null})!==JSON.stringify({...command.values,match_id:null})) throw new Error("Los registros son inmutables. Anulá y volvé a cargar.");
        }
        const payload = validateBook(state, company, period.id, command.values, command.id);
        const record = { id, organization_id: org.id, company_id: company.id, period_id: period.id, payload };
        return withEvent({...state,bookRecords:reorder(state.bookRecords??[],record)},"book_records",id,company.id,period.id,action);
      }
      case "book.void": {
        const previous=requireEntry(state.bookRecords.find(r=>r.id===command.id));
        openPeriod(state,previous.period_id);
        if(state.bookRecords.some(r=>(r.payload.kind==="cash"&&r.payload.settles_id===command.id)||(r.payload.kind==="statement"&&r.payload.match_id===command.id)||(r.payload.kind==="journal"&&r.payload.source_key.startsWith(`asset:${command.id}:`)))) throw new Error("El registro tiene movimientos vinculados. Desvinculalos o anulalos primero.");
        return withEvent({...state,bookRecords:state.bookRecords.filter(r=>r.id!==command.id)},"book_records",command.id,previous.company_id,previous.period_id,"VOID");
      }
      case "company.save": {
        const previous = command.id ? requireEntry(state.companies.find((company) => company.id === command.id)) : undefined;
        if (state.companies.some((company) => company.id !== id && company.cuit === command.values.cuit)) throw new Error("Ya existe una empresa con ese CUIT.");
        const company = { id, organization_id: org.id, status: previous?.status ?? "active", ...command.values } as const;
        return withEvent({ ...state, companies: reorder(state.companies, company) }, "companies", id, id, null, action);
      }
      case "company.status": {
        const company = requireEntry(state.companies.find((entry) => entry.id === id));
        return withEvent({ ...state, companies: reorder(state.companies, { ...company, status: command.status }) }, "companies", id, id, null, "UPDATE");
      }
      case "period.ensure": {
        const company = requireEntry(state.companies.find((entry) => entry.id === command.companyId));
        if (company.status === "archived") throw new Error("Reactivá la empresa antes de iniciar un período.");
        const existing = state.periods.find((period) => period.company_id === company.id && period.month === `${command.month}-01`);
        if (existing) { id = existing.id; return state; }
        const period: Period = { id, organization_id: org.id, company_id: company.id, month: `${command.month}-01`, status: "open" };
        const earlier = state.periods.filter((entry) => entry.company_id === company.id && entry.month < period.month).sort((a, b) => b.month.localeCompare(a.month))[0];
        const previousTasks = earlier ? state.tasks.filter((task) => task.period_id === earlier.id) : [];
        const definitions = previousTasks.length ? previousTasks : defaultTaskTitles.map((title, index) => ({ title, position: index + 1 }));
        const seed = definitions.map(({ title, position }) => ({
          id: crypto.randomUUID(), organization_id: org.id, company_id: company.id, period_id: id,
          title, position, status: "pending" as const, notes: "", document_id: null,
        }));
        return withEvent({ ...state, periods: [...state.periods, period], tasks: [...state.tasks, ...seed] }, "periods", id, company.id, id, action);
      }
      case "period.status": {
        const period = requireEntry(state.periods.find((entry) => entry.id === command.id));
        if (period.status === command.status) return state;
        if ((command.status === "open" || taskProgress(state.tasks.filter((task) => task.period_id === id)).pending > 0) && !command.reason) {
          throw new Error("Ingresá un motivo para registrar la decisión.");
        }
        const updated = withEvent({ ...state, periods: reorder(state.periods, { ...period, status: command.status }) }, "periods", id, period.company_id, id, "UPDATE");
        updated.activity[0].details = { reason: command.reason, status: command.status };
        return updated;
      }
      case "task.save": {
        const period = openPeriod(state, command.periodId);
        const direction=absenceDirection(command.title);
        if(command.status==='not_applicable'&&direction&&state.vouchers.some(v=>v.company_id===period.company_id&&v.period_id===period.id&&v.direction===direction))throw new Error('Ya hay comprobantes de ese tipo en el período.');
        const tasks = state.tasks.filter((task) => task.period_id === period.id);
        const position = command.id ? requireEntry(tasks.find((task) => task.id === command.id)).position : Math.max(0, ...tasks.map((task) => task.position)) + 1;
        const record = { id, position, company_id: period.company_id, organization_id: org.id, period_id: period.id, title: command.title, notes: command.notes, status: command.status, document_id: command.documentId };
        return withEvent({ ...state, tasks: reorder(state.tasks, record) }, "close_tasks", id, period.company_id, period.id, action);
      }
      case "account.save": {
        const siblings = state.accounts.filter((account) => account.company_id === command.companyId);
        const company = requireEntry(state.companies.find((entry) => entry.id === command.companyId));
        if (company.status !== "active") throw new Error("La empresa está archivada.");
        const previous = command.id ? requireEntry(siblings.find((account) => account.id === id)) : undefined;
        const core=coreState(state);
        if(previous&&core.lines.some(l=>l.account_id===previous.id)&&(previous.kind!==command.values.kind||previous.parent_code!==command.values.parent_code))throw new Error('Clasificación histórica de cuenta con Diario confirmado.');
        if(command.values.parent_code&&state.accounts.some(a=>a.company_id===company.id&&a.code===command.values.parent_code&&core.lines.some(l=>l.account_id===a.id)))throw new Error('La cuenta superior ya tiene movimientos confirmados.');
        if (previous && (previous.kind !== command.values.kind || previous.category !== command.values.category) && state.vouchers.some((voucher) => voucher.account_id === id && state.periods.some((period) => period.id === voucher.period_id && period.status === "closed"))) {
          throw new Error("La cuenta tiene comprobantes en períodos cerrados.");
        }
        if (siblings.some((account) => account.code === command.values.code && account.id !== id)) throw new Error("El código de cuenta ya existe.");
        const parentByCode = new Map(siblings.map((account) => [account.code, account.parent_code]));
        let parent = command.values.parent_code;
        const seen = new Set([command.values.code]);
        while (parent) {
          if (seen.has(parent)) throw new Error("La jerarquía de cuentas forma un ciclo.");
          if (!parentByCode.has(parent)) throw new Error("La cuenta superior no existe.");
          seen.add(parent);
          parent = parentByCode.get(parent) ?? null;
        }
        const record = { id, organization_id: org.id, company_id: command.companyId, ...command.values };
        return withEvent({ ...state, accounts: reorder(state.accounts, record) }, "accounts", id, command.companyId, null, action);
      }
      case "voucher.classify": {
        const previous = requireEntry(state.vouchers.find((voucher) => voucher.id === id));
        openPeriod(state, previous.period_id);
        const vat = cents(previous.vat);
        const deductible = command.values.deductible_vat === null ? null : cents(command.values.deductible_vat);
        if (deductible !== null && (previous.direction !== "purchase" || deductible < (vat < 0n ? vat : 0n) || deductible > (vat > 0n ? vat : 0n))) {
          throw new Error("El crédito fiscal computable supera el IVA del comprobante.");
        }
        const voucher = { ...previous, ...command.values };
        let rules = state.rules;
        if (command.saveRule && (voucher.review_status !== "approved" || !voucher.counterparty_cuit || !(voucher.account_id || voucher.category || voucher.concept || voucher.cost_center))) throw new Error("La sugerencia requiere un comprobante aprobado, CUIT e imputación.");
        if (command.saveRule && voucher.counterparty_cuit) {
          const existing = rules.find((rule) => rule.company_id === voucher.company_id && rule.direction === voucher.direction && rule.counterparty_cuit === voucher.counterparty_cuit);
          rules = reorder(rules, { id: existing?.id ?? crypto.randomUUID(), company_id: voucher.company_id, direction: voucher.direction, counterparty_cuit: voucher.counterparty_cuit, account_id: voucher.account_id, category: voucher.category, concept: voucher.concept, cost_center: voucher.cost_center });
        }
        return withEvent({ ...state, rules, vouchers: reorder(state.vouchers, voucher) }, "vouchers", id, voucher.company_id, voucher.period_id, action);
      }
      case "organization.settings": {
        const organization = { ...org, ...command.values };
        return { ...state, organization, organizations: [organization] };
      }
      case "obligation.save": {
        const period = openPeriod(state, command.periodId);
        if (command.id) requireEntry(state.obligations.find((entry) => entry.id === id && entry.period_id === period.id));
        const record = { id, company_id: period.company_id, period_id: period.id, title: command.title, due_on: command.dueOn, amount: command.amount, status: command.status, filed_on: command.filedOn, paid_on: command.paidOn, document_id: command.documentId, notes: withFiscalRule(command.notes,command.recurrence) };
        return withEvent({ ...state, obligations: reorder(state.obligations, record) }, "tax_obligations", id, period.company_id, period.id, action);
      }
      case 'core.exercise':case 'core.profile':case 'core.post':case 'core.reverse':case 'core.exercise.status':throw new Error('Comando de núcleo ya procesado.');
      case "organization.create":
      case "organization.member":
        throw new Error("La gestión de usuarios y organizaciones está disponible con Supabase conectado.");
    }
  });
  return { id };
}

type StoredDocument = { bytes: ArrayBuffer; mime: string };
const portableDocuments = new Map<string, StoredDocument>();

async function fileStore<T>(mode: IDBTransactionMode, operation: (store: IDBObjectStore) => IDBRequest<T>) {
  const database = await new Promise<IDBDatabase>((resolve, reject) => {
    const request = indexedDB.open("sofia-demo-files", 1);
    request.onupgradeneeded = () => request.result.createObjectStore("documents");
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(new Error("No se pudo abrir el almacenamiento de documentos del navegador."));
  });
  try {
    return await new Promise<T>((resolve, reject) => {
      const transaction = database.transaction("documents", mode);
      const request = operation(transaction.objectStore("documents"));
      transaction.oncomplete = () => resolve(request.result);
      transaction.onabort = () => reject(new Error("No se pudo completar la operación con el archivo en el navegador."));
    });
  } finally { database.close(); }
}

async function writeLocalDocument(initial: WorkspaceState, periodId: string, category: string, file: File, update?: (state: WorkspaceState, document: Document) => WorkspaceState) {
  const verified = await verifyDocument(file);
  const id = crypto.randomUUID();
  const original: StoredDocument = { bytes: await file.arrayBuffer(), mime: verified.mime };
  const portable = window.location.protocol === "file:";
  if (portable) portableDocuments.set(id, original);
  else await fileStore("readwrite", (store) => store.put(original, id));
  try {
    changeLocal(initial, (state) => {
      const period = openPeriod(state, periodId);
      const document: Document = {
        id, organization_id: period.organization_id, company_id: period.company_id, period_id: period.id, name: verified.name,
        category, storage_path: id, mime_type: verified.mime, size_bytes: file.size, created_at: new Date().toISOString(),
      };
      const next = { ...state, documents: [...state.documents, document] };
      return update ? update(next, document) : withEvent(next, "documents", id, period.company_id, period.id, "INSERT");
    });
  } catch (error) {
    if (portable) portableDocuments.delete(id);
    else await fileStore("readwrite", (store) => store.delete(id)).catch(() => undefined);
    throw error;
  }
  return { id };
}

export function uploadLocalDocument(initial: WorkspaceState, periodId: string, category: string, file: File) {
  return writeLocalDocument(initial, periodId, category, file);
}

async function storedLocalDocument(id: string) {
  const stored = window.location.protocol === "file:" ? portableDocuments.get(id)
    : await fileStore("readonly", (store) => store.get(id)) as StoredDocument | Blob | undefined;
  const original = requireEntry(stored, "El archivo no está disponible en este navegador.");
  return original instanceof Blob ? original : new Blob([original.bytes], { type: original.mime });
}

export async function readLocalDocument(document: Document) {
  return new File([await storedLocalDocument(document.id)],document.name,{type:document.mime_type});
}

export async function downloadLocalDocument(id: string) {
  return URL.createObjectURL(await storedLocalDocument(id));
}

type LocalImport = { file: File; kind: ImportKind; mapping: ColumnMapping; decimal: "auto" | "comma" | "point" };

export async function confirmLocalImport(initial: WorkspaceState, periodId: string, input: LocalImport) {
  const current = decodeLocal(localSnapshot(), initial);
  const period = openPeriod(current, periodId);
  const buffer = await input.file.arrayBuffer();
  const fileHash = Array.from(new Uint8Array(await crypto.subtle.digest("SHA-256", buffer)), (byte) => byte.toString(16).padStart(2, "0")).join("");
  const kind = { purchases: "purchase", sales: "sale", accounts: "accounts" }[input.kind] as WorkspaceState["imports"][number]["kind"];
  const existing = current.imports.find((entry) => (kind==='accounts'?entry.company_id===period.company_id:entry.period_id===periodId) && entry.kind === kind && entry.file_sha256 === fileHash);
  if (existing) return { row_count: existing.row_count, duplicate_count: existing.duplicate_count, reused: true };
  const source = await readSource(buffer, input.file.name);
  if(source.owner_cuit && input.kind!=='accounts' && current.companies.find(c=>c.id===period.company_id)?.cuit!==source.owner_cuit)throw new Error("El CUIT del archivo ARCA no coincide con la empresa seleccionada.");
  const preview = previewImport(input.kind, source, input.mapping, { month: period.month.slice(0, 7), decimal: input.decimal });
  if (preview.issues.some((issue) => issue.severity === "error")) throw new Error("Revisá las filas con errores antes de importar.");
  let outcome = { row_count: 0, duplicate_count: 0, reused: false };
  await writeLocalDocument(initial, periodId, kind === "accounts" ? "Plan de cuentas" : "Comprobantes", input.file, (state, document) => {
    const currentImport = state.imports.find((entry) => (kind==='accounts'?entry.company_id===period.company_id:entry.period_id===periodId) && entry.kind === kind && entry.file_sha256 === fileHash);
    if (currentImport) throw new Error("El archivo ya se importó en otra pestaña. Volvé a consultar el historial.");
    const currentAccounts = state.accounts.filter((account) => account.company_id === period.company_id);
    const allowedParents = new Set([...currentAccounts, ...preview.accounts].map((account) => account.code));
    if (preview.accounts.some((account) => account.parent_code && !allowedParents.has(account.parent_code))) throw new Error("El archivo referencia cuentas superiores que no existen.");
    const newAccounts = preview.accounts.filter((account) => !currentAccounts.some((existingAccount) => existingAccount.code === account.code))
      .map((account) => ({ ...account, id: crypto.randomUUID(), company_id: period.company_id, organization_id: period.organization_id }));
    const newVouchers = preview.vouchers.filter((voucher) => !state.vouchers.some((entry) =>
      entry.company_id === period.company_id && entry.direction === voucher.direction &&
      entry.point_of_sale === voucher.point_of_sale && entry.receipt_number === voucher.receipt_number &&
      entry.receipt_type.trim().toLowerCase() === voucher.receipt_type.trim().toLowerCase() &&
      (voucher.direction === "sale" || entry.counterparty_cuit === voucher.counterparty_cuit),
    )).map((voucher) => ({
      ...defaultClassification, ...voucher, vat_breakdown: voucher.vat_breakdown ?? {}, document_id: document.id, id: crypto.randomUUID(),
      company_id: period.company_id, organization_id: period.organization_id, period_id: period.id,
    }));
    const id = crypto.randomUUID();
    const rowCount = newAccounts.length + newVouchers.length;
    const duplicateCount = preview.accounts.length + preview.vouchers.length - rowCount + preview.duplicates;
    outcome = { row_count: rowCount, duplicate_count: duplicateCount, reused: false };
    const imports = [...state.imports, {
      id, company_id: period.company_id, period_id: period.id, kind, document_id: document.id, file_sha256: fileHash,
      row_count: rowCount, duplicate_count: duplicateCount, created_at: document.created_at,
    }];
    return withEvent({ ...state, imports, accounts: [...state.accounts, ...newAccounts], vouchers: [...state.vouchers, ...newVouchers] }, "imports", id, period.company_id, period.id, "INSERT");
  });
  return outcome;
}
