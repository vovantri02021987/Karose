"use client";
import Image from "next/image";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

const inputClass =
  "w-full rounded-lg border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary";

export default function LoginForm({ isDev }: { isDev: boolean }) {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = (await res.json().catch(() => null)) as { error?: string } | null;
      if (!res.ok) {
        setError(data?.error ?? "Không thể đăng nhập, vui lòng thử lại");
        return;
      }
      router.replace("/admin/dashboard");
      router.refresh();
    } catch {
      setError("Mất kết nối mạng, vui lòng thử lại");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={submit} className="w-full max-w-sm rounded-2xl border border-border bg-surface p-6 sm:p-8">
      <Image
        src="/images/logo-karose.jpg"
        alt="KAROSE"
        width={96}
        height={96}
        className="mx-auto mb-2 h-24 w-24 rounded-full mix-blend-multiply"
      />
      <h1 className="type-page-title text-center text-primary">KAROSE Admin</h1>
      <p className="mt-1 text-center text-sm text-muted-foreground">Đăng nhập dành cho quản trị viên và nhân viên.</p>

      <div className="mt-6 space-y-4">
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Email</span>
          <input
            className={inputClass}
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label className="block">
          <span className="mb-1 block text-sm font-medium">Mật khẩu</span>
          <input
            className={inputClass}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
      </div>

      {isDev && (
        <div className="mt-4 flex flex-wrap gap-2 text-xs">
          <span className="text-muted-foreground">Dev – điền nhanh email:</span>
          {["admin@karose.vn", "ops@karose.vn"].map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => setEmail(m)}
              className="rounded-full border border-border px-2.5 py-0.5 hover:bg-background"
            >
              {m}
            </button>
          ))}
        </div>
      )}

      {error && (
        <p role="alert" className="mt-4 rounded-lg border border-destructive/40 bg-background p-3 text-sm text-destructive">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={loading}
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-primary px-6 py-3 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {loading && <Loader2 size={16} className="animate-spin" />}
        {loading ? "Đang đăng nhập…" : "Đăng nhập"}
      </button>
    </form>
  );
}
