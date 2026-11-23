// ===== 描画：店の状態 → 3Dシーン =====
import * as THREE from 'three';
import { RoomEnvironment } from 'three/addons/environments/RoomEnvironment.js';
import { FIXTURES, TOPPINGS, SOUPS, BROTHS, TARES, GRIDDLE, BUILDING, HALL, DRONE_PAD, RICE_READY, SOUP_READY, localToWorld, basketPos, passPos, CHOHAN_T } from './data.js';
import { buildFixture, ANCHOR } from './models/fixtures.js';
import { dishMesh, dishKey, dirtyMesh, cleanMesh, toolMesh, basketMesh, grillFood, panFill, toppingDish, noodleBall, soupSurface, riceSurface, pile, potContents, dryRackMesh, washingMesh, cashMesh, tareBowl, tarePot } from './models/food.js';
import { potHeat, potAku } from './sim.js';
const DRIP = new THREE.CylinderGeometry(0.004, 0.05, 0.22, 10, 1, true);
import { ingredientMesh } from './models/products.js';
import { setShooter, thumbTick, thumbCanvas, onThumb, menuKey as menuKeyOf } from './thumbs.js';
const SIDE_DISH = { rice: { k: 'bowlS', side: 'rice' }, chadon: { k: 'bowlS', side: 'rice', tp: ['chashu', 'negi'] }, gyoza: { k: 'plate', side: 'gyoza', q: 90 }, karaage: { k: 'plate', side: 'karaage', q: 90 }, beer: { k: 'mug', side: 'beer', fill: 1 } };
import { Character, randomAvatar } from './models/character.js';
import { World, CEIL } from './models/world.js';
import { bakeGroup, mat, smat, setLiteMaterials, rbox, box } from './models/geo.js';
import { setAniso, setTexQuality, tex, canvasTex, rr, FONT, surf } from './textures.js';
import { angleLerp, lerp } from './util.js';

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _v = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _e = new THREE.Euler();
const UP = new THREE.Vector3(0, 1, 0);
const SUN_C = [(BUILDING.minX + HALL.x1) / 2, (BUILDING.minZ + BUILDING.maxZ) / 2];
class Instancer {
  constructor(root, makeParts) { this.root = root; this.make = makeParts; this.map = new Map(); }
  begin() { for (const e of this.map.values()) e.list.length = 0; }
  push(key, matrix) { let e = this.map.get(key); if (!e) { e = { list: [], meshes: [], cap: 0 }; this.map.set(key, e); } e.list.push(matrix.clone()); }
  end() {
    for (const [key, e] of this.map) {
      const n = e.list.length;
      if (n > e.cap) {
        for (const m of e.meshes) { this.root.remove(m); m.dispose(); }
        e.cap = Math.max(8, Math.ceil(n * 1.5));
        e.meshes = this.make(key).map(({ g, m }) => { const im = new THREE.InstancedMesh(g, m, e.cap); im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false; this.root.add(im); return im; });
      }
      for (const im of e.meshes) { for (let i = 0; i < n; i++) im.setMatrixAt(i, e.list[i]); im.count = n; im.visible = n > 0; im.instanceMatrix.needsUpdate = true; }
    }
  }
}
// 共有の小さな形
const UNIT_DISC = new THREE.CircleGeometry(1, 28).rotateX(-Math.PI / 2);
const FLAME = new THREE.ConeGeometry(0.012, 0.05, 5).translate(0, 0.025, 0);
function disc(color, r, y, o = {}) { const m = new THREE.Mesh(UNIT_DISC, mat(color, { r: 0.12, m: 0.05, ...o })); m.scale.set(r, 1, r); m.position.y = y; return m; }

export class Renderer {
  constructor(canvas, settings) {
    this.canvas = canvas; this.settings = settings; this.lite = !!settings.lite;
    setLiteMaterials(this.lite);
    this.r = new THREE.WebGLRenderer({ canvas, antialias: !this.lite, powerPreference: 'high-performance', alpha: false });
    setShooter((k, spec) => this._shootProduct(k, spec));
    onThumb((k) => { if (k.startsWith('menu:') || k.startsWith('side:')) this.storeRev = -1; });
    this.r.outputColorSpace = THREE.SRGBColorSpace;
    this.r.toneMapping = THREE.ACESFilmicToneMapping; this.r.toneMappingExposure = 1.0;
    setAniso(Math.min(this.lite ? 2 : 8, this.r.capabilities.getMaxAnisotropy()));
    setTexQuality(!this.lite, !this.lite && !!settings.ultra);
    this.scene = new THREE.Scene();
    this.scene.fog = new THREE.Fog(0xcfe9ff, 45, 160);
    this.camera = new THREE.PerspectiveCamera(settings.fov || 68, 1, 0.06, 260);
    this.hemi = new THREE.HemisphereLight(0xe8f4ff, 0xb7a58f, 1.2);
    this.sun = new THREE.DirectionalLight(0xfff4e0, 2.2);
    this.sun.shadow.mapSize.set(2048, 2048);
    const sc = this.sun.shadow.camera; sc.left = -30; sc.right = 30; sc.top = 26; sc.bottom = -26; sc.near = 1; sc.far = 120; sc.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.03;
    this.sun.target.position.set(SUN_C[0], 0, SUN_C[1]);
    this.scene.add(this.hemi, this.sun, this.sun.target);
    this.indoor = [];
    for (let i = 0; i < (this.lite ? 0 : 6); i++) { const l = new THREE.PointLight(0xffe7c2, 0, 13, 2); l.position.set(0, 2.9, 0); this.scene.add(l); this.indoor.push(l); }
    if (!this.lite) { try { const pm = new THREE.PMREMGenerator(this.r); this.envTex = pm.fromScene(new RoomEnvironment(), 0.04).texture; this.scene.environment = this.envTex; pm.dispose(); } catch (e) { console.warn('環境マップなしで続行', e); } }
    this.applySettings(settings);
    this.world = new World(this.scene, { lite: this.lite });
    this.fixRoot = new THREE.Group(); this.scene.add(this.fixRoot);
    this.propRoot = new THREE.Group(); this.scene.add(this.propRoot);
    this.charRoot = new THREE.Group(); this.scene.add(this.charRoot);
    this.fxRoot = new THREE.Group(); this.scene.add(this.fxRoot);
    this.handRoot = new THREE.Group(); this.scene.add(this.handRoot);
    this.fixViews = new Map(); this.chars = new Map(); this.hands = new Map();
    this.storeRev = -1; this.t = 0; this.highlight = null; this.ghost = null;
    this._parts = []; this._pool = [];
    this.resize();
  }
  applySettings(s) {
    this.settings = s;
    const ultra = !this.lite && !!s.ultra;
    this.dpr = Math.max(0.4, Math.min(window.devicePixelRatio || 1, this.lite ? 1 : 2) * (s.res || 1));
    this.r.setPixelRatio(this.dpr);
    const sh = !this.lite && s.shadows !== false, changed = this.r.shadowMap.enabled !== sh;
    this.r.shadowMap.enabled = sh; this.r.shadowMap.type = THREE.PCFSoftShadowMap;
    if (changed && this.scene) this.scene.traverse((o) => { if (o.material) o.material.needsUpdate = true; });
    this.sun.castShadow = sh;
    const ms = ultra ? 4096 : s.res < 0.8 ? 1024 : 2048;
    if (this.sun.shadow.mapSize.x !== ms) { this.sun.shadow.mapSize.set(ms, ms); if (this.sun.shadow.map) { this.sun.shadow.map.dispose(); this.sun.shadow.map = null; } }
    this.camera.fov = s.fov || 68; this.camera.updateProjectionMatrix();
    this.scene.fog.far = this.lite ? 90 : 160;
    if (ultra !== !!this.composer && ultra !== this._postWanted) this.enablePost(ultra);
    this.resize();
  }
  async enablePost(on) {
    this._postWanted = on;
    if (!on) { if (this.composer) { this.composer.dispose?.(); this.composer = null; } return; }
    try {
      const base = 'three/addons/postprocessing/';
      const [{ EffectComposer }, { RenderPass }, { SSAOPass }, { UnrealBloomPass }, { OutputPass }] = await Promise.all(['EffectComposer', 'RenderPass', 'SSAOPass', 'UnrealBloomPass', 'OutputPass'].map((n) => import(base + n + '.js')));
      if (!this._postWanted) return;
      const w = window.innerWidth, h = window.innerHeight;
      const c = new EffectComposer(this.r, new THREE.WebGLRenderTarget(w, h, { type: THREE.HalfFloatType, samples: 4 }));
      c.addPass(new RenderPass(this.scene, this.camera));
      const ao = new SSAOPass(this.scene, this.camera, w, h, 16); ao.kernelRadius = 0.45; ao.minDistance = 0.00008; ao.maxDistance = 0.0035; c.addPass(ao);
      c.addPass(new UnrealBloomPass(new THREE.Vector2(w, h), 0.25, 0.45, 0.92));
      c.addPass(new OutputPass());
      this.composer = c; this.resize();
    } catch (e) { console.warn('高画質エフェクトを使えません', e); this.composer = null; }
  }
  _viewSize() { const c = this.r.domElement, cw = Number(c?.clientWidth), ch = Number(c?.clientHeight); return [Math.max(1, Math.round(cw > 0 ? cw : window.innerWidth)), Math.max(1, Math.round(ch > 0 ? ch : window.innerHeight))]; }
  resize() {
    const [w, h] = this._viewSize(); this._vw = w; this._vh = h;
    this.r.setSize(w, h, false);
    this.camera.aspect = w / h; this._shiftKey = null; this.camera.clearViewOffset(); this.camera.updateProjectionMatrix();
    if (this.composer) { this.composer.setPixelRatio(Math.min(this.dpr || 1, 1.5)); this.composer.setSize(w, h); }
  }
  setViewShift(px) {
    px = Math.round(px || 0);
    const w = this._vw || window.innerWidth, h = this._vh || window.innerHeight, key = px + '|' + w + 'x' + h;
    if (key === this._shiftKey) return; this._shiftKey = key;
    if (!px) this.camera.clearViewOffset(); else this.camera.setViewOffset(w, h, -px, 0, w, h);
    this.camera.updateProjectionMatrix();
  }
  _fit() { const [w, h] = this._viewSize(); if (w !== this._vw || h !== this._vh) this.resize(); }
  setTime(min) {
    const h = min / 60;
    const day = THREE.MathUtils.clamp(1 - Math.abs(h - 13) / 8, 0, 1), dusk = Math.max(0, 1 - Math.abs(h - 18) / 1.6), night = THREE.MathUtils.clamp((h - 18.5) / 1.5, 0, 1);
    const top = new THREE.Color('#5fb4ff').lerp(new THREE.Color('#ff9a62'), dusk * 0.6).lerp(new THREE.Color('#0d1b3d'), night);
    const midc = new THREE.Color('#c9ecff').lerp(new THREE.Color('#ffc58a'), dusk).lerp(new THREE.Color('#25305a'), night);
    this.world.skyMat.uniforms.top.value.copy(top); this.world.skyMat.uniforms.mid.value.copy(midc); this.scene.fog.color.copy(midc);
    const env = !this.lite;
    this.sun.intensity = (env ? 1.6 : 2.2) * (0.55 + 0.45 * day) * (1 - night * 0.6);
    this.sun.color.set('#fff4e0').lerp(new THREE.Color('#ffb070'), dusk).lerp(new THREE.Color('#9fb6ff'), night);
    const ang = (h - 6) / 14 * Math.PI;
    this.sun.position.set(SUN_C[0] + Math.cos(ang) * 18, 34, SUN_C[1] + 12 + Math.sin(ang) * 6);
    this.hemi.intensity = (env ? 0.7 : 1.5) * (1 - night * 0.35);
    const indoor = env ? 5 + night * 14 + dusk * 5 : 0;
    for (const l of this.indoor) l.intensity = indoor;
    this.world.lampMat.color.set(night > 0.2 || dusk > 0.5 ? '#ffe9a8' : '#777777');
  }
  _placeIndoor() {
    const spots = this.world.lightSpots || [], n = this.indoor.length;
    this.indoor.forEach((l, i) => { const s = spots.length > n ? spots[Math.floor((i + 0.5) * spots.length / n)] : spots[i]; l.visible = !!s; if (s) l.position.set(s[0], 2.9, s[1]); });
  }
  // ---------- 設備 ----------
  syncStore(store) {
    const wk = this.world._key;
    this.world.updateStore(store);
    if (wk !== this.world._key) this._placeIndoor();
    if (store.rev === this.storeRev) return;
    this.storeRev = store.rev; this.store = store;
    const menuKey = (store.menu || []).filter((m) => m.on).map((m) => m.name + m.price + (thumbCanvas(menuKeyOf(m)) ? '+' : '')).join(',');
    const seen = new Set();
    for (const f of store.fixtures) {
      const def = FIXTURES[f.t]; if (!def) continue;
      const key = [f.t, f.x, f.z, f.r, f.tx, f.c, store.color, f.br ? 1 : 0, f.t === 'ticket' || f.t === 'menuboard' ? menuKey : '', f.t === 'opensign' ? store.phase === 'open' : 0].join('|');
      seen.add(f.id);
      const v = this.fixViews.get(f.id);
      if (v && v.key === key) continue;
      if (v) { this.fixRoot.remove(v.group); v.group.traverse((o) => o.isMesh && o.geometry.dispose()); }
      let g;
      try { g = bakeGroup(buildFixture(f, { color: store.color, phase: store.phase, menu: store.menu })); }
      catch (e) { console.warn('設備モデル失敗', f.t, e); g = new THREE.Group(); g.add(new THREE.Mesh(new THREE.BoxGeometry(def.w, 1, def.d).translate(0, 0.5, 0), mat(0xcccccc))); }
      g.position.set(f.x, 0, f.z); g.rotation.y = f.r * Math.PI / 2;
      g.traverse((o) => { if (o.isMesh) { o.userData.fid = f.id; o.castShadow = !this.lite && !o.material.transparent; o.receiveShadow = !this.lite; } });
      this.fixRoot.add(g);
      this.fixViews.set(f.id, { key, group: g });
    }
    for (const [id, v] of this.fixViews) if (!seen.has(id)) { this.fixRoot.remove(v.group); v.group.traverse((o) => o.isMesh && o.geometry.dispose()); this.fixViews.delete(id); }
    // 開店前は札の上に目印
    const sign = store.fixtures.find((f) => f.t === 'opensign');
    if (!this.signHint) { this.signHint = new THREE.Sprite(new THREE.SpriteMaterial({ map: signHintTex(), depthTest: false, transparent: true, toneMapped: false })); this.signHint.scale.set(1.3, 0.48, 1); this.signHint.renderOrder = 9; this.scene.add(this.signHint); }
    this.signHint.visible = !!sign && store.phase === 'prep';
    if (sign) this.signHint.position.set(sign.x, 2.0, sign.z);
  }
  // ---------- 調理中の中身・席の料理・食器（変わったときだけ作り直す） ----------
  syncProps(store, dyn, clk) {
    this._propT = (this._propT || 0) - 1;
    const parts = [];
    for (const f of store.fixtures) {
      const d = FIXTURES[f.t];
      if (d.pot) parts.push('p' + f.id + (f.pot ? `${f.pot.w}${f.pot.b}${JSON.stringify(f.pot.n)}${Math.ceil(f.pot.sv / 3)}${f.pot.fire}${f.pot.b ? Math.min(4, Math.floor(potHeat(f.pot, clk) / BROTHS[f.pot.b].ready * 4)) : 0}${Math.round(potAku(f.pot, clk) * 5)}` : '-'));
      if (d.baskets) parts.push('b' + f.id + f.bk.map((x) => (x ? Math.min(3, Math.floor((clk - x.t0) / 12)) + (x.dr && clk - (x.dt || 0) < 0.6 ? 'L' + Math.floor(x.dr * 3) : '') : '-')).join(''));
      if (d.griddle) parts.push('g' + f.id + (f.gr ? Math.min(4, Math.floor((clk - f.gr.t0) / 8)) : '-'));
      if (d.rice) parts.push('r' + f.id + (f.rc ? (clk - f.rc.t0 >= RICE_READY ? 'y' : 'n') + f.rc.sv : '-'));
      if (d.board) parts.push('j' + f.id + (f.job ? f.job.tid + Math.floor(f.job.p * 4) : '-'));
      if (d.pass) parts.push('s' + f.id + f.ps.map((x) => (x ? dishKey(x) : '-')).join(';'));
      if (d.seats) parts.push('d' + f.id + (f.dd || []).map((a) => a.join('.')).join(';'));
      if (d.topping) parts.push('t' + f.id + (f.tj ? f.tj.k + Math.floor(f.tj.p * 3) : '') + Object.entries(store.tare || {}).map(([k, n]) => k + Math.min(3, Math.ceil(n / 10))).join(''));
      if (d.sink) parts.push('k' + f.id + (f.wp ? f.wk + Math.floor(f.wp * 3) : ''));
    }
    parts.push('P' + Object.entries(store.prep || {}).map(([k, v]) => k + Math.min(4, Math.ceil(v / Math.max(1, (TOPPINGS[k]?.per || 20) / 4)))).join(','));
    parts.push('D' + Object.values(store.dish || {}).map((n) => Math.min(6, n)).join(',') + 'X' + Object.values(store.dirty || {}).map((n) => Math.min(8, n)).join(',') + 'Y' + Object.values(store.dry || {}).join(','));
    parts.push('V' + (dyn?.sv || []).map(([fid, si, i, dd, frac]) => `${fid}.${si}.${i}.${dishKey(dd, frac)}`).join(';'));
    parts.push('C' + (dyn?.ch ? dyn.ch.ph + (dyn.ch.d || []).join('') + JSON.stringify(dyn.ch.b || {}) : ''));
    const key = parts.join('|');
    if (key === this._propKey) return;
    this._propKey = key;
    for (const o of [...this.propRoot.children]) this.propRoot.remove(o);
    this._flames = [];
    const put = (f, obj, lx, y, lz, ry = 0) => { const [wx, wz] = localToWorld(f, lx, lz); obj.position.set(wx, y, wz); obj.rotation.y = f.r * Math.PI / 2 + ry; this.propRoot.add(obj); return obj; };
    const servedAt = new Map();
    for (const [fid, si, i, dd, frac] of dyn?.sv || []) { const k = fid + ':' + si; if (!servedAt.has(k)) servedAt.set(k, []); servedAt.get(k).push([i, dd, frac]); }
    for (const f of store.fixtures) {
      const d = FIXTURES[f.t];
      if (f.br) continue;
      if (d.pot && f.pot) {
        const A = ANCHOR[f.t] || ANCHOR.pot, P = f.pot, fill = P.b ? Math.max(0.2, (P.sv + 2) / (d.pot.sv + 2)) : 0.85;
        const pc = potContents(P, A.r - 0.012, potHeat(P, clk), potAku(P, clk)); if (pc) put(f, pc, 0, A.y - 0.04 + (A.h - 0.06) * fill, 0);
        if (f.pot.fire) { const ring = new THREE.Group(); for (let i = 0; i < 12; i++) { const fl = new THREE.Mesh(FLAME, mat(0x4aa8ff, { e: 0x2a6aff, ei: 1.4, t: true, op: 0.85 })); fl.position.set(Math.cos(i / 12 * 6.28) * 0.12, 0, Math.sin(i / 12 * 6.28) * 0.12); ring.add(fl); } put(f, ring, 0, 0.43, 0); this._flames.push(ring); }
      }
      if (d.baskets) f.bk.forEach((x, i) => { const [bx, bz] = basketPos(f.t, i), up = x && x.dr && clk - (x.dt || 0) < 0.6; const o = put(f, basketMesh(!!x, x ? clk - x.t0 : 0), bx, ANCHOR.boilerY + (up ? 0.26 : x ? -0.02 : 0.03), bz + (up ? -0.06 : 0)); if (up) { o.rotation.x = -0.35; const drip = new THREE.Mesh(DRIP, mat(0x9fd8ff, { t: true, op: 0.55, e: 0x3a86c8, ei: 0.3 })); put(f, drip, bx, ANCHOR.boilerY + 0.07, bz - 0.06); } });
      if (d.griddle && f.gr) {
        const sec = clk - f.gr.t0;
        if (d.griddle === 'gyoza') put(f, grillFood('gyoza', sec), 0, ANCHOR.griddleY, 0.05);
        else put(f, grillFood('karaage', sec), 0, ANCHOR.fryerY + 0.02, 0.05);
      }
      if (d.rice && f.rc) put(f, riceSurface(0.13), 0, ANCHOR.riceY + 0.01, 0);
      if (d.board && f.job) { const T0 = TOPPINGS[f.job.tid]; if (T0) { const raw = ingredientMesh(T0.raw); raw.scale.setScalar(0.75 * (1 - Math.min(0.6, f.job.p * 0.6))); put(f, raw, -0.16, 0.94, 0); const p = pile(f.job.tid, Math.max(0.2, f.job.p)); p.scale.setScalar(1.2); put(f, p, 0.12, 0.945, 0); } }
      if (d.topping) {
        const pans = ANCHOR.pans(d.w), ids = Object.keys(TOPPINGS).filter((t) => (store.prep?.[t] || 0) > 0).slice(0, pans.length);
        ids.forEach((tid, i) => { const n = store.prep?.[tid] || 0; if (!n) return; put(f, panFill(tid, Math.min(1, n / TOPPINGS[tid].per)), pans[i][0], ANCHOR.panY, pans[i][1]); });
      }
      if (d.rack) {
        const kinds = ['bowl', 'bowlS', 'plate', 'mug'];
        kinds.forEach((k, ci) => { const n = Math.min(6, store.dish?.[k] || 0); if (!n) return; const list = Array(Math.min(3, n)).fill(k); ANCHOR.rack.ys.forEach((y, li) => { if (n > li * 2) put(f, dirtyClean(list.slice(0, k === 'mug' ? 1 : 3), k), ANCHOR.rack.xs[ci], y, 0); }); });
      }
      if (d.sink) {
        const list = []; for (const [k, n] of Object.entries(store.dirty || {})) for (let i = 0; i < Math.min(4, n); i++) list.push(k);
        if (f.wp && list.length) list.pop();
        if (list.length) put(f, dirtyMesh(list.slice(0, 8)), ANCHOR.sink[0] + 0.08, ANCHOR.sink[1], ANCHOR.sink[2] + 0.06);
        if (f.wp && f.wk) put(f, washingMesh(f.wk, f.wp), ANCHOR.sink[0] - 0.08, ANCHOR.sink[1] + 0.16, ANCHOR.sink[2] - 0.05);
        const dl = []; for (const [k, n] of Object.entries(store.dry || {})) for (let i = 0; i < n; i++) dl.push(k);
        if (dl.length) put(f, dryRackMesh(dl.slice(0, 12)), ANCHOR.dryRack[0], ANCHOR.dryRack[1], ANCHOR.dryRack[2]);
      }
      if (d.topping && f.tj) put(f, tareBowl(f.tj.k, f.tj.p), ANCHOR.tareMix[0], ANCHOR.tareMix[1], ANCHOR.tareMix[2]);
      if (d.topping) Object.keys(TARES).forEach((k, i) => { if ((store.tare?.[k] || 0) > 0) put(f, tarePot(k, Math.min(1, (store.tare[k] || 0) / TARES[k].per)), ANCHOR.tarePots[0] + i * 0.13, ANCHOR.tarePots[1], ANCHOR.tarePots[2]); });
      if (d.pass) f.ps.forEach((x, i) => { if (!x) return; const [px] = passPos(f.t, i); put(f, dishMesh(x), px, ANCHOR.passY, 0); });
      if (d.seats) d.seats.forEach((_, si) => {
        const [sx, sz] = d.spots[si];
        const dd = f.dd?.[si];
        if (dd?.length) put(f, dirtyMesh(dd), sx, d.top, sz);
        const sv = servedAt.get(f.id + ':' + si);
        if (sv) sv.forEach(([i, dish, frac], k) => { const off = k === 0 ? 0 : (k % 2 ? -1 : 1) * 0.17; const o = dishMesh(dish, frac); put(f, o, sx + off * (isCounterT(f.t) ? 0.6 : 1), d.top, sz + (k ? (Math.sign(sz) || -1) * 0.04 : 0)); });
      });
      if (f.t === 'chohan') { this._dice(f, dyn?.ch); Object.values(dyn?.ch?.b || {}).forEach((b, i) => { put(f, cashMesh(b[1]), (b[0] === 'cho' ? -0.55 : 0.55) + (i % 3 - 1) * 0.06, 0.32, 0.25 + Math.floor(i / 3) * 0.12, i * 0.4); }); }
    }
  }
  _dice(f, ch) {
    const ph = ch?.ph || 'bet';
    const cup = new THREE.Group();
    const cupM = mat(0x2b1a10, { r: 0.5 });
    const geo = new THREE.CylinderGeometry(0.11, 0.09, 0.16, 18, 1, true).translate(0, 0.08, 0);
    cup.add(new THREE.Mesh(geo, mat(0x2b1a10, { r: 0.5, side: THREE.DoubleSide })));
    cup.add(new THREE.Mesh(new THREE.CircleGeometry(0.11, 18).rotateX(-Math.PI / 2).translate(0, 0.16, 0), cupM));
    const lifted = ph === 'show';
    const p = this.put0(f, cup, 0.35, 0.32 + (lifted ? 0.25 : 0), -0.2);
    if (lifted) p.rotation.z = 0.7;
    p.userData.shake = ph === 'roll';
    this._cup = p;
    if (lifted && ch?.d) ch.d.forEach((v, i) => { const dm = diceMesh(v); this.put0(f, dm, 0.28 + i * 0.12, 0.345, -0.2); });
  }
  put0(f, obj, lx, y, lz) { const [wx, wz] = localToWorld(f, lx, lz); obj.position.set(wx, y, wz); obj.rotation.y = f.r * Math.PI / 2; this.propRoot.add(obj); return obj; }

  // ---------- 火事・湯気・手裏剣・ドローン ----------
  syncFx(store, dyn) {
    this._fireList = (dyn?.f || []).map(([fid, v]) => { const f = store.fixtures.find((o) => o.id === fid); return f ? [f.x, f.z, v] : null; }).filter(Boolean);
    this._steam = [];
    const clk = dyn?.clk || 0;
    for (const f of store.fixtures) {
      const d = FIXTURES[f.t]; if (f.br) continue;
      if (d.pot && f.pot?.fire) this._steam.push([f.x, (ANCHOR[f.t] || ANCHOR.pot).y + 0.45, f.z, 1]);
      if (d.baskets && f.bk.some(Boolean)) this._steam.push([f.x, ANCHOR.boilerY + 0.05, f.z, 0.8]);
      if (d.griddle && f.gr && clk - f.gr.t0 > GRIDDLE[d.griddle].burn) this._steam.push([f.x, 1.0, f.z, 1.6, 1]);
      if (d.rice && f.rc && clk - f.rc.t0 < RICE_READY) this._steam.push([f.x, 1.2, f.z, 0.5]);
    }
    // 手裏剣
    this._shuri ||= new Map();
    const alive = new Set();
    for (const [id, x, z, y] of dyn?.p || []) {
      alive.add(id);
      let o = this._shuri.get(id);
      if (!o) { o = toolMesh('shuri'); o.scale.setScalar(1.4); this.fxRoot.add(o); this._shuri.set(id, o); o.position.set(x, y, z); }
      o.userData.tx = x; o.userData.tz = z; o.position.y = y;
    }
    for (const [id, o] of this._shuri) if (!alive.has(id)) { this.fxRoot.remove(o); this._shuri.delete(id); }
    // ドローン
    const dl = dyn?.dl || [];
    if (!this.drone) { this.drone = droneModel(); this.fxRoot.add(this.drone); this.drone.visible = false; this._droneLeave = 0; }
    if (dl.length) {
      const t = Math.min(...dl), p = 1 - Math.max(0, t) / 8, k = p < 0.75 ? p / 0.75 : 1;
      const e = 1 - Math.pow(1 - k, 2);
      this.drone.visible = true;
      this.drone.position.set(lerp(DRONE_PAD[0] + 30, DRONE_PAD[0], e), lerp(24, 1.6 + (p > 0.75 ? Math.sin(this.t * 3) * 0.05 : 0), e), lerp(DRONE_PAD[1] - 30, DRONE_PAD[1], e));
      this._droneLeave = 1;
    } else if (this._droneLeave > 0 && this.drone.visible) {
      this._droneLeave -= 1 / 60 / 3;
      const e = 1 - this._droneLeave;
      this.drone.position.set(lerp(DRONE_PAD[0], DRONE_PAD[0] - 25, e * e), lerp(1.6, 26, e), lerp(DRONE_PAD[1], DRONE_PAD[1] - 20, e * e));
      if (this._droneLeave <= 0) this.drone.visible = false;
    }
  }
  _updateFx(dt) {
    // パーティクル（湯気・煙・炎）
    const pool = this._pool, parts = this._parts;
    const spawn = (x, y, z, kind) => {
      let sp = pool.pop();
      if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); sp.renderOrder = 6; }
      sp.material.map = kind === 'fire' ? fireTex() : kind === 'smoke' ? smokeTex() : steamTex();
      sp.material.blending = kind === 'fire' ? THREE.AdditiveBlending : THREE.NormalBlending; sp.material.toneMapped = kind !== 'fire';
      sp.material.needsUpdate = true;
      sp.position.set(x + (Math.random() - 0.5) * 0.25, y, z + (Math.random() - 0.5) * 0.25);
      sp.userData = { kind, life: 0, max: kind === 'fire' ? 0.5 + Math.random() * 0.4 : kind === 'smoke' ? 2.2 : 1.4, vy: kind === 'fire' ? 1.2 : kind === 'smoke' ? 0.8 : 0.45, s0: kind === 'fire' ? 0.35 : 0.25 };
      this.fxRoot.add(sp); parts.push(sp);
    };
    this._acc = (this._acc || 0) + dt;
    if (parts.length < (this.lite ? 120 : 260)) {
      for (const s of this._steam || []) if (Math.random() < dt * 6 * s[3]) spawn(s[0], s[1], s[2], s[4] ? 'smoke' : 'steam');
      for (const [x, z, v] of this._fireList || []) { const k = v / 10; for (let i = 0; i < 2; i++) if (Math.random() < dt * (8 + 30 * k)) spawn(x, 0.9 + Math.random() * 0.3, z, 'fire'); if (Math.random() < dt * (3 + 8 * k)) spawn(x, 1.6, z, 'smoke'); }
    }
    for (let i = parts.length - 1; i >= 0; i--) {
      const sp = parts[i], u = sp.userData;
      u.life += dt; sp.position.y += u.vy * dt;
      const k = u.life / u.max;
      sp.scale.setScalar(u.s0 * (u.kind === 'fire' ? 1 - k * 0.5 : 1 + k * 2.2));
      sp.material.opacity = u.kind === 'fire' ? 0.9 * (1 - k) : (u.kind === 'smoke' ? 0.55 : 0.35) * Math.sin(Math.min(1, k) * Math.PI);
      if (u.life >= u.max) { this.fxRoot.remove(sp); parts.splice(i, 1); pool.push(sp); }
    }
    // 火事の明かり
    if (!this.lite) {
      if (!this.fireLight) { this.fireLight = new THREE.PointLight(0xff7a2a, 0, 8, 2); this.scene.add(this.fireLight); }
      const f = (this._fireList || [])[0];
      this.fireLight.intensity = f ? 4 + f[2] * 1.4 + Math.sin(this.t * 23) * 1.5 : 0;
      if (f) this.fireLight.position.set(f[0], 1.6, f[1]);
    }
    for (const r of this._flames || []) r.children.forEach((fl, i) => { fl.scale.y = 0.8 + Math.sin(this.t * 20 + i) * 0.3; });
    for (const o of this._shuri?.values() || []) { o.position.x = lerp(o.position.x, o.userData.tx, Math.min(1, dt * 14)); o.position.z = lerp(o.position.z, o.userData.tz, Math.min(1, dt * 14)); o.rotation.set(Math.PI / 2, 0, this.t * 30); }
    if (this.drone?.visible) for (const p of this.drone.userData.props) p.rotation.y += dt * 40;
    if (this._cup?.userData.shake) { this._cup.position.y = 0.42 + Math.abs(Math.sin(this.t * 14)) * 0.12; this._cup.rotation.z = Math.sin(this.t * 22) * 0.4; }
  }
  // 消火器のしぶき
  sprayFx(x, y, z, tx, tz, n = 10) {
    const dx = tx - x, dz = tz - z, d = Math.hypot(dx, dz) || 1, nx = dx / d, nz = dz / d;
    for (let i = 0; i < n; i++) {
      let sp = this._pool.pop();
      if (!sp) { sp = new THREE.Sprite(new THREE.SpriteMaterial({ transparent: true, depthWrite: false })); sp.renderOrder = 7; }
      sp.material.map = steamTex(); sp.material.blending = THREE.NormalBlending; sp.material.needsUpdate = true;
      sp.position.set(x + nx * 0.4, y + (Math.random() - 0.5) * 0.1, z + nz * 0.4);
      const v = 2 + Math.random() * 2.2;
      sp.userData = { kind: 'spray', life: 0, max: 0.6 + Math.random() * 0.4, vy: (Math.random() - 0.5) * 0.4, s0: 0.12, vx: nx * v + (Math.random() - 0.5) * 0.8, vz: nz * v + (Math.random() - 0.5) * 0.8 };
      this.fxRoot.add(sp); this._parts.push(sp);
    }
  }
  _updateSpray(dt) { for (const sp of this._parts) if (sp.userData.kind === 'spray') { sp.position.x += sp.userData.vx * dt; sp.position.z += sp.userData.vz * dt; sp.userData.vx *= Math.pow(0.15, dt); sp.userData.vz *= Math.pow(0.15, dt); } }
  // ---------- 大きい段ボール（買った設備） ----------
  _crateModel(ft) {
    const def = FIXTURES[ft] || {}, big = (def.w || 1) >= 1;
    const [w, h, d] = big ? [1.2, 0.9, 0.8] : [0.75, 0.6, 0.6];
    const g = new THREE.Group();
    g.add(new THREE.Mesh(rbox(w, h, d, 0.02), smat(surf('cardboard'), 0xc99a62, { r: 0.9 })));
    g.add(new THREE.Mesh(box(0.16, 0.004, d + 0.01).translate(0, h, 0), mat(0xc9a46c, { r: 0.35 })));
    const label = (this._crateTex ||= {})[ft] ||= canvasTex(256, 128, (c, W, H) => {
      c.fillStyle = '#fffdf6'; rr(c, 4, 4, W - 8, H - 8, 14); c.fill();
      c.font = `70px "Apple Color Emoji","Segoe UI Emoji",sans-serif`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText(def.icon || '📦', 52, H / 2);
      c.fillStyle = '#3a2a1a'; c.textAlign = 'left'; c.font = `900 ${def.name && def.name.length > 6 ? 22 : 30}px ${FONT}`; c.fillText(def.name || '設備', 100, H / 2, W - 108);
    });
    const lm = new THREE.MeshStandardMaterial({ map: label, roughness: 0.8 }), lw = Math.min(w * 0.7, 0.62);
    for (const s of [-1, 1]) { const p = new THREE.Mesh(new THREE.PlaneGeometry(lw, lw / 2), lm); p.position.set(0, h * 0.45, s * (d / 2 + 0.007)); if (s < 0) p.rotation.y = Math.PI; g.add(p); }
    g.traverse((o) => { if (o.isMesh) { o.castShadow = !this.lite; o.receiveShadow = true; } });
    g.userData.size = [w, h, d];
    return g;
  }
  syncCrates(store, holders, fp) {
    if (!this.crateRoot) { this.crateRoot = new THREE.Group(); this.scene.add(this.crateRoot); this.crateViews = new Map(); this._fallC = new Map(); this._crateT0 = performance.now() / 1000; }
    const now = performance.now() / 1000, ready = now - this._crateT0 > 1.5, alive = new Set();
    for (const c of store.crates || []) {
      alive.add(c.id);
      let v = this.crateViews.get(c.id);
      if (!v || v.ft !== c.ft) {
        if (v) this.crateRoot.remove(v.g);
        const g = this._crateModel(c.ft); g.traverse((o) => { if (o.isMesh) o.userData.crate = c.id; });
        v = { g, ft: c.ft }; this.crateViews.set(c.id, v); this.crateRoot.add(g);
        if (ready && c.drop && c.loc.t === 'f') this._fallC.set(c.id, now);
      }
      const L = c.loc, [, h, d] = v.g.userData.size;
      v.floor = L.t === 'f';
      if (L.t === 'f') {
        let y = L.y || 0, spin = 0; const f0 = this._fallC.get(c.id);
        if (f0 != null) { const t = now - f0, H = 14, Tt = Math.sqrt(2 * H / 19); if (t < Tt) { y += H - 0.5 * 19 * t * t; spin = (Tt - t) * 1.2; } else this._fallC.delete(c.id); }
        v.g.position.set(L.x, y, L.z); v.g.rotation.set(0, (L.ry || 0) + spin, 0); v.g.visible = true;
      } else if (L.t === 'h' && fp && L.who === fp.who) {
        this.camera.updateMatrixWorld();
        _v.set(0, -0.27 + (fp.bob || 0) - h, -0.5 - d / 2).applyMatrix4(this.camera.matrixWorld);
        v.g.position.copy(_v); v.g.quaternion.copy(this.camera.quaternion); v.g.visible = true;
      } else if (L.t === 'h') {
        const ch = holders(L.who); if (!ch) { v.g.visible = false; continue; }
        const o = ch.root, yaw = o.rotation.y; _e.set(0, yaw, 0);
        v.g.position.copy(o.position).add(new THREE.Vector3(0, 0.55 * ch.av.height, 0.3 + d / 2).applyEuler(_e)); v.g.rotation.set(0, yaw, 0); v.g.visible = true;
      }
    }
    for (const [id, v] of this.crateViews) if (!alive.has(id)) { this.crateRoot.remove(v.g); this.crateViews.delete(id); this._fallC.delete(id); }
  }
  // ---------- キャラクター ----------
  syncChars(list, dt) {
    const seen = new Set();
    for (const e of list) {
      seen.add(e.key);
      let v = this.chars.get(e.key);
      if (!v) {
        const ch = new Character(e.av, { lite: this.lite, small: e.small, uniform: e.uniform });
        if (e.name) ch.setName(e.name, e.nameColor);
        ch.root.position.set(e.x, e.y || 0, e.z); ch.root.rotation.y = e.ry || 0;
        this.charRoot.add(ch.root);
        v = { ch, x: e.x, z: e.z }; this.chars.set(e.key, v);
      }
      const ch = v.ch, o = ch.root;
      const sitting = e.an === 'sit' || e.an === 'eat';
      if (e.local || (sitting && Math.hypot(o.position.x - e.x, o.position.z - e.z) > 0.6)) { o.position.set(e.x, e.y || 0, e.z); o.rotation.y = e.ry || 0; }
      else { const k = Math.min(1, dt * 10); o.position.x = lerp(o.position.x, e.x, k); o.position.z = lerp(o.position.z, e.z, k); o.position.y = lerp(o.position.y, e.y || 0, k); o.rotation.y = angleLerp(o.rotation.y, e.ry || 0, Math.min(1, dt * 10)); }
      const sp = Math.hypot(o.position.x - v.x, o.position.z - v.z) / Math.max(dt, 1e-3);
      v.x = o.position.x; v.z = o.position.z; ch.speed = sp;
      ch.anim = e.an && e.an !== 'walk' && e.an !== 'idle' ? e.an : sp > 0.25 ? 'walk' : 'idle';
      if (e.an === 'walk' && !e.local) ch.anim = sp > 0.05 ? 'walk' : 'idle';
      ch.carry = !!e.carry;
      if (e.bubble !== undefined) ch.setBubble(e.bubble || null, e.bubbleText);
      ch.root.visible = e.visible !== false;
      ch.update(dt);
    }
    for (const [k, v] of this.chars) if (!seen.has(k)) { v.ch.dispose(); this.chars.delete(k); }
  }
  getChar(key) { return this.chars.get(key)?.ch; }
  // 一人称の腕（持っている物に両手を添える）
  _fpRig(av, size) {
    if (!this.fpHands) { if (!this.camera.parent) this.scene.add(this.camera); this.fpHands = new THREE.Group(); this.camera.add(this.fpHands); }
    const key = [av.skin, av.top, av.topColor, size.join(',')].join('|');
    if (this._fpKey !== key) {
      this._fpKey = key; this.fpHands.clear();
      const skin = mat(av.skin, { r: 0.55 }), sleeve = mat(av.top === 'suit' ? '#2b2d42' : av.top === 'apron' ? '#ffffff' : av.topColor, { r: 0.8 }), [w] = size;
      for (const s of [-1, 1]) {
        const hand = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.07, 4, 10), skin); hand.rotation.x = Math.PI / 2; hand.position.set(s * (w / 2 + 0.012), -0.02, 0.02); hand.scale.set(0.7, 1, 1.15);
        const arm = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.06, 0.55, 12).translate(0, -0.275, 0), sleeve); arm.position.set(s * (w / 2 + 0.02), -0.02, 0.07); arm.rotation.set(-1.25, 0, s * 0.32);
        for (const m of [hand, arm]) { m.renderOrder = 2; this.fpHands.add(m); }
      }
    }
    this.fpHands.visible = true;
  }
  // 手に持っている物（料理・下げた食器・消火器・手裏剣）
  syncHands(list, fp) {
    const alive = new Set();
    const itemKey = (hd) => (!hd ? '' : hd.t === 'dish' ? 'd' + dishKey(hd.d) : hd.t === 'dirty' ? 'x' + hd.a.join('.') : hd.t === 'clean' ? 'c' + hd.a.join('.') : hd.t);
    const make = (hd) => (hd.t === 'dish' ? dishMesh(hd.d) : hd.t === 'dirty' ? dirtyMesh(hd.a) : hd.t === 'clean' ? cleanMesh(hd.a) : toolMesh(hd.t));
    const get = (key, hd) => {
      const k = key + '|' + itemKey(hd); alive.add(k);
      let o = this.hands.get(k);
      if (!o) { for (const [kk, oo] of this.hands) if (kk.startsWith(key + '|')) { this.handRoot.remove(oo); this.hands.delete(kk); } o = make(hd); o.traverse((m) => { if (m.isMesh) { m.castShadow = false; m.renderOrder = 3; } }); this.handRoot.add(o); this.hands.set(k, o); }
      return o;
    };
    let fpOn = false;
    if (fp?.hand) {
      const hd = fp.hand, o = get('fp', hd), bob = fp.bob || 0;
      this.camera.updateMatrixWorld();
      let off = [0, -0.3 + bob, -0.45], rot = [0.25, 0, 0], w = 0.24;
      if (hd.t === 'ext') { off = [0.2, -0.32 + bob, -0.42]; rot = [0.9, 0.2, 0]; w = 0.1; }
      if (hd.t === 'shuri') { off = [0.2, -0.24 + bob, -0.4]; rot = [0.3, 0, 0.3]; w = 0.08; }
      if (hd.t === 'dish' && hd.d.k === 'mug') { off = [0.12, -0.32 + bob, -0.42]; w = 0.1; }
      _m.compose(_v.set(...off), _q.setFromEuler(_e.set(...rot)), _s.set(1, 1, 1));
      o.matrixAutoUpdate = false; o.matrix.multiplyMatrices(this.camera.matrixWorld, _m); o.matrixWorldNeedsUpdate = true;
      this._fpRig(fp.av, [w, 0.1, 0.02]);
      this.fpHands.position.set(off[0], off[1] + 0.02, off[2] + 0.02); this.fpHands.rotation.set(0.12, 0, 0);
      fpOn = true;
    }
    if (!fpOn && this.fpHands) this.fpHands.visible = false;
    for (const e of list) {
      if (!e.hand || e.visible === false) continue;
      const ch = this.getChar(e.key); if (!ch || !ch.root.visible) continue;
      const o = get(e.key, e.hand);
      ch.root.updateMatrixWorld(true);
      const hd = e.hand, H = ch.av.height;
      if (hd.t === 'ext' || hd.t === 'shuri') { _m.compose(_v.set(0, -0.36, 0.08), _q.identity(), _s.set(1, 1, 1)); o.matrixAutoUpdate = false; o.matrix.multiplyMatrices(ch.armR.matrixWorld, _m); }
      else { _m.compose(_v.set(0, 1.02 * H, 0.34), _q.identity(), _s.set(1, 1, 1)); o.matrixAutoUpdate = false; o.matrix.multiplyMatrices(ch.root.matrixWorld, _m); }
      o.matrixWorldNeedsUpdate = true;
      ch.carry = hd.t === 'dish' || hd.t === 'dirty' || hd.t === 'clean';
    }
    for (const [k, o] of this.hands) if (!alive.has(k)) { this.handRoot.remove(o); this.hands.delete(k); }
  }
  // ---------- ハイライト・ゴースト ----------
  setHighlight(fid, slotBox) {
    const k = fid == null ? '' : fid + '|' + (slotBox ? slotBox.join(',') : '');
    if (k === this._hlKey) return; this._hlKey = k;
    if (this.highlight) { this.scene.remove(this.highlight); this.highlight.geometry.dispose(); this.highlight = null; }
    if (fid == null) return;
    const v = this.fixViews.get(fid); if (!v) return;
    let geo;
    if (slotBox) { const [x, y, z, w, h, d] = slotBox; geo = new THREE.BoxGeometry(w, h, d); geo.translate(x, y + h / 2, z); }
    else { const bb = new THREE.Box3().setFromObject(v.group), sz = bb.getSize(new THREE.Vector3()), c = bb.getCenter(new THREE.Vector3()); geo = new THREE.BoxGeometry(sz.x + 0.04, sz.y + 0.04, sz.z + 0.04); geo.translate(c.x - v.group.position.x, c.y, c.z - v.group.position.z); }
    const line = new THREE.LineSegments(new THREE.EdgesGeometry(geo), new THREE.LineBasicMaterial({ color: 0xffe14d, transparent: true, opacity: 0.95, depthTest: false }));
    line.renderOrder = 10; line.position.copy(v.group.position);
    if (slotBox) line.rotation.copy(v.group.rotation);
    this.scene.add(line); this.highlight = line;
  }
  thumbUrl(type, color) { return this._thumbs?.get(type + '|' + color) ?? null; }
  requestThumbs(types, color, done) {
    this._thumbs ||= new Map(); this._thumbQ ||= [];
    let added = false;
    for (const t of types) { const k = t + '|' + color; if (this._thumbs.has(k) || this._thumbQ.some((q) => q.k === k)) continue; this._thumbQ.push({ t, color, k }); added = true; }
    if (added || this._thumbQ.length) this._thumbDone = done;
  }
  _thumbTick() { const q = this._thumbQ; if (!q || !q.length) return; const it = q.shift(); this._thumbs.set(it.k, this._makeThumb(it.t, it.color)); if (!q.length) { const d = this._thumbDone; this._thumbDone = null; try { d?.(); } catch (e) { /* noop */ } } }
  // 3Dモデルを撮影して画像にする（パソコン・建築の一覧などの絵）。bg=null なら背景は透明
  _shoot(obj, { view = [0.62, 0.5, 1], bg = 0xf3ece2, fit = 1, fov = 28 } = {}) {
    const R = this.r, S = 128, SS = 256, prevRT = R.getRenderTarget(), prevC = new THREE.Color(), prevA = R.getClearAlpha(); R.getClearColor(prevC);
    let out = null;
    try {
      const scene = this._thumbScene ||= (() => { const s = new THREE.Scene(); s.add(new THREE.HemisphereLight(0xffffff, 0xb8b0a2, 1.4)); const d = new THREE.DirectionalLight(0xffffff, 1.8); d.position.set(3, 5, 4); s.add(d); const f = new THREE.DirectionalLight(0xfff4e6, 0.6); f.position.set(-3, 2, 5); s.add(f); return s; })();
      scene.environment = this.scene.environment || null; scene.background = bg == null ? null : new THREE.Color(bg);
      this._thumbRT ||= new THREE.WebGLRenderTarget(SS, SS);
      scene.add(obj); obj.updateMatrixWorld(true);
      const bb = new THREE.Box3().setFromObject(obj), size = bb.getSize(new THREE.Vector3()), ctr = bb.getCenter(new THREE.Vector3());
      const cam = new THREE.PerspectiveCamera(fov, 1, 0.02, 80), rad = Math.max(0.05, size.length() / 2) * fit, far = rad / Math.sin(THREE.MathUtils.degToRad(fov / 2));
      cam.position.copy(ctr).addScaledVector(new THREE.Vector3(...view).normalize(), far); cam.lookAt(ctr);
      if (bg == null) R.setClearColor(0x000000, 0);
      R.setRenderTarget(this._thumbRT); R.render(scene, cam);
      const buf = new Uint8Array(SS * SS * 4); R.readRenderTargetPixels(this._thumbRT, 0, 0, SS, SS, buf);
      const lut = this._thumbLut ||= (() => { const l = new Uint8ClampedArray(256); for (let i = 0; i < 256; i++) { const x = i / 255 * 1.1; const t = (x * (2.51 * x + 0.03)) / (x * (2.43 * x + 0.59) + 0.14); l[i] = 255 * (t <= 0.0031308 ? 12.92 * t : 1.055 * Math.pow(t, 1 / 2.4) - 0.055); } return l; })();
      const c = document.createElement('canvas'); c.width = c.height = SS; const ctx = c.getContext('2d'), img = ctx.createImageData(SS, SS);
      for (let y = 0; y < SS; y++) for (let x = 0; x < SS; x++) {
        const si = ((SS - 1 - y) * SS + x) * 4, di = (y * SS + x) * 4, a = bg == null ? buf[si + 3] : 255, k = a > 0 && a < 255 ? 255 / a : 1;
        img.data[di] = lut[Math.min(255, buf[si] * k)]; img.data[di + 1] = lut[Math.min(255, buf[si + 1] * k)]; img.data[di + 2] = lut[Math.min(255, buf[si + 2] * k)]; img.data[di + 3] = a;
      }
      ctx.putImageData(img, 0, 0);
      const cv = document.createElement('canvas'); cv.width = cv.height = S; const c2 = cv.getContext('2d'); c2.imageSmoothingQuality = 'high'; c2.drawImage(c, 0, 0, S, S);
      const url = cv.toDataURL('image/png');
      if (typeof url === 'string' && url.startsWith('data:image')) out = { url, canvas: cv };
    } catch (e) { out = null; } finally {
      try { R.setRenderTarget(prevRT ?? null); R.setClearColor(prevC, prevA); } catch (e) { /* noop */ }
      try { this._thumbScene?.remove(obj); } catch (e) { /* noop */ }
    }
    return out;
  }
  _makeThumb(type, color) {
    let g = null;
    try { g = bakeGroup(buildFixture({ t: type, x: 0, z: 0, r: 0, tx: FIXTURES[type].text ? 'ラーメン' : undefined, c: '#ffffff' }, { color, phase: 'open', menu: this.store?.menu || [] })); } catch (e) { return null; }
    const r = this._shoot(g); try { g.traverse((o) => o.geometry?.dispose?.()); } catch (e) { /* noop */ }
    return r?.url || null;
  }
  // 商品の絵（thumbs.js の key から）
  _shootProduct(key, spec) {
    const [kind, a, b] = key.split(':');
    let obj = null, view = [0, 0.8, 0.66], fit = 0.92;
    switch (kind) {
      case 'ing': obj = ingredientMesh(a); view = [0.5, 0.78, 1]; fit = 0.9; break;
      case 'tp': obj = toppingDish(a); view = [0, 0.9, 0.62]; fit = 0.86; break;
      case 'soup': obj = dishMesh({ k: 'bowl', soup: a, tp: [] }); view = [0, 1, 0.5]; break;
      case 'menu': obj = dishMesh({ k: 'bowl', soup: a, men: 24, tp: b ? b.split('.') : [] }); break;
      case 'side': obj = dishMesh(SIDE_DISH[a] || SIDE_DISH.rice); if (a === 'beer') { view = [0.45, 0.35, 1]; fit = 0.95; } break;
      case 'dish': obj = dishMesh({ k: a, tp: [] }); view = [0, 0.7, 0.8]; break;
      case 'd': obj = spec?.d ? (spec.d.k === 'dirty' ? dirtyMesh(spec.d.a) : dishMesh(spec.d)) : null; if (spec?.d?.k === 'mug') view = [0.45, 0.35, 1]; break;
      case 'tool': obj = toolMesh(a); view = [0.7, 0.4, 1]; break;
      case 'men': obj = noodleBall(); break;
      case 'fx': { const r = this._makeThumb(a, b || '#c0392b'); return r ? { url: r } : null; }
      default: return null;
    }
    if (!obj) return null;
    return this._shoot(obj, { view, bg: null, fit });
  }
  setGhost(type, x, z, r, ok, store) {
    const k = type || '';
    if (k !== this._ghostKey) {
      this._ghostKey = k;
      if (this.ghost) { this.scene.remove(this.ghost); this.ghost = null; }
      if (type) {
        const g = bakeGroup(buildFixture({ t: type, x: 0, z: 0, r: 0, tx: 'NEW', c: '#ffffff' }, { color: store?.color || '#c0392b', menu: store?.menu || [] }));
        this.ghostMats = [new THREE.MeshBasicMaterial({ color: 0x4cff8a, transparent: true, opacity: 0.45, depthWrite: false }), new THREE.MeshBasicMaterial({ color: 0xff4c4c, transparent: true, opacity: 0.45, depthWrite: false })];
        g.traverse((o) => { if (o.isMesh) { o.material = this.ghostMats[0]; o.castShadow = false; o.userData.noRay = true; } });
        const def = FIXTURES[type], pad = new THREE.Mesh(new THREE.PlaneGeometry(def.w, def.d), this.ghostMats[0]); pad.rotation.x = -Math.PI / 2; pad.position.y = 0.02; g.add(pad);
        this.ghost = g; this.scene.add(g);
      }
    }
    if (this.ghost) { this.ghost.position.set(x, 0, z); this.ghost.rotation.y = r * Math.PI / 2; const m = this.ghostMats[ok ? 0 : 1]; this.ghost.traverse((o) => { if (o.isMesh) o.material = m; }); }
  }
  setFixtureHidden(fid) { for (const [id, v] of this.fixViews) v.group.visible = id !== fid; }
  pick(raycaster, { crates = true } = {}) {
    const objs = [];
    if (crates && this.crateViews) for (const v of this.crateViews.values()) if (v.floor) v.g.traverse((o) => { if (o.isMesh) objs.push(o); });
    this.fixRoot.traverse((o) => { if (o.isMesh && !o.userData.noRay) objs.push(o); });
    for (const h of raycaster.intersectObjects(objs, false)) {
      const o = h.object;
      if (o.userData.crate != null) return { type: 'crate', cid: o.userData.crate, point: h.point, dist: h.distance };
      if (o.userData.fid != null) return { type: 'fixture', fid: o.userData.fid, point: h.point, dist: h.distance };
    }
    return null;
  }
  syncBlobs(store, extra) {
    if (!this.blobs) {
      const flat = new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2);
      const mk = (map) => new THREE.MeshBasicMaterial({ map, transparent: true, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2, toneMapped: false });
      this.blobs = new Instancer(this.propRoot.parent, (k) => [{ g: flat, m: mk(tex(k === 'c' ? 'blob' : 'blobRect')) }]);
    }
    this.blobs.begin();
    const put = (k, x, z, sx, sz, ry = 0) => { _m.compose(_v.set(x, 0.012, z), _q.setFromAxisAngle(UP, ry), _s.set(sx, 1, sz)); this.blobs.push(k, _m); _s.set(1, 1, 1); };
    for (const f of store.fixtures) { const d = FIXTURES[f.t]; if (!d || d.air || ['nobori', 'kumade', 'kamidana', 'menuboard', 'neon', 'signstand'].includes(f.t)) continue; put('r', f.x, f.z, d.w * 1.3 + 0.25, d.d * 1.3 + 0.25, f.r * Math.PI / 2); }
    for (const [x, z] of extra) put('c', x, z, 0.85, 0.85);
    this.blobs.end();
  }
  // 投げた食器が飛んでいく
  flyFx(e) {
    const o = dirtyMesh(e.a || ['bowl']); o.position.set(e.x0, 1.3, e.z0); this.scene.add(o);
    this._fly = this._fly || []; this._fly.push({ o, t: 0, e });
  }
  // 「次にやること」の矢印（設備の上でゆれる）
  setGuide(pos, urgent) {
    if (!this.guide) {
      const g = new THREE.Group(), m = new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.95, depthTest: false, toneMapped: false });
      const head = new THREE.Mesh(new THREE.ConeGeometry(0.13, 0.24, 18).rotateX(Math.PI).translate(0, 0.12, 0), m), shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.2, 12).translate(0, 0.34, 0), m);
      const ring = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.018, 6, 28).rotateX(Math.PI / 2), m);
      for (const o of [head, shaft, ring]) { o.renderOrder = 30; g.add(o); }
      this.guide = g; this.guideMat = m; this.guideRing = ring; this.scene.add(g);
    }
    this.guide.visible = !!pos;
    if (!pos) return;
    this._gy = pos.y; this.guide.position.x = pos.x; this.guide.position.z = pos.z;
    this.guideMat.color.set(urgent ? 0xff4d4d : 0xffd23f);
  }
  update(dt) {
    this.t += dt; this._updateFx(dt); this._updateSpray(dt);
    if (this._fly?.length) for (const F of [...this._fly]) { F.t += dt / 0.55; const k = Math.min(1, F.t), e = F.e; F.o.position.set(e.x0 + (e.x1 - e.x0) * k, 1.3 + (e.y1 - 1.3) * k + Math.sin(k * Math.PI) * 0.9, e.z0 + (e.z1 - e.z0) * k); F.o.rotation.x += dt * 9; if (k >= 1) { this.scene.remove(F.o); this._fly.splice(this._fly.indexOf(F), 1); } }
    if (this.guide?.visible) { const k = Math.sin(this.t * 4.2); this.guide.position.y = this._gy + k * 0.07; this.guide.rotation.y += dt * 2.2; const s = 1 + 0.25 * (0.5 + 0.5 * Math.sin(this.t * 4.2 + 1.5)); this.guideRing.scale.set(s, s, s); }
  }
  render() {
    this._fit();
    try { this._thumbTick(); thumbTick(this._thumbQ?.length ? 3 : 6); } catch (e) { /* noop */ }
    if (this.signHint?.visible) this.signHint.position.y = 2.0 + Math.sin(performance.now() / 260) * 0.06;
    if (this.composer) { try { this.composer.render(); return; } catch (e) { console.warn('post error', e); this.composer = null; } }
    this.r.render(this.scene, this.camera);
  }
}
const isCounterT = (t) => t === 'counter' || t === 'counter2';
// 食器棚のきれいな器
function dirtyClean(list, k) { const g = new THREE.Group(); list.forEach((_, i) => { const o = dishMesh({ k, tp: [] }); o.position.y = i * (k === 'plate' ? 0.02 : k === 'bowl' ? 0.05 : 0.04); g.add(o); }); return g; }
// サイコロ（上の面が v）
const diceMats = [];
function diceMesh(v) {
  if (!diceMats.length) for (let n = 1; n <= 6; n++) diceMats[n] = new THREE.MeshStandardMaterial({ roughness: 0.4, map: canvasTex(64, 64, (c, w, h) => { c.fillStyle = '#fbfaf5'; c.fillRect(0, 0, w, h); c.fillStyle = n === 1 ? '#c62828' : '#1c1d20'; const P = { 1: [[2, 2]], 2: [[1, 1], [3, 3]], 3: [[1, 1], [2, 2], [3, 3]], 4: [[1, 1], [3, 1], [1, 3], [3, 3]], 5: [[1, 1], [3, 1], [2, 2], [1, 3], [3, 3]], 6: [[1, 1], [3, 1], [1, 2], [3, 2], [1, 3], [3, 3]] }[n]; for (const [x, y] of P) { c.beginPath(); c.arc(x * 16, y * 16, n === 1 ? 10 : 6, 0, 7); c.fill(); } }) });
  const m = new THREE.Mesh(new THREE.BoxGeometry(0.05, 0.05, 0.05), [diceMats[3], diceMats[4], diceMats[1], diceMats[6], diceMats[2], diceMats[5]]);
  const R = { 1: [0, 0], 6: [Math.PI, 0], 2: [-Math.PI / 2, 0], 5: [Math.PI / 2, 0], 3: [0, Math.PI / 2], 4: [0, -Math.PI / 2] }[v] || [0, 0];
  m.rotation.set(R[0], 0, R[1]);
  const g = new THREE.Group(); g.add(m); return g;
}
function droneModel() {
  const g = new THREE.Group(), body = mat(0xf2f2f2, { r: 0.35 }), dark = mat(0x2b2f33, { r: 0.4 });
  g.add(new THREE.Mesh(rbox(0.5, 0.15, 0.5, 0.05), body));
  g.add(new THREE.Mesh(box(0.5, 0.32, 0.36).translate(0, -0.36, 0), mat(0xc99a62, { r: 0.9 })));
  g.userData.props = [];
  for (const [x, z] of [[-0.4, -0.4], [0.4, -0.4], [-0.4, 0.4], [0.4, 0.4]]) {
    g.add(new THREE.Mesh(box(0.5, 0.03, 0.04).rotateY(Math.atan2(z, x)).translate(x / 2, 0.08, z / 2), dark));
    const p = new THREE.Mesh(box(0.4, 0.01, 0.05), dark); p.position.set(x, 0.14, z); g.add(p); g.userData.props.push(p);
  }
  g.add(new THREE.Mesh(new THREE.SphereGeometry(0.04, 8, 6).translate(0, 0, 0.26), mat(0x3bff8a, { e: 0x1a8a3a })));
  return g;
}
let _sht = null;
function signHintTex() {
  return _sht ||= canvasTex(360, 120, (c, w, h) => {
    c.fillStyle = '#ffffff'; c.strokeStyle = '#b71c1c'; c.lineWidth = 6; rr(c, 6, 6, w - 12, h - 36, 26); c.fill(); c.stroke();
    c.beginPath(); c.moveTo(w / 2 - 14, h - 32); c.lineTo(w / 2, h - 8); c.lineTo(w / 2 + 14, h - 32); c.fillStyle = '#b71c1c'; c.fill();
    c.fillStyle = '#b71c1c'; c.textAlign = 'center'; c.textBaseline = 'middle'; c.font = `900 34px ${FONT}`; c.fillText('「営業中」にしよう！', w / 2, (h - 30) / 2 + 3);
  });
}
let _st = null, _ft = null, _smt = null;
function steamTex() { return _st ||= canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,255,255,0.9)'); g.addColorStop(0.5, 'rgba(240,245,250,0.45)'); g.addColorStop(1, 'rgba(240,245,250,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
function fireTex() { return _ft ||= canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h * 0.6, 1, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(255,250,200,1)'); g.addColorStop(0.35, 'rgba(255,170,40,0.9)'); g.addColorStop(0.7, 'rgba(230,60,10,0.5)'); g.addColorStop(1, 'rgba(200,30,0,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
function smokeTex() { return _smt ||= canvasTex(64, 64, (c, w, h) => { const g = c.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2); g.addColorStop(0, 'rgba(70,70,70,0.8)'); g.addColorStop(0.6, 'rgba(60,60,60,0.35)'); g.addColorStop(1, 'rgba(60,60,60,0)'); c.fillStyle = g; c.fillRect(0, 0, w, h); }); }
export function avatarPreview(renderer) {
  const scene = new THREE.Scene(); scene.background = null;
  scene.add(new THREE.HemisphereLight(0xffffff, 0xc8b8a8, 1.6));
  const d = new THREE.DirectionalLight(0xffffff, 2.2); d.position.set(2, 4, 3); scene.add(d);
  if (renderer.envTex) scene.environment = renderer.envTex;
  const stage = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.95, 0.12, 40), mat(0xffffff, { r: 0.4 })); stage.position.y = -0.06; scene.add(stage);
  const ring = new THREE.Mesh(new THREE.TorusGeometry(0.92, 0.03, 8, 40), mat(0xc0392b, { r: 0.4 })); ring.rotation.x = Math.PI / 2; scene.add(ring);
  return { scene, cam: new THREE.PerspectiveCamera(32, 1, 0.1, 50) };
}
export { Character, randomAvatar, CEIL };
