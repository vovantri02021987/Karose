import type { OrderStatusKey } from "@/lib/admin-labels";

const FLOW: OrderStatusKey[] = ["PENDING", "CONFIRMED", "PROCESSING", "SHIPPING", "DELIVERED"];
const PRE_SHIPPING: OrderStatusKey[] = ["PENDING", "CONFIRMED", "PROCESSING"];

/** Trạng thái được phép chuyển tới từ `from` (không bao gồm chính nó). */
export function allowedNextStatuses(from: OrderStatusKey): OrderStatusKey[] {
  const out: OrderStatusKey[] = [];
  const idx = FLOW.indexOf(from);
  if (idx >= 0) out.push(...FLOW.slice(idx + 1));
  if (PRE_SHIPPING.includes(from)) out.push("CANCELLED");
  if (from === "SHIPPING" || from === "DELIVERED") out.push("RETURNED");
  return out;
}

export function isTransitionAllowed(from: OrderStatusKey, to: OrderStatusKey): boolean {
  return allowedNextStatuses(from).includes(to);
}

/** Hàng đã được xuất kho thực tế (reserved đã trừ) khi đơn ở SHIPPING trở đi. */
export function isPreShipping(status: OrderStatusKey): boolean {
  return PRE_SHIPPING.includes(status);
}
