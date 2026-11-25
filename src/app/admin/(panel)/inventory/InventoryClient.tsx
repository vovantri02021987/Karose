"use client";

import { Loader2, Plus, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate } from "@/lib/format";

export interface BatchRow {
  id: string;
  variantId: string;
  batchCode: string;
  productName: string;
  variantName: string;
  sku: string;
  manufacturedDate: string;
  expiryDate: string;
  initialQuantity: number;
  availableQuantity: number;
  reservedQuantity: number;
  fefoRank: number | null;
  state: "OK" | "NEAR" | "EXPIRED";
}

export interface VariantChoice {
  id: string;
  label: string;
}

const STATE_LABEL = { OK: "Khả dụng bán lẻ", NEAR: "Cận hạn (≤ 30 ngày)", EXPIRED: "Hết hạn" } as const;
const STATE_TONE = {
  OK: "bg-primary/10 text-primary",
  NEAR: "bg-brand-accent/15 text-brand-accent",
  EXPIRED: "bg-destructive/10 text-destructive",
} as const;

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
      <div className="my-10 w-full max-w-md rounded-2xl bg-background p-6 shadow-xl">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">{title}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="p-1"><X size={20} /></button>
        </div>
        {children}
      </div>
    </div>
  );
}

function IntakeForm({ variants, defaultVariantId, onDone }: { variants: VariantChoice[]; defaultVariantId: string; onDone: () => void }) {
  const router = useRouter();
  const [variantId, setVariantId] = useState(defaultVariantId || variants[0]?.id || "");
  const [batchCode, setBatchCode] = useState("");
  const [manufacturedDate, setManufacturedDate] = useState("");
  const [expiryDate, setExpiryDate] = useState("");
  const [qty, setQty] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (manufacturedDate && expiryDate && expiryDate <= manufacturedDate) {
      setError("Hạn sử dụng phải sau ngày sản xuất");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/inventory/batches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ variantId, batchCode, manufacturedDate, expiryDate, initialQuantity: Number(qty) }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Không thể nhập lô");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("Mất kết nối mạng, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="space-y-3">
      <label className="block text-sm"><span className="mb-1 block font-medium">Biến thể *</span>
        <select className={inputClass} value={variantId} onChange={(e) => setVariantId(e.target.value)}>
          {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
        </select>
      </label>
      <label className="block text-sm"><span className="mb-1 block font-medium">Mã lô *</span>
        <input className={inputClass} value={batchCode} onChange={(e) => setBatchCode(e.target.value.toUpperCase())} placeholder="VD: KR-RH-2611D" required />
      </label>
      <div className="grid grid-cols-2 gap-3">
        <label className="block text-sm"><span className="mb-1 block font-medium">Ngày sản xuất *</span>
          <input type="date" className={inputClass} value={manufacturedDate} onChange={(e) => setManufacturedDate(e.target.value)} required />
        </label>
        <label className="block text-sm"><span className="mb-1 block font-medium">Hạn sử dụng *</span>
          <input type="date" className={inputClass} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} required />
        </label>
      </div>
      <label className="block text-sm"><span className="mb-1 block font-medium">Số lượng nhập *</span>
        <input className={inputClass} inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} required />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />} Nhập lô
      </button>
    </form>
  );
}

function AdjustForm({ batch, onDone }: { batch: BatchRow; onDone: () => void }) {
  const router = useRouter();
  const [counted, setCounted] = useState(String(batch.availableQuantity + batch.reservedQuantity));
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/inventory/batches/${batch.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ countedQuantity: Number(counted), reason }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Không thể điều chỉnh");
        return;
      }
      router.refresh();
      onDone();
    } catch {
      setError("Mất kết nối mạng, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  };

  const newAvailable = Number(counted || 0) - batch.reservedQuantity;

  return (
    <form onSubmit={submit} className="space-y-3">
      <p className="text-sm text-muted-foreground">
        Lô <b>{batch.batchCode}</b> · {batch.productName} ({batch.variantName}). Đang giữ cho đơn hàng: <b>{batch.reservedQuantity}</b>.
      </p>
      <label className="block text-sm"><span className="mb-1 block font-medium">Số đếm thực tế trong kho (gồm hàng đang giữ) *</span>
        <input className={inputClass} inputMode="numeric" value={counted} onChange={(e) => setCounted(e.target.value.replace(/\D/g, ""))} required />
      </label>
      <p className={`text-xs ${newAvailable < 0 ? "text-destructive" : "text-muted-foreground"}`}>
        Tồn khả dụng mới: {Number.isFinite(newAvailable) ? newAvailable : 0} (hiện tại {batch.availableQuantity})
      </p>
      <label className="block text-sm"><span className="mb-1 block font-medium">Lý do điều chỉnh *</span>
        <input className={inputClass} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="VD: Kiểm kê tháng 11, hao hụt 2 chai" required maxLength={300} />
      </label>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <button type="submit" disabled={busy || newAvailable < 0} className="flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
        {busy && <Loader2 size={16} className="animate-spin" />} Lưu kiểm kê
      </button>
    </form>
  );
}

export default function InventoryClient({
  batches,
  variants,
  selectedVariantId,
}: {
  batches: BatchRow[];
  variants: VariantChoice[];
  selectedVariantId: string;
}) {
  const router = useRouter();
  const [intake, setIntake] = useState(false);
  const [adjusting, setAdjusting] = useState<BatchRow | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-serif text-3xl font-semibold">Nhập kho & Lô FEFO</h1>
        <button type="button" onClick={() => setIntake(true)} className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground">
          <Plus size={16} /> Nhập lô mới
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm">
        <label className="flex items-center gap-2">
          <span className="text-muted-foreground">Lọc theo biến thể:</span>
          <select
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm"
            value={selectedVariantId}
            onChange={(e) => router.push(e.target.value ? `/admin/inventory?variantId=${encodeURIComponent(e.target.value)}` : "/admin/inventory")}
          >
            <option value="">Tất cả</option>
            {variants.map((v) => <option key={v.id} value={v.id}>{v.label}</option>)}
          </select>
        </label>
        <p className="text-muted-foreground">FEFO: lô hết hạn sớm nhất được xuất trước (thứ tự #1, #2…).</p>
      </div>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[960px] text-left text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">FEFO</th>
              <th className="px-4 py-3">Mã lô</th>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">NSX</th>
              <th className="px-4 py-3">HSD</th>
              <th className="px-4 py-3 text-right">Nhập</th>
              <th className="px-4 py-3 text-right">Khả dụng</th>
              <th className="px-4 py-3 text-right">Đang giữ</th>
              <th className="px-4 py-3">Trạng thái</th>
              <th className="px-4 py-3" />
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {batches.length === 0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-muted-foreground">Chưa có lô hàng.</td></tr>
            )}
            {batches.map((b) => (
              <tr key={b.id}>
                <td className="px-4 py-3 font-semibold">{b.fefoRank ? `#${b.fefoRank}` : "—"}</td>
                <td className="px-4 py-3 font-medium">{b.batchCode}</td>
                <td className="px-4 py-3">{b.productName}<span className="block text-xs text-muted-foreground">{b.variantName} · {b.sku}</span></td>
                <td className="px-4 py-3">{formatDate(b.manufacturedDate)}</td>
                <td className="px-4 py-3">{formatDate(b.expiryDate)}</td>
                <td className="px-4 py-3 text-right">{b.initialQuantity}</td>
                <td className="px-4 py-3 text-right font-medium">{b.availableQuantity}</td>
                <td className="px-4 py-3 text-right">{b.reservedQuantity}</td>
                <td className="px-4 py-3"><span className={`whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${STATE_TONE[b.state]}`}>{STATE_LABEL[b.state]}</span></td>
                <td className="px-4 py-3 text-right">
                  <button type="button" onClick={() => setAdjusting(b)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface">Kiểm kê</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {intake && (
        <Modal title="Nhập lô hàng mới" onClose={() => setIntake(false)}>
          <IntakeForm variants={variants} defaultVariantId={selectedVariantId} onDone={() => setIntake(false)} />
        </Modal>
      )}
      {adjusting && (
        <Modal title="Kiểm kê / điều chỉnh tồn" onClose={() => setAdjusting(null)}>
          <AdjustForm batch={adjusting} onDone={() => setAdjusting(null)} />
        </Modal>
      )}
    </div>
  );
}
