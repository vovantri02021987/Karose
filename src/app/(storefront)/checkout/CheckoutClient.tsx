"use client";

import { CheckCircle2, Loader2, ShieldCheck, Tag, X } from "lucide-react";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import SafeImage from "@/components/storefront/SafeImage";
import VietQRPayment, { type VietQRBank } from "@/components/storefront/VietQRPayment";
import { VN_PROVINCES } from "@/data/vn-provinces";
import {
  checkoutFormSchema,
  EMPTY_CHECKOUT_FORM,
  type CheckoutFormErrors,
  type CheckoutFormValues,
} from "@/lib/checkout-schema";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { formatVND } from "@/lib/format";
import { selectCartSubtotal, useCartStore } from "@/store/useCartStore";

type PaymentMethod = "COD" | "VIETQR";

interface PreviewLine {
  variantId: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  lineDiscount: number;
  lineFinalAmount: number;
  eligibleForVoucher: boolean;
}

interface AppliedVoucherInfo {
  id: string;
  code: string;
  discountAmount: number;
  scope: "ORDER" | "PRODUCT";
  eligibleSubtotal: number;
  appliedProductNames: string[];
}

interface PreviewResult {
  items: PreviewLine[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  freeShipThreshold: number;
  amountNeededForFreeShip: number;
  voucher: { code: string; applied: AppliedVoucherInfo | null; error: string | null } | null;
  estimatedDelivery: { minDays: number; maxDays: number; text: string };
  deliveryByRegion: {
    bigCity: { text: string };
    other: { text: string };
  };
}

function voucherSuccessText(v: AppliedVoucherInfo): string {
  return v.scope === "PRODUCT"
    ? `Đã áp dụng mã ${v.code} cho: ${v.appliedProductNames.join(", ")}`
    : `Đã áp dụng mã ${v.code}`;
}

interface PlacedOrder {
  orderCode: string;
  totalAmount: number;
  paymentMethod: PaymentMethod;
  phone: string;
  vietqrUrl: string | null;
  bankInfo: VietQRBank | null;
  paid: boolean;
  estimatedDeliveryText: string | null;
}

interface SubmitError {
  message: string;
  stock: boolean;
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

function Field({
  label,
  error,
  required,
  children,
}: {
  label: string;
  error?: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-sm font-medium">
        {label}
        {required && <span className="text-brand-accent"> *</span>}
      </span>
      {children}
      {error && <span className="mt-1 block text-xs text-destructive">{error}</span>}
    </label>
  );
}

export default function CheckoutClient() {
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const items = useCartStore((s) => s.items);
  const rawSubtotal = useCartStore(selectCartSubtotal);
  const clearCart = useCartStore((s) => s.clearCart);
  const openCart = useCartStore((s) => s.openCart);

  const [form, setForm] = useState<CheckoutFormValues>(EMPTY_CHECKOUT_FORM);
  const [errors, setErrors] = useState<CheckoutFormErrors>({});
  const [payment, setPayment] = useState<PaymentMethod>("COD");
  const [voucherInput, setVoucherInput] = useState("");
  const [appliedVoucher, setAppliedVoucher] = useState("");
  const [voucherMessage, setVoucherMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [applying, setApplying] = useState(false);
  const [preview, setPreview] = useState<PreviewResult | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<SubmitError | null>(null);
  const [placed, setPlaced] = useState<PlacedOrder | null>(null);
  const submitLock = useRef(false);

  const payloadItems = useMemo(
    () => items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
    [items],
  );
  const itemsKey = JSON.stringify(payloadItems);

  const callPreview = useCallback(
    async (voucherCode: string, signal?: AbortSignal): Promise<PreviewResult | null> => {
      const res = await fetch("/api/checkout/preview", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          items: JSON.parse(itemsKey) as unknown,
          province: form.province,
          voucherCode: voucherCode || undefined,
        }),
        signal,
      });
      if (!res.ok) return null;
      return (await res.json()) as PreviewResult;
    },
    [itemsKey, form.province],
  );

  // Tính lại giá (debounce) khi giỏ / tỉnh thành / voucher đã áp dụng thay đổi.
  useEffect(() => {
    if (!hasHydrated || placed || payloadItems.length === 0) return;
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      setPreviewLoading(true);
      try {
        const data = await callPreview(appliedVoucher, controller.signal);
        if (!data) return;
        setPreview(data);
        if (appliedVoucher && data.voucher && !data.voucher.applied) {
          setAppliedVoucher("");
          setVoucherMessage({ ok: false, text: data.voucher.error ?? "Mã giảm giá không còn hợp lệ" });
        }
      } catch {
        /* huỷ hoặc lỗi mạng: giữ số liệu cũ */
      } finally {
        if (!controller.signal.aborted) setPreviewLoading(false);
      }
    }, 300);
    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [hasHydrated, placed, payloadItems.length, appliedVoucher, callPreview]);

  const applyVoucher = async () => {
    const code = voucherInput.trim().toUpperCase();
    if (!code) {
      setVoucherMessage({ ok: false, text: "Vui lòng nhập mã giảm giá" });
      return;
    }
    setApplying(true);
    setVoucherMessage(null);
    try {
      const data = await callPreview(code);
      if (!data) {
        setVoucherMessage({ ok: false, text: "Không kiểm tra được mã lúc này, vui lòng thử lại" });
        return;
      }
      setPreview(data);
      if (data.voucher?.applied) {
        setAppliedVoucher(data.voucher.applied.code);
        setVoucherInput(data.voucher.applied.code);
        setVoucherMessage({ ok: true, text: voucherSuccessText(data.voucher.applied) });
      } else {
        setVoucherMessage({ ok: false, text: data.voucher?.error ?? "Mã giảm giá không hợp lệ" });
      }
    } catch {
      setVoucherMessage({ ok: false, text: "Không kiểm tra được mã lúc này, vui lòng thử lại" });
    } finally {
      setApplying(false);
    }
  };

  const removeVoucher = () => {
    setAppliedVoucher("");
    setVoucherInput("");
    setVoucherMessage(null);
  };

  const setField = <K extends keyof CheckoutFormValues>(key: K, value: CheckoutFormValues[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    setErrors((e) => (e[key] ? { ...e, [key]: undefined } : e));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitLock.current) return;

    const parsed = checkoutFormSchema.safeParse(form);
    if (!parsed.success) {
      const next: CheckoutFormErrors = {};
      for (const issue of parsed.error.issues) {
        const key = issue.path[0] as keyof CheckoutFormValues;
        if (!next[key]) next[key] = issue.message;
      }
      setErrors(next);
      setSubmitError({ message: "Vui lòng kiểm tra lại các thông tin được đánh dấu.", stock: false });
      return;
    }

    submitLock.current = true;
    setSubmitting(true);
    setSubmitError(null);
    try {
      const v = parsed.data;
      const res = await fetch("/api/orders", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...v,
          customerEmail: v.customerEmail || undefined,
          note: v.note || undefined,
          paymentMethod: payment,
          voucherCode: appliedVoucher || undefined,
          items: payloadItems,
        }),
      });
      const data = (await res.json().catch(() => null)) as {
        error?: string;
        order?: { orderCode: string; totalAmount: number; paymentMethod: PaymentMethod; estimatedDeliveryText?: string | null };
        vietqrUrl?: string | null;
        bankInfo?: VietQRBank | null;
      } | null;

      if (!res.ok || !data?.order) {
        setSubmitError({
          message:
            data?.error ??
            (res.status >= 500
              ? "Hệ thống đang bận, vui lòng thử lại sau ít phút."
              : "Không thể đặt hàng, vui lòng kiểm tra lại thông tin."),
          stock: res.status === 409,
        });
        return;
      }

      clearCart();
      setPlaced({
        orderCode: data.order.orderCode,
        totalAmount: data.order.totalAmount,
        paymentMethod: data.order.paymentMethod,
        phone: v.customerPhone,
        vietqrUrl: data.vietqrUrl ?? null,
        bankInfo: data.bankInfo ?? null,
        paid: false,
        estimatedDeliveryText: data.order.estimatedDeliveryText ?? null,
      });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setSubmitError({ message: "Mất kết nối mạng, vui lòng thử lại.", stock: false });
    } finally {
      submitLock.current = false;
      setSubmitting(false);
    }
  };

  const wrapper = "mx-auto max-w-6xl px-4 py-12 tabular-nums sm:px-6";

  // ---- Sau khi đặt hàng ----
  if (placed) {
    const trackingHref = `/tracking?orderCode=${encodeURIComponent(placed.orderCode)}&phone=${encodeURIComponent(placed.phone)}`;
    const showQR = placed.paymentMethod === "VIETQR" && !placed.paid && placed.vietqrUrl;
    return (
      <div className={`${wrapper} max-w-3xl`}>
        <div className="text-center">
          <CheckCircle2 className="mx-auto text-primary" size={48} />
          <h1 className="type-page-title mt-3">
            {placed.paymentMethod === "VIETQR" && !placed.paid
              ? "Đơn hàng đã được tạo"
              : placed.paymentMethod === "VIETQR"
                ? "Thanh toán thành công"
                : "Đặt hàng thành công"}
          </h1>
          <p className="mt-2 text-muted-foreground">
            Mã đơn hàng của bạn:{" "}
            <span className="type-code font-semibold tracking-wider text-primary">{placed.orderCode}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            Tổng thanh toán: <span className="type-price font-semibold">{formatVND(placed.totalAmount)}</span>
          </p>
          {placed.estimatedDeliveryText && (
            <p className="mt-1 text-sm text-muted-foreground">
              Giao dự kiến: <span className="font-medium text-foreground">{placed.estimatedDeliveryText}</span>
            </p>
          )}
        </div>

        {showQR && placed.vietqrUrl && (
          <div className="mt-8">
            <VietQRPayment
              orderCode={placed.orderCode}
              amount={placed.totalAmount}
              vietqrUrl={placed.vietqrUrl}
              bankInfo={placed.bankInfo}
              onPaid={() => setPlaced((p) => (p ? { ...p, paid: true } : p))}
            />
          </div>
        )}

        {placed.paymentMethod === "COD" && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Bạn sẽ thanh toán khi nhận hàng. KAROSE sẽ sớm liên hệ để xác nhận đơn.
          </p>
        )}
        {placed.paymentMethod === "VIETQR" && placed.paid && (
          <p className="mt-6 text-center text-sm text-muted-foreground">
            Chúng tôi đã nhận được thanh toán và đang chuẩn bị đơn hàng của bạn.
          </p>
        )}

        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href={trackingHref}
            className="rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
          >
            Theo dõi đơn hàng
          </Link>
          <Link
            href="/products"
            className="rounded-full border border-border px-6 py-3 text-sm font-medium"
          >
            Tiếp tục mua sắm
          </Link>
        </div>
      </div>
    );
  }

  // ---- Đang tải giỏ ----
  if (!hasHydrated) {
    return (
      <div className={wrapper}>
        <div className="h-9 w-48 animate-pulse rounded bg-surface" />
        <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_380px]">
          <div className="h-96 animate-pulse rounded-2xl bg-surface" />
          <div className="h-72 animate-pulse rounded-2xl bg-surface" />
        </div>
      </div>
    );
  }

  // ---- Giỏ trống ----
  if (items.length === 0) {
    return (
      <div className={`${wrapper} text-center`}>
        <h1 className="type-page-title">Giỏ hàng đang trống</h1>
        <p className="mt-2 text-muted-foreground">
          Hãy chọn vài sản phẩm thiên nhiên trước khi thanh toán.
        </p>
        <Link
          href="/products"
          className="mt-6 inline-block rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground"
        >
          Quay lại cửa hàng
        </Link>
      </div>
    );
  }

  const subtotal = preview?.subtotal ?? rawSubtotal;
  const discount = preview?.discountAmount ?? 0;
  const shippingFee = preview?.shippingFee ?? 0;
  const total = preview?.totalAmount ?? rawSubtotal;
  const provinceChosen = form.province !== "";
  const freeShip = provinceChosen && shippingFee === 0;

  return (
    <form onSubmit={submit} noValidate className={wrapper}>
      <h1 className="type-page-title">Thanh toán</h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1fr_400px]">
        {/* Cột trái */}
        <div className="space-y-8">
          <section className="rounded-2xl border border-border p-5 sm:p-6">
            <h2 className="type-card-editorial">Thông tin giao hàng</h2>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
              <Field label="Họ và tên" required error={errors.customerName}>
                <input
                  className={inputClass}
                  value={form.customerName}
                  onChange={(e) => setField("customerName", e.target.value)}
                  autoComplete="name"
                />
              </Field>
              <Field label="Số điện thoại" required error={errors.customerPhone}>
                <input
                  className={inputClass}
                  value={form.customerPhone}
                  onChange={(e) => setField("customerPhone", e.target.value.replace(/[^\d]/g, "").slice(0, 10))}
                  inputMode="numeric"
                  autoComplete="tel"
                  placeholder="0xxxxxxxxx"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Email (không bắt buộc)" error={errors.customerEmail}>
                  <input
                    className={inputClass}
                    type="email"
                    value={form.customerEmail}
                    onChange={(e) => setField("customerEmail", e.target.value)}
                    autoComplete="email"
                  />
                </Field>
              </div>
              <Field label="Tỉnh/Thành phố" required error={errors.province}>
                <select
                  className={inputClass}
                  value={form.province}
                  onChange={(e) => setField("province", e.target.value)}
                >
                  <option value="">Chọn tỉnh/thành</option>
                  {VN_PROVINCES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
              </Field>
              <Field label="Quận/Huyện" required error={errors.district}>
                <input
                  className={inputClass}
                  value={form.district}
                  onChange={(e) => setField("district", e.target.value)}
                />
              </Field>
              <Field label="Phường/Xã" required error={errors.ward}>
                <input
                  className={inputClass}
                  value={form.ward}
                  onChange={(e) => setField("ward", e.target.value)}
                />
              </Field>
              <Field label="Địa chỉ cụ thể" required error={errors.shippingAddress}>
                <input
                  className={inputClass}
                  value={form.shippingAddress}
                  onChange={(e) => setField("shippingAddress", e.target.value)}
                  autoComplete="street-address"
                  placeholder="Số nhà, tên đường"
                />
              </Field>
              <div className="sm:col-span-2">
                <Field label="Ghi chú (không bắt buộc)" error={errors.note}>
                  <textarea
                    className={`${inputClass} min-h-20`}
                    value={form.note}
                    onChange={(e) => setField("note", e.target.value)}
                    maxLength={500}
                  />
                </Field>
              </div>
            </div>
          </section>

          <section className="rounded-2xl border border-border p-5 sm:p-6">
            <h2 className="type-card-editorial">Phương thức thanh toán</h2>
            <div className="mt-4 space-y-3">
              {(
                [
                  { id: "COD", title: "Thanh toán khi nhận hàng (COD)", desc: "Trả tiền mặt cho nhân viên giao hàng." },
                  { id: "VIETQR", title: "Chuyển khoản VietQR", desc: "Quét mã QR bằng ứng dụng ngân hàng." },
                ] as const
              ).map((m) => (
                <label
                  key={m.id}
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 ${
                    payment === m.id ? "border-primary bg-surface" : "border-border"
                  }`}
                >
                  <input
                    type="radio"
                    name="paymentMethod"
                    value={m.id}
                    checked={payment === m.id}
                    onChange={() => setPayment(m.id)}
                    className="mt-1 accent-primary"
                  />
                  <span className="flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-sm font-medium">
                      {m.title}
                      {m.id === "VIETQR" && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-primary px-2.5 py-0.5 text-xs font-normal text-primary-foreground">
                          <ShieldCheck size={12} />
                          Tự động xác nhận sau 5 giây
                        </span>
                      )}
                    </span>
                    <span className="block text-xs text-muted-foreground">{m.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </section>
        </div>

        {/* Cột phải */}
        <aside className="h-fit rounded-2xl border border-border bg-surface p-5 sm:p-6 lg:sticky lg:top-24">
          <h2 className="type-card-editorial">Đơn hàng của bạn</h2>
          <ul className="mt-4 divide-y divide-border">
            {items.map((item) => {
              const line = preview?.items.find((l) => l.variantId === item.variantId);
              const unit = line?.unitPrice ?? item.price;
              return (
                <li key={item.variantId} className="flex gap-3 py-3">
                  <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-lg bg-background">
                    <SafeImage src={item.image} alt={item.name} sizes="64px" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 text-sm font-medium">{item.name}</p>
                    <p className="text-xs text-muted-foreground">
                      {item.variantName} × {item.quantity}
                    </p>
                  </div>
                  <div className="shrink-0 text-right">
                    <p className="text-sm font-semibold">{formatVND(line?.lineFinalAmount ?? unit * item.quantity)}</p>
                    {line && line.lineDiscount > 0 && (
                      <>
                        <p className="text-xs text-muted-foreground line-through">{formatVND(line.lineTotal)}</p>
                        <p className="text-xs text-primary">Voucher -{formatVND(line.lineDiscount)}</p>
                      </>
                    )}
                    {line && !line.eligibleForVoucher && preview?.voucher?.applied?.scope === "PRODUCT" && (
                      <p className="text-xs text-muted-foreground">Không thuộc mã</p>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>

          <div className="mt-4 border-t border-border pt-4">
            <p className="mb-2 flex items-center gap-1 text-sm font-medium">
              <Tag size={14} /> Mã giảm giá
            </p>
            {appliedVoucher ? (
              <div className="flex items-center justify-between rounded-lg border border-primary bg-background px-3 py-2 text-sm">
                <span className="font-semibold text-primary">{appliedVoucher}</span>
                <button
                  type="button"
                  onClick={removeVoucher}
                  className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-destructive"
                >
                  <X size={14} /> Gỡ
                </button>
              </div>
            ) : (
              <div className="flex gap-2">
                <input
                  className={inputClass}
                  value={voucherInput}
                  onChange={(e) => setVoucherInput(e.target.value.toUpperCase())}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void applyVoucher();
                    }
                  }}
                  placeholder="Nhập mã"
                  maxLength={50}
                />
                <button
                  type="button"
                  onClick={applyVoucher}
                  disabled={applying}
                  className="shrink-0 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground disabled:opacity-50"
                >
                  {applying ? <Loader2 size={16} className="animate-spin" /> : "Áp dụng"}
                </button>
              </div>
            )}
            {voucherMessage && (
              <p className={`mt-1.5 text-xs ${voucherMessage.ok ? "text-primary" : "text-destructive"}`}>
                {voucherMessage.text}
              </p>
            )}
          </div>

          <dl className="mt-4 space-y-2 border-t border-border pt-4 text-sm">
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Tạm tính</dt>
              <dd>{formatVND(subtotal)}</dd>
            </div>
            {discount > 0 && (
              <div className="text-primary">
                <div className="flex justify-between">
                  <dt>
                    Giảm giá{preview?.voucher?.applied ? (
                      <> (<span className="type-code">{preview.voucher.applied.code}</span>)</>
                    ) : null}
                  </dt>
                  <dd>-{formatVND(discount)}</dd>
                </div>
                {preview?.voucher?.applied?.scope === "PRODUCT" && (
                  <p className="mt-0.5 text-xs">
                    Áp dụng cho: {preview.voucher.applied.appliedProductNames.join(", ")} · tiền hàng được giảm{" "}
                    {formatVND(preview.voucher.applied.eligibleSubtotal)}
                  </p>
                )}
              </div>
            )}
            <div className="flex justify-between">
              <dt className="text-muted-foreground">Phí vận chuyển</dt>
              <dd>
                {!provinceChosen ? "—" : freeShip ? <span className="text-primary">Miễn phí</span> : formatVND(shippingFee)}
              </dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-muted-foreground">Giao dự kiến</dt>
              <dd className="text-right">
                {!provinceChosen
                  ? preview?.deliveryByRegion
                    ? `${preview.deliveryByRegion.bigCity.text} (TP.HCM & Hà Nội) · ${preview.deliveryByRegion.other.text} (tỉnh khác)`
                    : "—"
                  : (preview?.estimatedDelivery.text ?? "—")}
              </dd>
            </div>
            {!provinceChosen && (
              <p className="text-xs text-muted-foreground">
                Chọn tỉnh/thành để tính phí vận chuyển. Miễn phí cho đơn từ{" "}
                {formatVND(FREE_SHIPPING_THRESHOLD)}.
              </p>
            )}
            {provinceChosen && preview && preview.amountNeededForFreeShip > 0 && (
              <p className="text-xs text-muted-foreground">
                Mua thêm {formatVND(preview.amountNeededForFreeShip)} để được miễn phí vận chuyển.
              </p>
            )}
            <div className="flex items-baseline justify-between border-t border-border pt-3">
              <dt className="font-medium">Tổng cộng</dt>
              <dd className="text-xl font-semibold text-primary">
                {previewLoading && <Loader2 size={14} className="mr-2 inline animate-spin" />}
                {formatVND(total)}
              </dd>
            </div>
          </dl>

          {submitError && (
            <div role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-background p-3 text-sm text-destructive">
              <p>{submitError.message}</p>
              {submitError.stock && (
                <button
                  type="button"
                  onClick={openCart}
                  className="mt-2 rounded-full border border-destructive px-3 py-1 text-xs"
                >
                  Mở giỏ hàng để điều chỉnh
                </button>
              )}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting && <Loader2 size={16} className="animate-spin" />}
            {submitting ? "Đang xử lý…" : "Hoàn tất đặt hàng"}
          </button>
          <Link href="/products" className="mt-3 block text-center text-xs text-muted-foreground underline">
            Tiếp tục mua sắm
          </Link>
        </aside>
      </div>
    </form>
  );
}
