import { PATCH as patchStatusRoute } from "@/app/api/admin/orders/[id]/status/route";
import { signSession } from "@/lib/auth/session";
import { SESSION_COOKIE } from "@/lib/auth/session";
import { cookieJar } from "./cookies";

/** Đặt cookie phiên cho user (ký thật bằng AUTH_SECRET của test). */
export async function loginAs(user: { id: string; name: string | null; email: string; role: "ADMIN" | "STAFF" | "CUSTOMER" }) {
  cookieJar.set(SESSION_COOKIE, await signSession({ id: user.id, name: user.name, email: user.email, role: user.role }));
}
export function logout() {
  cookieJar.delete(SESSION_COOKIE);
}

export async function patchStatus(orderId: string, body: Record<string, unknown>) {
  const res = await patchStatusRoute(
    new Request(`http://localhost/api/admin/orders/${orderId}/status`, {
      method: "PATCH",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    }),
    { params: Promise.resolve({ id: orderId }) },
  );
  return { status: res.status, body: await res.json() };
}
