'use strict';
/* ===== Pixel art: mascots, player portraits, in-game player sprites ===== */
function hex2rgb(h) { h = h.replace('#', ''); if (h.length === 3) h = h.split('').map(c => c + c).join(''); return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)]; }
function shade(h, amt) { const c = hex2rgb(h).map(v => clamp(Math.round(v + amt), 0, 255)); return '#' + c.map(v => v.toString(16).padStart(2, '0')).join(''); }
function colorDist(a, b) { const x = hex2rgb(a), y = hex2rgb(b); return Math.hypot(x[0] - y[0], x[1] - y[1], x[2] - y[2]); }
function lum(h) { const c = hex2rgb(h); return 0.3 * c[0] + 0.59 * c[1] + 0.11 * c[2]; }

/* ---- Mascot: box 14w x 20h, bottom-centre anchored. s = pixel scale ---- */
function drawMascot(ctx, m, bx, by, s, t, cheer) {
  const cs = m.cheer; let dx = 0, dy = 0, flip = false;
  if (cheer) {
    if (cs === 'jump') dy = -Math.abs(Math.sin(t * 9)) * 5;
    else if (cs === 'spin') { dy = -Math.abs(Math.sin(t * 7)) * 3; flip = Math.floor(t * 8) % 2 === 0; }
    else if (cs === 'dance') dx = Math.sin(t * 8) * 2.5;
    else dy = Math.sin(t * 6) * 1;
  } else dy = Math.sin(t * 3) > 0.5 ? -1 : 0;
  const ox = bx - 7 * s + dx * s, oy = by - 20 * s + dy * s;
  const R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(Math.round(ox + x * s), Math.round(oy + y * s), Math.max(1, Math.round(w * s)), Math.max(1, Math.round(h * s))); };
  ctx.save();
  if (flip) { ctx.translate(bx * 2, 0); ctx.scale(-1, 1); }
  const C1 = m.c1, C2 = m.c2, DK = '#141414', WH = '#ffffff', sp = m.species;
  const bodyC = sp === 'robot' ? C2 : C1, headC = sp === 'person' ? '#f0c090' : C1;
  // legs + shoes
  R(4, 16, 2, 3, sp === 'person' ? C2 : shade(C1, -30)); R(8, 16, 2, 3, sp === 'person' ? C2 : shade(C1, -30)); R(3, 19, 3, 1, DK); R(8, 19, 3, 1, DK);
  // body
  R(3, 10, 8, 6, bodyC); if (sp !== 'robot') R(5, 12, 4, 3, sp === 'person' ? C2 : shade(C2, 20)); else { R(5, 12, 4, 3, shade(C2, -40)); R(6, 13, 1, 1, '#ff4d4d'); R(8, 13, 1, 1, '#4dff88'); }
  if (sp === 'bird') R(2, 11, 1, 3, C2), R(11, 11, 1, 3, C2);
  // arms
  const leftUp = cheer && (cs !== 'dance' || Math.sin(t * 8) > 0) && cs !== 'wave' || (cheer && cs === 'wave' && Math.sin(t * 6) > 0);
  const rightUp = cheer && (cs !== 'dance' || Math.sin(t * 8) <= 0);
  const armC = sp === 'person' ? C1 : bodyC;
  const lhy = leftUp ? 3 : 14, rhy = rightUp ? 3 : 14;
  R(1, leftUp ? 4 : 10, 2, leftUp ? 6 : 5, armC); R(11, rightUp ? 4 : 10, 2, rightUp ? 6 : 5, armC);
  // head
  R(3, 3, 8, 7, headC);
  switch (sp) {
    case 'bear': R(3, 1, 2, 2, C1); R(9, 1, 2, 2, C1); R(4, 2, 1, 1, C2); R(9, 2, 1, 1, C2); R(5, 7, 4, 3, shade(C2, 30)); R(6, 7, 2, 1, DK); break;
    case 'cat': R(3, 1, 2, 2, C1); R(3, 0, 1, 1, C1); R(9, 1, 2, 2, C1); R(10, 0, 1, 1, C1); R(5, 7, 4, 2, shade(C2, 30)); R(6, 7, 2, 1, '#ff8fa3'); R(2, 8, 1, 1, WH); R(11, 8, 1, 1, WH); break;
    case 'dog': R(2, 3, 2, 5, C2); R(10, 3, 2, 5, C2); R(5, 7, 4, 3, shade(C2, 40)); R(6, 7, 2, 1, DK); break;
    case 'bird': R(6, 7, 3, 2, '#ffa534'); R(6, 0, 2, 3, C2); R(4, 1, 1, 2, C2); break;
    case 'horse': R(3, 1, 1, 2, C1); R(10, 1, 1, 2, C1); R(10, 2, 1, 7, C2); R(5, 7, 4, 4, shade(C2, 40)); R(5, 8, 1, 1, DK); R(8, 8, 1, 1, DK); break;
    case 'bull': R(1, 3, 2, 1, WH); R(1, 2, 1, 1, WH); R(11, 3, 2, 1, WH); R(12, 2, 1, 1, WH); R(5, 7, 4, 3, shade(C2, 30)); R(6, 8, 1, 1, DK); R(8, 8, 1, 1, DK); R(6, 9, 2, 1, '#ffd24d'); break;
    case 'robot': R(7, 0, 1, 3, '#888'); R(6, 0, 3, 1, '#ff4d4d'); R(5, 8, 4, 1, DK); R(5, 9, 1, 1, WH); R(7, 9, 1, 1, WH); R(8, 9, 1, 1, WH); break;
    case 'fish': R(6, 0, 2, 3, C1); R(7, 1, 2, 2, C1); R(4, 8, 7, 2, shade(C2, 50)); R(10, 8, 2, 1, shade(C1, 30)); break;
    default: R(3, 3, 8, 2, '#5a3a1d'); R(3, 5, 1, 2, '#5a3a1d'); R(6, 8, 3, 1, '#a0522d'); break;
  }
  // eyes
  if (m.shades) { R(4, 5, 6, 2, DK); R(4, 5, 1, 1, '#555'); } else {
    if (sp === 'robot') { R(4, 5, 2, 2, '#7fffd4'); R(8, 5, 2, 2, '#7fffd4'); } else { R(4, 5, 2, 2, WH); R(8, 5, 2, 2, WH); R(5, 6, 1, 1, DK); R(9, 6, 1, 1, DK); }
  }
  // hats
  switch (m.hat) {
    case 'cap': R(3, 2, 8, 2, C2); R(8, 3, 5, 1, shade(C2, -30)); break;
    case 'cowboy': R(0, 3, 14, 1, '#7a4a1d'); R(3, 0, 8, 3, '#9a6a2d'); R(3, 2, 8, 1, '#4a2a0d'); break;
    case 'crown': R(3, 1, 8, 2, '#ffd24d'); R(3, 0, 1, 1, '#ffd24d'); R(6, 0, 2, 1, '#ffd24d'); R(10, 0, 1, 1, '#ffd24d'); R(6, 1, 2, 1, '#e03a3a'); break;
    case 'pirate': R(2, 1, 10, 2, DK); R(4, 0, 6, 1, DK); R(6, 1, 2, 1, WH); R(2, 3, 10, 1, shade(C1, -20)); break;
    case 'viking': R(3, 1, 8, 3, '#9aa0a6'); R(2, 0, 1, 3, WH); R(11, 0, 1, 3, WH); break;
    case 'tophat': R(4, -2, 6, 5, DK); R(2, 3, 10, 1, DK); R(4, 1, 6, 1, C2); break;
    case 'cheese': R(3, 0, 8, 3, '#ffcf33'); R(5, 1, 1, 1, '#d9a400'); R(8, 0, 1, 1, '#d9a400'); R(9, 2, 1, 1, '#d9a400'); break;
    case 'hardhat': R(3, 1, 8, 3, '#ffd24d'); R(2, 3, 10, 1, '#e0b000'); break;
    case 'helmet': R(3, 1, 8, 3, C2); R(3, 3, 8, 1, shade(C2, -40)); R(6, 1, 2, 1, WH); break;
    case 'tricorn': R(1, 2, 12, 2, '#222a55'); R(3, 0, 8, 2, '#222a55'); R(1, 2, 12, 1, C2); break;
  }
  // accessories
  const hx = 1, hy = leftUp ? lhy : 14, rhx = 12, rhy2 = rhy;
  switch (m.acc) {
    case 'pompoms': { const w = (Math.floor(t * 12) % 2) ? 1 : 0; R(hx - 2, hy - 2 + w, 4, 4, C2); R(hx - 1, hy - 1 + w, 2, 2, WH); R(rhx - 1, rhy2 - 2 - w, 4, 4, C2); R(rhx, rhy2 - 1 - w, 2, 2, WH); break; }
    case 'flag': R(rhx + 1, rhy2 - 12, 1, 13, '#cfcfcf'); R(rhx + 2, rhy2 - 12, 6, 4, C2); R(rhx + 2, rhy2 - 10, 6, 1, C1); break;
    case 'finger': R(rhx - 1, rhy2 - 5, 4, 6, C2); R(rhx, rhy2 - 9, 2, 5, C2); break;
    case 'megaphone': R(rhx - 3, rhy2 - 2, 4, 3, '#d0d0d0'); R(rhx - 5, rhy2 - 3, 2, 5, '#9a9a9a'); break;
  }
  ctx.restore();
}
const _imgCache = {};
function mascotURL(m, s, t, cheer) {
  const key = ['m', m.species, m.c1, m.c2, m.hat, m.acc, m.shades, m.cheer, s, cheer ? Math.floor(t * 4) : 0].join('|');
  if (_imgCache[key]) return _imgCache[key];
  const c = document.createElement('canvas'); c.width = 22 * s; c.height = 28 * s;
  const x = c.getContext('2d'); x.imageSmoothingEnabled = false;
  drawMascot(x, m, 11 * s, 26 * s, s, t || 0, cheer);
  return (_imgCache[key] = c.toDataURL());
}

/* ---- Player portrait 24x24 ---- */
function portraitURL(p, team) {
  const key = ['p', p.skin, p.hair, p.hs, team ? team.c1 : '#555', team ? team.c2 : '#999'].join('|');
  if (_imgCache[key]) return _imgCache[key];
  const c = document.createElement('canvas'); c.width = 24; c.height = 24; const x = c.getContext('2d');
  const R = (a, b, w, h, col) => { x.fillStyle = col; x.fillRect(a, b, w, h); };
  const sk = SKINS[p.skin] || SKINS[2], hr = HAIRS[p.hair] || HAIRS[0];
  const c1 = team ? team.c1 : '#555', c2 = team ? team.c2 : '#999';
  R(0, 0, 24, 24, shade(c1, -50)); R(0, 18, 24, 6, c1); R(2, 17, 20, 3, c1); R(9, 15, 6, 3, shade(sk, -25));
  R(7, 6, 10, 11, sk); R(6, 10, 1, 3, sk); R(17, 10, 1, 3, sk);
  switch (p.hs) {
    case 1: R(7, 5, 10, 3, hr); R(6, 6, 1, 4, hr); R(17, 6, 1, 4, hr); break;
    case 2: R(5, 2, 14, 7, hr); R(5, 8, 2, 3, hr); R(17, 8, 2, 3, hr); break;
    case 3: R(10, 1, 4, 6, hr); break;
    case 4: R(6, 4, 12, 4, hr); R(6, 8, 2, 9, hr); R(16, 8, 2, 9, hr); break;
  }
  R(9, 10, 2, 2, '#fff'); R(14, 10, 2, 2, '#fff'); R(10, 11, 1, 1, '#111'); R(15, 11, 1, 1, '#111'); R(10, 14, 5, 1, shade(sk, -60));
  R(10, 18, 4, 2, c2);
  return (_imgCache[key] = c.toDataURL());
}

/* ---- in-game football player (8w x 12h), sx,sy = feet centre ---- */
function drawPlayerSprite(ctx, sx, sy, f, col, t, moving, ph, state) {
  sx = Math.round(sx); sy = Math.round(sy);
  const sw = moving ? (Math.sin(t * 16 + ph) > 0 ? 1 : 0) : 0;
  const down = state === 'down';
  ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fillRect(sx - 3, sy - 1, 7, 2);
  if (down) { ctx.fillStyle = col.jersey; ctx.fillRect(sx - 5, sy - 4, 9, 3); ctx.fillStyle = col.helmet; ctx.fillRect(sx + 3 * f - 1, sy - 5, 3, 3); ctx.fillStyle = col.pants; ctx.fillRect(sx - 6 * f - 1, sy - 3, 3, 2); return; }
  ctx.fillStyle = col.pants; ctx.fillRect(sx - 2, sy - 4 + sw, 2, 4 - sw); ctx.fillRect(sx, sy - 4 + (1 - sw), 2, 4 - (1 - sw));
  ctx.fillStyle = col.jersey; ctx.fillRect(sx - 3, sy - 8, 6, 4);
  ctx.fillStyle = col.skin; ctx.fillRect(sx - 4, sy - 8, 1, 3); ctx.fillRect(sx + 3, sy - 8, 1, 3);
  ctx.fillStyle = col.helmet; ctx.fillRect(sx - 2, sy - 12, 5, 4);
  ctx.fillStyle = col.mask; ctx.fillRect(sx + (f > 0 ? 1 : -3), sy - 10, 2, 2);
  ctx.fillStyle = col.skin; ctx.fillRect(sx + (f > 0 ? 0 : -1), sy - 9, 1, 1);
}
function teamColors(team, alt) {
  const jersey = alt ? team.c2 : team.c1, other = alt ? team.c1 : team.c2;
  return { jersey, helmet: shade(jersey, -25), pants: lum(other) > 200 ? '#e8e8e8' : (lum(other) < 40 ? '#2a2a2a' : other), mask: '#eee' };
}
