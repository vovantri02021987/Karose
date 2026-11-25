import { Prisma } from "@prisma/client";
import { guardApi, readJson } from "@/lib/auth/guard";
import { dateFromInput, voucherInputSchema } from "@/lib/admin-schemas";
import { prisma } from "@/lib/prisma";

export async function POST(request: Request) {
  const guard = await guardApi(request, ["ADMIN"]);
  if (!guard.ok) return guard.response;

  const parsed = voucherInputSchema.safeParse(await readJson(request));
  if (!parsed.success) {
    return Response.json({ error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const voucher = await prisma.voucher.create({
      data: {
        code: d.code,
        description: d.description || null,
        discountType: d.discountType,
        discountValue: d.discountValue,
        minOrderAmount: d.minOrderAmount,
        maxDiscount: d.maxDiscount ?? null,
        usageLimit: d.usageLimit ?? null,
        startDate: dateFromInput(d.startDate),
        // Kết thúc vào cuối ngày được chọn.
        endDate: new Date(`${d.endDate}T23:59:59.999Z`),
        isActive: true,
      },
      select: { id: true, code: true },
    });
    console.info(`[admin] ${guard.user.email} tạo voucher ${voucher.code}`);
    return Response.json({ voucher }, { status: 201 });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return Response.json({ error: `Mã ${d.code} đã tồn tại` }, { status: 409 });
    }
    console.error("POST /api/admin/vouchers failed", e);
    return Response.json({ error: "Không thể tạo voucher, vui lòng thử lại" }, { status: 500 });
  }
}
