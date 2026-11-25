import { defineConfig } from "vitest/config";
import path from "node:path";

/**
 * Test tích hợp nghiệp vụ KaRose (chạy với Postgres thật).
 * - `@/lib/prisma` được thay bằng tests/helpers/prisma.ts để dùng DB test
 *   (TEST_DATABASE_URL) thay vì DATABASE_URL production.
 * - Các file chạy tuần tự vì dùng chung một DB.
 */
export default defineConfig({
  resolve: {
    alias: [
      {
        find: /^@\/lib\/prisma$/,
        replacement: path.resolve(__dirname, "tests/helpers/prisma.ts"),
      },
      { find: /^@\//, replacement: `${path.resolve(__dirname, "src")}/` },
    ],
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    setupFiles: ["tests/helpers/setup.ts"],
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
