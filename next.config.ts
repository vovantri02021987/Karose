import type { NextConfig } from "next";
import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";

const nextConfig: NextConfig = {
  // Workers không có bộ tối ưu ảnh runtime: dùng loader trỏ tới bản WebP tạo sẵn trong /public.
  images: { loader: "custom", loaderFile: "./src/lib/image-loader.ts" },
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
