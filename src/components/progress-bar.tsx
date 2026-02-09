interface ProgressBarProps {
  current: number;
  total: number;
  label?: string;
  showAmount?: boolean;
  formatFn?: (n: number) => string;
  variant?: "amber" | "emerald";
}

export function ProgressBar({
  current,
  total,
  label,
  showAmount = true,
  formatFn = (n) => `$${n.toLocaleString("es-CO")}`,
  variant = "amber",
}: ProgressBarProps) {
  const percentage = total > 0 ? Math.min((current / total) * 100, 100) : 0;
  const barColor = variant === "amber" ? "bg-amber-500" : "bg-emerald-500";

  return (
    <div>
      {(label || showAmount) && (
        <div className="flex items-center justify-between mb-2">
          {label && (
            <span className="text-sm text-stone-400">{label}</span>
          )}
          {showAmount && (
            <span className="text-sm font-medium text-stone-300">
              {formatFn(current)} / {formatFn(total)}
            </span>
          )}
        </div>
      )}
      <div className="h-2.5 bg-stone-700 rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${barColor}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
