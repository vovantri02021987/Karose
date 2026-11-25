"use client";

import { LogOut } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function LogoutButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const logout = async () => {
    setBusy(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.replace("/admin/login");
      router.refresh();
    }
  };
  return (
    <button
      type="button"
      onClick={logout}
      disabled={busy}
      className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-muted-foreground hover:bg-background hover:text-foreground disabled:opacity-50"
    >
      <LogOut size={16} /> {busy ? "Đang thoát…" : "Đăng xuất"}
    </button>
  );
}
