import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import { commitShippedStock, releaseReservedStock, StockError } from "@/lib/fefo";
import { ORDER_STATUS_LABEL, type OrderStatusKey } from "@/lib/admin-labels";
import { isPreShipping, isTransitionAllowed } from "@/lib/order-transitions";
import { prisma } from "@/lib/prisma";

const schema = z
  .object({
    status: z
      .enum(["PENDING", "CONFIRMED", "PROCESSING", "SHIPPING", "DELIVERED", "CANCELLED", "RETURNED"])
      .optional(),
    paymentStatus: z.enum(["UNPAID", "PAID", "REFUNDED"]).optional(),
    shippingPartner: z.string().trim().max(60).optional(),
    trackingCode: z.string().trim().max(80).optional(),
  })
  .refine(
    (v) =>
      v.status !== undefined ||
      v.paymentStatus !== undefined ||
      v.shippingPartner !== undefined ||
      v.trackingCode !== undefined,
    { message: "Không có thay đổi nào để cập nhật" },
  );

class ConflictError extends Error {}

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request);
  if (!guard.ok) return guard.response;

  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  const input = parsed.data;

  try {
    const updated = await prisma.$transaction(
      async (tx) => {
        const order = await tx.order.findUnique({
          where: { id },
          select: { id: true, orderCode: true, status: true, voucherId: true },
        });
        if (!order) return null;
        const from = order.status as OrderStatusKey;

        const changeStatus = input.status !== undefined && input.status !== from;
        if (changeStatus && input.status) {
          if (!isTransitionAllowed(from, input.status)) {
            throw new ConflictError(
              `Không thể chuyển đơn từ "${ORDER_STATUS_LABEL[from]}" sang "${ORDER_STATUS_LABEL[input.status]}"`,
            );
          }
          // Khoá lạc quan: chỉ cập nhật nếu trạng thái chưa bị ai đổi trong lúc xử lý.
          const lock = await tx.order.updateMany({
            where: { id, status: from },
            data: { status: input.status },
          });
          if (lock.count !== 1) {
            throw new ConflictError("Đơn hàng vừa được người khác cập nhật, vui lòng tải lại trang");
          }

          if (input.status === "CANCELLED") {
            await releaseReservedStock(tx, id);
            if (order.voucherId) {
              await tx.voucher.updateMany({
                where: { id: order.voucherId, usedCount: { gt: 0 } },
                data: { usedCount: { decrement: 1 } },
              });
            }
          } else if (
            (input.status === "SHIPPING" || input.status === "DELIVERED") &&
            isPreShipping(from)
          ) {
            await commitShippedStock(tx, id);
          }
        }

        return tx.order.update({
          where: { id },
          data: {
            ...(input.paymentStatus ? { paymentStatus: input.paymentStatus } : {}),
            ...(input.shippingPartner !== undefined
              ? { shippingPartner: input.shippingPartner || null }
              : {}),
            ...(input.trackingCode !== undefined ? { trackingCode: input.trackingCode || null } : {}),
          },
          select: {
            id: true,
            orderCode: true,
            status: true,
            paymentStatus: true,
            shippingPartner: true,
            trackingCode: true,
          },
        });
      },
      { timeout: 15_000, maxWait: 10_000 },
    );

    if (!updated) return Response.json({ error: "Không tìm thấy đơn hàng" }, { status: 404 });
    console.info(`[admin] ${guard.user.email} cập nhật đơn ${updated.orderCode}`, JSON.stringify(input));
    return Response.json({ order: updated });
  } catch (e) {
    if (e instanceof ConflictError || e instanceof StockError) {
      return Response.json({ error: e.message }, { status: 409 });
    }
    console.error("PATCH /api/admin/orders/[id]/status failed", e);
    return Response.json({ error: "Không thể cập nhật đơn hàng, vui lòng thử lại" }, { status: 500 });
  }
}
