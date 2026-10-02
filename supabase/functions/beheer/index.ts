// Edge Function "beheer" – Schoolcup-portaal
// Acties van de beheerder: aanvraag goedkeuren (account + uitnodiging), afwijzen, nieuwe aanmeldlink sturen.
// Instelling in Supabase: "Verify JWT" UIT – deze functie controleert zelf of de aanroeper beheerder is.
import { createClient } from "npm:@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};
const antwoord = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...cors, "Content-Type": "application/json" } });

async function mail(aan: string, onderwerp: string, tekst: string) {
  const r = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: { Authorization: `Bearer ${Deno.env.get("RESEND_API_KEY")}`, "Content-Type": "application/json" },
    body: JSON.stringify({ from: Deno.env.get("MAIL_FROM"), to: [aan], reply_to: Deno.env.get("MAIL_REPLY_TO") || undefined, subject: onderwerp, text: tekst }),
  });
  if (!r.ok) console.error("Resend-fout", r.status, await r.text());
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwoord(405, { fout: "Niet toegelaten." });
  try {
    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    // 1. Wie roept aan? Enkel beheerders.
    const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
    const { data: { user } } = await db.auth.getUser(token);
    if (!user) return antwoord(401, { fout: "Je bent niet (meer) aangemeld. Meld opnieuw aan." });
    const { data: isBeheerder } = await db.from("beheerders").select("user_id").eq("user_id", user.id).maybeSingle();
    if (!isBeheerder) return antwoord(403, { fout: "Enkel de beheerder kan dit doen." });

    // 2. Welke school?
    const { actie, school_id } = await req.json();
    const { data: s } = await db.from("scholen").select("*").eq("id", school_id).maybeSingle();
    if (!s) return antwoord(404, { fout: "School niet gevonden." });
    const site = (Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
    if (!site) return antwoord(500, { fout: "SITE_URL is niet ingesteld bij de Edge Function secrets." });

    if (actie === "goedkeuren") {
      if (s.status !== "aanvraag") return antwoord(409, { fout: "Deze aanvraag is al behandeld." });
      const { data: inv, error: e1 } = await db.auth.admin.inviteUserByEmail(s.email, {
        redirectTo: `${site}/wachtwoord.html`,
        data: { school: s.naam, voornaam: s.contact_voornaam ?? "" },
      });
      if (e1 || !inv?.user) return antwoord(400, { fout: `Uitnodiging mislukt: ${e1?.message ?? "onbekende fout"}` });

      const { error: e2 } = await db.from("school_gebruikers").insert({ user_id: inv.user.id, school_id: s.id });
      if (e2) throw e2;
      const { error: e3 } = await db.from("scholen").update({ status: "actief" }).eq("id", s.id);
      if (e3) throw e3;
      const { data: inst } = await db.from("instellingen").select("seizoen").single();
      if (s.gewenste_ploegen?.length) {
        const { error: e4 } = await db.from("ploegen").upsert(
          s.gewenste_ploegen.map((c: number) => ({ school_id: s.id, seizoen: inst!.seizoen, categorie: c })),
          { onConflict: "school_id,seizoen,categorie", ignoreDuplicates: true });
        if (e4) throw e4;
      }
      return antwoord(200, { ok: true, bericht: `${s.naam} is goedgekeurd. De uitnodiging is gemaild naar ${s.email}.` });
    }

    if (actie === "afwijzen") {
      if (s.status !== "aanvraag") return antwoord(409, { fout: "Deze aanvraag is al behandeld." });
      const { error } = await db.from("scholen").update({ status: "afgewezen" }).eq("id", s.id);
      if (error) throw error;
      await mail(s.email, "Je aanvraag voor de Verbroedering Schoolcup",
`Beste ${s.contact_voornaam ?? "collega"},

We kunnen de aanvraag van ${s.naam} dit seizoen helaas niet aanvaarden. Neem gerust contact op als je meer uitleg wil.

Sportieve groeten,
TVJO Verbroedering Zwijndrecht`);
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
