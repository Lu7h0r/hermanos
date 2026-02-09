"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/stat-card";
import { formatCOP } from "@/lib/split-rules";
import type { MotoMaintenance, MotoKmLog } from "@/lib/types";

const TYPE_LABELS: Record<string, { label: string; emoji: string }> = {
  oil: { label: "Aceite", emoji: "🛢️" },
  tire_front: { label: "Llanta delantera", emoji: "🔵" },
  tire_rear: { label: "Llanta trasera", emoji: "🔴" },
  brakes: { label: "Pastillas de freno", emoji: "🛑" },
  chain: { label: "Cadena", emoji: "⛓️" },
  other: { label: "Otro", emoji: "🔧" },
};

const DEFAULT_INTERVALS: Record<string, number> = {
  oil: 3000,
  brakes: 8000,
  chain: 15000,
  tire_front: 20000,
  tire_rear: 15000,
};

export default function MotoPage() {
  const supabase = createClient();
  const [maintenance, setMaintenance] = useState<MotoMaintenance[]>([]);
  const [latestKm, setLatestKm] = useState<MotoKmLog | null>(null);
  const [duvanId, setDuvanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [showForm, setShowForm] = useState(false);

  // Maintenance form
  const [mDate, setMDate] = useState(new Date().toISOString().split("T")[0]);
  const [mType, setMType] = useState<string>("oil");
  const [mCost, setMCost] = useState("");
  const [mKm, setMKm] = useState("");
  const [mNextKm, setMNextKm] = useState("");
  const [mDesc, setMDesc] = useState("");

  // KM form
  const [showKmForm, setShowKmForm] = useState(false);
  const [newKm, setNewKm] = useState("");

  const fetchData = useCallback(async () => {
    const { data: duvan } = await supabase
      .from("family_members")
      .select("*")
      .eq("slug", "duvan")
      .single();

    if (!duvan) return;
    setDuvanId(duvan.id);

    const [maintRes, kmRes] = await Promise.all([
      supabase
        .from("moto_maintenance")
        .select("*")
        .eq("member_id", duvan.id)
        .order("date", { ascending: false }),
      supabase
        .from("moto_km_log")
        .select("*")
        .eq("member_id", duvan.id)
        .order("date", { ascending: false })
        .limit(1),
    ]);

    setMaintenance(maintRes.data || []);
    setLatestKm(kmRes.data?.[0] || null);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleMaintenanceSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId || !mCost) return;
    setSaving(true);

    const kmAtService = mKm ? parseInt(mKm, 10) : null;
    let nextServiceKm = mNextKm ? parseInt(mNextKm, 10) : null;

    // Auto-calculate next service if km is provided
    if (kmAtService && !nextServiceKm && DEFAULT_INTERVALS[mType]) {
      nextServiceKm = kmAtService + DEFAULT_INTERVALS[mType];
    }

    await supabase.from("moto_maintenance").insert({
      member_id: duvanId,
      date: mDate,
      type: mType as MotoMaintenance["type"],
      cost: parseInt(mCost, 10),
      km_at_service: kmAtService,
      next_service_km: nextServiceKm,
      description: mDesc || null,
    });

    // Update km log if provided
    if (kmAtService) {
      await supabase.from("moto_km_log").insert({
        member_id: duvanId,
        date: mDate,
        km_reading: kmAtService,
      });
    }

    // Reset
    setMCost("");
    setMKm("");
    setMNextKm("");
    setMDesc("");
    setShowForm(false);

    await fetchData();
    setSaving(false);
  }

  async function saveKm(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId || !newKm) return;
    setSaving(true);

    await supabase.from("moto_km_log").insert({
      member_id: duvanId,
      date: new Date().toISOString().split("T")[0],
      km_reading: parseInt(newKm, 10),
    });

    setNewKm("");
    setShowKmForm(false);
    await fetchData();
    setSaving(false);
  }

  async function deleteMaintenance(id: string) {
    await supabase.from("moto_maintenance").delete().eq("id", id);
    await fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse">Cargando...</div>
      </div>
    );
  }

  // Monthly amortization
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentMaint = maintenance.filter((m) => new Date(m.date) >= oneYearAgo);
  const totalCost = recentMaint.reduce((s, m) => s + m.cost, 0);
  const months = Math.max(1, 12);
  const monthlyAmort = Math.round(totalCost / months);

  // Costs by type
  const costsByType: Record<string, number> = {};
  for (const m of recentMaint) {
    costsByType[m.type] = (costsByType[m.type] || 0) + m.cost;
  }

  // Service alerts
  const currentKm = latestKm?.km_reading || 0;
  const alerts: { type: string; label: string; emoji: string; kmLeft: number }[] = [];

  for (const m of maintenance) {
    if (m.next_service_km && currentKm > 0) {
      const kmLeft = m.next_service_km - currentKm;
      if (kmLeft < 500 && kmLeft > -1000) {
        const typeInfo = TYPE_LABELS[m.type] || TYPE_LABELS.other;
        // Only add if not already have a newer alert for same type
        if (!alerts.find((a) => a.type === m.type)) {
          alerts.push({ type: m.type, ...typeInfo, kmLeft });
        }
      }
    }
  }

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          🏍️ Mantenimiento Moto
        </h1>
        <div className="flex items-center gap-3 mt-1">
          <p className="text-stone-400 text-sm">
            {currentKm > 0 ? `${currentKm.toLocaleString("es-CO")} km` : "Sin registro de KM"}
          </p>
          <button
            onClick={() => setShowKmForm(!showKmForm)}
            className="text-xs text-amber-400 hover:text-amber-300"
          >
            {showKmForm ? "Cancelar" : "Actualizar KM"}
          </button>
        </div>
      </div>

      {/* KM update form */}
      {showKmForm && (
        <form onSubmit={saveKm} className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-4 flex gap-2">
          <input
            type="number"
            value={newKm}
            onChange={(e) => setNewKm(e.target.value)}
            placeholder="Kilometraje actual"
            className="flex-1 px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
          />
          <button
            type="submit"
            disabled={saving || !newKm}
            className="px-4 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm disabled:opacity-50"
          >
            Guardar
          </button>
        </form>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <div className="space-y-2 mb-6">
          {alerts.map((alert) => (
            <div
              key={alert.type}
              className={`border rounded-2xl p-4 ${
                alert.kmLeft <= 0
                  ? "bg-red-500/10 border-red-500/30"
                  : "bg-amber-500/10 border-amber-500/30"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className="text-xl">{alert.emoji}</span>
                <div>
                  <p className="font-medium text-stone-200">
                    {alert.label}
                  </p>
                  <p className={`text-sm ${alert.kmLeft <= 0 ? "text-red-400" : "text-amber-400"}`}>
                    {alert.kmLeft <= 0
                      ? `Pasado por ${Math.abs(alert.kmLeft).toLocaleString("es-CO")} km`
                      : `Faltan ~${alert.kmLeft.toLocaleString("es-CO")} km`
                    }
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Amortización/mes"
          value={formatCOP(monthlyAmort)}
          emoji="📉"
          variant="accent"
        />
        <StatCard
          label="Total último año"
          value={formatCOP(totalCost)}
          emoji="🔧"
        />
      </div>

      {/* Cost breakdown */}
      {Object.keys(costsByType).length > 0 && (
        <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-6">
          <h3 className="text-sm font-medium text-stone-300 mb-3">
            Desglose por tipo (último año)
          </h3>
          <div className="space-y-2">
            {Object.entries(costsByType)
              .sort(([, a], [, b]) => b - a)
              .map(([type, cost]) => {
                const info = TYPE_LABELS[type] || TYPE_LABELS.other;
                const monthlyShare = Math.round(cost / months);
                return (
                  <div key={type} className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span>{info.emoji}</span>
                      <span className="text-sm text-stone-400">{info.label}</span>
                    </div>
                    <div className="text-right">
                      <span className="text-sm font-medium text-stone-300">
                        {formatCOP(cost)}
                      </span>
                      <span className="text-xs text-stone-500 ml-2">
                        ({formatCOP(monthlyShare)}/mes)
                      </span>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      )}

      {/* Add maintenance button */}
      {!showForm && (
        <button
          onClick={() => setShowForm(true)}
          className="w-full py-3 bg-stone-800 border border-stone-700 hover:border-amber-500/50 rounded-2xl text-stone-300 font-medium transition-colors mb-6"
        >
          + Registrar mantenimiento
        </button>
      )}

      {/* Maintenance form */}
      {showForm && (
        <form onSubmit={handleMaintenanceSubmit} className="bg-stone-800 border border-amber-500/30 rounded-2xl p-4 mb-6">
          <h3 className="font-medium text-stone-200 mb-3">Nuevo mantenimiento</h3>
          <div className="space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 block mb-1">Fecha</label>
                <input
                  type="date"
                  value={mDate}
                  onChange={(e) => setMDate(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">Tipo</label>
                <select
                  value={mType}
                  onChange={(e) => setMType(e.target.value)}
                  className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 focus:outline-none focus:border-amber-500 text-sm"
                >
                  {Object.entries(TYPE_LABELS).map(([key, { label, emoji }]) => (
                    <option key={key} value={key}>
                      {emoji} {label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Costo *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
                <input
                  type="number"
                  value={mCost}
                  onChange={(e) => setMCost(e.target.value)}
                  required
                  placeholder="40.000"
                  className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-stone-500 block mb-1">KM al servicio</label>
                <input
                  type="number"
                  value={mKm}
                  onChange={(e) => {
                    setMKm(e.target.value);
                    if (e.target.value && DEFAULT_INTERVALS[mType]) {
                      setMNextKm((parseInt(e.target.value, 10) + DEFAULT_INTERVALS[mType]).toString());
                    }
                  }}
                  placeholder="Ej: 15000"
                  className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
              <div>
                <label className="text-xs text-stone-500 block mb-1">Próximo servicio KM</label>
                <input
                  type="number"
                  value={mNextKm}
                  onChange={(e) => setMNextKm(e.target.value)}
                  placeholder="Auto-calc"
                  className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            </div>

            <div>
              <label className="text-xs text-stone-500 block mb-1">Descripción</label>
              <input
                type="text"
                value={mDesc}
                onChange={(e) => setMDesc(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>

            <div className="flex gap-2">
              <button
                type="submit"
                disabled={saving || !mCost}
                className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
              >
                {saving ? "Guardando..." : "Registrar"}
              </button>
              <button
                type="button"
                onClick={() => setShowForm(false)}
                className="px-4 py-2.5 bg-stone-700 text-stone-300 rounded-xl text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Maintenance history */}
      {maintenance.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-stone-300 mb-3">
            Historial de mantenimiento
          </h3>
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
                        {m.description && (
                          <p className="text-xs text-stone-500">{m.description}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-amber-400 text-sm">
                        {formatCOP(m.cost)}
                      </span>
                      <button
                        onClick={() => deleteMaintenance(m.id)}
                        className="text-stone-500 hover:text-red-400 text-xs"
                      >
                        🗑️
                      </button>
                    </div>
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
