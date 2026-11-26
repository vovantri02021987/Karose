/**
 * Loader cho next/image trên Cloudflare Workers (không có bộ tối ưu ảnh runtime).
 * Ảnh sản phẩm /images/products/<tên>.jpg có sẵn bản WebP 400/800/1000px trong
 * /images/products/w/ (tạo bằng scripts/make-webp.mjs). Ảnh khác giữ nguyên đường dẫn.
 */
export default function imageLoader({
  src,
  width,
}: {
  src: string;
  width: number;
  quality?: number;
}): string {
  const m = src.match(/^\/images\/products\/([^/]+)\.jpe?g$/i);
  if (!m) return src;
  const w = width <= 400 ? 400 : width <= 800 ? 800 : 1000;
  return `/images/products/w/${m[1]}-${w}.webp`;
}
