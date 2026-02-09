export interface Database {
  public: {
    Tables: {
      family_members: {
        Row: {
          id: string;
          name: string;
          slug: string;
          role: "contributor" | "beneficiary";
          avatar_emoji: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          name: string;
          slug: string;
          role: "contributor" | "beneficiary";
          avatar_emoji?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          name?: string;
          slug?: string;
          role?: "contributor" | "beneficiary";
          avatar_emoji?: string;
          created_at?: string;
        };
      };
      monthly_periods: {
        Row: {
          id: string;
          year: number;
          month: number;
          status: "active" | "closed";
          mama_fund_goal: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          year: number;
          month: number;
          status?: "active" | "closed";
          mama_fund_goal?: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          year?: number;
          month?: number;
          status?: "active" | "closed";
          mama_fund_goal?: number;
          created_at?: string;
        };
      };
      household_expenses: {
        Row: {
          id: string;
          period_id: string;
          category: "arriendo" | "mercado" | "servicios" | "garaje";
          description: string | null;
          amount: number;
          date: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          period_id: string;
          category: "arriendo" | "mercado" | "servicios" | "garaje";
          description?: string | null;
          amount: number;
          date?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          period_id?: string;
          category?: "arriendo" | "mercado" | "servicios" | "garaje";
          description?: string | null;
          amount?: number;
          date?: string;
          created_at?: string;
        };
      };
      payments: {
        Row: {
          id: string;
          member_id: string;
          period_id: string;
          category: "arriendo" | "mercado" | "servicios" | "garaje" | "mama_fund";
          amount_due: number;
          paid: boolean;
          paid_date: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          period_id: string;
          category: "arriendo" | "mercado" | "servicios" | "garaje" | "mama_fund";
          amount_due: number;
          paid?: boolean;
          paid_date?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          period_id?: string;
          category?: "arriendo" | "mercado" | "servicios" | "garaje" | "mama_fund";
          amount_due?: number;
          paid?: boolean;
          paid_date?: string | null;
          created_at?: string;
        };
      };
      work_logs: {
        Row: {
          id: string;
          member_id: string;
          date: string;
          gross_income: number;
          gas_cost: number;
          other_costs: number;
          km_driven: number | null;
          notes: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          date: string;
          gross_income: number;
          gas_cost?: number;
          other_costs?: number;
          km_driven?: number | null;
          notes?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          date?: string;
          gross_income?: number;
          gas_cost?: number;
          other_costs?: number;
          km_driven?: number | null;
          notes?: string | null;
          created_at?: string;
        };
      };
      moto_maintenance: {
        Row: {
          id: string;
          member_id: string;
          date: string;
          type: "oil" | "tire_front" | "tire_rear" | "brakes" | "chain" | "other";
          cost: number;
          km_at_service: number | null;
          next_service_km: number | null;
          description: string | null;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          date: string;
          type: "oil" | "tire_front" | "tire_rear" | "brakes" | "chain" | "other";
          cost: number;
          km_at_service?: number | null;
          next_service_km?: number | null;
          description?: string | null;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          date?: string;
          type?: "oil" | "tire_front" | "tire_rear" | "brakes" | "chain" | "other";
          cost?: number;
          km_at_service?: number | null;
          next_service_km?: number | null;
          description?: string | null;
          created_at?: string;
        };
      };
      moto_km_log: {
        Row: {
          id: string;
          member_id: string;
          date: string;
          km_reading: number;
          created_at: string;
        };
        Insert: {
          id?: string;
          member_id: string;
          date: string;
          km_reading: number;
          created_at?: string;
        };
        Update: {
          id?: string;
          member_id?: string;
          date?: string;
          km_reading?: number;
          created_at?: string;
        };
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
  };
}
