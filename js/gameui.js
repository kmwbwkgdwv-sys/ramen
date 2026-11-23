// ===== ゲーム中のUI（HUD・注文票・パソコン・調理の選択・賭場・建築・チャット） =====
import { h, $, modal, toast, confirmBox, promptBox } from './ui.js';
import {
  FIXTURES, FIXTURE_CATS, SOUPS, BROTHS, TARES, POT_PER, CASH_CHOICES, DRY_MAX, soupRecipe, TOPPINGS, SIDES, HARD, DISHES, DIRTY_MAX, INGREDIENTS, ING_LIST, ING_CATS, STAFF_ROLES, STAFF_SLOTS, STAFF_MAX, SPEEDS, STAFF_NAMES, GAMBLES, BET_CHIPS, CHOHAN_FEE, CHOHAN_T, SLOT_PAY, SLOT_CHERRY2, SLOT_SYMS,
  hasStaffLicense, fixtureUnlocked, staffLimit, xpNeed, closeTime, CHAT_PRESETS, SHOP, ALL_COLS, expandTargets, MAX_LEVEL, unlocksAt, ticketLimit, ingUnlocked, SHIPPING_FEE, ORDER_MAX,
  menuValue, menuLimit, menuCost, MENU_RAMEN_MAX, TOP_MAX, OPEN_TIME,
} from './data.js';
import { orderTotal, orderCost, fridgeCap, fridgeUsed, customerFactors, repStars, menuAvailable } from './sim.js';
import { yen, fmtTime, mulberry32 } from './util.js';
import { pimg, menuKey } from './thumbs.js';
import { dishKey } from './models/food.js';
import { dishText } from './game.js';

const PHASE = { prep: '準備中', open: '営業中', closing: '店じまい', summary: '本日の結果' };
const lineName = (st, l) => (l[0] === 'ramen' ? st.menu.find((m) => m.id === l[1])?.name || 'ラーメン' : SIDES[l[0]]?.name || l[0]);
const lineIcon = (l) => (l[0] === 'ramen' ? '🍜' : SIDES[l[0]]?.icon || '🍽️');

export class GameUI {
  constructor() {
    this.hud = $('#hud'); this.hud.innerHTML = '';
    const H = this.hud;
    this.day = h('div', { class: 'hud-chip' }); this.openBtn = h('button', { class: 'hud-open' });
    this.money = h('div', { class: 'hud-chip money' });
    this.lvText = h('span'); this.lvBar = h('i');
    this.ordBtn = h('button', { class: 'hud-chip binder', title: '注文票（C）' }, '📋');
    this.rep = h('button', { class: 'hud-chip rep', title: '評判と口コミ（Tab）' });
    this.lv = h('button', { class: 'hud-chip lv', title: 'レベルとできるようになること' }, this.lvText, h('div', { class: 'bar' }, this.lvBar));
    H.append(h('div', { class: 'hud-top' }, this.day, this.openBtn, this.money, this.lv, this.rep, this.ordBtn));
    this.roomInfo = h('div', { class: 'room-info hidden' }); H.append(this.roomInfo);
    this.cross = h('div', { class: 'crosshair' }); H.append(this.cross);
    this.hint = h('div', { class: 'hint hidden' }); H.append(this.hint);
    this.info = h('div', { class: 'target-info hidden' }); H.append(this.info);
    this.chatLog = h('div', { class: 'chatlog' }); H.append(this.chatLog);
    this.keys = h('div', { class: 'pc-keys' }); H.append(this.keys);
    this.build = h('div', { class: 'build-ui hidden' }); H.append(this.build);
    this.orders = h('div', { class: 'orders' }); H.append(this.orders);
    this.alerts = h('div', { class: 'alerts' }); H.append(this.alerts);
    this.gaugeBar = h('i'); this.gaugeTxt = h('b'); this.gaugeIc = h('span', { class: 'sg-ic' }, '🧯');
    this.gauge = h('div', { class: 'spray-gauge hidden' }, this.gaugeIc, h('div', { class: 'sg-bar' }, this.gaugeBar), this.gaugeTxt); H.append(this.gauge);
    this.guideEl = h('div', { class: 'guide hidden' }); H.append(this.guideEl);
    this.edgeEl = h('div', { class: 'guide-edge hidden' }, h('i')); H.append(this.edgeEl);
    this.handEl = h('div', { class: 'hand-card hidden' }); H.append(this.handEl);
    this._hudT = 0; this.open = null; this.ordOpen = true;
  }
  // 「次にやること」と、画面の外にあるときの矢印
  setGuide(text, edge, urgent, near) {
    const on = !!text && !this.open;
    if (this.guideEl._on !== on) { this.guideEl.classList.toggle('hidden', !on); this.guideEl._on = on; }
    if (on && this.guideEl._t !== text) { this.guideEl._t = text; this.guideEl.innerHTML = ''; this.guideEl.append(h('span', { class: 'gl' }, '次'), h('span', {}, text)); }
    this.guideEl.classList.toggle('urgent', !!urgent); this.guideEl.classList.toggle('near', !!near);
    const eon = on && edge != null;
    if (this.edgeEl._on !== eon) { this.edgeEl.classList.toggle('hidden', !eon); this.edgeEl._on = eon; }
    if (eon) { const c = Math.cos(edge), sn = Math.sin(edge), k = Math.min(0.42 / Math.max(1e-3, Math.abs(c)), 0.36 / Math.max(1e-3, Math.abs(sn))); this.edgeEl.style.left = (50 + c * k * 100) + '%'; this.edgeEl.style.top = (50 + sn * k * 100) + '%'; this.edgeEl.style.transform = `translate(-50%,-50%) rotate(${edge}rad)`; this.edgeEl.classList.toggle('urgent', !!urgent); }
  }
  // 手に持っている物（絵と説明）
  setHand(hd) {
    const key = !hd ? '' : hd.t === 'dish' ? 'd' + dishKey(hd.d) + (hd.d.men != null ? Math.floor(hd.d.men) : '') + (hd.d.fill != null ? Math.round(hd.d.fill * 20) : '') : hd.t === 'dirty' ? 'x' + hd.a.join('.') : hd.t + (hd.n ?? Math.round((hd.u || 0) * 20));
    if (key === this.handEl._k) return;
    this.handEl._k = key; this.handEl.innerHTML = ''; this.handEl.classList.toggle('hidden', !hd);
    if (!hd) return;
    if (hd.t === 'dish') this.handEl.append(pimg('d:' + dishKey(hd.d), '🍜', 'hc', { d: hd.d }), h('div', { class: 'hc-t' }, h('small', {}, '手に持っている'), h('b', {}, dishText(hd.d))));
    else if (hd.t === 'dirty') this.handEl.append(pimg('d:dirty' + hd.a.join('.'), '🍽️', 'hc', { d: { k: 'dirty', a: hd.a } }), h('div', { class: 'hc-t' }, h('small', {}, '下げた食器'), h('b', {}, `${hd.a.length}/${DIRTY_MAX}枚`)));
    else if (hd.t === 'ext') this.handEl.append(pimg('tool:ext', '🧯', 'hc'), h('div', { class: 'hc-t' }, h('small', {}, '消火器'), h('b', {}, `残り ${Math.round((hd.u || 0) * 100)}%`)));
    else if (hd.t === 'shuri') this.handEl.append(pimg('tool:shuri', '✴️', 'hc'), h('div', { class: 'hc-t' }, h('small', {}, '手裏剣'), h('b', {}, `残り ${hd.n}枚`)));
  }
  show(v) { this.hud.classList.toggle('hidden', !v); }
  bind(game) {
    this.g = game;
    this.openBtn.onclick = () => { const ph = game.store.phase; toast(ph === 'prep' ? '🪧 店の外の札を「営業中」にすると、お客さんが来ます' : ph === 'open' ? '🪧 店じまいは外の札を「準備中」に' : '⏳ 残りのお客さんが食べ終わるのを待とう'); };
    this.lv.onclick = () => { if (!this.open) this.openLevel(); };
    this.rep.onclick = () => { if (!this.open) this.openRep(); };
    this.ordBtn.onclick = () => this.toggleOrders();
  }
  toggleOrders() { this.ordOpen = !this.ordOpen; this.orders.classList.toggle('hidden', !this.ordOpen); this._ordKey = ''; }
  updateHUD(dt, store, dyn, force) {
    this._hudT -= dt;
    if (this._hudT > 0 && !force) return;
    this._hudT = 0.2;
    if (!store) return;
    const t = dyn?.time ?? store.time, ph = store.phase;
    this.day.innerHTML = `📅 ${store.day}日目 <b>${fmtTime(t)}</b> <small>${PHASE[ph] || ''}</small>`;
    this.openBtn.textContent = ph === 'prep' ? '🔴 準備中' : ph === 'open' ? '🏮 営業中' : ph === 'closing' ? '⏳ 店じまい中' : '📊 集計中';
    this.openBtn.classList.toggle('isopen', ph === 'open'); this.openBtn.classList.toggle('pulse', ph === 'prep');
    this.money.innerHTML = `💴 ${yen(store.money)}${store.till > 0 ? ` <small>レジ ${yen(store.till)}</small>` : ''}`;
    const maxed = store.level >= MAX_LEVEL;
    this.lvText.textContent = 'Lv.' + store.level + (maxed ? ' MAX' : '');
    this.lvBar.style.width = (maxed ? 100 : Math.min(100, store.xp / xpNeed(store.level) * 100)) + '%';
    this.rep.textContent = '⭐ ' + repStars(store.rep).toFixed(1);
    // 警告（火事・泥棒・ドローン）
    const al = [];
    if (dyn?.f?.length) al.push(['fire', `🔥 火事！ ${dyn.f.length}か所 → 🧯消火器で消そう`]);
    if (dyn?.th && dyn.th[5] !== 'down') al.push(['thief', dyn.th[5] === 'run' ? '🥷 泥棒が逃げていく！手裏剣を当てよう' : '🥷 泥棒がレジを狙っている！']);
    if (dyn?.dl?.length) al.push(['drone', `🚁 ドローン配送中 ×${dyn.dl.length}（あと${Math.ceil(Math.min(...dyn.dl))}秒）`]);
    const dirtyS = store.fixtures.reduce((n, f) => n + (f.dd || []).filter((x) => x.length).length, 0);
    if (dirtyS >= 2) al.push(['dish', `🍽️ 片付けていない席 ${dirtyS}`]);
    const clean = store.dish?.bowl || 0; if (ph !== 'prep' && clean <= 2) al.push(['dish', `🍜 きれいな丼があと${clean}個（洗い場で洗おう）`]);
    const k = JSON.stringify(al);
    if (k !== this._alKey) { this._alKey = k; this.alerts.innerHTML = ''; for (const [c, tx] of al) this.alerts.append(h('div', { class: 'alert ' + c }, tx)); }
  }
  // ---------- 注文票（左の一覧） ----------
  updateOrders(store, dyn, clk, sel) {
    if (!this.ordOpen || !store) return;
    const os = (dyn?.o || []).slice().sort((a, b) => b[2] - a[2]);
    const key = JSON.stringify([os.map((o) => [o[0], o[1], Math.floor(o[2] / 5), o[3] < 30, o[5]]), sel, store.menu.length]);
    if (key === this._ordKey) return;
    this._ordKey = key;
    const O = this.orders; O.innerHTML = '';
    O.append(h('div', { class: 'ord-h' }, h('b', {}, `📋 注文票 ${os.length ? os.length + '件' : ''}`), h('button', { class: 'ord-x', onclick: () => this.toggleOrders() }, '×')));
    if (!os.length) { O.append(h('div', { class: 'ord-empty' }, store.phase === 'open' ? 'お客さんを待っています…' : '営業中になると注文が来ます')); return; }
    for (const o of os.slice(0, 7)) {
      const [cid, label, wait, pat, critic, lines] = o;
      const el = h('div', { class: 'ticket' + (sel === cid ? ' sel' : '') + (pat < 30 ? ' late' : '') + (critic ? ' critic' : ''), onclick: () => { this.g.selOrder = sel === cid ? null : cid; this._ordKey = ''; } },
        h('div', { class: 'tk-h' }, h('b', {}, (critic ? '🕶️ ' : '') + label), h('span', {}, `${wait}秒`)),
        ...lines.map((l) => {
          const m = l[0] === 'ramen' ? store.menu.find((x) => x.id === l[1]) : null;
          return h('div', { class: 'tk-l' + (l[3] ? ' done' : '') + (l[4] ? ' cook' : '') },
            l[3] ? h('span', { class: 'tk-i' }, '✅') : pimg(m ? menuKey(m) : 'side:' + l[0], lineIcon(l), 'tk-img' + (l[4] ? ' cook' : '')),
            h('span', { class: 'tk-n' }, lineName(store, l)),
            m ? h('span', { class: 'tk-d' }, h('b', { class: 'hard h-' + l[2] }, '麺' + (HARD[l[2]]?.name || '')), ` ${SOUPS[m.soup]?.name || ''}・${m.tp.map((x) => TOPPINGS[x]?.name).join('・') || 'トッピングなし'}`) : null);
        }));
      O.append(el);
    }
    if (os.length > 7) O.append(h('div', { class: 'ord-empty' }, `ほか ${os.length - 7}件`));
  }
  setRoom(text) { this.roomInfo.classList.toggle('hidden', !text); this.roomInfo.innerHTML = ''; if (text) this.roomInfo.append(...text); }
  setHint(text, info) {
    this.hint.classList.toggle('hidden', !text);
    if (this.hint._t !== text) { this.hint.textContent = text || ''; this.hint._t = text; }
    this.info.classList.toggle('hidden', !info);
    if (info && this.info._t !== info) { this.info.innerHTML = info; this.info._t = info; }
  }
  setGauge(g) {
    const on = !!g;
    if (this.gauge._on !== on) { this.gauge.classList.toggle('hidden', !on); this.gauge._on = on; }
    if (!on) return;
    const [v, ic, lb] = g, pct = Math.max(0, Math.min(100, Math.round(v * 100)));
    const k = pct + ic + (lb || '');
    if (this.gauge._k === k) return; this.gauge._k = k;
    this.gaugeIc.textContent = ic; this.gaugeBar.style.width = pct + '%'; this.gaugeTxt.textContent = lb || pct + '%';
    this.gauge.classList.toggle('low', ic === '🧯' && pct <= 25);
  }
  setKeys(text) { if (this.keys._t !== text) { this.keys.textContent = text; this.keys._t = text; } }
  showCross(v) { this.cross.classList.toggle('hidden', !v); }

  // ---------- 調理の選択 ----------
  // 寸胴鍋に入れる材料（何回でも足せる）
  openPotPicker(fid) {
    const g = this.g, body = h('div', {});
    const draw = () => {
      const st = g.store, f = g.fx(fid), P = f?.pot, def = f && FIXTURES[f.t]; if (!def) return;
      const cap = def.pot.sv / POT_PER, mains = Object.entries(P?.n || {}).filter(([k]) => INGREDIENTS[k]?.broth).reduce((t, [, v]) => t + v, 0);
      body.innerHTML = '';
      body.append(h('div', { class: 'pot-now' }, h('b', {}, '鍋の中：'), P?.n && Object.keys(P.n).length ? Object.entries(P.n).map(([k, n]) => h('span', { class: 'chip img' }, pimg('ing:' + k, INGREDIENTS[k].icon, 'ci'), `${INGREDIENTS[k].name.split('（')[0]}×${n}`)) : h('span', { class: 'muted' }, '水だけ'), P?.b ? h('span', { class: 'chip on' }, `→ ${BROTHS[P.b].name}・${P.sv}杯分`) : null));
      const list = ING_LIST.filter((p) => p.cat === 'soup' && st.level >= p.lv);
      body.append(h('div', { class: 'pick-grid' }, list.map((p) => {
        const n = st.stock[p.id] || 0, full = p.broth ? mains >= cap : (P?.n?.[p.id] || 0) >= 2;
        const note = p.broth ? `${BROTHS[p.broth].short}スープ・1つで${POT_PER}杯分` : p.id === 'yasai' ? '香りが立つ（品質＋）' : 'うま味が出る（品質＋）';
        return h('button', { class: 'pick' + (n && !full ? '' : ' none'), onclick: () => { if (!n) { toast(`${p.name}がありません（パソコンで仕入れよう）`, 'warn'); return; } if (full) { toast(p.broth ? `この鍋に入る骨などは${cap}つまで` : 'もう十分入っています', 'warn'); return; } g.act({ t: 'potAdd', fid, id: p.id }); setTimeout(draw, 120); } },
          pimg('ing:' + p.id, p.icon, 'pi'), h('b', {}, p.name.split('（')[0]), h('small', {}, `在庫 ${n}`), h('small', { class: 'muted' }, note));
      })));
      body.append(h('p', { class: 'muted small' }, `骨などの材料（鶏ガラ・豚骨・煮干し）を入れると、いちばん多い材料のだしになります（この鍋は${cap}つまで＝${def.pot.sv}杯分）。入れたら火をつけて、出てきたアクを取ろう`));
      body.append(h('div', { class: 'row-end' }, P?.b && !P.fire ? h('button', { class: 'btn', onclick: () => { g.act({ t: 'fire', fid }); m.close(); } }, '🔥 火をつける') : null, h('button', { class: 'btn ghost', onclick: () => m.close() }, 'とじる')));
    };
    const m = modal('🍲 寸胴鍋に材料を入れる', [body], { onClose: () => this.closed() });
    this.opened(m); draw();
  }
  openSoupPicker(fid) { return this.openPotPicker(fid); }
  // タレ（かえし）：作る／丼に入れる
  openTarePicker(fid, mode = 'in') {
    const g = this.g, st = g.store, make = mode === 'make';
    const list = Object.entries(TARES).filter(([, T]) => st.level >= T.lv);
    const grid = h('div', { class: 'pick-grid' }, list.map(([k, T]) => {
      const raw = st.stock[T.raw] || 0, have = st.tare?.[k] || 0, ok = make ? raw > 0 : have > 0;
      const uses = Object.values(SOUPS).filter((S) => S.tare === k && st.level >= S.lv).map((S) => S.name).join('・');
      return h('button', { class: 'pick' + (ok ? '' : ' none'), onclick: () => {
        if (!ok) { toast(make ? `${INGREDIENTS[T.raw].name}がありません（パソコンで仕入れよう）` : `${T.name}がありません（作ろう）`, 'warn'); return; }
        g.act(make ? { t: 'tareStart', fid, k } : { t: 'tareIn', fid, k }); m.close();
      } }, pimg('ing:' + T.raw, T.icon, 'pi'), h('b', {}, T.short), h('small', {}, make ? `材料 ${raw}・できる量 ${T.per}杯分` : `あと ${have}杯分`), h('small', { class: 'muted' }, uses ? `${uses}に使う` : ''));
    }));
    const m = modal(make ? '🫙 タレ（かえし）を作る' : '🫙 丼にタレを入れる', [grid, h('p', { class: 'muted small' }, make ? '材料を出したら、長押しで混ぜるとタレができます。タレは丼に先に入れて、そこに寸胴鍋のだしを注ぎます' : 'だし（鶏ガラ・豚骨・煮干し）とタレの組み合わせで、どのラーメンのスープになるかが決まります')], { onClose: () => this.closed() });
    this.opened(m);
  }
  // レジ：お金をつかむ
  openCashPicker(fid) {
    const g = this.g, st = g.store, safe = Math.max(0, st.money - st.till), hd = g.hand();
    const btn = (v, src) => h('button', { class: 'gchip', disabled: v <= 0, onclick: () => { g.act({ t: 'cashTake', fid, v, src }); m.close(); } }, v >= 10000 && v % 10000 === 0 ? `${v / 10000}万円` : yen(v));
    const row = (src, have) => h('div', { class: 'gchips' }, CASH_CHOICES.filter((v) => v <= have).map((v) => btn(v, src)), have > 0 ? h('button', { class: 'gchip all', onclick: () => { g.act({ t: 'cashTake', fid, v: have, src }); m.close(); } }, `ぜんぶ ${yen(have)}`) : h('span', { class: 'muted' }, '空っぽ'));
    const m = modal('💴 レジを開ける', [
      h('div', { class: 'cash-head' }, h('span', { class: 'cash-ic' }, '💴'), h('div', {}, h('b', {}, `レジの中 ${yen(st.till)}`), h('div', { class: 'muted small' }, `金庫 ${yen(safe)}${hd?.t === 'cash' ? `・手持ち ${yen(hd.v)}` : ''}`))),
      h('div', { class: 'muted small' }, 'レジからつかむ'), row('till', st.till),
      h('div', { class: 'muted small' }, '金庫から出す'), row('safe', safe),
      h('p', { class: 'muted small' }, 'つかんだお金を持って、となりの賭場の台で「お金をセット」すると賭けられます。勝ったお金は手持ちに入るので、レジに戻しましょう（1日の終わりには自動でレジに戻ります）'),
    ], { onClose: () => this.closed() });
    this.opened(m);
  }
  openPrepPicker(fid) {
    const g = this.g, st = g.store;
    const grid = h('div', { class: 'pick-grid' }, Object.entries(TOPPINGS).filter(([, t]) => st.level >= t.lv).map(([k, t]) => {
      const raw = st.stock[t.raw] || 0;
      return h('button', { class: 'pick' + (raw ? '' : ' none'), onclick: () => { if (!raw) { toast(`${INGREDIENTS[t.raw].name}がありません（パソコンで仕入れよう）`, 'warn'); return; } g.act({ t: 'chop', fid, tid: k, dur: 0.05 }); m.close(); toast(`🔪 ${t.name}の仕込み開始！まな板を狙って長押しで切ろう`, 'ok'); } },
        pimg('tp:' + k, t.icon, 'pi'), h('b', {}, t.name), h('small', {}, `仕込み済み ${st.prep[k] || 0}人前`), h('small', { class: 'muted' }, `${INGREDIENTS[t.raw].name} ${raw}${INGREDIENTS[t.raw].unit} → 1つで${t.per}人前`));
    }));
    const m = modal('🔪 なにを仕込む？', [grid], { onClose: () => this.closed() });
    this.opened(m);
  }
  openDishPicker(fid) {
    const g = this.g, st = g.store;
    const grid = h('div', { class: 'pick-grid' }, Object.entries(DISHES).map(([k, d]) => h('button', { class: 'pick' + ((st.dish[k] || 0) > 0 ? '' : ' none'), onclick: () => { g.act({ t: 'take', fid, k }); m.close(); } },
      pimg('dish:' + k, d.icon, 'pi'), h('b', {}, d.name), h('small', {}, `${st.dish[k] || 0}個`), h('small', { class: 'muted' }, { bowl: 'ラーメン', bowlS: 'ライス・チャーシュー丼', plate: '餃子・唐揚げ', mug: '生ビール' }[k]))));
    const m = modal('🍽️ どの器を取る？', [grid], { onClose: () => this.closed() });
    this.opened(m);
  }
  openToppingPicker(fid) {
    const g = this.g;
    const body = h('div');
    const draw = () => {
      const st = g.store, hd = g.hand();
      if (hd?.t !== 'dish') { m.close(); return; }
      const have = hd.d.tp || [], target = g.targetRecipe(hd.d);
      body.innerHTML = '';
      body.append(h('div', { class: 'tp-now' }, pimg('d:' + dishKey(hd.d), '🍜', 'big', { d: hd.d }), h('div', {}, h('b', {}, 'いまの丼'), h('div', { class: 'small' }, have.length ? have.map((x) => TOPPINGS[x]?.name).join('・') : 'トッピングなし'))));
      if (target) body.append(h('div', { class: 'tp-target' }, `📋「${target.name}」：`, ...target.tp.map((x) => h('span', { class: 'tpt' + (have.includes(x) ? ' ok' : '') }, (have.includes(x) ? '✅' : '⬜') + TOPPINGS[x]?.icon + TOPPINGS[x]?.name)),
        target.miss.length ? h('button', { class: 'btn small', onclick: () => { for (const tid of target.miss) g.act({ t: 'top', fid, tid }); setTimeout(draw, 120); } }, '🎯 注文どおりにのせる') : null));
      body.append(h('div', { class: 'pick-grid tp' }, Object.entries(TOPPINGS).filter(([, t]) => st.level >= t.lv).map(([k, t]) => {
        const n = st.prep[k] || 0, on = have.includes(k);
        return h('button', { class: 'pick small' + (n ? '' : ' none') + (on ? ' on' : '') + (target?.tp.includes(k) ? ' want' : ''), onclick: () => { if (on) return; g.act({ t: 'top', fid, tid: k }); setTimeout(draw, 120); } },
          pimg('tp:' + k, t.icon, 'pi'), h('b', {}, t.name), h('small', {}, on ? 'のせた' : `${n}人前`));
      })));
      body.append(h('p', { class: 'muted small' }, `トッピングは${TOP_MAX}種類まで。注文にないトッピングを多くのせると少し減点、足りないと大きく減点されます`));
      body.append(h('button', { class: 'btn big', onclick: () => m.close() }, '盛り付け完了'));
    };
    const m = modal('🥢 トッピング', [body], { onClose: () => this.closed() });
    this.opened(m); draw();
  }
  openStock() {
    const g = this.g, st = g.store, body = h('div', { class: 'stock-list' });
    body.append(h('div', { class: 'muted small' }, `冷蔵庫 ${fridgeUsed(st)}/${fridgeCap(st)}パック`));
    for (const [cat, C] of Object.entries(ING_CATS)) {
      if (cat === 'dish') continue;
      const items = ING_LIST.filter((p) => p.cat === cat && (st.stock[p.id] || 0) > 0);
      body.append(h('div', { class: 'ed-label' }, C.icon + ' ' + C.name), items.length ? h('div', { class: 'chips' }, items.map((p) => h('span', { class: 'chip img' }, pimg('ing:' + p.id, p.icon, 'ci'), `${p.name} ${st.stock[p.id]}${p.unit}`))) : h('div', { class: 'muted small' }, 'なし'));
    }
    body.append(h('div', { class: 'ed-label' }, '🥢 仕込み済みのトッピング'), h('div', { class: 'chips' }, Object.entries(st.prep).filter(([k, n]) => TOPPINGS[k] && n > 0).map(([k, n]) => h('span', { class: 'chip img' }, pimg('tp:' + k, TOPPINGS[k].icon, 'ci'), `${TOPPINGS[k].name} ${n}人前`))));
    body.append(h('div', { class: 'ed-label' }, '🫙 作ったタレ（かえし）'), h('div', { class: 'chips' }, Object.entries(st.tare || {}).filter(([k, n]) => TARES[k] && n > 0).map(([k, n]) => h('span', { class: 'chip img' }, pimg('ing:' + TARES[k].raw, TARES[k].icon, 'ci'), `${TARES[k].short} ${n}杯分`)), Object.keys(st.tare || {}).length ? null : h('span', { class: 'muted small' }, 'まだありません（トッピング台で作る）')));
    body.append(h('div', { class: 'ed-label' }, '🍽️ 器'), h('div', { class: 'chips' }, Object.entries(DISHES).map(([k, d]) => h('span', { class: 'chip img' }, pimg('dish:' + k, d.icon, 'ci'), `${d.name} 棚${st.dish[k] || 0}・水切りかご${st.dry?.[k] || 0}・洗い物${st.dirty[k] || 0}`))));
    const m = modal('🧊 在庫', [body, h('button', { class: 'btn', onclick: () => { m.close(); this.openPC('order'); } }, '💻 パソコンで仕入れる')], { onClose: () => this.closed() });
    this.opened(m);
  }
  // ---------- パソコン ----------
  openPC(tab = 'order') {
    const g = this.g, cart = new Map();
    let cat = 'base';
    const body = h('div', { class: 'pc-body' }), tabs = h('div', { class: 'tabs pc-apps' });
    const TABS = [['order', '🚁', '仕入れ'], ['menu', '📜', 'メニュー'], ['staff', '🧑‍🍳', 'アルバイト'], ['rep', '💬', '評判'], ['store', '🏮', 'お店'], ['expand', '🗺️', '拡張']];
    const total = h('b'), orderBtn = h('button', { class: 'btn' }, '注文する');
    const draw = () => {
      const st = g.store;
      tabs.innerHTML = '';
      const canSLic = STAFF_SLOTS.filter((sl) => st.level >= sl.lv && !hasStaffLicense(st, sl.no)).length;
      for (const [k, ic, n] of TABS) tabs.append(h('button', { class: 'tab app' + (k === tab ? ' on' : ''), onclick: () => { tab = k; draw(); } }, h('span', { class: 'ai' }, ic), h('span', { class: 'an' }, n), k === 'staff' && canSLic ? h('i', { class: 'badge' }, canSLic) : null));
      const keepB = body.scrollTop, same = body.dataset.k === tab + cat, keepG = body.querySelector('.pgrid')?.scrollTop || 0;
      body.dataset.k = tab + cat;
      body.innerHTML = ''; body.className = 'pc-body tab-' + tab;
      requestAnimationFrame(() => { if (same) { body.scrollTop = keepB; const gr = body.querySelector('.pgrid'); if (gr) gr.scrollTop = keepG; } else body.scrollTop = 0; });
      if (tab === 'order') {
        const ctabs = h('div', { class: 'tabs scroll small' });
        for (const [k, c] of Object.entries(ING_CATS)) ctabs.append(h('button', { class: 'tab' + (k === cat ? ' on' : ''), onclick: () => { cat = k; draw(); } }, c.icon + ' ' + c.name));
        const grid = h('div', { class: 'pgrid ptiles' });
        const inCart = [...cart.values()].reduce((t, n) => t + n, 0), full = inCart >= ORDER_MAX;
        const coming = (g.sim?.dyn.deliveries || []).flatMap((d) => d.items);
        const items = [...cart.entries()].filter(([, n]) => n > 0);
        const cap = fridgeCap(st), used = fridgeUsed(st, [...coming, ...items.filter(([id]) => INGREDIENTS[id].space)]);
        for (const p of ING_LIST.filter((x) => x.cat === cat).sort((a, b) => a.lv - b.lv)) {
          const ok = ingUnlocked(p.id, st.level), n = cart.get(p.id) || 0;
          const have = p.dish ? (st.dish[p.dish] || 0) + (st.dirty[p.dish] || 0) : st.stock[p.id] || 0;
          grid.append(h('div', { class: 'ptile' + (ok ? '' : ' locked') },
            pimg('ing:' + p.id, p.icon, 'pe tile'), h('div', { class: 'pn' }, p.name),
            h('div', { class: 'pm' }, `1パック ${p.pack}${p.unit}・${yen(p.cost)}`),
            h('div', { class: 'pm' }, p.dish ? `持っている ${have}個` : `在庫 ${have}${p.unit}`),
            ok ? h('div', { class: 'qty' }, h('button', { onclick: () => { cart.set(p.id, Math.max(0, n - 1)); draw(); } }, '−'), h('b', {}, n), h('button', { class: full ? 'dim' : '', onclick: () => { if (full) { toast(`1回の配送は${ORDER_MAX}パックまで`, 'warn'); return; } cart.set(p.id, n + 1); draw(); } }, '＋'))
              : h('div', { class: 'lock' }, `🔒 お店 Lv.${p.lv}`)));
        }
        const cost = orderTotal(items);
        total.textContent = yen(cost);
        orderBtn.disabled = !items.length || cost > st.money || used > cap;
        orderBtn.textContent = items.length ? `🚁 注文する（${inCart}パック）` : '注文する';
        orderBtn.onclick = () => { g.act({ t: 'order', items }); cart.clear(); draw(); };
        body.append(ctabs, grid, h('div', { class: 'cartbar' },
          h('div', { class: 'cart-l' }, h('div', {}, h('b', { class: 'cart-n' + (used > cap ? ' full' : '') }, `🧊 冷蔵庫 ${used}/${cap}`), items.length ? h('button', { class: 'cclear', onclick: () => { cart.clear(); draw(); } }, 'からにする') : null),
            h('div', { class: 'muted small' }, ...(items.length ? items.map(([id, k]) => h('span', { class: 'cart-it' }, pimg('ing:' + id, INGREDIENTS[id].icon, 'ci'), '×' + k)) : ['＋でカートに入れてね（ドローンが冷蔵庫に直接届けます）']))),
          h('div', { class: 'cart-r' }, h('div', { class: 'cart-sum' }, items.length ? `商品 ${yen(orderCost(items))} ＋ 送料 ${yen(SHIPPING_FEE)}` : `送料 ${yen(SHIPPING_FEE)}／回`), h('div', {}, '合計 ', total, h('span', { class: 'muted small' }, ` ／ 資金 ${yen(st.money)}`)), orderBtn)));
      } else if (tab === 'menu') body.append(this.menuPanel(st, draw));
      else if (tab === 'rep') body.append(repPanel(st));
      else if (tab === 'staff') body.append(this.staffPanel(st, draw));
      else if (tab === 'expand') body.append(this.expandPanel(st, draw));
      else if (tab === 'store') {
        body.append(
          h('div', { class: 'pc-stats' }, stat('総売上', yen(st.totalSales)), stat('来店客数', st.totalCustomers + '人'), stat('出したラーメン', (st.totalBowls || 0) + '杯'), stat('評判', '⭐' + repStars(st.rep).toFixed(1)), stat('営業時間', `${fmtTime(OPEN_TIME)}〜${fmtTime(closeTime())}`),
            stat('券売機', `最大${ticketLimit(st.level)}台`), stat('撃退した泥棒', (st.stats?.thief || 0) + '人'), stat('消した火事', (st.stats?.fires || 0) + '回'), stat('評論家の合格', (st.stats?.critic || 0) + '回'), stat('賭場の勝ち負け', yen((st.stats?.gWin || 0) - (st.stats?.gLose || 0)))),
          h('div', { class: 'row' }, h('button', { class: 'btn', onclick: async () => { const v = await promptBox('お店の名前', st.name, { max: 16 }); if (v) g.act({ t: 'storeName', v }); setTimeout(draw, 150); } }, '✏️ 店名を変える')),
          h('div', { class: 'ed-label' }, 'のれんの色'),
          h('div', { class: 'swatches' }, ['#c0392b', '#8e2b2b', '#1d3557', '#2b2d42', '#264653', '#2a9d8f', '#e76f51', '#6a4c93', '#3a2414', '#f2b705'].map((c) => h('button', { class: 'sw' + (st.color === c ? ' on' : ''), style: { background: c }, onclick: () => { g.act({ t: 'storeName', v: st.name, c }); setTimeout(draw, 150); } }))));
      }
    };
    const m = modal('💻 パソコン', [h('div', { class: 'pc-screen' }, tabs, body)], { wide: true, cls: 'pcm pcdesk', onClose: () => this.closed() });
    this.opened(m); draw();
    this._redraw = draw; this._live = () => { if (tab === 'order' || tab === 'rep') draw(); };
  }
  menuPanel(st, draw) {
    const g = this.g, wrap = h('div', { class: 'menu-panel' });
    const ramen = st.menu.filter((m) => m.kind === 'ramen');
    wrap.append(h('p', { class: 'muted small' }, `お客さんは券売機でこのメニューから食券を買います。値段が「相場の130%」をこえると注文してくれません。ラーメンは${MENU_RAMEN_MAX(st.level)}品まで（レベルで増える）。`));
    wrap.append(h('div', { class: 'ed-label' }, `🍜 ラーメン（${ramen.length}/${MENU_RAMEN_MAX(st.level)}）`));
    for (const m of ramen) {
      const lim = menuLimit(m), cost = menuCost(m), av = menuAvailable(st, m);
      wrap.append(h('div', { class: 'mrow' + (m.on ? '' : ' off') },
        pimg(menuKey(m), SOUPS[m.soup]?.icon, 'mi'),
        h('div', { class: 'minfo' }, h('b', {}, m.name), h('div', { class: 'muted small' }, `${SOUPS[m.soup]?.name}・${m.tp.map((x) => TOPPINGS[x]?.icon + TOPPINGS[x]?.name).join('・') || 'トッピングなし'}`),
          h('div', { class: 'small' + (m.price > lim ? ' bad' : '') }, `¥${m.price.toLocaleString()}（原価 約${yen(cost)}・相場 ${yen(menuValue(m))}・${yen(lim)}まで売れる）${m.price > lim ? ' 🚫高すぎ' : ''}${av ? '' : ' ・⚠売り切れ（材料なし）'}`)),
        h('div', { class: 'mbtns' },
          h('button', { class: 'btn small ghost', onclick: () => this.openMenuEditor(m) }, '✏️ 編集'),
          h('button', { class: 'btn small ' + (m.on ? '' : 'ghost'), onclick: () => { g.act({ t: 'menuOn', id: m.id, on: !m.on }); setTimeout(draw, 120); } }, m.on ? '販売中' : '休止中'))));
    }
    if (ramen.length < MENU_RAMEN_MAX(st.level)) wrap.append(h('button', { class: 'btn alt', onclick: () => this.openMenuEditor(null) }, '＋ 新しいラーメンを作る'));
    wrap.append(h('div', { class: 'ed-label' }, '🥟 サイドメニュー'));
    for (const [k, S] of Object.entries(SIDES)) {
      const m = st.menu.find((x) => x.id === k), ok = st.level >= S.lv, hasFx = st.fixtures.some((f) => f.t === S.fx || FIXTURES[f.t].griddle === S.fx);
      const price = m?.price ?? S.price;
      wrap.append(h('div', { class: 'mrow' + (m?.on ? '' : ' off') + (ok ? '' : ' locked') },
        pimg('side:' + k, S.icon, 'mi'),
        h('div', { class: 'minfo' }, h('b', {}, S.name), h('div', { class: 'muted small' }, ok ? `${FIXTURES[S.fx === 'fryer' ? 'fryer' : S.fx]?.name || ''}で作る${hasFx ? '' : '（⚠ 設備がありません：建築で置こう）'}・相場 ${yen(S.val)}` : `🔒 お店 Lv.${S.lv}`)),
        ok ? h('div', { class: 'mbtns' },
          h('div', { class: 'pctl' }, h('button', { onclick: () => { g.act({ t: 'menuOn', id: k, on: !!m?.on, price: price - 50 }); setTimeout(draw, 120); } }, '−'), h('b', {}, yen(price)), h('button', { onclick: () => { g.act({ t: 'menuOn', id: k, on: !!m?.on, price: price + 50 }); setTimeout(draw, 120); } }, '＋')),
          h('button', { class: 'btn small ' + (m?.on ? '' : 'ghost'), onclick: () => { g.act({ t: 'menuOn', id: k, on: !m?.on }); setTimeout(draw, 120); } }, m?.on ? '販売中' : '休止中')) : null));
    }
    return wrap;
  }
  openMenuEditor(m0) {
    const g = this.g, st = g.store;
    const m = m0 ? { ...m0, tp: [...m0.tp] } : { id: null, name: '', soup: 'shoyu', tp: ['negi', 'chashu'], price: 800 };
    const body = h('div', { class: 'menu-ed' });
    const name = h('input', { class: 'inp', value: m.name, maxlength: 14, placeholder: '例：特製醤油ラーメン' });
    const draw = () => {
      body.innerHTML = '';
      const val = menuValue(m), lim = menuLimit(m), cost = menuCost(m);
      body.append(h('div', { class: 'ed-preview' }, pimg(menuKey({ kind: 'ramen', soup: m.soup, tp: m.tp }), '🍜', 'big'), h('div', { class: 'ed-pv-t' }, h('b', {}, name.value || `${SOUPS[m.soup].name}ラーメン`), h('div', { class: 'muted small' }, `${SOUPS[m.soup].name}・${m.tp.map((x) => TOPPINGS[x]?.name).join('・') || 'トッピングなし'}`), h('div', { class: 'muted small' }, '券売機・お品書きにもこの写真が出ます'))),
        h('div', { class: 'ed-label' }, '名前'), name,
        h('div', { class: 'ed-label' }, '🍲 スープ'), h('div', { class: 'pick-grid tp' }, Object.entries(SOUPS).map(([k, s]) => h('button', { class: 'pick small' + (m.soup === k ? ' on' : '') + (st.level >= s.lv ? '' : ' none'), onclick: () => { if (st.level < s.lv) { toast(`お店 Lv.${s.lv} から`, 'warn'); return; } m.soup = k; draw(); } }, pimg('soup:' + k, s.icon, 'pi'), h('b', {}, s.name), h('small', {}, st.level >= s.lv ? soupRecipe(k) : `🔒Lv.${s.lv}`)))),
        h('div', { class: 'ed-label' }, `🥢 トッピング（${m.tp.length}/${TOP_MAX}）`), h('div', { class: 'pick-grid tp' }, Object.entries(TOPPINGS).map(([k, t]) => h('button', { class: 'pick small' + (m.tp.includes(k) ? ' on' : '') + (st.level >= t.lv ? '' : ' none'), onclick: () => { if (st.level < t.lv) { toast(`お店 Lv.${t.lv} から`, 'warn'); return; } if (m.tp.includes(k)) m.tp = m.tp.filter((x) => x !== k); else if (m.tp.length < TOP_MAX) m.tp.push(k); draw(); } }, pimg('tp:' + k, t.icon, 'pi'), h('b', {}, t.name), h('small', {}, st.level >= t.lv ? `+${t.val}円` : `🔒Lv.${t.lv}`)))),
        h('div', { class: 'ed-label' }, '💴 値段'),
        h('div', { class: 'row' }, h('div', { class: 'pctl' }, h('button', { onclick: () => { m.price = Math.max(100, m.price - 50); draw(); } }, '−'), h('b', {}, yen(m.price)), h('button', { onclick: () => { m.price = Math.min(9990, m.price + 50); draw(); } }, '＋')),
          h('button', { class: 'btn small ghost', onclick: () => { m.price = Math.round(val / 10) * 10; draw(); } }, '相場にする'), h('button', { class: 'btn small ghost', onclick: () => { m.price = lim; draw(); } }, 'ギリギリ売れる値段')),
        h('div', { class: 'small' + (m.price > lim ? ' bad' : '') }, `原価 約${yen(cost)}・利益 約${yen(m.price - cost)}・相場 ${yen(val)}（${yen(lim)}まで売れる）${m.price > lim ? '　🚫 高すぎて注文されません' : m.price < val * 0.9 ? '　😍 お得（よく売れて口コミも良い）' : ''}`),
        h('div', { class: 'row end' }, m0 && st.menu.filter((x) => x.kind === 'ramen').length > 1 ? h('button', { class: 'btn danger small', onclick: async () => { if (await confirmBox(`「${m0.name}」をメニューから消しますか？`, '消す')) { g.act({ t: 'menuDel', id: m0.id }); md.close(); setTimeout(() => this.openPC('menu'), 150); } } }, '🗑 消す') : null,
          h('button', { class: 'btn', onclick: () => { g.act({ t: 'menuSave', m: { ...m, name: name.value.trim() || `${SOUPS[m.soup].name}ラーメン` } }); md.close(); setTimeout(() => this.openPC('menu'), 150); } }, '💾 保存')));
    };
    const md = modal(m0 ? '✏️ メニューを編集' : '🆕 新しいラーメン', [body], { wide: true, onClose: () => this.closed() });
    this.opened(md); draw();
  }
  staffPanel(st, draw) {
    const g = this.g, wrap = h('div');
    const wages = st.staff.reduce((t, o) => t + (o.wage || 0), 0);
    wrap.append(h('div', { class: 'wage-total' }, `💴 人件費 1日 ${yen(wages)}`, h('span', { class: 'muted small' }, `（${st.staff.length}人・閉店のときに払います）`)),
      h('p', { class: 'muted small' }, `雇える人 ${staffLimit(st.level)} / ${STAFF_MAX}人（お店 Lv.3 から。先に🔑雇用ライセンスを買う）。人によって「調理」と「接客」のはやさがちがいます。仕事：🔄おまかせ・👨‍🍳調理・🙋接客（配膳と片付け）・🫧洗い場・🛡️警備`),
      h('p', { class: 'muted small' }, '🛡️ 泥棒の対処は役割を「警備」にした人だけがします（ほかの仕事はせず、レジの前で見張ります）。手裏剣ケースがあれば手裏剣を投げ、なければ走って取り押さえます。接客が早い人ほど足が速く、よく当たります'));
    const bar = (spd) => h('span', { class: 'spdbar' }, h('i', { style: { width: Math.round(SPEEDS[spd].k / 2 * 100) + '%' } }));
    const skills = (c, hl) => h('div', { class: 'skills' }, h('div', { class: 'sk' }, h('span', {}, '👨‍🍳 調理'), bar(c), h('b', {}, `${SPEEDS[c].icon}${SPEEDS[c].name}`)), h('div', { class: 'sk' }, h('span', {}, '🙋 接客'), bar(hl), h('b', {}, `${SPEEDS[hl].icon}${SPEEDS[hl].name}`)));
    const r = mulberry32(st.day * 7919 + st.staff.length * 31);
    for (const sl of STAFF_SLOTS) {
      const s = st.staff.find((o) => o.slot === sl.no), open = st.level >= sl.lv;
      const head = h('div', { class: 'slot-h' }, h('b', {}, `No.${sl.no}`), h('span', { class: 'muted small' }, `日給 ${yen(sl.wage)}`));
      if (s) {
        const R = STAFF_ROLES[s.role] || STAFF_ROLES.auto;
        wrap.append(h('div', { class: 'scard' }, head, skills(s.cook, s.hall),
          h('div', { class: 'row between' }, h('span', {}, `${R.icon} ${s.name}さん（${R.name}）`, h('button', { class: 'btn tiny ghost', onclick: async () => { const v = await promptBox('✏️ 名前（10文字まで）', s.name, { max: 10 }); if (v) { g.act({ t: 'staffName', sid: s.id, name: v }); setTimeout(draw, 150); } } }, '✏️')),
            h('button', { class: 'btn small ghost', onclick: async () => { if (await confirmBox(`${s.name}さんを解雇しますか？`, '解雇')) { g.act({ t: 'dismiss', sid: s.id }); setTimeout(draw, 150); } } }, '解雇')),
          h('div', { class: 'roles' }, Object.entries(STAFF_ROLES).map(([k, d]) => h('button', { class: 'role' + (s.role === k ? ' on' : ''), onclick: () => { g.act({ t: 'staffRole', sid: s.id, role: k }); setTimeout(draw, 150); } }, `${d.icon} ${d.name}`))),
          h('div', { class: 'muted small' }, R.desc)));
      } else if (open && !hasStaffLicense(st, sl.no)) {
        wrap.append(h('div', { class: 'scard nolic' }, head, skills(sl.cook, sl.hall), h('div', { class: 'row between' }, h('span', { class: 'muted small' }, '🔑 雇用ライセンスを買うと雇えます'),
          h('button', { class: 'btn small lic-btn', onclick: async () => { if (sl.lic > st.money) { toast('お金が足りません', 'warn'); return; } if (await confirmBox(`🔑 No.${sl.no} の雇用ライセンスを ${yen(sl.lic)} で買いますか？`, '買う')) { g.act({ t: 'staffLicense', slot: sl.no }); setTimeout(draw, 150); } } }, h('span', {}, '🔑 ライセンス'), h('b', {}, yen(sl.lic))))));
      } else if (open) {
        const nm = (this._hireNames ||= {})[sl.no] ?? STAFF_NAMES[Math.floor(r() * STAFF_NAMES.length)], seed = Math.floor(r() * 1e9);
        const inp = h('input', { class: 'inp name-inp', value: nm, maxlength: 10 }); inp.oninput = () => { this._hireNames[sl.no] = inp.value; };
        wrap.append(h('div', { class: 'scard free' }, head, skills(sl.cook, sl.hall), h('div', { class: 'row name-row' }, h('span', { class: 'muted small' }, '✏️ 名前'), inp),
          h('div', { class: 'roles' }, h('button', { class: 'role hire', onclick: () => { const n = inp.value.trim(); if (!n) { toast('名前を入れてね', 'warn'); return; } delete this._hireNames[sl.no]; g.act({ t: 'hire', name: n, seed, slot: sl.no }); setTimeout(draw, 150); } }, `🤝 雇う（日給${yen(sl.wage)}）`))));
      } else wrap.append(h('div', { class: 'scard locked' }, head, skills(sl.cook, sl.hall), h('div', { class: 'muted small' }, `🔒 お店 Lv.${sl.lv} で雇用ライセンス（${yen(sl.lic)}）が買えます`)));
    }
    return wrap;
  }
  expandPanel(st, draw) {
    const g = this.g, wrap = h('div'), tg = Object.fromEntries(expandTargets(st).map((t) => [t.id, t]));
    const row = h('div', { class: 'xrow' }); row.style.gridTemplateColumns = `repeat(${SHOP.cols}, 1fr) 1.2fr`;
    for (const c of ALL_COLS) {
      const t = tg[c], owned = !t;
      const b = h('button', { class: 'xcell bay' + (owned ? ' owned' : t.can ? ' can' : ' locked') }, h('b', {}, `${String.fromCharCode(65 + c)}列`), h('span', {}, owned ? '✅ 使用中' : t.can ? yen(t.cost) : '🔒 となりから'));
      if (!owned && t.can) b.onclick = async () => { if (await confirmBox(`${String.fromCharCode(65 + c)}列（厨房＋カウンター＋客席）を ${yen(t.cost)} で買いますか？`, '購入')) { g.act({ t: 'expand', id: c }); setTimeout(draw, 150); } };
      row.append(b);
    }
    row.append(h('div', { class: 'xcell office' }, h('b', {}, '🎲 賭場'), h('span', {}, 'となりの建物')));
    wrap.append(h('p', { class: 'muted small' }, `資金 ${yen(st.money)}。お店は左へ1列（4m）ずつ広げられます。1列ふえると、厨房・カウンター席4つ・客席のスペースが増えます`), h('div', { class: 'xgrid' }, h('div', { class: 'xrow street' }, h('div', { class: 'xstreet' }, '⬆ 奥：厨房（勝手口・ドローン）')), row, h('div', { class: 'xrow street' }, h('div', { class: 'xstreet door' }, '⬇ 手前：客席・入口（のれん）・通り'))));
    return wrap;
  }
  // ---------- 賭場 ----------
  openGamble(kind, fid) {
    if (kind === 'chohan') return this.openChohan();
    if (kind === 'chinchiro') return this.openChinchiro();
    return this.openSlot();
  }
  cash() { const hd = this.g.hand(); return hd?.t === 'cash' ? hd.v : 0; }
  chips(onPick, cur) {
    const cash = this.cash();
    if (!cash) return h('div', { class: 'no-cash' }, '💴 お金を持っていません。お店のレジを開けて、お金をつかんでこよう');
    return h('div', { class: 'gchips' }, BET_CHIPS.filter((v) => v < cash).map((v) => h('button', { class: 'gchip' + (cur === v ? ' on' : ''), onclick: () => onPick(v) }, v >= 10000 ? `${v / 10000}万` : `${v.toLocaleString()}`)), h('button', { class: 'gchip all' + (cur === cash || cur === 'all' ? ' on' : ''), onclick: () => onPick('all') }, `ぜんぶ ${yen(cash)}`));
  }
  betOf(bet) { const c = this.cash(); return bet === 'all' ? c : Math.min(bet, c); }
  openChohan() {
    const g = this.g, body = h('div', { class: 'gpanel chohan' });
    let bet = this._bet || 1000;
    const draw = () => {
      const st = g.store, C = g.dyn?.ch; if (!C) return;
      const mine = C.b?.[g.me];
      const key = JSON.stringify([C.ph, Math.ceil(C.t), C.d, C.b, bet, this.cash(), C.n]);
      if (key === this._chKey) return; this._chKey = key;
      body.innerHTML = '';
      const others = Object.entries(C.b || {}).filter(([k]) => k !== g.me);
      body.append(h('div', { class: 'g-status ' + C.ph }, C.ph === 'bet' ? `🎲 第${C.n}番勝負　さあ張った張った！ あと ${Math.ceil(C.t)}秒` : C.ph === 'roll' ? '🥁 壺を振っています…' : `🎲 ${C.d[0]}・${C.d[1]} の ${(C.d[0] + C.d[1]) % 2 ? '半' : '丁'}！`));
      body.append(h('div', { class: 'dice-row' }, C.ph === 'show' && C.d ? C.d.map((v) => h('span', { class: 'die big' }, '⚀⚁⚂⚃⚄⚅'[v - 1])) : h('span', { class: 'cup' + (C.ph === 'roll' ? ' shake' : '') }, '🥣')));
      body.append(h('div', { class: 'cho-han' },
        h('button', { class: 'chbtn cho' + (mine?.[0] === 'cho' ? ' on' : ''), disabled: C.ph !== 'bet', onclick: () => g.act({ t: 'bet', s: 'cho', a: this.betOf(bet) }) }, h('b', {}, '丁'), h('small', {}, 'ここにお金をセット')),
        h('button', { class: 'chbtn han' + (mine?.[0] === 'han' ? ' on' : ''), disabled: C.ph !== 'bet', onclick: () => g.act({ t: 'bet', s: 'han', a: this.betOf(bet) }) }, h('b', {}, '半'), h('small', {}, 'ここにお金をセット'))));
      body.append(h('div', { class: 'muted small center' }, `セットするお金（手持ち ${yen(this.cash())}）・丁＝合計が偶数／半＝奇数`), this.chips((v) => { bet = this._bet = v; this._chKey = ''; draw(); }, bet));
      body.append(h('div', { class: 'g-mine' }, mine ? `あなた：${mine[0] === 'cho' ? '丁' : '半'}に ${yen(mine[1])}` : 'まだ賭けていません', mine && C.ph === 'bet' ? h('button', { class: 'btn tiny ghost', onclick: () => g.act({ t: 'bet', cancel: 1 }) }, '取り消す') : null));
      if (others.length) body.append(h('div', { class: 'g-others' }, '👥 ', others.map(([, b]) => `${b[2] || '仲間'}：${b[0] === 'cho' ? '丁' : '半'} ${yen(b[1])}`).join('　')));
      body.append(h('div', { class: 'g-hist' }, '出目：', (C.h || []).map(([a, b2]) => h('span', { class: 'hist ' + ((a + b2) % 2 ? 'han' : 'cho') }, `${a + b2}${(a + b2) % 2 ? '半' : '丁'}`))));
      body.append(h('p', { class: 'muted small' }, `当たるとセットしたお金が2倍になって手元に返ってきます（寺銭${Math.round(CHOHAN_FEE * 100)}%を引く）。ルームの仲間と同じ勝負に賭けられます。勝ったお金はレジに戻そう`)); void st;
    };
    const m = modal('🎲 丁半博打', [body], { onClose: () => { clearInterval(this._gT); this.closed(); } });
    this.opened(m); this._chKey = ''; draw();
    clearInterval(this._gT); this._gT = setInterval(draw, 200);
  }
  openChinchiro() {
    const g = this.g, body = h('div', { class: 'gpanel chin' });
    let bet = this._bet || 1000;
    this._chinRes = null;
    const draw = () => {
      const st = g.store; body.innerHTML = '';
      const R = this._chinRes;
      body.append(h('div', { class: 'g-status' }, R ? (R.net > 0 ? `🎉 勝ち！ +${yen(R.net)}` : R.net < 0 ? `💸 負け… −${yen(-R.net)}` : '🤝 引き分け') : '🥣 親（胴元）と勝負！'));
      const show = (who, r) => h('div', { class: 'chin-side' }, h('b', {}, who), ...r.rolls.map((d, i) => h('div', { class: 'chin-roll' + (i === r.rolls.length - 1 ? ' last' : '') }, d.map((v) => h('span', { class: 'die' }, '⚀⚁⚂⚃⚄⚅'[v - 1])))), h('div', { class: 'chin-hand' }, r.h.name));
      if (R) body.append(h('div', { class: 'chin-res' }, show('親', R.dealer), show('あなた', R.you)));
      body.append(h('div', { class: 'muted small center' }, '賭け金'), this.chips((v) => { bet = this._bet = v; draw(); }, bet));
      body.append(h('button', { class: 'btn big', disabled: !this.cash(), onclick: () => { this._chinRes = 'wait'; g.act({ t: 'chinchiro', a: this.betOf(bet) }); setTimeout(draw, 200); } }, `🎲 ${yen(this.betOf(bet))} をセットして勝負！`));
      body.append(h('p', { class: 'muted small' }, '役：ピンゾロ（1・1・1）5倍＞ゾロ目 3倍＞シゴロ（4・5・6）2倍＞目（2つそろった残りの数）＞目なし。ヒフミ（1・2・3）は2倍払い。負けると親の役の倍率ぶん払います'));
      body.append(h('div', { class: 'muted small' }, `手持ち ${yen(this.cash())}`)); void st;
    };
    this._gameRedraw = (e) => { if (e.g === 'chinchiro') { this._chinRes = e; this.g.app.sfx.play(e.net > 0 ? 'win' : 'lose'); draw(); } };
    const m = modal('🥣 チンチロリン', [body], { onClose: () => { this._gameRedraw = null; this.closed(); } });
    this.opened(m); draw();
  }
  openSlot() {
    const g = this.g, body = h('div', { class: 'gpanel slot' });
    let bet = Math.min(this._bet || 100, 10000);
    const reels = [h('div', { class: 'reel' }, '7'), h('div', { class: 'reel' }, '🍒'), h('div', { class: 'reel' }, '🍜')];
    const res = h('div', { class: 'g-status' }, '🎰 3つそろえよう！');
    let spinning = false;
    const syms = SLOT_SYMS.map((s) => s[0]);
    const draw = () => {
      body.innerHTML = '';
      body.append(res, h('div', { class: 'reels' }, reels));
      body.append(h('div', { class: 'muted small center' }, '1回に入れるお金'), this.chips((v) => { bet = this._bet = v; draw(); }, bet));
      body.append(h('button', { class: 'btn big', disabled: !this.cash(), onclick: () => { if (spinning) return; spinning = true; res.textContent = '🎰 回転中…'; g.act({ t: 'slot', a: this.betOf(bet) }); let k = 0; this._spin = setInterval(() => { reels.forEach((r, i) => { r.textContent = syms[(k + i * 2) % syms.length]; }); k++; }, 70); setTimeout(() => { if (spinning) { clearInterval(this._spin); spinning = false; } }, 4000); } }, `🎰 ${yen(this.betOf(bet))} 入れて回す`));
      body.append(h('div', { class: 'paytable' }, Object.entries(SLOT_PAY).map(([s, v]) => h('span', {}, `${s}${s}${s} ×${v}`)), h('span', {}, `🍒🍒 ×${SLOT_CHERRY2}`)));
      body.append(h('div', { class: 'muted small' }, `手持ち ${yen(this.cash())}`));
    };
    this._gameRedraw = (e) => {
      if (e.g !== 'slot') return;
      setTimeout(() => {
        clearInterval(this._spin); spinning = false;
        e.r.forEach((s, i) => setTimeout(() => { reels[i].textContent = s; reels[i].classList.add('stop'); setTimeout(() => reels[i].classList.remove('stop'), 300); g.app.sfx.play('click'); }, i * 260));
        setTimeout(() => { res.textContent = e.mult ? `🎉 ×${e.mult}！ +${yen(e.net)}` : '…はずれ'; g.app.sfx.play(e.mult >= 20 ? 'jackpot' : e.mult ? 'win' : 'lose'); draw(); }, 820);
      }, 600);
    };
    const m = modal('🎰 スロット', [body], { onClose: () => { clearInterval(this._spin); this._gameRedraw = null; this.closed(); } });
    this.opened(m); draw();
  }
  onGamble(e) {
    if (e.g === 'chohan') { toast(e.win ? `🎲 ${e.d[0]}・${e.d[1]}の${e.res === 'cho' ? '丁' : '半'}！ 当たり！ +${yen(e.net)}` : `🎲 ${e.d[0]}・${e.d[1]}の${e.res === 'cho' ? '丁' : '半'}… はずれ −${yen(-e.net)}`, e.win ? 'money' : 'warn', 3000); this.g.app.sfx.play(e.win ? 'win' : 'lose'); return; }
    if (this._gameRedraw) this._gameRedraw(e);
    else toast(e.net >= 0 ? `🎲 +${yen(e.net)}` : `🎲 −${yen(-e.net)}`, e.net >= 0 ? 'money' : 'warn');
  }
  showCritic(e) {
    const m = modal('🕶️ ラーメン評論家', [h('div', { class: 'critic ' + (e.ok ? 'ok' : 'ng') }, h('div', { class: 'cr-score' }, `${e.q}点`), h('div', { class: 'cr-m' }, `「${e.m}」`), e.ok ? h('div', { class: 'cr-prize' }, `🏆 合格！評判が大きく上がった！ 掲載の賞金 +${yen(e.prize)}`) : h('div', { class: 'cr-prize bad' }, '😓 不合格…評判が下がってしまった')), h('button', { class: 'btn big', onclick: () => m.close() }, 'OK')], { onClose: () => this.closed() });
    this.opened(m);
    this.g.app.sfx.play(e.ok ? 'jackpot' : 'lose');
  }
  // ---------- 評判・看板・共通 ----------
  openRep() {
    const g = this.g, body = h('div', { class: 'pc-body tab-rep' });
    const draw = () => { const keep = body.querySelector('.rv-list')?.scrollTop || 0; body.innerHTML = ''; body.append(repPanel(g.store)); const l = body.querySelector('.rv-list'); if (l) l.scrollTop = keep; };
    const m = modal('💬 評判と口コミ', [body], { wide: true, cls: 'pcm rep', onClose: () => this.closed() });
    this.opened(m); draw(); this._redraw = draw; this._live = draw;
  }
  openText(fid) {
    const g = this.g, f = g.store.fixtures.find((o) => o.id === fid); if (!f) return;
    const def = FIXTURES[f.t], colorable = ['nobori', 'neon'].includes(f.t);
    const COLORS = f.t === 'neon' ? ['#ff4f6d', '#4fd8ff', '#ffe14f', '#5dff7a', '#ff6b4f', '#b77bff', '#ffffff'] : ['#ffffff', '#c0392b', '#1d3557', '#2b2d42', '#2a9d8f', '#e76f51', '#f2b705', '#6a4c93'];
    let col = f.c || COLORS[0];
    const inp = h('input', { class: 'inp', value: (f.tx || '').replace(/\n/g, '/'), maxlength: f.t === 'nobori' ? 8 : 24, placeholder: '例：本日のおすすめ' });
    const sw = h('div', { class: 'swatches' });
    const drawSw = () => { sw.innerHTML = ''; for (const c of COLORS) sw.append(h('button', { class: 'sw' + (c === col ? ' on' : ''), style: { background: c === '#ffffff' && f.t !== 'neon' ? (g.store.color || '#c0392b') : c }, onclick: () => { col = c; drawSw(); } })); };
    drawSw();
    const ok = () => { g.act({ t: 'text', fid, v: inp.value.trim().replace(/\//g, '\n'), c: colorable ? col : undefined }); m.close(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') ok(); });
    const m = modal(`${def.icon} ${def.name}の文字`, [h('div', { class: 'muted small' }, f.t === 'nobori' ? 'のぼりは縦書き8文字まで' : '24文字まで。「/」で改行'), inp, colorable ? sw : null, h('div', { class: 'row end' }, h('button', { class: 'btn', onclick: ok }, '決定'))], { onClose: () => this.closed() });
    this.opened(m); setTimeout(() => inp.focus(), 60);
  }
  opened(m) { if (this.open && this.open !== m) { const o = this.open; this.open = null; this._replacing = true; try { o.close(); } catch (e) { /* noop */ } this._replacing = false; } this.open = m; this.g.setUIBlock(true); }
  closed() { if (this._replacing) return; this.open = null; this._redraw = null; this._live = null; this.g.setUIBlock(false); }
  refresh() { this._redraw && this.open && this._redraw(); }
  live() {
    if (!this.open || !this._live) return true;
    if (!this._touchWatch) { this._touchWatch = true; const t = () => { this._touchT = performance.now(); }; for (const ev of ['pointerdown', 'pointerup', 'wheel', 'touchmove']) document.addEventListener(ev, t, { capture: true, passive: true }); }
    if (performance.now() - (this._touchT || 0) < 900) return false;
    this._live(); return true;
  }
  closeAll() { clearInterval(this._gT); this._redraw = null; this._live = null; if (this.open) { const o = this.open; this.open = null; this._replacing = true; try { o.close(); } finally { this._replacing = false; } } this.g?.setUIBlock(false); }
  openExpand() { this.openPC('expand'); }
  openLevel() {
    const st = this.g.store, body = h('div', { class: 'lv-body' }), maxed = st.level >= MAX_LEVEL;
    body.append(h('div', { class: 'lv-now' }, h('b', {}, `🏮 お店 Lv.${st.level}${maxed ? ' MAX' : ''}`),
      h('div', { class: 'bar big' }, h('i', { style: { width: (maxed ? 100 : Math.min(100, st.xp / xpNeed(st.level) * 100)) + '%' } })),
      h('span', { class: 'muted small' }, maxed ? '最高レベルです！' : `次のレベルまで ${(xpNeed(st.level) - st.xp).toLocaleString()} XP（お客さんが満足して帰るともらえる。おいしいほど多い）`)));
    const list = h('div', { class: 'lv-list' });
    for (let lv = 2; lv <= MAX_LEVEL; lv++) { const u = unlocksAt(lv); if (!u.length) continue; list.append(h('div', { class: 'lv-row' + (lv <= st.level ? ' done' : lv === st.level + 1 ? ' next' : '') }, h('span', { class: 'lv-n' }, lv <= st.level ? '✅' : `Lv.${lv}`), h('div', { class: 'lv-u' }, u.map((x) => h('span', { class: 'chip small k-' + x.k }, x.icon + ' ' + x.name))))); }
    body.append(list);
    const m = modal('⭐ お店のレベル（最大50）', body, { wide: true, onClose: () => this.closed() });
    this.opened(m); requestAnimationFrame(() => list.querySelector('.next')?.scrollIntoView({ block: 'center' }));
  }
  openPause() {
    const g = this.g;
    const m = modal('⏸ メニュー', [h('div', { class: 'col' },
      h('button', { class: 'btn big', onclick: () => m.close() }, '▶ 再開'),
      h('button', { class: 'btn ghost', onclick: () => { m.close(); this.openLevel(); } }, '⭐ レベルとできるようになること'),
      h('button', { class: 'btn ghost', onclick: () => { m.close(); this.openRep(); } }, '💬 評判と口コミ'),
      h('button', { class: 'btn ghost', onclick: () => { m.close(); this.openStock(); } }, '🧊 在庫を見る'),
      h('div', { class: 'muted small', style: { textAlign: 'center' } }, '💻 仕入れ・メニュー・アルバイト・拡張は、厨房の右奥のパソコンでできます'),
      h('button', { class: 'btn ghost', onclick: () => { m.close(); g.app.openSettingsInGame(); } }, '⚙️ 設定'),
      h('button', { class: 'btn ghost', onclick: () => { m.close(); g.help(); } }, '❓ 遊び方'),
      g.roomId ? h('div', { class: 'chip' }, `ルームID：${g.roomId}`) : null,
      h('button', { class: 'btn danger', onclick: async () => { m.close(); if (await confirmBox(g.mode === 'client' ? 'ルームから退出しますか？' : '保存してメニューに戻りますか？', '戻る')) g.app.endGame(); } }, g.mode === 'solo' ? '💾 保存してメニューへ' : '🚪 退出する'))], { onClose: () => this.closed() });
    this.opened(m);
  }
  showSummary(d, isHost) {
    const g = this.g, row = (k, v, cls) => h('div', { class: 'sum-row ' + (cls || '') }, h('span', {}, k), h('b', {}, v));
    const income = d.sales + d.bounty + d.critic + Math.max(0, d.gamble), cost = d.refund + d.orders + d.ship + d.wages + d.bills + d.stolen + d.repair + Math.max(0, -d.gamble);
    const mx = Math.max(1, income, cost), bar = (v, cls) => h('div', { class: 'sum-bar' }, h('i', { class: cls, style: { width: Math.round(v / mx * 100) + '%' } }));
    const diff = d.prevProfit == null ? null : d.profit - d.prevProfit;
    const left = h('div', { class: 'sum-col' },
      h('div', { class: 'sum-h' }, '💰 収入'), bar(income, 'plus'),
      row('食券の売上', '+' + yen(d.sales), 'plus'), d.bounty ? row('泥棒の懸賞金', '+' + yen(d.bounty), 'plus') : null, d.critic ? row('評論家の賞金', '+' + yen(d.critic), 'plus') : null, d.gamble > 0 ? row('賭場の勝ち', '+' + yen(d.gamble), 'plus') : null,
      h('div', { class: 'sum-h' }, '💸 支出'), bar(cost, 'minus'),
      d.refund ? row('返金（怒って帰った）', '−' + yen(d.refund), 'minus') : null, row('仕入れ', '−' + yen(d.orders), 'minus'), d.ship ? row('ドローン送料', '−' + yen(d.ship), 'minus') : null, row('人件費', '−' + yen(d.wages), 'minus'), row('家賃・光熱費', '−' + yen(d.bills), 'minus'),
      d.stolen ? row('泥棒に盗まれた', '−' + yen(d.stolen), 'minus') : null, d.repair ? row('修理代', '−' + yen(d.repair), 'minus') : null, d.gamble < 0 ? row('賭場の負け', '−' + yen(-d.gamble), 'minus') : null,
      h('div', { class: 'sum-total ' + (d.profit >= 0 ? 'plus' : 'minus') }, h('span', {}, '本日の利益'), h('b', {}, (d.profit >= 0 ? '+' : '−') + yen(Math.abs(d.profit)))),
      diff == null ? null : h('div', { class: 'muted small right' }, `前日比 ${diff >= 0 ? '▲ +' : '▼ −'}${yen(Math.abs(diff))}`), row('資金', yen(d.money)));
    const right = h('div', { class: 'sum-col' },
      h('div', { class: 'sum-h' }, '🏆 よく売れたメニュー'),
      (d.top || []).length ? h('div', { class: 'sum-top' }, d.top.map(([n, [c, rev]], i) => h('div', { class: 'sum-item' }, h('span', { class: 'rk' }, ['🥇', '🥈', '🥉'][i] || (i + 1) + '.'), h('span', { class: 'nm' }, n), h('span', { class: 'muted small' }, `${c}杯`), h('b', {}, yen(rev))))) : h('p', { class: 'muted small' }, '今日は注文がありませんでした…'),
      h('div', { class: 'sum-h' }, '📈 お店の様子'),
      row('来たお客さん', d.served + '人'), row('出したラーメン', `${d.bowls}杯（サイド ${d.sides}品）`), row('料理の平均点', d.avgQ ? d.avgQ + '点' : '—'), row('怒って帰ったお客さん', d.lost + '人', d.lost ? 'minus' : ''),
      d.fires ? row('火事', d.fires + '回', 'minus') : null, row('獲得経験値', d.xp + ' XP'),
      row('評判', `⭐ ${repStars(d.rep).toFixed(1)}` + (d.repPrev != null ? `（${d.rep >= d.repPrev ? '▲' : '▼'}${Math.abs(repStars(d.rep) - repStars(d.repPrev)).toFixed(1)}）` : ''), d.repPrev != null && d.rep < d.repPrev ? 'minus' : ''),
      row('お店のレベル', 'Lv.' + d.level + (d.level >= MAX_LEVEL ? ' MAX' : '')));
    const body = [h('div', { class: 'sum-big' }, `${d.day}日目 おつかれさま！`), h('div', { class: 'sum-grid' }, left, right),
      isHost ? h('button', { class: 'btn big', onclick: () => { m.close(); g.act({ t: 'nextDay' }); } }, `☀️ 次の日へ（${d.day + 1}日目）`) : h('p', { class: 'muted center' }, 'ホストが次の日を始めるのを待っています…')];
    const m = modal('📊 本日の収支', body, { wide: true, cls: 'summary', noClose: isHost, onClose: () => this.closed() });
    this.opened(m); this.summaryModal = m;
  }
  closeSummary() { if (this.summaryModal) { try { this.summaryModal.close(); } catch (e) { /* noop */ } this.summaryModal = null; } }
  // ---------- 建築 ----------
  showBuild(open, sel, onPick, mv = null) {
    this.build.classList.toggle('hidden', !open);
    this.build.classList.toggle('moving', !!(open && mv));
    this.orders.classList.toggle('hidden', !!open || !this.ordOpen);
    if (!open) return;
    const st = this.g.store;
    if (mv) {
      const key = 'mv|' + mv.type;
      if (this._bKey !== key) {
        this._bKey = key;
        const def = FIXTURES[mv.type], B = this.build; B.innerHTML = '';
        this._bStatus = h('div', { class: 'mv-status' });
        const press = (id) => () => this.g.input.edges.add(id);
        B.append(h('div', { class: 'mv-bar' }, h('div', { class: 'mv-title' }, `🔧 ${def.icon} ${def.name}を移動中`), this._bStatus,
          h('div', { class: 'row' }, h('button', { class: 'btn small ghost', onclick: press('alt') }, '🔄 回転'), h('button', { class: 'btn small', onclick: press('act') }, '✅ ここに移動'), h('button', { class: 'btn small ghost', onclick: press('box') }, '✖ やめる'))));
      }
      if (this._bStatus) { const t = mv.ok ? '🟢 ここに置けます' : '🔴 ' + (mv.why || 'ここには置けません'); if (this._bStatus.textContent !== t) { this._bStatus.textContent = t; this._bStatus.classList.toggle('ng', !mv.ok); } }
      return;
    }
    const key = JSON.stringify([sel, st.money, st.level, this._bcat, this._thumbRev || 0]);
    if (key === this._bKey) return;
    this._bKey = key;
    this._bcat ||= 'kitchen'; if (!FIXTURE_CATS[this._bcat]) this._bcat = 'kitchen';
    const B = this.build; B.innerHTML = '';
    const tabs = h('div', { class: 'tabs scroll small' });
    for (const [k, n] of Object.entries(FIXTURE_CATS)) tabs.append(h('button', { class: 'tab' + (k === this._bcat ? ' on' : ''), onclick: () => { this._bcat = k; this._bKey = ''; this.showBuild(true, sel, onPick); } }, n));
    const items = h('div', { class: 'bitems' }), R = this.g.R, need = [];
    for (const [id, f] of Object.entries(FIXTURES)) {
      if (f.cat !== this._bcat || f.fixed) continue;
      const ok = fixtureUnlocked(id, st.level), url = R?.thumbUrl?.(id, st.color);
      if (url === null && R?.thumbUrl && !R._thumbs?.has(id + '|' + st.color)) need.push(id);
      items.append(h('button', { class: 'bitem' + (sel === id ? ' on' : '') + (ok ? '' : ' locked'), title: f.desc || '', onclick: () => (ok ? onPick(id) : toast(`お店 Lv.${f.lv} で買えるようになります`, 'warn')) },
        url ? h('img', { class: 'bthumb', src: url, alt: f.name }) : h('span', { class: 'bi' }, f.icon), h('span', { class: 'bn' }, f.name),
        f.seats ? h('span', { class: 'bs' }, `${f.seats.length}席`) : f.place === 'kitchen' ? h('span', { class: 'bs' }, '厨房') : null, h('span', { class: 'bp' }, ok ? yen(f.price) : `🔒 Lv.${f.lv}`)));
    }
    if (need.length) R.requestThumbs(need, st.color, () => { this._thumbRev = (this._thumbRev || 0) + 1; if (!this.build.classList.contains('hidden') && !this.build.classList.contains('moving')) this.showBuild(true, sel, onPick); });
    B.append(h('div', { class: 'build-head' }, h('b', {}, '🔨 建築モード'), h('span', { class: 'muted small' }, '設備を選んで置く／置いてある設備を狙って「移動」「売却」'), h('button', { class: 'btn small ghost', onclick: () => this.g.toggleBuild(false) }, '終了')), tabs, items);
  }
  openChat() {
    const g = this.g, inp = h('input', { class: 'inp', maxlength: 60, placeholder: 'メッセージ（60文字まで）' });
    const send = (t) => { t = (t || '').trim(); if (!t) return; g.sendChat(t); inp.value = ''; m.close(); };
    inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') send(inp.value); });
    const log = h('div', { class: 'chat-full' }, ...(this._chatHist || []).map((c) => chatLine(c)));
    const m = modal('💬 ルームチャット', [log, h('div', { class: 'presets' }, CHAT_PRESETS.map((p) => h('button', { class: 'chip btnchip', onclick: () => send(p) }, p))), h('div', { class: 'row' }, inp, h('button', { class: 'btn', onclick: () => send(inp.value) }, '送信'))], { onClose: () => this.closed() });
    this.opened(m); setTimeout(() => { log.scrollTop = 1e6; inp.focus(); }, 30);
  }
  addChat(c) {
    (this._chatHist ||= []).push(c); if (this._chatHist.length > 50) this._chatHist.shift();
    const line = chatLine(c); this.chatLog.append(line);
    while (this.chatLog.children.length > 5) this.chatLog.firstChild.remove();
    setTimeout(() => line.classList.add('fade'), 9000);
  }
}
function chatLine(c) { return h('div', { class: 'cline' }, h('b', {}, (c.n || '???') + '：'), document.createTextNode(String(c.m || '').slice(0, 60))); }
const stat = (k, v) => h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, String(v)));
function repPanel(st) {
  const stars = repStars(st.rep), f = customerFactors(st);
  const starBar = (v) => h('span', { class: 'stars' }, h('span', { class: 'stars-bg' }, '★★★★★'), h('span', { class: 'stars-fg', style: { width: (v / 5 * 100) + '%' } }, '★★★★★'));
  const rv = st.today?.rv || [0, 0, 0, 0, 0], n = rv.reduce((a, b) => a + b, 0), mx = Math.max(1, ...rv);
  const dist = h('div', { class: 'rv-dist' }, [5, 4, 3, 2, 1].map((s) => h('div', { class: 'rv-row' }, h('span', {}, '★' + s), h('div', { class: 'sum-bar' }, h('i', { class: s >= 4 ? 'plus' : s <= 2 ? 'minus' : '', style: { width: Math.round(rv[s - 1] / mx * 100) + '%' } })), h('b', {}, rv[s - 1]))));
  const x = (v) => '×' + v.toFixed(2).replace(/0$/, '');
  const left = h('div', { class: 'rv-col' },
    h('div', { class: 'rv-big' }, h('b', {}, stars.toFixed(1)), starBar(stars)),
    h('div', { class: 'muted small' }, `評判 ${Math.round(st.rep)}/100`),
    h('div', { class: 'sum-h' }, `📅 今日の評価 ${n ? '（' + n + '人）' : ''}`), n ? dist : h('p', { class: 'muted small' }, 'まだ評価がありません'),
    h('div', { class: 'sum-h' }, '🚶 お客さんの来やすさ'),
    h('div', { class: 'rv-fac' }, h('div', {}, `⭐ 評判 ${x(f.rep)}`), h('div', {}, `🏮 お店のレベル ${x(f.lv)}`), h('div', {}, `📐 お店の広さ ${x(f.size)}`), f.attract > 1 ? h('div', {}, `✨ 縁起物・装飾 ${x(f.attract)}`) : null, h('div', { class: 'rv-total' }, `合計 ${x(f.rep * f.lv * f.size * f.attract)}`)),
    h('div', { class: 'muted small' }, '評判が上がる：おいしい（麺のかたさ・スープのコクと温度・注文どおりのトッピング）・早く出す・お得な値段・きれいな席。下がる：待たせる・注文ちがい・高すぎ・片付けていない席・火事・手裏剣が当たる'));
  const list = (st.reviews || []).length ? st.reviews.map((r) => h('div', { class: 'rv-item' + (r.s <= 2 ? ' bad' : r.s >= 5 ? ' good' : '') }, h('div', { class: 'rv-head' }, h('span', { class: 'rv-s' }, '★'.repeat(r.s) + '☆'.repeat(5 - r.s)), h('span', { class: 'muted small' }, `${r.d}日目 ${fmtTime(r.t)}`)), h('div', { class: 'rv-m' }, '「' + r.m + '」'))) : [h('p', { class: 'muted small' }, 'まだ口コミはありません')];
  return h('div', { class: 'rv-grid' }, left, h('div', { class: 'rv-col' }, h('div', { class: 'sum-h' }, '💬 最近の口コミ'), h('div', { class: 'rv-list' }, list)));
}
export { CHOHAN_T };
