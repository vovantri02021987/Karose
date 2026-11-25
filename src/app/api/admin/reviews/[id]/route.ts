import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

const schema = z.object({ isApproved: z.boolean() });

export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;
  const parsed = schema.safeParse(await readJson(request));
  if (!parsed.success) return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  const { id } = await ctx.params;
  const res = await prisma.review.updateMany({ where: { id }, data: { isApproved: parsed.data.isApproved } });
  if (res.count === 0) return Response.json({ error: "Không tìm thấy đánh giá" }, { status: 404 });
  console.info(`[admin] ${guard.user.email} ${parsed.data.isApproved ? "duyệt" : "bỏ duyệt"} đánh giá ${id}`);
  return Response.json({ ok: true });
}

export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const res = await prisma.review.deleteMany({ where: { id } });
  if (res.count === 0) return Response.json({ error: "Không tìm thấy đánh giá" }, { status: 404 });
  console.info(`[admin] ${guard.user.email} xoá đánh giá ${id}`);
  return Response.json({ ok: true });
}
