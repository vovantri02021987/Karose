import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { prisma } from "./helpers/prisma";
import {
  batchState,
  cleanup,
  leftovers,
  makeBatch,
  makeCombo,
  makeUser,
  makeVariant,
  makeVoucher,
} from "./helpers/factory";
import { placeOrder } from "./helpers/orders";
import { loginAs, patchStatus } from "./helpers/admin";

beforeAll(async () => {
  await loginAs(await makeUser("ADMIN"));
});
afterAll(async () => {
  await cleanup();
  expect(await leftovers()).toBe(0);
  await prisma.$disconnect();
});

/** 2 lô: lô sớm (+60d) tồn 5, lô muộn (+200d) tồn 20. Đặt 8 → 5 từ lô sớm + 3 từ lô muộn. */
async function twoLotOrder(qty = 8, extra: Record<string, unknown> = {}) {
  const v = await makeVariant();
  const early = await makeBatch(v.variantId, { expiresInDays: 60, qty: 5 });
  const late = await makeBatch(v.variantId, { expiresInDays: 200, qty: 20 });
  const r = await placeOrder([{ variantId: v.variantId, quantity: qty }], extra);
  expect(r.status).toBe(201);
  return { v, early, late, order: r.body.order as { id: string; orderCode: string } };
}
const statusOf = async (id: string) => (await prisma.order.findUniqueOrThrow({ where: { id } })).status;

describe("4. Huỷ đơn hoàn kho & giao hàng chốt xuất kho", () => {
  it("4.1 CANCELLED: hoàn đúng availableQuantity và giảm reservedQuantity vào đúng lô đã giữ", async () => {
    const { early, late, order } = await twoLotOrder(8);
    expect(await batchState(early)).toEqual({ available: 0, reserved: 5 });
    expect(await batchState(late)).toEqual({ available: 17, reserved: 3 });

    const r = await patchStatus(order.id, { status: "CANCELLED" });
    expect(r.status).toBe(200);
    expect(r.body.order.status).toBe("CANCELLED");
    expect(await batchState(early)).toEqual({ available: 5, reserved: 0 });
    expect(await batchState(late)).toEqual({ available: 20, reserved: 0 });
  });

  it("4.2 Huỷ một đơn không đụng phần giữ của đơn khác trên cùng lô", async () => {
    const v = await makeVariant();
    const lot = await makeBatch(v.variantId, { expiresInDays: 100, qty: 10 });
    const o1 = (await placeOrder([{ variantId: v.variantId, quantity: 3 }])).body.order;
    const o2 = (await placeOrder([{ variantId: v.variantId, quantity: 4 }])).body.order;
    expect(await batchState(lot)).toEqual({ available: 3, reserved: 7 });
    await patchStatus(o1.id, { status: "CANCELLED" });
    expect(await batchState(lot)).toEqual({ available: 6, reserved: 4 }); // phần của o2 còn nguyên
    expect(await statusOf(o2.id)).toBe("PENDING");
  });

  it("4.3 Huỷ đơn combo hoàn đúng lô của từng thành phần con", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    const a1 = await makeBatch(a.variantId, { expiresInDays: 60, qty: 3 });
    const a2 = await makeBatch(a.variantId, { expiresInDays: 200, qty: 10 });
    const b1 = await makeBatch(b.variantId, { expiresInDays: 90, qty: 5 });
    const combo = await makeCombo([
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 1 },
    ]);
    const o = (await placeOrder([{ variantId: combo.variantId, quantity: 2 }])).body.order;
    expect(await batchState(a1)).toEqual({ available: 0, reserved: 3 });
    expect(await batchState(a2)).toEqual({ available: 9, reserved: 1 });
    expect(await batchState(b1)).toEqual({ available: 3, reserved: 2 });
    await patchStatus(o.id, { status: "CANCELLED" });
    expect(await batchState(a1)).toEqual({ available: 3, reserved: 0 });
    expect(await batchState(a2)).toEqual({ available: 10, reserved: 0 });
    expect(await batchState(b1)).toEqual({ available: 5, reserved: 0 });
  });

  it("4.4 Huỷ lặp lại đơn đã CANCELLED không cộng dư kho lần 2 (tuần tự)", async () => {
    const { early, late, order } = await twoLotOrder(8);
    expect((await patchStatus(order.id, { status: "CANCELLED" })).status).toBe(200);
    const again1 = await patchStatus(order.id, { status: "CANCELLED" });
    const again2 = await patchStatus(order.id, { status: "CANCELLED" });
    expect([again1.status, again2.status].every((s) => s === 200 || s === 409)).toBe(true);
    expect(await batchState(early)).toEqual({ available: 5, reserved: 0 });
    expect(await batchState(late)).toEqual({ available: 20, reserved: 0 });
  });

  it("4.5 Huỷ đồng thời 6 request cho cùng đơn → chỉ hoàn kho 1 lần", async () => {
    const { early, late, order } = await twoLotOrder(8);
    const rs = await Promise.all(Array.from({ length: 6 }, () => patchStatus(order.id, { status: "CANCELLED" })));
    expect(rs.every((r) => r.status === 200 || r.status === 409)).toBe(true); // không 500
    expect(await batchState(early)).toEqual({ available: 5, reserved: 0 });
    expect(await batchState(late)).toEqual({ available: 20, reserved: 0 });
  });

  it("4.6 Huỷ hoàn lượt dùng voucher (không xuống dưới 0)", async () => {
    const voucher = await makeVoucher({ usageLimit: 3 });
    const { order } = await twoLotOrder(2, { voucherCode: voucher.code });
    expect((await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } })).usedCount).toBe(1);
    await patchStatus(order.id, { status: "CANCELLED" });
    await patchStatus(order.id, { status: "CANCELLED" });
    expect((await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } })).usedCount).toBe(0);
  });

  it("4.7 SHIPPING: giảm reservedQuantity (chốt xuất kho), availableQuantity giữ nguyên", async () => {
    const { early, late, order } = await twoLotOrder(8);
    const r = await patchStatus(order.id, { status: "SHIPPING", shippingPartner: "GHN", trackingCode: "GHN123" });
    expect(r.status).toBe(200);
    expect(r.body.order).toMatchObject({ status: "SHIPPING", shippingPartner: "GHN", trackingCode: "GHN123" });
    expect(await batchState(early)).toEqual({ available: 0, reserved: 0 });
    expect(await batchState(late)).toEqual({ available: 17, reserved: 0 });
    // DELIVERED sau SHIPPING không trừ thêm
    expect((await patchStatus(order.id, { status: "DELIVERED" })).status).toBe(200);
    expect(await batchState(late)).toEqual({ available: 17, reserved: 0 });
  });

  it("4.8 Đi tuần tự PENDING→CONFIRMED→PROCESSING→SHIPPING: chỉ chốt kho đúng 1 lần, ở bước SHIPPING", async () => {
    const { late, order } = await twoLotOrder(8);
    await patchStatus(order.id, { status: "CONFIRMED" });
    await patchStatus(order.id, { status: "PROCESSING" });
    expect(await batchState(late)).toEqual({ available: 17, reserved: 3 }); // chưa xuất
    await patchStatus(order.id, { status: "SHIPPING" });
    expect(await batchState(late)).toEqual({ available: 17, reserved: 0 });
  });

  it("4.9 Nhảy cóc PENDING→DELIVERED vẫn chốt kho đúng 1 lần", async () => {
    const { late, order } = await twoLotOrder(8);
    expect((await patchStatus(order.id, { status: "DELIVERED" })).status).toBe(200);
    expect(await batchState(late)).toEqual({ available: 17, reserved: 0 });
  });

  it("4.10 Đã SHIPPING thì không huỷ được (409) và kho không đổi; RETURNED được phép", async () => {
    const { late, order } = await twoLotOrder(8);
    await patchStatus(order.id, { status: "SHIPPING" });
    const bad = await patchStatus(order.id, { status: "CANCELLED" });
    expect(bad.status).toBe(409);
    expect(await statusOf(order.id)).toBe("SHIPPING");
    expect(await batchState(late)).toEqual({ available: 17, reserved: 0 });
    expect((await patchStatus(order.id, { status: "RETURNED" })).status).toBe(200);
  });

  it("4.11 CANCELLED là trạng thái cuối: không mở lại sang CONFIRMED/SHIPPING", async () => {
    const { late, order } = await twoLotOrder(8);
    await patchStatus(order.id, { status: "CANCELLED" });
    for (const s of ["CONFIRMED", "PROCESSING", "SHIPPING", "DELIVERED", "PENDING"] as const) {
      expect((await patchStatus(order.id, { status: s })).status, s).toBe(409);
    }
    expect(await batchState(late)).toEqual({ available: 20, reserved: 0 });
  });

  it("4.12 Dữ liệu giữ kho lệch (reserved < đã cấp phát) → huỷ bị chặn 409 và trạng thái được rollback", async () => {
    const { late, order } = await twoLotOrder(8);
    await prisma.inventoryBatch.update({ where: { id: late }, data: { reservedQuantity: 1 } }); // < 3
    const r = await patchStatus(order.id, { status: "CANCELLED" });
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/không khớp/);
    expect(await statusOf(order.id)).toBe("PENDING"); // không để đơn CANCELLED mà kho chưa hoàn
    expect(await batchState(late)).toEqual({ available: 17, reserved: 1 });
  });

  it("4.13 Đơn không tồn tại → 404; trạng thái không hợp lệ → 400", async () => {
    expect((await patchStatus("khong-ton-tai", { status: "CANCELLED" })).status).toBe(404);
    const { order } = await twoLotOrder(1);
    expect((await patchStatus(order.id, { status: "BLAH" })).status).toBe(400);
    expect((await patchStatus(order.id, {})).status).toBe(400);
  });

  it("4.14 Bất biến kho: initial = available + reserved + đã xuất, sau chuỗi đơn/huỷ/giao hỗn hợp", async () => {
    const v = await makeVariant();
    const lot = await makeBatch(v.variantId, { expiresInDays: 150, qty: 30 });
    const orders = [];
    for (const q of [3, 5, 2, 7, 4]) orders.push((await placeOrder([{ variantId: v.variantId, quantity: q }])).body.order);
    await patchStatus(orders[0].id, { status: "CANCELLED" }); // +3
    await patchStatus(orders[1].id, { status: "SHIPPING" }); // 5 đã xuất
    await patchStatus(orders[2].id, { status: "DELIVERED" }); // 2 đã xuất
    await patchStatus(orders[3].id, { status: "CANCELLED" }); // +7
    // orders[4] (4) vẫn đang giữ
    const s = await batchState(lot);
    expect(s).toEqual({ available: 30 - 5 - 2 - 4, reserved: 4 });
    expect(s.available + s.reserved + (5 + 2)).toBe(30);
  });
});
