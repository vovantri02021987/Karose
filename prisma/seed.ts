/**
 * KaRose seed data (Vietnamese content, English identifiers).
 *
 * Idempotent: wipes every table in foreign-key-safe order, then re-creates the
 * dataset. Dates are computed relative to "now", so near-expiry batches stay
 * near-expiry every time you re-seed.
 *
 *   npx prisma db seed
 *
 * Safety: refuses to run when NODE_ENV=production unless ALLOW_SEED_RESET=true,
 * because it deletes all users, orders and inventory.
 */
import { PrismaClient, Role } from "@prisma/client";
import bcrypt from "bcryptjs";
import { formatBatchCode, formatVND } from "../src/lib/format";

const prisma = new PrismaClient();

const DAY_MS = 24 * 60 * 60 * 1000;
const NOW = new Date();

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * DAY_MS);
}

/* -------------------------------------------------------------------------- */
/* Types                                                                      */
/* -------------------------------------------------------------------------- */

interface BatchSpec {
  /** Days between manufacture and now. Expiry = manufacture + shelfLifeDays. */
  manufacturedDaysAgo: number;
  initialQuantity: number;
  availableQuantity: number;
}

interface VariantSpec {
  sku: string;
  name: string;
  price: number;
  compareAtPrice?: number;
  weightGram?: number;
  batches: BatchSpec[];
}

interface ProductSpec {
  name: string;
  slug: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  ingredientsInci: string;
  usageGuide: string;
  storageGuide: string | null;
  skinTypes: string[];
  benefits: string[];
  isFeatured: boolean;
  /** Shelf life in days from the manufacture date (unopened). */
  shelfLifeDays: number;
  variants: VariantSpec[];
}

/* -------------------------------------------------------------------------- */
/* Catalogue data                                                             */
/* -------------------------------------------------------------------------- */

/**
 * Nguồn dữ liệu chuẩn: "Danh mục sản phẩm Karose" (docs/danh-muc-san-pham-karose.md).
 * Tên, SKU, dung tích, thành phần chính, công dụng, giá và đường dẫn ảnh lấy NGUYÊN VĂN từ tài liệu đó.
 * Không bịa thêm: những trường tài liệu chưa cung cấp (INCI đầy đủ, hướng dẫn sử dụng, bảo quản,
 * loại da, cân nặng) để trống hoặc dùng văn bản "đang cập nhật".
 */
const PENDING_TEXT = "Thông tin đang được cập nhật.";

const CATEGORIES = [
  {
    name: "Chăm sóc da mặt",
    slug: "cham-soc-da-mat",
    description: "Nước hoa hồng và dầu dưỡng da mặt từ hoa hồng nhung cổ hữu cơ.",
    imageUrl: null,
  },
  {
    name: "Làm sạch da",
    slug: "lam-sach-da",
    description: "Sản phẩm làm sạch dịu nhẹ từ thảo mộc.",
    imageUrl: null,
  },
  {
    name: "Chăm sóc môi",
    slug: "cham-soc-moi",
    description: "Son dưỡng môi từ sáp ong, bơ hạt mỡ và hoa hồng.",
    imageUrl: null,
  },
  {
    name: "Chăm sóc tóc",
    slug: "cham-soc-toc",
    description: "Dầu gội thảo dược và xịt dưỡng tóc tinh dầu thiên nhiên.",
    imageUrl: null,
  },
  {
    name: "Chăm sóc cơ thể",
    slug: "cham-soc-co-the",
    description: "Xà phòng tắm thủ công từ dầu oliu, dầu dừa và hoa hồng.",
    imageUrl: null,
  },
  {
    name: "Thực phẩm / Trà",
    slug: "thuc-pham-tra",
    description: "Trà hoa hồng hữu cơ sấy lạnh.",
    imageUrl: null,
  },
  {
    name: "Bộ sản phẩm & quà tặng",
    slug: "bo-san-pham-qua-tang",
    description: "Các bộ sản phẩm được phối sẵn từ danh mục Karose.",
    imageUrl: null,
  },
];

const PRODUCTS: ProductSpec[] = [
  {
    name: "Nước hoa hồng Karose (Karose Toner)",
    slug: "nuoc-hoa-hong-karose",
    categorySlug: "cham-soc-da-mat",
    shortDescription:
      "Cân bằng độ pH, cấp ẩm dịu nhẹ, làm dịu da, se khít lỗ chân lông.",
    description:
      "Chai thủy tinh 100ml, vòi xịt phun sương. Thành phần chính: nước cất hoa hồng nhung cổ hữu cơ 100%. Công dụng: cân bằng độ pH, cấp ẩm dịu nhẹ, làm dịu da, se khít lỗ chân lông.",
    ingredientsInci: "Nước cất hoa hồng nhung cổ hữu cơ 100%.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["CAP_AM", "LAM_DIU"],
    isFeatured: true,
    shelfLifeDays: 365,
    variants: [
      {
        sku: "KR-TN-01",
        name: "Chai thủy tinh 100ml",
        price: 250000,
        batches: [
          // Cận hạn: còn ~20 ngày → loại khỏi tồn bán lẻ, cảnh báo ở Admin
          { manufacturedDaysAgo: 345, initialQuantity: 30, availableQuantity: 24 },
          { manufacturedDaysAgo: 120, initialQuantity: 100, availableQuantity: 80 },
          { manufacturedDaysAgo: 15, initialQuantity: 150, availableQuantity: 150 },
        ],
      },
    ],
  },
  {
    name: "Dầu dưỡng da Karose (Karose Face Oil / Serum)",
    slug: "dau-duong-da-karose",
    categorySlug: "cham-soc-da-mat",
    shortDescription:
      "Dưỡng ẩm sâu, chống lão hóa, phục hồi hàng rào bảo vệ da.",
    description:
      "Chai thủy tinh 30ml, nhỏ giọt (pipette). Thành phần chính: dầu hạt nho, dầu tầm xuân, tinh dầu hoa hồng. Công dụng: dưỡng ẩm sâu, chống lão hóa, phục hồi hàng rào bảo vệ da.",
    ingredientsInci: "Dầu hạt nho, dầu tầm xuân, tinh dầu hoa hồng.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["CAP_AM", "CHONG_LAO_HOA", "PHUC_HOI"],
    isFeatured: true,
    shelfLifeDays: 540,
    variants: [
      {
        sku: "KR-SR-01",
        name: "Chai thủy tinh 30ml",
        price: 380000,
        batches: [
          // Còn ~60 ngày: hợp lệ bán lẻ, được xuất trước (FEFO)
          { manufacturedDaysAgo: 480, initialQuantity: 40, availableQuantity: 28 },
          { manufacturedDaysAgo: 60, initialQuantity: 100, availableQuantity: 100 },
        ],
      },
    ],
  },
  {
    name: "Sữa rửa mặt thảo mộc Karose",
    slug: "sua-rua-mat-thao-moc-karose",
    categorySlug: "lam-sach-da",
    shortDescription:
      "Làm sạch dịu nhẹ, không chứa sulfate, không gây khô căng.",
    description:
      "Chai 100ml, vòi nhấn (pump). Thành phần chính: chiết xuất bồ hòn, nước hoa hồng, tinh dầu thiên nhiên. Công dụng: làm sạch dịu nhẹ, không chứa sulfate, không gây khô căng.",
    ingredientsInci: "Chiết xuất bồ hòn, nước hoa hồng, tinh dầu thiên nhiên.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["LAM_SACH"],
    isFeatured: false,
    shelfLifeDays: 540,
    variants: [
      {
        sku: "KR-CL-01",
        name: "Chai 100ml",
        price: 220000,
        batches: [
          { manufacturedDaysAgo: 300, initialQuantity: 80, availableQuantity: 55 },
          { manufacturedDaysAgo: 30, initialQuantity: 120, availableQuantity: 120 },
        ],
      },
    ],
  },
  {
    name: "Son dưỡng môi hoa hồng Karose",
    slug: "son-duong-moi-hoa-hong-karose",
    categorySlug: "cham-soc-moi",
    shortDescription: "Dưỡng ẩm môi, giảm thâm, làm mềm môi nứt nẻ.",
    description:
      "Thỏi 5g. Thành phần chính: sáp ong, bơ hạt mỡ, dầu dừa, chiết xuất cánh hoa hồng. Công dụng: dưỡng ẩm môi, giảm thâm, làm mềm môi nứt nẻ.",
    ingredientsInci: "Sáp ong, bơ hạt mỡ, dầu dừa, chiết xuất cánh hoa hồng.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["CAP_AM"],
    isFeatured: false,
    shelfLifeDays: 730,
    variants: [
      {
        sku: "KR-LP-01",
        name: "Thỏi 5g",
        price: 120000,
        batches: [
          // Cận hạn: còn ~15 ngày
          { manufacturedDaysAgo: 715, initialQuantity: 40, availableQuantity: 22 },
          { manufacturedDaysAgo: 150, initialQuantity: 200, availableQuantity: 180 },
        ],
      },
    ],
  },
  {
    name: "Dầu gội thảo dược Karose",
    slug: "dau-goi-thao-duoc-karose",
    categorySlug: "cham-soc-toc",
    shortDescription:
      "Làm sạch gàu, giảm rụng tóc, kích thích mọc tóc tự nhiên.",
    description:
      "Chai 250ml / 500ml. Thành phần chính: bồ kết, hương nhu, vỏ bưởi, sả chanh, cỏ mần trầu. Công dụng: làm sạch gàu, giảm rụng tóc, kích thích mọc tóc tự nhiên.",
    ingredientsInci: "Bồ kết, hương nhu, vỏ bưởi, sả chanh, cỏ mần trầu.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["LAM_SACH"],
    isFeatured: true,
    shelfLifeDays: 730,
    variants: [
      {
        // Tài liệu chỉ có một mức giá cho "Chai 250ml / 500ml" nên giữ một biến thể.
        sku: "KR-HC-01",
        name: "Chai 250ml / 500ml",
        price: 240000,
        batches: [
          // Cận hạn: còn ~20 ngày
          { manufacturedDaysAgo: 710, initialQuantity: 30, availableQuantity: 18 },
          { manufacturedDaysAgo: 200, initialQuantity: 150, availableQuantity: 130 },
        ],
      },
    ],
  },
  {
    name: "Xịt dưỡng tóc tinh dầu bưởi & hoa hồng",
    slug: "xit-duong-toc-tinh-dau-buoi-hoa-hong",
    categorySlug: "cham-soc-toc",
    shortDescription:
      "Giảm xơ rối, nuôi dưỡng nang tóc, tạo hương thơm tự nhiên.",
    description:
      "Chai xịt 100ml, phun sương. Thành phần chính: nước cất hoa hồng, tinh dầu vỏ bưởi. Công dụng: giảm xơ rối, nuôi dưỡng nang tóc, tạo hương thơm tự nhiên.",
    ingredientsInci: "Nước cất hoa hồng, tinh dầu vỏ bưởi.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: [],
    isFeatured: false,
    shelfLifeDays: 365,
    variants: [
      {
        sku: "KR-HC-02",
        name: "Chai xịt 100ml",
        price: 180000,
        batches: [
          // Cận hạn: còn ~25 ngày
          { manufacturedDaysAgo: 340, initialQuantity: 20, availableQuantity: 12 },
          { manufacturedDaysAgo: 40, initialQuantity: 80, availableQuantity: 80 },
        ],
      },
    ],
  },
  {
    name: "Xà phòng tắm thủ công Karose (Handmade Soap)",
    slug: "xa-phong-tam-thu-cong-karose",
    categorySlug: "cham-soc-co-the",
    shortDescription:
      "Làm sạch da cơ thể, dưỡng ẩm, giữ mùi hương thư giãn.",
    description:
      "Bánh 100g. Thành phần chính: dầu oliu, dầu dừa, nước cốt hoa hồng, cánh hoa hồng khô. Công dụng: làm sạch da cơ thể, dưỡng ẩm, giữ mùi hương thư giãn.",
    ingredientsInci:
      "Dầu oliu, dầu dừa, nước cốt hoa hồng, cánh hoa hồng khô.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["LAM_SACH", "CAP_AM"],
    isFeatured: false,
    shelfLifeDays: 730,
    variants: [
      {
        sku: "KR-BD-01",
        name: "Bánh 100g",
        price: 110000,
        batches: [
          // Lô đã bán hết (availableQuantity = 0) → không xuất hiện ở storefront
          { manufacturedDaysAgo: 300, initialQuantity: 50, availableQuantity: 0 },
          { manufacturedDaysAgo: 650, initialQuantity: 90, availableQuantity: 64 },
          { manufacturedDaysAgo: 100, initialQuantity: 200, availableQuantity: 200 },
        ],
      },
    ],
  },
  {
    name: "Trà hoa hồng hữu cơ Karose",
    slug: "tra-hoa-hong-huu-co-karose",
    categorySlug: "thuc-pham-tra",
    shortDescription:
      "Thanh nhiệt, đẹp da, giảm căng thẳng, hỗ trợ tiêu hóa.",
    description:
      "Hộp / Lọ 30g - 50g. Thành phần chính: nụ hoa hồng nhung cổ sấy lạnh hữu cơ 100%. Công dụng: thanh nhiệt, đẹp da, giảm căng thẳng, hỗ trợ tiêu hóa.",
    ingredientsInci: "Nụ hoa hồng nhung cổ sấy lạnh hữu cơ 100%.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: [],
    isFeatured: true,
    shelfLifeDays: 540,
    variants: [
      {
        // Tài liệu chỉ có một mức giá cho "Hộp / Lọ 30g - 50g" nên giữ một biến thể.
        sku: "KR-TR-01",
        name: "Hộp / Lọ 30g - 50g",
        price: 190000,
        batches: [
          { manufacturedDaysAgo: 100, initialQuantity: 120, availableQuantity: 120 },
          { manufacturedDaysAgo: 20, initialQuantity: 90, availableQuantity: 90 },
        ],
      },
    ],
  },
];

interface ComboSpec {
  name: string;
  slug: string;
  categorySlug: string;
  shortDescription: string;
  description: string;
  ingredientsInci: string;
  usageGuide: string;
  storageGuide: string | null;
  skinTypes: string[];
  benefits: string[];
  isFeatured: boolean;
  variant: { sku: string; name: string; price: number; compareAtPrice?: number };
  items: { childSku: string; quantity: number }[];
}

/**
 * Combo thử nghiệm logic tách combo (CLAUDE.md §4A). Không có trong tài liệu danh mục:
 * giá = tổng giá các sản phẩm lẻ (250.000 + 380.000 + 220.000), không giảm giá tự đặt.
 */
const COMBOS: ComboSpec[] = [
  {
    name: "Bộ chăm sóc da mặt Karose",
    slug: "bo-cham-soc-da-mat-karose",
    categorySlug: "bo-san-pham-qua-tang",
    shortDescription:
      "Bộ gồm nước hoa hồng, dầu dưỡng da và sữa rửa mặt thảo mộc Karose.",
    description:
      "Bộ 3 sản phẩm: Nước hoa hồng Karose 100ml, Dầu dưỡng da Karose 30ml và Sữa rửa mặt thảo mộc Karose 100ml.",
    ingredientsInci:
      "Nước hoa hồng Karose: nước cất hoa hồng nhung cổ hữu cơ 100%.\nDầu dưỡng da Karose: dầu hạt nho, dầu tầm xuân, tinh dầu hoa hồng.\nSữa rửa mặt thảo mộc Karose: chiết xuất bồ hòn, nước hoa hồng, tinh dầu thiên nhiên.",
    usageGuide: PENDING_TEXT,
    storageGuide: null,
    skinTypes: [],
    benefits: ["CAP_AM", "LAM_DIU", "LAM_SACH", "PHUC_HOI", "CHONG_LAO_HOA"],
    isFeatured: false,
    variant: { sku: "KR-CB-01", name: "Bộ 3 sản phẩm", price: 850000 },
    items: [
      { childSku: "KR-TN-01", quantity: 1 },
      { childSku: "KR-SR-01", quantity: 1 },
      { childSku: "KR-CL-01", quantity: 1 },
    ],
  },
];

interface VoucherSeed {
  code: string;
  description: string;
  discountType: string;
  discountValue: number;
  minOrderAmount: number;
  maxDiscount: number | null;
  usageLimit: number | null;
  usedCount: number;
  startDate: Date;
  endDate: Date;
  isActive: boolean;
  scope?: "ORDER" | "PRODUCT";
  /** Slug sản phẩm được áp mã (chỉ dùng khi scope = PRODUCT). */
  productSlugs?: string[];
}

const VOUCHERS: VoucherSeed[] = [
  {
    code: "KAROSE10",
    description: "Giảm 10% cho đơn từ 300.000đ (tối đa 100.000đ)",
    discountType: "PERCENT",
    discountValue: 10,
    minOrderAmount: 300000,
    maxDiscount: 100000,
    usageLimit: 500,
    usedCount: 12,
    startDate: addDays(NOW, -30),
    endDate: addDays(NOW, 180),
    isActive: true,
  },
  {
    code: "WELCOME50K",
    description: "Giảm 50.000đ cho khách hàng mới, đơn từ 400.000đ",
    discountType: "FIXED",
    discountValue: 50000,
    minOrderAmount: 400000,
    maxDiscount: null,
    usageLimit: 1000,
    usedCount: 87,
    startDate: addDays(NOW, -60),
    endDate: addDays(NOW, 120),
    isActive: true,
  },
  {
    // Đã dùng hết lượt → test validate usageLimit
    code: "SINHNHAT20",
    description: "Giảm 20% mừng sinh nhật KaRose (đã hết lượt)",
    discountType: "PERCENT",
    discountValue: 20,
    minOrderAmount: 600000,
    maxDiscount: 150000,
    usageLimit: 50,
    usedCount: 50,
    startDate: addDays(NOW, -20),
    endDate: addDays(NOW, 40),
    isActive: true,
  },
  {
    // Voucher theo sản phẩm (scope PRODUCT): giảm cố định trên đúng sản phẩm được chọn.
    code: "ROSE20K",
    description: "Giảm 20.000đ cho Nước hoa hồng cổ",
    discountType: "FIXED",
    discountValue: 20000,
    minOrderAmount: 0,
    maxDiscount: null,
    usageLimit: 300,
    usedCount: 0,
    startDate: addDays(NOW, -7),
    endDate: addDays(NOW, 90),
    isActive: true,
    scope: "PRODUCT",
    productSlugs: ["nuoc-hoa-hong-karose"],
  },
  {
    // Voucher theo sản phẩm theo phần trăm, có trần giảm.
    code: "DAUDUONG10",
    description: "Giảm 10% (tối đa 30.000đ) cho Dầu dưỡng da",
    discountType: "PERCENT",
    discountValue: 10,
    minOrderAmount: 0,
    maxDiscount: 30000,
    usageLimit: null,
    usedCount: 0,
    startDate: addDays(NOW, -7),
    endDate: addDays(NOW, 90),
    isActive: true,
    scope: "PRODUCT",
    productSlugs: ["dau-duong-da-karose"],
  },
  {
    // Đã hết hạn → test validate endDate
    code: "HETHAN",
    description: "Mã khuyến mãi mùa hè đã kết thúc",
    discountType: "FIXED",
    discountValue: 30000,
    minOrderAmount: 0,
    maxDiscount: null,
    usageLimit: null,
    usedCount: 140,
    startDate: addDays(NOW, -120),
    endDate: addDays(NOW, -15),
    isActive: true,
  },
];

// Đánh giá mẫu để thử giao diện, gắn với sản phẩm trong danh mục Karose.
const REVIEWS: {
  productSlug: string;
  authorName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  daysAgo: number;
}[] = [
  {
    productSlug: "nuoc-hoa-hong-karose",
    authorName: "Nguyễn Thu Hà",
    rating: 5,
    comment:
      "Mùi hoa hồng rất dịu, xịt lên da thấy mát và mềm. Da mình hay khô nhưng dùng không bị châm chích.",
    isApproved: true,
    daysAgo: 12,
  },
  {
    productSlug: "nuoc-hoa-hong-karose",
    authorName: "Trần Minh Anh",
    rating: 4,
    comment:
      "Vòi xịt phun sương mịn, tiện dùng. Chai thủy tinh nhìn rất đẹp, mong có thêm dung tích lớn hơn.",
    isApproved: true,
    daysAgo: 30,
  },
  {
    productSlug: "dau-duong-da-karose",
    authorName: "Lê Phương Linh",
    rating: 5,
    comment:
      "Chỉ cần vài giọt là đủ cho cả mặt, da mềm hơn vào sáng hôm sau. Mùi hoa hồng nhẹ, dễ chịu.",
    isApproved: true,
    daysAgo: 8,
  },
  {
    productSlug: "sua-rua-mat-thao-moc-karose",
    authorName: "Phạm Quỳnh Như",
    rating: 4,
    comment:
      "Rửa xong da sạch mà không bị căng. Vòi nhấn tiện, một lượng nhỏ là tạo đủ bọt nhẹ.",
    isApproved: true,
    daysAgo: 45,
  },
  {
    productSlug: "son-duong-moi-hoa-hong-karose",
    authorName: "Đặng Hoài Thu",
    rating: 5,
    comment:
      "Môi mình hay nứt nẻ khi trời hanh, dùng vài ngày thấy mềm hơn. Chất son hồng nhạt rất tự nhiên.",
    isApproved: true,
    daysAgo: 5,
  },
  {
    productSlug: "dau-goi-thao-duoc-karose",
    authorName: "Bùi Thanh Tâm",
    rating: 4,
    comment:
      "Gội xong da đầu sạch và mát, mùi thảo mộc dễ chịu. Màu nâu đặc trưng của thảo dược nấu rất đúng như mô tả.",
    isApproved: true,
    daysAgo: 25,
  },
  {
    productSlug: "xit-duong-toc-tinh-dau-buoi-hoa-hong",
    authorName: "Võ Ngọc Bích",
    rating: 5,
    comment:
      "Xịt lên tóc thấy đỡ rối và thơm mùi bưởi nhẹ, không bết tóc.",
    isApproved: true,
    daysAgo: 21,
  },
  {
    productSlug: "xa-phong-tam-thu-cong-karose",
    authorName: "Hoàng Gia Hân",
    rating: 5,
    comment:
      "Bánh xà phòng có cánh hoa khô rất xinh, tạo bọt tốt, tắm xong da không bị khô.",
    isApproved: true,
    daysAgo: 16,
  },
  {
    productSlug: "tra-hoa-hong-huu-co-karose",
    authorName: "Ngô Thùy Dương",
    rating: 5,
    comment:
      "Nụ hoa hồng khô nguyên bông, pha lên thơm dịu. Uống buổi tối thấy dễ chịu.",
    isApproved: true,
    daysAgo: 9,
  },
  {
    // Chưa duyệt → không hiển thị ở storefront, hiển thị ở Admin chờ duyệt
    productSlug: "dau-duong-da-karose",
    authorName: "Khách ẩn danh",
    rating: 3,
    comment: "Sản phẩm ổn nhưng giao hàng hơi chậm so với dự kiến.",
    isApproved: false,
    daysAgo: 2,
  },
];

/* -------------------------------------------------------------------------- */
/* Seed steps                                                                 */
/* -------------------------------------------------------------------------- */

async function resetDatabase() {
  // Children first, then parents (foreign-key safe).
  await prisma.$transaction([
    prisma.chatMessage.deleteMany(),
    prisma.chatSession.deleteMany(),
    prisma.knowledgeSource.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.review.deleteMany(),
    prisma.voucherProduct.deleteMany(),
    prisma.comboItem.deleteMany(),
    prisma.inventoryBatch.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.category.deleteMany(),
    prisma.voucher.deleteMany(),
    prisma.user.deleteMany(),
  ]);
}

async function seedUsers() {
  const adminPassword = process.env.SEED_ADMIN_PASSWORD ?? "Admin@123456";
  const staffPassword = process.env.SEED_STAFF_PASSWORD ?? "Staff@123456";
  const [adminHash, staffHash] = await Promise.all([
    bcrypt.hash(adminPassword, 10),
    bcrypt.hash(staffPassword, 10),
  ]);

  await prisma.user.createMany({
    data: [
      {
        name: "Quản trị viên KaRose",
        email: "admin@karose.vn",
        phone: "0900000001",
        passwordHash: adminHash,
        role: Role.ADMIN,
      },
      {
        name: "Nhân viên kho KaRose",
        email: "staff@karose.vn",
        phone: "0900000002",
        passwordHash: staffHash,
        role: Role.STAFF,
      },
    ],
  });

  return { adminPassword, staffPassword };
}

async function seedCatalogue() {
  const categoryIdBySlug = new Map<string, string>();
  for (const category of CATEGORIES) {
    const created = await prisma.category.create({ data: category });
    categoryIdBySlug.set(category.slug, created.id);
  }

  const variantIdBySku = new Map<string, string>();
  const productIdBySlug = new Map<string, string>();
  let batchCount = 0;

  // 1) Regular products + variants + FEFO batches
  for (const spec of PRODUCTS) {
    const categoryId = categoryIdBySlug.get(spec.categorySlug);
    if (!categoryId) throw new Error(`Unknown category: ${spec.categorySlug}`);

    const product = await prisma.product.create({
      data: {
        name: spec.name,
        slug: spec.slug,
        shortDescription: spec.shortDescription,
        description: spec.description,
        ingredientsInci: spec.ingredientsInci,
        usageGuide: spec.usageGuide,
        storageGuide: spec.storageGuide,
        skinTypes: spec.skinTypes,
        benefits: spec.benefits,
        images: [`/images/products/${spec.variants[0].sku}.jpg`],
        isFeatured: spec.isFeatured,
        isActive: true,
        isCombo: false,
        categoryId,
        variants: {
          create: spec.variants.map((v) => ({
            sku: v.sku,
            name: v.name,
            price: v.price,
            compareAtPrice: v.compareAtPrice ?? null,
            weightGram: v.weightGram,
          })),
        },
      },
      include: { variants: true },
    });
    productIdBySlug.set(spec.slug, product.id);

    for (const variant of product.variants) {
      variantIdBySku.set(variant.sku, variant.id);
      const variantSpec = spec.variants.find((v) => v.sku === variant.sku);
      if (!variantSpec) continue;

      const batches = variantSpec.batches.map((b, index) => {
        const manufacturedDate = addDays(NOW, -b.manufacturedDaysAgo);
        return {
          variantId: variant.id,
          batchCode: formatBatchCode(variant.sku, manufacturedDate, index + 1),
          manufacturedDate,
          expiryDate: addDays(manufacturedDate, spec.shelfLifeDays),
          initialQuantity: b.initialQuantity,
          availableQuantity: b.availableQuantity,
          reservedQuantity: 0,
        };
      });
      await prisma.inventoryBatch.createMany({ data: batches });
      batchCount += batches.length;
    }
  }

  // 2) Combo products (virtual stock: derived from child variants at checkout)
  for (const combo of COMBOS) {
    const categoryId = categoryIdBySlug.get(combo.categorySlug);
    if (!categoryId) throw new Error(`Unknown category: ${combo.categorySlug}`);

    const comboItems = combo.items.map((item) => {
      const childVariantId = variantIdBySku.get(item.childSku);
      if (!childVariantId) throw new Error(`Unknown child SKU: ${item.childSku}`);
      return { childVariantId, quantity: item.quantity };
    });

    const product = await prisma.product.create({
      data: {
        name: combo.name,
        slug: combo.slug,
        shortDescription: combo.shortDescription,
        description: combo.description,
        ingredientsInci: combo.ingredientsInci,
        usageGuide: combo.usageGuide,
        storageGuide: combo.storageGuide,
        skinTypes: combo.skinTypes,
        benefits: combo.benefits,
        images: [],
        isFeatured: combo.isFeatured,
        isActive: true,
        isCombo: true,
        categoryId,
        variants: {
          create: [
            {
              sku: combo.variant.sku,
              name: combo.variant.name,
              price: combo.variant.price,
              compareAtPrice: combo.variant.compareAtPrice ?? null,
            },
          ],
        },
        comboItems: { create: comboItems },
      },
    });
    productIdBySlug.set(combo.slug, product.id);
  }

  return { productIdBySlug, batchCount };
}

async function seedVouchers(productIdBySlug: Map<string, string>) {
  for (const { productSlugs, ...data } of VOUCHERS) {
    const productIds = (productSlugs ?? []).map((slug) => {
      const id = productIdBySlug.get(slug);
      if (!id) throw new Error(`Seed voucher ${data.code}: không tìm thấy sản phẩm "${slug}"`);
      return id;
    });
    await prisma.voucher.create({
      data: {
        ...data,
        scope: data.scope ?? "ORDER",
        products: { create: productIds.map((productId) => ({ productId })) },
      },
    });
  }
}

async function seedReviews(productIdBySlug: Map<string, string>) {
  for (const review of REVIEWS) {
    const productId = productIdBySlug.get(review.productSlug);
    if (!productId) throw new Error(`Unknown product for review: ${review.productSlug}`);
    await prisma.review.create({
      data: {
        productId,
        authorName: review.authorName,
        rating: review.rating,
        comment: review.comment,
        images: [],
        isApproved: review.isApproved,
        createdAt: addDays(NOW, -review.daysAgo),
      },
    });
  }
}

/**
 * Nguồn kiến thức MẪU: chỉ là trang gốc của các tổ chức tham khảo, tắt sẵn (isActive=false) để chatbot
 * không trích dẫn nội dung chưa kiểm chứng. Vào /admin/knowledge → "Thêm nguồn thủ công" để tải nội dung thật.
 */
async function seedKnowledgeSources() {
  const samples = [
    { title: "DermNet — thông tin về da liễu", sourceUrl: "https://dermnetnz.org/", category: "SAFETY" },
    { title: "American Academy of Dermatology", sourceUrl: "https://www.aad.org/", category: "GENERAL" },
    { title: "National Library of Medicine (NIH)", sourceUrl: "https://www.ncbi.nlm.nih.gov/", category: "INGREDIENT" },
  ];
  for (const s of samples) {
    await prisma.knowledgeSource.create({
      data: { ...s, summary: "Nguồn mẫu — chưa tải nội dung. Dùng Admin → Kiến thức chatbot để thêm/làm mới trang cụ thể.", isActive: false },
    });
  }
}

async function main() {
  if (
    process.env.NODE_ENV === "production" &&
    process.env.ALLOW_SEED_RESET !== "true"
  ) {
    throw new Error(
      "Từ chối chạy seed trên production (seed sẽ xóa toàn bộ dữ liệu). Đặt ALLOW_SEED_RESET=true nếu bạn thực sự muốn.",
    );
  }

  console.log("🌿 KaRose seed: đang dọn dữ liệu cũ...");
  await resetDatabase();

  console.log("👤 Tạo tài khoản ADMIN / STAFF...");
  const credentials = await seedUsers();

  console.log("🗂️  Tạo danh mục, sản phẩm, combo và lô hàng...");
  const { productIdBySlug, batchCount } = await seedCatalogue();

  console.log("🎟️  Tạo voucher...");
  await seedVouchers(productIdBySlug);

  console.log("📚 Tạo nguồn kiến thức mẫu...");
  await seedKnowledgeSources();

  console.log("⭐ Tạo đánh giá...");
  await seedReviews(productIdBySlug);

  const nearExpiryCutoff = addDays(NOW, 30);
  const [products, variants, nearExpiry, sellable, vouchers, approvedReviews] =
    await Promise.all([
      prisma.product.count(),
      prisma.productVariant.count(),
      prisma.inventoryBatch.count({
        where: { expiryDate: { lte: nearExpiryCutoff }, availableQuantity: { gt: 0 } },
      }),
      prisma.inventoryBatch.count({
        where: { expiryDate: { gt: nearExpiryCutoff }, availableQuantity: { gt: 0 } },
      }),
      prisma.voucher.count(),
      prisma.review.count({ where: { isApproved: true } }),
    ]);

  console.log("\n✅ Seed hoàn tất");
  console.log(`   Sản phẩm: ${products} (gồm ${COMBOS.length} combo) | Biến thể: ${variants}`);
  console.log(
    `   Lô hàng: ${batchCount} | Cận hạn <30 ngày: ${nearExpiry} | Có thể bán lẻ: ${sellable}`,
  );
  console.log(`   Voucher: ${vouchers} | Đánh giá đã duyệt: ${approvedReviews}`);
  console.log(`   Ví dụ giá combo: ${formatVND(COMBOS[0].variant.price)}`);
  console.log("\n   Đăng nhập thử:");
  console.log(`   ADMIN  admin@karose.vn / ${credentials.adminPassword}`);
  console.log(`   STAFF  staff@karose.vn / ${credentials.staffPassword}`);
}

main()
  .catch((error) => {
    console.error("❌ Seed thất bại:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
