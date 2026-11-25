"use client";

import { Loader2, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { productInputSchema, slugify } from "@/lib/admin-schemas";
import { BENEFITS, SKIN_TYPES } from "@/types/product";
import type { AdminProduct, VariantOption } from "./ProductManager";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:border-primary";

interface VariantState {
  id?: string;
  sku: string;
  name: string;
  price: string;
  compareAtPrice: string;
  weightGram: string;
}

interface ComboState {
  childVariantId: string;
  quantity: string;
}

function Label({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <label className="block text-sm">
      <span className="mb-1 block font-medium">{text}</span>
      {children}
    </label>
  );
}

function toggle(list: string[], value: string): string[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

export default function ProductForm({
  product,
  categories,
  variantOptions,
  onClose,
}: {
  product: AdminProduct | null;
  categories: { id: string; name: string }[];
  variantOptions: VariantOption[];
  onClose: () => void;
}) {
  const router = useRouter();
  const [name, setName] = useState(product?.name ?? "");
  const [slug, setSlug] = useState(product?.slug ?? "");
  const [slugTouched, setSlugTouched] = useState(Boolean(product));
  const [categoryId, setCategoryId] = useState(product?.categoryId ?? categories[0]?.id ?? "");
  const [shortDescription, setShortDescription] = useState(product?.shortDescription ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [ingredientsInci, setIngredientsInci] = useState(product?.ingredientsInci ?? "");
  const [usageGuide, setUsageGuide] = useState(product?.usageGuide ?? "");
  const [storageGuide, setStorageGuide] = useState(product?.storageGuide ?? "");
  const [skinTypes, setSkinTypes] = useState<string[]>(product?.skinTypes ?? []);
  const [benefits, setBenefits] = useState<string[]>(product?.benefits ?? []);
  const [images, setImages] = useState<string[]>(product?.images.length ? product.images : [""]);
  const [isFeatured, setIsFeatured] = useState(product?.isFeatured ?? false);
  const [isActive, setIsActive] = useState(product?.isActive ?? true);
  const [isCombo, setIsCombo] = useState(product?.isCombo ?? false);
  const [variants, setVariants] = useState<VariantState[]>(
    product?.variants.length
      ? product.variants.map((v) => ({
          id: v.id,
          sku: v.sku,
          name: v.name,
          price: String(v.price),
          compareAtPrice: v.compareAtPrice ? String(v.compareAtPrice) : "",
          weightGram: String(v.weightGram),
        }))
      : [{ sku: "", name: "", price: "", compareAtPrice: "", weightGram: "200" }],
  );
  const [comboItems, setComboItems] = useState<ComboState[]>(
    product?.comboItems.map((c) => ({ childVariantId: c.childVariantId, quantity: String(c.quantity) })) ?? [],
  );
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const updateVariant = (idx: number, patch: Partial<VariantState>) =>
    setVariants((list) => list.map((v, i) => (i === idx ? { ...v, ...patch } : v)));

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    const payload = {
      name,
      slug,
      categoryId,
      shortDescription,
      description,
      ingredientsInci,
      usageGuide,
      storageGuide,
      skinTypes,
      benefits,
      images: images.map((i) => i.trim()).filter(Boolean),
      isFeatured,
      isActive,
      isCombo,
      variants: variants.map((v) => ({
        ...(v.id ? { id: v.id } : {}),
        sku: v.sku,
        name: v.name,
        price: Number(v.price),
        compareAtPrice: v.compareAtPrice.trim() ? Number(v.compareAtPrice) : null,
        weightGram: Number(v.weightGram),
      })),
      comboItems: isCombo
        ? comboItems.map((c) => ({ childVariantId: c.childVariantId, quantity: Number(c.quantity) }))
        : [],
    };
    const parsed = productInputSchema.safeParse(payload);
    if (!parsed.success) {
      setError(parsed.error.issues[0]?.message ?? "Dữ liệu chưa hợp lệ");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(product ? `/api/admin/products/${product.id}` : "/api/admin/products", {
        method: product ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsed.data),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Không thể lưu sản phẩm");
        return;
      }
      router.refresh();
      onClose();
    } catch {
      setError("Mất kết nối mạng, vui lòng thử lại");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-foreground/40 p-4">
      <form
        onSubmit={submit}
        className="my-8 w-full max-w-3xl space-y-6 rounded-2xl bg-background p-5 shadow-xl sm:p-7"
        aria-label={product ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm"}
      >
        <div className="flex items-center justify-between">
          <h2 className="type-section">{product ? "Chỉnh sửa sản phẩm" : "Tạo sản phẩm mới"}</h2>
          <button type="button" onClick={onClose} aria-label="Đóng" className="p-1"><X size={22} /></button>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="Tên sản phẩm *">
            <input
              className={inputClass}
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                if (!slugTouched) setSlug(slugify(e.target.value));
              }}
            />
          </Label>
          <Label text="Slug (đường dẫn) *">
            <input
              className={inputClass}
              value={slug}
              onChange={(e) => {
                setSlugTouched(true);
                setSlug(e.target.value);
              }}
            />
          </Label>
          <Label text="Danh mục *">
            <select className={inputClass} value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
              {categories.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Label>
          <div className="flex flex-wrap items-end gap-x-5 gap-y-2 pb-2 text-sm">
            <label className="flex items-center gap-2"><input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} /> Hiển thị</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={isFeatured} onChange={(e) => setIsFeatured(e.target.checked)} /> Nổi bật</label>
            <label className="flex items-center gap-2"><input type="checkbox" checked={isCombo} onChange={(e) => setIsCombo(e.target.checked)} /> Là combo</label>
          </div>
        </div>

        <Label text="Mô tả ngắn *"><input className={inputClass} value={shortDescription} onChange={(e) => setShortDescription(e.target.value)} maxLength={300} /></Label>
        <Label text="Mô tả chi tiết *"><textarea className={`${inputClass} min-h-28`} value={description} onChange={(e) => setDescription(e.target.value)} /></Label>
        <Label text="Bảng thành phần INCI *"><textarea className={`${inputClass} min-h-24`} value={ingredientsInci} onChange={(e) => setIngredientsInci(e.target.value)} /></Label>
        <div className="grid gap-4 sm:grid-cols-2">
          <Label text="Hướng dẫn sử dụng *"><textarea className={`${inputClass} min-h-24`} value={usageGuide} onChange={(e) => setUsageGuide(e.target.value)} /></Label>
          <Label text="Hướng dẫn bảo quản"><textarea className={`${inputClass} min-h-24`} value={storageGuide} onChange={(e) => setStorageGuide(e.target.value)} /></Label>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Loại da</legend>
            <div className="flex flex-wrap gap-2">
              {SKIN_TYPES.map((s) => (
                <button
                  key={s.value}
                  type="button"
                  onClick={() => setSkinTypes((l) => toggle(l, s.value))}
                  className={`rounded-full border px-3 py-1 text-xs ${skinTypes.includes(s.value) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {s.label}
                </button>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend className="mb-1 text-sm font-medium">Công dụng</legend>
            <div className="flex flex-wrap gap-2">
              {BENEFITS.map((b) => (
                <button
                  key={b.value}
                  type="button"
                  onClick={() => setBenefits((l) => toggle(l, b.value))}
                  className={`rounded-full border px-3 py-1 text-xs ${benefits.includes(b.value) ? "border-primary bg-primary text-primary-foreground" : "border-border"}`}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </fieldset>
        </div>

        <fieldset className="space-y-2">
          <legend className="text-sm font-medium">Ảnh sản phẩm (URL hoặc đường dẫn /images/…)</legend>
          {images.map((url, idx) => (
            <div key={idx} className="flex gap-2">
              <input className={inputClass} value={url} onChange={(e) => setImages((l) => l.map((v, i) => (i === idx ? e.target.value : v)))} placeholder="https://… hoặc /images/products/ten-anh.webp" />
              <button type="button" aria-label="Xoá ảnh" onClick={() => setImages((l) => (l.length > 1 ? l.filter((_, i) => i !== idx) : [""]))} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setImages((l) => [...l, ""])} className="text-xs text-primary underline">+ Thêm ảnh</button>
        </fieldset>

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">Biến thể *</legend>
          {variants.map((v, idx) => (
            <div key={v.id ?? idx} className="grid gap-2 rounded-xl border border-border p-3 sm:grid-cols-[1fr_1.2fr_1fr_1fr_0.8fr_auto]">
              <input className={inputClass} placeholder="SKU" value={v.sku} onChange={(e) => updateVariant(idx, { sku: e.target.value.toUpperCase() })} aria-label="SKU" />
              <input className={inputClass} placeholder="Tên (VD: Chai 100ml)" value={v.name} onChange={(e) => updateVariant(idx, { name: e.target.value })} aria-label="Tên biến thể" />
              <input className={inputClass} placeholder="Giá (₫)" inputMode="numeric" value={v.price} onChange={(e) => updateVariant(idx, { price: e.target.value.replace(/\D/g, "") })} aria-label="Giá bán" />
              <input className={inputClass} placeholder="Giá gạch (₫)" inputMode="numeric" value={v.compareAtPrice} onChange={(e) => updateVariant(idx, { compareAtPrice: e.target.value.replace(/\D/g, "") })} aria-label="Giá gạch" />
              <input className={inputClass} placeholder="Gram" inputMode="numeric" value={v.weightGram} onChange={(e) => updateVariant(idx, { weightGram: e.target.value.replace(/\D/g, "") })} aria-label="Khối lượng (gram)" />
              <button type="button" aria-label="Xoá biến thể" disabled={variants.length === 1} onClick={() => setVariants((l) => l.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-destructive disabled:opacity-30"><Trash2 size={16} /></button>
            </div>
          ))}
          <button type="button" onClick={() => setVariants((l) => [...l, { sku: "", name: "", price: "", compareAtPrice: "", weightGram: "200" }])} className="inline-flex items-center gap-1 text-xs text-primary underline"><Plus size={12} /> Thêm biến thể</button>
        </fieldset>

        {isCombo && (
          <fieldset className="space-y-3">
            <legend className="text-sm font-medium">Thành phần combo *</legend>
            {comboItems.map((c, idx) => (
              <div key={idx} className="grid gap-2 sm:grid-cols-[1fr_100px_auto]">
                <select className={inputClass} value={c.childVariantId} onChange={(e) => setComboItems((l) => l.map((x, i) => (i === idx ? { ...x, childVariantId: e.target.value } : x)))} aria-label="Sản phẩm thành phần">
                  <option value="">Chọn sản phẩm lẻ…</option>
                  {variantOptions.map((o) => <option key={o.id} value={o.id}>{o.label}</option>)}
                </select>
                <input className={inputClass} inputMode="numeric" value={c.quantity} onChange={(e) => setComboItems((l) => l.map((x, i) => (i === idx ? { ...x, quantity: e.target.value.replace(/\D/g, "") } : x)))} aria-label="Số lượng" />
                <button type="button" aria-label="Xoá thành phần" onClick={() => setComboItems((l) => l.filter((_, i) => i !== idx))} className="p-2 text-muted-foreground hover:text-destructive"><Trash2 size={16} /></button>
              </div>
            ))}
            <button type="button" onClick={() => setComboItems((l) => [...l, { childVariantId: "", quantity: "1" }])} className="inline-flex items-center gap-1 text-xs text-primary underline"><Plus size={12} /> Thêm thành phần</button>
          </fieldset>
        )}

        {error && <p role="alert" className="rounded-lg border border-destructive/40 p-3 text-sm text-destructive">{error}</p>}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className="rounded-full border border-border px-5 py-2.5 text-sm">Huỷ</button>
          <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60">
            {busy && <Loader2 size={16} className="animate-spin" />}
            {busy ? "Đang lưu…" : "Lưu sản phẩm"}
          </button>
        </div>
      </form>
    </div>
  );
}
