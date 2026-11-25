import { Star } from "lucide-react";

export default function RatingStars({
  rating,
  size = 16,
}: {
  rating: number;
  size?: number;
}) {
  const rounded = Math.round(rating);
  return (
    <span
      className="inline-flex items-center gap-0.5"
      role="img"
      aria-label={`${rating.toFixed(1)} trên 5 sao`}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          size={size}
          aria-hidden="true"
          className={
            n <= rounded
              ? "fill-brand-accent text-brand-accent"
              : "text-border"
          }
        />
      ))}
    </span>
  );
}
