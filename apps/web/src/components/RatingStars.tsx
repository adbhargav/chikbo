interface Props {
  rating: number | null;
  count?: number;
  size?: number;
  showCount?: boolean;
}

function Star({ fill, size }: { fill: number; size: number }) {
  const id = `star-${Math.random().toString(36).slice(2, 9)}`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true">
      <defs>
        <linearGradient id={id}>
          <stop offset={`${fill * 100}%`} stopColor="var(--gold-500)" />
          <stop offset={`${fill * 100}%`} stopColor="var(--ink-300)" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${id})`}
        d="M12 2.6l2.9 6 6.6.9-4.8 4.6 1.2 6.5L12 17.5l-5.9 3.1 1.2-6.5L2.5 9.5l6.6-.9z"
      />
    </svg>
  );
}

export function RatingStars({ rating, count, size = 15, showCount = true }: Props) {
  if (rating === null || rating === undefined) {
    return <span className="stars-empty muted">No reviews yet</span>;
  }
  const stars = [0, 1, 2, 3, 4].map((i) => Math.min(1, Math.max(0, rating - i)));
  return (
    <span className="stars" aria-label={`Rated ${rating.toFixed(1)} out of 5${count !== undefined ? ` from ${count} reviews` : ''}`}>
      <span className="stars-row" aria-hidden="true">
        {stars.map((fill, i) => (
          <Star key={i} fill={fill} size={size} />
        ))}
      </span>
      {showCount && count !== undefined && <span className="stars-count">({count})</span>}
    </span>
  );
}
