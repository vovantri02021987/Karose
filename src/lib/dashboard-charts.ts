import type { ChartDatum } from "@/components/admin/charts";
import { formatVND, sellableExpiryCutoff } from "@/lib/format";

const DAY_MS = 86_400_000;

export function revenueWindowStart(): Date {
  const d = new Date(Date.now() - 13 * DAY_MS);
  d.setHours(0, 0, 0, 0);
  return d;
}

interface LiveBatch {
  availableQuantity: number;
  expiryDate: Date;
  variant: {
    price: number;
    product: { name: string; category: { name: string } };
  };
}

interface RecentOrder {
  createdAt: Date;
  totalAmount: number;
}

export function buildDashboardCharts(liveBatches: LiveBatch[], recentOrders: RecentOrder[]) {
  const now = Date.now();
  const cutoff = sellableExpiryCutoff().getTime();
  const byCategory = new Map<string, number>();
  const byProduct = new Map<string, number>();
  let stockValue = 0;
  const buckets = [
    { label: "Quá hạn", test: (d: number) => d <= 0, tone: "bg-destructive" },
    { label: "≤ 30 ngày", test: (d: number) => d > 0 && d <= 30, tone: "bg-destructive/70" },
    { label: "31–90", test: (d: number) => d > 30 && d <= 90, tone: "bg-brand-accent/70" },
    { label: "91–180", test: (d: number) => d > 90 && d <= 180, tone: "bg-brand-accent" },
    { label: "181–365", test: (d: number) => d > 180 && d <= 365, tone: "bg-primary/70" },
    { label: "> 365", test: (d: number) => d > 365, tone: "bg-primary" },
  ].map((b) => ({ ...b, value: 0 }));
  for (const b of liveBatches) {
    const days = Math.ceil((b.expiryDate.getTime() - now) / DAY_MS);
    const bucket = buckets.find((x) => x.test(days));
    if (bucket) bucket.value += b.availableQuantity;
    if (b.expiryDate.getTime() > cutoff) {
      const cat = b.variant.product.category.name;
      byCategory.set(cat, (byCategory.get(cat) ?? 0) + b.availableQuantity);
      const name = b.variant.product.name;
      byProduct.set(name, (byProduct.get(name) ?? 0) + b.availableQuantity);
      stockValue += b.availableQuantity * b.variant.price;
    }
  }
  const toData = (m: Map<string, number>, limit?: number): ChartDatum[] =>
    [...m.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([label, value]) => ({ label, value }));
  const categoryData = toData(byCategory);
  const productData = toData(byProduct, 10);
  const expiryData: ChartDatum[] = buckets.map((b) => ({ label: b.label, value: b.value, tone: b.tone }));

  const dayKey = (d: Date) => d.toLocaleDateString("en-CA", { timeZone: "Asia/Ho_Chi_Minh" });
  const revenueByDay = new Map<string, number>();
  for (const o of recentOrders) {
    const k = dayKey(o.createdAt);
    revenueByDay.set(k, (revenueByDay.get(k) ?? 0) + o.totalAmount);
  }
  const revenueData: ChartDatum[] = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(now - (13 - i) * DAY_MS);
    const k = dayKey(d);
    const [, m, dd] = k.split("-");
    return { label: `${dd}/${m}`, value: Math.round((revenueByDay.get(k) ?? 0) / 1000), hint: `${dd}/${m}: ${formatVND(revenueByDay.get(k) ?? 0)}` };
  });
  const revenue14 = recentOrders.reduce((s, o) => s + o.totalAmount, 0);

  return { categoryData, productData, expiryData, revenueData, revenue14, stockValue };
}
