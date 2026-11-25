import { afterAll, afterEach, describe, expect, it, vi } from "vitest";
import { prisma } from "./helpers/prisma";
import {
  DAY_MS,
  batchState,
  cleanup,
  leftovers,
  makeBatch,
  makeVariant,
  makeVoucher,
} from "./helpers/factory";
import { placeOrder } from "./helpers/orders";
import {
  getNearExpiryBatches,
  getProductSellableStock,
  getSellableStock,
  getSellableStockForVariants,
} from "@/lib/fefo";

// Cho phép ép orderCode trùng ở lần thử đầu để kiểm tra rollback SAU khi đã giữ kho.
const codes = vi.hoisted(() => ({ queue: [] as string[] }));
vi.mock("@/lib/vietqr", async (importActual) => {
  const actual = await importActual<typeof import("@/lib/vietqr")>();
  return {
    ...actual,
    generateOrderCode: () => codes.queue.shift() ?? actual.generateOrderCode(),
  };
});

afterAll(async () => {
  await cleanup();
  expect(await leftovers()).toBe(0);
  await prisma.$disconnect();
});
afterEach(() => vi.useRealTimers());

describe("1. FEFO & quy tắc cận hạn 30 ngày", () => {
  it("1.1 Lô hết hạn <= now+30 ngày không tính vào tồn khả dụng (biên chính xác)", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    const now = Date.now();
    const v = await makeVariant();
    await makeBatch(v.variantId, { expiresAt: new Date(now - 5 * DAY_MS), qty: 7 }); // đã hết hạn
    await makeBatch(v.variantId, { expiresAt: new Date(now + 10 * DAY_MS), qty: 11 }); // cận hạn
    await makeBatch(v.variantId, { expiresAt: new Date(now + 30 * DAY_MS), qty: 13 }); // ĐÚNG biên: loại
    await makeBatch(v.variantId, { expiresAt: new Date(now + 30 * DAY_MS + 1000), qty: 17 }); // +1s: lấy
    await makeBatch(v.variantId, { expiresAt: new Date(now + 90 * DAY_MS), qty: 19 });

    expect(await getSellableStock(v.variantId)).toBe(17 + 19);
    expect((await getSellableStockForVariants([v.variantId])).get(v.variantId)).toBe(36);
    expect(await getProductSellableStock(v.productId)).toBe(36);
  });

  it("1.2 Đặt hàng không bao giờ phân bổ từ lô cận hạn / hết hạn", async () => {
    const v = await makeVariant();
    const near = await makeBatch(v.variantId, { expiresInDays: 10, qty: 100 });
    const expired = await makeBatch(v.variantId, { expiresInDays: -2, qty: 100 });
    const ok = await makeBatch(v.variantId, { expiresInDays: 120, qty: 5 });

    const r = await placeOrder([{ variantId: v.variantId, quantity: 3 }]);
    expect(r.status).toBe(201);
    expect(await batchState(ok)).toEqual({ available: 2, reserved: 3 });
    expect(await batchState(near)).toEqual({ available: 100, reserved: 0 });
    expect(await batchState(expired)).toEqual({ available: 100, reserved: 0 });
  });

  it("1.3 Cận hạn có nhiều hàng nhưng lô hợp lệ thiếu → từ chối (409), không đụng lô cận hạn", async () => {
    const v = await makeVariant();
    const near = await makeBatch(v.variantId, { expiresInDays: 5, qty: 1000 });
    const ok = await makeBatch(v.variantId, { expiresInDays: 200, qty: 4 });
    const r = await placeOrder([{ variantId: v.variantId, quantity: 5 }]);
    expect(r.status).toBe(409);
    expect(r.body.error).toMatch(/không đủ số lượng tồn kho khả dụng/);
    expect(await batchState(near)).toEqual({ available: 1000, reserved: 0 });
    expect(await batchState(ok)).toEqual({ available: 4, reserved: 0 });
  });

  it("1.4 Phân bổ theo expiryDate ASC, tràn sang lô kế tiếp, lưu vết đúng vào OrderItem.batchAllocated", async () => {
    const v = await makeVariant();
    // Cố ý tạo lô theo thứ tự lộn xộn
    const late = await makeBatch(v.variantId, { expiresInDays: 300, qty: 5, code: "LATE" });
    const first = await makeBatch(v.variantId, { expiresInDays: 60, qty: 5, code: "FIRST" });
    const mid = await makeBatch(v.variantId, { expiresInDays: 150, qty: 5, code: "MID" });

    const r = await placeOrder([{ variantId: v.variantId, quantity: 12 }]);
    expect(r.status).toBe(201);

    expect(await batchState(first)).toEqual({ available: 0, reserved: 5 });
    expect(await batchState(mid)).toEqual({ available: 0, reserved: 5 });
    expect(await batchState(late)).toEqual({ available: 3, reserved: 2 });

    const item = await prisma.orderItem.findFirstOrThrow({ where: { orderId: r.body.order.id } });
    expect(item.batchAllocated).toEqual([
      { batchId: first, batchCode: "FIRST", quantity: 5 },
      { batchId: mid, batchCode: "MID", quantity: 5 },
      { batchId: late, batchCode: "LATE", quantity: 2 },
    ]);
  });

  it("1.5 Cùng hạn dùng → ưu tiên lô nhập trước (createdAt ASC)", async () => {
    const v = await makeVariant();
    const expiresAt = new Date(Date.now() + 100 * DAY_MS);
    const newer = await makeBatch(v.variantId, { expiresAt, qty: 5, createdAt: new Date(Date.now() - 1000) });
    const older = await makeBatch(v.variantId, { expiresAt, qty: 5, createdAt: new Date(Date.now() - 999_000) });
    const r = await placeOrder([{ variantId: v.variantId, quantity: 4 }]);
    expect(r.status).toBe(201);
    expect(await batchState(older)).toEqual({ available: 1, reserved: 4 });
    expect(await batchState(newer)).toEqual({ available: 5, reserved: 0 });
  });

  it("1.6 Vượt tổng tồn khả dụng → 409, không tạo đơn, kho không âm, không đổi", async () => {
    const v = await makeVariant();
    const a = await makeBatch(v.variantId, { expiresInDays: 90, qty: 3 });
    const b = await makeBatch(v.variantId, { expiresInDays: 150, qty: 2 });
    const before = await prisma.order.count();
    const r = await placeOrder([{ variantId: v.variantId, quantity: 6 }]);
    expect(r.status).toBe(409);
    expect(await prisma.order.count()).toBe(before);
    expect(await batchState(a)).toEqual({ available: 3, reserved: 0 });
    expect(await batchState(b)).toEqual({ available: 2, reserved: 0 });
    // đúng bằng tổng thì vẫn được
    const ok = await placeOrder([{ variantId: v.variantId, quantity: 5 }]);
    expect(ok.status).toBe(201);
    expect(await batchState(a)).toEqual({ available: 0, reserved: 3 });
    expect(await batchState(b)).toEqual({ available: 0, reserved: 2 });
  });

  it("1.7 Đơn nhiều dòng: dòng sau thiếu hàng → dòng trước KHÔNG bị trừ (rollback)", async () => {
    const v1 = await makeVariant();
    const v2 = await makeVariant();
    const b1 = await makeBatch(v1.variantId, { expiresInDays: 100, qty: 10 });
    const b2 = await makeBatch(v2.variantId, { expiresInDays: 100, qty: 1 });
    const voucher = await makeVoucher({ usageLimit: 5 });
    const r = await placeOrder(
      [
        { variantId: v1.variantId, quantity: 4 },
        { variantId: v2.variantId, quantity: 2 },
      ],
      { voucherCode: voucher.code },
    );
    expect(r.status).toBe(409);
    expect(await batchState(b1)).toEqual({ available: 10, reserved: 0 });
    expect(await batchState(b2)).toEqual({ available: 1, reserved: 0 });
    expect((await prisma.voucher.findUniqueOrThrow({ where: { id: voucher.id } })).usedCount).toBe(0);
  });

  it("1.8 Lỗi SAU khi đã giữ kho (trùng orderCode) → rollback lần thử lỗi, kho chỉ bị trừ đúng 1 lần", async () => {
    const v = await makeVariant();
    const b = await makeBatch(v.variantId, { expiresInDays: 100, qty: 10 });
    const first = await placeOrder([{ variantId: v.variantId, quantity: 2 }]);
    expect(first.status).toBe(201);
    codes.queue.push(first.body.order.orderCode); // lần thử đầu sẽ trùng mã → P2002 sau khi reserve
    const second = await placeOrder([{ variantId: v.variantId, quantity: 3 }]);
    expect(second.status).toBe(201);
    expect(second.body.order.orderCode).not.toBe(first.body.order.orderCode);
    expect(await batchState(b)).toEqual({ available: 5, reserved: 5 }); // 10 - 2 - 3, không trừ đúp
  });

  it("1.9 getNearExpiryBatches(30): đúng các lô cận hạn + đã hết hạn, sắp xếp ASC", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date());
    const now = Date.now();
    const v = await makeVariant();
    const expired = await makeBatch(v.variantId, { expiresAt: new Date(now - 3 * DAY_MS), qty: 4, code: "EXP" });
    const d10 = await makeBatch(v.variantId, { expiresAt: new Date(now + 10 * DAY_MS), qty: 6, code: "D10" });
    const d30 = await makeBatch(v.variantId, { expiresAt: new Date(now + 30 * DAY_MS), qty: 8, code: "D30" });
    await makeBatch(v.variantId, { expiresAt: new Date(now + 31 * DAY_MS), qty: 9, code: "D31" });
    await makeBatch(v.variantId, { expiresAt: new Date(now + 5 * DAY_MS), qty: 0, reserved: 3, code: "EMPTY" }); // hết available → không báo

    const mine = (await getNearExpiryBatches(30)).filter((b) => b.variantId === v.variantId);
    expect(mine.map((b) => b.batchCode)).toEqual(["EXP", "D10", "D30"]);
    expect(mine.map((b) => b.batchId)).toEqual([expired, d10, d30]);
    expect(mine[0]).toMatchObject({ isExpired: true, daysLeft: -3, availableQuantity: 4 });
    expect(mine[1]).toMatchObject({ isExpired: false, daysLeft: 10 });
    expect(mine[2]).toMatchObject({ isExpired: false, daysLeft: 30 });

    const week = (await getNearExpiryBatches(7)).filter((b) => b.variantId === v.variantId);
    expect(week.map((b) => b.batchCode)).toEqual(["EXP"]);
  });

  it("1.10 Đồng thời: 12 đơn × 1 sp trên lô tồn 5 → đúng 5 thành công, không bán lố, không âm kho", async () => {
    const v = await makeVariant();
    const b = await makeBatch(v.variantId, { expiresInDays: 100, qty: 5 });
    const results = await Promise.all(
      Array.from({ length: 12 }, () => placeOrder([{ variantId: v.variantId, quantity: 1 }])),
    );
    const ok = results.filter((r) => r.status === 201).length;
    const conflict = results.filter((r) => r.status === 409).length;
    expect(ok).toBe(5);
    expect(ok + conflict).toBe(12); // không có 500
    expect(await batchState(b)).toEqual({ available: 0, reserved: 5 });
  });

  it("1.11 Đồng thời + 2 lô: tổng tồn đủ cho cả 2 đơn thì KHÔNG được từ chối oan", async () => {
    const v = await makeVariant();
    const a = await makeBatch(v.variantId, { expiresInDays: 60, qty: 5 });
    const b = await makeBatch(v.variantId, { expiresInDays: 120, qty: 5 });
    const results = await Promise.all([
      placeOrder([{ variantId: v.variantId, quantity: 5 }]),
      placeOrder([{ variantId: v.variantId, quantity: 5 }]),
    ]);
    const statuses = results.map((r) => r.status).sort();
    const sa = await batchState(a);
    const sb = await batchState(b);
    // Bất biến an toàn (luôn phải đúng): không âm, không bán lố.
    expect(sa.available).toBeGreaterThanOrEqual(0);
    expect(sb.available).toBeGreaterThanOrEqual(0);
    expect(sa.available + sa.reserved).toBe(5);
    expect(sb.available + sb.reserved).toBe(5);
    // Tính sống còn: tồn đủ (10) cho 2 đơn × 5 → cả hai phải thành công.
    expect(statuses).toEqual([201, 201]);
  });

  it("1.12 Đồng thời: các đơn đặt cùng 2 sản phẩm theo thứ tự ngược nhau không được deadlock (500)", async () => {
    const a = await makeVariant();
    const b = await makeVariant();
    await makeBatch(a.variantId, { expiresInDays: 100, qty: 1000 });
    await makeBatch(b.variantId, { expiresInDays: 100, qty: 1000 });
    const jobs = Array.from({ length: 40 }, (_, i) =>
      placeOrder(
        i % 2 === 0
          ? [{ variantId: a.variantId, quantity: 1 }, { variantId: b.variantId, quantity: 1 }]
          : [{ variantId: b.variantId, quantity: 1 }, { variantId: a.variantId, quantity: 1 }],
      ),
    );
    const rs = await Promise.all(jobs);
    const codes500 = rs.filter((r) => r.status >= 500).length;
    expect(codes500, "số đơn lỗi 500 do deadlock/lock timeout").toBe(0);
  });
});
