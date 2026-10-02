// Speelschema-algoritmes (zelfde logica als het prototype).
import { hhmm, toMin } from "./gemeen.js";

export function rng(seed){let x=seed||1;return()=>{x^=x<<13;x^=x>>>17;x^=x<<5;return((x>>>0)%100000)/100000;};}
export function verdeelOverDagen(teams,matches,D){
  if(!D)return null;const perTeam=matches.length*2/teams.length;
  for(let extra=0;extra<4;extra++){const cap=Math.ceil(perTeam/D)+extra,dayCap=Math.ceil(matches.length/D)+extra;
    for(let seed=1;seed<40;seed++){const r=rng(seed*7919),order=matches.slice().sort(()=>r()-.5);
      const load={};teams.forEach(t=>load[t]=new Array(D).fill(0));const cnt=new Array(D).fill(0),pairDay={},asg={};let steps=0;
      const bt=k=>{if(++steps>20000)return false;if(k===order.length)return true;const m=order[k],key=[m.a,m.b].sort().join("-");
        const days=[...Array(D).keys()].sort((x,y)=>cnt[x]-cnt[y]||(load[m.a][x]+load[m.b][x])-(load[m.a][y]+load[m.b][y]));
        for(const d of days){if(cnt[d]>=dayCap||load[m.a][d]>=cap||load[m.b][d]>=cap)continue;if(D>1&&pairDay[key]===d)continue;
          cnt[d]++;load[m.a][d]++;load[m.b][d]++;const prev=pairDay[key];pairDay[key]=d;asg[m.id]=d;
          if(bt(k+1))return true;cnt[d]--;load[m.a][d]--;load[m.b][d]--;pairDay[key]=prev;delete asg[m.id];}
        return false;};
      if(bt(0))return{asg,cap};}}
  return null;}
export function ordenDag(ms,fields){const rest=ms.slice(),slots=[];let prev=new Set();
  while(rest.length){const used=new Set(),slot=[];
    const sorted=rest.slice().sort((x,y)=>((prev.has(x.a)||prev.has(x.b))?1:0)-((prev.has(y.a)||prev.has(y.b))?1:0));
    for(const m of sorted){if(slot.length>=fields)break;if(used.has(m.a)||used.has(m.b))continue;if((prev.has(m.a)||prev.has(m.b))&&slot.length>0)continue;slot.push(m);used.add(m.a);used.add(m.b);}
    if(!slot.length)slot.push(sorted[0]);slot.forEach(m=>rest.splice(rest.indexOf(m),1));slots.push(slot);prev=new Set(slot.flatMap(m=>[m.a,m.b]));}
  return slots;}

// Dubbele competitie voor één categorie, verdeeld over de competitiedagen.
// ploegIds: ids van de ploegen; dagIds: ids van de speeldagen. Geeft [{thuis, uit, ronde, dagId}] of null.
export function maakReeks(ploegIds, dagIds) {
  const m = [];
  for (let i = 0; i < ploegIds.length; i++) for (let j = i + 1; j < ploegIds.length; j++) {
    m.push({ id: `${i}-${j}-1`, a: ploegIds[i], b: ploegIds[j], ronde: 1 });
    m.push({ id: `${i}-${j}-2`, a: ploegIds[j], b: ploegIds[i], ronde: 2 });
  }
  if (ploegIds.length < 2 || !dagIds.length) return [];
  const v = verdeelOverDagen(ploegIds, m, dagIds.length);
  if (!v) return null;
  const out = m.map((x) => ({ thuis: x.a, uit: x.b, ronde: x.ronde, dagIndex: v.asg[x.id] }));
  // heenwedstrijd vóór terugwedstrijd
  out.forEach((h) => { if (h.ronde !== 1) return; const t = out.find((x) => x.ronde === 2 && x.thuis === h.uit && x.uit === h.thuis); if (t && t.dagIndex < h.dagIndex) { [h.thuis, h.uit, t.thuis, t.uit] = [t.thuis, t.uit, h.thuis, h.uit]; } });
  return out.map((x) => ({ thuis: x.thuis, uit: x.uit, ronde: x.ronde, dagId: dagIds[x.dagIndex] }));
}

// Uren en velden voor één dag. regs: reguliere wedstrijden (met thuis_ploeg_id/uit_ploeg_id),
// cfg: dagplanning. aantalPloegen + rrKlaar bepalen of er klassementswedstrijden bijkomen.
export function planDag(regs, cfg, aantalPloegen, rrKlaar) {
  const velden = Math.max(1, cfg.velden || 1);
  const slot = 2 * cfg.minuten_helft + cfg.rust + cfg.wissel;
  const start = toMin(String(cfg.start).slice(0, 5));
  const tijdVan = (si) => hhmm(start + si * slot) + ":00";
  const veld = (fi) => String.fromCharCode(65 + fi);
  const slots = ordenDag(regs.map((r) => ({ ...r, a: r.thuis_ploeg_id, b: r.uit_ploeg_id })), velden);
  const regulier = [];
  slots.forEach((g, si) => g.forEach((x, fi) => { const { a, b, ...rest } = x; regulier.push({ ...rest, slot: si, aftrap: tijdVan(si), veld: veld(fi) }); }));
  const extra = [];
  let next = slots.length;
  const paren = Math.floor(aantalPloegen / 2);
  if (rrKlaar && cfg.extra_rondes > 0 && paren > 0) {
    for (let r = 0; r < cfg.extra_rondes; r++) {
      for (let q = 0; q < paren; q++) {
        const fi = q % velden; if (q > 0 && fi === 0) next++;
        extra.push({ rang_thuis: 2 * q + 1, rang_uit: 2 * q + 2, slot: next, aftrap: tijdVan(next), veld: veld(fi) });
      }
      next++;
    }
  }
  const laatsteSlot = Math.max(-1, ...regulier.map((x) => x.slot), ...extra.map((x) => x.slot));
  const eind = hhmm(start + (laatsteSlot + 1) * slot);
  return { regulier, extra, eind, past: toMin(eind) <= toMin(String(cfg.eind).slice(0, 5)) };
}
