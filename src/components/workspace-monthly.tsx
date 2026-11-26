"use client";

import { ClipboardCheck, Download } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { companyName, cuitLabel, money, monthLabel } from "@/lib/workspace/format";
import { monthlyChecklistCsv, monthlyControl, vatDetailCsv, vatSummaryCsv, vatWorksheet } from "@/lib/workspace/monthly-control";
import { useWorkspace } from "./workspace-context";
import { CompanyRequired, PeriodRequired } from "./workspace-operations";
import { Badge, Heading, SectionHeading, TaskBadge } from "./workspace-ui";

function downloadCsv(content: string, name: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = name;
  document.body.append(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 10000);
}

export function MonthlyControlPage() {
  const { state, company, month, locale, canEdit, href, mutate } = useWorkspace();
  const [saving, setSaving] = useState<string | null>(null);
  const [error, setError] = useState("");
  if (!company) return <><Heading title="Control mensual" description="Revisá el circuito contable de cada empresa." /><CompanyRequired /></>;
  const control = monthlyControl(state, company, month);
  const { period, vouchers } = control;
  const sheet = vatWorksheet(vouchers);
  const editable = canEdit && period?.status === "open" && company.status === "active";
  const prefix = `sofia-${company.cuit}-${month}`;
  const amount = (value: bigint) => money(value, "ARS", locale);

  async function addTask(title: string) {
    if (!period || !editable || saving) return;
    setSaving(title);
    setError("");
    try {
      await mutate({ type: "task.save", periodId: period.id, title, status: "pending", notes: "", documentId: null }, "Control agregado al checklist del mes.");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo agregar el control.");
    } finally { setSaving(null); }
  }

  return <>
    <Heading title="Control mensual" description={`${companyName(company)} · CUIT ${cuitLabel(company.cuit)} · ${monthLabel(month, locale)}`}
      actions={period && <button className="button button-secondary" type="button" onClick={() => downloadCsv(monthlyChecklistCsv(company, month, control), `${prefix}-checklist.csv`)}><Download size={16} aria-hidden="true" /> Exportar checklist</button>} />
    {!period ? <PeriodRequired /> : <>
      <section className="panel">
        <SectionHeading title="Pendientes detectados" subtitle="Estos controles usan los registros cargados; completarlos requiere revisión profesional." />
        <div className="monthly-metrics">
          <div><strong>{control.unreviewed}</strong><span>Comprobantes sin aprobar</span></div>
          <div><strong>{control.unclassified}</strong><span>Comprobantes sin cuenta</span></div>
          <div><strong>{sheet.missingCredit}</strong><span>Compras ARS sin IVA computable definido</span></div>
          <div><strong>{control.pendingXubio}</strong><span>Comprobantes sin marcar en Xubio</span></div>
        </div>
        <p className="muted text-sm mt-3">{control.missingTitles.length} controles sugeridos todavía no figuran en el checklist. Agregalos según corresponda; podés marcar «No aplica» desde Cierre mensual.</p>
        {error && <p role="alert" className="notice notice-error">{error}</p>}
      </section>
      <div className="monthly-grid">{control.steps.map((step) => <section className="panel" key={step.id}>
        <SectionHeading title={step.title} action={<Link className="text-button" href={href(step.section)}>Abrir {step.section === "cierre" ? "checklist" : "sección"}</Link>} />
        <p className="muted text-sm">{step.description}</p>
        <ul className="monthly-tasks">{step.tasks.map(({ title, record }) => <li key={title}>
          <span>{title}</span>
          {record ? <TaskBadge status={record.status} /> : editable ? <button type="button" className="button button-secondary" disabled={saving !== null} aria-label={`Agregar control: ${title}`} onClick={() => void addTask(title)}>{saving === title ? "Agregando…" : "Agregar control"}</button> : <Badge>Sin agregar</Badge>}
        </li>)}</ul>
      </section>)}</div>
      <section className="panel" aria-labelledby="iva-worksheet">
        <SectionHeading title="Papel de trabajo de IVA · ARS" subtitle="Subtotales del mes a partir de comprobantes cargados." />
        <h3 id="iva-worksheet" className="sr-only">Detalle preliminar de IVA</h3>
        <div className="notice notice-warning">La diferencia es parcial: faltan saldos anteriores, retenciones, percepciones y ajustes. El IVA bancario requiere su respaldo y revisión. Este papel no determina la declaración jurada ni el importe a pagar.</div>
        <div className="table-wrap mt-3"><table><thead><tr><th>Concepto</th><th className="text-right">Importe ARS</th></tr></thead><tbody>
          <tr><td>IVA ventas informado</td><td className="text-right numbers">{sheet.hasSales ? amount(sheet.reportedDebit) : "Sin comprobantes"}</td></tr>
          <tr><td>IVA compras informado</td><td className="text-right numbers">{sheet.hasPurchases ? amount(sheet.reportedCredit) : "Sin comprobantes"}</td></tr>
          <tr><td>Débito de ventas aprobadas</td><td className="text-right numbers">{amount(sheet.debit)}</td></tr>
          <tr><td>Crédito computable de compras aprobadas y con importe definido</td><td className="text-right numbers">{amount(sheet.credit)}</td></tr>
          <tr><td><strong>Diferencia de subtotales revisados</strong></td><td className="text-right numbers"><strong>{amount(sheet.difference)}</strong></td></tr>
        </tbody></table></div>
        <p className="muted text-sm mt-3">{sheet.unreviewed} comprobantes ARS sin aprobar · {sheet.missingCredit} compras ARS sin crédito definido · {sheet.foreignCurrency} comprobantes en otras monedas excluidos de los subtotales, conservados en el detalle.</p>
        <div className="heading-actions mt-3">
          <button className="button button-secondary" type="button" disabled={!vouchers.length} onClick={() => downloadCsv(vatDetailCsv(company, month, vouchers), `${prefix}-iva-detalle.csv`)}><Download size={16} aria-hidden="true" /> Exportar detalle IVA</button>
          <button className="button button-secondary" type="button" disabled={!vouchers.length} onClick={() => downloadCsv(vatSummaryCsv(company, month, vouchers), `${prefix}-iva-resumen.csv`)}>Exportar resumen IVA</button>
          <Link className="button button-secondary" href={href("comprobantes")}>Revisar comprobantes</Link>
        </div>
      </section>
      <section className="panel">
        <Link className="button button-primary mb-3" href={href("contabilidad")}>Abrir contabilidad operativa</Link>
        <SectionHeading title="Integraciones y alcance" icon={ClipboardCheck} />
        <p className="muted">ARCA: la importación actual usa archivos y asignación de columnas. Los vencimientos se cargan manualmente. TEM Tucumán: falta definir el municipio y sus reglas vigentes.</p>
        <p className="muted mt-3">Xubio: el detalle de IVA usa CSV de trabajo. Desde Contabilidad operativa podés exportar asientos XLS según el modelo oficial; verificá nombres, circuito y una importación de prueba.</p>
        <p className="muted mt-3">Contabilidad operativa reúne aperturas y saldos de cuentas corrientes, cobros y pagos parciales, devengamientos, vinculación de extractos, amortización lineal y asientos. Los informes usan solo registros contabilizados. La conciliación agrupada, conversiones de moneda y liquidaciones fiscales completas requieren una ampliación.</p>
      </section>
    </>}
  </>;
}
