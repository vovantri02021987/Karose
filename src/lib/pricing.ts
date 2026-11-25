import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { FREE_SHIPPING_THRESHOLD } from "@/lib/constants";
import {
  calculateEstimatedDelivery,
  estimateDeliveryBothRegions,
  isCoreHubProvince,
  type DeliveryEstimate,
} from "@/lib/delivery";

/**
 * Tính giá đơn hàng phía server. Đơn giá luôn lấy từ bảng ProductVariant,
 * không bao giờ nhận giá từ Client. Mọi số tiền là số nguyên VND.
 */

type DbClient = Prisma.TransactionClient | typeof prisma;

export { FREE_SHIPPING_THRESHOLD, calculateEstimatedDelivery, isCoreHubProvince };
export const SHIPPING_FEE_BIG_CITY = 20_000;
export const SHIPPING_FEE_OTHER = 30_000;

export class PricingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PricingError";
  }
}

/** Lỗi riêng của mã giảm giá (để API preview trả thông báo mà vẫn tính được giá không voucher). */
export class VoucherError extends PricingError {
  constructor(message: string) {
    super(message);
    this.name = "VoucherError";
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

export interface PricedLineItem {
  variantId: string;
  productId: string;
  sku: string;
  productName: string;
  variantName: string;
  quantity: number;
  unitPrice: number;
  lineTotal: number;
  /** Phần giảm giá voucher phân bổ cho dòng này (tổng các dòng = discountAmount). */
  lineDiscount: number;
  lineFinalAmount: number;
  /** Dòng này có thuộc phạm vi áp dụng của voucher đang dùng không. */
  eligibleForVoucher: boolean;
  deliveryMinDays: number;
  deliveryMaxDays: number;
}

export interface AppliedVoucherSummary {
  id: string;
  code: string;
  discountType: string;
  discountValue: number;
  discountAmount: number;
  usageLimit: number | null;
  scope: "ORDER" | "PRODUCT";
  /** Phần tiền hàng được xét giảm giá (ORDER: = subtotal; PRODUCT: chỉ các sản phẩm hợp lệ). */
  eligibleSubtotal: number;
  /** Tên sản phẩm trong giỏ được áp mã (chỉ có ý nghĩa với scope PRODUCT). */
  appliedProductNames: string[];
}

export interface CalculatePricingResult {
  items: PricedLineItem[];
  subtotal: number;
  discountAmount: number;
  shippingFee: number;
  totalAmount: number;
  voucher: AppliedVoucherSummary | null;
  freeShipThreshold: number;
  /** Số tiền cần mua thêm để được miễn phí ship (0 nếu đã đủ). */
  amountNeededForFreeShip: number;
  /** Dự kiến giao theo tỉnh/thành (nếu chưa chọn tỉnh: mức của "tỉnh khác"). */
  estimatedDelivery: DeliveryEstimate;
  /** Dự kiến theo từng khu vực, dùng khi chưa biết tỉnh/thành. */
  deliveryByRegion: { bigCity: DeliveryEstimate; other: DeliveryEstimate };
}

/** Phí ship: 0 nếu (tạm tính - giảm giá) >= 500.000; 20.000 HCM/Hà Nội; còn lại 30.000. */
export function calculateShippingFee(
  amountAfterDiscount: number,
  province: string,
): number {
  if (amountAfterDiscount >= FREE_SHIPPING_THRESHOLD) return 0;
  return isCoreHubProvince(province) ? SHIPPING_FEE_BIG_CITY : SHIPPING_FEE_OTHER;
}

export async function calculateOrderPricing(
  params: PricingParams,
  db: DbClient = prisma,
): Promise<CalculatePricingResult> {
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
      product: {
        select: {
          id: true,
          name: true,
          isActive: true,
          deliveryMinDays: true,
          deliveryMaxDays: true,
        },
      },
    },
  });
  const map = new Map(variants.map((v) => [v.id, v]));

  const lines: PricedLineItem[] = items.map((it) => {
    const v = map.get(it.variantId);
    if (!v || !v.product.isActive) {
      throw new PricingError(
        "Có sản phẩm không tồn tại hoặc đã ngừng kinh doanh",
      );
    }
    return {
      variantId: v.id,
      productId: v.product.id,
      sku: v.sku,
      productName: v.product.name,
      variantName: v.name,
      quantity: it.quantity,
      unitPrice: v.price,
      lineTotal: v.price * it.quantity,
      lineDiscount: 0,
      lineFinalAmount: v.price * it.quantity,
      eligibleForVoucher: false,
      deliveryMinDays: v.product.deliveryMinDays,
      deliveryMaxDays: v.product.deliveryMaxDays,
    };
  });

  const subtotal = lines.reduce((s, l) => s + l.lineTotal, 0);

  let discountAmount = 0;
  let voucher: AppliedVoucherSummary | null = null;
  const code = params.voucherCode?.trim().toUpperCase();

  if (code) {
    const v = await db.voucher.findUnique({
      where: { code },
      include: { products: { select: { productId: true } } },
    });
    const now = new Date();
    if (!v || !v.isActive) {
      throw new VoucherError("Mã giảm giá không hợp lệ hoặc đã bị vô hiệu hoá");
    }
    if (now < v.startDate) {
      throw new VoucherError("Mã giảm giá chưa đến thời gian áp dụng");
    }
    if (now > v.endDate) {
      throw new VoucherError("Mã giảm giá đã hết hạn");
    }
    if (v.usageLimit !== null && v.usedCount >= v.usageLimit) {
      throw new VoucherError("Mã giảm giá đã hết lượt sử dụng");
    }

    // Phạm vi áp dụng. Combo là một sản phẩm riêng (có giá riêng): chỉ được giảm
    // khi chính sản phẩm combo nằm trong danh sách của mã, không bung theo thành phần con.
    let eligibleLines = lines;
    if (v.scope === "PRODUCT") {
      const allowed = new Set(v.products.map((p) => p.productId));
      eligibleLines = lines.filter((l) => allowed.has(l.productId));
      if (eligibleLines.length === 0) {
        throw new VoucherError(
          "Mã này chỉ áp dụng cho một số sản phẩm nhất định, giỏ hàng chưa có sản phẩm phù hợp",
        );
      }
    }
    const eligibleSubtotal = eligibleLines.reduce((s, l) => s + l.lineTotal, 0);

    // Đơn tối thiểu tính trên đúng phần tiền hàng thuộc phạm vi áp dụng.
    if (eligibleSubtotal < v.minOrderAmount) {
      throw new VoucherError(
        v.scope === "PRODUCT"
          ? `Tiền hàng của sản phẩm áp dụng chưa đạt tối thiểu ${v.minOrderAmount.toLocaleString("vi-VN")} ₫ để dùng mã này`
          : `Đơn hàng chưa đạt giá trị tối thiểu ${v.minOrderAmount.toLocaleString("vi-VN")} ₫ để dùng mã này`,
      );
    }

    if (v.discountType === "PERCENTAGE" || v.discountType === "PERCENT") {
      discountAmount = Math.floor((eligibleSubtotal * v.discountValue) / 100);
      if (v.maxDiscount !== null) {
        discountAmount = Math.min(discountAmount, v.maxDiscount);
      }
    } else if (v.discountType === "FIXED_AMOUNT" || v.discountType === "FIXED") {
      discountAmount = v.discountValue;
    } else {
      throw new VoucherError("Loại mã giảm giá không được hỗ trợ");
    }
    // Không bao giờ vượt phần tiền hàng hợp lệ.
    discountAmount = Math.max(0, Math.min(discountAmount, eligibleSubtotal));

    // Phân bổ giảm giá theo tỷ lệ tiền hàng của các dòng hợp lệ; dòng cuối nhận phần dư
    // để tổng các dòng luôn đúng bằng discountAmount (số nguyên VND).
    let remaining = discountAmount;
    eligibleLines.forEach((line, idx) => {
      const share =
        idx === eligibleLines.length - 1
          ? remaining
          : Math.floor((discountAmount * line.lineTotal) / eligibleSubtotal);
      line.lineDiscount = share;
      line.lineFinalAmount = line.lineTotal - share;
      line.eligibleForVoucher = true;
      remaining -= share;
    });

    voucher = {
      id: v.id,
      code: v.code,
      discountType: v.discountType,
      discountValue: v.discountValue,
      discountAmount,
      usageLimit: v.usageLimit,
      scope: v.scope,
      eligibleSubtotal,
      appliedProductNames:
        v.scope === "PRODUCT"
          ? [...new Set(eligibleLines.map((l) => l.productName))]
          : [],
    };
  }

  const windows = lines.map((l) => ({
    minDays: l.deliveryMinDays,
    maxDays: l.deliveryMaxDays,
  }));
  const afterDiscount = subtotal - discountAmount;
  const shippingFee = calculateShippingFee(afterDiscount, province);

  return {
    items: lines,
    subtotal,
    discountAmount,
    shippingFee,
    totalAmount: afterDiscount + shippingFee,
    voucher,
    freeShipThreshold: FREE_SHIPPING_THRESHOLD,
    amountNeededForFreeShip: Math.max(0, FREE_SHIPPING_THRESHOLD - afterDiscount),
    estimatedDelivery: calculateEstimatedDelivery(windows, province),
    deliveryByRegion: estimateDeliveryBothRegions(windows),
  };
}
