# Test nghiệp vụ KaRose (FEFO, Combo, VietQR, Huỷ/Giao, Phân quyền)

Chạy với Postgres THẬT (không mock Prisma) để kiểm được transaction, rollback và đồng thời.

```bash
# 1) DB test trống (cục bộ hoặc 1 nhánh Neon riêng, KHÔNG phải production)
export TEST_DATABASE_URL=postgresql://postgres:postgres@localhost:5432/karose_test
DATABASE_URL=$TEST_DATABASE_URL npx prisma db push      # tạo bảng (hoặc psql -f tests/helpers/schema.sql)

# 2) Chạy
npm test
```

- `tests/helpers/prisma.ts` thay `@/lib/prisma` trong lúc test (xem `vitest.config.ts`), dùng `@prisma/adapter-pg`.
  Từ chối chạy nếu `TEST_DATABASE_URL` không phải localhost (trừ khi `ALLOW_REMOTE_TEST_DB=1`).
- Mọi dữ liệu test mang tiền tố ngẫu nhiên và được xoá sau mỗi file; mỗi file tự kiểm tra không còn dữ liệu sót.
- Test không đụng `DATABASE_URL`.
