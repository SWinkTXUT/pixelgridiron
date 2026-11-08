'use strict';
/* ===== Real-time football match engine + renderer ===== */
const FW = 120, FH = 28, PX = 8, CW = 320, CH = 180, FY0 = 40, FY1 = 156, QLEN = 300, CRATE = 4;
const dirOf = s => (s === 'home' ? 1 : -1);
const oppS = s => (s === 'home' ? 'away' : 'home');
const goalX = s => (s === 'home' ? 110 : 10);
const ownGoalX = s => (s === 'home' ? 10 : 110);
const xFromOwn = (s, y) => (s === 'home' ? 10 + y : 110 - y);
const dist2 = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);

const ROUTES = {
  pass_short: { WR1: [[3, 0], [7, 5]], WR2: [[3, 0], [7, -5]], WR3: [[5, 0], [6, 3]], TE: [[4, -1], [5, -5]], RB: [[1, 4], [3, 8]] },
  pass_mid: { WR1: [[10, 0], [13, -5]], WR2: [[8, 0], [12, 5]], WR3: [[11, 2], [14, 6]], TE: [[6, 0], [9, -3]], RB: [[0, 5], [5, 10]] },
  pass_deep: { WR1: [[32, 1]], WR2: [[11, 0], [30, -7]], WR3: [[16, 2], [34, 7]], TE: [[8, 0], [13, -2]], RB: [[0, 5], [3, 9]] },
};
const CALL_NAMES = { run_in: 'Run Inside', run_out: 'Run Outside', pass_short: 'Short Pass', pass_mid: 'Medium Pass', pass_deep: 'Deep Pass', punt: 'Punt', fg: 'Field Goal', kneel: 'Kneel' };

class Match {
  constructor(home, away, opts) {
    opts = opts || {};
    this.team = { home, away };
    this.userSide = opts.userSide || null;
    this.playoff = !!opts.playoff;
    this.score = { home: 0, away: 0 };
    this.q = 1; this.clock = QLEN;
    this.stat = { home: { yds: 0, pass: 0, rush: 0, to: 0, sacks: 0, plays: 0 }, away: { yds: 0, pass: 0, rush: 0, to: 0, sacks: 0, plays: 0 } };
    this.cheer = { home: 0, away: 0 };
    this.hype = { home: 0, away: 0 };
    for (const s of ['home', 'away']) { const mm = this.team[s].mascot || {}; this.hype[s] = mm.cheer === 'dance' ? 25 : 0; }
    this.cols = { home: teamColors(home, false), away: teamColors(away, false) };
    if (colorDist(home.c1, away.c1) < 90) this.cols.away = teamColors(away, true);
    if (colorDist(this.cols.home.jersey, this.cols.away.jersey) < 70) this.cols.away = teamColors(away, colorDist(home.c1, away.c2) > colorDist(home.c1, away.c1));
    this.banner = null; this.log = []; this.pl = null; this.over = false; this.onEnd = null;
    this.cam = 0; this.time = 0; this.dwell = 0; this.pend = null; this.suddenOver = false;
    this.input = { dx: 0, dy: 0, act: false, throwIdx: -1 };
    this.fgm = null; this.kick = null; this.notice = null; this.popups = [];
    this.recv0 = Math.random() < 0.5 ? 'home' : 'away';
    this.crowd = []; for (let i = 0; i < 340; i++) this.crowd.push({ x: Math.random() * 760, y: 19 + Math.floor(Math.random() * 20), c: Math.random() < 0.45 ? home.c1 : Math.random() < 0.5 ? away.c1 : ['#c9c9c9', '#8a8a8a', '#d8c9a0', '#555'][ri(0, 3)] });
    for (const t of [home, away]) for (const p of t.roster) p.fat = 0;
    this.poss = this.recv0; this.ballX = 40; this.ballY = 14; this.down = 1; this.toGo = 10;
    this.doKickoff(oppS(this.recv0), 'KICKOFF');
  }

  /* ---------- helpers ---------- */
  ydsOwn(s, x) { x = x === undefined ? this.ballX : x; return s === 'home' ? x - 10 : 110 - x; }
  ytg() { return Math.round((goalX(this.poss) - this.ballX) * dirOf(this.poss)); }
  spotText() { const y = Math.round(this.ydsOwn(this.poss)); return y < 50 ? 'OWN ' + y : y === 50 ? '50' : 'OPP ' + (100 - y); }
  downText() { const ytg = this.ytg(); return ord(this.down) + ' & ' + (this.toGo >= ytg ? 'GOAL' : this.toGo); }
  clockText() { const c = Math.ceil(this.clock); return Math.floor(c / 60) + ':' + String(c % 60).padStart(2, '0'); }
  qText() { return this.q <= 4 ? 'Q' + this.q : 'OT'; }
  say(t, big) { this.log.push(`${this.qText()} ${this.clockText()} ${t}`); if (this.log.length > 60) this.log.shift(); }
  setBanner(t, sec, col) { this.banner = { t, time: sec || 1.6, col: col || '#fff' }; }
  hypeBonus(side) { const m = this.team[side].mascot || {}; return this.hype[side] / 100 * 4 + (side === 'home' ? 1 : 0) + (m.cheer === 'wave' ? 1 : 0); }
  addHype(side, v) { const m = this.team[side].mascot || {}; if (v > 0 && m.cheer === 'jump') v *= 1.5; this.hype[side] = clamp(this.hype[side] + v, 0, 100); }
  effR(p, side) { const rp = p.real || p; return p.ovr - (rp.fat || 0) * 0.14 + this.hypeBonus(side); }
  effSpd(p) { const rp = p.real || p; return 2.9 + clamp(rp.spd - (rp.fat || 0) * 0.08, 30, 99) / 100 * 3.0; }
  addScore(side, pts) { this.score[side] += pts; if (this.q >= 5) this.suddenOver = true; }

  /* ---------- drive / kickoff ---------- */
  giveBall(side, x, y) {
    this.poss = side; this.ballX = clamp(x, 11, 109); this.ballY = y === undefined ? 14 : y; this.down = 1; this.setFirst();
  }
  setFirst() { const ytg = (goalX(this.poss) - this.ballX) * dirOf(this.poss); this.toGo = Math.max(1, Math.min(10, Math.round(ytg))); }
  doKickoff(kickSide, label) {
    const recv = oppS(kickSide);
    const r = Math.random(); let spot;
    if (r < 0.6) spot = 30; else spot = ri(18, 38);
    this.giveBall(recv, xFromOwn(recv, spot), 14);
    this.setBanner(label || 'KICKOFF', 1.2);
    this.toPresnap();
  }
  toPresnap() {
    this.pl = null; this.phase = 'presnap'; this.pend = null;
    if (this.userSide) { this.snap('pass_short', 'base', true); this.pl.preview = true; this.phase = 'presnap'; }
    this.cheer.home = Math.max(0, this.cheer.home); // keep timers
    if (!this.userSide) this.autoCall();
  }
  callSide() { if (this.phase !== 'presnap' || !this.userSide) return null; return this.poss === this.userSide ? 'off' : 'def'; }
  autoCall() { this.call(this.aiOffCall(), this.aiDefCall()); }
  aiPlay() {
    const tg = this.toGo, r = Math.random();
    if (tg >= 8) return r < 0.2 ? 'run_in' : r < 0.55 ? 'pass_short' : r < 0.8 ? 'pass_mid' : 'pass_deep';
    if (tg <= 2) return r < 0.6 ? 'run_in' : r < 0.75 ? 'run_out' : r < 0.9 ? 'pass_short' : 'pass_mid';
    return r < 0.28 ? 'run_in' : r < 0.42 ? 'run_out' : r < 0.68 ? 'pass_short' : r < 0.88 ? 'pass_mid' : 'pass_deep';
  }
  aiOffCall() {
    const o = this.poss, yo = this.ydsOwn(o), ytg = 100 - yo;
    const trailing = this.score[o] < this.score[oppS(o)], late = this.q >= 4 && this.clock < 150;
    if (this.down === 4) {
      if (late && trailing && ytg > 35) return this.aiPlay();
      if (ytg + 17 <= 54 && !(this.toGo <= 1 && Math.random() < 0.4)) return 'fg';
      if (ytg <= 3 || (this.toGo <= 1 && yo > 45 && Math.random() < 0.5)) return this.aiPlay();
      return 'punt';
    }
    if (this.q >= 4 && this.clock < 55 && this.score[o] > this.score[oppS(o)]) return 'kneel';
    return this.aiPlay();
  }
  aiDefCall() {
    const r = Math.random();
    if (this.toGo <= 3 && r < 0.4) return 'run_stop';
    return r < 0.4 ? 'base' : r < 0.6 ? 'blitz' : r < 0.85 ? 'zone' : 'run_stop';
  }
  call(off, def) {
    if (this.phase !== 'presnap') return;
    this.stat[this.poss].plays++;
    if (off === 'punt') return this.doPunt();
    if (off === 'fg') return this.doFG();
    if (off === 'kneel') return this.doKneel();
    this.snap(off, def || this.aiDefCall());
  }
  doKneel() {
    this.clock = Math.max(0, this.clock - 40); this.down++; this.ballX -= dirOf(this.poss) * 1; this.say('QB kneel');
    if (this.down > 4) { this.giveBall(oppS(this.poss), this.ballX); }
    this.phase = 'dwell'; this.dwell = 0.5; this.setBanner('KNEEL DOWN', 0.9);
  }

  /* ---------- special teams ---------- */
  doPunt() {
    const o = this.poss, d = dirOf(o), P = getStarters(this.team[o]).P[0];
    const dist = Math.round(clamp(36 + (this.effR(P, o) - 60) / 2.2 + rnd(-7, 7), 25, 66));
    let land = this.ballX + d * dist, spot, tb = false;
    if ((land - goalX(o)) * d >= 0) { tb = true; spot = xFromOwn(oppS(o), 20); land = goalX(o); }
    else { const ret = Math.random() < 0.18 ? 0 : ri(1, 13); spot = land - d * ret; }
    this.kick = { t: 0, T: 1.0 + dist / 55, fx: this.ballX - d * 6, fy: 14, tx: land, ty: 14, h: 30 + dist * 0.4, done: () => {
      this.setBanner(tb ? 'TOUCHBACK' : `PUNT ${dist} YDS`, 1.2); this.say(`${this.team[o].abbr} punt ${dist} yds`);
      this.addHype(oppS(o), 4); this.giveBall(oppS(o), spot, 14); this.clock = Math.max(0, this.clock - 8); this.afterPlay(false, 0);
    } };
    this.phase = 'kick';
  }
  doFG() {
    const o = this.poss, d = dirOf(o), dist = this.ytg() + 17;
    if (this.userSide === o) { this.phase = 'fgmeter'; this.fgm = { t: 0, dist }; this.setBanner(`${dist} YARD FIELD GOAL`, 1); }
    else this.resolveFG(rnd(-0.5, 0.5) * 0.6);
  }
  resolveFG(m) {
    const o = this.poss, d = dirOf(o), K = getStarters(this.team[o]).K[0], dist = this.ytg() + 17, k = this.effR(K, o);
    let p = clamp(0.985 - Math.max(0, dist - 30) * 0.011 - (82 - k) * 0.004, 0.03, 0.99);
    if (dist > 58) p -= (dist - 58) * 0.07;
    p *= 1 - 0.75 * Math.abs(m); if (Math.abs(m) < 0.12) p = Math.min(0.99, p + 0.08);
    const good = Math.random() < clamp(p, 0, 0.99);
    const tx = goalX(o) + d * 4;
    this.kick = { t: 0, T: 1.2, fx: this.ballX - d * 7, fy: 14, tx, ty: 14 + (good ? 0 : (Math.random() < 0.5 ? -4 : 4)), h: 40, done: () => {
      if (good) {
        this.addScore(o, 3); this.setBanner(`FIELD GOAL! ${dist} YDS`, 1.6, '#7CFC00'); this.say(`${this.team[o].abbr} FG good from ${dist}`);
        this.addHype(o, 12); this.cheer[o] = 3; this.pend = { k: 'kickoff', side: o };
      } else {
        this.setBanner('NO GOOD!', 1.4, '#ff6b6b'); this.say(`${this.team[o].abbr} FG missed from ${dist}`);
        this.addHype(oppS(o), 8);
        const spot = this.ydsOwn(oppS(o), this.ballX) < 20 ? xFromOwn(oppS(o), 20) : this.ballX;
        this.giveBall(oppS(o), spot, 14);
      }
      this.clock = Math.max(0, this.clock - 6); this.afterPlay(false, 0, true);
    } };
    this.phase = 'kick'; this.fgm = null;
  }

  /* ---------- snap / setup play ---------- */
  snap(call, dcall, preview) {
    const off = this.poss, df = oppS(off), d = dirOf(off), x0 = this.ballX, yc = clamp(this.ballY, 10, 18);
    const so = getStarters(this.team[off]), sd = getStarters(this.team[df]);
    // fatigue
    const onField = new Set(); [so, sd].forEach(s => POS.forEach(pos => s[pos].forEach(p => onField.add((p.real || p).id))));
    if (!preview) for (const t of [this.team.home, this.team.away]) for (const p of t.roster) p.fat = onField.has(p.id) ? Math.min(100, (p.fat || 0) + FAT_RATE[p.pos]) : Math.max(0, (p.fat || 0) - 2.5);
    const isRun = call.startsWith('run');
    const pl = { off, df, d, x0, yc, call, dcall, isRun, t: 0, E: [], pairs: [], holder: null, carrier: null, ball: null, ended: false, handed: false, lock: 0, lockE: null,
      pressure: false, think: rnd(1.5, 2.5), actCd: 0, jumpT: -9, ctrl: null, passed: false, dropX: x0 - d * 4.5, maxHold: rnd(3.0, 4.2), scr: 0 };
    this.pl = pl;
    const mk = (p, side, role, x, y) => {
      const e = { p, rp: p.real || p, side, role, x, y: clamp(y, 1.2, FH - 1.2), vx: 0, vy: 0, wx: 0, wy: 0, r: this.effR(p, side), spd: this.effSpd(p), stun: 0, free: false, eng: null, tcd: 0, ph: Math.random() * 6,
        jk: 0, jkcd: 0, dive: 0, face: side === off ? d : -d, route: null, ri: 0, catching: false, rush: false, man: null, zone: null, lane: null, laneT: 0, down: false, blockRb: false };
      pl.E.push(e); return e;
    };
    const o = {};
    o.qb = mk(so.QB[0], off, 'QB', x0 - d * 4.5, yc);
    o.rb = mk(so.RB[0], off, 'RB', x0 - d * 4.5, yc + 2.4);
    o.wr1 = mk(so.WR[0], off, 'WR1', x0 - d * 0.5, 2.8);
    o.wr2 = mk(so.WR[1], off, 'WR2', x0 - d * 0.5, FH - 2.8);
    o.wr3 = mk(so.WR[2], off, 'WR3', x0 - d * 0.5, yc - 8);
    o.te = mk(so.TE[0], off, 'TE', x0 - d * 0.5, yc + 5.2);
    o.lt = mk(so.OT[0], off, 'LT', x0 - d * 0.6, yc - 3.4);
    o.lg = mk(so.OG[0], off, 'LG', x0 - d * 0.6, yc - 1.7);
    o.c = mk(so.C[0], off, 'C', x0 - d * 0.4, yc);
    o.rg = mk(so.OG[1], off, 'RG', x0 - d * 0.6, yc + 1.7);
    o.rt = mk(so.OT[1], off, 'RT', x0 - d * 0.6, yc + 3.4);
    const q = {};
    q.de1 = mk(sd.DE[0], df, 'DE', x0 + d * 1.2, yc - 4.2);
    q.dt1 = mk(sd.DT[0], df, 'DT', x0 + d * 1.2, yc - 1.4);
    q.dt2 = mk(sd.DT[1], df, 'DT', x0 + d * 1.2, yc + 1.4);
    q.de2 = mk(sd.DE[1], df, 'DE', x0 + d * 1.2, yc + 4.2);
    q.lb1 = mk(sd.LB[0], df, 'OLB', x0 + d * 4.2, yc - 6);
    q.lb2 = mk(sd.LB[1], df, 'MLB', x0 + d * 4.2, yc);
    q.lb3 = mk(sd.LB[2], df, 'OLB', x0 + d * 4.2, yc + 6);
    q.cb1 = mk(sd.CB[0], df, 'CB', x0 + d * 6, o.wr1.y);
    q.cb2 = mk(sd.CB[1], df, 'CB', x0 + d * 6, o.wr2.y);
    q.s1 = mk(sd.S[0], df, 'SS', x0 + d * 8, yc - 4);
    q.s2 = mk(sd.S[1], df, 'FS', x0 + d * 13, yc + 3);
    pl.o = o; pl.q = q; pl.qb = o.qb; pl.rb = o.rb;
    pl.recs = [o.wr1, o.wr2, o.wr3, o.te, o.rb];
    pl.offE = pl.E.filter(e => e.side === off); pl.defE = pl.E.filter(e => e.side === df);
    pl.holder = o.qb;
    // routes
    if (!isRun) {
      const spec = ROUTES[call];
      const setR = (e, sp) => { const sg = e.y < 14 ? 1 : -1; e.route = sp.map(([f, l]) => [e.x + d * f, clamp(e.y + l * sg, 2, FH - 2)]); };
      setR(o.wr1, spec.WR1); setR(o.wr2, spec.WR2); setR(o.wr3, spec.WR3); setR(o.te, spec.TE); setR(o.rb, spec.RB);
      pl.dropX = x0 - d * (call === 'pass_deep' ? 6.5 : 5.2);
    }
    // defense scheme
    const rushers = [q.de1, q.dt1, q.dt2, q.de2];
    let blitz = [];
    if (dcall === 'blitz') blitz = [q.lb1, q.lb3];
    rushers.forEach(e => e.rush = true); blitz.forEach(e => e.rush = true);
    const Z = (e, depth, y) => { e.zone = { x: x0 + d * depth, y }; };
    const rs = dcall === 'run_stop';
    if (dcall === 'zone') {
      Z(q.cb1, 8, 4); Z(q.cb2, 8, FH - 4); Z(q.lb1, 6, yc - 6); Z(q.lb2, 6, yc); Z(q.lb3, 6, yc + 6);  Z(q.s1, 11, yc - 5); Z(q.s2, 17, yc + 5);
    } else {
      q.cb1.man = o.wr1; q.cb2.man = o.wr2; q.s1.man = o.wr3; Z(q.s2, rs ? 12 : 17, yc);
      if (dcall === 'blitz') { q.lb2.man = o.te; } else { Z(q.lb1, rs ? 4 : 5.5, yc - 6); Z(q.lb3, rs ? 4 : 5.5, yc + 6); if (rs) Z(q.lb2, 4, yc); else q.lb2.man = o.rb; }
      if (rs) { Z(q.s1, 5, yc - 4); q.s1.man = null; q.cb1.cush = 7; q.cb2.cush = 7; }
    }
    // blocking pairs
    const addPair = (b, r, shed, bo) => { pl.pairs.push({ b, r, t: 0, shed, on: false, done: false, bo, push: 0 }); };
    const passShed = (b, r) => clamp(1.8 + (b.r - r.r) / 16 + rnd(-0.6, 0.9), 0.5, 7);
    const runShed = (b, r) => clamp(1.7 + (b.r - r.r) / 14 + rnd(-0.5, 0.8), 0.4, 6);
    if (!isRun) {
      [[o.lt, q.de1], [o.lg, q.dt1], [o.rg, q.dt2], [o.rt, q.de2]].forEach(([b, r]) => addPair(b, r, passShed(b, r), -d));
      if (blitz.length) { addPair(o.c, blitz[0], passShed(o.c, blitz[0]) , -d); if (blitz[1]) { o.rb.blockRb = true; addPair(o.rb, blitz[1], passShed(o.rb, blitz[1]) + 0.3, -d); } }
    } else {
      const blockers = [o.lt, o.lg, o.c, o.rg, o.rt, o.te].sort((a, b) => a.y - b.y);
      const targets = [q.de1, q.dt1, q.dt2, q.de2, q.lb1, q.lb2, q.lb3]; const taken = new Set();
      for (const b of blockers) {
        let best = null, bd = 1e9;
        for (const r of targets) { if (taken.has(r)) continue; const dd = Math.abs(r.y - b.y) + Math.abs(r.x - b.x) * 0.35; if (dd < bd) { bd = dd; best = r; } }
        if (best) { taken.add(best); addPair(b, best, runShed(b, best), -d); }
      }
      addPair(o.wr1, q.cb1, clamp(2.4 + (o.wr1.r - q.cb1.r) / 14, 0.8, 6), -d); addPair(o.wr2, q.cb2, clamp(2.4 + (o.wr2.r - q.cb2.r) / 14, 0.8, 6), -d);
      pl.aimY = call === 'run_in' ? yc : (Math.random() < 0.5 ? 6 : 22);
    }
    if (preview) { this.phase = 'presnap'; return; }
    this.phase = 'play';
    this.say(`${this.team[off].abbr} ${this.downText()} at ${this.spotText()} — ${CALL_NAMES[call]}`);
  }

  /* ---------- input ---------- */
  tapAt(cx, cy) {
    if (this.phase === 'fgmeter') { this.input.act = true; return; }
    const pl = this.pl; if (this.phase !== 'play' || !pl) return;
    const us = this.userSide; if (!us) return;
    let best = null, bd = 30;
    if (us === pl.off && pl.holder === pl.qb && !pl.ball) {
      pl.recs.forEach((e, i) => { if (e.blockRb) return; const sx = e.x * PX - this.cam, sy = this.y2s(e.y) - 6, dd = Math.hypot(sx - cx, sy - cy); if (dd < bd) { bd = dd; best = i; } });
      if (best !== null) this.input.throwIdx = best;
    } else {
      let be = null;
      for (const e of pl.E) if (e.side === us) { const sx = e.x * PX - this.cam, sy = this.y2s(e.y) - 6, dd = Math.hypot(sx - cx, sy - cy); if (dd < bd) { bd = dd; be = e; } }
      if (be) { pl.lock = 3; pl.lockE = be; }
    }
  }
  y2s(y) { return FY0 + y * (FY1 - FY0) / FH; }

  /* ---------- update ---------- */
  update(dt) {
    if (this.over) return;
    this.time += dt;
    for (const s of ['home', 'away']) { if (this.cheer[s] > 0) this.cheer[s] -= dt; }
    if (this.banner) { this.banner.time -= dt; if (this.banner.time <= 0) this.banner = null; }
    this.popups = this.popups.filter(p => (p.t -= dt) > 0);
    if (this.notice) { this.notice.t -= dt; if (this.notice.t <= 0) this.notice = null; }
    if (this.phase === 'play') this.updatePlay(dt);
    else if (this.phase === 'dwell') { this.dwell -= dt; if (this.pl) this.moveAll(dt, true); if (this.dwell <= 0) this.afterDwell(); }
    else if (this.phase === 'kick') {
      const k = this.kick; k.t += dt; if (k.t >= k.T) { this.kick = null; k.done(); }
    } else if (this.phase === 'fgmeter') {
      const f = this.fgm; f.t += dt; f.m = Math.sin(f.t * 3.6);
      if (this.input.act) { this.input.act = false; this.resolveFG(f.m); }
      else if (f.t > 6) this.resolveFG(f.m);
    }
    // camera
    let tx = this.ballX;
    const pl = this.pl;
    if (this.kick) tx = this.kick.fx + (this.kick.tx - this.kick.fx) * clamp(this.kick.t / this.kick.T, 0, 1);
    else if (pl && (this.phase === 'play' || this.phase === 'dwell')) {
      if (pl.ball) tx = pl.ball.x; else if (pl.holder) tx = pl.holder.x; else tx = pl.x0;
      tx += pl.d * 3;
    }
    const target = clamp(tx * PX - CW / 2, 0, FW * PX - CW);
    this.cam += (target - this.cam) * Math.min(1, dt * 6);
  }
  afterDwell() {
    if (this.suddenOver) return this.finishGame();
    if (this.clock <= 0) return this.endQuarter();
    if (this.pend && this.pend.k === 'kickoff') return this.doKickoff(this.pend.side, 'KICKOFF');
    this.toPresnap();
  }
  endQuarter() {
    if (this.q === 1 || this.q === 3) { this.q++; this.clock = QLEN; this.setBanner('QUARTER ' + this.q, 1.5); this.say('— End of quarter —'); this.afterDwellResume(); }
    else if (this.q === 2) { this.q = 3; this.clock = QLEN; this.setBanner('HALFTIME', 2.2); this.say('— Halftime —'); this.pend = { k: 'kickoff', side: this.recv0 }; this.afterDwellResume(); }
    else {
      if (this.score.home === this.score.away && (this.q === 4 || this.playoff)) {
        this.q++; this.clock = QLEN; this.setBanner('OVERTIME!', 2); this.say('— Overtime: sudden death —');
        this.pend = { k: 'kickoff', side: Math.random() < 0.5 ? 'home' : 'away' }; this.afterDwellResume();
      } else this.finishGame();
    }
  }
  afterDwellResume() { this.phase = 'dwell'; this.dwell = this.pend ? 1.6 : 1.0; this.pl = null; }
  finishGame() {
    this.over = true; this.phase = 'final'; this.pl = null;
    this.say(`FINAL: ${this.team.home.abbr} ${this.score.home} - ${this.team.away.abbr} ${this.score.away}`);
    if (this.onEnd) this.onEnd(this);
  }

  /* ---------- play simulation ---------- */
  updatePlay(dt) {
    const pl = this.pl; pl.t += dt;
    if (this.clock > 0) this.clock = Math.max(0, this.clock - dt * CRATE);
    pl.lock -= dt; pl.actCd -= dt;
    for (const e of pl.E) { e.wx = 0; e.wy = 0; e.tcd -= dt; e.stun -= dt; e.jk -= dt; e.jkcd -= dt; e.dive -= dt; }
    pl.ctrl = this.pickCtrl();
    if (pl.t >= 0.2) {
      this.aiOffense(dt); this.aiDefense(dt); this.userControl(dt); this.blocks(dt);
    }
    this.moveAll(dt);
    if (pl.ended) return;
    this.ballLogic(dt);
    if (pl.ended) return;
    this.checkTackles();
    if (pl.t > 15 && !pl.ended && pl.holder) this.endTackle(pl.holder, 'tackle');
    this.input.act = false; this.input.throwIdx = -1;
  }
  moveAll(dt, freeze) {
    const pl = this.pl; if (!pl) return;
    for (const e of pl.E) {
      if (freeze || pl.t < 0.2 || e.down) { e.vx *= 0.8; e.vy *= 0.8; if (freeze) { e.x += e.vx * dt; e.y += e.vy * dt; } continue; }
      let wx = e.wx, wy = e.wy;
      if (e.stun > 0) { wx *= 0.15; wy *= 0.15; }
      const ax = wx - e.vx, ay = wy - e.vy, am = Math.hypot(ax, ay), mx = 22 * dt;
      if (am > mx) { e.vx += ax / am * mx; e.vy += ay / am * mx; } else { e.vx = wx; e.vy = wy; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      if (e.y < -1) e.y = -1; if (e.y > FH + 1) e.y = FH + 1;
      if (Math.abs(e.vx) > 0.3) e.face = e.vx > 0 ? 1 : -1;
    }
    // keep blockers attached
    for (const pr of pl.pairs) if (pr.on && !pr.done) {
      const { b, r } = pr; const ux = pr.bo;
      b.x += (r.x + ux * 0.95 - b.x) * Math.min(1, dt * 14); b.y += (r.y - b.y) * Math.min(1, dt * 14);
    }
  }
  seek(e, tx, ty, mul) {
    const dx = tx - e.x, dy = ty - e.y, dd = Math.hypot(dx, dy);
    if (dd < 0.05) return;
    const sp = e.spd * (mul === undefined ? 1 : mul) * Math.min(1, dd / 0.7);
    e.wx = dx / dd * sp; e.wy = dy / dd * sp;
  }
  pickCtrl() {
    const pl = this.pl, us = this.userSide; if (!us) return null;
    if (pl.holder && pl.holder.side === us) return pl.holder;
    if (us === pl.off && !pl.holder) return null; // ball in the air on offense
    if (us === pl.off && pl.holder && pl.holder.side !== us) { /* user lost the ball: control a defender below */ }
    if (pl.lock > 0 && pl.lockE && pl.lockE.side === us) return pl.lockE;
    const bp = pl.holder ? pl.holder : (pl.ball ? { x: pl.ball.tx, y: pl.ball.ty } : { x: pl.x0, y: pl.yc });
    let best = null, bd = 1e9;
    for (const e of pl.E) {
      if (e.side !== us) continue;
      if (e.role.startsWith('LT') || e.role.startsWith('LG') || e.role === 'C' || e.role.startsWith('RG') || e.role.startsWith('RT')) continue;
      if (us === pl.off && (e.role === 'QB')) continue;
      const dd = Math.hypot(e.x - bp.x, e.y - bp.y) + (e.eng ? 8 : 0);
      if (dd < bd) { bd = dd; best = e; }
    }
    return best;
  }
  userControl(dt) {
    const pl = this.pl, c = pl.ctrl, inp = this.input; if (!c) return;
    const mag = Math.hypot(inp.dx, inp.dy);
    if (c === pl.qb && pl.isRun && !pl.handed) return;
    const beyond = c === pl.qb && (c.x - pl.x0) * pl.d > 0.3;
    const isQB = c === pl.qb && pl.holder === pl.qb && !pl.isRun && !beyond;
    if (beyond) pl.scr = true;
    if (inp.act && pl.actCd <= 0) {
      if (isQB) { if (!pl.ball) this.throwAway(); }
      else if (pl.holder === c) { if (c.jkcd <= 0) { c.jk = 0.4; c.jkcd = 1.4; pl.actCd = 0.2; } }
      else { c.dive = 0.35; pl.jumpT = pl.t; pl.actCd = 0.6; }
    }
    if (isQB) {
      if (inp.throwIdx >= 0 && !pl.ball) { const r = pl.recs[inp.throwIdx]; if (r && !r.blockRb) this.throwBall(r); }
      if (mag > 0.1 || pl.t >= 0.8) { c.wx = inp.dx * c.spd * 0.62; c.wy = inp.dy * c.spd * 0.62; } return;
    }
    if (mag > 0.15) {
      let sp = c.spd; if (c.jk > 0) sp *= 1.15; if (c.dive > 0) sp *= 1.25;
      c.wx = inp.dx / Math.max(1, mag) * sp; c.wy = inp.dy / Math.max(1, mag) * sp;
      if (c.eng) { /* fighting a block: pushing helps */ }
    }
  }
  /* ----- offense AI ----- */
  aiOffense(dt) {
    const pl = this.pl, d = pl.d, o = pl.o, userOff = this.userSide === pl.off;
    // receivers
    for (const r of pl.recs) {
      if (r.blockRb || (pl.holder && pl.holder.side !== pl.off)) continue;
      if (pl.isRun && !(pl.holder === r)) { continue; }
      if (pl.holder === r) continue;
      if (r.catching) { if (pl.ball) this.seek(r, pl.ball.tx, pl.ball.ty, 1); continue; }
      if (pl.holder && pl.holder !== pl.qb && pl.holder.side === pl.off) continue; // carrier exists: others block below
      if (r.route && r.ri < r.route.length) {
        const wp = r.route[r.ri]; this.seek(r, wp[0], wp[1], 0.97);
        if (Math.hypot(wp[0] - r.x, wp[1] - r.y) < 0.9) r.ri++;
      } else this.seek(r, r.x + d * 3, r.y + (r.y < 14 ? 0.6 : -0.6), 0.4);
    }
    // QB / handoff
    const qb = pl.qb;
    if (pl.holder === qb && !pl.ball) {
      if (pl.isRun) {
        const mesh = { x: pl.x0 - d * 3.0, y: pl.yc + 1.2 };
        if (!pl.handed) { this.seek(pl.rb, mesh.x, mesh.y, 1); this.seek(qb, pl.x0 - d * 3.6, pl.yc + 0.5, 0.4); }
        if (pl.t > 0.55 && !pl.handed) { pl.handed = true; pl.holder = pl.rb; pl.rb.x = mesh.x; this.say(`${pl.rb.p.name} takes the handoff`); }
      } else if (!userOff) this.aiQB(dt);
      else if (pl.t < 0.8) this.seek(qb, pl.dropX, pl.yc, 0.75);
    }
    // carriers (AI-steered)
    const h = pl.holder;
    if (h && h.side === pl.off && h !== qb || (h === qb && pl.isRun && pl.handed)) {
      if (h !== pl.ctrl || Math.hypot(this.input.dx, this.input.dy) <= 0.15) this.steer(h);
    } else if (h === qb && pl.scr) { this.steer(h); }
    // blockers when carrier exists
    if (h && h.side === pl.off && (h !== qb || pl.handed)) {
      for (const b of pl.offE) {
        if (b === h || b.eng || b.stun > 0 || b.role === 'QB' || b.down) continue;
        if (pl.pairs.some(pr => pr.b === b && !pr.done)) continue;
        let tgt = null, td = 1e9;
        for (const e of pl.defE) { if (e.eng || e.stun > 0) continue; const dd = Math.hypot(e.x - b.x, e.y - b.y) + Math.abs(e.x - h.x) * 0.5; if (dd < td) { td = dd; tgt = e; } }
        if (tgt) { this.seek(b, tgt.x, tgt.y, 0.95); if (Math.hypot(tgt.x - b.x, tgt.y - b.y) < 1.1) this.tryBlock(b, tgt, h); }
      }
    }
    // turnover: defense now carries -> offense chases (handled in aiDefense with sides swapped)
  }
  tryBlock(b, r, carrier) {
    const pl = this.pl; if (pl.pairs.some(pr => (pr.b === b || pr.r === r) && !pr.done)) return;
    const shed = clamp(1.1 + (b.r - r.r) / 20 + rnd(-0.3, 0.5), 0.4, 3);
    pl.pairs.push({ b, r, t: 0, shed, on: true, done: false, bo: Math.sign(carrier.x - r.x) || 1, push: 0 }); r.eng = b; b.eng = r;
  }
  aiQB(dt) {
    const pl = this.pl, qb = pl.qb, d = pl.d;
    if (pl.t < 0.9) this.seek(qb, pl.dropX, pl.yc, 0.75);
    let freeD = 99;
    for (const e of pl.defE) if (e.rush && e.free || (e.rush && !e.eng && pl.t > 0.6)) freeD = Math.min(freeD, dist2(e, qb));
    pl.pressure = freeD < 3.5;
    if (pl.t < 1.2) return;
    const thr = 2.7 - (qb.r - 70) * 0.02;
    const urgent = pl.t > pl.think + 0.4 || freeD < 2.3 || pl.t > pl.maxHold;
    let best = null, bs = -1e9, bsep = 0;
    for (const r of pl.recs) {
      if (r.blockRb || (r.ri < 1 && pl.t < 2.4)) continue;
      if (r.role === 'RB' && !urgent) continue;
      let sep = 99; for (const e of pl.defE) if (!e.down) sep = Math.min(sep, Math.hypot(e.x - (r.x + r.vx * 0.3), e.y - (r.y + r.vy * 0.3)));
      const depth = (r.x - pl.x0) * d;
      const sc = Math.min(sep, 5) + depth * 0.12 + (r.role === 'RB' ? -2.5 : 0);
      if (sc > bs) { bs = sc; best = r; bsep = sep; }
    }
    if (best && (bsep >= thr || (urgent && bsep > 1.7))) { this.throwBall(best); return; }
    if (urgent) {
      if (freeD < 2.3 && Math.random() < 0.5 && qb.spd > 4.6) { pl.scr = true; this.steer(qb); }
      else if (pl.t > pl.maxHold + 0.5 || freeD < 1.6) this.throwAway();
    }
  }
  steer(c) {
    const pl = this.pl, cd = c.side === pl.off ? pl.d : -pl.d; // carrier attack dir
    const opps = c.side === pl.off ? pl.defE : pl.offE;
    c.laneT -= 1 / 60;
    if (c.laneT <= 0 || c.lane === null) {
      c.laneT = 0.18; let bestY = c.y, bsc = -1e9;
      const early = pl.isRun && !pl.handed || (pl.isRun && pl.t < 1.3 && pl.aimY !== undefined && c.side === pl.off && c === pl.rb);
      const lanes = [-9, -6, -4, -2, 0, 2, 4, 6, 9];
      for (const dy of lanes) {
        const ty = clamp(c.y + dy, 2, FH - 2), tx = c.x + cd * 7; let md = 8;
        for (const e of opps) {
          if (e.down || (e.stun > 0.3)) continue;
          const ex = (e.x - c.x) * cd; if (ex < -1.5 || ex > 12) continue;
          const sx = tx - c.x, sy = ty - c.y, L2 = sx * sx + sy * sy, tt = clamp(((e.x - c.x) * sx + (e.y - c.y) * sy) / L2, 0, 1);
          const dd = Math.hypot(e.x - (c.x + sx * tt), e.y - (c.y + sy * tt)) - (e.eng ? 1.5 : 0) * 0;
          if (e.eng) { if (dd < md) md = dd + 1.8; } else if (dd < md) md = dd;
        }
        let sc = md * 1.0 - Math.abs(dy) * 0.06; if (ty < 4 || ty > FH - 4) sc -= 2.5;
        if (c === pl.rb && pl.t < 1.2 && pl.aimY !== undefined) sc -= Math.abs(ty - pl.aimY) * 0.15;
        if (sc > bsc) { bsc = sc; bestY = ty; }
      }
      c.lane = bestY;
    }
    this.seek(c, c.x + cd * 8, c.lane, 1);
    // AI juke
    if (c !== pl.ctrl && c.jkcd <= 0) {
      for (const e of opps) if (!e.down && e.stun <= 0 && Math.hypot(e.x - c.x, e.y - c.y) < 2.1 && ((e.x - c.x) * cd > -0.5)) { c.jk = 0.4; c.jkcd = 1.6; break; }
    }
    if (c.jk > 0) { c.wx *= 1.12; c.wy *= 1.12; }
  }
  /* ----- defense AI ----- */
  aiDefense(dt) {
    const pl = this.pl, d = pl.d, h = pl.holder;
    // Which side is chasing?
    const chasers = h && h.side === pl.df ? pl.offE : pl.defE; // after turnover offense chases
    const blockersSide = h && h.side === pl.df ? pl.defE : pl.offE;
    if (h && h.side === pl.df) {
      // interception / fumble return: defense carries
      if (h !== pl.ctrl || Math.hypot(this.input.dx, this.input.dy) <= 0.15) this.steer(h);
      for (const b of pl.defE) {
        if (b === h || b.eng || b.stun > 0) continue;
        let tgt = null, td = 1e9;
        for (const e of pl.offE) { if (e.eng || e.stun > 0 || e.down) continue; const dd = Math.hypot(e.x - b.x, e.y - b.y); if (dd < td) { td = dd; tgt = e; } }
        if (tgt) { this.seek(b, tgt.x, tgt.y, 0.95); if (td < 1.1) this.tryBlock(b, tgt, h); }
      }
    }
    for (const e of chasers) {
      if (e.eng || e.down) continue;
      if (h && h.side !== e.side && !(h === pl.qb && (!pl.isRun || !pl.handed) && (h.x - pl.x0) * pl.d < 0.5 && h.side === pl.off)) { // pursue ball carrier
        if (e === pl.ctrl && Math.hypot(this.input.dx, this.input.dy) > 0.15) continue;
        const dd = dist2(e, h), lead = Math.min(dd / Math.max(1, e.spd), 1.1) * 0.8;
        if (!(e.rush && pl.holder === pl.qb && !pl.isRun && false)) this.seek(e, h.x + h.vx * lead, h.y + h.vy * lead, 1);
        continue;
      }
      if (e.side !== pl.df) continue;
      if (e === pl.ctrl && Math.hypot(this.input.dx, this.input.dy) > 0.15) continue;
      // air phase
      if (pl.ball) {
        const b = pl.ball;
        if (!e.rush && Math.hypot(e.x - b.tx, e.y - b.ty) < 14) this.seek(e, b.tx, b.ty, 0.96);
        else if (e.rush) this.seek(e, pl.qb.x, pl.qb.y, 0.7);
        continue;
      }
      if (e.rush) {
        if (pl.isRun) { if (!pl.handed) this.seek(e, pl.qb.x, pl.qb.y, 0.6); }
        else this.seek(e, pl.qb.x, pl.qb.y, 1);
        continue;
      }
      if (pl.isRun && !pl.handed) { // read
        if (pl.t > (pl.dcall === 'run_stop' ? 0.2 : 0.45)) this.seek(e, pl.x0 - d * 2, pl.rb.y, 0.7);
        continue;
      }
      if (e.man) {
        const t = e.man, cush = e.cush || (e.role === 'CB' ? 3.2 : 2.4);
        this.seek(e, t.x + d * cush + t.vx * 0.15, t.y + t.vy * 0.15, 0.97);
      } else if (e.zone) {
        let tx = e.zone.x, ty = e.zone.y;
        // shade towards nearest receiver in zone
        let nr = null, nd = 6.5;
        for (const r of pl.recs) { const dd = Math.hypot(r.x - tx, r.y - ty); if (dd < nd && !r.blockRb) { nd = dd; nr = r; } }
        if (nr) { tx = tx * 0.4 + (nr.x + d * 1.5) * 0.6; ty = ty * 0.4 + nr.y * 0.6; }
        this.seek(e, tx, ty, 0.9);
      }
    }
  }
  /* ----- blocking pairs ----- */
  blocks(dt) {
    const pl = this.pl, ctrl = pl.ctrl;
    for (const pr of pl.pairs) {
      if (pr.done) continue;
      const { b, r } = pr;
      if (b.down || r.down) { pr.done = true; b.eng = r.eng = null; continue; }
      if (!pr.on) {
        const dd = Math.hypot(b.x - r.x, b.y - r.y);
        if (dd < 1.35) { pr.on = true; r.eng = b; b.eng = r; }
        else { this.seek(b, r.x - pl.d * 0.4, r.y, 0.95); continue; }
      }
      let rate = 1;
      if (r === ctrl) { const m = Math.hypot(this.input.dx, this.input.dy); if (m > 0.5) rate += 0.5; if (this.input.act && pl.actCd <= 0) { pr.t += 0.45; pl.actCd = 0.8; } }
      pr.t += dt * rate;
      const push = pl.isRun ? 1.0 : -0.35;
      r.wx = pl.d * push; r.wy = 0; b.wx = r.wx; b.wy = 0;
      if (!pl.isRun && pl.holder === pl.qb) { r.wx = -pl.d * 0.8; }
      if (pr.t >= pr.shed) { pr.done = true; r.eng = null; b.eng = null; r.free = true; b.stun = 0.35; }
    }
  }
  /* ----- ball: throws, catches ----- */
  throwBall(rec) {
    const pl = this.pl, qb = pl.qb, d = pl.d;
    if ((qb.x - pl.x0) * d > 0.3) { this.notice = { t: 1.2, text: 'PAST THE LINE - NO PASS' }; return; }
    let T = 0.5, px = rec.x, py = rec.y;
    for (let i = 0; i < 3; i++) { const dd = Math.hypot(px - qb.x, py - qb.y); T = clamp(dd / 25, 0.35, 2.4); px = rec.x + rec.vx * T; py = rec.y + rec.vy * T; }
    let dd = Math.hypot(px - qb.x, py - qb.y);
    const maxR = 26 + (qb.r - 60) * 0.5;
    let short = false;
    if (dd > maxR) { px = qb.x + (px - qb.x) * maxR / dd; py = qb.y + (py - qb.y) * maxR / dd; short = true; dd = maxR; T = clamp(dd / 25, 0.35, 2.4); }
    py = clamp(py + rnd(-1, 1) * (100 - qb.r) / 40, 0.5, FH - 0.5);
    for (const e of pl.defE) if (e.rush && (e.free || !e.eng) && dist2(e, qb) < 3.6) pl.pressure = true;
    pl.ball = { x: qb.x, y: qb.y, z: 0, t: 0, T, fx: qb.x, fy: qb.y, tx: px, ty: py, rec, dist: dd, short, away: false };
    pl.holder = null; pl.passed = true; rec.catching = true; qb.wx = qb.wy = 0;
    this.say(`${qb.p.name} throws to ${rec.p.name}`);
  }
  throwAway() {
    const pl = this.pl, qb = pl.qb, d = pl.d; const oy = qb.y < 14 ? -1.5 : FH + 1.5;
    pl.ball = { x: qb.x, y: qb.y, z: 0, t: 0, T: 0.8, fx: qb.x, fy: qb.y, tx: qb.x + d * 7, ty: oy, rec: null, dist: 8, away: true };
    pl.holder = null; qb.wx = qb.wy = 0; this.say('QB throws it away');
  }
  ballLogic(dt) {
    const pl = this.pl, b = pl.ball;
    if (!b || pl.holder) return;
    b.t += dt; const s = clamp(b.t / b.T, 0, 1);
    b.x = b.fx + (b.tx - b.fx) * s; b.y = b.fy + (b.ty - b.fy) * s; b.z = Math.sin(Math.PI * s) * (3 + b.dist * 0.18);
    if (b.t < b.T) return;
    if (b.away) { return this.endPlay({ k: 'inc', x: this.ballX, y: this.ballY }); }
    const rec = b.rec, defs = pl.defE.filter(e => !e.down);
    let d1 = null, dm = 99;
    for (const e of defs) { const dd = Math.hypot(e.x - b.tx, e.y - b.ty); if (dd < dm) { dm = dd; d1 = e; } }
    const recDist = Math.hypot(rec.x - b.tx, rec.y - b.ty);
    const qb = pl.qb, dfR = d1 ? d1.r : 60;
    let jump = false;
    if (this.userSide && this.userSide === pl.df && pl.ctrl && Math.hypot(pl.ctrl.x - b.tx, pl.ctrl.y - b.ty) < 2.6 && pl.t - pl.jumpT < 0.7 && pl.t - pl.jumpT >= 0) jump = true;
    let pc = 0.66 + (qb.r - 70) * 0.004 + (rec.r - dfR) * 0.004 + (dm - 2.0) * 0.12 - Math.max(0, b.dist - 25) * 0.004 - (pl.pressure ? 0.07 : 0);
    if (b.short) pc -= 0.45; if (recDist > 2.5) pc -= 0.5; if (jump) pc *= 0.45;
    pc = clamp(pc, 0.03, 0.96);
    const roll = Math.random();
    if (roll < pc) {
      pl.holder = rec; pl.carrier = rec; pl.ball = null; rec.catching = false; rec.x = b.tx; rec.y = b.ty;
      this.say(`${rec.p.name} makes the catch`); return;
    }
    let pi = (dm < 2.4 && d1) ? clamp(0.09 + (dfR - qb.r) * 0.003 + (jump ? 0.22 : 0), 0.02, 0.5) : 0.01;
    if (Math.random() < pi) {
      pl.holder = d1; pl.carrier = d1; pl.ball = null; d1.x = b.tx; d1.y = b.ty; pl.turnover = true;
      this.setBanner('INTERCEPTION!', 1.4, '#ff6b6b'); this.say(`${d1.p.name} intercepts the pass!`);
      this.stat[pl.off].to++; this.addHype(pl.df, 20); this.addHype(pl.off, -10); this.cheer[pl.df] = 3; return;
    }
    this.endPlay({ k: 'inc', x: this.ballX, y: this.ballY });
  }
  /* ----- tackles ----- */
  checkTackles() {
    const pl = this.pl, h = pl.holder; if (!h || pl.ended) return;
    const hAtt = h.side;
    // OOB / TD
    const cd = hAtt === pl.off ? pl.d : -pl.d;
    if ((h.x - goalX(hAtt)) * cd >= 0) { return this.endPlay({ k: 'td', x: h.x, y: h.y, side: hAtt }); }
    if (h.y < 0.1 || h.y > FH - 0.1) { h.y = clamp(h.y, 0, FH); return this.endPlay({ k: 'oob', x: h.x, y: h.y, e: h }); }
    const inPocket = h === pl.qb && !pl.isRun && (h.x - pl.x0) * pl.d < 0.5;
    for (const e of pl.E) {
      if (e.side === hAtt || e.eng || e.stun > 0 || e.tcd > 0 || e.down) continue;
      const reach = 1.0 + (e.dive > 0 ? 0.85 : 0);
      if (Math.hypot(e.x - h.x, e.y - h.y) > reach) continue;
      e.tcd = 0.5;
      let n = 0; for (const o of pl.E) if (o.side !== hAtt && o !== e && !o.eng && Math.hypot(o.x - h.x, o.y - h.y) < 1.7) n++;
      let p = 0.54 + (e.r - h.r * 0.85) / 120 + n * 0.1 + (e.dive > 0 ? -0.1 : 0) + (inPocket ? 0.12 : 0);
      if (h.jk > 0) p -= 0.55; p = clamp(p, 0.12, 0.95);
      if (Math.random() < p) { return this.endTackle(h, inPocket ? 'sack' : 'tackle', e); }
      e.stun = h.jk > 0 ? 0.9 : 0.5; h.stun = Math.max(h.stun, 0.12);
    }
  }
  endTackle(h, kind, by) {
    const pl = this.pl;
    // fumble?
    const fp = kind === 'sack' ? 0.06 : 0.011 + (h.rp.fat || 0) * 0.0001;
    if (Math.random() < fp) {
      if (Math.random() < 0.55) { return this.endPlay({ k: 'fum', x: h.x, y: h.y, e: h, by }); }
    }
    // injury roll
    if (Math.random() < 0.012) { const v = Math.random() < 0.5 ? h : by; if (v) this.injure(v); }
    this.endPlay({ k: kind, x: h.x, y: h.y, e: h, by });
  }
  injure(e) {
    const rp = e.rp; if (rp.inj > 0) return;
    rp.inj = Math.random() < 0.08 ? ri(8, 14) : ri(1, 5);
    this.notice = { t: 3, text: `INJURY: ${rp.pos} ${rp.name} (${rp.inj} wk${rp.inj > 1 ? 's' : ''})` }; this.say(`Injury: ${rp.name} out ${rp.inj} wks`);
  }

  /* ---------- end of play & scoring ---------- */
  endPlay(r) {
    const pl = this.pl; if (pl.ended) return; pl.ended = true;
    const off = pl.off, df = pl.df, d = pl.d;
    const startX = this.ballX; let stopClock = false, text = '', col = '#fff', next = null;
    const h = r.e || pl.holder;
    const gain = Math.round((r.x - startX) * d);
    if (h) { h.wx = h.wy = 0; }
    const flipHolder = h && h.side === df; // defense had ball
    const y = clamp(r.y === undefined ? 14 : r.y, 5, FH - 5);
    const isPassPlay = (pl.passed || r.k === 'sack') && h && h.side === off;
    const credit = g => { this.stat[off].yds += g; if (isPassPlay) this.stat[off].pass += g; else this.stat[off].rush += g; };
    switch (r.k) {
      case 'inc': text = 'INCOMPLETE'; stopClock = true; this.down++; this.checkDowns(); break;
      case 'td': {
        const s = r.side; const pts = 6 + this.autoPAT(s);
        this.addScore(s, pts); this.cheer[s] = 4; this.addHype(s, 25); this.addHype(oppS(s), -15); stopClock = true;
        if (s === off) credit(Math.max(0, gain));
        text = 'TOUCHDOWN!'; col = '#ffe14a'; this.say(`${this.team[s].abbr} TOUCHDOWN (${h ? h.p.name : ''})`);
        this.pend = { k: 'kickoff', side: s }; break;
      }
      case 'fum':
        text = 'FUMBLE! LOST!'; col = '#ff6b6b'; this.stat[off].to++; this.addHype(df, 18); this.addHype(off, -8); this.cheer[df] = 2.5;
        this.giveBall(df, r.x, y); this.say('Fumble recovered by ' + this.team[df].abbr); break;
      default: { // tackle, sack, oob
        if (flipHolder) { // return after turnover tackled
          let spot = r.x; const ownG = ownGoalX(df);
          if ((spot - ownG) * -d <= 0) { text = 'TOUCHBACK'; spot = xFromOwn(df, 20); }
          else text = 'RETURN TACKLED';
          this.giveBall(df, spot, y); stopClock = false; break;
        }
        const ownG = ownGoalX(off);
        if ((r.x - ownG) * d <= 0) { // safety
          this.addScore(df, 2); this.cheer[df] = 3; this.addHype(df, 20); stopClock = true; text = 'SAFETY!'; col = '#ffe14a';
          this.say(`${this.team[df].abbr} SAFETY`); this.pend = { k: 'kickoff', side: off }; break;
        }
        if (r.k === 'sack') { this.stat[df].sacks++; text = `SACK! ${gain} YDS`; col = '#ff9f43'; this.addHype(df, 14); this.addHype(off, -6); this.cheer[df] = 2; }
        else text = gain >= 0 ? `GAIN OF ${gain}` : `LOSS OF ${-gain}`;
        if (r.k === 'oob') { stopClock = true; text += ' (OOB)'; }
        credit(gain);
        if (gain >= 15) { this.addHype(off, 10); this.cheer[off] = 1.8; if (r.k !== 'sack') text = 'BIG PLAY! ' + text; }
        else if (gain >= 8) this.addHype(off, 4);
        if (this.userSide && r.k !== 'sack' && gain >= 10) this.popups.push({ t: 1.2, text: `+${gain}` });
        this.ballX = startX + d * gain; this.ballY = y;
        if (gain >= this.toGo) { this.down = 1; this.setFirst(); if (gain >= this.toGo || true) text += ' - 1ST DOWN'; }
        else { this.toGo -= gain; this.down++; this.checkDowns(); }
        this.say(`${text} (${this.team[off].abbr})`);
      }
    }
    if (this.tod) { text = 'TURNOVER ON DOWNS'; col = '#ff6b6b'; this.tod = false; }
    // clock
    if (!stopClock) this.clock = Math.max(0, this.clock - 9);
    this.setBanner(text, 1.5, col);
    this.afterPlay(stopClock, 0);
  }
  checkDowns() {
    if (this.down > 4) {
      const o = this.poss; this.say('Turnover on downs');
      this.stat[o].to++; this.addHype(oppS(o), 8);
      this.giveBall(oppS(o), this.ballX, this.ballY); this.tod = true;
    }
  }
  afterPlay(stopClock, extra, noDwell) {
    this.phase = 'dwell'; this.dwell = noDwell ? 1.2 : 1.7;
    if (this.score.home + this.score.away > 0 && this.pend) this.dwell = 2.4;
  }
  autoPAT(s) {
    const K = getStarters(this.team[s]).K[0];
    const good = Math.random() < clamp(0.93 + (this.effR(K, s) - 70) * 0.003, 0.7, 0.995);
    return good ? 1 : 0;
  }
}

/* =============== Rendering =============== */
Match.prototype.draw = function (ctx) {
  const t = this.time, cam = this.cam, pl = this.pl, us = this.userSide;
  const x2s = x => x * PX - cam;
  ctx.fillStyle = '#10131d'; ctx.fillRect(0, 0, CW, CH);
  // stands
  ctx.fillStyle = '#1b2033'; ctx.fillRect(0, 18, CW, FY0 - 18);
  const bounce = (this.cheer.home > 0 || this.cheer.away > 0) ? Math.floor(Math.sin(t * 14) * 1.2) : 0;
  for (const c of this.crowd) { const x = ((c.x - cam * 0.6) % 760 + 760) % 760 - 20; if (x < -2 || x > CW) continue; ctx.fillStyle = c.c; ctx.fillRect(Math.round(x), c.y + (c.x % 2 ? bounce : 0), 2, 3); }
  ctx.fillStyle = '#2b3350'; ctx.fillRect(0, FY0 - 3, CW, 3);
  // grass
  for (let k = 0; k < 24; k++) { ctx.fillStyle = k % 2 ? '#2e7d32' : '#2a7330'; ctx.fillRect(Math.round(x2s(k * 5)), FY0, 5 * PX + 1, FY1 - FY0); }
  // end zones
  const ez = (x0, tm) => { ctx.fillStyle = shade(tm.c1, -35); ctx.fillRect(Math.round(x2s(x0)), FY0, 10 * PX, FY1 - FY0); ctx.save(); ctx.translate(Math.round(x2s(x0 + 5)), (FY0 + FY1) / 2); ctx.rotate(x0 < 60 ? -Math.PI / 2 : Math.PI / 2); ctx.fillStyle = tm.c2; ctx.font = 'bold 14px monospace'; ctx.textAlign = 'center'; ctx.fillText(tm.name.toUpperCase().slice(0, 9), 0, 5); ctx.restore(); };
  ez(0, this.team.home); ez(110, this.team.away);
  // lines
  ctx.fillStyle = 'rgba(255,255,255,.75)';
  for (let j = 0; j <= 20; j++) { const x = 10 + j * 5; const sx = Math.round(x2s(x)); if (sx < -2 || sx > CW + 2) continue; ctx.fillRect(sx, FY0, (j === 0 || j === 20) ? 2 : 1, FY1 - FY0); }
  ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let x = 11; x < 110; x++) { const sx = Math.round(x2s(x)); if (sx < 0 || sx > CW) continue; ctx.fillRect(sx, this.y2s(10), 1, 2); ctx.fillRect(sx, this.y2s(18), 1, 2); }
  ctx.font = '8px monospace'; ctx.textAlign = 'center'; ctx.fillStyle = 'rgba(255,255,255,.55)';
  for (let k = 1; k <= 9; k++) { const x = 10 + k * 10; const sx = x2s(x); if (sx < -10 || sx > CW + 10) continue; const n = String(10 * Math.min(k, 10 - k)); ctx.fillText(n, sx, FY0 + 12); ctx.fillText(n, sx, FY1 - 5); }
  ctx.fillStyle = '#fff'; ctx.fillRect(0, FY0 - 1, CW, 1); ctx.fillRect(0, FY1, CW, 1);
  // LOS & first-down lines
  if (this.phase !== 'kick' && !this.over) {
    const bx = pl && (this.phase === 'play' || this.phase === 'dwell') ? pl.x0 : this.ballX;
    ctx.fillStyle = '#4aa3ff'; ctx.fillRect(Math.round(x2s(bx)), FY0, 1, FY1 - FY0);
    const d = dirOf(this.poss), fx = (pl ? pl.x0 : this.ballX) + d * this.toGo;
    if (this.toGo < this.ytg() + 0 || this.toGo < 10) { if ((goalX(this.poss) - fx) * d > 0) { ctx.fillStyle = '#ffe14a'; ctx.fillRect(Math.round(x2s(fx)), FY0, 1, FY1 - FY0); } }
  }
  // sidelines: mascots
  ctx.fillStyle = '#1f2a1f'; ctx.fillRect(0, FY1 + 1, CW, CH - FY1);
  ctx.fillStyle = '#3a4a3a'; ctx.fillRect(0, FY1 + 1, CW, 1);
  const mh = this.team.home.mascot, ma = this.team.away.mascot;
  if (mh) drawMascot(ctx, mh, 24, CH - 2, 1, t, this.cheer.home > 0);
  if (ma) drawMascot(ctx, ma, CW - 24, CH - 2, 1, t + 1, this.cheer.away > 0);
  // hype bars
  const bar = (x, w, v, c1, lab) => { ctx.fillStyle = '#000'; ctx.fillRect(x, CH - 12, w, 6); ctx.fillStyle = c1; ctx.fillRect(x + 1, CH - 11, Math.round((w - 2) * v / 100), 4); ctx.fillStyle = '#ccc'; ctx.font = '6px monospace'; ctx.textAlign = 'left'; ctx.fillText(lab, x, CH - 14); };
  bar(46, 80, this.hype.home, '#ffd24d', 'HYPE ' + this.team.home.abbr); bar(CW - 126, 80, this.hype.away, '#ffd24d', 'HYPE ' + this.team.away.abbr);
  // entities
  const ents = [];
  if (pl) for (const e of pl.E) ents.push(e);
  ents.sort((a, b) => a.y - b.y);
  for (const e of ents) {
    const sx = x2s(e.x); if (sx < -10 || sx > CW + 10) continue;
    const col = this.cols[e.side]; col.skin = SKINS[e.rp.skin] || SKINS[2];
    const moving = Math.hypot(e.vx, e.vy) > 0.6;
    drawPlayerSprite(ctx, sx, this.y2s(e.y), e.face, col, t, moving, e.ph, e.down ? 'down' : '');
    if (pl && pl.holder === e) { ctx.fillStyle = '#7a4a1d'; ctx.fillRect(Math.round(sx) + e.face * 4 - 1, Math.round(this.y2s(e.y)) - 7, 3, 2); }
    if (e === pl.ctrl && this.phase === 'play') { ctx.fillStyle = '#ffe14a'; const yy = Math.round(this.y2s(e.y)) - 17 + (Math.floor(t * 6) % 2); ctx.fillRect(Math.round(sx) - 2, yy, 5, 1); ctx.fillRect(Math.round(sx) - 1, yy + 1, 3, 1); ctx.fillRect(Math.round(sx), yy + 2, 1, 1); }
  }
  // receiver numbers for user passing
  if (pl && us === pl.off && this.phase === 'play' && pl.holder === pl.qb && !pl.ball) {
    ctx.font = 'bold 8px monospace'; ctx.textAlign = 'center';
    pl.recs.forEach((e, i) => { if (e.blockRb) return; const sx = x2s(e.x), sy = this.y2s(e.y) - 15; ctx.fillStyle = 'rgba(0,0,0,.65)'; ctx.fillRect(Math.round(sx) - 4, Math.round(sy) - 7, 9, 9); ctx.fillStyle = '#ffe14a'; ctx.fillText(String(i + 1), Math.round(sx), Math.round(sy)); });
  }
  // ball in air / kick
  const drawBall = (bx, by, z) => { const sx = Math.round(x2s(bx)), sy = Math.round(this.y2s(by)); ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(sx - 1, sy, 3, 1); ctx.fillStyle = '#7a4a1d'; ctx.fillRect(sx - 2, sy - 3 - Math.round(z), 4, 2); ctx.fillStyle = '#fff'; ctx.fillRect(sx, sy - 3 - Math.round(z), 1, 1); };
  if (pl && pl.ball) drawBall(pl.ball.x, pl.ball.y, pl.ball.z * 2);
  if (this.kick) { const k = this.kick, s = clamp(k.t / k.T, 0, 1); drawBall(k.fx + (k.tx - k.fx) * s, k.fy + (k.ty - k.fy) * s, Math.sin(Math.PI * s) * k.h * 0.5); }
  if (this.phase === 'presnap') { drawBall(this.ballX - dirOf(this.poss) * 4.5, this.ballY, 0); }
  // goalposts during FG
  // scoreboard
  ctx.fillStyle = 'rgba(0,0,0,.82)'; ctx.fillRect(0, 0, CW, 18);
  const hh = this.team.home, aa = this.team.away;
  ctx.fillStyle = hh.c1; ctx.fillRect(4, 3, 4, 12); ctx.fillStyle = hh.c2; ctx.fillRect(8, 3, 2, 12);
  ctx.font = 'bold 10px monospace'; ctx.textAlign = 'left'; ctx.fillStyle = '#fff'; ctx.fillText(hh.abbr + ' ' + this.score.home, 14, 13);
  ctx.textAlign = 'right'; ctx.fillText(this.score.away + ' ' + aa.abbr, CW - 14, 13); ctx.fillStyle = aa.c1; ctx.fillRect(CW - 10, 3, 4, 12); ctx.fillStyle = aa.c2; ctx.fillRect(CW - 12, 3, 2, 12);
  ctx.textAlign = 'center'; ctx.fillStyle = '#ffe14a'; ctx.fillText(this.qText() + ' ' + this.clockText(), CW / 2, 13);
  ctx.fillStyle = 'rgba(0,0,0,.6)'; ctx.fillRect(CW / 2 - 70, 19, 140, 10);
  ctx.fillStyle = '#fff'; ctx.font = '8px monospace';
  const arrow = this.poss === 'home' ? '▶ ' : '';
  ctx.fillText((this.poss === 'home' ? '▶ ' : '◀ ') + this.team[this.poss].abbr + '  ' + this.downText() + ' @ ' + this.spotText(), CW / 2, 27);
  // popups & notice
  for (const p of this.popups) { ctx.fillStyle = '#ffe14a'; ctx.font = 'bold 12px monospace'; ctx.fillText(p.text, CW / 2, 60 - (1.2 - p.t) * 12); }
  if (this.notice) { ctx.fillStyle = 'rgba(160,20,20,.85)'; ctx.fillRect(0, 31, CW, 11); ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.fillText(this.notice.text, CW / 2, 39); }
  // hint
  if (pl && us === pl.off && this.phase === 'play' && pl.holder === pl.qb && !pl.ball && !pl.isRun) { ctx.fillStyle = 'rgba(0,0,0,.55)'; ctx.fillRect(CW / 2 - 70, FY1 - 12, 140, 10); ctx.fillStyle = '#fff'; ctx.font = '7px monospace'; ctx.fillText('TAP A RECEIVER TO THROW', CW / 2, FY1 - 5); }
  // FG meter
  if (this.phase === 'fgmeter' && this.fgm) {
    const f = this.fgm, w = 160, x = (CW - w) / 2, y = 80;
    ctx.fillStyle = 'rgba(0,0,0,.8)'; ctx.fillRect(x - 6, y - 14, w + 12, 40);
    ctx.fillStyle = '#fff'; ctx.font = 'bold 8px monospace'; ctx.fillText(`${f.dist} YD FIELD GOAL - TAP WHEN CENTERED`, CW / 2, y - 4);
    ctx.fillStyle = '#7a1f1f'; ctx.fillRect(x, y, w, 12); ctx.fillStyle = '#c9a227'; ctx.fillRect(x + w * 0.3, y, w * 0.4, 12); ctx.fillStyle = '#3ddc84'; ctx.fillRect(x + w * 0.44, y, w * 0.12, 12);
    ctx.fillStyle = '#fff'; ctx.fillRect(Math.round(x + w / 2 + (f.m || 0) * w / 2) - 1, y - 3, 3, 18);
  }
  // banner
  if (this.banner) {
    const bn = this.banner; ctx.font = 'bold 15px monospace'; ctx.textAlign = 'center';
    ctx.fillStyle = 'rgba(0,0,0,.55)'; const wd = ctx.measureText(bn.t).width + 20; ctx.fillRect((CW - wd) / 2, 88, wd, 24);
    ctx.fillStyle = '#000'; ctx.fillText(bn.t, CW / 2 + 1, 106); ctx.fillStyle = bn.col; ctx.fillText(bn.t, CW / 2, 105);
  }
  ctx.textAlign = 'left';
};
