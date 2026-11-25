import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Journal",
  description:
    "Kiến thức chăm sóc da thiên nhiên cơ bản: cách đọc bảng thành phần INCI, bảo quản mỹ phẩm thiên nhiên và chu trình làm sạch 2 bước.",
};

const ARTICLES = [
  { id: "doc-inci", title: "Cách đọc bảng thành phần INCI" },
  { id: "bao-quan", title: "Bảo quản mỹ phẩm thiên nhiên" },
  { id: "lam-sach-2-buoc", title: "Chu trình làm sạch 2 bước" },
];

export default function JournalPage() {
  return (
    <div className="mx-auto max-w-[96rem] px-4 py-12 sm:px-6 lg:px-8">
      <p className="text-sm uppercase tracking-[0.25em] text-brand-accent">
        Journal
      </p>
      <h1 className="type-page-title mt-2">
        Kiến thức chăm sóc da thiên nhiên
      </h1>
      <p className="mt-4 max-w-3xl leading-relaxed text-muted-foreground">
        Những điều cơ bản giúp bạn chọn, dùng và cất giữ mỹ phẩm thiên nhiên
        đúng cách. Nội dung mang tính tham khảo chung, không thay thế tư vấn của
        bác sĩ da liễu.
      </p>

      <nav
        aria-label="Mục lục"
        className="mt-8 max-w-3xl rounded-xl border border-border bg-surface p-5"
      >
        <p className="text-sm font-semibold">Trong bài viết</p>
        <ol className="mt-2 list-decimal space-y-1 pl-5 text-sm">
          {ARTICLES.map((a) => (
            <li key={a.id}>
              <a href={`#${a.id}`} className="text-primary hover:underline">
                {a.title}
              </a>
            </li>
          ))}
        </ol>
      </nav>

      <div className="mt-12 grid gap-6 lg:grid-cols-3 lg:gap-8">
      <article id="doc-inci" className="scroll-mt-24 rounded-xl border border-border bg-white p-6 sm:p-8">
        <h2 className="type-section">
          Cách đọc bảng thành phần INCI
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed">
          <p>
            INCI (International Nomenclature of Cosmetic Ingredients) là hệ
            thống tên gọi quốc tế cho thành phần mỹ phẩm. Nhờ vậy, cùng một
            nguyên liệu sẽ có cùng một tên trên bao bì ở mọi quốc gia.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              <strong>Thứ tự là thông tin quan trọng.</strong> Thành phần được
              liệt kê theo hàm lượng giảm dần. Những thành phần đứng đầu danh
              sách chiếm phần lớn công thức.
            </li>
            <li>
              <strong>Nước thường đứng đầu.</strong> “Aqua” hoặc “Water” là
              nước. Với sản phẩm dạng nước cất hoa, tên loài hoa kèm “flower
              water” có thể là thành phần chính.
            </li>
            <li>
              <strong>Tên khoa học của thực vật</strong> thường được ghi bằng
              tiếng Latin, ví dụ chi “Rosa” là hoa hồng, kèm bộ phận dùng
              (flower, leaf, seed…) và dạng chiết xuất (water, oil, extract).
            </li>
            <li>
              <strong>Hương liệu</strong> thường ghi là “Parfum” hoặc
              “Fragrance”. Nếu da bạn nhạy cảm, hãy chú ý mục này.
            </li>
            <li>
              <strong>Thử trước khi dùng.</strong> “Tự nhiên” không đồng nghĩa
              với “không gây kích ứng”. Hãy thử một vùng da nhỏ trước khi dùng
              toàn mặt.
            </li>
          </ul>
        </div>
      </article>

      <article id="bao-quan" className="scroll-mt-24 rounded-xl border border-border bg-white p-6 sm:p-8">
        <h2 className="type-section">
          Bảo quản mỹ phẩm thiên nhiên
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed">
          <p>
            Mỹ phẩm thiên nhiên thường hạn chế hoặc không dùng chất bảo quản
            tổng hợp, nên cần được cất giữ cẩn thận hơn để giữ chất lượng đến
            hết hạn dùng.
          </p>
          <ul className="list-disc space-y-2 pl-5">
            <li>
              Để nơi khô ráo, thoáng mát, tránh ánh nắng trực tiếp và nguồn
              nhiệt. Không để trong phòng tắm ẩm lâu ngày.
            </li>
            <li>Đậy kín nắp ngay sau khi dùng, tránh để không khí lọt vào.</li>
            <li>
              Rửa sạch và lau khô tay trước khi lấy sản phẩm. Với sản phẩm dạng
              hũ, nên dùng thìa hoặc spatula sạch.
            </li>
            <li>
              Xem biểu tượng hộp mở nắp kèm số tháng (ví dụ 6M, 12M) trên bao bì:
              đó là thời hạn nên dùng hết sau khi mở nắp.
            </li>
            <li>
              Ngưng dùng nếu thấy đổi màu, đổi mùi, vón cục hoặc có dấu hiệu nấm
              mốc, dù chưa đến hạn ghi trên bao bì.
            </li>
          </ul>
          <p>
            Hạn dùng và hướng dẫn bảo quản riêng của từng sản phẩm được ghi ở
            mục “Sử dụng & Bảo quản” trên trang sản phẩm.
          </p>
        </div>
      </article>

      <article id="lam-sach-2-buoc" className="scroll-mt-24 rounded-xl border border-border bg-white p-6 sm:p-8">
        <h2 className="type-section">
          Chu trình làm sạch 2 bước
        </h2>
        <div className="mt-4 space-y-4 leading-relaxed">
          <p>
            Làm sạch 2 bước giúp loại bỏ bụi bẩn, bã nhờn và lớp kem chống nắng
            hay trang điểm một cách nhẹ nhàng hơn so với chỉ rửa một lần.
          </p>
          <ol className="list-decimal space-y-3 pl-5">
            <li>
              <strong>Bước 1 – Làm sạch lớp bẩn gốc dầu.</strong> Dùng sản phẩm
              dạng dầu hoặc dạng nước tẩy trang để hoà tan kem chống nắng và
              trang điểm. Massage nhẹ nhàng rồi làm ẩm da bằng nước ấm.
            </li>
            <li>
              <strong>Bước 2 – Làm sạch lớp bẩn gốc nước.</strong> Dùng sữa rửa
              mặt dịu nhẹ để loại bỏ mồ hôi và bụi bẩn còn lại. Rửa lại bằng
              nước ấm, không dùng nước quá nóng.
            </li>
          </ol>
          <ul className="list-disc space-y-2 pl-5">
            <li>Thấm khô bằng khăn sạch, không chà xát mạnh.</li>
            <li>
              Nếu hôm đó không trang điểm và không dùng kem chống nắng, có thể
              chỉ cần bước 2.
            </li>
            <li>
              Sau khi làm sạch, tiếp tục các bước cấp ẩm phù hợp với làn da của
              bạn.
            </li>
          </ul>
        </div>
      </article>

      </div>

      <div className="mt-16 rounded-xl bg-primary p-8 text-center text-primary-foreground">
        <p className="font-heading text-2xl font-semibold">
          Sẵn sàng chọn sản phẩm phù hợp?
        </p>
        <Link
          href="/products"
          className="mt-5 inline-flex rounded-full bg-background px-6 py-2.5 text-sm font-medium text-primary"
        >
          Xem sản phẩm
        </Link>
      </div>
    </div>
  );
}
