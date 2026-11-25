import { prisma } from "@/lib/prisma";
import { sellableExpiryCutoff } from "@/lib/format";
import { getSellableStockForVariants } from "@/lib/fefo";
import { normalizeText } from "@/lib/text";
import type {
  CatalogProduct,
  CategorySummary,
  ComboComponent,
  HomeReview,
  ProductDetail,
  PublicReview,
} from "@/types/product";

/**
 * Truy vấn dữ liệu storefront (chỉ dùng trong Server Component / route handler).
 * Tồn kho luôn theo FEFO: lô còn hạn > 30 ngày và availableQuantity > 0.
 */

interface ComboLink {
  childVariantId: string;
  quantity: number;
}

function comboStock(links: ComboLink[], stockMap: Map<string, number>): number {
  if (links.length === 0) return 0;
  let min = Number.POSITIVE_INFINITY;
  for (const l of links) {
    const per = Math.floor(
      (stockMap.get(l.childVariantId) ?? 0) / Math.max(1, l.quantity),
    );
    if (per < min) min = per;
  }
  return Number.isFinite(min) ? min : 0;
}

export async function getCatalogProducts(): Promise<CatalogProduct[]> {
  const products = await prisma.product.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "asc" }],
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: { orderBy: { price: "asc" } },
      comboItems: { select: { childVariantId: true, quantity: true } },
    },
  });

  const allVariantIds = new Set<string>();
  for (const p of products) {
    for (const v of p.variants) allVariantIds.add(v.id);
    for (const c of p.comboItems) allVariantIds.add(c.childVariantId);
  }
  const stockMap = await getSellableStockForVariants([...allVariantIds]);

  return products.map((p) => {
    const productComboStock = p.isCombo
      ? comboStock(p.comboItems, stockMap)
      : 0;
    const variants = p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      weightGram: v.weightGram,
      stock: p.isCombo ? productComboStock : (stockMap.get(v.id) ?? 0),
    }));
    const cheapest = variants[0];
    const stock = p.isCombo
      ? productComboStock
      : variants.reduce((s, v) => s + v.stock, 0);
    return {
      id: p.id,
      slug: p.slug,
      name: p.name,
      shortDescription: p.shortDescription,
      categoryId: p.category.id,
      categorySlug: p.category.slug,
      categoryName: p.category.name,
      images: p.images,
      isFeatured: p.isFeatured,
      isCombo: p.isCombo,
      skinTypes: p.skinTypes,
      benefits: p.benefits,
      variants,
      minPrice: cheapest?.price ?? 0,
      minCompareAtPrice: cheapest?.compareAtPrice ?? null,
      stock,
      searchIndex: normalizeText(
        `${p.name} ${p.shortDescription} ${p.ingredientsInci} ${p.category.name}`,
      ),
    };
  });
}

export async function getCategorySummaries(
  products: CatalogProduct[],
): Promise<CategorySummary[]> {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: "asc" },
    select: { id: true, name: true, slug: true },
  });
  return categories.map((c) => {
    const inCategory = products.filter((p) => p.categoryId === c.id);
    const cover =
      inCategory.find((p) => p.stock > 0 && p.images[0]) ??
      inCategory.find((p) => p.images[0]);
    return {
      ...c,
      count: inCategory.length,
      image: cover?.images[0] ?? null,
    };
  });
}

export async function getHomeReviews(limit = 6): Promise<HomeReview[]> {
  const rows = await prisma.review.findMany({
    where: { isApproved: true, rating: { gte: 4 } },
    orderBy: { createdAt: "desc" },
    take: limit,
    include: { product: { select: { name: true, slug: true } } },
  });
  return rows.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
    productName: r.product.name,
    productSlug: r.product.slug,
  }));
}

export async function getProductDetail(
  slug: string,
): Promise<ProductDetail | null> {
  const p = await prisma.product.findUnique({
    where: { slug },
    include: {
      category: { select: { id: true, name: true, slug: true } },
      variants: { orderBy: { price: "asc" } },
      comboItems: {
        include: {
          childVariant: {
            select: {
              id: true,
              name: true,
              product: { select: { name: true, slug: true, images: true } },
            },
          },
        },
      },
      reviews: {
        where: { isApproved: true },
        orderBy: { createdAt: "desc" },
      },
    },
  });
  if (!p || !p.isActive) return null;

  const variantIds = [
    ...p.variants.map((v) => v.id),
    ...p.comboItems.map((c) => c.childVariantId),
  ];
  const stockMap = await getSellableStockForVariants(variantIds);
  const productComboStock = p.isCombo ? comboStock(p.comboItems, stockMap) : 0;

  const expiryByVariant: Record<string, string> = {};
  if (!p.isCombo && p.variants.length > 0) {
    const expiryRows = await prisma.inventoryBatch.groupBy({
      by: ["variantId"],
      where: {
        variantId: { in: p.variants.map((v) => v.id) },
        availableQuantity: { gt: 0 },
        expiryDate: { gt: sellableExpiryCutoff(new Date()) },
      },
      _min: { expiryDate: true },
    });
    for (const r of expiryRows) {
      if (r._min.expiryDate) {
        expiryByVariant[r.variantId] = r._min.expiryDate.toISOString();
      }
    }
  }

  const variants = p.variants.map((v) => ({
    id: v.id,
    sku: v.sku,
    name: v.name,
    price: v.price,
    compareAtPrice: v.compareAtPrice,
    weightGram: v.weightGram,
    stock: p.isCombo ? productComboStock : (stockMap.get(v.id) ?? 0),
  }));

  const comboComponents: ComboComponent[] = p.comboItems.map((c) => ({
    variantId: c.childVariantId,
    productName: c.childVariant.product.name,
    productSlug: c.childVariant.product.slug,
    variantName: c.childVariant.name,
    quantity: c.quantity,
    image: c.childVariant.product.images[0] ?? null,
  }));

  const reviews: PublicReview[] = p.reviews.map((r) => ({
    id: r.id,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    createdAt: r.createdAt.toISOString(),
  }));
  const ratingCount = reviews.length;
  const ratingAverage = ratingCount
    ? reviews.reduce((s, r) => s + r.rating, 0) / ratingCount
    : 0;

  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    shortDescription: p.shortDescription,
    categoryId: p.category.id,
    categorySlug: p.category.slug,
    categoryName: p.category.name,
    images: p.images,
    isFeatured: p.isFeatured,
    isCombo: p.isCombo,
    skinTypes: p.skinTypes,
    benefits: p.benefits,
    variants,
    minPrice: variants[0]?.price ?? 0,
    minCompareAtPrice: variants[0]?.compareAtPrice ?? null,
    stock: p.isCombo
      ? productComboStock
      : variants.reduce((s, v) => s + v.stock, 0),
    searchIndex: "",
    description: p.description,
    ingredientsInci: p.ingredientsInci,
    usageGuide: p.usageGuide,
    storageGuide: p.storageGuide,
    comboComponents,
    reviews,
    ratingAverage,
    ratingCount,
    expiryByVariant,
  };
}

/**
 * Gợi ý sản phẩm liên quan (cross-sell): ưu tiên còn hàng, cùng danh mục,
 * trùng công dụng; bổ sung bằng sản phẩm bán chạy nếu chưa đủ.
 */
export async function getRelatedProducts(
  slug: string,
  limit = 4,
): Promise<CatalogProduct[]> {
  const all = await getCatalogProducts();
  const current = all.find((p) => p.slug === slug);
  if (!current) return [];
  const score = (p: CatalogProduct): number =>
    (p.categoryId === current.categoryId ? 10 : 0) +
    p.benefits.filter((b) => current.benefits.includes(b)).length * 2 +
    (p.isFeatured ? 1 : 0) -
    (p.isCombo !== current.isCombo ? 1 : 0);
  return all
    .filter((p) => p.slug !== slug && p.stock > 0)
    .sort((a, b) => score(b) - score(a))
    .slice(0, limit);
}
