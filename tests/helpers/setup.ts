// Biến môi trường cố định cho test (không dùng secret thật).
process.env.AUTH_SECRET = "test-auth-secret-0123456789abcdef";
process.env.VIETQR_WEBHOOK_SECRET = "test-webhook-secret";
process.env.VIETQR_BANK_ID = "970436";
process.env.VIETQR_ACCOUNT_NO = "0123456789";
process.env.VIETQR_ACCOUNT_NAME = "CONG TY KAROSE TEST";

import { vi } from "vitest";

// `cookies()` của Next chỉ chạy trong request scope → thay bằng kho cookie giả toàn cục.
vi.mock("next/headers", () => {
  const g = globalThis as unknown as { __cookieJar?: Map<string, string> };
  const jar = (g.__cookieJar ??= new Map<string, string>());
  return {
    cookies: async () => ({
      get: (name: string) => {
        const value = jar.get(name);
        return value === undefined ? undefined : { name, value };
      },
      set: (name: string, value: string) => void jar.set(name, value),
      delete: (name: string) => void jar.delete(name),
    }),
    headers: async () => new Headers(),
  };
});
