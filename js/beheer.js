// Beheerdersschermen (fase 4).
import { sb, esc, melding, functie } from "./supabase.js";
import { CATS, FORMAT, fmtD, fmtK, tijd, toMin, hhmm, fout, tabs, laadContext, opgelost, uitslag, standTabel, jokerStatus, coachRegel } from "./gemeen.js";
import { maakReeks, planDag } from "./planning.js";

export async function startBeheer(ctx, el, msg) {
  const st = { tab: (location.hash || "#aanvragen").slice(1), dagId: null, bewerk: null };
  let scholen = [], ss = [], coaches = [], spelers = [];

  async function laad() {
    Object.assign(ctx, await laadContext());
    const r = await Promise.all([
      sb.from("scholen").select("*").order("naam"),
      sb.from("school_speeldag").select("*"),
      sb.from("coaches").select("*"),
      sb.from("spelers").select("id,ploeg_id"),
    ]);
    r.forEach((x) => fout(x.error));
    [scholen, ss, coaches, spelers] = r.map((x) => x.data);
  }
  const actief = () => scholen.filter((s) => s.status === "actief");
  const ploegenVan = (sid) => ctx.ploegen.filter((p) => p.school_id === sid).sort((a, b) => a.categorie - b.categorie);
  const kernAantal = (pid) => spelers.filter((s) => s.ploeg_id === pid).length;
  const catsMetReeks = () => CATS.filter((u) => ctx.ploegen.filter((p) => p.categorie === u).length >= 2);
  const kiesDag = (incl = false) => { const lijst = incl ? ctx.dagen : ctx.comp; if (!st.dagId || !lijst.some((d) => d.id === st.dagId)) { const vd = ctx.volgendeDag(); st.dagId = vd && (incl || vd.code !== "F") ? vd.id : lijst[0]?.id; } return ctx.dag(st.dagId); };
  const dagTabs = (incl = false) => tabs((incl ? ctx.dagen : ctx.comp).map((d) => [d.id, ctx.dagLabel(d)]), st.dagId, "data-dag");
  const label = (m, k) => (m[k + "_ploeg_id"] ? ctx.naamPloeg(m[k + "_ploeg_id"]) : `nr. ${m["rang_" + k]}`);

  // ---------- Aanvragen ----------
  function vAanvragen() {
    const a = scholen.filter((s) => s.status === "aanvraag");
    return `<div class="vlak"><h3 style="margin-top:0">Openstaande aanvragen</h3><div class="kaartlijst">${a.length ? a.map((s) => `
      <div class="aanvraagkaart"><b>${esc(s.naam)}</b> ${s.gemeente ? "(" + esc(s.gemeente) + ")" : ""}<br>${esc(s.contact_voornaam)} ${esc(s.contact_naam)} · ${esc(s.email)}<br>
      Gewenste ploegen: ${(s.gewenste_ploegen || []).map((u) => "U" + u).join(", ") || "—"} · aangevraagd ${new Date(s.aangevraagd_op).toLocaleDateString("nl-BE")}
      <div class="rij" style="margin-top:8px"><button class="knop groen klein" data-actie="goedkeuren" data-id="${s.id}" data-naam="${esc(s.naam)}">Goedkeuren en uitnodigen</button>
      <button class="knop gevaar klein" data-actie="afwijzen" data-id="${s.id}" data-naam="${esc(s.naam)}">Afwijzen</button></div></div>`).join("") : "<p>Geen openstaande aanvragen.</p>"}</div></div>`;
  }

  // ---------- Scholen ----------
  function vScholen() {
    const totaal = actief().reduce((n, s) => n + ploegenVan(s.id).reduce((m, p) => m + kernAantal(p.id), 0), 0);
    return `<div class="vlak"><h3 style="margin-top:0">Actieve scholen</h3><div class="scroll"><table><thead><tr><th>School</th><th>Contact</th>${CATS.map((u) => `<th class="num">U${u}</th>`).join("")}<th>Bevestigd</th><th>Joker</th><th></th></tr></thead><tbody>
      ${actief().map((s) => {
        if (st.bewerk === s.id) return `<tr><td colspan="${CATS.length + 5}"><form class="rij" data-bewerk="${s.id}" novalidate>
          <input type="text" name="naam" value="${esc(s.naam)}" aria-label="Naam school"><input type="text" name="gemeente" value="${esc(s.gemeente || "")}" placeholder="Gemeente" aria-label="Gemeente">
          <input type="text" name="vn" value="${esc(s.contact_voornaam || "")}" placeholder="Voornaam contact" aria-label="Voornaam contact"><input type="text" name="an" value="${esc(s.contact_naam || "")}" placeholder="Naam contact" aria-label="Naam contact">
          <button class="knop klein" type="submit">Opslaan</button><button class="knop licht klein" type="button" data-act="annuleer">Annuleren</button></form></td></tr>`;
        const js = jokerStatus(ctx, s.id, ss);
        return `<tr><td><b>${esc(s.naam)}</b><br><small>${esc(s.email)}</small></td><td>${esc(s.contact_voornaam || "")} ${esc(s.contact_naam || "")}</td>
          ${CATS.map((u) => { const p = ploegenVan(s.id).find((x) => x.categorie === u); return `<td class="num"><button class="vak ${p ? "aan" : ""}" data-ploeg="${u}" data-school="${s.id}" title="${p ? "Uitschrijven" : "Inschrijven"}">${p ? kernAantal(p.id) : "–"}</button></td>`; }).join("")}
          <td>${s.ploegen_bevestigd ? "✓" : "—"}</td><td>${js.joker ? "ingezet" : "beschikbaar"}</td>
          <td class="rij"><button class="knop licht klein" data-act="bewerk" data-id="${s.id}">Bewerken</button><button class="knop licht klein" data-actie="nieuwe_link" data-id="${s.id}" data-naam="${esc(s.naam)}">Aanmeldlink</button></td></tr>`;
      }).join("") || `<tr><td colspan="${CATS.length + 5}">Nog geen actieve scholen.</td></tr>`}</tbody></table></div>
      <p class="klein-grijs">Getal = spelers in de kern; klik om een ploeg in of uit te schrijven (de beheerder mag dit ook na de deadline). Aandenkens te voorzien: <b>${totaal}</b>.</p></div>`;
  }

  // ---------- Planning ----------
  function vPlanning() {
    const dag = kiesDag(); if (!dag) return `<div class="vlak"><p>Geen speeldagen.</p></div>`;
    let h = `<div class="vlak"><div class="rij" style="justify-content:space-between"><h3 style="margin:0">Speelschema</h3><button class="knop" data-act="genereer">Volledig speelschema (opnieuw) genereren</button></div>
      <p class="klein-grijs">Genereren verdeelt per categorie alle wedstrijden (iedereen 2× tegen iedereen) over de speeldagen. Bestaande wedstrijden en uitslagen van die categorieën worden vervangen.</p></div>
      <div class="vlak">${dagTabs()}<p>Instellingen voor <b>${esc(fmtD(dag.dt))}</b>. Herberekenen wijzigt enkel uren en velden van deze dag. Klassementswedstrijden (nr. 1 – nr. 2, nr. 3 – nr. 4) kunnen enkel op de dag waarop de dubbele competitie rond is.</p></div>`;
    catsMetReeks().forEach((u) => {
      const c = ctx.cfg(dag.id, u), ms = opgelost(ctx, u).filter((m) => m.speeldag_id === dag.id).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0) || String(a.veld).localeCompare(String(b.veld)));
      const rrKlaar = !ctx.wedstrijden.some((m) => m.categorie === u && !m.klassement && ctx.dag(m.speeldag_id).dt > dag.dt);
      const slot = 2 * c.minuten_helft + c.rust + c.wissel, laatste = Math.max(-1, ...ms.map((m) => m.slot ?? -1)), eind = hhmm(toMin(tijd(c.start)) + (laatste + 1) * slot), past = toMin(eind) <= toMin(tijd(c.eind));
      h += `<div class="vlak"><h3 style="margin-top:0">U${u} <small>${FORMAT[u].fmt} · ${ctx.ploegen.filter((p) => p.categorie === u).length} ploegen${c.gewijzigd_op ? " · aangepast " + new Date(c.gewijzigd_op).toLocaleDateString("nl-BE") : ""}</small></h3>
        <form class="rij" data-plan="${u}" novalidate>
          <label>Start <input type="time" name="start" value="${tijd(c.start)}"></label><label>Uiterlijk einde <input type="time" name="eind" value="${tijd(c.eind)}"></label>
          <label>Min./helft <input type="number" name="minuten_helft" min="5" max="30" value="${c.minuten_helft}"></label><label>Rust <input type="number" name="rust" min="0" max="15" value="${c.rust}"></label>
          <label>Wissel <input type="number" name="wissel" min="0" max="30" value="${c.wissel}"></label>
          <label>Velden <select name="velden">${[1, 2, 3, 4].map((n) => `<option ${c.velden == n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <label>Klassementsrondes <select name="extra_rondes" ${rrKlaar ? "" : "disabled"}>${[0, 1, 2].map((n) => `<option ${c.extra_rondes == n ? "selected" : ""}>${n}</option>`).join("")}</select></label>
          <button class="knop groen klein" type="submit">Opslaan en herberekenen</button></form>
        <p>${ms.filter((m) => !m.klassement).length} reguliere${ms.some((m) => m.klassement) ? " + " + ms.filter((m) => m.klassement).length + " klassementswedstrijden" : " wedstrijden"} · einde <b>${eind}</b> <span class="badge ${past ? "ok" : "fout"}">${past ? "past in het tijdvenster" : "loopt uit tot na " + tijd(c.eind)}</span></p>
        <div class="scroll"><table>${ms.map((m) => `<tr><td class="tijd">${tijd(m.aftrap)}</td><td>veld ${esc(m.veld || "")}</td><td>${esc(label(m, "thuis"))} – ${esc(label(m, "uit"))}${m.klassement ? ` <span class="badge let">klassement</span>` : ""}</td></tr>`).join("") || `<tr><td>Nog geen wedstrijden op deze dag.</td></tr>`}</table></div></div>`;
    });
    if (!catsMetReeks().length) h += `<div class="melding">Nog geen categorie met minstens twee ploegen.</div>`;
    return h;
  }

  async function planDagOpslaan(u, dagId) {
    const dag = ctx.dag(dagId), cfg = ctx.cfg(dagId, u);
    const regs = ctx.wedstrijden.filter((m) => m.categorie === u && m.speeldag_id === dagId && !m.klassement);
    const rrKlaar = !ctx.wedstrijden.some((m) => m.categorie === u && !m.klassement && ctx.dag(m.speeldag_id).dt > dag.dt);
    const res = planDag(regs, cfg, ctx.ploegen.filter((p) => p.categorie === u).length, rrKlaar);
    if (res.regulier.length) fout((await sb.from("wedstrijden").upsert(res.regulier)).error);
    fout((await sb.from("wedstrijden").delete().eq("categorie", u).eq("speeldag_id", dagId).eq("klassement", true)).error);
    if (res.extra.length) fout((await sb.from("wedstrijden").insert(res.extra.map((x) => ({ ...x, speeldag_id: dagId, categorie: u, klassement: true })))).error);
  }

  async function genereerAlles() {
    const comp = ctx.comp.map((d) => d.id);
    for (const u of catsMetReeks()) {
      fout((await sb.from("wedstrijden").delete().eq("categorie", u).in("speeldag_id", comp)).error);
      const reeks = maakReeks(ctx.ploegen.filter((p) => p.categorie === u).map((p) => p.id), comp);
      if (reeks === null) throw new Error(`Geen geldige verdeling gevonden voor U${u}.`);
      if (reeks.length) fout((await sb.from("wedstrijden").insert(reeks.map((r) => ({ speeldag_id: r.dagId, categorie: u, thuis_ploeg_id: r.thuis, uit_ploeg_id: r.uit, ronde: r.ronde })))).error);
    }
    Object.assign(ctx, await laadContext());
    for (const u of catsMetReeks()) for (const d of ctx.comp) await planDagOpslaan(u, d.id);
    await herberekenForfaits();
  }

  // ---------- Aanwezigheid ----------
  function vAanwezigheid() {
    const dag = kiesDag(true); if (!dag) return "";
    return `<div class="vlak">${dagTabs(true)}<p>Registreer op de dag zelf of de verantwoordelijke van elke school aanwezig is. Een eerste afwezigheid op een competitiespeeldag zet de joker in; daarna volgt forfait (0–5). Op de finaledag geldt geen joker.</p>
      <div class="scroll"><table><thead><tr><th>School</th><th>Verantwoordelijke</th><th>Coaches</th><th>Aanwezig</th><th>Gevolg</th></tr></thead><tbody>
      ${actief().map((s) => {
        const r = ss.find((x) => x.school_id === s.id && x.speeldag_id === dag.id) || {};
        const pl = ploegenVan(s.id).filter((p) => dag.code === "F" || ctx.wedstrijden.some((m) => m.speeldag_id === dag.id && (m.thuis_ploeg_id === p.id || m.uit_ploeg_id === p.id)));
        const dc = coaches.filter((c) => c.speeldag_id === dag.id), cr = coachRegel(pl.map((p) => p.id), dc, r);
        const co = pl.map((p) => { const c = dc.filter((x) => x.ploeg_id === p.id); return `U${p.categorie}: ${c.length ? c.map((x) => esc(x.voornaam + " " + x.naam)).join(", ") : cr.auto === p.id ? `<em>${esc(r.verantw_voornaam + " " + r.verantw_naam)} (verantw.)</em>` : `<span class="rood">—</span>`}`; }).join("<br>") || "—";
        const gevolg = jokerStatus(ctx, s.id, ss).res[dag.id];
        return `<tr><td>${esc(s.naam)}</td><td>${r.verantw_voornaam ? esc(r.verantw_voornaam + " " + r.verantw_naam) + (r.verantw_lo ? " (LO)" : "") : `<span class="rood">niet ingevuld</span>`}</td><td><small>${co}</small></td>
          <td><select data-aanw="${s.id}" aria-label="Aanwezigheid ${esc(s.naam)}"><option value="" ${!r.aanwezig ? "selected" : ""}>—</option><option value="ja" ${r.aanwezig === "ja" ? "selected" : ""}>aanwezig</option><option value="nee" ${r.aanwezig === "nee" ? "selected" : ""}>afwezig</option></select></td>
          <td>${gevolg === "joker" ? "joker ingezet" : gevolg === "forfait" ? `<span class="rood">forfait</span>` : ""}</td></tr>`;
      }).join("")}</tbody></table></div></div>`;
  }

  async function herberekenForfaits() {
    const status = Object.fromEntries(actief().map((s) => [s.id, jokerStatus(ctx, s.id, ss).res]));
    const wijzig = ctx.wedstrijden.filter((m) => m.thuis_ploeg_id && m.uit_ploeg_id).map((m) => {
      const ft = status[ctx.schoolVan(m.thuis_ploeg_id)]?.[m.speeldag_id] === "forfait", fu = status[ctx.schoolVan(m.uit_ploeg_id)]?.[m.speeldag_id] === "forfait";
      const f = ft && fu ? "beide" : ft ? "thuis" : fu ? "uit" : null;
      return f !== (m.forfait ?? null) ? { ...m, forfait: f } : null;
    }).filter(Boolean);
    if (wijzig.length) fout((await sb.from("wedstrijden").upsert(wijzig)).error);
  }

  // ---------- Uitslagen ----------
  function vUitslagen() {
    const dag = kiesDag(); if (!dag) return "";
    return `<div class="vlak">${dagTabs()}${catsMetReeks().map((u) => { const ms = opgelost(ctx, u).filter((m) => m.speeldag_id === dag.id).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)); if (!ms.length) return "";
      return `<h3>U${u}</h3><div class="scroll"><table>${ms.map((m) => { const x = uitslag(m), dicht = !!(m.forfait || !m.thuis_ploeg_id);
        return `<tr><td class="tijd">${tijd(m.aftrap)}</td><td style="text-align:right">${esc(label(m, "thuis"))}</td>
          <td style="white-space:nowrap"><input class="score" type="number" min="0" data-score="${m.id}" data-kant="doelpunten_thuis" value="${m.doelpunten_thuis ?? ""}" aria-label="Doelpunten ${esc(label(m, "thuis"))}" ${dicht ? "disabled" : ""}> – <input class="score" type="number" min="0" data-score="${m.id}" data-kant="doelpunten_uit" value="${m.doelpunten_uit ?? ""}" aria-label="Doelpunten ${esc(label(m, "uit"))}" ${dicht ? "disabled" : ""}></td>
          <td>${esc(label(m, "uit"))}${m.klassement ? ` <span class="badge let">klassement</span>` : ""}</td><td>${m.forfait ? `<small class="rood">forfait (${x?.dubbel ? "beide" : "afwezigheid"})</small>` : !m.thuis_ploeg_id ? `<small>bekend na de reguliere wedstrijden</small>` : ""}</td></tr>`; }).join("")}</table></div>`; }).join("") || "<p>Geen wedstrijden op deze dag.</p>"}</div>`;
  }

  // ---------- Klassementen ----------
  function vKlassementen() {
    return `<div class="grid">${catsMetReeks().map((u) => `<div class="vlak kaart"><h3>U${u} <small>${FORMAT[u].fmt}</small></h3>${standTabel(ctx, u)}</div>`).join("") || `<div class="vlak"><p>Nog geen reeksen.</p></div>`}</div>`;
  }

  // ---------- Instellingen (testklok) ----------
  function vInstellingen() {
    const t = ctx.test ? new Date(ctx.test) : null, lok = (d) => new Date(d.getTime() - d.getTimezoneOffset() * 60000).toISOString().slice(0, 16);
    return `<div class="vlak" style="max-width:760px"><h3 style="margin-top:0">Testklok</h3>
      <p>Om deadlines te testen kan je een gesimuleerde datum instellen. Het hele portaal (ook voor scholen) gedraagt zich dan alsof het die datum is. <b>Enkel gebruiken in de testomgeving.</b></p>
      <p>Nu: <b>${esc(ctx.nu.toLocaleString("nl-BE"))}</b> ${t ? `<span class="badge let">testdatum actief</span>` : `<span class="badge ok">echte tijd</span>`}</p>
      <form class="rij" id="fKlok" novalidate><input type="datetime-local" id="klok" value="${lok(t || ctx.nu)}" aria-label="Testdatum"><button class="knop" type="submit">Testdatum instellen</button><button class="knop licht" type="button" data-act="echtetijd">Terug naar echte tijd</button></form>
      <h3>Seizoen</h3><p>Seizoen ${ctx.seizoen}–${ctx.seizoen + 1} · ${ctx.dagen.map((d) => `${ctx.dagLabel(d)} ${fmtK(d.dt)}`).join(" · ")}</p></div>`;
  }

  function render() {
    const n = scholen.filter((s) => s.status === "aanvraag").length;
    const t = [["aanvragen", `Aanvragen${n ? " · " + n : ""}`], ["scholen", "Scholen"], ["planning", "Planning"], ["aanwezigheid", "Aanwezigheid"], ["uitslagen", "Uitslagen"], ["klassementen", "Klassementen"], ["instellingen", "Instellingen"]];
    if (!t.some(([k]) => k === st.tab)) st.tab = "aanvragen";
    const v = { aanvragen: vAanvragen, scholen: vScholen, planning: vPlanning, aanwezigheid: vAanwezigheid, uitslagen: vUitslagen, klassementen: vKlassementen, instellingen: vInstellingen }[st.tab]();
    el.innerHTML = `${tabs(t, st.tab)}${v}<p class="klein-grijs" style="margin-top:20px"><a href="reglement.html">Reglement &amp; afspraken</a></p>`;
  }

  async function doe(fn, ok) {
    try { melding(msg, "Bezig…", "blauw"); const r = await fn(); await laad(); render(); melding(msg, r || ok || "", "groen"); }
    catch (e) { melding(msg, e.message, "rood"); }
  }

  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab) { location.hash = b.dataset.tab; return; }
    if (b.dataset.dag) { st.dagId = +b.dataset.dag; render(); return; }
    if (b.dataset.actie) {
      const vraag = { goedkeuren: `${b.dataset.naam} goedkeuren en een uitnodiging mailen?`, afwijzen: `De aanvraag van ${b.dataset.naam} afwijzen?`, nieuwe_link: `Een nieuwe aanmeldlink mailen naar ${b.dataset.naam}?` }[b.dataset.actie];
      if (!confirm(vraag)) return;
      return doe(async () => (await functie("beheer", { actie: b.dataset.actie, school_id: b.dataset.id })).bericht);
    }
    if (b.dataset.act === "bewerk") { st.bewerk = b.dataset.id; render(); return; }
    if (b.dataset.act === "annuleer") { st.bewerk = null; render(); return; }
    if (b.dataset.ploeg) {
      const u = +b.dataset.ploeg, sid = b.dataset.school, p = ploegenVan(sid).find((x) => x.categorie === u), naam = scholen.find((s) => s.id === sid)?.naam;
      if (p) { const n = kernAantal(p.id); if (!confirm(`U${u} van ${naam} uitschrijven?${n ? ` De ${n} spelers worden verwijderd.` : ""}`)) return; return doe(async () => fout((await sb.from("ploegen").delete().eq("id", p.id)).error), `U${u} uitgeschreven.`); }
      if (!confirm(`U${u} inschrijven voor ${naam}?`)) return;
      return doe(async () => fout((await sb.from("ploegen").insert({ school_id: sid, seizoen: ctx.seizoen, categorie: u })).error), `U${u} ingeschreven. Vergeet niet het speelschema opnieuw te genereren.`);
    }
    if (b.dataset.act === "genereer") {
      if (ctx.wedstrijden.some((m) => m.doelpunten_thuis != null) && !confirm("Er zijn al uitslagen ingevuld. Die gaan verloren. Toch opnieuw genereren?")) return;
      if (!confirm("Het volledige speelschema (opnieuw) genereren?")) return;
      return doe(genereerAlles, "Speelschema gegenereerd.");
    }
    if (b.dataset.act === "echtetijd") return doe(async () => fout((await sb.from("instellingen").update({ test_nu: null }).eq("id", true)).error), "Terug naar de echte tijd.");
  });

  el.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (f.dataset.bewerk) return doe(async () => { fout((await sb.from("scholen").update({ naam: f.naam.value.trim(), gemeente: f.gemeente.value.trim() || null, contact_voornaam: f.vn.value.trim(), contact_naam: f.an.value.trim() }).eq("id", f.dataset.bewerk)).error); st.bewerk = null; }, "School bijgewerkt.");
    if (f.dataset.plan) {
      const u = +f.dataset.plan, num = (n) => Math.max(0, parseInt(f[n].value, 10) || 0);
      const rij = { speeldag_id: st.dagId, categorie: u, start: f.start.value, eind: f.eind.value, minuten_helft: Math.max(5, num("minuten_helft")), rust: num("rust"), wissel: num("wissel"), velden: +f.velden.value, extra_rondes: f.extra_rondes.disabled ? 0 : +f.extra_rondes.value, gewijzigd_op: new Date().toISOString() };
      if (ctx.wedstrijden.some((m) => m.categorie === u && m.speeldag_id === st.dagId && m.klassement && m.doelpunten_thuis != null) && !confirm("Uitslagen van klassementswedstrijden op deze dag gaan verloren. Doorgaan?")) return;
      return doe(async () => { fout((await sb.from("dagplanning").upsert(rij)).error); Object.assign(ctx, await laadContext()); await planDagOpslaan(u, st.dagId); }, `Planning U${u} herberekend. Laat de scholen weten dat de uren gewijzigd zijn.`);
    }
    if (f.id === "fKlok") { const v = f.klok.value; if (!v) return; return doe(async () => fout((await sb.from("instellingen").update({ test_nu: new Date(v).toISOString() }).eq("id", true)).error), "Testdatum ingesteld."); }
  });

  el.addEventListener("change", async (e) => {
    const c = e.target;
    if (c.dataset.aanw) {
      return doe(async () => { fout((await sb.from("school_speeldag").upsert({ school_id: c.dataset.aanw, speeldag_id: st.dagId, aanwezig: c.value || null }, { onConflict: "school_id,speeldag_id" })).error);
        const r = await sb.from("school_speeldag").select("*"); fout(r.error); ss = r.data; await herberekenForfaits(); }, "Aanwezigheid opgeslagen.");
    }
    if (c.dataset.score) {
      const m = opgelost(ctx, ctx.wedstrijden.find((x) => x.id === c.dataset.score).categorie).find((x) => x.id === c.dataset.score);
      const waarde = c.value === "" ? null : Math.max(0, parseInt(c.value, 10) || 0);
      const upd = { [c.dataset.kant]: waarde };
      if (m.klassement) { upd.thuis_ploeg_id = m.thuis_ploeg_id; upd.uit_ploeg_id = m.uit_ploeg_id; }
      try { fout((await sb.from("wedstrijden").update(upd).eq("id", m.id)).error); const raw = ctx.wedstrijden.find((x) => x.id === m.id); Object.assign(raw, upd); melding(msg, "Uitslag opgeslagen.", "groen"); }
      catch (err) { melding(msg, err.message, "rood"); }
    }
  });

  window.addEventListener("hashchange", () => { st.tab = location.hash.slice(1) || "aanvragen"; melding(msg, ""); render(); });

  await laad();
  render();
}
