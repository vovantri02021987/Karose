"use client";

import { Plus } from "lucide-react";
import { useState } from "react";
import { formatVND } from "@/lib/format";
import ProductForm from "./ProductForm";

export interface AdminVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  weightGram: number;
}

export interface AdminProduct {
  id: string;
  name: string;
  slug: string;
  categoryId: string;
  categoryName: string;
  shortDescription: string;
  description: string;
  ingredientsInci: string;
  usageGuide: string;
  storageGuide: string;
  skinTypes: string[];
  benefits: string[];
  images: string[];
  isFeatured: boolean;
  isActive: boolean;
  isCombo: boolean;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  stock: number;
  variants: AdminVariant[];
  comboItems: { childVariantId: string; quantity: number }[];
}

export interface VariantOption {
  id: string;
  label: string;
}

interface Props {
  products: AdminProduct[];
  categories: { id: string; name: string }[];
  variantOptions: VariantOption[];
  canEdit: boolean;
}

export default function ProductManager({ products, categories, variantOptions, canEdit }: Props) {
  const [editing, setEditing] = useState<AdminProduct | "new" | null>(null);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="type-page-title">Sản phẩm & Combo</h1>
        {canEdit && (
          <button
            type="button"
            onClick={() => setEditing("new")}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground"
          >
            <Plus size={16} /> Tạo sản phẩm
          </button>
        )}
      </div>
      {!canEdit && (
        <p className="rounded-lg border border-border bg-surface p-3 text-sm text-muted-foreground">
          Tài khoản nhân viên chỉ được xem danh mục sản phẩm. Chỉnh sửa do quản trị viên (ADMIN) thực hiện.
        </p>
      )}

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Sản phẩm</th>
              <th className="px-4 py-3">Danh mục</th>
              <th className="px-4 py-3">Biến thể</th>
              <th className="px-4 py-3 text-right">Tồn khả dụng</th>
              <th className="px-4 py-3">Trạng thái</th>
              {canEdit && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-border align-top">
            {products.map((p) => (
              <tr key={p.id}>
                <td className="px-4 py-3">
                  <p className="font-medium">
                    {p.name}
                    {p.isCombo && (
                      <span className="ml-2 rounded-full bg-brand-accent/15 px-2 py-0.5 text-xs text-brand-accent">COMBO</span>
                    )}
                  </p>
                  <p className="text-xs text-muted-foreground">/{p.slug}</p>
                </td>
                <td className="px-4 py-3">{p.categoryName}</td>
                <td className="px-4 py-3">
                  <ul className="space-y-0.5 text-xs">
                    {p.variants.map((v) => (
                      <li key={v.id}>
                        <span className="type-code font-medium">{v.sku}</span> · {v.name} · {formatVND(v.price)}
                      </li>
                    ))}
                  </ul>
                </td>
                <td className="px-4 py-3 text-right font-medium">{p.stock}</td>
                <td className="px-4 py-3 text-xs">
                  <span className={p.isActive ? "text-primary" : "text-destructive"}>{p.isActive ? "Đang hiển thị" : "Đã ẩn"}</span>
                  {p.isFeatured && <span className="block text-brand-accent">Nổi bật</span>}
                </td>
                {canEdit && (
                  <td className="px-4 py-3 text-right">
                    <button type="button" onClick={() => setEditing(p)} className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface">
                      Sửa
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {editing && (
        <ProductForm
          key={editing === "new" ? "new" : editing.id}
          product={editing === "new" ? null : editing}
          categories={categories}
          variantOptions={variantOptions}
          onClose={() => setEditing(null)}
        />
      )}
    </div>
  );
}
