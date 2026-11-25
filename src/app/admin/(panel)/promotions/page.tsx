import { requireStaffPage } from "@/lib/auth/guard";
import { prisma } from "@/lib/prisma";
import PromotionsClient, { type ReviewRow, type VoucherRow } from "./PromotionsClient";

export default async function PromotionsPage() {
  const user = await requireStaffPage();
  const [vouchers, reviews] = await Promise.all([
    prisma.voucher.findMany({ orderBy: { endDate: "desc" } }),
    prisma.review.findMany({
      orderBy: [{ isApproved: "asc" }, { createdAt: "desc" }],
      take: 100,
      include: { product: { select: { name: true } } },
    }),
  ]);

  const nowMs = new Date().getTime();
  const voucherRows: VoucherRow[] = vouchers.map((v) => ({
    id: v.id,
    code: v.code,
    description: v.description ?? "",
    discountType: v.discountType,
    discountValue: v.discountValue,
    minOrderAmount: v.minOrderAmount,
    maxDiscount: v.maxDiscount,
    usageLimit: v.usageLimit,
    usedCount: v.usedCount,
    startDate: v.startDate.toISOString(),
    endDate: v.endDate.toISOString(),
    isActive: v.isActive,
    state: !v.isActive
      ? "Đã tắt"
      : v.endDate.getTime() < nowMs
        ? "Hết hạn"
        : v.usageLimit !== null && v.usedCount >= v.usageLimit
          ? "Hết lượt"
          : "Đang chạy",
  }));
  const reviewRows: ReviewRow[] = reviews.map((r) => ({
    id: r.id,
    productName: r.product.name,
    authorName: r.authorName,
    rating: r.rating,
    comment: r.comment,
    isApproved: r.isApproved,
    createdAt: r.createdAt.toISOString(),
  }));

  return <PromotionsClient vouchers={voucherRows} reviews={reviewRows} canEdit={user.role === "ADMIN"} />;
}
