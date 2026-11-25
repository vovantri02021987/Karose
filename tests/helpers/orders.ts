import { POST as createOrderRoute } from "@/app/api/orders/route";
import { RUN } from "./factory";

export interface PlaceResult {
  status: number;
  body: any; // eslint-disable-line @typescript-eslint/no-explicit-any
}

/** Gọi trực tiếp route handler POST /api/orders như một request thật. */
export async function placeOrder(
  items: { variantId: string; quantity: number }[],
  extra: Record<string, unknown> = {},
): Promise<PlaceResult> {
  const res = await createOrderRoute(
    new Request("http://localhost/api/orders", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        customerName: `${RUN} Khach`,
        customerPhone: "0901234567",
        shippingAddress: "1 Nguyen Hue",
        province: "Hồ Chí Minh",
        district: "Quận 1",
        ward: "Bến Nghé",
        paymentMethod: "COD",
        items,
        ...extra,
      }),
    }),
  );
  return { status: res.status, body: await res.json() };
}
