import type { MemberName } from "@/lib/split-rules";
import { MEMBERS } from "@/lib/split-rules";

interface MemberBadgeProps {
  name: MemberName;
  size?: "sm" | "md" | "lg";
  showName?: boolean;
}

const sizeStyles = {
  sm: "w-8 h-8 text-base",
  md: "w-10 h-10 text-xl",
  lg: "w-14 h-14 text-2xl",
};

export function MemberBadge({ name, size = "md", showName = true }: MemberBadgeProps) {
  const member = MEMBERS.find((m) => m.name === name);
  if (!member) return null;

  return (
    <div className="flex items-center gap-2">
      <div
        className={`${sizeStyles[size]} rounded-full bg-stone-700 flex items-center justify-center shrink-0`}
      >
        {member.emoji}
      </div>
      {showName && (
        <span className="font-medium text-stone-200">{member.label}</span>
      )}
    </div>
  );
}
