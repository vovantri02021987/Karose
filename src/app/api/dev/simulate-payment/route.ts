import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { confirmVietQRPayment } from "@/lib/payments";

/**
 * Giả lập ngân hàng báo có (CHỈ môi trường development).
 * Ở production/preview route này trả 404 nên không thể dùng để tự xác nhận thanh toán.
 */
export async function POST(request: Request) {
  if (process.env.NODE_ENV !== "development") {
    return Response.json({ error: "Not found" }, { status: 404 });
  }
  const parsed = z
    .object({ orderCode: z.string().min(1) })
    .safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return Response.json({ error: "Thiếu mã đơn hàng" }, { status: 400 });
  }
  const order = await prisma.order.findUnique({
    where: { orderCode: parsed.data.orderCode.toUpperCase() },
    select: { orderCode: true, totalAmount: true },
  });
  if (!order) {
    return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }
  const result = await confirmVietQRPayment({
    content: `DEV SIMULATE ${order.orderCode}`,
    amount: order.totalAmount,
    reference: `DEV-SIM-${Date.now()}`,
  });
  return Response.json({ success: true, ...result });
}
