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

// --- Debt helpers ---
import type { Debt, DebtPlanItem } from "./types";

const PRIORITY_ORDER: Record<string, number> = {
  urgente: 0,
  normal: 1,
  tranqui: 2,
};

/**
 * Ordena deudas para plan de pago: urgente > normal > tranqui.
 * Dentro de cada prioridad, las de menor monto primero (snowball).
 */
export function sortDebtsForPayoff(debts: Debt[]): Debt[] {
  return [...debts]
    .filter((d) => !d.is_paid_off)
    .sort((a, b) => {
      const pDiff = PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority];
      if (pDiff !== 0) return pDiff;
      return a.remaining_amount - b.remaining_amount;
    });
}

/**
 * Distribuye el presupuesto mensual entre deudas ordenadas.
 * Estrategia snowball: todo el presupuesto va a la primera deuda activa,
 * cuando se paga, pasa a la siguiente.
 */
export function calculateDebtPlan(
  debts: Debt[],
  monthlyBudget: number
): DebtPlanItem[] {
  if (monthlyBudget <= 0) {
    return sortDebtsForPayoff(debts).map((debt) => ({
      debt,
      monthlySuggested: 0,
      estimatedPayoffDate: new Date(2099, 0, 1),
      monthsToPayoff: Infinity,
    }));
  }

  const sorted = sortDebtsForPayoff(debts);
  const result: DebtPlanItem[] = [];
  let accumulatedMonths = 0;

  for (let i = 0; i < sorted.length; i++) {
    const debt = sorted[i];
    const monthsNeeded = Math.ceil(debt.remaining_amount / monthlyBudget);
    const estimatedDate = new Date();
    estimatedDate.setMonth(estimatedDate.getMonth() + accumulatedMonths + monthsNeeded);

    // La deuda actual en foco recibe todo el presupuesto
    // Las siguientes esperan su turno (snowball)
    const isFocused = i === 0;

    result.push({
      debt,
      monthlySuggested: isFocused ? Math.min(monthlyBudget, debt.remaining_amount) : 0,
      estimatedPayoffDate: estimatedDate,
      monthsToPayoff: monthsNeeded,
    });

    accumulatedMonths += monthsNeeded;
  }

  return result;
}

/**
 * Estima la fecha en la que Duvan queda libre de deudas.
 */
export function estimatePayoffDate(
  debts: Debt[],
  monthlyBudget: number
): Date | null {
  const activeDebts = debts.filter((d) => !d.is_paid_off);
  if (activeDebts.length === 0) return null;
  if (monthlyBudget <= 0) return null;

  const totalRemaining = activeDebts.reduce((s, d) => s + d.remaining_amount, 0);
  const months = Math.ceil(totalRemaining / monthlyBudget);
  const date = new Date();
  date.setMonth(date.getMonth() + months);
  return date;
}
