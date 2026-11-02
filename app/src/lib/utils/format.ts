/** ISO currency minor-unit exponents (doc 08 §1: money is stored as integer minor units). */
const EXPONENTS: Record<string, number> = { USD: 2, NGN: 2, GHS: 2, XOF: 0 };

export function minorToMajor(minor: number, currency: string): number {
  return minor / 10 ** (EXPONENTS[currency] ?? 2);
}

export function formatMoney(minor: number | null | undefined, currency: string, compact = false): string {
  if (minor == null || !Number.isFinite(minor) || !/^[A-Z]{3}$/.test(currency)) return "Unavailable";
  const exponent = EXPONENTS[currency] ?? 2;
  return new Intl.NumberFormat("en", {
    style: "currency",
    currency,
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : exponent === 0 ? 0 : minor % 100 === 0 ? 0 : 2,
  }).format(minorToMajor(minor, currency));
}

export function formatNumber(value: number | null | undefined, compact = false): string {
  if (value == null || !Number.isFinite(value)) return "Unavailable";
  return new Intl.NumberFormat("en", {
    notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 0,
  }).format(value);
}

export function formatPercent(value: number, digits = 1): string {
  return `${value.toFixed(digits)}%`;
}

export function formatDelta(percent: number | null | undefined): string {
  if (percent === null || percent === undefined || !Number.isFinite(percent)) return "—";
  return `${percent >= 0 ? "+" : ""}${percent.toFixed(1)}%`;
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

export function formatDate(d: string | Date | null): string {
  if (!d) return "Unavailable";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

export function formatDateTime(d: string | Date | null): string {
  if (!d) return "Unavailable";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  return `${formatDate(date)} ${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())} UTC`;
}

export function formatRelative(d: string | Date | null, now = new Date()): string {
  if (!d) return "Unavailable";
  const date = typeof d === "string" ? new Date(d) : d;
  if (!Number.isFinite(date.getTime())) return "Unavailable";
  const seconds = Math.max(0, Math.floor((now.getTime() - date.getTime()) / 1000));
  if (seconds < 90) return "just now";
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days} d ago`;
  return formatDate(date);
}

export function shortId(id: string): string {
  return id.length <= 10 ? id : `${id.slice(0, 8)}…`;
}

export function humanize(key: string): string {
  return key
    .replace(/[._]/g, " ")
    .split(" ")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
