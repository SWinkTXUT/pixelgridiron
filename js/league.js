'use strict';
/* ===== League: players, teams, contracts, schedule, trades, draft, FA, offseason ===== */
const SAVE_KEY = 'pixelGridiron.save.v1';
let LG = null;

/* ---------- helpers ---------- */
const rnd = (a, b) => a + Math.random() * (b - a);
const ri = (a, b) => Math.floor(rnd(a, b + 1));
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
const pick = a => a[Math.floor(Math.random() * a.length)];
function gauss(m, s) { let u = 0, v = 0; while (!u) u = Math.random(); while (!v) v = Math.random(); return m + s * Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); }
function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; }
const genName = () => pick(FIRST) + ' ' + pick(LAST);
const fmtM = v => '$' + (Math.round(v * 10) / 10).toFixed(1) + 'M';
const pct = t => (t.w + t.t * 0.5) / Math.max(1, t.w + t.l + t.t);
const ord = n => n + (['th', 'st', 'nd', 'rd'][(n % 100 > 10 && n % 100 < 14) ? 0 : (n % 10 < 4 ? n % 10 : 0)]);

function news(L, text) { L.news.unshift({ t: text, y: L.year, w: L.week }); if (L.news.length > 40) L.news.length = 40; }

/* ---------- players ---------- */
function jerseyNum(pos) {
  switch (pos) {
    case 'QB': case 'K': case 'P': return ri(1, 19);
    case 'RB': return ri(20, 49);
    case 'WR': return pick([ri(10, 19), ri(80, 89)]);
    case 'TE': return ri(80, 89);
    case 'OT': case 'OG': case 'C': return ri(60, 79);
    case 'DE': return pick([ri(50, 79), ri(90, 99)]);
    case 'DT': return ri(90, 99);
    case 'LB': return ri(50, 59);
    default: return ri(20, 39);
  }
}
function genPlayer(L, pos, ovr, age) {
  const [lo, hi] = SPD_RANGE[pos];
  const f = clamp(0.35 + (ovr - 60) / 80 * 0.5 + rnd(-0.3, 0.3), 0, 1);
  const pot = age <= 25 ? Math.min(99, ovr + ri(0, 12)) : ovr;
  return {
    id: L.nid++, name: genName(), pos, age, ovr: Math.round(ovr), pot: Math.round(pot), spd: Math.round(lo + (hi - lo) * f),
    fat: 0, inj: 0, sal: 0.8, yrs: 1, num: jerseyNum(pos), skin: ri(0, SKINS.length - 1), hair: ri(0, HAIRS.length - 1), hs: ri(0, 4), tid: -1,
  };
}
const rawSal = (ovr, pos) => Math.max(0, ovr - 48) ** 2.3 * 0.0105 * POS_MULT[pos];
const marketSalary = (L, ovr, pos) => Math.max(0.8, Math.round(rawSal(ovr, pos) * L.salScale * 10) / 10);
function makeAsk(L, p) {
  p.askSal = Math.max(0.8, Math.round(marketSalary(L, p.ovr, p.pos) * rnd(0.9, 1.15) * 10) / 10);
  const kp = (p.pos === 'QB' || p.pos === 'K' || p.pos === 'P') ? 3 : 0;
  p.askYrs = p.age + 0 - kp >= 31 ? ri(1, 2) : p.age <= 26 ? ri(3, 5) : ri(2, 4);
}

/* ---------- league creation ---------- */
function defaultMascot(i) {
  const t = TEAM_DATA[i];
  return { name: pick(MASCOT_FIRST) + ' the ' + t[5][0].toUpperCase() + t[5].slice(1), species: t[5], c1: t[3], c2: t[4], hat: t[6], acc: 'pompoms', shades: false, cheer: pick(Object.keys(CHEERS)) };
}
function newLeague(old) {
  const L = { v: 1, year: 2026, week: 1, phase: 'regular', user: -1, nid: 1, salScale: 1, teams: [], fa: [], prospects: [], picks: [], schedule: [],
    po: null, news: [], draft: null, faDay: 0, history: [] };
  TEAM_DATA.forEach((t, i) => {
    const team = { id: i, city: t[0], name: t[1], abbr: t[2], c1: t[3], c2: t[4], stadium: t[0] + ' Stadium', mascot: defaultMascot(i), conf: i < 16 ? 'AFC' : 'NFC',
      div: Math.floor(i / 4) % 4, roster: [], depth: {}, w: 0, l: 0, t: 0, pf: 0, pa: 0 };
    if (old && old.teams[i]) { const o = old.teams[i]; Object.assign(team, { city: o.city, name: o.name, abbr: o.abbr, c1: o.c1, c2: o.c2, stadium: o.stadium, mascot: o.mascot }); }
    L.teams.push(team);
  });
  let scaleSum = 0;
  for (const team of L.teams) {
    const strength = gauss(0, 3.5);
    for (const pos of POS) {
      for (let k = 0; k < ROSTER_TEMPLATE[pos]; k++) {
        const starter = k < STARTERS[pos];
        let ovr = (pos === 'K' || pos === 'P') ? gauss(72 + strength * 0.5, 7) : starter ? gauss(71 + strength, 7) : gauss(58 + strength * 0.5, 6) - k * 0.8;
        ovr = clamp(Math.round(ovr), 44, 96);
        let age = Math.round(clamp(gauss(starter ? 27 : 25, 3), 21, 37)); if (pos === 'QB' || pos === 'K' || pos === 'P') age += 2;
        const p = genPlayer(L, pos, ovr, age); p.tid = team.id; p.yrs = age >= 31 ? ri(1, 2) : ri(1, 5);
        team.roster.push(p);
      }
    }
    const raw = team.roster.reduce((s, p) => s + Math.max(0.8, rawSal(p.ovr, p.pos)), 0);
    const scale = rnd(170, 192) / raw; scaleSum += scale;
    team.roster.forEach(p => { p.sal = Math.max(0.8, Math.round(rawSal(p.ovr, p.pos) * scale * 10) / 10); });
    autoDepth(team);
  }
  L.salScale = scaleSum / 32;
  // free agents
  for (let i = 0; i < 90; i++) { const pos = pick(POS); const p = genPlayer(L, pos, clamp(Math.round(gauss(56, 6)), 42, 72), ri(23, 34)); makeAsk(L, p); L.fa.push(p); }
  // picks
  for (let y = L.year; y <= L.year + 2; y++) addPicks(L, y);
  L.schedule = genSchedule();
  return L;
}
function addPicks(L, y) { for (let r = 1; r <= 7; r++) for (let t = 0; t < 32; t++) L.picks.push({ year: y, round: r, orig: t, owner: t }); }

/* ---------- depth chart / starters ---------- */
function normalizeDepth(team) {
  const d = team.depth || (team.depth = {});
  for (const pos of POS) {
    const inR = team.roster.filter(p => p.pos === pos);
    const ids = new Set(inR.map(p => p.id));
    const order = (d[pos] || []).filter(id => ids.has(id));
    const have = new Set(order);
    const rest = inR.filter(p => !have.has(p.id)).sort((a, b) => b.ovr - a.ovr).map(p => p.id);
    d[pos] = order.concat(rest);
  }
}
function autoDepth(team) { team.depth = {}; for (const pos of POS) team.depth[pos] = team.roster.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr).map(p => p.id); }
function depthList(team, pos) { normalizeDepth(team); const m = new Map(team.roster.map(p => [p.id, p])); return team.depth[pos].map(id => m.get(id)); }
function getStarters(team) {
  normalizeDepth(team);
  const m = new Map(team.roster.map(p => [p.id, p]));
  const out = {}, used = new Set();
  for (const pos of POS) {
    const list = team.depth[pos].map(id => m.get(id)).filter(p => p && !p.inj).slice(0, STARTERS[pos]);
    list.forEach(p => used.add(p.id));
    out[pos] = list;
  }
  for (const pos of POS) {
    while (out[pos].length < STARTERS[pos]) {
      const cand = team.roster.filter(p => !p.inj && !used.has(p.id)).sort((a, b) => b.ovr - a.ovr)[0] || team.roster[0];
      used.add(cand.id);
      out[pos].push(Object.assign({}, cand, { pos, ovr: Math.round(cand.ovr * 0.6), fill: true, real: cand }));
    }
  }
  return out;
}
function teamRatings(team) {
  const s = getStarters(team), avg = a => a.reduce((x, p) => x + p.ovr, 0) / a.length;
  const off = s.QB[0].ovr * 0.32 + s.RB[0].ovr * 0.08 + avg(s.WR) * 0.2 + s.TE[0].ovr * 0.07 + avg([...s.OT, ...s.OG, ...s.C]) * 0.3 + s.K[0].ovr * 0.03;
  const def = avg([...s.DE, ...s.DT]) * 0.34 + avg(s.LB) * 0.22 + avg(s.CB) * 0.26 + avg(s.S) * 0.18;
  return { off: Math.round(off * 10) / 10, def: Math.round(def * 10) / 10, ovr: Math.round((off + def) / 2) };
}
const payroll = t => Math.round(t.roster.filter(p => !p.exp).reduce((s, p) => s + p.sal, 0) * 10) / 10;
const capSpace = t => Math.round((CAP - payroll(t)) * 10) / 10;
const rosterCount = t => t.roster.length;

/* ---------- valuation / trades ---------- */
function playerValue(p) {
  const shift = (p.pos === 'QB' || p.pos === 'K' || p.pos === 'P') ? 3 : 0;
  const a = p.age - shift;
  const af = a <= 24 ? 1.2 : a <= 25 ? 1.12 : a <= 28 ? 1.0 : a <= 30 ? 0.8 : a <= 32 ? 0.55 : 0.3;
  const base = Math.max(0, p.ovr - 45) ** 2.2 * 0.02 * POS_MULT[p.pos] * af;
  const potB = a <= 24 ? Math.max(0, p.pot - p.ovr) * 0.5 : 0;
  return base + potB;
}
function pickValue(L, pk) {
  const n = pk.overall || ((pk.round - 1) * 32 + 16);
  return 75 * Math.exp(-0.0185 * n) * Math.pow(0.88, Math.max(0, pk.year - L.year - (L.phase === 'regular' || L.phase === 'playoffs' ? 0 : 0)));
}
function tradeAllowed(L) { return L.phase !== 'playoffs' && !(L.phase === 'regular' && L.week > 9); }
function evalTrade(L, uid, oid, give, get) {
  // give/get: {p:[players], k:[picks]}
  const U = L.teams[uid], O = L.teams[oid];
  if (!tradeAllowed(L)) return { ok: false, msg: 'The trade deadline has passed (after Week 9).' };
  if (!give.p.length && !give.k.length && !get.p.length && !get.k.length) return { ok: false, msg: 'Select something to trade.' };
  const vGive = give.p.reduce((s, p) => s + playerValue(p), 0) + give.k.reduce((s, k) => s + pickValue(L, k), 0);
  const vGet = get.p.reduce((s, p) => s + playerValue(p), 0) + get.k.reduce((s, k) => s + pickValue(L, k), 0);
  const uPay = payroll(U) - give.p.reduce((s, p) => s + p.sal, 0) + get.p.reduce((s, p) => s + p.sal, 0);
  const oPay = payroll(O) + give.p.reduce((s, p) => s + p.sal, 0) - get.p.reduce((s, p) => s + p.sal, 0);
  const res = { vGive, vGet, uPay, oPay, ok: true, msg: '' };
  if (uPay > CAP && uPay > payroll(U)) { res.ok = false; res.msg = 'That trade puts you over the salary cap.'; return res; }
  if (oPay > CAP && oPay > payroll(O)) { res.ok = false; res.msg = O.city + ' cannot fit those salaries under their cap.'; return res; }
  if (vGive < vGet * 1.1 + 1) { res.ok = false; res.msg = O.name + ' decline: they want more value.'; return res; }
  res.msg = O.name + ' accept the trade!';
  return res;
}
function execTrade(L, uid, oid, give, get) {
  const U = L.teams[uid], O = L.teams[oid];
  const mv = (list, from, to) => list.forEach(p => { from.roster.splice(from.roster.indexOf(p), 1); to.roster.push(p); p.tid = to.id; });
  mv(give.p, U, O); mv(get.p, O, U);
  give.k.forEach(k => k.owner = oid); get.k.forEach(k => k.owner = uid);
  autoDepth(O); aiTrim(L, O); ensureNeeds(L, O); normalizeDepth(U);
  news(L, `Trade: ${U.abbr} send ${give.p.length} player(s)/${give.k.length} pick(s) to ${O.abbr} for ${get.p.length} player(s)/${get.k.length} pick(s).`);
}

/* ---------- AI roster management ---------- */
function aiTrim(L, team) {
  while (team.roster.length > ROSTER_MAX) {
    const prot = new Set();
    for (const pos of POS) team.roster.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, pos === 'K' || pos === 'P' ? 1 : STARTERS[pos] + 1).forEach(p => prot.add(p.id));
    const cands = team.roster.filter(p => !prot.has(p.id)).sort((a, b) => playerValue(a) - playerValue(b));
    release(L, team, (cands[0] || team.roster[team.roster.length - 1]));
  }
}
function release(L, team, p) {
  team.roster.splice(team.roster.indexOf(p), 1); p.tid = -1; p.exp = false; makeAsk(L, p); p.inj = p.inj || 0; L.fa.push(p);
}
function ensureNeeds(L, team) {
  for (const pos of POS) {
    const need = (pos === 'K' || pos === 'P') ? 1 : STARTERS[pos] + 1;
    while (team.roster.filter(p => p.pos === pos).length < need) {
      const cand = L.fa.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr)[0];
      let p;
      if (cand) { L.fa.splice(L.fa.indexOf(cand), 1); p = cand; } else p = genPlayer(L, pos, ri(48, 60), ri(23, 30));
      p.tid = team.id; p.sal = Math.max(0.8, Math.min(p.askSal || 0.8, 1.5)); p.yrs = 1; team.roster.push(p);
    }
  }
}
function needScore(team, pos) {
  const l = team.roster.filter(p => p.pos === pos).sort((a, b) => b.ovr - a.ovr).slice(0, STARTERS[pos]);
  if (l.length < STARTERS[pos]) return 4;
  return clamp((72 - l.reduce((s, p) => s + p.ovr, 0) / l.length) / 6, 0, 3);
}

/* ---------- game simulation (non-user games) ---------- */
function simGameScore(L, h, a, neutral, mustWin) {
  const rh = teamRatings(h), ra = teamRatings(a), hb = neutral ? 0 : 2;
  const exp = (o, d) => clamp(21 + (o - d) * 0.6, 6, 46);
  const pts = e => Math.max(0, Math.round(gauss((e - 4.5) / 7, 1.5))) * 7 + ri(0, 3) * 3;
  let hs = pts(exp(rh.off + hb, ra.def)), as = pts(exp(ra.off, rh.def + hb));
  if (hs === as) { if (mustWin) { if (Math.random() < 0.5 + (rh.ovr - ra.ovr) * 0.01) hs += 3; else as += 3; } else if (Math.random() < 0.5) { if (Math.random() < 0.5) hs += 3; else as += 3; } }
  for (const t of [h, a]) if (Math.random() < 0.13) {
    const c = t.roster.filter(p => !p.inj && p.pos !== 'K' && p.pos !== 'P'); const p = pick(c);
    if (p) p.inj = Math.random() < 0.1 ? ri(8, 16) : ri(1, 6);
  }
  return [hs, as];
}
function recordGame(L, g, hs, as, playoff) {
  g.hs = hs; g.as = as; g.done = true;
  if (playoff) return;
  const H = L.teams[g.h], A = L.teams[g.a];
  H.pf += hs; H.pa += as; A.pf += as; A.pa += hs;
  if (hs > as) { H.w++; A.l++; } else if (as > hs) { A.w++; H.l++; } else { H.t++; A.t++; }
}

/* ---------- schedule ---------- */
function genSchedule() {
  const same = shuffle([4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]).slice(0, 7);
  const inter = shuffle([...Array(16)].map((_, i) => 16 + i)).slice(0, 4);
  const list = shuffle([1, 2, 3, 1, 2, 3, ...same, ...inter]);
  const seen = {};
  return list.map(r => {
    const games = [];
    for (let i = 0; i < 32; i++) {
      const j = i ^ r; if (i > j) continue;
      const key = i + '-' + j; let home;
      if (seen[key] !== undefined) home = seen[key] === i ? j : i; else home = Math.random() < 0.5 ? i : j;
      seen[key] = home;
      games.push({ h: home, a: home === i ? j : i, done: false, hs: 0, as: 0 });
    }
    return games;
  });
}
function userGame(L) {
  if (L.phase === 'regular') return (L.schedule[L.week - 1] || []).find(g => !g.done && (g.h === L.user || g.a === L.user)) || null;
  if (L.phase === 'playoffs' && L.po) return L.po.games.find(g => !g.done && (g.h === L.user || g.a === L.user)) || null;
  return null;
}
function simWeek(L, skipUser) {
  for (const g of L.schedule[L.week - 1]) {
    if (g.done) continue;
    if (skipUser && (g.h === L.user || g.a === L.user)) continue;
    const [hs, as] = simGameScore(L, L.teams[g.h], L.teams[g.a], false, false); recordGame(L, g, hs, as, false);
  }
}
function completeWeek(L) {
  // injuries heal, ai upkeep, advance
  for (const t of L.teams) { for (const p of t.roster) { if (p.inj > 0) p.inj--; p.fat = 0; } if (t.id !== L.user) { autoDepth(t); } }
  L.week++;
  if (L.week > NUM_WEEKS) startPlayoffs(L);
}

/* ---------- playoffs ---------- */
function seedConf(L, conf) {
  const ts = L.teams.filter(t => t.conf === conf);
  const cmp = (a, b) => pct(b) - pct(a) || (b.pf - b.pa) - (a.pf - a.pa) || Math.random() - 0.5;
  const winners = [0, 1, 2, 3].map(d => ts.filter(t => t.div === d).sort(cmp)[0]).sort(cmp);
  const rest = ts.filter(t => !winners.includes(t)).sort(cmp).slice(0, 3);
  return [...winners, ...rest].map((t, i) => ({ id: t.id, seed: i + 1 }));
}
function startPlayoffs(L) {
  L.phase = 'playoffs';
  L.po = { round: 1, alive: { AFC: seedConf(L, 'AFC'), NFC: seedConf(L, 'NFC') }, games: [], champion: null, exit: {}, names: ['Wild Card', 'Divisional', 'Conference Championship', 'Super Bowl'] };
  setupPoRound(L);
  const you = [...L.po.alive.AFC, ...L.po.alive.NFC].find(x => x.id === L.user);
  news(L, you ? `${L.teams[L.user].name} made the playoffs as the #${you.seed} seed!` : `${L.teams[L.user].name} missed the playoffs.`);
}
function setupPoRound(L) {
  const po = L.po; po.games = [];
  if (po.round === 4) { po.games.push({ h: po.alive.AFC[0].id, a: po.alive.NFC[0].id, neutral: true, done: false, hs: 0, as: 0 }); return; }
  for (const conf of ['AFC', 'NFC']) {
    const al = po.alive[conf].slice().sort((a, b) => a.seed - b.seed);
    const pairs = po.round === 1 ? [[1, 6], [2, 5], [3, 4]] : po.round === 2 ? [[0, 3], [1, 2]] : [[0, 1]];
    for (const [i, j] of pairs) po.games.push({ h: al[i].id, a: al[j].id, conf, done: false, hs: 0, as: 0 });
  }
}
function simPoGame(L, g) { const [hs, as] = simGameScore(L, L.teams[g.h], L.teams[g.a], !!g.neutral, true); g.hs = hs; g.as = as; g.done = true; }
function finishPoRound(L) {
  const po = L.po;
  for (const g of po.games) if (!g.done) simPoGame(L, g);
  const winners = {};
  for (const g of po.games) { const w = g.hs > g.as ? g.h : g.a, lo = g.hs > g.as ? g.a : g.h; po.exit[lo] = po.round; (winners[g.conf || 'SB'] = winners[g.conf || 'SB'] || []).push(w); }
  if (po.round === 4) {
    po.champion = po.games[0].hs > po.games[0].as ? po.games[0].h : po.games[0].a; po.exit[po.champion] = 5;
    const c = L.teams[po.champion]; L.history.push({ year: L.year, champ: c.city + ' ' + c.name, id: c.id });
    news(L, `${c.city} ${c.name} win the ${L.year} championship!`);
    beginOffseason(L); return;
  }
  for (const conf of ['AFC', 'NFC']) {
    const prev = po.alive[conf].slice().sort((a, b) => a.seed - b.seed);
    const keep = po.round === 1 ? [prev[0]] : [];
    po.alive[conf] = keep.concat(prev.filter(x => (winners[conf] || []).includes(x.id))).sort((a, b) => a.seed - b.seed);
  }
  po.round++; setupPoRound(L);
}

/* ---------- offseason ---------- */
function progress(L, p) {
  const sh = (p.pos === 'QB' || p.pos === 'K' || p.pos === 'P') ? 3 : 0; p.age++;
  const a = p.age - sh; let d;
  if (a <= 24) d = rnd(1, 5) * ((p.pot - p.ovr) / 8 + 0.4); else if (a <= 28) d = rnd(-1.5, 2.5); else if (a <= 31) d = rnd(-3.5, 1); else d = rnd(-6, -1.5);
  if (a <= 24) d = Math.min(d, Math.max(1, p.pot - p.ovr + 2));
  p.ovr = clamp(Math.round(p.ovr + d), 40, 99);
  if (a >= 28) p.spd = clamp(Math.round(p.spd - rnd(0, 2.5)), 30, 99);
  if (a <= 26) p.pot = Math.max(p.ovr, p.pot); else p.pot = p.ovr;
}
function genProspects(L) {
  const w = { QB: 14, RB: 22, WR: 36, TE: 14, OT: 22, OG: 20, C: 8, DE: 24, DT: 22, LB: 30, CB: 30, S: 20, K: 4, P: 4 };
  const out = [];
  for (const pos of POS) for (let i = 0; i < w[pos]; i++) {
    const ovr = clamp(Math.round((pos === 'K' || pos === 'P') ? gauss(64, 8) : gauss(59, 8)), 40, 86);
    const p = genPlayer(L, pos, ovr, ri(21, 23)); p.pot = Math.min(99, ovr + ri(2, 15));
    p.scout = Math.round(clamp(ovr + gauss(0, 3), 35, 95)); p.potScout = Math.round(clamp(p.pot + gauss(0, 3), 35, 99));
    p.grade = p.scout * 0.55 + p.potScout * 0.45 + (pos === 'QB' ? 3 : pos === 'K' || pos === 'P' ? -14 : 0) + rnd(-1.5, 1.5);
    out.push(p);
  }
  return out.sort((a, b) => b.grade - a.grade);
}
function rookieSal(overall) { return Math.max(0.8, Math.round(9.5 * Math.exp(-0.035 * (overall - 1)) * 10) / 10); }
function beginOffseason(L) {
  L.phase = 'resign';
  const exitScore = t => (L.po && L.po.exit[t.id] ? L.po.exit[t.id] * 10 : 0) + pct(t);
  const rank = L.teams.slice().sort((a, b) => exitScore(a) - exitScore(b)).map(t => t.id);
  L.draftRank = rank;
  for (const t of L.teams) for (const p of t.roster) { p.yrs--; progress(L, p); p.fat = 0; if (p.inj > 0) p.inj = Math.max(0, p.inj - 6); }
  for (const t of L.teams) {
    // retirement
    for (const p of t.roster.slice()) {
      const sh = (p.pos === 'QB' || p.pos === 'K' || p.pos === 'P') ? 3 : 0;
      if ((p.age - sh >= 34 && Math.random() < 0.45) || (p.age - sh >= 32 && p.ovr < 58 && Math.random() < 0.5)) {
        t.roster.splice(t.roster.indexOf(p), 1); if (t.id === L.user) news(L, `${p.pos} ${p.name} (${p.ovr}) retired at ${p.age}.`);
      }
    }
    for (const p of t.roster.slice()) {
      if (p.yrs > 0) continue;
      makeAsk(L, p);
      if (t.id === L.user) { p.exp = true; continue; }
      const prob = clamp(0.25 + (p.ovr - 55) * 0.03 - (p.age - 29) * 0.04, 0.05, 0.92);
      if (Math.random() < prob && capSpace(t) > p.askSal + 3) { p.sal = p.askSal; p.yrs = p.askYrs; } else release(L, t, p);
    }
    if (t.id !== L.user) autoDepth(t);
  }
  // older FAs lose a bit, unsigned FAs retire sometimes
  L.fa = L.fa.filter(p => { progress(L, p); return !(p.age >= 35 && Math.random() < 0.5); });
  L.fa.forEach(p => makeAsk(L, p));
  L.prospects = genProspects(L);
  news(L, 'Offseason begins. Player ratings have changed — check your roster!');
}
function reSign(L, p, yrs) {
  const t = L.teams[L.user];
  const newSal = p.askSal; const pay = payroll(t) + newSal;
  if (pay > CAP) return 'Not enough cap space to re-sign ' + p.name + '.';
  p.exp = false; p.sal = newSal; p.yrs = yrs || p.askYrs; return null;
}
function finishReSign(L) {
  const t = L.teams[L.user];
  for (const p of t.roster.slice()) if (p.exp) release(L, t, p);
  normalizeDepth(t);
  startDraft(L);
}
function startDraft(L) {
  L.phase = 'draft';
  const order = [];
  for (let r = 1; r <= 7; r++) L.draftRank.forEach((tid, i) => {
    const pk = L.picks.find(k => k.year === L.year && k.round === r && k.orig === tid);
    if (pk) { pk.overall = (r - 1) * 32 + i + 1; order.push(pk); }
  });
  L.draft = { order, idx: 0, log: [] };
  news(L, `The ${L.year} Draft is set. You pick #${(L.draft.order.find(k => k.owner === L.user) || { overall: '-' }).overall} first.`);
}
function draftCurrent(L) { return L.draft.order[L.draft.idx]; }
function doDraftPick(L, prospect) {
  const pk = draftCurrent(L), team = L.teams[pk.owner];
  L.prospects.splice(L.prospects.indexOf(prospect), 1);
  delete prospect.scout; delete prospect.potScout; delete prospect.grade;
  prospect.tid = team.id; prospect.sal = rookieSal(pk.overall); prospect.yrs = 4; prospect.rookie = true; prospect.draftPick = pk.overall;
  team.roster.push(prospect);
  if (team.id === L.user) news(L, `You drafted ${prospect.pos} ${prospect.name} with pick #${pk.overall} (round ${pk.round}).`);
  L.draft.log.unshift({ overall: pk.overall, team: team.abbr, name: prospect.name, pos: prospect.pos, user: team.id === L.user }); if (L.draft.log.length > 12) L.draft.log.length = 12;
  L.draft.idx++;
  if (L.draft.idx >= L.draft.order.length) finishDraft(L);
}
function aiDraftPick(L) {
  const pk = draftCurrent(L), team = L.teams[pk.owner];
  let best = null, bs = -1e9;
  for (const p of L.prospects.slice(0, 40)) {
    const s = p.grade + needScore(team, p.pos) * 1.6 + rnd(-2, 2);
    if (s > bs) { bs = s; best = p; }
  }
  doDraftPick(L, best || L.prospects[0]);
}
function simDraft(L, untilUser) {
  while (L.phase === 'draft') {
    const pk = draftCurrent(L); if (!pk) break;
    if (untilUser && pk.owner === L.user) break;
    aiDraftPick(L);
  }
}
function finishDraft(L) {
  L.fa.push(...L.prospects.map(p => { p.tid = -1; delete p.scout; delete p.potScout; delete p.grade; makeAsk(L, p); p.askSal = Math.max(0.8, Math.min(p.askSal, 1.2)); return p; }));
  L.prospects = []; L.picks = L.picks.filter(k => k.year !== L.year); addPicks(L, L.year + 3);
  for (const t of L.teams) if (t.id !== L.user) { autoDepth(t); }
  L.phase = 'fa'; L.faDay = 0; L.draft = null;
  news(L, 'The draft is complete. Free agency is open — sign players before the AI does!');
}
function signFA(L, p, yrs) {
  const t = L.teams[L.user];
  if (payroll(t) + p.askSal > CAP) return 'Not enough cap space (' + fmtM(capSpace(t)) + ' available).';
  if (t.roster.length >= ROSTER_MAX && L.phase !== 'preseason' && L.phase !== 'fa') return 'Your roster is full (53). Release someone first.';
  L.fa.splice(L.fa.indexOf(p), 1); p.tid = t.id; p.sal = p.askSal; p.yrs = yrs || p.askYrs; p.exp = false; t.roster.push(p); normalizeDepth(t);
  return null;
}
function aiFADay(L) {
  for (const t of shuffle(L.teams.slice())) {
    if (t.id === L.user) continue;
    for (let k = 0; k < 3; k++) {
      let best = null, bs = -1e9;
      for (const p of L.fa) {
        if (p.askSal > capSpace(t) - 1 || p.ovr < 55) continue;
        const s = p.ovr + needScore(t, p.pos) * 3 - p.askSal * 0.3;
        if (s > bs) { bs = s; best = p; }
      }
      if (!best) break;
      const worst = t.roster.filter(p => p.pos === best.pos).sort((a, b) => a.ovr - b.ovr)[0];
      const starters = t.roster.filter(p => p.pos === best.pos).sort((a, b) => b.ovr - a.ovr).slice(0, STARTERS[best.pos]);
      const upgrade = starters.length < STARTERS[best.pos] || best.ovr > starters[starters.length - 1].ovr + 2;
      if (!upgrade && t.roster.length >= 50) break;
      L.fa.splice(L.fa.indexOf(best), 1); best.tid = t.id; best.sal = best.askSal; best.yrs = best.askYrs; t.roster.push(best);
      aiTrim(L, t);
    }
    ensureNeeds(L, t); autoDepth(t);
  }
}
function advanceFA(L) {
  aiFADay(L); L.faDay++;
  if (L.faDay >= 3) { L.phase = 'preseason'; for (const t of L.teams) if (t.id !== L.user) { aiTrim(L, t); ensureNeeds(L, t); autoDepth(t); } news(L, 'Free agency is over. Cut your roster to 53 and get under the cap.'); }
}
function startNewSeason(L) {
  const t = L.teams[L.user];
  if (t.roster.length > ROSTER_MAX) return `Roster has ${t.roster.length} players. Cut down to ${ROSTER_MAX}.`;
  if (payroll(t) > CAP) return 'You are over the salary cap by ' + fmtM(payroll(t) - CAP) + '.';
  L.year++; L.week = 1; L.phase = 'regular'; L.po = null;
  L.teams.forEach(x => { x.w = x.l = x.t = x.pf = x.pa = 0; x.roster.forEach(p => { p.rookie = false; p.fat = 0; }); ensureNeeds(L, x); x.id === L.user ? normalizeDepth(x) : autoDepth(x); });
  L.fa = L.fa.filter(p => p.ovr >= 45).slice(0, 220);
  L.schedule = genSchedule();
  news(L, `The ${L.year} season begins!`);
  return null;
}

/* ---------- save / load ---------- */
function saveLeague() { try { if (LG) localStorage.setItem(SAVE_KEY, JSON.stringify(LG)); } catch (e) { console.warn('save failed', e); } }
function loadLeague() { try { const s = localStorage.getItem(SAVE_KEY); if (s) { const L = JSON.parse(s); if (L && L.v === 1) return L; } } catch (e) { } return null; }
function wipeSave() { try { localStorage.removeItem(SAVE_KEY); } catch (e) { } }
