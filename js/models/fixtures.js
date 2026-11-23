// ===== 設備（厨房機器・客席・券売機・賭場・装飾）の3Dモデル =====
import * as THREE from 'three';
import { thumbCanvas, requestThumb, menuKey } from '../thumbs.js';
import { FIXTURES, TOPPINGS, SOUPS, basketPos, passPos } from '../data.js';
import { tex, surf, signTexture, canvasTex, emoji, FONT, rr, shade } from '../textures.js';
import { mat, smat, glassMat, T, box, rbox, cyl, sph, lathe, plane, torus, cone, add, M, vcolor } from './geo.js';

const basicCache = new Map();
export function basic(map, o = {}) {
  const k = map.uuid + JSON.stringify(o);
  if (!basicCache.has(k)) basicCache.set(k, new THREE.MeshBasicMaterial({ map, transparent: !!o.t, side: o.side ?? THREE.FrontSide, toneMapped: false, depthWrite: o.dw ?? true }));
  return basicCache.get(k);
}
const C = (c, o = {}) => mat(c, { r: 0.55, ...o });
const STEEL = () => smat(surf('metal'), 0xe8ebee, { r: 0.3, m: 0.75 });
const DARK = () => C(0x2f3337, { r: 0.45, m: 0.4 });
const WOOD = () => smat(surf('wood'), 0xffffff, { r: 0.6 });
const DWOOD = () => smat(surf('wood'), 0x7a5236, { r: 0.6 });
const CHROME = () => C(0xdfe3e8, { r: 0.18, m: 0.9 });
const BLACK = () => C(0x1c1d20, { r: 0.4 });
// 縦書きの文字（のぼり・提灯・木札）
export function vtext(text, { w = 128, h = 512, bg = '#c0392b', fg = '#ffffff', size = 0, border = null, lantern = false } = {}) {
  return canvasTex(w, h, (c) => {
    if (lantern) { const g = c.createRadialGradient(w / 2, h / 2, 10, w / 2, h / 2, w * 0.7); g.addColorStop(0, shade(bg, 0.25)); g.addColorStop(1, bg); c.fillStyle = g; } else c.fillStyle = bg;
    c.fillRect(0, 0, w, h);
    if (lantern) { c.strokeStyle = 'rgba(0,0,0,0.25)'; c.lineWidth = 2; for (let y = 10; y < h; y += 18) { c.beginPath(); c.moveTo(0, y); c.lineTo(w, y); c.stroke(); } }
    if (border) { c.strokeStyle = border; c.lineWidth = w * 0.06; c.strokeRect(w * 0.05, w * 0.05, w * 0.9, h - w * 0.1); }
    const chars = [...String(text || '')].slice(0, 8);
    const s = size || Math.min(w * 0.72, (h * 0.86) / Math.max(1, chars.length));
    c.fillStyle = fg; c.font = `900 ${s}px "Dela Gothic One",${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle';
    const y0 = h / 2 - (chars.length - 1) * s * 0.52;
    chars.forEach((ch, i) => c.fillText(ch, w / 2, y0 + i * s * 1.04));
  });
}
// ---- 調理台のベース（ステンレスの作業台） ----
function steelTable(g, w, d, h = 0.9, legs = true) {
  add(g, T(rbox(w, 0.04, d, 0.008), 0, h - 0.04), STEEL());
  if (legs) {
    for (const x of [-w / 2 + 0.05, w / 2 - 0.05]) for (const z of [-d / 2 + 0.05, d / 2 - 0.05]) add(g, cyl(0.02, 0.02, h - 0.04, 8), CHROME(), x, 0, z);
    add(g, T(box(w - 0.1, 0.02, d - 0.1), 0, 0.18), STEEL());
  } else add(g, box(w, h - 0.04, d), STEEL());
}
// 取り付け位置（描画で中身を置く所）
export const ANCHOR = {
  pot: { y: 0.5, r: 0.27, h: 0.42 }, pot2: { y: 0.5, r: 0.33, h: 0.48 },
  boilerY: 0.9,
  panY: 0.93, pans: (w) => { const out = []; for (let i = 0; i < 8; i++) out.push([-w / 2 + 0.12 + (i % 4) * ((w - 0.24) / 3), i < 4 ? -0.12 : 0.12]); return out; },
  rack: { ys: [0.12, 0.6, 1.08], xs: [-0.42, -0.14, 0.14, 0.42] },
  sink: [0.25, 0.72, 0], passY: 1.06, griddleY: 0.93, fryerY: 0.86, riceY: 0.95, beerY: 1.0,
};
const BUILD = {
  // ---------- 厨房 ----------
  pot(f) { return potModel(FIXTURES.pot, ANCHOR.pot); },
  pot2(f) { return potModel(FIXTURES.pot2, ANCHOR.pot2); },
  boiler(f) { return boilerModel(FIXTURES.boiler); },
  boiler6(f) { return boilerModel(FIXTURES.boiler6); },
  topping(f) {
    const g = new THREE.Group(), d = FIXTURES.topping;
    steelTable(g, d.w, d.d);
    // 容器（バット）8つ
    for (const [x, z] of ANCHOR.pans(d.w)) { const y0 = 0.9, st = STEEL(); add(g, T(box(0.148, 0.003, 0.148), x, y0, z), C(0x9aa0a6, { r: 0.35, m: 0.7 })); for (const [ox, oz, w, dd] of [[0, 0.073, 0.15, 0.004], [0, -0.073, 0.15, 0.004], [0.073, 0, 0.004, 0.15], [-0.073, 0, 0.004, 0.15]]) add(g, T(box(w, 0.05, dd), x + ox, y0, z + oz), st); }
    return g;
  },
  board(f) {
    const g = new THREE.Group(), d = FIXTURES.board;
    steelTable(g, d.w, d.d);
    add(g, T(rbox(0.55, 0.035, 0.36, 0.008), -0.1, 0.9), C(0xf0e4cc, { r: 0.75 }));
    add(g, T(box(0.03, 0.01, 0.2), 0.32, 0.9, 0, 0, 0.3), CHROME());
    add(g, T(box(0.03, 0.02, 0.1), 0.36, 0.9, 0.14, 0, 0.3), BLACK());
    for (const x of [0.4, 0.48]) add(g, T(cyl(0.05, 0.045, 0.06, 12), x, 0.9, -0.18), STEEL());
    return g;
  },
  fridge(f) { return fridgeModel(FIXTURES.fridge, 2); },
  fridge2(f) { return fridgeModel(FIXTURES.fridge2, 3); },
  dishrack(f) {
    const g = new THREE.Group(), d = FIXTURES.dishrack, w = d.w;
    for (const x of [-w / 2 + 0.02, w / 2 - 0.02]) add(g, box(0.03, 1.55, d.d), STEEL(), x, 0, 0);
    add(g, T(box(w, 1.5, 0.02), 0, 0.02, -d.d / 2 + 0.01), STEEL());
    for (const y of ANCHOR.rack.ys) add(g, T(box(w - 0.04, 0.02, d.d - 0.02), 0, y - 0.02), STEEL());
    add(g, T(box(w, 0.03, d.d), 0, 1.55), STEEL());
    const lbl = M(T(plane(0.7, 0.1), 0, 1.42), basic(signTexture('🍜丼　🍚小丼　🍽️皿　🍺ジョッキ', { w: 768, h: 96, bg: '#3a3f45', fg: '#ffffff', radius: 10 }))); lbl.position.z = d.d / 2 + 0.002; g.add(lbl);
    return g;
  },
  sink(f) {
    const g = new THREE.Group(), d = FIXTURES.sink;
    add(g, box(d.w, 0.86, d.d), STEEL());
    add(g, T(box(0.7, 0.02, d.d - 0.1), 0.25, 0.7), C(0xb7bec4, { r: 0.25, m: 0.8 }));
    for (const z of [-d.d / 2 + 0.04, d.d / 2 - 0.04]) add(g, T(box(0.74, 0.18, 0.02), 0.25, 0.7, z), STEEL());
    add(g, T(box(0.04, 0.4, 0.04), 0.25, 0.88, -d.d / 2 + 0.06), CHROME());
    add(g, T(cyl(0.015, 0.015, 0.25, 8), 0.25, 1.26, -d.d / 2 + 0.06 + 0.12, Math.PI / 2), CHROME());
    add(g, T(box(0.5, 0.06, 0.4), -0.4, 0.86), C(0x9fb5c4, { r: 0.5 }));
    add(g, T(cyl(0.04, 0.04, 0.12, 10), -0.55, 0.86, -0.2), C(0x2e8bff, { r: 0.4 }));
    return g;
  },
  pass(f) {
    const g = new THREE.Group(), d = FIXTURES.pass;
    add(g, box(d.w, 1.0, d.d), C(0x6b4a30, { r: 0.6 }));
    add(g, T(rbox(d.w + 0.04, 0.04, d.d + 0.04, 0.01), 0, 1.0), STEEL());
    for (const x of [-d.w / 2 + 0.04, d.w / 2 - 0.04]) add(g, T(cyl(0.015, 0.015, 0.55, 8), x, 1.04, -d.d / 2 + 0.05), CHROME());
    add(g, T(rbox(d.w, 0.06, 0.2, 0.02), 0, 1.58, -d.d / 2 + 0.12), STEEL());
    add(g, T(box(d.w - 0.1, 0.01, 0.12), 0, 1.575, -d.d / 2 + 0.12), C(0xffb070, { e: 0xff7a20, ei: 0.8 }));
    add(g, T(sph(0.05, 12, 8), d.w / 2 - 0.12, 1.04, d.d / 2 - 0.12, 0, 0, 0, 1, 0.6, 1), C(0xc9a227, { r: 0.3, m: 0.8 }));
    const lbl = M(T(plane(0.6, 0.12), 0, 0.82), basic(signTexture('🛎️ 受け渡し', { w: 512, h: 100, bg: '#fffdf6', fg: '#6b4a30', radius: 12 }))); lbl.position.z = d.d / 2 + 0.002; g.add(lbl);
    return g;
  },
  rice(f) {
    const g = new THREE.Group();
    add(g, box(0.56, 0.7, 0.56), C(0x6b4a30, { r: 0.6 }));
    add(g, T(rbox(0.4, 0.26, 0.34, 0.08), 0, 0.7), C(0xf6f6f2, { r: 0.35 }));
    add(g, T(rbox(0.36, 0.04, 0.3, 0.02), 0, 0.95), C(0xd8d8d0, { r: 0.35 }));
    add(g, T(box(0.12, 0.05, 0.01), 0, 0.8, 0.171), C(0x2b6cb0, { r: 0.3, e: 0x123a66 }));
    return g;
  },
  gyoza(f) {
    const g = new THREE.Group(), d = FIXTURES.gyoza;
    steelTable(g, d.w, d.d, 0.86, false);
    add(g, T(box(d.w - 0.08, 0.04, d.d - 0.12), 0, 0.86), C(0x2a2a2c, { r: 0.35, m: 0.6 }));
    for (const z of [-0.2, 0.2]) add(g, T(box(0.06, 0.03, 0.04), d.w / 2 - 0.08, 0.6, d.d / 2 + 0.01), C(0xb0b6bc, { m: 0.7, r: 0.3 }), 0, 0, 0);
    add(g, T(box(d.w - 0.1, 0.15, 0.02), 0, 0.88, -d.d / 2 + 0.06), STEEL());
    return g;
  },
  fryer(f) {
    const g = new THREE.Group(), d = FIXTURES.fryer;
    add(g, box(d.w, 0.86, d.d), STEEL());
    add(g, T(box(d.w - 0.12, 0.02, d.d - 0.16), 0, 0.84), C(0xc79a3a, { r: 0.1, m: 0.2 }));
    add(g, T(box(d.w, 0.25, 0.04), 0, 0.86, -d.d / 2 + 0.02), STEEL());
    for (const x of [-0.2, 0.2]) add(g, T(cyl(0.025, 0.025, 0.02, 12), x, 0.6, d.d / 2 + 0.005, Math.PI / 2), BLACK());
    return g;
  },
  beer(f) {
    const g = new THREE.Group();
    add(g, box(0.56, 0.9, 0.56), C(0x6b4a30, { r: 0.6 }));
    add(g, T(rbox(0.36, 0.42, 0.36, 0.04), 0, 0.9), STEEL());
    add(g, T(cyl(0.02, 0.02, 0.12, 8), 0, 1.15, 0.2, Math.PI / 2), CHROME());
    add(g, T(box(0.04, 0.14, 0.04), 0, 1.2, 0.26), C(0xf2b705, { r: 0.4 }));
    add(g, T(box(0.3, 0.02, 0.18), 0, 0.9, 0.18), C(0x8d949a, { m: 0.7, r: 0.4 }));
    const lbl = M(T(plane(0.3, 0.12), 0, 0.98), basic(signTexture('生ビール', { w: 256, h: 100, bg: '#f2b705', fg: '#3a2200', radius: 10 }))); lbl.position.z = 0.182; g.add(lbl);
    return g;
  },
  // ---------- 客席 ----------
  counter(f) { return counterModel(FIXTURES.counter); },
  counter2(f) { return counterModel(FIXTURES.counter2); },
  table2(f) { return tableModel(FIXTURES.table2); },
  table4(f) { return tableModel(FIXTURES.table4); },
  zashiki(f) {
    const g = new THREE.Group(), d = FIXTURES.zashiki;
    add(g, box(d.w, 0.35, d.d), DWOOD());
    add(g, T(box(d.w - 0.08, 0.02, d.d - 0.08), 0, 0.35), mat(0xffffff, { map: tatamiTex(), r: 0.85 }));
    add(g, T(rbox(d.w - 0.5, 0.05, 0.8, 0.01), 0, 0.62), DWOOD());
    for (const x of [-d.w / 2 + 0.4, d.w / 2 - 0.4]) for (const z of [-0.3, 0.3]) add(g, T(box(0.05, 0.25, 0.05), x, 0.37, z), DWOOD());
    d.seats.forEach(([x, z]) => add(g, T(rbox(0.4, 0.05, 0.4, 0.02), x, 0.37, z * 0.98), C(0x8e2b2b, { r: 0.85 })));
    return g;
  },
  ticket(f, ctx) {
    const g = new THREE.Group(), body = C(0xe9ecef, { r: 0.35, m: 0.3 });
    add(g, rbox(0.76, 1.65, 0.55, 0.03), body);
    const face = M(T(plane(0.62, 0.62), 0, 0.92), basic(ticketFace(ctx.menu || []))); face.position.z = 0.276; g.add(face);
    add(g, T(box(0.2, 0.12, 0.02), 0, 0.62), C(0x111111), 0.2, 0, 0.27);
    add(g, T(box(0.3, 0.05, 0.03), 0, 0.42), C(0x222222), 0, 0, 0.27);
    add(g, T(box(0.76, 0.12, 0.56), 0, 1.6), C(ctx.color || '#c0392b', { r: 0.4 }));
    const top = M(T(plane(0.7, 0.1), 0, 1.61), basic(signTexture('食券', { w: 256, h: 64, bg: ctx.color || '#c0392b', fg: '#ffffff' }))); top.position.z = 0.282; g.add(top);
    return g;
  },
  bench(f) {
    const g = new THREE.Group(), w = WOOD();
    add(g, T(box(1.45, 0.05, 0.4), 0, 0.42), w);
    for (const x of [-0.62, 0.62]) add(g, box(0.06, 0.42, 0.36), DWOOD(), x);
    add(g, T(box(1.45, 0.3, 0.04), 0, 0.5, -0.2), DWOOD());
    return g;
  },
  water(f) {
    const g = new THREE.Group();
    add(g, rbox(0.36, 1.0, 0.36, 0.03), C(0xf2f2f2, { r: 0.4 }));
    add(g, T(cyl(0.15, 0.15, 0.42, 16), 0, 1.0), mat(0x9fd3ff, { r: 0.05, t: true, op: 0.55 }));
    for (let i = 0; i < 4; i++) add(g, T(cyl(0.03, 0.025, 0.08, 10), -0.09 + i * 0.06, 0.62, 0.22), mat(0xe8f6ff, { r: 0.05, t: true, op: 0.5 }));
    add(g, T(box(0.3, 0.02, 0.1), 0, 0.6, 0.22), C(0xcfd4d8, { m: 0.6 }));
    return g;
  },
  trash(f) {
    const g = new THREE.Group();
    add(g, cyl(0.2, 0.18, 0.62, 16), C(0x3b6e4f, { r: 0.5, m: 0.2 }));
    add(g, T(cyl(0.215, 0.215, 0.04, 16), 0, 0.62), C(0x2a4a36, { r: 0.5 }));
    add(g, T(box(0.1, 0.04, 0.04), 0, 0.66), C(0x2a4a36));
    const lbl = M(T(plane(0.2, 0.12), 0, 0.36), basic(signTexture('生ゴミ', { w: 256, h: 128, bg: '#ffffff', fg: '#2a4a36', radius: 12 }))); lbl.position.z = 0.192; g.add(lbl);
    return g;
  },
  // ---------- 防犯・防火 ----------
  ext(f) {
    const g = new THREE.Group();
    add(g, T(box(0.3, 0.05, 0.3), 0, 0), C(0xb71c1c));
    add(g, T(cyl(0.07, 0.07, 0.5, 16), 0, 0.05), C(0xd62828, { r: 0.35 }));
    add(g, T(sph(0.07, 14, 8), 0, 0.55, 0, 0, 0, 0, 1, 0.5, 1), C(0xd62828, { r: 0.35 }));
    add(g, T(box(0.04, 0.06, 0.12), 0, 0.6, 0.02), BLACK());
    const lbl = M(T(plane(0.12, 0.16), 0, 0.3), basic(signTexture('消火器', { w: 128, h: 160, bg: '#ffffff', fg: '#b71c1c', radius: 10 }))); lbl.position.z = 0.072; g.add(lbl);
    const sign = M(T(plane(0.3, 0.12), 0, 1.4), basic(signTexture('🧯 消火器', { w: 256, h: 100, bg: '#d62828', fg: '#ffffff', radius: 10 }))); g.add(sign);
    add(g, T(cyl(0.01, 0.01, 0.75, 6), 0, 0.65), CHROME(), 0, 0, -0.1);
    return g;
  },
  shuriken(f) {
    const g = new THREE.Group();
    add(g, box(0.56, 0.9, 0.36), DWOOD());
    add(g, T(box(0.5, 0.5, 0.02), 0, 0.92), C(0x1c1d20, { r: 0.5 }), 0, 0, -0.12);
    for (let i = 0; i < 6; i++) { const s = new THREE.Shape(); for (let k = 0; k < 8; k++) { const a = k / 8 * Math.PI * 2, r = k % 2 ? 0.014 : 0.05; s.lineTo(Math.cos(a) * r, Math.sin(a) * r); } const m = M(new THREE.ExtrudeGeometry(s, { depth: 0.006, bevelEnabled: false }), C(0x8c949c, { r: 0.25, m: 0.85 })); m.position.set(-0.15 + (i % 3) * 0.15, 1.05 + Math.floor(i / 3) * 0.2, -0.1); g.add(m); }
    const lbl = M(T(plane(0.4, 0.12), 0, 0.72), basic(signTexture('✴️ 手裏剣', { w: 256, h: 76, bg: '#1c1d20', fg: '#ffd23f', radius: 10 }))); lbl.position.z = 0.182; g.add(lbl);
    return g;
  },
  turret(f) {
    const g = new THREE.Group();
    add(g, cyl(0.25, 0.3, 0.6, 16), DARK());
    add(g, T(sph(0.22, 16, 10), 0, 0.75), C(0x5a6470, { r: 0.35, m: 0.6 }));
    add(g, T(cyl(0.05, 0.05, 0.36, 10), 0, 0.75, 0.18, Math.PI / 2), BLACK());
    add(g, T(sph(0.04, 10, 6), 0, 0.88, 0.16), C(0xff3b3b, { e: 0xff0000, ei: 0.8 }));
    return g;
  },
  // ---------- 装飾 ----------
  plant(f) {
    const g = new THREE.Group();
    add(g, lathe([[0, 0], [0.15, 0], [0.2, 0.38], [0.22, 0.4], [0.22, 0.43], [0, 0.43]], 16), C(0x6b4a30, { r: 0.8 }));
    const leaf = [C(0x2f7d32), C(0x43a047), C(0x1b5e20)];
    for (let i = 0; i < 11; i++) { const a = i * 2.39, t = 0.35 + (i % 4) * 0.12, len = 0.55 + (i % 3) * 0.15; const tx = Math.cos(a) * t, tz = Math.sin(a) * t; add(g, T(sph(0.13, 10, 6), -len * Math.sin(tz), 0.42 + len * Math.cos(tz) * Math.cos(tx), len * Math.cos(tz) * Math.sin(tx), 0.4, a, 0, 1, 0.18, 0.62), leaf[i % 3]); }
    return g;
  },
  maneki(f) {
    const g = new THREE.Group(), w = C(0xfafafa, { r: 0.3 });
    add(g, box(0.4, 0.5, 0.4), DWOOD());
    add(g, T(sph(0.15, 16, 12), 0, 0.68, 0, 0, 0, 0, 1, 1.2, 0.9), w);
    add(g, T(sph(0.12, 16, 12), 0, 0.92), w);
    for (const s of [-1, 1]) add(g, T(cone(0.04, 0.07, 8), s * 0.07, 1.0), w);
    add(g, T(sph(0.045, 10, 8), 0.12, 1.02, 0.04), w);
    add(g, T(torus(0.08, 0.012, 6, 16), 0, 0.82, 0, Math.PI / 2), C(0xd62828));
    add(g, T(sph(0.025, 8, 6), 0, 0.78, 0.1), C(0xf2b705, { m: 0.7, r: 0.3 }));
    add(g, T(box(0.1, 0.06, 0.02), 0, 0.6, 0.13), C(0xf2b705, { m: 0.6, r: 0.3 }));
    for (const s of [-1, 1]) add(g, T(sph(0.012, 6, 4), s * 0.045, 0.94, 0.11), BLACK());
    return g;
  },
  chochin(f, ctx) {
    const g = new THREE.Group();
    add(g, T(cyl(0.006, 0.006, 0.7, 4), 0, 3.1), BLACK());
    add(g, T(cyl(0.08, 0.08, 0.04, 14), 0, 3.06), BLACK());
    add(g, T(sph(0.2, 18, 12), 0, 2.78, 0, 0, 0, 0, 1, 1.35, 1), mat(0xffffff, { map: vtext('らーめん', { w: 256, h: 256, bg: '#d62828', lantern: true, size: 50 }), r: 0.6, e: 0x5a0a0a, ei: 0.6 }));
    add(g, T(cyl(0.08, 0.08, 0.04, 14), 0, 2.48), BLACK());
    void ctx;
    return g;
  },
  tanuki(f) {
    const g = new THREE.Group(), br = C(0x8a5a3a, { r: 0.6 }), lt = C(0xd8b48a, { r: 0.6 });
    add(g, T(sph(0.25, 16, 12), 0, 0.3, 0, 0, 0, 0, 1, 1.1, 1), br);
    add(g, T(sph(0.18, 14, 10), 0, 0.3, 0.13, 0, 0, 0, 1, 1.1, 0.6), lt);
    add(g, T(sph(0.18, 14, 10), 0, 0.72), br);
    add(g, T(cyl(0.2, 0.22, 0.04, 16), 0, 0.88), C(0x6b4a30));
    add(g, T(cyl(0.12, 0.14, 0.08, 16), 0, 0.88), C(0x6b4a30));
    for (const s of [-1, 1]) { add(g, T(sph(0.05, 8, 6), s * 0.07, 0.75, 0.13), C(0xffffff)); add(g, T(sph(0.025, 8, 6), s * 0.07, 0.75, 0.17), BLACK()); }
    add(g, T(rbox(0.12, 0.2, 0.06, 0.02), 0.2, 0.25, 0.1), C(0xe9d8b4));
    return g;
  },
  kamidana(f) {
    const g = new THREE.Group(), w = C(0xe6cfa0, { r: 0.6 });
    add(g, T(box(0.95, 0.03, 0.35), 0, 2.2), w);
    for (const x of [-0.42, 0.42]) add(g, T(box(0.04, 0.2, 0.3), x, 2.0), w);
    add(g, T(box(0.4, 0.3, 0.2), 0, 2.23), w);
    add(g, T(cone(0.28, 0.12, 4), 0, 2.53, 0, 0, Math.PI / 4), C(0x6b4a30));
    for (const x of [-0.3, 0.3]) add(g, T(cyl(0.04, 0.05, 0.12, 8), x, 2.23), C(0xffffff));
    add(g, T(torus(0.25, 0.015, 6, 20, Math.PI), 0, 2.2, 0.18, 0, 0, Math.PI), C(0xe0c080));
    return g;
  },
  kumade(f) {
    const g = new THREE.Group();
    add(g, T(cyl(0.015, 0.015, 1.4, 6), 0, 1.0, -0.05, 0, 0, 0.1), C(0xd8b48a));
    add(g, T(cyl(0.35, 0.35, 0.03, 14, false, 0, Math.PI), 0, 2.1, -0.05, Math.PI / 2, 0, 0), C(0xd8b48a));
    const cols = [0xd62828, 0xf2b705, 0x2e7d32, 0xffffff];
    for (let i = 0; i < 10; i++) add(g, T(sph(0.06, 8, 6), -0.28 + (i % 5) * 0.14, 2.05 + Math.floor(i / 5) * 0.12, 0), C(cols[i % 4], { r: 0.4 }));
    add(g, T(plane(0.3, 0.12), 0, 1.75), basic(signTexture('商売繁盛', { w: 256, h: 96, bg: '#d62828', fg: '#ffffff' })));
    return g;
  },
  aquarium(f) {
    const g = new THREE.Group();
    add(g, box(1.2, 0.75, 0.5), DWOOD());
    add(g, T(box(1.15, 0.55, 0.45), 0, 0.75), mat(0x7fd3ff, { r: 0.05, t: true, op: 0.35 }));
    add(g, T(box(1.15, 0.05, 0.45), 0, 0.75), C(0xd8c49a, { r: 0.9 }));
    for (let i = 0; i < 6; i++) add(g, T(sph(0.03, 8, 6), -0.4 + i * 0.16, 0.95 + (i % 3) * 0.1, (i % 2) * 0.1 - 0.05, 0, i, 0, 1.6, 0.8, 0.6), C(i % 3 ? 0xff5a1f : 0xffffff, { r: 0.4 }));
    add(g, T(box(1.2, 0.04, 0.5), 0, 1.3), BLACK());
    return g;
  },
  // ---------- 看板 ----------
  signstand(f) {
    const g = new THREE.Group(), w = WOOD();
    const t = signTexture(f.tx || '', { w: 256, h: 320, chalk: true });
    for (const s of [1, -1]) { const p = new THREE.Group(); add(p, box(0.46, 0.72, 0.03), w); p.add(M(T(plane(0.4, 0.58), 0, 0.37, 0.016), basic(t))); p.position.set(0, 0.05, s * 0.12); p.rotation.y = s > 0 ? 0 : Math.PI; p.rotation.x = s > 0 ? -0.22 : 0.22; g.add(p); }
    return g;
  },
  nobori(f, ctx) {
    const g = new THREE.Group();
    add(g, cyl(0.15, 0.17, 0.08, 14), DARK());
    add(g, cyl(0.02, 0.02, 2.4, 8), CHROME());
    add(g, T(cyl(0.012, 0.012, 0.5, 6), 0.25, 2.35, 0, 0, 0, Math.PI / 2), CHROME());
    const bg = f.c && f.c !== '#ffffff' ? f.c : ctx.color;
    const t = vtext(f.tx || 'ラーメン', { w: 128, h: 448, bg, fg: '#ffffff', border: '#ffffff' });
    g.add(M(T(plane(0.45, 1.6), 0.25, 1.55, 0.01), basic(t, { side: THREE.DoubleSide })));
    return g;
  },
  menuboard(f, ctx) {
    const g = new THREE.Group();
    const items = (ctx.menu || []).filter((m) => m.on).slice(0, 8);
    add(g, T(box(1.0, 0.7, 0.04), 0, 1.5, -0.1), DWOOD());
    for (const m of items) requestThumb(menuKey(m));
    const t = canvasTex(512, 360, (c, W, H) => {
      c.fillStyle = '#e9d6b0'; c.fillRect(0, 0, W, H);
      c.fillStyle = '#3a2210'; c.font = `900 34px "Dela Gothic One",${FONT}`; c.textAlign = 'center'; c.fillText('お品書き', W / 2, 44);
      c.font = `800 25px ${FONT}`; c.textAlign = 'left';
      items.forEach((m, i) => { const y = 92 + i * 34, img = thumbCanvas(menuKey(m)); if (img) c.drawImage(img, 18, y - 28, 36, 36); c.fillText(m.name, 60, y, 290); c.textAlign = 'right'; c.fillText('¥' + m.price.toLocaleString(), W - 22, y); c.textAlign = 'left'; });
    });
    g.add(M(T(plane(0.94, 0.64), 0, 1.53, -0.078), basic(t)));
    for (const x of [-0.4, 0.4]) add(g, box(0.04, 1.5, 0.04), DWOOD(), x, 0, -0.12);
    return g;
  },
  neon(f) {
    const g = new THREE.Group();
    for (const x of [-0.4, 0.4]) add(g, box(0.04, 1.5, 0.04), DARK(), x, 0, -0.05);
    add(g, T(rbox(0.96, 0.5, 0.06, 0.02), 0, 1.1), C(0x15151a, { r: 0.3 }), 0, 0, -0.05);
    const col = f.c || '#ff4f6d';
    const t = signTexture(f.tx || '', { w: 512, h: 256, bg: null, fg: '#ffffff', glow: col, stroke: col });
    g.add(M(T(plane(0.92, 0.46), 0, 1.12, -0.015), basic(t, { t: true })));
    return g;
  },
  // ---------- 固定 ----------
  pc() {
    const g = new THREE.Group(), wd = WOOD(), dark = DARK();
    add(g, T(rbox(1.5, 0.05, 0.72, 0.01), 0, 0.74), wd);
    for (const [x, z] of [[-0.7, 0.3], [0.7, 0.3], [-0.7, -0.3], [0.7, -0.3]]) add(g, box(0.05, 0.74, 0.05), dark, x, 0, z);
    add(g, T(box(0.04, 0.22, 0.04), 0, 0.79), dark, 0, 0, -0.18);
    add(g, T(rbox(0.86, 0.52, 0.04, 0.012), 0, 0.98), C(0x1b1d24, { r: 0.4 }), 0, 0, -0.2);
    const scr = M(T(plane(0.8, 0.46), 0, 1.01 + 0.23), basic(pcScreen())); scr.position.z = -0.177; g.add(scr);
    add(g, T(rbox(0.46, 0.02, 0.16, 0.006), 0, 0.79), C(0xe9ebf0, { r: 0.4 }), -0.05, 0, 0.06);
    add(g, T(cyl(0.05, 0.06, 0.1, 12), 0.5, 0.77, -0.1), C(0xffffff, { r: 0.3 }));
    return g;
  },
  opensign(f, ctx) {
    // 店の前の札（両面）「営業中」「準備中」
    const g = new THREE.Group(), open = ctx.phase === 'open';
    add(g, box(0.42, 0.06, 0.3), DWOOD());
    for (const x of [-0.18, 0.18]) add(g, box(0.04, 1.05, 0.04), DWOOD(), x);
    const face = vtext(open ? '営業中' : '準備中', { w: 160, h: 420, bg: open ? '#fdf6e3' : '#2b2b2b', fg: open ? '#b71c1c' : '#f2f2f2', border: open ? '#b71c1c' : '#888', size: 96 });
    add(g, T(box(0.36, 0.9, 0.03), 0, 0.16), DWOOD());
    for (const s of [1, -1]) { const p = M(T(plane(0.32, 0.84), 0, 0.61), basic(face)); p.position.z = s * 0.017; if (s < 0) p.rotation.y = Math.PI; g.add(p); }
    return g;
  },
  chohan(f) {
    // 盆茣蓙（白い布を張った低い台）と座布団
    const g = new THREE.Group(), d = FIXTURES.chohan;
    add(g, box(d.w, 0.3, d.d), DWOOD());
    add(g, T(box(d.w - 0.1, 0.02, d.d - 0.1), 0, 0.3), C(0xf6f4ee, { r: 0.9 }));
    for (const x of [-1, -0.33, 0.33, 1]) add(g, T(rbox(0.42, 0.06, 0.42, 0.02), x, 0, 1.15), C(0x7a1f1f, { r: 0.85 }));
    add(g, T(rbox(0.5, 0.06, 0.5, 0.02), 0, 0, -1.2), C(0x2b2d42, { r: 0.85 }));
    const lbl = M(T(plane(0.8, 0.22), 0, 0.12), basic(signTexture('丁　半', { w: 512, h: 140, bg: '#1c1d20', fg: '#f2c94c', radius: 14 }))); lbl.position.z = d.d / 2 + 0.002; g.add(lbl);
    return g;
  },
  chinchiro(f) {
    const g = new THREE.Group();
    add(g, cyl(0.7, 0.7, 0.35, 28), DWOOD());
    add(g, T(cyl(0.66, 0.66, 0.01, 28), 0, 0.35), C(0x234a2a, { r: 0.9 }));
    const bowl = new THREE.Group();
    add(bowl, lathe([[0, 0], [0.07, 0], [0.16, 0.08], [0.2, 0.14]], 22), mat(0xffffff, { r: 0.25, side: THREE.DoubleSide }));
    bowl.position.y = 0.36; g.add(bowl);
    for (const [x, z] of [[0, 0.95], [0, -0.95], [0.95, 0], [-0.95, 0]]) add(g, T(rbox(0.4, 0.06, 0.4, 0.02), x, 0, z), C(0x7a1f1f, { r: 0.85 }));
    return g;
  },
  slot(f) {
    const g = new THREE.Group();
    add(g, rbox(0.72, 1.7, 0.6, 0.03), C(0x5b1a8a, { r: 0.4, m: 0.3 }));
    const scr = M(T(plane(0.56, 0.3), 0, 1.0), basic(slotFace())); scr.position.z = 0.302; g.add(scr);
    add(g, T(box(0.6, 0.12, 0.14), 0, 0.78, 0.3), C(0x2b2d42, { r: 0.4 }));
    for (let i = 0; i < 3; i++) add(g, T(cyl(0.025, 0.025, 0.02, 10), -0.15 + i * 0.15, 0.9, 0.37, Math.PI / 2), C([0xff3b3b, 0xffd23f, 0x3bff8a][i], { e: [0x661010, 0x664d00, 0x0a5a2a][i] }));
    add(g, T(plane(0.6, 0.18), 0, 1.45, 0.302), basic(signTexture('🎰 SLOT', { w: 512, h: 150, bg: '#ffd23f', fg: '#5b1a8a', radius: 16, shine: true })));
    add(g, T(cyl(0.02, 0.02, 0.3, 8), 0.4, 1.0, 0.1), CHROME()); add(g, T(sph(0.05, 10, 8), 0.4, 1.32, 0.1), C(0xd62828, { r: 0.3 }));
    return g;
  },
};
function potModel(def, A) {
  const g = new THREE.Group();
  add(g, rbox(def.w, 0.42, def.d, 0.02), STEEL());
  add(g, T(box(def.w - 0.1, 0.01, def.d - 0.1), 0, 0.42), BLACK());
  for (const x of [-0.25, 0.25]) add(g, T(cyl(0.03, 0.03, 0.02, 12), x, 0.25, def.d / 2 + 0.005, Math.PI / 2), BLACK());
  add(g, T(torus(0.12, 0.012, 6, 16), 0, 0.44, 0, Math.PI / 2), C(0x2b2b2b, { m: 0.6 }));
  // 寸胴鍋
  add(g, T(cyl(A.r, A.r, A.h, 24, true), 0, A.y - 0.05), mat(0xdde1e4, { r: 0.25, m: 0.85, side: THREE.DoubleSide }));
  add(g, T(cyl(A.r, A.r, 0.01, 24), 0, A.y - 0.05), mat(0xbfc5ca, { r: 0.3, m: 0.8 }));
  add(g, T(torus(A.r, 0.01, 6, 24), 0, A.y - 0.05 + A.h, 0, Math.PI / 2), CHROME());
  for (const s of [-1, 1]) add(g, T(torus(0.05, 0.01, 5, 10, Math.PI), s * (A.r + 0.03), A.y + A.h - 0.12, 0, 0, s > 0 ? Math.PI / 2 : -Math.PI / 2, Math.PI / 2), CHROME());
  // おたま
  add(g, T(cyl(0.006, 0.006, 0.5, 6), A.r - 0.06, A.y + 0.15, 0.05, 0, 0, -0.35), CHROME());
  return g;
}
function boilerModel(def) {
  const g = new THREE.Group();
  add(g, box(def.w, 0.86, def.d), STEEL());
  add(g, T(box(def.w - 0.08, 0.02, def.d - 0.1), 0, ANCHOR.boilerY - 0.04), mat(0x9fc6d6, { r: 0.05, m: 0.1, t: true, op: 0.8 }));
  add(g, T(box(def.w, 0.22, 0.04), 0, 0.86, -def.d / 2 + 0.02), STEEL());
  add(g, T(box(0.2, 0.08, 0.01), 0, 0.5, def.d / 2 + 0.002), C(0x111111, { e: 0x0a3a1a }));
  for (let i = 0; i < def.baskets; i++) {
    const [x, z] = basketPos(def.id, i);
    add(g, T(torus(0.09, 0.008, 5, 16), x, ANCHOR.boilerY - 0.03, z, Math.PI / 2), CHROME());
  }
  return g;
}
function fridgeModel(def, doors) {
  const g = new THREE.Group();
  add(g, rbox(def.w, 1.9, def.d, 0.02), STEEL());
  for (let i = 0; i < doors; i++) {
    const dw = def.w / doors, x = -def.w / 2 + dw * (i + 0.5);
    add(g, T(box(dw - 0.02, 1.7, 0.02), x, 0.12, def.d / 2), smat(surf('metal'), 0xf2f4f6, { r: 0.25, m: 0.7 }));
    add(g, T(box(0.03, 0.4, 0.04), x + (i % 2 ? -1 : 1) * (dw / 2 - 0.08), 0.95, def.d / 2 + 0.03), CHROME());
  }
  add(g, T(box(0.18, 0.06, 0.01), 0, 1.78, def.d / 2 + 0.015), C(0x111111, { e: 0x103a5a }));
  return g;
}
function counterModel(def) {
  const g = new THREE.Group(), w = def.w;
  // 天板（客席側）と腰板・厨房側の低い作業台
  add(g, T(rbox(w, 0.06, 0.62, 0.01), 0, 0.92, -0.4), smat(surf('wood'), 0xd9b27c, { r: 0.45 }));
  add(g, T(box(w, 0.92, 0.06), 0, 0, -0.12), DWOOD());
  add(g, T(box(w, 0.08, 0.04), 0, 0.12, -0.08), BLACK());
  add(g, T(box(w, 0.04, 0.5), 0, 0.78, -0.42), STEEL());
  add(g, T(box(w, 0.78, 0.04), 0, 0, -0.68), STEEL());
  // 調味料（こしょう・酢・ラー油）と箸立て
  for (let i = 0; i < def.seats.length; i++) {
    const [x] = def.seats[i];
    if (i % 2 === 0) { add(g, T(cyl(0.035, 0.035, 0.12, 10), x + 0.28, 0.98, -0.2), C(0x6b4a30)); add(g, T(cyl(0.015, 0.015, 0.1, 8), x + 0.36, 0.98, -0.2), C(0x8a2a1a)); add(g, T(cyl(0.015, 0.015, 0.1, 8), x + 0.4, 0.98, -0.2), C(0xf2f0e8)); }
  }
  // スツール
  for (const [x, z] of def.seats) {
    add(g, T(cyl(0.035, 0.05, 0.62, 10), x, 0, z), CHROME());
    add(g, T(cyl(0.18, 0.18, 0.08, 18), x, 0.62, z), C(0x9b1c1c, { r: 0.6 }));
    add(g, T(torus(0.14, 0.01, 5, 16), x, 0.24, z, Math.PI / 2), CHROME());
  }
  return g;
}
function tableModel(def) {
  const g = new THREE.Group(), tw = def.w - 0.1, td = def.seats.some(([, z]) => Math.abs(z) > 0.65) ? 0.85 : 0.75;
  add(g, T(rbox(tw, 0.05, td, 0.01), 0, def.top - 0.05), smat(surf('wood'), 0xc8955a, { r: 0.45 }));
  add(g, T(cyl(0.04, 0.05, def.top - 0.05, 10), 0, 0), BLACK());
  add(g, T(cyl(0.25, 0.28, 0.03, 18), 0, 0), BLACK());
  add(g, T(cyl(0.03, 0.03, 0.12, 8), tw / 2 - 0.12, def.top, 0), C(0x6b4a30));
  for (const [x, z] of def.seats) {
    const s = Math.sign(z);
    add(g, T(rbox(0.38, 0.05, 0.38, 0.015), x, 0.45, z), smat(surf('wood'), 0xa87a4a, { r: 0.5 }));
    for (const dx of [-0.15, 0.15]) for (const dz of [-0.15, 0.15]) add(g, T(box(0.03, 0.45, 0.03), x + dx, 0, z + dz), DWOOD());
    add(g, T(box(0.36, 0.4, 0.03), x, 0.5, z + s * 0.18), smat(surf('wood'), 0xa87a4a, { r: 0.5 }));
  }
  return g;
}
let pcTex = null;
function pcScreen() {
  return pcTex ||= canvasTex(512, 320, (c, W, H) => {
    const g = c.createLinearGradient(0, 0, W, H); g.addColorStop(0, '#8a1c1c'); g.addColorStop(1, '#d1452f');
    c.fillStyle = g; c.fillRect(0, 0, W, H);
    c.fillStyle = 'rgba(255,255,255,0.92)'; rr(c, 18, 18, W - 36, H - 64, 14); c.fill();
    c.fillStyle = '#8a1c1c'; c.font = `900 26px ${FONT}`; c.fillText('🚁 食材の仕入れ', 34, 54);
    ['🍜', '🥩', '🌿', '🥚', '🥟', '🍺'].forEach((e, i) => { const x = 34 + (i % 3) * 150, y = 76 + Math.floor(i / 3) * 84; c.fillStyle = '#fbe9e4'; rr(c, x, y, 136, 72, 10); c.fill(); emoji(c, e, x + 34, y + 36, 40); c.fillStyle = '#f0c4b8'; c.fillRect(x + 64, y + 22, 58, 9); c.fillRect(x + 64, y + 40, 40, 9); });
    c.fillStyle = 'rgba(0,0,0,0.35)'; c.fillRect(0, H - 34, W, 34);
    c.fillStyle = '#fff'; c.font = `800 16px ${FONT}`; c.textAlign = 'right'; c.fillText('RAMEN SHOP OS', W - 16, H - 11);
  });
}
const ticketCache = new Map();
// 券売機のボタン（料理の写真つき。写真はパソコンと同じ3Dモデルの撮影）
function ticketFace(menu) {
  const items = menu.filter((m) => m.on).slice(0, 12), ready = items.filter((m) => thumbCanvas(menuKey(m))).length, key = items.map((m) => m.name + m.price).join('|') + '#' + ready;
  if (ticketCache.has(key)) return ticketCache.get(key);
  for (const m of items) requestThumb(menuKey(m));
  const t = canvasTex(512, 512, (c, W, H) => {
    c.fillStyle = '#16212b'; c.fillRect(0, 0, W, H);
    items.forEach((m, i) => {
      const x = 10 + (i % 3) * 167, y = 10 + Math.floor(i / 3) * 124, w = 158, h = 116;
      c.fillStyle = m.kind === 'ramen' ? '#fff6df' : '#e3f3ff'; rr(c, x, y, w, h, 10); c.fill();
      const img = thumbCanvas(menuKey(m)); if (img) c.drawImage(img, x + (w - 78) / 2, y + 2, 78, 78);
      else { c.font = `56px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(m.kind === 'ramen' ? '🍜' : '🍽️', x + w / 2, y + 40); }
      c.textBaseline = 'alphabetic'; c.fillStyle = '#2a1a10'; c.font = `800 19px ${FONT}`; c.textAlign = 'center'; c.fillText(m.name.slice(0, 8), x + w / 2, y + 94, w - 10);
      c.fillStyle = '#b71c1c'; c.font = `900 17px ${FONT}`; c.fillText('¥' + m.price.toLocaleString(), x + w / 2, y + 112);
    });
  });
  ticketCache.set(key, t);
  return t;
}
let slotT = null;
const slotFace = () => slotT ||= canvasTex(256, 140, (c, W, H) => {
  c.fillStyle = '#111'; c.fillRect(0, 0, W, H);
  for (let i = 0; i < 3; i++) { c.fillStyle = '#fffdf6'; rr(c, 10 + i * 80, 12, 74, H - 24, 8); c.fill(); emoji(c, ['7️⃣', '🍒', '🍜'][i], 47 + i * 80, H / 2, 46); }
});
let tatamiT = null;
export const tatamiTex = () => tatamiT ||= canvasTex(256, 512, (c, W, H) => {
  c.fillStyle = '#c9c48a'; c.fillRect(0, 0, W, H);
  for (let y = 0; y < H; y += 4) { c.fillStyle = y % 8 ? 'rgba(80,90,30,0.12)' : 'rgba(255,255,220,0.12)'; c.fillRect(0, y, W, 2); }
  c.fillStyle = '#2b3a2a'; c.fillRect(0, 0, 14, H); c.fillRect(W - 14, 0, 14, H);
});
export function buildFixture(f, ctx) {
  const fn = BUILD[f.t];
  const g = fn ? fn(f, ctx) : new THREE.Group();
  // 壊れた設備は黒こげに
  if (f.br) g.traverse((o) => { if (o.isMesh && o.material?.isMeshStandardMaterial) o.material = mat(0x2a2522, { r: 0.95 }); });
  return g;
}
export const FIX_SOUP = SOUPS;
