const TONES: Record<string, string> = {
  PENDING: "bg-brand-accent/15 text-brand-accent",
  CONFIRMED: "bg-primary/10 text-primary",
  PROCESSING: "bg-primary/10 text-primary",
  SHIPPING: "bg-primary/15 text-primary",
  DELIVERED: "bg-primary text-primary-foreground",
  CANCELLED: "bg-destructive/10 text-destructive",
  RETURNED: "bg-destructive/10 text-destructive",
  UNPAID: "bg-brand-accent/15 text-brand-accent",
  PAID: "bg-primary/10 text-primary",
  REFUNDED: "bg-destructive/10 text-destructive",
};

export default function StatusBadge({
  value,
  label,
}: {
  kind: "order" | "payment";
  value: string;
  label: string;
}) {
  return (
    <span className={`inline-block whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium ${TONES[value] ?? "bg-surface"}`}>
      {label}
    </span>
  );
}
