"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import SafeImage from "@/components/storefront/SafeImage";
import VietQRPayment, { type VietQRBank } from "@/components/storefront/VietQRPayment";
import { formatDateTime, formatVND } from "@/lib/format";

interface TrackedItem {
  id: string;
  productName: string;
  productSlug: string;
  variantName: string;
  image: string | null;
  quantity: number;
  unitPrice: number;
}

interface TrackedOrder {
  orderCode: string;
  status: string;
  paymentMethod: "COD" | "VIETQR";
  paymentStatus: string;
  createdAt: string;
  customerName: string;
  customerPhoneMasked: string;
  shippingAddress: string;
  note: string | null;
  trackingCode: string | null;
  shippingPartner: string | null;
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  items: TrackedItem[];
  payment: { vietqrUrl: string; bankInfo: VietQRBank } | null;
}

const STEPS = [
  { key: "PENDING", label: "Chờ xác nhận" },
  { key: "CONFIRMED", label: "Đã xác nhận" },
  { key: "PROCESSING", label: "Đang chuẩn bị hàng" },
  { key: "SHIPPING", label: "Đang giao hàng" },
  { key: "DELIVERED", label: "Đã giao" },
] as const;

const STATUS_LABEL: Record<string, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang chuẩn bị hàng",
  SHIPPING: "Đang giao hàng",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
  RETURNED: "Hoàn trả",
};

const PAYMENT_LABEL: Record<string, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
};

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Timeline({ status }: { status: string }) {
  if (status === "CANCELLED" || status === "RETURNED") {
    return (
      <div className="flex items-center gap-3 rounded-xl border border-destructive/40 p-4 text-destructive">
        <XCircle size={22} />
        <p className="text-sm font-medium">{STATUS_LABEL[status]}</p>
      </div>
    );
  }
  const current = STEPS.findIndex((s) => s.key === status);
  return (
    <ol className="space-y-0">
      {STEPS.map((step, idx) => {
        const done = idx < current || status === "DELIVERED";
        const active = idx === current && status !== "DELIVERED";
        return (
          <li key={step.key} className="relative flex gap-3 pb-5 last:pb-0">
            {idx < STEPS.length - 1 && (
              <span
                className={`absolute left-[11px] top-6 h-full w-0.5 ${done ? "bg-primary" : "bg-border"}`}
                aria-hidden="true"
              />
            )}
            <span className="relative z-10 mt-0.5 bg-background">
              {done ? (
                <CheckCircle2 size={24} className="text-primary" />
              ) : active ? (
                <Loader2 size={24} className="animate-spin text-brand-accent" />
              ) : (
                <Circle size={24} className="text-border" />
              )}
            </span>
            <p
              className={`text-sm ${
                done || active ? "font-medium" : "text-muted-foreground"
              } ${active ? "text-brand-accent" : ""}`}
            >
              {step.label}
            </p>
          </li>
        );
      })}
    </ol>
  );
}

export default function TrackingClient() {
  const params = useSearchParams();
  const [orderCode, setOrderCode] = useState(params.get("orderCode") ?? "");
  const [phone, setPhone] = useState(params.get("phone") ?? "");
  const [order, setOrder] = useState<TrackedOrder | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [showQR, setShowQR] = useState(false);

  const lookup = useCallback(async (code: string, ph: string) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/tracking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode: code, phone: ph }),
        cache: "no-store",
      });
      const data = (await res.json().catch(() => null)) as
        | { order?: TrackedOrder; error?: string }
        | null;
      if (!res.ok || !data?.order) {
        setOrder(null);
        setError(data?.error ?? "Không thể tra cứu lúc này, vui lòng thử lại sau.");
        return;
      }
      setOrder(data.order);
    } catch {
      setOrder(null);
      setError("Mất kết nối mạng, vui lòng thử lại.");
    } finally {
      setLoading(false);
    }
  }, []);

  // Tự tra cứu khi URL có đủ orderCode & phone.
  useEffect(() => {
    const c = params.get("orderCode");
    const p = params.get("phone");
    if (c && p) {
      const t = window.setTimeout(() => void lookup(c, p), 0);
      return () => window.clearTimeout(t);
    }
  }, [params, lookup]);

  const onSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setShowQR(false);
    void lookup(orderCode.trim(), phone.trim());
  };

  return (
    <div className="mt-8">
      <form onSubmit={onSubmit} className="grid gap-3 sm:grid-cols-[1fr_1fr_auto]">
        <input
          className={inputClass}
          value={orderCode}
          onChange={(e) => setOrderCode(e.target.value.toUpperCase())}
          placeholder="Mã đơn hàng (VD: KR7H3K9P)"
          aria-label="Mã đơn hàng"
        />
        <input
          className={inputClass}
          value={phone}
          onChange={(e) => setPhone(e.target.value)}
          placeholder="Số điện thoại đặt hàng"
          inputMode="tel"
          aria-label="Số điện thoại đặt hàng"
        />
        <button
          type="submit"
          disabled={loading || !orderCode.trim() || !phone.trim()}
          className="rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-50"
        >
          {loading ? "Đang tra cứu…" : "Tra cứu"}
        </button>
      </form>

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/40 p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      {order && (
        <div className="mt-8 space-y-6">
          <section className="rounded-2xl border border-border p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs text-muted-foreground">Mã đơn hàng</p>
                <p className="text-xl font-semibold tracking-wider text-primary">{order.orderCode}</p>
                <p className="text-xs text-muted-foreground">Đặt lúc {formatDateTime(order.createdAt)}</p>
              </div>
              <div className="text-right text-sm">
                <p className="font-medium">{STATUS_LABEL[order.status] ?? order.status}</p>
                <p className="text-muted-foreground">
                  {order.paymentMethod === "COD" ? "COD" : "VietQR"} ·{" "}
                  {PAYMENT_LABEL[order.paymentStatus] ?? order.paymentStatus}
                </p>
              </div>
            </div>
            <div className="mt-6">
              <Timeline status={order.status} />
            </div>
            {(order.trackingCode || order.shippingPartner) && (
              <p className="mt-4 rounded-lg bg-surface p-3 text-sm">
                {order.shippingPartner && <>Đơn vị vận chuyển: <b>{order.shippingPartner}</b></>}
                {order.shippingPartner && order.trackingCode && " · "}
                {order.trackingCode && <>Mã vận đơn: <b>{order.trackingCode}</b></>}
              </p>
            )}
          </section>

          {order.payment && (
            <section>
              {showQR ? (
                <VietQRPayment
                  orderCode={order.orderCode}
                  amount={order.totalAmount}
                  vietqrUrl={order.payment.vietqrUrl}
                  bankInfo={order.payment.bankInfo}
                  onPaid={() => {
                    setShowQR(false);
                    void lookup(order.orderCode, phone);
                  }}
                />
              ) : (
                <div className="flex flex-col items-start gap-3 rounded-2xl border border-brand-accent/50 bg-surface p-5 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm">Đơn hàng chưa được thanh toán. Bạn có thể mở lại mã QR để chuyển khoản.</p>
                  <button
                    type="button"
                    onClick={() => setShowQR(true)}
                    className="shrink-0 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
                  >
                    Mở mã QR thanh toán
                  </button>
                </div>
              )}
            </section>
          )}

          <section className="rounded-2xl border border-border p-5 sm:p-6">
            <h2 className="font-serif text-xl font-semibold">Sản phẩm</h2>
            <ul className="mt-3 divide-y divide-border">
              {order.items.map((i) => (
                <li key={i.id} className="flex gap-3 py-3">
                  <Link
                    href={`/products/${i.productSlug}`}
                    className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-surface"
                  >
                    <SafeImage src={i.image} alt={i.productName} sizes="64px" />
                  </Link>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{i.productName}</p>
                    <p className="text-xs text-muted-foreground">
                      {i.variantName} × {i.quantity}
                    </p>
                  </div>
                  <p className="text-sm font-semibold">{formatVND(i.unitPrice * i.quantity)}</p>
                </li>
              ))}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Tạm tính</dt>
                <dd>{formatVND(order.subtotal)}</dd>
              </div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Giảm giá</dt>
                  <dd>-{formatVND(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between">
                <dt className="text-muted-foreground">Phí vận chuyển</dt>
                <dd>{order.shippingFee === 0 ? "Miễn phí" : formatVND(order.shippingFee)}</dd>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold">
                <dt>Tổng cộng</dt>
                <dd className="text-primary">{formatVND(order.totalAmount)}</dd>
              </div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border p-5 text-sm sm:p-6">
            <h2 className="font-serif text-xl font-semibold">Giao đến</h2>
            <p className="mt-2 font-medium">
              {order.customerName} · {order.customerPhoneMasked}
            </p>
            <p className="text-muted-foreground">{order.shippingAddress}</p>
            {order.note && <p className="mt-2 text-muted-foreground">Ghi chú: {order.note}</p>}
          </section>
        </div>
      )}
    </div>
  );
}
