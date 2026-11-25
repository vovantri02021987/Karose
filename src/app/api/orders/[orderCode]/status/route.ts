import { prisma } from "@/lib/prisma";

/** API nhẹ cho trang Checkout polling mỗi 3 giây. */
export async function GET(
  _request: Request,
  ctx: { params: Promise<{ orderCode: string }> },
) {
  const { orderCode } = await ctx.params;
  const order = await prisma.order.findUnique({
    where: { orderCode: orderCode.toUpperCase() },
    select: {
      orderCode: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      totalAmount: true,
    },
  });
  if (!order) {
    return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
  }
  return Response.json(order, {
    headers: { "Cache-Control": "no-store" },
  });
}
