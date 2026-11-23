// ===== ゲームデータ定義（three.js 非依存） =====
export const CELL = 0.5;
// ---------- 店舗レイアウト ----------
// お店は「奥が厨房・手前が客席」の縦長の店。間に固定のカウンター席がある。
// 4m幅の「列」を左へ買い足して広げる（列ごとに厨房・カウンター・客席が増える）。倉庫・在庫棚はなし（食材はドローンで冷蔵庫へ直接届く）
export const COL_W = 4;
export const SHOP = { x0: -14, cols: 5 };
export const SHOP_X1 = SHOP.x0 + SHOP.cols * COL_W; // 6
export const BACK_Z = -7, FRONT_Z = 6, KITCHEN_Z = -3;
export const START_COLS = [2, 3, 4];
export const DOOR = { x: 0, z: FRONT_Z, half: 1.0 };
export const BUILDING = { minX: SHOP.x0, maxX: SHOP_X1, minZ: BACK_Z, maxZ: FRONT_Z };
export const COUNTER_Z = KITCHEN_Z + 0.7; // カウンター（客席側にスツール）の中心
export const PASSAGE = { minX: 4.4, maxX: 6, minZ: KITCHEN_Z - 0.6, maxZ: KITCHEN_Z + 1.6 }; // 厨房への通り道（右はし）
// となりの賭場（丁半・チンチロ・スロット）
export const HALL = { x0: 9, x1: 17, z0: -3, z1: 6, door: [12.1, 13.9] };
export const NAV_BOUNDS = { minX: -22, maxX: 24, minZ: -12, maxZ: 14 };
export const PLAYER_BOUNDS = { minX: -23, maxX: 25, minZ: -13, maxZ: 16 };
export const SPAWN_POINTS = [[-21, 8.0], [23, 8.0], [-21, 7.3], [23, 7.3]];
export const PLAYER_SPAWN = [3.2, -4.6];
export const STAFF_HOME = [5.2, -4.6];
export const DRONE_PAD = [4.5, -8.6]; // 勝手口の外：ドローンが食材を届ける
export const CRATE_AREA = { minX: -10, maxX: -3, minZ: 10.8, maxZ: 13.8 }; // 買った設備（大きい段ボール）が届く所
export const OPEN_TIME = 10 * 60;
export const CLOSE_TIME = 23 * 60;
export const GAME_MIN_PER_SEC = 1.7;
export const SHIPPING_FEE = 500; // ドローン配送1回
export const ORDER_MAX = 20;     // 1回の配送で運べる数（パック）

export const ALL_COLS = [0, 1, 2, 3, 4];
export function colRect(c) { const x0 = SHOP.x0 + c * COL_W; return { id: 'c' + c, c, minX: x0, maxX: x0 + COL_W, minZ: BACK_Z, maxZ: FRONT_Z }; }
export function colAt(x) { const c = Math.floor((x - SHOP.x0) / COL_W); return c >= 0 && c < SHOP.cols ? c : -1; }
export const ownCols = (st) => ALL_COLS.filter((c) => st?.cols?.[c]);
// 使える区画（配置判定・経路探索用）
export function zones(store) {
  const out = [];
  for (const c of ownCols(store)) {
    const r = colRect(c);
    out.push({ ...r, id: 'k' + c, maxZ: KITCHEN_Z, kind: 'kitchen' });
    out.push({ ...r, id: 'd' + c, minZ: KITCHEN_Z, kind: 'dining' });
  }
  out.push({ id: 'hall', minX: HALL.x0, maxX: HALL.x1, minZ: HALL.z0, maxZ: HALL.z1, kind: 'hall' });
  return out;
}
export const inKitchen = (x, z) => z < KITCHEN_Z && z > BACK_Z && x > SHOP.x0 && x < SHOP_X1;
export const inShop = (x, z) => x > BUILDING.minX && x < BUILDING.maxX && z > BUILDING.minZ && z < BUILDING.maxZ;
export const inHall = (x, z, m = 0) => x > HALL.x0 - m && x < HALL.x1 + m && z > HALL.z0 - m && z < HALL.z1 + m;
export const EXPAND_COST = [150000, 600000];
export function expandTargets(store) {
  const own = ownCols(store), out = [];
  for (const c of ALL_COLS) {
    if (store.cols?.[c]) continue;
    const can = own.includes(c + 1) || own.includes(c - 1);
    out.push({ id: c, can, cost: EXPAND_COST[Math.max(0, own.length - START_COLS.length)] ?? 2000000 });
  }
  return out;
}
// 置けない場所（入口・厨房の通り道・勝手口）
export function keepClear() {
  return [
    { minX: -1.6, maxX: 1.6, minZ: 4.2, maxZ: FRONT_Z },
    { ...PASSAGE },
    { minX: 3.7, maxX: 5.3, minZ: BACK_Z, maxZ: BACK_Z + 0.9 },
  ];
}
// 壁（矩形の当たり判定）。type: front=正面, outer=外壁, part=未購入の列との仮壁, hall=賭場の壁
export function getWalls(store) {
  const T = 0.12, w = [];
  const H = (x0, x1, z, type) => { if (x1 - x0 > 0.01) w.push({ minX: x0, maxX: x1, minZ: z - T, maxZ: z + T, type, axis: 'x' }); };
  const V = (z0, z1, x, type) => { if (z1 - z0 > 0.01) w.push({ minX: x - T, maxX: x + T, minZ: z0, maxZ: z1, type, axis: 'z' }); };
  const L = BUILDING.minX, R = BUILDING.maxX;
  H(L, DOOR.x - DOOR.half, FRONT_Z, 'front'); H(DOOR.x + DOOR.half, R, FRONT_Z, 'front');
  V(BACK_Z, FRONT_Z, L, 'outer'); V(BACK_Z, FRONT_Z, R, 'outer'); H(L, R, BACK_Z, 'outer');
  // 未購入の列との境目
  const own = ownCols(store);
  for (const c of own) {
    const r = colRect(c);
    if (c > 0 && !own.includes(c - 1)) V(BACK_Z, FRONT_Z, r.minX, 'part');
    if (c < SHOP.cols - 1 && !own.includes(c + 1)) V(BACK_Z, FRONT_Z, r.maxX, 'part');
  }
  // 賭場
  H(HALL.x0, HALL.door[0], HALL.z1, 'hall'); H(HALL.door[1], HALL.x1, HALL.z1, 'hall');
  H(HALL.x0, HALL.x1, HALL.z0, 'hall'); V(HALL.z0, HALL.z1, HALL.x0, 'hall'); V(HALL.z0, HALL.z1, HALL.x1, 'hall');
  return w;
}

// ---------- スープ・麺・トッピング・サイド ----------
// スープ：寸胴鍋に「スープの材料」を1回分入れて炊く（1回で寸胴鍋の大きさぶんの杯数）
export const SOUPS = {
  shoyu: { name: '醤油', icon: '🟤', color: '#7a4422', lv: 1, add: 0, set: 's_shoyu', desc: '鶏ガラと醤油ダレのすっきり系' },
  shio: { name: '塩', icon: '⚪', color: '#e3cf8f', lv: 3, add: 0, set: 's_shio', desc: '透きとおった鶏ガラ塩スープ' },
  miso: { name: '味噌', icon: '🟠', color: '#c27a2c', lv: 6, add: 100, set: 's_miso', desc: '炒めた野菜と合わせ味噌' },
  tonkotsu: { name: '豚骨', icon: '🥛', color: '#efe3cb', lv: 10, add: 150, set: 's_tonkotsu', desc: '豚骨を強火で炊いた白濁スープ' },
  iekei: { name: '家系', icon: '🟡', color: '#d6a868', lv: 16, add: 200, set: 's_iekei', desc: '豚骨醤油に鶏油（チーユ）' },
  tantan: { name: '担々', icon: '🔴', color: '#c13a22', lv: 22, add: 250, set: 's_tantan', desc: 'ごまと辣油のピリ辛スープ' },
  niboshi: { name: '煮干し', icon: '🐟', color: '#9b8462', lv: 30, add: 200, set: 's_niboshi', desc: '煮干しをたっぷり使った魚介系' },
  black: { name: '富山ブラック', icon: '⚫', color: '#2b1a10', lv: 40, add: 300, set: 's_black', desc: '真っ黒な濃口醤油スープ' },
};
export const SOUP_READY = 30;   // 炊き始めて30秒で使える
export const SOUP_RICH = 120;   // 120秒までコクが増える
// 麺のかたさ：てぼを茹で麺機に入れてからの秒数
export const HARD = {
  katame: { name: 'かため', t: [15, 21] },
  futsu: { name: 'ふつう', t: [21, 27] },
  yawa: { name: 'やわらかめ', t: [27, 33] },
};
export const NOODLE_OVER = 42; // これより長いと「のびた」
export function noodleLabel(sec) {
  if (sec == null) return '';
  if (sec < 12) return '生煮え';
  if (sec < HARD.katame.t[1]) return 'かため';
  if (sec < HARD.futsu.t[1]) return 'ふつう';
  if (sec < NOODLE_OVER) return 'やわらかめ';
  return 'のびた';
}
// トッピング：raw（仕入れる食材）を、まな板で仕込むと per 人前になる
export const TOPPINGS = {
  negi: { name: 'ネギ', icon: '🌿', color: '#69b33f', lv: 1, raw: 'negi', per: 20, prep: 2.4, val: 30 },
  chashu: { name: 'チャーシュー', icon: '🥩', color: '#b9744a', lv: 1, raw: 'chashu', per: 10, prep: 3.2, val: 150 },
  menma: { name: 'メンマ', icon: '🎋', color: '#c99a4e', lv: 1, raw: 'menma', per: 20, prep: 1.6, val: 40 },
  nori: { name: '海苔', icon: '⬛', color: '#1d2a20', lv: 2, raw: 'nori', per: 30, prep: 1.2, val: 30 },
  ajitama: { name: '味玉', icon: '🥚', color: '#f0a52a', lv: 4, raw: 'ajitama', per: 10, prep: 2.8, val: 100 },
  moyashi: { name: 'もやし', icon: '🌱', color: '#f2efd8', lv: 5, raw: 'moyashi', per: 15, prep: 1.6, val: 30 },
  corn: { name: 'コーン', icon: '🌽', color: '#f6cf2c', lv: 7, raw: 'corn', per: 20, prep: 1.0, val: 50 },
  butter: { name: 'バター', icon: '🧈', color: '#fbe38b', lv: 8, raw: 'butter', per: 20, prep: 1.0, val: 60 },
  naruto: { name: 'なると', icon: '🍥', color: '#ffffff', lv: 11, raw: 'naruto', per: 20, prep: 1.8, val: 40 },
  spinach: { name: 'ほうれん草', icon: '🥬', color: '#2f7d32', lv: 14, raw: 'spinach', per: 15, prep: 2.2, val: 40 },
  seabura: { name: '背脂', icon: '🤍', color: '#f7f3ea', lv: 18, raw: 'seabura', per: 20, prep: 1.4, val: 50 },
  karamiso: { name: '辛味噌', icon: '🌶️', color: '#c62828', lv: 20, raw: 'karamiso', per: 20, prep: 1.4, val: 60 },
  kikurage: { name: 'きくらげ', icon: '🍄', color: '#3b2a24', lv: 26, raw: 'kikurage', per: 20, prep: 1.6, val: 50 },
};
// サイドメニュー
export const SIDES = {
  rice: { name: 'ライス', icon: '🍚', lv: 2, fx: 'rice', dish: 'bowlS', price: 200, val: 220 },
  gyoza: { name: '餃子', icon: '🥟', lv: 4, fx: 'gyoza', dish: 'plate', price: 400, val: 450 },
  beer: { name: '生ビール', icon: '🍺', lv: 6, fx: 'beer', dish: 'mug', price: 550, val: 600 },
  chadon: { name: 'チャーシュー丼', icon: '🍖', lv: 9, fx: 'rice', dish: 'bowlS', price: 450, val: 500 },
  karaage: { name: '唐揚げ', icon: '🍗', lv: 14, fx: 'fryer', dish: 'plate', price: 500, val: 560 },
};
// 焼き・揚げのタイミング（秒）：ideal＝ちょうどいい、burn＝焦げ、fire＝火が出る
export const GRIDDLE = {
  gyoza: { name: '餃子', ideal: [16, 24], burn: 31, fire: 48, use: 6, item: 'gyozaF' },
  karaage: { name: '唐揚げ', ideal: [12, 18], burn: 25, fire: 42, use: 4, item: 'chicken' },
};
export const RICE_READY = 25;
export const DISHES = {
  bowl: { name: 'ラーメン丼', icon: '🍜' }, bowlS: { name: '小丼', icon: '🍚' }, plate: { name: '皿', icon: '🍽️' }, mug: { name: 'ジョッキ', icon: '🍺' },
};
export const DIRTY_MAX = 5; // 下げた食器を重ねて持てる数

// ---------- 仕入れ（食材・器） ----------
// pack：1回の注文で届く数（unit） / cost：1パックの値段 / space：冷蔵庫の場所（パック数で数える）
const I = (o) => ({ space: 1, ...o });
export const ING_CATS = { base: { name: '麺・スープ', icon: '🍜' }, top: { name: 'トッピング', icon: '🥢' }, side: { name: 'サイド', icon: '🥟' }, dish: { name: '器', icon: '🍽️' } };
export const INGREDIENTS = {
  men: I({ name: '生麺', icon: '🍜', cat: 'base', unit: '玉', pack: 20, cost: 1600, lv: 1 }),
  ...Object.fromEntries(Object.entries(SOUPS).map(([k, s]) => [s.set, I({ name: `${s.name}スープの材料`, icon: s.icon, cat: 'base', unit: '回分', pack: 1, cost: 2600 + s.add * 8, lv: s.lv, soup: k })])),
  negi: I({ name: '長ねぎ', icon: '🌿', cat: 'top', unit: '束', pack: 3, cost: 600, lv: 1 }),
  chashu: I({ name: '豚バラ肉（煮豚用）', icon: '🥩', cat: 'top', unit: '本', pack: 2, cost: 2400, lv: 1 }),
  menma: I({ name: 'メンマ', icon: '🎋', cat: 'top', unit: '袋', pack: 2, cost: 900, lv: 1 }),
  nori: I({ name: '焼き海苔', icon: '⬛', cat: 'top', unit: '束', pack: 2, cost: 700, lv: 2 }),
  ajitama: I({ name: '卵（10個）', icon: '🥚', cat: 'top', unit: 'パック', pack: 2, cost: 600, lv: 4 }),
  moyashi: I({ name: 'もやし', icon: '🌱', cat: 'top', unit: '袋', pack: 4, cost: 400, lv: 5 }),
  corn: I({ name: 'コーン缶', icon: '🌽', cat: 'top', unit: '缶', pack: 2, cost: 600, lv: 7 }),
  butter: I({ name: 'バター', icon: '🧈', cat: 'top', unit: '箱', pack: 1, cost: 900, lv: 8 }),
  naruto: I({ name: 'なると', icon: '🍥', cat: 'top', unit: '本', pack: 2, cost: 600, lv: 11 }),
  spinach: I({ name: 'ほうれん草', icon: '🥬', cat: 'top', unit: '束', pack: 3, cost: 700, lv: 14 }),
  seabura: I({ name: '背脂', icon: '🤍', cat: 'top', unit: '袋', pack: 1, cost: 1000, lv: 18 }),
  karamiso: I({ name: '辛味噌', icon: '🌶️', cat: 'top', unit: 'パック', pack: 1, cost: 1200, lv: 20 }),
  kikurage: I({ name: 'きくらげ', icon: '🍄', cat: 'top', unit: '袋', pack: 1, cost: 1000, lv: 26 }),
  kome: I({ name: '米（20杯分）', icon: '🌾', cat: 'side', unit: '袋', pack: 1, cost: 1600, lv: 2 }),
  gyozaF: I({ name: '冷凍餃子（30個）', icon: '🥟', cat: 'side', unit: '個', pack: 30, cost: 1800, lv: 4 }),
  taru: I({ name: 'ビール樽（20杯）', icon: '🛢️', cat: 'side', unit: '樽', pack: 1, cost: 5000, lv: 6 }),
  chicken: I({ name: '鶏もも肉（20個）', icon: '🍗', cat: 'side', unit: '個', pack: 20, cost: 2000, lv: 14 }),
  d_bowl: I({ name: 'ラーメン丼（5個）', icon: '🍜', cat: 'dish', unit: '個', pack: 5, cost: 2500, lv: 1, dish: 'bowl', space: 0 }),
  d_bowlS: I({ name: '小丼（5個）', icon: '🍚', cat: 'dish', unit: '個', pack: 5, cost: 1500, lv: 2, dish: 'bowlS', space: 0 }),
  d_plate: I({ name: '皿（5枚）', icon: '🍽️', cat: 'dish', unit: '枚', pack: 5, cost: 1200, lv: 4, dish: 'plate', space: 0 }),
  d_mug: I({ name: 'ジョッキ（5個）', icon: '🍺', cat: 'dish', unit: '個', pack: 5, cost: 2000, lv: 6, dish: 'mug', space: 0 }),
};
for (const [id, p] of Object.entries(INGREDIENTS)) p.id = id;
export const ING_LIST = Object.values(INGREDIENTS);
export const ingUnlocked = (id, lv) => !!INGREDIENTS[id] && (lv || 1) >= INGREDIENTS[id].lv;
// 1人前のだいたいの原価（メニューの原価表示用）
export function unitCost(id) { const p = INGREDIENTS[id]; return p ? p.cost / p.pack : 0; }
export function toppingCost(tid) { const t = TOPPINGS[tid]; return t ? unitCost(t.raw) / t.per : 0; }
export function soupCost(k, sv = 20) { const s = SOUPS[k]; return s ? unitCost(s.set) / sv : 0; }
export function menuCost(m) {
  if (m.kind === 'side') {
    const s = m.side;
    if (s === 'rice') return unitCost('kome') / 20;
    if (s === 'chadon') return unitCost('kome') / 20 + toppingCost('chashu') * 2;
    if (s === 'gyoza') return unitCost('gyozaF') * 6;
    if (s === 'karaage') return unitCost('chicken') * 4;
    if (s === 'beer') return unitCost('taru') / 20;
    return 0;
  }
  return Math.round(soupCost(m.soup) + unitCost('men') + (m.tp || []).reduce((t, x) => t + toppingCost(x), 0));
}
// お客さんが「これくらいなら払う」値段（相場）。これの130%までなら注文してくれる
export function menuValue(m) {
  if (m.kind === 'side') return SIDES[m.side]?.val || 300;
  return 480 + (SOUPS[m.soup]?.add || 0) + (m.tp || []).reduce((t, x) => t + (TOPPINGS[x]?.val || 0), 0);
}
export const PRICE_OK = 1.3;
export const menuLimit = (m) => Math.floor(menuValue(m) * PRICE_OK / 10) * 10;
export const MENU_RAMEN_MAX = (lv) => 3 + Math.floor((lv || 1) / 8);
export const TOP_MAX = 6; // 1杯にのせられるトッピングの種類

// ---------- 設備 ----------
// place: kitchen=厨房, dining=客席, any=店内ならどこでも / seats: 座席 [x, z]（ローカル） / spots: 料理を置く位置 [x, z]
const F = (o) => ({ place: 'any', ...o });
const stools = (n, w) => Array.from({ length: n }, (_, i) => [-w / 2 + (i + 0.5) * w / n, 0.38]);
const tops = (n, w) => Array.from({ length: n }, (_, i) => [-w / 2 + (i + 0.5) * w / n, -0.36]);
export const FIXTURES = {
  // ---- 厨房 ----
  pot: F({ name: '寸胴鍋とコンロ', cat: 'kitchen', icon: '🍲', price: 12000, w: 0.9, d: 0.8, place: 'kitchen', lv: 1, pot: { sv: 20 }, fireRisk: 1, desc: 'スープを炊く。スープの材料を入れて火にかけると30秒で使えるようになり、長く炊くほどコクが出る（20杯分）' }),
  pot2: F({ name: '大寸胴鍋', cat: 'kitchen', icon: '🍲', price: 32000, w: 1.1, d: 0.9, place: 'kitchen', lv: 15, pot: { sv: 35 }, fireRisk: 1, desc: '大きな寸胴鍋。1回で35杯分のスープが炊ける' }),
  boiler: F({ name: '茹で麺機（4てぼ）', cat: 'kitchen', icon: '♨️', price: 15000, w: 1.0, d: 0.8, place: 'kitchen', lv: 1, baskets: 4, desc: '麺を茹でる。てぼを入れてからの秒数で、かため・ふつう・やわらかめが決まる' }),
  boiler6: F({ name: '茹で麺機（6てぼ）', cat: 'kitchen', icon: '♨️', price: 38000, w: 1.4, d: 0.8, place: 'kitchen', lv: 18, baskets: 6, desc: '6つのてぼを同時に茹でられる大型の茹で麺機' }),
  topping: F({ name: 'トッピング台', cat: 'kitchen', icon: '🥢', price: 8000, w: 1.4, d: 0.7, place: 'kitchen', lv: 1, topping: true, desc: '仕込んだトッピングを丼にのせる台' }),
  board: F({ name: 'まな板（仕込み台）', cat: 'kitchen', icon: '🔪', price: 5000, w: 1.2, d: 0.7, place: 'kitchen', lv: 1, board: true, desc: '冷蔵庫の食材を切って、トッピングを仕込む' }),
  fridge: F({ name: '業務用冷蔵庫', cat: 'kitchen', icon: '🧊', price: 15000, w: 1.2, d: 0.8, place: 'kitchen', lv: 1, cap: 40, desc: '届いた食材をしまっておく（40パック分）。ドローンで届いた食材は自動でここに入る' }),
  fridge2: F({ name: '大型冷蔵庫', cat: 'kitchen', icon: '🧊', price: 42000, w: 1.8, d: 0.8, place: 'kitchen', lv: 12, cap: 100, desc: '大きな冷蔵庫（100パック分）' }),
  dishrack: F({ name: '食器棚', cat: 'kitchen', icon: '🍽️', price: 6000, w: 1.2, d: 0.5, place: 'kitchen', lv: 1, rack: true, desc: 'きれいな丼・皿・ジョッキを取る' }),
  sink: F({ name: '洗い場', cat: 'kitchen', icon: '🚰', price: 9000, w: 1.4, d: 0.7, place: 'kitchen', lv: 1, sink: true, desc: '下げた食器を置いて洗う（長押し）。洗った食器は食器棚へ' }),
  pass: F({ name: '受け渡し台', cat: 'kitchen', icon: '🛎️', price: 5000, w: 1.2, d: 0.6, place: 'any', lv: 1, pass: 4, desc: 'できた料理を置いておくと、接客のアルバイトがお客さんに運ぶ' }),
  // ---- サイドメニュー ----
  rice: F({ name: '炊飯器', cat: 'side', icon: '🍚', price: 6000, w: 0.6, d: 0.6, place: 'kitchen', lv: 2, rice: { sv: 20 }, desc: '米を入れて炊く（25秒で20杯分）。ライス・チャーシュー丼に使う' }),
  gyoza: F({ name: '餃子焼き器', cat: 'side', icon: '🥟', price: 14000, w: 0.9, d: 0.7, place: 'kitchen', lv: 4, griddle: 'gyoza', fireRisk: 1, desc: '餃子を6個ずつ焼く。焼きすぎると焦げて、さらに放っておくと火が出る' }),
  beer: F({ name: 'ビールサーバー', cat: 'side', icon: '🍺', price: 16000, w: 0.6, d: 0.6, place: 'any', lv: 6, beer: true, desc: 'ジョッキを持って長押しで注ぐ。泡が7:3くらいで止めるとおいしい' }),
  fryer: F({ name: 'フライヤー', cat: 'side', icon: '🍗', price: 22000, w: 0.8, d: 0.7, place: 'kitchen', lv: 14, griddle: 'karaage', fireRisk: 1, desc: '唐揚げを4個ずつ揚げる。揚げすぎ注意（火が出る）' }),
  // ---- 客席 ----
  table2: F({ name: 'テーブル席（2人）', cat: 'seat', icon: '🪑', price: 9000, w: 1.0, d: 1.7, place: 'dining', lv: 1, seats: [[0, 0.62], [0, -0.62]], spots: [[0, 0.18], [0, -0.18]], top: 0.74, desc: '向かい合わせの2人席' }),
  table4: F({ name: 'テーブル席（4人）', cat: 'seat', icon: '🪑', price: 20000, w: 1.6, d: 1.8, place: 'dining', lv: 7, seats: [[-0.4, 0.68], [0.4, 0.68], [-0.4, -0.68], [0.4, -0.68]], spots: [[-0.4, 0.2], [0.4, 0.2], [-0.4, -0.2], [0.4, -0.2]], top: 0.74, desc: '4人で座れるテーブル席' }),
  zashiki: F({ name: '小上がり（座敷・6人）', cat: 'seat', icon: '🎎', price: 48000, w: 2.6, d: 2.2, place: 'dining', lv: 24, seats: [[-0.8, 0.62], [0, 0.62], [0.8, 0.62], [-0.8, -0.62], [0, -0.62], [0.8, -0.62]], spots: [[-0.8, 0.2], [0, 0.2], [0.8, 0.2], [-0.8, -0.2], [0, -0.2], [0.8, -0.2]], top: 0.62, attract: 0.04, desc: '畳の小上がり。6人座れて、お店の雰囲気もアップ' }),
  ticket: F({ name: '券売機', cat: 'service', icon: '🎫', price: 18000, w: 0.8, d: 0.6, place: 'dining', lv: 1, desc: 'お客さんはここで食券を買う。売上はいったん券売機（レジ）にたまる。泥棒に狙われるので、ときどき回収しよう' }),
  bench: F({ name: '待合ベンチ', cat: 'service', icon: '🪑', price: 4000, w: 1.5, d: 0.5, place: 'dining', lv: 3, wait: 3, desc: '席が空くのを待つお客さんが座る（待つのが少し長くなっても怒りにくい）' }),
  water: F({ name: 'ウォーターサーバー', cat: 'service', icon: '💧', price: 8000, w: 0.5, d: 0.5, place: 'dining', lv: 5, attract: 0.03, desc: 'セルフのお水。待っているお客さんがイライラしにくくなる' }),
  trash: F({ name: '生ゴミ箱', cat: 'service', icon: '🗑️', price: 1500, w: 0.5, d: 0.5, place: 'any', lv: 1, desc: '失敗した料理を捨てる（器は洗い物になる）' }),
  // ---- 防犯・防火 ----
  ext: F({ name: '消火器', cat: 'safety', icon: '🧯', price: 3000, w: 0.4, d: 0.4, place: 'any', lv: 1, desc: '手に持って長押しで消火。火事が大きくなる前に消そう' }),
  shuriken: F({ name: '手裏剣ケース', cat: 'safety', icon: '✴️', price: 4000, w: 0.6, d: 0.4, place: 'any', lv: 3, desc: '手裏剣を8枚持てる。レジを狙う泥棒に投げて撃退しよう' }),
  turret: F({ name: '警備タレット', cat: 'safety', icon: '🛡️', price: 60000, w: 0.6, d: 0.6, place: 'any', lv: 20, turret: { range: 7.5, cd: 1.4 }, desc: '近くに来た泥棒に自動で手裏剣を撃つ' }),
  // ---- 装飾 ----
  plant: F({ name: '観葉植物', cat: 'deco', icon: '🪴', price: 1500, w: 0.5, d: 0.5, place: 'any', lv: 1, desc: '店内に緑を' }),
  maneki: F({ name: '招き猫', cat: 'deco', icon: '🐱', price: 5000, w: 0.5, d: 0.5, place: 'dining', lv: 2, attract: 0.03, desc: 'お客さんを招く（少しお客さんが増える）' }),
  chochin: F({ name: '赤ちょうちん', cat: 'deco', icon: '🏮', price: 3000, w: 0.5, d: 0.5, place: 'any', lv: 3, air: true, desc: '天井から吊るす赤い提灯（下を通れる）' }),
  tanuki: F({ name: '信楽焼のたぬき', cat: 'deco', icon: '🦝', price: 7000, w: 0.6, d: 0.6, place: 'dining', lv: 8, attract: 0.02, desc: '縁起ものの大きなたぬき' }),
  kamidana: F({ name: '神棚', cat: 'deco', icon: '⛩️', price: 12000, w: 1.0, d: 0.4, place: 'any', lv: 10, attract: 0.03, desc: '商売繁盛を祈る神棚' }),
  kumade: F({ name: '熊手', cat: 'deco', icon: '🎋', price: 15000, w: 0.8, d: 0.3, place: 'any', lv: 15, attract: 0.03, desc: '福をかき集める縁起物（お客さんが増える）' }),
  aquarium: F({ name: '金魚の水槽', cat: 'deco', icon: '🐠', price: 25000, w: 1.2, d: 0.5, place: 'dining', lv: 28, attract: 0.04, desc: '泳ぐ金魚で癒やしの空間に' }),
  // ---- 看板 ----
  signstand: F({ name: '立て看板', cat: 'sign', icon: '🪧', price: 2000, w: 0.5, d: 0.5, place: 'any', lv: 1, text: true, desc: '好きな文字を書ける黒板看板' }),
  nobori: F({ name: 'のぼり旗', cat: 'sign', icon: '🎏', price: 2500, w: 0.5, d: 0.5, place: 'any', lv: 4, text: true, desc: '「ラーメン」などの文字ののぼり旗' }),
  menuboard: F({ name: 'お品書き', cat: 'sign', icon: '📜', price: 3500, w: 1.0, d: 0.3, place: 'any', lv: 2, desc: '今日のメニューと値段を書いた木の札（自動で書きかわる）' }),
  neon: F({ name: 'ネオン看板', cat: 'sign', icon: '💡', price: 6000, w: 1.0, d: 0.5, place: 'any', lv: 12, text: true, desc: '光る文字の看板' }),
  // ---- 固定（建物の一部） ----
  counter: F({ name: 'カウンター席', cat: 'fixed', icon: '🍥', price: 0, w: 4, d: 1.4, fixed: true, seats: stools(4, 4), spots: tops(4, 4), top: 0.95, desc: '厨房と客席の間のカウンター' }),
  counter2: F({ name: 'カウンター席', cat: 'fixed', icon: '🍥', price: 0, w: 2.4, d: 1.4, fixed: true, seats: stools(2, 2.4), spots: tops(2, 2.4), top: 0.95, desc: '厨房と客席の間のカウンター' }),
  pc: F({ name: 'パソコン', cat: 'fixed', icon: '💻', price: 0, w: 1.6, d: 0.8, fixed: true, desc: '仕入れ・メニュー・アルバイト・お店の設定' }),
  opensign: F({ name: 'のれん掛けの札', cat: 'fixed', icon: '🪧', price: 0, w: 0.6, d: 0.5, fixed: true, desc: '「営業中」にするとお客さんが来る' }),
  chohan: F({ name: '丁半の盆', cat: 'fixed', icon: '🎲', price: 0, w: 3.0, d: 1.8, fixed: true, gamble: 'chohan', desc: '壺振りがサイコロ2つを振る。合計が偶数なら丁、奇数なら半' }),
  chinchiro: F({ name: 'チンチロの卓', cat: 'fixed', icon: '🥣', price: 0, w: 1.6, d: 1.6, fixed: true, gamble: 'chinchiro', desc: 'どんぶりにサイコロ3つ。親（胴元）と役の強さで勝負' }),
  slot: F({ name: 'スロット台', cat: 'fixed', icon: '🎰', price: 0, w: 0.8, d: 0.7, fixed: true, gamble: 'slot', desc: '3つのリールをそろえよう' }),
};
export const FIXTURE_CATS = { kitchen: '厨房', side: 'サイド', seat: '客席', service: '接客', safety: '防犯・防火', deco: '装飾', sign: '看板' };
const priceUp = (lv) => ((lv || 1) <= 1 ? 1 : 1.1 + 0.5 * Math.min(1, ((lv || 1) - 2) / 48));
for (const [id, f] of Object.entries(FIXTURES)) { f.id = id; if (f.price && !f.fixed) f.price = Math.round(f.price * priceUp(f.lv) / 100) * 100; }
export const isCounter = (t) => t === 'counter' || t === 'counter2';
export const SEAT_TYPES = Object.keys(FIXTURES).filter((k) => FIXTURES[k].seats);

export function fixtureFootprint(fx, x, z, r) {
  const def = FIXTURES[fx];
  const rw = r % 2 ? def.d : def.w, rd = r % 2 ? def.w : def.d;
  return { minX: x - rw / 2, maxX: x + rw / 2, minZ: z - rd / 2, maxZ: z + rd / 2, rw, rd };
}
export function snapFixture(type, x, z, r) {
  const fp = fixtureFootprint(type, 0, 0, r);
  const minX = Math.round((x - fp.rw / 2) / CELL) * CELL, minZ = Math.round((z - fp.rd / 2) / CELL) * CELL;
  return [minX + fp.rw / 2, minZ + fp.rd / 2];
}
export function localToWorld(f, lx, lz) {
  const a = f.r * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  return [f.x + lx * c + lz * s, f.z - lx * s + lz * c];
}
export function worldToLocal(f, wx, wz) {
  const a = -f.r * Math.PI / 2, c = Math.cos(a), s = Math.sin(a);
  const dx = wx - f.x, dz = wz - f.z;
  return [dx * c + dz * s, -dx * s + dz * c];
}
// 設備の前（人が立って使う所）
export function frontSpot(f, off = 0.55) { const d = FIXTURES[f.t]; return localToWorld(f, 0, d.d / 2 + off); }
// 座席：座る位置・席に行くために立つ位置・料理を置く位置・座ったときの向き
export function seatPos(f, si) { const [x, z] = FIXTURES[f.t].seats[si]; return localToWorld(f, x, z); }
export function seatAccess(f, si) {
  const d = FIXTURES[f.t], [x, z] = d.seats[si];
  return localToWorld(f, x, Math.sign(z || 1) * (d.d / 2 + 0.38));
}
export function seatSpot(f, si) { const [x, z] = FIXTURES[f.t].spots[si]; return localToWorld(f, x, z); }
export function seatYaw(f, si) { const [ax, az] = seatPos(f, si), [bx, bz] = seatSpot(f, si); return Math.atan2(bx - ax, bz - az); }
// 狙った点（ローカル座標）にいちばん近い席
export function pickSeat(type, lx, lz) {
  const d = FIXTURES[type]; if (!d.seats) return -1;
  let best = -1, bd = 1e9;
  d.seats.forEach(([x, z], i) => { const s = d.spots[i]; const dd = Math.min((lx - x) ** 2 + (lz - z) ** 2, (lx - s[0]) ** 2 + (lz - s[1]) ** 2 * 1.4); if (dd < bd) { bd = dd; best = i; } });
  return best;
}
// 茹で麺機のてぼの位置（ローカル）
export function basketPos(type, i) { const n = FIXTURES[type].baskets, w = FIXTURES[type].w; return [-w / 2 + (i % (n / 2) + 0.5) * w / (n / 2), i < n / 2 ? 0.12 : -0.14]; }
export function pickBasket(type, lx, lz) {
  const n = FIXTURES[type].baskets || 0; let best = -1, bd = 1e9;
  for (let i = 0; i < n; i++) { const [x, z] = basketPos(type, i); const d = (lx - x) ** 2 + (lz - z) ** 2; if (d < bd) { bd = d; best = i; } }
  return best;
}
export function passPos(type, i) { const n = FIXTURES[type].pass, w = FIXTURES[type].w; return [-w / 2 + (i + 0.5) * w / n, 0]; }
export function pickPass(type, lx) { const n = FIXTURES[type].pass || 0, w = FIXTURES[type].w; return Math.max(0, Math.min(n - 1, Math.floor((lx + w / 2) / (w / n)))); }
// 券売機：お客さんが立つ場所と並ぶ列
export function ticketSpot(f, i) { return localToWorld(f, 0, 0.62 + Math.max(0, i) * 0.72); }

// ---------- アルバイト ----------
export const STAFF_ROLES = {
  auto: { name: 'おまかせ', icon: '🔄', desc: '注文があれば調理、手が空いたら配膳・片付け・洗い物' },
  cook: { name: '調理', icon: '👨‍🍳', desc: 'スープを炊く・トッピングを仕込む・ラーメンとサイドを作って受け渡し台に置く' },
  hall: { name: '接客', icon: '🙋', desc: '受け渡し台の料理をお客さんに運び、食べ終わった食器を下げる' },
  wash: { name: '洗い場', icon: '🫧', desc: '下げた食器を洗って食器棚にもどす' },
};
export const SPEEDS = [
  null,
  { id: 1, name: 'とても遅い', icon: '🐢', k: 0.5 },
  { id: 2, name: '遅い', icon: '🐌', k: 0.72 },
  { id: 3, name: '普通', icon: '🙂', k: 1.0 },
  { id: 4, name: '早い', icon: '🏃', k: 1.4 },
  { id: 5, name: 'とても早い', icon: '⚡', k: 1.9 },
];
// 雇える人（No.1〜8）。cook：調理のはやさ　hall：接客・洗い物のはやさ
export const STAFF_SLOTS = [
  { no: 1, lv: 3, cook: 1, hall: 2, lic: 8000, wage: 1800 },
  { no: 2, lv: 6, cook: 2, hall: 1, lic: 16000, wage: 2600 },
  { no: 3, lv: 10, cook: 2, hall: 3, lic: 36000, wage: 4000 },
  { no: 4, lv: 15, cook: 3, hall: 2, lic: 70000, wage: 6500 },
  { no: 5, lv: 21, cook: 3, hall: 3, lic: 120000, wage: 9000 },
  { no: 6, lv: 28, cook: 4, hall: 3, lic: 200000, wage: 14000 },
  { no: 7, lv: 36, cook: 3, hall: 5, lic: 320000, wage: 20000 },
  { no: 8, lv: 45, cook: 5, hall: 5, lic: 500000, wage: 30000 },
];
export const STAFF_MAX = STAFF_SLOTS.length;
export const hasStaffLicense = (store, no) => !!store?.slic?.[no];
export const staffSlotOpen = (level, no) => (level || 1) >= (STAFF_SLOTS[no - 1]?.lv ?? 999);
export const staffLimit = (level) => STAFF_SLOTS.filter((s) => (level || 1) >= s.lv).length;
export const staffK = (s, job) => SPEEDS[(job === 'cook' ? s.cook : s.hall) || 1]?.k || 0.5;
export const STAFF_NAMES = ['たなか', 'すずき', 'さとう', 'やまだ', 'こばやし', 'いとう', 'わたなべ', 'なかむら', 'かとう', 'よしだ', 'まつもと', 'いのうえ', 'きむら', 'はやし', 'しみず', 'もり', 'あべ', 'いけだ', 'はしもと', 'やまもと'];

// ---------- 賭場 ----------
export const GAMBLES = {
  chohan: { name: '丁半博打', icon: '🎲', lv: 1, desc: '壺振りが2つのサイコロを振る。合計が偶数なら「丁」、奇数なら「半」。当たると賭け金の2倍（寺銭5%を引く）' },
  chinchiro: { name: 'チンチロリン', icon: '🥣', lv: 8, desc: '親（胴元）と子がどんぶりに3つのサイコロを振って、役の強さで勝負。ピンゾロは5倍、ゾロ目は3倍、シゴロは2倍' },
  slot: { name: 'スロット', icon: '🎰', lv: 12, desc: '3つのリールの絵柄をそろえる。7・7・7で200倍！' },
};
export const BET_CHIPS = [100, 1000, 5000, 10000, 50000, 100000];
export const CHOHAN_FEE = 0.05; // 寺銭
export const CHOHAN_T = { bet: 14, roll: 2.6, show: 5 };
export const SLOT_SYMS = [['🍒', 8], ['🔔', 6], ['🍉', 5], ['🍜', 4], ['BAR', 3], ['7', 1]];
export const SLOT_PAY = { '7': 200, BAR: 40, '🍜': 20, '🍉': 12, '🔔': 8, '🍒': 5 };
export const SLOT_CHERRY2 = 2.5;

// ---------- お店のレベル（最大50） ----------
export const MAX_LEVEL = 50;
export const xpOf = (yen, q = 70) => Math.max(1, Math.round(Math.sqrt(Math.max(0, yen)) / 3 * (0.6 + q / 200)));
const XP_LV = [[1, 90], [3, 200], [5, 330], [8, 600], [10, 800], [15, 1400], [20, 2500], [25, 4200], [30, 5600], [35, 7000], [40, 9000], [45, 10500], [49, 12000]];
export function xpNeed(level) {
  const L = Math.min(49, Math.max(1, level || 1));
  let i = 0; while (i < XP_LV.length - 2 && XP_LV[i + 1][0] < L) i++;
  const [l0, v0] = XP_LV[i], [l1, v1] = XP_LV[i + 1], t = Math.min(1, Math.max(0, (L - l0) / (l1 - l0)));
  return Math.round(Math.exp(Math.log(v0) + (Math.log(v1) - Math.log(v0)) * t) / 10) * 10;
}
export const TICKET_LV = [[12, 2], [28, 3]];
export function ticketLimit(level) { let n = 1; for (const [l, k] of TICKET_LV) if ((level || 1) >= l) n = k; return n; }
export function fixtureUnlocked(t, level) { const f = FIXTURES[t]; return !!f && !f.fixed && (level || 1) >= (f.lv || 1); }
export function unlocksAt(lv) {
  const out = [];
  if (lv <= 1) return out;
  for (const [k, s] of Object.entries(SOUPS)) if (s.lv === lv) out.push({ k: 'soup', icon: s.icon, name: `${s.name}スープ` });
  for (const [, t] of Object.entries(TOPPINGS)) if (t.lv === lv) out.push({ k: 'top', icon: t.icon, name: `トッピング「${t.name}」` });
  for (const [, s] of Object.entries(SIDES)) if (s.lv === lv) out.push({ k: 'side', icon: s.icon, name: `サイド「${s.name}」` });
  for (const [, f] of Object.entries(FIXTURES)) if (!f.fixed && f.lv === lv) out.push({ k: 'fx', icon: f.icon, name: f.name });
  for (const s of STAFF_SLOTS) if (s.lv === lv) out.push({ k: 'staff', icon: '🧑‍🍳', name: `アルバイト No.${s.no}（雇用ライセンス ¥${s.lic.toLocaleString()}）` });
  for (const [l, n] of TICKET_LV) if (l === lv) out.push({ k: 'reg', icon: '🎫', name: `券売機を${n}台まで置ける` });
  for (const [, g] of Object.entries(GAMBLES)) if (g.lv === lv) out.push({ k: 'gamble', icon: g.icon, name: `賭場で「${g.name}」が遊べる` });
  if (lv % 8 === 0) out.push({ k: 'menu', icon: '📜', name: `ラーメンのメニューを${MENU_RAMEN_MAX(lv)}品まで作れる` });
  if (lv === 3) out.push({ k: 'thief', icon: '🥷', name: '泥棒が来るようになる（手裏剣で撃退）' });
  if (lv === 5) out.push({ k: 'critic', icon: '🕶️', name: 'ラーメン評論家が来るようになる' });
  return out;
}
export function closeTime() { return CLOSE_TIME; }
export const CHAT_PRESETS = ['スープ炊くね', '麺あげて！', '洗い物するね', '仕込みやる', '配膳お願い！', '泥棒だ！', '火事！消火器！', 'ナイス！', 'ありがとう！', '丁半いこうぜ', '開店しよう！', 'ちょっと待って'];
