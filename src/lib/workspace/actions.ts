"use server";

import { createHash, randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { previewImport, readSource } from "@/lib/imports";
import { getWorkspaceAccess } from "@/lib/supabase/access";
import { verifyDocument } from "./documents";
import { validateBook } from "@/lib/accounting/engine";
import { loadWorkspace } from "./queries";
import { commandSchema, documentContextSchema, importOptionsSchema } from "./validation";
import type { Document } from './model';

type Result<T> = { ok: true; data: T } | { ok: false; message: string };
type ImportOutcome = { row_count: number; duplicate_count: number; reused: boolean };
type DbError = { code?: string; message: string };

const bucket = "accounting-documents";
class WorkspaceError extends Error {}

async function liveAccess() {
  const access = await getWorkspaceAccess();
  if (access?.mode !== "auth") throw new WorkspaceError("Ingresá con una cuenta autorizada.");
  return access;
}

function failure(error: unknown): { ok: false; message: string } {
  if (error instanceof z.ZodError) return { ok: false, message: error.issues[0]?.message ?? "Revisá los campos." };
  if (error instanceof WorkspaceError) return { ok: false, message: error.message };
  return { ok: false, message: "No se pudo completar la operación. Revisá los datos e intentá de nuevo." };
}

function checked<T>(result: { data: T; error: DbError | null }): NonNullable<T> {
  if (result.error || !result.data) {
    const error = result.error;
    if (error?.code === "23505") throw new WorkspaceError("Ya existe un registro con esos datos.");
    if (error?.code === "23503") throw new WorkspaceError("Falta un registro relacionado o pertenece a otro contexto.");
    if (error?.code === "42501" || error?.code === "PGRST116") throw new WorkspaceError("El registro no está disponible o no tenés permisos para modificarlo.");
    if (error?.code === "55000" || error?.code === "P0001" || error?.code === "22023" || error?.code === "23514") {
      if (/cuenta tiene comprobantes/i.test(error.message)) throw new WorkspaceError("La cuenta tiene comprobantes en períodos cerrados. Reabrí los períodos afectados para cambiar su clasificación.");
      if (/archivad/i.test(error.message)) throw new WorkspaceError("La empresa está archivada. Reactivala para hacer cambios.");
      if (/regla.*requiere/i.test(error.message)) throw new WorkspaceError("La sugerencia requiere un comprobante aprobado, CUIT e imputación.");
      if (/closed|cerrado/i.test(error.message)) throw new WorkspaceError("El período está cerrado. Reabrilo para hacer cambios.");
      if (/reason|motivo/i.test(error.message)) throw new WorkspaceError("Ingresá el motivo del cambio de estado.");
      if (/last owner|últim[oa]|al menos un propietario/i.test(error.message)) throw new WorkspaceError("La organización debe conservar al menos una persona propietaria.");
      throw new WorkspaceError("Los datos no cumplen las reglas del registro. Revisá el período y las relaciones.");
    }
    throw new WorkspaceError("No se pudo guardar el registro.");
  }
  return result.data;
}

async function periodScope(client: SupabaseClient, id: string) {
  return checked(await client.from("periods").select("id,organization_id,company_id,month,status").eq("id", id).single());
}

async function companyScope(client: SupabaseClient, id: string) {
  return checked(await client.from("companies").select("id,organization_id,cuit").eq("id", id).single());
}

async function saveRecord(client: SupabaseClient, table: string, id: string | undefined, values: Record<string, unknown>, scope?: [string, string]) {
  if (!id) return checked(await client.from(table).insert(values).select("id").single());
  let query = client.from(table).update(values).eq("id", id);
  if (scope) query = query.eq(...scope);
  return checked(await query.select("id").single());
}

export async function mutateWorkspace(input: unknown): Promise<Result<{ id?: string }>> {
  const result = await performWorkspaceMutation(input);
  if (result.ok) revalidatePath('/[section]', 'page');
  return result;
}

async function performWorkspaceMutation(input: unknown): Promise<Result<{ id?: string }>> {
  try {
    const { supabase, userId } = await liveAccess();
    const command = commandSchema.parse(input);
    switch (command.type) {
      case "book.import": {
        const period=await periodScope(supabase,command.periodId);
        const state=await loadWorkspace(supabase,userId,period.organization_id);
        const company=state.companies.find(c=>c.id===period.company_id);
        if(!company || !state.accountingReady) throw new WorkspaceError("Primero activá el libro operativo en Supabase.");
        try {
          for(const input of command.values) {
            if(!input.document_id || !["opening","statement"].includes(input.kind)) throw new Error("El lote requiere respaldo y un tipo de importación admitido.");
            const payload=validateBook(state,company,period.id,input);
            state.bookRecords.push({id:randomUUID(),organization_id:period.organization_id,company_id:company.id,period_id:period.id,payload});
          }
        }catch(e){throw new WorkspaceError(e instanceof Error?e.message:"Lote inválido.");}
        checked(await supabase.rpc("save_book_batch",{target_period:period.id,record_payloads:command.values}));
        return {ok:true,data:{}};
      }
      case "book.save": {
        const period = await periodScope(supabase, command.periodId);
        const state = await loadWorkspace(supabase,userId,period.organization_id);
        const company = state.companies.find(c=>c.id===period.company_id);
        if(!company || !state.accountingReady) throw new WorkspaceError("Primero activá la migración del libro operativo en Supabase.");
        let payload;
        try { payload=validateBook(state,company,period.id,command.values,command.id); }
        catch(e){ throw new WorkspaceError(e instanceof Error ? e.message : "Revisá el registro."); }
        const id = checked(await supabase.rpc("save_book_record", { target_period: period.id, target_id: command.id ?? null, record_payload: payload }));
        return {ok:true,data:{id}};
      }
      case "book.void": {
        checked(await supabase.rpc("void_book_record",{target_id:command.id}));
        return {ok:true,data:{id:command.id}};
      }
      case "company.save": {
        const values = { ...command.values, fiscal_year_end: command.values.fiscal_year_end || null };
        const row = await saveRecord(supabase, "companies", command.id,
          command.id ? values : { ...values, organization_id: command.organizationId }, ["organization_id", command.organizationId]);
        return { ok: true, data: row };
      }
      case "company.status":
        return { ok: true, data: await saveRecord(supabase, "companies", command.id, { status: command.status }) };
      case "period.ensure": {
        const result = checked(await supabase.rpc("ensure_period", { target_company: command.companyId, target_month: `${command.month}-01` }));
        return { ok: true, data: { id: result.id } };
      }
      case "period.status": {
        const result = checked(await supabase.rpc("set_period_status", { target_period: command.id, target_status: command.status, reason: command.reason }));
        return { ok: true, data: { id: result.id } };
      }
      case "task.save": {
        const period = await periodScope(supabase, command.periodId);
        const values = { title: command.title, status: command.status, notes: command.notes, document_id: command.documentId };
        if (command.id) return { ok: true, data: await saveRecord(supabase, "close_tasks", command.id, values, ["period_id", period.id]) };
        const result = await supabase.from("close_tasks").select("position").eq("period_id", period.id).order("position", { ascending: false }).limit(1);
        const position = (checked(result)[0]?.position ?? 0) + 1;
        return { ok: true, data: await saveRecord(supabase, "close_tasks", undefined, {
          ...values, organization_id: period.organization_id, company_id: period.company_id, period_id: period.id, position,
        }) };
      }
      case "account.save": {
        const { code, ...values } = command.values;
        const company = await companyScope(supabase, command.companyId);
        return { ok: true, data: await saveRecord(supabase, "accounts", command.id,
          command.id ? values : { ...values, code, organization_id: company.organization_id, company_id: company.id }, ["company_id", company.id]) };
      }
      case "voucher.classify": {
        const id = checked(await supabase.rpc("update_voucher_classification", {
          target_voucher: command.id, classification: command.values, save_rule: command.saveRule,
        }));
        return { ok: true, data: { id } };
      }
      case "organization.create": {
        const result = checked(await supabase.rpc("create_organization", { organization_name: command.name }));
        return { ok: true, data: { id: typeof result === "string" ? result : result.id } };
      }
      case "organization.member": {
        const result = await supabase.rpc("set_organization_member", {
          target_organization: command.organizationId, target_user: command.userId, member_role: command.role,
        });
        if (result.error) checked(result);
        return { ok: true, data: {} };
      }
      case "organization.settings":
        return { ok: true, data: await saveRecord(supabase, "organizations", command.id, command.values) };
      case "obligation.save": {
        const period = await periodScope(supabase, command.periodId);
        const values = { title: command.title, due_on: command.dueOn, amount: command.amount, status: command.status, filed_on: command.filedOn, paid_on: command.paidOn, document_id: command.documentId, notes: command.notes };
        return { ok: true, data: await saveRecord(supabase, "tax_obligations", command.id,
          command.id ? values : { ...values, organization_id: period.organization_id, company_id: period.company_id, period_id: period.id }, ["period_id", period.id]) };
      }
    }
  } catch (error) {
    return failure(error);
  }
}

async function readFile(form: FormData) {
  const file = form.get("file");
  if (!(file instanceof File)) throw new WorkspaceError("Seleccioná un archivo.");
  try {
    return { file, ...await verifyDocument(file) };
  } catch (error) {
    throw new WorkspaceError(error instanceof Error ? error.message : "No se pudo verificar el archivo.");
  }
}

async function storeFile(
  access: Awaited<ReturnType<typeof liveAccess>>,
  context: { companyId: string; periodId: string; category: string },
  verified: Awaited<ReturnType<typeof readFile>>,
) {
  const period = await periodScope(access.supabase, context.periodId);
  if (period.company_id !== context.companyId) throw new WorkspaceError("Seleccioná una empresa y un período compatibles.");
  if (period.status === "closed") throw new WorkspaceError("El período está cerrado.");
  const id = randomUUID();
  const storagePath = `${period.organization_id}/${period.company_id}/${period.id}/${id}`;
  const storage = access.supabase.storage.from(bucket);
  try {
    const uploaded = await storage.upload(storagePath, await verified.file.arrayBuffer(), { contentType: verified.mime, upsert: false });
    if (uploaded.error) throw new WorkspaceError("No se pudo guardar el original. Revisá tus permisos y el tamaño del archivo.");
    return checked(await access.supabase.from("documents").insert({
      id, organization_id: period.organization_id, company_id: period.company_id, period_id: period.id,
      name: verified.name, category: context.category, storage_path: storagePath, mime_type: verified.mime,
      size_bytes: verified.file.size,
    }).select("id").single());
  } catch (error) {
    await storage.remove([storagePath]);
    throw error;
  }
}

function parseContext(form: FormData) {
  const serialized = form.get("context");
  if (typeof serialized !== "string" || serialized.length > 8000) throw new WorkspaceError("El contexto del archivo es inválido.");
  try { return JSON.parse(serialized) as unknown; }
  catch { throw new WorkspaceError("El contexto del archivo es inválido."); }
}

export async function uploadWorkspaceDocument(form: FormData): Promise<Result<{ id: string }>> {
  try {
    const access = await liveAccess();
    const context = documentContextSchema.parse(parseContext(form));
    const data = await storeFile(access, context, await readFile(form));
    revalidatePath('/[section]', 'page');
    return { ok: true, data };
  } catch (error) { return failure(error); }
}

export async function downloadWorkspaceDocument(rawId: string): Promise<Result<{ url: string }>> {
  try {
    const access = await liveAccess();
    const id = z.uuid().parse(rawId);
    const document = checked(await access.supabase.from("documents").select("name,storage_path").eq("id", id).single());
    const { signedUrl } = checked(await access.supabase.storage.from(bucket).createSignedUrl(document.storage_path, 60, { download: document.name }));
    return { ok: true, data: { url: signedUrl } };
  } catch (error) { return failure(error); }
}

export async function listWorkspaceDocuments(companyId:string,periodId:string):Promise<Result<Document[]>>{
  try{
    const access=await liveAccess();const period=await periodScope(access.supabase,z.uuid().parse(periodId));
    if(period.company_id!==z.uuid().parse(companyId))throw new WorkspaceError('Empresa y período incompatibles.');
    const rows:Document[]=[];
    for(let offset=0;;offset+=500){const batch=checked(await access.supabase.from('documents').select('*').eq('company_id',companyId).eq('period_id',periodId).order('id').range(offset,offset+499)) as Document[];rows.push(...batch);if(batch.length<500)return {ok:true,data:rows};}
  }catch(error){return failure(error);}
}

export async function confirmWorkspaceImport(form: FormData): Promise<Result<ImportOutcome>> {
  const result = await performWorkspaceImport(form);
  if (result.ok) revalidatePath('/[section]', 'page');
  return result;
}

async function performWorkspaceImport(form: FormData): Promise<Result<ImportOutcome>> {
  try {
    const access = await liveAccess();
    const context = importOptionsSchema.parse(parseContext(form));
    const period = await periodScope(access.supabase, context.periodId);
    if (period.company_id !== context.companyId || period.status !== "open") throw new WorkspaceError("Seleccioná un período abierto de la empresa.");
    const verified = await readFile(form);
    const buffer = await verified.file.arrayBuffer();
    const fileHash = createHash("sha256").update(Buffer.from(buffer)).digest("hex");
    let table;
    try { table = await readSource(buffer, verified.name); }
    catch (error) { throw new WorkspaceError(error instanceof Error ? error.message : "No se pudo leer el archivo."); }
    if (table.owner_cuit && context.kind !== 'accounts') {
      const company = await companyScope(access.supabase,context.companyId);
      if(company.cuit !== table.owner_cuit)throw new WorkspaceError("El CUIT del archivo ARCA no coincide con la empresa seleccionada.");
    }
    const preview = previewImport(context.kind, table, context.mapping, { month: period.month.slice(0, 7), decimal: context.decimal });
    if (preview.issues.some((issue) => issue.severity === "error")) throw new WorkspaceError("La importación tiene filas inválidas. Revisá el mapeo y el archivo.");
    const normalized = context.kind === "accounts" ? preview.accounts : preview.vouchers;
    if (!normalized.length) throw new WorkspaceError("No se encontraron filas para importar.");
    const kind = { purchases: "purchase", sales: "sale", accounts: "accounts" }[context.kind];
    const previous = access.supabase.from("imports").select("row_count,duplicate_count")
      .eq(context.kind === 'accounts' ? "company_id" : "period_id", context.kind === 'accounts' ? context.companyId : context.periodId)
      .eq("kind", kind).eq("file_sha256", fileHash);
    const existing = await previous.limit(1).maybeSingle();
    if (existing.error) throw new WorkspaceError("No se pudo verificar el historial de importaciones.");
    if (existing.data) return { ok: true, data: { ...existing.data, reused: true } };
    const document = await storeFile(access, {
      ...context, category: context.kind === "accounts" ? "Plan de cuentas" : "Comprobantes",
    }, verified);
    const result = checked(await access.supabase.rpc("confirm_import", {
      target_period: context.periodId, source_document: document.id, import_kind: kind, file_sha256: fileHash, normalized_rows: normalized, source_duplicates: preview.duplicates,
    }));
    return { ok: true, data: result as ImportOutcome };
  } catch (error) { return failure(error); }
}
