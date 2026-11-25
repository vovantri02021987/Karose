import Footer from "@/components/storefront/Footer";
import Navbar from "@/components/storefront/Navbar";
import SlideCart from "@/components/storefront/SlideCart";
import { prisma } from "@/lib/prisma";

// Dữ liệu danh mục lấy từ PostgreSQL ở mỗi request (không prerender lúc build).
export const dynamic = "force-dynamic";

export default async function StorefrontLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const categories = await prisma.category.findMany({
    orderBy: { createdAt: "asc" },
    select: { name: true, slug: true },
  });

  return (
    <>
      <Navbar />
      <main className="flex-1">{children}</main>
      <Footer categories={categories} />
      <SlideCart />
    </>
  );
}
