"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Building2, ClipboardCheck, FileText, Lock, Pencil, Plus, Unlock } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { useForm } from "react-hook-form";
import { companyName, cuitLabel, initials, monthLabel, taskProgress } from "@/lib/workspace/format";
import { periodRows } from "@/lib/workspace/insights";
import { taskStatuses, type Company, type CompanyValues, type Task } from "@/lib/workspace/model";
import { companySchema } from "@/lib/workspace/validation";
import { useWorkspace } from "./workspace-context";
import { ActionForm, Badge, Empty, Field, Heading, Input, Modal, Progress, Search, SectionHeading, Select, TaskBadge, fieldValue, optionalValue } from "./workspace-ui";

const provinces = ["Buenos Aires", "Ciudad Autónoma de Buenos Aires", "Catamarca", "Chaco", "Chubut", "Córdoba", "Corrientes", "Entre Ríos", "Formosa", "Jujuy", "La Pampa", "La Rioja", "Mendoza", "Misiones", "Neuquén", "Río Negro", "Salta", "San Juan", "San Luis", "Santa Cruz", "Santa Fe", "Santiago del Estero", "Tierra del Fuego", "Tucumán"];

function CompanyForm({ company, close }: { company?: Company; close: () => void }) {
  const { state, mutate } = useWorkspace();
  const [error, setError] = useState("");
  const org = state.organization!;
  const {
    register, handleSubmit, formState: { errors, isSubmitting },
  } = useForm<CompanyValues>({
    resolver: zodResolver(companySchema),
    defaultValues: company ?? {
      legal_name: "", trade_name: "", cuit: "", entity_type: "", activity: "", tax_address: "",
      province: "Tucumán", vat_status: "", gross_income_regime: "", start_date: null, fiscal_year_end: "",
      employee_count: 0, currency: org.currency, tax_obligations: "", notes: "",
    },
  });
  const submit = handleSubmit(async (values) => {
    setError("");
    try { await mutate({ type: "company.save", organizationId: org.id, id: company?.id, values }, company ? "Empresa actualizada." : "Empresa creada."); close(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar la empresa."); }
  });

  return <Modal title={company ? "Editar empresa" : "Nueva empresa"} description="Datos de identificación y perfil fiscal." close={close}>
    <form onSubmit={submit} noValidate>
      <fieldset className="form-grid" disabled={isSubmitting}>
        <Field label="Razón social"><Input {...register("legal_name")} required maxLength={160} aria-invalid={!!errors.legal_name} /></Field>
        <Field label="Nombre comercial"><Input {...register("trade_name")} maxLength={100} /></Field>
        <Field label="CUIT"><Input {...register("cuit")} required inputMode="numeric" placeholder="30-00000000-0" aria-invalid={!!errors.cuit} /></Field>
        <Field label="Tipo societario"><Input {...register("entity_type")} placeholder="Por ejemplo, S.A.S." maxLength={60} /></Field>
        <Field label="Actividad económica" span><Input {...register("activity")} maxLength={180} /></Field>
        <Field label="Domicilio fiscal"><Input {...register("tax_address")} maxLength={200} /></Field>
        <Field label="Provincia"><Select {...register("province")}><option value="">Sin definir</option>{provinces.map((name) => <option key={name}>{name}</option>)}</Select></Field>
        <Field label="Condición frente al IVA"><Input {...register("vat_status")} placeholder="Por ejemplo, responsable inscripto" maxLength={60} /></Field>
        <Field label="Régimen de Ingresos Brutos"><Input {...register("gross_income_regime")} placeholder="Por ejemplo, local" maxLength={80} /></Field>
        <Field label="Inicio de actividades"><Input {...register("start_date", { setValueAs: (value: string) => value || null })} type="date" /></Field>
        <Field label="Cierre de ejercicio (mes-día)"><Input {...register("fiscal_year_end")} placeholder="12-31" maxLength={5} /></Field>
        <Field label="Cantidad de empleados"><Input {...register("employee_count", { valueAsNumber: true })} type="number" min={0} max={1000000} required /></Field>
        <Field label="Moneda"><Input {...register("currency")} required maxLength={3} autoCapitalize="characters" /></Field>
        <Field label="Obligaciones fiscales" span><textarea className="control" {...register("tax_obligations")} maxLength={2000} /></Field>
        <Field label="Observaciones" span><textarea className="control" {...register("notes")} maxLength={4000} /></Field>
      </fieldset>
      {(error || Object.keys(errors).length > 0) && <div className="notice notice-error" role="alert">{error || Object.values(errors).map((entry) => entry.message).filter(Boolean).join(". ")}</div>}
      <div className="form-actions"><button type="button" className="button button-secondary" onClick={close} disabled={isSubmitting}>Cancelar</button>
        <button type="submit" className="button button-primary" disabled={isSubmitting}>{isSubmitting ? "Guardando…" : company ? "Guardar empresa" : "Crear empresa"}</button></div>
    </form>
  </Modal>;
}

export function CompaniesPage({ openNew = false }: { openNew?: boolean }) {
  const { state, canEdit, href, mutate } = useWorkspace();
  const [surface, setSurface] = useState<"new" | Company | null>(openNew ? "new" : null);
  const [archive, setArchive] = useState<Company | null>(null);
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("active");
  const query = search.toLowerCase();
  const companies = state.companies.filter((company) => (status === "all" || company.status === status) &&
    `${company.legal_name} ${company.trade_name} ${cuitLabel(company.cuit)} ${company.cuit}`.toLowerCase().includes(query));
  return <>
    <Heading title="Empresas" description="Administrá los datos y el estado de cada cliente del estudio."
      actions={canEdit && <button type="button" className="button button-primary" onClick={() => setSurface("new")}><Plus size={17} /> Nueva empresa</button>} />
    <section className="panel">
      <div className="table-toolbar"><Search label="Buscar por nombre o CUIT" value={search} onChange={setSearch} />
        <Select aria-label="Estado de empresa" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="active">Activas</option><option value="archived">Archivadas</option><option value="all">Todas</option>
        </Select></div>
      {companies.length ? <div className="table-wrap"><table>
        <thead><tr><th>Empresa</th><th>CUIT</th><th>Provincia</th><th>Estado</th><th className="text-right">Acciones</th></tr></thead>
        <tbody>{companies.map((company, index) => <tr key={company.id}>
          <td className="cell-main"><div className="flex items-center gap-2"><span className={`avatar tone-${index % 3}`} aria-hidden="true">{initials(companyName(company))}</span>
            <span><strong>{companyName(company)}</strong><small>{company.legal_name}</small></span></div></td>
          <td className="cell-nowrap numbers">{cuitLabel(company.cuit)}</td><td>{company.province || "—"}</td>
          <td><Badge tone={company.status === "active" ? "positive" : "neutral"} dot>{company.status === "active" ? "Activa" : "Archivada"}</Badge></td>
          <td><div className="table-actions"><Link className="button button-secondary" href={href("inicio", { companyId: company.id })}>Abrir</Link>
            {canEdit && <><button type="button" className="button button-secondary" onClick={() => setSurface(company)} aria-label={`Editar ${companyName(company)}`}><Pencil size={15} /> Editar</button>
              <button type="button" className="button button-secondary" onClick={() => setArchive(company)}>{company.status === "active" ? "Archivar" : "Reactivar"}</button></>}
          </div></td>
        </tr>)}</tbody>
      </table></div> : <Empty icon={Building2} title={search ? "Sin coincidencias" : "Todavía no hay empresas con este estado"} text={search ? "Probá con otro nombre o CUIT." : undefined} />}
    </section>
    {surface && canEdit && <CompanyForm company={surface === "new" ? undefined : surface} close={() => setSurface(null)} />}
    {archive && <Modal title={archive.status === "active" ? "Archivar empresa" : "Reactivar empresa"} description={companyName(archive)} close={() => setArchive(null)}>
      <ActionForm close={() => setArchive(null)} label={archive.status === "active" ? "Archivar empresa" : "Reactivar empresa"} submit={async () => {
        await mutate({ type: "company.status", id: archive.id, status: archive.status === "active" ? "archived" : "active" });
      }}><p className="muted field-wide">{archive.status === "active" ? "La empresa pasará al listado de archivadas. Su historial seguirá disponible para consulta." : "La empresa volverá al listado activo y podrá iniciar períodos."}</p></ActionForm>
    </Modal>}
  </>;
}

export function CompanyRequired({ description }: { description?: string }) {
  const { href, state } = useWorkspace();
  const active = state.companies.filter((company) => company.status === "active");
  return <section className="panel"><Empty icon={Building2} title="Elegí una empresa"
    text={description ?? "Seleccioná una empresa en la barra superior para continuar."}
    action={active.length === 0 ? <Link className="button button-secondary" href={href("empresas")}>Ver empresas</Link> : undefined} /></section>;
}

export function PeriodRequired() {
  const { company, canEdit, month, mutate, locale } = useWorkspace();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  if (!company) return <CompanyRequired />;
  return <section className="panel">
    <Empty icon={ClipboardCheck} title="Período sin iniciar" text={`Abrí ${monthLabel(month, locale).toLowerCase()} para preparar el checklist de esta empresa.`}
      action={canEdit && company.status === "active" && <button type="button" className="button button-primary" disabled={pending} onClick={async () => {
        setPending(true);
        setError("");
        try { await mutate({ type: "period.ensure", companyId: company.id, month }, "Período iniciado."); }
        catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo iniciar el período."); }
        finally { setPending(false); }
      }}><Plus size={17} /> {pending ? "Iniciando…" : "Iniciar período"}</button>} />
    {error && <p className="notice notice-error" role="alert">{error}</p>}
  </section>;
}

export function ClosingPage() {
  const { state, company, period, month, canEdit, locale, href, mutate, download } = useWorkspace();
  const [task, setTask] = useState<Task | "new" | null>(null);
  const [periodDialog, setPeriodDialog] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [error, setError] = useState("");
  const periodTasks = period ? state.tasks.filter((entry) => entry.period_id === period.id).sort((a, b) => a.position - b.position || a.id.localeCompare(b.id)) : [];
  const progress = taskProgress(periodTasks);
  const editable = canEdit && period?.status === "open" && company?.status === "active";
  const currentTask = task && task !== "new" ? task : undefined;
  const docs = state.documents.filter((entry) => entry.period_id === period?.id);
  const tasks = periodTasks.filter((entry) => (!filter || entry.status === filter) && entry.title.toLowerCase().includes(search.toLowerCase()));
  return <>
    <Heading title="Cierre mensual" description={`${company ? companyName(company) + " · " : ""}${monthLabel(month, locale)}`}
      actions={period && canEdit && company?.status === "active" && <>{editable && <button type="button" className="button button-secondary" onClick={() => setTask("new")}><Plus size={17} /> Nueva tarea</button>}
        <button type="button" className="button button-primary" onClick={() => setPeriodDialog(true)}>{period.status === "open" ? <Lock size={16} /> : <Unlock size={16} />}{period.status === "open" ? "Cerrar período" : "Reabrir período"}</button></>} />
    {!company && <section className="panel">
      <SectionHeading title="Cierres por empresa" icon={ClipboardCheck} />
      {state.companies.some((entry) => entry.status === "active") ? <ul className="data-list close-rows">
        {periodRows(state, month).map((row) => <li key={row.company.id}><Link className="data-row" href={href("cierre", { companyId: row.company.id })}>
          <span className="avatar" aria-hidden="true">{initials(companyName(row.company))}</span><span className="data-main">
            <strong>{companyName(row.company)}</strong><small>{row.period ? `${row.progress.complete} de ${row.progress.total} tareas aplicables` : "Período sin iniciar"}</small></span>
          <Badge dot tone={row.period?.status === "closed" ? "positive" : "neutral"}>{row.period?.status === "closed" ? "Cerrado" : row.period ? "Abierto" : "Sin iniciar"}</Badge>
        </Link></li>)}
      </ul> : <Empty icon={Building2} title="No hay empresas activas" action={<Link className="button button-secondary" href={href("empresas")}>Ver empresas</Link>} />}
    </section>}
    {company && !period && <PeriodRequired />}
    {period && <>
      <section className="panel closing-summary">
        <div className="flex flex-wrap justify-between gap-2"><h2>Avance del checklist</h2><Badge tone={period.status === "closed" ? "positive" : "accent"} dot>{period.status === "closed" ? "Período cerrado" : "Período abierto"}</Badge></div>
        <div className="flex flex-wrap items-center justify-between gap-2"><p className="muted text-sm">{progress.complete} de {progress.total} tareas aplicables completadas</p><strong className="numbers">{progress.percent}%</strong></div>
        <Progress value={progress.percent} label="Avance de cierre mensual" />
      </section>
      <section className="panel">
        <SectionHeading title="Checklist del período" subtitle="Controlá el estado de cada tarea y vinculá sus respaldos." icon={ClipboardCheck} />
        {error && <p className="notice notice-error mb-3" role="alert">{error}</p>}
        <div className="table-toolbar"><Search label="Buscar tarea" value={search} onChange={setSearch} />
          <Select aria-label="Estado de tarea" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todos los estados</option>
            {Object.entries(taskStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
        </div>
        {tasks.length ? <div className="table-wrap"><table>
          <thead><tr><th>Tarea</th><th>Estado</th><th>Documento</th><th className="text-right">Acciones</th></tr></thead>
          <tbody>{tasks.map((entry) => {
            const doc = docs.find((item) => item.id === entry.document_id);
            return <tr key={entry.id}>
              <td className="cell-main"><strong>{entry.title}</strong>{entry.notes && <small>{entry.notes}</small>}</td>
              <td><TaskBadge status={entry.status} /></td>
              <td>{doc ? <button type="button" className="text-button" onClick={() => void download(doc).catch((reason: Error) => setError(reason.message))}><FileText size={14} /> {doc.name}</button> : <span className="muted">—</span>}</td>
              <td><div className="table-actions"><button type="button" className="button button-secondary" aria-label={`${editable ? "Editar" : "Ver"} tarea ${entry.title}`} onClick={() => setTask(entry)}>{editable ? "Editar" : "Ver"}</button></div></td>
            </tr>;
          })}</tbody>
        </table></div> : <Empty icon={ClipboardCheck} title="Sin tareas para estos filtros" />}
      </section>
    </>}
    {task && period && <Modal title={currentTask ? currentTask.title : "Nueva tarea"} description={monthLabel(month, locale)} close={() => setTask(null)}>
      {editable ? <ActionForm close={() => setTask(null)} submit={async (data) => {
        await mutate({ type: "task.save", periodId: period.id, id: currentTask?.id, title: fieldValue(data, "title"), status: fieldValue(data, "status") as Task["status"], notes: fieldValue(data, "notes"), documentId: optionalValue(data, "document") }, "Tarea guardada.");
      }}>
        <Field label="Nombre de la tarea" span><Input name="title" defaultValue={currentTask?.title} required maxLength={180} /></Field>
        <Field label="Estado" span><Select name="status" defaultValue={currentTask?.status ?? "pending"}>{Object.entries(taskStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></Field>
        <Field label="Documento vinculado" span><Select name="document" defaultValue={currentTask?.document_id ?? ""}><option value="">Sin documento</option>
          {docs.map((doc) => <option key={doc.id} value={doc.id}>{doc.name}</option>)}</Select></Field>
        <Field label="Observaciones" span><textarea className="control" name="notes" maxLength={4000} defaultValue={currentTask?.notes ?? ""} /></Field>
      </ActionForm> : <div className="grid gap-3">{currentTask && <TaskBadge status={currentTask.status} />}<p className="muted">{currentTask?.notes || "Sin observaciones."}</p></div>}
    </Modal>}
    {periodDialog && period && <Modal title={period.status === "open" ? "Cerrar período" : "Reabrir período"} description={monthLabel(month, locale)} close={() => setPeriodDialog(false)}>
      <ActionForm close={() => setPeriodDialog(false)} label={period.status === "open" ? "Confirmar cierre" : "Confirmar reapertura"} submit={async (data) => {
        await mutate({ type: "period.status", id: period.id, status: period.status === "open" ? "closed" : "open", reason: fieldValue(data, "reason") }, period.status === "open" ? "Período cerrado." : "Período reabierto.");
      }}>
        {period.status === "open" && <p className={`notice field-wide ${progress.pending ? "notice-warning" : ""}`}>{progress.pending ? `Quedan ${progress.pending} tareas aplicables sin completar. Indicá el motivo para cerrar con pendientes.` : "El período quedará disponible para consulta y se bloquearán las modificaciones."}</p>}
        <Field label={period.status === "closed" || progress.pending ? "Motivo (obligatorio)" : "Motivo (opcional)"} span>
          <textarea className="control" name="reason" maxLength={1200} required={period.status === "closed" || progress.pending > 0} />
        </Field>
      </ActionForm>
    </Modal>}
  </>;
}
