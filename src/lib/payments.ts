import { prisma } from "@/lib/prisma";
import { extractOrderCodes } from "@/lib/vietqr";

export type PaymentConfirmResult =
  | { matched: false; reason: "NO_ORDER_CODE" | "ORDER_NOT_FOUND" }
  | {
      matched: true;
      orderCode: string;
      updated?: boolean;
      alreadyPaid?: boolean;
      reason?: "ORDER_CANCELLED" | "INSUFFICIENT_AMOUNT";
      expected?: number;
      received?: number;
    };

/**
 * Xác nhận thanh toán VietQR từ nội dung chuyển khoản. Dùng chung cho webhook
 * ngân hàng và route giả lập (dev). Idempotent: đơn đã PAID thì không xử lý lại.
 */
export async function confirmVietQRPayment(params: {
  content: string;
  amount: number;
  reference: string | null;
}): Promise<PaymentConfirmResult> {
  const codes = extractOrderCodes(params.content);
  if (codes.length === 0) return { matched: false, reason: "NO_ORDER_CODE" };

  const order = await prisma.order.findFirst({
    where: { orderCode: { in: codes } },
    select: {
      id: true,
      orderCode: true,
      status: true,
      paymentStatus: true,
      paymentMethod: true,
      totalAmount: true,
    },
  });
  if (!order || order.paymentMethod !== "VIETQR") {
    return { matched: false, reason: "ORDER_NOT_FOUND" };
  }

  if (order.paymentStatus === "PAID") {
    return { matched: true, orderCode: order.orderCode, alreadyPaid: true };
  }
  if (order.status === "CANCELLED") {
    return {
      matched: true,
      orderCode: order.orderCode,
      updated: false,
      reason: "ORDER_CANCELLED",
    };
  }
  if (params.amount < order.totalAmount) {
    return {
      matched: true,
      orderCode: order.orderCode,
      updated: false,
      reason: "INSUFFICIENT_AMOUNT",
      expected: order.totalAmount,
      received: params.amount,
    };
  }

  // Chỉ chuyển UNPAID -> PAID một lần (an toàn khi webhook bắn đồng thời).
  const result = await prisma.order.updateMany({
    // Không ghi PAID lên đơn vừa bị huỷ giữa lúc đọc và lúc cập nhật.
    where: { id: order.id, paymentStatus: "UNPAID", status: { not: "CANCELLED" } },
    data: {
      paymentStatus: "PAID",
      ...(order.status === "PENDING" ? { status: "CONFIRMED" } : {}),
      paymentRef: params.reference,
    },
  });

  return {
    matched: true,
    orderCode: order.orderCode,
    updated: result.count === 1,
    alreadyPaid: result.count === 0,
  };
}
