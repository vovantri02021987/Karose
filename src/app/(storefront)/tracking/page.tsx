import type { Metadata } from "next";
import { Suspense } from "react";
import TrackingClient from "./TrackingClient";

export const metadata: Metadata = {
  title: "Theo dõi đơn hàng",
  robots: { index: false, follow: false },
};

export default function TrackingPage() {
  return (
    <div className="mx-auto max-w-3xl px-4 py-12 sm:px-6">
      <h1 className="font-serif text-4xl font-semibold">Theo dõi đơn hàng</h1>
      <p className="mt-2 text-muted-foreground">
        Nhập mã đơn hàng và số điện thoại đã dùng khi đặt hàng.
      </p>
      <Suspense
        fallback={<p className="py-12 text-center text-muted-foreground">Đang tải…</p>}
      >
        <TrackingClient />
      </Suspense>
    </div>
  );
}
