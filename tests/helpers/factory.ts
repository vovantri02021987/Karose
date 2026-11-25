import { randomUUID } from "node:crypto";
import { prisma } from "./prisma";

/** Mọi dữ liệu test mang tiền tố RUN để dọn chính xác, không đụng dữ liệu khác. */
export const RUN = `T${randomUUID().replace(/-/g, "").slice(0, 8).toUpperCase()}`;
const DAY = 24 * 60 * 60 * 1000;

let seq = 0;
const next = () => `${RUN}-${++seq}`;

let categoryId: string | null = null;
async function ensureCategory(): Promise<string> {
  if (categoryId) return categoryId;
  const c = await prisma.category.create({
    data: { name: `Test ${RUN}`, slug: `test-${RUN.toLowerCase()}` },
  });
  categoryId = c.id;
  return c.id;
}

export interface TestVariant {
  productId: string;
  variantId: string;
  sku: string;
}

export async function makeVariant(opts: {
  price?: number;
  name?: string;
  isActive?: boolean;
  isCombo?: boolean;
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
} = {}): Promise<TestVariant> {
  const tag = next();
  const product = await prisma.product.create({
    data: {
      name: opts.name ?? `SP ${tag}`,
      slug: `sp-${tag.toLowerCase()}`,
      shortDescription: "test",
      description: "test",
      ingredientsInci: "test",
      usageGuide: "test",
      skinTypes: [],
      benefits: [],
      images: [],
      isActive: opts.isActive ?? true,
      isCombo: opts.isCombo ?? false,
      ...(opts.deliveryMinDays !== undefined ? { deliveryMinDays: opts.deliveryMinDays } : {}),
      ...(opts.deliveryMaxDays !== undefined ? { deliveryMaxDays: opts.deliveryMaxDays } : {}),
      categoryId: await ensureCategory(),
      variants: {
        create: {
          sku: tag,
          name: opts.name ?? `SP ${tag}`,
          price: opts.price ?? 100_000,
        },
      },
    },
    include: { variants: true },
  });
  return { productId: product.id, variantId: product.variants[0].id, sku: tag };
}

export async function makeBatch(
  variantId: string,
  opts: {
    expiresInDays?: number;
    expiresAt?: Date;
    qty: number;
    reserved?: number;
    code?: string;
    createdAt?: Date;
  },
): Promise<string> {
  const expiry =
    opts.expiresAt ?? new Date(Date.now() + (opts.expiresInDays ?? 365) * DAY);
  const b = await prisma.inventoryBatch.create({
    data: {
      variantId,
      batchCode: opts.code ?? next(),
      manufacturedDate: new Date(expiry.getTime() - 730 * DAY),
      expiryDate: expiry,
      initialQuantity: opts.qty + (opts.reserved ?? 0),
      availableQuantity: opts.qty,
      reservedQuantity: opts.reserved ?? 0,
      ...(opts.createdAt ? { createdAt: opts.createdAt } : {}),
    },
  });
  return b.id;
}

/** Tạo combo: product isCombo + 1 variant + ComboItem trỏ tới các biến thể con. */
export async function makeCombo(
  children: { variantId: string; quantity: number }[],
  price = 300_000,
): Promise<TestVariant> {
  const combo = await makeVariant({ isCombo: true, price });
  await prisma.comboItem.createMany({
    data: children.map((c) => ({
      comboProductId: combo.productId,
      childVariantId: c.variantId,
      quantity: c.quantity,
    })),
  });
  return combo;
}

export async function batchState(batchId: string) {
  const b = await prisma.inventoryBatch.findUniqueOrThrow({
    where: { id: batchId },
    select: { availableQuantity: true, reservedQuantity: true },
  });
  return { available: b.availableQuantity, reserved: b.reservedQuantity };
}

export async function makeUser(role: "ADMIN" | "STAFF" | "CUSTOMER", password?: string) {
  const bcrypt = (await import("bcryptjs")).default;
  const email = `${next().toLowerCase()}@test.local`;
  const user = await prisma.user.create({
    data: {
      email,
      name: `User ${role}`,
      role,
      passwordHash: await bcrypt.hash(password ?? "Passw0rd!test", 4),
    },
  });
  return { ...user, plainPassword: password ?? "Passw0rd!test" };
}

export async function makeVoucher(opts: {
  usageLimit?: number | null;
  usedCount?: number;
  discountValue?: number;
  discountType?: string;
  minOrderAmount?: number;
  maxDiscount?: number | null;
  scope?: "ORDER" | "PRODUCT";
  productIds?: string[];
}) {
  return prisma.voucher.create({
    data: {
      code: `${RUN}V${++seq}`,
      discountType: opts.discountType ?? "FIXED_AMOUNT",
      discountValue: opts.discountValue ?? 10_000,
      minOrderAmount: opts.minOrderAmount ?? 0,
      maxDiscount: opts.maxDiscount ?? null,
      scope: opts.scope ?? "ORDER",
      products: { create: (opts.productIds ?? []).map((productId) => ({ productId })) },
      usageLimit: opts.usageLimit ?? null,
      usedCount: opts.usedCount ?? 0,
      startDate: new Date(Date.now() - DAY),
      endDate: new Date(Date.now() + 30 * DAY),
    },
  });
}

/** Dọn toàn bộ dữ liệu của lần chạy này (đơn → voucher → user → sản phẩm → danh mục). */
export async function cleanup(): Promise<void> {
  await prisma.order.deleteMany({
    where: { items: { some: { variant: { sku: { startsWith: RUN } } } } },
  });
  await prisma.order.deleteMany({ where: { customerName: { startsWith: RUN } } });
  await prisma.voucher.deleteMany({ where: { code: { startsWith: RUN } } });
  await prisma.user.deleteMany({ where: { email: { startsWith: RUN.toLowerCase() } } });
  await prisma.product.deleteMany({ where: { slug: { startsWith: `sp-${RUN.toLowerCase()}` } } });
  await prisma.category.deleteMany({ where: { slug: `test-${RUN.toLowerCase()}` } });
  categoryId = null;
}

export async function leftovers(): Promise<number> {
  const [o, p, u, v, c] = await Promise.all([
    prisma.order.count({ where: { customerName: { startsWith: RUN } } }),
    prisma.product.count({ where: { slug: { startsWith: `sp-${RUN.toLowerCase()}` } } }),
    prisma.user.count({ where: { email: { startsWith: RUN.toLowerCase() } } }),
    prisma.voucher.count({ where: { code: { startsWith: RUN } } }),
    prisma.category.count({ where: { slug: `test-${RUN.toLowerCase()}` } }),
  ]);
  return o + p + u + v + c;
}

export const DAY_MS = DAY;
