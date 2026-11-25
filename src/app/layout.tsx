import type { Metadata } from "next";
import {
  Be_Vietnam_Pro,
  Cormorant_Garamond,
  JetBrains_Mono,
} from "next/font/google";
import "./globals.css";

// Editorial Botanical: Cormorant Garamond (heading) + Be Vietnam Pro (body/UI) + JetBrains Mono (mã, số).
const fontHeading = Cormorant_Garamond({
  subsets: ["vietnamese", "latin"],
  weight: ["500", "600", "700"],
  style: ["normal", "italic"],
  variable: "--font-heading",
  display: "swap",
});

const fontSans = Be_Vietnam_Pro({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-sans",
  display: "swap",
});

const fontMono = JetBrains_Mono({
  subsets: ["vietnamese", "latin"],
  weight: ["400", "500"],
  variable: "--font-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "KaRose — Mỹ phẩm thiên nhiên",
    template: "%s | KaRose",
  },
  description:
    "KaRose — mỹ phẩm thiên nhiên và hữu cơ với thành phần INCI minh bạch, từ vườn thảo mộc đến từng giọt tinh chất.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="vi"
      className={`${fontHeading.variable} ${fontSans.variable} ${fontMono.variable} h-full`}
    >
      <body className="min-h-full flex flex-col font-sans antialiased bg-[#FAF8F5] text-[#1F2421]">
        {children}
      </body>
    </html>
  );
}
