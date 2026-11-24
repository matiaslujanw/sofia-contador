"use client";

import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import {
  Building2, CalendarDays, ChevronRight, ClipboardCheck, FileText, FlaskConical, House,
  LayoutList, LogOut, Menu, ReceiptText, Settings, ShieldCheck, X, ChartNoAxesCombined,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useSyncExternalStore } from "react";
import { signOut } from "@/lib/supabase/auth-actions";
import { confirmWorkspaceImport, downloadWorkspaceDocument, mutateWorkspace, uploadWorkspaceDocument } from "@/lib/workspace/actions";
import { companyName, initials, monthLabel, shiftMonth } from "@/lib/workspace/format";
import { confirmLocalImport, decodeLocal, downloadLocalDocument, emptyLocalSnapshot, localSnapshot, mutateLocal, subscribeLocal, uploadLocalDocument } from "@/lib/workspace/local";
import type { WorkspaceState } from "@/lib/workspace/model";
import { sections, workspaceHref, type Section, type Selection } from "@/lib/workspace/routes";
import { monthSchema } from "@/lib/workspace/validation";
import { AuditPage, CalendarPage, SettingsPage } from "./workspace-admin";
import { WorkspaceContext, type Context } from "./workspace-context";
import { CompanyDashboard, StudyDashboard } from "./workspace-dashboard";
import { AccountsPage, DocumentsPage, VouchersPage } from "./workspace-records";
import { ClosingPage, CompaniesPage } from "./workspace-operations";
import { Field, Input, Modal, Select } from "./workspace-ui";

const nav = [
  { label: "Espacio de trabajo", items: [
    { id: "inicio", icon: House }, { id: "empresas", icon: Building2 }, { id: "cierre", icon: ClipboardCheck },
  ] },
  { label: "Contabilidad", items: [
    { id: "comprobantes", icon: ReceiptText }, { id: "cuentas", icon: LayoutList },
    { id: "documentacion", icon: FileText }, { id: "calendario", icon: CalendarDays },
  ] },
  { label: "Control", items: [
    { id: "informes", icon: ChartNoAxesCombined }, { id: "auditoria", icon: ShieldCheck }, { id: "configuracion", icon: Settings },
  ] },
] as const;

type Props = {
  initial: WorkspaceState; section: Section; mode: "auth" | "demo"; email: string | null;
  month: string; today: string; companyId?: string; purpose?: string;
};

const roleLabels = { owner: "Propietaria", editor: "Edición", viewer: "Consulta" } as const;
const noLocalSubscribe = () => () => undefined;

export function Workspace({ initial, section, mode, email, month, today, companyId, purpose }: Props) {
  const router = useRouter();
  const stored = useSyncExternalStore(mode === "demo" ? subscribeLocal : noLocalSubscribe, mode === "demo" ? localSnapshot : emptyLocalSnapshot, emptyLocalSnapshot);
  const state = mode === "demo" ? decodeLocal(stored, initial) : initial;
  const [drawer, setDrawer] = useState(false);
  const [monthPicker, setMonthPicker] = useState(false);
  const [message, setMessage] = useState("");
  const company = state.companies.find((company) => company.id === companyId);
  const period = state.periods.find((entry) => entry.company_id === company?.id && entry.month.slice(0, 7) === month);
  const organization = state.organization;
  const locale = organization?.locale ?? "es-AR";
  const canEdit = !!organization && organization.role !== "viewer";
  const selection = { organizationId: organization?.id, companyId: company?.id, month };
  const href = (target: Section, override?: Partial<Selection>, extra?: Record<string, string>) =>
    workspaceHref(target, { ...selection, ...override }, extra);
  const months = [...new Set([month, ...Array.from({ length: 13 }, (_, index) => shiftMonth(today.slice(0, 7), 2 - index)), ...state.periods.map((record) => record.month.slice(0, 7))])].sort().reverse();

  function notify(value: string) {
    setMessage(value);
  }

  const context: Context = {
    state, company, period, month, mode, today, canEdit, locale, href,
    async mutate(command, success = "Cambios guardados.") {
      if (mode === "demo") {
        const result = mutateLocal(initial, command);
        notify(success);
        return result;
      }
      const result = await mutateWorkspace(command);
      if (!result.ok) { router.refresh(); throw new Error(result.message); }
      router.refresh();
      notify(success);
      return result.data;
    },
    async upload(category, file) {
      if (!company || !period) throw new Error("Seleccioná una empresa y un período.");
      if (mode === "demo") await uploadLocalDocument(initial, period.id, category, file);
      else {
        const body = new FormData();
        body.set("file", file);
        body.set("context", JSON.stringify({ companyId: company.id, periodId: period.id, category }));
        const response = await uploadWorkspaceDocument(body);
        if (!response.ok) throw new Error(response.message);
        router.refresh();
      }
      notify("Documento guardado.");
    },
    async download(document) {
      const response = mode === "demo" ? { ok: true as const, data: { url: await downloadLocalDocument(document.id) } } : await downloadWorkspaceDocument(document.id);
      if (!response.ok) throw new Error(response.message);
      const anchor = window.document.createElement("a");
      anchor.href = response.data.url;
      anchor.download = document.name;
      anchor.rel = "noreferrer";
      window.document.body.append(anchor);
      anchor.click();
      anchor.remove();
      if (mode === "demo") window.setTimeout(() => URL.revokeObjectURL(response.data.url), 10000);
    },
    async confirmImport({ file, kind, mapping, decimal }) {
      if (!company || !period) throw new Error("Seleccioná una empresa y un período.");
      if (mode === "demo") return confirmLocalImport(initial, period.id, { file, kind, mapping, decimal });
      const body = new FormData();
      body.set("file", file);
      body.set("context", JSON.stringify({ companyId: company.id, periodId: period.id, kind, mapping, decimal }));
      const response = await confirmWorkspaceImport(body);
      if (!response.ok) throw new Error(response.message);
      router.refresh();
      return response.data;
    },
  };

  function navigate(url: string) {
    setMessage("");
    router.push(url);
  }

  function sidebar(close?: () => void) {
    return <aside className="sidebar">
      <Link className="brand" href={href("inicio", { companyId: undefined })} onClick={close} aria-label="Sofía, inicio">
        <Image src="/sofia-mark.svg" alt="" width={37} height={37} unoptimized />
        <span className="brand-name"><strong>SOFÍA</strong><span>Gestión Contable</span></span>
      </Link>
      <nav aria-label="Navegación principal" className="nav-groups">
        {nav.map((group) => <div className="nav-group" key={group.label}>
          <h2>{group.label}</h2><ul>{group.items.map(({ id, icon: Icon }) =>
            <li key={id}><Link className="nav-link" aria-current={section === id ? "page" : undefined} href={href(id)} onClick={close}>
              <Icon size={18} strokeWidth={1.75} aria-hidden="true" />{sections[id]}
            </Link></li>)}</ul>
        </div>)}
      </nav>
      <div className="sidebar-bottom"><div className="profile">
        <span className="avatar" aria-hidden="true">{initials(organization?.name ?? "Sofía")}</span>
        <div className="profile-name"><strong>{organization?.name ?? "Sofía"}</strong>
          <span>{mode === "demo" ? "Espacio de demostración" : organization ? roleLabels[organization.role] : email ?? "Acceso privado"}</span>
        </div>
        {mode === "auth" && <form action={signOut}><button type="submit" className="icon-button" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button></form>}
      </div></div>
    </aside>;
  }

  const view = (() => {
    if (!organization) return <SettingsPage />;
    switch (section) {
      case "inicio": return company ? <CompanyDashboard /> : <StudyDashboard />;
      case "empresas": return <CompaniesPage key={purpose ?? "empresas"} openNew={purpose === "nueva"} />;
      case "cierre": return <ClosingPage key={period?.id ?? `${company?.id}-${month}`} />;
      case "comprobantes": return <VouchersPage key={period?.id ?? `${company?.id}-${month}`} />;
      case "cuentas": return <AccountsPage key={company?.id} />;
      case "documentacion": return <DocumentsPage key={`${period?.id ?? company?.id}-${purpose}`} purpose={purpose} />;
      case "calendario": return <CalendarPage key={`${company?.id}-${month}`} />;
      case "informes": return <CompanyDashboard report />;
      case "auditoria": return <AuditPage />;
      case "configuracion": return <SettingsPage />;
    }
  })();

  return <WorkspaceContext.Provider value={context}>
    <div className="workspace">
      <a href="#contenido" className="skip-link button button-primary">Ir al contenido</a>
      {sidebar()}
      <div className="workspace-body">
        <header className="topbar">
          <Dialog.Root open={drawer} onOpenChange={setDrawer}>
            <Dialog.Trigger asChild><button className="icon-button mobile-menu" type="button" aria-label="Abrir menú"><Menu size={20} /></button></Dialog.Trigger>
            <Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className="drawer">
              <Dialog.Title className="sr-only">Menú de navegación</Dialog.Title><Dialog.Description className="sr-only">Secciones de Sofía</Dialog.Description>
              {sidebar(() => setDrawer(false))}
              <Dialog.Close asChild><button type="button" className="icon-button close-nav" aria-label="Cerrar menú"><X size={18} /></button></Dialog.Close>
            </Dialog.Content></Dialog.Portal>
          </Dialog.Root>
          <div className="breadcrumb"><span>Espacio de trabajo</span><ChevronRight size={13} aria-hidden="true" /><strong>{sections[section]}</strong></div>
          {organization && <div className="top-controls">
            {state.organizations.length > 1 && <label><span className="sr-only">Organización</span><Select value={organization.id} onChange={(event) => navigate(href(section, { organizationId: event.target.value, companyId: undefined }))}>
              {state.organizations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </Select></label>}
            <label className="with-icon"><Building2 size={16} aria-hidden="true" /><span className="sr-only">Empresa</span>
              <Select value={company?.id ?? ""} onChange={(event) => navigate(href(section, { companyId: event.target.value || undefined }, purpose ? { tipo: purpose } : undefined))}>
                <option value="">Vista del estudio</option>
                {state.companies.filter((entry) => entry.status === "active" || entry.id === company?.id).map((entry) =>
                  <option key={entry.id} value={entry.id}>{companyName(entry)}</option>)}
              </Select>
            </label>
            <label className="with-icon"><CalendarDays size={16} aria-hidden="true" /><span className="sr-only">Período</span>
              <Select value={month} onChange={(event) => event.target.value === "otro" ? setMonthPicker(true) : navigate(href(section, { month: event.target.value }, purpose ? { tipo: purpose } : undefined))}>
                {months.map((item) => <option value={item} key={item}>{monthLabel(item, locale)}</option>)}<option value="otro">Otro período…</option>
              </Select>
            </label>
          </div>}
        </header>
        <main id="contenido" className="workspace-main">
          {mode === "demo" && <div className="demo-strip"><FlaskConical size={15} aria-hidden="true" />
            <strong>Modo demostración</strong><span>Datos ficticios y cambios guardados en este navegador. Usá archivos de prueba.</span></div>}
          {message && <div role="status" className={clsx("notice notice-success", "workspace-feedback")}>{message}<button type="button" className="icon-button" aria-label="Descartar mensaje" onClick={() => setMessage("")}><X size={16} /></button></div>}
          {view}
        </main>
      </div>
    </div>
    {monthPicker && <Modal title="Seleccionar período" description="Elegí el mes contable que querés consultar." close={() => setMonthPicker(false)}>
      <form onSubmit={(event) => {
        event.preventDefault();
        const parsed = monthSchema.safeParse(new FormData(event.currentTarget).get("month"));
        if (parsed.success) {
          setMonthPicker(false);
          navigate(href(section, { month: parsed.data }, purpose ? { tipo: purpose } : undefined));
        }
      }}>
        <Field label="Mes y año"><Input name="month" type="month" min="2000-01" max="2099-12" defaultValue={month} required /></Field>
        <div className="form-actions"><button className="button button-primary" type="submit">Aplicar período</button></div>
      </form>
    </Modal>}
  </WorkspaceContext.Provider>;
}
