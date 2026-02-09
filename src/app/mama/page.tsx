"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { ProgressBar } from "@/components/progress-bar";
import { MemberBadge } from "@/components/member-badge";
import {
  calculateShare,
  formatCOP,
  MEMBERS,
  type MemberName,
} from "@/lib/split-rules";
import type { MonthlyPeriod, Payment, FamilyMember } from "@/lib/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function MamaPage() {
  const supabase = createClient();
  const [period, setPeriod] = useState<MonthlyPeriod | null>(null);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [allPeriods, setAllPeriods] = useState<MonthlyPeriod[]>([]);
  const [allPayments, setAllPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const [pRes, memRes, allPRes] = await Promise.all([
      supabase.from("monthly_periods").select("*").eq("year", year).eq("month", month).single(),
      supabase.from("family_members").select("*").order("created_at"),
      supabase.from("monthly_periods").select("*").order("year", { ascending: false }).order("month", { ascending: false }).limit(12),
    ]);

    const p = pRes.data;
    setMembers(memRes.data || []);
    setAllPeriods(allPRes.data || []);

    if (p) {
      setPeriod(p);
      const { data: payData } = await supabase
        .from("payments")
        .select("*")
        .eq("period_id", p.id)
        .eq("category", "mama_fund");
      setPayments(payData || []);

      // Get all mama_fund payments for history
      const periodIds = (allPRes.data || []).map((per) => per.id);
      if (periodIds.length > 0) {
        const { data: allPayData } = await supabase
          .from("payments")
          .select("*")
          .in("period_id", periodIds)
          .eq("category", "mama_fund");
        setAllPayments(allPayData || []);
      }
    }

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function togglePayment(memberSlug: MemberName) {
    if (!period) return;
    const memberObj = members.find((m) => m.slug === memberSlug);
    if (!memberObj) return;

    const amountDue = calculateShare(period.mama_fund_goal, "mama_fund", memberSlug);
    const existing = payments.find((p) => p.member_id === memberObj.id);

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
        category: "mama_fund" as const,
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

  const goal = period.mama_fund_goal;
  const totalCollected = payments.filter((p) => p.paid).reduce((sum, p) => sum + p.amount_due, 0);

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          ❤️ Fondo Mamá
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          {MONTH_NAMES[period.month]} {period.year}
        </p>
      </div>

      {/* Main card */}
      <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5 mb-6">
        <div className="text-center mb-4">
          <div className="text-4xl mb-2">❤️</div>
          <p className="text-stone-400 text-sm">Meta mensual para Mamá</p>
          <p className="font-display text-3xl font-bold text-amber-400 mt-1">
            {formatCOP(goal)}
          </p>
        </div>

        <ProgressBar
          current={totalCollected}
          total={goal}
          variant="emerald"
        />

        <div className="mt-4 text-center">
          {totalCollected >= goal ? (
            <p className="text-emerald-400 font-medium">
              Meta cumplida este mes
            </p>
          ) : (
            <p className="text-stone-400 text-sm">
              Faltan {formatCOP(goal - totalCollected)}
            </p>
          )}
        </div>
      </div>

      {/* Per member contributions */}
      <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
        Aportes del mes
      </h2>

      <div className="space-y-3 mb-8">
        {MEMBERS.map((member) => {
          const share = calculateShare(goal, "mama_fund", member.name);
          const memberObj = members.find((m) => m.slug === member.name);
          const payment = payments.find((p) => p.member_id === memberObj?.id);
          const isPaid = payment?.paid || false;

          return (
            <div
              key={member.name}
              className={`bg-stone-800 border rounded-2xl p-4 transition-colors ${
                isPaid ? "border-emerald-500/40" : "border-stone-700"
              }`}
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => togglePayment(member.name)}
                    className={`w-6 h-6 rounded-lg border-2 flex items-center justify-center transition-all ${
                      isPaid
                        ? "bg-emerald-500 border-emerald-500"
                        : "border-stone-600 hover:border-amber-500"
                    }`}
                  >
                    {isPaid && (
                      <svg className="w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </button>
                  <MemberBadge name={member.name} size="sm" />
                </div>
                <div className="text-right">
                  <p className={`font-display font-bold text-lg ${isPaid ? "text-emerald-400" : "text-stone-50"}`}>
                    {formatCOP(share)}
                  </p>
                  {isPaid && (
                    <span className="text-xs text-emerald-500">Pagado</span>
                  )}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* History */}
      {allPeriods.length > 1 && (
        <>
          <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
            Historial
          </h2>
          <div className="space-y-2">
            {allPeriods
              .filter((p) => p.id !== period.id)
              .map((p) => {
                const pPayments = allPayments.filter(
                  (pay) => pay.period_id === p.id && pay.paid
                );
                const collected = pPayments.reduce((sum, pay) => sum + pay.amount_due, 0);

                return (
                  <div key={p.id} className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-3 flex items-center justify-between">
                    <span className="text-sm text-stone-400">
                      {MONTH_NAMES[p.month]} {p.year}
                    </span>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-stone-300">
                        {formatCOP(collected)} / {formatCOP(p.mama_fund_goal)}
                      </span>
                      {collected >= p.mama_fund_goal && (
                        <span className="text-emerald-400 text-sm">✓</span>
                      )}
                    </div>
                  </div>
                );
              })}
          </div>
        </>
      )}
    </div>
  );
}
