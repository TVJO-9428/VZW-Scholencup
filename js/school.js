// Schooldashboard (fase 3).
import { sb, esc, melding } from "./supabase.js";
import { CATS, FORMAT, KERN_MAX, fmtD, fmtK, fmtDT, tijd, fout, tabs, klassement, opgelost, uitslag, standTabel, jokerStatus, coachRegel } from "./gemeen.js";

export async function startSchool(ctx, schoolId, el, msg) {
  const st = { tab: (location.hash || "#overzicht").slice(1), u: null, dagId: null };
  let school, spelers = [], ss = [], coaches = [], selecties = [];

  async function laad() {
    const r = await Promise.all([
      sb.from("scholen").select("*").eq("id", schoolId).single(),
      sb.from("spelers").select("*").order("naam"),
      sb.from("school_speeldag").select("*").eq("school_id", schoolId),
      sb.from("coaches").select("*"),
      sb.from("selecties").select("*"),
      sb.from("ploegen").select("id,school_id,categorie,seizoen"),
    ]);
    r.forEach((x) => fout(x.error));
    [school, spelers, ss, coaches, selecties] = r.slice(0, 5).map((x) => x.data);
    ctx.ploegen = r[5].data.filter((p) => p.seizoen === ctx.seizoen);
  }
  const mijnPloegen = () => ctx.ploegen.filter((p) => p.school_id === schoolId).sort((a, b) => a.categorie - b.categorie);
  const ploegVan = (u) => mijnPloegen().find((p) => p.categorie === u);
  const kern = (pid) => spelers.filter((s) => s.ploeg_id === pid);
  const nu = () => ctx.nu;
  const ploegenDicht = () => ctx.ploegDeadline && nu() >= ctx.ploegDeadline;
  const kernBevroren = () => ctx.kernBevriezing && nu() >= ctx.kernBevriezing;
  const dagBevroren = (dag) => nu() >= ctx.selDeadline(dag);
  const wedVan = (dagId) => mijnPloegen().flatMap((p) => opgelost(ctx, p.categorie).filter((m) => m.speeldag_id === dagId && (m.thuis_ploeg_id === p.id || m.uit_ploeg_id === p.id)).map((m) => ({ ...m, mijn: p })));
  const ploegenOpDag = (dagId) => mijnPloegen().filter((p) => ctx.wedstrijden.some((m) => m.speeldag_id === dagId && (m.thuis_ploeg_id === p.id || m.uit_ploeg_id === p.id)));
  const ssVan = (dagId) => ss.find((r) => r.speeldag_id === dagId);

  function taken() {
    const t = [];
    if (!mijnPloegen().length) return [{ txt: "Duid de ploegen aan waarmee jullie deelnemen", tab: "ploegen" }];
    if (!school.ploegen_bevestigd && !ploegenDicht()) t.push({ txt: `Bevestig je ploegen vóór ${fmtK(ctx.ploegDeadline)}`, tab: "ploegen" });
    if (!kernBevroren()) mijnPloegen().forEach((p) => { const n = kern(p.id).length; if (n < FORMAT[p.categorie].max) t.push({ txt: `Kern U${p.categorie}: ${n} spelers, minstens ${FORMAT[p.categorie].max} aanbevolen (vóór ${fmtK(ctx.kernBevriezing)})`, tab: "kern" }); });
    const vd = ctx.volgendeDag();
    if (vd && vd.code !== "F" && !dagBevroren(vd)) {
      const pl = ploegenOpDag(vd.id), s = ssVan(vd.id);
      if (!s?.verantw_voornaam || !s?.verantw_naam) t.push({ txt: `${ctx.dagLabel(vd)}: verantwoordelijke invullen`, tab: "speeldag" });
      const cr = coachRegel(pl.map((p) => p.id), coaches.filter((c) => c.speeldag_id === vd.id), s);
      cr.ontbrekend.forEach((pid) => t.push({ txt: `${ctx.dagLabel(vd)}: coach U${ctx.ploeg(pid).categorie} invullen${cr.ontbrekend.length > 1 ? " (de verantwoordelijke kan maar één ploeg overnemen)" : ""}`, tab: "speeldag" }));
      pl.forEach((p) => { if (!selecties.some((x) => x.ploeg_id === p.id && x.speeldag_id === vd.id)) t.push({ txt: `${ctx.dagLabel(vd)}: selectie U${p.categorie} (max. ${FORMAT[p.categorie].max})`, tab: "speeldag" }); });
    }
    return t;
  }

  // ---------- weergaven ----------
  function vOverzicht() {
    const tk = taken(), vd = ctx.volgendeDag(), js = jokerStatus(ctx, schoolId, ss);
    const ms = vd && vd.code !== "F" ? wedVan(vd.id).sort((a, b) => a.mijn.categorie - b.mijn.categorie || (a.slot ?? 0) - (b.slot ?? 0)) : [];
    return `<div class="grid">
      <div class="vlak kaart"><h3>Te doen</h3>${tk.length ? `<ul class="taken">${tk.map((x) => `<li><a href="#${x.tab}">${esc(x.txt)}</a></li>`).join("")}</ul>` : `<p class="okk">Alles in orde.</p>`}</div>
      <div class="vlak kaart"><h3>Belangrijke data</h3><ul class="data">
        ${ctx.ploegDeadline ? `<li><span>Ploegen aanpassen tot</span><b>${fmtK(ctx.ploegDeadline)}</b></li>` : ""}
        ${ctx.kernBevriezing ? `<li><span>Kern bevroren vanaf</span><b>${fmtK(ctx.kernBevriezing)}</b></li>` : ""}
        ${ctx.dagen.map((d) => `<li><span>${ctx.dagLabel(d)}</span><b>${fmtK(d.dt)}</b></li>`).join("")}</ul></div>
      <div class="vlak kaart"><h3>Volgende speeldag</h3>${vd ? `<p><b>${esc(fmtD(vd.dt))}</b></p>${ms.length ? `<table>${ms.map((m) => `<tr><td>U${m.mijn.categorie}</td><td class="tijd">${tijd(m.aftrap)}</td><td>veld ${esc(m.veld || "")}</td><td>tegen ${esc(ctx.naamPloeg(m.thuis_ploeg_id === m.mijn.id ? m.uit_ploeg_id : m.thuis_ploeg_id))}</td></tr>`).join("")}</table>` : `<p class="klein-grijs">${vd.code === "F" ? "De finalisten zijn bekend na de laatste speeldag." : "Het speelschema is nog niet bekend."}</p>`}` : "<p>Seizoen afgelopen.</p>"}</div>
      <div class="vlak kaart"><h3>Kernen</h3>${mijnPloegen().length ? `<table>${mijnPloegen().map((p) => { const n = kern(p.id).length; return `<tr><td>U${p.categorie}</td><td><div class="balk"><i style="width:${Math.min(100, (n / KERN_MAX) * 100)}%"></i></div></td><td class="num">${n}/${KERN_MAX}</td></tr>`; }).join("")}</table>` : "<p>Nog geen ploegen.</p>"}</div>
      <div class="vlak kaart"><h3>Klassement</h3>${mijnPloegen().length ? `<table>${mijnPloegen().map((p) => { const k = klassement(ctx, p.categorie); const i = k.rows.findIndex((r) => r.id === p.id); return `<tr><td>U${p.categorie}</td><td>${i + 1}e van ${k.rows.length}</td><td class="num">${k.rows[i]?.p ?? 0} ptn</td></tr>`; }).join("")}</table>` : "<p>—</p>"}</div>
      <div class="vlak kaart"><h3>Joker</h3><p class="${js.joker ? "letop" : "okk"}">${js.joker ? "ingezet op " + esc(ctx.dagLabel(js.joker).toLowerCase()) : "beschikbaar"}</p><p class="klein-grijs">Eén keer zonder verantwoordelijke op een competitiespeeldag. Niet op de finaledag.</p></div>
    </div>`;
  }

  function vPloegen() {
    const dicht = ploegenDicht();
    return `<div class="vlak"><h3 style="margin-top:0">Met welke ploegen neemt ${esc(school.naam)} deel?</h3>
      <p>Per categorie maximaal één ploeg. Je keuze bepaalt de spelerskernen, taken en het speelschema.</p>
      ${dicht ? `<div class="melding">Ploegen aanpassen kan niet meer sinds ${fmtD(ctx.ploegDeadline)}. Neem contact op met de TVJO.</div>` : `<div class="melding blauw">Aanpassen kan tot ${fmtD(ctx.ploegDeadline)}.${school.ploegen_bevestigd ? " Je keuze is bevestigd." : ""}</div>`}
      <div class="ploegkaarten">${CATS.map((u) => { const p = ploegVan(u), n = p ? kern(p.id).length : 0, andere = ctx.ploegen.filter((x) => x.categorie === u && x.school_id !== schoolId).length;
        return `<div class="ploegkaart ${p ? "aan" : ""}"><b>U${u}</b><span>${u - 6}de leerjaar · geboren ${ctx.seizoen + 1 - u}</span><span>${FORMAT[u].fmt} · max. ${FORMAT[u].max} op het wedstrijdblad</span><span>${andere} andere ${andere === 1 ? "school" : "scholen"} ingeschreven</span>${p && n ? `<span>${n} spelers in de kern</span>` : ""}
          <button class="knop ${p ? "licht" : "groen"} klein" data-ploeg="${u}" ${dicht ? "disabled" : ""}>${p ? "Uitschrijven" : "Inschrijven"}</button></div>`; }).join("")}</div>
      <div class="rij" style="margin-top:14px"><button class="knop" data-act="bevestig" ${dicht || !mijnPloegen().length ? "disabled" : ""}>${school.ploegen_bevestigd ? "Opnieuw bevestigen" : "Ploegen bevestigen"}</button></div></div>`;
  }

  function vKern() {
    const pl = mijnPloegen();
    if (!pl.length) return `<div class="vlak"><p>Nog geen ploegen. <a href="#ploegen">Duid eerst je ploegen aan.</a></p></div>`;
    if (!st.u || !ploegVan(st.u)) st.u = pl[0].categorie;
    const p = ploegVan(st.u), k = kern(p.id), vast = kernBevroren();
    return `<div class="vlak">${tabs(pl.map((x) => [x.categorie, `U${x.categorie} · ${kern(x.id).length}`]), st.u, "data-u")}
      ${vast ? `<div class="melding">Kern bevroren sinds ${fmtK(ctx.kernBevriezing)}. Aanvullen tot ${KERN_MAX} kan nog; een aanvulling is definitief.</div>` : `<div class="melding blauw">Wijzigen kan tot ${fmtD(ctx.kernBevriezing)}. U${st.u} = geboren in ${ctx.seizoen + 1 - st.u}; jongere kinderen mogen hoger spelen, oudere niet.</div>`}
      <h3>Kern U${st.u} <span class="badge ${k.length > KERN_MAX ? "fout" : "ok"}">${k.length} / ${KERN_MAX}</span></h3>
      <div class="scroll"><table><thead><tr><th>Voornaam</th><th>Naam</th><th class="num">Geboortejaar</th><th>Leerjaar</th><th></th></tr></thead><tbody>
      ${k.map((s) => `<tr><td>${esc(s.voornaam)}</td><td>${esc(s.naam)}${s.aangevuld_op ? ` <span class="badge">aangevuld ${new Date(s.aangevuld_op).toLocaleDateString("nl-BE")}</span>` : ""}</td><td class="num">${s.geboortejaar}</td><td>${s.leerjaar ?? "—"}</td><td>${vast ? `<span class="badge">vast</span>` : `<button class="knop licht klein" data-del="${s.id}">Verwijderen</button>`}</td></tr>`).join("") || `<tr><td colspan="5">Nog geen spelers.</td></tr>`}
      </tbody></table></div>
      ${k.length < KERN_MAX ? `<h3>${vast ? "Definitief aanvullen" : "Speler toevoegen"}</h3><form class="rij" id="fSpeler" novalidate>
        <input type="text" id="sVn" placeholder="Voornaam" aria-label="Voornaam" required><input type="text" id="sAn" placeholder="Naam" aria-label="Naam" required>
        <input type="number" id="sGj" placeholder="Geboortejaar" aria-label="Geboortejaar" style="width:8em" required>
        <select id="sLj" aria-label="Leerjaar">${[2, 3, 4, 5, 6].map((l) => `<option value="${l}" ${l === st.u - 6 ? "selected" : ""}>${l}de leerjaar</option>`).join("")}</select>
        <button class="knop groen" type="submit">${vast ? "Definitief toevoegen" : "Toevoegen"}</button></form>` : `<div class="melding">Kern volzet.</div>`}</div>`;
  }

  function vSpeeldag() {
    const dagen = ctx.comp;
    if (!dagen.length) return `<div class="vlak"><p>Nog geen speeldagen.</p></div>`;
    if (!st.dagId || !dagen.some((d) => d.id === st.dagId)) { const vd = ctx.volgendeDag(); st.dagId = vd && vd.code !== "F" ? vd.id : dagen[dagen.length - 1].id; }
    const dag = ctx.dag(st.dagId), bevr = dagBevroren(dag), dis = bevr ? "disabled" : "", s = ssVan(dag.id) || {};
    const pl = ploegenOpDag(dag.id).length ? ploegenOpDag(dag.id) : mijnPloegen();
    const dc = coaches.filter((c) => c.speeldag_id === dag.id), cr = coachRegel(pl.map((p) => p.id), dc, s), js = jokerStatus(ctx, schoolId, ss);
    let h = `<div class="vlak">${tabs(dagen.map((d) => [d.id, ctx.dagLabel(d)]), dag.id, "data-dag")}
      <p><b>${esc(fmtD(dag.dt))}</b> · ${bevr ? `<span class="badge">bevroren sinds ${esc(fmtDT(ctx.selDeadline(dag)))}</span>` : `invullen tot ${esc(fmtDT(ctx.selDeadline(dag)))}`}</p>
      <h3>Verantwoordelijke van de school</h3><p class="klein-grijs">Bij voorkeur de leerkracht LO; zorgt mee voor orde, netheid en discipline. Joker: ${js.joker ? "ingezet" : "beschikbaar"}.</p>
      <form class="rij" id="fLv" novalidate><input type="text" id="lvVn" value="${esc(s.verantw_voornaam || "")}" placeholder="Voornaam" aria-label="Voornaam verantwoordelijke" ${dis}>
        <input type="text" id="lvAn" value="${esc(s.verantw_naam || "")}" placeholder="Naam" aria-label="Naam verantwoordelijke" ${dis}>
        <label class="check"><input type="checkbox" id="lvLo" ${s.verantw_lo ? "checked" : ""} ${dis}> leerkracht LO</label>
        <button class="knop" type="submit" ${dis}>Opslaan</button></form></div>`;
    pl.forEach((p) => {
      const ms = wedVan(dag.id).filter((m) => m.mijn.id === p.id).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0));
      const sel = selecties.filter((x) => x.ploeg_id === p.id && x.speeldag_id === dag.id).map((x) => x.speler_id), max = FORMAT[p.categorie].max;
      const cfg = ctx.cfg(dag.id, p.categorie);
      h += `<div class="vlak"><h3 style="margin-top:0">U${p.categorie} <small>${FORMAT[p.categorie].fmt} · 2 × ${cfg.minuten_helft}' · selectie ${sel.length}/${max}</small></h3>
        ${ms.length ? `<p>${ms.map((m) => `${tijd(m.aftrap)} op veld ${esc(m.veld || "")} tegen ${esc(ctx.naamPloeg(m.thuis_ploeg_id === p.id ? m.uit_ploeg_id : m.thuis_ploeg_id))}${m.klassement ? " (klassementswedstrijd)" : ""}`).join(" · ")}</p>` : `<p class="klein-grijs">Speelschema nog niet bekend.</p>`}
        <h4>Coaches (1 of 2)</h4>
        ${cr.auto === p.id ? `<div class="melding blauw">Geen coach ingevuld: verantwoordelijke ${esc(s.verantw_voornaam + " " + s.verantw_naam)} wordt automatisch coach van deze ploeg.</div>` : ""}
        ${cr.ontbrekend.includes(p.id) ? `<div class="melding rood">${cr.ontbrekend.length > 1 ? `${cr.ontbrekend.length} ploegen zonder coach. De verantwoordelijke kan er maar één overnemen.` : "Nog geen coach. Vul een coach in, of vul de verantwoordelijke in zodat die automatisch overneemt."}</div>` : ""}
        ${[1, 2].map((nr) => { const c = dc.find((x) => x.ploeg_id === p.id && x.volgnr === nr) || {}; return `<form class="rij" data-coach="${p.id}" data-nr="${nr}" novalidate><span class="nr">${nr}</span>
          <input type="text" name="vn" value="${esc(c.voornaam || "")}" placeholder="Voornaam" aria-label="Voornaam coach ${nr}" ${dis}><input type="text" name="an" value="${esc(c.naam || "")}" placeholder="Naam" aria-label="Naam coach ${nr}" ${dis}>
          <select name="rol" aria-label="Rol coach ${nr}" ${dis}>${["leerkracht", "ouder", "familie"].map((r) => `<option ${c.rol === r ? "selected" : ""}>${r}</option>`).join("")}</select>
          <button class="knop licht klein" type="submit" ${dis}>Opslaan</button>${nr === 2 ? `<small class="klein-grijs">optioneel</small>` : ""}</form>`; }).join("")}
        <h4>Wedstrijdblad</h4><div class="selectie">${kern(p.id).map((sp) => { const on = sel.includes(sp.id); return `<label><input type="checkbox" data-sel="${p.id}" value="${sp.id}" ${on ? "checked" : ""} ${bevr || (!on && sel.length >= max) ? "disabled" : ""}> ${esc(sp.voornaam)} ${esc(sp.naam)} <small>°${sp.geboortejaar}</small></label>`; }).join("") || `<p class="klein-grijs">Nog geen spelers in de kern.</p>`}</div></div>`;
    });
    return h;
  }

  function vSchema() {
    if (!mijnPloegen().length) return `<div class="vlak"><p>Nog geen ploegen.</p></div>`;
    return mijnPloegen().map((p) => { const ms = opgelost(ctx, p.categorie).filter((m) => m.thuis_ploeg_id === p.id || m.uit_ploeg_id === p.id).sort((a, b) => ctx.dag(a.speeldag_id).dt - ctx.dag(b.speeldag_id).dt || (a.slot ?? 0) - (b.slot ?? 0));
      return `<div class="vlak"><h3 style="margin-top:0">U${p.categorie} <small>${FORMAT[p.categorie].fmt}</small></h3><div class="duo">
        <div class="scroll"><table><thead><tr><th>Dag</th><th>Uur</th><th>Wedstrijd</th><th>Uitslag</th></tr></thead><tbody>${ms.map((m) => { const x = uitslag(m);
          return `<tr><td>${fmtK(ctx.dag(m.speeldag_id).dt)}</td><td class="tijd">${tijd(m.aftrap)}</td><td>${esc(ctx.naamPloeg(m.thuis_ploeg_id))} – ${esc(ctx.naamPloeg(m.uit_ploeg_id))}${m.klassement ? ` <span class="badge let">klassement</span>` : ""}</td><td>${x ? (x.dubbel ? "dubbel forfait" : `${x.gt} – ${x.gu}${x.ff ? " (ff)" : ""}`) : "—"}</td></tr>`; }).join("") || `<tr><td colspan="4">Speelschema nog niet bekend.</td></tr>`}</tbody></table></div>
        <div>${standTabel(ctx, p.categorie, p.id)}</div></div></div>`; }).join("");
  }

  function vGegevens() {
    return `<div class="vlak" style="max-width:720px"><h3 style="margin-top:0">Schoolgegevens</h3>
      <p>School: <b>${esc(school.naam)}</b>${school.gemeente ? " · " + esc(school.gemeente) : ""} · login: <b>${esc(school.email)}</b></p>
      <form id="fContact" novalidate><div class="duo2"><label class="veld">Voornaam contactpersoon<input type="text" id="cVn" value="${esc(school.contact_voornaam || "")}"></label><label class="veld">Naam contactpersoon<input type="text" id="cAn" value="${esc(school.contact_naam || "")}"></label></div>
      <button class="knop" type="submit">Opslaan</button></form>
      <h3>Wachtwoord wijzigen</h3><form class="rij" id="fPw" novalidate><input type="password" id="nPw" placeholder="Nieuw wachtwoord (min. 8 tekens)" aria-label="Nieuw wachtwoord" autocomplete="new-password"><button class="knop" type="submit">Wijzigen</button></form>
      <p class="klein-grijs">Naam van de school of loginadres wijzigen? Neem contact op met de TVJO.</p></div>`;
  }

  function render() {
    const t = [["overzicht", "Overzicht"], ["ploegen", "Ploegen inschrijven"], ["kern", "Spelerskern"], ["speeldag", "Speeldag"], ["schema", "Schema & klassement"], ["gegevens", "Schoolgegevens"]];
    if (!t.some(([k]) => k === st.tab)) st.tab = "overzicht";
    const v = { overzicht: vOverzicht, ploegen: vPloegen, kern: vKern, speeldag: vSpeeldag, schema: vSchema, gegevens: vGegevens }[st.tab]();
    el.innerHTML = `${tabs(t, st.tab)}${v}<p class="klein-grijs" style="margin-top:20px"><a href="reglement.html">Reglement &amp; afspraken</a></p>`;
  }

  async function doe(fn, ok) {
    try { melding(msg, "Bezig…", "blauw"); await fn(); await laad(); render(); melding(msg, ok || "", "groen"); }
    catch (e) { melding(msg, e.message, "rood"); }
  }

  // ---------- acties ----------
  el.addEventListener("click", async (e) => {
    const b = e.target.closest("button"); if (!b) return;
    if (b.dataset.tab) { location.hash = b.dataset.tab; return; }
    if (b.dataset.u) { st.u = +b.dataset.u; render(); return; }
    if (b.dataset.dag) { st.dagId = +b.dataset.dag; render(); return; }
    if (b.dataset.ploeg) {
      const u = +b.dataset.ploeg, p = ploegVan(u);
      if (p) {
        const n = kern(p.id).length;
        if (!confirm(`U${u} uitschrijven?${n ? ` De ${n} spelers in deze kern worden verwijderd.` : ""}`)) return;
        await doe(async () => { fout((await sb.from("ploegen").delete().eq("id", p.id)).error); fout((await sb.from("scholen").update({ ploegen_bevestigd: false }).eq("id", schoolId)).error); }, `U${u} uitgeschreven.`);
      } else {
        await doe(async () => { fout((await sb.from("ploegen").insert({ school_id: schoolId, seizoen: ctx.seizoen, categorie: u })).error); fout((await sb.from("scholen").update({ ploegen_bevestigd: false }).eq("id", schoolId)).error); }, `U${u} ingeschreven.`);
      }
      return;
    }
    if (b.dataset.act === "bevestig") return doe(async () => fout((await sb.from("scholen").update({ ploegen_bevestigd: true }).eq("id", schoolId)).error), "Ploegen bevestigd.");
    if (b.dataset.del) { if (!confirm("Deze speler verwijderen?")) return; return doe(async () => fout((await sb.from("spelers").delete().eq("id", b.dataset.del)).error), "Speler verwijderd."); }
  });

  el.addEventListener("submit", async (e) => {
    e.preventDefault(); const f = e.target;
    if (f.id === "fSpeler") {
      const p = ploegVan(st.u), vn = f.querySelector("#sVn").value.trim(), an = f.querySelector("#sAn").value.trim(), gj = parseInt(f.querySelector("#sGj").value, 10), lj = +f.querySelector("#sLj").value;
      if (!vn || !an || !gj) return melding(msg, "Vul voornaam, naam en geboortejaar in.", "rood");
      if (kernBevroren() && !confirm(`${vn} ${an} definitief toevoegen? Dit kan nadien niet meer gewijzigd worden.`)) return;
      return doe(async () => fout((await sb.from("spelers").insert({ ploeg_id: p.id, voornaam: vn, naam: an, geboortejaar: gj, leerjaar: lj })).error), `${vn} toegevoegd.`);
    }
    if (f.id === "fLv") {
      const rij = { school_id: schoolId, speeldag_id: st.dagId, verantw_voornaam: f.querySelector("#lvVn").value.trim() || null, verantw_naam: f.querySelector("#lvAn").value.trim() || null, verantw_lo: f.querySelector("#lvLo").checked };
      return doe(async () => fout((await sb.from("school_speeldag").upsert(rij, { onConflict: "school_id,speeldag_id" })).error), "Verantwoordelijke opgeslagen.");
    }
    if (f.dataset.coach) {
      const vn = f.vn.value.trim(), an = f.an.value.trim(), sleutel = { ploeg_id: f.dataset.coach, speeldag_id: st.dagId, volgnr: +f.dataset.nr };
      return doe(async () => {
        if (!vn && !an) fout((await sb.from("coaches").delete().match(sleutel)).error);
        else { if (!vn || !an) throw new Error("Vul voornaam én naam van de coach in."); fout((await sb.from("coaches").upsert({ ...sleutel, voornaam: vn, naam: an, rol: f.rol.value })).error); }
      }, "Coach opgeslagen.");
    }
    if (f.id === "fContact") return doe(async () => fout((await sb.from("scholen").update({ contact_voornaam: f.querySelector("#cVn").value.trim(), contact_naam: f.querySelector("#cAn").value.trim() }).eq("id", schoolId)).error), "Gegevens opgeslagen.");
    if (f.id === "fPw") { const pw = f.querySelector("#nPw").value; if (pw.length < 8) return melding(msg, "Kies minstens 8 tekens.", "rood"); const { error } = await sb.auth.updateUser({ password: pw }); return error ? melding(msg, error.message, "rood") : melding(msg, "Wachtwoord gewijzigd.", "groen"); }
  });

  el.addEventListener("change", async (e) => {
    const c = e.target; if (!c.dataset.sel) return;
    const rij = { ploeg_id: c.dataset.sel, speeldag_id: st.dagId, speler_id: c.value };
    await doe(async () => fout((c.checked ? await sb.from("selecties").insert(rij) : await sb.from("selecties").delete().match(rij)).error));
  });

  window.addEventListener("hashchange", () => { st.tab = location.hash.slice(1) || "overzicht"; melding(msg, ""); render(); });

  await laad();
  render();
}
