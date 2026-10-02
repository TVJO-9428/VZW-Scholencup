// Edge Function "aanvraag" – Schoolcup-portaal
// Ontvangt een aanvraag van een school, bewaart ze en stuurt twee mails.
// Instelling in Supabase: "Verify JWT" UIT (publieke pagina zonder login).
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
    body: JSON.stringify({
      from: Deno.env.get("MAIL_FROM"),
      to: [aan],
      reply_to: Deno.env.get("MAIL_REPLY_TO") || undefined,
      subject: onderwerp,
      text: tekst,
    }),
  });
  if (!r.ok) console.error("Resend-fout", r.status, await r.text());
}

const schoon = (v: unknown, max: number) => String(v ?? "").trim().slice(0, max);

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors });
  if (req.method !== "POST") return antwoord(405, { fout: "Niet toegelaten." });
  try {
    const b = await req.json();
    if (b.website) return antwoord(200, { ok: true }); // spamrobot

    const naam = schoon(b.naam, 100), gemeente = schoon(b.gemeente, 60);
    const voornaam = schoon(b.voornaam, 60), achternaam = schoon(b.achternaam, 60);
    const email = schoon(b.email, 120).toLowerCase();
    const ruw: unknown[] = Array.isArray(b.ploegen) ? b.ploegen : [];
    const ploegen: number[] = [...new Set(ruw.map((x) => Number(x)))].filter((u) => u >= 8 && u <= 12).sort((a, c) => a - c);
    if (naam.length < 2 || !voornaam || !achternaam || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) {
      return antwoord(400, { fout: "Vul de naam van de school, de contactpersoon en een geldig e-mailadres in." });
    }

    const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { data: bestaand } = await db.from("scholen").select("id").eq("email", email).maybeSingle();
    if (bestaand) return antwoord(409, { fout: "Er bestaat al een aanvraag of account met dit e-mailadres. Neem contact op met de club als je hulp nodig hebt." });

    // Eenvoudige rem tegen misbruik: maximaal 20 aanvragen per uur.
    const { count } = await db.from("scholen").select("id", { count: "exact", head: true })
      .gte("aangevraagd_op", new Date(Date.now() - 3600_000).toISOString());
    if ((count ?? 0) >= 20) return antwoord(429, { fout: "Er zijn momenteel te veel aanvragen. Probeer het later opnieuw." });

    const { error } = await db.from("scholen").insert({
      naam, gemeente, contact_voornaam: voornaam, contact_naam: achternaam, email, status: "aanvraag", gewenste_ploegen: ploegen,
    });
    if (error) throw error;

    const lijst = ploegen.map((u) => "U" + u).join(", ") || "nog geen gekozen";
    await mail(email, "Je aanvraag voor de Verbroedering Schoolcup is ontvangen",
`Beste ${voornaam},

We ontvingen de aanvraag van ${naam} voor de Verbroedering Schoolcup.
Gewenste ploegen: ${lijst}.

Na goedkeuring krijg je een mail om je wachtwoord te kiezen en aan te melden in het portaal.

Met de inschrijving gaan de school en de spelers akkoord met de clubregels en de beeldregeling van Verbroedering Zwijndrecht (zie website).

Sportieve groeten,
TVJO Verbroedering Zwijndrecht`);

    const beheer = Deno.env.get("BEHEER_EMAIL");
    if (beheer) await mail(beheer, `Nieuwe aanvraag Schoolcup: ${naam}`,
`Nieuwe aanvraag in het Schoolcup-portaal.

School: ${naam}${gemeente ? " (" + gemeente + ")" : ""}
Contact: ${voornaam} ${achternaam}, ${email}
Gewenste ploegen: ${lijst}

Keur goed of wijs af via het portaal (aanmelden als beheerder).`);

    return antwoord(200, { ok: true });
  } catch (e) {
    console.error(e);
    return antwoord(500, { fout: "Er liep iets mis bij het versturen. Probeer het later opnieuw." });
  }
});
