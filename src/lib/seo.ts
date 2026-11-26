import type { Metadata } from "next";
import { headers } from "next/headers";

export const SITE_NAME = "KAROSE";
export const DEFAULT_OG_IMAGE = {
  url: "/images/og-default.jpg",
  width: 1200,
  height: 630,
  alt: "KAROSE — Mỹ phẩm thiên nhiên",
} as const;

/**
 * Gốc URL của website (không có "/" cuối).
 * Ưu tiên biến môi trường NEXT_PUBLIC_SITE_URL (domain production). Chưa đặt biến
 * này thì dùng host của request hiện tại, không hardcode domain nào.
 */
export async function getSiteOrigin(): Promise<string> {
  const fromEnv = process.env.NEXT_PUBLIC_SITE_URL?.trim().replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  if (!host) return "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

type PageSeo = {
  title: string;
  description: string;
  /** Đường dẫn chuẩn của trang, ví dụ "/products". */
  path: string;
  image?: { url: string; width: number; height: number; alt?: string };
};

/**
 * Metadata đầy đủ cho một trang: canonical + Open Graph + Twitter card.
 * Open Graph/Twitter của trang thay thế hoàn toàn của layout nên phải đủ trường.
 * `title` ở đây đã là tiêu đề cuối cùng của trang (không gồm hậu tố "| KAROSE").
 */
export function pageMetadata({
  title,
  description,
  path,
  image = DEFAULT_OG_IMAGE,
}: PageSeo): Metadata {
  // Tên sản phẩm đã có "KAROSE" thì không thêm hậu tố thương hiệu nữa (tránh "KAROSE | KAROSE").
  const hasBrand = title.toUpperCase().includes(SITE_NAME);
  const socialTitle = hasBrand ? title : `${title} | ${SITE_NAME}`;
  return {
    title: hasBrand ? { absolute: title } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "vi_VN",
      title: socialTitle,
      description,
      url: path,
      images: [image],
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description,
      images: [image.url],
    },
  };
}

type Crumb = { name: string; path: string };

/** JSON-LD BreadcrumbList; `origin` là gốc URL tuyệt đối. */
export function breadcrumbJsonLd(origin: string, crumbs: Crumb[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: crumbs.map((c, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: c.name,
      item: `${origin}${c.path}`,
    })),
  };
}

/** Chuỗi JSON an toàn để nhúng vào <script type="application/ld+json">. */
export function jsonLdString(data: unknown): string {
  return JSON.stringify(data).replace(/</g, "\\u003c");
}
