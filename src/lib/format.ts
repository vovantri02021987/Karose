/** Locale and timezone used across the KaRose storefront and admin. */
const LOCALE = "vi-VN";
const TIME_ZONE = "Asia/Ho_Chi_Minh";

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Shelf-life threshold: batches expiring within this many days are not sold at retail (CLAUDE.md §4A). */
export const NEAR_EXPIRY_DAYS = 30;

/**
 * Format an integer VND amount, e.g. 350000 -> "350.000 ₫".
 * Money is always integer VND; non-finite input falls back to "0 ₫".
 */
export function formatVND(amount: number): string {
  const safe = Number.isFinite(amount) ? Math.round(amount) : 0;
  // Intl may use a non-breaking space before the symbol; normalise to a regular space.
  const digits = new Intl.NumberFormat(LOCALE, {
    maximumFractionDigits: 0,
  }).format(safe);
  return `${digits} ₫`;
}

function toDate(value: Date | string | number): Date {
  return value instanceof Date ? value : new Date(value);
}

/** "25/11/2026" */
export function formatDate(value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat(LOCALE, {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    timeZone: TIME_ZONE,
  }).format(date);
}

/** "25/11/2026 14:30" */
export function formatDateTime(value: Date | string | number): string {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return "";
  const d = formatDate(date);
  const t = new Intl.DateTimeFormat(LOCALE, {
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: TIME_ZONE,
  }).format(date);
  return `${d} ${t}`;
}

/** Whole days from `from` (default now) until `expiry`; negative when already expired. */
export function daysUntilExpiry(
  expiry: Date | string | number,
  from: Date = new Date(),
): number {
  return Math.floor((toDate(expiry).getTime() - from.getTime()) / MS_PER_DAY);
}

/** Cut-off date: batches must expire AFTER this instant to be sellable at retail. */
export function sellableExpiryCutoff(from: Date = new Date()): Date {
  return new Date(from.getTime() + NEAR_EXPIRY_DAYS * MS_PER_DAY);
}

/** True when the batch expires within NEAR_EXPIRY_DAYS (or is already expired). */
export function isNearExpiry(
  expiry: Date | string | number,
  from: Date = new Date(),
): boolean {
  return toDate(expiry).getTime() <= sellableExpiryCutoff(from).getTime();
}

export type ExpiryStatus = "EXPIRED" | "NEAR_EXPIRY" | "OK";

export function getExpiryStatus(
  expiry: Date | string | number,
  from: Date = new Date(),
): ExpiryStatus {
  const time = toDate(expiry).getTime();
  if (time <= from.getTime()) return "EXPIRED";
  return isNearExpiry(expiry, from) ? "NEAR_EXPIRY" : "OK";
}

/** Vietnamese label for an expiry status, shown in Admin. */
export function expiryStatusLabel(status: ExpiryStatus): string {
  switch (status) {
    case "EXPIRED":
      return "Đã hết hạn";
    case "NEAR_EXPIRY":
      return "Cận hạn";
    default:
      return "Còn hạn";
  }
}

/** Human text such as "Còn 45 ngày" / "Quá hạn 3 ngày". */
export function formatShelfLife(
  expiry: Date | string | number,
  from: Date = new Date(),
): string {
  const days = daysUntilExpiry(expiry, from);
  if (days < 0) return `Quá hạn ${Math.abs(days)} ngày`;
  if (days === 0) return "Hết hạn hôm nay";
  return `Còn ${days} ngày`;
}

/**
 * Batch code in the form `<SKU>-YYMMDD-NN`, e.g. `KR-TONER-250-261015-01`,
 * where the date is the manufacturing date.
 */
export function formatBatchCode(
  sku: string,
  manufacturedDate: Date | string | number,
  sequence = 1,
): string {
  const d = toDate(manufacturedDate);
  const yy = String(d.getUTCFullYear()).slice(-2);
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${sku}-${yy}${mm}${dd}-${String(sequence).padStart(2, "0")}`;
}

/** Order code used as the bank-transfer memo: `KR` + base36 timestamp + random suffix. */
export function generateOrderCode(now: Date = new Date()): string {
  const ts = now.getTime().toString(36).toUpperCase();
  const rand = Math.random().toString(36).slice(2, 6).toUpperCase();
  return `KR${ts}${rand}`;
}
