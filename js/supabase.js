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

// Edge Function aanroepen; bij een fout tonen we ook de technische oorzaak tussen [ ].
export async function functie(naam, body) {
  const { data, error } = await sb.functions.invoke(naam, { body });
  if (!error) return data;
  let tekst = "Er liep iets mis. Probeer het later opnieuw.";
  let detail = error.name || "onbekend";
  const r = error.context;
  if (r && typeof r.status === "number") {
    detail = `HTTP ${r.status}`;
    try {
      const t = await r.text();
      try { const j = JSON.parse(t); if (j.fout) tekst = j.fout; detail += " " + (j.msg || j.message || j.error || ""); }
      catch (_) { detail += " " + t.slice(0, 120); }
    } catch (_) {}
  } else if (error.name === "FunctionsFetchError") {
    detail = `geen verbinding met ${SUPABASE_URL}/functions/v1/${naam}`;
  }
  throw new Error(`${tekst} [${detail.trim()}]`);
}
