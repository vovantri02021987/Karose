"use client";

import { Star } from "lucide-react";
import { useState } from "react";

export default function ReviewForm({ productId }: { productId: string }) {
  const [authorName, setAuthorName] = useState("");
  const [rating, setRating] = useState(5);
  const [comment, setComment] = useState("");
  const [website, setWebsite] = useState(""); // honeypot chống bot
  const [status, setStatus] = useState<"idle" | "sending" | "done" | "error">(
    "idle",
  );
  const [message, setMessage] = useState("");

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setStatus("sending");
    setMessage("");
    try {
      const res = await fetch("/api/reviews", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, authorName, rating, comment, website }),
      });
      const data = (await res.json()) as { error?: string; message?: string };
      if (!res.ok) {
        setStatus("error");
        setMessage(data.error ?? "Không gửi được đánh giá, vui lòng thử lại.");
        return;
      }
      setStatus("done");
      setMessage(
        data.message ??
          "Cảm ơn bạn! Đánh giá sẽ hiển thị sau khi được KaRose duyệt.",
      );
      setAuthorName("");
      setComment("");
      setRating(5);
    } catch {
      setStatus("error");
      setMessage("Không gửi được đánh giá, vui lòng thử lại.");
    }
  }

  return (
    <form
      onSubmit={onSubmit}
      className="h-fit rounded-xl border border-border bg-surface/60 p-6"
    >
      <h3 className="type-card-editorial">Viết đánh giá</h3>

      <fieldset className="mt-4">
        <legend className="mb-1 text-sm">Mức độ hài lòng</legend>
        <div className="flex gap-1">
          {[1, 2, 3, 4, 5].map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => setRating(n)}
              aria-label={`${n} sao`}
              aria-pressed={rating === n}
              className="p-0.5"
            >
              <Star
                size={24}
                className={
                  n <= rating
                    ? "fill-brand-accent text-brand-accent"
                    : "text-border"
                }
              />
            </button>
          ))}
        </div>
      </fieldset>

      <label className="mt-4 block text-sm">
        Họ tên
        <input
          required
          minLength={2}
          maxLength={80}
          value={authorName}
          onChange={(e) => setAuthorName(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <label className="mt-4 block text-sm">
        Nhận xét
        <textarea
          required
          minLength={10}
          maxLength={1000}
          rows={4}
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2"
        />
      </label>

      <div className="hidden" aria-hidden="true">
        <label>
          Website
          <input
            tabIndex={-1}
            autoComplete="off"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={status === "sending"}
        className="mt-5 w-full rounded-full bg-primary px-6 py-2.5 text-sm font-medium text-primary-foreground disabled:opacity-60"
      >
        {status === "sending" ? "Đang gửi…" : "Gửi đánh giá"}
      </button>

      {message && (
        <p
          role="status"
          className={`mt-3 text-sm ${
            status === "error" ? "text-destructive" : "text-primary"
          }`}
        >
          {message}
        </p>
      )}
    </form>
  );
}
