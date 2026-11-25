/**
 * Thời gian giao hàng dự kiến (ngày làm việc). Thuần hàm, KHÔNG import Prisma
 * nên dùng được ở cả Server và Client.
 *
 * Mỗi sản phẩm có khung chuẩn (mặc định 2–4 ngày). Khu vực điều chỉnh khung đó:
 *   - TP.HCM & Hà Nội: min − 1, max − 2  → mặc định 1–2 ngày
 *   - Tỉnh/thành khác: min + 1, max + 1  → mặc định 3–5 ngày
 * Sản phẩm cần bảo quản mát / pha chế theo lô: Admin tăng khung của sản phẩm (VD 3–5)
 * → tự cộng vào cả hai khu vực. Giỏ nhiều sản phẩm: lấy khung chậm nhất.
 */

export const DEFAULT_DELIVERY_MIN_DAYS = 2;
export const DEFAULT_DELIVERY_MAX_DAYS = 4;

export interface DeliveryWindow {
  minDays: number;
  maxDays: number;
}

export interface DeliveryEstimate extends DeliveryWindow {
  text: string;
}

/** Bỏ dấu, hạ chữ thường, gộp khoảng trắng để so khớp tên tỉnh/thành. */
export function normalizeProvince(input: string): string {
  return input
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/gi, "d")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function isBigCity(province: string): boolean {
  const n = normalizeProvince(province)
    .replace(/^(thanh pho|tp)\s+/, "")
    .trim();
  return (
    n === "ho chi minh" ||
    n === "hcm" ||
    n === "hcmc" ||
    n === "sai gon" ||
    n === "ha noi" ||
    n === "hn"
  );
}

/** Tỉnh/thành "trục chính" (TP.HCM, Hà Nội) có thời gian giao ngắn nhất. */
export function isCoreHubProvince(province: string): boolean {
  return isBigCity(province);
}

/** Đưa khung về giá trị hợp lệ: số nguyên, min ≥ 1, max ≥ min. */
function sanitize(minDays: number, maxDays: number): DeliveryWindow {
  const min = Math.max(1, Math.floor(Number.isFinite(minDays) ? minDays : DEFAULT_DELIVERY_MIN_DAYS));
  const max = Math.max(min, Math.floor(Number.isFinite(maxDays) ? maxDays : DEFAULT_DELIVERY_MAX_DAYS));
  return { minDays: min, maxDays: max };
}

export function formatDeliveryText(minDays: number, maxDays: number): string {
  return minDays === maxDays
    ? `${minDays} ngày làm việc`
    : `${minDays}–${maxDays} ngày làm việc`;
}

/** Khung giao cho một khu vực, từ khung chuẩn của sản phẩm. */
export function deliveryWindowForRegion(
  base: DeliveryWindow,
  bigCity: boolean,
): DeliveryEstimate {
  const b = sanitize(base.minDays, base.maxDays);
  const w = bigCity
    ? sanitize(b.minDays - 1, b.maxDays - 2)
    : sanitize(b.minDays + 1, b.maxDays + 1);
  return { ...w, text: formatDeliveryText(w.minDays, w.maxDays) };
}

/** Giỏ nhiều sản phẩm: khung chậm nhất (min lớn nhất, max lớn nhất). */
export function slowestWindow(windows: DeliveryWindow[]): DeliveryWindow {
  if (windows.length === 0) {
    return {
      minDays: DEFAULT_DELIVERY_MIN_DAYS,
      maxDays: DEFAULT_DELIVERY_MAX_DAYS,
    };
  }
  return sanitize(
    Math.max(...windows.map((w) => w.minDays)),
    Math.max(...windows.map((w) => w.maxDays)),
  );
}

/** Dự kiến giao theo tỉnh/thành cho một nhóm khung sản phẩm. */
export function estimateDelivery(
  windows: DeliveryWindow[],
  province: string,
): DeliveryEstimate {
  return deliveryWindowForRegion(slowestWindow(windows), isCoreHubProvince(province));
}

/** Tên chính thức: dự kiến giao theo tỉnh/thành cho khung của các sản phẩm trong giỏ. */
export const calculateEstimatedDelivery = estimateDelivery;

/** Cả hai khu vực — dùng khi chưa biết tỉnh/thành (PDP, giỏ trượt). */
export function estimateDeliveryBothRegions(windows: DeliveryWindow[]): {
  bigCity: DeliveryEstimate;
  other: DeliveryEstimate;
} {
  const base = slowestWindow(windows);
  return {
    bigCity: deliveryWindowForRegion(base, true),
    other: deliveryWindowForRegion(base, false),
  };
}

/** Câu hiển thị trên PDP / giỏ khi chưa chọn tỉnh. */
export function deliverySummaryText(windows: DeliveryWindow[]): string {
  const { bigCity, other } = estimateDeliveryBothRegions(windows);
  return `Giao dự kiến ${bigCity.text} tại TP.HCM & Hà Nội, ${other.text} các tỉnh khác`;
}
