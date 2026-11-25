-- Bổ sung tồn kho: mọi biến thể đơn (không phải combo) của sản phẩm đang bán
-- mà tồn kho bán được = 0 sẽ được thêm 1 lô ADJ 5 đơn vị.
-- "Bán được" theo FEFO: availableQuantity > 0 và hạn dùng > now + 30 ngày.
-- Idempotent: chạy lại không tạo thêm lô vì biến thể đã có tồn kho bán được.
-- Đã chạy trên Neon production ngày 2026-11-25 (21 lô, 105 đơn vị).
-- KHÔNG đưa vào prisma/seed.ts: seed là dữ liệu demo và sẽ xóa sạch DB.

INSERT INTO "InventoryBatch"
  ("id", "variantId", "batchCode", "manufacturedDate", "expiryDate",
   "initialQuantity", "availableQuantity", "reservedQuantity", "createdAt")
SELECT
  'adj' || replace(gen_random_uuid()::text, '-', ''),
  v.id,
  'ADJ-1125-' || v.sku,
  TIMESTAMP '2026-11-01',
  CASE WHEN v.sku LIKE 'KR-MK-%' OR v.sku LIKE 'KR-CL-%'
       THEN TIMESTAMP '2027-05-01'
       ELSE TIMESTAMP '2027-11-01' END,
  5, 5, 0, now()
FROM "ProductVariant" v
JOIN "Product" p ON p.id = v."productId"
WHERE p."isActive"
  AND NOT p."isCombo"
  AND NOT EXISTS (
    SELECT 1 FROM "InventoryBatch" b
    WHERE b."variantId" = v.id
      AND b."availableQuantity" > 0
      AND b."expiryDate" > now() + interval '30 days'
  );
