// Gedeelde gegevens en berekeningen voor school- en beheerdersschermen.
import { sb, esc } from "./supabase.js";

export const CATS = [8, 9, 10, 11, 12];
export const FORMAT = { 8: { fmt: "5v5", max: 8 }, 9: { fmt: "5v5", max: 8 }, 10: { fmt: "8v8", max: 12 }, 11: { fmt: "8v8", max: 12 }, 12: { fmt: "8v8", max: 12 } };
export const KERN_MAX = 25;

export const hhmm = (m) => `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
export const toMin = (t) => { const [h, m] = String(t).split(":").map(Number); return h * 60 + m; };
export const tijd = (t) => (t ? String(t).slice(0, 5) : "");
export const fmtD = (d) => d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
export const fmtK = (d) => d.toLocaleDateString("nl-BE", { day: "numeric", month: "long" });
export const fmtDT = (d) => d.toLocaleDateString("nl-BE", { weekday: "long", day: "numeric", month: "long" }) + " om " + d.toLocaleTimeString("nl-BE", { hour: "2-digit", minute: "2-digit" });
const alsDatum = (s) => { const [y, m, d] = s.split("-").map(Number); return new Date(y, m - 1, d); };
const dagenVoor = (dt, n, uur = 0) => { const x = new Date(dt); x.setDate(x.getDate() - n); x.setHours(uur, 0, 0, 0); return x; };

export function fout(error) { if (error) throw new Error(error.message || String(error)); }

export function tabs(lijst, huidig, attr = "data-tab") {
  return `<nav class="subtabs">${lijst.map(([k, l]) => `<button ${attr}="${k}" aria-selected="${k === huidig}">${esc(l)}</button>`).join("")}</nav>`;
}

// Basisgegevens: seizoen, (test)tijd, kalender, deadlines, schoolnamen, ploegen, wedstrijden.
export async function laadContext() {
  const r = await Promise.all([
    sb.from("instellingen").select("seizoen,test_nu").single(),
    sb.rpc("nu"),
    sb.from("speeldagen").select("*").order("datum"),
    sb.rpc("schoolnamen"),
    sb.from("ploegen").select("id,school_id,categorie,seizoen"),
    sb.from("dagplanning").select("*"),
    sb.from("finalisten").select("*"),
  ]);
  r.forEach((x) => fout(x.error));
  const [inst, nu, dagen, namen, ploegen, plan, fin] = r.map((x) => x.data);
  const seizoen = inst.seizoen;
  const d = dagen.filter((x) => x.seizoen === seizoen).map((x) => ({ ...x, dt: alsDatum(x.datum) }));
  const comp = d.filter((x) => x.code !== "F");
  const ctx = {
    seizoen, test: inst.test_nu, nu: new Date(nu), dagen: d, comp, finale: d.find((x) => x.code === "F"),
    ploegDeadline: comp[0] ? dagenVoor(comp[0].dt, 14) : null,
    kernBevriezing: comp[0] ? dagenVoor(comp[0].dt, 7) : null,
    selDeadline: (dag) => dagenVoor(dag.dt, dag.code === "F" ? 7 : 2, 12),
    namen: Object.fromEntries((namen || []).map((s) => [s.id, s.naam])),
    ploegen: ploegen.filter((p) => p.seizoen === seizoen),
    plan,
    finalisten: (fin || []).filter((f) => f.seizoen === seizoen),
  };
  ctx.ploeg = (id) => ctx.ploegen.find((p) => p.id === id);
  ctx.schoolVan = (pid) => ctx.ploeg(pid)?.school_id;
  ctx.naamPloeg = (pid) => ctx.namen[ctx.schoolVan(pid)] || "?";
  ctx.dag = (id) => d.find((x) => x.id === id);
  ctx.dagLabel = (dag) => (dag.code === "F" ? "Finale" : "Speeldag " + dag.code);
  ctx.cfg = (dagId, u) => plan.find((p) => p.speeldag_id === dagId && p.categorie === u) || { start: "13:30", eind: "17:00", minuten_helft: u <= 9 ? 12 : 15, rust: 2, wissel: 5, velden: 1, extra_rondes: 0 };
  ctx.isFinalist = (pid) => ctx.finalisten.some((f) => f.ploeg_id === pid);
  ctx.finaleDeadline = (pid) => (ctx.finale ? dagenVoor(ctx.finale.dt, ctx.finalisten.some((f) => f.ploeg_id === pid && f.vrijgeleide) ? 2 : 7, 12) : null);
  ctx.laatsteVoorbij = () => { const l = comp[comp.length - 1]; if (!l) return false; const x = new Date(l.dt); x.setDate(x.getDate() + 1); return ctx.nu >= x; };
  ctx.volgendeDag = () => { const n = new Date(ctx.nu); n.setHours(0, 0, 0, 0); return d.find((x) => x.dt >= n) || null; };
  await herlaadWedstrijden(ctx);
  return ctx;
}

export async function herlaadWedstrijden(ctx) {
  const ids = ctx.dagen.map((x) => x.id);
  const { data, error } = await sb.from("wedstrijden").select("*").in("speeldag_id", ids.length ? ids : [-1]);
  fout(error);
  ctx.wedstrijden = data;
}

// Uitslag van een wedstrijd (rekening houdend met forfait).
export function uitslag(m) {
  if (!m.thuis_ploeg_id || !m.uit_ploeg_id) return null;
  if (m.forfait === "beide") return { gt: 0, gu: 0, dubbel: true };
  if (m.forfait === "thuis") return { gt: 0, gu: 5, ff: true };
  if (m.forfait === "uit") return { gt: 5, gu: 0, ff: true };
  if (m.doelpunten_thuis == null || m.doelpunten_uit == null) return null;
  return { gt: m.doelpunten_thuis, gu: m.doelpunten_uit };
}

// Klassement: punten, zeges, doelsaldo, gemaakte doelpunten, onderling resultaat, (loting = naam).
export function klassement(ctx, u, alleenRegulier = false) {
  const fid = ctx.finale?.id;
  const lijst = alleenRegulier ? ctx.wedstrijden.filter((m) => m.categorie === u && !m.klassement && m.speeldag_id !== fid) : opgelost(ctx, u);
  const T = {};
  ctx.ploegen.filter((p) => p.categorie === u).forEach((p) => (T[p.id] = { id: p.id, g: 0, w: 0, d: 0, v: 0, dv: 0, dt: 0, p: 0 }));
  let gesp = 0;
  lijst.forEach((m) => {
    const x = uitslag(m); const A = T[m.thuis_ploeg_id], B = T[m.uit_ploeg_id];
    if (!x || !A || !B) return;
    gesp++; A.g++; B.g++;
    if (x.dubbel) { A.v++; B.v++; A.dt += 5; B.dt += 5; return; }
    A.dv += x.gt; A.dt += x.gu; B.dv += x.gu; B.dt += x.gt;
    if (x.gt > x.gu) { A.w++; B.v++; A.p += 3; } else if (x.gt < x.gu) { B.w++; A.v++; B.p += 3; } else { A.d++; B.d++; A.p++; B.p++; }
  });
  const h2h = (a, b) => {
    let pa = 0, pb = 0;
    lijst.forEach((m) => {
      const x = uitslag(m); if (!x || x.dubbel) return;
      if (!((m.thuis_ploeg_id === a && m.uit_ploeg_id === b) || (m.thuis_ploeg_id === b && m.uit_ploeg_id === a))) return;
      const ga = m.thuis_ploeg_id === a ? x.gt : x.gu, gb = m.thuis_ploeg_id === a ? x.gu : x.gt;
      if (ga > gb) pa += 3; else if (gb > ga) pb += 3; else { pa++; pb++; }
    });
    return pb - pa;
  };
  const rows = Object.values(T).sort((a, b) => b.p - a.p || b.w - a.w || (b.dv - b.dt) - (a.dv - a.dt) || b.dv - a.dv || h2h(a.id, b.id) || ctx.naamPloeg(a.id).localeCompare(ctx.naamPloeg(b.id)));
  return { rows, gesp, tot: lijst.length };
}

// Klassementswedstrijden (nr. 1 – nr. 2 …) invullen zodra alle reguliere uitslagen er zijn.
export function opgelost(ctx, u) {
  const raw = ctx.wedstrijden.filter((m) => m.categorie === u && m.speeldag_id !== ctx.finale?.id);
  if (!raw.some((m) => m.klassement && !m.thuis_ploeg_id)) return raw;
  const regs = raw.filter((m) => !m.klassement);
  const rows = regs.length && regs.every((m) => uitslag(m)) ? klassement(ctx, u, true).rows : [];
  return raw.map((m) => (m.klassement && !m.thuis_ploeg_id ? { ...m, thuis_ploeg_id: rows[m.rang_thuis - 1]?.id ?? null, uit_ploeg_id: rows[m.rang_uit - 1]?.id ?? null } : m));
}

export function standTabel(ctx, u, mijnPloeg) {
  const k = klassement(ctx, u);
  return `<div class="scroll"><table><thead><tr><th>#</th><th>School</th><th class="num">Gesp.</th><th class="num">W</th><th class="num">G</th><th class="num">V</th><th class="num">Doelp.</th><th class="num">Saldo</th><th class="num">Ptn</th></tr></thead><tbody>
  ${k.rows.map((r, i) => `<tr class="${r.id === mijnPloeg ? "mijn" : ""}"><td>${i + 1}</td><td>${esc(ctx.naamPloeg(r.id))}</td><td class="num">${r.g}</td><td class="num">${r.w}</td><td class="num">${r.d}</td><td class="num">${r.v}</td><td class="num">${r.dv}–${r.dt}</td><td class="num">${r.dv - r.dt > 0 ? "+" : ""}${r.dv - r.dt}</td><td class="num"><b>${r.p}</b></td></tr>`).join("")}
  </tbody></table></div><p class="klein-grijs">${k.gesp} van ${k.tot} wedstrijden gespeeld</p>`;
}

// Joker: eerste afwezigheid op een competitiespeeldag waarop de school speelt = joker, daarna forfait.
export function jokerStatus(ctx, schoolId, ssRijen) {
  const res = {}; let joker = null;
  for (const d of ctx.comp) {
    const a = ssRijen.find((r) => r.school_id === schoolId && r.speeldag_id === d.id)?.aanwezig;
    const speelt = ctx.wedstrijden.some((m) => m.speeldag_id === d.id && !m.klassement && (ctx.schoolVan(m.thuis_ploeg_id) === schoolId || ctx.schoolVan(m.uit_ploeg_id) === schoolId));
    if (a === "nee" && speelt) { if (!joker) { joker = d; res[d.id] = "joker"; } else res[d.id] = "forfait"; }
    else res[d.id] = a || "";
  }
  if (ctx.finale) { const a = ssRijen.find((r) => r.school_id === schoolId && r.speeldag_id === ctx.finale.id)?.aanwezig; res[ctx.finale.id] = a === "nee" ? "forfait" : a || ""; }
  return { res, joker };
}

// Coach-regel: precies één ploeg zonder coach + verantwoordelijke ingevuld → verantwoordelijke wordt coach.
export function coachRegel(ploegIds, coachRijen, ss) {
  const lvOk = !!(ss?.verantw_voornaam && ss?.verantw_naam);
  const zonder = ploegIds.filter((pid) => !coachRijen.some((c) => c.ploeg_id === pid));
  const auto = zonder.length === 1 && lvOk ? zonder[0] : null;
  return { auto, ontbrekend: auto ? [] : zonder };
}

// Winnaar van een (finale)wedstrijd: ploeg-id of null.
export function winnaar(m) {
  const x = uitslag(m); if (!x || x.dubbel) return null;
  if (x.gt > x.gu) return m.thuis_ploeg_id; if (x.gu > x.gt) return m.uit_ploeg_id;
  return m.strafschoppen_winnaar || null;
}

// Derde woensdag van een maand (maand 0–11).
export function derdeWoensdag(jaar, maand) { const d = new Date(jaar, maand, 1); const off = (3 - d.getDay() + 7) % 7; return new Date(jaar, maand, 1 + off + 14); }
export const isoDatum = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
