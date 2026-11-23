// ===== ラーメン屋の経営シミュレーション（ホスト側で実行・three.js 非依存） =====
import {
  FIXTURES, SOUPS, BROTHS, TARES, BROTH_EXTRA, POT_PER, AKU_RATE, TARE_MIX, OLD_SOUP_SETS, DRY_MAX, WASH_T, DRAIN_T, FLOAT_CASH, soupOf, TOPPINGS, SIDES, GRIDDLE, HARD, INGREDIENTS, ING_LIST, DISHES, STAFF_ROLES, STAFF_SLOTS, SPEEDS, STAFF_NAMES,
  OPEN_TIME, GAME_MIN_PER_SEC, SPAWN_POINTS, PLAYER_BOUNDS, START_COLS, STAFF_HOME, CRATE_AREA, SHIPPING_FEE, ORDER_MAX, CELL,
  SOUP_READY, SOUP_RICH, RICE_READY, NOODLE_OVER, DIRTY_MAX, TOP_MAX, MENU_RAMEN_MAX, MAX_LEVEL, CHOHAN_FEE, CHOHAN_T, SLOT_SYMS, SLOT_PAY, SLOT_CHERRY2, GAMBLES,
  zones, keepClear, getWalls, expandTargets, fixtureFootprint, snapFixture, localToWorld, frontSpot, seatPos, seatAccess, seatYaw, ticketSpot,
  staffK, staffSlotOpen, hasStaffLicense, ticketLimit, closeTime, xpNeed, xpOf, fixtureUnlocked, unlocksAt, ingUnlocked, menuValue, menuLimit,
  isCounter, inHall, inKitchen, colRect, COUNTER_Z, KITCHEN_Z, ownCols, BUILDING, FRONT_Z, DOOR,
} from './data.js';
import { NavGrid } from './nav.js';
import { rand, randi, pick, dist, dist2, clamp } from './util.js';

export const SAVE_V = 1;
const BUBBLE_T = 2.6;
const DELIVERY_SEC = 8;
const newToday = () => ({ sales: 0, served: 0, lost: 0, refund: 0, orders: 0, ship: 0, xp: 0, bowls: 0, sides: 0, stolen: 0, bounty: 0, critic: 0, gamble: 0, repair: 0, fires: 0, items: {}, rv: [0, 0, 0, 0, 0], qs: 0, qn: 0 });
const counterFor = (c) => (c === 4 ? 'counter2' : 'counter');
function counterFixture(st, c) {
  const r = colRect(c), t = counterFor(c), w = FIXTURES[t].w;
  return { id: st.nid++, t, x: r.minX + w / 2, z: COUNTER_Z, r: 0, dd: FIXTURES[t].seats.map(() => []) };
}
export function newStore(name) {
  const st = {
    v: SAVE_V, name: name || 'ラーメン一番', money: 30000, till: FLOAT_CASH, day: 1, level: 1, xp: 0, rep: 50,
    staff: [], nid: 100, phase: 'prep', time: OPEN_TIME, totalSales: 0, totalCustomers: 0, totalBowls: 0, rev: 1, created: Date.now(), color: '#c0392b',
    today: newToday(), cols: Object.fromEntries(START_COLS.map((c) => [c, 1])), crates: [], reviews: [],
    stock: { men: 40, torigara: 2, yasai: 2, t_shoyu: 1, negi: 3, chashu: 2, menma: 2 },
    prep: {}, tare: {},
    dish: { bowl: 12, bowlS: 0, plate: 0, mug: 0 }, dirty: { bowl: 0, bowlS: 0, plate: 0, mug: 0 }, dry: { bowl: 0, bowlS: 0, plate: 0, mug: 0 },
    menu: [{ id: 'm1', kind: 'ramen', name: '醤油ラーメン', soup: 'shoyu', tp: ['negi', 'chashu', 'menma'], price: 800, on: true }],
    hand: {}, slic: {}, stats: { bowls: 0, critic: 0, thief: 0, fires: 0, gWin: 0, gLose: 0 },
  };
  st.fixtures = initialFixtures(st);
  return st;
}
function initialFixtures(st) {
  const L = [];
  const add = (t, x, z, r = 0, extra = {}) => { const f = { id: st.nid++, t, x, z, r, ...extra }; initState(f); L.push(f); return f; };
  for (const c of START_COLS) L.push(counterFixture(st, c));
  // 厨房：カウンターのすぐ内側が調理ライン（お客さんの顔を見ながら作る）。トッピング台（タレ）→ 寸胴鍋 → 茹で麺機 の順
  //       奥の壁ぎわに 冷蔵庫・まな板・食器棚・洗い場（シンク＋水切りかご）、右の壁にパソコン
  add('topping', -4.45, -3.72, 2); add('pot', -2.95, -3.68, 2); add('boiler', -1.65, -3.68, 2);
  add('fridge', -5.4, -6.6); add('board', -3.95, -6.65); add('dishrack', -2.45, -6.75); add('sink', -0.75, -6.65); add('trash', 0.75, -6.7);
  add('pc', 5.6, -5.6, 3);
  add('pass', 3.4, -3.5); add('ext', -5.75, -4.6);
  // 客席：入口の右に券売機とレジ、左にテーブル席
  add('ticket', 2.2, 5.4, 2); add('register', 3.55, 5.45, 2); add('table2', -4.5, 1.2); add('table2', -2.2, 1.2); add('plant', -5.6, 5.55); add('signstand', 3.6, 6.9);
  add('opensign', -1.9, 6.75);
  // 賭場（となりの建物）
  add('chohan', 13, 0.6); add('chinchiro', 10.6, -1.7); for (const z of [-1.9, -0.8, 0.3]) add('slot', 16.45, z, 3);
  return L;
}
function initState(f) {
  const d = FIXTURES[f.t];
  if (d.baskets) f.bk = Array(d.baskets).fill(null);
  if (d.pass) f.ps = Array(d.pass).fill(null);
  if (d.seats) f.dd = d.seats.map(() => []);
  if (d.pot && f.pot === undefined) f.pot = null;
  if (d.text && !f.tx) { f.tx = f.t === 'nobori' ? 'ラーメン' : f.t === 'neon' ? 'RAMEN' : '本日も営業中'; f.c = f.t === 'neon' ? '#ff4f6d' : '#ffffff'; }
}
// 保存データの整合性を直す（読込時）。調理の途中（タイマー）はリセット
export function normalizeStore(st) {
  st.v ||= SAVE_V;
  st.crates ||= []; st.reviews ||= []; st.staff ||= []; st.fixtures ||= []; st.slic ||= {};
  st.cols ||= Object.fromEntries(START_COLS.map((c) => [c, 1]));
  st.stock ||= {}; st.prep ||= {}; st.tare ||= {}; st.dish ||= { bowl: 10 }; st.dirty ||= {}; st.dry ||= {};
  // 古いセーブの「スープの材料」は、骨・香味野菜・タレの材料に置きかえる
  for (const [old, sk] of Object.entries(OLD_SOUP_SETS)) { const n = st.stock[old] | 0; if (n > 0) { const S = SOUPS[sk]; st.stock[BROTHS[S.broth].item] = (st.stock[BROTHS[S.broth].item] || 0) + n * 2; st.stock.yasai = (st.stock.yasai || 0) + n; st.stock[TARES[S.tare].raw] = (st.stock[TARES[S.tare].raw] || 0) + 1; } delete st.stock[old]; }
  for (const k of Object.keys(st.tare)) if (!TARES[k] || !(st.tare[k] > 0)) delete st.tare[k];
  for (const k of Object.keys(DISHES)) { st.dish[k] = Math.max(0, st.dish[k] | 0); st.dirty[k] = Math.max(0, st.dirty[k] | 0); st.dry[k] = Math.max(0, st.dry[k] | 0); }
  for (const k of Object.keys(st.stock)) if (!INGREDIENTS[k] || !(st.stock[k] > 0)) delete st.stock[k];
  for (const k of Object.keys(st.prep)) if ((!TOPPINGS[k] && k !== 'beer') || !(st.prep[k] > 0)) delete st.prep[k];
  st.menu = (st.menu || []).filter((m) => (m.kind === 'ramen' && SOUPS[m.soup]) || (m.kind === 'side' && SIDES[m.side]));
  for (const m of st.menu) if (m.kind === 'ramen') m.tp = (m.tp || []).filter((t) => TOPPINGS[t]).slice(0, TOP_MAX);
  if (!st.menu.some((m) => m.kind === 'ramen')) st.menu.unshift({ id: 'm1', kind: 'ramen', name: '醤油ラーメン', soup: 'shoyu', tp: ['negi', 'chashu', 'menma'], price: 800, on: true });
  st.stats = { bowls: 0, critic: 0, thief: 0, fires: 0, gWin: 0, gLose: 0, ...(st.stats || {}) };
  st.today = { ...newToday(), ...(st.today || {}) };
  st.rev ||= 1; st.level = clamp(st.level || 1, 1, MAX_LEVEL); st.xp ||= 0; st.till = Math.max(0, st.till || 0);
  if (st.level >= MAX_LEVEL) st.xp = 0;
  st.fixtures = st.fixtures.filter((f) => FIXTURES[f.t]);
  // 持っている物：料理は捨てて洗い物に、下げた食器は洗い場へ
  for (const [k, hd] of Object.entries(st.hand || {})) {
    if (hd?.t === 'dish' && DISHES[hd.d?.k]) st.dirty[hd.d.k]++;
    if (hd?.t === 'dirty') for (const x of hd.a || []) if (DISHES[x]) st.dirty[x]++;
    if (hd?.t === 'clean') for (const x of hd.a || []) if (DISHES[x]) st.dry[x]++;
    if (hd?.t === 'cash' && hd.v > 0) { st.money += hd.v; st.till += hd.v; }
    delete st.hand[k];
  }
  st.hand = {};
  for (const f of st.fixtures) {
    const d = FIXTURES[f.t];
    initState(f);
    if (d.pot) {
      const P = f.pot;
      if (P && P.k && !P.b && P.sv > 0 && SOUPS[P.k]) { const S = SOUPS[P.k]; f.pot = { w: 1, n: { [BROTHS[S.broth].item]: Math.ceil(P.sv / POT_PER) }, b: S.broth, ha: BROTHS[S.broth].rich, hs: 0, sk: 1, sv: P.sv, used: 0, fire: 0, off: -999, dry: null }; st.tare[S.tare] = (st.tare[S.tare] || 0) + P.sv; }
      else if (P && P.w > 0 && P.n) { P.ha = P.fire && P.b ? Math.max(P.ha || 0, BROTHS[P.b].ready) : (P.ha || 0); P.hs = 0; P.off = 0; P.dry = null; P.sk = Math.min(P.sk || 0, 1); }
      else f.pot = null;
    }
    if (d.topping) f.tj = null;
    if (d.sink) f.wp = 0;
    if (d.baskets) f.bk = Array(d.baskets).fill(null);
    if (d.griddle) f.gr = null;
    if (d.rice) { if (f.rc && f.rc.sv > 0) f.rc.t0 = -999; else f.rc = null; }
    if (d.board) f.job = null;
    if (d.pass) { f.ps = (f.ps || []).slice(0, d.pass).map((x) => (x && DISHES[x.k] ? x : null)); while (f.ps.length < d.pass) f.ps.push(null); for (const x of f.ps) if (x) { x.t = 0; delete x.for; } }
    if (d.seats) { f.dd = (f.dd || []).slice(0, d.seats.length).map((a) => (Array.isArray(a) ? a.filter((x) => DISHES[x]) : [])); while (f.dd.length < d.seats.length) f.dd.push([]); }
  }
  // レジがなければ券売機のそばに置く
  if (!st.fixtures.some((f) => f.t === 'register')) { const tk = st.fixtures.find((f) => f.t === 'ticket'); const fp = fitPlacement(st, 'register', (tk?.x ?? 2.2) + 1.3, tk?.z ?? 5.4, 2); st.fixtures.push({ id: st.nid++, t: 'register', x: fp.x, z: fp.z, r: 2 }); }
  // 買った列にはカウンターがある
  for (const c of ownCols(st)) {
    const r = colRect(c);
    if (!st.fixtures.some((f) => isCounter(f.t) && f.x > r.minX && f.x < r.maxX)) st.fixtures.push(counterFixture(st, c));
  }
  for (const c of st.crates) if (c.loc?.t !== 'f') c.loc = crateSpot(st);
  for (const s of st.staff) { const sl = STAFF_SLOTS.find((o) => o.no === s.slot); s.cook ||= sl?.cook || 1; s.hall ||= sl?.hall || 1; if (!STAFF_ROLES[s.role]) s.role = 'auto'; s.wage = sl?.wage ?? s.wage ?? 1800; }
  if (st.phase !== 'prep' && st.phase !== 'summary') { st.phase = 'prep'; st.time = OPEN_TIME; }
  if (st.phase === 'summary') { st.phase = 'prep'; st.day++; st.time = OPEN_TIME; st.today = newToday(); st.till = Math.min(st.money, FLOAT_CASH); }
  st.till = Math.min(st.till, Math.max(0, st.money));
  return st;
}
export function crateSpot(st) {
  const A = CRATE_AREA, taken = (st.crates || []).filter((c) => c.loc?.t === 'f').map((c) => [c.loc.x, c.loc.z]);
  for (let z = A.minZ + 0.6; z <= A.maxZ; z += 1.4) for (let x = A.maxX - 0.6; x >= A.minX; x -= 1.4) if (taken.every(([tx, tz]) => Math.abs(tx - x) > 1.2 || Math.abs(tz - z) > 1.0)) return { t: 'f', x, y: 0, z, ry: 0 };
  return { t: 'f', x: rand(A.minX, A.maxX), y: 0, z: rand(A.minZ, A.maxZ), ry: 0 };
}
export function fitPlacement(store, type, x, z, r, ignoreId, avoid = () => false) {
  const S = { store }, chk = (xx, zz) => Sim.prototype.canPlaceFixture.call(S, type, xx, zz, r, ignoreId);
  const check = chk(x, z);
  if (check === true && !avoid(x, z)) return { x, z, ok: true, why: true };
  const fp = fixtureFootprint(type, 0, 0, r), R = Math.max(1, Math.ceil((Math.max(fp.rw, fp.rd) / 2 + 0.5) * 2) / 2);
  const cands = [];
  for (let dx = -R; dx <= R + 1e-6; dx += 0.5) for (let dz = -R; dz <= R + 1e-6; dz += 0.5) { if (!dx && !dz) continue; const [cx, cz] = snapFixture(type, x + dx, z + dz, r); cands.push([Math.hypot(cx - x, cz - z), cx, cz]); }
  cands.sort((a, b) => a[0] - b[0]);
  for (const [, cx, cz] of cands) if (!avoid(cx, cz) && chk(cx, cz) === true) return { x: cx, z: cz, ok: true, why: true };
  return { x, z, ok: false, why: check === true ? '自分と重なっています（少し離れてね）' : check };
}
// ---------- 料理の品質 ----------
// 寸胴鍋：炊いた秒数（火がついていて、水と材料が入っている間だけ増える）
export const potBoiling = (P) => !!(P && P.fire && P.w > 0 && P.b);
export const potHeat = (P, clk) => (P ? (P.ha || 0) + (potBoiling(P) ? Math.max(0, clk - (P.hs || 0)) : 0) : 0);
// アク：炊きはじめに出てくる。取った分は P.sk
export function potAku(P, clk) { if (!P?.b) return 0; const B = BROTHS[P.b], gen = Math.min(1, AKU_RATE * Math.min(potHeat(P, clk), B.ready + 70)); return clamp(gen - (P.sk || 0), 0, 1); }
export function potCommit(P, clk) { if (!P) return; P.ha = potHeat(P, clk); P.hs = clk; }
export function potBroth(P) { let best = null, bn = 0; for (const [id, n] of Object.entries(P?.n || {})) { const b = INGREDIENTS[id]?.broth; if (b && n > bn) { bn = n; best = b; } } return best; }
export function potServings(P, def) { if (!P?.b) return 0; return Math.max(0, Math.min(def.pot.sv, (P.n[BROTHS[P.b].item] || 0) * POT_PER) - (P.used || 0)); }
export function soupQuality(f, clk) {
  const P = f?.pot; if (!P?.b) return 0;
  const B = BROTHS[P.b], heat = potHeat(P, clk), rich = clamp((heat - B.ready) / (B.rich - B.ready), 0, 1);
  const temp = P.fire ? 1 : clamp(1 - (clk - (P.off ?? clk)) / 90, 0.4, 1);
  let bonus = 0; for (const [k, v] of Object.entries(BROTH_EXTRA)) if (P.n[k]) bonus += v;
  for (const [id, n] of Object.entries(P.n)) { const b = INGREDIENTS[id]?.broth; if (b && b !== P.b && n > 0) bonus += 0.05; }
  let q = Math.min(1, 0.62 + 0.24 * rich + bonus) * (1 - 0.3 * potAku(P, clk));
  if (B.bitter && heat > B.bitter) q *= 1 - Math.min(0.35, (heat - B.bitter) / 250);
  return +(q * (0.55 + 0.45 * temp)).toFixed(3);
}
export const potReady = (f, clk) => !!f?.pot?.b && f.pot.sv > 0 && potHeat(f.pot, clk) >= BROTHS[f.pot.b].ready && !f.br;
export const dryCount = (st) => Object.values(st.dry || {}).reduce((a, b) => a + b, 0);
export function griddleQ(type, sec) {
  const G = GRIDDLE[type]; if (!G) return 50;
  if (sec < G.ideal[0]) return clamp(Math.round(100 - (G.ideal[0] - sec) * 7), 15, 100);
  if (sec <= G.ideal[1]) return 100;
  if (sec <= G.burn) return Math.round(100 - (sec - G.ideal[1]) * 6);
  return 18;
}
export const beerQ = (fill) => clamp(Math.round(100 - Math.abs((fill || 0) - 0.93) * 320), 5, 100);
const dishEmpty = (d) => !d.soup && !d.broth && !d.tare && !d.side && d.men == null && !(d.tp || []).length;
// 料理を「どの注文か」に当てはめて点数をつける（null＝注文とちがう）
export function evalDish(store, d, line, c, clk) {
  if (!d || !line) return null;
  if (line.k === 'ramen') {
    const m = store.menu.find((x) => x.id === line.m);
    if (!m || d.k !== 'bowl') return { ng: '器がちがう' };
    if (!d.broth && !d.tare) return { ng: 'スープが入っていない' };
    if (!d.tare) return { ng: 'タレ（かえし）が入っていない' };
    if (!d.broth) return { ng: 'だし（寸胴鍋のスープ）が入っていない' };
    if (d.soup !== m.soup) return { ng: `スープがちがう（${BROTHS[d.broth]?.short}＋${TARES[d.tare]?.short}）` };
    if (d.men == null) return { ng: '麺が入っていない' };
    let s = 100;
    const H = HARD[line.h] || HARD.futsu;
    if (d.men < H.t[0]) s -= Math.min(40, (H.t[0] - d.men) * 4.5);
    if (d.men > H.t[1]) s -= Math.min(50, (d.men - H.t[1]) * 3.2);
    s -= (1 - (d.sq ?? 0.8)) * 30;
    s -= (d.wet || 0) * 28; // 湯切りが足りないと水っぽい
    const tp = d.tp || [], miss = m.tp.filter((t) => !tp.includes(t)), extra = tp.filter((t) => !m.tp.includes(t));
    s -= miss.length * 12 + extra.length * 4;
    const w = clk - (c?.ordT ?? clk); if (w > 75) s -= Math.min(25, (w - 75) * 0.35);
    const cool = clk - (d.t ?? clk); if (cool > 45) s -= Math.min(20, (cool - 45) * 0.4);
    return { q: Math.round(clamp(s, 0, 100)), miss, extra };
  }
  const S = SIDES[line.k]; if (!S) return null;
  if (d.k !== S.dish) return { ng: '器がちがう' };
  if (line.k === 'chadon') { if (d.side !== 'rice') return { ng: 'ごはんが入っていない' }; if (!(d.tp || []).includes('chashu')) return { ng: 'チャーシューがのっていない' }; return { q: clamp(Math.round((d.q ?? 85) + 5), 0, 100) }; }
  if (line.k === 'rice') { if (d.side !== 'rice') return { ng: 'ごはんが入っていない' }; return { q: d.q ?? 85 }; }
  if (line.k === 'beer') { if (d.side !== 'beer') return { ng: 'ビールが入っていない' }; return { q: beerQ(d.fill) }; }
  if (d.side !== line.k) return { ng: `${S.name}じゃない` };
  const cool = clk - (d.t ?? clk);
  return { q: Math.round(clamp((d.q ?? 70) - Math.max(0, cool - 50) * 0.3, 0, 100)) };
}
// メニューが今注文できるか（売り切れ判定）
export function menuAvailable(st, m, clk = 0) {
  if (!m?.on) return false;
  const fx = (pred) => st.fixtures.some((f) => !f.br && pred(f));
  if (m.kind === 'ramen') {
    if (!SOUPS[m.soup] || (st.level || 1) < SOUPS[m.soup].lv) return false;
    if (!((st.stock.men || 0) > 0) || !fx((f) => FIXTURES[f.t].baskets)) return false;
    const S = SOUPS[m.soup], B = BROTHS[S.broth], T = TARES[S.tare];
    const broth = fx((f) => f.pot?.b === S.broth && f.pot.sv > 0) || ((st.stock[B.item] || 0) > 0 && fx((f) => FIXTURES[f.t].pot));
    return broth && ((st.tare?.[S.tare] || 0) > 0 || (st.stock[T.raw] || 0) > 0);
  }
  const S = SIDES[m.side]; if (!S || (st.level || 1) < S.lv) return false;
  if (m.side === 'rice' || m.side === 'chadon') {
    const ok = fx((f) => f.t === 'rice' && f.rc && f.rc.sv > 0) || ((st.stock.kome || 0) > 0 && fx((f) => f.t === 'rice'));
    if (m.side === 'chadon') return ok && ((st.prep.chashu || 0) > 0 || (st.stock.chashu || 0) > 0);
    return ok;
  }
  if (m.side === 'beer') return fx((f) => f.t === 'beer') && ((st.prep.beer || 0) > 0 || (st.stock.taru || 0) > 0);
  if (m.side === 'gyoza') return fx((f) => FIXTURES[f.t].griddle === 'gyoza') && (st.stock.gyozaF || 0) >= GRIDDLE.gyoza.use;
  if (m.side === 'karaage') return fx((f) => FIXTURES[f.t].griddle === 'karaage') && (st.stock.chicken || 0) >= GRIDDLE.karaage.use;
  return false;
}
export function fridgeCap(st) { return st.fixtures.reduce((t, f) => t + (f.br ? 0 : FIXTURES[f.t].cap || 0), 0); }
export function fridgeUsed(st, extra = []) {
  const s = { ...st.stock };
  for (const [id, n] of extra) s[id] = (s[id] || 0) + n * (INGREDIENTS[id]?.pack || 0);
  let u = 0; for (const [id, n] of Object.entries(s)) { const p = INGREDIENTS[id]; if (p && p.space) u += Math.ceil(n / p.pack) * p.space; }
  return u;
}
export function orderCost(items) { return Math.round(items.reduce((t, [id, n]) => t + (INGREDIENTS[id]?.cost || 0) * n, 0)); }
export const orderTotal = (items) => (items.length ? orderCost(items) + SHIPPING_FEE : 0);
export function seatLabels(st) {
  const out = {}; let c = 1, t = 1;
  const list = st.fixtures.filter((f) => FIXTURES[f.t].seats).sort((a, b) => (isCounter(b.t) - isCounter(a.t)) || a.x - b.x || a.z - b.z);
  for (const f of list) {
    const n = FIXTURES[f.t].seats.length;
    out[f.id] = isCounter(f.t) ? Array.from({ length: n }, () => 'カ' + c++) : Array.from({ length: n }, (_, i) => `卓${t}-${i + 1}`);
    if (!isCounter(f.t)) t++;
  }
  return out;
}

export function newDyn() { return { customers: [], staffRt: {}, deliveries: [], spawnT: 4, cid: 1, seats: {}, tq: {}, fires: [], proj: [], pid: 1, thief: null, ch: { ph: 'bet', t: CHOHAN_T.bet, bets: {}, d: [1, 1], n: 1, hist: [] } }; }

export class Sim {
  constructor(store) {
    this.store = normalizeStore(store);
    this.dyn = newDyn();
    this.clk = 0;
    this.nav = new NavGrid(); this.navC = new NavGrid();
    this.rebuildNav();
    this.events = [];
    this.players = {};
    this.criticDay = 0;
  }
  rebuildNav() { this.nav.build(this.store); this.navC.build(this.store, { noKitchen: true }); }
  bump() { this.store.rev++; }
  ev(e) { this.events.push(e); }
  toast(to, msg, kind = 'info') { this.ev({ t: 'toast', to, msg, kind }); }
  err(to, msg) { this.ev({ t: 'toast', to, msg, kind: 'err' }); this.ev({ t: 'sfx', s: 'err', to }); }
  sfx(s, x, z) { this.ev({ t: 'sfx', s, x, z }); }
  fx(id) { return this.store.fixtures.find((f) => f.id === id); }
  hand(uid) { return this.store.hand?.[uid] || null; }
  setHand(uid, hd) { this.store.hand ||= {}; if (hd) this.store.hand[uid] = hd; else delete this.store.hand[uid]; }
  get level() { return this.store.level || 1; }
  near(uid, f, r = 3.2) { if (this.requireNear === false) return true; const p = this.players[uid]; if (!p || !f) return String(uid).startsWith('s:'); return dist(p.x, p.z, f.x, f.z) < r + Math.max(FIXTURES[f.t].w, FIXTURES[f.t].d) / 2; }
  usable(uid, f) { if (!f) return false; if (f.br) { this.err(uid, `${FIXTURES[f.t].name}は壊れています（修理してね）`); return false; } return true; }
  cust(id) { return this.dyn.customers.find((c) => c.id === id); }

  // ---------- プレイヤー操作 ----------
  act(uid, a) {
    const fn = this['a_' + a?.t];
    if (!fn) return;
    try { fn.call(this, uid, a); } catch (e) { console.error('action error', a, e); }
  }
  // 食器棚：きれいな器を取る
  a_take(uid, a) {
    const st = this.store, f = this.fx(a.fid), k = a.k || 'bowl';
    if (!f || !FIXTURES[f.t].rack || !DISHES[k] || !this.near(uid, f)) return;
    if (this.hand(uid)) return this.err(uid, '手に持っている物を置いてから取ろう');
    if ((st.dish[k] || 0) <= 0) return this.err(uid, (st.dry[k] || 0) > 0 ? `${DISHES[k].name}は水切りかごにあります（洗い場から持ってきて、ここにしまおう）` : `きれいな${DISHES[k].name}がありません（洗い場で洗おう）`);
    st.dish[k]--;
    this.setHand(uid, { t: 'dish', d: { k, tp: [], t: this.clk } });
    this.sfx('pick', f.x, f.z); this.bump();
  }
  // 寸胴鍋：水を入れる → 骨などの材料・香味野菜を入れる → 火にかける → アクを取る → 丼に注ぐ
  a_water(uid, a) {
    const f = this.fx(a.fid), def = f && FIXTURES[f.t];
    if (!def?.pot || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (this.hand(uid)) return this.err(uid, '手に持っている物を置いてから');
    if (f.pot?.w > 0) return this.err(uid, 'もう水が入っています');
    const fire = f.pot?.fire || 0;
    f.pot = { w: 1, n: {}, b: null, ha: 0, hs: this.clk, sk: 0, sv: 0, used: 0, fire, off: this.clk, dry: null };
    this.sfx('pour', f.x, f.z); this.bump();
  }
  a_potAdd(uid, a) {
    const st = this.store, f = this.fx(a.fid), def = f && FIXTURES[f.t], id = a.id, I = INGREDIENTS[id];
    if (!def?.pot || !I || I.cat !== 'soup' || !this.usable(uid, f) || !this.near(uid, f)) return;
    const P = f.pot; if (!(P?.w > 0)) return this.err(uid, '先に水を入れよう');
    if (P.used > 0) return this.err(uid, '使いはじめた鍋には足せません（空になったら炊き直そう）');
    if (!ingUnlocked(id, this.level)) return;
    if (!((st.stock[id] || 0) > 0)) return this.err(uid, `${I.name}がありません（パソコンで仕入れよう）`);
    const cap = def.pot.sv / POT_PER, mains = Object.entries(P.n).filter(([k]) => INGREDIENTS[k]?.broth).reduce((t, [, v]) => t + v, 0);
    if (I.broth && mains >= cap) return this.err(uid, `この鍋に入る骨などの材料は${cap}つまで（1つで${POT_PER}杯分）`);
    if (!I.broth && (P.n[id] || 0) >= 2) return this.err(uid, `${I.name}はもう十分入っています`);
    st.stock[id]--; if (!st.stock[id]) delete st.stock[id];
    potCommit(P, this.clk);
    P.n[id] = (P.n[id] || 0) + 1;
    const nb = potBroth(P);
    if (nb !== P.b) { if (P.b) { P.ha = Math.min(P.ha, 8); P.sk = 0; } P.b = nb; }
    P.sv = potServings(P, def);
    this.sfx('splash', f.x, f.z); this.bump();
  }
  a_fire(uid, a) {
    const f = this.fx(a.fid), def = f && FIXTURES[f.t]; if (!def?.pot || !this.near(uid, f)) return;
    if (!f.pot) f.pot = { w: 0, n: {}, b: null, ha: 0, hs: this.clk, sk: 0, sv: 0, used: 0, fire: 0, off: this.clk, dry: null };
    const P = f.pot; potCommit(P, this.clk);
    P.fire = P.fire ? 0 : 1; P.off = this.clk; P.hs = this.clk; P.dry = P.fire && !(P.w > 0) ? this.clk : null;
    if (P.fire && !(P.w > 0)) this.err(uid, '⚠ 水が入っていません！空焚きは火事のもと');
    this.sfx('click', f.x, f.z); this.bump();
  }
  a_skim(uid, a) {
    const f = this.fx(a.fid), P = f?.pot; if (!P?.b || !this.near(uid, f)) return;
    const B = BROTHS[P.b], gen = Math.min(1, AKU_RATE * Math.min(potHeat(P, this.clk), B.ready + 70));
    P.sk = Math.min(gen, (P.sk || 0) + clamp(+a.dur || 0.13, 0.02, 0.4) * 0.9);
    if (Math.random() < 0.3) this.sfx('pour', f.x, f.z);
    this.bump();
  }
  a_soupDump(uid, a) {
    const f = this.fx(a.fid); if (!f?.pot) return;
    const fire = f.pot.fire; f.pot = fire ? { w: 0, n: {}, b: null, ha: 0, hs: this.clk, sk: 0, sv: 0, used: 0, fire, off: this.clk, dry: this.clk } : null;
    this.sfx('trash', f.x, f.z); this.bump();
  }
  a_soupPour(uid, a) {
    const f = this.fx(a.fid), hd = this.hand(uid);
    if (!f?.pot || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (hd?.t !== 'dish' || hd.d.k !== 'bowl') return this.err(uid, 'ラーメン丼を持ってこよう（食器棚）');
    if (hd.d.broth) return this.err(uid, 'もうスープが入っています');
    if (!potReady(f, this.clk)) return this.err(uid, !f.pot.b ? 'まだだしの材料が入っていません' : f.pot.sv <= 0 ? 'だしがなくなりました' : 'まだだしが炊けていません');
    const P = f.pot;
    hd.d.broth = P.b; hd.d.sq = soupQuality(f, this.clk); hd.d.soup = soupOf(P.b, hd.d.tare); hd.d.t = this.clk;
    P.sv--; P.used = (P.used || 0) + 1;
    if (P.sv <= 0) { potCommit(P, this.clk); P.w = 0; if (P.fire) P.dry = this.clk; this.toast(uid, '🍲 寸胴鍋が空になりました（火を止めて、水を入れて炊き直そう）', 'warn'); }
    this.sfx('pour', f.x, f.z); this.bump();
  }
  // 茹で麺機
  a_noodleIn(uid, a) {
    const st = this.store, f = this.fx(a.fid), def = f && FIXTURES[f.t];
    if (!def?.baskets || !this.usable(uid, f) || !this.near(uid, f)) return;
    let bi = a.bi ?? -1;
    if (bi < 0 || f.bk[bi]) bi = f.bk.findIndex((x) => !x);
    if (bi < 0) return this.err(uid, 'てぼがいっぱいです');
    if (!((st.stock.men || 0) > 0)) return this.err(uid, '生麺がありません（パソコンで仕入れよう）');
    st.stock.men--; if (!st.stock.men) delete st.stock.men;
    f.bk[bi] = { t0: this.clk };
    this.sfx('splash', f.x, f.z); this.bump();
  }
  // てぼを選ぶ（指定がなければいちばん長く茹でている麺）
  _basket(f, bi) { if (bi == null || bi < 0 || !f.bk[bi]) { let best = -1, bt = -1; f.bk.forEach((x, i) => { if (x && this.clk - x.t0 > bt) { bt = this.clk - x.t0; best = i; } }); bi = best; } return bi; }
  _bowlForNoodle(uid) {
    const hd = this.hand(uid);
    if (hd?.t !== 'dish' || hd.d.k !== 'bowl') { this.err(uid, 'タレとスープを入れた丼を持って湯切りしよう'); return null; }
    if (!hd.d.broth) { this.err(uid, '先に丼にタレとスープを入れよう'); return null; }
    if (hd.d.men != null) { this.err(uid, 'もう麺が入っています'); return null; }
    return hd;
  }
  _noodleInto(uid, f, bi, wet) {
    const hd = this.hand(uid), b = f.bk[bi];
    hd.d.men = Math.round((this.clk - b.t0) * 10) / 10; hd.d.wet = +clamp(wet, 0, 1).toFixed(2);
    f.bk[bi] = null;
    this.ev({ t: 'yugiri', who: uid, x: f.x, z: f.z, sec: hd.d.men, wet: hd.d.wet });
    this.sfx('splash', f.x, f.z); this.bump();
  }
  // 湯切り（長押し）：てぼを上げて振って水を切る。切りきったら丼へ
  a_drain(uid, a) {
    const f = this.fx(a.fid); if (!f?.bk || !this.near(uid, f)) return;
    const bi = this._basket(f, a.bi); if (bi < 0 || !f.bk[bi]) return this.err(uid, '茹でている麺がありません');
    if (!this._bowlForNoodle(uid)) return;
    const b = f.bk[bi]; b.dr = (b.dr || 0) + clamp(+a.dur || 0.13, 0.02, 0.4) / DRAIN_T; b.dt = this.clk;
    if (Math.random() < 0.45) this.sfx('yugiri', f.x, f.z);
    if (b.dr >= 1) this._noodleInto(uid, f, bi, 0); else this.bump();
  }
  // 湯切りせずに入れる（水っぽくなる）
  a_noodleOut(uid, a) {
    const f = this.fx(a.fid); if (!f?.bk || !this.near(uid, f)) return;
    const bi = this._basket(f, a.bi); if (bi < 0 || !f.bk[bi]) return this.err(uid, '茹でている麺がありません');
    if (!this._bowlForNoodle(uid)) return;
    this._noodleInto(uid, f, bi, 1 - (f.bk[bi].dr || 0));
  }
  a_noodleDump(uid, a) {
    const f = this.fx(a.fid); if (!f?.bk) return;
    const bi = a.bi ?? f.bk.findIndex(Boolean); if (bi < 0 || !f.bk[bi]) return;
    f.bk[bi] = null; this.sfx('trash', f.x, f.z); this.bump();
  }
  // トッピング台：タレ（かえし）を材料から作る → 丼に入れる
  a_tareStart(uid, a) {
    const st = this.store, f = this.fx(a.fid), T = TARES[a.k];
    if (!f || !FIXTURES[f.t].topping || !T || this.level < T.lv || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (this.hand(uid)) return this.err(uid, '手を空けてから作ろう');
    if (f.tj) return this.err(uid, 'いまタレを作っています（長押しで混ぜよう）');
    if (!((st.stock[T.raw] || 0) > 0)) return this.err(uid, `${INGREDIENTS[T.raw].name}がありません（パソコンで仕入れよう）`);
    st.stock[T.raw]--; if (!st.stock[T.raw]) delete st.stock[T.raw];
    f.tj = { k: a.k, p: 0 }; this.sfx('pour', f.x, f.z); this.bump();
  }
  a_tareMix(uid, a) {
    const st = this.store, f = this.fx(a.fid); if (!f?.tj || !this.near(uid, f)) return;
    f.tj.p += clamp(+a.dur || 0.13, 0.02, 0.4) / TARE_MIX;
    if (Math.random() < 0.3) this.sfx('pour', f.x, f.z);
    if (f.tj.p >= 1) { const T = TARES[f.tj.k]; st.tare[f.tj.k] = (st.tare[f.tj.k] || 0) + T.per; this.toast(uid, `🫙 ${T.name}ができました（${T.per}杯分）`, 'ok'); f.tj = null; this.sfx('ding', f.x, f.z); }
    this.bump();
  }
  a_tareIn(uid, a) {
    const st = this.store, f = this.fx(a.fid), hd = this.hand(uid), T = TARES[a.k];
    if (!f || !FIXTURES[f.t].topping || !T || !this.near(uid, f)) return;
    if (hd?.t !== 'dish' || hd.d.k !== 'bowl') return this.err(uid, 'ラーメン丼を持ってこよう（食器棚）');
    if (hd.d.tare) return this.err(uid, 'もうタレが入っています');
    if (!((st.tare[a.k] || 0) > 0)) return this.err(uid, `${T.name}がありません（トッピング台で作ろう）`);
    st.tare[a.k]--; if (!st.tare[a.k]) delete st.tare[a.k];
    hd.d.tare = a.k; hd.d.soup = soupOf(hd.d.broth, a.k); if (!hd.d.broth) hd.d.t = this.clk;
    this.sfx('pour', f.x, f.z); this.bump();
  }
  // トッピング台：丼にのせる
  a_top(uid, a) {
    const st = this.store, hd = this.hand(uid), T = TOPPINGS[a.tid];
    if (!T || hd?.t !== 'dish') return;
    const f = this.fx(a.fid) || st.fixtures.find((o) => FIXTURES[o.t].topping && this.near(uid, o, 3));
    if (!f || !FIXTURES[f.t].topping || !this.near(uid, f, 3.5)) return this.err(uid, 'トッピング台の前でのせよう');
    const d = hd.d;
    if (!(d.k === 'bowl' && d.broth) && !(d.k === 'bowlS' && d.side === 'rice')) return this.err(uid, 'スープを入れた丼（またはライス）にのせよう');
    if ((d.tp ||= []).includes(a.tid)) return;
    if (d.tp.length >= TOP_MAX) return this.err(uid, `トッピングは${TOP_MAX}種類まで`);
    if (!((st.prep[a.tid] || 0) > 0)) return this.err(uid, `${T.name}の仕込みがありません（まな板で仕込もう）`);
    st.prep[a.tid]--; if (!st.prep[a.tid]) delete st.prep[a.tid];
    d.tp.push(a.tid);
    this.sfx('top', f.x, f.z); this.bump();
  }
  // まな板：仕込み（長押し）
  a_chop(uid, a) {
    const st = this.store, f = this.fx(a.fid);
    if (!f || !FIXTURES[f.t].board || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (this.hand(uid)) return this.err(uid, '手に何も持たずに仕込もう');
    if (!f.job) {
      const T = TOPPINGS[a.tid]; if (!T || this.level < T.lv) return;
      if (!((st.stock[T.raw] || 0) > 0)) return this.err(uid, `${INGREDIENTS[T.raw].name}がありません（仕入れよう）`);
      st.stock[T.raw]--; if (!st.stock[T.raw]) delete st.stock[T.raw];
      f.job = { tid: a.tid, p: 0, by: uid };
    }
    const T = TOPPINGS[f.job.tid];
    f.job.p = Math.min(1, f.job.p + clamp(+a.dur || 0.13, 0.02, 0.4) / T.prep);
    f.job.by = uid;
    if (Math.random() < 0.5) this.sfx('chop', f.x, f.z);
    if (f.job.p >= 1) {
      st.prep[f.job.tid] = (st.prep[f.job.tid] || 0) + T.per;
      this.toast(uid, `🔪 ${T.icon}${T.name}を${T.per}人前 仕込みました（いま${st.prep[f.job.tid]}人前）`, 'ok');
      f.job = null; this.sfx('ding', f.x, f.z);
    }
    this.bump();
  }
  a_chopCancel(uid, a) { const f = this.fx(a.fid); if (f?.job) { const T = TOPPINGS[f.job.tid]; this.store.stock[T.raw] = (this.store.stock[T.raw] || 0) + 1; f.job = null; this.bump(); } }
  // 洗い場
  a_dirtyPut(uid, a) {
    const st = this.store, f = this.fx(a.fid), hd = this.hand(uid);
    if (!f || !FIXTURES[f.t].sink || hd?.t !== 'dirty') return;
    for (const k of hd.a) st.dirty[k] = (st.dirty[k] || 0) + 1;
    this.setHand(uid, null); this.sfx('dish', f.x, f.z); this.bump();
  }
  // 洗う（長押し）：シンクの食器を1つずつ洗って、水切りかごに並べる
  a_wash(uid, a) {
    const st = this.store, f = this.fx(a.fid);
    if (!f || !FIXTURES[f.t].sink || !this.usable(uid, f) || !this.near(uid, f)) return;
    const k = Object.keys(DISHES).find((x) => st.dirty[x] > 0);
    if (!k) return;
    if (dryCount(st) >= DRY_MAX) return this.err(uid, '水切りかごがいっぱいです（洗った食器を食器棚にしまおう）');
    f.wp = (f.wp || 0) + clamp(+a.dur || 0.13, 0.02, 0.4) / WASH_T; f.wk = k;
    if (Math.random() < 0.4) this.sfx('wash', f.x, f.z);
    if (f.wp >= 1) { f.wp = 0; st.dirty[k]--; st.dry[k] = (st.dry[k] || 0) + 1; this.sfx('dish', f.x, f.z); }
    this.bump();
  }
  // 水切りかごの洗った食器を持つ（5個まで）
  a_dryTake(uid, a) {
    const st = this.store, f = this.fx(a.fid); if (!f || !FIXTURES[f.t].sink || !this.near(uid, f)) return;
    const hd = this.hand(uid); if (hd && hd.t !== 'clean') return this.err(uid, '手を空けてから');
    const arr = hd?.a?.slice() || [];
    for (const k of Object.keys(DISHES)) while ((st.dry[k] || 0) > 0 && arr.length < DIRTY_MAX) { st.dry[k]--; arr.push(k); }
    if (!arr.length || arr.length === hd?.a?.length) return this.err(uid, '水切りかごに食器がありません');
    this.setHand(uid, { t: 'clean', a: arr }); this.sfx('dish', f.x, f.z); this.bump();
  }
  // 食器棚にしまう
  a_rackPut(uid, a) {
    const st = this.store, f = this.fx(a.fid), hd = this.hand(uid);
    if (!f || !FIXTURES[f.t].rack || hd?.t !== 'clean' || !this.near(uid, f)) return;
    for (const k of hd.a) st.dish[k] = (st.dish[k] || 0) + 1;
    this.setHand(uid, null); this.sfx('dish', f.x, f.z); this.bump();
  }
  // 下げた食器をシンクに投げ入れる（遠いと割れる・お客さんに当たると怒られる）
  a_dirtyThrow(uid, a) {
    const st = this.store, f = this.fx(a.fid), hd = this.hand(uid), p = this.players[uid];
    if (!f || !FIXTURES[f.t].sink || hd?.t !== 'dirty' || !p) return;
    const d = dist(p.x, p.z, f.x, f.z); if (d > 8) return this.err(uid, '遠すぎて届きません');
    this.setHand(uid, null);
    const seg = (c) => { const vx = f.x - p.x, vz = f.z - p.z, L = vx * vx + vz * vz || 1, t = clamp(((c.x - p.x) * vx + (c.z - p.z) * vz) / L, 0, 1); return dist(c.x, c.z, p.x + vx * t, p.z + vz * t); };
    const hit = this.dyn.customers.find((c) => c.st !== 'out' && seg(c) < 0.42 && dist(c.x, c.z, p.x, p.z) > 0.5);
    this.ev({ t: 'dishfly', x0: p.x, z0: p.z, x1: hit ? hit.x : f.x, z1: hit ? hit.z : f.z, y1: hit ? 1.55 : 0.95, a: hd.a });
    this.sfx('throw', p.x, p.z);
    if (hit) {
      this.toast(null, '🤕 投げた食器がお客さんの頭に当たった！ 食器は割れて、お客さんは怒って帰ってしまった…', 'err');
      this.sfx('dish', hit.x, hit.z); hit.why = 'dish'; this.bubble(hit, 'hurt'); this.leave(hit, true); st.rep = Math.max(0, st.rep - 3);
      this.bump(); return;
    }
    let broke = 0; const pBreak = clamp((d - 2.5) / 12, 0, 0.45);
    for (const k of hd.a) { if (Math.random() < pBreak) broke++; else st.dirty[k] = (st.dirty[k] || 0) + 1; }
    this.toast(uid, broke ? `💥 シンクに投げ入れた…けど${broke}個割れた` : '🎯 シンクにナイスシュート！', broke ? 'warn' : 'ok');
    this.sfx('dish', f.x, f.z); this.bump();
  }
  a_trash(uid) {
    const st = this.store, hd = this.hand(uid);
    if (hd?.t !== 'dish') return;
    if (dishEmpty(hd.d)) st.dish[hd.d.k]++; else st.dirty[hd.d.k]++;
    this.setHand(uid, null); this.sfx('trash'); this.bump();
  }
  a_handBack(uid) {
    const hd = this.hand(uid);
    if (!hd) return;
    if (hd.t === 'dish') { if (dishEmpty(hd.d)) { this.store.dish[hd.d.k]++; this.setHand(uid, null); this.bump(); } return; }
    if (hd.t === 'ext' || hd.t === 'shuri') { this.setHand(uid, null); this.bump(); }
  }
  // 炊飯器
  a_riceStart(uid, a) {
    const st = this.store, f = this.fx(a.fid);
    if (f?.t !== 'rice' || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (f.rc && f.rc.sv > 0) return this.err(uid, 'まだごはんが残っています');
    if (!((st.stock.kome || 0) > 0)) return this.err(uid, '米がありません（仕入れよう）');
    st.stock.kome--; if (!st.stock.kome) delete st.stock.kome;
    f.rc = { t0: this.clk, sv: FIXTURES.rice.rice.sv };
    this.sfx('click', f.x, f.z); this.bump();
  }
  a_riceServe(uid, a) {
    const f = this.fx(a.fid), hd = this.hand(uid);
    if (f?.t !== 'rice' || !this.near(uid, f)) return;
    if (!f.rc || f.rc.sv <= 0) return this.err(uid, 'ごはんがありません（米を入れて炊こう）');
    if (this.clk - f.rc.t0 < RICE_READY) return this.err(uid, 'まだ炊けていません');
    if (hd?.t !== 'dish' || hd.d.k !== 'bowlS' || hd.d.side) return this.err(uid, '空の小丼を持ってこよう（食器棚）');
    hd.d.side = 'rice'; hd.d.q = 92; hd.d.t = this.clk; f.rc.sv--;
    if (f.rc.sv <= 0) f.rc = null;
    this.sfx('pick', f.x, f.z); this.bump();
  }
  // 餃子焼き器・フライヤー
  a_grillStart(uid, a) {
    const st = this.store, f = this.fx(a.fid), G = GRIDDLE[FIXTURES[f?.t]?.griddle];
    if (!G || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (f.gr) return this.err(uid, 'いま焼いています');
    if ((st.stock[G.item] || 0) < G.use) return this.err(uid, `${INGREDIENTS[G.item].name}が足りません（仕入れよう）`);
    st.stock[G.item] -= G.use; if (!st.stock[G.item]) delete st.stock[G.item];
    f.gr = { t0: this.clk };
    this.sfx('sizzle', f.x, f.z); this.bump();
  }
  a_grillTake(uid, a) {
    const f = this.fx(a.fid), hd = this.hand(uid), type = FIXTURES[f?.t]?.griddle;
    if (!type || !f.gr || !this.near(uid, f)) return;
    if (hd?.t !== 'dish' || hd.d.k !== 'plate' || hd.d.side) return this.err(uid, '空の皿を持ってこよう（食器棚）');
    const sec = this.clk - f.gr.t0;
    hd.d.side = type; hd.d.q = griddleQ(type, sec); hd.d.burnt = sec > GRIDDLE[type].burn ? 1 : 0; hd.d.t = this.clk;
    f.gr = null;
    this.toast(uid, `${SIDES[type].icon} ${hd.d.burnt ? '焦げちゃった…' : hd.d.q >= 95 ? 'こんがりパーフェクト！' : hd.d.q >= 70 ? 'いい焼き色！' : '焼き加減がいまいち'}（${hd.d.q}点）`, hd.d.q >= 70 ? 'ok' : 'warn');
    this.sfx('pick', f.x, f.z); this.bump();
  }
  // ビールサーバー（長押しで注ぐ）
  a_pour(uid, a) {
    const st = this.store, f = this.fx(a.fid), hd = this.hand(uid);
    if (f?.t !== 'beer' || !this.usable(uid, f) || !this.near(uid, f)) return;
    if (hd?.t !== 'dish' || hd.d.k !== 'mug') return this.err(uid, 'ジョッキを持ってこよう（食器棚）');
    const d = hd.d;
    if (d.side !== 'beer') {
      if (!((st.prep.beer || 0) > 0)) { if ((st.stock.taru || 0) > 0) { st.stock.taru--; if (!st.stock.taru) delete st.stock.taru; st.prep.beer = 20; this.toast(uid, '🛢️ 新しいビール樽をつなぎました', 'ok'); } else return this.err(uid, 'ビール樽がありません（仕入れよう）'); }
      st.prep.beer--; if (!st.prep.beer) delete st.prep.beer;
      d.side = 'beer'; d.fill = 0; d.t = this.clk;
    }
    d.fill = Math.min(1.25, +(d.fill + clamp(+a.dur || 0.13, 0.02, 0.4) * 0.42).toFixed(3));
    if (Math.random() < 0.5) this.sfx('pour', f.x, f.z);
    this.bump();
  }
  // 受け渡し台
  a_passPut(uid, a) {
    const f = this.fx(a.fid), hd = this.hand(uid);
    if (!f?.ps || hd?.t !== 'dish' || !this.near(uid, f)) return;
    if (dishEmpty(hd.d)) return this.err(uid, '空の器は置けません');
    let pi = a.pi ?? -1; if (pi < 0 || f.ps[pi]) pi = f.ps.findIndex((x) => !x);
    if (pi < 0) return this.err(uid, '受け渡し台がいっぱいです');
    f.ps[pi] = hd.d; this.setHand(uid, null);
    this.sfx('place', f.x, f.z); this.bump();
  }
  a_passTake(uid, a) {
    const f = this.fx(a.fid);
    if (!f?.ps || this.hand(uid) || !this.near(uid, f)) return;
    let pi = a.pi ?? -1; if (pi < 0 || !f.ps[pi]) pi = f.ps.findIndex(Boolean);
    if (pi < 0) return;
    const d = f.ps[pi]; f.ps[pi] = null; delete d.for;
    this.setHand(uid, { t: 'dish', d });
    this.sfx('pick', f.x, f.z); this.bump();
  }
  // お客さんに出す
  a_serve(uid, a) {
    const hd = this.hand(uid);
    if (hd?.t !== 'dish') return;
    let c = a.cid != null ? this.cust(a.cid) : null;
    if (!c && a.fid != null) c = this.dyn.customers.find((o) => o.seat && o.seat[0] === a.fid && o.seat[1] === a.si);
    if (!c || !['seated', 'eat'].includes(c.st)) return this.err(uid, 'そこにお客さんはいません');
    const r = this.serveTo(c, hd.d, uid);
    if (r === true) this.setHand(uid, null);
  }
  // 料理を出す：合う注文を探して点数をつける。合わなければ受け取ってもらえない
  serveTo(c, d, who) {
    let best = null;
    const tries = [];
    c.lines.forEach((l, i) => { if (l.d) return; const e = evalDish(this.store, d, l, c, this.clk); if (!e) return; tries.push(e); if (e.q != null && (!best || e.q > best.e.q)) best = { i, l, e }; });
    if (!best) {
      const why = tries.find((x) => x.ng)?.ng || '注文していない料理';
      this.bubble(c, 'ng'); c.pat -= 12; c.ngT = (c.ngT || 0) + 1;
      this.err(who, `🙅 「注文とちがう！」（${why}）`);
      return false;
    }
    best.l.d = d; best.l.q = best.e.q;
    d.t = this.clk; delete d.for;
    const st = this.store, T = st.today;
    if (best.l.k === 'ramen') { T.bowls++; st.stats.bowls++; st.totalBowls = (st.totalBowls || 0) + 1; if (!c.eatS) { c.eatS = this.clk; c.st = 'eat'; c.an = 'eat'; } } else T.sides++;
    T.qs += best.e.q; T.qn++;
    const q = best.e.q;
    this.bubble(c, q >= 90 ? 'love' : q >= 70 ? 'happy' : q >= 45 ? 'ok' : 'meh');
    if (!String(who).startsWith('s:')) {
      const miss = best.e.miss?.length ? `（${best.e.miss.map((t) => TOPPINGS[t].name).join('・')}がない）` : '';
      this.toast(who, `${q >= 90 ? '😋 うまい！' : q >= 70 ? '🙂 おいしい' : q >= 45 ? '😐 まあまあ' : '😖 いまいち…'} ${q}点${miss}${best.l.k === 'ramen' && d.men != null ? `・麺 ${d.men.toFixed(0)}秒` : ''}`, q >= 70 ? 'ok' : 'warn');
    }
    this.ev({ t: 'serve', x: c.x, z: c.z, q, who });
    this.sfx('serve', c.x, c.z); this.bump();
    return true;
  }
  // 席の食器を下げる
  a_clear(uid, a) {
    const f = this.fx(a.fid), hd = this.hand(uid);
    if (!f?.dd || !this.near(uid, f, 3)) return;
    const list = a.si != null ? [a.si] : f.dd.map((_, i) => i);
    let got = 0;
    for (const si of list) {
      const dd = f.dd[si]; if (!dd?.length) continue;
      const cur = this.hand(uid);
      if (cur && cur.t !== 'dirty') return this.err(uid, '手に持っている物を置いてから下げよう');
      const stack = cur || { t: 'dirty', a: [] };
      while (dd.length && stack.a.length < DIRTY_MAX) { stack.a.push(dd.pop()); got++; }
      this.setHand(uid, stack);
      if (stack.a.length >= DIRTY_MAX) break;
    }
    if (!got) { if (hd?.t === 'dirty' && hd.a.length >= DIRTY_MAX) this.err(uid, `一度に${DIRTY_MAX}個まで（洗い場に置こう）`); return; }
    this.sfx('dish', f.x, f.z); this.bump();
  }
  // 消火器・手裏剣
  a_takeTool(uid, a) {
    const f = this.fx(a.fid); if (!f || !this.near(uid, f)) return;
    if (this.hand(uid)) return this.err(uid, '手に持っている物を置いてから持とう');
    if (f.t === 'ext') this.setHand(uid, { t: 'ext', u: 1 });
    else if (f.t === 'shuriken') this.setHand(uid, { t: 'shuri', n: 8 });
    else return;
    this.sfx('pick', f.x, f.z); this.bump();
  }
  a_spray(uid, a) {
    const hd = this.hand(uid);
    if (hd?.t !== 'ext') return;
    const dur = clamp(+a.dur || 0.15, 0.02, 0.4), ang = +a.a || 0, x = +a.x || 0, z = +a.z || 0;
    hd.u = +(hd.u - dur * 0.1).toFixed(3);
    const fx = Math.sin(ang), fz = Math.cos(ang);
    let hit = false;
    for (const fr of this.dyn.fires) {
      const f = this.fx(fr.fid); if (!f) continue;
      const dx = f.x - x, dz = f.z - z, d = Math.hypot(dx, dz);
      if (d > 3.4) continue;
      if (d > 0.6 && (dx * fx + dz * fz) / d < 0.55) continue;
      fr.v -= dur * 5.2; hit = true;
    }
    if (hit) this.cleanFires(uid);
    this.ev({ t: 'spray', x, z, tx: x + fx * 3, tz: z + fz * 3, who: uid, n: 10 });
    if (hd.u <= 0.001) { this.setHand(uid, null); this.toast(uid, '🧯 消火器が空になりました（もう1本持ってこよう）', 'warn'); }
    this.bump();
  }
  cleanFires(who) {
    const before = this.dyn.fires.length;
    this.dyn.fires = this.dyn.fires.filter((fr) => fr.v > 0);
    if (this.dyn.fires.length < before) { this.store.stats.fires++; this.toast(null, '🧯 火を消しました！', 'ok'); this.sfx('steam'); void who; }
  }
  a_throw(uid, a) {
    const hd = this.hand(uid);
    if (hd?.t !== 'shuri') return;
    hd.n--;
    const ang = +a.a || 0;
    this.dyn.proj.push({ id: this.dyn.pid++, x: +a.x || 0, z: +a.z || 0, y: 1.35, vx: Math.sin(ang) * 17, vz: Math.cos(ang) * 17, t: 0.75, by: uid });
    if (hd.n <= 0) this.setHand(uid, null);
    this.sfx('throw', a.x, a.z); this.bump();
  }
  // 券売機のお金を回収（泥棒に盗まれないように）
  // レジ：金庫にしまう・お金をつかむ・お金を戻す
  _reg(uid, a) { const f = this.fx(a.fid); return f && (f.t === 'register' || f.t === 'ticket') && this.near(uid, f) ? f : null; }
  a_collect(uid, a) {
    const f = this._reg(uid, a); if (!f) return;
    const v = this.store.till; if (v <= 0) return;
    this.store.till = 0;
    this.toast(null, `💴 レジのお金 ¥${v.toLocaleString()} を金庫にしまいました`, 'money');
    this.sfx('cash', f.x, f.z); this.bump();
  }
  a_cashTake(uid, a) {
    const st = this.store, f = this._reg(uid, a), hd = this.hand(uid), v = Math.round(+a.v || 0), safe = a.src === 'safe';
    if (!f) return;
    if (hd && hd.t !== 'cash') return this.err(uid, '手に持っている物を置いてから');
    const have = safe ? Math.max(0, st.money - st.till) : st.till;
    if (!(v > 0) || v > have) return this.err(uid, safe ? '金庫にそんなにお金がありません' : 'レジにそんなにお金がありません');
    if (!safe) st.till -= v;
    st.money -= v;
    this.setHand(uid, { t: 'cash', v: (hd?.v || 0) + v });
    this.sfx('cash', f.x, f.z); this.bump();
  }
  a_cashBack(uid, a) {
    const st = this.store, f = this._reg(uid, a), hd = this.hand(uid);
    if (!f || hd?.t !== 'cash') return;
    st.money += hd.v; st.till += hd.v;
    this.toast(uid, `💴 ¥${hd.v.toLocaleString()} をレジに戻しました`, 'money');
    this.setHand(uid, null); this.sfx('cash', f.x, f.z); this.bump();
  }
  // 手持ちのお金をふやす（勝ったとき）。手がふさがっていればレジに入れる
  giveCash(uid, v) {
    const st = this.store, hd = this.hand(uid); if (!(v > 0)) return;
    if (this.players[uid] && (!hd || hd.t === 'cash')) this.setHand(uid, { t: 'cash', v: (hd?.v || 0) + v });
    else { st.money += v; st.till += v; }
  }
  a_repair(uid, a) {
    const st = this.store, f = this.fx(a.fid); if (!f?.br) return;
    const cost = repairCost(f);
    if (st.money < cost) return this.err(uid, 'お金が足りません');
    st.money -= cost; st.today.repair += cost; f.br = 0;
    this.toast(null, `🔧 ${FIXTURES[f.t].name}を修理しました（−¥${cost.toLocaleString()}）`, 'ok');
    this.sfx('build', f.x, f.z); this.bump();
  }
  // ---------- 仕入れ（ドローンで冷蔵庫へ直接届く） ----------
  a_order(uid, a) {
    const st = this.store;
    const items = (Array.isArray(a.items) ? a.items : []).map(([id, n]) => [id, clamp(n | 0, 0, ORDER_MAX)]).filter(([id, n]) => n > 0 && ingUnlocked(id, this.level));
    if (!items.length) return;
    if (items.reduce((t, x) => t + x[1], 0) > ORDER_MAX) return this.err(uid, `1回で${ORDER_MAX}パックまで`);
    const food = items.filter(([id]) => INGREDIENTS[id].space);
    if (food.length) {
      const cap = fridgeCap(st), coming = this.dyn.deliveries.flatMap((d) => d.items);
      if (!cap) return this.err(uid, '冷蔵庫がありません');
      if (fridgeUsed(st, [...coming, ...food]) > cap) return this.err(uid, `冷蔵庫に入りきりません（${fridgeUsed(st, coming)}/${cap}パック）`);
    }
    const cost = orderTotal(items);
    if (cost > st.money) return this.err(uid, 'お金が足りません');
    st.money -= cost; st.today.orders += cost - SHIPPING_FEE; st.today.ship += SHIPPING_FEE;
    this.dyn.deliveries.push({ t: DELIVERY_SEC, items });
    this.toast(null, `🚁 注文しました！ドローンが${DELIVERY_SEC}秒くらいで勝手口に届けます（¥${cost.toLocaleString()}）`, 'ok');
    this.sfx('drone'); this.bump();
  }
  deliver(items) {
    const st = this.store;
    for (const [id, n] of items) {
      const p = INGREDIENTS[id]; if (!p) continue;
      if (p.dish) st.dish[p.dish] = (st.dish[p.dish] || 0) + n * p.pack;
      else st.stock[id] = (st.stock[id] || 0) + n * p.pack;
    }
    this.toast(null, '📦 ドローンが食材を届けました！冷蔵庫・食器棚に入っています', 'ok');
    this.ev({ t: 'drone' }); this.sfx('drop'); this.bump();
  }
  // ---------- メニュー ----------
  a_menuSave(uid, a) {
    const st = this.store, m = a.m || {};
    const soup = SOUPS[m.soup]; if (!soup || this.level < soup.lv) return this.err(uid, 'そのスープはまだ使えません');
    const tp = [...new Set((m.tp || []).filter((t) => TOPPINGS[t] && this.level >= TOPPINGS[t].lv))].slice(0, TOP_MAX);
    const name = String(m.name || '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 14) || `${soup.name}ラーメン`;
    const price = clamp(Math.round((+m.price || 800) / 10) * 10, 100, 9990);
    let cur = st.menu.find((x) => x.id === m.id && x.kind === 'ramen');
    if (!cur) {
      if (st.menu.filter((x) => x.kind === 'ramen').length >= MENU_RAMEN_MAX(this.level)) return this.err(uid, `ラーメンのメニューはいま${MENU_RAMEN_MAX(this.level)}品までです`);
      cur = { id: 'm' + st.nid++, kind: 'ramen', on: true }; st.menu.push(cur);
    }
    Object.assign(cur, { name, soup: m.soup, tp, price });
    this.toast(null, `📜 メニュー「${name}」¥${price.toLocaleString()} を保存しました`, 'ok'); this.sfx('click'); this.bump();
  }
  a_menuDel(uid, a) {
    const st = this.store, m = st.menu.find((x) => x.id === a.id); if (!m) return;
    if (m.kind === 'ramen' && st.menu.filter((x) => x.kind === 'ramen').length <= 1) return this.err(uid, 'ラーメンのメニューは1つは必要です');
    st.menu = st.menu.filter((x) => x !== m); this.bump();
  }
  a_menuOn(uid, a) {
    const st = this.store;
    let m = st.menu.find((x) => x.id === a.id);
    if (!m && SIDES[a.id]) { if (this.level < SIDES[a.id].lv) return; m = { id: a.id, kind: 'side', side: a.id, price: SIDES[a.id].price, on: false }; st.menu.push(m); }
    if (!m) return;
    m.on = !!a.on;
    if (a.price != null) m.price = clamp(Math.round((+a.price || 0) / 10) * 10, 50, 9990);
    this.bump();
  }
  // ---------- 設備（建築） ----------
  a_buy(uid, a) {
    const st = this.store, def = FIXTURES[a.ft];
    if (!def || def.fixed || !fixtureUnlocked(a.ft, this.level)) return;
    if (def.price > st.money) return this.err(uid, 'お金が足りません');
    const count = (t) => st.fixtures.filter((f) => f.t === t).length + st.crates.filter((c) => c.ft === t).length;
    if (a.ft === 'ticket' && count('ticket') >= ticketLimit(this.level)) return this.err(uid, `券売機はいま${ticketLimit(this.level)}台までです`);
    st.money -= def.price;
    st.crates.push({ id: st.nid++, ft: a.ft, loc: crateSpot(st), drop: 1 });
    this.toast(uid, `📦 ${def.icon} ${def.name}が大きい段ボールで店の前に届きます！持って、置きたい場所で「ここに置く」`, 'ok');
    this.sfx('truck'); this.bump();
  }
  heldCrate(who) { return this.store.crates.find((c) => c.loc.t === 'h' && c.loc.who === who); }
  a_cratePick(uid, a) {
    if (this.heldCrate(uid)) return;
    if (this.hand(uid)) return this.err(uid, '手に持っている物を置いてから持とう');
    const c = this.store.crates.find((o) => o.id === a.cid); if (!c || c.loc.t === 'h') return;
    c.loc = { t: 'h', who: uid }; delete c.drop; this.sfx('pick'); this.bump();
  }
  a_crateDrop(uid, a) {
    const c = this.heldCrate(uid); if (!c) return;
    c.loc = { t: 'f', x: clamp(+a.x || 0, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX), y: 0, z: clamp(+a.z || 0, PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ), ry: +a.ry || 0 };
    this.sfx('place'); this.bump();
  }
  a_unpack(uid, a) {
    const st = this.store, c = this.heldCrate(uid); if (!c) return;
    const r = a.r & 3, ok = this.canPlaceFixture(c.ft, a.x, a.z, r, null);
    if (ok !== true) return this.err(uid, ok);
    const f = { id: st.nid++, t: c.ft, x: a.x, z: a.z, r }; initState(f);
    st.fixtures.push(f); st.crates = st.crates.filter((o) => o !== c);
    this.rebuildNav();
    this.toast(uid, `🔨 ${FIXTURES[c.ft].icon} ${FIXTURES[c.ft].name}を置きました！`, 'ok');
    this.sfx('build', a.x, a.z); this.bump();
  }
  a_crateReturn(uid, a) {
    const st = this.store, c = st.crates.find((o) => o.id === a.cid);
    if (!c || (c.loc.t === 'h' && c.loc.who !== uid)) return;
    st.crates = st.crates.filter((o) => o !== c); st.money += FIXTURES[c.ft]?.price || 0;
    this.sfx('coin'); this.bump();
  }
  busyFixture(f) {
    if (f.pot && f.pot.sv > 0) return 'スープが入っている寸胴鍋は動かせません（捨ててから）';
    if (f.bk?.some(Boolean)) return '麺を茹でている間は動かせません';
    if (f.gr) return '焼いている間は動かせません';
    if (f.ps?.some(Boolean)) return '受け渡し台に料理がのっています';
    if (f.dd?.some((x) => x.length)) return '食器が残っている席は動かせません（下げてから）';
    if (this.dyn.seats[f.id]?.some(Boolean)) return 'お客さんが座っています';
    if (this.dyn.fires.some((x) => x.fid === f.id)) return '燃えています！';
    return null;
  }
  a_move(uid, a) {
    const f = this.fx(a.fid); if (!f || FIXTURES[f.t].fixed) return;
    const busy = this.busyFixture(f); if (busy) return this.err(uid, busy);
    const r = a.r & 3, ok = this.canPlaceFixture(f.t, a.x, a.z, r, f.id);
    if (ok !== true) return this.err(uid, ok);
    f.x = a.x; f.z = a.z; f.r = r;
    this.rebuildNav(); this.sfx('build', a.x, a.z); this.bump();
  }
  a_sell(uid, a) {
    const f = this.fx(a.fid); if (!f || FIXTURES[f.t].fixed) return;
    const busy = this.busyFixture(f); if (busy) return this.err(uid, busy);
    delete this.dyn.seats[f.id]; delete this.dyn.tq[f.id];
    this.store.fixtures = this.store.fixtures.filter((o) => o !== f);
    this.store.money += Math.floor(FIXTURES[f.t].price / 2);
    this.rebuildNav(); this.sfx('cash'); this.bump();
  }
  canPlaceFixture(t, x, z, r, ignoreId) {
    const def = FIXTURES[t], st = this.store;
    const fp = fixtureFootprint(t, x, z, r), eps = 0.01, zs = zones(st);
    for (let cx = fp.minX + CELL / 2; cx < fp.maxX; cx += CELL) for (let cz = fp.minZ + CELL / 2; cz < fp.maxZ; cz += CELL) {
      const zone = zs.find((zn) => cx > zn.minX && cx < zn.maxX && cz > zn.minZ && cz < zn.maxZ);
      if (!zone) return '買ってある区画の中にしか置けません';
      if (zone.kind === 'hall') return '賭場には置けません';
      if (def.place === 'kitchen' && zone.kind !== 'kitchen') return 'これは厨房（カウンターの奥）にしか置けません';
      if (def.place === 'dining' && zone.kind !== 'dining') return 'これは客席（カウンターの手前）にしか置けません';
    }
    const hit = (o) => fp.minX < o.maxX - eps && fp.maxX > o.minX + eps && fp.minZ < o.maxZ - eps && fp.maxZ > o.minZ + eps;
    if (getWalls(st).some(hit)) return '壁と重なっています';
    if (!def.air && keepClear().some(hit)) return '入口・厨房の通り道・勝手口には置けません';
    for (const f of st.fixtures) {
      if (f.id === ignoreId) continue;
      if (!!FIXTURES[f.t]?.air !== !!def.air) continue;
      if (hit(fixtureFootprint(f.t, f.x, f.z, f.r))) return '他の設備と重なっています';
    }
    if (t === 'ticket' && ignoreId == null && st.fixtures.filter((f) => f.t === 'ticket').length >= ticketLimit(st.level || 1)) return '券売機はこれ以上置けません';
    return true;
  }
  a_text(uid, a) { const f = this.fx(a.fid); if (!f || !FIXTURES[f.t].text) return; f.tx = String(a.v || '').slice(0, 24); if (a.c) f.c = String(a.c).slice(0, 9); this.bump(); }
  a_storeName(uid, a) { this.store.name = String(a.v || '').slice(0, 16) || 'ラーメン一番'; if (a.c) this.store.color = String(a.c).slice(0, 9); this.bump(); }
  a_expand(uid, a) {
    const st = this.store, t = expandTargets(st).find((x) => x.id === (a.id | 0));
    if (!t) return;
    if (!t.can) return this.err(uid, 'いまのお店のとなりの列から広げてください');
    if (st.money < t.cost) return this.err(uid, 'お金が足りません');
    st.money -= t.cost; st.cols[t.id] = 1;
    st.fixtures.push(counterFixture(st, t.id));
    this.rebuildNav();
    this.toast(null, '🧱 お店を広げました！厨房・カウンター席・客席が増えました', 'ok');
    this.sfx('build'); this.bump();
  }
  a_open() {
    const st = this.store;
    if (st.phase === 'prep') { st.phase = 'open'; this.toast(null, '🏮 のれんを出しました！営業中', 'ok'); this.sfx('bell'); this.criticDay = this.level >= 5 && Math.random() < 0.4 ? rand(OPEN_TIME + 90, closeTime() - 120) : 0; }
    else if (st.phase === 'open') { st.phase = 'closing'; this.toast(null, '🔴 のれんをしまいました。残りのお客さんが帰ったら1日が終わります'); this.sfx('click'); }
    this.bump();
  }
  a_nextDay() {
    const st = this.store;
    if (st.phase !== 'summary') return;
    st.phase = 'prep'; st.day++; st.time = OPEN_TIME; st.today = newToday(); st.till = Math.min(Math.max(0, st.money), FLOAT_CASH);
    this.dyn.customers = []; this.dyn.seats = {}; this.dyn.tq = {}; this.dyn.thief = null; this.dyn.fires = []; this.dyn.proj = [];
    this.ev({ t: 'newday', day: st.day }); this.bump();
  }
  // ---------- アルバイト ----------
  a_staffLicense(uid, a) {
    const st = this.store, sl = STAFF_SLOTS.find((o) => o.no === (a.slot | 0)); if (!sl) return;
    if (!staffSlotOpen(this.level, sl.no)) return this.err(uid, `お店のレベル${sl.lv}になると買えます`);
    if (hasStaffLicense(st, sl.no)) return;
    if (st.money < sl.lic) return this.err(uid, 'お金が足りません');
    st.money -= sl.lic; st.slic[sl.no] = 1;
    this.toast(null, `🔑 アルバイト No.${sl.no} の雇用ライセンスを買いました`, 'ok'); this.sfx('cash'); this.bump();
  }
  a_hire(uid, a) {
    const st = this.store, sl = STAFF_SLOTS.find((o) => o.no === (a.slot | 0)); if (!sl) return;
    if (!staffSlotOpen(this.level, sl.no)) return this.err(uid, `お店のレベル${sl.lv}になると雇えます`);
    if (!hasStaffLicense(st, sl.no)) return this.err(uid, '先に雇用ライセンスを買ってください');
    if (st.staff.some((o) => o.slot === sl.no)) return;
    const name = String(a.name ?? '').replace(/[\r\n\t]/g, ' ').trim().slice(0, 10) || pick(STAFF_NAMES);
    const s = { id: st.nid++, role: STAFF_ROLES[a.role] ? a.role : 'auto', cook: sl.cook, hall: sl.hall, name, seed: (a.seed >>> 0) || randi(1, 1e9), slot: sl.no, wage: sl.wage };
    st.staff.push(s);
    this.toast(null, `🧑‍🍳 ${s.name}さんを雇いました！（調理：${SPEEDS[s.cook].name}・接客：${SPEEDS[s.hall].name}・日給 ¥${s.wage.toLocaleString()}）`, 'ok');
    this.sfx('bell'); this.bump();
  }
  a_staffName(uid, a) { const s = this.store.staff.find((o) => o.id === a.sid), n = String(a.name || '').trim().slice(0, 10); if (s && n) { s.name = n; this.bump(); } }
  a_staffRole(uid, a) { const s = this.store.staff.find((o) => o.id === a.sid); if (!s || !STAFF_ROLES[a.role]) return; this.releaseStaff(s); s.role = a.role; this.bump(); }
  a_dismiss(uid, a) { const st = this.store, s = st.staff.find((o) => o.id === a.sid); if (!s) return; this.releaseStaff(s); st.staff = st.staff.filter((o) => o !== s); delete this.dyn.staffRt[s.id]; this.bump(); }
  releaseStaff(s) {
    const who = 's:' + s.id, hd = this.hand(who), st = this.store;
    if (hd?.t === 'dish') { if (dishEmpty(hd.d)) st.dish[hd.d.k]++; else st.dirty[hd.d.k]++; }
    if (hd?.t === 'dirty') for (const k of hd.a) st.dirty[k]++;
    this.setHand(who, null);
    for (const c of this.dyn.customers) for (const l of c.lines || []) if (l.cl === s.id) l.cl = null;
    const rt = this.dyn.staffRt[s.id]; if (rt) { rt.job = null; rt.st = 'idle'; rt.t = 0.5; rt.path = null; }
  }
  playerLeft(uid) {
    const hd = this.hand(uid), st = this.store;
    if (hd?.t === 'dish') { if (dishEmpty(hd.d)) st.dish[hd.d.k]++; else st.dirty[hd.d.k]++; }
    if (hd?.t === 'dirty') for (const k of hd.a) st.dirty[k]++;
    if (hd?.t === 'clean') for (const k of hd.a) st.dry[k]++;
    if (hd?.t === 'cash') { st.money += hd.v; st.till += hd.v; }
    this.setHand(uid, null);
    const c = this.heldCrate(uid), p = this.players[uid]; if (c) c.loc = { t: 'f', x: p?.x ?? 0, y: 0, z: p?.z ?? 0, ry: 0 };
    const ob = this.dyn.ch.bets[uid]; if (ob) { st.money += ob.a; st.till += ob.a; }
    delete this.dyn.ch.bets[uid];
    delete this.players[uid]; this.bump();
  }
  // ---------- 賭場 ----------
  inHallP(uid) { if (this.requireNear === false) return true; const p = this.players[uid]; return !!p && inHall(p.x, p.z, 0.6); }
  // 賭けるのは「手に持っているお金」（レジでつかんでくる）
  pay(uid, a) {
    const hd = this.hand(uid), v = Math.round(+a || 0);
    if (hd?.t !== 'cash') { this.err(uid, '💴 お金を持っていません（お店のレジを開けて、お金をつかんでこよう）'); return 0; }
    if (!(v >= 100)) { this.err(uid, '100円から賭けられます'); return 0; }
    if (v > hd.v) { this.err(uid, `手持ちのお金が足りません（¥${hd.v.toLocaleString()}）`); return 0; }
    hd.v -= v; if (hd.v <= 0) this.setHand(uid, null);
    return v;
  }
  gambleResult(uid, g, bet, back) {
    const st = this.store, net = back - bet;
    if (back > 0) this.giveCash(uid, back);
    else if (back < 0) { let ex = -back; const hd = this.hand(uid); if (hd?.t === 'cash') { const k = Math.min(ex, hd.v); hd.v -= k; ex -= k; if (hd.v <= 0) this.setHand(uid, null); } st.money -= ex; st.till = Math.min(st.till, Math.max(0, st.money)); }
    st.today.gamble += net;
    if (net > 0) st.stats.gWin += net; else st.stats.gLose -= net;
    this.bump();
    return net;
  }
  a_bet(uid, a) {
    const C = this.dyn.ch;
    if (!this.inHallP(uid)) return this.err(uid, '賭場の中で賭けてね');
    if (C.ph !== 'bet') return this.err(uid, 'いまは賭けられません（次の勝負を待とう）');
    const old = C.bets[uid]; if (old) { this.giveCash(uid, old.a); delete C.bets[uid]; }
    if (a.cancel) { this.bump(); return; }
    if (a.s !== 'cho' && a.s !== 'han') return;
    const v = this.pay(uid, a.a); if (!v) return;
    C.bets[uid] = { s: a.s, a: v, n: this.players[uid]?.name || '' };
    this.sfx('chip'); this.bump();
  }
  updateChohan(dt) {
    const C = this.dyn.ch;
    C.t -= dt;
    if (C.t > 0) return;
    if (C.ph === 'bet') {
      if (!Object.keys(C.bets).length) { C.t = CHOHAN_T.bet; return; }
      C.ph = 'roll'; C.t = CHOHAN_T.roll; C.d = [randi(1, 6), randi(1, 6)];
      this.ev({ t: 'sfx', s: 'cup', x: 13, z: 0.6 });
    } else if (C.ph === 'roll') {
      C.ph = 'show'; C.t = CHOHAN_T.show;
      const sum = C.d[0] + C.d[1], res = sum % 2 === 0 ? 'cho' : 'han';
      for (const [uid, b] of Object.entries(C.bets)) {
        const win = b.s === res, back = win ? b.a + Math.floor(b.a * (1 - CHOHAN_FEE)) : 0;
        const net = this.gambleResult(uid, 'chohan', b.a, back);
        this.ev({ t: 'gamble', g: 'chohan', to: uid, win, net, d: C.d, res });
      }
      C.hist = [[C.d[0], C.d[1]], ...C.hist].slice(0, 10);
      this.sfx('dice', 13, 0.6);
    } else {
      C.ph = 'bet'; C.t = CHOHAN_T.bet; C.bets = {}; C.n++;
    }
  }
  a_chinchiro(uid, a) {
    if (this.level < GAMBLES.chinchiro.lv) return;
    if (!this.inHallP(uid)) return this.err(uid, '賭場の中で遊んでね');
    const v = this.pay(uid, a.a); if (!v) return;
    const dealer = chinchiroRoll(), you = chinchiroRoll();
    let mult = 0; // 子から見た倍率（＋なら勝ち）
    if (you.h.r > dealer.h.r || (you.h.r === dealer.h.r && you.h.p > dealer.h.p)) mult = you.h.m;
    else if (you.h.r < dealer.h.r || (you.h.r === dealer.h.r && you.h.p < dealer.h.p)) mult = -dealer.h.m;
    if (you.h.k === 'hifumi') mult = -2; // ヒフミは倍払い
    if (dealer.h.k === 'hifumi' && you.h.k !== 'hifumi') mult = 2;
    if (dealer.h.k === 'hifumi' && you.h.k === 'hifumi') mult = 0;
    // 負けたときは役の倍率ぶん払う（お店の資金が足りない分はまけてもらえる）
    const back = Math.max(v + v * mult, -(this.store.money + (this.hand(uid)?.t === 'cash' ? this.hand(uid).v : 0)));
    const net = this.gambleResult(uid, 'chinchiro', v, back);
    this.ev({ t: 'gamble', g: 'chinchiro', to: uid, dealer, you, net, bet: v });
    this.sfx('dice');
  }
  a_slot(uid, a) {
    if (this.level < GAMBLES.slot.lv) return;
    if (!this.inHallP(uid)) return this.err(uid, '賭場の中で遊んでね');
    const v = this.pay(uid, a.a); if (!v) return;
    const W = SLOT_SYMS.reduce((t, s) => t + s[1], 0);
    const spin = () => { let x = Math.random() * W; for (const [s, w] of SLOT_SYMS) { x -= w; if (x <= 0) return s; } return SLOT_SYMS[0][0]; };
    const r = [spin(), spin(), spin()];
    let mult = 0;
    if (r[0] === r[1] && r[1] === r[2]) mult = SLOT_PAY[r[0]] || 0;
    else if (r.filter((s) => s === '🍒').length === 2) mult = SLOT_CHERRY2;
    const back = Math.floor(v * mult);
    const net = this.gambleResult(uid, 'slot', v, back);
    this.ev({ t: 'gamble', g: 'slot', to: uid, r, net, bet: v, mult });
    this.sfx('slot');
  }

  // ---------- 毎フレーム ----------
  tick(dt) {
    dt = Math.min(dt, 0.1);
    this.clk += dt;
    const st = this.store, dyn = this.dyn;
    if (st.phase === 'open' || st.phase === 'closing') {
      st.time += dt * GAME_MIN_PER_SEC;
      if (st.phase === 'open' && st.time >= closeTime()) { st.phase = 'closing'; this.toast(null, '⏰ 閉店時間です！のれんをしまいました', 'warn'); this.bump(); }
      if (st.phase === 'open') { this.updateSpawn(dt); this.updateThiefSpawn(dt); }
      if (st.phase === 'closing' && dyn.customers.length === 0 && !dyn.thief) this.finishDay();
    }
    for (const d of dyn.deliveries) d.t -= dt;
    const ready = dyn.deliveries.filter((d) => d.t <= 0);
    if (ready.length) { dyn.deliveries = dyn.deliveries.filter((d) => d.t > 0); for (const d of ready) this.deliver(d.items); }
    this.updateKitchen(dt);
    for (const c of dyn.customers) this.updateCustomer(c, dt);
    dyn.customers = dyn.customers.filter((c) => !c.gone);
    this.updateThief(dt);
    this.updateProj(dt);
    this.updateFires(dt);
    this.updateTurrets(dt);
    for (const s of st.staff) this.updateStaff(s, dt);
    this.updateChohan(dt);
  }
  // 調理の時間：焦げ・空焚き → 火事
  updateKitchen(dt) {
    const st = this.store, clk = this.clk;
    for (const f of st.fixtures) {
      if (f.br) continue;
      const def = FIXTURES[f.t];
      if (def.pot && f.pot) {
        const P = f.pot;
        if (P.fire && !(P.w > 0)) { P.dry ??= clk; if (clk - P.dry > 25) { this.startFire(f, '空焚き'); f.pot = null; this.bump(); } }
        else if (P.fire && st.phase === 'open' && this.level >= 4 && Math.random() < dt * 0.00035) this.startFire(f, 'コンロ');
      }
      if (def.griddle && f.gr) {
        const G = GRIDDLE[def.griddle], sec = clk - f.gr.t0;
        if (sec > G.burn && !f.gr.warn) { f.gr.warn = 1; this.toast(null, `💨 ${G.name}が焦げています！早く皿に取ろう（火が出るよ）`, 'warn'); this.sfx('err', f.x, f.z); }
        if (sec > G.fire) { this.startFire(f, G.name); f.gr = null; this.bump(); }
      }
    }
    // 長押しでの仕込み・洗い物が止まったら、少しずつ戻らないように何もしない（途中から再開できる）
    void dt;
  }
  startFire(f, why) {
    if (this.dyn.fires.some((x) => x.fid === f.id)) return;
    this.dyn.fires.push({ fid: f.id, v: 1.5, max: 0 });
    this.store.today.fires++;
    this.toast(null, `🔥 火事だ！${FIXTURES[f.t].name}から火が出た（${why}）。消火器を持って長押しで消そう！`, 'err');
    this.sfx('alarm', f.x, f.z);
  }
  updateFires(dt) {
    const dyn = this.dyn;
    for (const fr of dyn.fires) {
      const f = this.fx(fr.fid); if (!f) { fr.v = 0; continue; }
      fr.v = Math.min(10, fr.v + dt * 0.32);
      if (fr.v >= 10) {
        fr.max += dt;
        if (fr.max > 15) {
          f.br = 1; fr.v = 0;
          if (f.pot) f.pot = null; if (f.gr) f.gr = null; if (f.bk) f.bk = f.bk.map(() => null);
          this.toast(null, `💥 ${FIXTURES[f.t].name}が焼けて壊れてしまった…（狙って「修理」）`, 'err');
          this.store.rep = Math.max(0, this.store.rep - 4);
          this.bump();
        }
      }
      // 近くのお客さんは逃げる
      if (fr.v > 4) for (const c of dyn.customers) if (c.st !== 'out' && dist2(c.x, c.z, f.x, f.z) < 36) { c.fire = 1; c.why = 'fire'; this.leave(c, true); }
    }
    const n = dyn.fires.length;
    dyn.fires = dyn.fires.filter((x) => x.v > 0);
    if (n !== dyn.fires.length) this.bump();
  }
  // ---------- 泥棒 ----------
  updateThiefSpawn(dt) {
    const st = this.store, dyn = this.dyn;
    if (dyn.thief || this.level < 3 || st.till < 3000) return;
    const tk = st.fixtures.find((f) => f.t === 'register') || st.fixtures.find((f) => f.t === 'ticket'); if (!tk) return;
    if (Math.random() > dt / 230) return;
    const [sx, sz] = pick(SPAWN_POINTS);
    dyn.thief = { x: sx, z: sz, ry: 0, st: 'come', hp: 2, loot: 0, spd: 1.9, an: 'walk', fid: tk.id, path: null, pi: 0, seed: randi(1, 1e9) };
    this.goC(dyn.thief, ...(tk.t === 'register' ? frontSpot(tk, 0.55) : ticketSpot(tk, 0)));
  }
  updateThief(dt) {
    const T = this.dyn.thief; if (!T) return;
    const st = this.store;
    if (T.bt > 0 && (T.bt -= dt) <= 0) T.bub = null;
    switch (T.st) {
      case 'come': {
        const f = this.fx(T.fid); if (!f) { T.st = 'run'; this.runAway(T); break; }
        if (stepPath(T, dt, T.spd)) { T.st = 'steal'; T.t = 7; T.an = 'reach'; T.ry = Math.atan2(f.x - T.x, f.z - T.z); T.bub = 'money'; T.bt = 99; this.toast(null, '🥷 怪しい人がレジをこじ開けている！手裏剣を投げて止めよう！', 'warn'); this.sfx('alarm', T.x, T.z); }
        break;
      }
      case 'steal': {
        T.t -= dt;
        if (T.t > 0) break;
        T.loot = Math.min(st.till, Math.round(st.till * 0.6 + 1000), 4000 + this.level * 1000);
        st.till -= T.loot; st.money -= T.loot;
        this.toast(null, `💸 泥棒にレジのお金 ¥${T.loot.toLocaleString()} を盗まれた！逃げる前に手裏剣を当てよう！`, 'err');
        T.st = 'run'; T.spd = 3.4; T.bub = 'run'; T.bt = 99; this.runAway(T); this.bump();
        break;
      }
      case 'run':
        if (stepPath(T, dt, T.spd)) {
          if (T.loot) { st.today.stolen += T.loot; this.toast(null, `🥷 泥棒に逃げられた…（−¥${T.loot.toLocaleString()}）`, 'err'); }
          this.dyn.thief = null; this.bump();
        }
        break;
      case 'down':
        T.t -= dt; if (T.t <= 0) { this.dyn.thief = null; this.bump(); }
        break;
      default: break;
    }
  }
  runAway(T) { const [sx, sz] = pick(SPAWN_POINTS); if (!this.goC(T, sx, sz)) T.path = [[sx, sz]]; T.pi = 0; T.an = 'walk'; }
  hitThief(by) {
    const T = this.dyn.thief, st = this.store; if (!T || T.st === 'down') return;
    T.hp--; T.bub = 'hurt'; T.bt = 1.2;
    this.sfx('hit', T.x, T.z);
    if (T.hp > 0) { if (T.st === 'steal') { T.st = 'run'; T.spd = 3.2; this.runAway(T); } return; }
    const bounty = 3000 + this.level * 400;
    st.money += T.loot + bounty; st.today.bounty += bounty; st.stats.thief++;
    T.st = 'down'; T.t = 3; T.an = 'down'; T.bub = 'ko'; T.bt = 99; T.path = null;
    this.toast(null, `✴️ 泥棒を撃退した！${T.loot ? `盗まれた¥${T.loot.toLocaleString()}を取りもどし、` : ''}懸賞金 +¥${bounty.toLocaleString()}`, 'money');
    this.sfx('cash'); T.loot = 0; this.bump(); void by;
  }
  updateProj(dt) {
    const dyn = this.dyn;
    for (const p of dyn.proj) {
      p.t -= dt;
      const steps = 3;
      for (let i = 0; i < steps && p.t > 0; i++) {
        p.x += p.vx * dt / steps; p.z += p.vz * dt / steps;
        const T = dyn.thief;
        if (T && T.st !== 'down' && dist2(p.x, p.z, T.x, T.z) < 0.5) { this.hitThief(p.by); p.t = 0; break; }
        for (const c of dyn.customers) if (c.st !== 'out' && dist2(p.x, p.z, c.x, c.z) < 0.22) { c.hit = 1; c.pat -= 25; this.bubble(c, 'angry'); this.sfx('hit', c.x, c.z); if (!String(p.by).startsWith('s:')) this.toast(p.by, '💢 お客さんに手裏剣が当たった！', 'warn'); p.t = 0; break; }
      }
    }
    dyn.proj = dyn.proj.filter((p) => p.t > 0);
  }
  updateTurrets(dt) {
    const T = this.dyn.thief, dyn = this.dyn; dyn.tcd ||= {};
    for (const f of this.store.fixtures) {
      const tu = FIXTURES[f.t].turret; if (!tu || f.br) continue;
      if ((dyn.tcd[f.id] = (dyn.tcd[f.id] || 0) - dt) > 0) continue;
      if (!T || T.st === 'down' || dist(T.x, T.z, f.x, f.z) > tu.range) continue;
      const a = Math.atan2(T.x - f.x, T.z - f.z);
      dyn.proj.push({ id: dyn.pid++, x: f.x + Math.sin(a) * 0.4, z: f.z + Math.cos(a) * 0.4, y: 1.0, vx: Math.sin(a) * 17, vz: Math.cos(a) * 17, t: 0.7, by: 'turret' });
      dyn.tcd[f.id] = tu.cd; this.sfx('throw', f.x, f.z);
    }
  }

  // ---------- お客さん ----------
  goto(e, x, z) { e.path = this.nav.findPath(e.x, e.z, x, z); e.pi = 0; return !!e.path; }
  goC(e, x, z) { e.path = this.navC.findPath(e.x, e.z, x, z); e.pi = 0; return !!e.path; }
  bubble(c, k) { c.bub = k; c.bt = BUBBLE_T; }
  seatList() {
    const out = [];
    for (const f of this.store.fixtures) { const d = FIXTURES[f.t]; if (!d.seats || f.br) continue; d.seats.forEach((_, si) => out.push([f, si])); }
    return out;
  }
  seatFree(f, si) { return !f.br && !this.dyn.seats[f.id]?.[si] && !(f.dd?.[si]?.length); }
  maxCust() { return Math.min(this.custCap || 40, this.seatList().length + 4); }
  updateSpawn(dt) {
    const st = this.store, dyn = this.dyn;
    dyn.spawnT -= dt;
    if (this.criticDay && st.time >= this.criticDay) { this.criticDay = 0; if (this.dyn.customers.length < this.maxCust() + 2) this.spawnCustomer('critic'); }
    if (dyn.spawnT > 0) return;
    const t = st.time;
    const curve = 0.45 + 0.85 * Math.exp(-(((t - 750) / 70) ** 2)) + 0.75 * Math.exp(-(((t - 1140) / 90) ** 2));
    const f = customerFactors(st);
    dyn.spawnT = (24 / (curve * f.rep * f.lv * f.size * f.attract)) * rand(0.6, 1.4);
    if (dyn.customers.length >= this.maxCust()) return;
    this.spawnCustomer(Math.random() < 0.22 ? 'pair' : null);
  }
  spawnCustomer(kind) {
    const [sx, sz] = pick(SPAWN_POINTS);
    const n = kind === 'pair' ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const critic = kind === 'critic';
      const c = {
        id: this.dyn.cid++, av: randi(1, 2 ** 30), x: sx + i * 0.6, z: sz + (i ? 0.4 : 0), ry: 0, st: 'in', path: null, pi: 0, kind: critic ? 'critic' : 'normal',
        spd: rand(1.2, 1.55), bub: null, bt: 0, an: 'walk', lines: [], pat: 999, spent: 0, mood: 0,
      };
      this.dyn.customers.push(c);
      this.toTicket(c);
      if (critic) this.toast(null, '🕶️ サングラスのラーメン評論家が来店！最高の一杯を出そう', 'warn');
    }
  }
  toTicket(c) {
    const tks = this.store.fixtures.filter((f) => f.t === 'ticket' && !f.br);
    if (!tks.length) { c.why = 'noticket'; return this.leave(c, true); }
    let best = null, bs = 1e9;
    for (const f of tks) { const q = (this.dyn.tq[f.id] ||= []); const s = q.length * 10 + dist(c.x, c.z, f.x, f.z) * 0.3; if (s < bs) { bs = s; best = f; } }
    this.dyn.tq[best.id].push(c.id); c.tk = best.id; c.st = 'tq'; c.qi = -1; c.pat = 90;
    this.updateTQ(c);
  }
  updateTQ(c) {
    const q = this.dyn.tq[c.tk], f = this.fx(c.tk);
    if (!q || !f) { c.tk = null; return this.toTicket(c); }
    const qi = q.indexOf(c.id);
    if (qi !== c.qi) { c.qi = qi; const [x, z] = ticketSpot(f, qi); c.an = 'walk'; if (!this.goC(c, x, z)) { c.path = [[x, z]]; c.pi = 0; } }
  }
  leaveTQ(c) { if (c.tk && this.dyn.tq[c.tk]) this.dyn.tq[c.tk] = this.dyn.tq[c.tk].filter((id) => id !== c.id); c.tk = null; }
  // 食券を買う：メニューから選ぶ（売り切れ・高すぎるものは選ばない）
  chooseOrder(c) {
    const st = this.store, clk = this.clk;
    const ramen = st.menu.filter((m) => m.kind === 'ramen' && menuAvailable(st, m, clk));
    const fair = ramen.filter((m) => m.price <= menuLimit(m));
    if (!ramen.length) return { why: 'soldout' };
    if (!fair.length) return { why: 'pricey' };
    let main;
    if (c.kind === 'critic') main = fair.slice().sort((a, b) => b.price - a.price)[0];
    else {
      let tot = 0; const w = fair.map((m) => { const v = Math.pow(menuValue(m) / m.price, 2) * (1 + m.tp.length * 0.08); tot += v; return v; });
      let x = Math.random() * tot; main = fair[fair.length - 1];
      for (let i = 0; i < fair.length; i++) { x -= w[i]; if (x <= 0) { main = fair[i]; break; } }
    }
    const r = Math.random();
    const lines = [{ k: 'ramen', m: main.id, h: c.kind === 'critic' ? 'futsu' : r < 0.3 ? 'katame' : r < 0.86 ? 'futsu' : 'yawa', d: null, q: null, cl: null }];
    let total = main.price;
    if (c.kind !== 'critic') {
      const night = st.time > 17 * 60;
      const P = { rice: 0.22, gyoza: 0.3, beer: night ? 0.3 : 0.08, chadon: 0.14, karaage: 0.16 };
      for (const m of st.menu.filter((x) => x.kind === 'side')) {
        if (!menuAvailable(st, m, clk) || m.price > menuLimit(m)) continue;
        if (m.side === 'rice' && lines.some((l) => l.k === 'chadon')) continue;
        if (m.side === 'chadon' && lines.some((l) => l.k === 'rice')) continue;
        if (lines.length < 3 && Math.random() < (P[m.side] || 0.1)) { lines.push({ k: m.side, m: m.id, d: null, q: null, cl: null }); total += m.price; }
      }
    }
    return { lines, total };
  }
  findSeat(c) {
    let best = null, bd = 1e9;
    for (const [f, si] of this.seatList()) {
      if (!this.seatFree(f, si)) continue;
      const [ax, az] = seatAccess(f, si), d = dist(c.x, c.z, ax, az) + Math.random() * 1.5 - (isCounter(f.t) ? 0.6 : 0);
      if (d < bd) { bd = d; best = [f, si]; }
    }
    return best;
  }
  takeSeat(c, f, si) {
    (this.dyn.seats[f.id] ||= FIXTURES[f.t].seats.map(() => 0))[si] = c.id;
    c.seat = [f.id, si]; c.st = 'toseat'; c.an = 'walk';
    const [ax, az] = seatAccess(f, si);
    if (!this.goC(c, ax, az)) { c.path = [[ax, az]]; c.pi = 0; }
  }
  freeSeat(c) { if (!c.seat) return; const s = this.dyn.seats[c.seat[0]]; if (s && s[c.seat[1]] === c.id) s[c.seat[1]] = 0; c.seat = null; }
  waitSpot(c) {
    const st = this.store, taken = new Set(this.dyn.customers.filter((o) => o !== c && o.st === 'wseat' && o.ws).map((o) => o.ws.join(',')));
    for (const f of st.fixtures) {
      const w = FIXTURES[f.t].wait; if (!w) continue;
      for (let i = 0; i < w; i++) { const p = localToWorld(f, -0.5 + i * 0.5, 0.0); const k = p.join(','); if (!taken.has(k)) return { p, bench: f }; }
    }
    for (let i = 0; i < 8; i++) {
      const p = [-1.9 - i * 0.65, FRONT_Z - 0.9];
      if (p[0] < BUILDING.minX + 0.5 || !st.cols[Math.floor((p[0] + 14) / 4)]) continue;
      const k = p.join(','); if (!taken.has(k)) return { p };
    }
    return { p: [DOOR.x - 1.5, FRONT_Z - 1.4] };
  }
  refund(c, why) {
    const st = this.store;
    let v = 0;
    for (const l of c.lines) if (!l.d) { const m = st.menu.find((x) => x.id === l.m); v += c.paidL?.[l.m] ?? m?.price ?? 0; l.refunded = 1; }
    v = Math.min(v, c.spent);
    if (v > 0) { st.money -= v; st.till = Math.max(0, st.till - v); st.today.refund += v; c.spent -= v; }
    void why;
  }
  review(c, angry) {
    if (c.rv) return; c.rv = 1;
    const st = this.store, why = [];
    const served = c.lines.filter((l) => l.d), avg = served.length ? served.reduce((t, l) => t + l.q, 0) / served.length : 0;
    let s;
    if (angry) { s = 1; why.push(c.why || 'angry'); }
    else if (!served.length) { s = 2; why.push(c.why || 'soldout'); }
    else {
      s = 3.1 + (avg - 60) / 22;
      if (avg >= 90) why.push('great'); else if (avg < 45) why.push('bad');
      if (c.firstT != null && c.firstT > 100) { s -= 0.6; why.push('slow'); } else if (c.firstT != null && c.firstT < 50) { s += 0.25; why.push('fast'); }
      if (c.lines.some((l) => !l.d)) { s -= 0.7; why.push('missing'); }
      if (c.ngT) { s -= 0.3 * c.ngT; why.push('wrong'); }
      const val = c.lines.reduce((t, l) => { const m = st.menu.find((x) => x.id === l.m); return t + (m ? menuValue(m) : 0); }, 0);
      if (c.spent && c.spent < val * 0.85) { s += 0.3; why.push('cheap'); } else if (c.spent > val * 1.15) { s -= 0.3; why.push('pricey'); }
      const dirtySeats = st.fixtures.reduce((t, f) => t + (f.dd || []).filter((x) => x.length).length, 0);
      if (dirtySeats >= 3) { s -= 0.35; why.push('messy'); }
      s += Math.min(0.3, st.fixtures.filter((f) => FIXTURES[f.t].cat === 'deco').length * 0.04);
      if (st.fixtures.some((f) => f.t === 'water')) s += 0.1;
    }
    if (c.hit) { s -= 1.5; why.unshift('hit'); }
    if (c.fire) { s = 1; why.unshift('fire'); }
    s = clamp(s, 1, 5);
    const stars = Math.round(s);
    st.rep = clamp(st.rep + ((s - 1) * 25 - st.rep) * (c.kind === 'critic' ? 0.25 : 0.04), 0, 100);
    st.today.rv[stars - 1]++;
    // 評論家：点数で大きく評判が動く
    if (c.kind === 'critic' && !angry && served.length) {
      const ok = avg >= 80, prize = ok ? 5000 + this.level * 1500 : 0;
      st.money += prize; st.today.critic += prize; if (ok) st.stats.critic++;
      const m = ok ? pick(['香り・うま味・トッピング、文句なし。グルメサイトに載せよう', 'この一杯のためにまた来たい。満点に近い', 'スープの深みが見事だ']) : pick(['麺の茹で加減がなっていない…', 'まだまだ修行が足りないな', 'スープにコクがない']);
      this.ev({ t: 'critic', ok, q: Math.round(avg), prize, m });
      const r = { d: st.day, t: Math.round(st.time), s: ok ? 5 : 2, m: '🕶️評論家：' + m, av: c.av };
      st.reviews = [r, ...(st.reviews || [])].slice(0, 40);
      return;
    }
    if (Math.random() < (stars <= 2 ? 0.75 : stars >= 5 ? 0.55 : 0.3)) {
      const r = { d: st.day, t: Math.round(st.time), s: stars, m: reviewText(stars, why, st, c), av: c.av };
      st.reviews = [r, ...(st.reviews || [])].slice(0, 40);
      this.ev({ t: 'review', r });
    }
  }
  leave(c, angry) {
    if (c.st === 'out') return;
    this.leaveTQ(c);
    if (angry) { this.bubble(c, 'angry'); this.store.today.lost++; this.refund(c, c.why); }
    // 食べた器は席に残す
    if (c.seat) {
      const f = this.fx(c.seat[0]);
      if (f?.dd) { const left = c.lines.filter((l) => l.d).map((l) => l.d.k); f.dd[c.seat[1]] = [...(f.dd[c.seat[1]] || []), ...left]; if (left.length) this.bump(); }
      // 座っていた場所から立ち上がる
      if (f) { const [ax, az] = seatAccess(f, c.seat[1]); c.x = ax; c.z = az; }
    }
    this.freeSeat(c);
    if (c.lines.some((l) => l.d)) this.store.today.served++;
    this.review(c, angry);
    c.st = 'out'; c.an = 'walk'; c.y = 0;
    const [sx, sz] = pick(SPAWN_POINTS);
    if (!this.goC(c, sx, sz)) c.gone = true;
  }
  finishEat(c) {
    const st = this.store, served = c.lines.filter((l) => l.d);
    const avg = served.reduce((t, l) => t + l.q, 0) / Math.max(1, served.length);
    const gx = xpOf(c.spent, avg); st.today.xp += gx; this.gainXp(gx);
    st.totalCustomers++;
    this.bubble(c, avg >= 85 ? 'love' : 'happy');
    this.leave(c, false);
  }
  updateCustomer(c, dt) {
    if (c.bt > 0) { c.bt -= dt; if (c.bt <= 0) c.bub = null; }
    const st = this.store;
    switch (c.st) {
      case 'tq': {
        this.updateTQ(c);
        if (c.st !== 'tq') break;
        const arrived = stepPath(c, dt, c.spd); c.an = arrived ? 'idle' : 'walk';
        c.pat -= dt * (c.qi > 0 ? 0.7 : 1);
        if (c.pat <= 0) { c.why = 'line'; return this.leave(c, true); }
        if (arrived && c.qi === 0) { const f = this.fx(c.tk); if (f) c.ry = Math.atan2(f.x - c.x, f.z - c.z); c.st = 'buy'; c.t = 1.6; c.an = 'reach'; }
        break;
      }
      case 'buy': {
        c.t -= dt; if (c.t > 0) break;
        const o = this.chooseOrder(c);
        this.leaveTQ(c);
        if (!o.lines) { c.why = o.why; this.bubble(c, o.why === 'pricey' ? 'pricey' : 'none'); this.review(c, false); c.lines = []; return this.leave(c, false); }
        c.lines = o.lines; c.spent = o.total; c.paidL = Object.fromEntries(o.lines.map((l) => [l.m, st.menu.find((m) => m.id === l.m)?.price || 0]));
        st.money += o.total; st.till += o.total; st.today.sales += o.total; st.totalSales += o.total;
        for (const l of o.lines) { const e = (st.today.items[l.m] ||= [0, 0]); e[0]++; e[1] += c.paidL[l.m]; }
        this.ev({ t: 'sale', total: o.total, x: c.x, z: c.z });
        this.sfx('ticket', c.x, c.z); this.bump();
        const s = this.findSeat(c);
        if (s) this.takeSeat(c, ...s);
        else { const w = this.waitSpot(c); c.ws = w.p; c.wb = !!w.bench; c.st = 'wseat'; c.pat = (c.wb ? 95 : 70) * (st.fixtures.some((f) => f.t === 'water') ? 1.15 : 1); this.goC(c, ...w.p); this.bubble(c, 'wait'); }
        break;
      }
      case 'wseat': {
        if (stepPath(c, dt, c.spd)) { c.an = c.wb ? 'sit' : 'idle'; c.ry = Math.PI; }
        c.pat -= dt; c.chk = (c.chk || 0) - dt;
        if (c.chk <= 0) { c.chk = 0.8; const s = this.findSeat(c); if (s) { this.takeSeat(c, ...s); break; } }
        if (c.pat <= 0) { c.why = 'noseat'; return this.leave(c, true); }
        break;
      }
      case 'toseat': {
        const f = this.fx(c.seat?.[0]);
        if (!f) { c.seat = null; c.st = 'wseat'; c.pat = 40; break; }
        if (stepPath(c, dt, c.spd)) {
          const [x, z] = seatPos(f, c.seat[1]);
          c.x = x; c.z = z; c.ry = seatYaw(f, c.seat[1]); c.an = 'sit'; c.y = isCounter(f.t) ? 0.22 : f.t === 'zashiki' ? 0.18 : 0;
          c.st = 'seated'; c.ordT = this.clk;
          c.pat = (c.kind === 'critic' ? 130 : clamp(160 - this.level * 1.2, 105, 160)) * (st.fixtures.some((o) => o.t === 'water') ? 1.12 : 1);
          this.bubble(c, 'order'); this.sfx('order', c.x, c.z);
        }
        break;
      }
      case 'seated': case 'eat': {
        const unserved = c.lines.some((l) => !l.d);
        if (c.st === 'eat') {
          c.an = 'eat';
          if (c.firstT == null) c.firstT = (c.eatS ?? this.clk) - c.ordT;
          const dur = 18 + 5 * c.lines.length;
          if (this.clk - c.eatS >= dur) {
            if (!unserved) return this.finishEat(c);
            c.an = 'sit'; c.pat -= dt * 0.8;
            if (c.pat < 15 && !c.bub) this.bubble(c, 'wait');
            if (c.pat <= 0) { this.refund(c); this.store.today.lost++; return this.finishEat(c); }
          }
        } else {
          c.pat -= dt;
          if (c.pat < 25 && !c.bub) this.bubble(c, 'wait');
          if (c.pat <= 0) { c.why = 'slowAngry'; return this.leave(c, true); }
        }
        break;
      }
      case 'out': if (stepPath(c, dt, c.spd)) c.gone = true; break;
      default: break;
    }
  }
  gainXp(gx) {
    const st = this.store;
    if (st.level < MAX_LEVEL) st.xp += gx;
    while (st.level < MAX_LEVEL && st.xp >= xpNeed(st.level)) {
      st.xp -= xpNeed(st.level); st.level++;
      if (st.level >= MAX_LEVEL) st.xp = 0;
      // 新しく使えるサイドメニューは自動でメニューに入れる（オフ）
      for (const [k, s] of Object.entries(SIDES)) if (s.lv === st.level && !st.menu.some((m) => m.id === k)) st.menu.push({ id: k, kind: 'side', side: k, price: s.price, on: false });
      this.ev({ t: 'levelup', level: st.level, max: st.level >= MAX_LEVEL, unlocks: unlocksAt(st.level) }); this.sfx('levelup');
    }
  }

  // ---------- アルバイトAI ----------
  pendingLines() {
    const out = [];
    for (const c of this.dyn.customers) if (['seated', 'eat'].includes(c.st)) c.lines.forEach((l, i) => { if (!l.d && !l.cl) out.push({ c, l, i }); });
    return out.sort((a, b) => a.c.ordT - b.c.ordT);
  }
  updateStaff(s, dt) {
    const dyn = this.dyn, who = 's:' + s.id;
    let rt = dyn.staffRt[s.id];
    if (!rt) rt = dyn.staffRt[s.id] = { x: STAFF_HOME[0] + rand(-0.6, 0.6), z: STAFF_HOME[1] + rand(-0.6, 0.6), ry: 0, st: 'idle', t: rand(0.3, 1.5), path: null, pi: 0, an: 'idle', job: null };
    if (rt.bt > 0 && (rt.bt -= dt) <= 0) rt.bub = null;
    if (rt.st === 'walk') {
      const j = rt.job;
      if (!j || !this.jobValid(s, j)) { this.cancelJob(s, rt); return; }
      if (stepPath(rt, dt, Math.max(1.3, 2.0 * staffK(s, j.skill)))) {
        rt.st = 'work'; rt.t = j.dur; rt.an = j.an || 'reach';
        if (j.face) rt.ry = Math.atan2(j.face[0] - rt.x, j.face[1] - rt.z);
        this.jobStart(s, rt, j, who);
      }
      return;
    }
    if (rt.st === 'work') {
      rt.t -= dt * staffK(s, rt.job?.skill);
      if (rt.job?.sfx && Math.random() < dt * 2) this.sfx(rt.job.sfx, rt.x, rt.z);
      if (rt.t > 0) return;
      const j = rt.job; rt.job = null; rt.st = 'idle'; rt.t = 0.15; rt.an = 'idle';
      if (j) this.jobDone(s, rt, j, who);
      return;
    }
    rt.an = 'idle'; rt.t -= dt;
    if (rt.t > 0) return;
    rt.t = 0.6;
    const j = this.findJob(s, rt, who);
    if (!j) { rt.msg = null; return; }
    rt.job = j;
    const [x, z] = j.spot;
    if (dist(rt.x, rt.z, x, z) < 0.3 || this.goto(rt, x, z)) { rt.st = 'walk'; if (!rt.path) rt.path = [[x, z]]; }
    else { rt.job = null; this.unclaim(s); }
  }
  unclaim(s) { for (const c of this.dyn.customers) for (const l of c.lines || []) if (l.cl === s.id) l.cl = null; }
  cancelJob(s, rt) { this.unclaim(s); rt.job = null; rt.st = 'idle'; rt.t = 0.5; rt.path = null; }
  jobValid(s, j) { const f = j.fid != null ? this.fx(j.fid) : null; if (j.fid != null && (!f || f.br)) return false; if (j.c && !['seated', 'eat'].includes(j.c.st)) return false; return true; }
  findJob(s, rt, who) {
    const st = this.store, role = s.role, hd = this.hand(who);
    const F = (pred) => { let b = null, bd = 1e9; for (const f of st.fixtures) { if (f.br || !pred(f)) continue; const d = dist2(rt.x, rt.z, f.x, f.z); if (d < bd) { bd = d; b = f; } } return b; };
    const job = (kind, f, dur, skill, extra = {}) => ({ kind, fid: f?.id, spot: f ? frontSpot(f, 0.5) : [rt.x, rt.z], face: f ? [f.x, f.z] : null, dur, skill, ...extra });
    // 持っている物を片付ける
    if (hd?.t === 'dish') {
      const tgt = this.matchCustomer(hd.d, hd.d.for);
      if (tgt) { const f = this.fx(tgt.c.seat[0]); return { kind: 'serve', fid: f.id, c: tgt.c, spot: seatAccess(f, tgt.c.seat[1]), face: [tgt.c.x, tgt.c.z], dur: 0.6, skill: 'hall' }; }
      const ps = F((f) => f.ps && f.ps.some((x) => !x));
      if (ps) return job('passput', ps, 0.4, 'hall');
      return job('trash', F((f) => f.t === 'trash'), 0.4, 'hall');
    }
    if (hd?.t === 'dirty') { const sk = F((f) => FIXTURES[f.t].sink); return sk ? job('sinkput', sk, 0.5, 'hall') : null; }
    if (hd?.t === 'clean') { const rk = F((f) => FIXTURES[f.t].rack); return rk ? job('rackput', rk, 0.5, 'hall') : null; }
    if (hd) { this.setHand(who, null); return null; }
    const cookJobs = () => this.findCookJob(s, rt, F, job);
    const hallJobs = () => {
      // 受け渡し台の料理を運ぶ
      for (const f of st.fixtures) {
        if (!f.ps || f.br) continue;
        for (let i = 0; i < f.ps.length; i++) {
          const d = f.ps[i]; if (!d) continue;
          if (st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.kind === 'pick' && this.dyn.staffRt[o.id].job.fid === f.id && this.dyn.staffRt[o.id].job.pi === i)) continue;
          if (this.matchCustomer(d, d.for)) return job('pick', f, 0.4, 'hall', { pi: i });
        }
      }
      // 食べ終わった席を片付ける
      let best = null, bd = 1e9;
      for (const f of st.fixtures) {
        if (!f.dd) continue;
        f.dd.forEach((dd, si) => {
          if (!dd.length) return;
          if (st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.kind === 'clear' && this.dyn.staffRt[o.id].job.fid === f.id && this.dyn.staffRt[o.id].job.si === si)) return;
          const [ax, az] = seatAccess(f, si), d = dist2(rt.x, rt.z, ax, az);
          if (d < bd) { bd = d; best = { kind: 'clear', fid: f.id, si, spot: [ax, az], face: localToWorld(f, ...FIXTURES[f.t].spots[si]), dur: 0.8, skill: 'hall' }; }
        });
      }
      return best;
    };
    const washJob = () => {
      const dirty = Object.values(st.dirty).some((n) => n > 0), dry = dryCount(st);
      const sink = F((f) => FIXTURES[f.t].sink);
      // 水切りかごがたまったら食器棚にしまう
      if (sink && dry > 0 && (dry >= DRY_MAX || !dirty || dry >= DIRTY_MAX || (st.dish.bowl || 0) < 2) && !st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.kind === 'shelve')) return job('shelve', sink, 0.6, 'hall');
      if (!dirty || dry >= DRY_MAX) return null;
      const sk = F((f) => FIXTURES[f.t].sink && !st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.kind === 'wash' && this.dyn.staffRt[o.id].job.fid === f.id));
      return sk ? job('wash', sk, WASH_T * 1.5, 'hall', { an: 'wash', sfx: 'wash' }) : null;
    };
    const order = role === 'cook' ? [cookJobs] : role === 'hall' ? [hallJobs, washJob] : role === 'wash' ? [washJob, hallJobs] : [cookJobs, hallJobs, washJob];
    for (const fn of order) { const j = fn(); if (j) return j; }
    // 手が空いたら仕込みの手伝い（おまかせ）
    if (role === 'auto') return this.findPrepJob(s, F, job, 4);
    return null;
  }
  findCookJob(s, rt, F, job) {
    const st = this.store, clk = this.clk;
    const busyF = (fid) => st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.fid === fid);
    const pend = this.pendingLines();
    // トッピングが切れそうなら先に仕込む
    if (pend.length) { const pj = this.findPrepJob(s, F, job, 2); if (pj) return pj; }
    for (const { c, l } of pend) {
      if (l.k === 'ramen') {
        const m = st.menu.find((x) => x.id === l.m); if (!m) continue;
        const S = SOUPS[m.soup], pot = F((f) => potReady(f, clk) && f.pot.b === S.broth);
        const boiler = F((f) => FIXTURES[f.t].baskets);
        if (!pot || !boiler || !((st.stock.men || 0) > 0) || !((st.dish.bowl || 0) > 0) || !((st.tare[S.tare] || 0) > 0)) continue;
        l.cl = s.id;
        return job('ramen', boiler, 10, 'cook', { c, l, pot: pot.id, an: 'stir', sfx: 'boil' });
      }
      const S = SIDES[l.k]; if (!S || !((st.dish[S.dish] || 0) > 0)) continue;
      if (l.k === 'rice' || l.k === 'chadon') {
        const rc = F((f) => f.t === 'rice' && f.rc && f.rc.sv > 0 && clk - f.rc.t0 >= RICE_READY);
        if (!rc || (l.k === 'chadon' && !((st.prep.chashu || 0) > 0))) continue;
        l.cl = s.id; return job('side', rc, 2.5, 'cook', { c, l });
      }
      if (l.k === 'beer') {
        const b = F((f) => f.t === 'beer'); if (!b || !((st.prep.beer || 0) > 0 || (st.stock.taru || 0) > 0)) continue;
        l.cl = s.id; return job('side', b, 3, 'cook', { c, l, sfx: 'pour' });
      }
      const G = GRIDDLE[l.k];
      if (G) {
        const g = F((f) => FIXTURES[f.t].griddle === l.k && !f.gr && !busyF(f.id)); if (!g || (st.stock[G.item] || 0) < G.use) continue;
        l.cl = s.id; return job('side', g, (G.ideal[0] + G.ideal[1]) / 2, 'cook', { c, l, an: 'stir', sfx: 'sizzle' });
      }
    }
    // だしを炊く・アクを取る・タレを作る（注文が多いスープ → メニューのスープ）
    const want = [...new Set([...pend.filter((p) => p.l.k === 'ramen').map((p) => st.menu.find((m) => m.id === p.l.m)?.soup), ...st.menu.filter((m) => m.kind === 'ramen' && m.on).map((m) => m.soup)].filter((k) => SOUPS[k]))];
    const aku = F((f) => f.pot?.b && potAku(f.pot, clk) > 0.45 && !busyF(f.id)); if (aku) return job('skim', aku, 2.5, 'cook', { an: 'stir', sfx: 'pour' });
    for (const b of [...new Set(want.map((k) => SOUPS[k].broth))]) {
      if (st.fixtures.some((f) => f.pot?.b === b && (f.pot.sv > 3 || !potReady(f, clk)) && !f.br)) continue;
      if (!((st.stock[BROTHS[b].item] || 0) > 0)) continue;
      const pot = F((f) => FIXTURES[f.t].pot && (!f.pot || !f.pot.b || f.pot.sv <= 0) && !busyF(f.id));
      if (pot) return job('soup', pot, 4, 'cook', { b, an: 'stir' });
    }
    for (const t of [...new Set(want.map((k) => SOUPS[k].tare))]) {
      const T = TARES[t]; if ((st.tare[t] || 0) >= 5 || !((st.stock[T.raw] || 0) > 0) || this.level < T.lv) continue;
      if (st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.kind === 'tare')) continue;
      const tb = F((f) => FIXTURES[f.t].topping && !f.tj && !busyF(f.id)); if (tb) return job('tare', tb, TARE_MIX * 1.6, 'cook', { k: t, an: 'stir', sfx: 'pour' });
    }
    // ごはんを炊く
    if (st.menu.some((m) => m.on && (m.side === 'rice' || m.side === 'chadon')) && (st.stock.kome || 0) > 0) {
      const rc = F((f) => f.t === 'rice' && !f.rc && !busyF(f.id)); if (rc) return job('riceStart', rc, 1.5, 'cook');
    }
    // 空焚きを止める
    const dry = F((f) => f.pot && !(f.pot.w > 0) && f.pot.fire); if (dry) return job('fireoff', dry, 0.5, 'cook');
    return this.findPrepJob(s, F, job, 8);
  }
  findPrepJob(s, F, job, low) {
    const st = this.store;
    const need = new Set(st.menu.filter((m) => m.on && m.kind === 'ramen').flatMap((m) => m.tp));
    if (st.menu.some((m) => m.on && m.side === 'chadon')) need.add('chashu');
    for (const tid of need) {
      const T = TOPPINGS[tid]; if (!T || (st.prep[tid] || 0) >= low || !((st.stock[T.raw] || 0) > 0)) continue;
      if (st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.tid === tid)) continue;
      const b = F((f) => FIXTURES[f.t].board && !f.job && !st.staff.some((o) => o !== s && this.dyn.staffRt[o.id]?.job?.fid === f.id));
      if (b) return job('prep', b, T.prep * 1.6, 'cook', { tid, an: 'chop', sfx: 'chop' });
    }
    return null;
  }
  jobStart(s, rt, j, who) {
    const st = this.store;
    if (j.kind === 'prep') { const T = TOPPINGS[j.tid]; if ((st.stock[T.raw] || 0) > 0) { st.stock[T.raw]--; if (!st.stock[T.raw]) delete st.stock[T.raw]; j.ok = 1; this.bump(); } }
    if (j.kind === 'tare') { const T = TARES[j.k]; if ((st.stock[T.raw] || 0) > 0) { st.stock[T.raw]--; if (!st.stock[T.raw]) delete st.stock[T.raw]; j.ok = 1; this.bump(); } }
    if (j.kind === 'side' && GRIDDLE[j.l.k]) { const G = GRIDDLE[j.l.k]; if ((st.stock[G.item] || 0) >= G.use) { st.stock[G.item] -= G.use; if (!st.stock[G.item]) delete st.stock[G.item]; j.ok = 1; this.bump(); } }
    void who;
  }
  jobDone(s, rt, j, who) {
    const st = this.store, clk = this.clk, f = this.fx(j.fid), k = staffK(s, j.skill);
    const noise = (a) => rand(-a, a) / Math.max(0.5, k);
    switch (j.kind) {
      case 'ramen': {
        const m = st.menu.find((x) => x.id === j.l.m), pot = this.fx(j.pot);
        const S = m && SOUPS[m.soup];
        if (!m || !potReady(pot, clk) || pot.pot.b !== S.broth || !((st.stock.men || 0) > 0) || !((st.dish.bowl || 0) > 0) || !((st.tare[S.tare] || 0) > 0)) { j.l.cl = null; return; }
        st.stock.men--; if (!st.stock.men) delete st.stock.men; st.dish.bowl--; st.tare[S.tare]--; if (!st.tare[S.tare]) delete st.tare[S.tare];
        const sq0 = soupQuality(pot, clk); pot.pot.sv--; pot.pot.used = (pot.pot.used || 0) + 1; if (pot.pot.sv <= 0) { potCommit(pot.pot, clk); pot.pot.w = 0; if (pot.pot.fire) pot.pot.dry = clk; }
        const H = HARD[j.l.h] || HARD.futsu, tp = [];
        for (const t of m.tp) if ((st.prep[t] || 0) > 0) { st.prep[t]--; if (!st.prep[t]) delete st.prep[t]; tp.push(t); }
        const d = { k: 'bowl', soup: m.soup, broth: S.broth, tare: S.tare, wet: 0, sq: sq0 * clamp(0.85 + k * 0.08, 0.85, 1), men: Math.round(((H.t[0] + H.t[1]) / 2 + noise(5)) * 10) / 10, tp, t: clk, for: { c: j.c.id, l: j.c.lines.indexOf(j.l) } };
        j.l.cl = null;
        this.setHand(who, { t: 'dish', d }); this.bump();
        break;
      }
      case 'side': {
        const S = SIDES[j.l.k]; if (!S || !((st.dish[S.dish] || 0) > 0)) { j.l.cl = null; return; }
        const d = { k: S.dish, tp: [], t: clk, for: { c: j.c.id, l: j.c.lines.indexOf(j.l) } };
        if (j.l.k === 'rice' || j.l.k === 'chadon') {
          const rc = f?.rc; if (!rc || rc.sv <= 0) { j.l.cl = null; return; }
          rc.sv--; if (rc.sv <= 0) f.rc = null;
          d.side = 'rice'; d.q = 90;
          if (j.l.k === 'chadon') { if ((st.prep.chashu || 0) > 0) { st.prep.chashu--; if (!st.prep.chashu) delete st.prep.chashu; d.tp.push('chashu'); } }
        } else if (j.l.k === 'beer') {
          if (!((st.prep.beer || 0) > 0)) { if ((st.stock.taru || 0) > 0) { st.stock.taru--; if (!st.stock.taru) delete st.stock.taru; st.prep.beer = 20; } else { j.l.cl = null; return; } }
          st.prep.beer--; if (!st.prep.beer) delete st.prep.beer;
          d.side = 'beer'; d.fill = clamp(0.93 + noise(0.09), 0.7, 1.15);
        } else { if (!j.ok) { j.l.cl = null; return; } d.side = j.l.k; d.q = Math.round(clamp(78 + k * 9 + noise(10), 30, 100)); }
        st.dish[S.dish]--; j.l.cl = null;
        this.setHand(who, { t: 'dish', d }); this.bump();
        break;
      }
      case 'soup': {
        const B = BROTHS[j.b], def = FIXTURES[f?.t];
        if (!f || !B || (f.pot?.b && f.pot.sv > 0) || !((st.stock[B.item] || 0) > 0)) return;
        const n = Math.min(def.pot.sv / POT_PER, st.stock[B.item]), P = { w: 1, n: { [B.item]: n }, b: j.b, ha: 0, hs: clk, sk: 0, sv: 0, used: 0, fire: 1, off: clk, dry: null };
        st.stock[B.item] -= n; if (!st.stock[B.item]) delete st.stock[B.item];
        for (const x of ['yasai', ...(j.b !== 'ton' ? ['kombu'] : [])]) if ((st.stock[x] || 0) > 0 && ingUnlocked(x, this.level)) { st.stock[x]--; if (!st.stock[x]) delete st.stock[x]; P.n[x] = 1; }
        P.sv = potServings(P, def); f.pot = P;
        this.sfx('boil', f.x, f.z); this.bump();
        break;
      }
      case 'skim': if (f?.pot?.b) { const B = BROTHS[f.pot.b]; f.pot.sk = Math.min(1, AKU_RATE * Math.min(potHeat(f.pot, clk), B.ready + 70)) + (potHeat(f.pot, clk) < B.ready + 70 ? 0.2 : 0); this.bump(); } break;
      case 'tare': if (j.ok) { const T = TARES[j.k]; st.tare[j.k] = (st.tare[j.k] || 0) + T.per; this.bump(); } break;
      case 'riceStart': if (f && !f.rc && (st.stock.kome || 0) > 0) { st.stock.kome--; if (!st.stock.kome) delete st.stock.kome; f.rc = { t0: clk, sv: FIXTURES.rice.rice.sv }; this.bump(); } break;
      case 'fireoff': if (f?.pot && !(f.pot.w > 0)) { f.pot = null; this.bump(); } break;
      case 'prep': if (j.ok) { const T = TOPPINGS[j.tid]; st.prep[j.tid] = (st.prep[j.tid] || 0) + T.per; this.bump(); } break;
      case 'serve': {
        const hd = this.hand(who); if (hd?.t !== 'dish') return;
        if (!['seated', 'eat'].includes(j.c.st)) return;
        if (!j.c.lines.some((l) => !l.d && evalDish(st, hd.d, l, j.c, clk)?.q != null)) return; // ほかの人が先に出した
        if (this.serveTo(j.c, hd.d, who) === true) this.setHand(who, null);
        break;
      }
      case 'passput': {
        const hd = this.hand(who); if (hd?.t !== 'dish' || !f?.ps) return;
        const i = f.ps.findIndex((x) => !x); if (i < 0) return;
        f.ps[i] = hd.d; this.setHand(who, null); this.sfx('bell2', f.x, f.z); this.bump();
        break;
      }
      case 'pick': {
        if (!f?.ps?.[j.pi] || this.hand(who)) return;
        const d = f.ps[j.pi]; f.ps[j.pi] = null; this.setHand(who, { t: 'dish', d }); this.bump();
        break;
      }
      case 'trash': { const hd = this.hand(who); if (hd?.t === 'dish') { st.dirty[hd.d.k]++; this.setHand(who, null); this.bump(); } break; }
      case 'clear': {
        if (!f?.dd?.[j.si]?.length) return;
        const stack = { t: 'dirty', a: f.dd[j.si].splice(0, DIRTY_MAX) };
        this.setHand(who, stack); this.sfx('dish', f.x, f.z); this.bump();
        break;
      }
      case 'sinkput': { const hd = this.hand(who); if (hd?.t === 'dirty') { for (const x of hd.a) st.dirty[x]++; this.setHand(who, null); this.bump(); } break; }
      case 'wash': {
        const kk = Object.keys(DISHES).find((x) => st.dirty[x] > 0); if (!kk || dryCount(st) >= DRY_MAX) return;
        st.dirty[kk]--; st.dry[kk] = (st.dry[kk] || 0) + 1; this.sfx('dish', f?.x, f?.z); this.bump();
        break;
      }
      case 'shelve': {
        if (this.hand(who)) return; const arr = [];
        for (const kk of Object.keys(DISHES)) while ((st.dry[kk] || 0) > 0 && arr.length < DIRTY_MAX) { st.dry[kk]--; arr.push(kk); }
        if (arr.length) { this.setHand(who, { t: 'clean', a: arr }); this.sfx('dish', f?.x, f?.z); this.bump(); }
        break;
      }
      case 'rackput': { const hd = this.hand(who); if (hd?.t === 'clean') { for (const x of hd.a) st.dish[x] = (st.dish[x] || 0) + 1; this.setHand(who, null); this.sfx('dish', f?.x, f?.z); this.bump(); } break; }
      default: break;
    }
  }
  // 料理を待っているお客さん（for があればその人）
  matchCustomer(d, pref) {
    if (pref) { const c = this.cust(pref.c); const l = c?.lines?.[pref.l]; if (c && ['seated', 'eat'].includes(c.st) && l && !l.d && evalDish(this.store, d, l, c, this.clk)?.q != null) return { c, l }; }
    for (const c of this.dyn.customers.filter((o) => ['seated', 'eat'].includes(o.st)).sort((a, b) => a.ordT - b.ordT)) {
      for (const l of c.lines) if (!l.d && evalDish(this.store, d, l, c, this.clk)?.q != null) return { c, l };
    }
    return null;
  }
  finishDay() {
    const st = this.store, T = st.today;
    for (const [uid, hd] of Object.entries(st.hand || {})) if (hd?.t === 'cash') { st.money += hd.v; st.till += hd.v; delete st.hand[uid]; }
    const wages = st.staff.reduce((s, o) => s + (o.wage || 0), 0);
    const bills = 1200 + ownCols(st).length * 400 + st.fixtures.length * 30;
    st.money -= wages + bills;
    const top = Object.entries(T.items || {}).sort((a, b) => b[1][1] - a[1][1]).slice(0, 6).map(([id, v]) => [st.menu.find((m) => m.id === id)?.name || id, v]);
    const data = {
      day: st.day, top, sales: T.sales, refund: T.refund, served: T.served, lost: T.lost, bowls: T.bowls, sides: T.sides, orders: T.orders, ship: T.ship, wages, bills,
      stolen: T.stolen, bounty: T.bounty, critic: T.critic, gamble: T.gamble, repair: T.repair, fires: T.fires, xp: T.xp, level: st.level, rep: Math.round(st.rep), repPrev: st.last?.rep ?? null,
      rv: T.rv, avgQ: T.qn ? Math.round(T.qs / T.qn) : 0, money: st.money, prevProfit: st.last?.profit ?? null,
    };
    data.profit = data.sales - data.refund + data.bounty + data.critic + data.gamble - data.orders - data.ship - wages - bills - data.stolen - data.repair;
    st.phase = 'summary'; st.last = data; st.till = 0;
    this.ev({ t: 'summary', data });
    this.sfx('bell'); this.bump();
  }

  // ---------- ネット同期用スナップショット ----------
  dynSnapshot() {
    const d = this.dyn, labels = seatLabels(this.store);
    const sv = [];
    const orders = [];
    for (const c of d.customers) {
      if (!c.seat || !['seated', 'eat'].includes(c.st)) continue;
      const frac = c.eatS ? clamp((this.clk - c.eatS) / (18 + 5 * c.lines.length), 0, 1) : 0;
      c.lines.forEach((l, i) => { if (l.d) sv.push([c.seat[0], c.seat[1], i, l.d, frac]); });
      orders.push([c.id, labels[c.seat[0]]?.[c.seat[1]] || '', Math.round(this.clk - c.ordT), Math.round(c.pat), c.kind === 'critic' ? 1 : 0, c.lines.map((l) => [l.k, l.m, l.h || '', l.d ? 1 : 0, l.cl ? 1 : 0]), c.seat[0], c.seat[1]]);
    }
    const T = d.thief;
    const C = d.ch;
    return {
      clk: +this.clk.toFixed(2), time: this.store.time,
      c: d.customers.map((c) => [c.id, c.kind === 'critic' ? 'critic' : c.av, +c.x.toFixed(2), +c.z.toFixed(2), +c.ry.toFixed(2), c.an, c.bub || '', c.y || 0, c.st === 'eat' ? 1 : 0]),
      s: this.store.staff.map((s) => { const r = d.staffRt[s.id] || {}; return [s.id, +(r.x || 0).toFixed(2), +(r.z || 0).toFixed(2), +(r.ry || 0).toFixed(2), r.an || 'idle', r.bub || '']; }),
      o: orders, sv,
      th: T ? [+T.x.toFixed(2), +T.z.toFixed(2), +T.ry.toFixed(2), T.an, T.bub || '', T.st, T.seed] : null,
      f: d.fires.map((x) => [x.fid, +x.v.toFixed(1)]),
      p: d.proj.map((p) => [p.id, +p.x.toFixed(2), +p.z.toFixed(2), p.y]),
      ch: { ph: C.ph, t: +C.t.toFixed(1), d: C.ph === 'bet' || C.ph === 'roll' ? null : C.d, b: Object.fromEntries(Object.entries(C.bets).map(([k, v]) => [k, [v.s, v.a, v.n]])), n: C.n, h: C.hist },
      dl: d.deliveries.map((x) => +x.t.toFixed(1)),
    };
  }
}

export function stepPath(e, dt, spd) {
  if (!e.path || e.pi >= e.path.length) return true;
  let remain = spd * dt;
  while (remain > 0 && e.pi < e.path.length) {
    const [tx, tz] = e.path[e.pi];
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz);
    if (d > 1e-4) e.ry = Math.atan2(dx, dz);
    if (d <= remain) { e.x = tx; e.z = tz; e.pi++; remain -= d; }
    else { e.x += dx / d * remain; e.z += dz / d * remain; remain = 0; }
  }
  e.an = e.pi >= e.path.length ? 'idle' : 'walk';
  return e.pi >= e.path.length;
}
export function repairCost(f) { return Math.max(2000, Math.round((FIXTURES[f.t].price || 10000) * 0.3 / 100) * 100); }
// チンチロ：3回まで振って役を決める
export function chinchiroHand(d) {
  const s = [...d].sort((a, b) => a - b);
  if (s[0] === 1 && s[1] === 1 && s[2] === 1) return { k: 'pinzoro', name: 'ピンゾロ', r: 6, p: 0, m: 5 };
  if (s[0] === s[1] && s[1] === s[2]) return { k: 'zoro', name: `${s[0]}のゾロ目`, r: 5, p: s[0], m: 3 };
  if (s[0] === 4 && s[1] === 5 && s[2] === 6) return { k: 'shigoro', name: 'シゴロ', r: 4, p: 0, m: 2 };
  if (s[0] === 1 && s[1] === 2 && s[2] === 3) return { k: 'hifumi', name: 'ヒフミ', r: 0, p: 0, m: 2 };
  if (s[0] === s[1]) return { k: 'me', name: `${s[2]}の目`, r: 2, p: s[2], m: 1 };
  if (s[1] === s[2]) return { k: 'me', name: `${s[0]}の目`, r: 2, p: s[0], m: 1 };
  return null;
}
export function chinchiroRoll() {
  const rolls = [];
  let h = null;
  for (let i = 0; i < 3 && !h; i++) { const d = [randi(1, 6), randi(1, 6), randi(1, 6)]; rolls.push(d); h = chinchiroHand(d); }
  return { rolls, h: h || { k: 'none', name: '目なし', r: 1, p: 0, m: 1 } };
}
// 来店の勢い
export function customerFactors(st) {
  let at = 0; for (const f of st.fixtures || []) at += FIXTURES[f.t]?.attract || 0;
  return {
    lv: 1 + 0.035 * ((st.level || 1) - 1),
    size: Math.pow(Math.max(1, ownCols(st).length) / START_COLS.length, 0.6),
    rep: 0.5 + (st.rep ?? 50) / 100,
    attract: 1 + Math.min(0.5, at),
  };
}
export const repStars = (rep) => 1 + clamp(rep ?? 50, 0, 100) / 25;
const RV = {
  great: () => pick(['スープが最高！また来ます', '麺の茹で加減が完璧', 'ここのラーメン、街でいちばん！', '最後の一滴まで飲み干した']),
  bad: () => pick(['麺がのびてた…', 'スープがぬるい', 'トッピングが足りない', 'ちょっと残念な一杯']),
  slow: () => pick(['ラーメンが出てくるのが遅い…', 'かなり待たされた', '注文から長すぎ']),
  fast: () => pick(['すぐ出てきてうれしい', '提供が早い！']),
  missing: () => pick(['頼んだサイドが来なかった', '餃子まだ？って言ったのに…']),
  wrong: () => pick(['注文とちがうのが来た', '最初ちがうラーメンが来た']),
  cheap: () => pick(['安くてうまい！', 'コスパ最高']),
  pricey: () => pick(['ちょっと高いかな', 'この値段ならもう少し…']),
  messy: () => pick(['食器が片付いてない席が多い', 'テーブルが汚れたまま']),
  hit: () => pick(['いきなり手裏剣が飛んできた！！', '頭に何か当たった…危ない店', '手裏剣はやめてくれ']),
  dish: () => pick(['頭に丼が飛んできた！！', '店員が食器を投げてくる店', '後頭部にジョッキが…']),
  fire: () => pick(['火事で逃げた！', '厨房から火が…怖かった']),
  slowAngry: () => pick(['待っても全然来ない！帰る', '注文を忘れられた？もう来ない']),
  noseat: () => pick(['席が空かなくて帰った', '満席で座れなかった']),
  line: () => pick(['券売機の列が長すぎ', '食券を買うまでに疲れた']),
  noticket: () => '券売機がなくて注文できなかった',
  soldout: () => pick(['売り切れだらけ…', 'スープ切れって何！？', '麺がないってどういうこと']),
  angry: () => 'もう来ない！',
  5: () => pick(['また来ます！', '最高のラーメン屋！', '近所にあってうれしい']), 4: () => pick(['おいしかった', 'いいお店でした']),
  3: () => pick(['ふつうかな', 'まあまあ']), 2: () => pick(['うーん…', 'ちょっと残念']), 1: () => 'もう来ない',
};
function reviewText(stars, why) {
  const bad = why.filter((w) => ['bad', 'slow', 'missing', 'wrong', 'pricey', 'messy', 'hit', 'dish', 'fire', 'slowAngry', 'noseat', 'line', 'noticket', 'soldout', 'angry', 'pricey'].includes(w));
  const good = why.filter((w) => ['great', 'fast', 'cheap'].includes(w));
  const w = stars <= 3 ? bad[0] || null : (Math.random() < 0.65 && good.length ? pick(good) : null);
  return (w && RV[w] ? RV[w] : RV[stars])();
}
export { inKitchen, KITCHEN_Z, ING_LIST };
