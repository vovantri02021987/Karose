"use client";

import { Loader2, RefreshCw, Search, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatDateTime } from "@/lib/format";

export interface KnowledgeRow {
  id: string;
  title: string;
  sourceUrl: string;
  summary: string;
  category: string;
  isActive: boolean;
  syncedAt: string;
}

interface Props {
  rows: KnowledgeRow[];
  isAdmin: boolean;
  searchEnabled: boolean;
  allowedDomains: string[];
}

const inputClass = "w-full rounded-lg border border-border bg-background px-3 py-2 text-sm";
const CATEGORIES = ["INGREDIENT", "USAGE", "SAFETY", "GENERAL"];

export default function KnowledgeClient({ rows, isAdmin, searchEnabled, allowedDomains }: Props) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);
  const [url, setUrl] = useState("");
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("INGREDIENT");

  async function call(key: string, endpoint: string, init: { method: string; body?: unknown }) {
    setBusy(key);
    setMessage(null);
    try {
      const res = await fetch(endpoint, {
        method: init.method,
        headers: { "Content-Type": "application/json" },
        body: init.body === undefined ? undefined : JSON.stringify(init.body),
      });
      const data = (await res.json().catch(() => ({}))) as { error?: string; message?: string; errors?: string[] };
      if (!res.ok) {
        setMessage({ text: data.error ?? data.message ?? "Thao tác thất bại", error: true });
      } else {
        const extra = data.errors?.length ? ` Lỗi: ${data.errors.slice(0, 3).join("; ")}` : "";
        setMessage({ text: `${data.message ?? "Thành công"}${extra}`, error: false });
        router.refresh();
      }
    } catch {
      setMessage({ text: "Không kết nối được máy chủ", error: true });
    } finally {
      setBusy(null);
    }
  }

  const spinner = (key: string) => busy === key && <Loader2 size={16} className="animate-spin" />;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="type-page-title">Kiến thức chatbot</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Nguồn tham khảo từ internet để chatbot trả lời về thành phần, công dụng. Giá bán và tồn kho luôn lấy từ dữ liệu cửa hàng, không bị thay đổi bởi mục này.
        </p>
      </div>

      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={`rounded-lg border p-3 text-sm ${message.error ? "border-destructive/40 text-destructive" : "border-border bg-surface"}`}
        >
          {message.text}
        </p>
      )}

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="type-card">Đồng bộ</h2>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            disabled={busy !== null}
            onClick={() => void call("refresh", "/api/admin/knowledge/sync", { method: "POST", body: { mode: "REFRESH_EXISTING" } })}
            className="inline-flex items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
          >
            {spinner("refresh") || <RefreshCw size={16} />} Làm mới các nguồn đang bật
          </button>
          <button
            type="button"
            disabled={busy !== null || !searchEnabled}
            onClick={() => void call("search", "/api/admin/knowledge/sync", { method: "POST", body: { mode: "SEARCH" } })}
            className="inline-flex items-center gap-2 rounded-full border border-border px-5 py-2.5 text-sm hover:bg-background disabled:opacity-50"
          >
            {spinner("search") || <Search size={16} />} Tìm nguồn theo thành phần sản phẩm
          </button>
        </div>
        {!searchEnabled && (
          <p className="text-xs text-muted-foreground">
            Chưa cấu hình <span className="type-code">TAVILY_API_KEY</span> nên chưa thể tự tìm nguồn; bạn vẫn thêm nguồn thủ công và làm mới bình thường.
          </p>
        )}
      </section>

      <section className="space-y-3 rounded-2xl border border-border bg-surface p-5">
        <h2 className="type-card">Thêm nguồn thủ công</h2>
        <form
          className="grid gap-3 sm:grid-cols-3"
          onSubmit={(e) => {
            e.preventDefault();
            void call("add", "/api/admin/knowledge/sync", {
              method: "POST",
              body: { mode: "UPSERT_SOURCE", url, title: title || undefined, category },
            });
          }}
        >
          <label className="text-sm sm:col-span-3">
            <span className="mb-1 block font-medium">Địa chỉ trang (https) *</span>
            <input className={inputClass} value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://…" required />
          </label>
          <label className="text-sm sm:col-span-2">
            <span className="mb-1 block font-medium">Tiêu đề (bỏ trống = lấy từ trang)</span>
            <input className={inputClass} value={title} onChange={(e) => setTitle(e.target.value)} maxLength={200} />
          </label>
          <label className="text-sm">
            <span className="mb-1 block font-medium">Nhóm</span>
            <select className={inputClass} value={category} onChange={(e) => setCategory(e.target.value)}>
              {CATEGORIES.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </label>
          <div className="sm:col-span-3">
            <button
              type="submit"
              disabled={busy !== null || url.trim().length === 0}
              className="inline-flex items-center gap-2 rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
            >
              {spinner("add")} Tải và lưu nguồn
            </button>
          </div>
        </form>
        <p className="text-xs text-muted-foreground">Chỉ nhận trang thuộc: {allowedDomains.join(", ")}.</p>
      </section>

      <section className="space-y-3">
        <h2 className="type-card">Nguồn đã lưu ({rows.length})</h2>
        {rows.length === 0 ? (
          <p className="rounded-lg border border-border p-4 text-sm text-muted-foreground">Chưa có nguồn nào.</p>
        ) : (
          <ul className="divide-y divide-border rounded-2xl border border-border">
            {rows.map((r) => (
              <li key={r.id} className="space-y-1 p-4">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="font-medium">{r.title}</p>
                    <a href={r.sourceUrl} target="_blank" rel="noopener noreferrer" className="break-all text-xs text-muted-foreground underline">
                      {r.sourceUrl}
                    </a>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="rounded-full bg-surface px-2 py-0.5 text-xs">{r.category}</span>
                    <button
                      type="button"
                      disabled={busy !== null}
                      onClick={() => void call(`toggle-${r.id}`, `/api/admin/knowledge/${r.id}`, { method: "PATCH", body: { isActive: !r.isActive } })}
                      className="rounded-full border border-border px-3 py-1 text-xs hover:bg-surface disabled:opacity-60"
                    >
                      {r.isActive ? "Tắt" : "Bật"}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        disabled={busy !== null}
                        aria-label={`Xoá ${r.title}`}
                        onClick={() => {
                          if (window.confirm(`Xoá nguồn "${r.title}"? Không thể hoàn tác.`)) {
                            void call(`del-${r.id}`, `/api/admin/knowledge/${r.id}`, { method: "DELETE" });
                          }
                        }}
                        className="rounded-full border border-border p-1.5 text-destructive hover:bg-surface disabled:opacity-60"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </div>
                <p className="line-clamp-3 text-sm text-muted-foreground">{r.summary}</p>
                <p className="text-xs text-muted-foreground">
                  {r.isActive ? "Đang bật" : "Đã tắt"} · cập nhật {formatDateTime(r.syncedAt)}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
