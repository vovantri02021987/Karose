import type { Metadata } from "next";
import ChatWidget from "@/components/storefront/ChatWidget";
import Footer from "@/components/storefront/Footer";
import Navbar from "@/components/storefront/Navbar";
import SlideCart from "@/components/storefront/SlideCart";
import { prisma } from "@/lib/prisma";
import { DEFAULT_OG_IMAGE, SITE_NAME, getSiteOrigin } from "@/lib/seo";

// Dữ liệu danh mục lấy từ PostgreSQL ở mỗi request (không prerender lúc build).
export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  const origin = await getSiteOrigin();
  return {
    ...(origin ? { metadataBase: new URL(origin) } : {}),
    openGraph: {
      type: "website",
      siteName: SITE_NAME,
      locale: "vi_VN",
      images: [DEFAULT_OG_IMAGE],
    },
    twitter: { card: "summary_large_image", images: [DEFAULT_OG_IMAGE.url] },
  };
}

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
      <ChatWidget />
    </>
  );
}
