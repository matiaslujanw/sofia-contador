"use client";

import * as Dialog from "@radix-ui/react-dialog";
import clsx from "clsx";
import { ChevronDown, X, type LucideIcon } from "lucide-react";
import { useState, type FormEvent, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes } from "react";
import type { Task } from "@/lib/workspace/model";
import { taskStatuses } from "@/lib/workspace/model";

export function Heading({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return <div className="page-heading">
    <div><h1>{title}</h1>{description && <p>{description}</p>}</div>
    {actions && <div className="heading-actions">{actions}</div>}
  </div>;
}

export function SectionHeading({ title, subtitle, action, icon: Icon }: { title: string; subtitle?: string; action?: ReactNode; icon?: LucideIcon }) {
  return <div className="panel-heading">
    <div className="panel-title">{Icon && <span className="section-icon"><Icon size={18} aria-hidden="true" /></span>}
      <div><h2>{title}</h2>{subtitle && <p>{subtitle}</p>}</div>
    </div>{action}
  </div>;
}

export function Empty({ icon: Icon, title, text, action }: { icon: LucideIcon; title: string; text?: string; action?: ReactNode }) {
  return <div className="empty-state"><div className="empty-icon"><Icon size={22} aria-hidden="true" /></div><h3>{title}</h3>
    {text && <p>{text}</p>}{action}</div>;
}

export function Progress({ value, label }: { value: number; label: string }) {
  return <div className="progress" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={value} aria-label={label}>
    <span style={{ width: `${value}%` }} className={value === 100 ? "complete" : undefined} />
  </div>;
}

export function Badge({ children, tone = "neutral", dot = false }: { children: ReactNode; tone?: "neutral" | "accent" | "positive" | "warning" | "negative"; dot?: boolean }) {
  return <span className={clsx("badge", `badge-${tone}`)}>{dot && <i aria-hidden="true" />}{children}</span>;
}

export function TaskBadge({ status }: { status: Task["status"] }) {
  const tone = { pending: "neutral", in_progress: "accent", waiting: "warning", review: "warning", completed: "positive", not_applicable: "neutral" } as const;
  return <Badge dot tone={tone[status]}>{taskStatuses[status]}</Badge>;
}

export function Field({ label, span, children }: { label: string; span?: boolean; children: ReactNode }) {
  return <label className={clsx("field", span && "field-wide")}><span>{label}</span>{children}</label>;
}

export function Select({ className, children, ...props }: SelectHTMLAttributes<HTMLSelectElement>) {
  return <span className="select-wrap"><select className={clsx("control", className)} {...props}>{children}</select><ChevronDown size={15} aria-hidden="true" /></span>;
}

export function Input({ className, ...props }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={clsx("control", className)} {...props} />;
}

export function Search({ value, onChange, label }: { value: string; onChange: (value: string) => void; label: string }) {
  return <Input type="search" className="search" aria-label={label} placeholder={label} value={value} onChange={(event) => onChange(event.target.value)} />;
}

export function Modal({ title, description, close, children }: { title: string; description: string; close: () => void; children: ReactNode }) {
  return <Dialog.Root open onOpenChange={(open) => { if (!open) close(); }}>
    <Dialog.Portal><Dialog.Overlay className="modal-overlay" /><Dialog.Content className="modal-content">
      <div className="modal-heading"><div><Dialog.Title>{title}</Dialog.Title><Dialog.Description>{description}</Dialog.Description></div>
        <Dialog.Close asChild><button type="button" className="icon-button" aria-label="Cerrar"><X size={20} /></button></Dialog.Close></div>
      {children}
    </Dialog.Content></Dialog.Portal>
  </Dialog.Root>;
}

export function ActionForm({ children, submit, close, label = "Guardar cambios", className }: {
  children: ReactNode; submit: (data: FormData) => Promise<void>; close: () => void; label?: string; className?: string;
}) {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (pending) return;
    const data = new FormData(event.currentTarget);
    setPending(true);
    setError("");
    try { await submit(data); close(); }
    catch (reason) { setError(reason instanceof Error ? reason.message : "No se pudo guardar el registro."); }
    finally { setPending(false); }
  }
  return <form className={className} onSubmit={handleSubmit}>
    <fieldset className="form-grid" disabled={pending}>{children}</fieldset>
    {error && <p className="notice notice-error" role="alert">{error}</p>}
    <div className="form-actions"><button className="button button-secondary" type="button" onClick={close} disabled={pending}>Cancelar</button>
      <button type="submit" className="button button-primary" disabled={pending}>{pending ? "Guardando…" : label}</button></div>
  </form>;
}

export function fieldValue(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
export function optionalValue(data: FormData, key: string) { return fieldValue(data, key) || null; }
