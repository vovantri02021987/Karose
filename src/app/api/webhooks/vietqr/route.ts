import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { extractOrderCodes } from "@/lib/vietqr";

/** So sánh chuỗi thời gian hằng định để tránh lộ secret qua timing. */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

const numish = z.union([z.number(), z.string()]);

const payloadSchema = z.looseObject({
  content: z.string().optional(),
  description: z.string().optional(),
  transferAmount: numish.optional(),
  amount: numish.optional(),
  referenceCode: z.string().optional(),
  reference: z.string().optional(),
  id: numish.optional(),
});

export async function POST(request: Request) {
  const secret = process.env.VIETQR_WEBHOOK_SECRET;
  if (!secret) {
    console.error("VIETQR_WEBHOOK_SECRET chưa được cấu hình");
    return Response.json({ error: "Webhook chưa được cấu hình" }, { status: 503 });
  }
  const auth = request.headers.get("authorization") ?? "";
  if (!safeEqual(auth, `Bearer ${secret}`)) {
    return Response.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await request.json();
  } catch {
    return Response.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = payloadSchema.safeParse(json);
  if (!parsed.success) {
    return Response.json({ error: "Invalid payload" }, { status: 400 });
  }
  const p = parsed.data;

  const text = `${p.content ?? ""} ${p.description ?? ""}`;
  const amount = Number(p.transferAmount ?? p.amount ?? 0);
  const ref =
    p.referenceCode ?? p.reference ?? (p.id !== undefined ? String(p.id) : null);

  const codes = extractOrderCodes(text);
  if (codes.length === 0) {
    // 200 để ngân hàng/đối tác không retry vô hạn với giao dịch không liên quan.
    return Response.json({ success: true, matched: false, reason: "NO_ORDER_CODE" });
  }

  const order = await prisma.order.findFirst({
    where: { orderCode: { in: codes } },
    select: {
      id: true,
      orderCode: true,
      status: true,
      paymentStatus: true,
      totalAmount: true,
    },
  });
  if (!order) {
    return Response.json({ success: true, matched: false, reason: "ORDER_NOT_FOUND" });
  }

  // Idempotent: đã thanh toán thì trả 200 ngay.
  if (order.paymentStatus === "PAID") {
    return Response.json({
      success: true,
      matched: true,
      orderCode: order.orderCode,
      alreadyPaid: true,
    });
  }

  if (order.status === "CANCELLED") {
    return Response.json({
      success: true,
      matched: true,
      orderCode: order.orderCode,
      updated: false,
      reason: "ORDER_CANCELLED",
    });
  }

  if (!Number.isFinite(amount) || amount < order.totalAmount) {
    return Response.json({
      success: true,
      matched: true,
      orderCode: order.orderCode,
      updated: false,
      reason: "INSUFFICIENT_AMOUNT",
      expected: order.totalAmount,
      received: Number.isFinite(amount) ? amount : 0,
    });
  }

  // Chỉ chuyển UNPAID -> PAID một lần (an toàn khi webhook bắn đồng thời).
  const result = await prisma.order.updateMany({
    where: { id: order.id, paymentStatus: "UNPAID" },
    data: {
      paymentStatus: "PAID",
      ...(order.status === "PENDING" ? { status: "CONFIRMED" } : {}),
      paymentRef: ref,
    },
  });

  return Response.json({
    success: true,
    matched: true,
    orderCode: order.orderCode,
    updated: result.count === 1,
    alreadyPaid: result.count === 0,
  });
}
