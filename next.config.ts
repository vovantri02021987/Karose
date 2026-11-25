import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Ảnh sản phẩm là file tĩnh trong /public: bỏ tối ưu hoá để chạy ổn trên Cloudflare Workers.
  images: { unoptimized: true },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

// Cho phép dùng bindings của Cloudflare khi chạy `next dev`.
initOpenNextCloudflareForDev();

export default nextConfig;
