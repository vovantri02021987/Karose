import { ArrowRight, Droplets, FlaskConical, Leaf } from "lucide-react";
import Link from "next/link";
import type { Metadata } from "next";
import SafeImage from "@/components/storefront/SafeImage";
import ProductCard from "@/components/storefront/ProductCard";
import RatingStars from "@/components/storefront/RatingStars";
import { SITE_NAME, getSiteOrigin, jsonLdString, pageMetadata } from "@/lib/seo";
import {
  getCatalogProducts,
  getCategorySummaries,
  getHomeReviews,
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

const HOME_TITLE = "KAROSE — Mỹ phẩm thiên nhiên";
const HOME_DESCRIPTION =
  "KAROSE — mỹ phẩm thiên nhiên và hữu cơ với thành phần INCI minh bạch, từ vườn thảo mộc đến từng giọt tinh chất.";

const homeSeo = pageMetadata({
  title: HOME_TITLE,
  description: HOME_DESCRIPTION,
  path: "/",
});

export const metadata: Metadata = {
  ...homeSeo,
  // Tiêu đề trang chủ là nguyên văn, không thêm hậu tố "| KAROSE".
  title: { absolute: HOME_TITLE },
  openGraph: { ...homeSeo.openGraph, title: HOME_TITLE },
  twitter: { ...homeSeo.twitter, title: HOME_TITLE },
};

const HOME_CATEGORY_SLUGS = [
  "cham-soc-da-mat",
  "cham-soc-co-the",
  "cham-soc-toc",
  "bo-san-pham-qua-tang",
];

export default async function HomePage() {
  const products = await getCatalogProducts();
  const [categories, reviews] = await Promise.all([
    getCategorySummaries(products),
    getHomeReviews(6),
  ]);

  // Thẻ danh mục chỉ hiện khi có ảnh thật của sản phẩm trong danh mục (không dùng placeholder).
  const homeCategories = HOME_CATEGORY_SLUGS.map((slug) =>
    categories.find((c) => c.slug === slug),
  ).filter(
    (c): c is NonNullable<typeof c> & { image: string } => Boolean(c?.image),
  );

  const featured = products.filter((p) => p.isFeatured).slice(0, 8);
  const featuredList = featured.length > 0 ? featured : products.slice(0, 8);
  const heroMain = featuredList[0];
  const heroSub = featuredList[1];
  const combo = products.find((p) => p.isCombo);

  const origin = await getSiteOrigin();
  // Chỉ dùng thông tin đã có: tên, logo, link gian hàng Shopee chính thức. Không bịa liên hệ/địa chỉ.
  const organizationJsonLd = {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE_NAME,
    url: origin,
    logo: `${origin}/images/logo-karose.jpg`,
    sameAs: ["https://shopee.vn/karose.01"],
  };
  // Ô tìm kiếm trên header dẫn tới /products?q=..., nên khai báo SearchAction là đúng thực tế.
  const websiteJsonLd = {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE_NAME,
    url: origin,
    inLanguage: "vi-VN",
    potentialAction: {
      "@type": "SearchAction",
      target: `${origin}/products?q={search_term_string}`,
      "query-input": "required name=search_term_string",
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(organizationJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: jsonLdString(websiteJsonLd) }}
      />
      {/* Hero */}
      <section data-surface="dark" className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-[96rem] items-center gap-10 px-4 py-20 sm:px-6 lg:px-8 md:grid-cols-2 md:py-28">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-primary-foreground/70">
              Mỹ phẩm thiên nhiên
            </p>
            <h1 className="type-hero mt-4">
              Thuần khiết
              <br />
              từ thiên nhiên
            </h1>
            <p className="mt-6 max-w-md leading-relaxed text-primary-foreground/80">
              KAROSE chắt lọc hoa hồng và thảo mộc thành những sản phẩm chăm
              sóc da, tóc, cơ thể nhẹ nhàng. Thành phần minh bạch, hướng dẫn
              dùng và bảo quản rõ ràng.
            </p>
            <div className="mt-8 flex flex-wrap gap-3">
              <Link
                href="/products"
                className="inline-flex items-center gap-2 rounded-full bg-background px-6 py-3 text-sm font-medium text-primary transition hover:bg-surface"
              >
                Khám phá sản phẩm <ArrowRight size={16} />
              </Link>
              {combo && (
                <Link
                  href={`/products/${combo.slug}`}
                  className="inline-flex items-center px-2 py-3 text-sm font-medium underline-offset-4 transition hover:underline"
                >
                  Xem {combo.name}
                </Link>
              )}
            </div>
          </div>
          {heroMain && (
            <div className="relative mx-auto hidden w-full max-w-md md:block">
              <Link
                href={`/products/${heroMain.slug}`}
                className="relative block aspect-square overflow-hidden rounded-[2rem] border border-primary-foreground/20 bg-background"
              >
                <SafeImage
                  src={heroMain.images[0]}
                  alt={heroMain.name}
                  sizes="(min-width: 768px) 28rem, 100vw"
                  priority
                  className="object-cover"
                />
              </Link>
              {heroSub && (
                <Link
                  href={`/products/${heroSub.slug}`}
                  className="absolute -bottom-6 -left-6 block h-36 w-36 overflow-hidden rounded-2xl border-4 border-primary bg-background shadow-lg"
                >
                  <span className="relative block h-full w-full">
                    <SafeImage
                      src={heroSub.images[0]}
                      alt={heroSub.name}
                      sizes="9rem"
                      className="object-cover"
                    />
                  </span>
                </Link>
              )}
              <p className="mt-4 text-right text-xs text-primary-foreground/70">
                {heroMain.name}
              </p>
            </div>
          )}
        </div>
      </section>

      {/* Danh mục */}
      {homeCategories.length > 0 && (
        <section className="mx-auto max-w-[96rem] px-4 pt-20 sm:px-6 lg:px-8">
          <h2 className="type-section text-center">
            Danh mục nổi bật
          </h2>
          <div
            className={`mt-10 grid grid-cols-2 gap-4 ${
              homeCategories.length === 3 ? "md:grid-cols-3" : "md:grid-cols-4"
            }`}
          >
            {homeCategories.map((c) => (
              <Link
                key={c.slug}
                href={`/products?category=${c.slug}`}
                className="group relative flex aspect-[4/3] flex-col justify-end overflow-hidden rounded-xl border border-border bg-surface p-5 text-primary-foreground transition hover:border-primary/50"
              >
                <SafeImage
                  src={c.image}
                  alt=""
                  sizes="(min-width: 768px) 25vw, 50vw"
                  className="object-cover transition duration-500 group-hover:scale-105"
                />
                {/* Gradient mận ở nửa dưới thẻ: chữ trắng luôn đạt tương phản ≥ 4.5:1 kể cả trên vùng ảnh sáng nhất. */}
                <span
                  className="absolute inset-x-0 bottom-0 h-[55%] bg-[linear-gradient(to_top,rgb(42_15_21/0.8)_0%,rgb(42_15_21/0.7)_80%,rgb(42_15_21/0)_100%)]"
                  aria-hidden="true"
                />
                <div className="relative">
                  <h3 className="type-card-editorial">{c.name}</h3>
                  <p className="mt-1 text-xs text-primary-foreground">
                    {c.count} sản phẩm
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sản phẩm nổi bật */}
      <section className="mx-auto max-w-[96rem] px-4 pt-24 sm:px-6 lg:px-8">
        <div className="flex items-end justify-between gap-4">
          <h2 className="type-section">
            Sản phẩm bán chạy
          </h2>
          <Link
            href="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        <div className="mt-10 grid grid-cols-2 gap-3 sm:gap-5 md:grid-cols-4 2xl:grid-cols-5">
          {featuredList.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* Câu chuyện thương hiệu */}
      <section className="mt-24 bg-surface">
        <div className="mx-auto max-w-[96rem] px-4 py-20 sm:px-6 lg:px-8">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-brand-accent">
              Farm to Bottle
            </p>
            <h2 className="type-section mt-3">
              Từ vườn thảo mộc đến từng giọt tinh chất
            </h2>
            <p className="mt-5 leading-relaxed text-muted-foreground">
              Chúng tôi chọn cách chế biến tôn trọng nguyên liệu: chưng cất và
              ép lạnh để giữ lại tối đa hoạt chất tự nhiên của cây cỏ, thay vì
              pha loãng bằng những thành phần không cần thiết.
            </p>
          </div>
          <div className="mt-12 grid gap-8 md:grid-cols-3">
            {[
              {
                icon: Droplets,
                title: "Chưng cất & ép lạnh",
                body: "Nước cất hoa hồng và các loại dầu được chế biến để giữ hương thơm và dưỡng chất tự nhiên của nguyên liệu.",
              },
              {
                icon: FlaskConical,
                title: "Minh bạch thành phần INCI",
                body: "Mỗi sản phẩm công khai bảng thành phần theo danh pháp INCI để bạn tự đọc và chọn lựa.",
              },
              {
                icon: Leaf,
                title: "Bảo quản đúng cách",
                body: "Sản phẩm thiên nhiên cần được cất giữ cẩn thận. Hướng dẫn bảo quản luôn được ghi rõ trên trang sản phẩm.",
              },
            ].map(({ icon: Icon, title, body }) => (
              <div key={title} className="text-center">
                <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-background text-primary">
                  <Icon size={22} />
                </span>
                <h3 className="type-card-editorial mt-4">
                  {title}
                </h3>
                <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                  {body}
                </p>
              </div>
            ))}
          </div>
          <p className="mt-10 text-center text-sm">
            <Link href="/journal" className="font-medium text-primary hover:underline">
              Đọc Journal: cách đọc bảng thành phần & bảo quản mỹ phẩm thiên nhiên →
            </Link>
          </p>
        </div>
      </section>

      {/* Đánh giá */}
      {reviews.length > 0 && (
        <section className="mx-auto max-w-[96rem] px-4 pt-24 sm:px-6 lg:px-8">
          <h2 className="type-section text-center">
            Khách hàng nói về KAROSE
          </h2>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {reviews.map((r) => (
              <figure
                key={r.id}
                className="flex flex-col rounded-xl border border-border bg-surface/60 p-6"
              >
                <RatingStars rating={r.rating} />
                <blockquote className="mt-4 flex-1 text-sm leading-relaxed">
                  “{r.comment}”
                </blockquote>
                <figcaption className="mt-5 text-sm">
                  <span className="font-semibold">{r.authorName}</span>
                  <Link
                    href={`/products/${r.productSlug}`}
                    className="block text-xs text-muted-foreground hover:text-primary"
                  >
                    {r.productName}
                  </Link>
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </>
  );
}
