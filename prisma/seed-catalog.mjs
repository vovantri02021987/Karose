// Idempotent catalog import (29 SKU Shopee-derived products + gallery images for 5 originals).
// Run via the "Seed catalog" GitHub workflow (needs DATABASE_URL). Safe to re-run: ON CONFLICT DO NOTHING.
import { neon } from "@neondatabase/serverless";
import fs from "node:fs";

const url = process.env.DATABASE_URL;
if (!url) throw new Error("DATABASE_URL is required");
const sql = neon(url);
const parts = JSON.parse(
  fs.readFileSync(new URL("./catalog-seed.json", import.meta.url), "utf8"),
);
await sql.transaction(parts.map((p) => sql.query(p)));
const rows = await sql.query(
  `select count(*)::int as products, (select count(*)::int from "ProductVariant") as variants from "Product"`,
);
console.log("done", rows[0]);
