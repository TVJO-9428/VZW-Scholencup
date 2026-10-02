// @ts-nocheck – eenvoudige JavaScript-stijl; geen strikte typecontrole nodig
// Edge Function "meldingen" – Schoolcup-portaal (fase 6)
// 1. Dagelijks (via pg_cron): herinneringen naar scholen met openstaande taken.
// 2. Beheerder: "proef" (toon welke mails vandaag zouden vertrekken) of "nu_versturen".
// 3. School: bevestigingsmail na het bevestigen van de ploegen.
// Instelling in Supabase: "Verify JWT" UIT. Secrets: CRON_SECRET (+ de bestaande mail-secrets).
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-secret",
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

const MIN: Record<number, number> = { 8: 8, 9: 8, 10: 12, 11: 12, 12: 12 };
const GROET = "\n\nSportieve groeten,\nTVJO Verbroedering Zwijndrecht";
const ymd = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Brussels", year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
const plus = (iso: string, n: number) => { const d = new Date(iso + "T12:00:00Z"); d.setUTCDate(d.getUTCDate() + n); return d.toISOString().slice(0, 10); };
const lang = (iso: string) => new Date(iso + "T12:00:00").toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" });

type Melding = { school: string; aan: string; soort: string; taken: string[]; status: string };

// deno-lint-ignore no-explicit-any
async function controleer(db: any, proef: boolean) {
  const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
  const { data: nuS } = await db.rpc("nu");
  const vandaag = ymd(new Date(String(nuS)));
  const { data: inst } = await db.from("instellingen").select("seizoen").single();
  const seizoen = inst!.seizoen;
  const { data: dagen } = await db.from("speeldagen").select("*").eq("seizoen", seizoen).order("datum");
  const comp = (dagen ?? []).filter((d) => d.code !== "F"), fin = (dagen ?? []).find((d) => d.code === "F");

  const momenten: { soort: string; datum: string; dag?: any }[] = [];
  if (comp[0]) { momenten.push({ soort: "ploegen", datum: plus(comp[0].datum, -17) }); momenten.push({ soort: "kern", datum: plus(comp[0].datum, -14) }); }
  comp.forEach((d) => momenten.push({ soort: "speeldag-" + d.code, datum: plus(d.datum, -5), dag: d }));
  if (fin) momenten.push({ soort: "finale", datum: plus(fin.datum, -9), dag: fin });
  const actueel = momenten.filter((m) => m.datum === vandaag);
  const volgende = momenten.filter((m) => m.datum > vandaag).sort((a, b) => a.datum.localeCompare(b.datum))[0];
  if (!actueel.length) return { vandaag, mails: [], bericht: `Vandaag (${vandaag}) zijn er geen herinneringen gepland.${volgende ? ` Volgende: ${volgende.soort} op ${volgende.datum}.` : ""}` };

  const [sch, pl, sp, ss, co, se, we, fi] = await Promise.all([
    db.from("scholen").select("*").eq("status", "actief"),
    db.from("ploegen").select("id,school_id,categorie").eq("seizoen", seizoen),
    db.from("spelers").select("id,ploeg_id"),
    db.from("school_speeldag").select("*"),
    db.from("coaches").select("*"),
    db.from("selecties").select("ploeg_id,speeldag_id"),
    db.from("wedstrijden").select("speeldag_id,thuis_ploeg_id,uit_ploeg_id"),
    db.from("finalisten").select("*").eq("seizoen", seizoen),
  ]);
  const ploegen = pl.data ?? [];
  const ploegDl = comp[0] ? lang(plus(comp[0].datum, -14)) : "", kernDl = comp[0] ? lang(plus(comp[0].datum, -7)) : "";
  const uit: Melding[] = [];

  for (const m of actueel) for (const s of sch.data ?? []) {
    const mijn = ploegen.filter((p) => p.school_id === s.id).sort((a, b) => a.categorie - b.categorie);
    const taken: string[] = [];
    let deadline = "";
    if (m.soort === "ploegen") {
      if (!mijn.length) taken.push("Duid de ploegen aan waarmee jullie deelnemen.");
      else if (!s.ploegen_bevestigd) taken.push(`Bevestig jullie ploegen (${mijn.map((p) => "U" + p.categorie).join(", ")}).`);
      deadline = `vóór ${ploegDl}`;
    } else if (m.soort === "kern") {
      for (const p of mijn) { const n = (sp.data ?? []).filter((x) => x.ploeg_id === p.id).length; if (n < MIN[p.categorie]) taken.push(`Kern U${p.categorie}: ${n} spelers (minstens ${MIN[p.categorie]} aanbevolen).`); }
      deadline = `vóór ${kernDl} (daarna wordt de kern bevroren)`;
    } else {
      const dag = m.dag;
      const opDag = m.soort === "finale"
        ? mijn.filter((p) => (fi.data ?? []).some((f) => f.ploeg_id === p.id))
        : mijn.filter((p) => (we.data ?? []).some((w) => w.speeldag_id === dag.id && (w.thuis_ploeg_id === p.id || w.uit_ploeg_id === p.id)));
      if (!opDag.length) continue;
      const r = (ss.data ?? []).find((x) => x.school_id === s.id && x.speeldag_id === dag.id);
      const lvOk = !!(r?.verantw_voornaam && r?.verantw_naam);
      if (!lvOk) taken.push("Vul de verantwoordelijke van de school in (bij voorkeur de leerkracht LO).");
      const zonder = opDag.filter((p) => !(co.data ?? []).some((c) => c.ploeg_id === p.id && c.speeldag_id === dag.id));
      if (!(zonder.length === 1 && lvOk)) zonder.forEach((p) => taken.push(`Vul de coach van U${p.categorie} in.`));
      opDag.forEach((p) => { if (!(se.data ?? []).some((x) => x.ploeg_id === p.id && x.speeldag_id === dag.id)) taken.push(`Kies de spelers voor het wedstrijdblad van U${p.categorie}.`); });
      deadline = `vóór ${lang(plus(dag.datum, m.soort === "finale" ? -7 : -2))} om 12:00`;
    }
    if (!taken.length) continue;
    const sleutel = `${seizoen}-${s.id}`;
    const { data: al } = await db.from("mail_log").select("id").eq("soort", m.soort).eq("sleutel", sleutel).maybeSingle();
    if (al) { uit.push({ school: s.naam, aan: s.email, soort: m.soort, taken, status: "al verstuurd" }); continue; }
    if (proef) { uit.push({ school: s.naam, aan: s.email, soort: m.soort, taken, status: "proef: zou verstuurd worden" }); continue; }
    const titel = m.soort === "ploegen" ? "ploegen bevestigen" : m.soort === "kern" ? "spelerskern aanvullen" : m.soort === "finale" ? "finale voorbereiden" : `speeldag ${m.soort.split("-")[1]} voorbereiden`;
    const ok = await mail(s.email, `Herinnering Schoolcup: ${titel}`, `Beste ${s.contact_voornaam ?? "collega"},\n\nNog te doen voor ${s.naam}, ${deadline}:\n${taken.map((t) => "• " + t).join("\n")}\n\nAanmelden: ${site}${GROET}`);
    if (ok) await db.from("mail_log").insert({ school_id: s.id, soort: m.soort, sleutel, aan: s.email });
    uit.push({ school: s.naam, aan: s.email, soort: m.soort, taken, status: ok ? "verstuurd" : "mislukt (zie logs)" });
  }
  return { vandaag, mails: uit, bericht: `${uit.length} herinnering(en) ${proef ? "in proef" : "verwerkt"} voor ${vandaag}.` };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwoord(405, { fout: "Niet toegelaten." });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);
    const body = await req.json().catch(() => ({}));
    const actie: string = body.actie ?? "";

    if (actie === "cron") {
      const geheim = Deno.env.get("CRON_SECRET");
      if (!geheim || req.headers.get("x-cron-secret") !== geheim) return antwoord(401, { fout: "Niet toegelaten." });
      return antwoord(200, await controleer(db, false));
    }

    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return antwoord(401, { fout: "Je bent niet (meer) aangemeld." });

    if (actie === "proef" || actie === "nu_versturen") {
      const { data: b } = await db.from("beheerders").select("user_id").eq("user_id", user.id).maybeSingle();
      if (!b) return antwoord(403, { fout: "Enkel de beheerder kan dit doen." });
      return antwoord(200, await controleer(db, actie === "proef"));
    }

    if (actie === "ploegen_bevestigd") {
      const { data: k } = await db.from("school_gebruikers").select("school_id").eq("user_id", user.id).maybeSingle();
      if (!k) return antwoord(403, { fout: "Geen school gekoppeld." });
      const { data: s } = await db.from("scholen").select("*").eq("id", k.school_id).single();
      const { data: inst } = await db.from("instellingen").select("seizoen").single();
      const { data: pl } = await db.from("ploegen").select("categorie").eq("school_id", s!.id).eq("seizoen", inst!.seizoen).order("categorie");
      const { data: d1 } = await db.from("speeldagen").select("datum").eq("seizoen", inst!.seizoen).eq("code", "1").maybeSingle();
      await mail(s!.email, "Bevestiging ploegen Verbroedering Schoolcup",
        `Beste ${s!.contact_voornaam ?? "collega"},\n\n${s!.naam} neemt deel met: ${(pl ?? []).map((p) => "U" + p.categorie).join(", ")}.\n${d1 ? `Vul nu per ploeg de spelerskern in vóór ${lang(plus(d1.datum, -7))}; daarna wordt de kern bevroren.\n` : ""}\n${(Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "")}${GROET}`);
      return antwoord(200, { ok: true });
    }
    return antwoord(400, { fout: "Onbekende actie." });
  } catch (e) {
    console.error(e);
    return antwoord(500, { fout: "Er liep iets mis. Bekijk de logs van de Edge Function in Supabase." });
  }
});
