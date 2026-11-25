/** Kiểu dữ liệu storefront (serializable, dùng được ở cả Server và Client). */

export const SKIN_TYPES = [
  { value: "DA_DAU", label: "Da dầu" },
  { value: "DA_KHO", label: "Da khô" },
  { value: "DA_NHAY_CAM", label: "Da nhạy cảm" },
  { value: "HON_HOP", label: "Da hỗn hợp" },
  { value: "MOI_LOAI_DA", label: "Mọi loại da" },
] as const;

export const BENEFITS = [
  { value: "CAP_AM", label: "Cấp ẩm" },
  { value: "LAM_DIU", label: "Làm dịu" },
  { value: "LAM_SACH", label: "Làm sạch" },
  { value: "PHUC_HOI", label: "Phục hồi" },
  { value: "CHONG_LAO_HOA", label: "Chống lão hóa" },
] as const;

export function skinTypeLabel(value: string): string {
  return SKIN_TYPES.find((s) => s.value === value)?.label ?? value;
}

export function benefitLabel(value: string): string {
  return BENEFITS.find((b) => b.value === value)?.label ?? value;
}

export interface CatalogVariant {
  id: string;
  sku: string;
  name: string;
  price: number;
  compareAtPrice: number | null;
  weightGram: number;
  /** Tồn khả dụng FEFO (combo: tính theo thành phần con). */
  stock: number;
}

export interface CatalogProduct {
  id: string;
  slug: string;
  name: string;
  shortDescription: string;
  categoryId: string;
  categorySlug: string;
  categoryName: string;
  images: string[];
  isFeatured: boolean;
  isCombo: boolean;
  /** Khung giao hàng chuẩn của sản phẩm (ngày làm việc). */
  deliveryMinDays: number;
  deliveryMaxDays: number;
  skinTypes: string[];
  benefits: string[];
  variants: CatalogVariant[];
  /** Giá thấp nhất trong các biến thể. */
  minPrice: number;
  /** Giá so sánh của biến thể có giá thấp nhất (nếu có). */
  minCompareAtPrice: number | null;
  /** Tổng tồn bán lẻ của sản phẩm (combo: số bộ tối đa). */
  stock: number;
  /** Chuỗi đã bỏ dấu để tìm kiếm theo tên/thành phần. */
  searchIndex: string;
}

export interface ComboComponent {
  variantId: string;
  productName: string;
  productSlug: string;
  variantName: string;
  quantity: number;
  image: string | null;
}

export interface PublicReview {
  id: string;
  authorName: string;
  rating: number;
  comment: string;
  createdAt: string;
}

export interface HomeReview extends PublicReview {
  productName: string;
  productSlug: string;
}

/** Voucher theo sản phẩm đang chạy, gợi ý trên trang chi tiết. */
export interface ProductVoucherHint {
  code: string;
  description: string;
  /** Ví dụ "Giảm 20.000 ₫" hoặc "Giảm 10% (tối đa 30.000 ₫)". */
  discountLabel: string;
  minOrderAmount: number;
  endDate: string;
}

export interface ProductDetail extends CatalogProduct {
  description: string;
  ingredientsInci: string;
  usageGuide: string;
  storageGuide: string | null;
  comboComponents: ComboComponent[];
  reviews: PublicReview[];
  ratingAverage: number;
  ratingCount: number;
  /** Hạn dùng gần nhất (ISO) của lô còn bán được, theo biến thể. Combo: rỗng. */
  expiryByVariant: Record<string, string>;
  vouchers: ProductVoucherHint[];
}

export interface CategorySummary {
  id: string;
  name: string;
  slug: string;
  count: number;
  /** Ảnh đại diện danh mục (ảnh đầu tiên của sản phẩm còn hàng, nếu có). */
  image: string | null;
}

export interface CartItem {
  variantId: string;
  productId: string;
  slug: string;
  name: string;
  variantName: string;
  sku: string;
  price: number;
  compareAtPrice: number | null;
  image: string | null;
  quantity: number;
  /** Tồn khả dụng FEFO tại thời điểm thêm vào giỏ. */
  maxStock: number;
  isCombo: boolean;
  /** Khung giao hàng chuẩn của sản phẩm; giỏ cũ trong localStorage có thể không có (mặc định 2–4). */
  deliveryMinDays?: number;
  deliveryMaxDays?: number;
}
