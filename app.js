import { SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY } from "./config.js";

const el = document.getElementById("status");

async function controleer() {
  if (SUPABASE_URL.includes("VUL-IN") || SUPABASE_PUBLISHABLE_KEY === "VUL-IN") {
    el.textContent = "Nog niet ingesteld: vul js/config.js in met de URL en de publieke sleutel van Supabase.";
    el.style.color = "var(--let)";
    return;
  }
  try {
    const r = await fetch(`${SUPABASE_URL}/auth/v1/settings`, { headers: { apikey: SUPABASE_PUBLISHABLE_KEY } });
    if (r.ok) {
      el.textContent = "✓ Verbonden met Supabase. Fase 0 is klaar.";
      el.style.color = "var(--groen)";
    } else {
      el.textContent = `Supabase antwoordt, maar de sleutel wordt geweigerd (code ${r.status}). Controleer de publieke sleutel in js/config.js.`;
      el.style.color = "var(--kaart)";
    }
  } catch (e) {
    el.textContent = "Geen verbinding met Supabase. Controleer de URL in js/config.js.";
    el.style.color = "var(--kaart)";
  }
}
controleer();
