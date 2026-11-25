"use client";

import { BookOpen, Boxes, LayoutDashboard, Package, ReceiptText, Tag } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/dashboard", label: "Tổng quan", icon: LayoutDashboard },
  { href: "/admin/products", label: "Sản phẩm & Combo", icon: Package },
  { href: "/admin/inventory", label: "Nhập kho & Lô FEFO", icon: Boxes },
  { href: "/admin/orders", label: "Đơn hàng", icon: ReceiptText },
  { href: "/admin/promotions", label: "Khuyến mãi & Đánh giá", icon: Tag },
  { href: "/admin/knowledge", label: "Kiến thức chatbot", icon: BookOpen },
];

export default function AdminNav() {
  const pathname = usePathname();
  return (
    <nav className="no-scrollbar flex gap-1 overflow-x-auto lg:flex-col">
      {LINKS.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            className={`flex shrink-0 items-center gap-2 rounded-lg px-3 py-2 text-sm whitespace-nowrap ${
              active ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-background"
            }`}
          >
            <Icon size={16} /> {label}
          </Link>
        );
      })}
    </nav>
  );
}
