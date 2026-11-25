/**
 * Biểu đồ nhẹ cho trang quản trị: chỉ dùng HTML/CSS (Server Component), không thêm thư viện.
 * Mỗi biểu đồ có nhãn giá trị hiển thị trực tiếp + role="img"/aria-label để đọc được bằng trình đọc màn hình.
 */

export type ChartDatum = {
  label: string;
  value: number;
  /** Lớp màu nền (Tailwind), mặc định màu chủ đạo. */
  tone?: string;
  hint?: string;
};

export function BarList({
  data,
  unit = "",
  ariaLabel,
}: {
  data: ChartDatum[];
  unit?: string;
  ariaLabel: string;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul role="img" aria-label={ariaLabel} className="space-y-2.5">
      {data.map((d) => (
        <li key={d.label} className="grid grid-cols-[minmax(0,9rem)_1fr_auto] items-center gap-3 text-sm sm:grid-cols-[minmax(0,12rem)_1fr_auto]">
          <span className="truncate" title={d.label}>
            {d.label}
          </span>
          <span className="h-3 rounded-full bg-border/60">
            <span
              className={`block h-3 rounded-full ${d.tone ?? "bg-primary"}`}
              style={{ width: `${Math.max(d.value > 0 ? 2 : 0, (d.value / max) * 100)}%` }}
            />
          </span>
          <span className="min-w-14 text-right font-medium tabular-nums">
            {d.value.toLocaleString("vi-VN")}
            {unit}
          </span>
        </li>
      ))}
    </ul>
  );
}

export function Columns({
  data,
  ariaLabel,
  height = 140,
}: {
  data: ChartDatum[];
  ariaLabel: string;
  height?: number;
}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return (
    <ul
      role="img"
      aria-label={ariaLabel}
      className="flex items-end justify-between gap-2"
      style={{ height: height + 44 }}
    >
      {data.map((d) => (
        <li key={d.label} className="flex min-w-0 flex-1 flex-col items-center justify-end gap-1.5">
          <span className="text-xs font-medium tabular-nums">{d.value.toLocaleString("vi-VN")}</span>
          <span
            className={`w-full max-w-14 rounded-t-md ${d.tone ?? "bg-primary"}`}
            style={{ height: Math.max(d.value > 0 ? 4 : 1, (d.value / max) * height) }}
          />
          <span className="w-full truncate text-center text-[11px] text-muted-foreground" title={d.hint ?? d.label}>
            {d.label}
          </span>
        </li>
      ))}
    </ul>
  );
}
