// ===== 厨房機器・家具のくわしいモデル（洗い場・コンロ・茹で麺機・冷蔵庫・棚・テーブルなど） =====
import * as THREE from 'three';
import { FIXTURES, basketPos } from '../data.js';
import { surf, signTexture, canvasTex, FONT, rr } from '../textures.js';
import { mat, smat, T, box, rbox, cyl, sph, lathe, plane, torus, cone, add, M, slab, ringRect, rod, tube, dome } from './geo.js';

// 取り付け位置（描画で中身を置く所）。モデルの形はこれに合わせる
export const ANCHOR = {
  pot: { y: 0.5, r: 0.27, h: 0.42 }, pot2: { y: 0.5, r: 0.33, h: 0.48 },
  boilerY: 0.9,
  panY: 0.93, pans: (w) => { const out = []; for (let i = 0; i < 8; i++) out.push([-w / 2 + 0.12 + (i % 4) * ((w - 0.24) / 3), i < 4 ? -0.12 : 0.12]); return out; },
  rack: { ys: [0.12, 0.6, 1.08], xs: [-0.42, -0.14, 0.14, 0.42] },
  sink: [0.25, 0.72, 0], dryRack: [-0.38, 0.895, -0.04], tareMix: [0.5, 0.9, 0.26], tarePots: [-0.3, 0.9, 0.28], passY: 1.06, workY: 0.86, griddleY: 0.93, fryerY: 0.86, riceY: 0.95, beerY: 1.0,
};

const basicCache = new Map();
export function basic(map, o = {}) {
  const k = map.uuid + JSON.stringify(o);
  if (!basicCache.has(k)) basicCache.set(k, new THREE.MeshBasicMaterial({ map, transparent: !!o.t, side: o.side ?? THREE.FrontSide, toneMapped: false, depthWrite: o.dw ?? true }));
  return basicCache.get(k);
}
// ---- 質感 ----
const C = (c, o = {}) => mat(c, { r: 0.55, ...o });
const STEEL = () => smat(surf('metal'), 0xe8ebee, { r: 0.3, m: 0.75 });
const STEEL2 = () => smat(surf('metal'), 0xc9ced3, { r: 0.3, m: 0.75 });
const DARKSTEEL = () => C(0x6d737a, { r: 0.45, m: 0.6 });
const CHROME = () => C(0xdfe3e8, { r: 0.18, m: 0.9 });
const BLACK = () => C(0x1c1d20, { r: 0.4 });
const RUBBER = () => C(0x252525, { r: 0.85 });
const IRON = () => C(0x2a2b2d, { r: 0.5, m: 0.55 });
const WOOD = () => smat(surf('wood'), 0xffffff, { r: 0.6 });
const DWOOD = () => smat(surf('wood'), 0x7a5236, { r: 0.6 });
const LWOOD = () => smat(surf('wood'), 0xf2dcb4, { r: 0.6 });
const GLASS = () => mat(0xd8f0ff, { r: 0.05, m: 0.1, t: true, op: 0.35 });
const glow = (c, i = 1) => mat(c, { e: c, ei: i, r: 0.4 });
// 文字の板（ラベル）。z は前向きの面
function label(g, text, w, h, x, y, z, o = {}) {
  const m = M(plane(w, h), basic(signTexture(text, { w: Math.round(256 * w / h), h: 256, radius: 24, ...o })), false);
  m.position.set(x + Math.sin(o.ry || 0) * 0.002, y, z + Math.cos(o.ry || 0) * 0.002); if (o.ry) m.rotation.y = o.ry; if (o.rx) m.rotation.x = o.rx; g.add(m); return m;
}
// 液晶の小さな表示
const lcdCache = new Map();
function lcd(text, { bg = '#0d1f17', fg = '#62ffa8', w = 256, h = 96 } = {}) {
  const k = text + bg + fg; if (lcdCache.has(k)) return lcdCache.get(k);
  const t = canvasTex(w, h, (c) => { c.fillStyle = bg; c.fillRect(0, 0, w, h); c.fillStyle = fg; c.shadowColor = fg; c.shadowBlur = 10; c.font = `800 ${h * 0.62}px ui-monospace,Menlo,${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(text, w / 2, h / 2 + 2); });
  lcdCache.set(k, t); return t;
}
function screen(g, text, w, h, x, y, z, o = {}) { const m = M(plane(w, h), basic(lcd(text, o)), false); m.position.set(x, y, z); if (o.rx) m.rotation.x = o.rx; g.add(m); return m; }

// ---- 共通の部品 ----
// 丸パイプの脚（アジャスター付き）と下棚
function legs(g, w, d, h, { inset = 0.05, shelf = 0.16, r = 0.019, mat: m = STEEL } = {}) {
  const xs = [-w / 2 + inset, w / 2 - inset], zs = [-d / 2 + inset, d / 2 - inset];
  for (const x of xs) for (const z of zs) {
    add(g, T(cyl(r, r, h - 0.055, 10), x, 0.055, z), m());
    add(g, T(cyl(r * 0.85, r * 1.15, 0.045, 10), x, 0.01, z), m());
    add(g, T(cyl(r * 1.3, r * 1.3, 0.01, 10), x, 0, z), RUBBER());
  }
  if (shelf) {
    add(g, T(box(w - inset * 2 + 0.05, 0.02, d - inset * 2 + 0.05), 0, shelf), STEEL());
    add(g, T(box(w - inset * 2 + 0.054, 0.038, 0.012), 0, shelf - 0.015, d / 2 - inset + 0.025), STEEL());
    add(g, T(box(w - inset * 2 + 0.054, 0.038, 0.012), 0, shelf - 0.015, -d / 2 + inset - 0.025), STEEL());
  }
}
// 天板（前の縁を丸く折り返した作業台の板）と立ち上がり（バックガード）
function worktop(g, w, d, y, { t = 0.035, splash = 0.1, holes = [], front = true } = {}) {
  add(g, T(slab(w, d, t, 0.006, holes), 0, y - t), STEEL());
  if (front) add(g, T(rbox(w, 0.047, 0.025, 0.01), 0, y - 0.05, d / 2 - 0.006), STEEL());
  if (splash) {
    add(g, T(box(w, splash, 0.014), 0, y, -d / 2 + 0.007), STEEL());
    add(g, rod([-w / 2, y + splash, -d / 2 + 0.014], [w / 2, y + splash, -d / 2 + 0.014], 0.011, 10), STEEL());
  }
}
// 縦の棒の取っ手（2本の脚つき）
function barHandle(g, x, y0, y1, z, r = 0.009) {
  add(g, rod([x, y0, z], [x, y1, z], r, 10), CHROME());
  for (const y of [y0 + 0.02, y1 - 0.02]) add(g, rod([x, y, z - 0.024], [x, y, z], r * 0.8, 8), CHROME());
}
// 横の取っ手
function pullHandle(g, x, y, w, z, r = 0.008) {
  add(g, rod([x - w / 2, y, z], [x + w / 2, y, z], r, 10), CHROME());
  for (const s of [-1, 1]) add(g, rod([x + s * (w / 2 - 0.015), y, z - 0.022], [x + s * (w / 2 - 0.015), y, z], r * 0.8, 8), CHROME());
}
// ステンレスのキャビネット（扉と取っ手・幅木）。扉の前面は z=d/2
function cabinet(g, w, h, d, { doors = 2, kick = 0.08, handle = 'bar', y0 = 0, vent = false } = {}) {
  add(g, T(box(w, h - kick, d - 0.02), 0, y0 + kick, -0.01), STEEL2());
  add(g, T(box(w - 0.06, kick, d - 0.08), 0, y0, -0.04), DARKSTEEL());
  if (vent) for (let i = 0; i < 3; i++) add(g, T(box(w - 0.14, 0.008, 0.01), 0, y0 + 0.018 + i * 0.02, d / 2 - 0.045), BLACK());
  const dw = (w - 0.02) / doors, dh = h - kick - 0.03;
  for (let i = 0; i < doors; i++) {
    const x = -w / 2 + 0.01 + dw * (i + 0.5);
    add(g, T(rbox(dw - 0.012, dh, 0.022, 0.006), x, y0 + kick + 0.012, d / 2 - 0.014), STEEL());
    if (handle === 'bar') { const hx = x + (doors === 1 ? dw / 2 - 0.06 : (i % 2 ? -1 : 1) * (dw / 2 - 0.05)); barHandle(g, hx, y0 + kick + dh * 0.45, y0 + kick + dh * 0.85, d / 2 + 0.022); }
    else pullHandle(g, x, y0 + kick + dh - 0.05, Math.min(0.3, dw * 0.6), d / 2 + 0.02);
  }
}
// つまみ（前向き）
function knob(g, x, y, z, { r = 0.028, c = 0x1c1d20, ring = true } = {}) {
  if (ring) add(g, T(cyl(r * 1.35, r * 1.35, 0.004, 18), x, y, z, Math.PI / 2), CHROME());
  add(g, T(cyl(r, r * 0.92, 0.018, 16), x, y, z, Math.PI / 2), C(c, { r: 0.35 }));
  add(g, T(box(r * 0.35, r * 1.6, 0.01), x, y - r * 0.8, z + 0.017), C(c, { r: 0.35 }));
}
// ステンレスのボウル（lathe）
function bowl(r, h) { return T(lathe([[0, 0], [r * 0.45, 0], [r * 0.8, h * 0.25], [r * 0.98, h * 0.75], [r, h], [r * 1.04, h], [r * 1.04, h * 1.04], [r * 0.97, h * 1.02], [r * 0.95, h * 0.78], [r * 0.77, h * 0.3], [r * 0.43, h * 0.05], [0, h * 0.05]], 22), 0, 0.0015); }
// 網のかご（針金）。中心が原点、底が y=0
function wireBasket(g, w, d, h, x, y, z, m = CHROME) {
  const r = 0.0035, P = (a, b) => add(g, rod(a, b, r, 4), m());
  const x0 = x - w / 2, x1 = x + w / 2, z0 = z - d / 2, z1 = z + d / 2, y1 = y + h;
  for (const yy of [y, y1, y + h * 0.5]) { P([x0, yy, z0], [x1, yy, z0]); P([x0, yy, z1], [x1, yy, z1]); P([x0, yy, z0], [x0, yy, z1]); P([x1, yy, z0], [x1, yy, z1]); }
  const nx = Math.max(2, Math.round(w / 0.035)), nz = Math.max(2, Math.round(d / 0.035));
  for (let i = 1; i < nx; i++) { const xx = x0 + i * w / nx; P([xx, y, z0], [xx, y, z1]); P([xx, y, z0], [xx, y1, z0]); P([xx, y, z1], [xx, y1, z1]); }
  for (let i = 1; i < nz; i++) { const zz = z0 + i * d / nz; P([x0, y, zz], [x1, y, zz]); P([x0, y, zz], [x0, y1, zz]); P([x1, y, zz], [x1, y1, zz]); }
}

// ================= 洗い場（一槽シンク＋水切り台＋プレリンス水栓） =================
export function sinkModel() {
  const g = new THREE.Group(), d = FIXTURES.sink, W = d.w, D = d.d, TOP = 0.88;
  const [sx, , sz0] = ANCHOR.sink, sz = sz0 + 0.02, BW = 0.66, BD = 0.52, FLOOR = ANCHOR.sink[1] - 0.005;
  // 脚と下棚
  legs(g, W, D, FLOOR, { inset: 0.06, shelf: 0.15 });
  // 天板（シンクの穴あき）・前の縁・立ち上がり
  worktop(g, W, D, TOP, { t: 0.03, splash: 0.2, holes: [{ x: sx, z: sz, w: BW, d: BD, r: 0.05 }] });
  // 天板のまわりの水返し（ふち）
  add(g, T(rbox(W, 0.014, 0.018, 0.006), 0, TOP, D / 2 - 0.012), STEEL());
  for (const s of [-1, 1]) add(g, T(rbox(0.018, 0.014, D - 0.03, 0.006), s * (W / 2 - 0.009), TOP, 0.01), STEEL());
  // 深いシンク（中が空洞の槽）と底・排水口
  add(g, T(ringRect(BW, BD, TOP - FLOOR + 0.02, 0.012, 0.05), sx, FLOOR - 0.02, sz), STEEL());
  add(g, T(slab(BW - 0.004, BD - 0.004, 0.02, 0.05), sx, FLOOR - 0.022, sz), C(0xaab1b8, { r: 0.28, m: 0.8 }));
  const dx = sx + BW / 2 - 0.12, dz = sz - BD / 2 + 0.1;
  add(g, T(torus(0.042, 0.007, 6, 20), dx, FLOOR + 0.002, dz, Math.PI / 2), CHROME());
  add(g, T(cyl(0.038, 0.038, 0.003, 20), dx, FLOOR, dz), C(0x3a3d41, { r: 0.4, m: 0.6 }));
  for (const a of [0, Math.PI / 2]) add(g, T(box(0.07, 0.004, 0.006), dx, FLOOR + 0.003, dz, 0, a), CHROME());
  // 排水管（下に見える）
  add(g, T(cyl(0.025, 0.025, FLOOR - 0.24, 10), dx, 0.22, dz), C(0x9aa2a9, { r: 0.4, m: 0.6 }));
  add(g, rod([dx, 0.24, dz], [dx, 0.24, -D / 2 + 0.03], 0.025, 10), C(0x9aa2a9, { r: 0.4, m: 0.6 }));
  // 水切り台の溝（左側）
  const lx0 = -W / 2 + 0.04, lx1 = sx - BW / 2 - 0.02;
  for (let i = 0; i < 9; i++) add(g, T(box(0.008, 0.004, D - 0.12), lx0 + 0.03 + i * (lx1 - lx0 - 0.06) / 8, TOP, 0.0), STEEL2());
  // ---- 水栓（混合栓・ハンドル・プレリンスのばね付きシャワー） ----
  const wz = -D / 2 + 0.02, my = TOP + 0.11, cz = wz + 0.035;
  for (const s of [-1, 1]) {
    add(g, rod([sx + s * 0.12, my, wz], [sx + s * 0.12, my, cz], 0.012, 10), CHROME());
    add(g, T(cyl(0.02, 0.02, 0.05, 14), sx + s * 0.12, my - 0.025, cz), CHROME());
    for (const a of [0, Math.PI / 2]) add(g, T(box(0.075, 0.01, 0.012), sx + s * 0.12, my + 0.03, cz, 0, a + Math.PI / 4), CHROME());
    add(g, T(cyl(0.012, 0.012, 0.012, 12), sx + s * 0.12, my + 0.03, cz), C(s < 0 ? 0x2e6fd6 : 0xd63a2e, { r: 0.3 }));
  }
  add(g, rod([sx - 0.12, my - 0.01, cz], [sx + 0.12, my - 0.01, cz], 0.016, 12), CHROME());
  add(g, T(cyl(0.022, 0.022, 0.06, 14), sx, my - 0.04, cz), CHROME());
  // 首振りの吐水口（シンクの上に出る）
  const spz = sz - 0.17; // 吐水口は奥側（洗い物の山に当たらない）
  add(g, tube([[sx, my - 0.01, cz], [sx, my + 0.02, cz + 0.05], [sx, my + 0.03, cz + 0.12], [sx, my + 0.02, spz - 0.02], [sx, my - 0.03, spz]], 0.011, 18, 8), CHROME());
  add(g, T(cyl(0.014, 0.012, 0.03, 10), sx, my - 0.06, spz), CHROME());
  // 立ち上がりの管と上のアーム
  const ry = 1.62, hz = sz - 0.15;
  add(g, rod([sx, my, cz], [sx, ry, cz], 0.012, 10), CHROME());
  add(g, rod([sx, 1.42, wz], [sx, 1.42, cz], 0.008, 8), CHROME());
  add(g, T(cyl(0.02, 0.02, 0.012, 12), sx, 1.415, wz + 0.006, Math.PI / 2), CHROME());
  add(g, tube([[sx, ry - 0.04, cz], [sx, ry + 0.02, cz + 0.02], [sx, ry + 0.03, cz + 0.08], [sx, ry - 0.01, hz - 0.02], [sx, ry - 0.06, hz]], 0.011, 18, 8), CHROME());
  // ばね（コイル）とホース、シャワーヘッド
  const hy1 = ry - 0.07, hy0 = 1.13;
  add(g, rod([sx, hy1, hz], [sx, hy0 + 0.1, hz], 0.008, 8), C(0x3a3d41, { r: 0.5 }));
  for (let i = 0; i < 16; i++) add(g, T(torus(0.022, 0.003, 4, 14), sx, hy1 - 0.02 - i * 0.017, hz, Math.PI / 2 + 0.12), CHROME());
  add(g, T(cyl(0.02, 0.016, 0.1, 12), sx, hy0, hz), CHROME());
  add(g, T(cyl(0.024, 0.024, 0.06, 12), sx, hy0 + 0.04, hz), BLACK());
  add(g, T(box(0.012, 0.06, 0.04), sx, hy0 + 0.02, hz + 0.03, 0.25), C(0x2a2a2a, { r: 0.5 }));
  add(g, T(cyl(0.026, 0.02, 0.012, 14), sx, hy0 - 0.008, hz), C(0x8c939a, { r: 0.4, m: 0.7 }));
  // ---- 水切りかご（針金のかご） ----
  const [rx, , rz] = ANCHOR.dryRack, RW = 0.56, RD = 0.44, ry0 = TOP + 0.006;
  add(g, T(slab(RW + 0.02, RD + 0.02, 0.008, 0.02), rx, TOP, rz), C(0xd8dde1, { r: 0.3, m: 0.6 }));
  const wire = (a, b, r = 0.0035) => add(g, rod(a, b, r, 4), CHROME());
  const X0 = rx - RW / 2, X1 = rx + RW / 2, Z0 = rz - RD / 2, Z1 = rz + RD / 2;
  for (const y of [ry0, ry0 + 0.09, ry0 + 0.15]) { wire([X0, y, Z0], [X1, y, Z0]); wire([X0, y, Z1], [X1, y, Z1]); wire([X0, y, Z0], [X0, y, Z1]); wire([X1, y, Z0], [X1, y, Z1]); }
  for (const x of [X0, rx, X1]) for (const z of [Z0, Z1]) wire([x, ry0, z], [x, ry0 + 0.15, z]);
  for (let i = 1; i < 8; i++) { const z = Z0 + i * RD / 8; wire([X0, ry0, z], [X1, ry0, z], 0.003); }
  // 食器の列の間の低いくし（食器に刺さらない位置）
  for (let i = 0; i < 7; i++) { const x = X0 + 0.016 + i * 0.088; wire([x, ry0, rz - 0.004], [x, ry0 + 0.035, rz], 0.003); }
  wire([X0, ry0 + 0.03, rz], [X1, ry0 + 0.03, rz], 0.003);
  // 箸立て（かごの横）
  add(g, T(cyl(0.035, 0.03, 0.12, 12, true), X0 - 0.0, ry0, Z1 + 0.06), mat(0xdfe3e8, { r: 0.2, m: 0.85, side: THREE.DoubleSide }));
  for (let i = 0; i < 6; i++) add(g, rod([X0 - 0.015 + (i % 3) * 0.015, ry0 + 0.01, Z1 + 0.05 + (i > 2 ? 0.02 : 0)], [X0 - 0.03 + (i % 3) * 0.02, ry0 + 0.2, Z1 + 0.04 + (i > 2 ? 0.03 : 0)], 0.003, 4), C(0xc8955a, { r: 0.6 }));
  // ---- 洗剤（ポンプボトル）・スポンジ・たわし ----
  const bx = sx + BW / 2 + 0.055;
  add(g, T(lathe([[0, 0], [0.032, 0], [0.034, 0.01], [0.034, 0.15], [0.028, 0.17], [0.012, 0.18], [0, 0.18]], 16), bx, TOP, -0.22), C(0x2e8bff, { r: 0.25 }));
  add(g, T(cyl(0.008, 0.008, 0.04, 8), bx, TOP + 0.18, -0.22), C(0xffffff, { r: 0.4 }));
  add(g, T(box(0.016, 0.012, 0.05), bx, TOP + 0.215, -0.205), C(0xffffff, { r: 0.4 }));
  label(g, '洗剤', 0.05, 0.035, bx, TOP + 0.09, -0.22 + 0.0345, { bg: '#ffffff', fg: '#1a5fbf', radius: 30 });
  add(g, T(rbox(0.09, 0.022, 0.06, 0.008), bx, TOP, 0.05), C(0xf4d03f, { r: 0.85 }));
  add(g, T(rbox(0.09, 0.012, 0.06, 0.004), bx, TOP + 0.022, 0.05), C(0x2e9e4f, { r: 0.9 }));
  add(g, T(sph(0.035, 10, 6), bx, TOP + 0.018, 0.18, 0, 0.4, 0, 1, 0.5, 1.4), C(0x8a6a3a, { r: 1 }));
  // ---- 下棚：洗い桶とバケツ ----
  add(g, T(ringRect(0.46, 0.34, 0.16, 0.01, 0.05), -0.3, 0.17, 0.02), C(0x2f6fd0, { r: 0.6 }));
  add(g, T(slab(0.454, 0.334, 0.01, 0.05), -0.3, 0.172, 0.02), C(0x2f6fd0, { r: 0.6 }));
  add(g, T(cyl(0.13, 0.11, 0.22, 18, true), 0.35, 0.17, 0.0), mat(0xf2f2ee, { r: 0.6, side: THREE.DoubleSide }));
  add(g, T(cyl(0.11, 0.11, 0.01, 18), 0.35, 0.17, 0.0), C(0xf2f2ee, { r: 0.6 }));
  add(g, T(torus(0.13, 0.008, 6, 20), 0.35, 0.39, 0.0, Math.PI / 2), C(0xf2f2ee, { r: 0.6 }));
  return g;
}

// ================= 寸胴鍋とスープレンジ（低いガス台・五徳・バーナー・ガス管） =================
// 寸胴鍋だけ（持ち運ぶとき・コンロにのせるとき共通）。y0＝鍋の底の高さ
export function stockPotMesh(A, y0 = 0, ladle = false) {
  const g = new THREE.Group(), r = A.r, h = A.h, py0 = y0, pot = mat(0xdde1e4, { r: 0.22, m: 0.85, side: THREE.DoubleSide });
  add(g, T(lathe([[0, 0], [r - 0.015, 0], [r, 0.015], [r, h - 0.016], [r + 0.006, h - 0.006], [r + 0.004, h + 0.002], [r - 0.006, h], [r - 0.008, h - 0.012], [r - 0.008, 0.02], [r - 0.022, 0.009], [0, 0.009]], 36), 0, py0), pot);
  add(g, T(torus(r + 0.002, 0.006, 6, 36), 0, py0 + 0.03, 0, Math.PI / 2), C(0xc9ced3, { r: 0.3, m: 0.8 }));
  for (const s of [-1, 1]) {
    add(g, T(box(0.012, 0.05, 0.08), s * (r + 0.004), py0 + h - 0.1, 0), CHROME());
    add(g, T(torus(0.045, 0.009, 6, 14, Math.PI), s * (r + 0.01), py0 + h - 0.075, 0, Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2), CHROME());
  }
  // おたま（鍋のふちに掛けて）
  if (ladle) add(g, tube([[r * 0.35, py0 + h * 0.45, 0.06], [r - 0.02, py0 + h + 0.02, 0.08], [r + 0.02, py0 + h + 0.12, 0.1], [r + 0.04, py0 + h + 0.28, 0.12], [r + 0.02, py0 + h + 0.31, 0.12]], 0.006, 16, 6), CHROME());
  return g;
}
export function stoveModel(def, A, opts = {}) {
  const g = new THREE.Group(), W = def.w, D = def.d, TY = 0.4;
  // 角パイプの脚と枠
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) { add(g, T(box(0.04, TY - 0.03, 0.04), sx * (W / 2 - 0.03), 0.015, sz * (D / 2 - 0.03)), STEEL()); add(g, T(box(0.05, 0.015, 0.05), sx * (W / 2 - 0.03), 0, sz * (D / 2 - 0.03)), RUBBER()); }
  add(g, T(ringRect(W, D, 0.045, 0.04, 0.015), 0, TY - 0.045), STEEL());
  for (const sz of [-1, 1]) add(g, T(box(W - 0.06, 0.03, 0.03), 0, 0.12, sz * (D / 2 - 0.03)), STEEL());
  // 下の受け皿
  add(g, T(slab(W - 0.11, D - 0.11, 0.008, 0.02), 0, 0.142), STEEL2());
  add(g, T(ringRect(W - 0.1, D - 0.1, 0.03, 0.008, 0.02), 0, 0.14), STEEL2());
  // バーナー（鋳物）と支え
  add(g, T(box(W - 0.06, 0.025, 0.05), 0, TY - 0.08), DARKSTEEL());
  add(g, T(cyl(0.125, 0.1, 0.05, 24), 0, TY - 0.06), IRON());
  add(g, T(torus(0.12, 0.012, 6, 28), 0, TY + 0.015, 0, Math.PI / 2), C(0x3a3a3c, { r: 0.6, m: 0.4 }));
  add(g, T(cyl(0.065, 0.07, 0.035, 20), 0, TY - 0.015), IRON());
  add(g, T(cyl(0.035, 0.035, 0.012, 14), 0, TY + 0.02), C(0x4a4a4c, { r: 0.5, m: 0.5 }));
  // 五徳（鍋をのせる鋳物の輪と爪）
  const R5 = Math.min(W, D) / 2 - 0.08, y5 = A.y - 0.05;
  add(g, T(torus(R5, 0.014, 6, 32), 0, y5 - 0.02, 0, Math.PI / 2), IRON());
  for (let i = 0; i < 6; i++) { const a = i / 6 * Math.PI * 2 + 0.26, rm = (0.14 + R5) / 2; add(g, T(box(R5 - 0.12, 0.028, 0.022), Math.cos(a) * rm, y5 - 0.03, Math.sin(a) * rm, 0, -a, 0), IRON()); }
  for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) { const a = Math.atan2(sz * (D / 2 - 0.03), sx * (W / 2 - 0.03)); add(g, rod([Math.cos(a) * R5, y5 - 0.02, Math.sin(a) * R5], [sx * (W / 2 - 0.035), TY, sz * (D / 2 - 0.035)], 0.012, 6), IRON()); }
  // ガス管・コック・ホース
  const pz = D / 2 - 0.075, py = 0.27, brass = C(0xc9a227, { r: 0.35, m: 0.8 });
  add(g, rod([-W / 2 + 0.04, py, pz], [0, py, pz], 0.012, 8), brass);
  add(g, rod([0, py, pz], [0, py, 0], 0.012, 8), brass);
  add(g, rod([0, py, 0], [0, TY - 0.06, 0], 0.014, 8), brass);
  add(g, T(cyl(0.022, 0.022, 0.05, 12), -0.12, py - 0.025, pz), brass);
  add(g, T(box(0.13, 0.012, 0.026), -0.07, py + 0.03, pz + 0.01, 0, -0.35), C(0xd62828, { r: 0.35 }));
  add(g, T(cyl(0.02, 0.02, 0.05, 12), 0.13, py - 0.01, D / 2 - 0.05, Math.PI / 2), C(0x1c1d20, { r: 0.35 }));
  add(g, rod([0.13, py, pz], [0.13, py, D / 2 - 0.05], 0.008, 6), brass);
  add(g, tube([[-W / 2 + 0.04, py, pz], [-W / 2 + 0.03, py - 0.08, pz - 0.05], [-W / 2 + 0.04, 0.05, 0.0], [-W / 2 + 0.05, 0.02, -D / 2 + 0.05]], 0.014, 20, 8), C(0xf28c28, { r: 0.6 }));
  // 寸胴鍋（ふちを巻いた厚みのある鍋）。持ち出しているときはコンロだけ
  if (opts.pot !== false) g.add(stockPotMesh(A, A.y - 0.05, true));
  return g;
}

// ================= 茹で麺機（てぼの穴・湯・操作盤・蛇口・平ざる） =================
export function boilerModel(def) {
  const g = new THREE.Group(), W = def.w, D = def.d, TOP = ANCHOR.boilerY;
  cabinet(g, W, 0.62, D, { doors: W > 1.2 ? 3 : 2, handle: 'pull', vent: true });
  // 操作盤
  add(g, T(box(W, 0.22, D - 0.02), 0, 0.62, -0.01), STEEL2());
  add(g, T(rbox(W - 0.02, 0.2, 0.02, 0.006), 0, 0.63, D / 2 - 0.012), STEEL());
  const fz = D / 2 + 0.008;
  knob(g, -W / 2 + 0.1, 0.73, fz, { r: 0.03 }); knob(g, -W / 2 + 0.2, 0.73, fz, { r: 0.022, c: 0xb71c1c });
  add(g, T(cyl(0.026, 0.026, 0.01, 18), -W / 2 + 0.31, 0.73, fz, Math.PI / 2), C(0x111111, { r: 0.1 }));
  add(g, T(cyl(0.012, 0.012, 0.012, 12), -W / 2 + 0.31, 0.73, fz + 0.002, Math.PI / 2), glow(0xff8a1e, 1.2));
  screen(g, '0:23', 0.15, 0.06, W / 2 - 0.16, 0.74, fz + 0.003);
  for (let i = 0; i < 3; i++) add(g, T(cyl(0.011, 0.011, 0.01, 12), W / 2 - 0.21 + i * 0.05, 0.67, fz, Math.PI / 2), C([0x2e8b57, 0xd62828, 0x444444][i], { r: 0.4 }));
  label(g, 'ゆで麺機', 0.16, 0.04, 0, 0.79, fz, { bg: '#2b2f33', fg: '#ffffff' });
  add(g, T(box(0.03, 0.03, 0.02), 0.0, 0.66, fz), CHROME()); add(g, T(box(0.1, 0.015, 0.016), 0.04, 0.68, fz + 0.016, 0, 0, -0.3), C(0xd62828));
  // 湯（穴からのぞく）・天板（てぼの丸穴）・穴のふち
  add(g, T(box(W - 0.06, 0.006, D - 0.1), 0, TOP - 0.05, 0), mat(0x8fc3d6, { r: 0.05, m: 0.1, e: 0x1d4a5a, ei: 0.25 }));
  const holes = []; for (let i = 0; i < def.baskets; i++) { const [x, z] = basketPos(def.id, i); holes.push({ x, z, rad: 0.1, n: 24 }); }
  add(g, T(slab(W, D, 0.03, 0.01, holes), 0, TOP - 0.03), STEEL());
  for (const o of holes) { add(g, T(torus(0.1, 0.008, 6, 24), o.x, TOP, o.z, Math.PI / 2), CHROME()); add(g, T(cyl(0.1, 0.1, 0.045, 24, true), o.x, TOP - 0.05, o.z), mat(0x7d868e, { r: 0.4, m: 0.7, side: THREE.DoubleSide })); }
  add(g, T(rbox(W, 0.04, 0.025, 0.01), 0, TOP - 0.045, D / 2 - 0.006), STEEL());
  // 後ろの立ち上がり・てぼ掛け・排気口
  add(g, T(box(W, 0.3, 0.04), 0, TOP, -D / 2 + 0.02), STEEL());
  add(g, rod([-W / 2, TOP + 0.3, -D / 2 + 0.03], [W / 2, TOP + 0.3, -D / 2 + 0.03], 0.016, 10), STEEL());
  for (let i = 0; i < 6; i++) add(g, T(box(0.05, 0.012, 0.004), -0.15 + i * 0.06, TOP + 0.24, -D / 2 + 0.041), BLACK());
  add(g, rod([-W / 2 + 0.04, TOP + 0.2, -D / 2 + 0.1], [W / 2 - 0.04, TOP + 0.2, -D / 2 + 0.1], 0.008, 8), CHROME());
  for (const s of [-1, 1]) add(g, rod([s * (W / 2 - 0.04), TOP + 0.2, -D / 2 + 0.04], [s * (W / 2 - 0.04), TOP + 0.2, -D / 2 + 0.1], 0.008, 6), CHROME());
  // 平ざる（掛けてある）
  const hx = W / 2 - 0.12;
  add(g, rod([hx, TOP + 0.2, -D / 2 + 0.1], [hx, TOP + 0.05, -D / 2 + 0.11], 0.006, 6), C(0x6b4a30, { r: 0.6 }));
  add(g, T(cyl(0.07, 0.07, 0.008, 20), hx, TOP - 0.02, -D / 2 + 0.115, Math.PI / 2), C(0xb7bec4, { r: 0.45, m: 0.7 }));
  add(g, T(torus(0.07, 0.005, 5, 20), hx, TOP - 0.02, -D / 2 + 0.12), CHROME());
  // 給湯の蛇口
  const fx = -W / 2 + 0.12;
  add(g, rod([fx, TOP + 0.16, -D / 2 + 0.04], [fx, TOP + 0.16, -D / 2 + 0.09], 0.012, 10), CHROME());
  add(g, tube([[fx, TOP + 0.16, -D / 2 + 0.09], [fx, TOP + 0.22, -D / 2 + 0.13], [fx, TOP + 0.2, -D / 2 + 0.25], [fx, TOP + 0.12, -D / 2 + 0.3]], 0.01, 14, 8), CHROME());
  for (const a of [0, Math.PI / 2]) add(g, T(box(0.06, 0.008, 0.01), fx, TOP + 0.19, -D / 2 + 0.065, 0, a + 0.7), CHROME());
  return g;
}

// ================= トッピング台（コールドテーブル・ホテルパン・道具掛け） =================
export function toppingModel() {
  const g = new THREE.Group(), d = FIXTURES.topping, W = d.w, D = d.d, TOP = 0.9;
  cabinet(g, W, TOP - 0.04, D, { doors: 2, handle: 'pull', vent: true });
  worktop(g, W, D, TOP, { splash: 0.26 });
  screen(g, '3℃', 0.08, 0.035, W / 2 - 0.1, TOP - 0.09, D / 2 + 0.0, { bg: '#08131c', fg: '#6fd3ff' });
  const pans = ANCHOR.pans(W);
  add(g, T(slab(W - 0.06, 0.46, 0.02, 0.012, pans.map(([x, z]) => ({ x, z, w: 0.162, d: 0.162, r: 0.01 }))), 0, TOP, 0), STEEL());
  const pm = C(0x9aa0a6, { r: 0.35, m: 0.7 });
  for (const [x, z] of pans) {
    add(g, T(box(0.144, 0.003, 0.144), x, TOP + 0.002, z), pm);
    add(g, T(ringRect(0.152, 0.152, 0.05, 0.003, 0.008), x, TOP, z), mat(0xe8ebee, { r: 0.3, m: 0.75, side: THREE.DoubleSide }));
    add(g, T(ringRect(0.172, 0.172, 0.007, 0.012, 0.012), x, TOP + 0.046, z), CHROME());
  }
  // 道具掛け（おたま・トング・網じゃくし・菜箸）
  const ry = TOP + 0.2, rz = -D / 2 + 0.045;
  add(g, rod([-W / 2 + 0.06, ry, rz], [W / 2 - 0.06, ry, rz], 0.008, 8), CHROME());
  for (const s of [-1, 1]) add(g, rod([s * (W / 2 - 0.08), ry, -D / 2 + 0.014], [s * (W / 2 - 0.08), ry, rz], 0.007, 6), CHROME());
  const ladle = (x, rr0, len) => {
    add(g, tube([[x, ry + 0.015, rz - 0.004], [x, ry + 0.03, rz + 0.01], [x, ry, rz + 0.02], [x, ry - len, rz + 0.02]], 0.004, 12, 5), CHROME());
    add(g, T(dome(rr0, 14, 5), x, ry - len - rr0 * 0.4, rz + 0.02 + rr0, -Math.PI / 2), mat(0xdfe3e8, { r: 0.18, m: 0.9, side: THREE.DoubleSide }));
  };
  ladle(-W / 2 + 0.16, 0.04, 0.14); ladle(-W / 2 + 0.28, 0.032, 0.12);
  // 網じゃくし
  const sx = W / 2 - 0.36;
  add(g, rod([sx, ry + 0.01, rz + 0.01], [sx, ry - 0.13, rz + 0.02], 0.004, 5), CHROME());
  add(g, T(cyl(0.045, 0.045, 0.006, 16), sx, ry - 0.17, rz + 0.025, Math.PI / 2), C(0xb7bec4, { r: 0.45, m: 0.7 }));
  add(g, T(torus(0.045, 0.004, 5, 16), sx, ry - 0.17, rz + 0.03), CHROME());
  // トング
  const tx = W / 2 - 0.22;
  add(g, T(torus(0.012, 0.004, 5, 10), tx, ry, rz + 0.01), CHROME());
  for (const s of [-1, 1]) add(g, rod([tx, ry - 0.01, rz + 0.012], [tx + s * 0.022, ry - 0.2, rz + 0.016], 0.005, 5), CHROME());
  // 菜箸立て
  add(g, T(cyl(0.03, 0.028, 0.11, 12, true), W / 2 - 0.08, TOP, -D / 2 + 0.07), mat(0xdfe3e8, { r: 0.2, m: 0.85, side: THREE.DoubleSide }));
  for (let i = 0; i < 4; i++) add(g, rod([W / 2 - 0.09 + i * 0.006, TOP + 0.01, -D / 2 + 0.065 + (i % 2) * 0.01], [W / 2 - 0.1 + i * 0.012, TOP + 0.3, -D / 2 + 0.06 + (i % 2) * 0.02], 0.003, 4), C(0xc8955a, { r: 0.6 }));
  return g;
}

// ================= まな板（仕込み台・包丁・マグネットバー・ボウル） =================
function knifeGeo(len = 0.2, wid = 0.042) {
  const s = new THREE.Shape(); s.moveTo(0, 0); s.lineTo(len * 0.8, 0); s.quadraticCurveTo(len, 0, len, wid * 0.2); s.quadraticCurveTo(len * 0.75, wid, len * 0.3, wid); s.lineTo(0, wid); s.lineTo(0, 0);
  return new THREE.ExtrudeGeometry(s, { depth: 0.002, bevelEnabled: false, curveSegments: 4 });
}
export function boardModel() {
  const g = new THREE.Group(), d = FIXTURES.board, W = d.w, D = d.d, TOP = 0.9;
  legs(g, W, D, TOP - 0.035, { shelf: 0.17 });
  worktop(g, W, D, TOP, { splash: 0.14 });
  add(g, T(rbox(0.55, 0.035, 0.36, 0.008), -0.1, TOP), LWOOD());
  // 包丁（台の上）
  const kn = M(knifeGeo(), C(0xd9dee2, { r: 0.2, m: 0.9 })); kn.rotation.set(-Math.PI / 2, 0, 0.5); kn.position.set(0.23, TOP + 0.002, 0.22); g.add(kn);
  add(g, T(rbox(0.11, 0.02, 0.024, 0.008), 0.205, TOP, 0.24, 0, -0.5), C(0x3a2618, { r: 0.6 }));
  // マグネットバーと掛けた包丁
  add(g, T(rbox(0.42, 0.035, 0.018, 0.006), 0.2, TOP + 0.08, -D / 2 + 0.023), BLACK());
  [[0.06, 0.2], [0.17, 0.17], [0.3, 0.22]].forEach(([x, l]) => {
    const k = M(knifeGeo(l, 0.04), C(0xd9dee2, { r: 0.2, m: 0.9 })); k.rotation.set(0, 0, -Math.PI / 2); k.position.set(x, TOP + 0.09, -D / 2 + 0.034); g.add(k);
    add(g, T(rbox(0.024, 0.1, 0.02, 0.008), x + 0.02, TOP + 0.09, -D / 2 + 0.04), C(0x3a2618, { r: 0.6 }));
  });
  // ボウル
  add(g, T(bowl(0.1, 0.07), 0.44, TOP, -0.17), mat(0xdfe3e8, { r: 0.2, m: 0.85, side: THREE.DoubleSide }));
  add(g, T(bowl(0.075, 0.055), 0.46, TOP, 0.06), mat(0xdfe3e8, { r: 0.2, m: 0.85, side: THREE.DoubleSide }));
  // 下棚の保存容器
  for (let i = 0; i < 3; i++) { const x = -0.4 + i * 0.27; add(g, T(rbox(0.24, 0.12, 0.3, 0.015), x, 0.18, 0), mat(0xf4f4f0, { r: 0.3, t: true, op: 0.85 })); add(g, T(rbox(0.25, 0.02, 0.31, 0.01), x, 0.3, 0), C([0x2f6fd0, 0x2e9e4f, 0xd6402e][i], { r: 0.5 })); }
  return g;
}

// ================= 業務用冷蔵庫（4ドア/6ドア・取っ手・温度表示） =================
export function fridgeModel(def, cols, open = false) {
  const g = new THREE.Group(), W = def.w, D = def.d, H = 1.92, K = 0.1, HD = 0.15;
  const dw = W / cols, y0 = K + 0.005, y1 = H - HD, mid = (y0 + y1) / 2 + 0.06, fz = D / 2 - 0.02;
  const bodyM = STEEL2(), doorM = smat(surf('metal'), 0xf2f4f6, { r: 0.25, m: 0.7 });
  if (!open) add(g, T(rbox(W, H - K, D - 0.02, 0.012), 0, K, -0.01), bodyM);
  else {
    // 扉を開けたとき：中が見える箱（背板・側板・天井・底）と白い内張り、ワイヤー棚
    const t = 0.03, liner = C(0xeef2f5, { r: 0.5 }), wire = CHROME();
    add(g, T(box(W - t * 2, H - K, t), 0, K, -D / 2 + t / 2), bodyM);
    for (const sx of [-1, 1]) add(g, T(box(t, H - K, D - 0.02), sx * (W / 2 - t / 2), K, -0.01), bodyM);
    add(g, T(box(W - t * 2, 0.04, D - 0.02), 0, y1 - 0.04, -0.01), bodyM);
    add(g, T(box(W - t * 2, 0.03, D - 0.02), 0, K, -0.01), bodyM);
    add(g, T(box(W - t * 2 - 0.004, y1 - K - 0.07, 0.006), 0, K + 0.03, -D / 2 + t + 0.003), liner);
    for (const sx of [-1, 1]) add(g, T(box(0.006, y1 - K - 0.07, D - t - 0.05), sx * (W / 2 - t - 0.003), K + 0.03, 0.0), liner);
    add(g, T(box(W - t * 2 - 0.01, 0.006, D - t - 0.06), 0, K + 0.03, 0.0), liner);
    // 庫内灯
    add(g, T(box(W * 0.6, 0.012, 0.05), 0, y1 - 0.055, -D / 2 + 0.12), mat(0xffffff, { e: 0xf4fbff, ei: 1.2 }));
    // 扉と扉のあいだの柱
    for (let c = 1; c < cols; c++) add(g, T(box(0.03, y1 - K - 0.04, 0.03), -W / 2 + dw * c, K + 0.03, fz - 0.02), bodyM);
    // ワイヤー棚（ます目の高さ）
    for (const y of [0.54, 0.94, 1.34]) {
      add(g, T(box(W - t * 2 - 0.02, 0.008, D - 0.12), 0, y - 0.008, -0.02), C(0xd9dee3, { r: 0.3, m: 0.6 }));
      add(g, T(box(W - t * 2 - 0.02, 0.018, 0.01), 0, y - 0.016, D / 2 - 0.078), wire);
    }
    add(g, T(box(W - t * 2 - 0.02, 0.008, D - 0.12), 0, 0.132, -0.02), C(0xd9dee3, { r: 0.3, m: 0.6 }));
  }
  add(g, T(box(W - 0.04, K, D - 0.1), 0, 0, -0.04), DARKSTEEL());
  for (let i = 0; i < 4; i++) add(g, T(box(W - 0.12, 0.008, 0.01), 0, 0.02 + i * 0.02, D / 2 - 0.055), BLACK());
  for (let c = 0; c < cols; c++) {
    const x = -W / 2 + dw * (c + 0.5), side = cols === 2 ? (c ? -1 : 1) : (c === 0 ? 1 : c === cols - 1 ? -1 : 1);
    for (const [a, b] of [[y0, mid], [mid, y1]]) {
      // 扉：開けると蝶番（外側のふち）を軸に外へ開く
      const door = new THREE.Group(), hx = c < cols / 2 ? -W / 2 + dw * c : -W / 2 + dw * (c + 1), dx = x - hx;
      door.position.set(hx, 0, fz); g.add(door);
      add(door, T(rbox(dw - 0.016, b - a - 0.012, 0.035, 0.01), dx, a + 0.006, 0), doorM);
      if (open) add(door, T(box(dw - 0.06, b - a - 0.06, 0.006), dx, a + 0.03, -0.02), C(0xdfe5ea, { r: 0.5 }));
      const hhx = dx + side * (dw / 2 - 0.06);
      if (a === y0) barHandle(door, hhx, b - 0.38, b - 0.06, 0.045, 0.011); else barHandle(door, hhx, a + 0.06, a + 0.38, 0.045, 0.011);
      if (open) door.rotation.y = c < cols / 2 ? -1.75 : 1.75;
    }
  }
  // 上の操作パネル（温度表示・ロゴ・吸気口）
  add(g, T(rbox(W - 0.01, HD - 0.02, 0.02, 0.006), 0, y1 + 0.01, D / 2 - 0.012), C(0x3a3f45, { r: 0.4, m: 0.4 }));
  screen(g, '3.0℃', 0.16, 0.06, W / 2 - 0.15, y1 + 0.08, D / 2 + 0.002, { bg: '#06141f', fg: '#6fd3ff' });
  label(g, '冷蔵庫', 0.2, 0.05, -W / 2 + 0.16, y1 + 0.08, D / 2 + 0.0, { bg: '#3a3f45', fg: '#ffffff' });
  for (let i = 0; i < 6; i++) add(g, T(box(0.008, 0.07, 0.006), -0.1 + i * 0.03, y1 + 0.045, D / 2 - 0.001), BLACK());
  if (!open) {
    // 扉の温度計
    const tx = -W / 2 + dw / 2 - 0.1;
    add(g, T(cyl(0.035, 0.035, 0.012, 20), tx, y1 - 0.12, fz + 0.035, Math.PI / 2), CHROME());
    add(g, T(cyl(0.03, 0.03, 0.002, 20), tx, y1 - 0.12, fz + 0.048, Math.PI / 2), C(0xffffff, { r: 0.3 }));
    add(g, T(box(0.003, 0.024, 0.002), tx, y1 - 0.12, fz + 0.05, 0, 0, -0.6), C(0xd62828));
  }
  return g;
}

// ================= 食器棚（ステンレスのワイヤーシェルフ） =================
export function dishrackModel() {
  const g = new THREE.Group(), d = FIXTURES.dishrack, W = d.w, D = d.d, ys = [...ANCHOR.rack.ys, 1.55], TOPY = 1.6;
  const px = W / 2 - 0.016, pz = D / 2 - 0.016;
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    add(g, T(cyl(0.0135, 0.0135, TOPY - 0.02, 12), sx * px, 0.02, sz * pz), CHROME());
    add(g, T(cyl(0.018, 0.016, 0.02, 12), sx * px, 0, sz * pz), RUBBER());
    add(g, T(dome(0.0135, 10, 4), sx * px, TOPY, sz * pz), CHROME());
    for (const y of ys) add(g, T(cyl(0.017, 0.021, 0.035, 12), sx * px, y - 0.045, sz * pz), CHROME());
  }
  const w = (a, b, r = 0.0028) => add(g, rod(a, b, r, 4), CHROME());
  for (const y of ys) {
    const yt = y - 0.004, yb = y - 0.034, X0 = -px, X1 = px;
    for (const z of [-pz, pz]) {
      w([X0, yt, z], [X1, yt, z], 0.005); w([X0, yb, z], [X1, yb, z], 0.004);
      for (let i = 0; i < 14; i++) { const xa = X0 + i * (X1 - X0) / 14, xb = X0 + (i + 1) * (X1 - X0) / 14; w([xa, i % 2 ? yb : yt, z], [xb, i % 2 ? yt : yb, z], 0.003); }
    }
    for (const x of [X0, X1]) w([x, yt, -pz], [x, yt, pz], 0.005);
    for (let i = 1; i < 34; i++) { const x = X0 + i * (X1 - X0) / 34; w([x, yt, -pz], [x, yt, pz], 0.0025); }
    for (const z of [-pz / 2, pz / 2]) w([X0, yt - 0.006, z], [X1, yt - 0.006, z], 0.004);
  }
  // 札（上の棚に掛ける）
  const top = ys[ys.length - 1];
  add(g, T(rbox(0.74, 0.11, 0.012, 0.01), 0, top - 0.17, pz + 0.01), C(0x3a3f45, { r: 0.4 }));
  for (const s of [-1, 1]) add(g, rod([s * 0.3, top - 0.06, pz + 0.012], [s * 0.3, top - 0.004, pz], 0.003, 4), CHROME());
  const lbl = M(plane(0.7, 0.095), basic(signTexture('🍜丼　🍚小丼　🍽️皿　🍺ジョッキ', { w: 768, h: 104, bg: '#3a3f45', fg: '#ffffff', radius: 10 })), false); lbl.position.set(0, top - 0.115, pz + 0.019); g.add(lbl);
  // 一番上：割り箸の箱とキッチンペーパー
  add(g, T(rbox(0.42, 0.2, 0.3, 0.01), -0.28, top, 0), C(0xc9a26b, { r: 0.85 }));
  label(g, '割り箸', 0.2, 0.07, -0.28, top + 0.1, 0.151, { bg: '#c9a26b', fg: '#5a3a1a' });
  for (const x of [0.2, 0.36]) { add(g, T(cyl(0.06, 0.06, 0.15, 16), x + 0.075, top + 0.06, 0, 0, 0, Math.PI / 2), C(0xfbfbf7, { r: 0.9 })); }
  return g;
}

// ================= 受け渡し台（木の台・ステンレス天板・保温ランプ・伝票レール・呼び鈴） =================
let slipT = null;
const slipTex = () => slipT ||= canvasTex(96, 144, (c, w, h) => { c.fillStyle = '#fffdf4'; c.fillRect(0, 0, w, h); c.fillStyle = '#c0392b'; c.fillRect(0, 0, w, 14); c.fillStyle = '#555'; for (let i = 0; i < 6; i++) c.fillRect(10, 28 + i * 18, 40 + (i * 17) % 36, 6); });
// 作業台（ステンレスの台。下に棚）。上に何でも置ける
export function worktableModel() {
  const g = new THREE.Group(), d = FIXTURES.worktable, W = d.w, D = d.d, TOP = ANCHOR.workY;
  add(g, T(slab(W, D, 0.03, 0.012), 0, TOP - 0.03), STEEL());
  add(g, T(rbox(W - 0.004, 0.05, 0.022, 0.006), 0, TOP - 0.075, D / 2 - 0.013), STEEL2()); // 前のふち（天板の下）
  add(g, T(rbox(W, 0.09, 0.024, 0.008), 0, TOP, -D / 2 + 0.012), STEEL2()); // 奥のバックガード
  for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
    const x = sx * (W / 2 - 0.05), z = sz * (D / 2 - 0.06);
    add(g, T(cyl(0.019, 0.019, TOP - 0.06, 10), x, 0.03, z), CHROME());
    add(g, T(cyl(0.024, 0.028, 0.03, 10), x, 0, z), DARKSTEEL()); // アジャスター
  }
  add(g, T(slab(W - 0.08, D - 0.1, 0.02, 0.01), 0, 0.2), STEEL2()); // 下の棚
  // 置き場所の目印（うすい線）
  for (let i = 1; i < d.slots; i++) add(g, T(box(0.006, 0.003, D - 0.12), -W / 2 + i * W / d.slots, TOP - 0.0005, 0.02), C(0xa9b0b7, { r: 0.4, m: 0.6 }));
  return g;
}
export function passModel() {
  const g = new THREE.Group(), d = FIXTURES.pass, W = d.w, D = d.d, TOP = ANCHOR.passY;
  add(g, T(box(W - 0.06, 0.08, D - 0.08), 0, 0, -0.02), BLACK());
  add(g, T(box(W - 0.02, TOP - 0.12, D - 0.04), 0, 0.08, -0.01), DWOOD());
  const n = 9, sw = (W - 0.08) / n;
  for (let i = 0; i < n; i++) add(g, T(box(sw - 0.008, TOP - 0.2, 0.02), -W / 2 + 0.04 + sw * (i + 0.5), 0.12, D / 2 - 0.01), smat(surf('wood'), i % 2 ? 0xe0b884 : 0xd4a670, { r: 0.6 }));
  add(g, T(box(W - 0.02, 0.04, 0.03), 0, 0.08, D / 2 - 0.01), DWOOD()); add(g, T(box(W - 0.02, 0.04, 0.03), 0, TOP - 0.1, D / 2 - 0.01), DWOOD());
  add(g, T(slab(W + 0.04, D + 0.04, 0.04, 0.012), 0, TOP - 0.04), STEEL());
  add(g, T(rbox(W + 0.04, 0.05, 0.02, 0.008), 0, TOP - 0.06, D / 2 + 0.012), STEEL());
  // 保温ランプのやぐら
  const hz = -D / 2 + 0.13, HY = TOP + 0.56;
  for (const s of [-1, 1]) { add(g, T(cyl(0.016, 0.016, HY - TOP, 12), s * (W / 2 - 0.04), TOP, -D / 2 + 0.05), CHROME()); add(g, T(cyl(0.03, 0.03, 0.01, 12), s * (W / 2 - 0.04), TOP, -D / 2 + 0.05), CHROME()); }
  add(g, T(rbox(W, 0.07, 0.24, 0.02), 0, HY, hz), STEEL());
  for (const s of [-1, 1]) add(g, T(rbox(W / 2 - 0.08, 0.012, 0.12, 0.004), s * W / 4, HY - 0.01, hz), glow(0xffa05a, 1.1));
  // 伝票レール
  add(g, T(box(W - 0.06, 0.035, 0.014), 0, HY - 0.035, hz + 0.127), C(0xb9bfc5, { r: 0.3, m: 0.8 }));
  [-0.32, -0.12, 0.2].forEach((x, i) => { const p = M(plane(0.065, 0.1), mat(0xffffff, { map: slipTex(), r: 0.8, side: THREE.DoubleSide }), false); p.position.set(x, HY - 0.08, hz + 0.136); p.rotation.z = (i - 1) * 0.06; g.add(p); });
  // 呼び鈴
  const bx = W / 2 - 0.1, bz = D / 2 - 0.1;
  add(g, T(cyl(0.048, 0.052, 0.014, 20), bx, TOP, bz), C(0x2b2b2b, { r: 0.4 }));
  add(g, T(dome(0.042, 20, 7), bx, TOP + 0.014, bz), C(0xd9b44a, { r: 0.18, m: 0.9 }));
  add(g, T(cyl(0.004, 0.004, 0.02, 6), bx, TOP + 0.054, bz), CHROME());
  add(g, T(sph(0.008, 10, 6), bx, TOP + 0.076, bz), CHROME());
  label(g, '🛎️ 受け渡し', 0.6, 0.12, 0, 0.82, D / 2 + 0.003, { bg: '#fffdf6', fg: '#6b4a30' });
  return g;
}

// ================= 炊飯器（業務用ジャー・台・米袋・しゃもじ） =================
export function riceModel() {
  const g = new THREE.Group(), TOP = 0.6, R = 0.205, RY = ANCHOR.riceY + 0.005;
  legs(g, 0.6, 0.6, TOP - 0.03, { shelf: 0.14 });
  add(g, T(slab(0.6, 0.6, 0.03, 0.01), 0, TOP - 0.03), STEEL());
  // 米袋
  add(g, T(rbox(0.38, 0.15, 0.27, 0.05), -0.02, 0.16, 0), C(0xf1ead8, { r: 0.9 }));
  label(g, '米', 0.12, 0.1, -0.02, 0.235, 0.136, { bg: '#f1ead8', fg: '#1f5a2a', rx: -0.0 });
  // ジャー本体（中の内釜が見える）
  const H = RY - TOP;
  add(g, T(lathe([[0, 0], [R - 0.02, 0], [R, 0.02], [R + 0.006, 0.06], [R + 0.006, H - 0.05], [R - 0.008, H - 0.01], [R - 0.04, H], [0.152, H], [0.15, H - 0.01], [0.15, H - 0.2], [0, H - 0.2]], 32), 0, TOP + 0.002), C(0xf6f6f2, { r: 0.35 }));
  add(g, T(torus(R + 0.004, 0.008, 6, 32), 0, TOP + 0.03, 0, Math.PI / 2), C(0x8c939a, { r: 0.3, m: 0.7 }));
  add(g, T(cyl(0.15, 0.135, 0.16, 28, true), 0, RY - 0.17), mat(0x4a4d52, { r: 0.35, m: 0.5, side: THREE.DoubleSide }));
  add(g, T(torus(0.152, 0.006, 6, 28), 0, RY - 0.004, 0, Math.PI / 2), C(0xb9bfc5, { r: 0.3, m: 0.8 }));
  // 開いたふた（後ろの蝶番で立ち上がる）
  const lid = new THREE.Group(); lid.position.set(0, RY, -R + 0.01); lid.rotation.x = -1.6; g.add(lid);
  add(lid, T(lathe([[0, 0.07], [0.12, 0.062], [0.18, 0.04], [R, 0.012], [R + 0.004, 0], [0, 0]], 28), 0, 0, R - 0.01), mat(0xf6f6f2, { r: 0.35, side: THREE.DoubleSide }));
  add(lid, T(cyl(0.16, 0.16, 0.006, 28), 0, -0.004, R - 0.01), C(0xb9bfc5, { r: 0.3, m: 0.8 }));
  add(lid, T(rbox(0.1, 0.03, 0.04, 0.01), 0, 0.06, R - 0.01), C(0x8c939a, { r: 0.3, m: 0.7 }));
  // 操作パネル・取っ手
  add(g, T(rbox(0.13, 0.07, 0.02, 0.008), 0, TOP + 0.1, R - 0.002, -0.08), C(0x2b2f33, { r: 0.3 }));
  screen(g, '保温', 0.07, 0.028, -0.015, TOP + 0.14, R + 0.012, { bg: '#1a1208', fg: '#ffb24a' });
  add(g, T(cyl(0.008, 0.008, 0.006, 10), 0.04, TOP + 0.135, R + 0.01, Math.PI / 2), glow(0xff8a1e, 1.2));
  for (const s of [-1, 1]) add(g, T(torus(0.04, 0.008, 6, 12, Math.PI), s * (R + 0.01), TOP + H - 0.08, 0, Math.PI / 2, 0, s > 0 ? -Math.PI / 2 : Math.PI / 2), C(0x8c939a, { r: 0.3, m: 0.7 }));
  // しゃもじ立て
  add(g, T(cyl(0.035, 0.03, 0.11, 14, true), 0.24, TOP, 0.2), mat(0xf6f6f2, { r: 0.35, side: THREE.DoubleSide }));
  add(g, T(cyl(0.03, 0.03, 0.005, 14), 0.24, TOP, 0.2), C(0xf6f6f2, { r: 0.35 }));
  add(g, T(rbox(0.05, 0.1, 0.008, 0.004), 0.24, TOP + 0.03, 0.2, 0.15, 0, 0.1), C(0xf2efe6, { r: 0.5 }));
  add(g, T(rbox(0.022, 0.11, 0.008, 0.004), 0.23, TOP + 0.12, 0.21, 0.15, 0, 0.1), C(0xf2efe6, { r: 0.5 }));
  return g;
}

// ================= 餃子焼き器（鉄板・開いたふた・つまみ） =================
export function gyozaModel() {
  const g = new THREE.Group(), d = FIXTURES.gyoza, W = d.w, D = d.d, GY = ANCHOR.griddleY;
  legs(g, W, D, 0.6, { shelf: 0.15 });
  add(g, T(box(W, 0.26, D - 0.02), 0, 0.6, -0.01), STEEL2());
  add(g, T(rbox(W - 0.02, 0.22, 0.02, 0.006), 0, 0.62, D / 2 - 0.012), STEEL());
  const fz = D / 2 + 0.008;
  for (let i = 0; i < 3; i++) knob(g, -0.22 + i * 0.14, 0.72, fz, { r: 0.026 });
  add(g, T(cyl(0.022, 0.022, 0.01, 16), 0.28, 0.72, fz, Math.PI / 2), C(0x111111, { r: 0.1 }));
  add(g, T(cyl(0.01, 0.01, 0.012, 12), 0.28, 0.72, fz + 0.002, Math.PI / 2), glow(0xff8a1e, 1.2));
  label(g, '餃子', 0.12, 0.04, 0.28, 0.79, fz, { bg: '#2b2f33', fg: '#ffd27a' });
  // 油受けの引き出し
  add(g, T(rbox(W - 0.1, 0.03, 0.02, 0.005), 0, 0.64, fz + 0.005), STEEL2()); pullHandle(g, 0, 0.655, 0.16, fz + 0.02, 0.006);
  // 鉄板と囲い
  add(g, T(box(W - 0.06, GY - 0.03 - 0.86, D - 0.1), 0, 0.86, 0.02), STEEL());
  add(g, T(box(W - 0.1, 0.03, D - 0.18), 0, GY - 0.03, 0.03), mat(0x2b2b2d, { r: 0.32, m: 0.6 }));
  add(g, T(ringRect(W - 0.04, D - 0.1, 0.05, 0.02, 0.015), 0, GY - 0.03, 0.02), STEEL());
  add(g, T(box(W, 0.2, 0.02), 0, 0.86, -D / 2 + 0.01), STEEL());
  // 開いたふた（後ろに立てて）
  const lid = new THREE.Group(); lid.position.set(0, GY + 0.02, -D / 2 + 0.09); lid.rotation.x = -1.56; g.add(lid);
  const LD = D - 0.2;
  add(lid, T(rbox(W - 0.08, 0.06, LD, 0.025), 0, 0, LD / 2), STEEL());
  // 取っ手はふたの手前のふち（開けると上に来る・壁に当たらない）
  add(lid, rod([-0.18, 0.03, LD + 0.05], [0.18, 0.03, LD + 0.05], 0.016, 10), C(0x6b4a30, { r: 0.6 }));
  for (const s of [-1, 1]) add(lid, rod([s * 0.16, 0.03, LD - 0.01], [s * 0.16, 0.03, LD + 0.05], 0.008, 6), CHROME());
  // フライ返し
  add(g, T(box(0.09, 0.003, 0.08), 0.3, GY, 0.17, 0, 0.4), C(0xc9ced3, { r: 0.25, m: 0.85 }));
  add(g, rod([0.3 + 0.04, GY + 0.003, 0.17 + 0.02], [0.3 + 0.14, GY + 0.04, 0.17 + 0.07], 0.007, 6), C(0x2b2b2b, { r: 0.5 }));
  return g;
}

// ================= フライヤー（油槽・かご・操作盤） =================
export function fryerModel() {
  const g = new THREE.Group(), d = FIXTURES.fryer, W = d.w, D = d.d, TOP = 0.9, OIL = ANCHOR.fryerY - 0.01;
  cabinet(g, W, 0.7, D, { doors: 1, handle: 'pull', vent: true });
  add(g, T(ringRect(W, D - 0.02, 0.17, 0.02, 0.01), 0, 0.7, -0.01), STEEL2());
  add(g, T(rbox(W - 0.02, 0.15, 0.02, 0.006), 0, 0.71, D / 2 - 0.012), STEEL());
  const fz = D / 2 + 0.008;
  knob(g, -0.24, 0.785, fz, { r: 0.03 });
  for (const [x, c] of [[-0.12, 0xff3b30], [-0.07, 0x34c759]]) add(g, T(cyl(0.012, 0.012, 0.01, 12), x, 0.785, fz, Math.PI / 2), glow(c, 0.9));
  screen(g, '180℃', 0.15, 0.055, 0.17, 0.785, fz + 0.003, { bg: '#1a0b06', fg: '#ff9a4a' });
  // 天板と油槽
  const ow = W - 0.18, od = D - 0.26, oz = 0.02;
  add(g, T(slab(W, D, 0.03, 0.01, [{ x: 0, z: oz, w: ow, d: od, r: 0.03 }]), 0, TOP - 0.03), STEEL());
  add(g, T(rbox(W, 0.037, 0.025, 0.01), 0, TOP - 0.045, D / 2 - 0.006), STEEL());
  add(g, T(ringRect(ow, od, 0.137, 0.008, 0.03), 0, TOP - 0.14, oz), mat(0xb7bec4, { r: 0.35, m: 0.75, side: THREE.DoubleSide }));
  add(g, T(slab(ow - 0.01, od - 0.01, 0.004, 0.03), 0, OIL - 0.004, oz), mat(0xd9a640, { r: 0.08, m: 0.2, e: 0x5a3a08, ei: 0.25 }));
  // 揚げかご（油の中）と取っ手
  wireBasket(g, 0.28, 0.2, 0.09, 0, OIL - 0.05, 0.05);
  add(g, rod([0, OIL + 0.04, 0.15], [0, TOP + 0.05, 0.25], 0.006, 6), CHROME());
  add(g, rod([0, TOP + 0.05, 0.25], [0, TOP + 0.08, 0.32], 0.014, 10), C(0x1c1d20, { r: 0.5 }));
  // 後ろの立ち上がり・かご掛け・油はね
  add(g, T(box(W, 0.32, 0.03), 0, TOP, -D / 2 + 0.015), STEEL());
  add(g, rod([-W / 2 + 0.06, TOP + 0.22, -D / 2 + 0.07], [W / 2 - 0.06, TOP + 0.22, -D / 2 + 0.07], 0.009, 8), CHROME());
  for (const s of [-1, 1]) add(g, rod([s * (W / 2 - 0.06), TOP + 0.22, -D / 2 + 0.03], [s * (W / 2 - 0.06), TOP + 0.22, -D / 2 + 0.07], 0.008, 6), CHROME());
  // 網じゃくし（掛けてある）
  add(g, rod([W / 2 - 0.16, TOP + 0.22, -D / 2 + 0.07], [W / 2 - 0.16, TOP + 0.09, -D / 2 + 0.075], 0.005, 5), CHROME());
  add(g, T(cyl(0.05, 0.05, 0.006, 16), W / 2 - 0.16, TOP + 0.04, -D / 2 + 0.08, Math.PI / 2), C(0xb7bec4, { r: 0.45, m: 0.7 }));
  label(g, 'フライヤー', 0.2, 0.045, 0.0, TOP + 0.24, -D / 2 + 0.031, { bg: '#b3201b', fg: '#ffffff' });
  return g;
}

// ================= ビールサーバー（台・ビール樽・ガスボンベ・注ぎ口） =================
export function beerModel() {
  const g = new THREE.Group(), BY = 0.9;
  for (const s of [-1, 1]) add(g, T(box(0.03, BY - 0.082, 0.58), s * 0.285, 0.04, 0), DWOOD());
  add(g, T(box(0.6, 0.04, 0.6), 0, 0, 0), BLACK());
  add(g, T(box(0.54, 0.03, 0.56), 0, 0.04, 0), DWOOD());
  add(g, T(box(0.54, BY - 0.112, 0.02), 0, 0.07, -0.28), DWOOD());
  add(g, T(rbox(0.62, 0.04, 0.62, 0.01), 0, BY - 0.04), C(0x3a2a1e, { r: 0.45 }));
  // ビール樽
  const kx = -0.07, kr = 0.15, kh = 0.46, keg = C(0xd4d8dc, { r: 0.25, m: 0.85 });
  add(g, T(lathe([[0, 0], [kr - 0.02, 0], [kr, 0.03], [kr, kh - 0.03], [kr - 0.02, kh], [0.03, kh], [0, kh]], 28), kx, 0.072, 0.02), keg);
  for (const y of [0.13, kh - 0.05]) add(g, T(torus(kr + 0.004, 0.01, 6, 28), kx, 0.07 + y, 0.02, Math.PI / 2), keg);
  add(g, T(torus(kr - 0.03, 0.012, 6, 24), kx, 0.07 + kh + 0.01, 0.02, Math.PI / 2), keg);
  add(g, T(cyl(0.035, 0.035, 0.05, 14), kx, 0.07 + kh, 0.02), C(0x1c1d20, { r: 0.4 }));
  add(g, T(box(0.1, 0.015, 0.02), kx + 0.05, 0.07 + kh + 0.05, 0.02), C(0x1c1d20, { r: 0.4 }));
  add(g, tube([[kx, 0.07 + kh + 0.05, 0.02], [kx + 0.02, 0.07 + kh + 0.12, -0.08], [0.0, BY - 0.06, -0.18]], 0.008, 12, 6), C(0xeaeaea, { r: 0.3, t: true, op: 0.8 }));
  // 炭酸ガスボンベ
  add(g, T(cyl(0.055, 0.055, 0.46, 18), 0.19, 0.07, 0.12), C(0x2e7d4f, { r: 0.4, m: 0.3 }));
  add(g, T(dome(0.055, 18, 6), 0.19, 0.53, 0.12), C(0x2e7d4f, { r: 0.4, m: 0.3 }));
  add(g, T(box(0.05, 0.04, 0.04), 0.19, 0.58, 0.12), CHROME());
  add(g, T(cyl(0.022, 0.022, 0.01, 16), 0.19, 0.6, 0.145, Math.PI / 2), C(0xffffff, { r: 0.3 }));
  // サーバー本体と注ぎ口
  add(g, T(rbox(0.34, 0.36, 0.34, 0.03), 0, BY, -0.08), STEEL());
  for (let i = 0; i < 6; i++) add(g, T(box(0.004, 0.012, 0.2), 0.171, BY + 0.06 + i * 0.03, -0.08), BLACK());
  add(g, T(slab(0.3, 0.15, 0.02, 0.01), 0, BY, 0.17), C(0x8d949a, { m: 0.7, r: 0.4 }));
  for (let i = 0; i < 9; i++) add(g, T(box(0.008, 0.006, 0.13), -0.12 + i * 0.03, BY + 0.02, 0.17), CHROME());
  const ty = BY + 0.25;
  add(g, rod([0, ty, 0.09], [0, ty, 0.16], 0.022, 14), CHROME());
  add(g, T(cyl(0.016, 0.012, 0.07, 12), 0, ty - 0.08, 0.16), CHROME());
  add(g, T(cyl(0.02, 0.02, 0.03, 12), 0, ty, 0.16), CHROME());
  add(g, rod([0, ty + 0.02, 0.16], [0, ty + 0.17, 0.13], 0.014, 10, 0.02), C(0x1c1d20, { r: 0.35 }));
  add(g, T(cyl(0.021, 0.021, 0.02, 12), 0, ty + 0.15, 0.134, -0.2), C(0xd9b44a, { r: 0.2, m: 0.85 }));
  label(g, '生ビール', 0.28, 0.1, 0, BY + 0.11, 0.093, { bg: '#f2b705', fg: '#3a2200' });
  return g;
}

// ================= 客席・サービスの家具 =================
const VINYL = () => C(0xa31d1d, { r: 0.42 });
const FRAME = () => C(0x2a2a2c, { r: 0.4, m: 0.5 });
// 卓上の調味料セット（トレー・醤油・酢・ラー油・こしょう・つまようじ）。長い向きは x
function condiments(g, x, y, z, ry = 0) {
  const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s);
  add(s, rbox(0.2, 0.012, 0.085, 0.006), C(0x2a1a12, { r: 0.35 }));
  const bottle = (bx, liquid, cap) => {
    add(s, T(lathe([[0, 0], [0.017, 0], [0.019, 0.006], [0.019, 0.05], [0.011, 0.066], [0, 0.066]], 14), bx, 0.012, 0), mat(liquid, { r: 0.12, m: 0.1 }));
    add(s, T(cyl(0.012, 0.012, 0.016, 12), bx, 0.075, 0), C(cap, { r: 0.35 }));
    add(s, rod([bx, 0.088, 0.002], [bx, 0.094, 0.014], 0.003, 6), C(cap, { r: 0.35 }));
  };
  bottle(-0.07, 0x3a1608, 0xd62828); bottle(-0.028, 0xe8dfc2, 0xf4f4f4);
  add(s, T(cyl(0.017, 0.017, 0.042, 12), 0.014, 0.012, 0), mat(0xc0301a, { r: 0.12 }));
  add(s, T(cyl(0.018, 0.018, 0.01, 12), 0.014, 0.054, 0), C(0xd8d8d8, { m: 0.7, r: 0.3 }));
  add(s, T(cyl(0.013, 0.013, 0.055, 10), 0.052, 0.012, 0), C(0xf3efe6, { r: 0.4 }));
  add(s, T(dome(0.013, 10, 4), 0.052, 0.067, 0), C(0x9aa0a6, { m: 0.8, r: 0.3 }));
  add(s, T(cyl(0.011, 0.011, 0.04, 10), 0.083, 0.012, 0), C(0xc8955a, { r: 0.6 }));
  return s;
}
// 箸箱（ふた付き）
function chopBox(g, x, y, z, ry = 0) {
  const s = new THREE.Group(); s.position.set(x, y, z); s.rotation.y = ry; g.add(s);
  add(s, rbox(0.24, 0.055, 0.08, 0.008), C(0x2a1712, { r: 0.3 }));
  add(s, T(rbox(0.25, 0.018, 0.088, 0.006), 0, 0.05), C(0x8e1f1a, { r: 0.3 }));
  add(s, T(rbox(0.05, 0.012, 0.02, 0.004), 0, 0.068), C(0xc9a227, { r: 0.3, m: 0.6 }));
  return s;
}
// 椅子（スチールのフレーム＋赤いビニールの座面）。back: 背もたれの向き（+1 で +z 側）
function chair(g, x, z, back) {
  const fr = FRAME(), SY = 0.43, b = back;
  for (const dx of [-0.16, 0.16]) for (const dz of [-0.16, 0.16]) add(g, rod([x + dx * 1.08, 0, z + dz * 1.08], [x + dx, SY, z + dz], 0.011, 8), fr);
  for (const dz of [-0.16, 0.16]) add(g, rod([x - 0.165, 0.16, z + dz], [x + 0.165, 0.16, z + dz], 0.008, 6), fr);
  add(g, T(box(0.36, 0.02, 0.36), x, SY - 0.02, z), fr);
  add(g, T(rbox(0.4, 0.065, 0.4, 0.028), x, SY, z), VINYL());
  for (const dx of [-0.15, 0.15]) add(g, rod([x + dx, SY, z + b * 0.16], [x + dx * 0.95, 0.86, z + b * 0.2], 0.011, 8), fr);
  add(g, T(rbox(0.36, 0.15, 0.04, 0.016), x, 0.66, z + b * 0.2, -b * 0.08), VINYL());
}
export function tableModel(def) {
  const g = new THREE.Group(), tw = def.w - 0.1, td = def.seats.some(([, z]) => Math.abs(z) > 0.65) ? 0.85 : 0.75, TY = def.top;
  add(g, T(rbox(tw, 0.035, td, 0.008), 0, TY - 0.035), smat(surf('wood'), 0xd2a06a, { r: 0.4 }));
  add(g, T(ringRect(tw + 0.008, td + 0.008, 0.034, 0.012, 0.012), 0, TY - 0.04), C(0x3a2416, { r: 0.4 }));
  add(g, T(box(tw - 0.16, 0.05, td - 0.16), 0, TY - 0.085), FRAME());
  // 脚（十字の足）
  const posts = tw > 1.2 ? [-tw / 4, tw / 4] : [0];
  for (const px of posts) {
    add(g, T(cyl(0.032, 0.032, TY - 0.1, 12), px, 0.03), FRAME());
    for (const a of [Math.PI / 4, -Math.PI / 4]) add(g, T(box(0.62, 0.03, 0.045), px, 0.01, 0, 0, a), FRAME());
    for (const [sx, sz] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) add(g, T(cyl(0.022, 0.022, 0.012, 10), px + sx * 0.21, 0, sz * 0.21), RUBBER());
    add(g, T(box(0.3, 0.012, 0.3), px, TY - 0.11, 0), FRAME());
  }
  // 卓上（調味料・箸箱）
  const ex = tw / 2 - 0.1;
  condiments(g, ex, TY, -0.08, Math.PI / 2);
  chopBox(g, ex, TY, 0.16, Math.PI / 2);
  for (const [x, z] of def.seats) chair(g, x, z, Math.sign(z));
  return g;
}
// カウンター席（木の天板・縦格子の腰板・台上げ・足掛け・スツール・調味料）
export function counterModel(def) {
  const g = new THREE.Group(), w = def.w, TY = def.top; // 料理を置く高さ（def.top）と天板の面をそろえる
  add(g, T(rbox(w, 0.06, 0.64, 0.012), 0, TY - 0.06, -0.4), smat(surf('wood'), 0xd9b27c, { r: 0.4 }));
  // 腰板は天板より奥に下げて、座ったお客さんのひざが入るすき間をあける
  const PZ = -0.3;
  add(g, T(box(w, TY - 0.06, 0.05), 0, 0, PZ - 0.035), DWOOD());
  const n = Math.round(w / 0.1), sw = w / n;
  for (let i = 0; i < n; i++) add(g, T(box(sw - 0.012, TY - 0.24, 0.022), -w / 2 + sw * (i + 0.5), 0.1, PZ), smat(surf('wood'), i % 2 ? 0x8a5c3a : 0x7a5032, { r: 0.6 }));
  add(g, T(box(w - 0.004, 0.1, 0.05), 0, 0, PZ + 0.005), BLACK());
  add(g, T(box(w, 0.045, 0.035), 0, TY - 0.105, -0.1), DWOOD());
  for (let i = 0; i <= Math.round(w / 1.2); i++) { const x = -w / 2 + 0.03 + i * (w - 0.06) / Math.round(w / 1.2); add(g, T(box(0.04, 0.047, 0.22), x, TY - 0.11, -0.2), DWOOD()); }
  // 足掛けのバー（座ったお客さんの足の下）
  add(g, rod([-w / 2 + 0.05, 0.17, -0.06], [w / 2 - 0.05, 0.17, -0.06], 0.016, 10), CHROME());
  for (let i = 0; i <= Math.round(w / 1.2); i++) { const x = -w / 2 + 0.1 + i * (w - 0.2) / Math.round(w / 1.2); add(g, rod([x, 0.17, PZ + 0.01], [x, 0.17, -0.06], 0.01, 6), CHROME()); }
  // 厨房側：台上げ（丼を置く一段高い棚）と下の作業棚
  add(g, T(box(w, 0.16, 0.08), 0, TY, -0.67), DWOOD());
  add(g, T(rbox(w, 0.025, 0.12, 0.006), 0, TY + 0.16, -0.665), STEEL());
  add(g, T(box(w - 0.006, 0.04, 0.34), 0, 0.78, -0.5), STEEL());
  add(g, T(box(w, 0.78, 0.04), 0, 0, -0.68), STEEL());
  // 調味料と箸箱（席の間）
  const xs = def.seats.map(([x]) => x);
  for (let i = 0; i < xs.length - 1; i += 1) { const mx = (xs[i] + xs[i + 1]) / 2; if (i % 2 === 0 || xs.length <= 2) { condiments(g, mx, TY, -0.56); chopBox(g, mx, TY, -0.2, Math.PI / 2); } }
  if (xs.length <= 2) condiments(g, w / 2 - 0.2, TY, -0.56);
  // スツール（クロームの脚・足のせの輪・赤い座面）
  for (const [x, z] of def.seats) {
    add(g, T(cyl(0.2, 0.22, 0.025, 22), x, 0, z), CHROME());
    add(g, T(cyl(0.032, 0.04, 0.6, 12), x, 0.02, z), CHROME());
    add(g, T(torus(0.16, 0.01, 6, 20), x, 0.26, z, Math.PI / 2), CHROME());
    for (let k = 0; k < 4; k++) { const a = k * Math.PI / 2; add(g, rod([x, 0.26, z], [x + Math.cos(a) * 0.16, 0.26, z + Math.sin(a) * 0.16], 0.007, 6), CHROME()); }
    add(g, T(cyl(0.12, 0.08, 0.03, 18), x, 0.6, z), CHROME());
    add(g, T(cyl(0.19, 0.18, 0.07, 24), x, 0.62, z), VINYL());
    add(g, T(torus(0.185, 0.012, 6, 24), x, 0.655, z, Math.PI / 2), C(0x8a1616, { r: 0.4 }));
  }
  return g;
}
// 待合ベンチ（すのこの座面と背もたれ・黒い鉄の脚）
export function benchModel() {
  const g = new THREE.Group(), L = 1.45, fr = FRAME();
  for (let i = 0; i < 5; i++) add(g, T(rbox(L, 0.028, 0.068, 0.008), 0, 0.41, -0.15 + i * 0.077), smat(surf('wood'), i % 2 ? 0xd2a06a : 0xc8955a, { r: 0.5 }));
  for (let i = 0; i < 3; i++) add(g, T(rbox(L, 0.075, 0.024, 0.008), 0, 0.53 + i * 0.1, -0.2 - i * 0.012, -0.12), smat(surf('wood'), i % 2 ? 0xd2a06a : 0xc8955a, { r: 0.5 }));
  for (const x of [-0.6, 0.6]) {
    add(g, rod([x, 0, 0.17], [x, 0.41, 0.17], 0.014, 8), fr);
    add(g, rod([x, 0, -0.17], [x, 0.41, -0.17], 0.014, 8), fr);
    add(g, rod([x, 0.4, -0.17], [x, 0.4, 0.17], 0.014, 8), fr);
    add(g, rod([x, 0.08, -0.17], [x, 0.08, 0.17], 0.01, 8), fr);
    add(g, rod([x, 0.4, -0.18], [x, 0.84, -0.24], 0.014, 8), fr);
    add(g, rod([x, 0.62, 0.17], [x, 0.62, 0.1], 0.01, 6), fr);
    add(g, rod([x, 0.62, 0.17], [x, 0.43, 0.17], 0.012, 6), fr);
    add(g, T(rbox(0.06, 0.025, 0.3, 0.01), x, 0.62, 0.03), DWOOD());
  }
  add(g, rod([-0.6, 0.08, 0], [0.6, 0.08, 0], 0.01, 8), fr);
  return g;
}
// ウォーターサーバー（逆さのボトル・冷水/温水の注ぎ口・受け皿・紙コップ）
export function waterModel() {
  const g = new THREE.Group(), W = 0.34, H = 1.0;
  add(g, rbox(W, H, W, 0.03), C(0xf4f4f2, { r: 0.35 }));
  add(g, T(box(W + 0.01, 0.06, W + 0.01), 0, 0), C(0x9aa0a6, { r: 0.4, m: 0.4 }));
  add(g, T(rbox(0.25, 0.26, 0.02, 0.02), 0, 0.5, W / 2 - 0.005), C(0x3a3f45, { r: 0.4 }));
  for (const [x, c] of [[-0.05, 0x2e6fd6], [0.05, 0xd63a2e]]) {
    add(g, T(rbox(0.05, 0.05, 0.05, 0.01), x, 0.68, W / 2 + 0.01), C(0xf4f4f2, { r: 0.35 }));
    add(g, T(cyl(0.008, 0.006, 0.03, 8), x, 0.65, W / 2 + 0.025), C(0xbfc5ca, { m: 0.6, r: 0.3 }));
    add(g, T(rbox(0.035, 0.012, 0.04, 0.004), x, 0.73, W / 2 + 0.03, -0.3), C(c, { r: 0.35 }));
  }
  add(g, T(slab(0.24, 0.1, 0.02, 0.01), 0, 0.5, W / 2 + 0.03), C(0x8d949a, { m: 0.6, r: 0.4 }));
  for (let i = 0; i < 6; i++) add(g, T(box(0.006, 0.004, 0.08), -0.075 + i * 0.03, 0.52, W / 2 + 0.03), C(0x5b6168, { r: 0.4 }));
  label(g, 'お水はセルフで', 0.22, 0.06, 0, 0.3, W / 2 + 0.001, { bg: '#e8f4ff', fg: '#1a5fbf' });
  // ボトル（逆さ）
  add(g, T(lathe([[0, 0], [0.035, 0], [0.04, 0.04], [0.12, 0.08], [0.15, 0.13], [0.15, 0.2], [0.145, 0.22], [0.15, 0.24], [0.15, 0.34], [0.14, 0.4], [0.1, 0.42], [0, 0.42]], 24), 0, H - 0.01), mat(0x8cc8ff, { r: 0.05, t: true, op: 0.5 }));
  add(g, T(cyl(0.12, 0.13, 0.03, 20), 0, H - 0.02), C(0x2e6fd6, { r: 0.4 }));
  // 紙コップ
  add(g, T(cyl(0.04, 0.04, 0.3, 14, true), W / 2 + 0.04, 0.45, 0), mat(0xe8f6ff, { r: 0.2, t: true, op: 0.5, side: THREE.DoubleSide }));
  add(g, T(cyl(0.035, 0.028, 0.26, 14), W / 2 + 0.04, 0.47, 0), C(0xffffff, { r: 0.5 }));
  add(g, T(box(0.04, 0.03, 0.06), W / 2 + 0.01, 0.6, 0), C(0xbfc5ca, { m: 0.6, r: 0.3 }));
  return g;
}
// ペダル式のゴミ箱
export function trashModel() {
  // 足ペダル式のふた付きゴミ箱。ふた・ふちの帯・ラベルは本体の面から少し離して、面が重なってちらつかないようにする
  const g = new THREE.Group(), R = 0.17, H = 0.6, st = smat(surf('metal'), 0xd8dde1, { r: 0.28, m: 0.8 });
  const rAt = (y) => R - 0.01 * (1 - (y - 0.04) / (H - 0.04)); // 本体は下が少し細い
  add(g, T(cyl(R + 0.01, R + 0.01, 0.04, 24), 0, 0), RUBBER());
  add(g, T(cyl(R, R - 0.01, H - 0.046, 28), 0, 0.04), st);
  add(g, T(cyl(R + 0.006, R + 0.006, 0.022, 28, true), 0, H - 0.03), C(0x2a4a36, { r: 0.4, side: THREE.DoubleSide })); // ふちの帯（本体より6mm外）
  add(g, T(lathe([[0, 0.05], [0.1, 0.045], [0.15, 0.026], [R + 0.004, 0.012], [R + 0.012, 0.004], [R + 0.012, 0], [0, 0]], 28), 0, H + 0.004), C(0x3b6e4f, { r: 0.4, m: 0.2 }));
  add(g, T(box(0.08, 0.026, 0.035), 0, H + 0.012, -R + 0.002), C(0x2a4a36, { r: 0.4 }));
  add(g, T(rbox(0.12, 0.02, 0.08, 0.008), 0, 0.03, R + 0.05), C(0x2a4a36, { r: 0.4 }));
  add(g, T(box(0.05, 0.026, 0.05), 0, 0.034, R + 0.004), C(0x2a4a36, { r: 0.4 }));
  // ラベル：本体の曲面にそって3mm浮かせた帯に貼る
  const tl = 0.2 / R, y0 = 0.3, y1 = 0.42;
  const lb = M(T(new THREE.CylinderGeometry(rAt(y1) + 0.003, rAt(y0) + 0.003, y1 - y0, 12, 1, true, -tl / 2, tl), 0, (y0 + y1) / 2), basic(signTexture('生ゴミ', { w: 256, h: 150, bg: '#ffffff', fg: '#2a4a36', radius: 16 })), false);
  g.add(lb);
  return g;
}
// 券売機（光る看板・ボタン面・お札とコインの投入口・おつりと食券の取り出し口）
export function ticketModel(face, color = '#c0392b') {
  const g = new THREE.Group(), W = 0.76, D = 0.55, fz = D / 2;
  add(g, box(W + 0.04, 0.08, D + 0.02), C(0x2b2f33, { r: 0.5 }));
  add(g, T(rbox(W, 1.52, D, 0.03), 0, 0.08), C(0xe9ecef, { r: 0.35, m: 0.3 }));
  add(g, T(rbox(W + 0.02, 0.17, D + 0.02, 0.02), 0, 1.6), C(color, { r: 0.4 }));
  label(g, '食券', 0.5, 0.12, 0, 1.685, fz + 0.012, { bg: color, fg: '#ffffff', radius: 0 });
  // ボタン面（枠）
  add(g, T(rbox(0.68, 0.68, 0.03, 0.012), 0, 0.6, fz - 0.005), C(0x2b2f33, { r: 0.4 }));
  const fc = M(plane(0.62, 0.62), basic(face), false); fc.position.set(0, 0.94, fz + 0.012); g.add(fc);
  add(g, T(box(0.68, 0.03, 0.06), 0, 1.28, fz), C(0x2b2f33, { r: 0.4 }));
  // 投入口のパネル
  add(g, T(rbox(0.68, 0.16, 0.05, 0.01), 0, 0.42, fz - 0.01, -0.25), C(0xd5d9dd, { r: 0.35, m: 0.4 }));
  add(g, T(box(0.18, 0.016, 0.02), -0.16, 0.5, fz + 0.02, -0.25), C(0x111111));
  add(g, T(box(0.18, 0.004, 0.02), -0.16, 0.522, fz + 0.018, -0.25), glow(0x34c759, 0.9));
  add(g, T(box(0.012, 0.05, 0.02), 0.04, 0.47, fz + 0.02, -0.25), C(0x111111));
  add(g, T(rbox(0.06, 0.08, 0.012, 0.006), 0.04, 0.455, fz + 0.012, -0.25), CHROME());
  screen(g, '¥ 0', 0.16, 0.05, 0.21, 0.5, fz + 0.035, { bg: '#0d1f17', fg: '#62ffa8', rx: -0.25 });
  add(g, T(cyl(0.018, 0.018, 0.02, 14), 0.21, 0.45, fz + 0.03, Math.PI / 2 - 0.25), C(0xd62828, { r: 0.35 }));
  // 取り出し口（食券・おつり）
  for (const [x, t] of [[-0.18, '食券'], [0.18, 'おつり']]) {
    add(g, T(rbox(0.2, 0.12, 0.03, 0.01), x, 0.18, fz - 0.01), CHROME());
    add(g, T(box(0.16, 0.08, 0.012), x, 0.2, fz + 0.006), C(0x15171a, { r: 0.5 }));
    label(g, t, 0.12, 0.035, x, 0.32, fz + 0.001, { bg: '#2b2f33', fg: '#ffffff' });
  }
  add(g, T(box(0.05, 0.004, 0.06), -0.18, 0.205, fz + 0.012, -0.3), C(0xfff7e0, { r: 0.8 }));
  return g;
}
// レジ（木のカウンター・レジスター・引き出し・レシート・カルトン）
export function registerModel() {
  const g = new THREE.Group(), d = FIXTURES.register, W = d.w, D = d.d, TY = 0.95;
  add(g, T(box(W - 0.06, 0.08, D - 0.06), 0, 0, -0.01), BLACK());
  add(g, T(box(W, TY - 0.1, D), 0, 0.06), DWOOD());
  for (const x of [-W / 4, W / 4]) { add(g, T(rbox(W / 2 - 0.08, TY - 0.3, 0.02, 0.008), x, 0.14, D / 2), smat(surf('wood'), 0xa87a4a, { r: 0.55 })); add(g, T(ringRect(W / 2 - 0.06, 0.035, TY - 0.28, 0.014, 0.006), x, 0.13, D / 2 + 0.004).rotateX(0), C(0x3a2a1e, { r: 0.45 })); }
  add(g, T(rbox(W, 0.045, D + 0.03, 0.012), 0, TY - 0.04), C(0x3a2a1e, { r: 0.4 }));
  // レジスター
  const b = new THREE.Group(); b.position.set(-0.05, TY, -0.03); g.add(b);
  const cream = C(0xe9e4d8, { r: 0.4 }), gray = C(0x9a958a, { r: 0.45 });
  add(b, rbox(0.44, 0.11, 0.4, 0.02), cream);
  add(b, T(rbox(0.4, 0.075, 0.02, 0.008), 0, 0.012, 0.2), C(0xdcd6c8, { r: 0.4 }));
  add(b, T(box(0.12, 0.012, 0.01), 0, 0.05, 0.212), gray);
  add(b, T(cyl(0.008, 0.008, 0.01, 10), 0.15, 0.05, 0.212, Math.PI / 2), C(0xc9a227, { m: 0.7, r: 0.3 }));
  const kb = new THREE.Group(); kb.position.set(-0.03, 0.11, 0.03); kb.rotation.x = 0.3; b.add(kb);
  add(kb, rbox(0.32, 0.05, 0.22, 0.015), cream);
  for (let i = 0; i < 16; i++) add(kb, T(rbox(0.04, 0.014, 0.035, 0.005), -0.1 + (i % 4) * 0.05, 0.05, -0.07 + Math.floor(i / 4) * 0.045), C(i === 15 ? 0xd62828 : i % 4 === 3 ? 0x5a6a7a : 0x4a4a4a, { r: 0.5 }));
  // お客さん向けの表示（棒の上）
  add(b, T(cyl(0.012, 0.012, 0.18, 10), 0.0, 0.11, -0.15), gray);
  add(b, T(rbox(0.2, 0.08, 0.04, 0.01), 0.0, 0.28, -0.15), C(0x2b2d42, { r: 0.4 }));
  const scr = M(plane(0.17, 0.055), basic(lcd('¥ 0')), false); scr.position.set(0, 0.32, -0.128); g.add(scr); scr.position.add(b.position);
  // レシートプリンター
  add(b, T(rbox(0.11, 0.08, 0.14, 0.015), 0.17, 0.11, -0.08), C(0x3a3a3a, { r: 0.4 }));
  add(b, T(box(0.07, 0.06, 0.003), 0.17, 0.19, -0.04, -0.4), C(0xfffdf6, { r: 0.8 }));
  // カルトン（お釣りのトレー）
  add(g, T(rbox(0.18, 0.02, 0.13, 0.015), 0.3, TY, 0.12), C(0x1f3b6b, { r: 0.5 }));
  label(g, 'お会計', 0.5, 0.14, 0, 0.72, D / 2 + 0.024, { bg: '#b3201b', fg: '#fff5e6' });
  return g;
}
// 観葉植物（鉢・土・茎・葉）
export function plantModel() {
  const g = new THREE.Group();
  add(g, lathe([[0, 0], [0.14, 0], [0.15, 0.02], [0.19, 0.36], [0.205, 0.37], [0.205, 0.41], [0.19, 0.41], [0.18, 0.38], [0, 0.38]], 22), C(0xf2efe8, { r: 0.45 }));
  add(g, T(torus(0.2, 0.01, 6, 22), 0, 0.36, 0, Math.PI / 2), C(0x3b3b3b, { r: 0.5 }));
  add(g, T(cyl(0.18, 0.18, 0.01, 20), 0, 0.385), C(0x4a3424, { r: 1 }));
  const stem = C(0x4f7a2e, { r: 0.7 }), leaf = [C(0x2f7d32, { r: 0.55 }), C(0x43a047, { r: 0.55 }), C(0x1b5e20, { r: 0.55 })];
  const base = new THREE.Vector3(0, 0.39, 0);
  for (let i = 0; i < 12; i++) {
    const az = i * 2.399, el = 1.12 + (i % 4) * 0.12, L = 0.32 + (i % 3) * 0.08 + (i % 5) * 0.025;
    const dir = new THREE.Vector3(Math.cos(el) * Math.sin(az), Math.sin(el), Math.cos(el) * Math.cos(az));
    const tip = base.clone().addScaledVector(dir, L);
    add(g, rod([base.x + dir.x * 0.02, base.y, base.z + dir.z * 0.02], [tip.x, tip.y, tip.z], 0.006, 5, 0.004), stem);
    const pitch = el - 0.75, len = 0.15 + (i % 3) * 0.025, lg = sph(1, 12, 6);
    lg.applyMatrix4(new THREE.Matrix4().makeScale(0.06 + (i % 2) * 0.015, 0.01, len / 2));
    lg.applyMatrix4(new THREE.Matrix4().makeTranslation(0, 0, len / 2 - 0.01));
    lg.applyMatrix4(new THREE.Matrix4().makeRotationX(-pitch));
    lg.applyMatrix4(new THREE.Matrix4().makeRotationY(az));
    lg.applyMatrix4(new THREE.Matrix4().makeTranslation(tip.x, tip.y, tip.z));
    add(g, lg, leaf[i % 3]);
    add(g, rod([tip.x, tip.y, tip.z], [tip.x + Math.sin(az) * Math.cos(pitch) * len * 0.9, tip.y + Math.sin(pitch) * len * 0.9, tip.z + Math.cos(az) * Math.cos(pitch) * len * 0.9], 0.003, 4), C(0x8bc34a, { r: 0.6 }));
  }
  return g;
}
// 小上がり（座敷）
export function zashikiModel(def, tatami) {
  const g = new THREE.Group(), W = def.w, D = def.d, H = 0.35;
  add(g, box(W, H - 0.03, D), DWOOD());
  add(g, T(box(W - 0.06, 0.03, D - 0.06), 0, H - 0.03), mat(0xffffff, { map: tatami, r: 0.85 }));
  add(g, T(ringRect(W + 0.006, D + 0.006, 0.045, 0.063, 0.006), 0, H - 0.035), smat(surf('wood'), 0x4a2e1c, { r: 0.45 }));
  add(g, T(box(W - 0.02, 0.06, 0.02), 0, 0.02, D / 2 + 0.001), C(0x1c1d20, { r: 0.6 }));
  // 座卓
  const TY = def.top, tw = W - 0.5; // 料理を置く高さと座卓の面をそろえる
  add(g, T(rbox(tw, 0.045, 0.82, 0.012), 0, TY - 0.045), smat(surf('wood'), 0x5a3420, { r: 0.35 }));
  add(g, T(box(tw - 0.1, 0.05, 0.7), 0, TY - 0.095), DWOOD());
  for (const x of [-tw / 2 + 0.1, tw / 2 - 0.1]) for (const z of [-0.3, 0.3]) add(g, T(box(0.06, TY - H - 0.05, 0.06), x, H, z), DWOOD());
  condiments(g, tw / 2 - 0.15, TY, 0, Math.PI / 2);
  // 座布団
  def.seats.forEach(([x, z]) => { add(g, T(rbox(0.42, 0.07, 0.42, 0.03), x, H, z * 0.98), C(0x7b2341, { r: 0.85 })); add(g, T(sph(0.012, 8, 6), x, H + 0.07, z * 0.98), C(0xd9b44a, { r: 0.5 })); });
  return g;
}
// 神棚（棚板・宮形・榊・しめ縄と紙垂）
export function kamidanaModel() {
  const g = new THREE.Group(), Y = 2.2, hinoki = smat(surf('wood'), 0xf0d9a8, { r: 0.6 }), roof = C(0x5a3a24, { r: 0.8 });
  add(g, T(rbox(0.95, 0.035, 0.36, 0.006), 0, Y), hinoki);
  for (const x of [-0.38, 0.38]) { add(g, T(box(0.035, 0.18, 0.04), x, Y - 0.18, -0.16), hinoki); add(g, rod([x, Y - 0.17, -0.15], [x, Y - 0.005, 0.1], 0.014, 4), hinoki); }
  add(g, T(box(0.52, 0.04, 0.24), 0, Y + 0.035, -0.04), hinoki);
  add(g, T(box(0.36, 0.25, 0.16), 0, Y + 0.075, -0.06), hinoki);
  add(g, T(box(0.16, 0.18, 0.01), 0, Y + 0.1, 0.025), C(0xd9c08a, { r: 0.5 }));
  add(g, T(cyl(0.022, 0.022, 0.006, 16), 0, Y + 0.19, 0.03, Math.PI / 2), C(0xc9a227, { r: 0.3, m: 0.8 }));
  for (let i = 0; i < 3; i++) add(g, T(box(0.2 - i * 0.04, 0.018, 0.04), 0, Y + 0.035 + i * 0.018, 0.1 - i * 0.03), hinoki);
  for (const s of [-1, 1]) add(g, T(box(0.5, 0.022, 0.18), 0, Y + 0.38, -0.06 + s * 0.075, s * 0.55), roof);
  add(g, rod([-0.26, Y + 0.425, -0.06], [0.26, Y + 0.425, -0.06], 0.016, 8), roof);
  for (const x of [-0.24, 0.24]) for (const s of [-1, 1]) add(g, T(box(0.015, 0.09, 0.015), x, Y + 0.42, -0.06 + s * 0.02, s * 0.5), roof);
  // 榊と瓶子
  for (const x of [-0.36, 0.36]) {
    add(g, T(lathe([[0, 0], [0.028, 0], [0.034, 0.04], [0.02, 0.09], [0.014, 0.1], [0.018, 0.11], [0, 0.11]], 12), x, Y + 0.035, 0.0), C(0xfafafa, { r: 0.3 }));
    for (let k = 0; k < 5; k++) add(g, T(sph(0.045, 8, 6), x + Math.cos(k * 1.3) * 0.03, Y + 0.17 + (k % 2) * 0.04, Math.sin(k * 1.3) * 0.03, 0, k, 0.4, 1, 0.35, 0.6), C(0x2f6e2f, { r: 0.6 }));
  }
  for (const x of [-0.22, 0.22]) add(g, T(lathe([[0, 0], [0.02, 0], [0.026, 0.04], [0.012, 0.075], [0.008, 0.09], [0, 0.09]], 12), x, Y + 0.035, 0.08), C(0xfafafa, { r: 0.3 }));
  // しめ縄と紙垂
  add(g, tube([[-0.47, Y - 0.01, 0.185], [-0.25, Y - 0.05, 0.19], [0, Y - 0.065, 0.19], [0.25, Y - 0.05, 0.19], [0.47, Y - 0.01, 0.185]], 0.016, 24, 8), C(0xd9c27a, { r: 0.9 }));
  const shide = canvasTex(64, 128, (c, w, h) => { c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(8, 0); c.lineTo(40, 0); c.lineTo(40, 32); c.lineTo(56, 32); c.lineTo(56, 64); c.lineTo(40, 64); c.lineTo(40, 96); c.lineTo(56, 96); c.lineTo(56, 128); c.lineTo(24, 128); c.lineTo(24, 96); c.lineTo(8, 96); c.lineTo(8, 64); c.lineTo(24, 64); c.lineTo(24, 32); c.lineTo(8, 32); c.closePath(); c.fill(); });
  for (const x of [-0.3, -0.1, 0.1, 0.3]) { const p = M(plane(0.05, 0.11), basic(shide, { t: true, side: THREE.DoubleSide }), false); p.position.set(x, Y - 0.11 + Math.abs(x) * 0.1, 0.195); g.add(p); }
  return g;
}
