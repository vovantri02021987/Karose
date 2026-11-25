"use client";

import { Minus, Plus, Trash2, Truck, X } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import {
  DEFAULT_DELIVERY_MAX_DAYS,
  DEFAULT_DELIVERY_MIN_DAYS,
  deliverySummaryText,
} from "@/lib/delivery";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import { formatVND } from "@/lib/format";
import {
  selectCartCount,
  selectCartSubtotal,
  useCartStore,
} from "@/store/useCartStore";
import CartHydrator from "./CartHydrator";
import SafeImage from "./SafeImage";

export default function SlideCart() {
  const isOpen = useCartStore((s) => s.isOpen);
  const closeCart = useCartStore((s) => s.closeCart);
  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const rawItems = useCartStore((s) => s.items);
  const rawCount = useCartStore(selectCartCount);
  const rawSubtotal = useCartStore(selectCartSubtotal);
  const updateQuantity = useCartStore((s) => s.updateQuantity);
  const removeItem = useCartStore((s) => s.removeItem);

  const items = hasHydrated ? rawItems : [];
  const count = hasHydrated ? rawCount : 0;
  const subtotal = hasHydrated ? rawSubtotal : 0;

  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") closeCart();
    };
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [isOpen, closeCart]);

  const remaining = Math.max(0, FREE_SHIPPING_THRESHOLD - subtotal);
  const progress = Math.min(100, (subtotal / FREE_SHIPPING_THRESHOLD) * 100);

  return (
    <>
      <CartHydrator />
      <div
        className={`fixed inset-0 z-50 bg-foreground/40 transition-opacity ${
          isOpen ? "opacity-100" : "pointer-events-none opacity-0"
        }`}
        onClick={closeCart}
        aria-hidden="true"
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label="Giỏ hàng"
        aria-hidden={!isOpen}
        className={`fixed right-0 top-0 z-50 flex h-full tabular-nums w-full max-w-md flex-col bg-background shadow-xl transition-transform duration-300 ${
          isOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="flex items-center justify-between border-b border-border px-5 py-4">
          <h2 className="type-card-editorial">
            Giỏ hàng{count > 0 ? ` (${count})` : ""}
          </h2>
          <button
            type="button"
            onClick={closeCart}
            aria-label="Đóng giỏ hàng"
            className="p-1"
          >
            <X size={22} />
          </button>
        </div>

        <div className="border-b border-border bg-surface px-5 py-4">
          <p className="text-sm">
            {subtotal >= FREE_SHIPPING_THRESHOLD ? (
              <span className="font-medium text-primary">
                Chúc mừng! Đơn hàng của bạn được miễn phí vận chuyển.
              </span>
            ) : (
              <>
                Mua thêm{" "}
                <span className="font-semibold text-brand-accent">
                  {formatVND(remaining)}
                </span>{" "}
                để được miễn phí vận chuyển.
              </>
            )}
          </p>
          <div
            className="mt-2 h-2 overflow-hidden rounded-full bg-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress)}
            aria-label="Tiến trình đến mức miễn phí vận chuyển"
          >
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-5">
          {items.length === 0 ? (
            <div className="flex h-full flex-col items-center justify-center gap-4 text-center">
              <p className="text-muted-foreground">Giỏ hàng đang trống.</p>
              <Link
                href="/products"
                onClick={closeCart}
                className="rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground"
              >
                Khám phá sản phẩm
              </Link>
            </div>
          ) : (
            <ul className="divide-y divide-border">
              {items.map((item) => (
                <li key={item.variantId} className="flex gap-4 py-4">
                  <Link
                    href={`/products/${item.slug}`}
                    onClick={closeCart}
                    className="relative h-20 w-20 shrink-0 overflow-hidden rounded-lg bg-surface"
                  >
                    <SafeImage
                      src={item.image}
                      alt={item.name}
                      sizes="80px"
                    />
                  </Link>
                  <div className="flex min-w-0 flex-1 flex-col">
                    <Link
                      href={`/products/${item.slug}`}
                      onClick={closeCart}
                      className="line-clamp-2 text-sm font-medium hover:text-primary"
                    >
                      {item.name}
                    </Link>
                    <p className="text-xs text-muted-foreground">
                      {item.variantName}
                    </p>
                    <div className="mt-auto flex items-center justify-between pt-2">
                      <div className="inline-flex items-center rounded-full border border-border">
                        <button
                          type="button"
                          aria-label="Giảm số lượng"
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity - 1)
                          }
                          className="p-1.5"
                        >
                          <Minus size={14} />
                        </button>
                        <span className="min-w-6 text-center text-sm">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          aria-label="Tăng số lượng"
                          disabled={item.quantity >= item.maxStock}
                          onClick={() =>
                            updateQuantity(item.variantId, item.quantity + 1)
                          }
                          className="p-1.5 disabled:opacity-30"
                        >
                          <Plus size={14} />
                        </button>
                      </div>
                      <p className="text-sm font-semibold text-primary">
                        {formatVND(item.price * item.quantity)}
                      </p>
                    </div>
                    {item.quantity >= item.maxStock && (
                      <p className="pt-1 text-xs text-brand-accent">
                        Đã đạt số lượng tối đa còn hàng
                      </p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => removeItem(item.variantId)}
                    aria-label={`Xoá ${item.name} khỏi giỏ hàng`}
                    className="self-start p-1 text-muted-foreground hover:text-destructive"
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {items.length > 0 && (
          <div className="border-t border-border bg-surface px-5 py-5">
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Tạm tính</span>
              <span className="text-lg font-semibold text-primary">
                {formatVND(subtotal)}
              </span>
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              Phí vận chuyển và mã giảm giá (kể cả mã theo từng sản phẩm) được tính ở bước thanh toán.
            </p>
            <p className="mt-2 flex items-start gap-2 text-xs text-muted-foreground">
              <Truck size={14} className="mt-0.5 shrink-0 text-primary" aria-hidden />
              <span>
                {deliverySummaryText(
                  items.map((i) => ({
                    minDays: i.deliveryMinDays ?? DEFAULT_DELIVERY_MIN_DAYS,
                    maxDays: i.deliveryMaxDays ?? DEFAULT_DELIVERY_MAX_DAYS,
                  })),
                )}
                . Khung giao chính xác theo tỉnh/thành bạn chọn ở bước thanh toán.
              </span>
            </p>
            <Link
              href="/checkout"
              onClick={closeCart}
              className="mt-4 flex w-full items-center justify-center rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground transition hover:bg-primary/90"
            >
              Tiến hành thanh toán
            </Link>
          </div>
        )}
      </aside>
    </>
  );
}
