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
  weightGram: number;
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
  storageGuide: string;
  skinTypes: string[];
  benefits: string[];
  images: string[];
  isFeatured: boolean;
  /** Shelf life in days from the manufacture date (unopened). */
  shelfLifeDays: number;
  variants: VariantSpec[];
}

/* -------------------------------------------------------------------------- */
/* Catalogue data                                                             */
/* -------------------------------------------------------------------------- */

const CATEGORIES = [
  {
    name: "Chăm sóc da mặt",
    slug: "cham-soc-da-mat",
    description:
      "Nước hoa hồng, tẩy trang và tinh chất từ thảo mộc, giúp da cân bằng và khỏe tự nhiên.",
    imageUrl: "/images/categories/cham-soc-da-mat.webp",
  },
  {
    name: "Chăm sóc cơ thể",
    slug: "cham-soc-co-the",
    description:
      "Xà phòng thủ công và sản phẩm dưỡng thể làm từ dầu bơ thực vật, dịu nhẹ cho làn da nhạy cảm.",
    imageUrl: "/images/categories/cham-soc-co-the.webp",
  },
  {
    name: "Chăm sóc tóc",
    slug: "cham-soc-toc",
    description:
      "Dầu gội và dưỡng tóc từ bồ kết, sả, vỏ bưởi — làm sạch dịu nhẹ, nuôi dưỡng chân tóc.",
    imageUrl: "/images/categories/cham-soc-toc.webp",
  },
  {
    name: "Bộ sản phẩm & quà tặng",
    slug: "bo-san-pham-qua-tang",
    description:
      "Các bộ sản phẩm được phối sẵn và set quà tặng tinh tế, tiết kiệm hơn khi mua lẻ.",
    imageUrl: "/images/categories/bo-san-pham-qua-tang.webp",
  },
];

const PRODUCTS: ProductSpec[] = [
  {
    name: "Nước hoa hồng chưng cất Damask",
    slug: "nuoc-hoa-hong-chung-cat-damask",
    categorySlug: "cham-soc-da-mat",
    shortDescription:
      "Nước hoa hồng chưng cất hơi nước từ cánh hoa hồng Damask, cấp ẩm và làm dịu da tức thì.",
    description:
      "Được chưng cất hơi nước từ cánh hoa hồng Damask thu hoạch vào buổi sáng sớm, nước hoa hồng KaRose giữ trọn hương thơm tự nhiên và các hoạt chất dịu nhẹ của hoa. Công thức không cồn, không hương liệu tổng hợp, bổ sung Hyaluronic Acid và Panthenol giúp da căng mịn, cân bằng độ pH sau bước làm sạch.",
    ingredientsInci:
      "Rosa Damascena Flower Water, Aloe Barbadensis Leaf Juice, Glycerin, Sodium Hyaluronate, Panthenol, Betaine, Sodium Benzoate, Potassium Sorbate, Citric Acid.",
    usageGuide:
      "1. Sau bước tẩy trang và rửa mặt, thấm một lượng vừa đủ ra bông cotton hoặc ra lòng bàn tay.\n2. Vỗ nhẹ lên mặt và cổ cho đến khi thẩm thấu.\n3. Tiếp tục với serum và kem dưỡng. Dùng sáng và tối; có thể xịt khoáng giữa ngày.",
    storageGuide:
      "Bảo quản nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp. Hạn sử dụng 18 tháng kể từ ngày sản xuất; sau khi mở nắp nên dùng trong vòng 12 tháng.",
    skinTypes: ["MOI_LOAI_DA", "DA_KHO", "DA_NHAY_CAM"],
    benefits: ["CAP_AM", "LAM_DIU"],
    images: [
      "/images/products/nuoc-hoa-hong-damask-1.webp",
      "/images/products/nuoc-hoa-hong-damask-2.webp",
    ],
    isFeatured: true,
    shelfLifeDays: 540,
    variants: [
      {
        sku: "KR-TONER-100",
        name: "Chai 100ml",
        price: 180000,
        weightGram: 220,
        batches: [
          // Cận hạn: còn ~20 ngày → bị loại khỏi tồn bán lẻ
          { manufacturedDaysAgo: 520, initialQuantity: 30, availableQuantity: 24 },
          { manufacturedDaysAgo: 150, initialQuantity: 120, availableQuantity: 96 },
          { manufacturedDaysAgo: 20, initialQuantity: 150, availableQuantity: 150 },
        ],
      },
      {
        sku: "KR-TONER-250",
        name: "Chai 250ml",
        price: 350000,
        compareAtPrice: 390000,
        weightGram: 420,
        batches: [
          // Còn ~60 ngày: hợp lệ bán lẻ, được xuất trước (FEFO)
          { manufacturedDaysAgo: 480, initialQuantity: 40, availableQuantity: 28 },
          { manufacturedDaysAgo: 60, initialQuantity: 100, availableQuantity: 100 },
        ],
      },
    ],
  },
  {
    name: "Dầu tẩy trang thảo mộc",
    slug: "dau-tay-trang-thao-moc",
    categorySlug: "cham-soc-da-mat",
    shortDescription:
      "Dầu tẩy trang từ jojoba và hoa cúc, làm sạch lớp trang điểm mà không làm khô da.",
    description:
      "Dầu tẩy trang KaRose kết hợp dầu jojoba, dầu hướng dương và chiết xuất calendula, hoa cúc La Mã. Dầu nhũ hóa nhanh khi gặp nước, cuốn trôi lớp trang điểm, kem chống nắng và bã nhờn mà vẫn giữ lại lớp màng ẩm tự nhiên cho da.",
    ingredientsInci:
      "Simmondsia Chinensis (Jojoba) Seed Oil, Caprylic/Capric Triglyceride, Helianthus Annuus (Sunflower) Seed Oil, Polyglyceryl-4 Oleate, Calendula Officinalis Flower Extract, Chamomilla Recutita (Matricaria) Flower Extract, Rosmarinus Officinalis (Rosemary) Leaf Extract, Tocopherol.",
    usageGuide:
      "1. Lấy 2–3 lần bơm ra lòng bàn tay khô.\n2. Massage nhẹ nhàng lên mặt khô khoảng 1 phút, chú ý vùng mắt và môi.\n3. Thêm một ít nước để nhũ hóa, massage thêm 30 giây rồi rửa sạch bằng nước ấm.\n4. Tiếp tục với sữa rửa mặt nếu cần.",
    storageGuide:
      "Đậy kín nắp sau khi dùng, để nơi mát, tránh nắng. Hạn sử dụng 18 tháng kể từ ngày sản xuất; dùng trong 12 tháng sau khi mở nắp.",
    skinTypes: ["DA_DAU", "HON_HOP", "MOI_LOAI_DA"],
    benefits: ["LAM_SACH", "LAM_DIU"],
    images: [
      "/images/products/dau-tay-trang-1.webp",
      "/images/products/dau-tay-trang-2.webp",
    ],
    isFeatured: true,
    shelfLifeDays: 540,
    variants: [
      {
        sku: "KR-OIL-100",
        name: "Chai 100ml",
        price: 220000,
        weightGram: 240,
        batches: [
          { manufacturedDaysAgo: 300, initialQuantity: 80, availableQuantity: 55 },
          { manufacturedDaysAgo: 30, initialQuantity: 120, availableQuantity: 120 },
        ],
      },
      {
        sku: "KR-OIL-200",
        name: "Chai 200ml",
        price: 390000,
        compareAtPrice: 440000,
        weightGram: 400,
        batches: [
          // Cận hạn: chỉ còn ~5 ngày
          { manufacturedDaysAgo: 535, initialQuantity: 15, availableQuantity: 9 },
          { manufacturedDaysAgo: 90, initialQuantity: 60, availableQuantity: 60 },
        ],
      },
    ],
  },
  {
    name: "Serum phục hồi rau má & B5",
    slug: "serum-phuc-hoi-rau-ma-b5",
    categorySlug: "cham-soc-da-mat",
    shortDescription:
      "Tinh chất phục hồi hàng rào bảo vệ da với rau má, Panthenol và Niacinamide.",
    description:
      "Serum KaRose tập trung vào phục hồi: chiết xuất rau má (Centella Asiatica) làm dịu vùng da kích ứng, Panthenol (B5) và Allantoin hỗ trợ làm lành, Niacinamide cùng Squalane giúp da săn chắc và mịn màng hơn theo thời gian. Kết cấu mỏng nhẹ, thẩm thấu nhanh, không gây bết dính.",
    ingredientsInci:
      "Aqua, Centella Asiatica Extract, Glycerin, Panthenol, Niacinamide, Sodium Hyaluronate, Squalane, Betaine, Allantoin, Xanthan Gum, Sodium Benzoate, Potassium Sorbate, Citric Acid.",
    usageGuide:
      "1. Sau toner, nhỏ 3–4 giọt serum ra lòng bàn tay.\n2. Ấn nhẹ lên da mặt và cổ, tránh vùng mắt.\n3. Dùng sáng và tối trước kem dưỡng. Ban ngày nên kết hợp kem chống nắng.\n4. Thử trước ở vùng da nhỏ nếu da rất nhạy cảm.",
    storageGuide:
      "Bảo quản ở nhiệt độ dưới 25°C, tránh ánh sáng. Hạn sử dụng 12 tháng kể từ ngày sản xuất; dùng trong 6 tháng sau khi mở nắp.",
    skinTypes: ["DA_NHAY_CAM", "DA_KHO", "MOI_LOAI_DA"],
    benefits: ["PHUC_HOI", "LAM_DIU", "CHONG_LAO_HOA"],
    images: [
      "/images/products/serum-rau-ma-1.webp",
      "/images/products/serum-rau-ma-2.webp",
    ],
    isFeatured: true,
    shelfLifeDays: 365,
    variants: [
      {
        sku: "KR-SERUM-30",
        name: "Chai 30ml",
        price: 450000,
        compareAtPrice: 490000,
        weightGram: 120,
        batches: [
          // Cận hạn (~20 ngày) → cảnh báo ở Admin
          { manufacturedDaysAgo: 345, initialQuantity: 30, availableQuantity: 18 },
          { manufacturedDaysAgo: 200, initialQuantity: 70, availableQuantity: 40 },
          { manufacturedDaysAgo: 15, initialQuantity: 100, availableQuantity: 100 },
        ],
      },
      {
        sku: "KR-SERUM-50",
        name: "Chai 50ml",
        price: 690000,
        weightGram: 180,
        batches: [
          // Lô đã bán hết (availableQuantity = 0) → không xuất hiện ở storefront
          { manufacturedDaysAgo: 300, initialQuantity: 20, availableQuantity: 0 },
          { manufacturedDaysAgo: 120, initialQuantity: 50, availableQuantity: 50 },
          { manufacturedDaysAgo: 10, initialQuantity: 40, availableQuantity: 40 },
        ],
      },
    ],
  },
  {
    name: "Xà phòng thủ công bơ hạt mỡ & oải hương",
    slug: "xa-phong-thu-cong-bo-hat-mo-oai-huong",
    categorySlug: "cham-soc-co-the",
    shortDescription:
      "Xà phòng handmade nấu lạnh từ dầu ô liu, dầu dừa và bơ hạt mỡ, hương oải hương thư giãn.",
    description:
      "Mỗi bánh xà phòng KaRose được nấu lạnh (cold process) và ủ khoảng 6 tuần để xà phòng chín hoàn toàn. Dầu ô liu và bơ hạt mỡ dưỡng ẩm, dầu dừa tạo bọt mịn, tinh dầu oải hương mang lại cảm giác thư thái. Giữ lại glycerin tự nhiên nên da không bị khô căng sau khi tắm.",
    ingredientsInci:
      "Sodium Olivate, Sodium Cocoate, Sodium Shea Butterate, Aqua, Glycerin, Lavandula Angustifolia (Lavender) Oil, Butyrospermum Parkii (Shea) Butter, Sodium Chloride.",
    usageGuide:
      "1. Làm ướt bánh xà phòng và tạo bọt giữa hai bàn tay hoặc bằng bông tắm.\n2. Massage lên cơ thể, tránh vùng mắt, rồi rửa sạch với nước.\n3. Để xà phòng ở khay có khe thoát nước để bánh xà phòng luôn khô ráo.",
    storageGuide:
      "Để nơi khô ráo, thoáng khí, không để ngâm nước. Hạn sử dụng 24 tháng kể từ ngày sản xuất; hương thơm có thể nhạt dần theo thời gian nhưng chất lượng không đổi.",
    skinTypes: ["MOI_LOAI_DA", "DA_KHO", "DA_NHAY_CAM"],
    benefits: ["CAP_AM", "LAM_SACH"],
    images: [
      "/images/products/xa-phong-oai-huong-1.webp",
      "/images/products/xa-phong-oai-huong-2.webp",
    ],
    isFeatured: false,
    shelfLifeDays: 730,
    variants: [
      {
        sku: "KR-SOAP-100",
        name: "Bánh 100g",
        price: 95000,
        weightGram: 110,
        batches: [
          { manufacturedDaysAgo: 650, initialQuantity: 90, availableQuantity: 64 },
          { manufacturedDaysAgo: 100, initialQuantity: 200, availableQuantity: 200 },
        ],
      },
      {
        sku: "KR-SOAP-3PK",
        name: "Gói 3 bánh",
        price: 270000,
        compareAtPrice: 285000,
        weightGram: 340,
        batches: [
          { manufacturedDaysAgo: 40, initialQuantity: 60, availableQuantity: 60 },
        ],
      },
    ],
  },
  {
    name: "Dầu gội thảo mộc bồ kết & sả",
    slug: "dau-goi-thao-moc-bo-ket-sa",
    categorySlug: "cham-soc-toc",
    shortDescription:
      "Dầu gội làm sạch dịu nhẹ từ bồ kết và sả chanh, giảm dầu và làm thơm mát da đầu.",
    description:
      "Dầu gội KaRose dùng chiết xuất bồ kết truyền thống kết hợp tinh dầu sả chanh, chất làm sạch gốc dừa nên làm sạch dầu thừa mà không gây khô xơ. Panthenol giúp tóc mềm mượt, hương sả thơm nhẹ lưu lại sau khi gội.",
    ingredientsInci:
      "Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Gleditsia Sinensis Fruit Extract, Glycerin, Panthenol, Cymbopogon Citratus (Lemongrass) Leaf Oil, Sodium Benzoate, Potassium Sorbate, Citric Acid.",
    usageGuide:
      "1. Làm ướt tóc và da đầu.\n2. Lấy một lượng vừa đủ, massage da đầu 2–3 phút để tạo bọt rồi xả sạch.\n3. Với tóc nhiều dầu, có thể gội lần hai. Dùng 2–3 lần mỗi tuần hoặc theo nhu cầu.",
    storageGuide:
      "Bảo quản nơi thoáng mát, tránh nắng, đậy kín nắp. Hạn sử dụng 24 tháng kể từ ngày sản xuất; dùng trong 12 tháng sau khi mở nắp.",
    skinTypes: ["DA_DAU", "HON_HOP", "MOI_LOAI_DA"],
    benefits: ["LAM_SACH", "PHUC_HOI"],
    images: [
      "/images/products/dau-goi-bo-ket-1.webp",
      "/images/products/dau-goi-bo-ket-2.webp",
    ],
    isFeatured: true,
    shelfLifeDays: 730,
    variants: [
      {
        sku: "KR-SHAMPOO-250",
        name: "Chai 250ml",
        price: 195000,
        weightGram: 300,
        batches: [
          // Cận hạn (~20 ngày)
          { manufacturedDaysAgo: 710, initialQuantity: 30, availableQuantity: 18 },
          { manufacturedDaysAgo: 200, initialQuantity: 150, availableQuantity: 130 },
        ],
      },
      {
        sku: "KR-SHAMPOO-500",
        name: "Chai 500ml",
        price: 340000,
        compareAtPrice: 380000,
        weightGram: 560,
        batches: [
          { manufacturedDaysAgo: 90, initialQuantity: 80, availableQuantity: 80 },
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
  storageGuide: string;
  skinTypes: string[];
  benefits: string[];
  images: string[];
  isFeatured: boolean;
  variant: { sku: string; name: string; price: number; compareAtPrice: number; weightGram: number };
  items: { childSku: string; quantity: number }[];
}

const COMBOS: ComboSpec[] = [
  {
    name: "Bộ chăm sóc da mặt thiết yếu",
    slug: "bo-cham-soc-da-mat-thiet-yeu",
    categorySlug: "bo-san-pham-qua-tang",
    shortDescription:
      "Bộ 3 bước gồm nước hoa hồng, dầu tẩy trang và serum phục hồi — tiết kiệm 60.000đ so với mua lẻ.",
    description:
      "Quy trình dưỡng da tối giản gồm ba bước: tẩy trang bằng dầu thảo mộc, cân bằng với nước hoa hồng Damask và phục hồi bằng serum rau má & B5. Phù hợp để bắt đầu hành trình chăm sóc da tự nhiên hoặc làm quà tặng.",
    ingredientsInci:
      "Nước hoa hồng chưng cất Damask 100ml: Rosa Damascena Flower Water, Aloe Barbadensis Leaf Juice, Glycerin, Sodium Hyaluronate, Panthenol, Betaine, Sodium Benzoate, Potassium Sorbate, Citric Acid.\nDầu tẩy trang thảo mộc 100ml: Simmondsia Chinensis (Jojoba) Seed Oil, Caprylic/Capric Triglyceride, Helianthus Annuus (Sunflower) Seed Oil, Polyglyceryl-4 Oleate, Calendula Officinalis Flower Extract, Chamomilla Recutita (Matricaria) Flower Extract, Rosmarinus Officinalis (Rosemary) Leaf Extract, Tocopherol.\nSerum phục hồi rau má & B5 30ml: Aqua, Centella Asiatica Extract, Glycerin, Panthenol, Niacinamide, Sodium Hyaluronate, Squalane, Betaine, Allantoin, Xanthan Gum, Sodium Benzoate, Potassium Sorbate, Citric Acid.",
    usageGuide:
      "Bước 1: Tẩy trang bằng dầu tẩy trang thảo mộc, rửa sạch với nước ấm.\nBước 2: Vỗ nước hoa hồng lên da còn hơi ẩm.\nBước 3: Thoa 3–4 giọt serum, sau đó dưỡng ẩm và chống nắng vào ban ngày.",
    storageGuide:
      "Bảo quản từng sản phẩm nơi khô ráo, tránh nắng. Hạn sử dụng của bộ được tính theo sản phẩm có hạn ngắn nhất (xem nhãn từng chai).",
    skinTypes: ["MOI_LOAI_DA", "DA_NHAY_CAM", "DA_KHO"],
    benefits: ["LAM_SACH", "CAP_AM", "PHUC_HOI"],
    images: ["/images/products/bo-da-mat-thiet-yeu-1.webp"],
    isFeatured: true,
    variant: {
      sku: "KR-COMBO-FACE",
      name: "Bộ 3 sản phẩm",
      price: 790000,
      compareAtPrice: 850000,
      weightGram: 600,
    },
    items: [
      { childSku: "KR-TONER-100", quantity: 1 },
      { childSku: "KR-OIL-100", quantity: 1 },
      { childSku: "KR-SERUM-30", quantity: 1 },
    ],
  },
  {
    name: "Set quà tặng Thảo mộc dịu nhẹ",
    slug: "set-qua-tang-thao-moc-diu-nhe",
    categorySlug: "bo-san-pham-qua-tang",
    shortDescription:
      "Set quà gồm 2 bánh xà phòng oải hương và 1 chai dầu gội bồ kết sả 250ml, đóng hộp giấy kraft.",
    description:
      "Set quà dành cho những ai yêu mùi hương thảo mộc: hai bánh xà phòng thủ công oải hương và một chai dầu gội bồ kết & sả. Hộp giấy kraft tái chế, kèm thiệp viết tay theo yêu cầu.",
    ingredientsInci:
      "Xà phòng thủ công bơ hạt mỡ & oải hương: Sodium Olivate, Sodium Cocoate, Sodium Shea Butterate, Aqua, Glycerin, Lavandula Angustifolia (Lavender) Oil, Butyrospermum Parkii (Shea) Butter, Sodium Chloride.\nDầu gội thảo mộc bồ kết & sả 250ml: Aqua, Sodium Cocoyl Isethionate, Cocamidopropyl Betaine, Gleditsia Sinensis Fruit Extract, Glycerin, Panthenol, Cymbopogon Citratus (Lemongrass) Leaf Oil, Sodium Benzoate, Potassium Sorbate, Citric Acid.",
    usageGuide:
      "Xà phòng: tạo bọt với nước, massage lên cơ thể rồi xả sạch.\nDầu gội: massage da đầu 2–3 phút rồi xả sạch với nước.",
    storageGuide:
      "Để nơi khô ráo, thoáng mát. Hạn sử dụng theo từng sản phẩm trong set (xem nhãn).",
    skinTypes: ["MOI_LOAI_DA"],
    benefits: ["LAM_SACH", "CAP_AM"],
    images: ["/images/products/set-qua-thao-moc-1.webp"],
    isFeatured: false,
    variant: {
      sku: "KR-COMBO-GIFT",
      name: "Set quà 3 món",
      price: 349000,
      compareAtPrice: 385000,
      weightGram: 560,
    },
    items: [
      { childSku: "KR-SOAP-100", quantity: 2 },
      { childSku: "KR-SHAMPOO-250", quantity: 1 },
    ],
  },
];

const VOUCHERS = [
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

const REVIEWS: {
  productSlug: string;
  authorName: string;
  rating: number;
  comment: string;
  isApproved: boolean;
  daysAgo: number;
}[] = [
  {
    productSlug: "nuoc-hoa-hong-chung-cat-damask",
    authorName: "Nguyễn Thu Hà",
    rating: 5,
    comment:
      "Mùi hoa hồng rất dịu, không nồng. Da mình khô và hay đỏ nhưng dùng một tuần đã thấy mềm hơn hẳn, không hề châm chích.",
    isApproved: true,
    daysAgo: 12,
  },
  {
    productSlug: "nuoc-hoa-hong-chung-cat-damask",
    authorName: "Trần Minh Anh",
    rating: 4,
    comment:
      "Cấp ẩm tốt, thấm nhanh. Chai 250ml dùng được lâu. Mong có thêm đầu xịt phun sương cho tiện.",
    isApproved: true,
    daysAgo: 30,
  },
  {
    productSlug: "dau-tay-trang-thao-moc",
    authorName: "Lê Phương Linh",
    rating: 5,
    comment:
      "Tẩy trang sạch cả mascara chống nước mà không cay mắt. Rửa lại bằng nước thấy da không bị căng.",
    isApproved: true,
    daysAgo: 8,
  },
  {
    productSlug: "dau-tay-trang-thao-moc",
    authorName: "Phạm Quỳnh Như",
    rating: 4,
    comment:
      "Nhũ hóa nhanh, mùi thảo mộc dễ chịu. Da dầu như mình dùng xong vẫn cần rửa mặt thêm một lần.",
    isApproved: true,
    daysAgo: 45,
  },
  {
    productSlug: "serum-phuc-hoi-rau-ma-b5",
    authorName: "Đặng Hoài Thu",
    rating: 5,
    comment:
      "Da mình bị kích ứng sau khi đi nắng, dùng serum này khoảng 10 ngày thì đỡ đỏ rõ rệt. Kết cấu mỏng, không bết.",
    isApproved: true,
    daysAgo: 5,
  },
  {
    productSlug: "serum-phuc-hoi-rau-ma-b5",
    authorName: "Võ Ngọc Bích",
    rating: 5,
    comment:
      "Mua lần thứ hai rồi. Thích nhất là bảng thành phần rõ ràng, dễ kiểm tra từng chất.",
    isApproved: true,
    daysAgo: 21,
  },
  {
    productSlug: "xa-phong-thu-cong-bo-hat-mo-oai-huong",
    authorName: "Hoàng Gia Hân",
    rating: 5,
    comment:
      "Bọt mịn, mùi oải hương thơm nhẹ, tắm xong da không bị khô. Gói 3 bánh rất đáng tiền.",
    isApproved: true,
    daysAgo: 16,
  },
  {
    productSlug: "dau-goi-thao-moc-bo-ket-sa",
    authorName: "Bùi Thanh Tâm",
    rating: 4,
    comment:
      "Gội xong da đầu sạch và mát, mùi sả thơm. Tuần đầu tóc hơi xơ một chút, sau đó thì mượt dần.",
    isApproved: true,
    daysAgo: 25,
  },
  {
    productSlug: "bo-cham-soc-da-mat-thiet-yeu",
    authorName: "Ngô Thùy Dương",
    rating: 5,
    comment:
      "Mua làm quà cho mẹ, mẹ rất thích. Đóng gói cẩn thận, có ghi rõ hạn sử dụng trên từng chai.",
    isApproved: true,
    daysAgo: 9,
  },
  {
    // Chưa duyệt → không hiển thị ở storefront, hiển thị ở Admin chờ duyệt
    productSlug: "serum-phuc-hoi-rau-ma-b5",
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
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.review.deleteMany(),
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
        images: spec.images,
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
        images: combo.images,
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
              compareAtPrice: combo.variant.compareAtPrice,
              weightGram: combo.variant.weightGram,
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

async function seedVouchers() {
  await prisma.voucher.createMany({ data: VOUCHERS });
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
  await seedVouchers();

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
