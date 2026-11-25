import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";

/**
 * Tính giá đơn hàng phía server. Đơn giá luôn lấy từ bảng ProductVariant,
 * không bao giờ nhận giá từ Client. Mọi số tiền là số nguyên VND.
 */

type DbClient = Prisma.TransactionClient | typeof prisma;

export { FREE_SHIPPING_THRESHOLD };
export const SHIPPING_FEE_BIG_CITY = 20_000;
export const SHIPPING_FEE_OTHER = 30_000;

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

export interface PricingItemInput {
  variantId: string;
  quantity: number;
}

export interface PricingParams {
  items: PricingItemInput[];
  province: string;
  voucherCode?: string | null;
}

export interface PricedLine {
  variantId: string;
  sku: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
}

export interface AppliedVoucher {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  usageLimit: number | null;
}

export interface OrderPricing {
  lines: PricedLine[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  voucher: AppliedVoucher | null;
}

/** Bỏ dấu, hạ chữ thường, gộp khoảng trắng để so khớp tên tỉnh/thành. */
function normalizeProvince(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBigCity(province: string): boolean {
  const n = normalizeProvince(province)
    .replace(/^(thanh pho|tp)\s+/, "")
    .trim();
  return (
    n === "ho chi minh" ||
    n === "hcm" ||
    n === "hcmc" ||
    n === "sai gon" ||
    n === "ha noi" ||
    n === "hn"
  );
}

/** Phí ship: 0 nếu (tạm tính - giảm giá) >= 500.000; 20.000 HCM/Hà Nội; còn lại 30.000. */
export function calculateShippingFee(
  amountAfterDiscount: number,
  province: string,
): number {
  if (amountAfterDiscount >= FREE_SHIPPING_THRESHOLD) return 0;
  return isBigCity(province) ? SHIPPING_FEE_BIG_CITY : SHIPPING_FEE_OTHER;
}

export async function calculateOrderPricing(
  params: PricingParams,
  db: DbClient = prisma,
): Promise<OrderPricing> {
  const { items, province } = params;
  if (items.length === 0) {
    throw new PricingError("Giỏ hàng đang trống");
  }
  for (const it of items) {
    if (!Number.isInteger(it.quantity) || it.quantity <= 0) {
      throw new PricingError("Số lượng sản phẩm không hợp lệ");
    }
  }

  const variantIds = [...new Set(items.map((i) => i.variantId))];
  const variants = await db.productVariant.findMany({
    where: { id: { in: variantIds } },
    select: {
      id: true,
      sku: true,
      name: true,
      price: true,
      product: { select: { name: true, isActive: true } },
    },
  });
  const map = new Map(variants.map((v) => [v.id, v]));

  const lines: PricedLine[] = items.map((it) => {
    const v = map.get(it.variantId);
    if (!v || !v.product.isActive) {
      throw new PricingError(
        "Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh",
      );
    }
    return {
      variantId: v.id,
      sku: v.sku,
      productName: v.product.name,
      variantName: v.name,
      quantity: it.quantity,
      unitPrice: v.price,
      lineTotal: v.price * it.quantity,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let discountAmount = 0;
  let voucher: AppliedVoucher | null = null;
  const code = params.voucherCode?.trim().toUpperCase();

  if (code) {
    const v = await db.voucher.findUnique({ where: { code } });
    const now = new Date();
    if (!v || !v.isActive) {
      throw new PricingError("Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hoá");
    }
    if (now < v.startDate) {
      throw new PricingError("Mã giảm giá chưa đến thời gian áp dụng");
    }
    if (now > v.endDate) {
      throw new PricingError("Mã giảm giá đã hết hạn");
    }
    if (v.usageLimit !== null && v.usedCount >= v.usageLimit) {
      throw new PricingError("Mã giảm giá đã hết lượt sử dụng");
    }
    if (subtotal < v.minOrderAmount) {
      throw new PricingError(
        `Đơn hàng chưa đạt giá trị tối thiểu ${v.minOrderAmount.toLocaleString("vi-VN")} ₫ để dùng mã này`,
      );
    }

    if (v.discountType === "PERCENTAGE" || v.discountType === "PERCENT") {
      discountAmount = Math.floor((subtotal * v.discountValue) / 100);
      if (v.maxDiscount !== null) {
        discountAmount = Math.min(discountAmount, v.maxDiscount);
      }
    } else if (v.discountType === "FIXED_AMOUNT" || v.discountType === "FIXED") {
      discountAmount = v.discountValue;
    } else {
      throw new PricingError("Loại mã giảm giá không được hỗ trợ");
    }
    discountAmount = Math.max(0, Math.min(discountAmount, subtotal));

    voucher = {
      id: v.id,
      code: v.code,
      discountType: v.discountType,
      discountValue: v.discountValue,
      discountAmount,
      usageLimit: v.usageLimit,
    };
  }

  const afterDiscount = subtotal - discountAmount;
  const shippingFee = calculateShippingFee(afterDiscount, province);

  return {
    lines,
    subtotal,
    discountAmount,
    shippingFee,
    totalAmount: afterDiscount + shippingFee,
    voucher,
  };
}
