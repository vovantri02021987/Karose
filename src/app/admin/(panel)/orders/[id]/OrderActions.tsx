"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_STATUS_LABEL,
  type OrderStatusKey,
  type PaymentStatusKey,
} from "@/lib/admin-labels";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

interface Props {
  orderId: string;
  status: OrderStatusKey;
  paymentStatus: PaymentStatusKey;
  shippingPartner: string;
  trackingCode: string;
  nextStatuses: OrderStatusKey[];
}

export default function OrderActions(props: Props) {
  const router = useRouter();
  const [nextStatus, setNextStatus] = useState<OrderStatusKey | "">("");
  const [paymentStatus, setPaymentStatus] = useState<PaymentStatusKey>(props.paymentStatus);
  const [partner, setPartner] = useState(props.shippingPartner);
  const [tracking, setTracking] = useState(props.trackingCode);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const showShipping = nextStatus === "SHIPPING" || props.status === "SHIPPING";
  const destructive = nextStatus === "CANCELLED" || nextStatus === "RETURNED";

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (nextStatus === "CANCELLED" && !window.confirm("Huỷ đơn và hoàn tồn kho về đúng các lô đã giữ?")) return;
    if (nextStatus === "SHIPPING" && !window.confirm("Xác nhận xuất kho thực tế cho đơn này?")) return;

    const body: Record<string, string> = {};
    if (nextStatus) body.status = nextStatus;
    if (paymentStatus !== props.paymentStatus) body.paymentStatus = paymentStatus;
    if (showShipping) {
      if (partner !== props.shippingPartner) body.shippingPartner = partner;
      if (tracking !== props.trackingCode) body.trackingCode = tracking;
    }
    if (Object.keys(body).length === 0) {
      setMessage({ ok: false, text: "Chưa có thay đổi nào." });
      return;
    }

    setBusy(true);
    setMessage(null);
    try {
      const res = await fetch(`/api/admin/orders/${props.orderId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setMessage({ ok: false, text: data?.error ?? "Không thể cập nhật đơn hàng" });
        return;
      }
      setNextStatus("");
      setMessage({ ok: true, text: "Đã cập nhật đơn hàng." });
      router.refresh();
    } catch {
      setMessage({ ok: false, text: "Mất kết nối mạng, vui lòng thử lại" });
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="h-fit space-y-4 rounded-2xl border border-border bg-surface p-5">
      <h2 className="font-serif text-xl font-semibold">Xử lý đơn hàng</h2>

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Chuyển trạng thái đơn</span>
        <select
          className={inputClass}
          value={nextStatus}
          onChange={(e) => setNextStatus(e.target.value as OrderStatusKey | "")}
          disabled={props.nextStatuses.length === 0}
        >
          <option value="">
            {props.nextStatuses.length === 0
              ? `Đơn đã ở trạng thái cuối (${ORDER_STATUS_LABEL[props.status]})`
              : `Giữ nguyên: ${ORDER_STATUS_LABEL[props.status]}`}
          </option>
          {props.nextStatuses.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>

      {nextStatus === "SHIPPING" && (
        <p className="rounded-lg bg-background p-2 text-xs text-muted-foreground">
          Chuyển sang &quot;Đang giao&quot; sẽ trừ tồn đang giữ (xuất kho thực tế) theo từng lô đã phân bổ.
        </p>
      )}
      {nextStatus === "CANCELLED" && (
        <p className="rounded-lg bg-background p-2 text-xs text-destructive">
          Huỷ đơn sẽ hoàn lại tồn kho vào đúng lô cũ và hoàn lượt dùng voucher.
        </p>
      )}
      {nextStatus === "RETURNED" && (
        <p className="rounded-lg bg-background p-2 text-xs text-muted-foreground">
          Hoàn trả không tự cộng lại tồn kho; hãy nhập/kiểm kê lô sau khi kiểm tra chất lượng hàng.
        </p>
      )}

      {showShipping && (
        <div className="space-y-3">
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Đơn vị vận chuyển</span>
            <input className={inputClass} value={partner} onChange={(e) => setPartner(e.target.value)} placeholder="GHN, GHTK…" maxLength={60} />
          </label>
          <label className="block text-sm">
            <span className="mb-1 block font-medium">Mã vận đơn</span>
            <input className={inputClass} value={tracking} onChange={(e) => setTracking(e.target.value)} maxLength={80} />
          </label>
        </div>
      )}

      <label className="block text-sm">
        <span className="mb-1 block font-medium">Trạng thái thanh toán</span>
        <select className={inputClass} value={paymentStatus} onChange={(e) => setPaymentStatus(e.target.value as PaymentStatusKey)}>
          {(Object.keys(PAYMENT_STATUS_LABEL) as PaymentStatusKey[]).map((s) => (
            <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>
          ))}
        </select>
      </label>

      {message && (
        <p role="status" className={`text-sm ${message.ok ? "text-primary" : "text-destructive"}`}>{message.text}</p>
      )}

      <button
        type="submit"
        disabled={busy}
        className={`flex w-full items-center justify-center gap-2 rounded-full px-6 py-3 text-sm font-medium disabled:opacity-60 ${
          destructive ? "bg-destructive text-white" : "bg-primary text-primary-foreground"
        }`}
      >
        {busy && <Loader2 size={16} className="animate-spin" />}
        {busy ? "Đang lưu…" : "Lưu thay đổi"}
      </button>
    </form>
  );
}
