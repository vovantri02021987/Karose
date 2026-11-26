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
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[100] focus:rounded-full focus:bg-primary focus:px-5 focus:py-2.5 focus:text-sm focus:font-medium focus:text-primary-foreground"
      >
        Bỏ qua đến nội dung chính
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="flex-1 focus:outline-none">
        {children}
      </main>
      <Footer categories={categories} />
      <SlideCart />
      <ChatWidget />
    </>
  );
}
