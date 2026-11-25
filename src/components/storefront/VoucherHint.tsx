"use client";

import { Check, Copy, TicketPercent } from "lucide-react";
import { useState } from "react";
import { formatDate, formatVND } from "@/lib/format";
import type { ProductVoucherHint } from "@/types/product";

function CopyButton({ code }: { code: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      /* trình duyệt chặn clipboard: khách vẫn chép tay được mã hiển thị */
    }
  };
  return (
    <button
      type="button"
      onClick={copy}
      aria-label={`Sao chép mã ${code}`}
      className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-primary/40 px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10"
    >
      {copied ? <Check size={14} /> : <Copy size={14} />}
      {copied ? "Đã chép" : "Sao chép mã"}
    </button>
  );
}

/** Gợi ý mã giảm giá áp dụng riêng cho sản phẩm đang xem. */
export default function VoucherHint({ vouchers }: { vouchers: ProductVoucherHint[] }) {
  if (vouchers.length === 0) return null;
  return (
    <ul className="mt-4 space-y-2" aria-label="Mã giảm giá cho sản phẩm này">
      {vouchers.map((v) => (
        <li
          key={v.code}
          className="flex items-center gap-3 rounded-lg border border-dashed border-primary/50 bg-primary/5 p-3"
        >
          <TicketPercent size={20} className="shrink-0 text-primary" aria-hidden />
          <div className="min-w-0 flex-1 text-sm">
            <p className="font-medium">
              <span className="type-code text-primary">{v.code}</span> · {v.discountLabel}
            </p>
            <p className="text-xs text-muted-foreground">
              {v.minOrderAmount > 0 ? `Tiền hàng sản phẩm từ ${formatVND(v.minOrderAmount)} · ` : ""}
              HSD mã: {formatDate(v.endDate)}. Nhập mã ở bước thanh toán.
            </p>
          </div>
          <CopyButton code={v.code} />
        </li>
      ))}
    </ul>
  );
}
