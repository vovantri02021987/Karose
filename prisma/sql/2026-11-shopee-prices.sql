-- Đồng bộ giá bán lẻ theo giá Shopee (đã chạy trên Neon ngày 2026-11-26).
UPDATE "ProductVariant" SET price = 175000, "updatedAt" = now() WHERE sku = 'KR-TN-01' AND price = 250000;
UPDATE "ProductVariant" SET price = 325000, "updatedAt" = now() WHERE sku = 'KR-SR-01' AND price = 380000;
UPDATE "ProductVariant" SET price = 135000, "updatedAt" = now() WHERE sku = 'KR-HC-01' AND price = 240000;
UPDATE "ProductVariant" SET price = 125000, "updatedAt" = now() WHERE sku = 'KR-BD-01' AND price = 110000;
UPDATE "ProductVariant" SET price = 175000, "updatedAt" = now() WHERE sku = 'KR-TR-01' AND price = 190000;
