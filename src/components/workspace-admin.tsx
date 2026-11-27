"use client";

import {fiscalCalendar,fiscalRules,fiscalNotes,ruleFromDate} from "@/lib/workspace/fiscal-recurrence";
import { bookObligations } from "@/lib/accounting/engine";
import { Activity, CalendarClock, ClipboardList, Plus, Settings, ShieldAlert, Users } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { companyName, dayLabel, money, monthLabel, todayIn } from "@/lib/workspace/format";
import { activityLabel, scopeAlerts } from "@/lib/workspace/insights";
import type { AuditEvent, Member, Obligation, Role } from "@/lib/workspace/model";
import { organizationSettingsSchema } from "@/lib/workspace/validation";
import { useWorkspace } from "./workspace-context";
import { ActionForm, Badge, Empty, Field, Heading, Input, Modal, Search, SectionHeading, Select, fieldValue, optionalValue } from "./workspace-ui";

const roles = { owner: "Propietaria", editor: "Edición", viewer: "Consulta" } satisfies Record<Role, string>;
const localeLabels = { "es-AR": "Español (Argentina)", "es-UY": "Español (Uruguay)", "es-ES": "Español (España)" };
const timezoneLabels = {
  "America/Argentina/Tucuman": "Tucumán", "America/Argentina/Buenos_Aires": "Buenos Aires",
  "America/Argentina/Cordoba": "Córdoba", "America/Argentina/Mendoza": "Mendoza",
  "America/Montevideo": "Montevideo", UTC: "UTC",
};

type SettingsDialog = { type: "create" | "preferences" | "add" } | { type: "edit" | "remove"; member: Member };

export function SettingsPage() {
  const { state, mode, href, mutate } = useWorkspace();
  const router = useRouter();
  const [dialog, setDialog] = useState<SettingsDialog | null>(null);
  const { organization, members } = state;
  const isOwner = organization?.role === "owner";
  const dismiss = () => setDialog(null);
  const createButton = <button id="crear-organizacion" type="button" className="button button-primary" onClick={() => setDialog({ type: "create" })}>
    <Plus size={17} aria-hidden="true" /> Crear organización
  </button>;

  return <>
    <Heading title="Configuración" description="Administrá el estudio y los permisos de acceso." actions={mode === "auth" && organization ? createButton : undefined} />
    {organization ? <>
      <section className="panel">
        <SectionHeading title="Organización" icon={Settings} action={isOwner ? <button type="button" className="button button-secondary" onClick={() => setDialog({ type: "preferences" })}>Editar organización</button> : undefined} />
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <SettingValue label="Nombre" value={organization.name} />
          <SettingValue label="Idioma y región" value={localeLabels[organization.locale as keyof typeof localeLabels] ?? organization.locale} />
          <SettingValue label="Moneda" value={organization.currency} />
          <SettingValue label="Zona horaria" value={timezoneLabels[organization.timezone as keyof typeof timezoneLabels] ?? organization.timezone} />
        </dl>
      </section>
      <section className="panel">
        <SectionHeading title="Acceso al estudio" icon={Users} subtitle={`Tu permiso en este estudio es ${roles[organization.role].toLowerCase()}.`}
          action={mode === "auth" && isOwner ? <button className="button button-secondary" type="button" onClick={() => setDialog({ type: "add" })}><Plus size={16} aria-hidden="true" /> Agregar integrante</button> : undefined} />
        {isOwner && mode === "auth" && (members.length ? <div className="table-wrap"><table>
          <caption className="sr-only">Integrantes de la organización</caption>
          <thead><tr><th scope="col">Usuario</th><th scope="col">Permiso</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
          <tbody>{members.map((member) => <tr key={member.user_id}>
            <td><code>{member.user_id}</code></td><td><Badge>{roles[member.role]}</Badge></td>
            <td><div className="table-actions">
              <button className="button button-secondary" type="button" onClick={() => setDialog({ type: "edit", member })}>Editar permiso</button>
              <button className="button button-secondary" type="button" onClick={() => setDialog({ type: "remove", member })}>Quitar acceso</button>
            </div></td>
          </tr>)}</tbody>
        </table></div> : <Empty icon={Users} title="Sin integrantes para mostrar" />)}
      </section>
    </> : <section className="panel"><Empty icon={Users} title="Creá tu estudio" text="Después vas a poder agregar empresas e integrantes con una cuenta habilitada." action={mode === "auth" ? createButton : undefined} /></section>}

    {dialog?.type === "create" && <Modal title="Crear organización" description="Vas a quedar como propietaria del nuevo estudio." close={dismiss}>
      <ActionForm close={dismiss} label="Crear organización" submit={async (data) => {
        const { id } = await mutate({ type: "organization.create", name: fieldValue(data, "name") }, "Organización creada.");
        if (id) router.push(href("configuracion", { organizationId: id, companyId: undefined }));
      }}>
        <Field label="Nombre del estudio" span><Input name="name" autoComplete="organization" minLength={2} maxLength={120} required /></Field>
      </ActionForm>
    </Modal>}

    {organization && dialog?.type === "preferences" && <Modal title="Editar organización" description="Definí la configuración regional del estudio." close={dismiss}>
      <ActionForm close={dismiss} submit={async (data) => {
        const parsed = organizationSettingsSchema.safeParse(Object.fromEntries(data));
        if (!parsed.success) throw new Error("Revisá el nombre, la moneda y la configuración regional.");
        await mutate({ type: "organization.settings", id: organization.id, values: parsed.data }, "Organización actualizada.");
      }}>
        <Field label="Nombre" span><Input name="name" defaultValue={organization.name} minLength={2} maxLength={120} required /></Field>
        <Field label="Idioma y región"><Select name="locale" defaultValue={organization.locale}>
          {organizationSettingsSchema.shape.locale.options.map((locale) => <option key={locale} value={locale}>{localeLabels[locale]}</option>)}
        </Select></Field>
        <Field label="Moneda (código ISO)"><Input name="currency" defaultValue={organization.currency} pattern="[A-Za-z]{3}" minLength={3} maxLength={3} required /></Field>
        <Field label="Zona horaria" span><Select name="timezone" defaultValue={organization.timezone}>
          {organizationSettingsSchema.shape.timezone.options.map((zone) => <option key={zone} value={zone}>{timezoneLabels[zone]}</option>)}
        </Select></Field>
      </ActionForm>
    </Modal>}

    {organization && (dialog?.type === "add" || dialog?.type === "edit" || dialog?.type === "remove") && <MemberModal
      organizationId={organization.id} operation={dialog.type} member={"member" in dialog ? dialog.member : undefined} close={dismiss}
    />}
  </>;
}

function SettingValue({ label, value }: { label: string; value: string }) {
  return <div><dt className="muted text-sm">{label}</dt><dd className="mt-1 wrap-break-word">{value}</dd></div>;
}

function MemberModal({ organizationId, operation, member, close }: {
  organizationId: string; operation: "add" | "edit" | "remove"; member?: Member; close: () => void;
}) {
  const { mutate } = useWorkspace();
  const titles = { add: "Agregar integrante", edit: "Editar permiso", remove: "Quitar acceso" };
  const descriptions = {
    add: "Ingresá el UUID de una cuenta ya habilitada en Supabase Auth.",
    edit: "Elegí qué puede hacer esta persona en la organización.",
    remove: "Esta persona perderá el acceso a los datos de la organización.",
  };

  return <Modal title={titles[operation]} description={descriptions[operation]} close={close}>
    <ActionForm close={close} label={operation === "edit" ? "Guardar permiso" : titles[operation]} submit={async (data) => {
      const userId = member?.user_id ?? fieldValue(data, "userId");
      const role = operation === "remove" ? null : fieldValue(data, "role") as Role;
      await mutate({ type: "organization.member", organizationId, userId, role }, operation === "remove" ? "Acceso quitado." : "Permiso guardado.");
    }}>
      <Field label="UUID del usuario" span><Input name="userId" defaultValue={member?.user_id} readOnly={!!member} minLength={36} maxLength={36}
        pattern="[a-fA-F0-9]{8}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{4}-[a-fA-F0-9]{12}" required /></Field>
      {operation !== "remove" && <Field label="Permiso" span><Select name="role" defaultValue={member?.role ?? "viewer"}>
        {Object.entries(roles).map(([id, label]) => <option key={id} value={id}>{label}</option>)}
      </Select></Field>}
    </ActionForm>
  </Modal>;
}

const obligations = {
  pending: { label: "Pendiente", tone: "warning" }, filed: { label: "Presentado", tone: "accent" },
  paid: { label: "Pagado", tone: "positive" }, not_applicable: { label: "No aplica", tone: "neutral" },
} as const satisfies Record<Obligation["status"], { label: string; tone: string }>;

export function CalendarPage() {
  const { state, company, month, canEdit, locale, today } = useWorkspace();
  const [dialog, setDialog] = useState<Obligation | "new" | "habitual" | null>(null);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const monthlyPeriods = state.periods.filter((record) => record.month.startsWith(month) && (!company || record.company_id === company.id));
  const scope = new Set(monthlyPeriods.map((record) => record.id));
  const companies = new Map(state.companies.map((record) => [record.id, record]));
  const periodStatus = new Map(monthlyPeriods.map((record) => [record.id, record.status]));
  const baseRows = [...fiscalCalendar(state,month,company?.id),...bookObligations(state).filter(obligation=>scope.has(obligation.period_id))];
  const recurring=fiscalRules(state,company?.id).filter(r=>r.rule.active);
  const needle = query.trim().toLocaleLowerCase(locale);
  const filtered = baseRows.filter((obligation) => {
    const entry = companies.get(obligation.company_id);
    return (!status || obligation.status === status) &&
      `${obligation.title} ${entry ? companyName(entry) : ""}`.toLocaleLowerCase(locale).includes(needle);
  }).sort((a, b) => a.due_on.localeCompare(b.due_on) || a.title.localeCompare(b.title));
  const activeCompanies = state.companies.filter((entry) => entry.status === "active" && (!company || company.id === entry.id));
  const canCreate = canEdit && activeCompanies.some((entry) => monthlyPeriods.find((record) => record.company_id === entry.id)?.status !== "closed");
  const createButton = <button id="crear-organizacion" type="button" className="button button-primary" onClick={() => setDialog("new")}><Plus size={17} aria-hidden="true" /> Nuevo vencimiento</button>;

  return <>
    <div className="notice">{company ? `CUIT ${company.cuit} · terminación ${company.cuit.slice(-1)}. ` : "Elegí una empresa para verificar la terminación de CUIT. "}<a className="text-button" href="https://www.arca.gob.ar/vencimientos/" target="_blank" rel="noreferrer">Consultar agenda oficial ARCA</a> · Verificá impuesto, régimen, mes y prórrogas antes de guardar la fecha. IIBB y TEM requieren la fuente provincial o municipal.</div>
    <Heading title="Calendario fiscal" description={`${monthLabel(month, locale)} · ${company ? companyName(company) : "Vista del estudio"}`} actions={canCreate ? createButton : undefined} />
    <section className="panel" aria-label="Vencimientos habituales"><SectionHeading title="Vencimientos habituales" subtitle="Se configuran una vez por empresa. El día se repite al cambiar de mes; los importes y pagos no se copian." action={canCreate&&<button type="button" className="button button-secondary" onClick={()=>setDialog('habitual')}>Configurar vencimiento habitual</button>}/>
      {recurring.length?<ul className="grid gap-3">{recurring.map(({source,rule})=><li key={source.company_id+rule.seriesId}><strong>{source.title}</strong> · día {rule.day} {rule.offset?'del mes siguiente':'de cada mes'} · desde {monthLabel(rule.from,locale)}{!company&&<small> · {companyName(companies.get(source.company_id)!)}</small>}</li>)}</ul>:<p className="muted">Todavía no configuraste fechas habituales para esta empresa.</p>}
      <p className="muted text-sm mt-3">Son fechas de referencia del estudio. Revisá feriados y prórrogas oficiales y corregí el vencimiento puntual cuando corresponda. Si el día no existe, se usa el último día del mes.</p>
    </section>
    <section className="panel">
      <SectionHeading title="Obligaciones del período" icon={CalendarClock} subtitle="Fechas habituales previstas y vencimientos registrados. Registrar un mes no copia pagos anteriores." />
      {baseRows.length > 0 && <div className="table-toolbar">
        <Search label="Buscar obligación o empresa" value={query} onChange={setQuery} />
        <Select aria-label="Filtrar por estado" value={status} onChange={(event) => setStatus(event.target.value)}>
          <option value="">Todos los estados</option>
          {Object.entries(obligations).map(([id, info]) => <option key={id} value={id}>{info.label}</option>)}
        </Select>
      </div>}
      {filtered.length ? <div className="table-wrap"><table>
        <caption className="sr-only">Vencimientos fiscales de {monthLabel(month, locale)}</caption>
        <thead><tr><th scope="col">Obligación</th><th scope="col">Vencimiento</th><th scope="col" className="cell-numeric">Importe</th><th scope="col">Estado</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{filtered.map((record) => {
          const entry = companies.get(record.company_id);
          const projected=record.id.startsWith("recurring:");
          const editable = canEdit && !record.id.startsWith("book:") && entry?.status === "active" && (projected||periodStatus.get(record.period_id) === "open");
          const overdue = record.due_on < today && (record.status === "pending" || record.status === "filed");
          return <tr key={record.id}>
            <td className="cell-main"><strong>{record.title}</strong>{entry && <small>{companyName(entry)}</small>}{projected&&<small>Habitual · fecha por verificar</small>}</td>
            <td className="cell-nowrap"><time dateTime={record.due_on}>{dayLabel(record.due_on, undefined, locale)}</time>{overdue && <small>Vencido</small>}</td>
            <td className="cell-numeric">{record.amount === null ? "—" : money(record.amount, entry?.currency ?? state.organization?.currency, locale)}</td>
            <td><Badge tone={overdue ? "negative" : obligations[record.status].tone}>{obligations[record.status].label}</Badge></td>
            <td><div className="table-actions"><button className="button button-secondary" type="button" onClick={() => setDialog(record)}>{editable ? projected?"Registrar / ajustar este mes":"Editar" : "Ver detalle"}</button></div></td>
          </tr>;
        })}</tbody>
      </table></div> : <Empty icon={CalendarClock} title={baseRows.length ? "Sin coincidencias" : "Sin vencimientos cargados"}
        text={baseRows.length ? "Probá cambiar la búsqueda o el estado." : "Configurá las fechas habituales una vez o cargá un vencimiento puntual."} />}
    </section>
    {dialog && <ObligationModal habitual={dialog==='habitual'} record={dialog === "new"||dialog==='habitual' ? undefined : dialog} close={() => setDialog(null)} />}
  </>;
}

function ObligationModal({ record, habitual=false, close }: { record?: Obligation; habitual?:boolean; close: () => void }) {
  const { state, company, month, locale, canEdit, mutate, href } = useWorkspace();
  const projected=record?.id.startsWith("recurring:");
  const previous=fiscalNotes(record?.notes??'');
  const [repeat,setRepeat]=useState(habitual||!!previous.rule?.active);
  const [exception,setException]=useState(false);
  const monthPeriods = state.periods.filter((period) => period.month.slice(0, 7) === month);
  const active = state.companies.filter((entry) => entry.status === "active" &&
    monthPeriods.find((period) => period.company_id === entry.id)?.status !== "closed");
  const [companyId, setCompanyId] = useState(record?.company_id ?? company?.id ?? active[0]?.id ?? "");
  const selected = state.companies.find((entry) => entry.id === companyId);
  const period = record&&!projected ? state.periods.find((entry) => entry.id === record.period_id) : monthPeriods.find((entry) => entry.company_id === companyId);
  const documents = state.documents.filter((entry) => entry.period_id === period?.id);
  const selectedDocument = documents.find((entry) => entry.id === record?.document_id);
  const editable = canEdit && !record?.id.startsWith("book:") && selected?.status === "active" && (!record || projected || period?.status === "open");

  return <Modal title={record ? editable ? "Editar vencimiento" : record.title : habitual?"Configurar vencimiento habitual":"Nuevo vencimiento"}
    description={`${monthLabel(month, locale)}${selected ? ` · ${companyName(selected)}` : ""}`} close={close}>
    {editable ? <ActionForm close={close} label={record ? "Guardar cambios" : "Crear vencimiento"} submit={async (data) => {
      const savedPeriod = period ?? await mutate({ type: "period.ensure", companyId, month }, "Período iniciado.");
      if (!savedPeriod.id) throw new Error("No se pudo iniciar el período de la empresa.");
      await mutate({
        type: "obligation.save", periodId: savedPeriod.id, id: projected?undefined:record?.id,
        recurrence:repeat||previous.rule?repeat&&exception&&previous.rule?{...previous.rule,from:month}:ruleFromDate(previous.rule?.seriesId??crypto.randomUUID(),month,fieldValue(data,'dueOn'),repeat,previous.rule,record?.due_on):undefined,
        title: fieldValue(data, "title"), dueOn: fieldValue(data, "dueOn"), amount: optionalValue(data, "amount")?.replace(",", ".") ?? null,
        status: fieldValue(data, "status") as Obligation["status"], filedOn: optionalValue(data, "filedOn"), paidOn: optionalValue(data, "paidOn"),
        documentId: optionalValue(data, "documentId"), notes: fieldValue(data, "notes"),
      }, record ? "Vencimiento actualizado." : "Vencimiento guardado.");
    }}>
      {!record && !company && <Field label="Empresa" span><Select value={companyId} onChange={(event) => setCompanyId(event.target.value)}>
        {active.map((entry) => <option key={entry.id} value={entry.id}>{companyName(entry)}</option>)}
      </Select></Field>}
      <Field label="Impuesto u obligación" span><Input name="title" defaultValue={record?.title} minLength={2} maxLength={160} required /></Field>
      <Field label="Vencimiento"><Input type="date" name="dueOn" defaultValue={record?.due_on ?? ""} required /></Field>
      <label className="check-field field-wide"><input type="checkbox" checked={repeat} onChange={e=>setRepeat(e.target.checked)}/>Repetir todos los meses, conservando el día</label>
      {previous.rule&&repeat&&<label className="check-field field-wide"><input type="checkbox" checked={exception} onChange={e=>setException(e.target.checked)}/>Cambiar solo la fecha de este mes (por feriado o prórroga)</label>}
      <p className="muted text-sm field-wide">La fecha habitual se conserva entre meses. Importe, presentación y pago corresponden únicamente a este período.</p>
      <Field label={`Importe (${selected.currency})`}><Input name="amount" inputMode="decimal" pattern="[0-9]{1,14}([.,][0-9]{1,2})?" defaultValue={record?.amount?.replace(".", ",")} /></Field>
      <Field label="Estado" span><Select name="status" defaultValue={record?.status ?? "pending"}>
        {Object.entries(obligations).map(([id, info]) => <option key={id} value={id}>{info.label}</option>)}
      </Select></Field>
      <Field label="Fecha de presentación"><Input type="date" name="filedOn" defaultValue={record?.filed_on ?? ""} /></Field>
      <Field label="Fecha de pago"><Input type="date" name="paidOn" defaultValue={record?.paid_on ?? ""} /></Field>
      {documents.length > 0 && <Field label="Documento de respaldo" span><Select key={period?.id} name="documentId" defaultValue={record?.document_id ?? ""}>
        <option value="">Sin documento vinculado</option>{documents.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
      </Select></Field>}
      <Field label="Observaciones" span><textarea className="control" name="notes" defaultValue={previous.text} maxLength={4000} /></Field>
    </ActionForm> : record && <>
      <dl className="grid gap-4 sm:grid-cols-2">
        <SettingValue label="Estado" value={obligations[record.status].label} />
        <SettingValue label="Vencimiento" value={dayLabel(record.due_on, undefined, locale)} />
        <SettingValue label="Importe" value={record.amount === null ? "Pendiente de determinar" : money(record.amount, selected?.currency ?? state.organization?.currency, locale)} />
        <SettingValue label="Presentación" value={record.filed_on ? dayLabel(record.filed_on, undefined, locale) : "—"} />
        <SettingValue label="Pago" value={record.paid_on ? dayLabel(record.paid_on, undefined, locale) : "—"} />
        {previous.text && <SettingValue label="Observaciones" value={previous.text} />}
      </dl>
      {selectedDocument && <Link className="text-button mt-4" href={href("documentacion", { companyId: record.company_id })}>Ver {selectedDocument.name} en Documentación</Link>}
    </>}
  </Modal>;
}

const auditActions: Record<string, string> = { close: "Cierre", reopen: "Reapertura", confirm: "Confirmación" };

export function AuditPage() {
  const { state, company, month, href, locale } = useWorkspace();
  const [detail, setDetail] = useState<AuditEvent | null>(null);
  const alerts = scopeAlerts(state, month, company?.id);
  const participants = new Map(state.companies.map((entry) => [entry.id, companyName(entry)]));
  const vouchers = new Map(state.vouchers.map((entry) => [entry.id, entry]));
  const periods = new Set(state.periods.filter((entry) => entry.month.slice(0, 7) === month).map((entry) => entry.id));
  const timezone = state.organization?.timezone;
  const eventTime = new Intl.DateTimeFormat(locale, { dateStyle: "short", timeStyle: "short", timeZone: timezone });
  const activity = state.activity.filter((entry) => (!company || entry.company_id === company.id) &&
    (entry.period_id ? periods.has(entry.period_id) : todayIn(timezone, new Date(entry.created_at)).startsWith(month)))
    .sort((a, b) => b.created_at.localeCompare(a.created_at));

  return <>
    <Heading title="Auditoría" description={`${monthLabel(month, locale)} · ${company ? companyName(company) : "Vista del estudio"}`} />
    <section className="panel">
      <SectionHeading title="Alertas del período" icon={ShieldAlert} subtitle="Revisá los registros de origen para resolver cada alerta." />
      {alerts.length ? <ul className="data-list">{alerts.map((alert) => {
        const voucher = alert.section === "comprobantes" ? vouchers.get(alert.id.replace(/^asset-/, "")) : undefined;
        return <li key={alert.id} className="data-row flex-wrap">
          <div className="data-main min-w-56"><strong>{alert.title}</strong><small>{participants.get(alert.companyId)} · {alert.description}</small></div>
          {voucher && <span className="numbers text-sm">{money(voucher.total, voucher.currency, locale)}</span>}
          <Badge tone={alert.type === "Hipótesis" ? "accent" : "warning"}>{alert.type}</Badge>
          <Link className="text-button" href={href(alert.section, { companyId: alert.companyId })}>{voucher ? "Ver comprobantes" : "Ver checklist"}</Link>
        </li>;
      })}</ul> : <Empty icon={ShieldAlert} title="Sin alertas en este período" />}
    </section>
    <section className="panel">
      <SectionHeading title="Historial de acciones" icon={Activity} subtitle="Actividad registrada en el estudio." />
      {activity.length ? <div className="table-wrap"><table>
        <caption className="sr-only">Acciones en el período seleccionado</caption>
        <thead><tr><th scope="col">Acción</th><th scope="col">Contexto</th><th scope="col">Fecha</th><th scope="col"><span className="sr-only">Acciones</span></th></tr></thead>
        <tbody>{activity.map((entry) => <tr key={entry.id}>
          <td className="cell-main"><strong>{activityLabel(entry.entity, auditActions[entry.action] ?? entry.action)}</strong></td>
          <td>{entry.company_id ? participants.get(entry.company_id) : state.organization?.name}</td>
          <td className="cell-nowrap"><time dateTime={entry.created_at}>{eventTime.format(new Date(entry.created_at))}</time></td>
          <td><div className="table-actions"><button type="button" className="button button-secondary" onClick={() => setDetail(entry)}>Ver detalle</button></div></td>
        </tr>)}</tbody>
      </table></div> : <Empty icon={ClipboardList} title="Sin actividad registrada" />}
    </section>
    {detail && <Modal title={activityLabel(detail.entity, auditActions[detail.action] ?? detail.action)} description="Registro de auditoría" close={() => setDetail(null)}>
      <dl className="grid gap-4">
        <SettingValue label="Identificador del registro" value={detail.entity_id} />
        {"actor_id" in detail && typeof detail.actor_id === "string" && <SettingValue label="Usuario" value={detail.actor_id} />}
        {typeof detail.details.reason === "string" && <SettingValue label="Motivo" value={detail.details.reason} />}
        {Array.isArray(detail.details.fields) && <SettingValue label="Campos actualizados" value={detail.details.fields.filter((field) => typeof field === "string").join(", ")} />}
        {typeof detail.details.rows === "number" && <SettingValue label="Filas incorporadas" value={String(detail.details.rows)} />}
        {typeof detail.details.duplicates === "number" && <SettingValue label="Filas duplicadas" value={String(detail.details.duplicates)} />}
      </dl>
    </Modal>}
  </>;
}
