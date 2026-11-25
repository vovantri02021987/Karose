import Link from "next/link";
import { notFound } from "next/navigation";
import StatusBadge from "@/components/admin/StatusBadge";
import { requireStaffPage } from "@/lib/auth/guard";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/admin-labels";
import { formatDateTime, formatVND } from "@/lib/format";
import { allowedNextStatuses } from "@/lib/order-transitions";
import { prisma } from "@/lib/prisma";
import OrderActions from "./OrderActions";

interface Allocation {
  batchCode: string;
  quantity: number;
}

function readAllocations(value: unknown): Allocation[] {
  if (!Array.isArray(value)) return [];
  const out: Allocation[] = [];
  for (const v of value) {
    if (v && typeof v === "object" && "batchCode" in v && "quantity" in v) {
      const { batchCode, quantity } = v as { batchCode: unknown; quantity: unknown };
      if (typeof batchCode === "string" && typeof quantity === "number") out.push({ batchCode, quantity });
    }
  }
  return out;
}

export default async function OrderDetailPage({ params }: { params: Promise<{ id: string }> }) {
  await requireStaffPage();
  const { id } = await params;
  const order = await prisma.order.findUnique({
    where: { id },
    include: {
      voucher: { select: { code: true } },
      items: {
        include: { variant: { select: { sku: true, name: true, product: { select: { name: true } } } } },
      },
    },
  });
  if (!order) notFound();

  return (
    <div className="space-y-6">
      <div>
        <Link href="/admin/orders" className="text-sm text-muted-foreground underline">← Danh sách đơn hàng</Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="type-page-title">Đơn <span className="type-code">{order.orderCode}</span></h1>
          <StatusBadge kind="order" value={order.status} label={ORDER_STATUS_LABEL[order.status]} />
          <StatusBadge kind="payment" value={order.paymentStatus} label={PAYMENT_STATUS_LABEL[order.paymentStatus]} />
        </div>
        <p className="text-sm text-muted-foreground">
          Đặt lúc {formatDateTime(order.createdAt)} · {PAYMENT_METHOD_LABEL[order.paymentMethod]}
        </p>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1fr_380px]">
        <div className="space-y-6">
          <section className="rounded-2xl border border-border p-5">
            <h2 className="type-card-editorial">Sản phẩm & lô xuất kho</h2>
            <ul className="mt-3 divide-y divide-border">
              {order.items.map((i) => {
                const alloc = readAllocations(i.batchAllocated);
                return (
                  <li key={i.id} className="py-3 text-sm">
                    <div className="flex justify-between gap-3">
                      <div>
                        <p className="font-medium">{i.variant.product.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {i.variant.name} · {i.variant.sku} · SL {i.quantity} × {formatVND(i.unitPrice)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatVND(i.unitPrice * i.quantity)}</p>
                    </div>
                    <p className="mt-1 text-xs">
                      <span className="text-muted-foreground">Lấy từ lô: </span>
                      {alloc.length === 0
                        ? "—"
                        : alloc.map((a) => `${a.batchCode} (${a.quantity})`).join(", ")}
                    </p>
                  </li>
                );
              })}
            </ul>
            <dl className="mt-3 space-y-1.5 border-t border-border pt-3 text-sm">
              <div className="flex justify-between"><dt className="text-muted-foreground">Tạm tính</dt><dd>{formatVND(order.subtotal)}</dd></div>
              {order.discountAmount > 0 && (
                <div className="flex justify-between text-primary">
                  <dt>Giảm giá{order.voucher ? ` (${order.voucher.code})` : ""}</dt>
                  <dd>-{formatVND(order.discountAmount)}</dd>
                </div>
              )}
              <div className="flex justify-between"><dt className="text-muted-foreground">Phí vận chuyển</dt><dd>{order.shippingFee === 0 ? "Miễn phí" : formatVND(order.shippingFee)}</dd></div>
              <div className="flex justify-between border-t border-border pt-2 text-base font-semibold"><dt>Tổng cộng</dt><dd className="text-primary">{formatVND(order.totalAmount)}</dd></div>
            </dl>
          </section>

          <section className="rounded-2xl border border-border p-5 text-sm">
            <h2 className="type-card-editorial">Người nhận</h2>
            <p className="mt-2 font-medium">{order.customerName} · {order.customerPhone}</p>
            {order.customerEmail && <p className="text-muted-foreground">{order.customerEmail}</p>}
            <p className="mt-1">{order.shippingAddress}, {order.ward}, {order.district}, {order.province}</p>
            <p className="mt-2 text-muted-foreground">
              Giao dự kiến (đã cam kết khi đặt):{" "}
              <span className="font-medium text-foreground">{order.estimatedDeliveryText ?? "Đơn cũ — chưa lưu"}</span>
            </p>
            {order.note && <p className="mt-2 text-muted-foreground">Ghi chú: {order.note}</p>}
            {order.paymentRef && <p className="mt-2 text-xs text-muted-foreground">Mã giao dịch: {order.paymentRef}</p>}
          </section>
        </div>

        <OrderActions
          orderId={order.id}
          status={order.status}
          paymentStatus={order.paymentStatus}
          shippingPartner={order.shippingPartner ?? ""}
          trackingCode={order.trackingCode ?? ""}
          nextStatuses={allowedNextStatuses(order.status)}
        />
      </div>
    </div>
  );
}
