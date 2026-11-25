import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";

/**
 * Singleton PrismaClient.
 * - Dev: Next.js hot-reload re-evaluates modules, so the instance is cached on
 *   `globalThis` to avoid exhausting PostgreSQL connections.
 * - Cloudflare Workers: the Rust engine cannot run there, so the Neon driver
 *   adapter (WebSocket pool, supports interactive $transaction) is used.
 *   DATABASE_URL comes from a Worker secret and is exposed on process.env by
 *   the `nodejs_compat` flag.
 * - Node (local dev, seed, CLI, other hosts): the regular query engine.
 */
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined;
};

function isCloudflareWorkers(): boolean {
  return (
    typeof navigator !== "undefined" &&
    navigator.userAgent === "Cloudflare-Workers"
  );
}

function createPrismaClient(): PrismaClient {
  const log: ("query" | "error" | "warn")[] =
    process.env.NODE_ENV === "development"
      ? ["query", "error", "warn"]
      : ["error"];

  if (isCloudflareWorkers()) {
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) {
      throw new Error("DATABASE_URL chưa được cấu hình cho Worker.");
    }
    return new PrismaClient({
      adapter: new PrismaNeon({ connectionString }),
      log,
    });
  }

  return new PrismaClient({ log });
}

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
