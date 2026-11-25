import { Prisma } from "@prisma/client";
import { guardApi, readJson } from "@/lib/auth/guard";
import { createProduct, ProductConflictError } from "@/lib/admin-product";
import { productInputSchema } from "@/lib/admin-schemas";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const guard = await guardApi(request);
  if (!guard.ok) return guard.response;
  const products = await prisma.product.findMany({
    orderBy: { createdAt: "desc" },
    select: { id: true, name: true, slug: true, isActive: true, isFeatured: true, isCombo: true },
  });
  return Response.json({ products });
}

export async function POST(request: Request) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;

  const parsed = productInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ", field: parsed.error.issues[0]?.path.join(".") },
      { status: 400 },
    );
  }
  try {
    const product = await createProduct(parsed.data);
    console.info(`[admin] ${guard.user.email} tạo sản phẩm ${product.slug}`);
    return Response.json({ product }, { status: 201 });
  } catch (e) {
    if (e instanceof ProductConflictError) return Response.json({ error: e.message }, { status: 409 });
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: "Slug hoặc SKU đã tồn tại" }, { status: 409 });
    }
    console.error("POST /api/admin/products failed", e);
    return Response.json({ error: "Không thể tạo sản phẩm, vui lòng thử lại" }, { status: 500 });
  }
}
