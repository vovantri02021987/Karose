"use client";

import { Check, Minus, PackageSearch, Plus, ShieldCheck, Wallet } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import AddToCartButton from "@/components/storefront/AddToCartButton";
import RatingStars from "@/components/storefront/RatingStars";
import RichText from "@/components/storefront/RichText";
import SafeImage from "@/components/storefront/SafeImage";
import { StockBadge } from "@/components/storefront/ProductCard";
import { PENDING_TEXT } from "@/lib/constants";
import { formatVND } from "@/lib/format";
import { useCartStore } from "@/store/useCartStore";
import { benefitLabel, skinTypeLabel, type ProductDetail } from "@/types/product";
import ReviewForm from "./ReviewForm";

type TabKey = "overview" | "inci" | "usage" | "reviews";

export default function ProductDetailClient({
  product,
}: {
  product: ProductDetail;
}) {
  const router = useRouter();
  const addItem = useCartStore((s) => s.addItem);

  const initialVariant =
    product.variants.find((v) => v.stock > 0) ?? product.variants[0];
  const [variantId, setVariantId] = useState(initialVariant?.id ?? "");
  const [quantity, setQuantity] = useState(1);
  const [imageIndex, setImageIndex] = useState(0);
  const [tab, setTab] = useState<TabKey>("overview");

  const variant =
    product.variants.find((v) => v.id === variantId) ?? initialVariant;
  const images = product.images.length > 0 ? product.images : [null];
  const soldOut = !variant || variant.stock <= 0;
  const maxQty = variant ? Math.max(1, variant.stock) : 1;

  function chooseVariant(id: string) {
    setVariantId(id);
    setQuantity(1);
  }

  function buyNow() {
    if (!variant || soldOut) return;
    addItem(
      {
        variantId: variant.id,
        productId: product.id,
        slug: product.slug,
        name: product.name,
        variantName: variant.name,
        sku: variant.sku,
        price: variant.price,
        compareAtPrice: variant.compareAtPrice,
        image: product.images[0] ?? null,
        maxStock: variant.stock,
        isCombo: product.isCombo,
      },
      quantity,
    );
    router.push("/checkout");
  }

  const hasText = (t: string | null | undefined): t is string =>
    Boolean(t && t.trim() && t.trim() !== PENDING_TEXT);
  const mainIngredients = hasText(product.ingredientsInci)
    ? product.ingredientsInci.replace(/\s+/g, " ").trim().slice(0, 110) +
      (product.ingredientsInci.length > 110 ? "…" : "")
    : null;
  const expiryIso = variant ? product.expiryByVariant[variant.id] : undefined;
  const expiry = expiryIso
    ? new Date(expiryIso).toLocaleDateString("vi-VN", {
        timeZone: "Asia/Ho_Chi_Minh",
      })
    : null;
  function showIngredients() {
    setTab("inci");
    document
      .getElementById("tab-inci")
      ?.scrollIntoView({ behavior: "smooth", block: "center" });
  }

  // Mô tả đã có mục "Công dụng nổi bật" thì không lặp lại danh sách thẻ công dụng.
  const showBenefitTags =
    product.benefits.length > 0 &&
    !product.description.includes("Công dụng nổi bật");
  const hasSide = product.skinTypes.length > 0 || showBenefitTags;

  const tabs: { key: TabKey; label: string }[] = [
    { key: "overview", label: "Mô tả & Công dụng" },
    { key: "inci", label: "Thành phần (INCI)" },
    { key: "usage", label: "Sử dụng & Bảo quản" },
    { key: "reviews", label: `Đánh giá (${product.ratingCount})` },
  ];

  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
      <nav
        aria-label="Đường dẫn"
        className="mb-8 text-sm text-muted-foreground"
      >
        <Link href="/" className="hover:text-primary">
          Trang chủ
        </Link>{" "}
        /{" "}
        <Link href="/products" className="hover:text-primary">
          Sản phẩm
        </Link>{" "}
        /{" "}
        <Link
          href={`/products?category=${product.categorySlug}`}
          className="hover:text-primary"
        >
          {product.categoryName}
        </Link>
      </nav>

      <div className="grid gap-10 md:grid-cols-2">
        {/* Thư viện ảnh */}
        <div>
          <div className="relative aspect-square overflow-hidden rounded-xl border border-border bg-surface">
            <SafeImage
              key={images[imageIndex] ?? "placeholder"}
              src={images[imageIndex]}
              alt={imageIndex > 0 ? `${product.name} – ảnh ${imageIndex + 1}` : product.name}
              priority
              sizes="(min-width: 768px) 50vw, 100vw"
            />
          </div>
          {images.length > 1 && (
            <ul className="mt-3 grid grid-cols-5 gap-2">
              {images.map((img, i) => (
                <li key={`${img}-${i}`}>
                  <button
                    type="button"
                    onClick={() => setImageIndex(i)}
                    aria-label={`Xem ảnh ${i + 1}`}
                    aria-current={i === imageIndex}
                    className={`relative block aspect-square w-full overflow-hidden rounded-lg border bg-surface ${
                      i === imageIndex ? "border-primary" : "border-border"
                    }`}
                  >
                    <SafeImage
                      src={img}
                      alt={`${product.name} – ảnh ${i + 1}`}
                      sizes="100px"
                    />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {/* Thông tin mua hàng */}
        <div>
          <p className="text-xs uppercase tracking-wider text-muted-foreground">
            {product.categoryName}
            {product.isCombo ? " · Combo" : ""}
          </p>
          <h1 className="mt-2 font-serif text-3xl font-semibold leading-tight md:text-4xl">
            {product.name}
          </h1>
          {product.ratingCount > 0 && (
            <p className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <RatingStars rating={product.ratingAverage} />
              {product.ratingAverage.toFixed(1)} ({product.ratingCount} đánh giá)
            </p>
          )}
          <p className="mt-4 leading-relaxed text-muted-foreground">
            {product.shortDescription}
          </p>

          {variant && (
            <p className="mt-6 flex items-baseline gap-3">
              <span className="text-3xl font-semibold text-primary">
                {formatVND(variant.price)}
              </span>
              {variant.compareAtPrice &&
                variant.compareAtPrice > variant.price && (
                  <span className="text-lg text-muted-foreground line-through">
                    {formatVND(variant.compareAtPrice)}
                  </span>
                )}
            </p>
          )}

          {variant && (
            <dl className="mt-5 grid grid-cols-[auto_1fr] gap-x-6 gap-y-2 rounded-lg border border-border bg-surface/60 p-4 text-sm">
              <dt className="text-muted-foreground">Dung tích / Quy cách</dt>
              <dd className="font-medium">{variant.name}</dd>
              {mainIngredients && (
                <>
                  <dt className="text-muted-foreground">Thành phần chính</dt>
                  <dd>
                    {mainIngredients}{" "}
                    <button
                      type="button"
                      onClick={showIngredients}
                      className="text-primary underline"
                    >
                      Xem đầy đủ
                    </button>
                  </dd>
                </>
              )}
              {expiry && (
                <>
                  <dt className="text-muted-foreground">Hạn dùng (lô gần nhất)</dt>
                  <dd>{expiry}</dd>
                </>
              )}
              <dt className="text-muted-foreground">Mã SKU</dt>
              <dd>{variant.sku}</dd>
              <dt className="text-muted-foreground">Tình trạng</dt>
              <dd>
                <StockBadge stock={variant.stock} />
              </dd>
            </dl>
          )}

          {product.variants.length > 1 && (
            <fieldset className="mt-6">
              <legend className="mb-2 text-sm font-semibold">
                Phân loại / Dung tích
              </legend>
              <div className="flex flex-wrap gap-2">
                {product.variants.map((v) => (
                  <button
                    key={v.id}
                    type="button"
                    onClick={() => chooseVariant(v.id)}
                    aria-pressed={v.id === variantId}
                    className={`rounded-full border px-4 py-2 text-sm transition ${
                      v.id === variantId
                        ? "border-primary bg-primary text-primary-foreground"
                        : "border-border hover:border-primary"
                    }`}
                  >
                    {v.name}
                    {v.stock <= 0 ? " (Hết hàng)" : ""}
                  </button>
                ))}
              </div>
            </fieldset>
          )}

          <div className="mt-8 flex flex-wrap items-center gap-4">
            <div className="inline-flex items-center rounded-full border border-border">
              <button
                type="button"
                aria-label="Giảm số lượng"
                disabled={quantity <= 1}
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="p-3 disabled:opacity-30"
              >
                <Minus size={16} />
              </button>
              <span className="min-w-10 text-center" aria-live="polite">
                {quantity}
              </span>
              <button
                type="button"
                aria-label="Tăng số lượng"
                disabled={soldOut || quantity >= maxQty}
                onClick={() => setQuantity((q) => Math.min(maxQty, q + 1))}
                className="p-3 disabled:opacity-30"
              >
                <Plus size={16} />
              </button>
            </div>
            {variant && (
              <div className="w-full min-w-48 flex-1 sm:w-auto">
                <AddToCartButton
                  product={product}
                  variant={variant}
                  quantity={quantity}
                  label="Thêm vào giỏ hàng"
                />
              </div>
            )}
          </div>
          <button
            type="button"
            onClick={buyNow}
            disabled={soldOut}
            className="mt-3 inline-flex w-full items-center justify-center rounded-full border border-primary px-6 py-2.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground disabled:cursor-not-allowed disabled:border-border disabled:text-muted-foreground disabled:hover:bg-transparent"
          >
            Mua ngay
          </button>

          <ul className="mt-6 space-y-2.5 text-sm text-muted-foreground">
            <li className="flex items-center gap-2.5">
              <Wallet size={16} className="shrink-0 text-primary" aria-hidden />
              Thanh toán khi nhận hàng (COD) hoặc chuyển khoản VietQR
            </li>
            <li className="flex items-center gap-2.5">
              <ShieldCheck size={16} className="shrink-0 text-primary" aria-hidden />
              <span>
                Chỉ bán hàng còn hạn dùng trên 30 ngày ·{" "}
                <Link href="/chinh-sach-doi-tra" className="text-primary underline">
                  Chính sách đổi trả
                </Link>
              </span>
            </li>
            <li className="flex items-center gap-2.5">
              <PackageSearch size={16} className="shrink-0 text-primary" aria-hidden />
              <span>
                Theo dõi đơn bằng mã đơn tại{" "}
                <Link href="/tracking" className="text-primary underline">
                  Tra cứu đơn hàng
                </Link>
              </span>
            </li>
          </ul>
        </div>
      </div>

      {/* Tabs */}
      <div className="mt-16">
        <div
          role="tablist"
          aria-label="Thông tin sản phẩm"
          className="flex gap-1 overflow-x-auto border-b border-border"
        >
          {tabs.map((t) => (
            <button
              key={t.key}
              role="tab"
              type="button"
              id={`tab-${t.key}`}
              aria-selected={tab === t.key}
              aria-controls={`panel-${t.key}`}
              onClick={() => setTab(t.key)}
              className={`whitespace-nowrap border-b-2 px-4 py-3 text-sm font-medium transition ${
                tab === t.key
                  ? "border-primary text-primary"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div
          role="tabpanel"
          id={`panel-${tab}`}
          aria-labelledby={`tab-${tab}`}
          className="py-8"
        >
          {tab === "overview" && (
            <div
              className={`grid gap-10 ${hasSide ? "md:grid-cols-[2fr_1fr]" : ""}`}
            >
              <div>
                <RichText text={product.description} />
                {product.isCombo && product.comboComponents.length > 0 && (
                  <div className="mt-8">
                    <h2 className="font-serif text-2xl font-semibold">
                      Sản phẩm trong bộ
                    </h2>
                    <ul className="mt-4 space-y-3">
                      {product.comboComponents.map((c) => (
                        <li
                          key={c.variantId}
                          className="flex items-center gap-4 rounded-lg border border-border bg-surface/60 p-3"
                        >
                          <span className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-surface">
                            <SafeImage
                              src={c.image}
                              alt={c.productName}
                              sizes="56px"
                            />
                          </span>
                          <div className="min-w-0 flex-1">
                            <Link
                              href={`/products/${c.productSlug}`}
                              className="font-medium hover:text-primary"
                            >
                              {c.productName}
                            </Link>
                            <p className="text-xs text-muted-foreground">
                              {c.variantName}
                            </p>
                          </div>
                          <span className="text-sm text-muted-foreground">
                            × {c.quantity}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {hasSide && (
              <div className="space-y-6 text-sm">
                {product.skinTypes.length > 0 && (
                <div>
                  <h2 className="mb-2 font-semibold">Loại da phù hợp</h2>
                  <ul className="flex flex-wrap gap-2">
                      {product.skinTypes.map((s) => (
                        <li
                          key={s}
                          className="rounded-full bg-surface px-3 py-1"
                        >
                          {skinTypeLabel(s)}
                        </li>
                      ))}
                  </ul>
                </div>
                )}
                {showBenefitTags && (
                <div>
                  <h2 className="mb-2 font-semibold">Công dụng</h2>
                    <ul className="space-y-1.5">
                      {product.benefits.map((b) => (
                        <li key={b} className="flex items-center gap-2">
                          <Check size={14} className="text-primary" />
                          {benefitLabel(b)}
                        </li>
                      ))}
                    </ul>
                </div>
                )}
              </div>
              )}
            </div>
          )}

          {tab === "inci" && (
            <div className="max-w-2xl">
              <h2 className="font-serif text-2xl font-semibold">
                Bảng thành phần (INCI)
              </h2>
              <p className="mt-4 whitespace-pre-line rounded-lg border border-border bg-surface/60 p-5 leading-relaxed">
                {product.ingredientsInci}
              </p>
              <p className="mt-3 text-sm text-muted-foreground">
                Nếu da bạn có tiền sử dị ứng, hãy thử một vùng da nhỏ trước khi
                dùng.{" "}
                <Link href="/journal#doc-inci" className="text-primary underline">
                  Cách đọc bảng thành phần INCI
                </Link>
              </p>
            </div>
          )}

          {tab === "usage" && (
            <div className="grid max-w-3xl gap-8 md:grid-cols-2">
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  Hướng dẫn sử dụng
                </h2>
                <div className="mt-3">
                  <RichText text={product.usageGuide} />
                </div>
              </div>
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  Bảo quản
                </h2>
                <div className="mt-3">
                  <RichText text={product.storageGuide ?? PENDING_TEXT} />
                </div>
                <p className="mt-3 text-sm text-muted-foreground">
                  Mỹ phẩm thiên nhiên cần được cất giữ cẩn thận.{" "}
                  <Link href="/journal#bao-quan" className="text-primary underline">
                    Xem hướng dẫn bảo quản chung
                  </Link>
                </p>
              </div>
            </div>
          )}

          {tab === "reviews" && (
            <div className="grid gap-12 md:grid-cols-[3fr_2fr]">
              <div>
                <h2 className="font-serif text-2xl font-semibold">
                  Đánh giá từ khách hàng
                </h2>
                {product.reviews.length === 0 ? (
                  <p className="mt-4 text-muted-foreground">
                    Chưa có đánh giá nào. Hãy là người đầu tiên chia sẻ cảm nhận.
                  </p>
                ) : (
                  <ul className="mt-5 divide-y divide-border">
                    {product.reviews.map((r) => (
                      <li key={r.id} className="py-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="font-medium">{r.authorName}</p>
                          <time
                            dateTime={r.createdAt}
                            className="text-xs text-muted-foreground"
                          >
                            {new Date(r.createdAt).toLocaleDateString("vi-VN", {
                              timeZone: "Asia/Ho_Chi_Minh",
                            })}
                          </time>
                        </div>
                        <div className="mt-1">
                          <RatingStars rating={r.rating} size={14} />
                        </div>
                        <p className="mt-2 text-sm leading-relaxed">
                          {r.comment}
                        </p>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <ReviewForm productId={product.id} />
            </div>
          )}
        </div>
      </div>

      {variant && (
        <div className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-background/95 px-4 py-3 backdrop-blur md:hidden">
          <div className="mx-auto flex max-w-6xl items-center gap-4">
            <p className="text-xl font-semibold text-primary">
              {formatVND(variant.price)}
            </p>
            <div className="flex-1">
              <AddToCartButton
                product={product}
                variant={variant}
                quantity={quantity}
                label="Thêm vào giỏ hàng"
              />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
