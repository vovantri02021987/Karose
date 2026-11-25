import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import type { ProductInput } from "@/lib/admin-schemas";

export class ProductConflictError extends Error {}

type Tx = Prisma.TransactionClient;

async function assertComboChildren(tx: Tx, input: ProductInput, ownVariantIds: string[]) {
  if (!input.isCombo) return;
  const ids = input.comboItems.map((c) => c.childVariantId);
  const children = await tx.productVariant.findMany({
    where: { id: { in: ids } },
    select: { id: true, product: { select: { isCombo: true } } },
  });
  if (children.length !== ids.length) {
    throw new ProductConflictError("Có thành phần combo không còn tồn tại");
  }
  if (children.some((c) => c.product.isCombo)) {
    throw new ProductConflictError("Combo không được chứa combo khác");
  }
  if (ids.some((id) => ownVariantIds.includes(id))) {
    throw new ProductConflictError("Combo không được chứa chính biến thể của nó");
  }
}

async function assertUniqueSkus(tx: Tx, input: ProductInput, productId: string | null) {
  const clash = await tx.productVariant.findFirst({
    where: {
      sku: { in: input.variants.map((v) => v.sku) },
      ...(productId ? { NOT: { productId } } : {}),
    },
    select: { sku: true },
  });
  if (clash) throw new ProductConflictError(`SKU ${clash.sku} đã tồn tại ở sản phẩm khác`);
}

export async function createProduct(input: ProductInput) {
  return prisma.$transaction(async (tx) => {
    if (await tx.product.findUnique({ where: { slug: input.slug }, select: { id: true } })) {
      throw new ProductConflictError(`Slug "${input.slug}" đã được dùng`);
    }
    if (!(await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
      throw new ProductConflictError("Danh mục không tồn tại");
    }
    await assertUniqueSkus(tx, input, null);
    await assertComboChildren(tx, input, []);

    const product = await tx.product.create({
      data: {
        name: input.name,
        slug: input.slug,
        categoryId: input.categoryId,
        shortDescription: input.shortDescription,
        description: input.description,
        ingredientsInci: input.ingredientsInci,
        usageGuide: input.usageGuide,
        storageGuide: input.storageGuide || null,
        skinTypes: input.skinTypes,
        benefits: input.benefits,
        images: input.images,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
        isCombo: input.isCombo,
        deliveryMinDays: input.deliveryMinDays,
        deliveryMaxDays: input.deliveryMaxDays,
        variants: {
          create: input.variants.map((v) => ({
            sku: v.sku,
            name: v.name,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            weightGram: v.weightGram,
          })),
        },
        comboItems: {
          create: input.comboItems.map((c) => ({
            childVariantId: c.childVariantId,
            quantity: c.quantity,
          })),
        },
      },
      select: { id: true, slug: true },
    });
    return product;
  });
}

export async function updateProduct(id: string, input: ProductInput) {
  return prisma.$transaction(async (tx) => {
    const current = await tx.product.findUnique({
      where: { id },
      select: { id: true, isCombo: true, variants: { select: { id: true } } },
    });
    if (!current) return null;

    const slugOwner = await tx.product.findUnique({ where: { slug: input.slug }, select: { id: true } });
    if (slugOwner && slugOwner.id !== id) {
      throw new ProductConflictError(`Slug "${input.slug}" đã được dùng`);
    }
    if (!(await tx.category.findUnique({ where: { id: input.categoryId }, select: { id: true } }))) {
      throw new ProductConflictError("Danh mục không tồn tại");
    }
    await assertUniqueSkus(tx, input, id);

    const currentIds = current.variants.map((v) => v.id);
    const keptIds = input.variants.flatMap((v) => (v.id ? [v.id] : []));
    if (keptIds.some((k) => !currentIds.includes(k))) {
      throw new ProductConflictError("Biến thể không thuộc sản phẩm này");
    }
    await assertComboChildren(tx, input, currentIds);

    // Không đổi loại sản phẩm khi đã có lô/đơn: tránh làm sai tồn kho đang giữ.
    if (current.isCombo !== input.isCombo) {
      const [batches, orderItems] = await Promise.all([
        tx.inventoryBatch.count({ where: { variantId: { in: currentIds } } }),
        tx.orderItem.count({ where: { variantId: { in: currentIds } } }),
      ]);
      if (batches > 0 || orderItems > 0) {
        throw new ProductConflictError("Không thể đổi giữa sản phẩm thường và combo khi đã có lô hàng hoặc đơn hàng");
      }
    }

    // Biến thể bị xoá khỏi form: chỉ cho xoá nếu chưa có lô/đơn/combo tham chiếu.
    const removed = currentIds.filter((x) => !keptIds.includes(x));
    if (removed.length > 0) {
      const [batches, orderItems, inCombos] = await Promise.all([
        tx.inventoryBatch.count({ where: { variantId: { in: removed } } }),
        tx.orderItem.count({ where: { variantId: { in: removed } } }),
        tx.comboItem.count({ where: { childVariantId: { in: removed } } }),
      ]);
      if (batches > 0 || orderItems > 0 || inCombos > 0) {
        throw new ProductConflictError("Không thể xoá biến thể đã có lô hàng, đơn hàng hoặc nằm trong combo");
      }
      await tx.productVariant.deleteMany({ where: { id: { in: removed } } });
    }

    await tx.product.update({
      where: { id },
      data: {
        name: input.name,
        slug: input.slug,
        categoryId: input.categoryId,
        shortDescription: input.shortDescription,
        description: input.description,
        ingredientsInci: input.ingredientsInci,
        usageGuide: input.usageGuide,
        storageGuide: input.storageGuide || null,
        skinTypes: input.skinTypes,
        benefits: input.benefits,
        images: input.images,
        isFeatured: input.isFeatured,
        isActive: input.isActive,
        isCombo: input.isCombo,
        deliveryMinDays: input.deliveryMinDays,
        deliveryMaxDays: input.deliveryMaxDays,
      },
    });

    for (const v of input.variants) {
      const data = {
        sku: v.sku,
        name: v.name,
        price: v.price,
        compareAtPrice: v.compareAtPrice ?? null,
        weightGram: v.weightGram,
      };
      if (v.id) await tx.productVariant.update({ where: { id: v.id }, data });
      else await tx.productVariant.create({ data: { ...data, productId: id } });
    }

    await tx.comboItem.deleteMany({ where: { comboProductId: id } });
    if (input.isCombo) {
      await tx.comboItem.createMany({
        data: input.comboItems.map((c) => ({
          comboProductId: id,
          childVariantId: c.childVariantId,
          quantity: c.quantity,
        })),
      });
    }
    return { id, slug: input.slug };
  }, { timeout: 20_000, maxWait: 10_000 });
}
