// ===== 商品の絵（3Dモデルを撮影した画像）=====
// パソコン・注文票・手に持っている物・券売機など、画面に出す商品の絵はぜんぶここから取る。
// 3Dで使っているモデルをそのまま撮影するので、どこで見ても同じ見た目になる。
// key の例： 'ing:men'（仕入れる食材） 'tp:chashu'（仕込んだトッピング） 'soup:miso'
//            'menu:shoyu:chashu.negi'（メニューのラーメン） 'side:gyoza' 'dish:bowl'（器）
//            'd:<dishKey>'（手に持っている料理。spec.d に料理のデータ）
const urls = new Map(), canv = new Map(), waiting = new Map(), queue = [], specs = new Map();
let shooter = null;
// 撮影する関数を登録する（render.js から）
export function setShooter(fn) { shooter = fn; }
export function thumbUrl(key) { return urls.get(key) || null; }
export function thumbCanvas(key) { return canv.get(key) || null; }
// 撮影を予約（すでにあれば何もしない）
export function requestThumb(key, spec = {}) {
  if (urls.has(key) || specs.has(key)) return;
  specs.set(key, spec); queue.push(key);
}
// 1フレームに少しずつ撮影する
export function thumbTick(budgetMs = 6) {
  if (!shooter || !queue.length) return;
  const t0 = performance.now();
  while (queue.length && performance.now() - t0 < budgetMs) {
    const key = queue.shift(), spec = specs.get(key) || {};
    let res = null;
    try { res = shooter(key, spec); } catch (e) { res = null; }
    urls.set(key, res?.url || null); if (res?.canvas) canv.set(key, res.canvas);
    const set = waiting.get(key); waiting.delete(key);
    if (set) for (const el of set) fill(el, res?.url);
    for (const f of listeners) { try { f(key); } catch (e) { /* noop */ } }
  }
}
const listeners = new Set();
export function onThumb(f) { listeners.add(f); return () => listeners.delete(f); }
function fill(el, url) {
  if (!url) { el.classList.add('none'); return; }
  el.textContent = ''; const im = document.createElement('img'); im.src = url; im.alt = ''; im.draggable = false; el.append(im); el.classList.add('ok');
}
// 商品の絵の要素を作る。まだ撮影していなければ絵文字を出しておいて、できたら差しかえる
export function pimg(key, fallback = '', cls = '', spec) {
  const el = document.createElement('span'); el.className = 'pimg' + (cls ? ' ' + cls : '');
  const url = urls.get(key);
  if (url) fill(el, url);
  else {
    el.textContent = fallback;
    if (url === undefined && shooter) { requestThumb(key, spec || {}); let s = waiting.get(key); if (!s) { s = new Set(); waiting.set(key, s); } s.add(el); }
  }
  return el;
}
// メニュー1品の絵のキー
export function menuKey(m) {
  if (!m) return '';
  if (m.kind === 'side') return 'side:' + m.side;
  return 'menu:' + m.soup + ':' + (m.tp || []).join('.');
}
