import { requireStaffPage } from "@/lib/auth/guard";
import { sellableExpiryCutoff } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import InventoryClient, { type BatchRow, type VariantChoice } from "./InventoryClient";

interface Params {
  variantId?: string;
}

export default async function InventoryPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireStaffPage();
  const { variantId } = await searchParams;

  const [variants, batches] = await Promise.all([
    prisma.productVariant.findMany({
      where: { product: { isCombo: false } },
      orderBy: [{ product: { name: "asc" } }, { price: "asc" }],
      select: { id: true, sku: true, name: true, product: { select: { name: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: variantId ? { variantId } : undefined,
      orderBy: [{ variantId: "asc" }, { expiryDate: "asc" }],
      include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } } },
    }),
  ]);

  const now = new Date();
  const cutoff = sellableExpiryCutoff(now);
  const rankByVariant = new Map<string, number>();
  const rows: BatchRow[] = batches.map((b) => {
    let rank: number | null = null;
    if (b.availableQuantity > 0) {
      rank = (rankByVariant.get(b.variantId) ?? 0) + 1;
      rankByVariant.set(b.variantId, rank);
    }
    const state = b.expiryDate <= now ? "EXPIRED" : b.expiryDate <= cutoff ? "NEAR" : "OK";
    return {
      id: b.id,
      variantId: b.variantId,
      batchCode: b.batchCode,
      productName: b.variant.product.name,
      variantName: b.variant.name,
      sku: b.variant.sku,
      manufacturedDate: b.manufacturedDate.toISOString(),
      expiryDate: b.expiryDate.toISOString(),
      initialQuantity: b.initialQuantity,
      availableQuantity: b.availableQuantity,
      reservedQuantity: b.reservedQuantity,
      fefoRank: rank,
      state,
    };
  });

  const choices: VariantChoice[] = variants.map((v) => ({
    id: v.id,
    label: `${v.product.name} – ${v.name} (${v.sku})`,
  }));

  return <InventoryClient batches={rows} variants={choices} selectedVariantId={variantId ?? ""} />;
}
