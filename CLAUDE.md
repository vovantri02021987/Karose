# KaRose — Hướng dẫn cho Claude

@AGENTS.md

Website bán mỹ phẩm thiên nhiên KaRose (Storefront + Admin/OMS).

## 1. TECH STACK

- Next.js 16 (App Router), React 19, TypeScript, Tailwind CSS 4.
- Prisma 6 + Neon Postgres; deploy Cloudflare Workers (OpenNext) qua GitHub Actions khi push `main`.
- Không tự ý thêm thư viện ngoài (Redux, Framer Motion, UI kit nặng...) khi chưa được yêu cầu.
- Ưu tiên Server Component; chỉ dùng `"use client"` cho phần thật sự tương tác.
- Tiền tệ là số nguyên VND, luôn hiển thị qua `formatVND`.

## 2. NGHIỆP VỤ & KIỂM THỬ

- FEFO: lô bán được khi `available > 0` và hạn dùng > hôm nay + 30 ngày (`sellableExpiryCutoff`).
- Combo được bung thành các SKU thành phần khi giữ/xuất kho.
- Test: `npm test` (vitest, Postgres thật qua `TEST_DATABASE_URL`). Xem `tests/README.md`.
- Trước khi commit: `npx next typegen && npx tsc --noEmit`, `npx eslint`, `npm test`.

### 2.1 Voucher theo phạm vi & thời gian giao hàng

- `Voucher.scope`: `ORDER` (giảm trên toàn bộ tiền hàng) hoặc `PRODUCT` (chỉ giảm trên tiền hàng của các sản phẩm trong bảng `VoucherProduct`).
- Voucher `PRODUCT`: `minOrderAmount` và mức giảm đều tính trên **phần tiền hàng thuộc sản phẩm áp dụng**; `discountAmount` không vượt phần đó. Combo là một sản phẩm riêng, chỉ được giảm khi chính combo được chọn (không bung theo thành phần con). Giỏ không có sản phẩm hợp lệ → `VoucherError`.
- Phí ship vẫn xét trên `subtotal - discountAmount` (≥ 500.000 ₫ → 0; HCM/HN 20.000; tỉnh khác 30.000).
- Giao hàng dự kiến (`src/lib/delivery.ts`, thuần hàm, dùng được ở Client): mỗi sản phẩm có khung chuẩn `deliveryMinDays/deliveryMaxDays` (mặc định 2–4 ngày làm việc). HCM/Hà Nội: min−1, max−2 (→ 1–2); tỉnh khác: min+1, max+1 (→ 3–5). Giỏ nhiều sản phẩm lấy khung chậm nhất. Sản phẩm cần bảo quản mát/pha theo lô: Admin tăng khung của sản phẩm.
- Đơn hàng chốt cam kết tại lúc đặt: `Order.deliveryMinDays/deliveryMaxDays/estimatedDeliveryText` (đơn cũ để null). `POST /api/checkout/preview`, `POST /api/orders`, `POST /api/tracking` đều trả thông tin này.
- Admin: `/admin/promotions` (tạo/sửa/bật-tắt/xoá voucher; voucher đã gắn vào đơn thì chỉ được tắt) và `/admin/products` (ô ngày giao). API: `/api/admin/vouchers` (POST) và `/api/admin/vouchers/[id]` (PATCH bật/tắt, PUT sửa, DELETE).
- Cập nhật DB: `npx prisma db push` (dev) hoặc, trên DB đang có dữ liệu thật, chạy `prisma/sql/2026-11-voucher-scope-delivery.sql` (chỉ thêm cột/bảng, chạy lại an toàn) rồi mới deploy. `npx prisma db seed` XOÁ toàn bộ dữ liệu — chỉ dùng cho DB trống/dev (seed có sẵn voucher theo sản phẩm `ROSE20K`, `DAUDUONG10`).

## 3. DESIGN SYSTEM

Phong cách Organic & Minimalist: nhiều khoảng trắng, mộc mạc, rõ từng thông số (thành phần, cách dùng, bảo quản).

### 3.1 Bộ font — Editorial Botanical

Khai báo trong `src/app/layout.tsx` bằng `next/font/google` (`subsets: ['vietnamese','latin']`, `display: 'swap'`), gắn cả 3 biến vào `<html>`.

| Vai trò | Font | Biến CSS | Tiện ích Tailwind |
|---|---|---|---|
| Tiêu đề (thương hiệu, hero, tiêu đề trang/mục, tên sản phẩm) | Cormorant Garamond 500/600/700 + italic | `--font-heading` | `font-heading` |
| Nội dung, UI, form, bảng | Be Vietnam Pro 400/500/600/700 | `--font-sans` | `font-sans` (mặc định của `body`) |
| Mã & số hiệu | JetBrains Mono 400/500 | `--font-mono` | `font-mono` |

`body` mặc định: `font-sans antialiased bg-[#FAF8F5] text-[#1F2421]`.

**Lưu ý kỹ thuật:** biến của next/font trùng tên khoá theme `--font-sans` của Tailwind, nên `globals.css` dùng `@theme inline { --font-*: initial; }` và định nghĩa `@utility font-heading | font-sans | font-mono` thủ công (tránh vòng tự tham chiếu `--font-sans: var(--font-sans)`). Không đổi lại thành `--font-sans: var(--font-sans)` trong `@theme`.

### 3.2 Scale Typography (`src/app/globals.css`)

| Utility | Dùng cho | Định nghĩa |
|---|---|---|
| `type-hero` | h1 Hero trang chủ | `font-heading text-4xl sm:text-5xl lg:text-6xl font-semibold leading-[1.1] tracking-[-0.01em]` |
| `type-page-title` | h1 mỗi trang | `font-heading text-3xl sm:text-4xl font-semibold leading-[1.15]` |
| `type-section` | h2 các mục | `font-heading text-2xl sm:text-3xl font-semibold leading-[1.2]` |
| `type-card` | h3 thẻ sản phẩm / mục trong văn bản dài | `font-sans text-base sm:text-lg font-semibold leading-snug` |
| `type-card-editorial` | tiêu đề panel/thẻ kiểu editorial | `font-heading text-xl font-semibold leading-snug` |
| `type-body` | văn bản thường | `font-sans text-sm sm:text-base leading-relaxed text-foreground` |
| `type-caption` | chú thích, nhãn INCI | `font-sans text-xs sm:text-sm font-medium text-muted-foreground` |
| `type-price` | tiền, số lượng | `font-medium tabular-nums` |
| `type-code` | `orderCode`, `batchCode`, SKU | `font-mono tabular-nums` |

Base layer: `h1, h2` → `font-heading`; `h3, h4` → `font-sans`.

### 3.3 Quy tắc áp dụng

1. Serif (`font-heading`) chỉ cho tiêu đề ngắn. **Không** dùng cho văn bản dài (INCI, hướng dẫn sử dụng, bảo quản), form, bảng dữ liệu admin → giữ `font-sans`. Vì vậy h3 trong `RichText` dùng `type-card`.
2. Mọi số tiền (`formatVND`), tồn kho, số lượng, giỏ hàng (SlideCart), checkout, tracking, bảng tồn kho FEFO và bảng đơn hàng admin phải có `tabular-nums` (đặt ở container gốc hoặc dùng `type-price`).
3. `orderCode`, `batchCode`, SKU luôn dùng `type-code` (`font-mono tabular-nums`).
4. Input/textarea/select giữ `font-sans`.

### 3.4 Màu (token trong `globals.css`)

| Token | Giá trị | Ghi chú |
|---|---|---|
| `--kr-background` | `#faf8f5` | nền chính |
| `--kr-surface` | `#ede7d6` | |
| `--kr-primary` | `#682934` | |
| `--kr-accent` | `#204029` | |
| `--kr-text` | `#1f2421` | |
| `--kr-text-muted` | `#5c6660` | |
| `--kr-border` | `#ddd5c0` | |

## 4. NGUYÊN TẮC

- Single Source of Truth: không bịa tên sản phẩm, SKU, giá, dung tích, thành phần, công dụng ngoài dữ liệu KaRose đã thống nhất.
- Chỉ làm đúng phạm vi được giao; không đổi tên props/cấu trúc file không liên quan.
- Code đầy đủ, không dùng `any` bừa bãi, không để `// ... rest of code ...`.
- Với tính năng mới: tóm tắt 3–5 ý hướng triển khai và danh sách file trước khi code.
- ESLint: `react-hooks/purity` (không gọi `Date.now()` trong component), `react-hooks/set-state-in-effect`.
- Next 16: `params` là Promise; `LayoutProps<"/">` cần `npx next typegen` trước khi chạy `tsc`.
