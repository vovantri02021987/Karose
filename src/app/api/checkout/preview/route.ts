import { z } from "zod";
import {
  calculateOrderPricing,
  PricingError,
  VoucherError,
  type CalculatePricingResult,
} from "@/lib/pricing";

const previewSchema = z.object({
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Giỏ hàng đang trống")
    .max(50),
  province: z.string().trim().max(100).optional().default(""),
  voucherCode: z.string().trim().max(50).optional(),
});

function body(pricing: CalculatePricingResult, provinceProvided: boolean) {
  return {
    items: pricing.items.map((l) => ({
      variantId: l.variantId,
      productId: l.productId,
      productName: l.productName,
      variantName: l.variantName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
      lineDiscount: l.lineDiscount,
      lineFinalAmount: l.lineFinalAmount,
      eligibleForVoucher: l.eligibleForVoucher,
    })),
    subtotal: pricing.subtotal,
    discountAmount: pricing.discountAmount,
    shippingFee: pricing.shippingFee,
    totalAmount: pricing.totalAmount,
    freeShipThreshold: pricing.freeShipThreshold,
    amountNeededForFreeShip: pricing.amountNeededForFreeShip,
    // Chưa chọn tỉnh/thành thì phí ship chỉ là tạm tính (mức 30.000 ₫ nếu chưa đủ freeship).
    shippingEstimated: !provinceProvided,
    // Dự kiến giao: theo tỉnh đã chọn; chưa chọn thì client hiển thị cả hai khu vực.
    estimatedDelivery: pricing.estimatedDelivery,
    deliveryByRegion: pricing.deliveryByRegion,
  };
}

/**
 * Tính thử giá/ship/voucher bằng đúng hàm `calculateOrderPricing` mà POST /api/orders dùng,
 * nên số tiền trên Checkout khớp tuyệt đối với lúc tạo đơn.
 * Voucher lỗi KHÔNG làm hỏng cả phản hồi: trả giá không voucher + thông báo lỗi.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const parsed = previewSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }
  const { items, province, voucherCode } = parsed.data;
  const provinceProvided = province.length > 0;

  try {
    try {
      const pricing = await calculateOrderPricing({
        items,
        province,
        voucherCode,
      });
      return Response.json({
        ...body(pricing, provinceProvided),
        voucher: voucherCode
          ? { code: pricing.voucher?.code ?? voucherCode, applied: pricing.voucher, error: null }
          : null,
      });
    } catch (e) {
      if (!(e instanceof VoucherError)) throw e;
      const pricing = await calculateOrderPricing({ items, province });
      return Response.json({
        ...body(pricing, provinceProvided),
        voucher: { code: voucherCode ?? "", applied: null, error: e.message },
      });
    }
  } catch (e) {
    if (e instanceof PricingError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    console.error("POST /api/checkout/preview failed", e);
    return Response.json(
      { error: "Không thể tính giá lúc này, vui lòng thử lại" },
      { status: 500 },
    );
  }
}
