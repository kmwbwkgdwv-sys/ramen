// ===== ラーメン屋の建物・となりの賭場・まわりの街並み =====
import * as THREE from 'three';
import { tex, surf, signTexture, canvasTex, FONT, shade } from '../textures.js';
import { mat, smat, glassMat, T, box, rbox, cyl, sph, plane, cone, torus, add, M, bakeGroup, merge, vgrad, wuv } from './geo.js';
import { basic, vtext, tatamiTex } from './fixtures.js';
import { SHOP, SHOP_X1, COL_W, BACK_Z, FRONT_Z, KITCHEN_Z, DOOR, BUILDING, HALL, ALL_COLS, CRATE_AREA, DRONE_PAD, colRect, getWalls } from '../data.js';
import { mulberry32 } from '../util.js';

const C = (c, o = {}) => mat(c, { r: 0.7, ...o });
export const WALL_H = 3.9, CEIL = 3.2;
const L = BUILDING.minX, R = BUILDING.maxX, CX = (L + R) / 2, CZ = (BACK_Z + FRONT_Z) / 2;
const HX = (HALL.x0 + HALL.x1) / 2, HZ = (HALL.z0 + HALL.z1) / 2, HALL_H = 3.4;
function uvScale(g, su, sv = 1) { const uv = g.attributes.uv; for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv); uv.needsUpdate = true; return g; }
// 漆喰の壁＋木の腰板
function innerWall(g, w, h, d, cx, cz, y = 0) {
  const plaster = smat(surf('wall'), 0xfbf3e2, { r: 0.9 }), wood = smat(surf('wood'), 0x8a5a36, { r: 0.6 });
  add(g, wuv(T(box(w, h, d), cx, y, cz), 2.4), plaster);
  if (y) return;
  const lx = d < w ? 0.014 : 0.024, lz = w < d ? 0.014 : 0.024;
  add(g, wuv(T(box(w + lx, 1.0, d + lz), cx, 0, cz), 1.2), wood);
  add(g, T(box(w + lx * 1.5, 0.05, d + lz * 1.5), cx, 1.0, cz), C(0x4a2e1a, { r: 0.5 }));
}
export class World {
  constructor(scene, { lite }) {
    this.scene = scene; this.lite = lite;
    this.root = new THREE.Group(); scene.add(this.root);
    this.obstacles = [];
    this.dynamic = new THREE.Group(); this.root.add(this.dynamic);
    this.doors = [];
    for (const fn of ['_sky', '_ground', '_town', '_building', '_hall']) { try { this[fn](); } catch (e) { console.warn('world ' + fn, e); } }
    this.doorOpen = 0; this.hallOpen = 0;
    this.lampMat ||= new THREE.MeshBasicMaterial({ color: 0x777777 }); this.panelMat ||= new THREE.MeshBasicMaterial({ color: 0xffffff });
    this.skyMat ||= { uniforms: { top: { value: new THREE.Color() }, mid: { value: new THREE.Color() }, bot: { value: new THREE.Color() } } };
  }
  _sky() {
    const g = new THREE.SphereGeometry(180, 32, 16);
    this.skyMat = new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false,
      uniforms: { top: { value: new THREE.Color('#4f9ee8') }, mid: { value: new THREE.Color('#c4e4f7') }, bot: { value: new THREE.Color('#e9e6dc') }, sunDir: { value: new THREE.Vector3(0.3, 0.8, 0.4).normalize() } },
      vertexShader: 'varying vec3 vp; void main(){ vp = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
      fragmentShader: 'uniform vec3 top; uniform vec3 mid; uniform vec3 bot; uniform vec3 sunDir; varying vec3 vp; void main(){ float h = vp.y; vec3 c = h > 0.0 ? mix(mid, top, pow(h, 0.55)) : mix(mid, bot, min(1.0, -h * 4.0)); float s = max(dot(normalize(vp), normalize(sunDir)), 0.0); c += vec3(1.0, 0.9, 0.7) * (pow(s, 600.0) * 2.0 + pow(s, 12.0) * 0.12); gl_FragColor = vec4(c, 1.0); #include <colorspace_fragment> }',
    });
    this.sky = new THREE.Mesh(g, this.skyMat); this.sky.renderOrder = -10; this.scene.add(this.sky);
    const cm = C(0xffffff, { r: 1 }), r = mulberry32(5), parts = [];
    for (let i = 0; i < (this.lite ? 7 : 14); i++) { const x = (r() - 0.5) * 220, z = (r() - 0.5) * 220, y = 48 + r() * 25; for (let k = 0; k < 6; k++) parts.push(T(new THREE.IcosahedronGeometry(4 + r() * 5, 2), x + k * 5 - 12 + r() * 3, y + r() * 3, z + (r() - 0.5) * 8, 0, 0, 0, 1.4, 0.55, 1)); }
    this.clouds = M(merge(parts), cm, false); this.scene.add(this.clouds);
  }
  _ground() {
    const Rt = this.root, lay = (g, m) => { const o = add(Rt, g, m); o.castShadow = false; return o; };
    lay(T(plane(400, 400), 0, -0.02, 0, -Math.PI / 2), smat(surf('grass'), 0xffffff, { r: 1 }));
    lay(T(plane(120, 3.7), 0, 0.006, 7.85, -Math.PI / 2), smat(surf('sidewalk'), 0xffffff, { r: 0.9 }));
    lay(T(rbox(120, 0.14, 0.3, 0.03), 0, 0, 9.75), C(0xd2cdc3, { r: 0.8 }));
    lay(T(plane(300, 7.5), 0, 0.003, 13.6, -Math.PI / 2), mat(0xffffff, { map: tex('road'), r: 0.9 }));
    lay(T(plane(120, 3), 0, 0.006, 18.9, -Math.PI / 2), smat(surf('sidewalk'), 0xffffff, { r: 0.9 }));
    // 裏の路地・建物のあいだ（アスファルト）
    const asph = smat(surf('asphalt'), 0xd8d8d8, { r: 0.95 });
    lay(T(plane(52, 7), CX + 6, 0.002, BACK_Z - 3.6, -Math.PI / 2), asph);
    lay(T(plane(HALL.x0 - R - 0.3, FRONT_Z - BACK_Z), (R + HALL.x0) / 2, 0.003, CZ, -Math.PI / 2), asph);
    lay(T(plane(9, FRONT_Z - HALL.z0 + 2), HX, 0.002, HALL.z0 - 1 + (FRONT_Z - HALL.z0 + 2) / 2 - 1, -Math.PI / 2), asph);
    // ドローンの着陸場所
    const pad = canvasTex(256, 256, (c, w, h) => { c.fillStyle = '#2b2f33'; c.fillRect(0, 0, w, h); c.strokeStyle = '#ffd23f'; c.lineWidth = 12; c.beginPath(); c.arc(w / 2, h / 2, w * 0.4, 0, 7); c.stroke(); c.fillStyle = '#ffd23f'; c.font = `900 120px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('H', w / 2, h / 2 + 6); });
    lay(T(plane(2.2, 2.2), DRONE_PAD[0], 0.01, DRONE_PAD[1], -Math.PI / 2), mat(0xffffff, { map: pad, r: 0.8 }));
    const A = CRATE_AREA;
    const zone = canvasTex(512, 220, (c, W, H) => { c.fillStyle = 'rgba(255,204,0,0.16)'; c.fillRect(0, 0, W, H); c.strokeStyle = '#ffcc00'; c.lineWidth = 12; c.strokeRect(8, 8, W - 16, H - 16); c.fillStyle = 'rgba(255,255,255,0.92)'; c.font = `900 44px ${FONT}`; c.textAlign = 'center'; c.textBaseline = 'middle'; c.fillText('📦 設備の荷受け', W / 2, H / 2); });
    lay(T(plane(A.maxX - A.minX + 0.5, A.maxZ - A.minZ + 0.5), (A.minX + A.maxX) / 2, 0.009, (A.minZ + A.maxZ) / 2, -Math.PI / 2), mat(0xffffff, { map: zone, t: true, r: 0.9 }));
  }
  _town() {
    const g = new THREE.Group(), r = mulberry32(42);
    const trunk = C(0x7a5236, { r: 0.95 }), leafM = mat('#ffffff', { vc: true, r: 0.85 });
    const tree = (x, z, s = 1, pink = false) => {
      add(g, cyl(0.1 * s, 0.17 * s, 2.0 * s, 8), trunk, x, 0, z);
      for (let k = 0; k < 6; k++) {
        const a = k / 6 * 6.28 + r(), rad = (0.5 + r() * 0.5) * s;
        const geo = T(new THREE.IcosahedronGeometry((0.75 + r() * 0.35) * s, 2), x + Math.cos(a) * rad, (2.3 + r() * 1.1) * s, z + Math.sin(a) * rad, r(), r(), 0, 1, 0.82, 1);
        vgrad(geo, pink ? '#e58aa8' : '#2f6b33', pink ? '#ffd1df' : '#7dbb5a', 1.6 * s, 3.8 * s); add(g, geo, leafM);
      }
      this.obstacles.push({ minX: x - 0.3, maxX: x + 0.3, minZ: z - 0.3, maxZ: z + 0.3 });
    };
    for (const x of [L - 6, L + 2, R + 1.5, HALL.x1 + 3, HALL.x1 + 9]) tree(x, 10.5, 0.85, x === L + 2);
    for (let i = 0; i < 22; i++) { const a = r() * Math.PI * 2, d = 42 + r() * 30; tree(Math.cos(a) * d, Math.sin(a) * d * 0.8 - 6, 0.9 + r() * 0.7, r() < 0.3); }
    for (const [x, z] of [[L - 4, -4], [L - 5, 2], [L - 4, -12], [HALL.x1 + 4, -2], [HALL.x1 + 4, -9]]) tree(x, z, 1.05, true);
    // 街灯
    const pole = C(0x2b2f36, { r: 0.4, m: 0.6 }); this.lamps = [];
    for (let x = L + 3; x <= HALL.x1 + 10; x += 10) { add(g, cyl(0.06, 0.09, 4.6, 10), pole, x, 0, 9.4); add(g, T(rbox(0.5, 0.12, 0.25, 0.04), 0, 4.45), pole, x, 0, 8.95); this.lamps.push(x); this.obstacles.push({ minX: x - 0.15, maxX: x + 0.15, minZ: 9.25, maxZ: 9.55 }); }
    this.lampMat = new THREE.MeshBasicMaterial({ color: 0x777777, toneMapped: false });
    g.add(M(merge(this.lamps.map((x) => T(box(0.4, 0.02, 0.18), x, 4.44, 8.95))), this.lampMat, false));
    // 向かいの町家（和風の家並み）
    const walls = [0xe9dcc3, 0xd8c7a6, 0xe2d5bd, 0xcdbb98], roofM = C(0x3a3f4a, { r: 0.7 });
    for (let i = 0; i < 12; i++) {
      const x = -60 + i * 10.5 + r() * 2, h = 4 + r() * 3, zz = 25;
      add(g, rbox(8.6, h, 7, 0.1), C(walls[i % 4], { r: 0.9 }), x, 0, zz);
      add(g, T(box(9.6, 0.5, 8), 0, h), roofM, x, 0, zz);
      add(g, T(cone(6.4, 1.6, 4), 0, h + 0.4, 0, 0, Math.PI / 4, 0, 1, 1, 0.75), roofM, x, 0, zz);
      add(g, T(box(6, 1.8, 0.05), 0, 0.9), C(0x5a3a22, { r: 0.7 }), x, 0, zz - 3.53);
      for (let k = 0; k < 8; k++) add(g, T(box(0.04, 1.8, 0.06), -2.8 + k * 0.8, 0.9), C(0x3a2414), x, 0, zz - 3.56);
    }
    // 遠くの五重塔と富士山
    const pag = new THREE.Group(), red = C(0xa8321e, { r: 0.7 }), roof2 = C(0x2f3238, { r: 0.6 });
    for (let k = 0; k < 5; k++) { const s = 1 - k * 0.12, y = k * 3.2; add(pag, T(box(4 * s, 2.4, 4 * s), 0, y), red); add(pag, T(cone(4.6 * s, 1.1, 4), 0, y + 2.3, 0, 0, Math.PI / 4), roof2); }
    add(pag, T(cyl(0.12, 0.12, 5, 8), 0, 16.5), C(0xc9a227, { m: 0.7, r: 0.3 }));
    pag.position.set(-45, 0, -52); g.add(pag);
    const fuji = new THREE.Group();
    const mt = T(new THREE.ConeGeometry(70, 42, 40, 6), 0, 21, 0); vgrad(mt, '#4d6a8a', '#7f97b5', 0, 30);
    fuji.add(M(mt, mat('#ffffff', { vc: true, r: 1 }), false));
    fuji.add(M(T(new THREE.ConeGeometry(23.5, 14.2, 40, 2), 0, 35, 0), C(0xf8fbff, { r: 0.9 }), false));
    fuji.position.set(30, -2, -150); this.scene.add(fuji);
    const baked = bakeGroup(g); baked.traverse((o) => { if (o.isMesh) o.castShadow = !this.lite; }); this.root.add(baked);
  }
  _building() {
    const g = new THREE.Group(), Rt = this.root;
    // 床：客席は木の床、厨房はタイル
    const SW = R - L;
    const wood = add(Rt, uvScale(T(plane(SW, FRONT_Z - KITCHEN_Z), CX, 0.004, (KITCHEN_Z + FRONT_Z) / 2, -Math.PI / 2), SW / 4, (FRONT_Z - KITCHEN_Z) / 4), smat(surf('wood'), 0xcfa57a, { r: 0.6 })); wood.castShadow = false;
    const tile = add(Rt, uvScale(T(plane(SW, KITCHEN_Z - BACK_Z), CX, 0.004, (BACK_Z + KITCHEN_Z) / 2, -Math.PI / 2), SW / 30, (KITCHEN_Z - BACK_Z) / 10), smat(surf('floor'), 0xb9c0c4, { r: 0.7 })); tile.castShadow = false;
    const outer = smat(surf('wood'), 0x4b2f1c, { r: 0.7 }), stone = C(0x77736c, { r: 0.85 }), black = C(0x1d1d20, { r: 0.5 });
    const wall = (x0, x1, z0, z1, h, y, side) => {
      const w = x1 - x0, d = z1 - z0, cx = (x0 + x1) / 2, cz = (z0 + z1) / 2;
      innerWall(g, w, h, d, cx, cz, y);
      const [ox, oz] = side, bw = ox ? 0.05 : w + 0.1, bd = oz ? 0.05 : d + 0.1;
      add(g, wuv(T(box(bw, h, bd), cx + ox * (w / 2 + 0.025), y, cz + oz * (d / 2 + 0.025)), 1.2), outer);
      if (!y) add(g, T(box(bw + Math.abs(ox) * 0.04, 0.35, bd + Math.abs(oz) * 0.04), cx + ox * (w / 2 + 0.025), 0, cz + oz * (d / 2 + 0.025)), stone);
    };
    wall(L - 0.12, L + 0.12, BACK_Z - 0.12, FRONT_Z + 0.12, WALL_H, 0, [-1, 0]);
    wall(R - 0.12, R + 0.12, BACK_Z - 0.12, FRONT_Z + 0.12, WALL_H, 0, [1, 0]);
    // 奥の壁（勝手口つき）
    const bd0 = 3.9, bd1 = 5.1;
    wall(L, bd0, BACK_Z - 0.12, BACK_Z + 0.12, WALL_H, 0, [0, -1]); wall(bd1, R, BACK_Z - 0.12, BACK_Z + 0.12, WALL_H, 0, [0, -1]);
    wall(bd0, bd1, BACK_Z - 0.12, BACK_Z + 0.12, WALL_H - 2.2, 2.2, [0, -1]);
    add(g, T(box(bd1 - bd0, 2.2, 0.06), (bd0 + bd1) / 2, 0, BACK_Z), C(0x6b7b88, { r: 0.4, m: 0.5 }));
    add(g, T(cyl(0.03, 0.03, 0.04, 10), bd1 - 0.15, 1.0, BACK_Z + 0.05, Math.PI / 2), C(0xcccccc, { m: 0.8 }));
    add(g, T(plane(1.0, 0.24), (bd0 + bd1) / 2, 1.8, BACK_Z + 0.04), basic(signTexture('勝手口', { w: 256, h: 64, bg: '#2b2f33', fg: '#ffd23f', radius: 8 })));
    this.obstacles.push({ minX: bd0, maxX: bd1, minZ: BACK_Z - 0.2, maxZ: BACK_Z + 0.1 });
    // 正面：格子の窓と引き戸
    const glass = glassMat(), lattice = C(0x3a2414, { r: 0.6 });
    const front = (x0, x1) => {
      const w = x1 - x0, cx = (x0 + x1) / 2;
      add(g, T(box(w, 0.9, 0.24), cx, 0, FRONT_Z), outer);
      add(g, wuv(T(box(w, WALL_H - 2.6, 0.24), cx, 2.6, FRONT_Z), 1.2), outer);
      this.root.add(M(T(box(w, 1.7, 0.03), cx, 0.9, FRONT_Z), glass, false));
      for (let x = x0 + 0.1; x < x1; x += 0.12) add(g, T(box(0.03, 1.7, 0.05), x, 0.9, FRONT_Z + 0.06), lattice);
      add(g, T(box(w, 0.05, 0.08), cx, 1.6, FRONT_Z + 0.06), lattice);
      innerWall(g, w, 0.9, 0.04, cx, FRONT_Z - 0.14, 0);
    };
    front(L, DOOR.x - DOOR.half - 0.12); front(DOOR.x + DOOR.half + 0.12, R);
    for (const x of [DOOR.x - DOOR.half - 0.06, DOOR.x + DOOR.half + 0.06]) add(g, T(box(0.12, 2.4, 0.3), x, 0, FRONT_Z), black);
    add(g, T(box(DOOR.half * 2 + 0.24, 0.18, 0.3), DOOR.x, 2.3, FRONT_Z), black);
    add(g, wuv(T(box(DOOR.half * 2 + 0.24, WALL_H - 2.48, 0.24), DOOR.x, 2.48, FRONT_Z), 1.2), outer);
    for (const s of [-1, 1]) {
      const d = new THREE.Group();
      d.add(M(T(box(DOOR.half, 2.25, 0.03), 0, 0.02), glass, false));
      for (let k = 0; k <= 4; k++) d.add(M(T(box(0.04, 2.25, 0.05), -DOOR.half / 2 + k * DOOR.half / 4, 0.02), lattice));
      d.add(M(T(box(DOOR.half, 0.06, 0.05), 0, 0.02), lattice)); d.add(M(T(box(DOOR.half, 0.06, 0.05), 0, 2.2), lattice));
      d.position.set(DOOR.x + s * DOOR.half / 2, 0, FRONT_Z + 0.05 * s); d.userData = { base: DOOR.x + s * DOOR.half / 2, s, w: DOOR.half };
      this.root.add(d); this.doors.push(d);
    }
    // ひさし（瓦屋根）
    const kawara = C(0x3c4048, { r: 0.6 });
    add(g, T(box(R - L + 0.6, 0.12, 1.4), CX, 2.62, FRONT_Z + 0.6, 0.35), kawara);
    for (let x = L; x <= R; x += 0.3) add(g, T(cyl(0.05, 0.05, 1.4, 6), x, 2.66, FRONT_Z + 0.6, Math.PI / 2 - 0.35), kawara);
    // 天井・屋根
    const ceil = M(uvScale(T(plane(R - L, FRONT_Z - BACK_Z), CX, CEIL, CZ, Math.PI / 2), (R - L) / 30, (FRONT_Z - BACK_Z) / 18), smat(surf('wood'), 0x8a6a4a, { r: 0.8 }), false);
    this.root.add(ceil); this.ceiling = ceil;
    for (let x = L + 1; x < R; x += 2) add(g, T(box(0.14, 0.18, FRONT_Z - BACK_Z), x, CEIL - 0.18, CZ), C(0x4a2e1a, { r: 0.6 }));
    this.roofMat = kawara;
    add(g, T(box(R - L + 0.6, 0.3, FRONT_Z - BACK_Z + 0.6), CX, WALL_H, CZ), C(0x5a5f66, { r: 0.9 }));
    // 厨房の上の換気フード
    add(g, T(box(10.5, 0.45, 1.0), -0.3, 2.55, BACK_Z + 0.55), smat(surf('metal'), 0xe0e3e6, { r: 0.35, m: 0.7 }));
    // 時計
    this.clock = new THREE.Group();
    this.clock.add(M(T(cyl(0.3, 0.3, 0.05, 32), 0, 0, 0, Math.PI / 2), C(0xffffff, { r: 0.4 })));
    this.clock.add(M(T(torus(0.3, 0.03, 8, 32), 0, 0, 0.03), C(0x4a2e1a, { r: 0.4 })));
    this.hourHand = M(T(box(0.03, 0.16, 0.01), 0, 0, 0.06), C(0x222222)); this.minHand = M(T(box(0.02, 0.24, 0.01), 0, 0, 0.07), C(0x222222));
    this.clock.add(this.hourHand, this.minHand);
    this.clock.position.set(L + 0.15, 2.5, 1); this.clock.rotation.y = Math.PI / 2; this.root.add(this.clock);
    // 壁の木札メニュー（飾り）
    const fuda = ['醤油', '塩', '味噌', '豚骨', '餃子', 'ライス', '生ビール'];
    fuda.forEach((t, i) => { const p = M(T(plane(0.22, 0.7), 0, 0), basic(vtext(t, { w: 96, h: 320, bg: '#e9d6b0', fg: '#3a2210' }))); p.position.set(L + 0.14, 2.2, -1.5 + i * 0.32); p.rotation.y = Math.PI / 2; this.root.add(p); });
    const baked = bakeGroup(g); baked.traverse((o) => { if (o.isMesh) o.castShadow = !this.lite && o.material !== this.roofMat; }); this.root.add(baked);
  }
  // となりの賭場（和風の建物・畳・提灯）
  _hall() {
    const g = new THREE.Group(), x0 = HALL.x0, x1 = HALL.x1, z0 = HALL.z0, z1 = HALL.z1;
    const outer = smat(surf('wood'), 0x2e1c12, { r: 0.75 }), inner = smat(surf('wall'), 0x8f2a2a, { r: 0.9 }), black = C(0x161618, { r: 0.5 });
    const fl = add(this.root, uvScale(T(plane(x1 - x0, z1 - z0), HX, 0.006, HZ, -Math.PI / 2), 1, 1), mat(0xffffff, { map: tatamiTex(), r: 0.85 })); fl.castShadow = false;
    const wl = (ax, bx, az, bz, h = HALL_H) => { const w = bx - ax, d = bz - az; add(g, wuv(T(box(w, h, d), (ax + bx) / 2, 0, (az + bz) / 2), 2.4), inner); add(g, wuv(T(box(w + 0.06, h, d + 0.06), (ax + bx) / 2, 0, (az + bz) / 2), 1.2), outer); };
    wl(x0 - 0.12, x0 + 0.12, z0 - 0.12, z1 + 0.12); wl(x1 - 0.12, x1 + 0.12, z0 - 0.12, z1 + 0.12); wl(x0, x1, z0 - 0.12, z0 + 0.12);
    wl(x0, HALL.door[0], z1 - 0.12, z1 + 0.12); wl(HALL.door[1], x1, z1 - 0.12, z1 + 0.12);
    add(g, T(box(HALL.door[1] - HALL.door[0], HALL_H - 2.3, 0.24), HX, 2.3, z1), outer);
    add(g, T(box(x1 - x0 + 0.6, 0.3, z1 - z0 + 0.6), HX, HALL_H, HZ), C(0x3c4048, { r: 0.6 }));
    add(g, T(cone((x1 - x0) * 0.75, 1.6, 4), HX, HALL_H + 0.3, HZ, 0, Math.PI / 4, 0, 1, 1, 1.1), C(0x3c4048, { r: 0.6 }));
    this.root.add(M(T(plane(x1 - x0, z1 - z0), HX, HALL_H - 0.01, HZ, Math.PI / 2), C(0x3a2416, { r: 0.8 }), false));
    // 看板と提灯
    add(g, T(plane(3.2, 0.9), HX, 2.5, z1 + 0.14), basic(signTexture('賭場', { w: 768, h: 216, bg: '#1c1d20', fg: '#f2c94c', radius: 10, family: '"Dela Gothic One",sans-serif' })));
    for (const x of [HALL.door[0] - 0.6, HALL.door[1] + 0.6]) {
      add(g, T(cyl(0.005, 0.005, 0.4, 4), x, 2.6, z1 + 0.4), black);
      add(g, T(sph(0.22, 16, 10), x, 2.3, z1 + 0.4, 0, 0, 0, 1, 1.4, 1), mat(0xffffff, { map: vtext('丁半', { w: 256, h: 256, bg: '#d62828', lantern: true, size: 70 }), r: 0.6, e: 0x5a0a0a, ei: 0.8 }));
    }
    // 入口ののれん（黒）
    const noren = vtext('', { w: 64, h: 64, bg: '#1c1d20' });
    for (let k = 0; k < 4; k++) { const p = M(T(plane(0.42, 0.9), HALL.door[0] + 0.24 + k * 0.45, 1.85, z1 + 0.16), basic(noren, { side: THREE.DoubleSide }), false); p.userData.noRay = true; this.root.add(p); }
    // 中のふすまの絵・掛け軸
    add(g, T(plane(0.7, 1.6), x0 + 0.14, 1.2, HZ, 0, Math.PI / 2), basic(vtext('一攫千金', { w: 128, h: 448, bg: '#f2ead8', fg: '#1c1d20' })));
    const baked = bakeGroup(g); baked.traverse((o) => { if (o.isMesh) o.castShadow = !this.lite; }); this.root.add(baked);
    // 引き戸
    for (const s of [-1, 1]) {
      const d = new THREE.Group(), w = (HALL.door[1] - HALL.door[0]) / 2;
      d.add(M(T(box(w, 2.25, 0.04), 0, 0), C(0x3a2414, { r: 0.6 }))); d.add(M(T(box(w - 0.12, 1.4, 0.05), 0, 0.6), mat(0xfff4dc, { r: 0.9, e: 0x221a08 })));
      d.position.set(HX + s * w / 2, 0, z1 + 0.06 * s); d.userData = { base: HX + s * w / 2, s, w, hall: true };
      this.root.add(d); this.doors.push(d);
    }
    this.hallLights = [[HX, HZ - 1], [HX, HZ + 2]];
  }
  // 店の状態で変わるもの（店名の看板・のれん・未購入の列・照明）
  updateStore(store) {
    const key = [store.name, store.color, JSON.stringify(store.cols), store.phase === 'open' || store.phase === 'closing'].join('|');
    if (key === this._key) return;
    this._key = key;
    try { this._updateStore(store); } catch (e) { console.warn('updateStore', e); }
  }
  _updateStore(store) {
    for (const o of this.dynamic.children) o.traverse((m) => { if (m.isMesh && m.geometry) m.geometry.dispose(); });
    this.dynamic.clear();
    const D = this.dynamic, g = new THREE.Group();
    // 屋根の上の大きな木の看板
    const name = String(store.name || 'ラーメン');
    const board = signTexture(name, { w: 1536, h: 300, bg: '#3a2414', fg: '#fff4dc', stroke: '#1c1008', radius: 20, family: '"Dela Gothic One",sans-serif' });
    D.add(M(T(plane(10, 1.9), 0, WALL_H + 0.25, FRONT_Z + 0.2), basic(board), false));
    add(g, T(box(10.4, 2.1, 0.2), 0, WALL_H + 0.15, FRONT_Z + 0.06), C(0x1c1008, { r: 0.6 }));
    // のれん（店の色・「らーめん」）。営業中だけ出す
    const open = store.phase === 'open' || store.phase === 'closing';
    if (open) {
      const txt = ['ら', 'ー', 'め', 'ん'];
      txt.forEach((t, k) => { const p = M(T(plane(0.48, 0.95), DOOR.x - 0.75 + k * 0.5, 1.75, FRONT_Z + 0.2), basic(vtext(t, { w: 96, h: 192, bg: store.color || '#c0392b', fg: '#ffffff', size: 70 }), { side: THREE.DoubleSide }), false); p.userData.noRay = true; D.add(p); });
      add(g, T(cyl(0.025, 0.025, 2.2, 8), DOOR.x, 2.25, FRONT_Z + 0.2, 0, 0, Math.PI / 2), C(0x6b4a30));
    }
    // 赤ちょうちん（入口の両わき）
    for (const x of [DOOR.x - 1.6, DOOR.x + 1.6]) add(g, T(sph(0.24, 16, 10), x, 2.2, FRONT_Z + 0.45, 0, 0, 0, 1, 1.35, 1), mat(0xffffff, { map: vtext('らーめん', { w: 256, h: 256, bg: '#d62828', lantern: true, size: 50 }), r: 0.6, e: open ? 0x7a1010 : 0x220000, ei: 1 }));
    // 未購入の列：合板の仮壁と工事中の床
    const ply = smat(surf('plywood'), 0xffffff, { r: 0.85 });
    const sign = basic(signTexture('🚧 拡張予定地', { w: 768, h: 192, bg: '#2b2f33', fg: '#ffd23f', radius: 28 }));
    for (const w of getWalls(store)) {
      if (w.type !== 'part') continue;
      const cx = (w.minX + w.maxX) / 2, cz = (w.minZ + w.maxZ) / 2;
      add(g, wuv(T(box(w.maxX - w.minX, CEIL, w.maxZ - w.minZ), cx, 0, cz), 1.2, 2.4), ply);
      for (const z of [-4.5, 0.5]) for (const s of [1, -1]) { const p = M(T(plane(2.2, 0.55), 0, 0), sign, false); p.position.set(cx + s * 0.13, 1.7, z); p.rotation.y = s > 0 ? Math.PI / 2 : -Math.PI / 2; D.add(p); }
    }
    for (const c of ALL_COLS) {
      if (store.cols?.[c]) continue;
      const r = colRect(c), f = M(T(plane(COL_W - 0.1, FRONT_Z - BACK_Z - 0.1), (r.minX + r.maxX) / 2, 0.01, CZ, -Math.PI / 2), smat(surf('concrete'), 0x9a9890, { r: 0.95 }), false); D.add(f);
    }
    // 照明（ペンダントライト）
    this.lightSpots = [];
    const lamps = [];
    for (const c of ALL_COLS) {
      if (!store.cols?.[c]) continue;
      const r = colRect(c), cx = (r.minX + r.maxX) / 2;
      for (const z of [-5, -0.5, 3]) { lamps.push([cx - 1, z], [cx + 1, z]); }
      this.lightSpots.push([cx, -4.5], [cx, 2]);
    }
    const shade0 = C(0x2b2b2b, { r: 0.5 }), bulb = new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false });
    for (const [x, z] of lamps) { add(g, T(cyl(0.004, 0.004, 0.7, 4), x, CEIL - 0.7, z), shade0); add(g, T(cone(0.22, 0.2, 14), x, CEIL - 0.9, z), shade0); D.add(M(T(sph(0.07, 10, 8), x, CEIL - 0.92, z), bulb, false)); }
    for (const p of this.hallLights || []) this.lightSpots.push(p);
    const baked = bakeGroup(g); baked.traverse((o) => { if (o.isMesh) o.castShadow = !this.lite; }); D.add(baked);
  }
  update(dt, timeMin, chars) {
    // 引き戸（店と賭場）
    let near = false, nearH = false;
    for (const [x, z] of chars) { if (Math.abs(x - DOOR.x) < 2 && Math.abs(z - FRONT_Z) < 2.2) near = true; if (Math.abs(x - HX) < 2 && Math.abs(z - HALL.z1) < 2.2) nearH = true; }
    this.doorOpen += ((near ? 1 : 0) - this.doorOpen) * Math.min(1, dt * 6);
    this.hallOpen += ((nearH ? 1 : 0) - this.hallOpen) * Math.min(1, dt * 6);
    for (const d of this.doors) d.position.x = d.userData.base + d.userData.s * (d.userData.hall ? this.hallOpen : this.doorOpen) * d.userData.w * 0.95;
    const h = (timeMin / 60) % 12, m = timeMin % 60;
    if (this.hourHand) { this.hourHand.rotation.z = -h / 12 * Math.PI * 2; this.minHand.rotation.z = -m / 60 * Math.PI * 2; }
    if (this.clouds) this.clouds.position.x = (this.clouds.position.x + dt * 0.6) % 80;
  }
}
