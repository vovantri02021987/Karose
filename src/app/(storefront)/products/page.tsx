import type { Metadata } from "next";
import { Suspense } from "react";
import { getCatalogProducts, getCategorySummaries } from "@/lib/storefront";
import ProductCatalogClient from "./ProductCatalogClient";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sản phẩm",
  description:
    "Toàn bộ sản phẩm mỹ phẩm thiên nhiên KAROSE. Lọc theo danh mục, loại da và công dụng.",
};

export default async function ProductsPage() {
  const products = await getCatalogProducts();
  const categories = await getCategorySummaries(products);

  return (
    <div className="mx-auto max-w-[96rem] px-4 py-12 sm:px-6 lg:px-8">
      <h1 className="type-page-title">Sản phẩm</h1>
      <p className="mt-2 text-muted-foreground">
        Chọn theo danh mục, loại da hoặc công dụng bạn quan tâm.
      </p>
      <Suspense
        fallback={
          <p className="py-16 text-center text-muted-foreground">
            Đang tải sản phẩm…
          </p>
        }
      >
        <ProductCatalogClient products={products} categories={categories} />
      </Suspense>
    </div>
  );
}
