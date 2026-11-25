import { requireStaffPage } from "@/lib/auth/guard";
import { getProductSellableStock } from "@/lib/fefo";
import { prisma } from "@/lib/prisma";
import ProductManager, { type AdminProduct, type VariantOption } from "./ProductManager";

export default async function AdminProductsPage() {
  const user = await requireStaffPage();

  const [products, categories] = await Promise.all([
    prisma.product.findMany({
      orderBy: { createdAt: "desc" },
      include: {
        category: { select: { name: true } },
        variants: { orderBy: { price: "asc" } },
        comboItems: { select: { childVariantId: true, quantity: true } },
      },
    }),
    prisma.category.findMany({ orderBy: { createdAt: "asc" }, select: { id: true, name: true } }),
  ]);
  const stocks = await Promise.all(products.map((p) => getProductSellableStock(p.id)));

  const rows: AdminProduct[] = products.map((p, i) => ({
    id: p.id,
    name: p.name,
    slug: p.slug,
    categoryId: p.categoryId,
    categoryName: p.category.name,
    shortDescription: p.shortDescription,
    description: p.description,
    ingredientsInci: p.ingredientsInci,
    usageGuide: p.usageGuide,
    storageGuide: p.storageGuide ?? "",
    skinTypes: p.skinTypes,
    benefits: p.benefits,
    images: p.images,
    isFeatured: p.isFeatured,
    isActive: p.isActive,
    isCombo: p.isCombo,
    deliveryMinDays: p.deliveryMinDays,
    deliveryMaxDays: p.deliveryMaxDays,
    stock: stocks[i],
    variants: p.variants.map((v) => ({
      id: v.id,
      sku: v.sku,
      name: v.name,
      price: v.price,
      compareAtPrice: v.compareAtPrice,
      weightGram: v.weightGram,
    })),
    comboItems: p.comboItems,
  }));

  const variantOptions: VariantOption[] = products
    .filter((p) => !p.isCombo)
    .flatMap((p) => p.variants.map((v) => ({ id: v.id, label: `${p.name} – ${v.name} (${v.sku})` })));

  return (
    <ProductManager
      products={rows}
      categories={categories}
      variantOptions={variantOptions}
      canEdit={user.role === "ADMIN"}
    />
  );
}
