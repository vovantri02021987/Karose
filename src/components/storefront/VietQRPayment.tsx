"use client";

import { Check, Copy, Loader2 } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatVND } from "@/lib/format";

export interface VietQRBank {
  bankName: string;
  accountNo: string;
  accountName: string;
}

interface VietQRPaymentProps {
  orderCode: string;
  amount: number;
  vietqrUrl: string;
  bankInfo: VietQRBank | null;
  onPaid: () => void;
  /** Mốc bắt đầu đếm (ms) – cho phép Tracking mở lại QR mà không reset bộ đếm. */
  startedAt?: number;
}

function CopyRow({ label, value, display, mono }: { label: string; value: string; display?: string; mono?: boolean }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* trình duyệt chặn clipboard: bỏ qua, người dùng vẫn chép tay được */
    }
  };
  return (
    <div className="flex items-center justify-between gap-3 border-b border-border py-2.5 last:border-b-0">
      <div className="min-w-0">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={`truncate text-sm font-medium tabular-nums ${mono ? "font-mono" : ""}`}>{display ?? value}</p>
      </div>
      <button
        type="button"
        onClick={copy}
        aria-label={`Sao chép ${label}`}
        className="inline-flex shrink-0 items-center gap-1 rounded-full border border-border px-3 py-1 text-xs hover:bg-surface"
      >
        {copied ? <Check size={14} /> : <Copy size={14} />}
        {copied ? "Đã chép" : "Sao chép"}
      </button>
    </div>
  );
}

function formatTimer(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

/** Khung QR VietQR + thông tin chuyển khoản + polling trạng thái thanh toán mỗi 3 giây. */
export default function VietQRPayment({
  orderCode,
  amount,
  vietqrUrl,
  bankInfo,
  onPaid,
  startedAt,
}: VietQRPaymentProps) {
  const [qrFailed, setQrFailed] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [simulating, setSimulating] = useState(false);
  const [devMessage, setDevMessage] = useState<string | null>(null);
  const onPaidRef = useRef(onPaid);
  const [startMs] = useState(() => startedAt ?? Date.now());

  useEffect(() => {
    onPaidRef.current = onPaid;
  }, [onPaid]);

  const check = useCallback(async (signal?: AbortSignal): Promise<boolean> => {
    try {
      const res = await fetch(`/api/orders/${encodeURIComponent(orderCode)}/status`, {
        cache: "no-store",
        signal,
      });
      if (!res.ok) return false;
      const data = (await res.json()) as { paymentStatus?: string };
      return data.paymentStatus === "PAID";
    } catch {
      return false;
    }
  }, [orderCode]);

  useEffect(() => {
    const controller = new AbortController();
    let stopped = false;
    const poll = async () => {
      if (stopped) return;
      if (await check(controller.signal)) {
        stopped = true;
        window.clearInterval(pollId);
        window.clearInterval(tickId);
        onPaidRef.current();
      }
    };
    const pollId = window.setInterval(poll, 3000);
    const tickId = window.setInterval(
      () => setElapsed(Math.floor((Date.now() - startMs) / 1000)),
      1000,
    );
    return () => {
      stopped = true;
      controller.abort();
      window.clearInterval(pollId);
      window.clearInterval(tickId);
    };
  }, [check, startMs]);

  const simulate = async () => {
    setSimulating(true);
    setDevMessage(null);
    try {
      const res = await fetch("/api/dev/simulate-payment", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderCode }),
      });
      if (!res.ok) setDevMessage("Không giả lập được (chỉ chạy ở môi trường development).");
    } catch {
      setDevMessage("Không giả lập được.");
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border bg-background p-5 sm:p-6">
      <div className="flex flex-col items-center gap-5 sm:flex-row sm:items-start">
        <div className="w-full max-w-[240px] shrink-0">
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-white">
            {qrFailed ? (
              <div className="flex h-full items-center justify-center p-4 text-center text-sm text-muted-foreground">
                Không tải được mã QR. Vui lòng chuyển khoản thủ công theo thông tin bên cạnh.
              </div>
            ) : (
              // eslint-disable-next-line @next/next/no-img-element -- QR ngoại lai (img.vietqr.io), cần onError fallback
              <img
                src={vietqrUrl}
                alt={`Mã QR thanh toán đơn ${orderCode}`}
                className="h-full w-full object-contain"
                onError={() => setQrFailed(true)}
              />
            )}
          </div>
          <div
            className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"
            role="status"
            aria-live="polite"
          >
            <Loader2 size={16} className="animate-spin" />
            <span>Đang chờ thanh toán… {formatTimer(elapsed)}</span>
          </div>
        </div>

        <div className="w-full min-w-0 flex-1">
          <p className="text-sm text-muted-foreground">
            Quét mã QR bằng ứng dụng ngân hàng, hoặc chuyển khoản thủ công. Nhập đúng nội dung
            chuyển khoản để đơn được xác nhận tự động.
          </p>
          <div className="mt-3">
            {bankInfo && (
              <>
                <CopyRow label="Ngân hàng" value={bankInfo.bankName} />
                <CopyRow label="Số tài khoản" value={bankInfo.accountNo} mono />
                <CopyRow label="Chủ tài khoản" value={bankInfo.accountName} />
              </>
            )}
            <CopyRow label="Số tiền" value={String(amount)} display={formatVND(amount)} />
            <CopyRow label="Nội dung chuyển khoản" value={orderCode} mono />
          </div>
        </div>
      </div>

      {process.env.NODE_ENV === "development" && (
        <div className="mt-5 border-t border-dashed border-border pt-4">
          <button
            type="button"
            onClick={simulate}
            disabled={simulating}
            className="rounded-full border border-brand-accent px-4 py-2 text-xs text-brand-accent disabled:opacity-50"
          >
            {simulating ? "Đang giả lập…" : "Giả lập Webhook thanh toán thành công (Dev)"}
          </button>
          {devMessage && <p className="mt-2 text-xs text-destructive">{devMessage}</p>}
        </div>
      )}
    </div>
  );
}
