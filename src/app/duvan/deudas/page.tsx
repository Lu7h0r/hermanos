"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCOP, sortDebtsForPayoff, calculateDebtPlan, estimatePayoffDate } from "@/lib/split-rules";
import { ProgressBar } from "@/components/progress-bar";
import Link from "next/link";
import type { Debt, DebtPayment, DebtConfig, DebtPriority } from "@/lib/types";

const PRIORITY_META: Record<DebtPriority, { label: string; emoji: string; color: string; bgColor: string }> = {
  urgente: { label: "Urgente", emoji: "🔴", color: "text-red-400", bgColor: "bg-red-500/15 border-red-500/30" },
  normal: { label: "Normal", emoji: "🟡", color: "text-amber-400", bgColor: "bg-amber-500/15 border-amber-500/30" },
  tranqui: { label: "Tranqui", emoji: "🟢", color: "text-emerald-400", bgColor: "bg-emerald-500/15 border-emerald-500/30" },
};

export default function DeudasPage() {
  const supabase = createClient();

  const [debts, setDebts] = useState<Debt[]>([]);
  const [payments, setPayments] = useState<DebtPayment[]>([]);
  const [config, setConfig] = useState<DebtConfig | null>(null);
  const [duvanId, setDuvanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  // Form states
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCreditor, setNewCreditor] = useState("");
  const [newAmount, setNewAmount] = useState("");
  const [newPriority, setNewPriority] = useState<DebtPriority>("normal");
  const [newNotes, setNewNotes] = useState("");
  const [saving, setSaving] = useState(false);

  // Payment modal
  const [payingDebt, setPayingDebt] = useState<Debt | null>(null);
  const [payAmount, setPayAmount] = useState("");
  const [payNotes, setPayNotes] = useState("");

  // Budget edit
  const [editingBudget, setEditingBudget] = useState(false);
  const [budgetValue, setBudgetValue] = useState("");

  const fetchData = useCallback(async () => {
    const { data: duvan } = await supabase
      .from("family_members")
      .select("*")
      .eq("slug", "duvan")
      .single();

    if (!duvan) return;
    setDuvanId(duvan.id);

    const [debtsRes, configRes, paymentsRes] = await Promise.all([
      supabase
        .from("debts")
        .select("*")
        .eq("member_id", duvan.id)
        .order("created_at", { ascending: false }),
      supabase
        .from("debt_config")
        .select("*")
        .eq("member_id", duvan.id)
        .single(),
      supabase
        .from("debt_payments")
        .select("*, debts!inner(member_id, creditor_name)")
        .order("date", { ascending: false })
        .limit(20),
    ]);

    setDebts((debtsRes.data as Debt[]) || []);
    setConfig((configRes.data as DebtConfig) || null);

    // Filter payments for Duvan's debts
    const allPayments = (paymentsRes.data || []) as (DebtPayment & { debts: { member_id: string; creditor_name: string } })[];
    const duvanPayments = allPayments.filter((p) => p.debts?.member_id === duvan.id);
    setPayments(duvanPayments as unknown as DebtPayment[]);

    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---

  async function handleAddDebt(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId || !newCreditor.trim() || !newAmount) return;
    setSaving(true);

    const amount = parseInt(newAmount);
    await supabase.from("debts").insert({
      member_id: duvanId,
      creditor_name: newCreditor.trim(),
      original_amount: amount,
      remaining_amount: amount,
      priority: newPriority,
      notes: newNotes.trim() || null,
    });

    setNewCreditor("");
    setNewAmount("");
    setNewPriority("normal");
    setNewNotes("");
    setShowAddForm(false);
    setSaving(false);
    fetchData();
  }

  async function handlePayment(e: React.FormEvent) {
    e.preventDefault();
    if (!payingDebt || !payAmount) return;
    setSaving(true);

    const amount = Math.min(parseInt(payAmount), payingDebt.remaining_amount);
    const newRemaining = payingDebt.remaining_amount - amount;
    const isPaidOff = newRemaining <= 0;

    await Promise.all([
      supabase.from("debt_payments").insert({
        debt_id: payingDebt.id,
        amount,
        date: new Date().toISOString().split("T")[0],
        notes: payNotes.trim() || null,
      }),
      supabase
        .from("debts")
        .update({
          remaining_amount: Math.max(0, newRemaining),
          is_paid_off: isPaidOff,
          paid_off_date: isPaidOff ? new Date().toISOString().split("T")[0] : null,
        })
        .eq("id", payingDebt.id),
    ]);

    setPayingDebt(null);
    setPayAmount("");
    setPayNotes("");
    setSaving(false);
    fetchData();
  }

  async function handleSaveBudget() {
    if (!duvanId) return;
    setSaving(true);
    const amount = parseInt(budgetValue) || 0;

    if (config) {
      await supabase
        .from("debt_config")
        .update({ monthly_budget: amount, updated_at: new Date().toISOString() })
        .eq("member_id", duvanId);
    } else {
      await supabase.from("debt_config").insert({
        member_id: duvanId,
        monthly_budget: amount,
      });
    }

    setEditingBudget(false);
    setSaving(false);
    fetchData();
  }

  async function handleDeleteDebt(debtId: string) {
    if (!confirm("Seguro que quieres eliminar esta deuda?")) return;
    await supabase.from("debts").delete().eq("id", debtId);
    fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse">Cargando...</div>
      </div>
    );
  }

  // --- Computed ---
  const activeDebts = debts.filter((d) => !d.is_paid_off);
  const paidDebts = debts.filter((d) => d.is_paid_off);
  const totalOriginal = debts.reduce((s, d) => s + d.original_amount, 0);
  const totalRemaining = activeDebts.reduce((s, d) => s + d.remaining_amount, 0);
  const totalPaid = totalOriginal - totalRemaining - paidDebts.reduce((s, d) => s + d.original_amount, 0) + paidDebts.reduce((s, d) => s + d.original_amount, 0);
  const totalAbonado = debts.reduce((s, d) => s + (d.original_amount - d.remaining_amount), 0);
  const monthlyBudget = config?.monthly_budget || 0;
  const plan = calculateDebtPlan(activeDebts, monthlyBudget);
  const payoffDate = estimatePayoffDate(activeDebts, monthlyBudget);

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <Link href="/duvan" className="text-stone-500 text-sm hover:text-amber-400 transition-colors">
            &larr; Panel Duvan
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight mt-1">
            Deudas
          </h1>
        </div>
        <button
          onClick={() => setShowAddForm(!showAddForm)}
          className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold rounded-xl px-4 py-2 text-sm transition-colors"
        >
          + Agregar
        </button>
      </div>

      {/* Add Debt Form */}
      {showAddForm && (
        <form onSubmit={handleAddDebt} className="bg-stone-800 border border-stone-700 rounded-2xl p-5 mb-6 space-y-4">
          <h3 className="font-display font-semibold text-stone-200">Nueva deuda</h3>

          <div>
            <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">A quien le debes?</label>
            <input
              type="text"
              value={newCreditor}
              onChange={(e) => setNewCreditor(e.target.value)}
              placeholder="Nombre del acreedor"
              required
              className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Cuanto le debes?</label>
            <input
              type="number"
              value={newAmount}
              onChange={(e) => setNewAmount(e.target.value)}
              placeholder="Monto en COP"
              required
              min={1}
              className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div>
            <label className="text-xs text-stone-400 uppercase tracking-wide block mb-2">Que tan urgente es?</label>
            <div className="grid grid-cols-3 gap-2">
              {(["urgente", "normal", "tranqui"] as DebtPriority[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setNewPriority(p)}
                  className={`rounded-xl border py-3 text-center text-sm font-medium transition-all ${
                    newPriority === p
                      ? PRIORITY_META[p].bgColor + " " + PRIORITY_META[p].color
                      : "bg-stone-900 border-stone-700 text-stone-400 hover:border-stone-600"
                  }`}
                >
                  <span className="block text-lg mb-0.5">{PRIORITY_META[p].emoji}</span>
                  {PRIORITY_META[p].label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Notas (opcional)</label>
            <input
              type="text"
              value={newNotes}
              onChange={(e) => setNewNotes(e.target.value)}
              placeholder="Contexto adicional..."
              className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none transition-colors"
            />
          </div>

          <div className="flex gap-3">
            <button
              type="submit"
              disabled={saving}
              className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors"
            >
              {saving ? "Guardando..." : "Guardar deuda"}
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm(false)}
              className="px-4 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl py-3 text-sm transition-colors"
            >
              Cancelar
            </button>
          </div>
        </form>
      )}

      {/* Summary */}
      {debts.length > 0 && (
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide">Deuda total pendiente</p>
              <p className="font-display text-3xl font-bold text-red-400">{formatCOP(totalRemaining)}</p>
            </div>
            {paidDebts.length > 0 && (
              <div className="text-right">
                <p className="text-xs text-emerald-400">{paidDebts.length} pagada{paidDebts.length > 1 ? "s" : ""}</p>
                <p className="text-xs text-stone-500">{activeDebts.length} pendiente{activeDebts.length !== 1 ? "s" : ""}</p>
              </div>
            )}
          </div>

          <ProgressBar
            current={totalAbonado}
            total={totalOriginal}
            label="Progreso total"
            formatFn={formatCOP}
            variant="emerald"
          />

          {/* Monthly budget */}
          <div className="mt-4 pt-4 border-t border-stone-700">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-xs text-stone-400 uppercase tracking-wide">Presupuesto mensual</p>
                {editingBudget ? (
                  <div className="flex items-center gap-2 mt-1">
                    <input
                      type="number"
                      value={budgetValue}
                      onChange={(e) => setBudgetValue(e.target.value)}
                      placeholder="$ mensual"
                      min={0}
                      className="w-36 bg-stone-900 border border-stone-600 rounded-lg px-3 py-1.5 text-sm text-stone-100 focus:border-amber-500 focus:outline-none"
                      autoFocus
                    />
                    <button
                      onClick={handleSaveBudget}
                      disabled={saving}
                      className="bg-amber-500 text-stone-950 rounded-lg px-3 py-1.5 text-sm font-medium"
                    >
                      OK
                    </button>
                    <button
                      onClick={() => setEditingBudget(false)}
                      className="text-stone-500 text-sm"
                    >
                      X
                    </button>
                  </div>
                ) : (
                  <p className="font-display text-xl font-bold text-amber-400">
                    {monthlyBudget > 0 ? formatCOP(monthlyBudget) : "Sin definir"}
                  </p>
                )}
              </div>
              {!editingBudget && (
                <button
                  onClick={() => {
                    setBudgetValue(monthlyBudget.toString());
                    setEditingBudget(true);
                  }}
                  className="text-xs text-amber-400 hover:text-amber-300 transition-colors"
                >
                  Editar
                </button>
              )}
            </div>
          </div>

          {/* Payoff estimate */}
          {payoffDate && monthlyBudget > 0 && (
            <div className="mt-3 bg-emerald-500/10 border border-emerald-500/20 rounded-xl p-3 text-center">
              <p className="text-xs text-emerald-400 uppercase tracking-wide">Libre de deudas</p>
              <p className="font-display text-lg font-bold text-emerald-400">
                {payoffDate.toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
              </p>
              <p className="text-xs text-stone-500 mt-0.5">
                ~{Math.ceil(totalRemaining / monthlyBudget)} meses con {formatCOP(monthlyBudget)}/mes
              </p>
            </div>
          )}

          {monthlyBudget === 0 && activeDebts.length > 0 && (
            <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 text-center">
              <p className="text-xs text-amber-400">Define tu presupuesto mensual para ver el plan de pago</p>
            </div>
          )}
        </div>
      )}

      {/* Debt list - ordered by plan */}
      {activeDebts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
            Plan de pago {monthlyBudget > 0 ? "(Snowball)" : ""}
          </h2>
          <div className="space-y-3">
            {(monthlyBudget > 0 ? plan : sortDebtsForPayoff(activeDebts).map((d) => ({ debt: d, monthlySuggested: 0, estimatedPayoffDate: new Date(), monthsToPayoff: 0 }))).map(
              (item, idx) => {
                const meta = PRIORITY_META[item.debt.priority];
                const progress = item.debt.original_amount - item.debt.remaining_amount;
                const isFocused = idx === 0 && monthlyBudget > 0;

                return (
                  <div
                    key={item.debt.id}
                    className={`bg-stone-800 border rounded-2xl p-4 transition-all ${
                      isFocused ? "border-amber-500/50 ring-1 ring-amber-500/20" : "border-stone-700"
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        {isFocused && (
                          <span className="text-xs bg-amber-500/20 text-amber-400 px-2 py-0.5 rounded-full font-medium">
                            FOCO
                          </span>
                        )}
                        <span className={`text-xs px-2 py-0.5 rounded-full border font-medium ${meta.bgColor} ${meta.color}`}>
                          {meta.emoji} {meta.label}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteDebt(item.debt.id)}
                        className="text-stone-600 hover:text-red-400 text-xs transition-colors"
                        title="Eliminar"
                      >
                        Eliminar
                      </button>
                    </div>

                    <p className="font-medium text-stone-100 text-lg">{item.debt.creditor_name}</p>

                    {item.debt.notes && (
                      <p className="text-xs text-stone-500 mt-0.5">{item.debt.notes}</p>
                    )}

                    <div className="mt-3">
                      <ProgressBar
                        current={progress}
                        total={item.debt.original_amount}
                        formatFn={formatCOP}
                        variant="emerald"
                      />
                    </div>

                    <div className="flex items-center justify-between mt-3">
                      <div>
                        <p className="text-sm text-stone-300">
                          Falta: <span className="font-semibold text-red-400">{formatCOP(item.debt.remaining_amount)}</span>
                        </p>
                        {item.monthlySuggested > 0 && (
                          <p className="text-xs text-stone-500">
                            Cuota sugerida: {formatCOP(item.monthlySuggested)}/mes
                            {" "}~{item.monthsToPayoff} mes{item.monthsToPayoff > 1 ? "es" : ""}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => {
                          setPayingDebt(item.debt);
                          setPayAmount("");
                          setPayNotes("");
                        }}
                        className="bg-emerald-500 hover:bg-emerald-600 text-stone-950 font-semibold rounded-xl px-4 py-2 text-sm transition-colors"
                      >
                        Abonar
                      </button>
                    </div>
                  </div>
                );
              }
            )}
          </div>
        </div>
      )}

      {/* Empty state */}
      {debts.length === 0 && (
        <div className="text-center py-16">
          <div className="text-5xl mb-4">🎯</div>
          <p className="text-stone-300 font-medium text-lg">Sin deudas registradas</p>
          <p className="text-stone-500 text-sm mt-1">Agrega tus deudas para crear un plan de pago inteligente</p>
          <button
            onClick={() => setShowAddForm(true)}
            className="mt-4 bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
          >
            + Agregar primera deuda
          </button>
        </div>
      )}

      {/* Paid off debts */}
      {paidDebts.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
            Deudas liquidadas
          </h2>
          <div className="space-y-2">
            {paidDebts.map((debt) => (
              <div
                key={debt.id}
                className="bg-emerald-500/5 border border-emerald-500/20 rounded-xl p-3 flex items-center justify-between"
              >
                <div>
                  <p className="text-sm text-stone-300 line-through">{debt.creditor_name}</p>
                  <p className="text-xs text-emerald-400">
                    {formatCOP(debt.original_amount)} - Pagada
                    {debt.paid_off_date && ` el ${new Date(debt.paid_off_date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short" })}`}
                  </p>
                </div>
                <span className="text-2xl">🎉</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Payment history */}
      {payments.length > 0 && (
        <div className="mb-6">
          <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
            Historial de abonos
          </h2>
          <div className="space-y-2">
            {payments.map((p) => {
              const debtInfo = debts.find((d) => d.id === p.debt_id);
              return (
                <div
                  key={p.id}
                  className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-3 flex items-center justify-between"
                >
                  <div>
                    <p className="text-sm text-stone-300">
                      {debtInfo?.creditor_name || "Deuda eliminada"}
                    </p>
                    <p className="text-xs text-stone-500">
                      {new Date(p.date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      {p.notes && ` - ${p.notes}`}
                    </p>
                  </div>
                  <p className="font-medium text-emerald-400 text-sm">
                    -{formatCOP(p.amount)}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Payment modal overlay */}
      {payingDebt && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-end sm:items-center justify-center p-4">
          <form
            onSubmit={handlePayment}
            className="bg-stone-800 border border-stone-700 rounded-2xl p-6 w-full max-w-md space-y-4"
          >
            <h3 className="font-display font-semibold text-stone-200 text-lg">
              Abonar a {payingDebt.creditor_name}
            </h3>
            <p className="text-sm text-stone-400">
              Pendiente: <span className="text-red-400 font-semibold">{formatCOP(payingDebt.remaining_amount)}</span>
            </p>

            <div>
              <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Monto del abono</label>
              <input
                type="number"
                value={payAmount}
                onChange={(e) => setPayAmount(e.target.value)}
                placeholder="Cuanto vas a abonar?"
                required
                min={1}
                max={payingDebt.remaining_amount}
                autoFocus
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-emerald-500 focus:outline-none transition-colors"
              />
              {payAmount && parseInt(payAmount) === payingDebt.remaining_amount && (
                <p className="text-xs text-emerald-400 mt-1">Pagas el total! Esta deuda queda liquidada</p>
              )}
            </div>

            <div>
              <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Nota (opcional)</label>
              <input
                type="text"
                value={payNotes}
                onChange={(e) => setPayNotes(e.target.value)}
                placeholder="Ej: transferencia, efectivo..."
                className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-emerald-500 focus:outline-none transition-colors"
              />
            </div>

            {/* Quick amounts */}
            <div className="flex gap-2 flex-wrap">
              {[50000, 100000, payingDebt.remaining_amount].map((amt, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => setPayAmount(amt.toString())}
                  className="bg-stone-700 hover:bg-stone-600 text-stone-300 text-xs rounded-lg px-3 py-1.5 transition-colors"
                >
                  {i === 2 ? "Todo" : formatCOP(amt)}
                </button>
              ))}
            </div>

            <div className="flex gap-3 pt-2">
              <button
                type="submit"
                disabled={saving || !payAmount}
                className="flex-1 bg-emerald-500 hover:bg-emerald-600 disabled:opacity-50 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors"
              >
                {saving ? "Procesando..." : "Confirmar abono"}
              </button>
              <button
                type="button"
                onClick={() => setPayingDebt(null)}
                className="px-4 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl py-3 text-sm transition-colors"
              >
                Cancelar
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
