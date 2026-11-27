"use client";

import { useId, useMemo, useRef, useState, type ChangeEvent } from "react";
import { Download, FileSpreadsheet, UploadCloud } from "lucide-react";
import {
  fieldsFor, IMPORT_MAX_BYTES, previewImport, readSource, suggestMapping, templateCsv,
  type ColumnMapping, type DecimalFormat, type ImportKind, type SourceTable,
} from "@/lib/imports";

const kinds: { value: ImportKind; label: string; template: string }[] = [
  { value: "purchases", label: "Compras · comprobantes recibidos", template: "compras" },
  { value: "sales", label: "Ventas · comprobantes emitidos", template: "ventas" },
  { value: "accounts", label: "Plan de cuentas", template: "plan-de-cuentas" },
];

const accountKinds = {
  asset: "Activo", liability: "Pasivo", equity: "Patrimonio neto",
  revenue: "Ingresos", cost: "Costos", expense: "Gastos",
};
const previewPageSize = 8;

function outcomeMessage({ row_count, duplicate_count, reused }: Outcome, kind: ImportKind) {
  if (reused) return kind === "accounts" ? "Este archivo del plan ya está guardado para esta empresa." : "Este archivo ya se había importado para este tipo y período.";
  const saved = row_count === 1 ? "Se guardó 1 fila." : `Se guardaron ${row_count} filas.`;
  const skipped = duplicate_count === 1 ? "Se omitió 1 duplicado." : `Se omitieron ${duplicate_count} duplicados.`;
  return `${saved} ${skipped}`;
}

type Outcome = { row_count: number; duplicate_count: number; reused: boolean };
type ImportRequest = { file: File; kind: ImportKind; mapping: ColumnMapping; decimal: DecimalFormat };
type ImportPanelProps = {
  month: string;
  disabled?: boolean;
  initialKind?: ImportKind;
  lockedKind?: boolean;
  onConfirm: (input: ImportRequest) => Promise<Outcome>;
};

export function ImportPanel({ month, disabled = false, initialKind = "purchases", lockedKind = false, onConfirm }: ImportPanelProps) {
  const fileInput = useId();
  const uploadRequest = useRef(0);
  const [kind, setKind] = useState<ImportKind>(initialKind);
  const [decimal, setDecimal] = useState<DecimalFormat>("auto");
  const [file, setFile] = useState<File | null>(null);
  const [table, setTable] = useState<SourceTable | null>(null);
  const [mapping, setMapping] = useState<ColumnMapping>({});
  const [reviewedMonth, setReviewedMonth] = useState("");
  const [page, setPage] = useState(0);
  const [reading, setReading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [outcome, setOutcome] = useState<Outcome | null>(null);

  const fields = useMemo(() => fieldsFor(kind), [kind]);
  const preview = useMemo(() => table ? previewImport(kind, table, mapping, { month, decimal }) : null,
    [decimal, kind, mapping, month, table]);
  const rowCount = preview ? preview.accounts.length + preview.vouchers.length : 0;
  const pageCount = Math.ceil(rowCount / previewPageSize);
  const visiblePage = Math.max(0, Math.min(page, pageCount - 1));
  const pageStart = visiblePage * previewPageSize;
  const reviewed = reviewedMonth === month;
  const hasErrors = preview?.issues.some(({ severity }) => severity === "error") ?? false;
  const templateName = kinds.find(({ value }) => value === kind)!.template;
  const templateLink = `data:text/csv;charset=utf-8,${encodeURIComponent(templateCsv(kind))}`;

  function changeKind(event: ChangeEvent<HTMLSelectElement>) {
    const next = event.target.value as ImportKind;
    setKind(next);
    setMapping(table ? suggestMapping(next, table.headers) : {});
    setReviewedMonth("");
    setPage(0);
    setOutcome(null);
    setError("");
  }

  function assignColumn(key: string, column: string) {
    setMapping((current) => {
      const next = { ...current };
      if (column === "") delete next[key];
      else next[key] = Number(column);
      return next;
    });
    setReviewedMonth("");
    setPage(0);
    setOutcome(null);
    setError("");
  }

  async function chooseFile(event: ChangeEvent<HTMLInputElement>) {
    const selected = event.target.files?.[0];
    event.target.value = "";
    if (!selected) return;
    const request = ++uploadRequest.current;
    setReviewedMonth("");
    setPage(0);
    setOutcome(null);
    setError("");
    setFile(null);
    setTable(null);
    setMapping({});
    if (selected.size > IMPORT_MAX_BYTES) {
      setError("El archivo supera el límite de 3 MiB.");
      setReading(false);
      return;
    }
    setReading(true);
    try {
      const source = await readSource(await selected.arrayBuffer(), selected.name);
      if (request !== uploadRequest.current) return;
      setFile(selected);
      setTable(source);
      setMapping(suggestMapping(kind, source.headers));
    } catch (reason) {
      if (request === uploadRequest.current) {
        setError(reason instanceof Error ? reason.message : "No se pudo leer el archivo.");
      }
    } finally {
      if (request === uploadRequest.current) setReading(false);
    }
  }

  async function confirm() {
    if (!file || !reviewed || !rowCount || hasErrors || disabled || saving || outcome) return;
    setSaving(true);
    setError("");
    try {
      const saved = await onConfirm({ file, kind, mapping, decimal });
      setOutcome(saved);
      setReviewedMonth("");
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "No se pudo confirmar la importación.");
    } finally {
      setSaving(false);
    }
  }

  function columnField({ key, label, required }: (typeof fields)[number]) {
    return (
      <label className="field" key={key}>
        <span>{label}{required ? " *" : ""}</span>
        <select
          className="control" value={mapping[key] ?? ""} disabled={disabled || saving}
          onChange={(event) => assignColumn(key, event.target.value)}
        >
          <option value="">{required ? "Asignar columna" : "Sin asignar"}</option>
          {table?.headers.map((header, index) => (
            <option key={index} value={index}>{index + 1} · {header || "Sin encabezado"}</option>
          ))}
        </select>
      </label>
    );
  }

  const optionalFields = fields.filter(({ required }) => !required);
  const assignedOptionalFields = optionalFields.filter(({ key }) => mapping[key] !== undefined).length;

  return (
    <section className="panel grid gap-5" aria-label="Importar datos">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-2 text-lg font-semibold"><FileSpreadsheet size={19} aria-hidden="true" /> Importar datos</h2>
          <p className="muted mt-1 text-sm">Revisá las columnas y los importes antes de guardar. Los formatos externos se cargan con asignación manual.</p>
        </div>
        <a className="button button-secondary" href={templateLink} download={`sofia-${templateName}.csv`}>
          <Download size={16} aria-hidden="true" /> Plantilla CSV
        </a>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <label className="field">
          <span>Tipo de importación</span>
          <select className="control" value={kind} onChange={changeKind} disabled={lockedKind || disabled || reading || saving}>
            {kinds.map(({ value, label }) => <option key={value} value={value}>{label}</option>)}
          </select>
        </label>
        {kind !== "accounts" && (
          <label className="field">
            <span>Separador decimal en texto</span>
            <select
              className="control"
              value={decimal}
              onChange={(event) => {
                setDecimal(event.target.value as DecimalFormat);
                setReviewedMonth("");
                setPage(0);
                setOutcome(null);
                setError("");
              }}
              disabled={disabled || saving}
            >
              <option value="auto">Detectar automáticamente</option>
              <option value="comma">Coma decimal (1.234,56)</option>
              <option value="point">Punto decimal (1,234.56)</option>
            </select>
          </label>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <input
          id={fileInput} type="file" accept=".csv,.xls,.xlsx"
          className="peer sr-only" onChange={chooseFile}
          disabled={disabled || saving || reading}
        />
        <label
          className={`button button-secondary peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 ${disabled || saving || reading ? "cursor-not-allowed opacity-50" : "cursor-pointer"}`}
          htmlFor={fileInput}
        >
          <UploadCloud size={16} aria-hidden="true" />
          {reading ? "Leyendo archivo…" : file ? "Cambiar archivo" : "Elegir archivo"}
        </label>
        <p className="muted min-w-0 break-all text-sm" aria-live="polite">
          {file ? file.name : "CSV, XLS o XLSX · hasta 3 MiB y 5.000 filas"}
        </p>
      </div>

      {disabled && <p className="notice">El período seleccionado no admite importaciones.</p>}
      {error && <p className="notice notice-error" role="alert">{error}</p>}
      {outcome && (
        <p className="notice notice-success" role="status">{outcomeMessage(outcome,kind)}</p>
      )}
      {file&&!outcome&&!saving&&<p className="notice notice-warning">Vista previa sin guardar. Revisá los datos y presioná Confirmar importación para conservarlos al salir.</p>}

      {table && preview && (
        <>
          <div className="grid gap-3">
            <div>
              <h3 className="font-semibold">Asignación de columnas</h3>
              <p className="muted mt-1 text-sm">
                Tomamos los encabezados de la primera fila con datos. Para cambiar un valor, corregí el archivo y volvé a cargarlo.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {fields.filter(({ required }) => required).map(columnField)}
            </div>
            <details>
              <summary className="cursor-pointer py-2 text-sm font-semibold">
                Campos opcionales{assignedOptionalFields > 0 && ` · ${assignedOptionalFields} asignados`}
              </summary>
              <div className="grid gap-3 pt-2 sm:grid-cols-2 xl:grid-cols-3">{optionalFields.map(columnField)}</div>
            </details>
          </div>

          <div className="grid gap-3" aria-live="polite">
            <div>
              <h3 className="font-semibold">Vista previa</h3>
              <p className="muted mt-1 text-sm">
                {rowCount} {rowCount === 1 ? "fila válida" : "filas válidas"} de {table.rows.length}.
                {preview.duplicates > 0 && ` Se omitirán ${preview.duplicates} filas repetidas del archivo.`}
              </p>
            </div>
            {preview.issues.length > 0 && (
              <div className={`notice ${hasErrors ? "notice-error" : ""}`} role={hasErrors ? "alert" : "status"}>
                <ul className="grid list-disc gap-1 pl-5">
                  {preview.issues.slice(0, 10).map(({ row, field, message }, index) => (
                    <li key={index}>
                      {row > 0 && `Fila ${row} · ${fields.find(({ key }) => key === field)?.label ?? field}. `}
                      {message}
                    </li>
                  ))}
                </ul>
                {preview.issues.length > 10 && <p className="mt-2">Quedan {preview.issues.length - 10} observaciones. Corregí las primeras para volver a validar.</p>}
              </div>
            )}
            {preview.vouchers.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Fecha</th><th>Comprobante</th><th>Contraparte</th><th>IVA</th><th>Total</th></tr></thead>
                  <tbody>
                    {preview.vouchers.slice(pageStart, pageStart + previewPageSize).map((voucher, index) => (
                      <tr key={index}>
                        <td>{voucher.date}</td>
                        <td>{voucher.receipt_type} {String(voucher.point_of_sale).padStart(5, "0")}-{String(voucher.receipt_number).padStart(8, "0")}</td>
                        <td>{voucher.counterparty_name}</td>
                        <td className="tabular-nums">{voucher.currency} {voucher.vat.replace(".", ",")}</td>
                        <td className="tabular-nums">{voucher.currency} {voucher.total.replace(".", ",")}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {preview.accounts.length > 0 && (
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Código</th><th>Cuenta</th><th>Rubro</th><th>Cuenta padre</th><th>Estado</th></tr></thead>
                  <tbody>
                    {preview.accounts.slice(pageStart, pageStart + previewPageSize).map((account) => (
                      <tr key={account.code}>
                        <td>{account.code}</td><td>{account.name}</td><td>{accountKinds[account.kind]}</td>
                        <td>{account.parent_code ?? "—"}</td><td>{account.status === "active" ? "Activa" : "Inactiva"}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
            {pageCount > 1 && (
              <div className="flex flex-wrap items-center gap-2 text-sm">
                <button type="button" className="button button-secondary" disabled={visiblePage === 0}
                  onClick={() => setPage(visiblePage - 1)}>Anterior</button>
                <p className="muted px-2">Página {visiblePage + 1} de {pageCount}</p>
                <button type="button" className="button button-secondary" disabled={visiblePage + 1 === pageCount}
                  onClick={() => setPage(visiblePage + 1)}>Siguiente</button>
              </div>
            )}
          </div>

          {!outcome && (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <label className="flex items-center gap-2 text-sm">
                <input type="checkbox" checked={reviewed} disabled={disabled || saving || hasErrors || !rowCount}
                  onChange={(event) => setReviewedMonth(event.target.checked ? month : "")} />
                Verifiqué la asignación y los datos del archivo
              </label>
              <button
                className="button button-primary" type="button"
                disabled={disabled || saving || !reviewed || hasErrors || !rowCount}
                onClick={confirm}
              >
                {saving ? "Guardando…" : "Confirmar importación"}
              </button>
            </div>
          )}
        </>
      )}
    </section>
  );
}
