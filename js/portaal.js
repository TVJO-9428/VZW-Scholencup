// Start van het portaal na aanmelden: kiest tussen beheer en school.
import { sb, esc, melding } from "./supabase.js";
import { laadContext } from "./gemeen.js";

const msg = document.getElementById("msg"), inhoud = document.getElementById("inhoud"), sub = document.getElementById("sub");

const { data: { session } } = await sb.auth.getSession();
if (!session) { location.replace("index.html"); throw new Error("niet aangemeld"); }
document.getElementById("wie").innerHTML = `${esc(session.user.email)} <button class="knop klein" id="uit">Afmelden</button>`;
document.getElementById("uit").onclick = async () => { await sb.auth.signOut(); location.replace("index.html"); };

try {
  const ctx = await laadContext();
  if (ctx.test) document.getElementById("testklok").innerHTML = `<div class="melding">Testdatum actief: het portaal gedraagt zich alsof het <b>${esc(new Date(ctx.test).toLocaleString("nl-BE"))}</b> is.</div>`;
  const { data: beh } = await sb.from("beheerders").select("user_id").maybeSingle();
  if (beh) {
    sub.textContent = "Beheer";
    const { startBeheer } = await import("./beheer.js");
    await startBeheer(ctx, inhoud, msg);
  } else {
    const { data: k } = await sb.from("school_gebruikers").select("school_id, scholen(naam)").maybeSingle();
    if (!k) { sub.textContent = ""; melding(msg, "Dit account is nog niet aan een school gekoppeld. Neem contact op met de club.", "rood"); }
    else {
      sub.textContent = k.scholen?.naam || "";
      const { startSchool } = await import("./school.js");
      await startSchool(ctx, k.school_id, inhoud, msg);
    }
  }
} catch (e) {
  melding(msg, "Laden mislukt: " + e.message, "rood");
}
