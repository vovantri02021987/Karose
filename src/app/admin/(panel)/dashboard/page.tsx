import Link from "next/link";
import { getNearExpiryBatches } from "@/lib/fefo";
import { requireStaffPage } from "@/lib/auth/guard";
import { formatDate, formatDateTime, formatVND, sellableExpiryCutoff } from "@/lib/format";
import { prisma } from "@/lib/prisma";
import { ORDER_STATUS_LABEL, PAYMENT_STATUS_LABEL } from "@/lib/admin-labels";
import StatusBadge from "@/components/admin/StatusBadge";
import { BarList, Columns } from "@/components/admin/charts";
import { buildDashboardCharts, revenueWindowStart } from "@/lib/dashboard-charts";

function suggestion(daysLeft: number, expired: boolean): string {
  if (expired) return "Biệt lập khỏi khu bán hàng, lập biên bản huỷ";
  if (daysLeft < 15) return "Thanh lý / giảm giá sâu, ưu tiên xuất trước";
  return "Tặng mẫu thử hoặc đưa vào combo khuyến mãi";
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ denied?: string }>;
}) {
  await requireStaffPage();
  const { denied } = await searchParams;

  const since = revenueWindowStart();

  const [revenue, openOrders, stock, nearExpiry, recent, liveBatches, recentOrders] = await Promise.all([
    prisma.order.aggregate({
      _sum: { totalAmount: true },
      where: {
        status: { notIn: ["CANCELLED", "RETURNED"] },
        OR: [{ paymentStatus: "PAID" }, { status: "DELIVERED" }],
      },
    }),
    prisma.order.count({ where: { status: { in: ["PENDING", "CONFIRMED", "PROCESSING"] } } }),
    prisma.inventoryBatch.aggregate({
      _sum: { availableQuantity: true },
      where: { availableQuantity: { gt: 0 }, expiryDate: { gt: sellableExpiryCutoff() } },
    }),
    getNearExpiryBatches(30),
    prisma.order.findMany({
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        orderCode: true,
        customerName: true,
        totalAmount: true,
        status: true,
        paymentStatus: true,
        createdAt: true,
      },
    }),
    prisma.inventoryBatch.findMany({
      where: { availableQuantity: { gt: 0 } },
      select: {
        availableQuantity: true,
        expiryDate: true,
        variant: {
          select: {
            price: true,
            product: { select: { name: true, category: { select: { name: true } } } },
          },
        },
      },
    }),
    prisma.order.findMany({
      where: { createdAt: { gte: since }, status: { notIn: ["CANCELLED", "RETURNED"] } },
      select: { createdAt: true, totalAmount: true },
    }),
  ]);

  const { categoryData, productData, expiryData, revenueData, revenue14, stockValue } =
    buildDashboardCharts(liveBatches, recentOrders);

  const cards = [
    { label: "Doanh thu đã thanh toán / hoàn tất", value: formatVND(revenue._sum.totalAmount ?? 0) },
    { label: "Đơn mới & đang xử lý", value: String(openOrders) },
    { label: "Tồn khả dụng bán lẻ (hạn > 30 ngày)", value: String(stock._sum.availableQuantity ?? 0) },
    { label: "Lô cận hạn / hết hạn (≤ 30 ngày)", value: String(nearExpiry.length), warn: nearExpiry.length > 0 },
    { label: "Giá trị tồn bán lẻ (theo giá bán)", value: formatVND(stockValue) },
    { label: "Doanh số 14 ngày (đơn chưa huỷ)", value: formatVND(revenue14) },
  ];

  return (
    <div className="space-y-8">
      <h1 className="font-serif text-3xl font-semibold">Tổng quan</h1>
      {denied && (
        <p className="rounded-lg border border-brand-accent/50 bg-surface p-3 text-sm">
          Tính năng này chỉ dành cho quản trị viên (ADMIN).
        </p>
      )}

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="rounded-2xl border border-border bg-surface p-5">
            <p className="text-xs text-muted-foreground">{c.label}</p>
            <p className={`mt-2 text-2xl font-semibold ${c.warn ? "text-destructive" : "text-primary"}`}>
              {c.value}
            </p>
          </div>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <ChartCard title="Tồn khả dụng theo danh mục" note="Chỉ tính lô còn hạn > 30 ngày">
          <BarList data={categoryData} unit=" sp" ariaLabel="Tồn khả dụng theo danh mục" />
        </ChartCard>
        <ChartCard title="Top 10 sản phẩm theo tồn" note="Chỉ tính lô còn hạn > 30 ngày">
          <BarList data={productData} unit=" sp" ariaLabel="Top 10 sản phẩm theo tồn khả dụng" />
        </ChartCard>
        <ChartCard title="Tồn theo thời hạn còn lại" note="Số lượng theo số ngày còn đến hạn dùng; đỏ = cần xử lý">
          <Columns data={expiryData} ariaLabel="Tồn kho theo thời hạn còn lại" />
        </ChartCard>
        <ChartCard title="Doanh số 14 ngày gần nhất" note="Đơn vị: nghìn đồng, đơn chưa huỷ/hoàn">
          <Columns data={revenueData} ariaLabel="Doanh số theo ngày trong 14 ngày gần nhất" />
        </ChartCard>
      </div>

      <section>
        <h2 className="font-serif text-xl font-semibold">Cảnh báo lô cận hạn / hết hạn</h2>
        {nearExpiry.length === 0 ? (
          <p className="mt-3 text-sm text-muted-foreground">Không có lô nào cần xử lý.</p>
        ) : (
          <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
            <table className="w-full min-w-[760px] text-left text-sm">
              <thead className="bg-surface text-xs text-muted-foreground">
                <tr>
                  <th className="px-4 py-3">Mã lô</th>
                  <th className="px-4 py-3">Sản phẩm</th>
                  <th className="px-4 py-3">Hạn dùng</th>
                  <th className="px-4 py-3">Còn lại</th>
                  <th className="px-4 py-3 text-right">Tồn</th>
                  <th className="px-4 py-3">Gợi ý xử lý</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {nearExpiry.map((b) => {
                  const tone = b.isExpired || b.daysLeft < 15 ? "text-destructive" : "text-brand-accent";
                  return (
                    <tr key={b.batchId}>
                      <td className="px-4 py-3 font-medium">{b.batchCode}</td>
                      <td className="px-4 py-3">
                        {b.productName}
                        <span className="block text-xs text-muted-foreground">{b.variantName}</span>
                      </td>
                      <td className="px-4 py-3">{formatDate(b.expiryDate)}</td>
                      <td className={`px-4 py-3 font-semibold ${tone}`}>
                        {b.isExpired ? `Quá hạn ${Math.abs(b.daysLeft)} ngày` : `Còn ${b.daysLeft} ngày`}
                      </td>
                      <td className="px-4 py-3 text-right">
                        {b.availableQuantity}
                        {b.reservedQuantity > 0 && (
                          <span className="block text-xs text-muted-foreground">giữ {b.reservedQuantity}</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs">{suggestion(b.daysLeft, b.isExpired)}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <div className="flex items-center justify-between">
          <h2 className="font-serif text-xl font-semibold">Đơn hàng gần nhất</h2>
          <Link href="/admin/orders" className="text-sm text-primary underline">
            Xem tất cả
          </Link>
        </div>
        <div className="mt-3 overflow-x-auto rounded-2xl border border-border">
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="bg-surface text-xs text-muted-foreground">
              <tr>
                <th className="px-4 py-3">Mã đơn</th>
                <th className="px-4 py-3">Khách hàng</th>
                <th className="px-4 py-3">Thời gian</th>
                <th className="px-4 py-3 text-right">Tổng tiền</th>
                <th className="px-4 py-3">Đơn hàng</th>
                <th className="px-4 py-3">Thanh toán</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {recent.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-muted-foreground">
                    Chưa có đơn hàng.
                  </td>
                </tr>
              )}
              {recent.map((o) => (
                <tr key={o.id}>
                  <td className="px-4 py-3">
                    <Link href={`/admin/orders/${o.id}`} className="font-medium text-primary underline">
                      {o.orderCode}
                    </Link>
                  </td>
                  <td className="px-4 py-3">{o.customerName}</td>
                  <td className="px-4 py-3">{formatDateTime(o.createdAt)}</td>
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
      </section>
    </div>
  );
}

function ChartCard({
  title,
  note,
  children,
}: {
  title: string;
  note?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-2xl border border-border bg-surface/60 p-5">
      <h2 className="font-serif text-xl font-semibold">{title}</h2>
      {note && <p className="mt-1 text-xs text-muted-foreground">{note}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}
