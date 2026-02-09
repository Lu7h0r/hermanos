"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isSignUp, setIsSignUp] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");

    if (isSignUp) {
      const { error } = await supabase.auth.signUp({ email, password });
      if (error) {
        setError(error.message);
      } else {
        setError("Revisá tu email para confirmar la cuenta.");
      }
    } else {
      const { error } = await supabase.auth.signInWithPassword({ email, password });
      if (error) {
        setError("Email o contraseña incorrectos");
      } else {
        router.push("/");
        router.refresh();
      }
    }

    setLoading(false);
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 bg-stone-900">
      <div className="w-full max-w-sm">
        <div className="text-center mb-8">
          <div className="text-5xl mb-3">🏠</div>
          <h1 className="font-display text-3xl font-bold text-stone-50 tracking-tight">
            Gastos Hermanos
          </h1>
          <p className="text-stone-400 mt-2 text-sm">
            Reparto justo del hogar
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <input
              type="email"
              placeholder="Email familiar"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-xl text-stone-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>
          <div>
            <input
              type="password"
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
              className="w-full px-4 py-3 bg-stone-800 border border-stone-700 rounded-xl text-stone-50 placeholder-stone-500 focus:outline-none focus:border-amber-500 focus:ring-1 focus:ring-amber-500 transition-colors"
            />
          </div>

          {error && (
            <p className={`text-sm text-center ${error.includes("Revisá") ? "text-emerald-400" : "text-red-400"}`}>
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-amber-500 hover:bg-amber-400 text-stone-900 font-semibold rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? "Cargando..." : isSignUp ? "Crear cuenta" : "Entrar"}
          </button>
        </form>

        <button
          onClick={() => { setIsSignUp(!isSignUp); setError(""); }}
          className="w-full mt-4 text-sm text-stone-400 hover:text-amber-400 transition-colors text-center"
        >
          {isSignUp ? "Ya tengo cuenta" : "Crear cuenta nueva"}
        </button>
      </div>
    </div>
  );
}
