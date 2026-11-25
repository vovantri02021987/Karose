"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import SafeImage from "./SafeImage";

const CYCLE_MS = 10000;

/** Xáo trộn ngẫu nhiên (Fisher–Yates) trên bản sao của mảng. */
function shuffle(items: string[]): string[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Khung ảnh thẻ sản phẩm (1:1). Rê chuột vào thẻ: ảnh đổi ngẫu nhiên giữa các
 * ảnh liên quan của sản phẩm (hiện mờ chuyển tiếp), đổi tiếp sau mỗi ~10 giây
 * khi chuột còn ở trên thẻ; rời chuột thì về ảnh chính. Sản phẩm chỉ có 1 ảnh
 * thì không đổi. Hiệu ứng mờ chậm 3 giây (kể cả khi bật "giảm chuyển động").
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
  // `cur` là ảnh đang hiện mờ lên; `prev` là ảnh nằm bên dưới (ảnh trước đó).
  const [shown, setShown] = useState<{ prev: string | null; cur: string | null }>({
    prev: null,
    cur: null,
  });
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  const queue = useRef<string[]>([]);
  const canSwap = pool.length > 1;

  const stop = () => {
    if (timer.current) clearInterval(timer.current);
    timer.current = null;
    queue.current = [];
    setShown({ prev: null, cur: null });
  };

  /** Mọi lần chuyển (1→2, 2→3, 3→4...) dùng chung một cách: ảnh mới mờ dần đè lên ảnh trước. */
  const advance = () => {
    setShown((s) => {
      const current = s.cur ?? pool[0];
      if (queue.current.length === 0) {
        // Đi hết lượt các ảnh khác (thứ tự ngẫu nhiên) rồi mới lặp lại.
        queue.current = shuffle(pool.filter((src) => src !== current));
      }
      const next = queue.current.shift() ?? current;
      return { prev: current, cur: next };
    });
  };

  const start = () => {
    if (!canSwap) return;
    advance();
    if (timer.current) clearInterval(timer.current);
    timer.current = setInterval(advance, CYCLE_MS);
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
      {shown.prev && shown.prev !== pool[0] && (
        <div key={`prev-${shown.prev}`} className="absolute inset-0">
          <SafeImage
            src={shown.prev}
            alt=""
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      {shown.cur && (
        <div key={`cur-${shown.cur}-${shown.prev}`} className="karose-fade-in absolute inset-0">
          <SafeImage
            src={shown.cur}
            alt=""
            priority
            className="object-cover transition duration-500 group-hover:scale-[1.03]"
          />
        </div>
      )}
      {children}
    </Link>
  );
}
