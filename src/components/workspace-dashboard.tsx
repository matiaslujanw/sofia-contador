"use client";

import {
  Building2, CalendarClock, ChartNoAxesCombined, ChevronRight,
  ClipboardCheck, Files, Landmark, ListTree, NotebookPen, Package,
  Plus, ReceiptText, ShieldAlert, Wallet, type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import {brand} from "@/lib/brand";
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
    <Heading title={brand.title} description="Gestión contable de empresas. Organizá las cargas de cada mes, revisá qué falta y prepará los archivos para Xubio."
      actions={canEdit && <Link className="button button-primary" href={href("empresas", {}, { tipo: "nueva" })}><Plus size={17} aria-hidden="true" /> Nueva empresa</Link>} />
    <SectionHeading title="Empresas" subtitle="Elegí una empresa para continuar con sus cargas y su auditoría mensual."/>
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

const occasionalTools = [
  {title:'Plan de cuentas',section:'cuentas',icon:ListTree},
  {title:'Vencimientos fiscales · IVA, IIBB y TEM',section:'calendario',icon:CalendarClock},
  {title:'Clientes y proveedores',section:'contabilidad',tab:'current',icon:Building2},
  {title:'Caja y bancos',section:'contabilidad',tab:'cash',icon:Landmark},
  {title:'Impuestos y sueldos',section:'contabilidad',tab:'accrual',icon:ReceiptText},
  {title:'Conciliación bancaria',section:'contabilidad',tab:'reconciliation',icon:Landmark},
  {title:'Bienes de uso y amortizaciones',section:'contabilidad',tab:'assets',icon:Package},
  {title:'Contabilidad propia · Diario, Mayor y balance',section:'nucleo',icon:NotebookPen},
  {title:'Archivos guardados',section:'documentacion',icon:Files},
] as const;

export function CompanyHome() {
  const {company,month,locale,href,state,period}=useWorkspace();
  if(!company)return null;
  const accounts=state.accounts.filter(a=>a.company_id===company.id&&a.status==='active');
  const vouchers=state.vouchers.filter(v=>v.company_id===company.id&&v.period_id===period?.id);
  const docs=state.documents.filter(d=>d.company_id===company.id&&d.period_id===period?.id);
  const reception=(direction:'purchase'|'sale')=>{
    const rows=vouchers.filter(v=>v.direction===direction);
    const absent=state.tasks.some(t=>t.period_id===period?.id&&t.title===(direction==='sale'?'Recepción de comprobantes emitidos':'Recepción de comprobantes recibidos')&&t.status==='not_applicable');
    return rows.length ? `${rows.length} comprobantes · ${rows.filter(v=>v.review_status!=='approved').length} por revisar` : absent?'Sin actividad declarado':'Pendiente de carga o declaración sin actividad';
  };
  const reports=['diario','mayor','saldos'].filter(kind=>docs.some(d=>d.name.startsWith(`xubio-${kind}-${month}-`))).length;
  const extracts=docs.filter(d=>d.category==='Extractos bancarios').length;
  return <>
    <section className="company-overview">
      <span className="avatar company-hero-avatar" aria-hidden="true">{initials(companyName(company))}</span>
      <Heading title={companyName(company)} description={`CUIT ${cuitLabel(company.cuit)} · ${monthLabel(month,locale)}`}
        actions={<Link className="button button-secondary" href={href('cierre')}>Abrir cierre</Link>}/>
    </section>
    {!period&&<section className="notice">Este mes todavía no está iniciado. <Link className="text-button" href={href('cierre')}>Iniciar período</Link></section>}
    {period?.status==='closed'&&<p className="notice">Período cerrado: podés consultar sus registros. Para modificarlos se requiere la reapertura desde Checklist y cierre.</p>}
    {!accounts.length&&<p className="notice notice-warning">Primero importá el plan de cuentas de Xubio. Se guarda una sola vez por empresa. <Link className="text-button" href={href('cuentas')}>Cargar plan de cuentas</Link></p>}
    <div className="monthly-workflow" aria-label="Trabajo del mes">
      <section className="panel monthly-workflow-step">
        <span className="workflow-number" aria-hidden="true">1</span>
        <SectionHeading title="Cargar el mes" subtitle="Compras y ventas de ARCA, comprobantes manuales y resumen Comafi."/>
        <ul className="workflow-status">
          <li><Link href={href('preparacion',{}, {tipo:'compras'})}><strong>Compras</strong><span>{reception('purchase')}</span></Link></li>
          <li><Link href={href('preparacion',{}, {tipo:'ventas'})}><strong>Ventas</strong><span>{reception('sale')}</span></Link></li>
          <li><Link href={href('preparacion',{}, {tipo:'banco'})}><strong>Banco</strong><span>{extracts?`${extracts} extractos guardados`:'Pendiente de carga'}</span></Link></li>
        </ul>
        <Link className="button button-primary" href={href('preparacion')}>Comenzar preparación del mes</Link>
      </section>
      <section className="panel monthly-workflow-step">
        <span className="workflow-number" aria-hidden="true">2</span>
        <SectionHeading title="Auditar Xubio" subtitle="Subí Diario, Mayor y Sumas y Saldos del mismo mes para comparar."/>
        <p className="workflow-count">{reports} de 3 reportes guardados</p>
        <p className="muted text-sm">Revisá posibles asientos faltantes, diferencias bancarias y documentación pendiente.</p>
        <Link className="button button-primary" href={href('xubio')}>Abrir auditoría de Xubio</Link>
      </section>
      <section className="panel monthly-workflow-step">
        <span className="workflow-number" aria-hidden="true">3</span>
        <SectionHeading title="Revisar y exportar ajustes" subtitle="Confirmá los faltantes y generá el archivo para importar a Xubio."/>
        <p className="muted text-sm">Después de importarlo en Xubio, cargá sus reportes actualizados y volvé a auditar. Descargar un lote no confirma su registración.</p>
        <Link className="button button-secondary" href={href('xubio',{}, {tipo:'exportar'})}>Revisar ajustes para Xubio</Link>
      </section>
    </div>
    <details className="panel occasional-tools">
      <summary>Datos de la empresa y otras tareas <span className="muted">· {accounts.length} cuentas activas</span></summary>
      <p className="muted text-sm mt-3">El plan de cuentas y los vencimientos habituales se configuran una vez. Usá las demás herramientas cuando correspondan.</p>
      <div className="occasional-tool-links">{occasionalTools.map(tool=><Link key={tool.title} className="text-button" href={href(tool.section,{},'tab' in tool?{tipo:tool.tab}:undefined)}><tool.icon size={17} aria-hidden="true"/>{tool.title}</Link>)}</div>
      <Link className="text-button mt-3" href={href('control')}>Papel de trabajo de IVA y controles del mes</Link>
    </details>
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
