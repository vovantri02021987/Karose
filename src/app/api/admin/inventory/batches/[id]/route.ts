import { guardApi, readJson } from "@/lib/auth/guard";
import { batchAdjustSchema } from "@/lib/admin-schemas";
import { prisma } from "@/lib/prisma";

class AdjustError extends Error {}

/**
 * Kiểm kê nhanh: nhân viên nhập SỐ ĐẾM THỰC TẾ trong kho (gồm cả hàng đang giữ cho đơn).
 * availableQuantity mới = số đếm − reservedQuantity; không cho âm số đang giữ.
 */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request);
  if (!guard.ok) return guard.response;

  const parsed = batchAdjustSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const { countedQuantity, reason } = parsed.data;

  try {
    const result = await prisma.$transaction(async (tx) => {
      const batch = await tx.inventoryBatch.findUnique({
        where: { id },
        select: { id: true, batchCode: true, availableQuantity: true, reservedQuantity: true },
      });
      if (!batch) return null;
      if (countedQuantity < batch.reservedQuantity) {
        throw new AdjustError(
          `Số đếm (${countedQuantity}) nhỏ hơn số đang giữ cho đơn hàng (${batch.reservedQuantity}). Hãy xử lý các đơn đang giữ hàng trước.`,
        );
      }
      const newAvailable = countedQuantity - batch.reservedQuantity;
      // Khoá lạc quan: chỉ ghi nếu đơn hàng chưa thay đổi số đang giữ/còn lại trong lúc kiểm kê.
      const updated = await tx.inventoryBatch.updateMany({
        where: {
          id,
          reservedQuantity: batch.reservedQuantity,
          availableQuantity: batch.availableQuantity,
        },
        data: { availableQuantity: newAvailable },
      });
      if (updated.count !== 1) {
        throw new AdjustError("Tồn kho của lô vừa thay đổi do có đơn hàng, vui lòng tải lại và kiểm kê lại");
      }
      return {
        id: batch.id,
        batchCode: batch.batchCode,
        before: batch.availableQuantity,
        after: newAvailable,
        reserved: batch.reservedQuantity,
      };
    });
    if (!result) return Response.json({ error: "Không tìm thấy lô hàng" }, { status: 404 });
    console.info(
      `[admin] ${guard.user.email} kiểm kê lô ${result.batchCode}: khả dụng ${result.before} → ${result.after} (giữ ${result.reserved}). Lý do: ${reason}`,
    );
    return Response.json({ batch: result });
  } catch (e) {
    if (e instanceof AdjustError) return Response.json({ error: e.message }, { status: 409 });
    console.error("PATCH /api/admin/inventory/batches/[id] failed", e);
    return Response.json({ error: "Không thể điều chỉnh tồn kho, vui lòng thử lại" }, { status: 500 });
  }
}
