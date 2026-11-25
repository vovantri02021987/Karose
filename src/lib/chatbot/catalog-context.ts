/**
 * Ngữ cảnh dữ liệu KAROSE cho chatbot: sản phẩm đang bán (kèm tồn khả dụng FEFO), voucher còn hiệu lực
 * và kiến thức tham khảo đã đồng bộ. ĐÂY là nguồn sự thật duy nhất về giá/tồn kho — internet không bao giờ ghi đè.
 */
import type { PrismaClient } from "@prisma/client";
import { PENDING_TEXT, PLACEHOLDER_IMAGE } from "@/lib/constants";
import { getProductSellableStock, getSellableStockForVariants } from "@/lib/fefo";
import { prisma } from "@/lib/prisma";
import { normalizeText } from "@/lib/text";

export interface ChatVariant {
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
}

export interface ChatProduct {
  id: string;
  slug: string;
  name: string;
  category: string;
  shortDescription: string;
  description: string;
  ingredientsInci: string;
  usageGuide: string;
  storageGuide: string | null;
  skinTypes: string[];
  benefits: string[];
  isCombo: boolean;
  isFeatured: boolean;
  deliveryMinDays: number;
  deliveryMaxDays: number;
  image: string;
  variants: ChatVariant[];
  /** Giá thấp nhất trong các biến thể (VND). */
  minPrice: number;
  maxPrice: number;
  sellableStock: number;
  inStock: boolean;
  /** Tên thành phần con nếu là combo. */
  comboItemNames: string[];
}

export interface ChatVoucher {
  code: string;
  description: string | null;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  scope: "ORDER" | "PRODUCT";
  endDate: Date;
  productSlugs: string[];
}

export interface ChatKnowledge {
  id: string;
  title: string;
  sourceUrl: string;
  summary: string;
  category: string;
  syncedAt: Date;
}

export interface CatalogContext {
  products: ChatProduct[];
  vouchers: ChatVoucher[];
  knowledge: ChatKnowledge[];
  loadedAt: Date;
}

type Db = Pick<PrismaClient, "product" | "voucher" | "knowledgeSource">;

/** Nội dung trống / placeholder → coi như chưa có dữ liệu. */
export function hasContent(value: string | null | undefined): boolean {
  if (!value) return false;
  const v = value.trim();
  return v.length > 0 && v !== PENDING_TEXT;
}

export async function loadCatalogContext(db: Db = prisma, now: Date = new Date()): Promise<CatalogContext> {
  const rows = await db.product.findMany({
    where: { isActive: true },
    orderBy: [{ isFeatured: "desc" }, { createdAt: "asc" }],
    select: {
      id: true,
      slug: true,
      name: true,
      shortDescription: true,
      description: true,
      ingredientsInci: true,
      usageGuide: true,
      storageGuide: true,
      skinTypes: true,
      benefits: true,
      images: true,
      isCombo: true,
      isFeatured: true,
      deliveryMinDays: true,
      deliveryMaxDays: true,
      category: { select: { name: true } },
      variants: {
        orderBy: { price: "asc" },
        select: { id: true, sku: true, name: true, price: true, compareAtPrice: true },
      },
      comboItems: {
        select: { quantity: true, childVariant: { select: { product: { select: { name: true } } } } },
      },
    },
  });

  const plainVariantIds = rows.filter((p) => !p.isCombo).flatMap((p) => p.variants.map((v) => v.id));
  const stockByVariant = await getSellableStockForVariants(plainVariantIds);

  const products: ChatProduct[] = [];
  for (const p of rows) {
    const sellableStock = p.isCombo
      ? await getProductSellableStock(p.id)
      : p.variants.reduce((sum, v) => sum + (stockByVariant.get(v.id) ?? 0), 0);
    const prices = p.variants.map((v) => v.price);
    products.push({
      id: p.id,
      slug: p.slug,
      name: p.name,
      category: p.category.name,
      shortDescription: p.shortDescription,
      description: p.description,
      ingredientsInci: p.ingredientsInci,
      usageGuide: p.usageGuide,
      storageGuide: p.storageGuide,
      skinTypes: p.skinTypes,
      benefits: p.benefits,
      isCombo: p.isCombo,
      isFeatured: p.isFeatured,
      deliveryMinDays: p.deliveryMinDays,
      deliveryMaxDays: p.deliveryMaxDays,
      image: p.images[0] || PLACEHOLDER_IMAGE,
      variants: p.variants.map(({ sku, name, price, compareAtPrice }) => ({ sku, name, price, compareAtPrice })),
      minPrice: prices.length ? Math.min(...prices) : 0,
      maxPrice: prices.length ? Math.max(...prices) : 0,
      sellableStock,
      inStock: sellableStock > 0,
      comboItemNames: p.comboItems.map((c) => `${c.childVariant.product.name}${c.quantity > 1 ? ` x${c.quantity}` : ""}`),
    });
  }

  const voucherRows = await db.voucher.findMany({
    where: { isActive: true, startDate: { lte: now }, endDate: { gte: now } },
    orderBy: { endDate: "asc" },
    select: {
      code: true,
      description: true,
      discountType: true,
      discountValue: true,
      minOrderAmount: true,
      maxDiscount: true,
      usageLimit: true,
      usedCount: true,
      scope: true,
      endDate: true,
      products: { select: { product: { select: { slug: true } } } },
    },
  });
  const vouchers: ChatVoucher[] = voucherRows
    .filter((v) => v.usageLimit === null || v.usedCount < v.usageLimit)
    .map((v) => ({
      code: v.code,
      description: v.description,
      discountType: v.discountType,
      discountValue: v.discountValue,
      minOrderAmount: v.minOrderAmount,
      maxDiscount: v.maxDiscount,
      scope: v.scope,
      endDate: v.endDate,
      productSlugs: v.products.map((vp) => vp.product.slug),
    }));

  const knowledge = await db.knowledgeSource.findMany({
    where: { isActive: true },
    orderBy: { syncedAt: "desc" },
    take: 200,
    select: { id: true, title: true, sourceUrl: true, summary: true, category: true, syncedAt: true },
  });

  return { products, vouchers, knowledge, loadedAt: now };
}

/** Chuẩn hoá để so khớp tên sản phẩm: không dấu, bỏ tiền tố "karose". */
function productKey(name: string): string {
  return normalizeText(name).replace(/[^a-z0-9\s]/g, " ").replace(/\bkarose\b/g, " ").replace(/\s+/g, " ").trim();
}

/**
 * Tìm sản phẩm được nhắc đến trong câu hỏi: khớp tên đầy đủ (bỏ "KAROSE") hoặc slug,
 * hoặc ≥ 2 từ khoá đặc trưng của tên. Kết quả sắp theo độ khớp.
 */
export function matchProductsByText(products: ChatProduct[], message: string): ChatProduct[] {
  const text = ` ${normalizeText(message).replace(/[^a-z0-9\s]/g, " ").replace(/\s+/g, " ").trim()} `;
  const scored: { product: ChatProduct; score: number }[] = [];
  for (const p of products) {
    const key = productKey(p.name);
    if (!key) continue;
    let score = 0;
    if (text.includes(` ${key} `)) score = 100 + key.length;
    else if (text.includes(` ${p.slug.replace(/-/g, " ")} `)) score = 90;
    else {
      const tokens = key.split(" ").filter((t) => t.length >= 3 && !STOP_TOKENS.has(t));
      const hit = tokens.filter((t) => text.includes(` ${t} `)).length;
      if (tokens.length >= 2 && hit >= 2) score = hit * 10;
      else if (tokens.length === 1 && hit === 1) score = 10;
    }
    if (score > 0) scored.push({ product: p, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.product);
}

const STOP_TOKENS = new Set(["cho", "voi", "cua", "va", "set", "bo", "combo", "tu", "tinh", "chat", "thien", "nhien"]);

/** Sản phẩm có chứa thành phần (so khớp không dấu trong INCI/mô tả). */
export function findProductsByIngredient(products: ChatProduct[], term: string): ChatProduct[] {
  const needle = normalizeText(term);
  if (needle.length < 3) return [];
  return products.filter((p) => normalizeText(`${p.ingredientsInci} ${p.description}`).includes(needle));
}

/** Kiến thức đã đồng bộ liên quan tới câu hỏi (khớp từ khoá trên tiêu đề/tóm tắt). */
export function findRelevantKnowledge(knowledge: ChatKnowledge[], message: string, limit = 3): ChatKnowledge[] {
  const tokens = [
    ...new Set(
      normalizeText(message)
        .replace(/[^a-z0-9\s]/g, " ")
        .split(" ")
        .filter((t) => t.length >= 4 && !KNOWLEDGE_STOP.has(t)),
    ),
  ];
  if (tokens.length === 0) return [];
  return knowledge
    .map((item) => {
      const hay = normalizeText(`${item.title} ${item.summary}`);
      const score = tokens.reduce((s, t) => s + (hay.includes(t) ? 1 : 0), 0);
      return { item, score };
    })
    .filter((x) => x.score > 0)
    .sort((a, b) => b.score - a.score || b.item.syncedAt.getTime() - a.item.syncedAt.getTime())
    .slice(0, limit)
    .map((x) => x.item);
}

const KNOWLEDGE_STOP = new Set([
  "nhu", "nao", "the", "khong", "nhung", "cua", "cho", "toi", "minh", "ban", "duoc", "nay", "kia",
  "dang", "voi", "trong", "thi", "vay", "biet", "hoi", "muon", "can", "hay", "xin", "chao", "shop",
  "karose", "san", "pham", "moi", "nhat", "cap", "nhat", "tren", "mang", "internet",
]);
