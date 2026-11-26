"use client";

import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import {
  Building2, CalendarDays, ChevronDown, ClipboardCheck, Compass, FileText, FlaskConical, House,
  LayoutList, LogOut, Menu, ReceiptText, Settings, ShieldCheck, X, ChartNoAxesCombined,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useSyncExternalStore, type MouseEventHandler } from "react";
import { signOut } from "@/lib/supabase/auth-actions";
import { confirmWorkspaceImport, downloadWorkspaceDocument, mutateWorkspace, uploadWorkspaceDocument } from "@/lib/workspace/actions";
import { demoTourCompanyId, demoTourPeriodId, demoTourTaskId } from "@/lib/workspace/demo";
import { companyName, initials, monthLabel, shiftMonth } from "@/lib/workspace/format";
import { confirmLocalImport, decodeLocal, downloadLocalDocument, emptyLocalSnapshot, localSnapshot, mutateLocal, subscribeLocal, uploadLocalDocument } from "@/lib/workspace/local";
import type { WorkspaceState } from "@/lib/workspace/model";
import { getOnboarding } from "@/lib/workspace/onboarding";
import { sections, workspaceHref, type Section, type Selection } from "@/lib/workspace/routes";
import { monthSchema } from "@/lib/workspace/validation";
import { AuditPage, CalendarPage, SettingsPage } from "./workspace-admin";
import { WorkspaceContext, type Context } from "./workspace-context";
import { CompanyDashboard, StudyDashboard } from "./workspace-dashboard";
import { AccountsPage, DocumentsPage, VouchersPage } from "./workspace-records";
import { NextWorkspaceStep, WorkspaceGuide } from "./workspace-onboarding";
import { BookPage } from "./workspace-book";
import { MonthlyControlPage } from "./workspace-monthly";
import { ClosingPage, CompaniesPage } from "./workspace-operations";
import { Field, Input, Modal, Select } from "./workspace-ui";
import { TourEntry, WorkspaceTour } from "./workspace-tour";

const primaryNav = [
  { id: "inicio", icon: House }, { id: "empresas", icon: Building2 }, { id: "cierre", icon: ClipboardCheck },
  { id: "control", icon: ClipboardCheck }, { id: "contabilidad", icon: LayoutList }, { id: "comprobantes", icon: ReceiptText }, { id: "documentacion", icon: FileText }, { id: "calendario", icon: CalendarDays },
] as const;

const secondaryNav = [
  { id: "cuentas", icon: LayoutList }, { id: "informes", icon: ChartNoAxesCombined },
  { id: "auditoria", icon: ShieldCheck }, { id: "configuracion", icon: Settings },
] as const;

type Props = {
  initial: WorkspaceState; section: Section; mode: "auth" | "demo"; email: string | null;
  month: string; today: string; companyId?: string; purpose?: string; tourStep?: number | null; portable?: boolean;
};

const roleLabels = { owner: "Propietaria", editor: "Edición", viewer: "Consulta" } as const;
const noLocalSubscribe = () => () => undefined;

export function Workspace({ initial, section, mode, email, month, today, companyId, purpose, tourStep = null, portable = false }: Props) {
  const router = useRouter();
  const stored = useSyncExternalStore(mode === "demo" ? subscribeLocal : noLocalSubscribe, mode === "demo" ? localSnapshot : emptyLocalSnapshot, emptyLocalSnapshot);
  const state = mode === "demo" ? decodeLocal(stored, initial) : initial;
  const [drawer, setDrawer] = useState(false);
  const [monthPicker, setMonthPicker] = useState(false);
  const [message, setMessage] = useState("");
  const [guideOpen, setGuideOpen] = useState(false);
  const guideTrigger = useRef<HTMLButtonElement>(null);
  const openGuide: MouseEventHandler<HTMLButtonElement> = (event) => {
    guideTrigger.current = event.currentTarget;
    setGuideOpen(true);
  };
  const company = state.companies.find((company) => company.id === companyId);
  const period = state.periods.find((entry) => entry.company_id === company?.id && entry.month.slice(0, 7) === month);
  const organization = state.organization;
  const locale = organization?.locale ?? "es-AR";
  const canEdit = !!organization && organization.role !== "viewer";
  const selection = { organizationId: organization?.id, companyId: company?.id, month };
  const tourCompany = mode === "demo" ? state.companies.find((entry) => entry.id === demoTourCompanyId) : undefined;
  const tourPeriod = tourCompany ? state.periods.find((entry) => entry.id === demoTourPeriodId) : undefined;
  const tourTask = tourCompany ? state.tasks.find((entry) => entry.id === demoTourTaskId) : undefined;
  const sample = { ...selection, companyId: tourCompany?.id, month: tourPeriod?.month.slice(0, 7) ?? month };
  const sampleSelected = !!tourPeriod && tourPeriod.id === period?.id;
  const continuing: Record<string, string> = {};
  if (purpose && purpose !== "ejemplo") continuing.tipo = purpose;
  const scopeQuery = tourStep === null ? continuing : { ...continuing, recorrido: String(tourStep) };
  const href = (target: Section, override?: Partial<Selection>, extra?: Record<string, string>) =>
    workspaceHref(target, { ...selection, ...override }, extra);
  const guideProps = { steps: mode === "auth" ? getOnboarding(state, selection) : [], section, selection, purpose, href };
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
        <ul className="nav-list">{primaryNav.map(({ id, icon: Icon }) =>
          <li key={id}><Link className="nav-link" aria-current={section === id ? "page" : undefined} href={href(id)} onClick={close}>
            <Icon size={19} strokeWidth={1.7} aria-hidden="true" />{sections[id]}
          </Link></li>)}
        </ul>
        <details className="nav-more" open={secondaryNav.some((item) => item.id === section) || undefined}>
          <summary>Más herramientas<ChevronDown size={15} aria-hidden="true" /></summary>
          <ul className="nav-list">{secondaryNav.map(({ id, icon: Icon }) =>
            <li key={id}><Link className="nav-link" aria-current={section === id ? "page" : undefined} href={href(id)} onClick={close}>
              <Icon size={18} strokeWidth={1.7} aria-hidden="true" />{sections[id]}
            </Link></li>)}
          </ul>
        </details>
      </nav>
      <div className="sidebar-bottom"><div className="profile">
        <span className="avatar" aria-hidden="true">{initials(organization?.name ?? "Sofía")}</span>
        <div className="profile-name"><strong>{organization?.name ?? "Sofía"}</strong>
          <span>{mode === "demo" ? "Demostración" : organization ? roleLabels[organization.role] : email ?? "Acceso privado"}</span>
        </div>
        {mode === "auth" && <form action={signOut}><button type="submit" className="icon-button" aria-label="Cerrar sesión" title="Cerrar sesión"><LogOut size={17} /></button></form>}
      </div></div>
    </aside>;
  }

  const guideExample = sampleSelected && purpose === "ejemplo" && (tourStep === 2 || tourStep === 3);
  const closeGuideExample = guideExample ? () => router.replace(href(section, {}, scopeQuery)) : undefined;

  const view = (() => {
    if (!organization) return <SettingsPage />;
    switch (section) {
      case "inicio": return company ? <CompanyDashboard /> : <StudyDashboard />;
      case "empresas": return <CompaniesPage key={purpose ?? "empresas"} openNew={purpose === "nueva"} />;
      case "cierre": return <ClosingPage key={period?.id ?? `${company?.id}-${month}`} guide={sampleSelected && tourStep === 2} closeGuide={tourStep === 2 ? closeGuideExample : undefined} />;
      case "contabilidad": return <BookPage key={`${company?.id}-${month}`} />;
      case "control": return <MonthlyControlPage key={`${company?.id}-${month}`} />;
      case "comprobantes": return <VouchersPage key={period?.id ?? `${company?.id}-${month}`} guide={sampleSelected && tourStep === 3} closeGuide={tourStep === 3 ? closeGuideExample : undefined} />;
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
      <a href="#contenido" className="skip-link button button-primary" onClick={(event) => {
        event.preventDefault();
        document.getElementById("contenido")?.focus();
      }}>Ir al contenido</a>
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
          <div className="workspace-location">
            <span className="route-name">{sections[section]}</span>
            <span className="mobile-brand" aria-hidden="true">Sofía</span>
            {mode === "demo" && <span className="demo-indicator" title="Datos ficticios. Usá archivos de prueba.">
              <FlaskConical size={14} aria-hidden="true" /> <span>Demo</span><span className="sr-only"> con datos ficticios</span>
            </span>}
          </div>
          {organization && <div className="top-controls">
            {state.organizations.length > 1 && <label><span className="sr-only">Organización</span><Select value={organization.id} onChange={(event) => navigate(href(section, { organizationId: event.target.value, companyId: undefined }))}>
              {state.organizations.map((entry) => <option key={entry.id} value={entry.id}>{entry.name}</option>)}
            </Select></label>}
            <label className="with-icon"><Building2 size={16} aria-hidden="true" /><span className="sr-only">Empresa</span>
              <Select value={company?.id ?? ""} onChange={(event) => navigate(href(section, { companyId: event.target.value || undefined }, scopeQuery))}>
                <option value="">Vista del estudio</option>
                {state.companies.filter((entry) => entry.status === "active" || entry.id === company?.id).map((entry) =>
                  <option key={entry.id} value={entry.id}>{companyName(entry)}</option>)}
              </Select>
            </label>
            <label className="with-icon"><CalendarDays size={16} aria-hidden="true" /><span className="sr-only">Período</span>
              <Select value={month} onChange={(event) => event.target.value === "otro" ? setMonthPicker(true) : navigate(href(section, { month: event.target.value }, scopeQuery))}>
                {months.map((item) => <option value={item} key={item}>{monthLabel(item, locale)}</option>)}<option value="otro">Otro período…</option>
              </Select>
            </label>
          </div>}
          {mode === "demo" && tourCompany && tourStep === null && <TourEntry selection={sample} />}
          {mode === "auth" && <button type="button" className="tour-entry workspace-guide-entry" aria-haspopup="dialog" onClick={openGuide}>
            <Compass size={17} aria-hidden="true" /> Guía de Sofía
          </button>}
        </header>
        <main id="contenido" className="workspace-main" tabIndex={-1}>
          {mode === "auth" && <NextWorkspaceStep {...guideProps} openGuide={openGuide} />}
          {mode === "demo" && tourCompany && tourStep !== null && <WorkspaceTour
            step={tourStep} sample={sample} current={selection} section={section} continuing={continuing} portable={portable}
            companyName={companyName(tourCompany)} taskTitle={tourTask?.title ?? "la tarea de ejemplo"} sampleSelected={sampleSelected}
            editable={canEdit && sampleSelected && period?.status === "open" && company?.status === "active"}
            close={navigate}
          />}
          {message && <div role="status" className={clsx("notice notice-success", "workspace-feedback")}>{message}<button type="button" className="icon-button" aria-label="Descartar mensaje" onClick={() => setMessage("")}><X size={16} /></button></div>}
          {view}
        </main>
      </div>
    </div>
    {mode === "auth" && guideOpen && <WorkspaceGuide {...guideProps} close={() => setGuideOpen(false)} restoreFocus={() => guideTrigger.current?.focus()} />}
    {monthPicker && <Modal title="Seleccionar período" description="Elegí el mes contable que querés consultar." close={() => setMonthPicker(false)}>
      <form onSubmit={(event) => {
        event.preventDefault();
        const parsed = monthSchema.safeParse(new FormData(event.currentTarget).get("month"));
        if (parsed.success) {
          setMonthPicker(false);
          navigate(href(section, { month: parsed.data }, scopeQuery));
        }
      }}>
        <Field label="Mes y año"><Input name="month" type="month" min="2000-01" max="2099-12" defaultValue={month} required /></Field>
        <div className="form-actions"><button className="button button-primary" type="submit">Aplicar período</button></div>
      </form>
    </Modal>}
  </WorkspaceContext.Provider>;
}
