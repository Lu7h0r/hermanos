"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/stat-card";
import { ProgressBar } from "@/components/progress-bar";
import { MemberBadge } from "@/components/member-badge";
import {
  calculateShare,
  formatCOP,
  MEMBERS,
  type MemberName,
  type ExpenseCategory,
  type AllCategory,
} from "@/lib/split-rules";
import type { HouseholdExpense, Payment, MonthlyPeriod, FamilyMember } from "@/lib/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function DashboardPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState<MonthlyPeriod | null>(null);
  const [expenses, setExpenses] = useState<HouseholdExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    // Get or create period
    let { data: p } = await supabase
      .from("monthly_periods")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .single();

    if (!p) {
      const { data: newP } = await supabase
        .from("monthly_periods")
        .insert({ year, month })
        .select()
        .single();
      p = newP;

      if (p) {
        await supabase.from("household_expenses").insert([
          { period_id: p.id, category: "arriendo" as const, amount: 900000, description: "Arriendo mensual" },
          { period_id: p.id, category: "garaje" as const, amount: 180000, description: "Garaje mensual" },
        ]);
      }
    }

    if (!p) return;
    setPeriod(p);

    const [expRes, payRes, memRes] = await Promise.all([
      supabase.from("household_expenses").select("*").eq("period_id", p.id),
      supabase.from("payments").select("*").eq("period_id", p.id),
      supabase.from("family_members").select("*").order("created_at"),
    ]);

    setExpenses(expRes.data || []);
    setPayments(payRes.data || []);
    setMembers(memRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse text-lg">Cargando...</div>
      </div>
    );
  }

  if (!period) return null;

  // Calculate totals
  const expensesByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
  }

  const totalExpenses = expenses.reduce((sum, e) => sum + e.amount, 0);
  const mamaFundGoal = period.mama_fund_goal;

  // Per-member calculations
  const memberShares: Record<MemberName, { total: number; breakdown: Record<string, number>; paid: number; paidCategories: string[] }> = {
    alex: { total: 0, breakdown: {}, paid: 0, paidCategories: [] },
    duvan: { total: 0, breakdown: {}, paid: 0, paidCategories: [] },
    manuel: { total: 0, breakdown: {}, paid: 0, paidCategories: [] },
  };

  const allCategories: AllCategory[] = ["arriendo", "mercado", "servicios", "garaje", "mama_fund"];

  for (const memberName of MEMBERS.map((m) => m.name)) {
    for (const cat of allCategories) {
      const amount = cat === "mama_fund" ? mamaFundGoal : (expensesByCategory[cat] || 0);
      if (amount === 0) continue;
      const share = calculateShare(amount, cat, memberName);
      memberShares[memberName].breakdown[cat] = share;
      memberShares[memberName].total += share;
    }

    // Check payments
    const memberObj = members.find((m) => m.slug === memberName);
    if (memberObj) {
      const memberPayments = payments.filter((p) => p.member_id === memberObj.id && p.paid);
      memberShares[memberName].paid = memberPayments.reduce((sum, p) => sum + p.amount_due, 0);
      memberShares[memberName].paidCategories = memberPayments.map((p) => p.category);
    }
  }

  const totalMamaCollected = payments
    .filter((p) => p.category === "mama_fund" && p.paid)
    .reduce((sum, p) => sum + p.amount_due, 0);

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      {/* Header */}
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          🏠 Gastos Hermanos
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          {MONTH_NAMES[period.month]} {period.year}
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Total hogar"
          value={formatCOP(totalExpenses)}
          emoji="🏠"
        />
        <StatCard
          label="Fondo mamá"
          value={formatCOP(mamaFundGoal)}
          emoji="❤️"
          variant="accent"
        />
      </div>

      {/* Mama fund progress */}
      <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-6">
        <ProgressBar
          current={totalMamaCollected}
          total={mamaFundGoal}
          label="Fondo Mamá"
          variant="emerald"
        />
      </div>

      {/* Per member breakdown */}
      <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
        Reparto del mes
      </h2>

      <div className="space-y-3 mb-6">
        {MEMBERS.map((member) => {
          const share = memberShares[member.name];
          const isPaidAll = share.paid >= share.total && share.total > 0;
          const paidPercentage = share.total > 0 ? (share.paid / share.total) * 100 : 0;

          return (
            <div
              key={member.name}
              className={`bg-stone-800 border rounded-2xl p-4 transition-colors ${
                isPaidAll ? "border-emerald-500/40" : "border-stone-700"
              }`}
            >
              <div className="flex items-center justify-between mb-3">
                <MemberBadge name={member.name} size="sm" />
                <div className="text-right">
                  <p className="font-display font-bold text-lg text-stone-50">
                    {formatCOP(share.total)}
                  </p>
                  {isPaidAll && (
                    <span className="text-xs text-emerald-400 font-medium">
                      Pagado completo
                    </span>
                  )}
                </div>
              </div>

              {/* Category breakdown */}
              <div className="space-y-1.5">
                {Object.entries(share.breakdown)
                  .filter(([, amount]) => amount > 0)
                  .map(([cat, amount]) => {
                    const isPaid = share.paidCategories.includes(cat);
                    const catLabels: Record<string, string> = {
                      arriendo: "Arriendo",
                      mercado: "Mercado",
                      servicios: "Servicios",
                      garaje: "Garaje",
                      mama_fund: "Fondo Mamá",
                    };
                    return (
                      <div key={cat} className="flex items-center justify-between text-sm">
                        <span className={`${isPaid ? "text-stone-500 line-through" : "text-stone-400"}`}>
                          {catLabels[cat] || cat}
                        </span>
                        <span className={`font-medium ${isPaid ? "text-emerald-500" : "text-stone-300"}`}>
                          {formatCOP(amount)}
                          {isPaid && " ✓"}
                        </span>
                      </div>
                    );
                  })}
              </div>

              {!isPaidAll && share.total > 0 && (
                <div className="mt-3">
                  <div className="h-1.5 bg-stone-700 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-amber-500 rounded-full transition-all duration-500"
                      style={{ width: `${paidPercentage}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* Expenses loaded */}
      {expenses.length === 0 && (
        <div className="text-center py-8 text-stone-500">
          <p className="text-3xl mb-2">📋</p>
          <p>No hay gastos cargados este mes</p>
          <p className="text-sm mt-1">Andá a la sección Gastos para cargarlos</p>
        </div>
      )}
    </div>
  );
}
