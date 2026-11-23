// ===== 仕入れる食材・器のパッケージの3Dモデル =====
// パソコンの「仕入れ」の絵も、このモデルを撮影して使う
import * as THREE from 'three';
import { INGREDIENTS, SOUPS } from '../data.js';
import { canvasTex, FONT, rr, fitText, shade } from '../textures.js';
import { mulberry32 } from '../util.js';
import { mat, T, box, rbox, cyl, sph, torus, lathe, bakeGroup, merge, vcolor } from './geo.js';
import { PIECE, bowlBase, plateBase, tangledNoodles } from './food.js';

const C = (c, o = {}) => mat(c, { r: 0.5, ...o });
const VC = (o = {}) => mat('#ffffff', { r: 0.55, vc: true, ...o });
const TEX = new Map();
const ctex = (k, w, h, draw, o) => { let t = TEX.get(k); if (!t) { t = canvasTex(w, h, draw, o); TEX.set(k, t); } return t; };
const add = (g, geo, m, x = 0, y = 0, z = 0, rx = 0, ry = 0, rz = 0) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.rotation.set(rx, ry, rz); g.add(o); return o; };
const tint = (g, hex) => vcolor(g, new THREE.Color(hex));
// ラベルの絵（タイトル・小さい文字・帯の色）
function label(key, o = {}) {
  if (o.twice) { const n = o.times || 2, one = { ...o, twice: false, w: Math.round((o.w || 256) / n) }; return ctex('lbl|' + key, o.w || 512, o.h || 256, (c) => { const t = label(key + '|part', one).image; for (let i = 0; i < n; i++) c.drawImage(t, i * one.w, 0); }); }
  const { w = 256, h = 256, bg = '#ffffff', fg = '#222', title = '', sub = '', band = null, bandFg = '#fff', bandText = '', vertical = false, round = 0, border = null, art = null } = o;
  return ctex('lbl|' + key, w, h, (c) => {
    c.fillStyle = bg; c.fillRect(0, 0, w, h);
    if (border) { c.strokeStyle = border; c.lineWidth = w * 0.03; rr(c, w * 0.04, h * 0.04, w * 0.92, h * 0.92, round || w * 0.06); c.stroke(); }
    if (band) { c.fillStyle = band; c.fillRect(0, 0, w, h * 0.24); if (bandText) { c.fillStyle = bandFg; fitText(c, bandText, w * 0.86, h * 0.13, 800); c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(bandText, w / 2, h * 0.125); } }
    if (art) art(c, w, h);
    c.fillStyle = fg; c.textAlign = 'center'; c.textBaseline = 'middle';
    if (vertical) { const n = [...title].length, s = Math.min(w * 0.6, h * 0.8 / n); c.font = `900 ${s}px ${FONT}`; [...title].forEach((ch, i) => c.fillText(ch, w / 2, h / 2 - (n - 1) * s / 2 + i * s)); }
    else if (title) { fitText(c, title, w * 0.86, h * (band ? 0.3 : 0.36), 900); c.fillText(title, w / 2, band ? h * 0.56 : h * 0.46); }
    if (sub) { c.font = `700 ${Math.round(h * 0.09)}px ${FONT}`; fitText(c, sub, w * 0.86, h * 0.1, 700); c.fillText(sub, w / 2, h * 0.84); }
  });
}
const film = () => mat('#f4fbff', { r: 0.08, t: true, op: 0.28, side: THREE.DoubleSide });
const tray = (g, w, d, colr = '#f6f6f2') => { add(g, rbox(w, 0.018, d, 0.006), C(colr, { r: 0.6 })); };
// 透明な袋（中身が見える）＋ラベル
function bag(g, w, h, d, fill, lbl) {
  add(g, rbox(w, h, d, Math.min(d, h) * 0.45, 3), film());
  add(g, T(box(w * 1.02, h * 0.9, 0.012), 0, 0.002, -d / 2 - 0.004), C('#e3e9ee', { r: 0.4 }));
  if (fill) { fill.position.y = 0.004; g.add(fill); }
  if (lbl) add(g, T(new THREE.PlaneGeometry(w * 0.42, d * 0.42), 0, 0, 0, -Math.PI / 2), mat('#ffffff', { map: lbl, r: 0.5 }), w * 0.22, h + 0.001, d * 0.18);
}
// 業務用の袋（パウチ）
function pouch(g, w, h, d, lbl, back = '#ffffff') {
  add(g, rbox(w, h, d, d * 0.48, 3), C(back, { r: 0.35 }));
  add(g, new THREE.PlaneGeometry(w * 0.9, h * 0.88), mat('#ffffff', { map: lbl, r: 0.4 }), 0, h * 0.5, d / 2 + 0.0015);
  add(g, T(box(w * 1.0, 0.014, d * 0.35), 0, h - 0.01, 0), C(shade(back, -0.08), { r: 0.4 }));
}
// 一升瓶
function bottle(g, glass, lbl) {
  add(g, lathe([[0, 0], [0.05, 0], [0.052, 0.006], [0.052, 0.2], [0.046, 0.23], [0.02, 0.27], [0.016, 0.3], [0.016, 0.33], [0, 0.33]], 24), mat(glass, { r: 0.08, t: true, op: 0.92 }));
  add(g, cyl(0.0525, 0.0525, 0.12, 24, true), mat('#ffffff', { map: lbl, r: 0.5 }), 0, 0.05, 0);
  add(g, T(cyl(0.018, 0.018, 0.03, 12), 0, 0.325), C('#d4af37', { r: 0.3, m: 0.7 }));
}
function can(g, r, h, lbl) {
  const steel = C('#c9cdd1', { r: 0.25, m: 0.85 });
  add(g, cyl(r, r, h, 24, true), mat('#ffffff', { map: lbl, r: 0.35 }));
  add(g, T(cyl(r * 1.02, r * 1.02, 0.006, 24), 0, h - 0.003), steel); add(g, cyl(r * 1.02, r * 1.02, 0.006, 24), steel);
  add(g, T(torus(r * 0.85, 0.0025, 4, 24), 0, h + 0.003, 0, Math.PI / 2), steel);
}
function tub(g, r, h, lbl, lid) {
  add(g, cyl(r, r * 0.86, h, 28, true), mat('#ffffff', { map: lbl, r: 0.35 })); add(g, T(new THREE.CircleGeometry(r * 0.86, 24), 0, 0.001, 0, Math.PI / 2), C('#eeeeee'));
  add(g, T(cyl(r * 1.04, r * 1.04, 0.012, 24), 0, h), C(lid, { r: 0.35 }));
}
// ---------- 食材ごとのモデル ----------
const MAKE = {
  men(g) { // 麺箱（木の箱に生麺の玉）
    const wood = C('#d8b07a', { r: 0.6 }), W = 0.3, D = 0.2, H = 0.07;
    add(g, box(W, 0.01, D), wood); add(g, T(box(W, H, 0.01), 0, 0, D / 2 - 0.005), mat('#ffffff', { map: label('menbox', { w: 512, h: 128, bg: '#d8b07a', fg: '#b3201b', title: '生麺　製麺所', round: 0 }), r: 0.6 })); add(g, T(box(W, H, 0.01), 0, 0, -D / 2 + 0.005), wood);
    add(g, T(box(0.01, H, D), W / 2 - 0.005, 0, 0), wood); add(g, T(box(0.01, H, D), -W / 2 + 0.005, 0, 0), wood);
    const nd = tangledNoodles(0.04, 0.035, 10, 'raw', 3); for (let i = 0; i < 6; i++) add(g, nd, VC({ r: 0.5 }), -0.09 + (i % 3) * 0.09, 0.008, -0.045 + Math.floor(i / 3) * 0.09, 0, i, 0);
    add(g, T(box(W * 0.95, 0.002, D * 0.95), 0, 0.012, 0), C('#e8e2cc', { r: 0.9 }));
  },
  negi(g) { // 長ねぎ3本をテープでまとめる（横に寝かせる）
    const X = (r0, r1, len, x, y, z, colr, tz = 0) => add(g, new THREE.CylinderGeometry(r1, r0, len, 14).rotateZ(-Math.PI / 2), C(colr, { r: 0.45 }), x, y, z, 0, tz, 0);
    for (let i = 0; i < 3; i++) {
      const z = (i - 1) * 0.034, y = 0.017 + (i === 1 ? 0.022 : 0);
      X(0.016, 0.017, 0.2, -0.05, y, z, '#f4f3e8'); X(0.017, 0.016, 0.06, 0.08, y, z, '#cfe3a2'); X(0.016, 0.007, 0.2, 0.21, y, z * 1.4, '#4f9a3a', (i - 1) * 0.12);
      X(0.004, 0.015, 0.02, -0.16, y, z, '#d9cfae');
    }
    add(g, new THREE.CylinderGeometry(0.062, 0.062, 0.025, 24, 1, true).rotateZ(Math.PI / 2), C('#c0392b', { r: 0.5, side: THREE.DoubleSide }), 0.0, 0.03, 0, 0, 0, 0).scale.set(1, 1, 0.82);
    g.rotation.y = 0.5;
  },
  chashu(g) { // 豚バラ肉（巻いてたこ糸でしばる）
    tray(g, 0.24, 0.13);
    const meat = new THREE.Group();
    add(meat, T(cyl(0.042, 0.042, 0.17, 24), 0, -0.085), C('#e2a092', { r: 0.6 }));
    const end = ctex('rawpork', 128, 128, (c) => { c.fillStyle = '#e8a497'; c.fillRect(0, 0, 128, 128); c.strokeStyle = '#fbefe6'; c.lineWidth = 9; c.beginPath(); for (let a = 0.6; a < 15; a += 0.1) { const r = 4 + a * 3.9; c.lineTo(64 + Math.cos(a) * r, 64 + Math.sin(a) * r); } c.stroke(); });
    for (const s of [1, -1]) add(meat, T(new THREE.CircleGeometry(0.042, 24), 0, 0.085 * s, 0, -Math.PI / 2 * s), mat('#ffffff', { map: end, r: 0.55 }));
    for (let i = 0; i < 5; i++) add(meat, T(torus(0.0425, 0.0018, 4, 20), 0, -0.068 + i * 0.034, 0, Math.PI / 2), C('#f4efe2', { r: 0.8 }));
    meat.rotation.z = Math.PI / 2; meat.position.y = 0.06; g.add(meat);
    add(g, T(rbox(0.24, 0.1, 0.13, 0.02), 0, 0.012), film());
  },
  menma(g) { const f = new THREE.Group(); for (let i = 0; i < 6; i++) { const p = PIECE.menma(mulberry32(i + 3)); p.position.set(-0.05 + (i % 3) * 0.05, 0.01 + Math.floor(i / 3) * 0.012, -0.012 + (i % 2) * 0.02); p.rotation.y = i; f.add(p); } bag(g, 0.18, 0.06, 0.12, f, label('menma', { bg: '#fff4d6', fg: '#8a5a12', title: 'メンマ', border: '#c9973f' })); },
  nori(g) { add(g, box(0.21, 0.014, 0.19), C('#162119', { r: 0.6 })); add(g, T(box(0.215, 0.016, 0.07), 0, 0, 0), mat('#ffffff', { map: label('nori', { w: 256, h: 96, bg: '#c4161c', fg: '#f7e3a1', title: '焼海苔　全形' }), r: 0.4 })); add(g, T(rbox(0.22, 0.02, 0.2, 0.004), 0, -0.002, 0), film()); },
  ajitama(g) { // 卵パック
    add(g, box(0.27, 0.012, 0.11), mat('#f2f7fb', { r: 0.2, t: true, op: 0.5 }));
    for (let i = 0; i < 10; i++) { const x = -0.108 + (i % 5) * 0.054, z = -0.026 + Math.floor(i / 5) * 0.052; add(g, T(sph(1, 14, 10), 0, 0, 0, 0, 0, 0, 0.021, 0.028, 0.021), C('#e8c79c', { r: 0.4 }), x, 0.03, z); add(g, T(lathe([[0.016, 0], [0.026, 0.03], [0.024, 0.032]], 14), 0, 0.006), film(), x, 0, z); }
    add(g, T(rbox(0.28, 0.06, 0.12, 0.02), 0, 0.012), film());
    add(g, T(new THREE.PlaneGeometry(0.1, 0.03), 0, 0, 0, -Math.PI / 2), mat('#ffffff', { map: label('egg', { w: 256, h: 80, bg: '#fff8e8', fg: '#c0392b', title: '新鮮たまご 10個' }), r: 0.5 }), 0, 0.073, 0);
  },
  moyashi(g) { const f = PIECE.moyashi(mulberry32(5), 70, 0.07, 0.03); f.scale.set(1.2, 1, 0.75); bag(g, 0.2, 0.065, 0.13, f, label('moyashi', { bg: '#ffffff', fg: '#2e7d32', title: 'もやし', border: '#2e7d32' })); },
  corn(g) { can(g, 0.04, 0.11, label('corn', { w: 768, h: 256, twice: true, times: 3, bg: '#1f7a3a', fg: '#ffe066', title: 'コーン', band: '#f7c62c', bandFg: '#1f7a3a', bandText: 'ホール', art: (c, w, h) => { c.fillStyle = '#f7c62c'; for (let i = 0; i < 40; i++) { c.beginPath(); c.arc(w * 0.08 + (i % 10) * 12, h * 0.7 + Math.floor(i / 10) * 12, 5, 0, 7); c.fill(); } } })); },
  butter(g) { add(g, rbox(0.12, 0.05, 0.065, 0.004), C('#f9d55b', { r: 0.4 })); add(g, T(new THREE.PlaneGeometry(0.11, 0.058), 0, 0, 0, -Math.PI / 2), mat('#ffffff', { map: label('butter', { w: 256, h: 136, bg: '#f9d55b', fg: '#7a4b12', title: 'バター', sub: '有塩　業務用', border: '#ffffff' }), r: 0.4 }), 0, 0.0505, 0); add(g, new THREE.PlaneGeometry(0.11, 0.04), mat('#ffffff', { map: label('butter2', { w: 256, h: 96, bg: '#f9d55b', fg: '#7a4b12', title: 'BUTTER' }), r: 0.4 }), 0, 0.025, 0.0326); },
  naruto(g) {
    tray(g, 0.2, 0.08, '#fdfdfd');
    const o = new THREE.Group(), side = cyl(0.026, 0.026, 0.17, 32), p = side.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), z = p.getZ(i), d = Math.hypot(x, z); if (d < 1e-5) continue; const f = 1 + 0.06 * Math.cos(16 * Math.atan2(z, x)); p.setXYZ(i, x * f, p.getY(i), z * f); } side.computeVertexNormals();
    add(o, T(side, 0, -0.085), C('#fffaf3', { r: 0.35 }));
    const top = PIECE.naruto(); top.scale.set(1.24, 1, 1.24); top.position.y = 0.083; o.add(top);
    o.rotation.set(0, -0.7, Math.PI / 2); o.position.y = 0.045; g.add(o);
  },
  spinach(g) { // ほうれん草の束（根元がピンク）
    const r = mulberry32(8), ps = [];
    for (let i = 0; i < 8; i++) { const z = (i - 3.5) * 0.011, ry = (r() - 0.5) * 0.25, y = 0.012 + (i % 2) * 0.006; ps.push(tint(new THREE.CylinderGeometry(0.0035, 0.004, 0.12, 6).rotateZ(Math.PI / 2).rotateY(ry).translate(-0.02, y, z), '#8bbf5a')); for (let k = 0; k < 2; k++) ps.push(tint(new THREE.SphereGeometry(1, 10, 6).scale(0.045, 0.006, 0.022).rotateY(ry + (k - 0.5) * 0.5).translate(0.075 + k * 0.03 + r() * 0.01, y + 0.008 + k * 0.004, z * 1.7 + (k - 0.5) * 0.012), ['#2f6b2a', '#3c7a30', '#28592a'][(i + k) % 3])); ps.push(tint(new THREE.CylinderGeometry(0.006, 0.002, 0.022, 6).rotateZ(Math.PI / 2).translate(-0.09, y, z), '#d9607a')); }
    g.add(new THREE.Mesh(merge(ps, true), VC({ r: 0.45 })));
    add(g, new THREE.CylinderGeometry(0.05, 0.05, 0.018, 20, 1, true).rotateZ(Math.PI / 2), C('#2b6cb0', { r: 0.5, side: THREE.DoubleSide }), -0.045, 0.018, 0).scale.set(1, 0.55, 1.1);
    g.rotation.y = 0.5;
  },
  seabura(g) { tub(g, 0.06, 0.07, label('seabura', { w: 768, h: 160, twice: true, times: 3, bg: '#ffffff', fg: '#5a6470', title: '背脂', sub: '国産', border: '#9aa5b1' }), '#e8eef2'); },
  karamiso(g) { tub(g, 0.05, 0.06, label('karamiso', { w: 768, h: 160, twice: true, times: 3, bg: '#b3221a', fg: '#fff', title: '辛味噌', sub: '激辛' }), '#7a1410'); },
  kikurage(g) { const f = new THREE.Group(); for (let i = 0; i < 5; i++) { const p = PIECE.kikurage(mulberry32(i + 9)); p.position.set(-0.05 + (i % 3) * 0.05, 0.006, -0.02 + (i % 2) * 0.04); f.add(p); } bag(g, 0.18, 0.05, 0.12, f, label('kikurage', { bg: '#ffffff', fg: '#3a2820', title: 'きくらげ', border: '#3a2820' })); },
  kome(g) { add(g, rbox(0.26, 0.36, 0.1, 0.04, 3), C('#f1e6cb', { r: 0.8 })); add(g, new THREE.PlaneGeometry(0.22, 0.3), mat('#ffffff', { map: label('kome', { w: 256, h: 352, bg: '#f4ead2', fg: '#1f5f2f', title: '米', sub: '国産こしひかり', band: '#1f5f2f', bandText: '20杯分', border: '#1f5f2f' }), r: 0.7 }), 0, 0.18, 0.0505); g.rotation.x = -0.25; },
  gyozaF(g) { add(g, box(0.26, 0.045, 0.18), mat('#ffffff', { map: label('gyozaF', { w: 512, h: 360, bg: '#1d4f91', fg: '#ffffff', title: '冷凍餃子', sub: '30個入り', band: '#d62828', bandText: '本格焼き餃子', art: (c, w, h) => { c.fillStyle = '#f2e2bd'; for (let i = 0; i < 5; i++) { c.beginPath(); c.ellipse(w * 0.2 + i * w * 0.15, h * 0.72, w * 0.06, h * 0.05, 0, 0, 7); c.fill(); } } }), r: 0.45 })); },
  taru(g) { // ビール樽
    const steel = C('#c9ced3', { r: 0.22, m: 0.9 });
    add(g, lathe([[0, 0], [0.11, 0], [0.12, 0.02], [0.12, 0.38], [0.11, 0.4], [0, 0.4]], 28), steel);
    for (const y of [0.1, 0.3]) add(g, T(torus(0.121, 0.006, 5, 28), 0, y, 0, Math.PI / 2), steel);
    add(g, T(cyl(0.03, 0.03, 0.03, 16), 0, 0.4), C('#333', { r: 0.4 })); add(g, T(cyl(0.012, 0.012, 0.03, 10), 0, 0.43), C('#d62828', { r: 0.4 }));
    add(g, T(new THREE.PlaneGeometry(0.12, 0.12), 0, 0.2, 0.1215), mat('#ffffff', { map: label('beerkeg', { w: 256, h: 256, bg: '#f7b52c', fg: '#7a1410', title: '生ビール', sub: '業務用 20杯分', round: 30 }), r: 0.4 }));
  },
  chicken(g) { tray(g, 0.24, 0.15); const r = mulberry32(4); for (let i = 0; i < 4; i++) add(g, T(sph(1, 12, 8), 0, 0, 0, 0, r() * 3, 0, 0.05, 0.016, 0.034), C('#f0b6a8', { r: 0.45 }), -0.06 + (i % 2) * 0.11, 0.028, -0.032 + Math.floor(i / 2) * 0.064); add(g, T(rbox(0.24, 0.05, 0.15, 0.02), 0, 0.012), film()); add(g, T(new THREE.PlaneGeometry(0.08, 0.05), 0, 0, 0, -Math.PI / 2), mat('#ffffff', { map: label('chicken', { w: 256, h: 160, bg: '#ffffff', fg: '#c0392b', title: '鶏もも', sub: '国産　唐揚げ用', border: '#c0392b' }), r: 0.5 }), 0.05, 0.064, 0.03); },
  torigara(g) { // 鶏ガラ（トレーにラップ）
    tray(g, 0.26, 0.17); const r = mulberry32(3);
    for (let i = 0; i < 2; i++) { const o = new THREE.Group(); add(o, new THREE.IcosahedronGeometry(0.05, 1).scale(1.4, 0.55, 0.9), C('#efd6b0', { r: 0.6, flat: true })); for (let k = 0; k < 4; k++) add(o, new THREE.CylinderGeometry(0.008, 0.01, 0.07, 6).rotateZ(Math.PI / 2 + (r() - 0.5)).translate((r() - 0.5) * 0.08, 0.02, (r() - 0.5) * 0.06), C('#f3e6cc', { r: 0.5 })); o.position.set(-0.055 + i * 0.11, 0.035, 0); o.rotation.y = i * 1.3; g.add(o); }
    add(g, T(rbox(0.26, 0.07, 0.17, 0.02), 0, 0.012), film());
    add(g, T(new THREE.PlaneGeometry(0.09, 0.05), 0, 0, 0, -Math.PI / 2), mat('#ffffff', { map: label('torigara', { w: 256, h: 140, bg: '#fffaf0', fg: '#b3201b', title: '鶏ガラ', sub: '国産　だし用', border: '#b3201b' }), r: 0.5 }), 0.06, 0.084, 0.04);
  },
  tonkotsuB(g) { // 豚骨（げんこつ）
    tray(g, 0.28, 0.17);
    const m = C('#f1e6d2', { r: 0.5 });
    for (let i = 0; i < 3; i++) { const b = new THREE.Group(); add(b, new THREE.CylinderGeometry(0.016, 0.016, 0.17, 10).rotateZ(Math.PI / 2), m); for (const x of [-0.09, 0.09]) add(b, new THREE.SphereGeometry(0.03, 10, 8).scale(1, 0.85, 1.25), m, x, 0, 0); b.position.set(0, 0.035 + (i === 1 ? 0.02 : 0), -0.045 + i * 0.045); b.rotation.y = (i - 1) * 0.15; g.add(b); }
    add(g, T(rbox(0.28, 0.08, 0.17, 0.02), 0, 0.012), film());
    add(g, T(new THREE.PlaneGeometry(0.1, 0.05), 0, 0, 0, -Math.PI / 2), mat('#ffffff', { map: label('tonkotsuB', { w: 256, h: 130, bg: '#fffaf0', fg: '#7a4b12', title: '豚骨', sub: 'げんこつ　だし用', border: '#7a4b12' }), r: 0.5 }), 0.07, 0.094, 0.045);
  },
  niboshiG(g) { const f = new THREE.Group(), ps = [], r = mulberry32(6); for (let i = 0; i < 26; i++) ps.push(T(new THREE.SphereGeometry(1, 8, 5), (r() - 0.5) * 0.15, 0.01 + r() * 0.025, (r() - 0.5) * 0.09, 0, r() * 6, 0, 0.03, 0.006, 0.008)); f.add(new THREE.Mesh(merge(ps), C('#a9adb3', { r: 0.35, m: 0.5 }))); bag(g, 0.19, 0.055, 0.12, f, label('niboshiG', { bg: '#1d4f91', fg: '#ffffff', title: '煮干し', border: '#ffffff' })); },
  yasai(g) { // 香味野菜：ねぎ・しょうが・にんにく
    tray(g, 0.26, 0.16, '#e8f0e0');
    add(g, new THREE.CylinderGeometry(0.016, 0.017, 0.2, 12).rotateZ(Math.PI / 2), C('#f4f3e8', { r: 0.45 }), -0.02, 0.03, -0.04);
    add(g, new THREE.CylinderGeometry(0.008, 0.016, 0.08, 10).rotateZ(-Math.PI / 2), C('#4f9a3a', { r: 0.5 }), 0.12, 0.03, -0.04);
    const gin = new THREE.Group(); for (let i = 0; i < 4; i++) add(gin, new THREE.SphereGeometry(0.02, 8, 6).scale(1.4, 0.8, 1), C('#d9b878', { r: 0.7 }), (i % 2) * 0.03, 0, Math.floor(i / 2) * 0.025 - 0.012); gin.position.set(-0.06, 0.028, 0.04); g.add(gin);
    for (let i = 0; i < 2; i++) { add(g, new THREE.SphereGeometry(0.024, 12, 8).scale(1, 0.9, 1), C('#f7f2e8', { r: 0.5 }), 0.05 + i * 0.05, 0.034, 0.045); add(g, new THREE.ConeGeometry(0.008, 0.02, 8), C('#e9dcc0', { r: 0.6 }), 0.05 + i * 0.05, 0.062, 0.045); }
  },
  kombu(g) { add(g, box(0.24, 0.012, 0.12), C('#24301e', { r: 0.6 })); add(g, T(box(0.25, 0.016, 0.05), 0, -0.001, 0), mat('#ffffff', { map: label('kombu', { w: 384, h: 80, bg: '#e9dcb4', fg: '#24301e', title: '日高昆布　だし用' }), r: 0.5 })); add(g, T(rbox(0.25, 0.018, 0.13, 0.004), 0, -0.002, 0), film()); },
  t_shoyu(g) { bottle(g, '#3a1f12', label('t_shoyu', { w: 384, h: 256, twice: true, times: 2, bg: '#f6efdd', fg: '#6b1d0f', title: '醤油', sub: '本醸造' })); },
  t_black(g) { bottle(g, '#120a06', label('t_black', { w: 384, h: 256, twice: true, times: 2, bg: '#1b1b1b', fg: '#f2c94c', title: 'たまり', sub: '濃口醤油' })); },
  t_shio(g) { pouch(g, 0.13, 0.17, 0.05, label('t_shio', { w: 256, h: 320, bg: '#ffffff', fg: '#1d4f91', title: '天然塩', sub: '海の塩', band: '#1d4f91', bandText: 'しおダレ用' }), '#ffffff'); },
  t_miso(g) { tub(g, 0.075, 0.09, label('t_miso', { w: 768, h: 160, twice: true, times: 3, bg: '#a35d1c', fg: '#fff5e6', title: '味噌', sub: '合わせ' }), '#6b3a10'); },
  t_goma(g) { tub(g, 0.05, 0.08, label('t_goma', { w: 768, h: 160, twice: true, times: 3, bg: '#e6cf9c', fg: '#5a3a10', title: '練りごま' }), '#5a3a10'); const b = new THREE.Group(); bottle(b, '#b3221a', label('t_goma2', { w: 256, h: 200, twice: true, times: 2, bg: '#b3221a', fg: '#ffffff', title: 'ラー油' })); b.scale.setScalar(0.5); b.position.set(0.09, 0, 0.02); g.add(b); },
  d_bowl(g) { for (let i = 0; i < 3; i++) { const s = new THREE.Group(); bowlBase(s, 'bowl'); s.position.y = i * 0.032; g.add(s); } },
  d_bowlS(g) { for (let i = 0; i < 3; i++) { const s = new THREE.Group(); bowlBase(s, 'bowlS'); s.position.y = i * 0.026; g.add(s); } },
  d_plate(g) { for (let i = 0; i < 5; i++) { const s = new THREE.Group(); plateBase(s); s.position.y = i * 0.012; g.add(s); } },
  d_mug(g) { for (let i = 0; i < 2; i++) { const s = new THREE.Group(); const glass = mat('#cfe6f5', { r: 0.04, t: true, op: 0.45, side: THREE.DoubleSide }); add(s, lathe([[0.034, 0], [0.041, 0.002], [0.043, 0.012], [0.043, 0.15], [0.0405, 0.15], [0.0395, 0.018], [0, 0.018]], 20), glass); add(s, T(torus(0.032, 0.0075, 6, 14, Math.PI), 0.045, 0.082, 0, 0, 0, -Math.PI / 2, 0.8, 1, 1), glass); s.position.x = (i - 0.5) * 0.1; s.rotation.y = i * 2; g.add(s); } },
};
// スープの材料（業務用パウチ）
const SOUP_KANJI = { shoyu: '醤油', shio: '塩', miso: '味噌', tonkotsu: '豚骨', iekei: '家系', tantan: '担々', niboshi: '煮干', black: '黒醤油' };
function soupSet(g, k) {
  const s = SOUPS[k], dark = ['shoyu', 'miso', 'tantan', 'niboshi', 'black'].includes(k);
  const lbl = label('soup|' + k, { w: 256, h: 320, bg: '#fffaf0', fg: dark ? s.color : shade(s.color, -0.35), title: SOUP_KANJI[k] || s.name, sub: 'スープの素　業務用', band: s.color, bandFg: dark ? '#fff' : '#3a2a18', bandText: 'らーめんスープ', art: (c, w, h) => { c.fillStyle = s.color; c.beginPath(); c.ellipse(w / 2, h * 0.7, w * 0.3, h * 0.05, 0, 0, 7); c.fill(); } });
  pouch(g, 0.16, 0.2, 0.045, lbl, '#fffaf0');
}
export function ingredientMesh(id) {
  const p = INGREDIENTS[id]; if (!p) return new THREE.Group();
  const k = 'ing|' + id;
  let o = CACHE.get(k);
  if (!o) { const g = new THREE.Group(); (MAKE[id] || MAKE.butter)(g); o = bakeGroup(g); CACHE.set(k, o); }
  return o.clone();
}
const CACHE = new Map();
