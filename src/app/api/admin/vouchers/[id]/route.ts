import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ isActive: z.boolean() });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { id } = await ctx.params;
  const res = await prisma.voucher.updateMany({ where: { id }, data: { isActive: parsed.data.isActive } });
  if (res.count === 0) return Response.json({ error: "Không tìm thấy voucher" }, { status: 404 });
  console.info(`[admin] ${guard.user.email} ${parsed.data.isActive ? "bật" : "tắt"} voucher ${id}`);
  return Response.json({ ok: true });
}
