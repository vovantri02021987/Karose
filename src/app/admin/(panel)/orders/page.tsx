import Link from "next/link";
import type { Prisma } from "@prisma/client";
import StatusBadge from "@/components/admin/StatusBadge";
import { requireStaffPage } from "@/lib/auth/guard";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  PAYMENT_STATUS_LABEL,
} from "@/lib/admin-labels";
import { formatDateTime, formatVND } from "@/lib/format";
import { prisma } from "@/lib/prisma";

const PAGE_SIZE = 20;
const ORDER_STATUSES = Object.keys(ORDER_STATUS_LABEL) as (keyof typeof ORDER_STATUS_LABEL)[];
const PAYMENT_STATUSES = Object.keys(PAYMENT_STATUS_LABEL) as (keyof typeof PAYMENT_STATUS_LABEL)[];

interface Params {
  status?: string;
  paymentStatus?: string;
  q?: string;
  page?: string;
}

export default async function OrdersPage({ searchParams }: { searchParams: Promise<Params> }) {
  await requireStaffPage();
  const sp = await searchParams;
  const status = ORDER_STATUSES.find((s) => s === sp.status);
  const paymentStatus = PAYMENT_STATUSES.find((s) => s === sp.paymentStatus);
  const q = (sp.q ?? "").trim().slice(0, 40);
  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1);

  const where: Prisma.OrderWhereInput = {
    ...(status ? { status } : {}),
    ...(paymentStatus ? { paymentStatus } : {}),
    ...(q
      ? {
          OR: [
            { orderCode: { contains: q.toUpperCase() } },
            { customerPhone: { contains: q.replace(/\s+/g, "") } },
          ],
        }
      : {}),
  };

  const [total, orders] = await Promise.all([
    prisma.order.count({ where }),
    prisma.order.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        orderCode: true,
        customerName: true,
        customerPhone: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        paymentMethod: true,
        createdAt: true,
      },
    }),
  ]);
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const href = (p: number) => {
    const u = new URLSearchParams();
    if (status) u.set("status", status);
    if (paymentStatus) u.set("paymentStatus", paymentStatus);
    if (q) u.set("q", q);
    if (p > 1) u.set("page", String(p));
    const s = u.toString();
    return `/admin/orders${s ? `?${s}` : ""}`;
  };

  const selectClass = "rounded-lg border border-border bg-background px-3 py-2 text-sm";

  return (
    <div className="space-y-6">
      <h1 className="type-page-title">Đơn hàng</h1>

      <form className="flex flex-wrap items-end gap-3" action="/admin/orders">
        <input
          name="q"
          defaultValue={q}
          placeholder="Mã đơn hoặc số điện thoại"
          className={`${selectClass} w-64`}
        />
        <select name="status" defaultValue={status ?? ""} className={selectClass}>
          <option value="">Mọi trạng thái đơn</option>
          {ORDER_STATUSES.map((s) => (
            <option key={s} value={s}>{ORDER_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <select name="paymentStatus" defaultValue={paymentStatus ?? ""} className={selectClass}>
          <option value="">Mọi trạng thái thanh toán</option>
          {PAYMENT_STATUSES.map((s) => (
            <option key={s} value={s}>{PAYMENT_STATUS_LABEL[s]}</option>
          ))}
        </select>
        <button type="submit" className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
          Lọc
        </button>
        {(status || paymentStatus || q) && (
          <Link href="/admin/orders" className="py-2 text-sm text-muted-foreground underline">
            Xoá bộ lọc
          </Link>
        )}
      </form>

      <p className="text-sm text-muted-foreground">{total} đơn hàng</p>

      <div className="overflow-x-auto rounded-2xl border border-border">
        <table className="w-full min-w-[820px] text-left text-sm">
          <thead className="bg-surface text-xs text-muted-foreground">
            <tr>
              <th className="px-4 py-3">Mã đơn</th>
              <th className="px-4 py-3">Khách hàng</th>
              <th className="px-4 py-3">Thời gian</th>
              <th className="px-4 py-3">PT thanh toán</th>
              <th className="px-4 py-3 text-right">Tổng tiền</th>
              <th className="px-4 py-3">Đơn hàng</th>
              <th className="px-4 py-3">Thanh toán</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {orders.length === 0 && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-muted-foreground">
                  Không có đơn hàng phù hợp.
                </td>
              </tr>
            )}
            {orders.map((o) => (
              <tr key={o.id}>
                <td className="px-4 py-3">
                  <Link href={`/admin/orders/${o.id}`} className="type-code font-medium text-primary underline">
                    {o.orderCode}
                  </Link>
                </td>
                <td className="px-4 py-3">
                  {o.customerName}
                  <span className="block text-xs text-muted-foreground">{o.customerPhone}</span>
                </td>
                <td className="px-4 py-3">{formatDateTime(o.createdAt)}</td>
                <td className="px-4 py-3">{PAYMENT_METHOD_LABEL[o.paymentMethod]}</td>
                <td className="px-4 py-3 text-right">{formatVND(o.totalAmount)}</td>
                <td className="px-4 py-3">
                  <StatusBadge kind="order" value={o.status} label={ORDER_STATUS_LABEL[o.status]} />
                </td>
                <td className="px-4 py-3">
                  <StatusBadge kind="payment" value={o.paymentStatus} label={PAYMENT_STATUS_LABEL[o.paymentStatus]} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {pages > 1 && (
        <div className="flex items-center justify-center gap-4 text-sm">
          {page > 1 ? <Link href={href(page - 1)} className="underline">← Trước</Link> : <span />}
          <span className="text-muted-foreground">Trang {page}/{pages}</span>
          {page < pages ? <Link href={href(page + 1)} className="underline">Sau →</Link> : <span />}
        </div>
      )}
    </div>
  );
}
