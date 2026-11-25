import { z } from "zod";

/** Schema form giao hàng (kiểm tra phía Client; Server vẫn kiểm tra lại ở POST /api/orders). */
export const checkoutFormSchema = z.object({
  customerName: z.string().trim().min(2, "Vui lòng nhập họ tên").max(100),
  customerPhone: z
    .string()
    .trim()
    .regex(/^0\d{9}$/, "Số điện thoại gồm 10 chữ số, bắt đầu bằng 0"),
  customerEmail: z
    .string()
    .trim()
    .refine((v) => v === "" || z.email().safeParse(v).success, "Email không hợp lệ"),
  province: z.string().trim().min(1, "Vui lòng chọn tỉnh/thành"),
  district: z.string().trim().min(1, "Vui lòng nhập quận/huyện").max(100),
  ward: z.string().trim().min(1, "Vui lòng nhập phường/xã").max(100),
  shippingAddress: z.string().trim().min(3, "Vui lòng nhập địa chỉ cụ thể").max(255),
  note: z.string().trim().max(500, "Ghi chú tối đa 500 ký tự"),
});

export type CheckoutFormValues = z.infer<typeof checkoutFormSchema>;
export type CheckoutFormErrors = Partial<Record<keyof CheckoutFormValues, string>>;

export const EMPTY_CHECKOUT_FORM: CheckoutFormValues = {
  customerName: "",
  customerPhone: "",
  customerEmail: "",
  province: "",
  district: "",
  ward: "",
  shippingAddress: "",
  note: "",
};
