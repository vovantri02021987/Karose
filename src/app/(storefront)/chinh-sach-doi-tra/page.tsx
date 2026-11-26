import type { Metadata } from "next";
import { pageMetadata } from "@/lib/seo";
import Link from "next/link";
import { SHOP_EMAIL, SHOP_PHONE, SHOP_PHONE_DISPLAY } from "@/lib/site-info";

export const metadata: Metadata = pageMetadata({
  title: "Chính sách đổi trả",
  description: "Điều kiện và thời hạn đổi trả sản phẩm KAROSE.",
  path: "/chinh-sach-doi-tra",
});

const SECTIONS: { title: string; items: string[] }[] = [
  {
    title: "Điều kiện áp dụng",
    items: [
      "Trong vòng 14 ngày kể từ khi nhận sản phẩm.",
      "Hàng hoá vẫn còn mới, chưa qua sử dụng.",
      "Hàng hoá hư hỏng do vận chuyển hoặc do nhà sản xuất.",
    ],
  },
  {
    title: "Trường hợp được chấp nhận",
    items: [
      "Hàng không đúng chủng loại, mẫu mã như đơn đặt hàng.",
      "Không đủ số lượng, không đủ bộ như trong đơn hàng.",
      "Tình trạng bên ngoài bị ảnh hưởng như rách bao bì, bong tróc, bể vỡ.",
    ],
  },
  {
    title: "Trường hợp không đủ điều kiện",
    items: [
      "Quá 14 ngày kể từ khi quý khách nhận hàng.",
      "Gửi lại hàng không đúng mẫu mã, không phải hàng của KAROSE.",
      "Đặt nhầm sản phẩm, chủng loại; không thích hoặc không hợp.",
    ],
  },
];

export default function ReturnPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="type-page-title">Chính sách đổi trả</h1>
      <p className="mt-3 text-muted-foreground">
        Chính sách áp dụng tương tự gian hàng KAROSE trên Shopee. Vui lòng giữ mã
        đơn hàng để được hỗ trợ nhanh nhất; bạn có thể xem tình trạng đơn tại{" "}
        <Link href="/tracking" className="text-primary underline">
          Tra cứu đơn hàng
        </Link>
        .
      </p>
      <div className="mt-8 space-y-8">
        {SECTIONS.map((s) => (
          <section key={s.title}>
            <h2 className="type-section">{s.title}</h2>
            <ul className="mt-3 space-y-2">
              {s.items.map((i) => (
                <li key={i} className="flex gap-2 leading-relaxed">
                  <span aria-hidden className="mt-[0.6em] h-1.5 w-1.5 shrink-0 rounded-full bg-primary/60" />
                  <span>{i}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
        <section>
          <h2 className="type-section">Liên hệ đổi trả</h2>
          <p className="mt-3 leading-relaxed">
            Vui lòng liên hệ KAROSE kèm mã đơn hàng và hình ảnh sản phẩm:
          </p>
          <ul className="mt-3 space-y-1">
            <li>
              Điện thoại:{" "}
              <a href={`tel:${SHOP_PHONE}`} className="text-primary underline">
                {SHOP_PHONE_DISPLAY}
              </a>
            </li>
            <li>
              Email:{" "}
              <a href={`mailto:${SHOP_EMAIL}`} className="text-primary underline">
                {SHOP_EMAIL}
              </a>
            </li>
          </ul>
        </section>
      </div>
    </div>
  );
}
