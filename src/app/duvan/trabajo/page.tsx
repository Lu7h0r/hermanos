"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { formatCOP } from "@/lib/split-rules";
import type { WorkLog } from "@/lib/types";

const MONTH_NAMES = [
  "", "Enero", "Febrero", "Marzo", "Abril", "Mayo", "Junio",
  "Julio", "Agosto", "Septiembre", "Octubre", "Noviembre", "Diciembre",
];

export default function TrabajoPage() {
  const supabase = createClient();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [duvanId, setDuvanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // Form
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [grossIncome, setGrossIncome] = useState("");
  const [gasCost, setGasCost] = useState("10000");
  const [otherCosts, setOtherCosts] = useState("");
  const [kmDriven, setKmDriven] = useState("");
  const [notes, setNotes] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);

  const now = new Date();
  const currentMonth = now.getMonth() + 1;
  const currentYear = now.getFullYear();

  const fetchData = useCallback(async () => {
    const { data: duvan } = await supabase
      .from("family_members")
      .select("*")
      .eq("slug", "duvan")
      .single();

    if (!duvan) return;
    setDuvanId(duvan.id);

    const startOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-01`;
    const endOfMonth = `${currentYear}-${String(currentMonth).padStart(2, "0")}-${new Date(currentYear, currentMonth, 0).getDate()}`;

    const { data } = await supabase
      .from("work_logs")
      .select("*")
      .eq("member_id", duvan.id)
      .gte("date", startOfMonth)
      .lte("date", endOfMonth)
      .order("date", { ascending: false });

    setWorkLogs(data || []);
    setLoading(false);
  }, [supabase, currentMonth, currentYear]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!duvanId || !grossIncome) return;
    setSaving(true);

    const payload = {
      member_id: duvanId,
      date,
      gross_income: parseInt(grossIncome, 10),
      gas_cost: parseInt(gasCost || "0", 10),
      other_costs: parseInt(otherCosts || "0", 10),
      km_driven: kmDriven ? parseInt(kmDriven, 10) : null,
      notes: notes || null,
    };

    if (editingId) {
      await supabase.from("work_logs").update(payload).eq("id", editingId);
    } else {
      await supabase.from("work_logs").insert(payload);
    }

    // Reset form
    setGrossIncome("");
    setGasCost("10000");
    setOtherCosts("");
    setKmDriven("");
    setNotes("");
    setEditingId(null);
    setDate(new Date().toISOString().split("T")[0]);

    await fetchData();
    setSaving(false);
  }

  function startEdit(log: WorkLog) {
    setEditingId(log.id);
    setDate(log.date);
    setGrossIncome(log.gross_income.toString());
    setGasCost(log.gas_cost.toString());
    setOtherCosts(log.other_costs > 0 ? log.other_costs.toString() : "");
    setKmDriven(log.km_driven ? log.km_driven.toString() : "");
    setNotes(log.notes || "");
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  async function deleteLog(id: string) {
    await supabase.from("work_logs").delete().eq("id", id);
    await fetchData();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse">Cargando...</div>
      </div>
    );
  }

  // Stats
  const daysWorked = workLogs.length;
  const totalGross = workLogs.reduce((s, l) => s + l.gross_income, 0);
  const totalGas = workLogs.reduce((s, l) => s + l.gas_cost, 0);
  const totalOther = workLogs.reduce((s, l) => s + l.other_costs, 0);
  const totalNet = totalGross - totalGas - totalOther;
  const avgDaily = daysWorked > 0 ? Math.round(totalNet / daysWorked) : 0;

  // Calendar data
  const daysInMonth = new Date(currentYear, currentMonth, 0).getDate();
  const firstDayOfWeek = new Date(currentYear, currentMonth - 1, 1).getDay();
  const workedDates = new Set(workLogs.map((l) => parseInt(l.date.split("-")[2], 10)));

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          📝 Registro de Trabajo
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          {MONTH_NAMES[currentMonth]} {currentYear}
        </p>
      </div>

      {/* Quick form */}
      <form onSubmit={handleSubmit} className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-6">
        <h3 className="font-medium text-stone-200 mb-3">
          {editingId ? "Editar registro" : "Nuevo registro"}
        </h3>

        <div className="space-y-3">
          <div>
            <label className="text-xs text-stone-500 block mb-1">Fecha</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Bruto del día *</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
                <input
                  type="number"
                  value={grossIncome}
                  onChange={(e) => setGrossIncome(e.target.value)}
                  placeholder="100.000"
                  required
                  className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">Gasolina</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
                <input
                  type="number"
                  value={gasCost}
                  onChange={(e) => setGasCost(e.target.value)}
                  placeholder="10.000"
                  className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-stone-500 block mb-1">Otros gastos</label>
              <div className="relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-500 text-sm">$</span>
                <input
                  type="number"
                  value={otherCosts}
                  onChange={(e) => setOtherCosts(e.target.value)}
                  placeholder="0"
                  className="w-full pl-7 pr-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="text-xs text-stone-500 block mb-1">KM recorridos</label>
              <input
                type="number"
                value={kmDriven}
                onChange={(e) => setKmDriven(e.target.value)}
                placeholder="Opcional"
                className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="text-xs text-stone-500 block mb-1">Notas</label>
            <input
              type="text"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Opcional"
              className="w-full px-3 py-2.5 bg-stone-900 border border-stone-600 rounded-xl text-stone-50 placeholder-stone-600 focus:outline-none focus:border-amber-500 text-sm"
            />
          </div>

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving || !grossIncome}
              className="flex-1 py-2.5 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl text-sm transition-colors disabled:opacity-50"
            >
              {saving ? "Guardando..." : editingId ? "Actualizar" : "Registrar día"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => {
                  setEditingId(null);
                  setGrossIncome("");
                  setGasCost("10000");
                  setOtherCosts("");
                  setKmDriven("");
                  setNotes("");
                }}
                className="px-4 py-2.5 bg-stone-700 text-stone-300 rounded-xl text-sm"
              >
                Cancelar
              </button>
            )}
          </div>
        </div>
      </form>

      {/* Month stats */}
      <div className="grid grid-cols-3 gap-2 mb-6">
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
          <p className="text-xs text-stone-500">Días</p>
          <p className="font-display font-bold text-lg text-stone-50">{daysWorked}</p>
        </div>
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
          <p className="text-xs text-stone-500">Neto</p>
          <p className="font-display font-bold text-lg text-emerald-400">{formatCOP(totalNet)}</p>
        </div>
        <div className="bg-stone-800 border border-stone-700 rounded-xl p-3 text-center">
          <p className="text-xs text-stone-500">Prom/día</p>
          <p className="font-display font-bold text-lg text-amber-400">{formatCOP(avgDaily)}</p>
        </div>
      </div>

      {/* Mini calendar */}
      <div className="bg-stone-800 border border-stone-700 rounded-2xl p-4 mb-6">
        <h3 className="text-sm font-medium text-stone-300 mb-3">
          Calendario del mes
        </h3>
        <div className="grid grid-cols-7 gap-1 text-center">
          {["D", "L", "M", "M", "J", "V", "S"].map((day, i) => (
            <div key={i} className="text-xs text-stone-500 py-1">{day}</div>
          ))}
          {Array.from({ length: firstDayOfWeek }, (_, i) => (
            <div key={`empty-${i}`} />
          ))}
          {Array.from({ length: daysInMonth }, (_, i) => {
            const day = i + 1;
            const worked = workedDates.has(day);
            const isToday = day === now.getDate() && currentMonth === now.getMonth() + 1;

            return (
              <div
                key={day}
                className={`text-xs py-1.5 rounded-lg ${
                  worked
                    ? "bg-emerald-500/20 text-emerald-400 font-bold"
                    : isToday
                    ? "bg-amber-500/20 text-amber-400 font-bold"
                    : "text-stone-500"
                }`}
              >
                {day}
              </div>
            );
          })}
        </div>
      </div>

      {/* Work log list */}
      {workLogs.length > 0 && (
        <div className="mb-6">
          <h3 className="text-sm font-medium text-stone-300 mb-3">
            Registros del mes
          </h3>
          <div className="space-y-2">
            {workLogs.map((log) => {
              const net = log.gross_income - log.gas_cost - log.other_costs;
              return (
                <div key={log.id} className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-stone-300">
                        {new Date(log.date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                      </p>
                      <div className="flex gap-3 mt-0.5">
                        <span className="text-xs text-stone-500">
                          Bruto: {formatCOP(log.gross_income)}
                        </span>
                        <span className="text-xs text-red-400">
                          Gas: {formatCOP(log.gas_cost)}
                        </span>
                        {log.km_driven && (
                          <span className="text-xs text-stone-500">{log.km_driven}km</span>
                        )}
                      </div>
                      {log.notes && (
                        <p className="text-xs text-stone-500 mt-0.5">{log.notes}</p>
                      )}
                    </div>
                    <div className="text-right flex items-center gap-2">
                      <p className="font-medium text-emerald-400">{formatCOP(net)}</p>
                      <div className="flex gap-1">
                        <button
                          onClick={() => startEdit(log)}
                          className="text-stone-500 hover:text-amber-400 text-xs"
                        >
                          ✏️
                        </button>
                        <button
                          onClick={() => deleteLog(log.id)}
                          className="text-stone-500 hover:text-red-400 text-xs"
                        >
                          🗑️
                        </button>
                      </div>
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
