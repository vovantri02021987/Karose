"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";

export interface VoucherRow {
  id: string;
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startDate: string;
  endDate: string;
  isActive: boolean;
  state: string;
}

export interface ReviewRow {
  id: string;
  productName: string;
  authorName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  createdAt: string;
}

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function discountText(v: VoucherRow): string {
  const isPercent = v.discountType === "PERCENT" || v.discountType === "PERCENTAGE";
  return isPercent
    ? `${v.discountValue}%${v.maxDiscount ? ` (tối đa ${formatVND(v.maxDiscount)})` : ""}`
    : formatVND(v.discountValue);
}

function VoucherForm({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({
    code: "", description: "", discountType: "PERCENT", discountValue: "", minOrderAmount: "0",
    maxDiscount: "", usageLimit: "", startDate: "", endDate: "",
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/vouchers", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          code: f.code,
          description: f.description,
          discountType: f.discountType,
          discountValue: Number(f.discountValue),
          minOrderAmount: Number(f.minOrderAmount || 0),
          maxDiscount: f.maxDiscount ? Number(f.maxDiscount) : null,
          usageLimit: f.usageLimit ? Number(f.usageLimit) : null,
          startDate: f.startDate,
          endDate: f.endDate,
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Không thể tạo voucher");
        return;
      }
      onDone();
    } catch {
      setError("Mất kết nối mạng, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  };

  const num = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => set(k, e.target.value.replace(/\D/g, ""));

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <h3 className="font-serif text-lg font-semibold">Tạo voucher mới</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block font-medium">Mã *</span><input className={inputClass} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Loại giảm *</span>
          <select className={inputClass} value={f.discountType} onChange={(e) => set("discountType", e.target.value)}>
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="FIXED">Số tiền cố định (₫)</option>
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block font-medium">Giá trị giảm *</span><input className={inputClass} inputMode="numeric" value={f.discountValue} onChange={num("discountValue")} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Đơn tối thiểu (₫)</span><input className={inputClass} inputMode="numeric" value={f.minOrderAmount} onChange={num("minOrderAmount")} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Giảm tối đa (₫, cho %)</span><input className={inputClass} inputMode="numeric" value={f.maxDiscount} onChange={num("maxDiscount")} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Giới hạn lượt dùng</span><input className={inputClass} inputMode="numeric" value={f.usageLimit} onChange={num("usageLimit")} placeholder="Không giới hạn" /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Bắt đầu *</span><input type="date" className={inputClass} value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Kết thúc *</span><input type="date" className={inputClass} value={f.endDate} onChange={(e) => set("endDate", e.target.value)} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Mô tả</span><input className={inputClass} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={200} /></label>
      </div>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />} Tạo voucher
      </button>
    </form>
  );
}

export default function PromotionsClient({
  vouchers,
  reviews,
  canEdit,
}: {
  vouchers: VoucherRow[];
  reviews: ReviewRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const call = async (id: string, url: string, init: RequestInit) => {
    if (busyId) return;
    setBusyId(id);
    setError(null);
    try {
      const res = await fetch(url, { ...init, headers: { "Content-Type": "application/json" } });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) setError(data?.error ?? "Thao tác thất bại");
      else router.refresh();
    } catch {
      setError("Mất kết nối mạng, vui lòng thử lại");
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-10">
      <h1 className="font-serif text-3xl font-semibold">Khuyến mãi & Đánh giá</h1>
      {!canEdit && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          Tài khoản nhân viên chỉ được xem. Tạo/tắt voucher và duyệt đánh giá do quản trị viên (ADMIN) thực hiện.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Voucher</h2>
          {canEdit && !showForm && (
            <button type="button" onClick={() => setShowForm(true)} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Tạo voucher</button>
          )}
        </div>
        {showForm && <VoucherForm onDone={() => { setShowForm(false); router.refresh(); }} />}
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[860px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Giảm</th><th className="px-4 py-3">Đơn tối thiểu</th>
                <th className="px-4 py-3">Đã dùng</th><th className="px-4 py-3">Hiệu lực</th><th className="px-4 py-3">Trạng thái</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vouchers.map((v) => {
                return (
                  <tr key={v.id}>
                    <td className="px-4 py-3 font-medium">{v.code}{v.description && <span className="block text-xs font-normal text-muted-foreground">{v.description}</span>}</td>
                    <td className="px-4 py-3">{discountText(v)}</td>
                    <td className="px-4 py-3">{formatVND(v.minOrderAmount)}</td>
                    <td className="px-4 py-3">{v.usedCount}{v.usageLimit !== null ? ` / ${v.usageLimit}` : ""}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(v.startDate)} – {formatDate(v.endDate)}</td>
                    <td className="px-4 py-3 text-xs">{v.state}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <button
                          type="button"
                          disabled={busyId === v.id}
                          onClick={() => call(v.id, `/api/admin/vouchers/${v.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !v.isActive }) })}
                          className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface disabled:opacity-50"
                        >
                          {v.isActive ? "Tắt" : "Bật"}
                        </button>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="space-y-4">
        <h2 className="font-serif text-xl font-semibold">Đánh giá khách hàng</h2>
        {reviews.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có đánh giá.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {reviews.map((r) => (
              <li key={r.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 text-sm">
                  <p className="font-medium">
                    {r.authorName} · {"★".repeat(r.rating)}
                    <span className="text-border">{"★".repeat(5 - r.rating)}</span>
                    <span className={`ml-2 rounded-full px-2 py-0.5 text-xs ${r.isApproved ? "bg-primary/10 text-primary" : "bg-brand-accent/15 text-brand-accent"}`}>
                      {r.isApproved ? "Đã duyệt" : "Chờ duyệt"}
                    </span>
                  </p>
                  <p className="text-xs text-muted-foreground">{r.productName} · {formatDateTime(r.createdAt)}</p>
                  <p className="mt-1 whitespace-pre-line">{r.comment}</p>
                </div>
                {canEdit && (
                  <div className="flex shrink-0 gap-2">
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => call(r.id, `/api/admin/reviews/${r.id}`, { method: "PATCH", body: JSON.stringify({ isApproved: !r.isApproved }) })}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface disabled:opacity-50"
                    >
                      {r.isApproved ? "Bỏ duyệt" : "Duyệt"}
                    </button>
                    <button
                      type="button"
                      disabled={busyId === r.id}
                      onClick={() => { if (window.confirm("Xoá đánh giá này vĩnh viễn?")) void call(r.id, `/api/admin/reviews/${r.id}`, { method: "DELETE" }); }}
                      className="rounded-full border border-destructive/50 px-3 py-1 text-xs text-destructive disabled:opacity-50"
                    >
                      Xoá
                    </button>
                  </div>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
