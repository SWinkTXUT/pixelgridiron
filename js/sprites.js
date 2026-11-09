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

/* ---- in-game football player: drawn in half-pixel (device) units, ~16x29 device px ---- */
const DIGITS = ['111101101101111', '010110010010111', '111001111100111', '111001111001111', '101101111001001', '111100111001111', '111100111101111', '111001001001001', '111101111101111', '111101111001111'];
function drawPlayerSprite(ctx, sx, sy, f, col, t, moving, ph, state, num, ball) {
  const ox = Math.round(sx * 2) / 2, oy = Math.round(sy * 2) / 2;
  const fill = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + (f > 0 ? x : -x - w) * 0.5, oy + y * 0.5, w * 0.5, h * 0.5); };
  const OUT = '#0b0e14', J = col.jersey, Jd = shade(J, -38), Jl = shade(J, 34), H = col.helmet, Hl = shade(H, 45), PN = col.pants, PNd = shade(PN, -34), SK = col.skin, SKd = shade(SK, -40);
  fill(-8, -1, 17, 2, 'rgba(0,0,0,.28)'); fill(-6, 0, 13, 1, 'rgba(0,0,0,.22)');
  if (state === 'down') {
    const parts = [[-9, -9, 16, 7, J], [-15, -8, 7, 4, PN], [-15, -5, 7, 2, PNd], [6, -10, 7, 7, H], [9, -7, 4, 3, SK], [-4, -9, 10, 2, Jl]];
    parts.forEach(p => fill(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2, OUT)); parts.forEach(p => fill(p[0], p[1], p[2], p[3], p[4]));
    fill(12, -8, 2, 4, '#ddd'); return;
  }
  const s = moving ? Math.sin(t * 14 + ph) : 0, sw = moving ? Math.round(s * 2) : 0, la = s > 0.5 ? 2 : 0, lb = s < -0.5 ? 2 : 0;
  const armB = moving ? Math.round(-s * 2) : 0, armF = -armB;
  const parts = [];
  parts.push([-8 + (moving ? -armB : 0), -19 + armB, 3, 8, SKd, 'arm']);               // back arm
  parts.push([-4 + sw, -9, 3, 7 - la, PNd]); parts.push([-5 + sw, -3 - la, 5, 2, '#17181c']); // back leg + cleat
  parts.push([1 - sw, -9, 3, 7 - lb, PN]); parts.push([0 - sw, -3 - lb, 5, 2, '#222']);       // front leg
  parts.push([-5, -12, 10, 4, PN]);                                                              // hips
  parts.push([-5, -20, 10, 9, J]); parts.push([-6, -21, 12, 3, Jl]);                           // torso + pads
  if (ball) { parts.push([4, -17, 5, 3, SK]); parts.push([7, -18, 7, 5, '#7a4a1d']); }
  else parts.push([5, -19 + armF, 3, 8, SK]);
  parts.push([-4, -29, 9, 9, H]);
  parts.forEach(p => fill(p[0] - 1, p[1] - 1, p[2] + 2, p[3] + 2, OUT));
  parts.forEach(p => fill(p[0], p[1], p[2], p[3], p[4]));
  // details
  fill(-5, -12, 10, 1, shade(J, -20)); fill(3, -18, 2, 6, Jd);                                    // belt shade, torso shade
  fill(-4 + sw, -5 - la, 3, 1, col.stripe); fill(1 - sw, -5 - lb, 3, 1, col.stripe);             // socks
  fill(-4 + sw, -9, 1, 5 - la, col.stripe); fill(3 - sw, -9, 1, 5 - lb, col.stripe);             // pant stripes
  fill(-8, -19 + armB, 3, 3, J); fill(5, -19 + armF, 3, 3, J); fill(-8, -17 + armB, 3, 1, col.stripe); // sleeves
  if (!ball) fill(5, -12 + armF, 3, 2, col.glove);
  fill(-8, -12 + armB, 3, 2, col.glove);
  fill(-3, -29, 7, 1, Hl); fill(-4, -28, 1, 5, Hl); fill(0, -29, 2, 7, col.stripe);                // helmet highlight + stripe
  fill(2, -25, 3, 5, SK); fill(3, -25, 3, 1, col.mask); fill(3, -22, 3, 1, col.mask); fill(5, -25, 1, 6, col.mask); fill(3, -20, 3, 1, col.mask);
  fill(-1, -24, 2, 2, shade(H, -50)); fill(-4, -22, 2, 3, shade(H, -25));
  if (ball) { fill(8, -17, 4, 1, '#fff'); fill(7, -16, 1, 1, '#4a2a0d'); }
  // number
  if (num !== undefined && num !== null) {
    const str = String(num), w = str.length * 4 - 1; let x0 = -Math.floor(w / 2) + 0;
    for (const ch of str) { const d = DIGITS[+ch]; for (let r = 0; r < 5; r++) for (let c = 0; c < 3; c++) if (d[r * 3 + c] === '1') fill(x0 + c, -17 + r, 1, 1, col.num); x0 += 4; }
  }
}
function drawFootball(ctx, sx, sy, z) {
  const ox = Math.round(sx * 2) / 2, oy = Math.round((sy - z) * 2) / 2, R = (x, y, w, h, c) => { ctx.fillStyle = c; ctx.fillRect(ox + x * 0.5, oy + y * 0.5, w * 0.5, h * 0.5); };
  ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.fillRect(ox - 2, sy, 4, 1);
  R(-5, -7, 10, 6, '#0e0804'); R(-4, -6, 8, 4, '#7a3f16'); R(-3, -6, 6, 1, '#a45a26'); R(-4, -3, 8, 1, '#552a0d'); R(-1, -5, 3, 1, '#fff'); R(-1, -4, 1, 1, '#fff'); R(1, -4, 1, 1, '#fff'); R(-4, -5, 1, 2, '#fff'); R(3, -5, 1, 2, '#fff');
}
function teamColors(team, alt) {
  const jersey = alt ? team.c2 : team.c1, other = alt ? team.c1 : team.c2;
  const pants = lum(other) > 200 ? '#e8e8e8' : (lum(other) < 40 ? '#2a2a2a' : other);
  return { jersey, helmet: shade(jersey, -25), pants, mask: '#e6e6e6', stripe: lum(other) > 215 ? '#cfcfcf' : other, num: lum(jersey) > 150 ? '#111' : '#fff', glove: other };
}
