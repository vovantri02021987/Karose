/** Kho cookie giả cho `next/headers` (mock được đăng ký trong tests/helpers/setup.ts). */
const g = globalThis as unknown as { __cookieJar?: Map<string, string> };
export const cookieJar: Map<string, string> = (g.__cookieJar ??= new Map());
