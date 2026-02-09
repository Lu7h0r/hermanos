"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCOP, calculateShare, MEMBERS, type MemberName, type ExpenseCategory, type AllCategory } from "@/lib/split-rules";
import { MemberBadge } from "@/components/member-badge";
import type { MonthlyPeriod, HouseholdExpense, Payment, FamilyMember } from "@/lib/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function HistorialPage() {
  const supabase = createClient();
  const [periods, setPeriods] = useState<MonthlyPeriod[]>([]);
  const [selectedPeriod, setSelectedPeriod] = useState<MonthlyPeriod | null>(null);
  const [expenses, setExpenses] = useState<HouseholdExpense[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchPeriods = useCallback(async () => {
    const [perRes, memRes] = await Promise.all([
      supabase.from("monthly_periods").select("*").order("year", { ascending: false }).order("month", { ascending: false }),
      supabase.from("family_members").select("*").order("created_at"),
    ]);
    setPeriods(perRes.data || []);
    setMembers(memRes.data || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPeriods();
  }, [fetchPeriods]);

  async function selectPeriod(period: MonthlyPeriod) {
    setSelectedPeriod(period);
    const [expRes, payRes] = await Promise.all([
      supabase.from("household_expenses").select("*").eq("period_id", period.id),
      supabase.from("payments").select("*").eq("period_id", period.id),
    ]);
    setExpenses(expRes.data || []);
    setPayments(payRes.data || []);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse">Cargando...</div>
      </div>
    );
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          📊 Historial
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Revisá meses anteriores
        </p>
      </div>

      {/* Period list */}
      {!selectedPeriod && (
        <div className="space-y-2">
          {periods.length === 0 && (
            <div className="text-center py-8 text-stone-500">
              <p className="text-3xl mb-2">📊</p>
              <p>No hay meses registrados aún</p>
            </div>
          )}
          {periods.map((p) => (
            <button
              key={p.id}
              onClick={() => selectPeriod(p)}
              className="w-full bg-stone-800 border border-stone-700 hover:border-amber-500/50 rounded-2xl p-4 text-left transition-colors"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-stone-200">
                    {MONTH_NAMES[p.month]} {p.year}
                  </p>
                  <p className="text-xs text-stone-500 mt-0.5">
                    {p.status === "active" ? "En curso" : "Cerrado"}
                  </p>
                </div>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  p.status === "active"
                    ? "bg-amber-500/20 text-amber-400"
                    : "bg-stone-700 text-stone-400"
                }`}>
                  {p.status === "active" ? "Activo" : "Cerrado"}
                </span>
              </div>
            </button>
          ))}
        </div>
      )}

      {/* Period detail */}
      {selectedPeriod && (
        <div>
          <button
            onClick={() => setSelectedPeriod(null)}
            className="text-sm text-amber-400 hover:text-amber-300 mb-4 flex items-center gap-1"
          >
            ← Volver
          </button>

          <h2 className="font-display text-xl font-bold mb-4 text-stone-200">
            {MONTH_NAMES[selectedPeriod.month]} {selectedPeriod.year}
          </h2>

          {/* Expenses */}
          <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-4">
            <h3 className="text-sm font-medium text-stone-300 mb-3">
              Gastos del hogar
            </h3>
            <div className="space-y-2">
              {expenses.length === 0 && (
                <p className="text-sm text-stone-500">Sin gastos registrados</p>
              )}
              {expenses.map((exp) => (
                <div key={exp.id} className="flex items-center justify-between">
                  <span className="text-sm text-stone-400 capitalize">{exp.category}</span>
                  <span className="text-sm font-medium text-stone-300">
                    {formatCOP(exp.amount)}
                  </span>
                </div>
              ))}
              <div className="border-t border-stone-700 pt-2 mt-2 flex items-center justify-between">
                <span className="text-sm font-medium text-stone-300">Total</span>
                <span className="font-display font-bold text-amber-400">
                  {formatCOP(expenses.reduce((s, e) => s + e.amount, 0))}
                </span>
              </div>
            </div>
          </div>

          {/* Member breakdown */}
          <div className="space-y-3">
            {MEMBERS.map((member) => {
              const expByCategory: Record<string, number> = {};
              for (const e of expenses) {
                expByCategory[e.category] = (expByCategory[e.category] || 0) + e.amount;
              }

              const allCats: AllCategory[] = ["arriendo", "mercado", "servicios", "garaje", "mama_fund"];
              let total = 0;
              const breakdown: Record<string, number> = {};

              for (const cat of allCats) {
                const amount = cat === "mama_fund" ? selectedPeriod.mama_fund_goal : (expByCategory[cat] || 0);
                if (amount === 0) continue;
                const share = calculateShare(amount, cat, member.name);
                if (share > 0) {
                  breakdown[cat] = share;
                  total += share;
                }
              }

              const memberObj = members.find((m) => m.slug === member.name);
              const memberPayments = payments.filter((p) => p.member_id === memberObj?.id && p.paid);
              const totalPaid = memberPayments.reduce((s, p) => s + p.amount_due, 0);

              return (
                <div key={member.name} className="bg-stone-800 border border-stone-700 rounded-2xl p-4">
                  <div className="flex items-center justify-between mb-2">
                    <MemberBadge name={member.name} size="sm" />
                    <div className="text-right">
                      <p className="font-display font-bold text-stone-50">
                        {formatCOP(total)}
                      </p>
                      <p className={`text-xs ${totalPaid >= total ? "text-emerald-400" : "text-stone-500"}`}>
                        Pagado: {formatCOP(totalPaid)}
                      </p>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {Object.entries(breakdown).map(([cat, amount]) => {
                      const catLabels: Record<string, string> = {
                        arriendo: "Arriendo", mercado: "Mercado",
                        servicios: "Servicios", garaje: "Garaje", mama_fund: "Fondo Mamá",
                      };
                      return (
                        <div key={cat} className="flex justify-between text-xs">
                          <span className="text-stone-500">{catLabels[cat]}</span>
                          <span className="text-stone-400">{formatCOP(amount)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
