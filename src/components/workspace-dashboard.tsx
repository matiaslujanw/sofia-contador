"use client";

import { bookObligations } from "@/lib/accounting/engine";
import {
  Activity, Building2, CalendarClock, CalendarDays, ChartNoAxesCombined, Check, ChevronDown, ChevronRight,
  ClipboardCheck, Clock3, FileUp, Files, ListChecks, Plus, ReceiptText, ShieldAlert, Wallet, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import type { CSSProperties } from "react";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { companyName, dayLabel, initials, money, monthLabel } from "@/lib/workspace/format";
import { activityLabel, companyInsights, periodRows, scopeAlerts } from "@/lib/workspace/insights";
import { useWorkspace } from "./workspace-context";
import { Badge, Empty, Heading, Progress, SectionHeading } from "./workspace-ui";

export function Kpi({ title, value, note, icon: Icon, tone = "accent" }: {
  title: string; value: string | number | null; note: string; icon: LucideIcon; tone?: "accent" | "positive" | "warning" | "neutral";
}) {
  return <article className="panel kpi">
    <div className="kpi-top"><p>{title}</p><span className={`section-icon ${tone}`}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span></div>
    <strong className={value === null ? "kpi-empty" : "numbers"}>{value ?? "Pendiente"}</strong><small>{note}</small>
  </article>;
}

export function StudyDashboard() {
  const { state, month, today, canEdit, href, locale } = useWorkspace();
  const rows = periodRows(state, month);
  const open = rows.filter((row) => row.period?.status !== "closed");
  const missing = rows.reduce((total, row) => total + row.tasks.filter((task) => task.status === "waiting").length, 0);
  const pending = rows.reduce((total, row) => total + (row.period?.status === "closed" ? 0 : row.progress.pending), 0);
  const companyIds = new Set(rows.map((row) => row.company.id));
  const periodIds = new Set(rows.flatMap((row) => row.period ? [row.period.id] : []));
  const alerts = scopeAlerts(state, month).filter((alert) => companyIds.has(alert.companyId));
  const due = [...state.obligations,...bookObligations(state)].filter((entry) => periodIds.has(entry.period_id) && entry.due_on >= today && ["pending", "filed"].includes(entry.status))
    .sort((a, b) => a.due_on.localeCompare(b.due_on));
  const activity = state.activity.filter((event) => event.period_id ? periodIds.has(event.period_id) : (!event.company_id || companyIds.has(event.company_id)) && event.created_at.slice(0, 7) === month)
    .sort((a, b) => b.created_at.localeCompare(a.created_at)).slice(0, 4);

  const completedTasks = rows.reduce((total, row) => total + row.progress.complete, 0);
  const totalTasks = rows.reduce((total, row) => total + row.progress.total, 0);
  const progress = totalTasks ? Math.round(completedTasks * 100 / totalTasks) : null;

  return <>
    <section className="study-hero" aria-labelledby="study-title">
      <div className="study-hero-copy">
        <p className="study-period"><CalendarDays size={16} aria-hidden="true" /> {monthLabel(month, locale)}</p>
        <h1 id="study-title">Resumen del estudio</h1>
        <p className="study-intro">Seguí el cierre mensual y revisá lo que necesita atención.</p>
        <div className="study-actions">
          <Link className="button button-primary" href={href("cierre")}><ClipboardCheck size={17} aria-hidden="true" /> Ver cierres</Link>
          {canEdit && <Link className="button button-secondary" href={href("documentacion", {}, { tipo: "compras" })}><FileUp size={17} aria-hidden="true" /> Importar archivo</Link>}
        </div>
      </div>
      <div className="study-hero-visual">
        <div className="study-ring" style={{ "--ring-progress": `${progress ?? 0}%` } as CSSProperties}
          role="img" aria-label={progress === null ? "Sin tareas aplicables" : `Avance general del cierre: ${progress}%`}>
          <div className="study-ring-label" aria-hidden="true"><strong className="numbers">{progress === null ? "—" : `${progress}%`}</strong><span>Avance general</span></div>
        </div>
        {progress !== null && <p className="study-ring-caption"><strong>Avance general</strong>{completedTasks} de {totalTasks} tareas completadas</p>}
      </div>
    </section>
    <section className="study-metrics" aria-label="Indicadores del período">
      <div><span className="metric-icon metric-rose"><ClipboardCheck size={19} aria-hidden="true" /></span><p><strong className="numbers">{open.length}</strong><span>Cierres por completar</span></p></div>
      <div><span className="metric-icon metric-mint"><ListChecks size={19} aria-hidden="true" /></span><p><strong className="numbers">{pending}</strong><span>Tareas pendientes</span></p></div>
      <div><span className="metric-icon metric-amber"><Files size={19} aria-hidden="true" /></span><p><strong className="numbers">{missing}</strong><span>Respaldos pendientes</span></p></div>
    </section>
    <div className="study-grid">
      <section className="panel study-panel">
        <SectionHeading title="Cierres por empresa" subtitle={rows.length ? `${rows.length} ${rows.length === 1 ? "empresa activa" : "empresas activas"}` : undefined}
          action={canEdit && <Link className="button button-secondary" href={href("empresas", {}, { tipo: "nueva" })}><Plus size={16} aria-hidden="true" /> Nueva empresa</Link>} />
        {rows.length ? <ul className="data-list study-close-list">
          {rows.map(({ company, period, progress }, index) =>
            <li key={company.id}><Link className="data-row" href={href("cierre", { companyId: company.id })}>
              <span aria-hidden="true" className={`avatar tone-${index % 3}`}>{initials(companyName(company))}</span>
              <span className="data-main"><strong>{companyName(company)}</strong><small>{period ? `${progress.complete} de ${progress.total} tareas` : "Período sin iniciar"}</small></span>
              {period && <div className="study-row-progress">
                <Progress value={progress.percent} label={`Avance de ${companyName(company)}`} />
                <span className="numbers">{progress.percent}%</span>
              </div>}
              <ChevronRight size={17} className="study-row-chevron" aria-hidden="true" />
            </Link></li>)}
        </ul> : <Empty icon={Building2} title="Todavía no hay empresas activas" text="Agregá una empresa para comenzar su cierre mensual." />}
      </section>
      <section className="panel study-panel">
        <SectionHeading title="Requiere atención" action={alerts.length > 0 && <Link className="text-button" href={href("auditoria")}>Ver alertas</Link>} />
        {alerts.length ? <ul className="data-list study-attention-list">{alerts.slice(0, 3).map((alert) => {
          const company = state.companies.find((entry) => entry.id === alert.companyId);
          return <li key={alert.id}>
            <Link className="data-row" href={href(alert.section, { companyId: alert.companyId })}>
              <span className="alert-marker"><ShieldAlert size={16} aria-hidden="true" /></span>
              <span className="data-main"><strong>{alert.title}</strong><small>{company ? companyName(company) : alert.type}</small></span>
              <ChevronRight size={16} className="study-row-chevron" aria-hidden="true" />
            </Link>
          </li>;
        })}</ul> : <Empty icon={Check} title="Sin alertas para este período" />}
      </section>
    </div>
    <div className="study-grid">
      <section className="panel study-panel">
        <SectionHeading title="Próximos vencimientos" action={<Link className="text-button" href={href("calendario")}>Abrir calendario</Link>} />
        {due.length ? <ul className="data-list study-attention-list">
          {due.slice(0, 3).map((entry) => {
            const company = state.companies.find((company) => company.id === entry.company_id);
            return <li key={entry.id}><div className="data-row">
              <span className="date-tile" aria-label={dayLabel(entry.due_on, undefined, locale)}><strong>{Number(entry.due_on.slice(-2))}</strong><small>{dayLabel(entry.due_on, { month: "short" }, locale)}</small></span>
              <span className="data-main"><strong>{entry.title}</strong><small>{company ? companyName(company) : ""}</small></span>
              <Badge tone="warning">{entry.status === "filed" ? "Presentado" : "Pendiente"}</Badge>
            </div></li>;
          })}
        </ul> : <Empty icon={CalendarClock} title="Sin vencimientos próximos" />}
      </section>
      <details className="panel study-panel study-activity">
        <summary><Activity size={17} aria-hidden="true" /> Actividad reciente<ChevronDown size={17} aria-hidden="true" /></summary>
        {activity.length ? <ul className="data-list study-attention-list">
          {activity.map((event) => {
            const company = state.companies.find((entry) => entry.id === event.company_id);
            return <li key={event.id}><div className="data-row"><Clock3 size={17} className="muted" aria-hidden="true" /><span className="data-main">
              <strong>{activityLabel(event.entity, event.action)}</strong><small>{company ? companyName(company) : state.organization?.name}</small></span>
              <span className="data-end"><small>{dayLabel(event.created_at, undefined, locale)}</small></span></div></li>;
          })}
        </ul> : <Empty icon={Activity} title="Sin actividad registrada" />}
        <Link className="text-button" href={href("auditoria")}>Ver auditoría</Link>
      </details>
    </div>
  </>;
}

export function CompanyDashboard({ report = false }: { report?: boolean }) {
  const { company, state, period, month, href, locale } = useWorkspace();
  if (!company) return <>
    <Heading title="Informes financieros" description="Consultá los indicadores de una empresa por período." />
    <section className="panel"><Empty icon={ChartNoAxesCombined} title="Elegí una empresa" text="Usá el selector superior o abrí una empresa desde el listado."
      action={<Link className="button button-secondary" href={href("empresas")}>Ver empresas</Link>} /></section>
  </>;
  const metrics = companyInsights(state, company, month);
  const amount = (value: bigint | null) => value === null ? null : money(value, company.currency, locale);
  const graph = metrics.series.map((entry) => ({
    month: monthLabel(entry.month, locale, true), sales: entry.sales === null ? null : Number(entry.sales) / 100,
    purchases: entry.purchases === null ? null : Number(entry.purchases) / 100,
  }));

  return <>
    <section className="company-overview">
      <span aria-hidden="true" className="avatar company-hero-avatar">{initials(companyName(company))}</span>
      <Heading title={report ? "Informes financieros" : companyName(company)} description={`${report ? companyName(company) + " · " : ""}${monthLabel(month, locale)} · ${company.currency}`}
        actions={<Link className="button button-secondary" href={href("cierre")}><ClipboardCheck size={17} aria-hidden="true" /> Abrir cierre</Link>} />
    </section>
    {metrics.otherCurrencies > 0 && <p className="notice">Hay {metrics.otherCurrencies} comprobantes en otras monedas. Los totales de esta pantalla corresponden a {company.currency}.</p>}
    <div className="kpi-grid">
      <Kpi title="Ventas netas" value={amount(metrics.sales)} note={metrics.sales === 0n ? "Margen sobre ventas no aplicable" : "Base neta de comprobantes emitidos"} icon={ReceiptText} tone="positive" />
      <Kpi title="Compras netas" value={amount(metrics.purchases)} note="Base neta de comprobantes recibidos" icon={Files} />
      <Kpi title="IVA de compras" value={amount(metrics.vatCreditReported)} note="IVA informado en comprobantes recibidos" icon={Wallet} tone="neutral" />
      <Kpi title="Avance del cierre" value={period ? `${metrics.progress.percent}%` : null} note={period ? `${metrics.progress.complete} de ${metrics.progress.total} tareas aplicables` : "Período sin iniciar"} icon={ClipboardCheck} tone="warning" />
    </div>
    <div className="dashboard-grid">
      <section className="panel">
        <SectionHeading title="Evolución de compras y ventas" subtitle={`Últimos seis meses · ${company.currency}`} icon={ChartNoAxesCombined} />
        {graph.some((entry) => entry.sales !== null || entry.purchases !== null) ? <>
          <div className="chart-box" role="img" aria-label="Gráfico de compras y ventas netas por mes">
            <ResponsiveContainer width="100%" height="100%" minWidth={0} minHeight={240} initialDimension={{ width: 600, height: 246 }}>
              <BarChart data={graph} margin={{ top: 5, left: 2, right: 6, bottom: 0 }}>
                <CartesianGrid stroke="#3a4658" strokeDasharray="3 4" vertical={false} />
                <XAxis dataKey="month" tickFormatter={(value: string) => value.split(" ")[0]} interval={0} tick={{ fill: "#a0aec0", fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis width={62} tick={{ fill: "#a0aec0", fontSize: 11 }} axisLine={false} tickLine={false}
                  tickFormatter={(value) => new Intl.NumberFormat(locale, { notation: "compact" }).format(value)} />
                <Tooltip cursor={{ fill: "#323d50" }} contentStyle={{ background: "#131922", border: "1px solid #465166", borderRadius: 8, color: "#f8fafc" }}
                  labelStyle={{ color: "#f8fafc" }} formatter={(value) => new Intl.NumberFormat(locale, { style: "currency", currency: company.currency }).format(Number(value))} />
                <Bar dataKey="sales" name="Ventas" fill="#2dd4bf" radius={[4, 4, 0, 0]} isAnimationActive={false} />
                <Bar dataKey="purchases" name="Compras" fill="var(--brand)" radius={[4, 4, 0, 0]} isAnimationActive={false} />
              </BarChart>
            </ResponsiveContainer>
          </div>
          <div className="chart-legend"><span><i style={{ background: "#2dd4bf" }} />Ventas</span><span><i style={{ background: "var(--brand)" }} />Compras</span></div>
          <details className="mt-3 text-sm"><summary className="text-button cursor-pointer">Ver datos del gráfico</summary><div className="table-wrap"><table>
            <thead><tr><th scope="col">Período</th><th scope="col" className="cell-numeric">Ventas</th><th scope="col" className="cell-numeric">Compras</th></tr></thead>
            <tbody>{metrics.series.map((entry) => <tr key={entry.month}><td>{monthLabel(entry.month, locale)}</td><td className="cell-numeric">{amount(entry.sales) ?? "Pendiente"}</td><td className="cell-numeric">{amount(entry.purchases) ?? "Pendiente"}</td></tr>)}</tbody>
          </table></div></details>
        </> : <Empty icon={ChartNoAxesCombined} title="Todavía no hay datos para graficar" text="Importá comprobantes del período para consultar su evolución." />}
      </section>
      <section className="panel">
        <SectionHeading title="Control del período" icon={ShieldAlert} />
        <ul className="data-list">
          <li className="data-row"><span className="data-main"><strong>IVA de ventas</strong><small>Informado en comprobantes emitidos</small></span><Badge>{amount(metrics.vatDebit) ?? "Pendiente"}</Badge></li>
          <li className="data-row"><span className="data-main"><strong>Costos y gastos imputados</strong><small>Compras aprobadas en cuentas de costos o gastos</small></span><Badge>{amount(metrics.classifiedExpenses) ?? "Pendiente"}</Badge></li>
          <li className="data-row"><span className="data-main"><strong>Comprobantes por revisar</strong><small>Revisión contable del mes</small></span><Badge tone={metrics.reviewCount ? "warning" : "neutral"}>{metrics.reviewCount}</Badge></li>
          <li className="data-row"><span className="data-main"><strong>Resultado económico</strong><small>Requiere registraciones y ajustes del período</small></span><Badge>Pendiente</Badge></li>
        </ul>
        <Link className="text-button mt-4" href={href("comprobantes")}>Ver comprobantes</Link>
      </section>
    </div>
  </>;
}
