'use strict';
/* ===== UI: screens, editors, in-game controls ===== */
const $ = s => document.querySelector(s);
const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const UI = { screen: 'title', pos: 'ALL', tradeWith: 0, give: new Set(), get: new Set(), giveK: new Set(), getK: new Set(), tradeMsg: '', leagueTab: 'standings', edTeam: 0, mTeam: 0, mCheer: true, msg: '', depthPos: 'ALL', faPos: 'ALL', dPos: 'ALL' };
let M = null, raf = 0, paused = false, mraf = 0;
const myTeam = () => LG.teams[LG.user];
const ovrColor = v => v >= 85 ? '#3ddc84' : v >= 75 ? '#a6e22e' : v >= 65 ? '#ffd24d' : v >= 55 ? '#ff9f43' : '#ff6b6b';
const ovrBadge = v => `<span class="ovr" style="background:${ovrColor(v)}">${v}</span>`;
const tname = t => `${t.city} ${t.name}`;
const badge = t => `<span class="badge" style="background:${t.c1};box-shadow:inset -6px 0 ${t.c2}"></span>`;
function findPlayer(id) { for (const t of LG.teams) for (const p of t.roster) if (p.id === id) return p; return LG.fa.find(p => p.id === id) || null; }
function phaseLabel() {
  const L = LG;
  switch (L.phase) {
    case 'regular': return `Week ${L.week} of ${NUM_WEEKS}`;
    case 'playoffs': return 'Playoffs: ' + L.po.names[L.po.round - 1];
    case 'resign': return 'Offseason: Re-sign players';
    case 'draft': return 'Offseason: Draft';
    case 'fa': return `Offseason: Free agency (day ${L.faDay + 1}/3)`;
    case 'preseason': return 'Preseason: roster cuts';
  }
}
function toast(msg) { UI.msg = msg; }

/* ---------- modal ---------- */
function modal(html) { const m = $('#modal'); m.innerHTML = `<div class="box">${html}</div>`; m.hidden = false; }
function closeModal() { $('#modal').hidden = true; $('#modal').innerHTML = ''; }

/* ---------- navigation ---------- */
function go(screen) { UI.screen = screen; UI.msg = ''; render(); window.scrollTo(0, 0); }
function topbar() {
  const t = myTeam();
  return `<div class="top"><img src="${mascotURL(t.mascot, 3, 0, false)}"><div style="flex:1"><b>${esc(tname(t))}</b> <span class="dim">${t.w}-${t.l}${t.t ? '-' + t.t : ''}</span><br>
  <span class="dim">${LG.year} · ${phaseLabel()}</span></div><div style="text-align:right"><span class="gold">${fmtM(capSpace(t))}</span> <span class="dim">cap space</span><br><span class="dim">Roster ${t.roster.length}/53</span></div></div>`;
}
function nav() {
  const items = [['hub', 'Hub'], ['roster', 'Roster'], ['depth', 'Depth'], ['trade', 'Trades'], ['fa', 'Free Agents'], ['draft', 'Draft'], ['league', 'League'], ['teamed', 'Team Editor'], ['mascot', 'Mascot']];
  return `<div class="nav">${items.map(([k, l]) => `<button data-a="go" data-v="${k}" class="${UI.screen === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
}
const shell = body => topbar() + nav() + (UI.msg ? `<div class="card gold">${esc(UI.msg)}</div>` : '') + body;

/* ---------- render ---------- */
function render() {
  cancelAnimationFrame(mraf);
  const el = $('#screen'); let html = '';
  const s = UI.screen;
  if (s === 'title') html = vTitle();
  else if (s === 'select') html = vSelect();
  else if (s === 'edTeam') html = vTeamEd(true);
  else if (s === 'edMascot') html = vMascotEd(true);
  else if (!LG || LG.user < 0) html = vTitle();
  else if (s === 'hub') html = shell(vHub());
  else if (s === 'roster') html = shell(vRoster());
  else if (s === 'depth') html = shell(vDepth());
  else if (s === 'trade') html = shell(vTrade());
  else if (s === 'fa') html = shell(vFA());
  else if (s === 'draft') html = shell(vDraft());
  else if (s === 'league') html = shell(vLeague());
  else if (s === 'teamed') html = shell(vTeamEd());
  else if (s === 'mascot') html = shell(vMascotEd());
  el.innerHTML = html;
  if (s === 'mascot' || s === 'edMascot') mascotLoop();
  saveLeague();
}

/* ---------- title ---------- */
function vTitle() {
  const ids = shuffle([...Array(32).keys()]).slice(0, 6);
  const has = LG && LG.user >= 0;
  return `<div class="title"><img src="icons/icon-192.png" width="96" height="96" style="image-rendering:pixelated;border:3px solid #000;box-shadow:4px 4px 0 #000"><h1>PIXEL<br>GRIDIRON</h1><div class="dim">Coach · GM · Legend</div>
  <div class="parade">${ids.map(i => `<img src="${mascotURL(LG.teams[i].mascot, 3, 0, false)}">`).join('')}</div>
  ${has ? `<button class="pri" data-a="go" data-v="hub">Continue career</button>` : ''}
  <button class="${has ? '' : 'pri'}" data-a="newCareer">New career</button>
  <button data-a="go" data-v="edTeam">Team editor</button>
  <button data-a="go" data-v="edMascot">Mascot editor</button>
  <button class="bad" data-a="wipe">Erase save</button>
  <p class="dim" style="font-size:9px;padding:10px">Touch: drag to move, tap a receiver to throw. Keys: WASD/arrows, 1-5 to throw, Space = action.</p></div>`;
}
/* ---------- team select ---------- */
function vSelect() {
  const cards = LG.teams.map(t => { const r = teamRatings(t); return `<div class="teamcard" data-a="pickTeam" data-v="${t.id}"><div class="stripe" style="background:linear-gradient(90deg,${t.c1} 50%,${t.c2} 50%)"></div>
    <img src="${mascotURL(t.mascot, 3, 0, false)}"><div><b>${esc(t.abbr)}</b></div><div style="font-size:9px">${esc(t.city)}<br>${esc(t.name)}</div>
    <div style="margin-top:4px">${ovrBadge(r.ovr)}</div><div class="dim" style="font-size:8px">OFF ${r.off} · DEF ${r.def}</div><div class="dim" style="font-size:8px">${t.conf} ${DIV_NAMES[t.div]}</div></div>`; }).join('');
  return `<h2>Choose your franchise</h2><p class="dim">You are the head coach &amp; GM. Tap a team to take over.</p><div class="row"><button data-a="go" data-v="title">Back</button></div><div class="grid" style="margin-top:8px">${cards}</div>`;
}

/* ---------- hub ---------- */
function vHub() {
  const L = LG, t = myTeam(); let main = '';
  const rt = teamRatings(t);
  const g = userGame(L);
  if (L.phase === 'regular' || L.phase === 'playoffs') {
    if (g) {
      const home = g.h === L.user, opp = L.teams[home ? g.a : g.h], ro = teamRatings(opp);
      main = `<div class="card"><h2>${L.phase === 'playoffs' ? L.po.names[L.po.round - 1] : 'Week ' + L.week}</h2>
      <div class="row sp"><div>${badge(t)}<b>${esc(t.abbr)}</b> ${ovrBadge(rt.ovr)}</div><div class="dim">${home ? 'vs' : '@'}</div><div>${ovrBadge(ro.ovr)} <b>${esc(opp.abbr)}</b>${badge(opp)}</div></div>
      <div class="dim" style="font-size:9px">${esc(tname(opp))} (${opp.w}-${opp.l}${opp.t ? '-' + opp.t : ''}) · OFF ${ro.off} DEF ${ro.def} · Your OFF ${rt.off} DEF ${rt.def}</div>
      <div class="row" style="margin-top:8px"><button class="pri" data-a="playGame">Play game</button><button data-a="simGame">Sim game</button><button data-a="depthFirst">Set depth chart</button></div></div>`;
    } else if (L.phase === 'playoffs') {
      main = `<div class="card"><h2>${L.po.names[L.po.round - 1]}</h2><p>${L.po.exit[L.user] ? 'Your season is over.' : 'Your team has a bye this round!'}</p><div class="row"><button class="pri" data-a="simRound">Sim round</button><button data-a="simPlayoffs">Sim all playoffs</button></div></div>`;
    } else main = `<div class="card"><p>No game this week.</p><button class="pri" data-a="simRound">Next</button></div>`;
  } else if (L.phase === 'resign') {
    const n = t.roster.filter(p => p.exp).length;
    main = `<div class="card"><h2>Re-sign players</h2><p>${n} player(s) have expiring contracts. Re-sign them from the Roster tab or they hit free agency.</p>
    <div class="row"><button data-a="go" data-v="roster">Open roster</button><button class="pri" data-a="finishResign">Finish &amp; go to draft</button></div></div>`;
  } else if (L.phase === 'draft') {
    main = `<div class="card"><h2>${L.year} NFL Draft</h2><p>7 rounds, 224 picks. Order is reverse of standings. You can trade picks in the Trades tab.</p><button class="pri" data-a="go" data-v="draft">Enter draft room</button></div>`;
  } else if (L.phase === 'fa') {
    main = `<div class="card"><h2>Free agency</h2><p>Day ${L.faDay + 1} of 3. Sign the best free agents before the AI teams do.</p><div class="row"><button data-a="go" data-v="fa">Free agent list</button><button class="pri" data-a="advanceFA">Advance day</button></div></div>`;
  } else if (L.phase === 'preseason') {
    main = `<div class="card"><h2>Preseason</h2><p>Roster: ${t.roster.length}/53 · Payroll ${fmtM(payroll(t))} / ${fmtM(CAP)}.<br>You must be at 53 players and under the cap to start the season.</p><div class="row"><button data-a="go" data-v="roster">Cut players</button><button class="pri" data-a="startSeason">Start ${L.year + 1} season</button></div></div>`;
  }
  const hist = L.history.length ? `<div class="card"><h3>Champions</h3>${L.history.slice(-5).reverse().map(h => `<div>${h.year}: ${esc(h.champ)}</div>`).join('')}</div>` : '';
  return main + `<div class="card news"><h3>News</h3>${L.news.slice(0, 8).map(n => `<div>${esc(n.t)}</div>`).join('') || '<div class="dim">Nothing yet.</div>'}</div>` + hist +
    `<div class="row"><button data-a="go" data-v="title">Main menu</button></div>`;
}

/* ---------- roster ---------- */
function posTabs(cur, act) {
  return `<div class="nav">${['ALL', ...POS].map(p => `<button data-a="${act}" data-v="${p}" class="${cur === p ? 'on' : ''}">${p}</button>`).join('')}</div>`;
}
function playerRow(p, team, o) {
  o = o || {};
  const inj = p.inj > 0 ? `<span class="tag bad">INJ ${p.inj}w</span>` : '';
  return `<tr class="${p.inj ? 'inj' : ''}"><td><img class="pimg" src="${portraitURL(p, team)}"></td><td>${esc(p.name)} ${inj}${p.rookie ? '<span class="tag">R</span>' : ''}</td><td>${p.pos}</td><td>${p.age}</td><td>${ovrBadge(p.ovr)}</td><td>${p.pot}</td><td>${p.spd}</td>${o.extra || ''}</tr>`;
}
function vRoster() {
  const t = myTeam(), L = LG;
  const list = t.roster.filter(p => UI.pos === 'ALL' || p.pos === UI.pos).sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ovr - a.ovr);
  const rows = list.map(p => {
    let act;
    if (p.exp) act = `<td colspan="2" class="gold">Wants ${fmtM(p.askSal)} × ${p.askYrs}y</td><td><button class="sm good" data-a="resign" data-v="${p.id}">Re-sign</button> <button class="sm bad" data-a="release" data-v="${p.id}">Let go</button></td>`;
    else act = `<td>${fmtM(p.sal)}</td><td>${p.yrs}y</td><td><button class="sm bad" data-a="release" data-v="${p.id}">Cut</button></td>`;
    return playerRow(p, t, { extra: act });
  }).join('');
  return `<h2>Roster · Payroll ${fmtM(payroll(t))} / ${fmtM(CAP)}</h2>${posTabs(UI.pos, 'pos')}
  <div class="tbl"><table><tr><th></th><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th>SPD</th><th>$</th><th>Yrs</th><th></th></tr>${rows}</table></div>
  ${L.phase === 'resign' ? `<div class="row" style="margin-top:8px"><button class="pri" data-a="finishResign">Finish re-signing → Draft</button></div>` : ''}`;
}

/* ---------- depth chart ---------- */
function depthEditor(team, ingame) {
  normalizeDepth(team);
  const groups = (UI.depthPos === 'ALL' ? POS : [UI.depthPos]);
  const m = new Map(team.roster.map(p => [p.id, p]));
  return groups.map(pos => {
    const list = team.depth[pos].map(id => m.get(id)).filter(Boolean), ns = STARTERS[pos];
    const slotName = i => { const l = [...SLOTS_OFF, ...SLOTS_DEF].filter(s => s[1] === pos).map(s => s[0]); return l[i] || 'Bench'; };
    return `<div class="card"><h3>${POS_LABEL[pos]}</h3>${list.map((p, i) => `<div class="sub ${i < ns ? 'gold' : ''}"><span class="tag" style="min-width:42px;text-align:center">${i < ns ? slotName(i) : 'BENCH'}</span>
      <img class="pimg" src="${portraitURL(p, team)}"><span class="nm">${esc(p.name)} ${p.inj ? `<span class="bad">INJ</span>` : ''}</span>${ovrBadge(p.ovr)}
      ${ingame ? `<span class="fatb" title="fatigue"><i style="width:${p.fat || 0}%"></i></span>` : `<span class="dim">${p.spd}spd</span>`}
      <button class="sm" data-a="dmove" data-p="${pos}" data-i="${i}" data-d="-1" ${i === 0 ? 'disabled' : ''}>▲</button>
      <button class="sm" data-a="dmove" data-p="${pos}" data-i="${i}" data-d="1" ${i === list.length - 1 ? 'disabled' : ''}>▼</button></div>`).join('')}</div>`;
  }).join('');
}
function vDepth() {
  const t = myTeam();
  return `<h2>Depth chart</h2><p class="dim" style="font-size:9px">Top of each list starts. Injured players are skipped automatically. Rest your tired players during games from the SUBS button.</p>
  <div class="row"><button data-a="autoDepth" class="good">Auto-sort by rating</button></div>${posTabs(UI.depthPos, 'dpos')}${depthEditor(t, false)}`;
}

/* ---------- trades ---------- */
function vTrade() {
  const L = LG, U = myTeam(); if (UI.tradeWith === L.user) UI.tradeWith = (L.user + 1) % 32;
  const O = L.teams[UI.tradeWith];
  const sel = `<select data-a="tradeWith">${L.teams.filter(t => t.id !== L.user).map(t => `<option value="${t.id}" ${t.id === O.id ? 'selected' : ''}>${esc(tname(t))}</option>`).join('')}</select>`;
  const plist = (t, set, act) => t.roster.slice().sort((a, b) => b.ovr - a.ovr).map(p => `<label class="sub"><input type="checkbox" data-a="${act}" data-v="${p.id}" ${set.has(p.id) ? 'checked' : ''}><span class="nm">${esc(p.name)} <span class="dim">${p.pos} ${p.age}y</span></span>${ovrBadge(p.ovr)}<span class="dim">${fmtM(p.sal)}</span></label>`).join('');
  const klist = (tid, set, act) => L.picks.filter(k => k.owner === tid).sort((a, b) => a.year - b.year || a.round - b.round).map(k => { const i = L.picks.indexOf(k); return `<label class="sub"><input type="checkbox" data-a="${act}" data-v="${i}" ${set.has(i) ? 'checked' : ''}><span class="nm">${k.year} Round ${k.round}${k.orig !== tid ? ' <span class="dim">(' + L.teams[k.orig].abbr + ')</span>' : ''}${k.overall ? ' <span class="dim">#' + k.overall + '</span>' : ''}</span></label>`; }).join('');
  const sel2 = tt => ({ p: [...(tt === 'give' ? UI.give : UI.get)].map(findPlayer).filter(Boolean), k: [...(tt === 'give' ? UI.giveK : UI.getK)].map(i => L.picks[i]) });
  const give = sel2('give'), get = sel2('get');
  const vg = give.p.reduce((s, p) => s + playerValue(p), 0) + give.k.reduce((s, k) => s + pickValue(L, k), 0);
  const vt = get.p.reduce((s, p) => s + playerValue(p), 0) + get.k.reduce((s, k) => s + pickValue(L, k), 0);
  return `<h2>Trade center</h2>${!tradeAllowed(L) ? '<div class="card bad">Trades are closed (deadline after Week 9, and during playoffs).</div>' : ''}
  <div class="row">${sel}<span class="dim">Cap: you ${fmtM(capSpace(U))} · them ${fmtM(capSpace(O))}</span></div>
  <div class="card">Value you give: <b>${vg.toFixed(0)}</b> &nbsp; you get: <b>${vt.toFixed(0)}</b> ${UI.tradeMsg ? `<div class="gold" style="margin-top:6px">${esc(UI.tradeMsg)}</div>` : ''}
  <div class="row" style="margin-top:6px"><button class="pri" data-a="propose">Propose trade</button><button data-a="clearTrade">Clear</button></div></div>
  <div class="grid2"><div class="card"><h3>You give (${esc(U.abbr)})</h3>${klist(U.id, UI.giveK, 'tgk')}${plist(U, UI.give, 'tg')}</div>
  <div class="card"><h3>You get (${esc(O.abbr)})</h3>${klist(O.id, UI.getK, 'tkk')}${plist(O, UI.get, 'tk')}</div></div>`;
}

/* ---------- free agents ---------- */
function vFA() {
  const t = myTeam(), L = LG;
  const list = L.fa.filter(p => UI.faPos === 'ALL' || p.pos === UI.faPos).sort((a, b) => b.ovr - a.ovr).slice(0, 80);
  const rows = list.map(p => playerRow(p, t, { extra: `<td>${fmtM(p.askSal)}</td><td>${p.askYrs}y</td><td><button class="sm good" data-a="sign" data-v="${p.id}">Sign</button></td>` })).join('');
  return `<h2>Free agents (${L.fa.length})</h2><div class="dim">Cap space ${fmtM(capSpace(t))} · Roster ${t.roster.length}/53</div>${posTabs(UI.faPos, 'fpos')}
  ${L.phase === 'fa' ? `<div class="row"><button class="pri" data-a="advanceFA">Advance day (AI teams sign players)</button></div>` : ''}
  <div class="tbl"><table><tr><th></th><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th>SPD</th><th>Ask</th><th>Yrs</th><th></th></tr>${rows}</table></div>`;
}

/* ---------- draft ---------- */
function vDraft() {
  const L = LG, t = myTeam();
  if (L.phase !== 'draft') return `<h2>Draft</h2><div class="card">The draft takes place after the playoffs.<br><br>Your picks:<br>${L.picks.filter(k => k.owner === L.user).sort((a, b) => a.year - b.year || a.round - b.round).map(k => `${k.year} R${k.round}${k.orig !== L.user ? ' (' + L.teams[k.orig].abbr + ')' : ''}`).join(' · ')}</div>`;
  const cur = draftCurrent(L), onClock = L.teams[cur.owner], mine = cur.owner === L.user;
  const list = L.prospects.filter(p => UI.dPos === 'ALL' || p.pos === UI.dPos).slice(0, 70);
  const rows = list.map(p => `<tr><td><img class="pimg" src="${portraitURL(p, t)}"></td><td>${esc(p.name)}</td><td>${p.pos}</td><td>${p.age}</td><td>~${ovrBadge(p.scout)}</td><td>~${p.potScout}</td><td>${mine ? `<button class="sm good" data-a="draftPick" data-v="${p.id}">Draft</button>` : ''}</td></tr>`).join('');
  return `<h2>${L.year} Draft · Round ${cur.round}, Pick ${((cur.overall - 1) % 32) + 1} (#${cur.overall})</h2>
  <div class="card">${badge(onClock)}<b>${esc(tname(onClock))}</b> ${mine ? '<span class="gold">— YOU ARE ON THE CLOCK</span>' : 'on the clock'}
  <div class="row" style="margin-top:8px"><button data-a="draftToMe" ${mine ? 'disabled' : ''}>Sim to my pick</button><button data-a="draftAuto" ${mine ? '' : 'disabled'}>Auto-pick for me</button><button class="bad" data-a="draftAll">Sim entire draft</button></div>
  <div class="news" style="margin-top:6px">${L.draft.log.map(d => `<div class="${d.user ? 'gold' : ''}">#${d.overall} ${d.team}: ${esc(d.name)} (${d.pos})</div>`).join('')}</div></div>
  <div class="dim" style="font-size:9px">Scouting grades are estimates (~) — the real rating may differ.</div>${posTabs(UI.dPos, 'dposf')}
  <div class="tbl"><table><tr><th></th><th>Name</th><th>Pos</th><th>Age</th><th>OVR</th><th>POT</th><th></th></tr>${rows}</table></div>`;
}

/* ---------- league ---------- */
function vLeague() {
  const L = LG, tab = UI.leagueTab;
  const tabs = `<div class="nav">${[['standings', 'Standings'], ['schedule', 'My schedule'], ['scores', 'Scores'], ['playoffs', 'Playoffs'], ['power', 'Power ranks']].map(([k, l]) => `<button data-a="ltab" data-v="${k}" class="${tab === k ? 'on' : ''}">${l}</button>`).join('')}</div>`;
  let body = '';
  const rec = t => `${t.w}-${t.l}${t.t ? '-' + t.t : ''}`;
  if (tab === 'standings') {
    body = ['AFC', 'NFC'].map(conf => `<h3>${conf}</h3><div class="grid2">${[0, 1, 2, 3].map(d => { const ts = L.teams.filter(t => t.conf === conf && t.div === d).sort((a, b) => pct(b) - pct(a) || (b.pf - b.pa) - (a.pf - a.pa));
      return `<div class="card"><b>${conf} ${DIV_NAMES[d]}</b><table>${ts.map(t => `<tr class="${t.id === L.user ? 'starter' : ''}"><td>${badge(t)}${esc(t.abbr)}</td><td>${rec(t)}</td><td class="dim">${t.pf}-${t.pa}</td></tr>`).join('')}</table></div>`; }).join('')}</div>`).join('');
  } else if (tab === 'schedule') {
    body = `<div class="card"><table>${L.schedule.map((wk, i) => { const g = wk.find(g => g.h === L.user || g.a === L.user); if (!g) return ''; const home = g.h === L.user, o = L.teams[home ? g.a : g.h];
      const res = g.done ? ((home ? g.hs : g.as) > (home ? g.as : g.hs) ? '<span class="good">W</span>' : (home ? g.hs : g.as) < (home ? g.as : g.hs) ? '<span class="bad">L</span>' : 'T') + ` ${home ? g.hs : g.as}-${home ? g.as : g.hs}` : '<span class="dim">—</span>';
      return `<tr class="${i + 1 === L.week && L.phase === 'regular' ? 'starter' : ''}"><td>Wk ${i + 1}</td><td>${home ? 'vs' : '@'} ${badge(o)}${esc(o.abbr)}</td><td>${res}</td></tr>`; }).join('')}</table></div>`;
  } else if (tab === 'scores') {
    const wk = Math.max(1, Math.min(NUM_WEEKS, L.phase === 'regular' ? L.week - 1 : NUM_WEEKS)); const gs = L.schedule[wk - 1] || [];
    body = `<h3>Week ${wk} results</h3><div class="card"><table>${gs.map(g => `<tr><td>${esc(L.teams[g.a].abbr)} ${g.done ? g.as : ''}</td><td>@</td><td>${esc(L.teams[g.h].abbr)} ${g.done ? g.hs : ''}</td></tr>`).join('')}</table></div>`;
  } else if (tab === 'playoffs') {
    if (!L.po) body = '<div class="card dim">Playoffs begin after week 17. Seven teams per conference qualify.</div>';
    else body = `<div class="card"><b>${L.po.names[Math.min(3, L.po.round - 1)]}</b>${L.po.games.map(g => `<div>${esc(L.teams[g.a].abbr)} ${g.done ? g.as : ''} @ ${esc(L.teams[g.h].abbr)} ${g.done ? g.hs : ''}</div>`).join('')}${L.po.champion != null ? `<h3>Champion: ${esc(tname(L.teams[L.po.champion]))}</h3>` : ''}</div>`;
  } else {
    const rk = L.teams.map(t => ({ t, r: teamRatings(t) })).sort((a, b) => b.r.ovr - a.r.ovr);
    body = `<div class="card"><table>${rk.map((x, i) => `<tr class="${x.t.id === L.user ? 'starter' : ''}"><td>${i + 1}</td><td>${badge(x.t)}${esc(tname(x.t))}</td><td>${ovrBadge(x.r.ovr)}</td><td class="dim">O ${x.r.off} D ${x.r.def}</td><td>${rec(x.t)}</td></tr>`).join('')}</table></div>`;
  }
  return `<h2>League</h2>${tabs}${body}`;
}

/* ---------- team editor ---------- */
function vTeamEd(standalone) {
  const t = LG.teams[UI.edTeam];
  const head = standalone ? `<div class="row"><button data-a="go" data-v="title">Back</button></div>` : '';
  const sel = `<select data-a="edTeamSel">${LG.teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(tname(x))}</option>`).join('')}</select>`;
  const rows = t.roster.slice().sort((a, b) => POS.indexOf(a.pos) - POS.indexOf(b.pos) || b.ovr - a.ovr).map(p => `<tr><td><img class="pimg" data-pid="${p.id}" src="${portraitURL(p, t)}"></td>
    <td><input type="text" style="width:130px" value="${esc(p.name)}" data-bind="player:${p.id}:name"></td><td>${p.pos}</td>
    <td><input type="number" style="width:52px" min="0" max="99" value="${p.num}" data-bind="player:${p.id}:num"></td>
    <td><input type="number" style="width:52px" min="40" max="99" value="${p.ovr}" data-bind="player:${p.id}:ovr"></td>
    <td>${SKINS.map((c, i) => `<span class="sw ${p.skin === i ? 'on' : ''}" style="background:${c}" data-a="skin" data-id="${p.id}" data-v="${i}"></span>`).join('')}</td>
    <td><select data-bind="player:${p.id}:hs">${HAIR_STYLES.map((n, i) => `<option value="${i}" ${p.hs === i ? 'selected' : ''}>${n}</option>`).join('')}</select>
    <select data-bind="player:${p.id}:hair">${HAIRS.map((c, i) => `<option value="${i}" ${p.hair === i ? 'selected' : ''}>Hair ${i + 1}</option>`).join('')}</select></td></tr>`).join('');
  return (standalone ? '<div style="padding:10px">' : '') + head + `<h2>Team editor</h2><div class="row">${sel}<button data-a="resetTeam" class="bad">Reset team to default</button><button data-a="rndNames">Randomize player names</button></div>
  <div class="card"><div class="row">
   <label>City <input type="text" value="${esc(t.city)}" data-bind="team:${t.id}:city"></label>
   <label>Nickname <input type="text" value="${esc(t.name)}" data-bind="team:${t.id}:name"></label>
   <label>Abbr <input type="text" style="width:60px" maxlength="4" value="${esc(t.abbr)}" data-bind="team:${t.id}:abbr"></label>
   <label>Stadium <input type="text" value="${esc(t.stadium)}" data-bind="team:${t.id}:stadium"></label>
   <label>Primary <input type="color" value="${t.c1}" data-bind="team:${t.id}:c1"></label>
   <label>Secondary <input type="color" value="${t.c2}" data-bind="team:${t.id}:c2"></label></div></div>
  <div class="tbl"><table><tr><th></th><th>Name</th><th>Pos</th><th>#</th><th>OVR</th><th>Skin</th><th>Hair</th></tr>${rows}</table></div>` + (standalone ? '</div>' : '');
}

/* ---------- mascot editor ---------- */
function vMascotEd(standalone) {
  const t = LG.teams[UI.mTeam], m = t.mascot;
  const opt = (arr, cur, lab) => arr.map(v => `<option value="${v}" ${v === cur ? 'selected' : ''}>${lab ? lab(v) : v}</option>`).join('');
  return (standalone ? '<div style="padding:10px"><div class="row"><button data-a="go" data-v="title">Back</button></div>' : '') + `<h2>Mascot editor</h2>
  <div class="row"><select data-a="mTeamSel">${LG.teams.map(x => `<option value="${x.id}" ${x.id === t.id ? 'selected' : ''}>${esc(tname(x))}</option>`).join('')}</select>
  <button data-a="mRandom">Randomize</button><button class="bad" data-a="mReset">Reset to default</button><button data-a="mCheer">${UI.mCheer ? 'Show idle' : 'Show cheer'}</button></div>
  <div class="grid2"><div class="prev"><canvas id="mcv" width="260" height="300"></canvas></div>
  <div class="card"><div style="display:grid;gap:8px">
   <label>Name <input type="text" value="${esc(m.name)}" data-bind="mascot:${t.id}:name"></label>
   <label>Body <select data-bind="mascot:${t.id}:species">${opt(SPECIES, m.species, v => v[0].toUpperCase() + v.slice(1))}</select></label>
   <label>Hat <select data-bind="mascot:${t.id}:hat">${opt(HATS, m.hat)}</select></label>
   <label>Prop <select data-bind="mascot:${t.id}:acc">${opt(ACCS, m.acc)}</select></label>
   <label>Cheer style <select data-bind="mascot:${t.id}:cheer">${opt(Object.keys(CHEERS), m.cheer, v => CHEERS[v][0])}</select></label>
   <div class="dim" style="font-size:9px">Perk: ${CHEERS[m.cheer][1]}</div>
   <label><input type="checkbox" ${m.shades ? 'checked' : ''} data-bind="mascot:${t.id}:shades"> Sunglasses</label>
   <div class="row"><label>Color 1 <input type="color" value="${m.c1}" data-bind="mascot:${t.id}:c1"></label><label>Color 2 <input type="color" value="${m.c2}" data-bind="mascot:${t.id}:c2"></label></div>
  </div></div></div>` + (standalone ? '</div>' : '');
}
function mascotLoop() {
  const cv = $('#mcv'); if (!cv) return; const ctx = cv.getContext('2d'); const t0 = performance.now();
  const tick = () => {
    const c = $('#mcv'); if (!c) return; ctx.imageSmoothingEnabled = false; ctx.fillStyle = '#1d3a24'; ctx.fillRect(0, 0, 260, 300);
    ctx.fillStyle = '#2e7d32'; for (let i = 0; i < 6; i++) if (i % 2) ctx.fillRect(i * 44, 0, 44, 300);
    drawMascot(ctx, LG.teams[UI.mTeam].mascot, 130, 288, 3, (performance.now() - t0) / 1000, UI.mCheer);
    mraf = requestAnimationFrame(tick);
  };
  tick();
}

/* =========================================================
   Actions (event delegation)
   ========================================================= */
const A = {
  go(d) { go(d.v); },
  pos(d) { UI.pos = d.v; render(); }, dpos(d) { UI.depthPos = d.v; render(); }, fpos(d) { UI.faPos = d.v; render(); }, dposf(d) { UI.dPos = d.v; render(); },
  ltab(d) { UI.leagueTab = d.v; render(); },
  wipe() { if (confirm('Erase your saved career and all edits?')) { wipeSave(); LG = newLeague(); UI.screen = 'title'; render(); } },
  newCareer() { if (LG && LG.user >= 0 && !confirm('Start a new career? Your current career will be replaced (team & mascot edits are kept).')) return; LG = newLeague(LG); UI.screen = 'select'; render(); },
  pickTeam(d) { LG.user = +d.v; UI.tradeWith = (LG.user + 1) % 32; UI.edTeam = LG.user; UI.mTeam = LG.user; news(LG, `You are now the coach & GM of the ${tname(myTeam())}.`); go('hub'); },
  release(d) {
    const p = findPlayer(+d.v), t = myTeam(); if (!p) return;
    if (!p.exp && !confirm(`Cut ${p.name}? He will become a free agent.`)) return;
    release(LG, t, p); normalizeDepth(t); render();
  },
  resign(d) { const p = findPlayer(+d.v); const e = reSign(LG, p); if (e) toast(e); else toast(p.name + ' re-signed!'); render(); },
  finishResign() { if (!confirm('Unsigned players will leave. Continue to the draft?')) return; finishReSign(LG); go('draft'); },
  dmove(d) { const t = myTeam(), l = t.depth[d.p], i = +d.i, j = i + +d.d; if (j < 0 || j >= l.length) return; [l[i], l[j]] = [l[j], l[i]]; if (M && !$('#modal').hidden) { openSubs(); } else render(); },
  autoDepth() { autoDepth(myTeam()); render(); },
  depthFirst() { go('depth'); },
  /* trades */
  tradeWith(d, el) { UI.tradeWith = +el.value; UI.get.clear(); UI.getK.clear(); UI.tradeMsg = ''; render(); },
  tg(d, el) { el.checked ? UI.give.add(+d.v) : UI.give.delete(+d.v); render(); }, tk(d, el) { el.checked ? UI.get.add(+d.v) : UI.get.delete(+d.v); render(); },
  tgk(d, el) { el.checked ? UI.giveK.add(+d.v) : UI.giveK.delete(+d.v); render(); }, tkk(d, el) { el.checked ? UI.getK.add(+d.v) : UI.getK.delete(+d.v); render(); },
  clearTrade() { UI.give.clear(); UI.get.clear(); UI.giveK.clear(); UI.getK.clear(); UI.tradeMsg = ''; render(); },
  propose() {
    const give = { p: [...UI.give].map(findPlayer).filter(Boolean), k: [...UI.giveK].map(i => LG.picks[i]) }, get = { p: [...UI.get].map(findPlayer).filter(Boolean), k: [...UI.getK].map(i => LG.picks[i]) };
    const r = evalTrade(LG, LG.user, UI.tradeWith, give, get); UI.tradeMsg = r.msg;
    if (r.ok) { execTrade(LG, LG.user, UI.tradeWith, give, get); UI.give.clear(); UI.get.clear(); UI.giveK.clear(); UI.getK.clear(); }
    render();
  },
  /* FA / offseason */
  sign(d) { const p = findPlayer(+d.v); const e = signFA(LG, p); toast(e || `${p.name} signed for ${fmtM(p.sal)} × ${p.yrs}y!`); render(); },
  advanceFA() { advanceFA(LG); toast(LG.phase === 'preseason' ? 'Free agency is over.' : 'AI teams made their signings.'); render(); },
  startSeason() { const e = startNewSeason(LG); if (e) { toast(e); render(); } else go('hub'); },
  /* draft */
  draftPick(d) { const p = LG.prospects.find(x => x.id === +d.v); if (!p) return; doDraftPick(LG, p); simDraft(LG, true); LG.phase === 'draft' ? render() : go('hub'); },
  draftToMe() { simDraft(LG, true); LG.phase === 'draft' ? render() : go('hub'); },
  draftAuto() { aiDraftPick(LG); simDraft(LG, true); LG.phase === 'draft' ? render() : go('hub'); },
  draftAll() { if (confirm('Auto-draft all remaining picks?')) { simDraft(LG, false); go('hub'); } },
  /* games */
  playGame() { const g = userGame(LG); if (g) startMatch(g); },
  simGame() {
    const g = userGame(LG); if (!g) return;
    const [hs, as] = simGameScore(LG, LG.teams[g.h], LG.teams[g.a], !!g.neutral, LG.phase === 'playoffs'); g.hs = hs; g.as = as; g.done = true;
    finishUserGame(g, null);
  },
  simRound() { if (LG.phase === 'playoffs') finishPoRound(LG); render(); },
  simPlayoffs() { let n = 0; while (LG.phase === 'playoffs' && n++ < 6) finishPoRound(LG); render(); },
  /* editors */
  edTeamSel(d, el) { UI.edTeam = +el.value; render(); },
  mTeamSel(d, el) { UI.mTeam = +el.value; render(); },
  skin(d) { const p = findPlayer(+d.id); p.skin = +d.v; refreshPortrait(p); render(); },
  resetTeam() {
    const i = UI.edTeam, t = LG.teams[i], dt = TEAM_DATA[i]; if (!confirm('Reset this team name/colors/mascot to default?')) return;
    Object.assign(t, { city: dt[0], name: dt[1], abbr: dt[2], c1: dt[3], c2: dt[4], stadium: dt[0] + ' Stadium', mascot: defaultMascot(i) }); render();
  },
  rndNames() { LG.teams[UI.edTeam].roster.forEach(p => p.name = genName()); render(); },
  mRandom() {
    const m = LG.teams[UI.mTeam].mascot; const col = () => '#' + [0, 0, 0].map(() => ri(40, 230).toString(16).padStart(2, '0')).join('');
    Object.assign(m, { name: pick(MASCOT_FIRST) + ' the ' + pick(['Wild', 'Great', 'Mighty', 'Fierce', 'Bold']), species: pick(SPECIES), c1: col(), c2: col(), hat: pick(HATS), acc: pick(ACCS), shades: Math.random() < 0.3, cheer: pick(Object.keys(CHEERS)) }); render();
  },
  mReset() { LG.teams[UI.mTeam].mascot = defaultMascot(UI.mTeam); render(); },
  mCheer() { UI.mCheer = !UI.mCheer; render(); },
};
document.addEventListener('click', e => {
  const el = e.target.closest('[data-a]'); if (!el) return;
  if (['SELECT', 'INPUT'].includes(el.tagName) && e.type === 'click' && el.tagName === 'SELECT') return;
  if (el.tagName === 'INPUT' && el.type === 'checkbox') return; // handled in change
  const fn = A[el.dataset.a]; if (fn) fn(el.dataset, el, e);
});
document.addEventListener('change', e => {
  const el = e.target;
  if (el.dataset.a && (el.tagName === 'SELECT' || (el.tagName === 'INPUT' && el.type === 'checkbox'))) { const fn = A[el.dataset.a]; if (fn) fn(el.dataset, el, e); return; }
  if (el.dataset.bind) bind(el, true);
});
document.addEventListener('input', e => { const el = e.target; if (el.dataset.bind && (el.type === 'text' || el.type === 'number' || el.type === 'color')) bind(el, false); });
function refreshPortrait(p) { const t = LG.teams[p.tid] || null; document.querySelectorAll(`img[data-pid="${p.id}"]`).forEach(i => i.src = portraitURL(p, t)); }
function bind(el, final) {
  const [kind, id, f] = el.dataset.bind.split(':'); let v = el.type === 'checkbox' ? el.checked : el.value;
  if (kind === 'team') { LG.teams[+id][f] = f === 'abbr' ? String(v).toUpperCase().slice(0, 4) : v; }
  else if (kind === 'mascot') { LG.teams[+id].mascot[f] = v; if (final && ['species', 'hat', 'acc', 'cheer'].includes(f)) render(); }
  else if (kind === 'player') {
    const p = findPlayer(+id); if (!p) return;
    if (['num', 'ovr', 'hs', 'hair'].includes(f)) { v = +v; if (f === 'ovr') v = clamp(v || 40, 40, 99); if (f === 'num') v = clamp(v || 0, 0, 99); }
    p[f] = v; if (f === 'ovr' && p.pot < v) p.pot = v; if (['hs', 'hair'].includes(f)) refreshPortrait(p);
  }
  clearTimeout(bind.t); bind.t = setTimeout(saveLeague, 400);
}

/* =========================================================
   Match flow
   ========================================================= */
const keys = {}; const joy = { id: null, ox: 0, oy: 0, dx: 0, dy: 0, t0: 0, moved: false };
function startMatch(g) {
  const H = LG.teams[g.h], Aw = LG.teams[g.a], side = g.h === LG.user ? 'home' : 'away';
  M = new Match(H, Aw, { userSide: side, playoff: LG.phase === 'playoffs' }); M.gm = g; M.handled = false; paused = false;
  $('#screen').hidden = true; $('#gameWrap').hidden = false; closeModal(); lastKey = '';
  let last = performance.now();
  cancelAnimationFrame(raf);
  const loop = now => {
    const dt = Math.min(0.05, (now - last) / 1000); last = now;
    if (!paused && M) {
      readInput(); M.update(dt / 2); M.update(dt / 2); M.draw($('#cv').getContext('2d')); syncGameUI();
      if (M.over && !M.handled) { M.handled = true; setTimeout(() => showPostGame(M), 900); }
    }
    raf = requestAnimationFrame(loop);
  };
  raf = requestAnimationFrame(loop);
}
function readInput() {
  const inp = M.input; let dx = joy.dx, dy = joy.dy;
  if (keys.ArrowLeft || keys.a) dx -= 1; if (keys.ArrowRight || keys.d) dx += 1; if (keys.ArrowUp || keys.w) dy -= 1; if (keys.ArrowDown || keys.s) dy += 1;
  const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; }
  inp.dx = dx; inp.dy = dy;
}
let lastKey = '';
function syncGameUI() {
  const m = M, call = m.callSide(), pl = m.pl;
  const key = m.phase + '|' + call + '|' + m.down + '|' + m.toGo + '|' + Math.round(m.ballX) + '|' + m.poss + '|' + (m.q) + '|' + m.score.home + m.score.away + '|' + (m.over ? 1 : 0);
  const cu = $('#callUI');
  if (key !== lastKey) { lastKey = key; cu.innerHTML = call ? callPanel(call) : ''; }
  // action button
  const ab = $('#actBtn'); let label = '';
  if (m.phase === 'play' && pl && pl.ctrl && m.userSide) {
    const c = pl.ctrl;
    label = (c === pl.qb && pl.holder === pl.qb && !pl.isRun && (c.x - pl.x0) * pl.d <= 0.3) ? 'THROW AWAY' : pl.holder === c ? 'JUKE / DIVE' : (pl.o.qb === c ? '' : (c.rush ? 'SWIM' : 'DIVE / JUMP'));
  }
  ab.hidden = !label; if (label) ab.textContent = label;
}
function callPanel(side) {
  const m = M, sit = `${m.downText()} at ${m.spotText()} · ${m.qText()} ${m.clockText()} · ${m.team.home.abbr} ${m.score.home} - ${m.team.away.abbr} ${m.score.away}`;
  if (side === 'off') {
    const fourth = m.down === 4, ytg = m.ytg();
    const plays = [['run_in', 'Run In'], ['run_out', 'Run Out'], ['pass_short', 'Short'], ['pass_mid', 'Medium'], ['pass_deep', 'Deep']];
    return `<div class="callp"><div class="sit">${sit}</div>
    ${fourth ? `<div class="btns"><button class="pri" data-g="punt">Punt</button><button class="pri" data-g="fg" ${ytg + 17 > 62 ? 'disabled' : ''}>FG (${ytg + 17}y)</button></div><div class="dim" style="text-align:center">…or go for it:</div>` : ''}
    <div class="btns">${plays.map(([k, l]) => `<button data-g="${k}">${l}</button>`).join('')}</div>
    <div class="btns"><button data-g="kneel">Kneel</button><button data-g="subs">Subs / Depth</button></div></div>`;
  }
  return `<div class="callp"><div class="sit">DEFENSE · ${sit}</div><div class="btns">
    <button data-g="d:base">Base</button><button data-g="d:blitz">Blitz</button><button data-g="d:zone">Zone</button><button data-g="d:run_stop">Stop run</button><button data-g="subs">Subs</button></div>
    <div class="dim" style="text-align:center;font-size:.9em">You control the highlighted defender. Tap a defender to take over. Tap a defender to take over; drag to move.</div></div>`;
}
$('#callUI').addEventListener('click', e => {
  const b = e.target.closest('[data-g]'); if (!b || !M) return; const g = b.dataset.g;
  if (g === 'subs') return openSubs();
  if (g.startsWith('d:')) { M.call(M.aiOffCall(), g.slice(2)); } else M.call(g, null);
  lastKey = '';
});
function openSubs() {
  const t = M.team[M.userSide];
  modal(`<h2>Substitutions</h2><p class="dim" style="font-size:9px">Move a bench player above a starter. Fatigue bars show tired players (tired = slower &amp; weaker).</p>
  <div class="row"><button data-a="subsAuto" class="good">Auto-sort</button><button class="pri" id="subsClose">Done</button></div>${posTabs(UI.depthPos, 'subsPos')}${depthEditor(t, true)}`);
}
A.subsPos = d => { UI.depthPos = d.v; openSubs(); };
A.subsAuto = () => { autoDepth(M.team[M.userSide]); openSubs(); };
$('#modal').addEventListener('click', e => { if (e.target.id === 'subsClose') { closeModal(); lastKey = ''; } });
/* pause */
$('#pauseBtn').addEventListener('click', () => {
  paused = true;
  modal(`<h2>Paused</h2><div class="row"><button class="pri" id="resumeBtn">Resume</button><button id="autoBtn" class="bad">Auto-play rest of game</button></div>`);
});
$('#modal').addEventListener('click', e => {
  if (e.target.id === 'resumeBtn') { closeModal(); paused = false; }
  if (e.target.id === 'autoBtn') { closeModal(); M.userSide = null; paused = false; if (M.phase === 'presnap') M.autoCall(); }
});
/* touch / mouse input */
const stage = $('#stage'); let fgPtr = null;
function toCanvas(e) { const r = $('#cv').getBoundingClientRect(); return [(e.clientX - r.left) / r.width * CW, (e.clientY - r.top) / r.height * CH]; }
stage.addEventListener('pointerdown', e => {
  if (!M || e.target.closest('button') || e.target.closest('.callp')) return;
  const [cx, cy] = toCanvas(e);
  if (M.phase === 'fgaim') { fgPtr = e.pointerId; stage.setPointerCapture(e.pointerId); M.fgStart(cx, cy); return; }
  if (joy.id === null) { joy.id = e.pointerId; joy.ox = e.clientX; joy.oy = e.clientY; joy.t0 = performance.now(); joy.moved = false; joy.sx = cx; joy.sy = cy; stage.setPointerCapture(e.pointerId); }
  else M.tapAt(cx, cy);
});
stage.addEventListener('pointermove', e => {
  if (e.pointerId === fgPtr && M) { const [cx, cy] = toCanvas(e); M.fgMove(cx, cy); return; }
  if (e.pointerId !== joy.id) return;
  const dx = e.clientX - joy.ox, dy = e.clientY - joy.oy, r = 44, m = Math.hypot(dx, dy);
  if (m > 10 && !joy.moved) { joy.moved = true; const j = $('#joy'); const sr = stage.getBoundingClientRect(); j.style.left = (joy.ox - sr.left) + 'px'; j.style.top = (joy.oy - sr.top) + 'px'; j.hidden = false; }
  if (joy.moved) { const k = Math.min(1, m / r); joy.dx = dx / (m || 1) * k; joy.dy = dy / (m || 1) * k; $('#knob').style.transform = `translate(${joy.dx * r}px,${joy.dy * r}px)`; }
});
const endPtr = e => {
  if (e.pointerId === fgPtr) { fgPtr = null; if (M) M.fgEnd(); return; }
  if (e.pointerId !== joy.id) return;
  if (!joy.moved && performance.now() - joy.t0 < 450 && M) M.tapAt(joy.sx, joy.sy);
  joy.id = null; joy.dx = joy.dy = 0; $('#joy').hidden = true; $('#knob').style.transform = '';
};
stage.addEventListener('pointerup', endPtr); stage.addEventListener('pointercancel', endPtr);
$('#actBtn').addEventListener('pointerdown', e => { e.preventDefault(); e.stopPropagation(); if (M) M.input.act = true; });
window.addEventListener('keydown', e => {
  if (!M || $('#gameWrap').hidden) return; const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
  keys[k] = true;
  if (['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown', ' '].includes(k)) e.preventDefault();
  if (M.phase === 'fgaim' && k === ' ') { if (!e.repeat) M.fgCharge(true); return; }
  if (k === ' ' || k === 'z' || k === 'j') M.input.act = true;
  if (k >= '1' && k <= '5') M.input.throwIdx = +k - 1;
  if (k === 'p') $('#pauseBtn').click();
});
window.addEventListener('keyup', e => { const k = e.key.length === 1 ? e.key.toLowerCase() : e.key; keys[k] = false; if (k === ' ' && M && M.phase === 'fgaim') M.fgCharge(false); });

/* ---------- finishing a game ---------- */
function showPostGame(m) {
  const us = m.userSide || (m.gm.h === LG.user ? 'home' : 'away'), th = m.team.home, ta = m.team.away;
  const me = m.score[us], them = m.score[oppS(us)], won = me > them, tie = me === them;
  const row = (l, a, b) => `<tr><td>${a}</td><td class="dim">${l}</td><td>${b}</td></tr>`;
  const S = m.stat;
  modal(`<h2 class="${won ? 'good' : tie ? '' : 'bad'}">${won ? 'VICTORY!' : tie ? 'TIE GAME' : 'DEFEAT'}</h2>
  <div class="row sp" style="font-size:16px"><div>${badge(th)}${esc(th.abbr)} <b>${m.score.home}</b></div><div class="dim">FINAL</div><div><b>${m.score.away}</b> ${esc(ta.abbr)}${badge(ta)}</div></div>
  <table style="margin:8px 0">${row('Total yards', S.home.yds, S.away.yds)}${row('Passing', S.home.pass, S.away.pass)}${row('Rushing', S.home.rush, S.away.rush)}${row('Turnovers', S.home.to, S.away.to)}${row('Sacks', S.home.sacks, S.away.sacks)}</table>
  <div class="news" style="max-height:160px;overflow:auto">${m.log.filter(l => /TOUCHDOWN|FG|SAFETY|intercept|Fumble|Injury/i.test(l)).slice(-10).map(l => `<div>${esc(l)}</div>`).join('')}</div>
  <div class="row" style="margin-top:10px"><button class="pri" id="pgDone">Continue</button></div>`);
  $('#modal').onclick = e => { if (e.target.id === 'pgDone') { $('#modal').onclick = null; endMatch(m); } };
}
function endMatch(m) {
  cancelAnimationFrame(raf); raf = 0; $('#gameWrap').hidden = true; $('#screen').hidden = false; closeModal();
  const g = m.gm; g.hs = m.score.home; g.as = m.score.away; g.done = true;
  M = null; finishUserGame(g, m);
}
function finishUserGame(g, m) {
  const L = LG, home = g.h === L.user, me = home ? g.hs : g.as, them = home ? g.as : g.hs, opp = L.teams[home ? g.a : g.h];
  news(L, `${me > them ? 'Win' : me < them ? 'Loss' : 'Tie'} ${me}-${them} ${home ? 'vs' : '@'} ${opp.abbr}.`);
  if (L.phase === 'regular') { recordGame(L, g, g.hs, g.as, false); simWeek(L, false); completeWeek(L); toast(`Final: ${me}-${them}. ${me > them ? 'Great win, coach!' : me < them ? 'Tough loss.' : 'A tie.'}`); }
  else if (L.phase === 'playoffs') {
    toast(`Playoffs: ${me > them ? 'you advance!' : 'your season ends.'}`); finishPoRound(L);
  }
  UI.screen = 'hub'; render(); window.scrollTo(0, 0);
}

/* ---------- boot ---------- */
(function boot() {
  LG = loadLeague() || newLeague();
  if (!LG.draft && LG.phase === 'draft') startDraft(LG);
  UI.screen = 'title'; render();
})();
