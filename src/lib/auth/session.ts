import { cookies } from "next/headers";

/**
 * Session cookie tự ký (HMAC-SHA256, Web Crypto) – chạy được trên Cloudflare Workers
 * mà không cần thêm thư viện. Token: base64url(payload).base64url(signature).
 */

export type StaffRole = "ADMIN" | "STAFF";

export interface SessionPayload {
  id: string;
  name: string | null;
  email: string;
  role: "ADMIN" | "STAFF" | "CUSTOMER";
  exp: number; // epoch giây
}

export const SESSION_COOKIE = "karose_session";
export const SESSION_TTL_SECONDS = 8 * 60 * 60;

const encoder = new TextEncoder();

function toBase64Url(bytes: Uint8Array): string {
  let bin = "";
  for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function fromBase64Url(input: string): Uint8Array {
  const b64 = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = b64 + "=".repeat((4 - (b64.length % 4)) % 4);
  const bin = atob(padded);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/**
 * Khoá ký: ưu tiên AUTH_SECRET. Nếu chưa cấu hình, dẫn xuất từ DATABASE_URL
 * (cũng là secret của Worker) để không bị mở toang; nên đặt AUTH_SECRET riêng.
 */
async function getKey(): Promise<CryptoKey> {
  const secret = process.env.AUTH_SECRET;
  let material: Uint8Array;
  if (secret && secret.length >= 16) {
    material = encoder.encode(secret);
  } else {
    const fallback = process.env.DATABASE_URL;
    if (!fallback) throw new Error("AUTH_SECRET chưa được cấu hình");
    const digest = await crypto.subtle.digest(
      "SHA-256",
      encoder.encode(`karose-session-v1:${fallback}`),
    );
    material = new Uint8Array(digest);
  }
  return crypto.subtle.importKey(
    "raw",
    material as BufferSource,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

export async function signSession(
  data: Omit<SessionPayload, "exp">,
  ttlSeconds = SESSION_TTL_SECONDS,
): Promise<string> {
  const payload: SessionPayload = {
    ...data,
    exp: Math.floor(Date.now() / 1000) + ttlSeconds,
  };
  const body = toBase64Url(encoder.encode(JSON.stringify(payload)));
  const sig = await crypto.subtle.sign("HMAC", await getKey(), encoder.encode(body));
  return `${body}.${toBase64Url(new Uint8Array(sig))}`;
}

export async function verifySession(token: string | undefined): Promise<SessionPayload | null> {
  if (!token) return null;
  const [body, sig] = token.split(".");
  if (!body || !sig) return null;
  try {
    const ok = await crypto.subtle.verify(
      "HMAC",
      await getKey(),
      fromBase64Url(sig) as BufferSource,
      encoder.encode(body),
    );
    if (!ok) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64Url(body))) as SessionPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now() / 1000) return null;
    if (!payload.id || !payload.email || !payload.role) return null;
    return payload;
  } catch {
    return null;
  }
}

export async function readSessionCookie(): Promise<SessionPayload | null> {
  const store = await cookies();
  return verifySession(store.get(SESSION_COOKIE)?.value);
}

export function sessionCookieOptions(maxAge = SESSION_TTL_SECONDS) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}
