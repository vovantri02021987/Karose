import { defineCloudflareConfig } from "@opennextjs/cloudflare";

// Cache mặc định (in-memory). Khi cần ISR/revalidate bền vững, thêm R2 incremental cache:
// https://opennext.js.org/cloudflare/caching
export default defineCloudflareConfig();
