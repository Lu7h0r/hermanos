export type MemberName = "alex" | "duvan" | "manuel";
export type ExpenseCategory = "arriendo" | "mercado" | "servicios" | "garaje";
export type AllCategory = ExpenseCategory | "mama_fund";

export const MEMBERS: { name: MemberName; label: string; emoji: string; role: "contributor" | "beneficiary" }[] = [
  { name: "alex", label: "Alex", emoji: "🧑‍💻", role: "contributor" },
  { name: "duvan", label: "Duvan", emoji: "🏍️", role: "contributor" },
  { name: "manuel", label: "Manuel", emoji: "👷", role: "contributor" },
];

export const MAMA = { name: "mama" as const, label: "Mamá", emoji: "❤️", role: "beneficiary" as const };

type SplitRule = Record<MemberName, number> | "equal";

export const SPLIT_RULES: Record<AllCategory, SplitRule> = {
  arriendo: { alex: 70, duvan: 15, manuel: 15 },
  garaje: { alex: 50, duvan: 50, manuel: 0 },
  mercado: "equal",
  servicios: "equal",
  mama_fund: { alex: 50, duvan: 25, manuel: 25 },
} as const;

export const DEFAULT_AMOUNTS: Partial<Record<AllCategory, number>> = {
  arriendo: 900000,
  garaje: 180000,
  mama_fund: 350000,
};

export function calculateShare(
  amount: number,
  category: AllCategory,
  memberName: MemberName
): number {
  const rule = SPLIT_RULES[category];
  if (rule === "equal") {
    return Math.round(amount / 3);
  }
  const percentage = rule[memberName];
  if (percentage === 0) return 0;
  return Math.round((amount * percentage) / 100);
}

export function calculateMemberTotal(
  expenses: Record<ExpenseCategory, number>,
  mamaFund: number,
  memberName: MemberName
): number {
  let total = 0;
  for (const [category, amount] of Object.entries(expenses)) {
    total += calculateShare(amount, category as ExpenseCategory, memberName);
  }
  total += calculateShare(mamaFund, "mama_fund", memberName);
  return total;
}

export function formatCOP(amount: number): string {
  return new Intl.NumberFormat("es-CO", {
    style: "currency",
    currency: "COP",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatCOPShort(amount: number): string {
  if (amount >= 1000000) {
    return `$${(amount / 1000000).toFixed(1)}M`;
  }
  if (amount >= 1000) {
    return `$${Math.round(amount / 1000)}K`;
  }
  return formatCOP(amount);
}
