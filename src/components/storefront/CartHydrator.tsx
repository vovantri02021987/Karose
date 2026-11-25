"use client";

import { useEffect } from "react";
import { useCartStore } from "@/store/useCartStore";

/** Nạp giỏ hàng từ localStorage sau khi hydrate (tránh mismatch Server/Client). */
export default function CartHydrator() {
  useEffect(() => {
    void useCartStore.persist.rehydrate();
  }, []);
  return null;
}
