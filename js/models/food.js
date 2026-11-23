// ===== 料理と器の3Dモデル（丼・ラーメン・トッピング・ライス・餃子・唐揚げ・ビール・道具） =====
// パソコンの画面の絵も、ここのモデルをそのまま撮影して使う（見た目をそろえるため）
import * as THREE from 'three';
import { SOUPS, TOPPINGS, HARD, BROTHS, TARES } from '../data.js';
import { canvasTex, shade } from '../textures.js';
import { mulberry32 } from '../util.js';
import { mat, T, box, rbox, cyl, sph, torus, lathe, bakeGroup, merge, vcolor } from './geo.js';

const C = (c, o = {}) => mat(c, { r: 0.5, ...o });
const VC = (o = {}) => mat('#ffffff', { r: 0.55, vc: true, ...o });
const disc = (r, seg = 28) => new THREE.CircleGeometry(r, seg).rotateX(-Math.PI / 2);
const hemi = (r, ws = 12, hs = 6) => new THREE.SphereGeometry(r, ws, hs, 0, Math.PI * 2, 0, Math.PI / 2);
const lowHemi = (ws = 16, hs = 8) => new THREE.SphereGeometry(1, ws, hs, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2);
const col = (hex) => new THREE.Color(hex);
// ジオメトリの頂点に色を塗る（fn(x,y,z,i) → THREE.Color）
function paint(g, fn) {
  const p = g.attributes.position, a = new Float32Array(p.count * 3);
  for (let i = 0; i < p.count; i++) { const c = fn(p.getX(i), p.getY(i), p.getZ(i), i); a[i * 3] = c.r; a[i * 3 + 1] = c.g; a[i * 3 + 2] = c.b; }
  g.setAttribute('color', new THREE.BufferAttribute(a, 3));
  return g;
}
const tint = (g, hex) => vcolor(g, col(hex));
// なめらかな「でこぼこ」（決まった値になる）
const wob = (x, y, z, s = 0) => Math.sin(x * 5.1 + s) * Math.sin(y * 4.3 + s * 2) * Math.sin(z * 4.7 + 3) * 0.5 + Math.sin(x * 11 + y * 7 + s) * Math.sin(z * 13 + s * 0.7) * 0.25 + Math.sin(x * 23 - z * 19 + y * 17) * 0.1;
const TEX = new Map();
const ctex = (k, w, h, draw, o) => { let t = TEX.get(k); if (!t) { t = canvasTex(w, h, draw, o); TEX.set(k, t); } return t; };

// ---------- 器 ----------
export const BOWL_R = 0.106, BOWL_H = 0.085, BOWL_SCALE = 1.32; // ラーメン丼は大きめ（直径28cmくらい）
const OUT = [[0, 0.004], [0.034, 0.004], [0.036, 0], [0.046, 0], [0.048, 0.007], [0.062, 0.018], [0.08, 0.035], [0.094, 0.055], [0.102, 0.072], [0.106, 0.085]];
const INN = [[0, 0.013], [0.038, 0.014], [0.064, 0.026], [0.083, 0.045], [0.095, 0.065], [0.1005, 0.085]];
const S_H = 0.062;
const S_OUT = [[0, 0.003], [0.024, 0.003], [0.026, 0], [0.033, 0], [0.035, 0.006], [0.046, 0.016], [0.058, 0.034], [0.064, 0.05], [0.066, S_H]];
const S_INN = [[0, 0.011], [0.028, 0.012], [0.045, 0.022], [0.056, 0.036], [0.0615, 0.05], [0.0632, S_H]];
// 高さでUVを振ったろくろ形（模様の帯が高さどおりに出る）
function latheH(pts, seg, H) { const g = lathe(pts, seg), p = g.attributes.position, uv = g.attributes.uv; for (let i = 0; i < p.count; i++) uv.setY(i, p.getY(i) / H); return g; }
const innerR = (pts, y) => { for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; if (y <= y1) return x0 + (x1 - x0) * Math.max(0, Math.min(1, (y - y0) / (y1 - y0 || 1))); } return pts[pts.length - 1][0]; };
let G = null;
function geos() {
  if (G) return G;
  G = {
    bowlOut: latheH(OUT, 32, BOWL_H), bowlIn: latheH(INN, 32, BOWL_H), rim: T(torus(BOWL_R - 0.0025, 0.0032, 6, 32), 0, BOWL_H, 0, Math.PI / 2),
    sOut: latheH(S_OUT, 26, S_H), sIn: latheH(S_INN, 26, S_H), sRim: T(torus(0.0648, 0.0024, 5, 26), 0, S_H, 0, Math.PI / 2),
    plate: lathe([[0, 0.004], [0.07, 0.004], [0.072, 0], [0.08, 0], [0.083, 0.006], [0.115, 0.014], [0.123, 0.02], [0.121, 0.022], [0.11, 0.017], [0.075, 0.01], [0, 0.01]], 32),
  };
  return G;
}
// 雷紋（四角いうず）
function raimon(c, x, y, sx, lw, sy = sx) {
  const P = [[0.08, 0.92], [0.08, 0.08], [0.92, 0.08], [0.92, 0.92], [0.3, 0.92], [0.3, 0.3], [0.7, 0.3], [0.7, 0.7], [0.5, 0.7], [0.5, 0.52]];
  c.lineWidth = lw; c.lineCap = 'square'; c.beginPath(); P.forEach(([u, v], i) => (i ? c.lineTo(x + u * sx, y + v * sy) : c.moveTo(x + u * sx, y + v * sy))); c.stroke();
}
const speckle = (c, w, h, n, seed, color, rmax = 1.2) => { const r = mulberry32(seed); c.fillStyle = color; for (let i = 0; i < n; i++) { c.beginPath(); c.arc(r() * w, r() * h, 0.3 + r() * rmax, 0, 7); c.fill(); } };
const bowlOutTex = () => ctex('bowlOut', 512, 256, (c, w, h) => {
  c.fillStyle = '#fbf8f1'; c.fillRect(0, 0, w, h); speckle(c, w, h, 260, 3, 'rgba(120,100,80,0.10)');
  const bh = Math.round(h * 0.3);
  c.fillStyle = '#b3201b'; c.fillRect(0, 0, w, bh);
  c.strokeStyle = '#fff4e2'; c.lineWidth = 3; c.beginPath(); c.moveTo(0, 5); c.lineTo(w, 5); c.moveTo(0, bh - 5); c.lineTo(w, bh - 5); c.stroke();
  for (let x = 0; x < w; x += 16) raimon(c, x + 2, 12, 12, 2.2, bh - 24);
  c.fillStyle = '#b3201b'; c.fillRect(0, bh + 7, w, 3); c.fillRect(0, h - 26, w, 2);
  c.fillStyle = 'rgba(150,120,90,0.25)'; c.fillRect(0, h - 14, w, 14);
}, { repeat: [1, 1] });
const bowlInTex = () => ctex('bowlIn', 512, 128, (c, w, h) => {
  c.fillStyle = '#fdfbf6'; c.fillRect(0, 0, w, h); speckle(c, w, h, 120, 5, 'rgba(120,100,80,0.08)');
  c.fillStyle = '#b3201b'; c.fillRect(0, 0, w, 16); c.strokeStyle = '#fff4e2'; for (let x = 0; x < w; x += 8) raimon(c, x + 1, 3, 6, 1.1, 10);
});
const smallOutTex = () => ctex('sOut', 512, 256, (c, w, h) => {
  c.fillStyle = '#f9f8f3'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#27407a'; c.lineWidth = 3;
  for (let row = 0; row < 7; row++) for (let x = -1; x < 18; x++) { const cx = x * 32 + (row % 2) * 16, cy = 40 + row * 26; for (let k = 0; k < 3; k++) { c.beginPath(); c.arc(cx, cy, 15 - k * 5, Math.PI, 0); c.stroke(); } }
  c.fillStyle = '#f9f8f3'; c.fillRect(0, 0, w, 26); c.fillRect(0, h - 40, w, 40);
  c.fillStyle = '#27407a'; c.fillRect(0, 18, w, 5); c.fillRect(0, h - 44, w, 4); c.fillRect(0, h - 16, w, 3);
});
const smallInTex = () => ctex('sIn', 256, 128, (c, w, h) => { c.fillStyle = '#fbfaf6'; c.fillRect(0, 0, w, h); c.fillStyle = '#27407a'; c.fillRect(0, 4, w, 3); });
export function bowlBase(g, kind) {
  const Gs = geos();
  if (kind === 'bowlS') {
    g.add(new THREE.Mesh(Gs.sOut, mat('#ffffff', { map: smallOutTex(), r: 0.22 })));
    g.add(new THREE.Mesh(Gs.sIn, mat('#ffffff', { map: smallInTex(), r: 0.22, side: THREE.BackSide })));
    g.add(new THREE.Mesh(Gs.sRim, C('#f6f4ee', { r: 0.22 })));
    return S_H;
  }
  g.add(new THREE.Mesh(Gs.bowlOut, mat('#ffffff', { map: bowlOutTex(), r: 0.2 })));
  g.add(new THREE.Mesh(Gs.bowlIn, mat('#ffffff', { map: bowlInTex(), r: 0.2, side: THREE.BackSide })));
  g.add(new THREE.Mesh(Gs.rim, C('#b3201b', { r: 0.25 })));
  return BOWL_H;
}
export function plateBase(g) {
  g.add(new THREE.Mesh(geos().plate, C('#f7f6f1', { r: 0.25 })));
  g.add(new THREE.Mesh(T(torus(0.1165, 0.0016, 4, 40), 0, 0.0172, 0, Math.PI / 2), C('#27407a', { r: 0.3 })));
}

// ---------- スープ ----------
function oilDrops(c, w, h, n, seed, fill, ring, rmin = 1.5, rmax = 7, area = 0.42) {
  const r = mulberry32(seed);
  for (let i = 0; i < n; i++) {
    const a = r() * 7, d = Math.sqrt(r()) * w * area, x = w / 2 + Math.cos(a) * d, y = h / 2 + Math.sin(a) * d, rr = rmin + Math.pow(r(), 2.2) * (rmax - rmin);
    c.fillStyle = fill; c.beginPath(); c.ellipse(x, y, rr, rr * (0.8 + r() * 0.3), r() * 3, 0, 7); c.fill();
    c.strokeStyle = ring; c.lineWidth = Math.max(0.6, rr * 0.18); c.stroke();
    c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.arc(x - rr * 0.3, y - rr * 0.3, rr * 0.22, 0, 7); c.fill();
  }
}
const SOUP_DRAW = {
  shoyu: (c, w, h) => { oilDrops(c, w, h, 70, 11, 'rgba(232,170,70,0.55)', 'rgba(255,214,140,0.5)', 1.5, 8); },
  shio: (c, w, h) => { oilDrops(c, w, h, 55, 12, 'rgba(250,215,120,0.5)', 'rgba(255,240,190,0.6)', 1.2, 6); speckle(c, w, h, 25, 4, 'rgba(70,110,40,0.5)', 1.4); },
  miso: (c, w, h) => { speckle(c, w, h, 900, 13, 'rgba(120,60,20,0.35)', 1.3); speckle(c, w, h, 300, 14, 'rgba(255,220,160,0.25)', 1.2); oilDrops(c, w, h, 40, 15, 'rgba(230,140,40,0.55)', 'rgba(255,200,120,0.5)', 1.5, 7); },
  tonkotsu: (c, w, h) => { speckle(c, w, h, 500, 16, 'rgba(255,255,255,0.55)', 1.4); oilDrops(c, w, h, 30, 17, 'rgba(240,215,150,0.45)', 'rgba(255,245,210,0.6)', 1, 4); },
  iekei: (c, w, h) => { oilDrops(c, w, h, 90, 18, 'rgba(250,190,40,0.6)', 'rgba(255,225,120,0.6)', 2, 11, 0.45); },
  tantan: (c, w, h) => { const r = mulberry32(19); for (let i = 0; i < 26; i++) { c.fillStyle = 'rgba(170,25,10,0.45)'; c.beginPath(); c.ellipse(r() * w, r() * h, 8 + r() * 22, 6 + r() * 14, r() * 3, 0, 7); c.fill(); } oilDrops(c, w, h, 50, 20, 'rgba(220,60,20,0.6)', 'rgba(255,140,80,0.5)', 1.5, 7); for (let i = 0; i < 140; i++) { c.fillStyle = r() < 0.5 ? '#f2e2bd' : '#4a2c1a'; c.beginPath(); c.ellipse(r() * w, r() * h, 1.6, 0.9, r() * 3, 0, 7); c.fill(); } },
  niboshi: (c, w, h) => { speckle(c, w, h, 1300, 21, 'rgba(60,45,30,0.4)', 1); oilDrops(c, w, h, 35, 22, 'rgba(210,170,90,0.45)', 'rgba(240,210,150,0.5)', 1.2, 5); },
  black: (c, w, h) => { oilDrops(c, w, h, 60, 23, 'rgba(120,70,30,0.55)', 'rgba(210,150,90,0.45)', 1.5, 8); speckle(c, w, h, 400, 24, 'rgba(10,8,6,0.7)', 1.1); },
};
const soupTex = (k) => ctex('soup|' + k, 256, 256, (c, w, h) => {
  const b = SOUPS[k].color, gr = c.createRadialGradient(w * 0.45, h * 0.42, 8, w / 2, h / 2, w / 2);
  gr.addColorStop(0, shade(b, 0.08)); gr.addColorStop(0.7, b); gr.addColorStop(1, shade(b, -0.1));
  c.fillStyle = gr; c.fillRect(0, 0, w, h); (SOUP_DRAW[k] || SOUP_DRAW.shoyu)(c, w, h);
});
function soupDisc(g, k, y, r) { if (!SOUPS[k]) return; g.add(new THREE.Mesh(T(disc(r, 32), 0, y, 0), mat('#ffffff', { map: soupTex(k), r: 0.1 }))); }

// ---------- 麺 ----------
const NOODLE_COL = { katame: ['#f2d47c', '#e8c35c'], futsu: ['#f3da8e', '#ebcb6d'], yawa: ['#f5e2a8', '#efd690'], over: ['#f6ead0', '#f0e2bd'], raw: ['#f4dd98', '#e9cf78'] };
export const noodleState = (sec) => (sec == null ? 'none' : sec > 42 ? 'over' : sec < (HARD.katame.t[1]) ? 'katame' : sec > HARD.yawa.t[0] ? 'yawa' : 'futsu');
// 整えた麺線（スープの上に平行に並べる）。R=スープの半径
function neatNoodles(R, n, state, seed = 1) {
  const r = mulberry32(seed), parts = [], [c0, c1] = NOODLE_COL[state] || NOODLE_COL.futsu, A = col(c0), B = col(c1), th = state === 'over' ? 0.0026 : 0.0021, Rn = R * 0.86;
  for (let j = 0; j < n; j++) {
    const z = -0.5 * R + (j + 0.5) / n * 1.05 * R, L = Math.sqrt(Math.max(0, Rn * Rn - z * z)) * 0.97;
    if (L < 0.015) continue;
    const pts = [], ph = r() * 6;
    for (let i = 0; i <= 10; i++) { const t = i / 10, x = -L + 2 * L * t, dome = 1 - (x * x + z * z) / (Rn * Rn); pts.push(new THREE.Vector3(x, (i === 0 || i === 10) ? -0.005 : 0.0012 * Math.sin(t * 15 + ph) + 0.006 * dome - 0.0005, z + 0.0035 * Math.sin(t * 9 + ph * 1.7))); }
    const tg = new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 22, th, 4, false);
    const cc = A.clone().lerp(B, r()); parts.push(vcolor(tg, cc));
  }
  return parts.length ? merge(parts, true) : null;
}
// からまった麺（てぼの中・生麺）
function tangledNoodles(R, H, n, state, seed = 3) {
  const r = mulberry32(seed), parts = [], [c0, c1] = NOODLE_COL[state] || NOODLE_COL.raw, A = col(c0), B = col(c1);
  for (let j = 0; j < n; j++) {
    const pts = [], ph = r() * 6, ph2 = r() * 6;
    for (let i = 0; i <= 12; i++) { const t = i / 12, a = t * 9 + ph, rr = R * (0.35 + 0.6 * Math.abs(Math.sin(t * 5 + ph2))); pts.push(new THREE.Vector3(Math.cos(a) * rr, H * (0.15 + 0.7 * (0.5 + 0.5 * Math.sin(t * 7 + ph))), Math.sin(a) * rr)); }
    parts.push(vcolor(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 30, 0.0021, 4, false), A.clone().lerp(B, r())));
  }
  return merge(parts, true);
}

// ---------- トッピングの部品 ----------
const chashuTex = () => ctex('chashu', 256, 256, (c, w, h) => {
  const cx = w / 2, cy = h / 2, R = w / 2;
  c.fillStyle = '#5e2c12'; c.beginPath(); c.arc(cx, cy, R, 0, 7); c.fill();
  const g = c.createRadialGradient(cx, cy, 10, cx, cy, R - 12); g.addColorStop(0, '#e2b190'); g.addColorStop(1, '#c98a62'); c.fillStyle = g; c.beginPath(); c.arc(cx, cy, R - 12, 0, 7); c.fill();
  c.strokeStyle = 'rgba(248,232,205,0.95)'; c.lineWidth = 11; c.beginPath(); for (let a = 0.6; a < 15.5; a += 0.1) { const rr = 6 + a * 7.2; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92); } c.stroke();
  c.strokeStyle = 'rgba(150,80,45,0.5)'; c.lineWidth = 3; c.beginPath(); for (let a = 2; a < 15.5; a += 0.1) { const rr = 14 + a * 7.2; c.lineTo(cx + Math.cos(a) * rr, cy + Math.sin(a) * rr * 0.92); } c.stroke();
  const r = mulberry32(7); c.strokeStyle = 'rgba(120,60,30,0.25)'; c.lineWidth = 1; for (let i = 0; i < 160; i++) { const a = r() * 7, d = r() * (R - 16); c.beginPath(); c.moveTo(cx + Math.cos(a) * d, cy + Math.sin(a) * d); c.lineTo(cx + Math.cos(a + 0.2) * d, cy + Math.sin(a + 0.2) * d); c.stroke(); }
  c.strokeStyle = 'rgba(60,25,8,0.9)'; c.lineWidth = 9; c.beginPath(); c.arc(cx, cy, R - 7, 0, 7); c.stroke();
});
const eggTex = () => ctex('egg', 128, 128, (c, w, h) => {
  const cx = w / 2, cy = h / 2;
  c.fillStyle = '#d29a5c'; c.beginPath(); c.arc(cx, cy, 64, 0, 7); c.fill();
  c.fillStyle = '#fbf5e6'; c.beginPath(); c.arc(cx, cy, 57, 0, 7); c.fill();
  const g = c.createRadialGradient(cx - 6, cy - 6, 2, cx, cy, 34); g.addColorStop(0, '#ff9e1a'); g.addColorStop(0.55, '#f28a0c'); g.addColorStop(0.85, '#f6b33c'); g.addColorStop(1, '#f9d27a');
  c.fillStyle = g; c.beginPath(); c.arc(cx, cy, 34, 0, 7); c.fill();
  c.fillStyle = 'rgba(255,255,255,0.55)'; c.beginPath(); c.ellipse(cx - 10, cy - 12, 9, 5, -0.6, 0, 7); c.fill();
});
const noriTex = () => ctex('nori', 128, 128, (c, w, h) => {
  c.fillStyle = '#16231a'; c.fillRect(0, 0, w, h); const r = mulberry32(9);
  for (let i = 0; i < 500; i++) { c.strokeStyle = r() < 0.5 ? 'rgba(40,70,45,0.5)' : 'rgba(5,10,8,0.6)'; c.lineWidth = 0.8 + r() * 1.2; const x = r() * w, y = r() * h, a = r() * 7, l = 3 + r() * 9; c.beginPath(); c.moveTo(x, y); c.lineTo(x + Math.cos(a) * l, y + Math.sin(a) * l); c.stroke(); }
});
const narutoTex = () => ctex('naruto', 128, 128, (c, w, h) => {
  c.fillStyle = '#fffaf4'; c.fillRect(0, 0, w, h);
  c.strokeStyle = '#ee5a89'; c.lineWidth = 8; c.lineCap = 'round'; c.beginPath(); for (let a = 0; a < 14.5; a += 0.12) { const rr = 2 + a * 3.6; c.lineTo(64 + Math.cos(a) * rr, 64 + Math.sin(a) * rr); } c.stroke();
});
const riceTex = () => ctex('rice', 256, 256, (c, w, h) => {
  c.fillStyle = '#f7f6f0'; c.fillRect(0, 0, w, h); const r = mulberry32(31);
  for (let i = 0; i < 1100; i++) { const x = r() * w, y = r() * h, a = r() * 7; c.fillStyle = 'rgba(120,110,90,0.5)'; c.beginPath(); c.ellipse(x + 1, y + 1, 4.4, 2.2, a, 0, 7); c.fill(); c.fillStyle = r() < 0.2 ? '#ffffff' : '#fbfaf5'; c.beginPath(); c.ellipse(x, y, 4, 1.9, a, 0, 7); c.fill(); }
});
function wavyCyl(r, h, amp, k, seg = 48) { // 縁が波打った円柱（なると）
  const g = cyl(r, r, h, seg), p = g.attributes.position;
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z); if (d < 1e-5) continue; const f = 1 + amp * Math.cos(k * Math.atan2(z, x)); p.setXYZ(i, x * f, p.getY(i), z * f); }
  g.computeVertexNormals(); return g;
}
const PIECE = {
  chashu(r, s = 1) {
    const g = new THREE.Group(), R = 0.031 * s, th = 0.006 * s;
    g.add(new THREE.Mesh(cyl(R, R, th, 28, true), C('#6a3216', { r: 0.45 })));
    g.add(new THREE.Mesh(T(disc(R, 28), 0, th, 0), mat('#ffffff', { map: chashuTex(), r: 0.38 })));
    g.add(new THREE.Mesh(T(disc(R, 28), 0, 0, 0, Math.PI), C('#a8603a')));
    return g;
  },
  ajitama() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(T(lowHemi(18, 8), 0, 0, 0, 0, 0, 0, 0.02, 0.017, 0.028), C('#c88a50', { r: 0.3 })));
    g.add(new THREE.Mesh(T(new THREE.CircleGeometry(1, 32).rotateX(-Math.PI / 2), 0, 0.0004, 0, 0, 0, 0, 0.02, 1, 0.028), mat('#ffffff', { map: eggTex(), r: 0.22 })));
    return g;
  },
  nori() { const g = new THREE.Group(); g.add(new THREE.Mesh(box(0.066, 0.078, 0.0016), mat('#ffffff', { map: noriTex(), r: 0.55 }))); return g; },
  menma(r) {
    const ps = []; for (let i = 0; i < 6; i++) ps.push(tint(T(rbox(0.0085, 0.0045, 0.044 - (i % 2) * 0.006, 0.0018), (i - 2.5) * 0.0072, (i % 2) * 0.0035, (r() - 0.5) * 0.006, 0, (r() - 0.5) * 0.25), ['#c9973f', '#d4a54e', '#bd8935'][i % 3]));
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.42 }))); return g;
  },
  negi(r, n = 26, R = 0.022) {
    const ps = []; for (let i = 0; i < n; i++) { const a = r() * 7, d = Math.sqrt(r()) * R; ps.push(tint(T(torus(0.0033, 0.0012, 4, 8), Math.cos(a) * d, 0.0015 + (1 - d / R) * 0.005 + r() * 0.002, Math.sin(a) * d, Math.PI / 2 + (r() - 0.5) * 0.8, 0, r() * 3), r() < 0.72 ? (r() < 0.5 ? '#86c751' : '#9bd466') : '#e4f1c6')); }
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.4 }))); return g;
  },
  naruto() {
    const g = new THREE.Group(), w = wavyCyl(0.021, 0.0045, 0.05, 16);
    g.add(new THREE.Mesh(w, C('#fffaf3', { r: 0.35 })));
    const top = new THREE.CircleGeometry(0.021, 48), p = top.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i); const d = Math.hypot(x, y); if (d < 1e-5) continue; const f = 1 + 0.05 * Math.cos(16 * Math.atan2(-y, x)); p.setXY(i, x * f, y * f); }
    top.rotateX(-Math.PI / 2); g.add(new THREE.Mesh(T(top, 0, 0.0046, 0), mat('#ffffff', { map: narutoTex(), r: 0.35 })));
    return g;
  },
  spinach(r) {
    const ps = []; const greens = ['#2f6b2a', '#3c7a30', '#28592a', '#356f2c'];
    for (let i = 0; i < 6; i++) ps.push(tint(T(sph(1, 10, 6), (r() - 0.5) * 0.02, 0.003 + i * 0.0015, (r() - 0.5) * 0.016, (r() - 0.5) * 0.4, r() * 3, (r() - 0.5) * 0.4, 0.016, 0.0035, 0.01), greens[i % 4]));
    for (let i = 0; i < 3; i++) ps.push(tint(T(cyl(0.0016, 0.0016, 0.026, 5), (r() - 0.5) * 0.012, 0.006, (r() - 0.5) * 0.01, Math.PI / 2, r() * 3, 0), '#86b456'));
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.4 }))); return g;
  },
  corn(r, n = 34, R = 0.023) {
    const ps = []; for (let i = 0; i < n; i++) { const a = r() * 7, d = Math.sqrt(r()) * R; ps.push(tint(T(sph(0.0042, 6, 4), Math.cos(a) * d, 0.003 + (1 - (d / R) ** 2) * 0.009 + r() * 0.002, Math.sin(a) * d, r(), r(), 0, 1, 0.8, 1.15), r() < 0.6 ? '#f7c62c' : '#fad75a')); }
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.3 }))); return g;
  },
  butter() { const g = new THREE.Group(); g.add(new THREE.Mesh(rbox(0.024, 0.009, 0.019, 0.003), C('#fbe6a0', { r: 0.25 }))); g.add(new THREE.Mesh(T(disc(0.017, 18), 0, -0.0005, 0, 0, 0, 0, 1.2, 1, 1), mat('#f6d978', { r: 0.1, t: true, op: 0.7 }))); return g; },
  moyashi(r, n = 40, R = 0.03, H = 0.022) {
    const ps = []; for (let i = 0; i < n; i++) { const a = r() * 7, d = Math.sqrt(r()) * R, y = 0.002 + (1 - (d / R) ** 2) * H * (0.4 + r() * 0.6), ry = r() * 6, tl = (r() - 0.5) * 0.5; ps.push(tint(T(cyl(0.0016, 0.0013, 0.036, 5), Math.cos(a) * d, y, Math.sin(a) * d, tl, ry, Math.PI / 2), r() < 0.5 ? '#f5f2e3' : '#ece8d2')); ps.push(tint(T(sph(0.0025, 5, 4), Math.cos(a) * d + Math.cos(ry) * 0.018, y, Math.sin(a) * d - Math.sin(ry) * 0.018), '#e9dc8c')); }
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.4 }))); return g;
  },
  seabura(r, n = 45, R = 0.08) {
    const ps = []; for (let i = 0; i < n; i++) { const a = r() * 7, d = Math.sqrt(r()) * R, s = 0.0024 + r() * 0.0022; ps.push(T(sph(s, 5, 4), Math.cos(a) * d, 0.0008, Math.sin(a) * d, 0, r() * 3, 0, 1.2, 0.55, 1)); }
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps), C('#fcf8ef', { r: 0.25 }))); return g;
  },
  karamiso() { const g = new THREE.Group(); g.add(new THREE.Mesh(lathe([[0, 0.014], [0.004, 0.0135], [0.009, 0.011], [0.014, 0.006], [0.0175, 0.0015], [0.018, 0]], 20), C('#b3221a', { r: 0.32 }))); return g; },
  kikurage(r) {
    const ps = []; for (let i = 0; i < 7; i++) ps.push(tint(T(sph(1, 10, 6), (r() - 0.5) * 0.022, 0.002 + i * 0.0016, (r() - 0.5) * 0.016, (r() - 0.5) * 0.5, r() * 3, (r() - 0.5) * 0.6, 0.016, 0.0018, 0.0055), i % 2 ? '#2a1b16' : '#3a2820'));
    const g = new THREE.Group(); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.28 }))); return g;
  },
};
const place = (g, o, x, y, z, rx = 0, ry = 0, rz = 0) => { o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
// トッピングの位置（スープの半径に対する割合）。いつも同じ並びになる
const SPOT = { chashu: [0.38, -0.32], ajitama: [-0.5, 0.28], nori: [0.0, -0.8], menma: [-0.46, -0.3], negi: [0.02, 0.12], naruto: [0.48, 0.36], spinach: [-0.2, -0.55], corn: [0.02, 0.46], butter: [0.06, 0.42], moyashi: [0, 0], karamiso: [0.04, -0.06], kikurage: [0.58, 0.02] };
function toppings(g, list, y, R, seed) {
  const r = mulberry32(seed), has = (t) => list.includes(t), lift = has('moyashi') ? 0.016 : 0;
  for (const tid of list) {
    const [sx, sz] = SPOT[tid] || [0, 0], x = sx * R, z = sz * R;
    switch (tid) {
      case 'chashu': place(g, PIECE.chashu(r), x + 0.012, y + 0.006, z - 0.006, 0.55, 0.3, -0.12); place(g, PIECE.chashu(r), x - 0.008, y + 0.004, z + 0.012, 0.42, -0.4, 0.1); break;
      case 'ajitama': place(g, PIECE.ajitama(), x, y + 0.008, z, 0.45, 0.5, 0); break;
      case 'nori': place(g, PIECE.nori(), x, y - 0.03, z, -0.33, 0.12, 0); break;
      case 'menma': place(g, PIECE.menma(r), x, y + 0.002, z, 0.25, 0.7, 0); break;
      case 'negi': place(g, PIECE.negi(r), x, y + 0.004 + lift, z); break;
      case 'naruto': place(g, PIECE.naruto(), x, y + 0.004, z, 0.45, 0, -0.1); break;
      case 'spinach': place(g, PIECE.spinach(r), x, y + 0.001, z, 0.2, 0, 0); break;
      case 'corn': place(g, PIECE.corn(r), x, y + 0.001, z); break;
      case 'butter': place(g, PIECE.butter(), x, y + (has('corn') ? 0.012 : 0.003), z, 0.25, 0.5, 0); break;
      case 'moyashi': place(g, PIECE.moyashi(r), x, y + 0.002, z); break;
      case 'seabura': place(g, PIECE.seabura(r, 45, R * 0.8), 0, y + 0.0035, 0); break;
      case 'karamiso': place(g, PIECE.karamiso(), x, y + 0.006 + lift, z, 0.2, 0, 0); break;
      case 'kikurage': place(g, PIECE.kikurage(r), x, y + 0.002, z, 0.2, 0, 0); break;
      default: break;
    }
  }
}

// ---------- サイド ----------
function gyozaGeo(stage, seed) {
  const g = new THREE.SphereGeometry(1, 22, 12), p = g.attributes.position;
  const pale = col('#f2e5c6'), brown = col(['#f2e5c6', '#ead09a', '#d39a4c', '#9c5f2a', '#2b1a10'][stage]), dark = col(stage >= 4 ? '#150c06' : '#8a5022'), tmp = new THREE.Color();
  const ny = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i); ny[i] = y; const pl = y < 0 ? 0.0012 * Math.max(0, Math.sin(x * 22)) * (-y) : 0; p.setXYZ(i, x * 0.036, (y > 0 ? y * 0.008 : y * 0.015) + pl, z * 0.016 - 0.009 * (1 - x * x)); }
  g.computeVertexNormals();
  return paint(g, (x, y, z, i) => { const t = Math.max(0, Math.min(1, (ny[i] - 0.05) / 0.45)); tmp.copy(pale).lerp(brown, t); const sp = Math.max(0, wob(x * 40, y * 40, z * 40, seed) - 0.15) * t * 1.6; return tmp.lerp(dark, Math.min(0.8, sp)).clone(); });
}
function karaageGeo(seed, colHex) {
  const g = new THREE.SphereGeometry(1, 18, 12), p = g.attributes.position, base = col(colHex), hi = col(shade(colHex, 0.12)), lo = col(shade(colHex, -0.14)), tmp = new THREE.Color(), bump = new Float32Array(p.count);
  for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), b = 1 + 0.2 * wob(x * 1.6, y * 1.6, z * 1.6, seed) + 0.07 * Math.sin(x * 19 + seed) * Math.sin(y * 17) * Math.sin(z * 21); bump[i] = b; p.setXYZ(i, x * 0.022 * b, y * 0.018 * b, z * 0.024 * b); }
  g.computeVertexNormals();
  return paint(g, (x, y, z, i) => { const k = (bump[i] - 1) * 4; return tmp.copy(base).lerp(k > 0 ? hi : lo, Math.min(1, Math.abs(k))).clone(); });
}
const beerTex = () => ctex('beer', 64, 256, (c, w, h) => { const g = c.createLinearGradient(0, 0, 0, h); g.addColorStop(0, '#f7b52c'); g.addColorStop(1, '#d9800c'); c.fillStyle = g; c.fillRect(0, 0, w, h); speckle(c, w, h, 160, 41, 'rgba(255,250,220,0.65)', 1); });

// ---------- ラーメン丼（タレ → だし → 麺 → トッピング） ----------
function buildBowl(outer, g, d, frac) {
  bowlBase(g, 'bowl');
  const tex = d.soup || (d.broth ? BROTHS[d.broth]?.tex : null);
  if (tex) {
    const lv = frac > 0.92 ? 0.22 : 1 - frac * 0.55, y = 0.02 + (BOWL_H - 0.033) * lv, R = innerR(INN, y) - 0.0015;
    soupDisc(g, tex, y, R);
    if (!d.tare && d.broth) g.add(new THREE.Mesh(T(disc(R * 0.98, 28), 0, y + 0.0004, 0), mat('#ffffff', { r: 0.1, t: true, op: 0.25 })));
    if (d.men != null && frac < 0.85) { const n = Math.max(3, Math.round(20 * (1 - frac * 1.05))), ng = neatNoodles(R, n, noodleState(d.men), 5); if (ng) g.add(new THREE.Mesh(T(ng, 0, y, 0), VC({ r: 0.42 }))); }
    const tp = (d.tp || []).filter((t, i) => frac < 0.25 + 0.5 * ((i + 1) / ((d.tp || []).length + 1)));
    toppings(g, tp, y + (d.men != null ? 0.004 : 0), R, 7);
  } else if (d.tare) {
    // タレだけ：底に少したまっている
    g.add(new THREE.Mesh(T(disc(0.05, 24), 0, 0.0155, 0), mat(TARES[d.tare]?.color || '#3a1c0b', { r: 0.08 })));
  } else if (d.men != null) {
    const ng = tangledNoodles(0.05, 0.02, 12, noodleState(d.men), 9); g.add(new THREE.Mesh(T(ng, 0, 0.012, 0), VC({ r: 0.42 })));
  }
  return bakeGroup(outer);
}
// ---------- 料理1つぶん ----------
function build(d, frac) {
  const g = new THREE.Group();
  if (d.k === 'bowl') {
    const outer = g, gb = new THREE.Group(); gb.scale.setScalar(BOWL_SCALE); outer.add(gb);
    return buildBowl(outer, gb, d, frac);
  } else if (d.k === 'bowlS') {
    bowlBase(g, 'bowlS');
    if (d.side === 'rice' && frac < 0.9) {
      const top = 0.08 - frac * 0.04;
      g.add(new THREE.Mesh(T(hemi(1, 24, 10), 0, 0.03, 0, 0, 0, 0, 0.0615, top - 0.03, 0.0615), mat('#ffffff', { map: riceTex(), r: 0.65 })));
      if ((d.tp || []).length && frac < 0.5) {
        const r = mulberry32(11), yy = top - 0.004;
        if (d.tp.includes('chashu')) { place(g, PIECE.chashu(r, 0.8), -0.018, yy - 0.004, 0.004, 0.35, 0.2, 0.15); place(g, PIECE.chashu(r, 0.8), 0.016, yy - 0.004, -0.006, 0.3, -0.4, -0.2); place(g, PIECE.chashu(r, 0.8), 0, yy - 0.002, 0.02, 0.5, 0.1, 0); g.add(new THREE.Mesh(T(disc(0.03, 20), 0, yy + 0.003, 0.004, 0.3), mat('#6b3414', { r: 0.1, t: true, op: 0.55 }))); }
        const rest = d.tp.filter((t) => t !== 'chashu'); toppings(g, rest, yy, 0.045, 12);
      }
    }
  } else if (d.k === 'plate') {
    plateBase(g);
    const n = frac > 0.9 ? 0 : d.side === 'gyoza' ? Math.max(1, Math.round(6 * (1 - frac))) : d.side === 'karaage' ? Math.max(1, Math.round(5 * (1 - frac))) : 0;
    if (d.side === 'gyoza') {
      const st = d.burnt ? 4 : (d.q ?? 80) >= 70 ? 2 : 1;
      for (let i = 0; i < n; i++) place(g, new THREE.Mesh(gyozaGeo(st, i), VC({ r: 0.5 })), -0.068 + i * 0.027, 0.024, 0.008 * Math.sin(i * 1.3), 0, Math.PI / 2 + 0.3 + Math.sin(i) * 0.06, 0);
    } else if (d.side === 'karaage') {
      const c0 = d.burnt ? '#3a200e' : (d.q ?? 80) >= 70 ? '#b5651f' : '#c98a48', r = mulberry32(13);
      if (n) { const ps = []; for (let i = 0; i < 26; i++) ps.push(tint(T(box(0.034, 0.0012, 0.0028), -0.035 + (r() - 0.5) * 0.04, 0.014 + r() * 0.012, -0.03 + (r() - 0.5) * 0.03, r() * 0.5, r() * 6, r() * 0.4), r() < 0.5 ? '#d5eba9' : '#eef6d6')); g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.5 }))); }
      const spots = [[-0.03, -0.01], [0.012, -0.022], [0.04, 0.004], [-0.008, 0.026], [0.028, 0.034]];
      for (let i = 0; i < n; i++) { const m = new THREE.Mesh(karaageGeo(i * 1.7 + 1, c0), VC({ r: 0.55 })); m.position.set(spots[i][0], 0.03 + (i === 0 ? 0.008 : 0), spots[i][1]); m.rotation.set(r(), r() * 6, r()); g.add(m); }
      if (n) { const lw = new THREE.Group(); lw.add(new THREE.Mesh(cyl(0.022, 0.022, 0.016, 14, false, 0, Math.PI * 0.55), C('#f2d43c', { r: 0.35 }))); place(g, lw, 0.06, 0.016, 0.045, 0, 0.6, Math.PI / 2); }
    }
  } else if (d.k === 'mug') {
    const glass = mat('#eef7ff', { r: 0.04, t: true, op: 0.24, side: THREE.DoubleSide });
    g.add(new THREE.Mesh(lathe([[0.034, 0], [0.041, 0.002], [0.043, 0.012], [0.043, 0.15], [0.0405, 0.15], [0.0395, 0.018], [0, 0.018]], 24), glass));
    g.add(new THREE.Mesh(T(torus(0.032, 0.0075, 6, 14, Math.PI), 0.045, 0.082, 0, 0, 0, -Math.PI / 2, 0.8, 1, 1), glass));
    if (d.side === 'beer') {
      const f = Math.min(1.1, (d.fill || 0) * (1 - frac)), foam = Math.min(0.3, 0.1 + f * 0.2) * f, beer = Math.max(0, f - foam) * 0.128;
      if (beer > 0.002) g.add(new THREE.Mesh(T(cyl(0.0392, 0.0392, beer, 20), 0, 0.018), mat('#ffffff', { map: beerTex(), r: 0.12, t: true, op: 0.88 })));
      if (f > 0.02) { const fh = foam * 0.128 + 0.004, b = 0.018 + beer; g.add(new THREE.Mesh(lathe([[0.0392, b], [0.0395, b + fh], [0.034, b + fh + 0.004], [0.018, b + fh + 0.007], [0, b + fh + 0.008]], 20), C('#fffbf1', { r: 0.9 }))); }
      if ((d.fill || 0) > 1.08) g.add(new THREE.Mesh(T(sph(0.03, 10, 6), 0, 0.155, 0, 0, 0, 0, 1.3, 0.45, 1.3), C('#fffbf1', { r: 0.9 })));
    }
  }
  return bakeGroup(g);
}
export function dishKey(d, frac = 0) {
  const fb = Math.round(frac * 10);
  return [d.k, d.soup || '', d.broth || '', d.tare || '', d.side || '', noodleState(d.men), (d.tp || []).join('.'), d.k === 'mug' ? Math.round((d.fill || 0) * 20) : 0, d.burnt ? 1 : 0, d.k === 'plate' && (d.q ?? 80) >= 70 ? 1 : 0, fb].join('|');
}
const cache = new Map();
const cached = (k, make) => { let g = cache.get(k); if (!g) { g = make(); cache.set(k, g); if (cache.size > 400) cache.delete(cache.keys().next().value); } return g.clone(); };
export function dishMesh(d, frac = 0) { const k = dishKey(d, frac), o = cached(k, () => build(d, frac)); o.userData.key = k; return o; }
// 下げた食器（重ねた丼・皿）
export function cleanMesh(list) { return dirtyMesh(list, true); }
export function dirtyMesh(list, clean = false) {
  return cached((clean ? 'clean|' : 'dirty|') + list.join(','), () => {
    const grp = new THREE.Group(); let y = 0;
    list.forEach((kind, i) => {
      const s = new THREE.Group();
      if (kind === 'plate') { plateBase(s); if (!clean) s.add(new THREE.Mesh(T(disc(0.05, 16), 0.01, 0.0105, 0), mat('#c89a5a', { r: 0.2, t: true, op: 0.35 }))); }
      else if (kind === 'mug') { s.add(new THREE.Mesh(lathe([[0.034, 0], [0.041, 0.002], [0.043, 0.012], [0.043, 0.15], [0.0405, 0.15], [0.0395, 0.018], [0, 0.018]], 16), mat('#eef7ff', { r: 0.05, t: true, op: 0.3, side: THREE.DoubleSide }))); if (!clean) s.add(new THREE.Mesh(T(cyl(0.039, 0.039, 0.012, 14), 0, 0.018), C('#fff6dc', { r: 0.9 }))); }
      else { bowlBase(s, kind); if (!clean) s.add(new THREE.Mesh(T(disc(kind === 'bowlS' ? 0.03 : 0.045, 20), 0, kind === 'bowlS' ? 0.0125 : 0.0155, 0), mat('#8a5a30', { r: 0.15, t: true, op: 0.6 }))); if (kind === 'bowl') s.scale.setScalar(BOWL_SCALE); }
      s.position.set((i % 2) * 0.008, y, 0); s.rotation.y = i * 0.7;
      y += kind === 'plate' ? 0.014 : kind === 'mug' ? 0.155 : kind === 'bowlS' ? 0.03 : 0.04 * BOWL_SCALE;
      grp.add(s);
    });
    return bakeGroup(grp);
  });
}
// 手に持つ道具
export function toolMesh(kind) {
  if (kind === 'cash') return cashMesh(30000);
  return cached('tool|' + kind, () => {
    const grp = new THREE.Group();
    if (kind === 'ext') {
      grp.add(new THREE.Mesh(T(cyl(0.055, 0.055, 0.3, 20), 0, -0.16), C('#d62828', { r: 0.3 })));
      grp.add(new THREE.Mesh(T(hemi(0.055, 18, 6), 0, 0.14), C('#d62828', { r: 0.3 })));
      grp.add(new THREE.Mesh(T(cyl(0.016, 0.02, 0.03, 10), 0, 0.185), C('#c9c9c9', { r: 0.3, m: 0.8 })));
      grp.add(new THREE.Mesh(T(rbox(0.026, 0.02, 0.11, 0.006), 0, 0.205, 0.02), C('#222', { r: 0.5 })));
      grp.add(new THREE.Mesh(T(rbox(0.024, 0.012, 0.09, 0.004), 0, 0.232, 0.01, -0.25), C('#333', { r: 0.5 })));
      grp.add(new THREE.Mesh(T(cyl(0.008, 0.008, 0.14, 8), 0.04, 0.12, 0.04, 0.5, 0, 0.3), C('#111', { r: 0.6 })));
      grp.add(new THREE.Mesh(T(cyl(0.0565, 0.0565, 0.09, 20, true), 0, -0.12), mat('#ffffff', { map: extTex(), r: 0.5 })));
    } else if (kind === 'shuri') {
      const s = new THREE.Shape();
      for (let i = 0; i <= 8; i++) { const a = i / 8 * Math.PI * 2, r = i % 2 ? 0.016 : 0.06; if (i) s.lineTo(Math.cos(a) * r, Math.sin(a) * r); else s.moveTo(Math.cos(a) * r, Math.sin(a) * r); }
      const geo = new THREE.ExtrudeGeometry(s, { depth: 0.004, bevelEnabled: false });
      grp.add(new THREE.Mesh(geo, C('#9aa3ab', { r: 0.22, m: 0.9 })));
      grp.add(new THREE.Mesh(T(cyl(0.011, 0.011, 0.007, 14), 0, -0.0015, 0.002, Math.PI / 2), C('#2b2f33', { r: 0.4 })));
    }
    return bakeGroup(grp);
  });
}
const extTex = () => ctex('ext', 256, 64, (c, w, h) => { c.fillStyle = '#d62828'; c.fillRect(0, 0, w, h); c.fillStyle = '#ffffff'; c.fillRect(w * 0.3, 6, w * 0.4, h - 12); c.fillStyle = '#d62828'; c.font = '900 30px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('消火器', w / 2, h / 2 + 1); });
const meshTex = () => ctex('tebo', 128, 128, (c, w, h) => { c.clearRect(0, 0, w, h); c.strokeStyle = '#d7dce0'; c.lineWidth = 2; for (let x = 0; x <= w; x += 8) { c.beginPath(); c.moveTo(x, 0); c.lineTo(x, h); c.stroke(); } for (let y = 0; y <= h; y += 8) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }, { repeat: [6, 2] });
// 茹で麺機の「てぼ」（中に麺）
export function basketMesh(on, sec) {
  const st = on ? noodleState(sec) : 'x';
  return cached('teb|' + st, () => {
    const grp = new THREE.Group(), steel = C('#cfd4d8', { r: 0.28, m: 0.85 });
    grp.add(new THREE.Mesh(T(cyl(0.085, 0.075, 0.16, 20, true), 0, -0.1), mat('#ffffff', { map: meshTex(), r: 0.35, m: 0.7, side: THREE.DoubleSide, t: true, op: 1 })));
    grp.add(new THREE.Mesh(T(disc(0.075, 20), 0, -0.099), mat('#ffffff', { map: meshTex(), r: 0.35, m: 0.7, side: THREE.DoubleSide, t: true })));
    grp.add(new THREE.Mesh(T(torus(0.085, 0.005, 5, 22), 0, 0.06, 0, Math.PI / 2), steel));
    grp.add(new THREE.Mesh(T(cyl(0.007, 0.007, 0.1, 6), 0.0, 0.07, -0.085, -1.1), steel));
    grp.add(new THREE.Mesh(T(cyl(0.011, 0.011, 0.2, 8), 0.0, 0.11, -0.16, -1.1), C('#3b2a20', { r: 0.6 })));
    if (on) grp.add(new THREE.Mesh(T(tangledNoodles(0.062, 0.07, 14, st, 4), 0, -0.098, 0), VC({ r: 0.42 })));
    return bakeGroup(grp);
  });
}
export function grillFood(type, sec) {
  const stage = Math.min(4, Math.floor(sec / 8));
  return cached('grill|' + type + '|' + stage, () => {
    const grp = new THREE.Group();
    if (type === 'gyoza') for (let i = 0; i < 6; i++) { const m = new THREE.Mesh(gyozaGeo(stage, i), VC({ r: 0.5 })); m.position.set(-0.1 + i * 0.04, 0.006, 0); m.rotation.set(Math.PI, Math.PI / 2, 0); grp.add(m); }
    else { const c0 = ['#ead2a0', '#d9a55e', '#b8692a', '#7a3e18', '#2b160a'][stage]; for (let i = 0; i < 4; i++) { const m = new THREE.Mesh(karaageGeo(i * 2.3, c0), VC({ r: 0.55 })); m.position.set(-0.07 + i * 0.047, 0.01, (i % 2) * 0.025); m.rotation.set(i, i * 2, 0); grp.add(m); } }
    return bakeGroup(grp);
  });
}
// ---------- 仕込んだトッピングの山（トッピング台の容器・パソコンの絵） ----------
const mound = (g, c, R, h) => g.add(new THREE.Mesh(T(hemi(1, 16, 6), 0, 0, 0, 0, 0, 0, R, h, R), C(c, { r: 0.55 })));
function pile(tid, f) {
  const g = new THREE.Group(), r = mulberry32(tid.length * 31 + 7), n = (k) => Math.max(1, Math.round(k * f));
  switch (tid) {
    case 'chashu': for (let i = 0; i < n(8); i++) place(g, PIECE.chashu(r), -0.03 + (i % 4) * 0.02, 0.004 + Math.floor(i / 4) * 0.008, -0.022 + Math.floor(i / 4) * 0.04, 0.6, 0, 0); break;
    case 'ajitama': for (let i = 0; i < n(6); i++) place(g, PIECE.ajitama(), -0.03 + (i % 3) * 0.03, 0.016, -0.025 + Math.floor(i / 3) * 0.045, 0.15, 0.3, 0); break;
    case 'nori': for (let i = 0; i < n(8); i++) place(g, PIECE.nori(), -0.004 * i, 0.04 + i * 0.002, 0.035 - 0.004 * i, -Math.PI / 2, 0.18 * i - 0.5, 0); break;
    case 'menma': for (let i = 0; i < n(4); i++) place(g, PIECE.menma(r), -0.022 + (i % 2) * 0.044, 0.002 + Math.floor(i / 2) * 0.006, -0.018 + Math.floor(i / 2) * 0.03, 0, 0.3 * i, 0); break;
    case 'negi': mound(g, '#7cbf4a', 0.042, 0.012 * f + 0.004); place(g, PIECE.negi(r, n(90), 0.042), 0, 0.008 * f, 0); break;
    case 'naruto': for (let i = 0; i < n(8); i++) place(g, PIECE.naruto(), -0.036 + (i % 4) * 0.024, 0.006 + Math.floor(i / 4) * 0.004, -0.02 + Math.floor(i / 4) * 0.04, 0.35, 0, 0); break;
    case 'spinach': for (let i = 0; i < n(4); i++) place(g, PIECE.spinach(r), -0.02 + (i % 2) * 0.04, 0, -0.02 + Math.floor(i / 2) * 0.04); break;
    case 'corn': mound(g, '#f2c12a', 0.04, 0.01 * f + 0.003); place(g, PIECE.corn(r, n(90), 0.042), 0, 0.006 * f, 0); break;
    case 'butter': for (let i = 0; i < n(4); i++) place(g, PIECE.butter(), -0.025 + (i % 2) * 0.05, 0.005, -0.02 + Math.floor(i / 2) * 0.04, 0, 0.2, 0); break;
    case 'moyashi': mound(g, '#efe9cf', 0.045, 0.016 * f + 0.004); place(g, PIECE.moyashi(r, n(90), 0.048, 0.04), 0, 0.004, 0); break;
    case 'seabura': { const m = PIECE.seabura(r, n(110), 0.045); g.add(m); g.add(new THREE.Mesh(T(hemi(0.04, 14, 5), 0, 0, 0, 0, 0, 0, 1, 0.35 * f + 0.05, 1), C('#f8f3e6', { r: 0.3 }))); break; }
    case 'karamiso': g.add(new THREE.Mesh(T(hemi(0.042, 16, 6), 0, 0, 0, 0, 0, 0, 1, 0.45 * f + 0.15, 1), C('#b3221a', { r: 0.32 }))); break;
    case 'kikurage': mound(g, '#2a1b16', 0.04, 0.008 * f + 0.003); for (let i = 0; i < n(6); i++) place(g, PIECE.kikurage(r), -0.02 + (i % 2) * 0.04, 0.004 + 0.002 * i, -0.025 + Math.floor(i / 2) * 0.025); break;
    default: break;
  }
  return g;
}
export function panFill(tid, f) {
  return cached('pan|' + tid + '|' + Math.round(f * 4), () => { const grp = new THREE.Group(); if (f > 0) { const p = pile(tid, Math.max(0.25, Math.round(f * 4) / 4)); p.position.y = -0.027; p.scale.set(1.15, 1, 1.15); grp.add(p); } return bakeGroup(grp); });
}
// 小皿にのせたトッピング（パソコンの絵用）
export function toppingDish(tid) {
  return cached('tpd|' + tid, () => { const g = new THREE.Group(); const p = new THREE.Group(); p.add(new THREE.Mesh(geos().plate, C('#2e3440', { r: 0.3 }))); p.add(new THREE.Mesh(T(torus(0.1165, 0.0016, 4, 40), 0, 0.0172, 0, Math.PI / 2), C('#b8860b', { r: 0.3, m: 0.6 }))); p.scale.set(0.62, 0.62, 0.62); g.add(p); const q = pile(tid, 0.55); q.position.y = 0.008; g.add(q); return bakeGroup(g); });
}
// 茹でる前の麺（1玉）
export function noodleBall() { return cached('men1', () => { const g = new THREE.Group(); g.add(new THREE.Mesh(tangledNoodles(0.04, 0.03, 12, 'raw', 6), VC({ r: 0.5 }))); return bakeGroup(g); }); }
// ---------- 水切りかご（洗った食器を立てて並べる） ----------
export function dryRackMesh(list) {
  return cached('dryr|' + list.join(','), () => {
    const g = new THREE.Group();
    list.slice(0, 12).forEach((k, i) => {
      const s = new THREE.Group(), row = Math.floor(i / 6), col = i % 6;
      if (k === 'plate') plateBase(s); else if (k === 'mug') { s.add(new THREE.Mesh(lathe([[0.034, 0], [0.041, 0.002], [0.043, 0.012], [0.043, 0.15], [0.0405, 0.15], [0.0395, 0.018], [0, 0.018]], 14), mat('#eef7ff', { r: 0.05, t: true, op: 0.35, side: THREE.DoubleSide }))); }
      else { bowlBase(s, k); if (k === 'bowl') s.scale.setScalar(BOWL_SCALE * 0.82); }
      const big = k === 'bowl' ? 0.112 : k === 'bowlS' ? 0.066 : k === 'plate' ? 0.12 : 0;
      s.rotation.set(k === 'mug' ? Math.PI : 1.42, 0, 0);
      s.position.set(-0.22 + col * 0.088, k === 'mug' ? 0.15 : big * 0.92, -0.1 + row * 0.2);
      g.add(s);
    });
    return bakeGroup(g);
  });
}
// 洗っている食器（泡だらけ）
export function washingMesh(k, p) {
  return cached('wash|' + k + '|' + Math.floor(p * 3), () => {
    const g = new THREE.Group(), s = new THREE.Group();
    if (k === 'plate') plateBase(s); else bowlBase(s, k === 'bowl' ? 'bowl' : 'bowlS');
    if (k === 'bowl') s.scale.setScalar(BOWL_SCALE * 0.9);
    s.rotation.set(0.9, 0, 0); g.add(s);
    const r = mulberry32(5), ps = [];
    for (let i = 0; i < 18 - Math.floor(p * 3) * 5; i++) ps.push(T(sph(0.012 + r() * 0.012, 6, 4), (r() - 0.5) * 0.16, 0.02 + r() * 0.08, (r() - 0.5) * 0.12));
    if (ps.length) g.add(new THREE.Mesh(merge(ps), mat('#ffffff', { r: 0.6, t: true, op: 0.85 })));
    g.add(new THREE.Mesh(T(rbox(0.07, 0.03, 0.045, 0.008), 0.09, 0.09, 0.02, 0.3, 0.5, 0), C('#f4d03f', { r: 0.8 })));
    g.add(new THREE.Mesh(T(rbox(0.07, 0.012, 0.045, 0.004), 0.09, 0.07, 0.02, 0.3, 0.5, 0), C('#2e8b57', { r: 0.9 })));
    return bakeGroup(g);
  });
}
// ---------- 寸胴鍋の中身（水・骨・香味野菜・アク） ----------
const potPiece = {
  torigara: (r) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(T(new THREE.IcosahedronGeometry(0.045, 1), (r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.08, r(), r(), r(), 1.3, 0.7, 1), C(i % 2 ? '#efd9b4' : '#e6c99c', { r: 0.55, flat: true }))); return g; },
  tonkotsuB: (r) => { const g = new THREE.Group(), m = C('#efe4cf', { r: 0.5 }); for (let i = 0; i < 2; i++) { const b = new THREE.Group(); b.add(new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.14, 10).rotateZ(Math.PI / 2), m)); for (const x of [-0.075, 0.075]) b.add(new THREE.Mesh(T(sph(0.03, 10, 7), x, 0, 0, 0, 0, 0, 1, 0.85, 1.2), m)); b.position.set((r() - 0.5) * 0.08, 0, (r() - 0.5) * 0.1); b.rotation.y = r() * 3; g.add(b); } return g; },
  niboshiG: (r) => { const g = new THREE.Group(), ps = []; for (let i = 0; i < 10; i++) ps.push(T(sph(1, 8, 5), (r() - 0.5) * 0.3, 0, (r() - 0.5) * 0.3, 0, r() * 6, 0, 0.035, 0.007, 0.009)); g.add(new THREE.Mesh(merge(ps), C('#a9adb3', { r: 0.35, m: 0.4 }))); return g; },
  yasai: (r) => { const g = new THREE.Group(); for (let i = 0; i < 3; i++) g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.07, 10).rotateZ(Math.PI / 2).translate((r() - 0.5) * 0.2, 0, (r() - 0.5) * 0.2), C(i ? '#cfe3a2' : '#f1f1e4', { r: 0.5 }))); g.add(new THREE.Mesh(T(new THREE.CylinderGeometry(0.025, 0.025, 0.006, 12), 0.05, 0.004, -0.06), C('#e8d39a', { r: 0.5 }))); g.add(new THREE.Mesh(T(sph(0.017, 8, 6), -0.06, 0.004, 0.06), C('#f7f3ea', { r: 0.5 }))); return g; },
  kombu: (r) => { const g = new THREE.Group(); for (let i = 0; i < 2; i++) g.add(new THREE.Mesh(T(box(0.16, 0.003, 0.05), (r() - 0.5) * 0.1, 0, (r() - 0.5) * 0.14, 0, r() * 3, 0), C('#24301e', { r: 0.6 }))); return g; },
};
export function potContents(P, r, heat, aku) {
  if (!P || !(P.w > 0)) return null;
  const B = P.b && BROTHS[P.b], k = B ? Math.min(1, heat / B.ready) : 0, hb = Math.min(4, Math.floor(k * 4)), ab = Math.min(5, Math.round(aku * 5));
  const key = ['pot', r, P.b || '-', Object.entries(P.n || {}).map(([a, b]) => a + b).join('.'), hb, ab].join('|');
  return cached(key, () => {
    const g = new THREE.Group();
    if (B) { g.add(new THREE.Mesh(disc(r, 32), mat('#ffffff', { map: soupTex(B.tex), r: 0.1, t: true, op: 0.45 + 0.55 * (hb / 4) }))); }
    else g.add(new THREE.Mesh(disc(r, 32), mat('#cfe6ee', { r: 0.05, t: true, op: 0.5 })));
    const rnd = mulberry32(7);
    for (const [id, n] of Object.entries(P.n || {})) for (let i = 0; i < Math.min(2, n); i++) { const mk = potPiece[id]; if (!mk) continue; const o = mk(rnd); o.position.set((rnd() - 0.5) * r * 0.9, -0.012, (rnd() - 0.5) * r * 0.9); g.add(o); }
    if (ab) { const ps = []; for (let i = 0; i < ab * 4; i++) { const a = rnd() * 7, d = Math.sqrt(rnd()) * r * 0.85; ps.push(T(sph(0.018 + rnd() * 0.016, 12, 6), Math.cos(a) * d, 0.002, Math.sin(a) * d, 0, rnd() * 3, 0, 1.4, 0.3, 1.1)); } g.add(new THREE.Mesh(merge(ps), C('#9b8a74', { r: 0.8 }))); }
    return bakeGroup(g);
  });
}
// ---------- お金（手に持つ札束・台に置いたお金） ----------
const billTex = () => ctex('bill', 256, 128, (c, w, h) => {
  c.fillStyle = '#d9cfa8'; c.fillRect(0, 0, w, h); c.strokeStyle = '#8a7a4a'; c.lineWidth = 6; c.strokeRect(6, 6, w - 12, h - 12);
  c.fillStyle = '#b9a874'; c.beginPath(); c.arc(w * 0.75, h / 2, 34, 0, 7); c.fill();
  c.fillStyle = '#5a4a24'; c.font = '900 40px sans-serif'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('壱万', w * 0.33, h / 2 - 4); c.font = '800 18px sans-serif'; c.fillText('らーめん銀行', w * 0.33, h - 22); c.fillText('円', w * 0.75, h / 2);
});
export function cashMesh(v = 10000) {
  const n = Math.max(1, Math.min(14, Math.round(Math.log2(Math.max(1000, v) / 1000) * 2 + 1)));
  return cached('cash|' + n, () => {
    const g = new THREE.Group(), m = mat('#ffffff', { map: billTex(), r: 0.7 });
    for (let i = 0; i < n; i++) g.add(new THREE.Mesh(T(box(0.16, 0.002, 0.075), (i % 3 - 1) * 0.003, 0.001 + i * 0.0022, 0, 0, (i % 2 ? 0.04 : -0.03)), m));
    g.add(new THREE.Mesh(T(box(0.03, n * 0.0022 + 0.003, 0.077), 0, 0.0005, 0), C('#e8e2d0', { r: 0.8 })));
    return bakeGroup(g);
  });
}
// ---------- タレ（かえし） ----------
export function tarePot(k, f) {
  return cached('tpot|' + k + '|' + Math.ceil(f * 3), () => {
    const g = new THREE.Group(), T = TARES[k];
    g.add(new THREE.Mesh(lathe([[0.04, 0], [0.046, 0.004], [0.046, 0.075], [0.042, 0.075], [0.04, 0.008], [0, 0.008]], 20), C('#f4f1ea', { r: 0.25 })));
    g.add(new THREE.Mesh(T2(disc(0.041, 20), 0, 0.012 + 0.058 * Math.max(0.15, f), 0), mat(T.color, { r: 0.08 })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.13, 6).rotateX(0.35).translate(0.018, 0.08, -0.01), C('#c9cfd4', { r: 0.25, m: 0.8 })));
    return bakeGroup(g);
  });
}
const T2 = (g, x, y, z) => g.translate(x, y, z);
export function tareBowl(k, p) {
  return cached('tbowl|' + k + '|' + Math.floor(p * 3), () => {
    const g = new THREE.Group(), T = TARES[k], c = new THREE.Color(T.color).lerp(new THREE.Color('#ffffff'), 0.25 * (1 - p));
    g.add(new THREE.Mesh(lathe([[0, 0.002], [0.04, 0.002], [0.075, 0.03], [0.09, 0.06], [0.088, 0.062], [0.072, 0.033], [0.039, 0.006], [0, 0.006]], 24), C('#d3d8dc', { r: 0.2, m: 0.85, side: THREE.DoubleSide })));
    g.add(new THREE.Mesh(T2(disc(0.07, 24), 0, 0.03, 0), mat('#' + c.getHexString(), { r: 0.1 })));
    g.add(new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.002, 4, 16).rotateX(Math.PI / 2).translate(0, 0.031, 0), mat('#ffffff', { r: 0.2, t: true, op: 0.35 })));
    g.add(new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.2, 6).rotateZ(0.7).translate(0.04, 0.09, 0), C('#8a5a30', { r: 0.6 })));
    return bakeGroup(g);
  });
}
export function soupSurface(k, r) { return new THREE.Mesh(disc(r, 32), mat('#ffffff', { map: soupTex(k), r: 0.1 })); }
export function riceSurface(r) { return new THREE.Mesh(disc(r, 28), mat('#ffffff', { map: riceTex(), r: 0.65 })); }
export { PIECE, pile, tangledNoodles };
