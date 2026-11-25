import { z } from "zod";
import {
  calculateOrderPricing,
  PricingError,
  VoucherError,
  type OrderPricing,
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

function body(pricing: OrderPricing, provinceProvided: boolean) {
  return {
    lines: pricing.lines.map((l) => ({
      variantId: l.variantId,
      productName: l.productName,
      variantName: l.variantName,
      quantity: l.quantity,
      unitPrice: l.unitPrice,
      lineTotal: l.lineTotal,
    })),
    subtotal: pricing.subtotal,
    discountAmount: pricing.discountAmount,
    shippingFee: pricing.shippingFee,
    totalAmount: pricing.totalAmount,
    // Chưa chọn tỉnh/thành thì phí ship chỉ là tạm tính (mức 30.000 ₫ nếu chưa đủ freeship).
    shippingEstimated: !provinceProvided,
    // Dự kiến giao: theo tỉnh đã chọn; chưa chọn thì client hiển thị cả hai khu vực.
    delivery: pricing.delivery,
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
        voucher: pricing.voucher
          ? {
              valid: true,
              code: pricing.voucher.code,
              discountAmount: pricing.voucher.discountAmount,
              scope: pricing.voucher.scope,
              eligibleSubtotal: pricing.voucher.eligibleSubtotal,
              appliedProductNames: pricing.voucher.appliedProductNames,
              message:
                pricing.voucher.scope === "PRODUCT"
                  ? `Đã áp dụng mã ${pricing.voucher.code} cho: ${pricing.voucher.appliedProductNames.join(", ")}`
                  : `Đã áp dụng mã ${pricing.voucher.code}`,
            }
          : null,
      });
    } catch (e) {
      if (!(e instanceof VoucherError)) throw e;
      const pricing = await calculateOrderPricing({ items, province });
      return Response.json({
        ...body(pricing, provinceProvided),
        voucher: { valid: false, code: voucherCode ?? "", discountAmount: 0, message: e.message },
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
