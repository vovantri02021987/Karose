export type OrderStatusKey =
  | "PENDING" | "CONFIRMED" | "PROCESSING" | "SHIPPING" | "DELIVERED" | "CANCELLED" | "RETURNED";
export type PaymentStatusKey = "UNPAID" | "PAID" | "REFUNDED";

export const ORDER_STATUS_LABEL: Record<OrderStatusKey, string> = {
  PENDING: "Chờ xác nhận",
  CONFIRMED: "Đã xác nhận",
  PROCESSING: "Đang chuẩn bị",
  SHIPPING: "Đang giao",
  DELIVERED: "Đã giao",
  CANCELLED: "Đã huỷ",
  RETURNED: "Hoàn trả",
};

export const PAYMENT_STATUS_LABEL: Record<PaymentStatusKey, string> = {
  UNPAID: "Chưa thanh toán",
  PAID: "Đã thanh toán",
  REFUNDED: "Đã hoàn tiền",
};

export const PAYMENT_METHOD_LABEL: Record<"COD" | "VIETQR", string> = {
  COD: "COD",
  VIETQR: "VietQR",
};
