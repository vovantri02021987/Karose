import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

/**
 * PrismaClient dành riêng cho test. KHÔNG bao giờ dùng DATABASE_URL.
 * Từ chối chạy nếu TEST_DATABASE_URL trỏ tới host từ xa (vd. Neon production)
 * trừ khi đặt ALLOW_REMOTE_TEST_DB=1 một cách có chủ đích.
 */
const url = process.env.TEST_DATABASE_URL;
if (!url) {
  throw new Error(
    "Thiếu TEST_DATABASE_URL (vd. postgresql://postgres:postgres@localhost:54329/karose_test)",
  );
}
const host = new URL(url).hostname;
const isLocal = host === "localhost" || host === "127.0.0.1" || host === "::1";
if (!isLocal && process.env.ALLOW_REMOTE_TEST_DB !== "1") {
  throw new Error(
    `Từ chối chạy test trên DB từ xa (${host}). Dùng DB cục bộ hoặc đặt ALLOW_REMOTE_TEST_DB=1 nếu chắc chắn đây là DB test.`,
  );
}

export const prisma = new PrismaClient({
  adapter: new PrismaPg({ connectionString: url }),
});
export default prisma;
