import type { Metadata } from "next";
import { notFound } from "next/navigation";
import ProductCard from "@/components/storefront/ProductCard";
import {
  breadcrumbJsonLd,
  getSiteOrigin,
  jsonLdString,
  pageMetadata,
} from "@/lib/seo";
import { getProductDetail, getRelatedProducts } from "@/lib/storefront";
import ProductDetailClient from "./ProductDetailClient";

export const dynamic = "force-dynamic";

type PageProps = { params: Promise<{ slug: string }> };

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProductDetail(slug);
  if (!product) return { title: "Không tìm thấy sản phẩm" };
  return pageMetadata({
    title: product.name,
    description: product.shortDescription,
    path: `/products/${product.slug}`,
    // Ảnh OG = ảnh chính của sản phẩm (ảnh chuẩn 1000x1000); chưa có ảnh thì dùng ảnh thương hiệu.
    ...(product.images[0]
      ? {
          image: {
            url: product.images[0],
            width: 1000,
            height: 1000,
            alt: product.name,
          },
        }
      : {}),
  });
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const [product, related, origin] = await Promise.all([
    getProductDetail(slug),
    getRelatedProducts(slug),
    getSiteOrigin(),
  ]);
  if (!product) notFound();

  const abs = (path: string) => (path.startsWith("http") ? path : `${origin}${path}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    ...(product.images.length > 0 ? { image: product.images.map(abs) } : {}),
    category: product.categoryName,
    brand: { "@type": "Brand", name: "KAROSE" },
    sku: product.variants[0]?.sku,
    url: abs(`/products/${product.slug}`),
    offers: product.variants.map((v) => ({
      "@type": "Offer",
      sku: v.sku,
      price: v.price,
      priceCurrency: "VND",
      availability:
        v.stock > 0
          ? "https://schema.org/InStock"
          : "https://schema.org/OutOfStock",
      url: abs(`/products/${product.slug}`),
    })),
    ...(product.ratingCount > 0
      ? {
          aggregateRating: {
            "@type": "AggregateRating",
            ratingValue: Number(product.ratingAverage.toFixed(1)),
            reviewCount: product.ratingCount,
          },
        }
      : {}),
  };

  const breadcrumb = breadcrumbJsonLd(origin, [
    { name: "Trang chủ", path: "/" },
    { name: "Sản phẩm", path: "/products" },
    { name: product.name, path: `/products/${product.slug}` },
  ]);

  return (
    <>
      {/* Dữ liệu do hệ thống tạo (không chứa HTML người dùng); jsonLdString thoát "<" để an toàn. */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(jsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(breadcrumb) }}
      />
      <ProductDetailClient product={product} />
      {related.length === 0 && (
        // Chừa chỗ cho thanh "Thêm vào giỏ hàng" cố định trên mobile.
        <div className="h-24 md:hidden" aria-hidden="true" />
      )}
      {related.length > 0 && (
        <section
          aria-labelledby="related-title"
          className="mx-auto max-w-[96rem] px-4 pb-28 sm:px-6 lg:px-8 md:pb-16"
        >
          <h2
            id="related-title"
            className="type-section"
          >
            Có thể bạn cũng thích
          </h2>
          <div className="mt-6 grid grid-cols-2 gap-4 md:grid-cols-4">
            {related.map((p) => (
              <ProductCard key={p.id} product={p} />
            ))}
          </div>
        </section>
      )}
    </>
  );
}
