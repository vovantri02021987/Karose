import { z } from "zod";
import { confirmVietQRPayment } from "@/lib/payments";

/** So sánh chuỗi thời gian hằng định để tránh lộ secret qua timing. */
function safeEqual(a: string, b: string): boolean {
  const len = Math.max(a.length, b.length);
  let diff = a.length ^ b.length;
  for (let i = 0; i < len; i++) {
    diff |= (a.charCodeAt(i) || 0) ^ (b.charCodeAt(i) || 0);
  }
  return diff === 0;
}

/** Chấp nhận 470000, "470000", "470,000", "470.000 VND" (VND không có phần thập phân). */
function parseAmount(raw: number | string | undefined): number {
  if (typeof raw === "number") return Number.isFinite(raw) ? Math.trunc(raw) : 0;
  if (typeof raw === "string") {
    const digits = raw.replace(/[^\d]/g, "");
    return digits ? Number(digits) : 0;
  }
  return 0;
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

  const result = await confirmVietQRPayment({
    content: `${p.content ?? ""} ${p.description ?? ""}`,
    amount: parseAmount(p.transferAmount ?? p.amount),
    reference:
      p.referenceCode ?? p.reference ?? (p.id !== undefined ? String(p.id) : null),
  });

  // Luôn 200 với giao dịch không liên quan để ngân hàng/đối tác không retry vô hạn.
  return Response.json({ success: true, ...result });
}
