import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { maskPhone, normalizePhone } from "@/lib/phone";
import { generateVietQRUrl, getVietQRBankInfo } from "@/lib/vietqr";

const trackingSchema = z.object({
  orderCode: z.string().trim().min(4, "Vui lòng nhập mã đơn hàng").max(30),
  phone: z.string().trim().min(8, "Vui lòng nhập số điện thoại đặt hàng").max(20),
});

/**
 * Tra cứu đơn: bắt buộc đúng CẢ mã đơn và SĐT đặt hàng.
 * Sai một trong hai đều trả cùng một thông báo 404 để không lộ việc mã đơn có tồn tại.
 */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const parsed = trackingSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }
  const orderCode = parsed.data.orderCode.toUpperCase().replace(/\s+/g, "");
  const phone = normalizePhone(parsed.data.phone);

  try {
    const order = await prisma.order.findUnique({
      where: { orderCode },
      include: {
        items: {
          include: {
            variant: {
              select: {
                name: true,
                product: { select: { name: true, slug: true, images: true } },
              },
            },
          },
        },
      },
    });

    if (!order || normalizePhone(order.customerPhone) !== phone) {
      return Response.json(
        { error: "Không tìm thấy đơn hàng. Vui lòng kiểm tra lại mã đơn và số điện thoại." },
        { status: 404 },
      );
    }

    const canPayAgain =
      order.paymentMethod === "VIETQR" &&
      order.paymentStatus === "UNPAID" &&
      order.status === "PENDING";
    const bankInfo = canPayAgain ? getVietQRBankInfo() : null;
    const vietqrUrl =
      canPayAgain && bankInfo
        ? generateVietQRUrl({ amount: order.totalAmount, orderCode: order.orderCode })
        : null;

    return Response.json(
      {
        order: {
          orderCode: order.orderCode,
          status: order.status,
          paymentMethod: order.paymentMethod,
          paymentStatus: order.paymentStatus,
          createdAt: order.createdAt.toISOString(),
          customerName: order.customerName,
          customerPhoneMasked: maskPhone(order.customerPhone),
          shippingAddress: `${order.shippingAddress}, ${order.ward}, ${order.district}, ${order.province}`,
          note: order.note,
          trackingCode: order.trackingCode,
          shippingPartner: order.shippingPartner,
          subtotal: order.subtotal,
          discountAmount: order.discountAmount,
          shippingFee: order.shippingFee,
          totalAmount: order.totalAmount,
          estimatedDeliveryText: order.estimatedDeliveryText,
          deliveryMinDays: order.deliveryMinDays,
          deliveryMaxDays: order.deliveryMaxDays,
          items: order.items.map((i) => ({
            id: i.id,
            productName: i.variant.product.name,
            productSlug: i.variant.product.slug,
            variantName: i.variant.name,
            image: i.variant.product.images[0] ?? null,
            quantity: i.quantity,
            unitPrice: i.unitPrice,
          })),
          payment:
            canPayAgain && bankInfo && vietqrUrl
              ? { vietqrUrl, bankInfo }
              : null,
        },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (e) {
    console.error("POST /api/tracking failed", e);
    return Response.json(
      { error: "Không thể tra cứu lúc này, vui lòng thử lại sau" },
      { status: 500 },
    );
  }
}
