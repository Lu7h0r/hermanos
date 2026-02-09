"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import { StatCard } from "@/components/stat-card";
import { formatCOP } from "@/lib/split-rules";
import Link from "next/link";
import type { WorkLog, MotoMaintenance, Debt } from "@/lib/types";

export default function DuvanDashboard() {
  const supabase = createClient();
  const [workLogs, setWorkLogs] = useState<WorkLog[]>([]);
  const [maintenance, setMaintenance] = useState<MotoMaintenance[]>([]);
  const [debts, setDebts] = useState<Debt[]>([]);
  const [duvanId, setDuvanId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    const { data: duvan } = await supabase
      .from("family_members")
      .select("*")
      .eq("slug", "duvan")
      .single();

    if (!duvan) return;
    setDuvanId(duvan.id);

    const now = new Date();
    const startOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`;
    const endOfMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate()}`;

    const [logsRes, maintRes, debtsRes] = await Promise.all([
      supabase
        .from("work_logs")
        .select("*")
        .eq("member_id", duvan.id)
        .gte("date", startOfMonth)
        .lte("date", endOfMonth)
        .order("date", { ascending: false }),
      supabase
        .from("moto_maintenance")
        .select("*")
        .eq("member_id", duvan.id)
        .order("date", { ascending: false })
        .limit(20),
      supabase
        .from("debts")
        .select("*")
        .eq("member_id", duvan.id)
        .eq("is_paid_off", false),
    ]);

    setWorkLogs(logsRes.data || []);
    setMaintenance(maintRes.data || []);
    setDebts((debtsRes.data as Debt[]) || []);
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="text-stone-500 animate-pulse">Cargando...</div>
      </div>
    );
  }

  // Calculate month stats
  const daysWorked = workLogs.length;
  const grossIncome = workLogs.reduce((sum, l) => sum + l.gross_income, 0);
  const gasCost = workLogs.reduce((sum, l) => sum + l.gas_cost, 0);
  const otherCosts = workLogs.reduce((sum, l) => sum + l.other_costs, 0);
  const netIncome = grossIncome - gasCost - otherCosts;

  // Calculate monthly moto amortization from last 12 months maintenance
  const oneYearAgo = new Date();
  oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
  const recentMaintenance = maintenance.filter(
    (m) => new Date(m.date) >= oneYearAgo
  );
  const totalMaintenanceCost = recentMaintenance.reduce((sum, m) => sum + m.cost, 0);
  const monthsOfData = Math.max(1, Math.ceil(
    (Date.now() - oneYearAgo.getTime()) / (1000 * 60 * 60 * 24 * 30)
  ));
  const monthlyAmortization = Math.round(totalMaintenanceCost / monthsOfData);

  const realSalary = netIncome - monthlyAmortization;

  return (
    <div className="px-4 pt-6 max-w-lg mx-auto">
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold tracking-tight">
          🏍️ Panel de Duvan
        </h1>
        <p className="text-stone-400 text-sm mt-1">
          Control de trabajo y moto
        </p>
      </div>

      {/* Quick stats */}
      <div className="grid grid-cols-2 gap-3 mb-6">
        <StatCard
          label="Días trabajados"
          value={daysWorked.toString()}
          emoji="📅"
        />
        <StatCard
          label="Ingreso bruto"
          value={formatCOP(grossIncome)}
          emoji="💰"
          variant="accent"
        />
        <StatCard
          label="Gasto gasolina"
          value={formatCOP(gasCost)}
          emoji="⛽"
          variant="danger"
        />
        <StatCard
          label="Neto del mes"
          value={formatCOP(netIncome)}
          emoji="📊"
          variant="success"
        />
      </div>

      {/* Real salary */}
      <div className="bg-stone-800 border border-amber-500/30 rounded-2xl p-5 mb-6">
        <p className="text-xs text-stone-400 uppercase tracking-wide mb-1">
          Salario real (neto - amortización moto)
        </p>
        <p className="font-display text-3xl font-bold text-amber-400">
          {formatCOP(realSalary)}
        </p>
        <p className="text-xs text-stone-500 mt-1">
          Amortización moto: {formatCOP(monthlyAmortization)}/mes
        </p>
      </div>

      {/* Debt summary */}
      {debts.length > 0 && (
        <Link href="/duvan/deudas" className="block mb-6">
          <div className="bg-stone-800 border border-red-500/30 rounded-2xl p-5 hover:border-red-500/50 transition-colors">
            <div className="flex items-center justify-between mb-2">
              <p className="text-xs text-stone-400 uppercase tracking-wide">Deudas pendientes</p>
              <span className="text-xs text-stone-500">{debts.length} deuda{debts.length > 1 ? "s" : ""} &rarr;</span>
            </div>
            <p className="font-display text-2xl font-bold text-red-400">
              {formatCOP(debts.reduce((s, d) => s + d.remaining_amount, 0))}
            </p>
            <div className="flex items-center gap-2 mt-2">
              {debts.filter((d) => d.priority === "urgente").length > 0 && (
                <span className="text-xs bg-red-500/15 text-red-400 px-2 py-0.5 rounded-full">
                  {debts.filter((d) => d.priority === "urgente").length} urgente{debts.filter((d) => d.priority === "urgente").length > 1 ? "s" : ""}
                </span>
              )}
              {debts.filter((d) => d.priority === "normal").length > 0 && (
                <span className="text-xs bg-amber-500/15 text-amber-400 px-2 py-0.5 rounded-full">
                  {debts.filter((d) => d.priority === "normal").length} normal{debts.filter((d) => d.priority === "normal").length > 1 ? "es" : ""}
                </span>
              )}
              {debts.filter((d) => d.priority === "tranqui").length > 0 && (
                <span className="text-xs bg-emerald-500/15 text-emerald-400 px-2 py-0.5 rounded-full">
                  {debts.filter((d) => d.priority === "tranqui").length} tranqui
                </span>
              )}
            </div>
          </div>
        </Link>
      )}

      {/* Quick links */}
      <div className="grid grid-cols-2 gap-3 mb-3">
        <Link
          href="/duvan/trabajo"
          className="bg-stone-800 border border-stone-700 hover:border-amber-500/50 rounded-2xl p-5 text-center transition-colors"
        >
          <div className="text-3xl mb-2">📝</div>
          <p className="font-medium text-stone-200">Registrar trabajo</p>
          <p className="text-xs text-stone-500 mt-1">Log diario</p>
        </Link>
        <Link
          href="/duvan/moto"
          className="bg-stone-800 border border-stone-700 hover:border-amber-500/50 rounded-2xl p-5 text-center transition-colors"
        >
          <div className="text-3xl mb-2">🔧</div>
          <p className="font-medium text-stone-200">Moto</p>
          <p className="text-xs text-stone-500 mt-1">Mantenimiento</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 gap-3">
        <Link
          href="/duvan/deudas"
          className="bg-stone-800 border border-stone-700 hover:border-red-500/50 rounded-2xl p-5 text-center transition-colors"
        >
          <div className="text-3xl mb-2">💳</div>
          <p className="font-medium text-stone-200">Deudas</p>
          <p className="text-xs text-stone-500 mt-1">Plan de pago inteligente</p>
        </Link>
      </div>

      {/* Recent work logs */}
      {workLogs.length > 0 && (
        <div className="mt-6">
          <h2 className="font-display text-lg font-semibold mb-3 text-stone-200">
            Últimos registros
          </h2>
          <div className="space-y-2">
            {workLogs.slice(0, 5).map((log) => (
              <div key={log.id} className="bg-stone-800/50 border border-stone-700/50 rounded-xl p-3 flex items-center justify-between">
                <div>
                  <p className="text-sm text-stone-300">
                    {new Date(log.date + "T12:00:00").toLocaleDateString("es-CO", { weekday: "short", day: "numeric", month: "short" })}
                  </p>
                  <p className="text-xs text-stone-500">
                    Gasolina: {formatCOP(log.gas_cost)}
                  </p>
                </div>
                <div className="text-right">
                  <p className="font-medium text-emerald-400">
                    {formatCOP(log.gross_income - log.gas_cost - log.other_costs)}
                  </p>
                  <p className="text-xs text-stone-500">
                    Bruto: {formatCOP(log.gross_income)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
