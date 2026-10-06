import { createClient } from "@supabase/supabase-js";

export const url = import.meta.env.VITE_SUPABASE_URL;
export const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Quando as variáveis não estão definidas o app roda em "modo demonstração":
 * tudo funciona localmente (IndexedDB), nada é enviado para a nuvem.
 */
export const supabaseConfigurado = Boolean(url && anonKey);

export const supabase = supabaseConfigurado
  ? createClient(url, anonKey, {
      auth: { persistSession: true, autoRefreshToken: true },
      global: { headers: { "x-app": "cvc-hortifruit" } },
    })
  : null;

export function exigirSupabase() {
  if (!supabase) {
    throw new Error(
      "Supabase não configurado. Defina VITE_SUPABASE_URL e VITE_SUPABASE_ANON_KEY em .env.local"
    );
  }
  return supabase;
}
