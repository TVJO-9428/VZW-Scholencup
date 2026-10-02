// Edge Function "beheer" – Schoolcup-portaal (versie fase 6)
// Acties van de beheerder. Instelling in Supabase: "Verify JWT" UIT – de functie controleert zelf of je beheerder bent.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const antwoord = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function mail(aan: string, onderwerp: string, tekst: string): Promise<boolean> {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM"), to: [aan], reply_to: Deno.env.get("MAIL_REPLY_TO") || undefined, subject: onderwerp, text: tekst }),
  });
  if (!r.ok) console.error("Resend-fout", r.status, await r.text());
  return r.ok;
}
const datumNL = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
const tijd = (t: string | null) => (t ? String(t).slice(0, 5) : "—");
const GROET = "\n\nSportieve groeten,\nTVJO Verbroedering Zwijndrecht";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwoord(405, { fout: "Niet toegelaten." });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return antwoord(401, { fout: "Je bent niet (meer) aangemeld. Meld opnieuw aan." });
    const { data: isBeheerder } = await db.from("beheerders").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isBeheerder) return antwoord(403, { fout: "Enkel de beheerder kan dit doen." });

    const body = await req.json();
    const actie: string = body.actie;
    const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
    if (!site) return antwoord(500, { fout: "SITE_URL is niet ingesteld bij de Edge Function secrets." });

    // ---------- Beheerders ----------
    if (actie === "beheerders_lijst") {
      const { data: rijen } = await db.from("beheerders").select("user_id");
      const lijst = [];
      for (const r of rijen ?? []) {
        const { data } = await db.auth.admin.getUserById(r.user_id);
        lijst.push({ user_id: r.user_id, email: data.user?.email ?? "?", laatst: data.user?.last_sign_in_at ?? null });
      }
      return antwoord(200, { ok: true, lijst, ik: user.id });
    }
    if (actie === "beheerder_toevoegen") {
      const email = String(body.email ?? "").trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) return antwoord(400, { fout: "Geef een geldig e-mailadres." });
      const { data: lijst } = await db.auth.admin.listUsers({ page: 1, perPage: 1000 });
      let doel = lijst?.users.find((u) => (u.email ?? "").toLowerCase() === email);
      let nieuw = false;
      if (!doel) {
        const { data, error } = await db.auth.admin.createUser({ email, email_confirm: true });
        if (error || !data.user) return antwoord(400, { fout: `Account aanmaken mislukt: ${error?.message}` });
        doel = data.user; nieuw = true;
      }
      const { data: isSchool } = await db.from("school_gebruikers").select("school_id").eq("user_id", doel.id).maybeSingle();
      if (isSchool) return antwoord(409, { fout: "Dit adres is gekoppeld aan een school. Gebruik een ander adres voor een beheerder." });
      const { error: e2 } = await db.from("beheerders").upsert({ user_id: doel.id }, { ignoreDuplicates: true });
      if (e2) throw e2;
      const { error: e3 } = await db.auth.resetPasswordForEmail(email, { redirectTo: `${site}/wachtwoord.html` });
      return antwoord(200, { ok: true, bericht: `${email} is beheerder.${nieuw ? " Er is een mail verstuurd om een wachtwoord te kiezen." : ""}${e3 ? " (Mail versturen mislukte: " + e3.message + ")" : ""}` });
    }
    if (actie === "beheerder_verwijderen") {
      if (body.user_id === user.id) return antwoord(400, { fout: "Je kan jezelf niet verwijderen. Laat een andere beheerder dit doen." });
      const { count } = await db.from("beheerders").select("user_id", { count: "exact", head: true });
      if ((count ?? 0) <= 1) return antwoord(400, { fout: "Er moet minstens één beheerder blijven." });
      const { error } = await db.from("beheerders").delete().eq("user_id", body.user_id);
      if (error) throw error;
      return antwoord(200, { ok: true, bericht: "Beheerdersrechten ingetrokken. Het account zelf bestaat nog." });
    }

    // ---------- Mails over planning en finale ----------
    if (actie === "planning_mail" || actie === "finale_mail") {
      const { data: inst } = await db.from("instellingen").select("seizoen").single();
      const dagQ = db.from("speeldagen").select("*").eq("seizoen", inst!.seizoen);
      const { data: dag } = actie === "finale_mail" ? await dagQ.eq("code", "F").single() : await dagQ.eq("id", body.speeldag_id).single();
      if (!dag) return antwoord(404, { fout: "Speeldag niet gevonden." });
      let wq = db.from("wedstrijden").select("*").eq("speeldag_id", dag.id);
      if (body.categorie) wq = wq.eq("categorie", body.categorie);
      const { data: weds } = await wq;
      const { data: ploegen } = await db.from("ploegen").select("id,school_id,categorie").eq("seizoen", inst!.seizoen);
      const { data: scholen } = await db.from("scholen").select("id,naam,email,contact_voornaam").eq("status", "actief");
      const { data: plan } = await db.from("dagplanning").select("*").eq("speeldag_id", dag.id);
      const { data: fin } = await db.from("finalisten").select("*").eq("seizoen", inst!.seizoen);
      const schoolVan = (pid: string | null) => ploegen?.find((p) => p.id === pid)?.school_id;
      const naam = (pid: string | null) => scholen?.find((s) => s.id === schoolVan(pid))?.naam ?? "nog te bepalen";
      const perSchool: Record<string, string[]> = {};
      for (const m of weds ?? []) for (const [mijn, tegen] of [[m.thuis_ploeg_id, m.uit_ploeg_id], [m.uit_ploeg_id, m.thuis_ploeg_id]]) {
        const sid = schoolVan(mijn); if (!sid) continue;
        const min = plan?.find((p) => p.categorie === m.categorie)?.minuten_helft;
        (perSchool[sid] ??= []).push(`U${m.categorie}: ${tijd(m.aftrap)} op veld ${m.veld ?? "?"} tegen ${naam(tegen)}${min ? ` (2 × ${min}')` : ""}${m.klassement ? " – klassementswedstrijd" : ""}`);
      }
      let n = 0;
      for (const [sid, regels] of Object.entries(perSchool)) {
        const s = scholen?.find((x) => x.id === sid); if (!s) continue;
        let tekst: string, onderwerp: string;
        if (actie === "finale_mail") {
          const vrij = fin?.some((f) => f.vrijgeleide && schoolVan(f.ploeg_id) === sid);
          const dl = new Date(dag.datum + "T12:00:00"); dl.setDate(dl.getDate() - (vrij ? 2 : 7));
          onderwerp = "Finale Verbroedering Schoolcup";
          tekst = `Beste ${s.contact_voornaam ?? "collega"},\n\nProficiat! ${s.naam} speelt de finale op ${datumNL(dag.datum)}${vrij ? " (met een vrijgeleide)" : ""}:\n${regels.map((r) => "• " + r).join("\n")}\n\nVul in het portaal de verantwoordelijke, de coach(es) en de selectie in vóór ${dl.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" })} om 12:00. Anders gaat de plaats naar de volgende ploeg in het klassement.\nOp de finaledag geldt geen joker.\n\n${site}${GROET}`;
        } else {
          onderwerp = `Planning ${dag.code === "F" ? "finale" : "speeldag " + dag.code} aangepast`;
          tekst = `Beste ${s.contact_voornaam ?? "collega"},\n\nDe planning van ${datumNL(dag.datum)} is aangepast. De nieuwe uren voor ${s.naam}:\n${regels.map((r) => "• " + r).join("\n")}\n\nAlles staat ook in het portaal: ${site}${GROET}`;
        }
        if (await mail(s.email, onderwerp, tekst)) n++;
      }
      return antwoord(200, { ok: true, bericht: `${n} school/scholen verwittigd per mail.` });
    }

    // ---------- Acties op een school ----------
    const { data: s } = await db.from("scholen").select("*").eq("id", body.school_id).maybeSingle();
    if (!s) return antwoord(404, { fout: "School niet gevonden." });

    if (actie === "goedkeuren") {
      if (s.status !== "aanvraag") return antwoord(409, { fout: "Deze aanvraag is al behandeld." });
      const { data: inv, error: e1 } = await db.auth.admin.inviteUserByEmail(s.email, { redirectTo: `${site}/wachtwoord.html`, data: { school: s.naam, voornaam: s.contact_voornaam ?? "" } });
      if (e1 || !inv?.user) return antwoord(400, { fout: `Uitnodiging mislukt: ${e1?.message ?? "onbekende fout"}` });
      const { error: e2 } = await db.from("school_gebruikers").insert({ user_id: inv.user.id, school_id: s.id });
      if (e2) throw e2;
      const { error: e3 } = await db.from("scholen").update({ status: "actief" }).eq("id", s.id);
      if (e3) throw e3;
      const { data: inst } = await db.from("instellingen").select("seizoen").single();
      if (s.gewenste_ploegen?.length) {
        const { error: e4 } = await db.from("ploegen").upsert(s.gewenste_ploegen.map((c: number) => ({ school_id: s.id, seizoen: inst!.seizoen, categorie: c })), { onConflict: "school_id,seizoen,categorie", ignoreDuplicates: true });
        if (e4) throw e4;
      }
      return antwoord(200, { ok: true, bericht: `${s.naam} is goedgekeurd. De uitnodiging is gemaild naar ${s.email}.` });
    }
    if (actie === "afwijzen") {
      if (s.status !== "aanvraag") return antwoord(409, { fout: "Deze aanvraag is al behandeld." });
      const { error } = await db.from("scholen").update({ status: "afgewezen" }).eq("id", s.id);
      if (error) throw error;
      await mail(s.email, "Je aanvraag voor de Verbroedering Schoolcup", `Beste ${s.contact_voornaam ?? "collega"},\n\nWe kunnen de aanvraag van ${s.naam} dit seizoen helaas niet aanvaarden. Neem gerust contact op als je meer uitleg wil.${GROET}`);
      return antwoord(200, { ok: true, bericht: `De aanvraag van ${s.naam} is afgewezen; de school kreeg een mail.` });
    }
    if (actie === "nieuwe_link") {
      if (s.status !== "actief") return antwoord(409, { fout: "Enkel voor actieve scholen." });
      const { error } = await db.auth.resetPasswordForEmail(s.email, { redirectTo: `${site}/wachtwoord.html` });
      if (error) return antwoord(400, { fout: `Versturen mislukt: ${error.message}` });
      return antwoord(200, { ok: true, bericht: `Een nieuwe aanmeldlink is gemaild naar ${s.email}.` });
    }
    return antwoord(400, { fout: "Onbekende actie." });
  } catch (e) {
    console.error(e);
    return antwoord(500, { fout: "Er liep iets mis. Bekijk de logs van de Edge Function in Supabase." });
  }
});
