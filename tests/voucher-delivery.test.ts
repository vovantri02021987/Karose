import { afterAll, describe, expect, it } from "vitest";
import { calculateOrderPricing, VoucherError } from "@/lib/pricing";
import { calculateEstimatedDelivery, deliveryWindowForRegion, isCoreHubProvince } from "@/lib/delivery";
import { POST as previewRoute } from "@/app/api/checkout/preview/route";
import { cleanup, makeBatch, makeVariant, makeVoucher } from "./helpers/factory";
import { placeOrder } from "./helpers/orders";
import { prisma } from "./helpers/prisma";


afterAll(async () => {
  await cleanup();
  await prisma.$disconnect();
});

describe("Delivery: quy tắc khu vực", () => {
  it("khung chuẩn 2–4 → HCM/HN 1–2, tỉnh khác 3–5", () => {
    const base = { minDays: 2, maxDays: 4 };
    expect(deliveryWindowForRegion(base, true).text).toBe("1–2 ngày làm việc");
    expect(deliveryWindowForRegion(base, false).text).toBe("3–5 ngày làm việc");
  });
  it("giỏ nhiều sản phẩm lấy khung chậm nhất; không bao giờ min<1 hoặc max<min", () => {
    const e = calculateEstimatedDelivery([{ minDays: 2, maxDays: 4 }, { minDays: 3, maxDays: 5 }], "Hà Nội");
    expect(e).toMatchObject({ minDays: 2, maxDays: 3 });
    const tiny = deliveryWindowForRegion({ minDays: 1, maxDays: 1 }, true);
    expect(tiny.minDays).toBeGreaterThanOrEqual(1);
    expect(tiny.maxDays).toBeGreaterThanOrEqual(tiny.minDays);
  });
  it("nhận diện HCM/Hà Nội không phân biệt dấu/hoa thường", () => {
    expect(calculateEstimatedDelivery([], "TP. Hồ Chí Minh").text).toBe("1–2 ngày làm việc");
    expect(calculateEstimatedDelivery([], "ha noi").text).toBe("1–2 ngày làm việc");
    expect(calculateEstimatedDelivery([], "Đà Nẵng").text).toBe("3–5 ngày làm việc");
    expect(calculateEstimatedDelivery([], "").text).toBe("3–5 ngày làm việc");
  });
});

describe("Voucher scope PRODUCT", () => {
  it("chỉ giảm trên tiền hàng của sản phẩm hợp lệ, FIXED không vượt phần đó", async () => {
    const a = await makeVariant({ price: 100_000 });
    const b = await makeVariant({ price: 300_000 });
    const v = await makeVoucher({ scope: "PRODUCT", productIds: [a.productId], discountValue: 150_000 });
    const p = await calculateOrderPricing({
      items: [{ variantId: a.variantId, quantity: 1 }, { variantId: b.variantId, quantity: 1 }],
      province: "Hà Nội",
      voucherCode: v.code,
    });
    expect(p.subtotal).toBe(400_000);
    expect(p.discountAmount).toBe(100_000); // bị chặn ở phần tiền hàng hợp lệ
    expect(p.voucher?.eligibleSubtotal).toBe(100_000);
    expect(p.voucher?.appliedProductNames).toHaveLength(1);
  });

  it("PERCENT tính trên phần hợp lệ, có trần maxDiscount", async () => {
    const a = await makeVariant({ price: 200_000 });
    const b = await makeVariant({ price: 200_000 });
    const v = await makeVoucher({
      scope: "PRODUCT", productIds: [a.productId], discountType: "PERCENT", discountValue: 50, maxDiscount: 30_000,
    });
    const p = await calculateOrderPricing({
      items: [{ variantId: a.variantId, quantity: 1 }, { variantId: b.variantId, quantity: 1 }],
      province: "Hà Nội", voucherCode: v.code,
    });
    expect(p.discountAmount).toBe(30_000);
  });

  it("giỏ không có sản phẩm hợp lệ → VoucherError", async () => {
    const a = await makeVariant();
    const other = await makeVariant();
    const v = await makeVoucher({ scope: "PRODUCT", productIds: [a.productId] });
    await expect(
      calculateOrderPricing({ items: [{ variantId: other.variantId, quantity: 1 }], province: "Hà Nội", voucherCode: v.code }),
    ).rejects.toBeInstanceOf(VoucherError);
  });

  it("minOrderAmount của voucher PRODUCT tính trên phần tiền hàng thuộc phạm vi", async () => {
    const a = await makeVariant({ price: 100_000 });
    const b = await makeVariant({ price: 900_000 });
    const v = await makeVoucher({ scope: "PRODUCT", productIds: [a.productId], minOrderAmount: 200_000 });
    await expect(
      calculateOrderPricing({
        items: [{ variantId: a.variantId, quantity: 1 }, { variantId: b.variantId, quantity: 1 }],
        province: "Hà Nội", voucherCode: v.code,
      }),
    ).rejects.toBeInstanceOf(VoucherError);
    const ok = await calculateOrderPricing({
      items: [{ variantId: a.variantId, quantity: 2 }], province: "Hà Nội", voucherCode: v.code,
    });
    expect(ok.discountAmount).toBe(10_000);
  });

  it("voucher ORDER vẫn tính trên toàn đơn; freeship xét sau giảm giá", async () => {
    const a = await makeVariant({ price: 510_000 });
    const v = await makeVoucher({ scope: "ORDER", discountValue: 20_000 });
    const p = await calculateOrderPricing({ items: [{ variantId: a.variantId, quantity: 1 }], province: "Hà Nội", voucherCode: v.code });
    expect(p.discountAmount).toBe(20_000);
    expect(p.shippingFee).toBe(20_000); // 490.000 < 500.000
  });
});

describe("Đơn hàng lưu cam kết giao hàng", () => {
  it("lưu min/max/text theo tỉnh và sản phẩm chậm nhất; trả về trong response", async () => {
    const a = await makeVariant({ deliveryMinDays: 3, deliveryMaxDays: 5 });
    await makeBatch(a.variantId, { qty: 5 });
    const res = await placeOrder([{ variantId: a.variantId, quantity: 1 }], { province: "Cần Thơ" });
    expect(res.status).toBe(201);
    expect(res.body.order.estimatedDeliveryText).toBe("4–6 ngày làm việc");
    const row = await prisma.order.findUnique({ where: { orderCode: res.body.order.orderCode } });
    expect(row).toMatchObject({ deliveryMinDays: 4, deliveryMaxDays: 6, estimatedDeliveryText: "4–6 ngày làm việc" });
  });
});

describe("Phân bổ giảm giá theo dòng & API preview", () => {
  it("lineDiscount cộng lại đúng bằng discountAmount; dòng ngoài phạm vi không bị giảm", async () => {
    const a = await makeVariant({ price: 33_333 });
    const b = await makeVariant({ price: 66_667 });
    const c = await makeVariant({ price: 500_000 });
    const v = await makeVoucher({ scope: "PRODUCT", productIds: [a.productId, b.productId], discountType: "PERCENT", discountValue: 7 });
    const p = await calculateOrderPricing({
      items: [a, b, c].map((x) => ({ variantId: x.variantId, quantity: 1 })),
      province: "Hà Nội", voucherCode: v.code,
    });
    const sum = p.items.reduce((s, l) => s + l.lineDiscount, 0);
    expect(sum).toBe(p.discountAmount);
    expect(p.items.map((l) => l.eligibleForVoucher)).toEqual([true, true, false]);
    expect(p.items[2].lineDiscount).toBe(0);
    for (const l of p.items) expect(l.lineFinalAmount).toBe(l.lineTotal - l.lineDiscount);
  });

  it("isCoreHubProvince + freeship còn thiếu bao nhiêu", async () => {
    expect(isCoreHubProvince("TP Hồ Chí Minh")).toBe(true);
    expect(isCoreHubProvince("Huế")).toBe(false);
    const a = await makeVariant({ price: 200_000 });
    const p = await calculateOrderPricing({ items: [{ variantId: a.variantId, quantity: 1 }], province: "Huế" });
    expect(p.freeShipThreshold).toBe(500_000);
    expect(p.amountNeededForFreeShip).toBe(300_000);
    expect(p.estimatedDelivery.text).toBe("3–5 ngày làm việc");
  });

  it("POST /api/checkout/preview trả voucher {applied, error} và items đầy đủ", async () => {
    const a = await makeVariant({ price: 100_000 });
    const other = await makeVariant({ price: 100_000 });
    const v = await makeVoucher({ scope: "PRODUCT", productIds: [a.productId], discountValue: 10_000 });
    const call = async (voucherCode: string, variantId: string) => {
      const res = await previewRoute(new Request("http://localhost/api/checkout/preview", {
        method: "POST", headers: { "content-type": "application/json" },
        body: JSON.stringify({ items: [{ variantId, quantity: 1 }], province: "Hà Nội", voucherCode }),
      }));
      return res.json();
    };
    const ok = await call(v.code, a.variantId);
    expect(ok.voucher.applied.scope).toBe("PRODUCT");
    expect(ok.voucher.error).toBeNull();
    expect(ok.items[0]).toMatchObject({ lineDiscount: 10_000, lineFinalAmount: 90_000, eligibleForVoucher: true });
    expect(ok.estimatedDelivery.text).toBe("1–2 ngày làm việc");
    expect(ok.freeShipThreshold).toBe(500_000);

    const bad = await call(v.code, other.variantId);
    expect(bad.voucher.applied).toBeNull();
    expect(bad.voucher.error).toContain("chỉ áp dụng");
    expect(bad.discountAmount).toBe(0);
    expect(bad.totalAmount).toBe(bad.subtotal + bad.shippingFee);
  });
});
