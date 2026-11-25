"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDate, formatDateTime, formatVND } from "@/lib/format";
import { normalizeText } from "@/lib/text";

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
  scope: "ORDER" | "PRODUCT";
  products: { id: string; name: string }[];
}

export interface ProductOption {
  id: string;
  name: string;
  isCombo: boolean;
  isActive: boolean;
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

function ProductPicker({
  products,
  selected,
  onChange,
}: {
  products: ProductOption[];
  selected: string[];
  onChange: (ids: string[]) => void;
}) {
  const [query, setQuery] = useState("");
  const q = normalizeText(query);
  const visible = q ? products.filter((p) => normalizeText(p.name).includes(q)) : products;
  const toggle = (id: string) =>
    onChange(selected.includes(id) ? selected.filter((x) => x !== id) : [...selected, id]);

  return (
    <div className="space-y-2 rounded-lg border border-border bg-background p-3">
      <div className="flex items-center justify-between gap-3">
        <input
          className={inputClass}
          placeholder="Tìm nhanh theo tên sản phẩm…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-label="Tìm sản phẩm"
        />
        <span className="shrink-0 text-xs text-muted-foreground">Đã chọn {selected.length}</span>
      </div>
      <ul className="max-h-56 divide-y divide-border overflow-y-auto rounded-md border border-border">
        {visible.length === 0 && <li className="p-3 text-sm text-muted-foreground">Không có sản phẩm phù hợp.</li>}
        {visible.map((p) => (
          <li key={p.id}>
            <label className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm hover:bg-surface">
              <input type="checkbox" checked={selected.includes(p.id)} onChange={() => toggle(p.id)} />
              <span className="min-w-0 flex-1 truncate">{p.name}</span>
              {p.isCombo && <span className="rounded-full bg-surface px-2 py-0.5 text-xs">Combo</span>}
              {!p.isActive && <span className="rounded-full bg-surface px-2 py-0.5 text-xs text-muted-foreground">Đang ẩn</span>}
            </label>
          </li>
        ))}
      </ul>
      <p className="text-xs text-muted-foreground">
        Combo là một sản phẩm riêng có giá riêng: chỉ được giảm khi chính combo đó được chọn ở đây, không tự áp theo sản phẩm thành phần.
      </p>
    </div>
  );
}

function VoucherForm({
  products,
  editing,
  onDone,
  onCancel,
}: {
  products: ProductOption[];
  editing: VoucherRow | null;
  onDone: () => void;
  onCancel: () => void;
}) {
  const [f, setF] = useState({
    code: editing?.code ?? "",
    description: editing?.description ?? "",
    discountType: editing ? (editing.discountType === "FIXED" || editing.discountType === "FIXED_AMOUNT" ? "FIXED" : "PERCENT") : "PERCENT",
    discountValue: editing ? String(editing.discountValue) : "",
    minOrderAmount: editing ? String(editing.minOrderAmount) : "0",
    maxDiscount: editing?.maxDiscount ? String(editing.maxDiscount) : "",
    usageLimit: editing?.usageLimit ? String(editing.usageLimit) : "",
    startDate: editing ? editing.startDate.slice(0, 10) : "",
    endDate: editing ? editing.endDate.slice(0, 10) : "",
    scope: editing?.scope ?? "ORDER",
  });
  const [productIds, setProductIds] = useState<string[]>(editing?.products.map((p) => p.id) ?? []);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string) => setF((s) => ({ ...s, [k]: v }));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(editing ? `/api/admin/vouchers/${editing.id}` : "/api/admin/vouchers", {
        method: editing ? "PUT" : "POST",
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
          scope: f.scope,
          productIds: f.scope === "PRODUCT" ? productIds : [],
        }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Không thể lưu voucher");
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
  const isProduct = f.scope === "PRODUCT";

  return (
    <form onSubmit={submit} className="space-y-3 rounded-2xl border border-border bg-surface p-5">
      <h3 className="type-card">{editing ? `Sửa voucher ${editing.code}` : "Tạo voucher mới"}</h3>
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block font-medium">Mã *</span><input className={`${inputClass} type-code`} value={f.code} onChange={(e) => set("code", e.target.value.toUpperCase())} required /></label>
        <label className="text-sm sm:col-span-2"><span className="mb-1 block font-medium">Phạm vi áp dụng *</span>
          <select className={inputClass} value={f.scope} onChange={(e) => set("scope", e.target.value)}>
            <option value="ORDER">Toàn đơn hàng</option>
            <option value="PRODUCT">Từng sản phẩm</option>
          </select>
        </label>
      </div>
      {isProduct && (
        <div className="space-y-1 text-sm">
          <span className="block font-medium">Sản phẩm được giảm giá *</span>
          <ProductPicker products={products} selected={productIds} onChange={setProductIds} />
        </div>
      )}
      <div className="grid gap-3 sm:grid-cols-3">
        <label className="text-sm"><span className="mb-1 block font-medium">Loại giảm *</span>
          <select className={inputClass} value={f.discountType} onChange={(e) => set("discountType", e.target.value)}>
            <option value="PERCENT">Phần trăm (%)</option>
            <option value="FIXED">Số tiền cố định (₫)</option>
          </select>
        </label>
        <label className="text-sm"><span className="mb-1 block font-medium">Giá trị giảm *</span><input className={inputClass} inputMode="numeric" value={f.discountValue} onChange={num("discountValue")} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">{isProduct ? "Tiền hàng SP áp dụng tối thiểu (₫)" : "Đơn tối thiểu (₫)"}</span><input className={inputClass} inputMode="numeric" value={f.minOrderAmount} onChange={num("minOrderAmount")} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Giảm tối đa (₫, cho %)</span><input className={inputClass} inputMode="numeric" value={f.maxDiscount} onChange={num("maxDiscount")} /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Giới hạn lượt dùng</span><input className={inputClass} inputMode="numeric" value={f.usageLimit} onChange={num("usageLimit")} placeholder="Không giới hạn" /></label>
        <span aria-hidden className="hidden sm:block" />
        <label className="text-sm"><span className="mb-1 block font-medium">Bắt đầu *</span><input type="date" className={inputClass} value={f.startDate} onChange={(e) => set("startDate", e.target.value)} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Kết thúc *</span><input type="date" className={inputClass} value={f.endDate} onChange={(e) => set("endDate", e.target.value)} required /></label>
        <label className="text-sm"><span className="mb-1 block font-medium">Mô tả</span><input className={inputClass} value={f.description} onChange={(e) => set("description", e.target.value)} maxLength={200} /></label>
      </div>
      <p className="text-xs text-muted-foreground">
        {isProduct
          ? "Giảm giá và điều kiện tối thiểu chỉ tính trên tiền hàng của các sản phẩm được chọn (không tính sản phẩm khác trong giỏ). Phí ship vẫn xét trên tổng đơn sau giảm."
          : "Giảm giá và điều kiện tối thiểu tính trên tổng tiền hàng của cả đơn."}
      </p>
      {error && <p role="alert" className="text-sm text-destructive">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
          {busy && <Loader2 size={16} className="animate-spin" />} {editing ? "Lưu thay đổi" : "Tạo voucher"}
        </button>
        <button type="button" onClick={onCancel} className="rounded-full border border-border px-5 py-2.5 text-sm hover:bg-background">Huỷ</button>
      </div>
    </form>
  );
}

export default function PromotionsClient({
  vouchers,
  products,
  reviews,
  canEdit,
}: {
  vouchers: VoucherRow[];
  products: ProductOption[];
  reviews: ReviewRow[];
  canEdit: boolean;
}) {
  const router = useRouter();
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<VoucherRow | null>(null);
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
      <h1 className="type-page-title">Khuyến mãi & Đánh giá</h1>
      {!canEdit && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          Tài khoản nhân viên chỉ được xem. Tạo/tắt voucher và duyệt đánh giá do quản trị viên (ADMIN) thực hiện.
        </p>
      )}
      {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="type-card-editorial">Voucher</h2>
          {canEdit && !showForm && (
            <button type="button" onClick={() => { setEditing(null); setShowForm(true); }} className="rounded-full bg-primary px-5 py-2 text-sm font-medium text-primary-foreground">Tạo voucher</button>
          )}
        </div>
        {showForm && (
          <VoucherForm
            key={editing?.id ?? "new"}
            products={products}
            editing={editing}
            onCancel={() => { setShowForm(false); setEditing(null); }}
            onDone={() => { setShowForm(false); setEditing(null); router.refresh(); }}
          />
        )}
        <div className="overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[1000px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Mã</th><th className="px-4 py-3">Phạm vi</th><th className="px-4 py-3">Giảm</th><th className="px-4 py-3">Đơn tối thiểu</th>
                <th className="px-4 py-3">Đã dùng</th><th className="px-4 py-3">Hiệu lực</th><th className="px-4 py-3">Trạng thái</th>
                {canEdit && <th className="px-4 py-3" />}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {vouchers.map((v) => {
                return (
                  <tr key={v.id}>
                    <td className="type-code px-4 py-3 font-medium">{v.code}{v.description && <span className="block text-xs font-normal text-muted-foreground">{v.description}</span>}</td>
                    <td className="px-4 py-3">
                      {v.scope === "PRODUCT" ? (
                        <>
                          <span className="rounded-full bg-brand-accent/15 px-2 py-0.5 text-xs font-medium text-brand-accent">Theo sản phẩm</span>
                          <span className="mt-1 block max-w-56 text-xs text-muted-foreground">{v.products.length > 0 ? v.products.map((p) => p.name).join(", ") : "Chưa chọn sản phẩm"}</span>
                        </>
                      ) : (
                        <span className="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">Toàn đơn</span>
                      )}
                    </td>
                    <td className="px-4 py-3">{discountText(v)}</td>
                    <td className="px-4 py-3">{formatVND(v.minOrderAmount)}</td>
                    <td className="px-4 py-3">{v.usedCount}{v.usageLimit !== null ? ` / ${v.usageLimit}` : ""}</td>
                    <td className="px-4 py-3 text-xs">{formatDate(v.startDate)} – {formatDate(v.endDate)}</td>
                    <td className="px-4 py-3 text-xs">{v.state}</td>
                    {canEdit && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex justify-end gap-2">
                          <button
                            type="button"
                            onClick={() => { setEditing(v); setShowForm(true); window.scrollTo({ top: 0, behavior: "smooth" }); }}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface"
                          >
                            Sửa
                          </button>
                          <button
                            type="button"
                            disabled={busyId === v.id}
                            onClick={() => call(v.id, `/api/admin/vouchers/${v.id}`, { method: "PATCH", body: JSON.stringify({ isActive: !v.isActive }) })}
                            className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface disabled:opacity-50"
                          >
                            {v.isActive ? "Tắt" : "Bật"}
                          </button>
                          <button
                            type="button"
                            disabled={busyId === v.id}
                            onClick={() => { if (window.confirm(`Xoá voucher ${v.code}? Không thể hoàn tác.`)) void call(v.id, `/api/admin/vouchers/${v.id}`, { method: "DELETE" }); }}
                            className="rounded-full border border-destructive/50 px-3 py-1 text-xs text-destructive disabled:opacity-50"
                          >
                            Xoá
                          </button>
                        </div>
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
        <h2 className="type-card-editorial">Đánh giá khách hàng</h2>
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
