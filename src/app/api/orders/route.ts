import { Prisma } from "@prisma/client";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { calculateOrderPricing, PricingError } from "@/lib/pricing";
import { reserveStockFEFO, StockError } from "@/lib/fefo";
import {
  generateOrderCode,
  generateVietQRUrl,
  getVietQRBankInfo,
  VietQRConfigError,
} from "@/lib/vietqr";

const orderSchema = z.object({
  customerName: z.string().trim().min(2, "Vui lòng nhập họ tên").max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^(0|\+84)\d{9}$/, "Số điện thoại không hợp lệ"),
  customerEmail: z
    .union([z.literal(""), z.email("Email không hợp lệ")])
    .optional()
    .transform((v) => (v ? v : undefined)),
  shippingAddress: z.string().trim().min(3, "Vui lòng nhập địa chỉ").max(255),
  province: z.string().trim().min(1, "Vui lòng chọn tỉnh/thành").max(100),
  district: z.string().trim().min(1, "Vui lòng chọn quận/huyện").max(100),
  ward: z.string().trim().min(1, "Vui lòng chọn phường/xã").max(100),
  note: z.string().trim().max(500).optional(),
  paymentMethod: z.enum(["COD", "VIETQR"]),
  voucherCode: z.string().trim().max(50).optional(),
  items: z
    .array(
      z.object({
        variantId: z.string().min(1),
        quantity: z.number().int().min(1).max(99),
      }),
    )
    .min(1, "Giỏ hàng đang trống")
    .max(50),
});

function isOrderCodeCollision(e: unknown): boolean {
  if (!(e instanceof Prisma.PrismaClientKnownRequestError)) return false;
  if (e.code !== "P2002") return false;
  const target = e.meta?.target;
  return Array.isArray(target)
    ? target.includes("orderCode")
    : String(target ?? "").includes("orderCode");
}

export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu gửi lên không hợp lệ" }, { status: 400 });
  }

  const parsed = orderSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      {
        error: "Dữ liệu đơn hàng không hợp lệ",
        details: parsed.error.issues.map((i) => ({
          field: i.path.join("."),
          message: i.message,
        })),
      },
      { status: 400 },
    );
  }
  const data = parsed.data;

  // VietQR cần cấu hình tài khoản: kiểm tra trước khi giữ tồn kho.
  if (data.paymentMethod === "VIETQR") {
    try {
      generateVietQRUrl({ amount: 1, orderCode: "KRTEST00" });
    } catch (e) {
      if (e instanceof VietQRConfigError) {
        return Response.json(
          { error: "Thanh toán VietQR tạm thời chưa khả dụng" },
          { status: 503 },
        );
      }
      throw e;
    }
  }

  try {
    let order: Awaited<ReturnType<typeof createOrder>> | null = null;
    for (let attempt = 0; attempt < 5 && !order; attempt++) {
      try {
        order = await createOrder(data, generateOrderCode());
      } catch (e) {
        if (!isOrderCodeCollision(e)) throw e;
      }
    }
    if (!order) {
      return Response.json(
        { error: "Không thể tạo mã đơn hàng, vui lòng thử lại" },
        { status: 500 },
      );
    }

    const qrUrl =
      order.paymentMethod === "VIETQR"
        ? generateVietQRUrl({
            amount: order.totalAmount,
            orderCode: order.orderCode,
          })
        : null;

    return Response.json(
      {
        order: {
          id: order.id,
          orderCode: order.orderCode,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          shippingFee: order.shippingFee,
          totalAmount: order.totalAmount,
          items: order.items.map((i) => ({
            variantId: i.variantId,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
        },
        vietqrUrl: qrUrl,
        bankInfo: qrUrl ? getVietQRBankInfo() : null,
      },
      { status: 201 },
    );
  } catch (e) {
    if (e instanceof PricingError) {
      return Response.json({ error: e.message }, { status: 400 });
    }
    if (e instanceof StockError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    console.error("POST /api/orders failed", e);
    return Response.json(
      { error: "Không thể tạo đơn hàng, vui lòng thử lại sau" },
      { status: 500 },
    );
  }
}

type OrderInput = z.infer<typeof orderSchema>;

function createOrder(data: OrderInput, orderCode: string) {
  return prisma.$transaction(
    async (tx) => {
      // 1) Tính lại giá từ DB (không tin giá Client)
      const pricing = await calculateOrderPricing(
        {
          items: data.items,
          province: data.province,
          voucherCode: data.voucherCode,
        },
        tx,
      );

      // 2) Giữ tồn kho FEFO (rollback toàn bộ nếu thiếu hàng)
      const reserved = await reserveStockFEFO(tx, data.items);

      // 3) Tăng lượt dùng voucher (có điều kiện chống vượt giới hạn khi đặt đồng thời)
      if (pricing.voucher) {
        const v = pricing.voucher;
        const updated = await tx.voucher.updateMany({
          where:
            v.usageLimit === null
              ? { id: v.id }
              : { id: v.id, usedCount: { lt: v.usageLimit } },
          data: { usedCount: { increment: 1 } },
        });
        if (updated.count !== 1) {
          throw new PricingError("Mã giảm giá đã hết lượt sử dụng");
        }
      }

      // 4) Tạo đơn + dòng hàng kèm vết phân bổ lô
      return tx.order.create({
        data: {
          orderCode,
          customerName: data.customerName,
          customerPhone: data.customerPhone,
          customerEmail: data.customerEmail,
          shippingAddress: data.shippingAddress,
          province: data.province,
          district: data.district,
          ward: data.ward,
          note: data.note,
          subtotal: pricing.subtotal,
          shippingFee: pricing.shippingFee,
          discountAmount: pricing.discountAmount,
          totalAmount: pricing.totalAmount,
          voucherId: pricing.voucher?.id,
          paymentMethod: data.paymentMethod,
          items: {
            create: pricing.lines.map((line, idx) => ({
              variant: { connect: { id: line.variantId } },
              quantity: line.quantity,
              unitPrice: line.unitPrice,
              batchAllocated: reserved[idx].batchAllocated.map((a) => ({
                batchId: a.batchId,
                batchCode: a.batchCode,
                quantity: a.quantity,
              })),
            })),
          },
        },
        include: { items: true },
      });
    },
    { timeout: 15_000, maxWait: 10_000 },
  );
}
