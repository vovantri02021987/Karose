import { Prisma } from "@prisma/client";
import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import { dateFromInput, voucherInputSchema } from "@/lib/admin-schemas";
import { prisma } from "@/lib/prisma";

type Ctx = { params: Promise<{ id: string }> };

const toggleSchema = z.object({ isActive: z.boolean() });

/** Bật/tắt nhanh voucher. */
export async function PATCH(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;
  const parsed = toggleSchema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { id } = await ctx.params;
  const res = await prisma.voucher.updateMany({ where: { id }, data: { isActive: parsed.data.isActive } });
  if (res.count === 0) return Response.json({ error: "Không tìm thấy voucher" }, { status: 404 });
  console.info(`[admin] ${guard.user.email} ${parsed.data.isActive ? "bật" : "tắt"} voucher ${id}`);
  return Response.json({ ok: true });
}

/** Sửa toàn bộ voucher (kể cả phạm vi và danh sách sản phẩm). `usedCount` giữ nguyên. */
export async function PUT(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;

  const parsed = voucherInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const d = parsed.data;
  const { id } = await ctx.params;
  const productIds = d.scope === "PRODUCT" ? [...new Set(d.productIds)] : [];

  try {
    const result = await prisma.$transaction(async (tx) => {
      const current = await tx.voucher.findUnique({ where: { id }, select: { id: true, usedCount: true } });
      if (!current) return "NOT_FOUND" as const;
      if (d.usageLimit != null && d.usageLimit < current.usedCount) return "LIMIT_TOO_LOW" as const;
      if (productIds.length > 0) {
        const found = await tx.product.count({ where: { id: { in: productIds } } });
        if (found !== productIds.length) return "BAD_PRODUCT" as const;
      }
      await tx.voucher.update({
        where: { id },
        data: {
          code: d.code,
          description: d.description || null,
          discountType: d.discountType,
          discountValue: d.discountValue,
          minOrderAmount: d.minOrderAmount,
          maxDiscount: d.maxDiscount ?? null,
          usageLimit: d.usageLimit ?? null,
          startDate: dateFromInput(d.startDate),
          endDate: new Date(`${d.endDate}T23:59:59.999Z`),
          scope: d.scope,
        },
      });
      await tx.voucherProduct.deleteMany({ where: { voucherId: id } });
      if (productIds.length > 0) {
        await tx.voucherProduct.createMany({ data: productIds.map((productId) => ({ voucherId: id, productId })) });
      }
      return "OK" as const;
    });
    if (result === "NOT_FOUND") return Response.json({ error: "Không tìm thấy voucher" }, { status: 404 });
    if (result === "LIMIT_TOO_LOW") {
      return Response.json({ error: "Giới hạn lượt dùng không được nhỏ hơn số lượt đã dùng" }, { status: 400 });
    }
    if (result === "BAD_PRODUCT") {
      return Response.json({ error: "Có sản phẩm được chọn không còn tồn tại" }, { status: 400 });
    }
    console.info(`[admin] ${guard.user.email} sửa voucher ${d.code}`);
    return Response.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: `Mã ${d.code} đã tồn tại` }, { status: 409 });
    }
    console.error("PUT /api/admin/vouchers/[id] failed", e);
    return Response.json({ error: "Không thể lưu voucher, vui lòng thử lại" }, { status: 500 });
  }
}

/** Xoá voucher. Voucher đã gắn vào đơn hàng thì chỉ được tắt (giữ lịch sử đơn). */
export async function DELETE(request: Request, ctx: Ctx) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;

  const voucher = await prisma.voucher.findUnique({
    where: { id },
    select: { code: true, _count: { select: { orders: true } } },
  });
  if (!voucher) return Response.json({ error: "Không tìm thấy voucher" }, { status: 404 });
  if (voucher._count.orders > 0) {
    return Response.json(
      { error: `Mã ${voucher.code} đã được dùng trong ${voucher._count.orders} đơn hàng nên không thể xoá. Hãy tắt mã thay vì xoá.` },
      { status: 409 },
    );
  }
  await prisma.voucher.delete({ where: { id } });
  console.info(`[admin] ${guard.user.email} xoá voucher ${voucher.code}`);
  return Response.json({ ok: true });
}
