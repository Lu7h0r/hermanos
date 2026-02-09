interface StatCardProps {
  label: string;
  value: string;
  emoji?: string;
  sublabel?: string;
  variant?: "default" | "accent" | "success" | "danger";
  className?: string;
}

const variantStyles = {
  default: "bg-stone-800 border-stone-700",
  accent: "bg-amber-500/10 border-amber-500/30",
  success: "bg-emerald-500/10 border-emerald-500/30",
  danger: "bg-red-500/10 border-red-500/30",
};

const valueStyles = {
  default: "text-stone-50",
  accent: "text-amber-400",
  success: "text-emerald-400",
  danger: "text-red-400",
};

export function StatCard({
  label,
  value,
  emoji,
  sublabel,
  variant = "default",
  className = "",
}: StatCardProps) {
  return (
    <div
      className={`rounded-2xl border p-4 ${variantStyles[variant]} ${className}`}
    >
      <div className="flex items-center gap-2 mb-1">
        {emoji && <span className="text-lg">{emoji}</span>}
        <span className="text-xs text-stone-400 uppercase tracking-wide font-medium">
          {label}
        </span>
      </div>
      <p className={`text-xl font-bold font-display ${valueStyles[variant]}`}>
        {value}
      </p>
      {sublabel && (
        <p className="text-xs text-stone-500 mt-1">{sublabel}</p>
      )}
    </div>
  );
}
