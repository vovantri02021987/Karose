import { z } from "zod";
import { guardApi, readJson } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";

const patchSchema = z.object({ isActive: z.boolean({ error: "Thiếu trạng thái bật/tắt" }) });

/** Bật/tắt một nguồn kiến thức (ADMIN/STAFF). Nguồn tắt không còn được chatbot trích dẫn. */
export async function PATCH(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, ["ADMIN", "STAFF"]);
  if (!guard.ok) return guard.response;
  const parsed = patchSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const { id } = await ctx.params;
  const found = await prisma.knowledgeSource.findUnique({ where: { id }, select: { id: true } });
  if (!found) return Response.json({ error: "Không tìm thấy nguồn kiến thức" }, { status: 404 });
  const updated = await prisma.knowledgeSource.update({ where: { id }, data: { isActive: parsed.data.isActive } });
  return Response.json({ id: updated.id, isActive: updated.isActive });
}

/** Xoá hẳn một nguồn kiến thức (chỉ ADMIN). */
export async function DELETE(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;
  const { id } = await ctx.params;
  const found = await prisma.knowledgeSource.findUnique({ where: { id }, select: { id: true } });
  if (!found) return Response.json({ error: "Không tìm thấy nguồn kiến thức" }, { status: 404 });
  await prisma.knowledgeSource.delete({ where: { id } });
  return Response.json({ ok: true });
}
