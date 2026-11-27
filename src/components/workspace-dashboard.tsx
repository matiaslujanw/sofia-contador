"use client";

import {
  ArrowLeft, Building2, CalendarClock, Calculator, ChartNoAxesCombined, ChevronRight,
  ClipboardCheck, FileSpreadsheet, Files, Landmark, ListTree, NotebookPen, Package,
  Plus, ReceiptText, ShieldAlert, Users, Wallet, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { companyName, cuitLabel, initials, money, monthLabel } from "@/lib/workspace/format";
import { companyInsights } from "@/lib/workspace/insights";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useWorkspace } from "./workspace-context";
import { Badge, Empty, Heading, SectionHeading } from "./workspace-ui";

export function Kpi({ title, value, note, icon: Icon, tone = "accent" }: {
  title: string; value: string | number | null; note: string; icon: LucideIcon; tone?: "accent" | "positive" | "warning" | "neutral";
}) {
  return <article className="panel kpi">
    <div className="kpi-top"><p>{title}</p><span className={`section-icon ${tone}`}><Icon size={17} strokeWidth={1.8} aria-hidden="true" /></span></div>
    <strong className={value === null ? "kpi-empty" : "numbers"}>{value ?? "Pendiente"}</strong><small>{note}</small>
  </article>;
}

export function StudyDashboard() {
  const { state, canEdit, href } = useWorkspace();
  const companies = state.companies.filter(company => company.status === "active");
  return <>
    <Heading title="Empresas" description="Elegí una empresa para trabajar."
      actions={canEdit && <Link className="button button-primary" href={href("empresas", {}, { tipo: "nueva" })}><Plus size={17} aria-hidden="true" /> Nueva empresa</Link>} />
    {companies.length ? <div className="company-picker" aria-label="Empresas del estudio">
      {companies.map(company => <Link key={company.id} className="panel company-picker-card" href={href("inicio", { companyId: company.id })}>
        <span className="avatar company-hero-avatar" aria-hidden="true">{initials(companyName(company))}</span>
        <span className="company-picker-name"><strong>{companyName(company)}</strong>
          <span>{company.legal_name}</span><small>CUIT {cuitLabel(company.cuit)}</small></span>
        <span className="company-picker-open">Abrir empresa <ChevronRight size={17} aria-hidden="true" /></span>
      </Link>)}
    </div> : <section className="panel"><Empty icon={Building2} title="Todavía no hay empresas activas" text={canEdit ? "Agregá tu primera empresa para comenzar." : "Las empresas aparecerán cuando el estudio las agregue."} /></section>}
  </>;
}

const companyTools = [
  { title: "Vencimientos fiscales", description: "Consultar fuentes oficiales y cargar fechas de ARCA, IIBB y TEM.", section: "calendario", icon: CalendarClock },
  { title: "Compras y ventas", description: "Cargar comprobantes manuales, importar y revisar su clasificación.", section: "comprobantes", icon: ReceiptText },
  { title: "Clientes y proveedores", description: "Saldos iniciales, cuentas corrientes, cobros y pagos parciales.", section: "contabilidad", tab: "current", icon: Users },
  { title: "Caja y bancos", description: "Registrar ingresos, egresos, gastos bancarios y otros movimientos.", section: "contabilidad", tab: "cash", icon: Wallet },
  { title: "Impuestos y sueldos", description: "Devengamientos, obligaciones, pagos y control fiscal bancario.", section: "contabilidad", tab: "accrual", icon: Calculator },
  { title: "Papel de trabajo de IVA", description: "Revisar subtotales de IVA y descargar el detalle del período.", section: "control", anchor: "iva-worksheet", icon: FileSpreadsheet },
  { title: "Conciliación bancaria", description: "Cargar extractos, controlar saldos y vincular movimientos.", section: "contabilidad", tab: "reconciliation", icon: Landmark },
  { title: "Bienes de uso y amortizaciones", description: "Altas, vida útil y registro de la cuota mensual.", section: "contabilidad", tab: "assets", icon: Package },
  { title: "Asientos y Xubio", description: "Preparar asientos balanceados y exportar el archivo XLS.", section: "contabilidad", tab: "journal", icon: NotebookPen },
  { title: "Ingresos, egresos y rentabilidad", description: "Consultar el resultado y el flujo de fondos con gráficos.", section: "contabilidad", tab: "reports", icon: ChartNoAxesCombined },
  { title: "Documentación e importaciones", description: "Guardar respaldos e importar planillas de la empresa.", section: "documentacion", icon: Files },
  { title: "Plan de cuentas", description: "Consultar, cargar o importar las cuentas contables.", section: "cuentas", icon: ListTree },
  { title: "Checklist y cierre mensual", description: "Controlar lo pendiente, completar tareas y cerrar el mes.", section: "cierre", icon: ClipboardCheck },
  { title: "Auditoría mensual de Xubio", description: "Cargar reportes, comparar registraciones y exportar faltantes revisados.", section: "xubio", icon: ShieldAlert },
  { title: "Auditoría y controles", description: "Revisar alertas y el historial de cambios de esta empresa.", section: "auditoria", icon: ShieldAlert },
] as const;

export function CompanyHome() {
  const { company, month, locale, href, state, period } = useWorkspace();
  if (!company) return null;
  const accounts=state.accounts.filter(a=>a.company_id===company.id);
  const vouchers=state.vouchers.filter(v=>v.company_id===company.id&&v.period_id===period?.id);
  const docs=state.documents.filter(d=>d.company_id===company.id&&d.period_id===period?.id);
  const noSales=state.tasks.some(t=>t.period_id===period?.id&&t.title==='Recepción de comprobantes emitidos'&&t.status==='not_applicable')&&!vouchers.some(v=>v.direction==='sale');
  return <>
    <div><Link className="text-button" href={href("inicio", { companyId: undefined })}><ArrowLeft size={16} aria-hidden="true" /> Todas las empresas</Link></div>
    <section className="company-overview">
      <span className="avatar company-hero-avatar" aria-hidden="true">{initials(companyName(company))}</span>
      <Heading title={companyName(company)} description={`CUIT ${cuitLabel(company.cuit)} · ${monthLabel(month, locale)}`}
        actions={<Link className="button button-secondary" href={href("cierre")}>Abrir cierre</Link>} />
    </section>
    <section className="panel" aria-label="Configuración permanente"><SectionHeading title="Datos permanentes de la empresa" subtitle="Se mantienen entre meses y se modifican cuando hace falta."/><Link className="text-button" href={href('cuentas')}>Plan de cuentas · {accounts.length} cuentas guardadas</Link><p className="muted text-sm">{accounts.filter(a=>a.status==='active').length} activas · {accounts.filter(a=>a.status==='inactive').length} inactivas. No requiere una carga mensual.</p></section>
    <section className="panel"><SectionHeading title="Preparar el mes, paso a paso" subtitle="Compras, ventas, resumen bancario y papel impositivo del mes seleccionado." action={<Link className="button button-primary" href={href("preparacion")}>Comenzar preparación del mes</Link>} />
    <h3 className="mt-3">Revisar lo cargado · {monthLabel(month,locale)}</h3><ul className="mt-3"><li><Link className="text-button" href={href('preparacion',{}, {tipo:'compras'})}>Compras: {vouchers.filter(v=>v.direction==='purchase').length} comprobantes · {vouchers.filter(v=>v.direction==='purchase'&&v.review_status!=='approved').length} pendientes de revisión</Link></li><li><Link className="text-button" href={href('preparacion',{}, {tipo:'ventas'})}>Ventas: {noSales?'Sin ventas confirmado':`${vouchers.filter(v=>v.direction==='sale').length} comprobantes`}</Link></li><li><Link className="text-button" href={href('preparacion',{}, {tipo:'banco'})}>Banco: {docs.filter(d=>d.category==='Extractos bancarios').length} extractos · {docs.filter(d=>d.category==='Papeles de trabajo').length} papeles guardados</Link></li></ul><Link className="text-button mt-3" href={href('control')}>Ver controles del mes y pendientes</Link></section>
    <div className="company-tool-grid" aria-label={`Herramientas de ${companyName(company)}`}>
      {companyTools.filter(tool=>tool.section!=='cuentas').map(tool => <Link key={tool.title} className="panel company-tool-card"
        href={href(tool.section, {}, "tab" in tool ? { tipo: tool.tab } : undefined) + ("anchor" in tool ? `#${tool.anchor}` : "")}>
        <span className="section-icon" aria-hidden="true"><tool.icon size={21} /></span>
        <span><strong>{tool.title}</strong><small>{tool.description}</small></span>
        <ChevronRight size={18} aria-hidden="true" />
      </Link>)}
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
