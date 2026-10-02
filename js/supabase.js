// Gedeelde verbinding met Supabase voor alle pagina's.
import { createClient } from "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/+esm";
import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

export const sb = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
  auth: { flowType: "implicit", detectSessionInUrl: true, persistSession: true, autoRefreshToken: true },
});

export const esc = (v) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

export function melding(el, tekst, soort = "") {
  el.innerHTML = tekst ? `<div class="melding ${soort}">${esc(tekst)}</div>` : "";
}

// Edge Function aanroepen en een leesbare foutmelding teruggeven.
export async function functie(naam, body) {
  const { data, error } = await sb.functions.invoke(naam, { body });
  if (error) {
    let tekst = "Er liep iets mis. Probeer het later opnieuw.";
    try { const j = await error.context.json(); if (j && j.fout) tekst = j.fout; } catch (_) {}
    throw new Error(tekst);
  }
  return data;
}
