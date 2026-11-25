import { ArrowRight, Droplets, FlaskConical, Leaf } from "lucide-react";
import Link from "next/link";
import ProductCard from "@/components/storefront/ProductCard";
import RatingStars from "@/components/storefront/RatingStars";
import {
  getCatalogProducts,
  getCategorySummaries,
  getHomeReviews,
} from "@/lib/storefront";

export const dynamic = "force-dynamic";

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

  const homeCategories = HOME_CATEGORY_SLUGS.map((slug) =>
    categories.find((c) => c.slug === slug),
  ).filter((c): c is NonNullable<typeof c> => Boolean(c));

  const featured = products.filter((p) => p.isFeatured).slice(0, 4);
  const featuredList = featured.length > 0 ? featured : products.slice(0, 4);
  const combo = products.find((p) => p.isCombo);

  return (
    <>
      {/* Hero */}
      <section className="bg-primary text-primary-foreground">
        <div className="mx-auto grid max-w-6xl items-center gap-10 px-4 py-20 sm:px-6 md:grid-cols-2 md:py-28">
          <div>
            <p className="text-sm uppercase tracking-[0.25em] text-primary-foreground/70">
              Mỹ phẩm thiên nhiên
            </p>
            <h1 className="mt-4 font-serif text-5xl font-semibold leading-tight md:text-6xl">
              Thuần khiết
              <br />
              từ thiên nhiên
            </h1>
            <p className="mt-6 max-w-md leading-relaxed text-primary-foreground/80">
              KaRose chắt lọc hoa hồng và thảo mộc thành những sản phẩm chăm
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
                  className="inline-flex items-center rounded-full border border-primary-foreground/50 px-6 py-3 text-sm font-medium transition hover:bg-primary-foreground/10"
                >
                  Xem {combo.name}
                </Link>
              )}
            </div>
          </div>
          <div
            className="relative hidden aspect-square rounded-full border border-primary-foreground/20 md:block"
            aria-hidden="true"
          >
            <div className="absolute inset-8 rounded-full border border-primary-foreground/20" />
            <div className="absolute inset-16 flex items-center justify-center rounded-full bg-background/10">
              <Leaf size={96} strokeWidth={1} className="opacity-80" />
            </div>
          </div>
        </div>
      </section>

      {/* Danh mục */}
      {homeCategories.length > 0 && (
        <section className="mx-auto max-w-6xl px-4 pt-20 sm:px-6">
          <h2 className="text-center font-serif text-3xl font-semibold md:text-4xl">
            Danh mục nổi bật
          </h2>
          <div className="mt-10 grid grid-cols-2 gap-4 md:grid-cols-4">
            {homeCategories.map((c) => (
              <Link
                key={c.slug}
                href={`/products?category=${c.slug}`}
                className="group flex aspect-[4/3] flex-col justify-end rounded-xl border border-border bg-surface p-5 transition hover:border-primary/50 hover:bg-primary hover:text-primary-foreground"
              >
                <h3 className="font-serif text-xl font-semibold">{c.name}</h3>
                <p className="mt-1 text-xs text-muted-foreground group-hover:text-primary-foreground/80">
                  {c.count} sản phẩm
                </p>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Sản phẩm nổi bật */}
      <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
        <div className="flex items-end justify-between gap-4">
          <h2 className="font-serif text-3xl font-semibold md:text-4xl">
            Sản phẩm nổi bật
          </h2>
          <Link
            href="/products"
            className="text-sm font-medium text-primary hover:underline"
          >
            Xem tất cả
          </Link>
        </div>
        <div className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {featuredList.map((p, i) => (
            <ProductCard key={p.id} product={p} priority={i < 2} />
          ))}
        </div>
      </section>

      {/* Câu chuyện thương hiệu */}
      <section className="mt-24 bg-surface">
        <div className="mx-auto max-w-6xl px-4 py-20 sm:px-6">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm uppercase tracking-[0.25em] text-brand-accent">
              Farm to Bottle
            </p>
            <h2 className="mt-3 font-serif text-3xl font-semibold md:text-4xl">
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
                <h3 className="mt-4 font-serif text-xl font-semibold">
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
        <section className="mx-auto max-w-6xl px-4 pt-24 sm:px-6">
          <h2 className="text-center font-serif text-3xl font-semibold md:text-4xl">
            Khách hàng nói về KaRose
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
