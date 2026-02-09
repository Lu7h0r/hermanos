"use client";

import { useEffect, useState, useCallback } from "react";
import { createClient } from "@/lib/supabase/client";
import type { MonthlyPeriod, FamilyMember } from "@/lib/types";

export function usePeriod() {
  const [period, setPeriod] = useState<MonthlyPeriod | null>(null);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  const fetchPeriod = useCallback(async () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;

    const { data } = await supabase
      .from("monthly_periods")
      .select("*")
      .eq("year", year)
      .eq("month", month)
      .single();

    if (data) {
      setPeriod(data as MonthlyPeriod);
    } else {
      const { data: newPeriod } = await supabase
        .from("monthly_periods")
        .insert({ year, month })
        .select()
        .single();

      if (newPeriod) {
        setPeriod(newPeriod as MonthlyPeriod);
        await supabase.from("household_expenses").insert([
          { period_id: newPeriod.id, category: "arriendo", amount: 900000, description: "Arriendo mensual" },
          { period_id: newPeriod.id, category: "garaje", amount: 180000, description: "Garaje mensual" },
        ]);
      }
    }
    setLoading(false);
  }, [supabase]);

  useEffect(() => {
    fetchPeriod();
  }, [fetchPeriod]);

  return { period, loading, refetch: fetchPeriod };
}

export function useMembers() {
  const [members, setMembers] = useState<FamilyMember[]>([]);
  const [loading, setLoading] = useState(true);
  const supabase = createClient();

  useEffect(() => {
    async function fetch() {
      const { data } = await supabase
        .from("family_members")
        .select("*")
        .order("created_at");
      if (data) setMembers(data as FamilyMember[]);
      setLoading(false);
    }
    fetch();
  }, [supabase]);

  return { members, loading };
}
