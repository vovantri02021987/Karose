import { guardApi, readJson } from "@/lib/auth/guard";
import { batchInputSchema, dateFromInput } from "@/lib/admin-schemas";
import { prisma } from "@/lib/prisma";

export async function GET(request: Request) {
  const guard = await guardApi(request);
  if (!guard.ok) return guard.response;
  const variantId = new URL(request.url).searchParams.get("variantId") ?? undefined;
  const batches = await prisma.inventoryBatch.findMany({
    where: variantId ? { variantId } : undefined,
    orderBy: { expiryDate: "asc" },
    select: {
      id: true,
      variantId: true,
      batchCode: true,
      manufacturedDate: true,
      expiryDate: true,
      initialQuantity: true,
      availableQuantity: true,
      reservedQuantity: true,
    },
  });
  return Response.json({ batches });
}

export async function POST(request: Request) {
  const guard = await guardApi(request);
  if (!guard.ok) return guard.response;

  const parsed = batchInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const d = parsed.data;

  try {
    const variant = await prisma.productVariant.findUnique({
      where: { id: d.variantId },
      select: { id: true, sku: true, product: { select: { isCombo: true } } },
    });
    if (!variant) return Response.json({ error: "Biến thể không tồn tại" }, { status: 404 });
    if (variant.product.isCombo) {
      return Response.json({ error: "Combo không có lô riêng; hãy nhập lô cho các sản phẩm thành phần" }, { status: 409 });
    }
    const duplicate = await prisma.inventoryBatch.findFirst({
      where: { variantId: d.variantId, batchCode: d.batchCode },
      select: { id: true },
    });
    if (duplicate) {
      return Response.json({ error: `Mã lô ${d.batchCode} đã tồn tại cho biến thể này` }, { status: 409 });
    }
    const batch = await prisma.inventoryBatch.create({
      data: {
        variantId: d.variantId,
        batchCode: d.batchCode,
        manufacturedDate: dateFromInput(d.manufacturedDate),
        expiryDate: dateFromInput(d.expiryDate),
        initialQuantity: d.initialQuantity,
        availableQuantity: d.initialQuantity,
        reservedQuantity: 0,
      },
      select: { id: true, batchCode: true },
    });
    console.info(`[admin] ${guard.user.email} nhập lô ${batch.batchCode} (${variant.sku}) SL ${d.initialQuantity}`);
    return Response.json({ batch }, { status: 201 });
  } catch (e) {
    console.error("POST /api/admin/inventory/batches failed", e);
    return Response.json({ error: "Không thể nhập lô, vui lòng thử lại" }, { status: 500 });
  }
}
