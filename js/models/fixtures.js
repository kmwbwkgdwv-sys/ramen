// ===== 設備（厨房機器・客席・券売機・賭場・装飾）の3Dモデル =====
import * as THREE from 'three';
import { thumbCanvas, requestThumb, menuKey } from '../thumbs.js';
import { FIXTURES, TOPPINGS, SOUPS, basketPos, passPos } from '../data.js';
import { tex, surf, signTexture, canvasTex, emoji, FONT, rr, shade } from '../textures.js';
import { mat, smat, glassMat, T, box, rbox, cyl, sph, lathe, plane, torus, cone, add, M, vcolor } from './geo.js';

import { ANCHOR, basic, sinkModel, stoveModel, boilerModel, toppingModel, boardModel, fridgeModel, dishrackModel, passModel, riceModel, gyozaModel, fryerModel, beerModel, tableModel, counterModel, benchModel, waterModel, trashModel, ticketModel, registerModel, plantModel, zashikiModel, kamidanaModel } from './equip.js';
export { ANCHOR, basic };
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
const BUILD = {
  // ---------- 厨房 ----------
  pot(f) { return stoveModel(FIXTURES.pot, ANCHOR.pot); },
  pot2(f) { return stoveModel(FIXTURES.pot2, ANCHOR.pot2); },
  boiler(f) { return boilerModel(FIXTURES.boiler); },
  boiler6(f) { return boilerModel(FIXTURES.boiler6); },
  topping(f) { return toppingModel(); },
  board(f) { return boardModel(); },
  fridge(f) { return fridgeModel(FIXTURES.fridge, 2); },
  fridge2(f) { return fridgeModel(FIXTURES.fridge2, 3); },
  dishrack(f) { return dishrackModel(); },
  sink(f) { return sinkModel(); },
  register(f) { return registerModel(); },
  pass(f) { return passModel(); },
  rice(f) { return riceModel(); },
  gyoza(f) { return gyozaModel(); },
  fryer(f) { return fryerModel(); },
  beer(f) { return beerModel(); },
  // ---------- 客席 ----------
  counter(f) { return counterModel(FIXTURES.counter); },
  counter2(f) { return counterModel(FIXTURES.counter2); },
  table2(f) { return tableModel(FIXTURES.table2); },
  table4(f) { return tableModel(FIXTURES.table4); },
  zashiki(f) { return zashikiModel(FIXTURES.zashiki, tatamiTex()); },
  ticket(f, ctx) { return ticketModel(ticketFace(ctx.menu || []), ctx.color || '#c0392b'); },
  bench(f) { return benchModel(); },
  water(f) { return waterModel(); },
  trash(f) { return trashModel(); },
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
    add(g, T(cyl(0.05, 0.05, 0.2, 10), 0, 0.75, 0.12, Math.PI / 2), BLACK());
    add(g, T(sph(0.04, 10, 6), 0, 0.88, 0.16), C(0xff3b3b, { e: 0xff0000, ei: 0.8 }));
    return g;
  },
  // ---------- 装飾 ----------
  plant(f) { return plantModel(); },
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
  kamidana(f) { return kamidanaModel(); },
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
    // 足もとの重し・竿・横棒（旗は置き場所の中に収まるように）
    const px = -0.19;
    add(g, T(rbox(0.12, 0.12, 0.3, 0.02), px + 0.0, 0, 0), DARK());
    add(g, T(cyl(0.02, 0.02, 2.4, 8), px, 0), CHROME());
    add(g, T(cyl(0.012, 0.012, 0.4, 6), px + 0.4, 2.35, 0, 0, 0, Math.PI / 2), CHROME());
    const bg = f.c && f.c !== '#ffffff' ? f.c : ctx.color;
    const t = vtext(f.tx || 'ラーメン', { w: 128, h: 448, bg, fg: '#ffffff', border: '#ffffff' });
    g.add(M(T(plane(0.38, 1.6), 0.01, 1.55, 0.01), basic(t, { side: THREE.DoubleSide })));
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
