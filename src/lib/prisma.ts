import { PrismaClient } from "@prisma/client";
import { PrismaNeon } from "@prisma/adapter-neon";
import { getCloudflareContext } from "@opennextjs/cloudflare";

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

/**
 * Trên Cloudflare Workers, kết nối WebSocket của Neon KHÔNG được dùng chung
 * giữa các request ("Cannot perform I/O on behalf of a different request").
 * Vì vậy mỗi request có một PrismaClient riêng, khoá theo `ctx` của request
 * (WeakMap); kết nối được Workers giải phóng khi request kết thúc.
 */
const workerClients = new WeakMap<object, PrismaClient>();

function getWorkerClient(): PrismaClient {
  const { ctx } = getCloudflareContext();
  let client = workerClients.get(ctx);
  if (!client) {
    const created = createPrismaClient();
    client = created;
    workerClients.set(ctx, created);
  }
  return client;
}

function createPrismaForRuntime(): PrismaClient {
  if (!isCloudflareWorkers()) {
    return globalForPrisma.prisma ?? createPrismaClient();
  }
  return new Proxy({} as PrismaClient, {
    get(_target, prop) {
      const client = getWorkerClient();
      const value = Reflect.get(client, prop, client);
      return typeof value === "function" ? value.bind(client) : value;
    },
  });
}

export const prisma = createPrismaForRuntime();

if (!isCloudflareWorkers() && process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

export default prisma;
