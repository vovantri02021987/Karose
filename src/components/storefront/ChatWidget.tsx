"use client";

import { Leaf, Loader2, MessageCircle, Search, Send, ShieldAlert, X } from "lucide-react";
import Link from "next/link";
import { Fragment, useEffect, useRef, useState } from "react";
import { formatVND } from "@/lib/format";
import SafeImage from "./SafeImage";

interface RecommendedProduct {
  slug: string;
  name: string;
  price: number;
  image: string;
  inStock: boolean;
}

interface ChatSource {
  title: string;
  url: string;
}

interface ChatMessageView {
  id: number;
  role: "user" | "assistant";
  text: string;
  intent?: string;
  products?: RecommendedProduct[];
  sources?: ChatSource[];
  usedWebUpdate?: boolean;
  isError?: boolean;
}

interface ChatResponse {
  sessionId: string;
  intent: string;
  reply: string;
  recommendedProducts: RecommendedProduct[];
  sources: ChatSource[];
  usedWebUpdate: boolean;
  error?: string;
}

const STORAGE_KEY = "karose-chat-session";
const QUICK_QUESTIONS = [
  "Gợi ý sản phẩm cho da dầu",
  "Cách dùng và bảo quản sản phẩm",
  "Thành phần có gì?",
  "Mã giảm giá đang có",
  "Phí và thời gian giao hàng",
];
const WEB_HINT = /(mới nhất|internet|trên mạng|trên web|nghiên cứu|cập nhật|nguồn)/i;
const GREETING =
  "Chào bạn! Mình là trợ lý tư vấn KaRose. Bạn có thể hỏi về thành phần, công dụng, cách dùng, bảo quản; nhờ gợi ý theo loại da; hoặc hỏi giá, mã giảm giá, giao hàng.";

// Màu theo bộ nhận diện chatbot.
const GREEN = "#2C4A3E";
const CREAM = "#FAF8F5";
const SAND = "#F2EFE9";
const COPPER = "#C67D53";

/** Biến đường dẫn nội bộ trong câu trả lời thành liên kết bấm được. */
function renderLine(line: string) {
  return line.split(/(\/(?:tracking|chinh-sach-doi-tra))/).map((part, i) =>
    part.startsWith("/") ? (
      <Link key={i} href={part} className="underline decoration-[#C67D53] underline-offset-2">
        {part}
      </Link>
    ) : (
      <Fragment key={i}>{part}</Fragment>
    ),
  );
}

function MessageText({ text }: { text: string }) {
  return (
    <div className="space-y-2">
      {text.split(/\n{2,}/).map((block, bi) => (
        <p key={bi} className="whitespace-pre-line">
          {block.split("\n").map((line, li) => (
            <Fragment key={li}>
              {li > 0 ? "\n" : ""}
              {renderLine(line)}
            </Fragment>
          ))}
        </p>
      ))}
    </div>
  );
}

export default function ChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessageView[]>([
    { id: 0, role: "assistant", text: GREETING },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState("");

  const sessionRef = useRef<string | null>(null);
  const idRef = useRef(1);
  const endRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages, loading, open]);

  useEffect(() => {
    if (!open) return;
    inputRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  function readSession(): string | null {
    if (sessionRef.current) return sessionRef.current;
    try {
      sessionRef.current = window.localStorage.getItem(STORAGE_KEY);
    } catch {
      sessionRef.current = null;
    }
    return sessionRef.current;
  }

  function saveSession(id: string) {
    sessionRef.current = id;
    try {
      window.localStorage.setItem(STORAGE_KEY, id);
    } catch {
      /* trình duyệt chặn lưu trữ: vẫn chat được trong phiên hiện tại */
    }
  }

  function push(message: Omit<ChatMessageView, "id">) {
    const id = idRef.current++;
    setMessages((prev) => [...prev, { ...message, id }]);
  }

  async function send(raw: string) {
    const message = raw.trim();
    if (!message || loading) return;
    setInput("");
    push({ role: "user", text: message });
    setLoading(true);
    setStatus(WEB_HINT.test(message) ? "Đang tìm kiếm thông tin trên internet…" : "Đang phân tích câu hỏi…");
    const timer = window.setTimeout(() => {
      setStatus((s) => (s.startsWith("Đang tìm kiếm") ? s : "Đang tra cứu dữ liệu sản phẩm KaRose…"));
    }, 1200);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId: readSession() ?? undefined, message }),
      });
      const data = (await res.json().catch(() => null)) as ChatResponse | null;
      if (!res.ok || !data || typeof data.reply !== "string") {
        push({
          role: "assistant",
          text: data?.error ?? "Trợ lý đang gặp sự cố, bạn vui lòng thử lại sau ít phút.",
          isError: true,
        });
      } else {
        saveSession(data.sessionId);
        push({
          role: "assistant",
          text: data.reply,
          intent: data.intent,
          products: data.recommendedProducts,
          sources: data.sources,
          usedWebUpdate: data.usedWebUpdate,
        });
      }
    } catch {
      push({
        role: "assistant",
        text: "Không kết nối được máy chủ. Bạn kiểm tra mạng rồi thử lại nhé.",
        isError: true,
      });
    } finally {
      window.clearTimeout(timer);
      setLoading(false);
      setStatus("");
    }
  }

  const showChips = messages.length === 1;

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label={open ? "Đóng trợ lý tư vấn" : "Mở trợ lý tư vấn KaRose"}
        aria-expanded={open}
        style={{ backgroundColor: GREEN, color: CREAM }}
        className="fixed bottom-24 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-105 md:bottom-6 md:right-6"
      >
        {open ? <X size={24} /> : <MessageCircle size={24} />}
      </button>

      {open && (
        <section
          role="dialog"
          aria-label="Trợ lý tư vấn KaRose"
          style={{ backgroundColor: CREAM }}
          className="fixed inset-x-3 bottom-40 z-40 flex h-[min(70vh,560px)] flex-col overflow-hidden rounded-2xl border border-[#E2DCCF] shadow-2xl md:inset-x-auto md:bottom-24 md:right-6 md:h-[600px] md:w-[400px]"
        >
          <header style={{ backgroundColor: GREEN, color: CREAM }} className="flex items-center gap-3 px-4 py-3">
            <Leaf size={20} style={{ color: COPPER }} aria-hidden="true" />
            <div className="min-w-0 flex-1">
              <p className="font-heading text-lg leading-tight">Trợ lý KaRose</p>
              <p className="text-xs opacity-80">Tư vấn dựa trên sản phẩm đang bán</p>
            </div>
            <button type="button" onClick={() => setOpen(false)} aria-label="Đóng" className="p-1 opacity-80 hover:opacity-100">
              <X size={20} />
            </button>
          </header>

          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4" aria-live="polite">
            {messages.map((m) => (
              <div key={m.id} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
                <div className="max-w-[88%]">
                  <div
                    style={
                      m.role === "user"
                        ? { backgroundColor: GREEN, color: CREAM }
                        : { backgroundColor: m.isError ? "#F6E3DA" : SAND, color: "#1F2421" }
                    }
                    className="rounded-2xl px-3.5 py-2.5 text-sm leading-relaxed"
                  >
                    {m.role === "assistant" && m.intent === "SAFETY_MEDICAL_BOUNDARY" && (
                      <p className="mb-2 flex items-center gap-1.5 text-xs font-semibold" style={{ color: COPPER }}>
                        <ShieldAlert size={14} aria-hidden="true" /> Lưu ý sức khoẻ
                      </p>
                    )}
                    <MessageText text={m.text} />
                  </div>

                  {m.products && m.products.length > 0 && (
                    <ul className="mt-2 grid grid-cols-2 gap-2">
                      {m.products.map((p) => (
                        <li key={p.slug}>
                          <Link
                            href={`/products/${p.slug}`}
                            className="block overflow-hidden rounded-xl border border-[#E2DCCF] bg-white transition-shadow hover:shadow-md"
                          >
                            <div className="relative aspect-square">
                              <SafeImage src={p.image} alt={p.name} sizes="160px" />
                              {!p.inStock && (
                                <span className="absolute left-1.5 top-1.5 rounded-full bg-[#1F2421]/80 px-2 py-0.5 text-[10px] text-white">
                                  Tạm hết hàng
                                </span>
                              )}
                            </div>
                            <div className="p-2">
                              <p className="line-clamp-2 text-xs font-medium leading-snug">{p.name}</p>
                              <p className="mt-1 text-xs font-semibold tabular-nums" style={{ color: COPPER }}>
                                {formatVND(p.price)}
                              </p>
                            </div>
                          </Link>
                        </li>
                      ))}
                    </ul>
                  )}

                  {m.sources && m.sources.length > 0 && (
                    <div className="mt-2 rounded-xl border border-[#E2DCCF] bg-white px-3 py-2 text-xs">
                      <p className="mb-1 font-semibold" style={{ color: GREEN }}>
                        Nguồn tham khảo từ internet
                      </p>
                      <ul className="space-y-1">
                        {m.sources.map((s) => (
                          <li key={s.url}>
                            <a
                              href={s.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="break-words underline decoration-[#C67D53] underline-offset-2"
                            >
                              {s.title}
                            </a>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex justify-start">
                <div style={{ backgroundColor: SAND }} className="flex items-center gap-2 rounded-2xl px-3.5 py-2.5 text-sm">
                  {status.startsWith("Đang tìm kiếm") ? (
                    <Search size={14} className="animate-pulse" style={{ color: COPPER }} aria-hidden="true" />
                  ) : (
                    <Loader2 size={14} className="animate-spin" style={{ color: COPPER }} aria-hidden="true" />
                  )}
                  <span>{status}</span>
                </div>
              </div>
            )}

            {showChips && !loading && (
              <div className="flex flex-wrap gap-2 pt-1">
                {QUICK_QUESTIONS.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => void send(q)}
                    style={{ borderColor: GREEN, color: GREEN }}
                    className="rounded-full border bg-white px-3 py-1.5 text-xs transition-colors hover:bg-[#F2EFE9]"
                  >
                    {q}
                  </button>
                ))}
              </div>
            )}
            <div ref={endRef} />
          </div>

          <p className="border-t border-[#E2DCCF] px-4 py-2 text-[11px] leading-snug text-[#5C6660]">
            Trợ lý chỉ tư vấn chăm sóc da cơ bản, không thay thế bác sĩ. Nếu da bị kích ứng (ngứa, đỏ, rát), hãy ngưng dùng và gặp bác sĩ da liễu.
          </p>

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void send(input);
            }}
            className="flex items-center gap-2 border-t border-[#E2DCCF] bg-white px-3 py-2.5"
          >
            <input
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              maxLength={1000}
              placeholder="Nhập câu hỏi của bạn…"
              aria-label="Câu hỏi gửi trợ lý"
              disabled={loading}
              className="min-w-0 flex-1 rounded-full border border-[#E2DCCF] bg-[#FAF8F5] px-4 py-2 text-sm outline-none focus:border-[#2C4A3E]"
            />
            <button
              type="submit"
              disabled={loading || input.trim().length === 0}
              aria-label="Gửi"
              style={{ backgroundColor: GREEN, color: CREAM }}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full disabled:opacity-40"
            >
              <Send size={16} />
            </button>
          </form>
        </section>
      )}
    </>
  );
}
