import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { prisma } from "./helpers/prisma";
import { RUN, cleanup, leftovers, makeBatch, makeVariant } from "./helpers/factory";
import { placeOrder } from "./helpers/orders";
import { POST as webhook } from "@/app/api/webhooks/vietqr/route";

const SECRET = process.env.VIETQR_WEBHOOK_SECRET!;

afterAll(async () => {
  await cleanup();
  expect(await leftovers()).toBe(0);
  await prisma.$disconnect();
});

async function call(body: unknown, headers: Record<string, string> = { authorization: `Bearer ${SECRET}` }) {
  const res = await webhook(
    new Request("http://localhost/api/webhooks/vietqr", {
      method: "POST",
      headers: { "content-type": "application/json", ...headers },
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );
  return { status: res.status, body: await res.json() };
}

async function vietqrOrder(qty = 1, price = 200_000) {
  const v = await makeVariant({ price });
  await makeBatch(v.variantId, { expiresInDays: 200, qty: 50 });
  const r = await placeOrder([{ variantId: v.variantId, quantity: qty }], {
    paymentMethod: "VIETQR",
  });
  expect(r.status).toBe(201);
  return r.body.order as { id: string; orderCode: string; totalAmount: number };
}
const orderRow = (id: string) => prisma.order.findUniqueOrThrow({ where: { id } });

describe("3. Webhook VietQR", () => {
  let order: Awaited<ReturnType<typeof vietqrOrder>>;
  beforeEach(async () => {
    order = await vietqrOrder();
  });

  it("3.1 Thiếu header Authorization → 401, đơn không đổi", async () => {
    const r = await call({ content: order.orderCode, transferAmount: order.totalAmount }, {});
    expect(r.status).toBe(401);
    expect((await orderRow(order.id)).paymentStatus).toBe("UNPAID");
  });

  it("3.2 Sai secret / sai scheme / token rỗng → 401", async () => {
    for (const h of [
      "Bearer sai-secret",
      `Bearer ${SECRET}x`,
      `Bearer ${SECRET.slice(0, -1)}`,
      SECRET, // thiếu "Bearer "
      `Basic ${SECRET}`,
      "Bearer ",
      "",
    ]) {
      const r = await call({ content: order.orderCode, transferAmount: order.totalAmount }, { authorization: h });
      expect(r.status, `header="${h}"`).toBe(401);
    }
    expect((await orderRow(order.id)).paymentStatus).toBe("UNPAID");
  });

  it("3.3 Chưa cấu hình VIETQR_WEBHOOK_SECRET → 503 (không mở toang)", async () => {
    const saved = process.env.VIETQR_WEBHOOK_SECRET;
    delete process.env.VIETQR_WEBHOOK_SECRET;
    try {
      const r = await call({ content: order.orderCode, transferAmount: order.totalAmount }, { authorization: "Bearer " });
      expect(r.status).toBe(503);
    } finally {
      process.env.VIETQR_WEBHOOK_SECRET = saved;
    }
  });

  it("3.4 JSON hỏng → 400", async () => {
    expect((await call("{not json")).status).toBe(400);
  });

  it("3.5 Khớp orderCode + đủ tiền → PAID & CONFIRMED, lưu paymentRef", async () => {
    const r = await call({
      content: `MBVCB.123 ${order.orderCode.toLowerCase()} CHUYEN TIEN`, // chữ thường + lẫn nội dung
      transferAmount: order.totalAmount,
      referenceCode: "FT26001",
    });
    expect(r.status).toBe(200);
    expect(r.body).toMatchObject({ success: true, matched: true, orderCode: order.orderCode, updated: true });
    const o = await orderRow(order.id);
    expect(o.paymentStatus).toBe("PAID");
    expect(o.status).toBe("CONFIRMED");
    expect(o.paymentRef).toBe("FT26001");
  });

  it("3.6 Số tiền thiếu → không cập nhật (INSUFFICIENT_AMOUNT); dư tiền → vẫn xác nhận", async () => {
    const short = await call({ content: order.orderCode, transferAmount: order.totalAmount - 1 });
    expect(short.body).toMatchObject({ matched: true, updated: false, reason: "INSUFFICIENT_AMOUNT", expected: order.totalAmount });
    let o = await orderRow(order.id);
    expect([o.paymentStatus, o.status]).toEqual(["UNPAID", "PENDING"]);

    const over = await call({ content: order.orderCode, transferAmount: order.totalAmount + 5000 });
    expect(over.body.updated).toBe(true);
    o = await orderRow(order.id);
    expect([o.paymentStatus, o.status]).toEqual(["PAID", "CONFIRMED"]);
  });

  it("3.7 Định dạng số tiền: chuỗi '470.000 VND', '1,234', field amount", async () => {
    const fmt = order.totalAmount.toLocaleString("vi-VN") + " VND";
    const r = await call({ description: `CK ${order.orderCode}`, amount: fmt });
    expect(r.body.updated).toBe(true);
  });

  it("3.8 Idempotent: gửi lại cùng giao dịch 3 lần → không lỗi, chỉ cập nhật 1 lần", async () => {
    const payload = { content: order.orderCode, transferAmount: order.totalAmount, referenceCode: "FT-IDEM" };
    const r1 = await call(payload);
    const after1 = await orderRow(order.id);
    const r2 = await call(payload);
    const r3 = await call(payload);
    expect(r1.body.updated).toBe(true);
    for (const r of [r2, r3]) {
      expect(r.status).toBe(200);
      expect(r.body).toMatchObject({ matched: true, alreadyPaid: true });
      expect(r.body.updated).toBeUndefined();
    }
    const after3 = await orderRow(order.id);
    expect(after3.paymentStatus).toBe("PAID");
    expect(after3.status).toBe("CONFIRMED");
    expect(after3.paymentRef).toBe("FT-IDEM");
    expect(after3.updatedAt.getTime()).toBe(after1.updatedAt.getTime()); // không ghi lại
  });

  it("3.9 Idempotent đồng thời: 8 webhook song song → đúng 1 lần cập nhật", async () => {
    const payload = { content: order.orderCode, transferAmount: order.totalAmount, referenceCode: "FT-PAR" };
    const rs = await Promise.all(Array.from({ length: 8 }, () => call(payload)));
    expect(rs.every((r) => r.status === 200)).toBe(true);
    expect(rs.filter((r) => r.body.updated === true).length).toBe(1);
    expect((await orderRow(order.id)).paymentStatus).toBe("PAID");
  });

  it("3.10 Không đổi trạng thái đơn đã tiến xa hơn PENDING (giữ nguyên PROCESSING)", async () => {
    await prisma.order.update({ where: { id: order.id }, data: { status: "PROCESSING" } });
    await call({ content: order.orderCode, transferAmount: order.totalAmount });
    const o = await orderRow(order.id);
    expect([o.paymentStatus, o.status]).toEqual(["PAID", "PROCESSING"]);
  });

  it("3.11 Đơn đã huỷ → không đánh dấu PAID (ORDER_CANCELLED)", async () => {
    await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
    const r = await call({ content: order.orderCode, transferAmount: order.totalAmount });
    expect(r.body).toMatchObject({ matched: true, updated: false, reason: "ORDER_CANCELLED" });
    expect((await orderRow(order.id)).paymentStatus).toBe("UNPAID");
  });

  it("3.12 Giao dịch không liên quan → 200 nhưng không khớp (không retry vô hạn)", async () => {
    const none = await call({ content: "CHUYEN TIEN AN TRUA", transferAmount: 50_000 });
    expect(none.status).toBe(200);
    expect(none.body).toMatchObject({ matched: false, reason: "NO_ORDER_CODE" });
    const ghost = await call({ content: "KRZZZZZZ", transferAmount: 50_000 });
    expect(ghost.body).toMatchObject({ matched: false, reason: "ORDER_NOT_FOUND" });
  });

  it("3.13 Đơn COD có mã trong nội dung CK → bị bỏ qua (chỉ VIETQR được xác nhận)", async () => {
    const v = await makeVariant();
    await makeBatch(v.variantId, { expiresInDays: 200, qty: 5 });
    const cod = await placeOrder([{ variantId: v.variantId, quantity: 1 }]);
    const r = await call({ content: cod.body.order.orderCode, transferAmount: cod.body.order.totalAmount });
    expect(r.body).toMatchObject({ matched: false, reason: "ORDER_NOT_FOUND" });
    expect((await orderRow(cod.body.order.id)).paymentStatus).toBe("UNPAID");
  });

  it("3.14a [Điểm yếu] Số tiền chuỗi có dấu âm ('-470000') không được đọc thành dương", async () => {
    const num = await call({ content: order.orderCode, transferAmount: -order.totalAmount });
    expect(num.body.updated, "số âm kiểu number").not.toBe(true); // đã an toàn
    const str = await call({ content: order.orderCode, amount: `-${order.totalAmount}` });
    expect(str.body.updated, "số âm kiểu chuỗi bị bỏ dấu '-'").not.toBe(true);
    expect((await orderRow(order.id)).paymentStatus).toBe("UNPAID");
  });

  it("3.14b [Điểm yếu] Giao dịch chiều RA (transferType='out') không được xác nhận thanh toán", async () => {
    const r = await call({ content: order.orderCode, transferAmount: order.totalAmount, transferType: "out" });
    expect(r.body.updated, "giao dịch chuyển đi vẫn được tính là tiền vào").not.toBe(true);
    expect((await orderRow(order.id)).paymentStatus).toBe("UNPAID");
  });

  it("3.15 [Điểm yếu] Race xác định: đơn bị huỷ ngay giữa lúc webhook đọc và ghi → không được ghi PAID lên đơn CANCELLED", async () => {
    // Chèn lệnh huỷ NGAY TRƯỚC câu updateMany của webhook (sau khi webhook đã đọc đơn còn PENDING).
    const delegate = prisma.order as unknown as { updateMany: (a: unknown) => Promise<unknown> };
    const original = delegate.updateMany;
    let armed = true;
    delegate.updateMany = async function (this: unknown, args: unknown) {
      if (armed) {
        armed = false;
        await prisma.order.update({ where: { id: order.id }, data: { status: "CANCELLED" } });
      }
      return original.call(delegate, args);
    };
    try {
      const { confirmVietQRPayment } = await import("@/lib/payments");
      await confirmVietQRPayment({ content: order.orderCode, amount: order.totalAmount, reference: "RACE" });
    } finally {
      delegate.updateMany = original;
    }
    expect(typeof prisma.order.updateMany).toBe("function");
    const o = await orderRow(order.id);
    expect(`${o.status}/${o.paymentStatus}`).toBe("CANCELLED/UNPAID");
  });

  it("3.16 Tiền tố RUN không ảnh hưởng: mã đơn trong chuỗi dài vẫn khớp đúng một đơn", async () => {
    const r = await call({ content: `${RUN} FT123 ${order.orderCode} BANK`, transferAmount: order.totalAmount });
    expect(r.body.orderCode).toBe(order.orderCode);
  });
});
