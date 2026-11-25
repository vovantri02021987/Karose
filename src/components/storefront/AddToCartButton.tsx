"use client";

import { Check, ShoppingBag } from "lucide-react";
import { useEffect, useState } from "react";
import { useCartStore } from "@/store/useCartStore";
import type { CatalogProduct, CatalogVariant } from "@/types/product";

interface AddToCartButtonProps {
  product: Pick<
    CatalogProduct,
    "id" | "slug" | "name" | "images" | "isCombo"
  >;
  variant: CatalogVariant;
  quantity?: number;
  label?: string;
  className?: string;
}

export default function AddToCartButton({
  product,
  variant,
  quantity = 1,
  label = "Thêm vào giỏ",
  className,
}: AddToCartButtonProps) {
  const addItem = useCartStore((s) => s.addItem);
  const openCart = useCartStore((s) => s.openCart);
  const [justAdded, setJustAdded] = useState(false);

  useEffect(() => {
    if (!justAdded) return;
    const t = setTimeout(() => setJustAdded(false), 1500);
    return () => clearTimeout(t);
  }, [justAdded]);

  const soldOut = variant.stock <= 0;

  function handleClick() {
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
    setJustAdded(true);
    openCart();
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={soldOut}
      className={
        className ??
        "inline-flex w-full items-center justify-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:bg-border disabled:text-muted-foreground"
      }
    >
      {soldOut ? (
        "Hết hàng"
      ) : justAdded ? (
        <>
          <Check size={16} aria-hidden="true" /> Đã thêm
        </>
      ) : (
        <>
          <ShoppingBag size={16} aria-hidden="true" /> {label}
        </>
      )}
    </button>
  );
}
