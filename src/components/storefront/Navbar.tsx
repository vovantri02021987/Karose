"use client";

import { Menu, Search, ShoppingBag, X } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState } from "react";
import { selectCartCount, useCartStore } from "@/store/useCartStore";

const NAV_LINKS = [
  { href: "/", label: "Trang chủ" },
  { href: "/products", label: "Sản phẩm" },
  { href: "/journal", label: "Journal" },
  { href: "/tracking", label: "Tra cứu đơn hàng" },
];

export default function Navbar() {
  const router = useRouter();
  const pathname = usePathname();
  const [menuOpen, setMenuOpen] = useState(false);
  const [query, setQuery] = useState("");

  const hasHydrated = useCartStore((s) => s.hasHydrated);
  const count = useCartStore(selectCartCount);
  const openCart = useCartStore((s) => s.openCart);
  const badge = hasHydrated ? count : 0;

  function submitSearch(e: React.FormEvent) {
    e.preventDefault();
    const q = query.trim();
    setMenuOpen(false);
    router.push(q ? `/products?q=${encodeURIComponent(q)}` : "/products");
  }

  function isActive(href: string) {
    return href === "/" ? pathname === "/" : pathname.startsWith(href);
  }

  return (
    <header className="sticky top-0 z-40 border-b border-border bg-background/90 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4 sm:px-6">
        <button
          type="button"
          className="-ml-2 p-2 md:hidden"
          aria-label={menuOpen ? "Đóng menu" : "Mở menu"}
          aria-expanded={menuOpen}
          onClick={() => setMenuOpen((v) => !v)}
        >
          {menuOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <Link
          href="/"
          aria-label="KaRose – Trang chủ"
          className="flex items-center gap-2 font-heading text-2xl font-semibold tracking-wide text-primary"
        >
          <Image
            src="/images/logo-karose.jpg"
            alt=""
            width={44}
            height={44}
            className="h-11 w-11 rounded-full mix-blend-multiply"
            priority
          />
          <span className="md:hidden lg:inline">KaRose</span>
        </Link>

        <nav
          className="ml-2 hidden items-center gap-5 md:flex lg:ml-6 lg:gap-6"
          aria-label="Điều hướng chính"
        >
          {NAV_LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className={`whitespace-nowrap py-2 text-sm transition hover:text-primary ${
                isActive(l.href)
                  ? "font-semibold text-primary"
                  : "text-muted-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </nav>

        <form
          onSubmit={submitSearch}
          role="search"
          className="ml-auto hidden items-center rounded-full border border-border bg-surface px-3 sm:flex"
        >
          <Search size={16} className="text-muted-foreground" aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm sản phẩm, thành phần…"
            aria-label="Tìm kiếm sản phẩm"
            className="w-44 bg-transparent px-2 py-2 text-sm outline-none placeholder:text-muted-foreground lg:w-56"
          />
        </form>

        <button
          type="button"
          onClick={openCart}
          aria-label={`Mở giỏ hàng, ${badge} sản phẩm`}
          className="relative ml-auto p-2 sm:ml-0"
        >
          <ShoppingBag size={22} />
          {badge > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-brand-accent px-1 text-[11px] font-semibold text-white">
              {badge > 99 ? "99+" : badge}
            </span>
          )}
        </button>
      </div>

      {menuOpen && (
        <div className="border-t border-border bg-background px-4 pb-4 md:hidden">
          <form
            onSubmit={submitSearch}
            role="search"
            className="my-3 flex items-center rounded-full border border-border bg-surface px-3"
          >
            <Search size={16} className="text-muted-foreground" aria-hidden="true" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Tìm sản phẩm, thành phần…"
              aria-label="Tìm kiếm sản phẩm"
              className="w-full bg-transparent px-2 py-2 text-sm outline-none"
            />
          </form>
          <nav className="flex flex-col" aria-label="Điều hướng di động">
            {NAV_LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setMenuOpen(false)}
                className={`py-3 text-sm ${
                  isActive(l.href)
                    ? "font-semibold text-primary"
                    : "text-muted-foreground"
                }`}
              >
                {l.label}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </header>
  );
}
