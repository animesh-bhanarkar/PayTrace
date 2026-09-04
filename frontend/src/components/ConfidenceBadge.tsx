interface ConfidenceBadgeProps {
  level: string;
  abstained: boolean;
}

export default function ConfidenceBadge({ level, abstained }: ConfidenceBadgeProps) {
  const normalized = (level || "").toUpperCase();

  if (normalized === "HIGH") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
        HIGH
      </span>
    );
  }

  if (normalized === "MEDIUM") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-yellow-500/15 text-yellow-400 border border-yellow-500/30">
        MEDIUM
      </span>
    );
  }

  if (normalized === "LOW") {
    return (
      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-orange-500/15 text-orange-400 border border-orange-500/30">
        LOW
      </span>
    );
  }

  const label = abstained ? "ABSTAINED" : "INCONCLUSIVE";
  return (
    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-500/15 text-red-400 border border-red-500/30">
      {label}
    </span>
  );
}
