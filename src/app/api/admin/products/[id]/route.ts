import { Prisma } from "@prisma/client";
import { guardApi, readJson } from "@/lib/auth/guard";
import { ProductConflictError, updateProduct } from "@/lib/admin-product";
import { productInputSchema } from "@/lib/admin-schemas";

export async function PUT(request: Request, ctx: { params: Promise<{ id: string }> }) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;

  const parsed = productInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ", field: parsed.error.issues[0]?.path.join(".") },
      { status: 400 },
    );
  }
  const { id } = await ctx.params;
  try {
    const product = await updateProduct(id, parsed.data);
    if (!product) return Response.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
    console.info(`[admin] ${guard.user.email} cập nhật sản phẩm ${product.slug}`);
    return Response.json({ product });
  } catch (e) {
    if (e instanceof ProductConflictError) return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "Slug hoặc SKU đã tồn tại" }, { status: 409 });
    }
    console.error("PUT /api/admin/products/[id] failed", e);
    return Response.json({ error: "Không thể cập nhật sản phẩm, vui lòng thử lại" }, { status: 500 });
  }
}
