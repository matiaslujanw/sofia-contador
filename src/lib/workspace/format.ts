import type { Company, Task } from "./model";

export const DEFAULT_TIMEZONE = "America/Argentina/Tucuman";

export function todayIn(timezone = DEFAULT_TIMEZONE, date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone, year: "numeric", month: "2-digit", day: "2-digit",
  }).formatToParts(date);
  return ["year", "month", "day"].map((type) => parts.find((part) => part.type === type)?.value).join("-");
}

export function shiftMonth(month: string, offset: number) {
  const [year, number] = month.split("-").map(Number);
  return new Date(Date.UTC(year, number - 1 + offset, 1)).toISOString().slice(0, 7);
}

export function monthLabel(month: string, locale = "es-AR", short = false) {
  const label = new Intl.DateTimeFormat(locale, { month: short ? "short" : "long", year: "numeric", timeZone: "UTC" })
    .format(new Date(`${month.slice(0, 7)}-01T00:00:00Z`));
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function dayLabel(day: string, options: Intl.DateTimeFormatOptions = { day: "numeric", month: "short" }, locale = "es-AR") {
  return new Intl.DateTimeFormat(locale, { ...options, timeZone: "UTC" }).format(new Date(`${day.slice(0, 10)}T00:00:00Z`));
}

export function companyName(company: Company) {
  return company.trade_name || company.legal_name;
}

export function initials(value: string) {
  return value.split(/\s+/).filter(Boolean).slice(0, 2).map((word) => word[0]).join("").toUpperCase();
}

export function cuitLabel(value: string | null) {
  return value?.replace(/^(\d{2})(\d{8})(\d)$/, "$1-$2-$3") || "—";
}

export function taskProgress(tasks: Task[]) {
  const applicable = tasks.filter((task) => task.status !== "not_applicable");
  const complete = applicable.filter((task) => task.status === "completed").length;
  return {
    total: applicable.length,
    complete,
    pending: applicable.length - complete,
    percent: applicable.length ? Math.round(complete * 100 / applicable.length) : tasks.length ? 100 : 0,
  };
}

export function cents(value: string) {
  const [whole, fraction = ""] = value.replace(/^-/, "").split(".");
  return (BigInt(whole) * 100n + BigInt(fraction.padEnd(2, "0").slice(0, 2))) * (value.startsWith("-") ? -1n : 1n);
}

export function decimalFromCents(value: bigint) {
  const absolute = value < 0n ? -value : value;
  return `${value < 0n ? "-" : ""}${absolute / 100n}.${String(absolute % 100n).padStart(2, "0")}`;
}

export function money(value: string | bigint, currency = "ARS", locale = "es-AR") {
  const amount = typeof value === "bigint" ? value : cents(value);
  const absolute = amount < 0n ? -amount : amount;
  const formatter = new Intl.NumberFormat(locale, { style: "currency", currency, minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const parts = formatter.formatToParts(amount < 0n && absolute < 100n ? -1 : amount / 100n);
  return parts.map((part) => {
    if (part.type === "fraction") return String(absolute % 100n).padStart(2, "0");
    if (part.type === "integer" && amount < 0n && absolute < 100n) return "0";
    return part.value;
  }).join("");
}

export function fileSize(size: number) {
  return size >= 1024 * 1024 ? `${(size / (1024 * 1024)).toFixed(1)} MB` : `${Math.max(1, Math.round(size / 1024))} KB`;
}
