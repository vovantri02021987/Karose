"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SafeImage from "./SafeImage";

const CYCLE_MS = 1400;

/** Chọn ngẫu nhiên 1 ảnh khác `current` trong `pool` (pool có ≥ 2 ảnh). */
function pickRandomOther(pool: string[], current: string): string {
  const others = pool.filter((src) => src !== current);
  return others[Math.floor(Math.random() * others.length)] ?? current;
}

/**
 * Khung ảnh thẻ sản phẩm (1:1). Rê chuột vào thẻ: ảnh đổi ngẫu nhiên giữa các
 * ảnh liên quan của sản phẩm (hiện mờ chuyển tiếp), đổi tiếp sau mỗi ~1,4 giây
 * khi chuột còn ở trên thẻ; rời chuột thì về ảnh chính. Sản phẩm chỉ có 1 ảnh
 * hoặc người dùng bật "giảm chuyển động" thì không đổi ảnh.
 */
export default function ProductCardMedia({
  href,
  images,
  alt,
  priority = false,
  children,
}: {
  href: string;
  images: string[];
  alt: string;
  priority?: boolean;
  children?: ReactNode;
}) {
  const pool = useMemo(() => Array.from(new Set(images.filter(Boolean))), [images]);
  const [hoverSrc, setHoverSrc] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const canSwap = pool.length > 1;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    setHoverSrc(null);
  };

  const start = () => {
    if (!canSwap) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    setHoverSrc((cur) => pickRandomOther(pool, cur ?? pool[0]));
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(() => {
      setHoverSrc((cur) => pickRandomOther(pool, cur ?? pool[0]));
    }, CYCLE_MS);
  };

  useEffect(
    () => () => {
      if (timer.current) clearInterval(timer.current);
    },
    [],
  );

  return (
    <Link
      href={href}
      className="relative block aspect-square overflow-hidden bg-surface"
      onMouseEnter={start}
      onMouseLeave={stop}
      onBlur={stop}
    >
      <SafeImage
        src={pool[0]}
        alt={alt}
        priority={priority}
        className="object-cover transition duration-500 group-hover:scale-[1.03]"
      />
      {hoverSrc && (
        <div key={hoverSrc} className="karose-fade-in absolute inset-0">
          <SafeImage
            src={hoverSrc}
            alt=""
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      {children}
    </Link>
  );
}
