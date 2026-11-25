import { z } from "zod";
import { BENEFITS, SKIN_TYPES } from "@/types/product";

export function slugify(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

const imageUrl = z
  .string()
  .trim()
  .max(500)
  .refine((v) => /^https?:\/\//i.test(v) || v.startsWith("/"), "Ảnh phải là URL http(s) hoặc đường dẫn bắt đầu bằng /");

export const variantInputSchema = z
  .object({
    id: z.string().min(1).optional(),
    sku: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{1,39}$/, "SKU chỉ gồm chữ in hoa, số, gạch ngang (2–40 ký tự)"),
    name: z.string().trim().min(1, "Vui lòng nhập tên biến thể (dung tích/quy cách)").max(100),
    price: z.number({ error: "Giá phải là số" }).int("Giá phải là số nguyên VND").min(1000, "Giá tối thiểu 1.000 ₫").max(100_000_000),
    compareAtPrice: z.number().int().max(100_000_000).nullable().optional(),
    weightGram: z.number().int().min(1, "Khối lượng tối thiểu 1g").max(50_000),
  })
  .refine((v) => v.compareAtPrice == null || v.compareAtPrice > v.price, {
    message: "Giá gạch phải lớn hơn giá bán",
    path: ["compareAtPrice"],
  });

export const productInputSchema = z
  .object({
    name: z.string().trim().min(2, "Vui lòng nhập tên sản phẩm").max(150),
    slug: z
      .string()
      .trim()
      .min(2, "Vui lòng nhập slug")
      .max(160)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Slug chỉ gồm chữ thường, số và dấu gạch ngang"),
    categoryId: z.string().min(1, "Vui lòng chọn danh mục"),
    shortDescription: z.string().trim().min(1, "Vui lòng nhập mô tả ngắn").max(300),
    description: z.string().trim().min(1, "Vui lòng nhập mô tả chi tiết").max(10_000),
    ingredientsInci: z.string().trim().min(1, "Vui lòng nhập bảng thành phần INCI").max(5_000),
    usageGuide: z.string().trim().min(1, "Vui lòng nhập hướng dẫn sử dụng").max(5_000),
    storageGuide: z.string().trim().max(3_000).optional().default(""),
    skinTypes: z.array(z.enum(SKIN_TYPES.map((s) => s.value) as [string, ...string[]])).max(10),
    benefits: z.array(z.enum(BENEFITS.map((b) => b.value) as [string, ...string[]])).max(10),
    images: z.array(imageUrl).max(10),
    isFeatured: z.boolean(),
    isActive: z.boolean(),
    isCombo: z.boolean(),
    variants: z.array(variantInputSchema).min(1, "Cần ít nhất một biến thể").max(20),
    comboItems: z
      .array(
        z.object({
          childVariantId: z.string().min(1, "Chọn sản phẩm thành phần"),
          quantity: z.number().int().min(1, "Số lượng tối thiểu 1").max(99),
        }),
      )
      .max(30),
  })
  .superRefine((v, ctx) => {
    const skus = new Set<string>();
    v.variants.forEach((variant, idx) => {
      if (skus.has(variant.sku)) {
        ctx.addIssue({ code: "custom", path: ["variants", idx, "sku"], message: `SKU ${variant.sku} bị trùng trong form` });
      }
      skus.add(variant.sku);
    });
    if (v.isCombo && v.comboItems.length === 0) {
      ctx.addIssue({ code: "custom", path: ["comboItems"], message: "Combo cần ít nhất một sản phẩm thành phần" });
    }
    if (!v.isCombo && v.comboItems.length > 0) {
      ctx.addIssue({ code: "custom", path: ["comboItems"], message: "Chỉ combo mới có thành phần con" });
    }
    const children = new Set<string>();
    v.comboItems.forEach((c, idx) => {
      if (children.has(c.childVariantId)) {
        ctx.addIssue({ code: "custom", path: ["comboItems", idx, "childVariantId"], message: "Thành phần bị trùng" });
      }
      children.add(c.childVariantId);
    });
  });

export type ProductInput = z.infer<typeof productInputSchema>;

export const batchInputSchema = z
  .object({
    variantId: z.string().min(1, "Vui lòng chọn biến thể"),
    batchCode: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9][A-Z0-9_-]{2,39}$/, "Mã lô gồm chữ in hoa, số, gạch ngang (3–40 ký tự)"),
    manufacturedDate: z.iso.date("Ngày sản xuất không hợp lệ"),
    expiryDate: z.iso.date("Hạn sử dụng không hợp lệ"),
    initialQuantity: z.number().int("Số lượng phải là số nguyên").min(1, "Số lượng tối thiểu 1").max(1_000_000),
  })
  .refine((v) => v.expiryDate > v.manufacturedDate, {
    message: "Hạn sử dụng phải sau ngày sản xuất",
    path: ["expiryDate"],
  });

export const batchAdjustSchema = z.object({
  countedQuantity: z.number().int("Số lượng phải là số nguyên").min(0, "Số lượng không được âm").max(1_000_000),
  reason: z.string().trim().min(3, "Vui lòng nhập lý do điều chỉnh").max(300),
});

export const voucherInputSchema = z
  .object({
    code: z
      .string()
      .trim()
      .toUpperCase()
      .regex(/^[A-Z0-9_-]{3,30}$/, "Mã gồm chữ in hoa, số, gạch ngang (3–30 ký tự)"),
    description: z.string().trim().max(200).optional().default(""),
    discountType: z.enum(["PERCENT", "FIXED"]),
    discountValue: z.number().int().min(1, "Giá trị giảm tối thiểu 1"),
    minOrderAmount: z.number().int().min(0).max(100_000_000),
    maxDiscount: z.number().int().min(1).max(100_000_000).nullable().optional(),
    usageLimit: z.number().int().min(1).max(1_000_000).nullable().optional(),
    startDate: z.iso.date("Ngày bắt đầu không hợp lệ"),
    endDate: z.iso.date("Ngày kết thúc không hợp lệ"),
  })
  .superRefine((v, ctx) => {
    if (v.discountType === "PERCENT" && v.discountValue > 100) {
      ctx.addIssue({ code: "custom", path: ["discountValue"], message: "Phần trăm giảm tối đa 100" });
    }
    if (v.endDate < v.startDate) {
      ctx.addIssue({ code: "custom", path: ["endDate"], message: "Ngày kết thúc phải từ ngày bắt đầu trở đi" });
    }
  });

/** yyyy-mm-dd → Date (00:00 UTC). */
export function dateFromInput(value: string): Date {
  return new Date(`${value}T00:00:00.000Z`);
}
