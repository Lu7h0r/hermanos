"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/stat-card";
import { ProgressBar } from "@/components/progress-bar";
import { formatCOP } from "@/lib/split-rules";
import Link from "next/link";
import type { MotoMaintenance, MotoKmLog, MotoConfig, MotoSavingsGoal } from "@/lib/types";

// --- Constants ---

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  oil: { label: "Aceite", emoji: "🛢️" },
  tire_front: { label: "Llanta delantera", emoji: "🔵" },
  tire_rear: { label: "Llanta trasera", emoji: "🔴" },
  brakes: { label: "Pastillas de freno", emoji: "🛑" },
  chain: { label: "Cadena", emoji: "⛓️" },
  other: { label: "Otro", emoji: "🔧" },
};

const DEFAULT_INTERVALS_KM: Record<string, number> = {
  oil: 3000,
  brakes: 8000,
  chain: 15000,
  tire_front: 20000,
  tire_rear: 15000,
};

// Pre-loaded savings goals with known costs
const DEFAULT_SAVINGS_GOALS = [
  { name: "Cambio de aceite (sin filtro)", category: "oil" as const, target_amount: 70000, interval_months: 2 },
  { name: "Filtro de aceite", category: "oil_filter" as const, target_amount: 0, interval_months: 4 },
  { name: "Pastillas freno delanteras", category: "brakes_front" as const, target_amount: 35000, interval_months: 3 },
  { name: "Bandas freno traseras", category: "brakes_rear" as const, target_amount: 0, interval_months: 6 },
  { name: "Llanta delantera (Michelin Pilot Street)", category: "tire_front" as const, target_amount: 290000, interval_months: 12 },
  { name: "Llanta trasera (Michelin Pilot Street)", category: "tire_rear" as const, target_amount: 399000, interval_months: 12 },
  { name: "SOAT", category: "soat" as const, target_amount: 343300, interval_months: 12 },
  { name: "Tecnomecánica", category: "tecno" as const, target_amount: 248000, interval_months: 12 },
  { name: "Líquido de frenos", category: "brake_fluid" as const, target_amount: 0, interval_months: 12 },
  { name: "Líquido refrigerante", category: "coolant" as const, target_amount: 0, interval_months: 12 },
  { name: "Mantenimiento fuerte", category: "heavy_maintenance" as const, target_amount: 0, interval_months: 8 },
];

const CATEGORY_EMOJI: Record<string, string> = {
  oil: "🛢️", oil_filter: "🔄", brakes_front: "🛑", brakes_rear: "🛑",
  tire_front: "🔵", tire_rear: "🔴", soat: "📋", tecno: "🔍",
  brake_fluid: "💧", coolant: "❄️", heavy_maintenance: "🔩", other: "🔧",
};

type Tab = "bolsillo" | "config" | "historial";

export default function MotoPage() {
  const supabase = createClient();

  const [maintenance, setMaintenance] = useState<MotoMaintenance[]>([]);
  const [latestKm, setLatestKm] = useState<MotoKmLog | null>(null);
  const [config, setConfig] = useState<MotoConfig | null>(null);
  const [goals, setGoals] = useState<MotoSavingsGoal[]>([]);
  const [duvanId, setDuvanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeTab, setActiveTab] = useState<Tab>("bolsillo");

  // Config form
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [cfgRegDate, setCfgRegDate] = useState("");
  const [cfgPayment, setCfgPayment] = useState("");
  const [cfgMissed, setCfgMissed] = useState("");
  const [cfgSoatDate, setCfgSoatDate] = useState("");
  const [cfgTecnoDate, setCfgTecnoDate] = useState("");

  // Maintenance form
  const [showMaintForm, setShowMaintForm] = useState(false);
  const [mDate, setMDate] = useState(new Date().toISOString().split("T")[0]);
  const [mType, setMType] = useState("oil");
  const [mCost, setMCost] = useState("");
  const [mKm, setMKm] = useState("");
  const [mNextKm, setMNextKm] = useState("");
  const [mDesc, setMDesc] = useState("");

  // KM form
  const [showKmForm, setShowKmForm] = useState(false);
  const [newKm, setNewKm] = useState("");

  // Add savings to goal
  const [savingGoalId, setSavingGoalId] = useState<string | null>(null);
  const [saveAmount, setSaveAmount] = useState("");

  // Edit goal target
  const [editGoalId, setEditGoalId] = useState<string | null>(null);
  const [editGoalAmount, setEditGoalAmount] = useState("");

  const fetchData = useCallback(async () => {
    const { data: duvan } = await supabase
      .from("family_members")
      .select("*")
      .eq("slug", "duvan")
      .single();

    if (!duvan) return;
    setDuvanId(duvan.id);

    const [maintRes, kmRes, configRes, goalsRes] = await Promise.all([
      supabase.from("moto_maintenance").select("*").eq("member_id", duvan.id).order("date", { ascending: false }),
      supabase.from("moto_km_log").select("*").eq("member_id", duvan.id).order("date", { ascending: false }).limit(1),
      supabase.from("moto_config").select("*").eq("member_id", duvan.id).single(),
      supabase.from("moto_savings_goals").select("*").eq("member_id", duvan.id).eq("is_active", true).order("created_at", { ascending: true }),
    ]);

    setMaintenance(maintRes.data || []);
    setLatestKm(kmRes.data?.[0] || null);
    setConfig((configRes.data as MotoConfig) || null);
    setGoals((goalsRes.data as MotoSavingsGoal[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // --- Handlers ---

  async function handleSaveConfig(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId) return;
    setSaving(true);

    const payload = {
      member_id: duvanId,
      registration_date: cfgRegDate || null,
      monthly_payment: parseInt(cfgPayment) || 0,
      missed_payments: parseInt(cfgMissed) || 0,
      soat_due_date: cfgSoatDate || null,
      tecno_due_date: cfgTecnoDate || null,
      updated_at: new Date().toISOString(),
    };

    if (config) {
      await supabase.from("moto_config").update(payload).eq("member_id", duvanId);
    } else {
      await supabase.from("moto_config").insert(payload);
    }

    setShowConfigForm(false);
    setSaving(false);
    fetchData();
  }

  async function handleInitGoals() {
    if (!duvanId) return;
    setSaving(true);

    const inserts = DEFAULT_SAVINGS_GOALS.map((g) => ({
      member_id: duvanId,
      name: g.name,
      category: g.category,
      target_amount: g.target_amount || 1, // Placeholder 1 for unknown costs
      interval_months: g.interval_months,
      is_active: true,
      notes: g.target_amount === 0 ? "Costo por definir - edita el valor" : null,
    }));

    await supabase.from("moto_savings_goals").insert(inserts);
    setSaving(false);
    fetchData();
  }

  async function handleAddSavings(goalId: string) {
    if (!saveAmount) return;
    setSaving(true);
    const goal = goals.find((g) => g.id === goalId);
    if (!goal) return;

    const newSaved = goal.saved_amount + parseInt(saveAmount);
    await supabase.from("moto_savings_goals").update({ saved_amount: newSaved }).eq("id", goalId);

    setSavingGoalId(null);
    setSaveAmount("");
    setSaving(false);
    fetchData();
  }

  async function handleUpdateGoalTarget(goalId: string) {
    if (!editGoalAmount) return;
    setSaving(true);
    await supabase.from("moto_savings_goals").update({ target_amount: parseInt(editGoalAmount) }).eq("id", goalId);
    setEditGoalId(null);
    setEditGoalAmount("");
    setSaving(false);
    fetchData();
  }

  async function handleResetGoal(goalId: string) {
    setSaving(true);
    await supabase.from("moto_savings_goals").update({
      saved_amount: 0,
      last_done_date: new Date().toISOString().split("T")[0],
    }).eq("id", goalId);
    setSaving(false);
    fetchData();
  }

  async function handleMaintenanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId || !mCost) return;
    setSaving(true);

    const kmAtService = mKm ? parseInt(mKm) : null;
    let nextServiceKm = mNextKm ? parseInt(mNextKm) : null;
    if (kmAtService && !nextServiceKm && DEFAULT_INTERVALS_KM[mType]) {
      nextServiceKm = kmAtService + DEFAULT_INTERVALS_KM[mType];
    }

    await supabase.from("moto_maintenance").insert({
      member_id: duvanId,
      date: mDate,
      type: mType as MotoMaintenance["type"],
      cost: parseInt(mCost),
      km_at_service: kmAtService,
      next_service_km: nextServiceKm,
      description: mDesc || null,
    });

    if (kmAtService) {
      await supabase.from("moto_km_log").insert({
        member_id: duvanId, date: mDate, km_reading: kmAtService,
      });
    }

    setMCost(""); setMKm(""); setMNextKm(""); setMDesc("");
    setShowMaintForm(false);
    setSaving(false);
    fetchData();
  }

  async function saveKm(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId || !newKm) return;
    setSaving(true);
    await supabase.from("moto_km_log").insert({
      member_id: duvanId,
      date: new Date().toISOString().split("T")[0],
      km_reading: parseInt(newKm),
    });
    setNewKm(""); setShowKmForm(false);
    setSaving(false);
    fetchData();
  }

  async function deleteMaintenance(id: string) {
    await supabase.from("moto_maintenance").delete().eq("id", id);
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
  const currentKm = latestKm?.km_reading || 0;

  // Monthly amortization
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentMaint = maintenance.filter((m) => new Date(m.date) >= oneYearAgo);
  const totalMaintCost = recentMaint.reduce((s, m) => s + m.cost, 0);
  const monthlyAmort = Math.round(totalMaintCost / 12);

  // Bolsillo totals
  const totalNeededMonthly = goals.reduce((s, g) => {
    if (g.target_amount <= 1) return s; // unknown cost
    return s + Math.round(g.target_amount / g.interval_months);
  }, 0);

  const totalSaved = goals.reduce((s, g) => s + g.saved_amount, 0);
  const totalTarget = goals.reduce((s, g) => s + g.target_amount, 0);

  // SOAT/Tecno alerts
  const today = new Date();
  const soatDaysLeft = config?.soat_due_date
    ? Math.ceil((new Date(config.soat_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;
  const tecnoDaysLeft = config?.tecno_due_date
    ? Math.ceil((new Date(config.tecno_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24))
    : null;

  // Service alerts by KM
  const kmAlerts: { type: string; label: string; emoji: string; kmLeft: number }[] = [];
  for (const m of maintenance) {
    if (m.next_service_km && currentKm > 0) {
      const kmLeft = m.next_service_km - currentKm;
      if (kmLeft < 500 && kmLeft > -1000) {
        const typeInfo = TYPE_LABELS[m.type] || TYPE_LABELS.other;
        if (!kmAlerts.find((a) => a.type === m.type)) {
          kmAlerts.push({ type: m.type, ...typeInfo, kmLeft });
        }
      }
    }
  }

  // Cuota moto
  const motoDebt = config ? config.monthly_payment * config.missed_payments : 0;

  return (
    <div className="px-4 pt-6 pb-28 max-w-lg mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div>
          <Link href="/duvan" className="text-stone-500 text-sm hover:text-amber-400 transition-colors">
            &larr; Panel Duvan
          </Link>
          <h1 className="font-display text-2xl font-bold tracking-tight mt-1">
            Moto
          </h1>
          <div className="flex items-center gap-3 mt-1">
            <p className="text-stone-400 text-sm">
              {currentKm > 0 ? `${currentKm.toLocaleString("es-CO")} km` : "Sin registro KM"}
            </p>
            <button onClick={() => setShowKmForm(!showKmForm)} className="text-xs text-amber-400 hover:text-amber-300">
              {showKmForm ? "Cancelar" : "Actualizar KM"}
            </button>
          </div>
        </div>
      </div>

      {/* KM form */}
      {showKmForm && (
        <form onSubmit={saveKm} className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-4 flex gap-2">
          <input type="number" value={newKm} onChange={(e) => setNewKm(e.target.value)} placeholder="Kilometraje actual"
            className="flex-1 px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm" />
          <button type="submit" disabled={saving || !newKm}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm disabled:opacity-50">
            Guardar
          </button>
        </form>
      )}

      {/* Cuota moto + alerts */}
      {config && config.monthly_payment > 0 && (
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-xs text-stone-400 uppercase tracking-wide">Cuota mensual moto</p>
              <p className="font-display text-xl font-bold text-amber-400">{formatCOP(config.monthly_payment)}</p>
            </div>
            {config.missed_payments > 0 && (
              <div className="text-right">
                <p className="text-xs text-red-400">{config.missed_payments} cuota{config.missed_payments > 1 ? "s" : ""} atrasada{config.missed_payments > 1 ? "s" : ""}</p>
                <p className="font-semibold text-red-400 text-sm">{formatCOP(motoDebt)}</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SOAT/Tecno alerts */}
      {(soatDaysLeft !== null || tecnoDaysLeft !== null) && (
        <div className="grid grid-cols-2 gap-3 mb-4">
          {soatDaysLeft !== null && (
            <div className={`rounded-2xl border p-3 ${soatDaysLeft <= 30 ? "bg-red-500/10 border-red-500/30" : soatDaysLeft <= 60 ? "bg-amber-500/10 border-amber-500/30" : "bg-stone-800 border-stone-700"}`}>
              <p className="text-xs text-stone-400">SOAT</p>
              <p className={`font-display text-lg font-bold ${soatDaysLeft <= 30 ? "text-red-400" : soatDaysLeft <= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                {soatDaysLeft <= 0 ? "VENCIDO" : `${soatDaysLeft} días`}
              </p>
              <p className="text-xs text-stone-500">{formatCOP(config?.soat_cost || 343300)}</p>
            </div>
          )}
          {tecnoDaysLeft !== null && (
            <div className={`rounded-2xl border p-3 ${tecnoDaysLeft <= 30 ? "bg-red-500/10 border-red-500/30" : tecnoDaysLeft <= 60 ? "bg-amber-500/10 border-amber-500/30" : "bg-stone-800 border-stone-700"}`}>
              <p className="text-xs text-stone-400">Tecnomecánica</p>
              <p className={`font-display text-lg font-bold ${tecnoDaysLeft <= 30 ? "text-red-400" : tecnoDaysLeft <= 60 ? "text-amber-400" : "text-emerald-400"}`}>
                {tecnoDaysLeft <= 0 ? "VENCIDA" : `${tecnoDaysLeft} días`}
              </p>
              <p className="text-xs text-stone-500">{formatCOP(config?.tecno_cost || 248000)}</p>
            </div>
          )}
        </div>
      )}

      {/* KM Alerts */}
      {kmAlerts.length > 0 && (
        <div className="space-y-2 mb-4">
          {kmAlerts.map((alert) => (
            <div key={alert.type} className={`border rounded-2xl p-3 flex items-center gap-3 ${alert.kmLeft <= 0 ? "bg-red-500/10 border-red-500/30" : "bg-amber-500/10 border-amber-500/30"}`}>
              <span className="text-xl">{alert.emoji}</span>
              <div>
                <p className="font-medium text-stone-200 text-sm">{alert.label}</p>
                <p className={`text-xs ${alert.kmLeft <= 0 ? "text-red-400" : "text-amber-400"}`}>
                  {alert.kmLeft <= 0 ? `Pasado por ${Math.abs(alert.kmLeft).toLocaleString("es-CO")} km` : `Faltan ~${alert.kmLeft.toLocaleString("es-CO")} km`}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-4">
        <StatCard label="Amortización/mes" value={formatCOP(monthlyAmort)} emoji="📉" variant="accent" />
        <StatCard label="Guardar/mes" value={formatCOP(totalNeededMonthly)} emoji="🐷" sublabel={`${formatCOP(Math.round(totalNeededMonthly / 4))}/semana`} variant="success" />
      </div>

      {/* Tabs */}
      <div className="flex bg-stone-800 border border-stone-700 rounded-xl p-1 mb-4">
        {([
          { id: "bolsillo" as Tab, label: "Bolsillo", emoji: "🐷" },
          { id: "config" as Tab, label: "Config", emoji: "⚙️" },
          { id: "historial" as Tab, label: "Historial", emoji: "📋" },
        ]).map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-colors ${activeTab === tab.id ? "bg-amber-500/20 text-amber-400" : "text-stone-400 hover:text-stone-300"}`}
          >
            {tab.emoji} {tab.label}
          </button>
        ))}
      </div>

      {/* === TAB: BOLSILLO === */}
      {activeTab === "bolsillo" && (
        <div>
          {goals.length === 0 ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">🐷</div>
              <p className="text-stone-300 font-medium">Sin metas de ahorro</p>
              <p className="text-stone-500 text-sm mt-1 mb-4">Carga las metas predefinidas para empezar a planificar</p>
              <button
                onClick={handleInitGoals}
                disabled={saving}
                className="bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold rounded-xl px-6 py-3 text-sm transition-colors"
              >
                {saving ? "Cargando..." : "Cargar metas de mantenimiento"}
              </button>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Total progress */}
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-2">
                <ProgressBar current={totalSaved} total={totalTarget} label="Ahorro total" formatFn={formatCOP} variant="emerald" />
                <p className="text-xs text-stone-500 mt-2">
                  Necesitas guardar <span className="text-amber-400 font-medium">{formatCOP(totalNeededMonthly)}/mes</span> ({formatCOP(Math.round(totalNeededMonthly / 4))}/semana) para cubrir todo
                </p>
              </div>

              {goals.map((goal) => {
                const emoji = CATEGORY_EMOJI[goal.category] || "🔧";
                const monthlyNeeded = goal.target_amount > 1 ? Math.round(goal.target_amount / goal.interval_months) : 0;
                const weeklyNeeded = Math.round(monthlyNeeded / 4);
                const isUnknownCost = goal.target_amount <= 1;
                const progress = isUnknownCost ? 0 : Math.min((goal.saved_amount / goal.target_amount) * 100, 100);
                const isComplete = goal.saved_amount >= goal.target_amount && !isUnknownCost;

                // Days until due
                let daysUntilDue: number | null = null;
                if (goal.next_due_date) {
                  daysUntilDue = Math.ceil((new Date(goal.next_due_date).getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
                }

                return (
                  <div key={goal.id} className={`bg-stone-800 border rounded-2xl p-4 ${isComplete ? "border-emerald-500/30" : isUnknownCost ? "border-amber-500/30" : "border-stone-700"}`}>
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{emoji}</span>
                        <div>
                          <p className="font-medium text-stone-200 text-sm">{goal.name}</p>
                          <p className="text-xs text-stone-500">Cada {goal.interval_months} mes{goal.interval_months > 1 ? "es" : ""}</p>
                        </div>
                      </div>
                      {daysUntilDue !== null && (
                        <span className={`text-xs px-2 py-0.5 rounded-full ${daysUntilDue <= 14 ? "bg-red-500/15 text-red-400" : daysUntilDue <= 30 ? "bg-amber-500/15 text-amber-400" : "bg-stone-700 text-stone-400"}`}>
                          {daysUntilDue <= 0 ? "Vencido" : `${daysUntilDue}d`}
                        </span>
                      )}
                    </div>

                    {isUnknownCost ? (
                      <div className="mt-2">
                        {editGoalId === goal.id ? (
                          <div className="flex gap-2">
                            <input type="number" value={editGoalAmount} onChange={(e) => setEditGoalAmount(e.target.value)}
                              placeholder="Costo real" autoFocus min={1}
                              className="flex-1 px-3 py-2 bg-stone-900 border border-stone-600 rounded-lg text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm" />
                            <button onClick={() => handleUpdateGoalTarget(goal.id)} disabled={saving}
                              className="px-3 py-2 bg-amber-500 text-stone-950 rounded-lg text-sm font-medium">OK</button>
                            <button onClick={() => setEditGoalId(null)} className="text-stone-500 text-sm">X</button>
                          </div>
                        ) : (
                          <button onClick={() => { setEditGoalId(goal.id); setEditGoalAmount(""); }}
                            className="w-full py-2 bg-amber-500/10 border border-amber-500/30 rounded-xl text-amber-400 text-sm font-medium hover:bg-amber-500/20 transition-colors">
                            Definir costo
                          </button>
                        )}
                      </div>
                    ) : (
                      <>
                        <div className="mt-2">
                          <ProgressBar current={goal.saved_amount} total={goal.target_amount} formatFn={formatCOP} variant={isComplete ? "emerald" : "amber"} />
                        </div>

                        <div className="flex items-center justify-between mt-2">
                          <p className="text-xs text-stone-500">
                            {isComplete ? (
                              <span className="text-emerald-400 font-medium">Listo para pagar</span>
                            ) : (
                              <>Guardar: <span className="text-amber-400">{formatCOP(weeklyNeeded)}/sem</span> o <span className="text-amber-400">{formatCOP(monthlyNeeded)}/mes</span></>
                            )}
                          </p>

                          <div className="flex gap-1">
                            {isComplete ? (
                              <button onClick={() => handleResetGoal(goal.id)} disabled={saving}
                                className="text-xs bg-emerald-500 text-stone-950 px-3 py-1.5 rounded-lg font-medium">
                                Hecho! Reiniciar
                              </button>
                            ) : (
                              savingGoalId === goal.id ? (
                                <div className="flex gap-1">
                                  <input type="number" value={saveAmount} onChange={(e) => setSaveAmount(e.target.value)}
                                    placeholder="$" autoFocus min={1}
                                    className="w-24 px-2 py-1.5 bg-stone-900 border border-stone-600 rounded-lg text-stone-50 text-sm focus:outline-none focus:border-emerald-500" />
                                  <button onClick={() => handleAddSavings(goal.id)} disabled={saving || !saveAmount}
                                    className="px-2 py-1.5 bg-emerald-500 text-stone-950 rounded-lg text-xs font-medium">+</button>
                                  <button onClick={() => setSavingGoalId(null)} className="text-stone-500 text-xs">X</button>
                                </div>
                              ) : (
                                <button onClick={() => { setSavingGoalId(goal.id); setSaveAmount(""); }}
                                  className="text-xs bg-emerald-500/15 text-emerald-400 px-3 py-1.5 rounded-lg font-medium hover:bg-emerald-500/25 transition-colors">
                                  Ahorrar
                                </button>
                              )
                            )}
                          </div>
                        </div>

                        {/* Edit target */}
                        <div className="mt-1">
                          {editGoalId === goal.id ? (
                            <div className="flex gap-2 mt-1">
                              <input type="number" value={editGoalAmount} onChange={(e) => setEditGoalAmount(e.target.value)}
                                placeholder="Nuevo costo" autoFocus min={1}
                                className="flex-1 px-2 py-1.5 bg-stone-900 border border-stone-600 rounded-lg text-stone-50 text-sm focus:outline-none focus:border-amber-500" />
                              <button onClick={() => handleUpdateGoalTarget(goal.id)} disabled={saving}
                                className="px-2 py-1.5 bg-amber-500 text-stone-950 rounded-lg text-xs font-medium">OK</button>
                              <button onClick={() => setEditGoalId(null)} className="text-stone-500 text-xs">X</button>
                            </div>
                          ) : (
                            <button onClick={() => { setEditGoalId(goal.id); setEditGoalAmount(goal.target_amount.toString()); }}
                              className="text-xs text-stone-600 hover:text-stone-400 transition-colors">
                              Editar costo
                            </button>
                          )}
                        </div>
                      </>
                    )}

                    {goal.notes && <p className="text-xs text-amber-400/70 mt-1">{goal.notes}</p>}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* === TAB: CONFIG === */}
      {activeTab === "config" && (
        <div>
          {!config && !showConfigForm ? (
            <div className="text-center py-12">
              <div className="text-5xl mb-4">⚙️</div>
              <p className="text-stone-300 font-medium">Sin configuración de moto</p>
              <p className="text-stone-500 text-sm mt-1 mb-4">Registra los datos de tu moto</p>
              <button onClick={() => setShowConfigForm(true)}
                className="bg-amber-500 hover:bg-amber-600 text-stone-950 font-semibold rounded-xl px-6 py-3 text-sm transition-colors">
                Configurar moto
              </button>
            </div>
          ) : showConfigForm ? (
            <form onSubmit={handleSaveConfig} className="bg-stone-800 border border-amber-500/30 rounded-2xl p-5 space-y-4">
              <h3 className="font-display font-semibold text-stone-200">Datos de la moto</h3>

              <div>
                <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Fecha de matrícula</label>
                <input type="date" value={cfgRegDate} onChange={(e) => setCfgRegDate(e.target.value)}
                  className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 focus:border-amber-500 focus:outline-none transition-colors" />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Cuota mensual</label>
                  <input type="number" value={cfgPayment} onChange={(e) => setCfgPayment(e.target.value)} placeholder="360,000"
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Cuotas atrasadas</label>
                  <input type="number" value={cfgMissed} onChange={(e) => setCfgMissed(e.target.value)} placeholder="0" min={0}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 placeholder:text-stone-600 focus:border-amber-500 focus:outline-none transition-colors" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Vencimiento SOAT</label>
                  <input type="date" value={cfgSoatDate} onChange={(e) => setCfgSoatDate(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 focus:border-amber-500 focus:outline-none transition-colors" />
                </div>
                <div>
                  <label className="text-xs text-stone-400 uppercase tracking-wide block mb-1">Vencimiento Tecno</label>
                  <input type="date" value={cfgTecnoDate} onChange={(e) => setCfgTecnoDate(e.target.value)}
                    className="w-full bg-stone-900 border border-stone-700 rounded-xl px-4 py-3 text-stone-100 focus:border-amber-500 focus:outline-none transition-colors" />
                </div>
              </div>

              <div className="flex gap-3">
                <button type="submit" disabled={saving}
                  className="flex-1 bg-amber-500 hover:bg-amber-600 disabled:opacity-50 text-stone-950 font-semibold rounded-xl py-3 text-sm transition-colors">
                  {saving ? "Guardando..." : "Guardar"}
                </button>
                <button type="button" onClick={() => setShowConfigForm(false)}
                  className="px-4 bg-stone-700 hover:bg-stone-600 text-stone-300 rounded-xl py-3 text-sm transition-colors">
                  Cancelar
                </button>
              </div>
            </form>
          ) : config && (
            <div className="space-y-4">
              <div className="bg-stone-800 border border-stone-700 rounded-2xl p-5">
                <div className="flex items-center justify-between mb-4">
                  <h3 className="font-display font-semibold text-stone-200">Datos de la moto</h3>
                  <button onClick={() => {
                    setCfgRegDate(config.registration_date || "");
                    setCfgPayment(config.monthly_payment.toString());
                    setCfgMissed(config.missed_payments.toString());
                    setCfgSoatDate(config.soat_due_date || "");
                    setCfgTecnoDate(config.tecno_due_date || "");
                    setShowConfigForm(true);
                  }} className="text-xs text-amber-400 hover:text-amber-300">Editar</button>
                </div>

                <div className="space-y-3">
                  {config.registration_date && (
                    <div className="flex justify-between">
                      <span className="text-sm text-stone-400">Matrícula</span>
                      <span className="text-sm text-stone-200">
                        {new Date(config.registration_date + "T12:00:00").toLocaleDateString("es-CO", { month: "long", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-sm text-stone-400">Cuota mensual</span>
                    <span className="text-sm text-stone-200 font-medium">{formatCOP(config.monthly_payment)}</span>
                  </div>
                  {config.missed_payments > 0 && (
                    <div className="flex justify-between">
                      <span className="text-sm text-stone-400">Cuotas atrasadas</span>
                      <span className="text-sm text-red-400 font-medium">{config.missed_payments} ({formatCOP(motoDebt)})</span>
                    </div>
                  )}
                  {config.soat_due_date && (
                    <div className="flex justify-between">
                      <span className="text-sm text-stone-400">SOAT vence</span>
                      <span className={`text-sm font-medium ${soatDaysLeft !== null && soatDaysLeft <= 30 ? "text-red-400" : "text-stone-200"}`}>
                        {new Date(config.soat_due_date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  )}
                  {config.tecno_due_date && (
                    <div className="flex justify-between">
                      <span className="text-sm text-stone-400">Tecno vence</span>
                      <span className={`text-sm font-medium ${tecnoDaysLeft !== null && tecnoDaysLeft <= 30 ? "text-red-400" : "text-stone-200"}`}>
                        {new Date(config.tecno_due_date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      )}

      {/* === TAB: HISTORIAL === */}
      {activeTab === "historial" && (
        <div>
          {/* Add maintenance */}
          {!showMaintForm ? (
            <button onClick={() => setShowMaintForm(true)}
              className="w-full py-3 bg-stone-800 border border-stone-700 hover:border-amber-500/50 rounded-2xl text-stone-300 font-medium transition-colors mb-4">
              + Registrar mantenimiento
            </button>
          ) : (
            <form onSubmit={handleMaintenanceSubmit} className="bg-stone-800 border border-amber-500/30 rounded-2xl p-4 mb-4">
              <h3 className="font-medium text-stone-200 mb-3">Nuevo mantenimiento</h3>
              <div className="space-y-3">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 block mb-1">Fecha</label>
                    <input type="date" value={mDate} onChange={(e) => setMDate(e.target.value)}
                      className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 block mb-1">Tipo</label>
                    <select value={mType} onChange={(e) => setMType(e.target.value)}
                      className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 focus:outline-none focus:border-amber-500 text-sm">
                      {Object.entries(TYPE_LABELS).map(([key, { label, emoji }]) => (
                        <option key={key} value={key}>{emoji} {label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Costo *</label>
                  <div className="relative">
                    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
                    <input type="number" value={mCost} onChange={(e) => setMCost(e.target.value)} required placeholder="70,000"
                      className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs text-stone-500 block mb-1">KM al servicio</label>
                    <input type="number" value={mKm} onChange={(e) => {
                      setMKm(e.target.value);
                      if (e.target.value && DEFAULT_INTERVALS_KM[mType]) {
                        setMNextKm((parseInt(e.target.value) + DEFAULT_INTERVALS_KM[mType]).toString());
                      }
                    }} placeholder="Ej: 3000"
                      className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                  <div>
                    <label className="text-xs text-stone-500 block mb-1">Próximo KM</label>
                    <input type="number" value={mNextKm} onChange={(e) => setMNextKm(e.target.value)} placeholder="Auto"
                      className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm" />
                  </div>
                </div>
                <div>
                  <label className="text-xs text-stone-500 block mb-1">Descripción</label>
                  <input type="text" value={mDesc} onChange={(e) => setMDesc(e.target.value)} placeholder="Opcional"
                    className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm" />
                </div>
                <div className="flex gap-2">
                  <button type="submit" disabled={saving || !mCost}
                    className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50">
                    {saving ? "Guardando..." : "Registrar"}
                  </button>
                  <button type="button" onClick={() => setShowMaintForm(false)}
                    className="px-4 py-2.5 bg-stone-700 text-stone-300 rounded-xl text-sm">Cancelar</button>
                </div>
              </div>
            </form>
          )}

          {/* Cost breakdown */}
          {recentMaint.length > 0 && (
            <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-4">
              <h3 className="text-sm font-medium text-stone-300 mb-3">Desglose último año</h3>
              <div className="space-y-2">
                {Object.entries(
                  recentMaint.reduce((acc, m) => {
                    acc[m.type] = (acc[m.type] || 0) + m.cost;
                    return acc;
                  }, {} as Record<string, number>)
                ).sort(([, a], [, b]) => b - a).map(([type, cost]) => {
                  const info = TYPE_LABELS[type] || TYPE_LABELS.other;
                  return (
                    <div key={type} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span>{info.emoji}</span>
                        <span className="text-sm text-stone-400">{info.label}</span>
                      </div>
                      <span className="text-sm font-medium text-stone-300">{formatCOP(cost)}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* History */}
          {maintenance.length > 0 ? (
            <div>
              <h3 className="text-sm font-medium text-stone-300 mb-3">Historial</h3>
              <div className="space-y-2">
                {maintenance.map((m) => {
                  const info = TYPE_LABELS[m.type] || TYPE_LABELS.other;
                  return (
                    <div key={m.id} className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-3">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          <span>{info.emoji}</span>
                          <div>
                            <p className="text-sm text-stone-300">{info.label}</p>
                            <p className="text-xs text-stone-500">
                              {new Date(m.date + "T12:00:00").toLocaleDateString("es-CO", { day: "numeric", month: "short", year: "numeric" })}
                              {m.km_at_service && ` · ${m.km_at_service.toLocaleString("es-CO")} km`}
                            </p>
                            {m.description && <p className="text-xs text-stone-500">{m.description}</p>}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="font-medium text-amber-400 text-sm">{formatCOP(m.cost)}</span>
                          <button onClick={() => deleteMaintenance(m.id)} className="text-stone-500 hover:text-red-400 text-xs">🗑️</button>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="text-center py-8">
              <p className="text-stone-500 text-sm">Sin mantenimientos registrados</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
