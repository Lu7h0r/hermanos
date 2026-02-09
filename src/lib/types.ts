// Simple types for the app - no Supabase generics needed

export interface FamilyMember {
  id: string;
  name: string;
  slug: string;
  role: "contributor" | "beneficiary";
  avatar_emoji: string;
  created_at: string;
}

export interface MonthlyPeriod {
  id: string;
  year: number;
  month: number;
  status: "active" | "closed";
  mama_fund_goal: number;
  created_at: string;
}

export interface HouseholdExpense {
  id: string;
  period_id: string;
  category: "arriendo" | "mercado" | "servicios" | "garaje";
  description: string | null;
  amount: number;
  date: string;
  created_at: string;
}

export interface Payment {
  id: string;
  member_id: string;
  period_id: string;
  category: "arriendo" | "mercado" | "servicios" | "garaje" | "mama_fund";
  amount_due: number;
  paid: boolean;
  paid_date: string | null;
  created_at: string;
}

export interface WorkLog {
  id: string;
  member_id: string;
  date: string;
  gross_income: number;
  gas_cost: number;
  other_costs: number;
  km_driven: number | null;
  notes: string | null;
  created_at: string;
}

export interface MotoMaintenance {
  id: string;
  member_id: string;
  date: string;
  type: "oil" | "tire_front" | "tire_rear" | "brakes" | "chain" | "other";
  cost: number;
  km_at_service: number | null;
  next_service_km: number | null;
  description: string | null;
  created_at: string;
}

export interface MotoKmLog {
  id: string;
  member_id: string;
  date: string;
  km_reading: number;
  created_at: string;
}

// Debt tracking
export type DebtPriority = "urgente" | "normal" | "tranqui";

export interface Debt {
  id: string;
  member_id: string;
  creditor_name: string;
  original_amount: number;
  remaining_amount: number;
  priority: DebtPriority;
  notes: string | null;
  is_paid_off: boolean;
  paid_off_date: string | null;
  created_at: string;
}

export interface DebtPayment {
  id: string;
  debt_id: string;
  amount: number;
  date: string;
  notes: string | null;
  created_at: string;
}

export interface DebtConfig {
  id: string;
  member_id: string;
  monthly_budget: number;
  updated_at: string;
}

export interface DebtPlanItem {
  debt: Debt;
  monthlySuggested: number;
  estimatedPayoffDate: Date;
  monthsToPayoff: number;
}
