"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import {
  calculateShare,
  formatCOP,
  MEMBERS,
  DEFAULT_AMOUNTS,
  type MemberName,
  type ExpenseCategory,
} from "@/lib/split-rules";
import type { HouseholdExpense, MonthlyPeriod, FamilyMember, Payment } from "@/lib/types";

const CATEGORY_CONFIG: Record<ExpenseCategory, { label: string; emoji: string; fixed: boolean }> = {
  arriendo: { label: "Arriendo", emoji: "🏠", fixed: true },
  garaje: { label: "Garaje", emoji: "🚗", fixed: true },
  mercado: { label: "Mercado", emoji: "🛒", fixed: false },
  servicios: { label: "Servicios", emoji: "💡", fixed: false },
};

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function GastosPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState<MonthlyPeriod | null>(null);
  const [expenses, setExpenses] = useState<HouseholdExpense[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form state for variable expenses
  const [mercadoAmount, setMercadoAmount] = useState("");
  const [serviciosAmount, setServiciosAmount] = useState("");

  const fetchData = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

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

    const [expRes, memRes, payRes] = await Promise.all([
      supabase.from("household_expenses").select("*").eq("period_id", p.id),
      supabase.from("family_members").select("*").order("created_at"),
      supabase.from("payments").select("*").eq("period_id", p.id),
    ]);

    const exps = expRes.data || [];
    setExpenses(exps);
    setMembers(memRes.data || []);
    setPayments(payRes.data || []);

    // Pre-fill form with existing variable expenses
    const mercado = exps.find((e) => e.category === "mercado");
    const servicios = exps.find((e) => e.category === "servicios");
    if (mercado) setMercadoAmount(mercado.amount.toString());
    if (servicios) setServiciosAmount(servicios.amount.toString());

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function saveVariableExpense(category: "mercado" | "servicios", amountStr: string) {
    if (!period || !amountStr) return;
    setSaving(true);
    const amount = parseInt(amountStr.replace(/\D/g, ""), 10);
    if (isNaN(amount) || amount <= 0) {
      setSaving(false);
      return;
    }

    const existing = expenses.find((e) => e.category === category);
    if (existing) {
      await supabase
        .from("household_expenses")
        .update({ amount })
        .eq("id", existing.id);
    } else {
      await supabase.from("household_expenses").insert({
        period_id: period.id,
        category,
        amount,
        description: category === "mercado" ? "Mercado del mes" : "Servicios del mes",
      });
    }

    await fetchData();
    setSaving(false);
  }

  async function togglePayment(memberSlug: MemberName, category: string, amountDue: number) {
    if (!period) return;
    const memberObj = members.find((m) => m.slug === memberSlug);
    if (!memberObj) return;

    const existing = payments.find(
      (p) => p.member_id === memberObj.id && p.category === category
    );

    if (existing) {
      await supabase
        .from("payments")
        .update({
          paid: !existing.paid,
          paid_date: !existing.paid ? new Date().toISOString().split("T")[0] : null,
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("payments").insert({
        member_id: memberObj.id,
        period_id: period.id,
        category: category as Payment["category"],
        amount_due: amountDue,
        paid: true,
        paid_date: new Date().toISOString().split("T")[0],
      });
    }

    await fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse">Cargando...</div>
      </div>
    );
  }

  if (!period) return null;

  const expensesByCategory: Record<string, number> = {};
  for (const exp of expenses) {
    expensesByCategory[exp.category] = (expensesByCategory[exp.category] || 0) + exp.amount;
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          📋 Gastos del Hogar
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          {MONTH_NAMES[period.month]} {period.year}
        </p>
      </div>

      {/* Fixed expenses */}
      <div className="space-y-3 mb-6">
        {(["arriendo", "garaje"] as ExpenseCategory[]).map((cat) => {
          const config = CATEGORY_CONFIG[cat];
          const amount = expensesByCategory[cat] || DEFAULT_AMOUNTS[cat] || 0;

          return (
            <div key={cat} className="bg-stone-800 border border-stone-700 rounded-2xl p-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{config.emoji}</span>
                  <span className="font-medium text-stone-200">{config.label}</span>
                  <span className="text-xs text-stone-500 bg-stone-700 px-2 py-0.5 rounded-full">
                    Fijo
                  </span>
                </div>
                <span className="font-display font-bold text-amber-400">
                  {formatCOP(amount)}
                </span>
              </div>

              {/* Share per member */}
              <div className="space-y-2">
                {MEMBERS.map((member) => {
                  const share = calculateShare(amount, cat, member.name);
                  if (share === 0) return null;
                  const memberObj = members.find((m) => m.slug === member.name);
                  const isPaid = payments.some(
                    (p) => p.member_id === memberObj?.id && p.category === cat && p.paid
                  );

                  return (
                    <div key={member.name} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => togglePayment(member.name, cat, share)}
                          className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                            isPaid
                              ? "bg-emerald-500 border-emerald-500"
                              : "border-stone-600 hover:border-amber-500"
                          }`}
                        >
                          {isPaid && (
                            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                            </svg>
                          )}
                        </button>
                        <span className="text-sm text-stone-400">{member.emoji} {member.label}</span>
                      </div>
                      <span className={`text-sm font-medium ${isPaid ? "text-emerald-400" : "text-stone-300"}`}>
                        {formatCOP(share)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      {/* Variable expenses */}
      <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
        Gastos variables
      </h2>

      <div className="space-y-3 mb-6">
        {/* Mercado */}
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">🛒</span>
            <span className="font-medium text-stone-200">Mercado</span>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
              <input
                type="number"
                value={mercadoAmount}
                onChange={(e) => setMercadoAmount(e.target.value)}
                placeholder="950.000"
                className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>
            <button
              onClick={() => saveVariableExpense("mercado", mercadoAmount)}
              disabled={saving || !mercadoAmount}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {saving ? "..." : "Guardar"}
            </button>
          </div>

          {expensesByCategory.mercado && (
            <div className="space-y-2">
              {MEMBERS.map((member) => {
                const share = calculateShare(expensesByCategory.mercado, "mercado", member.name);
                const memberObj = members.find((m) => m.slug === member.name);
                const isPaid = payments.some(
                  (p) => p.member_id === memberObj?.id && p.category === "mercado" && p.paid
                );

                return (
                  <div key={member.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePayment(member.name, "mercado", share)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isPaid
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-stone-600 hover:border-amber-500"
                        }`}
                      >
                        {isPaid && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-stone-400">{member.emoji} {member.label}</span>
                    </div>
                    <span className={`text-sm font-medium ${isPaid ? "text-emerald-400" : "text-stone-300"}`}>
                      {formatCOP(share)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Servicios */}
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4">
          <div className="flex items-center gap-2 mb-3">
            <span className="text-xl">💡</span>
            <span className="font-medium text-stone-200">Servicios</span>
          </div>
          <div className="flex gap-2 mb-3">
            <div className="relative flex-1">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
              <input
                type="number"
                value={serviciosAmount}
                onChange={(e) => setServiciosAmount(e.target.value)}
                placeholder="344.558"
                className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>
            <button
              onClick={() => saveVariableExpense("servicios", serviciosAmount)}
              disabled={saving || !serviciosAmount}
              className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {saving ? "..." : "Guardar"}
            </button>
          </div>

          {expensesByCategory.servicios && (
            <div className="space-y-2">
              {MEMBERS.map((member) => {
                const share = calculateShare(expensesByCategory.servicios, "servicios", member.name);
                const memberObj = members.find((m) => m.slug === member.name);
                const isPaid = payments.some(
                  (p) => p.member_id === memberObj?.id && p.category === "servicios" && p.paid
                );

                return (
                  <div key={member.name} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => togglePayment(member.name, "servicios", share)}
                        className={`w-5 h-5 rounded-md border-2 flex items-center justify-center transition-colors ${
                          isPaid
                            ? "bg-emerald-500 border-emerald-500"
                            : "border-stone-600 hover:border-amber-500"
                        }`}
                      >
                        {isPaid && (
                          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                          </svg>
                        )}
                      </button>
                      <span className="text-sm text-stone-400">{member.emoji} {member.label}</span>
                    </div>
                    <span className={`text-sm font-medium ${isPaid ? "text-emerald-400" : "text-stone-300"}`}>
                      {formatCOP(share)}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
