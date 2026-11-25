import { z } from "zod";
import { prisma } from "@/lib/prisma";

const reviewSchema = z.object({
  productId: z.string().min(1),
  authorName: z.string().trim().min(2, "Vui lòng nhập họ tên").max(80),
  rating: z.number().int().min(1).max(5),
  comment: z
    .string()
    .trim()
    .min(10, "Nhận xét cần ít nhất 10 ký tự")
    .max(1000),
  website: z.string().optional(), // honeypot
});

/** Khách gửi đánh giá mới: lưu isApproved=false, chờ Admin duyệt. */
export async function POST(request: Request) {
  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Dữ liệu không hợp lệ" }, { status: 400 });
  }

  const parsed = reviewSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json(
      { error: parsed.error.issues[0]?.message ?? "Dữ liệu không hợp lệ" },
      { status: 400 },
    );
  }
  const data = parsed.data;

  const okMessage =
    "Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi được KAROSE duyệt.";

  // Bot điền ô ẩn: trả về như thành công nhưng không lưu.
  if (data.website) {
    return Response.json({ message: okMessage }, { status: 201 });
  }

  const product = await prisma.product.findUnique({
    where: { id: data.productId },
    select: { id: true, isActive: true },
  });
  if (!product || !product.isActive) {
    return Response.json({ error: "Không tìm thấy sản phẩm" }, { status: 404 });
  }

  await prisma.review.create({
    data: {
      productId: product.id,
      authorName: data.authorName,
      rating: data.rating,
      comment: data.comment,
      isApproved: false,
    },
  });

  return Response.json({ message: okMessage }, { status: 201 });
}
