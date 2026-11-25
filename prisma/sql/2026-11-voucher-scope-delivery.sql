-- KaRose: voucher theo sản phẩm + thời gian giao hàng dự kiến.
-- CHỈ THÊM cột/bảng (không xoá dữ liệu), chạy lại nhiều lần vẫn an toàn.
-- Dùng khi không muốn `prisma db push`/seed (seed sẽ xoá dữ liệu). Chạy TRƯỚC khi deploy code mới.

DO $$ BEGIN
  CREATE TYPE "VoucherScope" AS ENUM ('ORDER', 'PRODUCT');
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

ALTER TABLE "Voucher" ADD COLUMN IF NOT EXISTS "scope" "VoucherScope" NOT NULL DEFAULT 'ORDER';

CREATE TABLE IF NOT EXISTS "VoucherProduct" (
  "voucherId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  CONSTRAINT "VoucherProduct_pkey" PRIMARY KEY ("voucherId", "productId"),
  CONSTRAINT "VoucherProduct_voucherId_fkey" FOREIGN KEY ("voucherId") REFERENCES "Voucher"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "VoucherProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "VoucherProduct_productId_idx" ON "VoucherProduct"("productId");

ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deliveryMinDays" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "Product" ADD COLUMN IF NOT EXISTS "deliveryMaxDays" INTEGER NOT NULL DEFAULT 4;

ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryMinDays" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "deliveryMaxDays" INTEGER;
ALTER TABLE "Order" ADD COLUMN IF NOT EXISTS "estimatedDeliveryText" TEXT;
