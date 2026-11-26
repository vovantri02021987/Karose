"use client";

import Image from "next/image";
import { useEffect, useRef, useState } from "react";
import { PLACEHOLDER_IMAGE } from "@/lib/constants";

interface SafeImageProps {
  src: string | null | undefined;
  alt: string;
  sizes?: string;
  className?: string;
  priority?: boolean;
  fallbackSrc?: string;
}

/**
 * Ảnh vuông 1:1 (fill) với ảnh dự phòng khi ảnh chưa có hoặc đường dẫn lỗi.
 * Cha phải có `relative` và kích thước (vd: `aspect-square`).
 */
export default function SafeImage({
  src,
  alt,
  sizes = "(min-width: 1536px) 18vw, (min-width: 768px) 25vw, 50vw",
  className,
  priority = false,
  fallbackSrc = PLACEHOLDER_IMAGE,
}: SafeImageProps) {
  const wanted = src || fallbackSrc;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Ảnh có thể đã lỗi trước khi React gắn onError (SSR) -> kiểm tra lại sau hydrate.
  useEffect(() => {
    const img = imgRef.current;
    if (img && img.complete && img.naturalWidth === 0) {
      setFailedSrc(wanted);
    }
  }, [wanted]);

  const finalSrc = failedSrc === wanted ? fallbackSrc : wanted;

  return (
    <Image
      ref={imgRef}
      src={finalSrc}
      alt={alt}
      fill
      sizes={sizes}
      priority={priority}
      className={className ?? "object-cover"}
      onError={() => setFailedSrc(wanted)}
    />
  );
}
