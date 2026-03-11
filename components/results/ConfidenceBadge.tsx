interface ConfidenceBadgeProps {
  tier: 'locked' | 'likely';
}

export function ConfidenceBadge({ tier }: ConfidenceBadgeProps) {
  if (tier === 'locked') {
    return (
      <span className="inline-flex items-center gap-1 text-xs font-medium text-emerald-400 bg-emerald-900/30 border border-emerald-800 px-2 py-0.5 rounded-full">
        <span>●</span> Locked
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs font-medium text-amber-400 bg-amber-900/30 border border-amber-800 px-2 py-0.5 rounded-full">
      <span>◎</span> Likely
    </span>
  );
}
