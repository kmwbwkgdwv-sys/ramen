// ===== 賭場の演出（丁半博打・チンチロリン・スロット） =====
// 勝負の結果はホスト（sim.js）で決まる。ここでは「すぐに終わらせない」ための演出だけをする：
//   丁半：壺振りの口上 → 張る（締め切りのカウントダウン）→「丁半そろいました」「勝負！」→ 壺をゆっくり開ける → 出目
//   チンチロ：親が振る（目なしは振り直し）→ 自分で「振る」を押す（最大3回）。2つそろったら「ゾロ目くるか…!?」
//   スロット：予告ランプ → 自分でSTOP（押さなければ自動）→ 2つそろうと「リーチ！」でゆっくり止まる → 当たりはコインの雨
import { h, modal, toast } from './ui.js';
import { CHOHAN_FEE, CHOHAN_T, CHOHAN_ZORO, SLOT_PAY, SLOT_CHERRY2, SLOT_SYMS, SLOT_JP, BET_CHIPS } from './data.js';
import { yen, mulberry32, clamp } from './util.js';

const FACES = '⚀⚁⚂⚃⚄⚅';
const face = (v) => FACES[(v | 0) - 1] || '⚀';
// 丁半の出目の呼び方（例：シロクの丁・グイチの丁・サブロクの半・ピンゾロの丁）
const ZORO = ['ピンゾロ', 'ニゾロ', 'サンゾロ', 'シゾロ', 'ゴゾロ', 'ロクゾロ'];
const CALL = { '1-2': 'ピンニ', '1-3': 'サンピン', '1-4': 'ヨイチ', '1-5': 'グイチ', '1-6': 'ロッピン', '2-3': 'ニサン', '2-4': 'シニ', '2-5': 'グニ', '2-6': 'ニロク', '3-4': 'シソウ', '3-5': 'グサン', '3-6': 'サブロク', '4-5': 'シゴ', '4-6': 'シロク', '5-6': 'ゴロク' };
export function diceCall(d) {
  if (!d) return '';
  const [a, b] = d; if (a === b) return ZORO[a - 1];
  return CALL[`${Math.min(a, b)}-${Math.max(a, b)}`] || '';
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export class GambleUI {
  constructor(ui) {
    this.ui = ui;
    this.stat = { streak: 0, net: 0, plays: 0, best: 0 }; // この遊びの間の成績（連勝・収支）
    this.view = null;
  }
  get g() { return this.ui.g; }
  sfx(s, v) { try { this.g.app.sfx.play(s, v); } catch (e) { /* noop */ } }
  record(net) {
    const S = this.stat; S.plays++; S.net += net; S.best = Math.max(S.best, net);
    S.streak = net > 0 ? (S.streak > 0 ? S.streak + 1 : 1) : net < 0 ? (S.streak < 0 ? S.streak - 1 : -1) : S.streak;
  }
  statLine() {
    const S = this.stat; if (!S.plays) return null;
    const st = S.streak >= 2 ? h('b', { class: 'g-hot' }, `🔥 ${S.streak}連勝中！`) : S.streak <= -3 ? h('b', { class: 'g-cold' }, `😣 ${-S.streak}連敗… 流れが変わるかも？`) : null;
    return h('div', { class: 'g-stat' }, st, h('span', {}, `今日の勝負 ${S.plays}回・収支 `), h('b', { class: S.net >= 0 ? 'plus' : 'minus' }, (S.net >= 0 ? '+' : '−') + yen(Math.abs(S.net))));
  }
  // ---------- 演出の部品 ----------
  layer(panel) { let L = panel.querySelector(':scope > .g-fx'); if (!L) { L = h('div', { class: 'g-fx' }); panel.append(L); } return L; }
  banner(panel, text, cls = '', ms = 2200) {
    const L = this.layer(panel), b = h('div', { class: 'g-banner ' + cls }, text);
    L.append(b); setTimeout(() => b.remove(), ms); return b;
  }
  coins(panel, n = 24) {
    const L = this.layer(panel);
    for (let i = 0; i < n; i++) {
      const c = h('i', { class: 'g-coin', style: `left:${(Math.random() * 96).toFixed(1)}%;animation-delay:${(Math.random() * 0.9).toFixed(2)}s;animation-duration:${(1.1 + Math.random() * 0.9).toFixed(2)}s` }, Math.random() < 0.25 ? '💴' : '🪙');
      L.append(c); setTimeout(() => c.remove(), 2400);
    }
  }
  flash(panel, cls = 'gold') { const L = this.layer(panel), f = h('div', { class: 'g-flash ' + cls }); L.append(f); setTimeout(() => f.remove(), 900); }
  countUp(el, to, ms = 900) {
    const t0 = performance.now(), sgn = to >= 0 ? '+' : '−';
    const step = () => { const k = clamp((performance.now() - t0) / ms, 0, 1), v = Math.round(Math.abs(to) * (1 - Math.pow(1 - k, 3))); el.textContent = sgn + yen(v); if (k < 1 && el.isConnected) requestAnimationFrame(step); };
    step();
  }
  // 勝ち負けの大きな表示
  result(panel, net, big, label) {
    this.record(net);
    if (net > 0) {
      const amt = h('b', { class: 'g-amt' });
      this.banner(panel, h('div', {}, h('div', {}, label || '🎉 勝ち！'), amt), 'win' + (big ? ' big' : ''), big ? 3600 : 2600);
      this.countUp(amt, net, big ? 1600 : 900);
      this.coins(panel, big ? 60 : 26); this.flash(panel, 'gold');
      this.sfx(big ? 'bigwin' : 'win'); setTimeout(() => this.sfx('coins'), 300);
      if (this.stat.streak >= 3) setTimeout(() => this.banner(panel, `🔥 ${this.stat.streak}連勝！ ツイてる！`, 'streak', 1800), 1400);
    } else if (net < 0) { this.banner(panel, h('div', {}, h('div', {}, label || '💸 負け…'), h('b', { class: 'g-amt' }, '−' + yen(-net))), 'lose', 2000); this.sfx('lose'); }
    else { this.banner(panel, label || '🤝 引き分け（分け）', 'draw', 1800); this.sfx('click'); }
  }
  open(kind) { if (kind === 'chohan') return this.openChohan(); if (kind === 'chinchiro') return this.openChinchiro(); return this.openSlot(); }
  onEvent(e) {
    if (this.view?.kind === e.g && this.view.onEvent) return this.view.onEvent(e);
    if (e.g === 'chinchiro' && e.step !== 'end') return;
    if (e.g === 'chohan') { toast(e.win ? `🎲 ${diceCall(e.d)}の${e.res === 'cho' ? '丁' : '半'}！ 当たり！ +${yen(e.net)}` : `🎲 ${diceCall(e.d)}の${e.res === 'cho' ? '丁' : '半'}… はずれ −${yen(-e.net)}`, e.win ? 'money' : 'warn', 3000); this.sfx(e.win ? 'win' : 'lose'); this.record(e.net); return; }
    this.record(e.net || 0);
    toast(e.net >= 0 ? `🎲 +${yen(e.net)}` : `🎲 −${yen(-e.net)}`, e.net >= 0 ? 'money' : 'warn');
  }
  // 賭け金のチップ（cash＝画面に見せている手持ち。演出の途中で結果がばれないように）
  chips(onPick, cur, cash) {
    if (!cash) return h('div', { class: 'no-cash' }, '💴 お金を持っていません。お店のレジを開けて、お金をつかんでこよう');
    return h('div', { class: 'gchips' }, BET_CHIPS.filter((v) => v < cash).map((v) => h('button', { class: 'gchip' + (cur === v ? ' on' : ''), onclick: () => onPick(v) }, v >= 10000 ? `${v / 10000}万` : v.toLocaleString())), h('button', { class: 'gchip all' + (cur === 'all' || cur === cash ? ' on' : ''), onclick: () => onPick('all') }, `ぜんぶ ${yen(cash)}`));
  }
  betFor(bet, cash) { return bet === 'all' ? cash : Math.min(bet, cash); }

  // ======================= 丁半博打 =======================
  openChohan() {
    const U = this.ui, g = this.g, body = h('div', { class: 'gpanel chohan' }), timers = [];
    let bet = U._bet || 1000, lastPh = null, lastSec = -1, key = '';
    const later = (ms, fn) => timers.push(setTimeout(fn, ms));
    // 盆のまわりの旦那衆（雰囲気づくり・勝負には関係ない）
    const crowd = (n) => { const r = mulberry32(n * 7919 + 3), mk = () => ({ n: 1 + Math.floor(r() * 4), a: Math.round(3 + r() * 40) * 1000 }); return { cho: mk(), han: mk() }; };
    const onPhase = (ph) => {
      if (ph === 'shake') { this.sfx('cup'); later(350, () => this.sfx('rattle')); }
      else if (ph === 'bet') this.sfx('place');
      else if (ph === 'call') { this.sfx('click'); later(CHOHAN_T.call * 500, () => this.sfx('shout')); }
      else if (ph === 'open') { this.sfx('drum'); later(1550, () => { this.sfx('heart'); this.sfx('drum'); }); later(3000, () => this.sfx('heart')); }
      else if (ph === 'show') { this.sfx('drumEnd'); later(150, () => this.sfx('dice')); }
    };
    const draw = () => {
      const C = g.dyn?.ch; if (!C) return;
      const ph = C.ph, sec = Math.ceil(C.t), mine = C.b?.[g.me], cash = U.cash();
      if (ph !== lastPh) { if (lastPh) onPhase(ph); lastPh = ph; }
      if (ph === 'bet' && sec <= 5 && sec > 0 && sec !== lastSec) this.sfx(sec <= 2 ? 'tock' : 'tick');
      lastSec = sec;
      const k = JSON.stringify([ph, ph === 'bet' ? sec : ph === 'call' ? C.t < CHOHAN_T.call / 2 : 0, C.d, C.b, bet, cash, C.n, this.stat.plays]);
      if (k === key) return; key = k;
      for (const el of [...body.children]) if (!el.classList.contains('g-fx')) el.remove();
      const add = (...els) => { const L = body.querySelector(':scope > .g-fx'); for (const el of els) if (el) body.insertBefore(el, L); };
      const odd = C.d ? (C.d[0] + C.d[1]) % 2 : 0;
      const say = { shake: '「入ります！」', bet: '「さあ、張った張った！ 丁方ないか、半方ないか！」', call: C.t > CHOHAN_T.call / 2 ? '「丁半そろいました……」' : '「勝負ッ！！」', open: '「…………」', show: C.d ? `「${diceCall(C.d)}の${odd ? '半' : '丁'}！」` : '' }[ph] || '';
      add(h('div', { class: 'g-dealer' }, h('span', { class: 'g-dicon' }, '🧔'), h('div', { class: 'g-say ' + ph }, say), h('span', { class: 'g-round' }, `第${C.n}番`)));
      const table = h('div', { class: 'g-table' + (ph === 'open' ? ' tense' : '') });
      if (ph === 'show' && C.d) table.append(h('div', { class: 'dice-row' }, C.d.map((v, i) => h('span', { class: 'die big land', style: `animation-delay:${i * 0.22}s` }, face(v)))), h('div', { class: 'g-callout ' + (C.d[0] === C.d[1] ? 'zoro' : odd ? 'han' : 'cho') }, C.d[0] === C.d[1] ? 'ゾロ目！' : odd ? '半' : '丁'));
      else table.append(h('div', { class: 'cup2 ' + (ph === 'shake' ? 'shake' : ph === 'open' ? 'lift' : 'down'), style: ph === 'open' ? `animation-delay:-${Math.max(0, CHOHAN_T.open - C.t).toFixed(2)}s` : '' }, '🥣'));
      const N = crowd(C.n), tot = (s) => Object.values(C.b || {}).filter((b) => b[0] === s).reduce((t, b) => t + b[1], 0), cnt = (s) => Object.values(C.b || {}).filter((b) => b[0] === s).length;
      table.append(h('div', { class: 'g-pots' }, h('span', { class: 'gp cho' }, `丁方 ${N.cho.n + cnt('cho')}人 ${yen(N.cho.a + tot('cho'))}`), tot('zoro') ? h('span', { class: 'gp zoro' }, `ゾロ ${yen(tot('zoro'))}`) : null, h('span', { class: 'gp han' }, `半方 ${N.han.n + cnt('han')}人 ${yen(N.han.a + tot('han'))}`)));
      add(table);
      if (ph === 'bet') add(h('div', { class: 'g-timer' + (sec <= 5 ? ' hurry' : '') }, h('i', { style: `width:${clamp(C.t / CHOHAN_T.bet * 100, 0, 100).toFixed(0)}%` }), h('b', {}, sec <= 5 ? `締め切り ${sec}秒！` : `張れるのは あと${sec}秒`)));
      else if (ph === 'shake') add(h('div', { class: 'g-timer wait' }, h('b', {}, '壺を振っています… 伏せたら張れます')));
      const can = ph === 'bet';
      const btn = (s, label, sub) => h('button', { class: `chbtn ${s}${mine?.[0] === s ? ' on' : ''}`, disabled: !can || (!cash && !mine), onclick: () => { g.act({ t: 'bet', s, a: mine && !cash ? mine[1] : this.betFor(bet, U.cash() + (mine ? mine[1] : 0)) }); this.sfx('chip'); } }, h('b', {}, label), h('small', {}, sub), mine?.[0] === s ? h('span', { class: 'chstack' }, yen(mine[1])) : null);
      add(h('div', { class: 'cho-han three' }, btn('cho', '丁', '偶数 2倍'), btn('zoro', 'ゾロ目', `同じ目 ${CHOHAN_ZORO}倍`), btn('han', '半', '奇数 2倍')));
      add(h('div', { class: 'g-mine' }, mine ? `あなた：${{ cho: '丁', han: '半', zoro: 'ゾロ目' }[mine[0]]}に ${yen(mine[1])}` : can ? '丁か半かゾロ目に張ろう' : '次の勝負を待とう', mine && can ? h('button', { class: 'btn tiny ghost', onclick: () => g.act({ t: 'bet', cancel: 1 }) }, '取り消す') : null));
      if (can || !mine) add(h('div', { class: 'muted small center' }, `張るお金（手持ち ${yen(cash)}）`), this.chips((v) => { bet = U._bet = v; key = ''; draw(); }, bet, cash));
      const others = Object.entries(C.b || {}).filter(([kk]) => kk !== g.me);
      if (others.length) add(h('div', { class: 'g-others' }, '👥 ', others.map(([, b]) => `${b[2] || '仲間'}：${{ cho: '丁', han: '半', zoro: 'ゾロ' }[b[0]]} ${yen(b[1])}`).join('　')));
      // 出目の流れ（同じのが続くと気になる…）
      const hist = C.h || [], run = (() => { if (!hist.length) return 0; const p = (hist[0][0] + hist[0][1]) % 2; let n = 0; for (const [a, b] of hist) { if ((a + b) % 2 === p) n++; else break; } return n; })();
      add(h('div', { class: 'g-hist' }, '出目：', hist.map(([a, b]) => h('span', { class: 'hist ' + (a === b ? 'zoro' : (a + b) % 2 ? 'han' : 'cho') }, `${a + b}${a === b ? 'ゾ' : (a + b) % 2 ? '半' : '丁'}`))));
      if (run >= 3) add(h('div', { class: 'g-flow' }, `🌊 「${(hist[0][0] + hist[0][1]) % 2 ? '半' : '丁'}」が${run}回続いています……`));
      add(this.statLine());
      add(h('p', { class: 'muted small' }, `当たるとセットしたお金が2倍（ゾロ目は${CHOHAN_ZORO}倍）になって手元に返ってきます（もうけから寺銭${Math.round(CHOHAN_FEE * 100)}%）。ルームの仲間と同じ勝負に乗れます。勝ったお金はレジに戻そう`));
    };
    const view = { kind: 'chohan', onEvent: (e) => { later(500, () => this.result(body, e.net, e.s === 'zoro' && e.win, e.win ? (e.s === 'zoro' ? `🎯 ゾロ目的中！ ${diceCall(e.d)}！` : `🎉 ${diceCall(e.d)}の${e.res === 'cho' ? '丁' : '半'}！ 当たり！`) : `💸 ${diceCall(e.d)}の${e.res === 'cho' ? '丁' : '半'}… はずれ`)); } };
    this.view = view;
    const iv = setInterval(draw, 120);
    const m = modal('🎲 丁半博打', [body], { cls: 'gamblem', onClose: () => { clearInterval(iv); timers.forEach(clearTimeout); if (this.view === view) this.view = null; U.closed(); } });
    U.opened(m); this.layer(body); draw();
  }

  // ======================= チンチロリン =======================
  openChinchiro() {
    const U = this.ui, g = this.g, body = h('div', { class: 'gpanel chin' });
    let bet = U._bet || 1000;
    const S = { ph: 'bet', active: false, await: false, dealer: null, you: [], msg: '親（胴元）と勝負！ 賭け金を決めて「勝負！」', dh: '', yh: '', dDice: null, yDice: null, left: 3, cash: null, last: null };
    const tok = { dead: false }, q = { p: Promise.resolve() };
    const enqueue = (fn) => { q.p = q.p.then(() => (tok.dead ? null : fn())).catch((e) => console.warn(e)); };
    const wait = (ms) => sleep(ms).then(() => { if (tok.dead) throw new Error('closed'); });
    let spinIv = null;
    const bowl = (who) => body.querySelector(`.chin-bowl.${who} .bd`);
    const spin = (who) => { clearInterval(spinIv); spinIv = setInterval(() => { const el = bowl(who); if (el) el.textContent = [0, 0, 0].map(() => face(1 + Math.floor(Math.random() * 6))).join(''); }, 70); const b = body.querySelector(`.chin-bowl.${who}`); b?.classList.add('rolling'); };
    const stopSpin = (who) => { clearInterval(spinIv); spinIv = null; body.querySelector(`.chin-bowl.${who}`)?.classList.remove('rolling'); };
    // 1回ぶんのサイコロを1つずつ落とす（2つそろったら3つめはじらす）
    const land = async (who, d) => {
      spin(who); this.sfx('rattle'); await wait(1150);
      stopSpin(who);
      const shown = ['❔', '❔', '❔'], set = () => { const el = bowl(who); if (el) el.textContent = shown.join(''); };
      for (let i = 0; i < 3; i++) {
        if (i === 2 && d[0] === d[1]) {
          S.msg = d[0] === 1 ? 'ピンが2つ…！ ピンゾロくるか…!?' : 'ゾロ目くるか…!?'; draw(); body.classList.add('reach'); this.sfx('reach');
          await wait(600); this.sfx('heart'); await wait(700); this.sfx('heart'); await wait(500); body.classList.remove('reach');
        } else if (i === 2 && [d[0], d[1]].sort().join() === '4,5') { S.msg = '4・5…… 6ならシゴロ!?'; draw(); this.sfx('heart'); await wait(900); }
        shown[i] = face(d[i]); set(); this.sfx('diceLand'); await wait(i === 2 ? 200 : 330);
      }
    };
    const handName = (hh) => (hh ? hh.name : '目なし');
    const draw = () => {
      for (const el of [...body.children]) if (!el.classList.contains('g-fx')) el.remove();
      const add = (...els) => { const L = body.querySelector(':scope > .g-fx'); for (const el of els) if (el) body.insertBefore(el, L); };
      const cash = S.cash ?? U.cash();
      add(h('div', { class: 'g-status' + (S.ph === 'you' ? ' turn' : '') }, S.msg));
      const side = (who, label, dice, hn, extra) => h('div', { class: 'chin-bowl ' + who }, h('div', { class: 'cb-l' }, label), h('div', { class: 'cb-bowl' }, h('span', { class: 'bd' }, dice ? dice.map(face).join('') : '　')), h('div', { class: 'chin-hand' }, hn || '　'), extra || null);
      add(h('div', { class: 'chin-res' }, side('dealer', '🧔 親（胴元）', S.dDice, S.dh), side('you', '🫵 あなた', S.yDice, S.yh, S.ph === 'you' || S.ph === 'rolling' ? h('div', { class: 'cb-left' }, `あと${S.left}回振れる`) : null)));
      if (S.ph === 'bet' || S.ph === 'result') {
        if (S.ph === 'result' && S.last) add(h('div', { class: 'g-again' },
          h('button', { class: 'btn big again', disabled: cash < S.last, onclick: () => start(S.last) }, `🔁 もう一勝負（${yen(S.last)}）`),
          h('button', { class: 'btn big double', disabled: cash < S.last * 2, onclick: () => start(S.last * 2) }, `🔥 倍で勝負（${yen(S.last * 2)}）`)));
        add(h('div', { class: 'muted small center' }, `賭け金（手持ち ${yen(cash)}）`), this.chips((v) => { bet = U._bet = v; draw(); }, bet, cash));
        add(h('button', { class: 'btn big go', disabled: !cash, onclick: () => start(this.betFor(bet, U.cash())) }, `🥣 ${yen(this.betFor(bet, cash))} で親に勝負！`));
      } else if (S.ph === 'you') add(h('button', { class: 'btn big roll', onclick: () => roll() }, '🎲 振る！'));
      else add(h('div', { class: 'g-wait' }, S.ph === 'rolling' ? '🎲 カラカラカラ……' : '🧔 親が振っています……'));
      add(this.statLine());
      add(h('p', { class: 'muted small' }, '役：ピンゾロ（1・1・1）5倍＞ゾロ目 3倍＞シゴロ（4・5・6）2倍＞目（2つそろった残りの数）＞目なし。親がピンゾロ・ゾロ目・シゴロなら親の総取り、親がヒフミ（1・2・3）や目なしなら親の負け。子のヒフミは2倍払い。目なしは3回まで振り直せる'));
    };
    const start = (v) => {
      if (!(v > 0) || S.active) return;
      if (v > U.cash()) return;
      S.cash = U.cash() - v; S.last = v; S.ph = 'dealer'; S.active = true; S.await = false; S.dealer = null; S.dDice = null; S.yDice = null; S.dh = ''; S.yh = ''; S.left = 3;
      S.msg = `${yen(v)} をセット。親が振ります……`; draw(); this.sfx('chip');
      g.act({ t: 'chinchiro', a: v });
      S.timeout = setTimeout(() => { if (S.ph === 'dealer' && !S.dealer) { S.ph = 'bet'; S.active = false; S.cash = null; S.msg = '勝負できませんでした'; draw(); } }, 6000);
    };
    const roll = () => {
      if (S.ph !== 'you') return;
      S.ph = 'rolling'; draw(); spin('you'); this.sfx('rattle');
      g.act({ t: 'chinRoll' });
    };
    const playDealer = async (D) => {
      for (let i = 0; i < D.rolls.length; i++) {
        const last = i === D.rolls.length - 1;
        S.msg = i ? `親：目なし…振り直し（${i + 1}回目）` : '親が振ります……'; draw();
        await land('dealer', D.rolls[i]); S.dDice = D.rolls[i];
        S.dh = last ? handName(D.h) : '目なし'; draw(); await wait(last ? 500 : 650);
      }
    };
    const finish = async (e) => {
      S.active = false; S.ph = 'result'; S.cash = null;
      const big = (e.mult || 0) >= 3, by = e.by;
      const D = e.dealer.h, Y = e.you?.h;
      S.msg = by === 'dealer' ? (e.net < 0 ? `親の「${D.name}」！ 親の総取り…` : `親が「${D.name}」！ 親の負け！`) : e.net > 0 ? `あなたの「${Y.name}」！ あなたの勝ち！` : e.net < 0 ? (Y.k === 'hifumi' ? 'ヒフミ…！ 2倍払い' : Y.k === 'none' ? '目なし…あなたの負け' : `親の「${D.name}」に負け…`) : '同じ目で分け（引き分け）';
      draw(); await wait(200);
      this.result(body, e.net, big, e.net > 0 ? (Y?.k === 'pinzoro' ? '👑 ピンゾロ！ 5倍づけ！' : Y?.k === 'zoro' ? '✨ ゾロ目！ 3倍づけ！' : Y?.k === 'shigoro' ? '🎉 シゴロ！ 2倍づけ！' : '🎉 勝ち！') : null);
      draw();
    };
    const view = {
      kind: 'chinchiro',
      onEvent: (e) => {
        clearTimeout(S.timeout);
        if (e.step === 'dealer') { S.dealer = e.dealer; S.await = true; enqueue(async () => { await playDealer(e.dealer); S.ph = 'you'; S.msg = `親は「${e.dealer.h.name}」。あなたの番！ 「振る！」を押そう`; this.sfx('ding'); draw(); }); }
        else if (e.step === 'roll') enqueue(async () => { S.left = e.left; await land('you', e.d); S.yDice = e.d; S.yh = '目なし'; S.ph = 'you'; S.msg = `目なし… あと${e.left}回振れる！`; draw(); });
        else if (e.step === 'end') {
          S.await = false;
          if (e.by === 'dealer') enqueue(async () => { await playDealer(e.dealer); await finish(e); });
          else enqueue(async () => { const r = e.you.rolls; S.left = 3 - r.length; await land('you', r[r.length - 1]); S.yDice = r[r.length - 1]; S.yh = handName(e.you.h); draw(); await wait(350); await finish(e); });
        }
      },
    };
    this.view = view;
    const m = modal('🥣 チンチロリン', [body], { cls: 'gamblem', onClose: () => {
      tok.dead = true; clearInterval(spinIv); clearTimeout(S.timeout);
      if (S.await) g.act({ t: 'chinRoll', all: 1 }); // 途中でやめたら残りは自動で振る
      if (this.view === view) this.view = null; U.closed();
    } });
    U.opened(m); this.layer(body); draw();
  }

  // ======================= スロット =======================
  openSlot() {
    const U = this.ui, g = this.g, body = h('div', { class: 'gpanel slot' });
    let bet = Math.min(U._bet || 100, 10000);
    const syms = SLOT_SYMS.map((s) => s[0]);
    const S = { spinning: false, res: null, stopped: [false, false, false], reach: false, lock: false, auto: 0, cash: null, faces: ['7', '🍒', '🍜'] };
    const tok = { dead: false }, timers = [];
    const later = (ms, fn) => timers.push(setTimeout(() => { if (!tok.dead) fn(); }, ms));
    const reelEls = [0, 1, 2].map(() => h('div', { class: 'reel' }, h('span', { class: 'rs' })));
    const stopBtns = [0, 1, 2].map((i) => h('button', { class: 'stopb', onclick: () => stop(i, true) }, 'STOP'));
    const lamps = h('div', { class: 'lamps' }, [...Array(9)].map((_, i) => h('i', { style: `animation-delay:${i * 0.08}s` })));
    const jpEl = h('b', { class: 'jp-num' });
    const msg = h('div', { class: 'g-status' }, '🎰 3つそろえよう！ 7・7・7 でジャックポット！');
    const ctrl = h('div', { class: 'slot-ctrl' });
    let spinIv = null, slowK = 0;
    const paint = () => reelEls.forEach((r, i) => { r.firstChild.textContent = S.faces[i]; r.classList.toggle('seven', S.faces[i] === '7'); });
    const tickSpin = () => { slowK++; S.faces = S.faces.map((f, i) => (S.stopped[i] ? f : (S.reach && !S.stopped[i] && slowK % 3) ? f : syms[Math.floor(Math.random() * syms.length)])); paint(); };
    const jp = () => g.store?.jp || SLOT_JP.base;
    const drawCtrl = () => {
      ctrl.innerHTML = '';
      const cash = S.cash ?? U.cash();
      ctrl.append(h('div', { class: 'muted small center' }, `1回に入れるお金（手持ち ${yen(cash)}）`), this.chips((v) => { bet = U._bet = v; drawCtrl(); }, bet, cash));
      ctrl.append(h('div', { class: 'g-again' },
        h('button', { class: 'btn big go', disabled: !cash || S.spinning, onclick: () => { S.auto = 0; spin(); } }, S.spinning ? '🎰 回転中…' : `🎰 ${yen(this.betFor(bet, cash))} 入れて回す`),
        h('button', { class: 'btn big auto' + (S.auto ? ' on' : ''), disabled: !cash && !S.auto, onclick: () => { if (S.auto) { S.auto = 0; drawCtrl(); return; } S.auto = 10; if (!S.spinning) spin(); else drawCtrl(); } }, S.auto ? `⏹ オート停止（あと${S.auto}回）` : '🔁 オート10回')));
      ctrl.append(h('div', { class: 'paytable' }, Object.entries(SLOT_PAY).map(([s, v]) => h('span', {}, `${s === 'BAR' ? 'BAR×3' : s + s + s} ×${v}${s === '7' ? '＋JP' : ''}`)), h('span', {}, `🍒🍒 ×${SLOT_CHERRY2}`)));
      const st = this.statLine(); if (st) ctrl.append(st);
    };
    const spin = () => {
      if (S.spinning || tok.dead) return;
      const cash = U.cash(), v = this.betFor(bet, cash); if (!(v > 0)) { S.auto = 0; drawCtrl(); return; }
      S.spinning = true; S.res = null; S.stopped = [false, false, false]; S.reach = false; S.lock = false; S.cash = cash - v; S.startT = performance.now();
      body.classList.remove('reach', 'win', 'chance'); reelEls.forEach((r) => r.classList.remove('stop', 'slow', 'hit')); stopBtns.forEach((b) => { b.disabled = true; b.classList.remove('lit'); });
      msg.textContent = '🎰 回転中…'; drawCtrl();
      clearInterval(spinIv); spinIv = setInterval(tickSpin, 60);
      this.sfx('slot'); this.sfx('chip');
      g.act({ t: 'slot', a: v });
      later(650, () => stopBtns.forEach((b, i) => { if (!S.stopped[i]) { b.disabled = false; b.classList.add('lit'); } }));
      // 押さなければ自動で止まる
      [2300, 2900, 3500].forEach((ms, i) => later(ms, () => autoStop(i)));
      later(9000, () => { if (S.spinning && !S.res) { clearInterval(spinIv); S.spinning = false; S.cash = null; msg.textContent = '通信がうまくいきませんでした'; drawCtrl(); } });
    };
    const autoStop = (i) => { if (!S.spinning || S.stopped[i]) return; if (!S.res || S.lock) { later(300, () => autoStop(i)); return; } stop(i, false); };
    const stop = (i, byHand) => {
      if (!S.spinning || S.stopped[i] || !S.res) return;
      if (S.lock && byHand) return;
      S.stopped[i] = true; S.faces[i] = S.res.r[i]; paint();
      reelEls[i].classList.add('stop'); reelEls[i].classList.remove('slow'); stopBtns[i].disabled = true; stopBtns[i].classList.remove('lit');
      this.sfx('reelStop');
      const left = S.stopped.filter((x) => !x).length;
      if (left === 1 && !S.reach) {
        const st = S.res.r.filter((_, k) => S.stopped[k]);
        if (st[0] === st[1]) {
          // リーチ！ 最後のリールをゆっくり回してじらす
          S.reach = true; S.lock = true; body.classList.add('reach');
          const last = S.stopped.findIndex((x) => !x); reelEls[last].classList.add('slow');
          msg.textContent = st[0] === '7' ? '🔥🔥 7・7 リーチ！！ ジャックポットくるか!? 🔥🔥' : `⚡ ${st[0]} リーチ！`;
          this.banner(body, st[0] === '7' ? '🔥 リーチ！ 🔥' : 'リーチ！', 'reach', 1500); this.sfx('reach'); this.flash(body, 'red');
          later(900, () => this.sfx('heart')); later(1700, () => this.sfx('heart')); if (st[0] === '7') { later(2400, () => this.sfx('heart')); later(2800, () => this.sfx('drum')); }
          later(st[0] === '7' ? 4300 : 2600, () => { S.lock = false; stopBtns[last].disabled = false; stopBtns[last].classList.add('lit'); later(900, () => autoStop(last)); });
        }
      }
      if (!left) finish();
    };
    const finish = () => {
      clearInterval(spinIv); spinIv = null;
      const e = S.res; S.spinning = false; S.cash = null; body.classList.remove('reach');
      if (e.mult || e.jp) {
        body.classList.add('win');
        const hit = e.r[0] === e.r[1] && e.r[1] === e.r[2] ? [0, 1, 2] : e.r.map((s, i) => (s === '🍒' ? i : -1)).filter((i) => i >= 0);
        hit.forEach((i) => reelEls[i].classList.add('hit'));
        msg.textContent = e.jp ? `👑 JACKPOT！！ ${yen(e.jp)} 総取り！` : `🎉 ×${e.mult}！`;
        this.result(body, e.net, e.mult >= 20 || !!e.jp, e.jp ? '👑 ジャックポット！！' : e.mult >= 40 ? `🎊 BIG ×${e.mult}！` : `🎉 ×${e.mult}！`);
      } else { msg.textContent = S.reach ? '…おしい！ もうちょっとだった！' : '…はずれ'; this.record(e.net); if (S.reach) this.sfx('lose'); }
      drawCtrl();
      if (S.auto > 0) { S.auto--; if (S.auto > 0 && U.cash() > 0) later(e.mult ? 2600 : 900, () => spin()); else { S.auto = 0; drawCtrl(); } }
    };
    const view = {
      kind: 'slot',
      onEvent: (e) => {
        if (!S.spinning) return;
        S.res = e;
        // 予告：当たりのときはチャンス演出が出やすい（はずれでもたまに出る）
        const good = e.jp || e.mult >= 8;
        if ((good && Math.random() < 0.5) || Math.random() < 0.06) { body.classList.add('chance'); msg.textContent = '✨ チャンス！ ✨'; this.sfx('kiin'); this.flash(body, 'rainbow'); }
      },
    };
    this.view = view;
    body.append(h('div', { class: 'jp' }, h('span', {}, '👑 JACKPOT'), jpEl), lamps, msg, h('div', { class: 'reels' }, reelEls), h('div', { class: 'stops' }, stopBtns), ctrl);
    paint(); drawCtrl(); this.layer(body);
    const jpIv = setInterval(() => { jpEl.textContent = yen(jp()); }, 250); jpEl.textContent = yen(jp());
    const m = modal('🎰 スロット', [body], { cls: 'gamblem', onClose: () => {
      tok.dead = true; timers.forEach(clearTimeout); clearInterval(spinIv); clearInterval(jpIv);
      if (S.spinning && S.res) { const e = S.res; toast(e.net > 0 ? `🎰 ${e.r.join('')} +${yen(e.net)}` : `🎰 ${e.r.join('')} はずれ`, e.net > 0 ? 'money' : 'warn'); this.record(e.net); }
      if (this.view === view) this.view = null; U.closed();
    } });
    U.opened(m);
  }
}
