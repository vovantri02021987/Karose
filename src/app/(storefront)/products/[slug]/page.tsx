import type { Metadata } from "next";
import { headers } from "next/headers";
import { notFound } from "next/navigation";
import ProductCard from "@/components/storefront/ProductCard";
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
  return {
    title: product.name,
    description: product.shortDescription,
  };
}

export default async function ProductPage({ params }: PageProps) {
  const { slug } = await params;
  const [product, related, h] = await Promise.all([
    getProductDetail(slug),
    getRelatedProducts(slug),
    headers(),
  ]);
  if (!product) notFound();

  const host = h.get("x-forwarded-host") ?? h.get("host") ?? "";
  const proto = h.get("x-forwarded-proto") ?? "https";
  const origin = host ? `${proto}://${host}` : "";
  const abs = (path: string) => (path.startsWith("http") ? path : `${origin}${path}`);

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.shortDescription,
    image: product.images.map(abs),
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

  return (
    <>
      <script
        type="application/ld+json"
        // Dữ liệu do hệ thống tạo (không chứa HTML người dùng); thoát "<" để an toàn.
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(jsonLd).replace(/</g, "\\u003c"),
        }}
      />
      <ProductDetailClient product={product} />
      {related.length > 0 && (
        <section
          aria-labelledby="related-title"
          className="mx-auto max-w-6xl px-4 pb-28 sm:px-6 md:pb-16"
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
