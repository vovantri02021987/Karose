// Tạo bản WebP 400/800/1000px cho ảnh sản phẩm: node scripts/make-webp.mjs
import { readdirSync, mkdirSync } from "node:fs";
import path from "node:path";
import sharp from "sharp";

const dir = "public/images/products";
const out = path.join(dir, "w");
mkdirSync(out, { recursive: true });
const WIDTHS = [400, 800, 1000];
for (const f of readdirSync(dir).filter((n) => /\.jpe?g$/i.test(n))) {
  const base = f.replace(/\.jpe?g$/i, "");
  for (const w of WIDTHS) {
    await sharp(path.join(dir, f))
      .resize({ width: w, withoutEnlargement: true })
      .webp({ quality: 78 })
      .toFile(path.join(out, `${base}-${w}.webp`));
  }
}
console.log("done");
