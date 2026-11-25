"use client";

import { SlidersHorizontal, Search, X } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import ProductCard from "@/components/storefront/ProductCard";
import { normalizeText } from "@/lib/text";
import {
  BENEFITS,
  SKIN_TYPES,
  type CatalogProduct,
  type CategorySummary,
} from "@/types/product";

const PAGE_SIZE = 12;

type SortKey = "featured" | "price-asc" | "price-desc";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "featured", label: "Nổi bật" },
  { value: "price-asc", label: "Giá tăng dần" },
  { value: "price-desc", label: "Giá giảm dần" },
];

function parseSort(value: string | null): SortKey {
  return value === "price-asc" || value === "price-desc" ? value : "featured";
}

export default function ProductCatalogClient({
  products,
  categories,
}: {
  products: CatalogProduct[];
  categories: CategorySummary[];
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const category = searchParams.get("category") ?? "";
  const skin = searchParams.get("skin") ?? "";
  const benefit = searchParams.get("benefit") ?? "";
  const comboOnly = searchParams.get("combo") === "1";
  const q = searchParams.get("q") ?? "";
  const sort = parseSort(searchParams.get("sort"));

  const setParams = useCallback(
    (updates: Record<string, string | null>) => {
      const next = new URLSearchParams(searchParams.toString());
      for (const [key, value] of Object.entries(updates)) {
        if (value) next.set(key, value);
        else next.delete(key);
      }
      const qs = next.toString();
      router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    },
    [pathname, router, searchParams],
  );

  // Ô tìm kiếm: giữ state cục bộ, đẩy lên URL sau 300ms; đồng bộ lại khi URL đổi từ nơi khác (Navbar).
  const [qInput, setQInput] = useState(q);
  const [prevQ, setPrevQ] = useState(q);
  if (q !== prevQ) {
    setPrevQ(q);
    setQInput(q);
  }
  useEffect(() => {
    if (qInput === q) return;
    const t = setTimeout(() => setParams({ q: qInput.trim() || null }), 300);
    return () => clearTimeout(t);
  }, [qInput, q, setParams]);

  const skinCounts = useMemo(
    () =>
      Object.fromEntries(
        SKIN_TYPES.map((s) => [
          s.value,
          products.filter(
            (p) =>
              p.skinTypes.includes(s.value) ||
              p.skinTypes.includes("MOI_LOAI_DA"),
          ).length,
        ]),
      ),
    [products],
  );
  const benefitCounts = useMemo(
    () =>
      Object.fromEntries(
        BENEFITS.map((b) => [
          b.value,
          products.filter((p) => p.benefits.includes(b.value)).length,
        ]),
      ),
    [products],
  );

  const visible = useMemo(() => {
    const tokens = normalizeText(q).split(" ").filter(Boolean);
    const list = products.filter((p) => {
      if (category && p.categorySlug !== category) return false;
      if (
        skin &&
        !p.skinTypes.includes(skin) &&
        !p.skinTypes.includes("MOI_LOAI_DA")
      )
        return false;
      if (benefit && !p.benefits.includes(benefit)) return false;
      if (comboOnly && !p.isCombo) return false;
      if (tokens.length > 0 && !tokens.every((t) => p.searchIndex.includes(t)))
        return false;
      return true;
    });
    const sorted = [...list];
    if (sort === "price-asc") sorted.sort((a, b) => a.minPrice - b.minPrice);
    else if (sort === "price-desc")
      sorted.sort((a, b) => b.minPrice - a.minPrice);
    else
      sorted.sort(
        (a, b) =>
          Number(b.stock > 0) - Number(a.stock > 0) ||
          Number(b.isFeatured) - Number(a.isFeatured) ||
          a.name.localeCompare(b.name, "vi"),
      );
    return sorted;
  }, [products, category, skin, benefit, comboOnly, q, sort]);

  const hasFilters = Boolean(category || skin || benefit || comboOnly || q);
  const activeCount = [skin, benefit, comboOnly ? "1" : ""].filter(Boolean).length;
  const hasSkinData = SKIN_TYPES.some((s) => (skinCounts[s.value] ?? 0) > 0);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const filterKey = searchParams.toString();
  const [shown, setShown] = useState({ key: filterKey, n: PAGE_SIZE });
  const limit = shown.key === filterKey ? shown.n : PAGE_SIZE;
  const page = visible.slice(0, limit);

  const chip = (active: boolean, disabled = false) =>
    `rounded-full border px-3 py-1.5 text-sm transition ${
      active
        ? "border-primary bg-primary text-primary-foreground"
        : disabled
          ? "cursor-not-allowed border-border text-muted-foreground/50"
          : "border-border hover:border-primary"
    }`;

  return (
    <>
      <div className="mt-8 -mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0" role="group" aria-label="Danh mục">
        <div className="flex w-max gap-2 pb-1">
          <button
            type="button"
            className={chip(!category)}
            onClick={() => setParams({ category: null })}
          >
            Tất cả
          </button>
          {categories.map((c) => (
            <button
              key={c.slug}
              type="button"
              className={`${chip(category === c.slug)} whitespace-nowrap`}
              onClick={() =>
                setParams({ category: category === c.slug ? null : c.slug })
              }
            >
              {c.name} ({c.count})
            </button>
          ))}
        </div>
      </div>
    <div className="mt-6 grid gap-10 lg:grid-cols-[260px_1fr]">
      <aside
        className={`space-y-7 ${drawerOpen ? "block" : "hidden"} lg:block`}
        aria-label="Bộ lọc sản phẩm"
      >
        <div className="flex items-center rounded-full border border-border bg-surface px-3">
          <Search size={16} className="text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={qInput}
            onChange={(e) => setQInput(e.target.value)}
            placeholder="Tìm theo tên, thành phần…"
            aria-label="Tìm theo tên hoặc thành phần"
            className="w-full bg-transparent px-2 py-2.5 text-sm outline-none"
          />
        </div>

        {(hasSkinData || skin) && (
        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Loại da</legend>
          <div className="flex flex-wrap gap-2">
            {SKIN_TYPES.map((s) => {
              const count = skinCounts[s.value] ?? 0;
              const disabled = count === 0 && skin !== s.value;
              return (
                <button
                  key={s.value}
                  type="button"
                  disabled={disabled}
                  className={chip(skin === s.value, disabled)}
                  onClick={() =>
                    setParams({ skin: skin === s.value ? null : s.value })
                  }
                >
                  {s.label} ({count})
                </button>
              );
            })}
          </div>
        </fieldset>
        )}

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Công dụng</legend>
          <div className="flex flex-wrap gap-2">
            {BENEFITS.map((b) => {
              const count = benefitCounts[b.value] ?? 0;
              const disabled = count === 0 && benefit !== b.value;
              return (
                <button
                  key={b.value}
                  type="button"
                  disabled={disabled}
                  className={chip(benefit === b.value, disabled)}
                  onClick={() =>
                    setParams({ benefit: benefit === b.value ? null : b.value })
                  }
                >
                  {b.label} ({count})
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset>
          <legend className="mb-3 text-sm font-semibold">Loại sản phẩm</legend>
          <div className="flex gap-2">
            <button
              type="button"
              className={chip(!comboOnly)}
              onClick={() => setParams({ combo: null })}
            >
              Tất cả
            </button>
            <button
              type="button"
              className={chip(comboOnly)}
              onClick={() => setParams({ combo: "1" })}
            >
              Chỉ combo
            </button>
          </div>
        </fieldset>

        {hasFilters && (
          <button
            type="button"
            onClick={() => {
              setQInput("");
              router.replace(pathname, { scroll: false });
            }}
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
          >
            <X size={14} /> Xoá tất cả bộ lọc
          </button>
        )}
      </aside>

      <section aria-live="polite">
        <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setDrawerOpen((v) => !v)}
              aria-expanded={drawerOpen}
              className="inline-flex items-center gap-2 rounded-full border border-border px-3 py-1.5 text-sm lg:hidden"
            >
              <SlidersHorizontal size={14} aria-hidden="true" />
              Bộ lọc{activeCount > 0 ? ` (${activeCount})` : ""}
            </button>
            <p className="text-sm text-muted-foreground">
              {visible.length} sản phẩm
            </p>
          </div>
          <label className="flex items-center gap-2 text-sm">
            <span className="text-muted-foreground">Sắp xếp</span>
            <select
              value={sort}
              onChange={(e) =>
                setParams({
                  sort: e.target.value === "featured" ? null : e.target.value,
                })
              }
              className="rounded-full border border-border bg-background px-3 py-1.5"
            >
              {SORT_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                </option>
              ))}
            </select>
          </label>
        </div>

        {visible.length === 0 ? (
          <div className="rounded-xl border border-dashed border-border py-16 text-center">
            <p className="text-muted-foreground">
              Không tìm thấy sản phẩm phù hợp với bộ lọc hiện tại.
            </p>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-2 gap-4 sm:gap-6 xl:grid-cols-3">
              {page.map((p, i) => (
                <ProductCard key={p.id} product={p} priority={i < 3} />
              ))}
            </div>
            {visible.length > limit && (
              <div className="mt-10 text-center">
                <button
                  type="button"
                  onClick={() =>
                    setShown({ key: filterKey, n: limit + PAGE_SIZE })
                  }
                  className="rounded-full border border-primary px-8 py-3 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
                >
                  Xem thêm ({visible.length - limit} sản phẩm)
                </button>
              </div>
            )}
          </>
        )}
      </section>
    </div>
    </>
  );
}
