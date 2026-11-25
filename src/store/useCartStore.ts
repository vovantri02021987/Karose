"use client";

import { create } from "zustand";
import { createJSONStorage, persist } from "zustand/middleware";
import type { CartItem } from "@/types/product";

/**
 * Giỏ hàng lưu trong localStorage (khoá `karose-cart-v1`).
 * `skipHydration: true` để lần render đầu ở Client khớp với Server (giỏ rỗng),
 * sau đó <CartHydrator /> gọi `persist.rehydrate()` trong useEffect.
 * Đọc dữ liệu giỏ trong UI qua cờ `hasHydrated` để tránh hydration mismatch.
 */

export type NewCartItem = Omit<CartItem, "quantity">;

interface CartState {
  items: CartItem[];
  isOpen: boolean;
  hasHydrated: boolean;
  addItem: (item: NewCartItem, quantity?: number) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  openCart: () => void;
  closeCart: () => void;
}

function clampQuantity(quantity: number, maxStock: number): number {
  return Math.max(0, Math.min(Math.floor(quantity), Math.max(0, maxStock)));
}

export const useCartStore = create<CartState>()(
  persist(
    (set) => ({
      items: [],
      isOpen: false,
      hasHydrated: false,

      addItem: (item, quantity = 1) =>
        set((state) => {
          if (item.maxStock <= 0 || quantity <= 0) return state;
          const existing = state.items.find(
            (i) => i.variantId === item.variantId,
          );
          if (existing) {
            return {
              items: state.items.map((i) =>
                i.variantId === item.variantId
                  ? {
                      ...i,
                      ...item,
                      quantity: clampQuantity(
                        i.quantity + quantity,
                        item.maxStock,
                      ),
                    }
                  : i,
              ),
            };
          }
          return {
            items: [
              ...state.items,
              { ...item, quantity: clampQuantity(quantity, item.maxStock) },
            ],
          };
        }),

      removeItem: (variantId) =>
        set((state) => ({
          items: state.items.filter((i) => i.variantId !== variantId),
        })),

      updateQuantity: (variantId, quantity) =>
        set((state) => ({
          items: state.items
            .map((i) =>
              i.variantId === variantId
                ? { ...i, quantity: clampQuantity(quantity, i.maxStock) }
                : i,
            )
            .filter((i) => i.quantity > 0),
        })),

      clearCart: () => set({ items: [] }),
      openCart: () => set({ isOpen: true }),
      closeCart: () => set({ isOpen: false }),
    }),
    {
      name: "karose-cart-v1",
      storage: createJSONStorage(() => localStorage),
      skipHydration: true,
      partialize: (state) => ({ items: state.items }),
      onRehydrateStorage: () => () => {
        useCartStore.setState({ hasHydrated: true });
      },
    },
  ),
);

export const selectCartCount = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.quantity, 0);

export const selectCartSubtotal = (state: CartState): number =>
  state.items.reduce((sum, i) => sum + i.price * i.quantity, 0);
