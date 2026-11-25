import { cookies } from "next/headers";
import { SESSION_COOKIE, sessionCookieOptions } from "@/lib/auth/session";

export async function POST(request: Request) {
  const origin = request.headers.get("origin");
  if (origin && new URL(origin).host !== new URL(request.url).host) {
    return Response.json({ error: "Yêu cầu không hợp lệ" }, { status: 403 });
  }
  (await cookies()).set(SESSION_COOKIE, "", sessionCookieOptions(0));
  return Response.json({ ok: true });
}
