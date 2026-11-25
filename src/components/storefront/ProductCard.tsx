import Link from "next/link";
import { formatVND } from "@/lib/format";
import type { CatalogProduct } from "@/types/product";
import AddToCartButton from "./AddToCartButton";
import SafeImage from "./SafeImage";

export function StockBadge({ stock }: { stock: number }) {
  if (stock <= 0) {
    return (
      <span className="text-xs font-medium text-destructive">Hết hàng</span>
    );
  }
  if (stock <= 5) {
    return (
      <span className="text-xs font-medium text-brand-accent">
        Chỉ còn {stock}
      </span>
    );
  }
  return <span className="text-xs text-muted-foreground">Còn hàng</span>;
}

export default function ProductCard({
  product,
  priority = false,
}: {
  product: CatalogProduct;
  priority?: boolean;
}) {
  const soldOut = product.stock <= 0;
  const hasManyVariants = product.variants.length > 1;
  const firstInStock = product.variants.find((v) => v.stock > 0);
  const hasRange =
    hasManyVariants &&
    product.variants.some((v) => v.price !== product.minPrice);

  return (
    <article className="group flex flex-col overflow-hidden rounded-xl border border-border bg-surface/60 transition hover:border-primary/40">
      <Link
        href={`/products/${product.slug}`}
        className="relative block aspect-square overflow-hidden bg-surface"
      >
        <SafeImage
          src={product.images[0]}
          alt={product.name}
          priority={priority}
          className="object-cover transition duration-500 group-hover:scale-[1.03]"
        />
        {soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-foreground/80 px-3 py-1 text-xs font-medium text-background">
            Hết hàng
          </span>
        )}
        {product.isCombo && !soldOut && (
          <span className="absolute left-3 top-3 rounded-full bg-primary px-3 py-1 text-xs font-medium text-primary-foreground">
            Combo
          </span>
        )}
      </Link>

      <div className="flex flex-1 flex-col gap-2 p-4">
        <p className="text-xs uppercase tracking-wider text-muted-foreground">
          {product.categoryName}
        </p>
        <h3 className="font-serif text-lg font-semibold leading-snug">
          <Link
            href={`/products/${product.slug}`}
            className="hover:text-primary"
          >
            {product.name}
          </Link>
        </h3>

        <div className="mt-auto flex items-baseline justify-between gap-2 pt-1">
          <p className="flex items-baseline gap-2">
            <span className="font-semibold text-primary">
              {hasRange ? "Từ " : ""}
              {formatVND(product.minPrice)}
            </span>
            {product.minCompareAtPrice &&
              product.minCompareAtPrice > product.minPrice && (
                <span className="text-sm text-muted-foreground line-through">
                  {formatVND(product.minCompareAtPrice)}
                </span>
              )}
          </p>
          <StockBadge stock={product.stock} />
        </div>

        <div className="pt-2">
          {hasManyVariants ? (
            <Link
              href={`/products/${product.slug}`}
              className="inline-flex w-full items-center justify-center rounded-full border border-primary px-5 py-2.5 text-sm font-medium text-primary transition hover:bg-primary hover:text-primary-foreground"
            >
              Chọn phân loại
            </Link>
          ) : firstInStock ? (
            <AddToCartButton product={product} variant={firstInStock} />
          ) : (
            <button
              type="button"
              disabled
              className="inline-flex w-full cursor-not-allowed items-center justify-center rounded-full bg-border px-5 py-2.5 text-sm font-medium text-muted-foreground"
            >
              Hết hàng
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
