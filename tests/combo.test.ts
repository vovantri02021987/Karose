import { afterAll, describe, expect, it } from "vitest";
import { prisma } from "./helpers/prisma";
import {
  batchState,
  cleanup,
  leftovers,
  makeBatch,
  makeCombo,
  makeVariant,
} from "./helpers/factory";
import { placeOrder } from "./helpers/orders";
import { getProductSellableStock, getSellableStock } from "@/lib/fefo";

afterAll(async () => {
  await cleanup();
  expect(await leftovers()).toBe(0);
  await prisma.$disconnect();
});

/** Combo = 2 × A + 1 × B, mỗi thành phần có 2 lô. */
async function setup() {
  const a = await makeVariant({ name: "Thành phần A" });
  const b = await makeVariant({ name: "Thành phần B" });
  const a1 = await makeBatch(a.variantId, { expiresInDays: 60, qty: 3, code: "A1" });
  const a2 = await makeBatch(a.variantId, { expiresInDays: 200, qty: 10, code: "A2" });
  const b1 = await makeBatch(b.variantId, { expiresInDays: 90, qty: 2, code: "B1" });
  const b2 = await makeBatch(b.variantId, { expiresInDays: 250, qty: 10, code: "B2" });
  const combo = await makeCombo(
    [
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 1 },
    ],
    300_000,
  );
  return { a, b, a1, a2, b1, b2, combo };
}

describe("2. Combo Explosion", () => {
  it("2.1 Đặt combo trừ đúng ComboItem (quantity × số lượng đặt) theo FEFO, lưu vết gộp các thành phần", async () => {
    const s = await setup();
    const r = await placeOrder([{ variantId: s.combo.variantId, quantity: 2 }]);
    expect(r.status).toBe(201);
    // A cần 2×2=4: lô A1(+60d) lấy 3, A2 lấy 1.  B cần 1×2=2: lô B1(+90d) lấy 2.
    expect(await batchState(s.a1)).toEqual({ available: 0, reserved: 3 });
    expect(await batchState(s.a2)).toEqual({ available: 9, reserved: 1 });
    expect(await batchState(s.b1)).toEqual({ available: 0, reserved: 2 });
    expect(await batchState(s.b2)).toEqual({ available: 10, reserved: 0 });

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: r.body.order.id } });
    expect(item.variantId).toBe(s.combo.variantId);
    expect(item.quantity).toBe(2);
    const alloc = (item.batchAllocated as { batchId: string; quantity: number }[]).sort((x, y) =>
      x.batchId.localeCompare(y.batchId),
    );
    expect(alloc).toEqual(
      [
        { batchId: s.a1, batchCode: "A1", quantity: 3 },
        { batchId: s.a2, batchCode: "A2", quantity: 1 },
        { batchId: s.b1, batchCode: "B1", quantity: 2 },
      ].sort((x, y) => x.batchId.localeCompare(y.batchId)),
    );
    // Giá lấy từ biến thể combo (300.000 × 2 = 600.000) → freeship ≥ 500.000
    expect(r.body.order.subtotal).toBe(600_000);
    expect(r.body.order.shippingFee).toBe(0);
  });

  it("2.2 Thành phần A thiếu → từ chối cả combo, B không bị trừ dở dang", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    const a1 = await makeBatch(a.variantId, { expiresInDays: 100, qty: 3 }); // cần 2×2=4
    const b1 = await makeBatch(b.variantId, { expiresInDays: 100, qty: 50 });
    const combo = await makeCombo([
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 1 },
    ]);
    const before = await prisma.order.count();
    const r = await placeOrder([{ variantId: combo.variantId, quantity: 2 }]);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/không đủ số lượng tồn kho khả dụng/);
    expect(await prisma.order.count()).toBe(before);
    expect(await batchState(a1)).toEqual({ available: 3, reserved: 0 });
    expect(await batchState(b1)).toEqual({ available: 50, reserved: 0 });
  });

  it("2.3 Thành phần B (đứng sau) thiếu → A (đã đủ) không bị trừ", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    const a1 = await makeBatch(a.variantId, { expiresInDays: 100, qty: 50 });
    const b1 = await makeBatch(b.variantId, { expiresInDays: 100, qty: 1 }); // cần 2
    const combo = await makeCombo([
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 1 },
    ]);
    const r = await placeOrder([{ variantId: combo.variantId, quantity: 2 }]);
    expect(r.status).toBe(409);
    expect(await batchState(a1)).toEqual({ available: 50, reserved: 0 });
    expect(await batchState(b1)).toEqual({ available: 1, reserved: 0 });
  });

  it("2.4 Thành phần chỉ còn lô cận hạn → combo bị từ chối (cùng quy tắc 30 ngày)", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    await makeBatch(a.variantId, { expiresInDays: 100, qty: 50 });
    const bNear = await makeBatch(b.variantId, { expiresInDays: 20, qty: 50 });
    const combo = await makeCombo([
      { variantId: a.variantId, quantity: 1 },
      { variantId: b.variantId, quantity: 1 },
    ]);
    expect(await getSellableStock(combo.variantId)).toBe(0);
    const r = await placeOrder([{ variantId: combo.variantId, quantity: 1 }]);
    expect(r.status).toBe(409);
    expect(await batchState(bNear)).toEqual({ available: 50, reserved: 0 });
  });

  it("2.5 Tồn khả dụng của combo = min(floor(tồn con / quantity))", async () => {
    const s = await setup();
    // A: 13 / 2 = 6 ; B: 12 / 1 = 12  → 6
    expect(await getSellableStock(s.combo.variantId)).toBe(6);
    expect(await getProductSellableStock(s.combo.productId)).toBe(6);
  });

  it("2.6 Combo + sản phẩm lẻ cùng thành phần trong một đơn: nhu cầu được gộp, không bán lố", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    const a1 = await makeBatch(a.variantId, { expiresInDays: 100, qty: 4 });
    await makeBatch(b.variantId, { expiresInDays: 100, qty: 10 });
    const combo = await makeCombo([
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 1 },
    ]);
    // combo ×1 cần 2A, lẻ A ×3 → tổng 5A > 4A
    const over = await placeOrder([
      { variantId: combo.variantId, quantity: 1 },
      { variantId: a.variantId, quantity: 3 },
    ]);
    expect(over.status).toBe(409);
    expect(await batchState(a1)).toEqual({ available: 4, reserved: 0 });
    // combo ×1 (2A) + lẻ A ×2 = 4A đúng bằng tồn → được
    const ok = await placeOrder([
      { variantId: combo.variantId, quantity: 1 },
      { variantId: a.variantId, quantity: 2 },
    ]);
    expect(ok.status).toBe(201);
    expect(await batchState(a1)).toEqual({ available: 0, reserved: 4 });
  });

  it("2.7 Combo chưa cấu hình thành phần → từ chối an toàn", async () => {
    const empty = await makeVariant({ isCombo: true });
    const r = await placeOrder([{ variantId: empty.variantId, quantity: 1 }]);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/chưa được cấu hình thành phần/);
  });

  it("2.8 Đồng thời: 6 đơn combo trên tồn đủ cho 3 → đúng 3 thành công, kho không âm", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    const a1 = await makeBatch(a.variantId, { expiresInDays: 100, qty: 6 }); // 3 combo (2A)
    const b1 = await makeBatch(b.variantId, { expiresInDays: 100, qty: 100 });
    const combo = await makeCombo([
      { variantId: a.variantId, quantity: 2 },
      { variantId: b.variantId, quantity: 1 },
    ]);
    const rs = await Promise.all(
      Array.from({ length: 6 }, () => placeOrder([{ variantId: combo.variantId, quantity: 1 }])),
    );
    expect(rs.filter((r) => r.status === 201).length).toBe(3);
    expect(rs.every((r) => r.status === 201 || r.status === 409)).toBe(true);
    expect(await batchState(a1)).toEqual({ available: 0, reserved: 6 });
    expect(await batchState(b1)).toEqual({ available: 97, reserved: 3 }); // B không bị trừ cho đơn thất bại
  });
});
