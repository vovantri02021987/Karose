import Image from "next/image";
import AdminNav from "@/components/admin/AdminNav";
import LogoutButton from "@/components/admin/LogoutButton";
import { requireStaffPage } from "@/lib/auth/guard";

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const user = await requireStaffPage();
  return (
    <div className="mx-auto flex min-h-screen max-w-[1400px] flex-col lg:flex-row">
      <aside className="shrink-0 border-b border-border bg-surface p-4 lg:w-64 lg:border-b-0 lg:border-r">
        <p className="flex items-center gap-2 font-heading text-2xl font-semibold text-primary">
          <Image
            src="/images/logo-karose.jpg"
            alt=""
            width={40}
            height={40}
            className="h-10 w-10 rounded-full mix-blend-multiply"
          />
          KaRose Admin
        </p>
        <p className="mt-1 truncate text-xs text-muted-foreground">
          {user.name ?? user.email} · {user.role === "ADMIN" ? "Quản trị viên" : "Nhân viên"}
        </p>
        <div className="mt-4">
          <AdminNav />
        </div>
        <div className="mt-4 border-t border-border pt-3">
          <LogoutButton />
        </div>
      </aside>
      <main className="min-w-0 flex-1 tabular-nums p-4 sm:p-6 lg:p-8">{children}</main>
    </div>
  );
}
