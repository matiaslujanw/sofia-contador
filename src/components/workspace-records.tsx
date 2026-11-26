"use client";

import { Download, FileSpreadsheet, FileText, FileUp, FolderOpen, ListTree, Plus, ReceiptText, Sparkles } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { demoTourVoucherId } from "@/lib/workspace/demo";
import { documentExtensions } from "@/lib/workspace/documents";
import { companyName, cuitLabel, dayLabel, fileSize, money, monthLabel } from "@/lib/workspace/format";
import { accountKinds, documentCategories, paymentStatuses, reviewStatuses, xubioStatuses, type Account, type AccountValues, type Voucher, type VoucherClassification } from "@/lib/workspace/model";
import { ManualVoucher } from "./manual-voucher";
import { ImportPanel } from "./import-panel";
import { useWorkspace } from "./workspace-context";
import { CompanyRequired, PeriodRequired } from "./workspace-operations";
import { ActionForm, Badge, Empty, Field, Heading, Input, Modal, Search, SectionHeading, Select, fieldValue, optionalValue } from "./workspace-ui";

function VoucherForm({ voucher, editable, close }: { voucher: Voucher; editable: boolean; close: () => void }) {
  const { state, mutate, locale } = useWorkspace();
  const accounts = state.accounts.filter((account) => account.company_id === voucher.company_id).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const documents = state.documents.filter((document) => document.period_id === voucher.period_id);
  const rule = state.rules.find((entry) => entry.company_id === voucher.company_id && entry.direction === voucher.direction && entry.counterparty_cuit === voucher.counterparty_cuit);
  const [draft, setDraft] = useState({ account: voucher.account_id ?? "", category: voucher.category ?? "", concept: voucher.concept ?? "", center: voucher.cost_center ?? "" });

  const amounts = [
    ["Neto gravado", voucher.taxable], ["Neto no gravado", voucher.untaxed], ["Exento", voucher.exempt],
    ["IVA", voucher.vat], ["Otros tributos", voucher.other_taxes], ["Total", voucher.total],
  ];
  return <Modal title={editable ? "Revisar comprobante" : "Detalle del comprobante"}
    description={`${voucher.receipt_type} · ${String(voucher.point_of_sale).padStart(4, "0")}-${String(voucher.receipt_number).padStart(8, "0")} · ${dayLabel(voucher.date, { dateStyle: "short" }, locale)}`} close={close}>
    <dl className="receipt-summary numbers">{amounts.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value, voucher.currency, locale)}</dd></div>)}</dl>
    {Object.entries(voucher.vat_breakdown ?? {}).length > 0 && <details className="mb-3 text-sm"><summary className="text-button cursor-pointer">Ver desglose de IVA</summary>
      <ul className="text-sm">{Object.entries(voucher.vat_breakdown).map(([rate, value]) => <li key={rate}>{rate}% · {money(String(value), voucher.currency, locale)}</li>)}</ul>
    </details>}
    <p className="muted mb-4 text-sm">{voucher.counterparty_name || "Contraparte sin identificar"} · {cuitLabel(voucher.counterparty_cuit)} · {voucher.currency}</p>
    {editable ? <>
      {rule && <p className="notice mb-3 flex flex-wrap items-center justify-between gap-2">
        <span>Hay una sugerencia aprobada para esta contraparte.</span>
        <button className="text-button" type="button" onClick={() => setDraft({ account: rule.account_id ?? "", category: rule.category ?? "", concept: rule.concept ?? "", center: rule.cost_center ?? "" })}><Sparkles size={14} /> Aplicar sugerencia</button>
      </p>}
      <ActionForm close={close} label="Guardar revisión" submit={async (form) => {
        const values: VoucherClassification = {
          account_id: draft.account || null, category: draft.category.trim() || null, concept: draft.concept.trim() || null, cost_center: draft.center.trim() || null,
          payment_status: fieldValue(form, "payment") as VoucherClassification["payment_status"], payment_method: optionalValue(form, "method"),
          deductible_vat: optionalValue(form, "deductible")?.replace(",", ".") ?? null,
          review_status: fieldValue(form, "review") as VoucherClassification["review_status"],
          xubio_status: fieldValue(form, "xubio") as VoucherClassification["xubio_status"], notes: optionalValue(form, "notes"), document_id: optionalValue(form, "document"),
        };
        const saveRule = form.get("rule") === "on";
        if (saveRule && values.review_status !== "approved") throw new Error("Aprobá el comprobante para guardar la sugerencia.");
        await mutate({ type: "voucher.classify", id: voucher.id, values, saveRule }, "Revisión guardada.");
      }}>
        <Field label="Cuenta contable" span><Select value={draft.account} onChange={(event) => setDraft({ ...draft, account: event.target.value })}>
          <option value="">Sin imputar</option>{accounts.filter((account) => account.status === "active" || account.id === draft.account).map((account) => <option key={account.id} value={account.id}>{account.code} · {account.name}{account.status === "inactive" ? " (inactiva)" : ""}</option>)}
        </Select></Field>
        <Field label="Categoría"><Input value={draft.category} onChange={(event) => setDraft({ ...draft, category: event.target.value })} maxLength={90} /></Field>
        <Field label="Centro de costo"><Input value={draft.center} onChange={(event) => setDraft({ ...draft, center: event.target.value })} maxLength={100} /></Field>
        <Field label="Concepto" span><Input value={draft.concept} onChange={(event) => setDraft({ ...draft, concept: event.target.value })} maxLength={220} /></Field>
        <Field label={voucher.direction === "purchase" ? "Estado de pago" : "Estado de cobro"}><Select name="payment" defaultValue={voucher.payment_status}>
          {Object.entries(paymentStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select></Field>
        <Field label="Medio de pago"><Input name="method" defaultValue={voucher.payment_method ?? ""} maxLength={80} /></Field>
        {voucher.direction === "purchase" && <Field label="Crédito fiscal computable"><Input name="deductible" inputMode="decimal" defaultValue={voucher.deductible_vat ?? ""} placeholder="0,00" /></Field>}
        <Field label="Documento respaldatorio"><Select name="document" defaultValue={voucher.document_id ?? ""}><option value="">Sin documento</option>
          {documents.map((document) => <option key={document.id} value={document.id}>{document.name}</option>)}</Select></Field>
        <Field label="Estado de revisión"><Select name="review" defaultValue={voucher.review_status}>
          {Object.entries(reviewStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select></Field>
        <Field label="Registración en Xubio"><Select name="xubio" defaultValue={voucher.xubio_status}>
          {Object.entries(xubioStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}
        </Select></Field>
        <Field label="Observaciones" span><textarea className="control" name="notes" defaultValue={voucher.notes ?? ""} maxLength={4000} /></Field>
        {voucher.counterparty_cuit && <label className="check-field field-wide"><input type="checkbox" name="rule" className="control" /> Guardar la imputación aprobada como sugerencia para futuros comprobantes de esta contraparte.</label>}
      </ActionForm>
    </> : <dl className="record-details">
      <div><dt>Cuenta contable</dt><dd>{accounts.find((account) => account.id === voucher.account_id)?.name || "Sin imputar"}</dd></div>
      <div><dt>Categoría</dt><dd>{voucher.category || "—"}</dd></div><div><dt>Centro de costo</dt><dd>{voucher.cost_center || "—"}</dd></div>
      <div><dt>Concepto</dt><dd>{voucher.concept || "—"}</dd></div><div><dt>Pago o cobro</dt><dd>{paymentStatuses[voucher.payment_status]}</dd></div>
      <div><dt>Medio de pago</dt><dd>{voucher.payment_method || "—"}</dd></div><div><dt>Revisión</dt><dd>{reviewStatuses[voucher.review_status]}</dd></div>
      <div><dt>Registración en Xubio</dt><dd>{xubioStatuses[voucher.xubio_status]}</dd></div><div><dt>Respaldo</dt><dd>{documents.find((document) => document.id === voucher.document_id)?.name || "—"}</dd></div>
      <div><dt>Observaciones</dt><dd>{voucher.notes || "—"}</dd></div>
    </dl>}
  </Modal>;
}

export function VouchersPage({ guide = false, closeGuide, initialDirection = "purchase" }: { guide?: boolean; closeGuide?: () => void; initialDirection?: Voucher["direction"] }) {
  const { company, period, state, month, locale, href, canEdit } = useWorkspace();
  const [manual,setManual]=useState(false);
  const [direction, setDirection] = useState<Voucher["direction"]>(initialDirection);
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("");
  const [selection, setSelected] = useState<Voucher | null>(null);
  const editable = canEdit && period?.status === "open" && company?.status === "active";
  const all = state.vouchers.filter((entry) => entry.period_id === period?.id);
  const selected = selection ?? (closeGuide ? all.find((entry) => entry.id === demoTourVoucherId) : null);
  const vouchers = all.filter((entry) => entry.direction === direction && (!status || entry.review_status === status) &&
    [entry.counterparty_name, entry.counterparty_cuit, cuitLabel(entry.counterparty_cuit), entry.receipt_type, entry.receipt_number].join(" ").toLowerCase().includes(query.toLowerCase()))
    .sort((a, b) => b.date.localeCompare(a.date) || b.receipt_number - a.receipt_number);
  return <>
    <Heading title="Compras y ventas" description={company ? `${companyName(company)} · ${monthLabel(month, locale)}` : "Consultá y clasificá los comprobantes del período."}
      actions={editable && <><button className="button button-primary" type="button" onClick={()=>setManual(true)}>Nuevo comprobante</button><Link className="button button-secondary" href={href("documentacion", {}, { tipo: direction === "purchase" ? "compras" : "ventas" })}><FileUp size={17} /> Importar</Link></>} />
    {!company ? <CompanyRequired /> : !period ? <PeriodRequired /> : <section className="panel">
      <div className="segments" aria-label="Dirección del comprobante">
        <button type="button" className="segment" aria-pressed={direction === "purchase"} onClick={() => setDirection("purchase")}>Compras <span>{all.filter((entry) => entry.direction === "purchase").length}</span></button>
        <button type="button" className="segment" aria-pressed={direction === "sale"} onClick={() => setDirection("sale")}>Ventas <span>{all.filter((entry) => entry.direction === "sale").length}</span></button>
      </div>
      <div className="table-toolbar"><Search label="Buscar comprobante o CUIT" value={query} onChange={setQuery} />
        <Select aria-label="Estado de revisión" value={status} onChange={(event) => setStatus(event.target.value)}><option value="">Todas las revisiones</option>
          {Object.entries(reviewStatuses).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select>
      </div>
      {vouchers.length ? <div className="table-wrap"><table>
        <thead><tr><th>Fecha</th><th>Comprobante</th><th>{direction === "purchase" ? "Proveedor" : "Cliente"}</th><th>Revisión</th><th className="cell-numeric">Total</th><th className="text-right">Acciones</th></tr></thead>
        <tbody>{vouchers.map((entry) => <tr key={entry.id} className={guide && entry.id === demoTourVoucherId ? "tour-target-row" : undefined}><td className="cell-nowrap numbers">{dayLabel(entry.date, { dateStyle: "short" }, locale)}</td>
          <td className="cell-nowrap">{entry.receipt_type}<small className="numbers">{String(entry.point_of_sale).padStart(4, "0")}-{String(entry.receipt_number).padStart(8, "0")}</small></td>
          <td className="cell-main">{entry.counterparty_name || "Sin identificar"}<small>{cuitLabel(entry.counterparty_cuit)}</small></td>
          <td><Badge tone={entry.review_status === "approved" ? "positive" : entry.review_status === "review" ? "warning" : "neutral"} dot>{reviewStatuses[entry.review_status]}</Badge></td>
          <td className="cell-numeric">{money(entry.total, entry.currency, locale)}<small>{entry.currency}</small></td>
          <td><div className="table-actions"><button type="button" className="button button-secondary" onClick={() => setSelected(entry)}>{editable ? "Revisar" : "Ver"}</button></div></td>
        </tr>)}</tbody>
      </table></div> : <Empty icon={ReceiptText} title={query || status ? "Sin comprobantes para estos filtros" : `Sin comprobantes de ${direction === "purchase" ? "compras" : "ventas"}`}
        text={editable && !query && !status ? "Podés importar una planilla y revisar sus columnas antes de guardar." : undefined} />}
    </section>}
    {manual && <ManualVoucher direction={direction} close={()=>setManual(false)}/>}
    {selected && <VoucherForm voucher={selected} editable={editable} close={() => { setSelected(null); closeGuide?.(); }} />}
  </>;
}

const blankAccount: AccountValues = { code: "", name: "", kind: "asset", parent_code: null, category: null, status: "active" };

export function AccountsPage() {
  const { company, state, href, canEdit, mutate } = useWorkspace();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [selected, setSelected] = useState<Account | "new" | null>(null);
  const editable = !!company && canEdit && company.status === "active";
  const accounts = state.accounts.filter((entry) => entry.company_id === company?.id).sort((a, b) => a.code.localeCompare(b.code, undefined, { numeric: true }));
  const visible = accounts.filter((entry) => (!filter || filter === entry.kind) && `${entry.code} ${entry.name} ${entry.category ?? ""}`.toLowerCase().includes(query.toLowerCase()));
  const account = selected === "new" ? blankAccount : selected;

  return <>
    <Heading title="Plan de cuentas" description={company ? `Clasificación y cuentas de ${companyName(company)}.` : "Administrá las cuentas contables de cada empresa."}
      actions={editable && <><Link className="button button-secondary" href={href("documentacion", {}, { tipo: "cuentas" })}><FileUp size={17} /> Importar plan</Link>
        <button type="button" className="button button-primary" onClick={() => setSelected("new")}><Plus size={17} /> Nueva cuenta</button></>} />
    {!company ? <CompanyRequired /> : <section className="panel">
      <div className="table-toolbar"><Search label="Buscar cuenta o código" value={query} onChange={setQuery} />
        <Select aria-label="Tipo de cuenta" value={filter} onChange={(event) => setFilter(event.target.value)}><option value="">Todos los tipos</option>
          {Object.entries(accountKinds).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</Select></div>
      {visible.length ? <div className="table-wrap"><table>
        <thead><tr><th>Código</th><th>Cuenta</th><th>Tipo</th><th>Cuenta superior</th><th>Categoría</th><th>Estado</th>{editable && <th className="text-right">Acciones</th>}</tr></thead>
        <tbody>{visible.map((entry) => <tr key={entry.id}>
          <td className="numbers cell-nowrap">{entry.code}</td><td className="cell-main">{entry.name}</td><td>{accountKinds[entry.kind]}</td>
          <td>{entry.parent_code ?? "—"}</td><td>{entry.category ?? "—"}</td>
          <td><Badge dot tone={entry.status === "active" ? "positive" : "neutral"}>{entry.status === "active" ? "Activa" : "Inactiva"}</Badge></td>
          {editable && <td><div className="table-actions"><button className="button button-secondary" type="button" onClick={() => setSelected(entry)} aria-label={`Editar cuenta ${entry.name}`}>Editar</button></div></td>}
        </tr>)}</tbody>
      </table></div> : <Empty icon={ListTree} title={query || filter ? "Sin cuentas para estos filtros" : "Sin cuentas contables"} text="Podés crear una cuenta o importar un plan de cuentas." />}
    </section>}
    {editable && company && account && <Modal title={selected === "new" ? "Nueva cuenta" : "Editar cuenta"} description={companyName(company)} close={() => setSelected(null)}>
      <ActionForm close={() => setSelected(null)} submit={async (data) => {
        await mutate({ type: "account.save", companyId: company.id, id: selected && selected !== "new" ? selected.id : undefined, values: {
          code: fieldValue(data, "code"), name: fieldValue(data, "name"), kind: fieldValue(data, "kind") as AccountValues["kind"],
          parent_code: optionalValue(data, "parent"), category: optionalValue(data, "category"), status: fieldValue(data, "status") as AccountValues["status"],
        } }, "Cuenta guardada.");
      }}>
        <Field label="Código"><Input name="code" defaultValue={account.code} readOnly={selected !== "new"} required maxLength={45} /></Field>
        <Field label="Tipo"><Select name="kind" defaultValue={account.kind}>{Object.entries(accountKinds).map(([key, label]) => <option value={key} key={key}>{label}</option>)}</Select></Field>
        <Field label="Nombre" span><Input name="name" defaultValue={account.name} required maxLength={180} /></Field>
        <Field label="Cuenta superior"><Select name="parent" defaultValue={account.parent_code ?? ""}><option value="">Sin cuenta superior</option>
          {accounts.filter((candidate) => candidate.code !== account.code).map((candidate) => <option value={candidate.code} key={candidate.id}>{candidate.code} · {candidate.name}</option>)}
        </Select></Field>
        <Field label="Categoría interna"><Input name="category" defaultValue={account.category ?? ""} maxLength={90} /></Field>
        <Field label="Estado"><Select name="status" defaultValue={account.status}><option value="active">Activa</option><option value="inactive">Inactiva</option></Select></Field>
      </ActionForm>
    </Modal>}
  </>;
}

export function DocumentsPage({ purpose }: { purpose?: string }) {
  const { company, period, state, month, locale, canEdit, upload, download, confirmImport } = useWorkspace();
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState("");
  const [uploadOpen, setUploadOpen] = useState(false);
  const [error, setError] = useState("");
  const editable = canEdit && period?.status === "open" && company?.status === "active";
  const [tab, setTab] = useState(purpose ? "import" : "files");
  const docs = state.documents.filter((entry) => entry.period_id === period?.id && (!category || category === entry.category) &&
    entry.name.toLowerCase().includes(query.toLowerCase())).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const imports = state.imports.filter((entry) => entry.period_id === period?.id).sort((a, b) => b.created_at.localeCompare(a.created_at));
  const importLabels = { purchase: "Compras", sale: "Ventas", accounts: "Plan de cuentas" };
  return <>
    <Heading title="Documentación" description={company ? `${companyName(company)} · ${monthLabel(month, locale)}` : "Organizá los respaldos e importá planillas por empresa y período."}
      actions={editable && <button type="button" className="button button-primary" onClick={() => setUploadOpen(true)}><FileUp size={17} /> Subir documento</button>} />
    {!company ? <CompanyRequired description="Seleccioná la empresa en la barra superior para ver sus archivos e importar datos." /> : !period ? <PeriodRequired /> : <>
      <div className="segments" aria-label="Tipo de documentación">
        <button type="button" className="segment" aria-pressed={tab === "files"} onClick={() => setTab("files")}><FolderOpen size={17} /> Archivos</button>
        <button type="button" className="segment" aria-pressed={tab === "import"} onClick={() => setTab("import")}><FileSpreadsheet size={17} /> Importaciones</button>
      </div>
      {tab === "files" ? <section className="panel">
        <SectionHeading title="Documentos del período" icon={FolderOpen} />
        {error && <p className="notice notice-error mb-3" role="alert">{error}</p>}
        <div className="table-toolbar"><Search label="Buscar archivo" value={query} onChange={setQuery} />
          <Select aria-label="Categoría de documento" value={category} onChange={(event) => setCategory(event.target.value)}><option value="">Todas las categorías</option>
            {documentCategories.map((entry) => <option key={entry}>{entry}</option>)}</Select></div>
        {docs.length ? <div className="table-wrap"><table><thead><tr><th>Archivo</th><th>Categoría</th><th>Subido</th><th className="cell-numeric">Tamaño</th><th className="text-right">Acciones</th></tr></thead>
          <tbody>{docs.map((entry) => <tr key={entry.id}>
            <td className="cell-main"><div className="flex items-center gap-2"><FileText size={16} className="muted shrink-0" /> <span className="wrap-anywhere">{entry.name}</span></div></td>
            <td>{entry.category}</td><td className="cell-nowrap">{dayLabel(entry.created_at, { dateStyle: "short" }, locale)}</td><td className="cell-numeric">{fileSize(entry.size_bytes)}</td>
            <td><div className="table-actions"><button type="button" className="button button-secondary" aria-label={`Descargar ${entry.name}`} onClick={() => {
              setError("");
              void download(entry).catch((reason: Error) => setError(reason.message));
            }}><Download size={15} /> Descargar</button></div></td>
          </tr>)}</tbody></table></div> : <Empty icon={FolderOpen} title={query || category ? "Sin archivos para estos filtros" : "Todavía no hay documentos"} />}
      </section> : <>
        {editable && <ImportPanel key={period.id} month={month} initialKind={purpose === "cuentas" ? "accounts" : purpose === "ventas" ? "sales" : "purchases"} onConfirm={confirmImport} />}
        <section className="panel"><SectionHeading title="Historial de importaciones" icon={FileSpreadsheet} />
          {imports.length ? <div className="table-wrap"><table><thead><tr><th>Original</th><th>Tipo</th><th>Fecha</th><th className="cell-numeric">Importadas</th><th className="cell-numeric">Duplicadas</th></tr></thead>
            <tbody>{imports.map((entry) => <tr key={entry.id}><td className="cell-main">{state.documents.find((document) => document.id === entry.document_id)?.name ?? "Archivo original"}</td>
              <td>{importLabels[entry.kind]}</td><td className="cell-nowrap">{dayLabel(entry.created_at, { dateStyle: "short" }, locale)}</td>
              <td className="cell-numeric">{entry.row_count}</td><td className="cell-numeric">{entry.duplicate_count}</td></tr>)}</tbody>
          </table></div> : <Empty icon={FileSpreadsheet} title="Sin importaciones en este período" />}
        </section>
      </>}
    </>}
    {editable && uploadOpen && <Modal title="Subir documento" description="Guardá un archivo original como respaldo del período." close={() => setUploadOpen(false)}>
      <ActionForm close={() => setUploadOpen(false)} label="Subir documento" submit={async (data) => {
        const file = data.get("file");
        if (!(file instanceof File)) throw new Error("Seleccioná el archivo.");
        await upload(fieldValue(data, "category"), file);
        setTab("files");
      }}>
        <Field label="Categoría" span><Select name="category" defaultValue="Respaldos">{documentCategories.map((entry) => <option key={entry}>{entry}</option>)}</Select></Field>
        <Field label="Archivo (hasta 3 MB)" span><Input type="file" name="file" accept={documentExtensions.join(",")} required /></Field>
      </ActionForm>
    </Modal>}
  </>;
}
