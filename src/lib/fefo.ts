import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { sellableExpiryCutoff } from "@/lib/format";

/**
 * Quản lý tồn kho theo FEFO (First Expired, First Out) + tách Combo.
 *
 * Quy ước:
 * - Lô "bán được" = expiryDate > now + 30 ngày VÀ availableQuantity > 0.
 * - Đặt hàng: trừ availableQuantity, cộng reservedQuantity (giữ hàng).
 * - Huỷ đơn: hoàn lại đúng từng lô đã giữ.
 * - Giao hàng (SHIPPING): giảm reservedQuantity = xuất kho thực tế.
 */

type DbClient = Prisma.TransactionClient | typeof prisma;

export interface BatchAllocation {
  batchId: string;
  batchCode: string;
  quantity: number;
}

export interface ReserveItemInput {
  variantId: string;
  quantity: number;
}

export interface ReservedItemResult {
  variantId: string;
  quantity: number;
  batchAllocated: BatchAllocation[];
}

export interface NearExpiryBatch {
  batchId: string;
  batchCode: string;
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  expiryDate: Date;
  availableQuantity: number;
  reservedQuantity: number;
  daysLeft: number;
  isExpired: boolean;
}

/** Lỗi nghiệp vụ tồn kho (thông báo tiếng Việt, hiển thị được cho khách). */
export class StockError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StockError";
  }
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// Đọc tồn kho khả dụng
// ---------------------------------------------------------------------------

async function sumSellableForVariant(
  db: DbClient,
  variantId: string,
  now: Date,
): Promise<number> {
  const result = await db.inventoryBatch.aggregate({
    where: {
      variantId,
      availableQuantity: { gt: 0 },
      expiryDate: { gt: sellableExpiryCutoff(now) },
    },
    _sum: { availableQuantity: true },
  });
  return result._sum.availableQuantity ?? 0;
}

async function comboSellableStock(
  db: DbClient,
  comboProductId: string,
  now: Date,
): Promise<number> {
  const items = await db.comboItem.findMany({
    where: { comboProductId },
    select: { childVariantId: true, quantity: true },
  });
  if (items.length === 0) return 0;

  let minStock = Number.POSITIVE_INFINITY;
  for (const item of items) {
    const childStock = await sumSellableForVariant(
      db,
      item.childVariantId,
      now,
    );
    const per = Math.floor(childStock / Math.max(1, item.quantity));
    if (per < minStock) minStock = per;
  }
  return Number.isFinite(minStock) ? minStock : 0;
}

/** Tồn khả dụng của 1 biến thể (nếu thuộc combo: tính theo thành phần con). */
export async function getSellableStock(variantId: string): Promise<number> {
  const now = new Date();
  const variant = await prisma.productVariant.findUnique({
    where: { id: variantId },
    select: { product: { select: { id: true, isCombo: true } } },
  });
  if (!variant) return 0;
  if (variant.product.isCombo) {
    return comboSellableStock(prisma, variant.product.id, now);
  }
  return sumSellableForVariant(prisma, variantId, now);
}

/**
 * Tồn khả dụng cho nhiều biến thể trong MỘT truy vấn (dùng cho trang danh sách).
 * Cùng quy tắc FEFO: expiryDate > now + 30 ngày và availableQuantity > 0.
 * Biến thể không có lô hợp lệ trả về 0.
 */
export async function getSellableStockForVariants(
  variantIds: string[],
): Promise<Map<string, number>> {
  const result = new Map<string, number>(variantIds.map((id) => [id, 0]));
  if (variantIds.length === 0) return result;
  const rows = await prisma.inventoryBatch.groupBy({
    by: ["variantId"],
    where: {
      variantId: { in: variantIds },
      availableQuantity: { gt: 0 },
      expiryDate: { gt: sellableExpiryCutoff(new Date()) },
    },
    _sum: { availableQuantity: true },
  });
  for (const r of rows) {
    result.set(r.variantId, r._sum.availableQuantity ?? 0);
  }
  return result;
}

/** Tồn khả dụng của cả sản phẩm (tổng các biến thể; combo = min theo thành phần). */
export async function getProductSellableStock(
  productId: string,
): Promise<number> {
  const now = new Date();
  const product = await prisma.product.findUnique({
    where: { id: productId },
    select: { id: true, isCombo: true, variants: { select: { id: true } } },
  });
  if (!product) return 0;
  if (product.isCombo) {
    return comboSellableStock(prisma, product.id, now);
  }
  let total = 0;
  for (const v of product.variants) {
    total += await sumSellableForVariant(prisma, v.id, now);
  }
  return total;
}

/**
 * Các lô còn hàng nhưng hết hạn trong vòng `daysThreshold` ngày
 * (bao gồm cả lô đã hết hạn) — dùng cho cảnh báo đỏ ở Admin Dashboard.
 */
export async function getNearExpiryBatches(
  daysThreshold = 30,
): Promise<NearExpiryBatch[]> {
  const now = new Date();
  const limit = new Date(now.getTime() + daysThreshold * MS_PER_DAY);

  const batches = await prisma.inventoryBatch.findMany({
    where: {
      availableQuantity: { gt: 0 },
      expiryDate: { lte: limit },
    },
    orderBy: { expiryDate: "asc" },
    include: {
      variant: {
        select: {
          sku: true,
          name: true,
          product: { select: { name: true } },
        },
      },
    },
  });

  return batches.map((b) => ({
    batchId: b.id,
    batchCode: b.batchCode,
    variantId: b.variantId,
    sku: b.variant.sku,
    productName: b.variant.product.name,
    variantName: b.variant.name,
    expiryDate: b.expiryDate,
    availableQuantity: b.availableQuantity,
    reservedQuantity: b.reservedQuantity,
    daysLeft: Math.ceil((b.expiryDate.getTime() - now.getTime()) / MS_PER_DAY),
    isExpired: b.expiryDate.getTime() <= now.getTime(),
  }));
}

// ---------------------------------------------------------------------------
// Giữ hàng FEFO + Combo Explosion
// ---------------------------------------------------------------------------

interface ChildDemand {
  variantId: string;
  label: string; // tên hiển thị khi báo thiếu hàng
  quantity: number;
}

interface WorkingBatch {
  id: string;
  batchCode: string;
  remaining: number;
  taken: number;
}

function displayName(productName: string, variantName: string): string {
  return variantName && variantName !== productName
    ? `${productName} (${variantName})`
    : productName;
}

/**
 * Giữ hàng theo FEFO trong một transaction.
 * - Combo được tách thành các biến thể con; nhu cầu trùng biến thể được gộp
 *   khi kiểm tra tồn.
 * - Thiếu hàng → ném Error tiếng Việt để Prisma rollback toàn bộ.
 * - Trả về mảng kết quả cùng thứ tự với `items`, mỗi phần tử có `batchAllocated`
 *   (với combo: gộp vết phân bổ của mọi thành phần con).
 */
export async function reserveStockFEFO(
  tx: Prisma.TransactionClient,
  items: ReserveItemInput[],
): Promise<ReservedItemResult[]> {
  if (items.length === 0) return [];
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new StockError("Số lượng sản phẩm không hợp lệ");
    }
  }

  const now = new Date();
  const cutoff = sellableExpiryCutoff(now);

  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const variants = await tx.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      name: true,
      product: {
        select: {
          name: true,
          isActive: true,
          isCombo: true,
          comboItems: {
            select: {
              quantity: true,
              childVariant: {
                select: {
                  id: true,
                  name: true,
                  product: { select: { name: true } },
                },
              },
            },
          },
        },
      },
    },
  });
  const variantMap = new Map(variants.map((v) => [v.id, v]));

  // 1) Combo Explosion: mỗi dòng hàng -> danh sách nhu cầu theo biến thể con
  const perItemDemand: ChildDemand[][] = items.map((item) => {
    const v = variantMap.get(item.variantId);
    if (!v) throw new StockError("Sản phẩm không tồn tại hoặc đã ngừng kinh doanh");
    if (!v.product.isActive) {
      throw new StockError(
        `Sản phẩm ${v.product.name} hiện không còn được kinh doanh`,
      );
    }
    if (v.product.isCombo) {
      if (v.product.comboItems.length === 0) {
        throw new StockError(
          `Combo ${v.product.name} chưa được cấu hình thành phần`,
        );
      }
      return v.product.comboItems.map((ci) => ({
        variantId: ci.childVariant.id,
        label: displayName(
          ci.childVariant.product.name,
          ci.childVariant.name,
        ),
        quantity: ci.quantity * item.quantity,
      }));
    }
    return [
      {
        variantId: v.id,
        label: displayName(v.product.name, v.name),
        quantity: item.quantity,
      },
    ];
  });

  // 2) Gộp tổng nhu cầu theo biến thể con
  const totalNeed = new Map<string, { label: string; quantity: number }>();
  for (const demands of perItemDemand) {
    for (const d of demands) {
      const cur = totalNeed.get(d.variantId);
      if (cur) cur.quantity += d.quantity;
      else totalNeed.set(d.variantId, { label: d.label, quantity: d.quantity });
    }
  }

  // 3) Nạp lô khả dụng theo FEFO (expiryDate ASC) và kiểm tra đủ hàng
  const poolByVariant = new Map<string, WorkingBatch[]>();
  for (const [variantId, need] of totalNeed) {
    const batches = await tx.inventoryBatch.findMany({
      where: {
        variantId,
        availableQuantity: { gt: 0 },
        expiryDate: { gt: cutoff },
      },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
      select: { id: true, batchCode: true, availableQuantity: true },
    });
    const available = batches.reduce((s, b) => s + b.availableQuantity, 0);
    if (available < need.quantity) {
      throw new StockError(
        `Sản phẩm ${need.label} hiện không đủ số lượng tồn kho khả dụng`,
      );
    }
    poolByVariant.set(
      variantId,
      batches.map((b) => ({
        id: b.id,
        batchCode: b.batchCode,
        remaining: b.availableQuantity,
        taken: 0,
      })),
    );
  }

  // 4) Phân bổ cho từng dòng hàng theo thứ tự, rút dần từ lô sớm hết hạn nhất
  const results: ReservedItemResult[] = items.map((item, idx) => {
    const allocByBatch = new Map<string, BatchAllocation>();
    for (const d of perItemDemand[idx]) {
      let left = d.quantity;
      const pool = poolByVariant.get(d.variantId) ?? [];
      for (const b of pool) {
        if (left === 0) break;
        if (b.remaining === 0) continue;
        const take = Math.min(b.remaining, left);
        b.remaining -= take;
        b.taken += take;
        left -= take;
        const existing = allocByBatch.get(b.id);
        if (existing) existing.quantity += take;
        else
          allocByBatch.set(b.id, {
            batchId: b.id,
            batchCode: b.batchCode,
            quantity: take,
          });
      }
      if (left > 0) {
        // Không thể xảy ra sau bước kiểm tra, giữ để an toàn
        throw new StockError(
          `Sản phẩm ${d.label} hiện không đủ số lượng tồn kho khả dụng`,
        );
      }
    }
    return {
      variantId: item.variantId,
      quantity: item.quantity,
      batchAllocated: [...allocByBatch.values()],
    };
  });

  // 5) Ghi DB: trừ available, cộng reserved. Điều kiện gte chống bán lố khi
  //    có đơn khác giữ cùng lô đồng thời.
  for (const [variantId, pool] of poolByVariant) {
    const label = totalNeed.get(variantId)?.label ?? "đã chọn";
    for (const b of pool) {
      if (b.taken === 0) continue;
      const updated = await tx.inventoryBatch.updateMany({
        where: { id: b.id, availableQuantity: { gte: b.taken } },
        data: {
          availableQuantity: { decrement: b.taken },
          reservedQuantity: { increment: b.taken },
        },
      });
      if (updated.count !== 1) {
        throw new StockError(
          `Sản phẩm ${label} hiện không đủ số lượng tồn kho khả dụng`,
        );
      }
    }
  }

  return results;
}

// ---------------------------------------------------------------------------
// Huỷ đơn / Xuất kho
// ---------------------------------------------------------------------------

function parseBatchAllocated(value: Prisma.JsonValue | null): BatchAllocation[] {
  if (!Array.isArray(value)) return [];
  const out: BatchAllocation[] = [];
  for (const raw of value) {
    if (
      raw &&
      typeof raw === "object" &&
      !Array.isArray(raw) &&
      typeof raw.batchId === "string" &&
      typeof raw.quantity === "number"
    ) {
      out.push({
        batchId: raw.batchId,
        batchCode: typeof raw.batchCode === "string" ? raw.batchCode : "",
        quantity: raw.quantity,
      });
    }
  }
  return out;
}

async function loadAllocations(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<Map<string, number>> {
  const orderItems = await tx.orderItem.findMany({
    where: { orderId },
    select: { batchAllocated: true },
  });
  const byBatch = new Map<string, number>();
  for (const oi of orderItems) {
    for (const a of parseBatchAllocated(oi.batchAllocated)) {
      byBatch.set(a.batchId, (byBatch.get(a.batchId) ?? 0) + a.quantity);
    }
  }
  return byBatch;
}

/** Đơn bị huỷ: hoàn đúng số lượng về từng lô đã giữ (+available, -reserved). */
export async function releaseReservedStock(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const byBatch = await loadAllocations(tx, orderId);
  for (const [batchId, qty] of byBatch) {
    const updated = await tx.inventoryBatch.updateMany({
      where: { id: batchId, reservedQuantity: { gte: qty } },
      data: {
        availableQuantity: { increment: qty },
        reservedQuantity: { decrement: qty },
      },
    });
    if (updated.count !== 1) {
      throw new StockError(
        "Không thể hoàn kho: số lượng đang giữ của lô không khớp với đơn hàng",
      );
    }
  }
}

/** Đơn chuyển sang SHIPPING: giảm reservedQuantity = xuất kho thực tế. */
export async function commitShippedStock(
  tx: Prisma.TransactionClient,
  orderId: string,
): Promise<void> {
  const byBatch = await loadAllocations(tx, orderId);
  for (const [batchId, qty] of byBatch) {
    const updated = await tx.inventoryBatch.updateMany({
      where: { id: batchId, reservedQuantity: { gte: qty } },
      data: { reservedQuantity: { decrement: qty } },
    });
    if (updated.count !== 1) {
      throw new StockError(
        "Không thể xuất kho: số lượng đang giữ của lô không khớp với đơn hàng",
      );
    }
  }
}
