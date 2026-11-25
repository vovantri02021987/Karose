import Image from "next/image";
import Link from "next/link";
import type { CategorySummary } from "@/types/product";

export default function Footer({
  categories,
}: {
  categories: Pick<CategorySummary, "name" | "slug">[];
}) {
  return (
    <footer className="mt-24 border-t border-border bg-surface">
      <div className="mx-auto grid max-w-6xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-4">
        <div className="md:col-span-1">
          <p className="flex items-center gap-2 font-heading text-2xl font-semibold text-primary">
            <Image
              src="/images/logo-karose.jpg"
              alt=""
              width={56}
              height={56}
              className="h-14 w-14 rounded-full mix-blend-multiply"
            />
            KAROSE
          </p>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            Mỹ phẩm thiên nhiên từ hoa hồng và thảo mộc. Chúng tôi công khai
            bảng thành phần INCI, hướng dẫn sử dụng và cách bảo quản trên từng
            sản phẩm.
          </p>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wider">
            Danh mục
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            {categories.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/products?category=${c.slug}`}
                  className="inline-block py-1.5 hover:text-primary"
                >
                  {c.name}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wider">
            Cam kết của KAROSE
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>Nguyên liệu thiên nhiên, tôn trọng quy trình chế biến</li>
            <li>Minh bạch thành phần INCI trên từng sản phẩm</li>
            <li>Hạn sử dụng và hướng dẫn bảo quản rõ ràng</li>
            <li>Chỉ bán lô hàng còn hạn dùng dài</li>
          </ul>
        </div>

        <div>
          <h2 className="font-sans text-sm font-semibold uppercase tracking-wider">
            Hỗ trợ
          </h2>
          <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
            <li>
              <Link href="/tracking" className="inline-block py-1.5 hover:text-primary">
                Tra cứu đơn hàng
              </Link>
            </li>
            <li>
              <Link href="/journal#bao-quan" className="inline-block py-1.5 hover:text-primary">
                Hướng dẫn bảo quản
              </Link>
            </li>
            <li>
              <Link href="/journal" className="inline-block py-1.5 hover:text-primary">
                Journal chăm sóc da
              </Link>
            </li>
            <li>
              <Link href="/chinh-sach-doi-tra" className="inline-block py-1.5 hover:text-primary">
                Chính sách đổi trả
              </Link>
            </li>
            <li>
              <a
                href="https://shopee.vn/karose.01"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-block py-1.5 hover:text-primary"
              >
                KAROSE trên Shopee
              </a>
            </li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border py-5 text-center text-xs text-muted-foreground">
        © {new Date().getFullYear()} KAROSE. Mỹ phẩm thiên nhiên.
      </div>
    </footer>
  );
}
