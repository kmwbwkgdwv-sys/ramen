// ===== ゲームセッション（操作・同期・描画の橋渡し） =====
import * as THREE from 'three';
import { Sim, fitPlacement, potReady, potHeat, potAku, soupQuality, griddleQ, beerQ, repairCost, fridgeCap, fridgeUsed, evalDish, potReheat, topTotal, panRoom, dayWaste, crateItems } from './sim.js';
import {
  FIXTURES, SOUPS, TOPPINGS, SIDES, GRIDDLE, HARD, DISHES, INGREDIENTS, GAMBLES, PLAYER_BOUNDS, PLAYER_SPAWN, BUILDING, HALL, STAFF_ROLES, SOUP_READY, SOUP_RICH, RICE_READY, NOODLE_OVER, DIRTY_MAX,
  getWalls, fixtureFootprint, snapFixture, worldToLocal, localToWorld, pickSeat, pickBasket, pickPass, basketPos, isCounter, noodleLabel, inHall, BROTHS, TARES, soupRecipe, DRY_MAX,
  carryInfo, ingFits, ingShort, ingUnlocked, CARRY_SPEED, POT_PER, slotPos, pickSlot, SLOT_OK,
  fridgeLayout, fridgeCellPos, pickFridgeCell, fridgeItemName, fridgeGrid, CUT_N, PAN_MAX, staffEq, THROWABLE, packName, toppingPans, panKinds, pickPan,
} from './data.js';
import { clamp, yen, dist, angleLerp, lerp, escapeText } from './util.js';
import { toast, h, modal, confirmBox } from './ui.js';
import { sanitizeAvatar } from './models/character.js';
import { CEIL } from './render.js';

const RAY = new THREE.Raycaster();
const V2 = new THREE.Vector2();
const REACH = 2.4;
export const CRITIC_AV = { skin: '#f1b98c', hair: 'none', hairColor: '#2b1d16', eyes: 'cool', mouth: 'flat', brow: 'thick', blush: false, hat: 'none', acc: 'sun', top: 'suit', topColor: '#2b2d42', bottom: 'pants', bottomColor: '#2b2d42', shoeColor: '#111111', height: 1.04 };
const THIEF_AV = { skin: '#f1b98c', hair: 'short', hairColor: '#2b1d16', eyes: 'angry', mouth: 'flat', brow: 'thick', hat: 'beanie', hatColor: '#1c1d20', acc: 'mask', top: 'hoodie', topColor: '#26272b', bottom: 'pants', bottomColor: '#1c1d20', shoeColor: '#111111', height: 1 };
const DEALER_AV = { skin: '#d99b6c', hair: 'sidepart', hairColor: '#2b1d16', eyes: 'cool', mouth: 'flat', brow: 'thick', hat: 'hachimaki', hatColor: '#ffffff', acc: 'none', top: 'suit', topColor: '#1c1d20', bottom: 'pants', bottomColor: '#1c1d20', shoeColor: '#111111', height: 1 };
const SOUP_NAME = (k) => SOUPS[k]?.name || '';
// 料理の中身の説明
export function dishText(d) {
  if (!d) return '';
  const D = DISHES[d.k]?.name || '器';
  if (d.k === 'bowl') {
    if (!d.broth && !d.tare) return `🍜 空の${D}`;
    const soup = d.soup ? `${SOUP_NAME(d.soup)}スープ` : `${d.tare ? TARES[d.tare]?.short : 'タレなし'}＋${d.broth ? BROTHS[d.broth]?.short + 'スープ' : 'だしなし'}`;
    const men = d.men != null ? `・麺 ${d.men.toFixed(0)}秒（${noodleLabel(d.men)}）${(d.wet || 0) > 0.3 ? '💧水っぽい' : ''}` : d.broth ? '・麺なし' : '';
    const tp = (d.tp || []).map((t) => TOPPINGS[t]?.icon).join('');
    return `🍜 ${soup}${men}${tp ? '・' + tp : ''}`;
  }
  if (d.k === 'bowlS') return d.side === 'rice' ? `🍚 ライス${(d.tp || []).includes('chashu') ? '＋チャーシュー（チャーシュー丼）' : ''}` : `🍚 空の${D}`;
  if (d.k === 'plate') return d.side ? `${SIDES[d.side]?.icon}${SIDES[d.side]?.name}（${d.burnt ? '焦げ' : (d.q ?? 0) + '点'}）` : `🍽️ 空の${D}`;
  if (d.k === 'mug') return d.side === 'beer' ? `🍺 生ビール ${Math.round((d.fill || 0) * 100)}%（${beerQ(d.fill)}点）` : `🍺 空の${D}`;
  return D;
}
const lineName = (st, l) => (l[0] === 'ramen' ? st.menu.find((m) => m.id === l[1])?.name || 'ラーメン' : SIDES[l[0]]?.name || l[0]);

// 作業台に置いてある物の呼び名
export function slotItemName(o) {
  if (!o) return '';
  if (o.t === 'dish') return { bowl: 'ラーメン丼', bowlS: '小丼', plate: '皿', mug: 'ジョッキ' }[o.d.k] + (o.d.soup || o.d.side ? '（料理入り）' : o.d.tare ? '（タレ入り）' : '');
  if (o.t === 'dirty') return `下げた食器×${o.a.length}`;
  if (o.t === 'clean') return `洗った食器×${o.a.length}`;
  if (o.t === 'ing') return `${INGREDIENTS[o.k]?.icon || ''}${ingShort(o.k)}×${o.n}`;
  if (o.t === 'pot') return o.ft === 'pot2' ? '大寸胴鍋' : '寸胴鍋';
  if (o.t === 'top') return `${TOPPINGS[o.k]?.icon || ''}切った${TOPPINGS[o.k]?.name || ''}（1人前）`;
  if (o.t === 'keep') return `🫙スープ（${BROTHS[o.b]?.short || ''}）${o.sv}杯分`;
  if (o.t === 'pack') return `📦${INGREDIENTS[o.k]?.icon || ''}${packName(o.k)}`;
  if (o.t === 'tebo') return `♨️てぼ（麺 ${o.men.toFixed(0)}秒・${noodleLabel(o.men)}）`;
  return '?';
}
export class Game {
  constructor(app, opts) {
    const { mode, room, roomId } = opts;
    this.app = app; this.mode = mode; this.room = room; this.roomId = roomId;
    this.me = app.profile.pid;
    this.R = app.renderer; this.input = app.input; this.ui = app.gameUI;
    this.ui.bind(this);
    this.players = {}; this.local = !!opts.local;
    if (mode !== 'client') { this.sim = new Sim(app.profile.store); this.store = this.sim.store; this.sim.players[this.me] = { x: 0, z: 0, name: app.profile.name }; this.sim.custCap = app.renderer.lite ? 24 : 40; }
    else this.store = null;
    this.dyn = null; this.dynAt = 0;
    const [sx, sz] = PLAYER_SPAWN;
    this.pc = { x: sx + (Math.random() - 0.5), z: sz, y: 0, vy: 0, ry: Math.PI, yaw: 0.2, pitch: 0.25, grounded: true };
    this.state = 'walk';
    this.build = { sel: null, moving: null, r: 0, x: 0, z: 0, ok: false };
    this.timers = { net: 0, store: 0, dyn: 0, save: 0, rank: 0, repeat: 0, live: 0 };
    this.lastParts = {}; this.chat = {}; this.colRev = -1; this.hold = {};
    this.selOrder = null;
    this.setUIBlock(false);
    this.camDist = 3.2;
    if (room) this._bindRoom();
    this.ui.show(true);
    this.input.setRoom(!!room);
    this.input.wheelOff = this.input.on('wheel', (d) => { this.camDist = clamp(this.camDist + d * 0.4, 1.6, 6); });
    if (room) this.ui.setRoom([h('b', {}, '👥 ルーム ' + roomId), h('span', { class: 'plist2' })]);
    if (!this.app.profile.tutorialDone && mode !== 'client') setTimeout(() => { if (this.app.game === this) this.help(true); }, 600);
    setTimeout(() => { const st = this.store; if (st && st.day === 1 && st.phase === 'prep') toast('🍜 まずはパソコンで食材を仕入れよう！勝手口の外に段ボールで届くので、冷蔵庫に運んでから仕込み（画面の上の「次」に従えばOK）', 'ok', 6500); }, 2500);
  }
  _bindRoom() {
    const R = this.room;
    R.on('players', (pl) => {
      const prev = this.players; this.players = {};
      for (const [uid, p] of Object.entries(pl)) {
        if (uid === this.me) continue;
        let av = p.av; if (typeof av === 'string') { try { av = JSON.parse(av); } catch (e) { av = null; } }
        this.players[uid] = { ...p, av: sanitizeAvatar(av) };
        if (this.sim) this.sim.players[uid] = { x: p.x, z: p.z, name: p.n };
        if (!prev[uid]) toast(`👋 ${p.n || '???'} さんが参加しました`, 'ok');
      }
      for (const uid of Object.keys(prev)) if (!this.players[uid]) { toast(`${prev[uid].n || '???'} さんが退出しました`); if (this.sim) this.sim.playerLeft(uid); }
      const names = [this.app.profile.name, ...Object.values(this.players).map((p) => p.n)];
      const el = this.ui.roomInfo.querySelector('.plist2'); if (el) el.textContent = ` ${names.length}/4人：` + names.join('・');
    });
    R.on('action', ({ uid, a }) => { if (this.sim) { try { this.sim.act(uid, typeof a === 'string' ? JSON.parse(a) : a); } catch (e) { console.warn(e); } } });
    R.on('store', (parts) => {
      try {
        let changed = false;
        for (const k of ['core', 'fx']) if (parts[k] && parts[k] !== this.lastParts[k]) { this.lastParts[k] = parts[k]; changed = true; }
        if (!changed || !this.lastParts.core || !this.lastParts.fx) return;
        const core = JSON.parse(this.lastParts.core);
        const st = { ...core, fixtures: JSON.parse(this.lastParts.fx) };
        st.rev = (this.store?.rev || 0) + 1;
        st.time = this.dyn?.time ?? this.store?.time ?? core.time ?? 600;
        const prevPhase = this.store?.phase;
        this.store = st;
        if (this.roomId) this.app.rememberRoom(this.roomId, st);
        if (prevPhase === 'summary' && st.phase !== 'summary') this.ui.closeSummary();
        this.ui.refresh();
      } catch (e) { console.warn('store parse', e); }
    });
    R.on('dyn', (d) => { this.dyn = d; this.dynAt = performance.now(); if (this.store) this.store.time = d.time; });
    R.on('event', (e) => { try { this.handleEvent(typeof e === 'string' ? JSON.parse(e) : e); } catch (err) { console.warn(err); } });
    R.on('chat', (c) => this.onChat(c));
    R.on('closed', (why) => { if (this._closing) return; this._closing = true; toast('⚠ ' + why, 'warn', 4000); this.app.endGame(true); });
    if (R.requestState) { R.requestState(); setTimeout(() => { if (this.app.game === this && !this.store) R.requestState(); }, 300); }
    this._stateRetry = setInterval(() => { if (this.app.game !== this) return clearInterval(this._stateRetry); if (!this.store && R.requestState) R.requestState(); else if (this.store) clearInterval(this._stateRetry); }, 2000);
  }
  // ゲーム内の時計（秒）。参加した側はホストの時計＋受け取ってからの時間
  clk() { if (this.sim) return this.sim.clk; if (!this.dyn) return 0; return this.dyn.clk + Math.min(1, (performance.now() - this.dynAt) / 1000); }
  setUIBlock(v) { this.uiBlock = v; this.input.uiBlock = v; if (v) this.input.releasePointer(); }
  act(a) { if (this.sim) this.sim.act(this.me, a); else if (this.room) this.room.sendAction(a); }

  // ---------- イベント ----------
  handleEvent(e) {
    const me = this.me;
    switch (e.t) {
      case 'toast': if (!e.to || e.to === me) toast(e.msg, e.kind); break;
      case 'sfx': {
        if (e.to && e.to !== me) break;
        let v = 1; if (e.x != null) v = clamp(1.1 - dist(e.x, e.z, this.pc.x, this.pc.z) / 20, 0.08, 1);
        this.app.sfx.play(e.s, v); break;
      }
      case 'levelup':
        toast(e.max ? `👑 最高レベル Lv.${e.level} に到達！` : `🎉 レベルアップ！ お店 Lv.${e.level}`, 'level', 3500);
        if (e.unlocks?.length) setTimeout(() => toast(`🆕 できるようになったこと：${e.unlocks.map((u) => u.icon + u.name).join('・')}`, 'ok', 6500), 1200);
        break;
      case 'spray': this.R.sprayFx?.(e.x, 1.1, e.z, e.tx, e.tz, e.n || 10); { const now = performance.now(); if (now - (this._sprSfx || 0) > 280) { this._sprSfx = now; this.app.sfx.play('spray', clamp(1.1 - dist(e.x, e.z, this.pc.x, this.pc.z) / 18, 0.1, 1)); } } break;
      case 'summary': this.ui.closeAll(); this.ui.showSummary(e.data, this.mode !== 'client'); if (this.sim) this.app.saveGame(true); break;
      case 'newday': this.ui.closeSummary(); toast(`☀️ ${e.day}日目の朝！仕込みをしたら外の札を「営業中」にしよう`, 'ok', 3600); break;
      case 'sale': { this._sale = (this._sale || 0) + e.total; clearTimeout(this._saleT); this._saleT = setTimeout(() => { toast(`🎫 食券 +${yen(this._sale)}`, 'money', 1300); this._sale = 0; }, 250); break; }
      case 'review': {
        const r = e.r, now = performance.now();
        if (!r || (r.s > 1 && r.s < 5) || now - (this._rvT || 0) < 25000) break;
        this._rvT = now; toast(`💬 口コミ ${'★'.repeat(r.s)}${'☆'.repeat(5 - r.s)}「${r.m}」`, r.s <= 2 ? 'warn' : 'ok', 3200); break;
      }
      case 'critic': this.ui.showCritic(e); break;
      case 'gamble': if (e.to === me) this.ui.onGamble(e); else if (e.net > 50000) toast(`🎲 仲間が賭場で ${yen(e.net)} 勝った！`, 'money'); break;
      case 'yugiri': if (e.who === me) toast(`♨️ 湯切り！ 麺 ${e.sec.toFixed(0)}秒（${noodleLabel(e.sec)}）${(e.wet || 0) > 0.3 ? '💧水っぽい…' : ''}`, '', 1500); break;
      case 'dishfly': this.R.flyFx?.(e); break;
      default: break;
    }
  }
  onChat(c) { this.ui.addChat(c); this.chat[c.uid] = { text: String(c.m || '').slice(0, 40), t: 5 }; if (c.uid !== this.me) this.app.sfx.play('chat'); }
  sendChat(text) { if (this.room) this.room.sendChat({ uid: this.me, n: this.app.profile.name, m: text.slice(0, 60) }); }

  // 画面が裏に回っている間（ホストだけ）：描画はせず、お店の計算とルームへの送信だけ続ける
  backgroundStep(dt) {
    if (!this.sim) return;
    for (let left = dt; left > 1e-4; left -= 0.05) {
      const step = Math.min(0.05, left);
      this.sim.players[this.me] = { x: this.pc.x, z: this.pc.z, name: this.app.profile.name };
      this.sim.tick(step);
    }
    this.dyn = this.sim.dynSnapshot(); this.dynAt = performance.now();
    const evs = this.sim.events.splice(0);
    for (const e of evs) { if (e.t === 'summary' || e.t === 'newday') this.handleEvent(e); if (this.room) this.room.sendEvent(e); }
    this._net(dt);
  }
  // ---------- 毎フレーム ----------
  update(dt) {
    if (this.sim) {
      this.sim.players[this.me] = { x: this.pc.x, z: this.pc.z, name: this.app.profile.name };
      this.sim.tick(dt);
      this.dyn = this.sim.dynSnapshot(); this.dynAt = performance.now();
      if (this.sim.events.length) { const evs = this.sim.events.splice(0); for (const e of evs) { this.handleEvent(e); if (this.room) this.room.sendEvent(e); } }
    }
    if (!this.store) { this.R.camera.position.set(0, 8, 20); this.R.camera.lookAt(0, 1, 0); this.ui.setHint('ホストの店に接続中…'); return; }
    const inp = this.input.poll();
    this._collisions();
    if (inp.edges.has('menu')) { if (this.state === 'build') this.toggleBuild(false); else this.ui.openPause(); }
    if (inp.edges.has('chat') && this.room) this.ui.openChat();
    if (inp.edges.has('tab') && this.state !== 'build' && !this.ui.open) this.ui.openRep();
    if (inp.edges.has('cam')) { this.app.settings.cam = this.app.settings.cam === 'first' ? 'third' : 'first'; this.app.applySettings(); }
    if (inp.edges.has('build')) this.toggleBuild(this.state !== 'build');
    if (inp.edges.has('binder') && this.state === 'walk') this.ui.toggleOrders();
    this._updateWalk(dt, inp);
    this._net(dt);
    this._render(dt);
    this.ui.updateHUD(dt, this.store, this.dyn);
    this.ui.updateOrders(this.store, this.dyn, this.clk(), this.selOrder);
    this.timers.live += dt;
    if (this.timers.live > 1) { this.timers.live = 0; this.ui.live(); }
    this.app.profile.playTime += dt;
    if (this.sim) { this.timers.save += dt; if (this.timers.save > 20) { this.timers.save = 0; this.app.saveGame(false); } }
    this.timers.rank += dt; if (this.timers.rank > 90) { this.timers.rank = 0; this.app.pushRank(); }
  }
  _collisions() {
    const st = this.store;
    if (st.rev === this.colRev) return;
    this.colRev = st.rev;
    this.rects = [...getWalls(st), ...this.R.world.obstacles];
    for (const f of st.fixtures) { if (FIXTURES[f.t]?.air) continue; const fp = fixtureFootprint(f.t, f.x, f.z, f.r); this.rects.push({ minX: fp.minX + 0.04, maxX: fp.maxX - 0.04, minZ: fp.minZ + 0.04, maxZ: fp.maxZ - 0.04, fx: true, f }); }
  }
  // (px,pz) の高さ y の所に設備・壁があるか（設備は場所ごとの高さで判定）
  _solidAt(px, pz, y) {
    for (const b of this.rects || []) {
      const pad = b.f ? 0.08 : 0.03;
      if (px < b.minX - pad || px > b.maxX + pad || pz < b.minZ - pad || pz > b.maxZ + pad) continue;
      if (!b.f) { if (y < 4.3) return true; continue; }
      const H = this.R.fixHeightMap?.(b.f.t);
      if (!H) { if (y < 1.0) return true; continue; }
      const [lx, lz] = worldToLocal(b.f, px, pz), i = clamp(Math.floor((lx + H.w / 2) / H.C), 0, H.nx - 1), j = clamp(Math.floor((lz + H.d / 2) / H.C), 0, H.nz - 1);
      if (H.hs[j * H.nx + i] + 0.02 > y) return true;
    }
    return false;
  }
  // 向いている方向に、高さ y の物がさえぎられずに出せる距離
  _ahead(x, z, yaw, y, maxD) {
    const fx = Math.sin(yaw), fz = Math.cos(yaw);
    for (let k = 0.05; k <= maxD + 1e-6; k += 0.05) if (this._solidAt(x + fx * k, z + fz * k, y)) return k;
    return maxD;
  }
  _move(dx, dz) {
    const p = this.pc, r = 0.26;
    p.x += dx; p.z += dz;
    for (let it = 0; it < 3; it++) for (const b of this.rects) {
      if (p.y > 1.2 && b.fx) continue;
      const cx = clamp(p.x, b.minX, b.maxX), cz = clamp(p.z, b.minZ, b.maxZ);
      const ddx = p.x - cx, ddz = p.z - cz, d2 = ddx * ddx + ddz * ddz;
      if (d2 < r * r) {
        if (d2 > 1e-8) { const d = Math.sqrt(d2), k = (r - d) / d; p.x += ddx * k; p.z += ddz * k; }
        else { const o = [[b.minX - r - p.x, 0], [b.maxX + r - p.x, 0], [0, b.minZ - r - p.z], [0, b.maxZ + r - p.z]]; o.sort((a, c) => Math.abs(a[0] + a[1]) - Math.abs(c[0] + c[1])); p.x += o[0][0]; p.z += o[0][1]; }
      }
    }
    p.x = clamp(p.x, PLAYER_BOUNDS.minX, PLAYER_BOUNDS.maxX); p.z = clamp(p.z, PLAYER_BOUNDS.minZ, PLAYER_BOUNDS.maxZ);
  }
  get inside() { const p = this.pc; return (p.x > BUILDING.minX && p.x < BUILDING.maxX && p.z > BUILDING.minZ && p.z < BUILDING.maxZ) || inHall(p.x, p.z); }
  _camera(dt) {
    const p = this.pc, cam = this.R.camera, s = this.app.settings, height = this.app.profile.av.height || 1;
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
    if (s.cam === 'first') {
      this._bobT = (this._bobT || 0) + (this.moving && p.grounded ? dt * 9.5 : 0);
      this._bobA = lerp(this._bobA || 0, this.moving && p.grounded ? 1 : 0, Math.min(1, dt * 8));
      const by = Math.abs(Math.sin(this._bobT)) * 0.035 * this._bobA, bx = Math.cos(this._bobT) * 0.018 * this._bobA;
      this.fpBob = -by * 0.6;
      const ey = p.y + 1.6 * height + by, ex = p.x + Math.cos(p.yaw) * bx, ez = p.z - Math.sin(p.yaw) * bx;
      cam.position.set(ex, ey, ez);
      cam.lookAt(ex + fx * Math.cos(p.pitch), ey - Math.sin(p.pitch), ez + fz * Math.cos(p.pitch));
      return;
    }
    const rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw), sh = 0.42;
    const tx = p.x + rx * sh, ty = p.y + 1.55 * height, tz = p.z + rz * sh;
    let d = this.camDist;
    const dirx = -fx * Math.cos(p.pitch), diry = Math.sin(p.pitch), dirz = -fz * Math.cos(p.pitch);
    for (let k = 0.3; k <= d; k += 0.1) {
      const x = tx + dirx * k, y = ty + diry * k, z = tz + dirz * k;
      if ((this.inside && y > CEIL - 0.1) || this.rects.some((b) => !b.fx && x > b.minX - 0.15 && x < b.maxX + 0.15 && z > b.minZ - 0.15 && z < b.maxZ + 0.15 && y < 4.3) || this._solidAt(x, z, y - 0.15)) { d = Math.max(0.4, k - 0.15); break; }
    }
    this._cd = this._cd == null ? d : Math.min(d, this._cd + dt * 4); d = this._cd;
    cam.position.set(tx + dirx * d, ty + diry * d, tz + dirz * d);
    cam.lookAt(tx, ty, tz);
  }
  _updateWalk(dt, inp) {
    const p = this.pc, s = this.app.settings;
    p.yaw -= inp.look.x; p.pitch = clamp(p.pitch + inp.look.y, -1.1, 1.3);
    const fx = Math.sin(p.yaw), fz = Math.cos(p.yaw), rx = -Math.cos(p.yaw), rz = Math.sin(p.yaw);
    const hd = this.hand(), full = hd?.t === 'pot' && hd.w > 0;
    const sp = (inp.run && !full ? 5.4 : 3.4) * (this.state === 'build' ? 1.1 : 1) * (hd?.t === 'pot' ? (full ? CARRY_SPEED.potFull : CARRY_SPEED.pot) : 1);
    const mx = (fx * inp.move.y + rx * inp.move.x) * sp * dt, mz = (fz * inp.move.y + rz * inp.move.x) * sp * dt;
    this.moving = Math.hypot(mx, mz) > 1e-4;
    if (this.moving) { this._move(mx, mz); if (s.cam !== 'first') p.ry = angleLerp(p.ry, Math.atan2(mx, mz), Math.min(1, dt * 12)); }
    if (s.cam === 'first') p.ry = p.yaw;
    if (inp.edges.has('jump') && p.grounded && !full) { p.vy = 4.6; p.grounded = false; this.app.sfx.play('jump', 0.5); }
    p.vy -= 13 * dt; p.y += p.vy * dt;
    if (p.y <= 0) { p.y = 0; p.vy = 0; p.grounded = true; }
    this._camera(dt);
    if (this.state === 'build') return this._updateBuild(dt, inp);
    this._interact(dt, inp);
  }

  // ---------- 狙っている物 ----------
  _target() {
    const cam = this.R.camera, p = this.pc;
    V2.set(0, 0); RAY.setFromCamera(V2, cam); RAY.far = 12;
    RAY.near = this.app.settings.cam === 'first' ? 0.05 : Math.max(0.05, (this._cd || 3) - 0.4);
    const hit = this.R.pick(RAY);
    RAY.near = 0;
    const hd = this.hand();
    if (hit) {
      const front = (hit.point.x - p.x) * Math.sin(p.yaw) + (hit.point.z - p.z) * Math.cos(p.yaw);
      const f = hit.type === 'fixture' ? this.fx(hit.fid) : null;
      const big = f && hd?.t === 'dirty' && FIXTURES[f.t].sink ? 5.5 : f && (FIXTURES[f.t].gamble || f.t === 'pc' || f.t === 'opensign' || f.t === 'ticket' || f.t === 'register' || FIXTURES[f.t].seats) ? 0.8 : 0;
      if (front > -0.15 && dist(hit.point.x, hit.point.z, p.x, p.z) <= REACH + big) {
        if (f) {
          const [lx, lz] = worldToLocal(f, hit.point.x, hit.point.z), def = FIXTURES[f.t];
          hit.f = f; hit.lx = lx; hit.lz = lz;
          this._subTarget(hit, hd);
        }
        const done = hd?.t === 'dish' && this._dishDone(hd.d);
        if (!(hd?.t === 'dish' && f && !FIXTURES[f.t].seats && f.t !== 'trash' && (done || !this.cookTarget(f)) && this._custNear(done ? 3.3 : 2.3))) return hit;
      }
    }
    // 料理を持っているときは、近くのお客さんを狙いやすく
    if (hd?.t === 'dish' || hd?.t === 'dirty') { const c = this._custNear(hd?.t === 'dish' && this._dishDone(hd.d) ? 3.3 : 2.3); if (c) return c; }
    if (!this.heldCrate() && !hd) {
      let best = null, bd = 1.9;
      for (const c of this.store.crates || []) {
        if (c.loc.t !== 'f') continue;
        const d = dist(c.loc.x, c.loc.z, p.x, p.z), ang = Math.abs(angleLerp(0, Math.atan2(c.loc.x - p.x, c.loc.z - p.z) - p.yaw, 1));
        if (d < bd && ang < 0.9) { bd = d; best = c; }
      }
      if (best) return { type: 'crate', cid: best.id, point: { x: best.loc.x, y: 0.4, z: best.loc.z } };
      let bf = null, bfd = 1.5;
      for (const o of this.store.floor || []) {
        const d = dist(o.x, o.z, p.x, p.z), ang = Math.abs(angleLerp(0, Math.atan2(o.x - p.x, o.z - p.z) - p.yaw, 1));
        if (d < bfd && ang < 1.0) { bfd = d; bf = o; }
      }
      if (bf) return { type: 'floor', id: bf.id, point: { x: bf.x, y: 0.1, z: bf.z } };
    }
    // 狙いアシスト：まん中に何もなくても、前にある近くの設備を選ぶ
    if (this.app.settings.assist !== false) return this._assist(hd);
    return null;
  }
  // タッチ：画面の設備をタップすると、その設備の「行動」をする
  _tapAct(tp) {
    const cv = this.R.canvas, r = cv?.getBoundingClientRect ? cv.getBoundingClientRect() : { left: 0, top: 0, width: innerWidth, height: innerHeight };
    V2.set(((tp.x - r.left) / r.width) * 2 - 1, -((tp.y - r.top) / r.height) * 2 + 1);
    RAY.setFromCamera(V2, this.R.camera); RAY.far = 12; RAY.near = this.app.settings.cam === 'first' ? 0.05 : Math.max(0.05, (this._cd || 3) - 0.4);
    const hit = this.R.pick(RAY); RAY.near = 0;
    if (!hit || hit.type !== 'fixture') return;
    const f = this.fx(hit.fid); if (!f) return;
    const fp = fixtureFootprint(f.t, f.x, f.z, f.r), d = dist(clamp(this.pc.x, fp.minX, fp.maxX), clamp(this.pc.z, fp.minZ, fp.maxZ), this.pc.x, this.pc.z);
    if (d > REACH) { toast(`${FIXTURES[f.t].icon} ${FIXTURES[f.t].name}：もう少し近づこう`, '', 1500); return; }
    const [lx, lz] = worldToLocal(f, hit.point.x, hit.point.z); Object.assign(hit, { f, lx, lz });
    this._subTarget(hit, this.hand());
    const A = this._actions(hit);
    if (A.act) { A.act.fn(); this.reachT = 0.4; this.R.setHighlight(f.id, null); } else if (A.hint) toast(A.hint, '', 2000);
  }
  // 設備の中のどこ（席・てぼ・受け渡し台の場所）を使うか。持っている物に合わせて選びなおす
  _subTarget(hit, hd) {
    const f = hit.f, def = FIXTURES[f.t], lx = hit.lx, lz = hit.lz;
    if (def.seats) { hit.si = pickSeat(f.t, lx, lz); if (hd?.t === 'dish') { const b = this._bestSeat(f, hd.d, hit.si); if (b != null) hit.si = b; } else if (!hd && !(f.dd?.[hit.si]?.length)) { const k = (f.dd || []).findIndex((a) => a?.length); if (k >= 0 && !this.orderAt(f.id, hit.si)) hit.si = k; } }
    if (def.baskets) { hit.bi = pickBasket(f.t, lx, lz); hit.bi = this._bestBasket(f, hd, hit.bi); }
    if (def.pass) hit.pi = pickPass(f.t, lx);
    if (def.topping) {
      const kinds = panKinds(f), pi = pickPan(f.t, lx, lz ?? 0), g = this._guideNow?.top;
      hit.pk = !hit.assist && kinds[pi] ? kinds[pi] : g && kinds.includes(g) ? g : kinds[pi] || kinds[0] || null;
    }
    if (def.cap) {
      const cells = fridgeLayout(this.store).get(f.id) || [];
      hit.ci = -1;
      if (f.op && hit.point && !hit.assist) {
        // 視線と「棚の手前の面」が交わる所で、どのますかを決める（奥の壁に当たった点だと下の段になってしまう）
        let px = lx, py = hit.point.y;
        const o = RAY.ray.origin, dv = RAY.ray.direction, [ax, az] = worldToLocal(f, o.x, o.z), [bx, bz] = worldToLocal(f, o.x + dv.x, o.z + dv.z), dz = bz - az;
        if (Math.abs(dz) > 1e-4) { const tt = (0.12 - az) / dz; if (tt > 0 && tt < 6) { px = ax + (bx - ax) * tt; py = o.y + dv.y * tt; } }
        hit.ci = pickFridgeCell(f.t, px, py);
      }
      // 何もないますを狙っているときは、いちばん近い物（ガイドがほしい物があればそれ）
      if (!hd && f.op && !cells.some((c) => c.i === hit.ci)) {
        const g = this._guideNow, w = g && cells.find((c) => (g.ing && c.kind === 'ing' && c.k === g.ing) || (g.top && c.kind === 'top' && c.k === g.top) || (g.keep && c.kind === 'keep' && c.b === g.keep));
        if (w) hit.ci = w.i; else if (cells.length) { const G = fridgeGrid(f.t), ci = Math.max(0, hit.ci), cr = (i) => [i % G.cols, Math.floor(i / G.cols)], [ac, ar] = cr(ci); hit.ci = cells.reduce((b, c) => { const [x, y] = cr(c.i), d = Math.abs(x - ac) + Math.abs(y - ar) * 1.5; return d < b[1] ? [c.i, d] : b; }, [-1, 99])[0]; }
      }
    }
    if (def.slots) {
      hit.i = pickSlot(f.t, lx);
      // 置くときは空いている所、取るときは物がある所を近い順に
      const needM = (x) => x?.t === 'dish' && x.d.k === 'bowl' && x.d.broth && x.d.men == null;
      const needT = (x) => x?.t === 'dish' && ((x.d.k === 'bowl' && x.d.broth) || (x.d.k === 'bowlS' && x.d.side === 'rice')) && !(x.d.tp || []).includes(hd.k);
      if (hd?.t === 'tebo' || hd?.t === 'top') { const pr = hd.t === 'tebo' ? needM : needT; if (!pr(f.sl?.[hit.i])) { const k = this._nearSlot(f, hit.i, pr); if (k >= 0) hit.i = k; } }
      else if (hd && f.sl?.[hit.i]) { const k = this._nearSlot(f, hit.i, (x) => !x); if (k >= 0) hit.i = k; }
      if (!hd && !f.sl?.[hit.i]) { const k = this._nearSlot(f, hit.i, Boolean); if (k >= 0) hit.i = k; }
    }
    return hit;
  }
  _nearSlot(f, i0, pred) { let best = -1, bd = 99; (f.sl || []).forEach((x, i) => { if (pred(x) && Math.abs(i - i0) < bd) { bd = Math.abs(i - i0); best = i; } }); return best; }
  _assist(hd) {
    const p = this.pc, guideF = this._guideNow?.f?.id;
    let best = null, bs = Infinity;
    for (const f of this.store.fixtures) {
      const def = FIXTURES[f.t]; if (!def || ['deco', 'sign'].includes(def.cat) || def.air) continue;
      const fp = fixtureFootprint(f.t, f.x, f.z, f.r), cx = clamp(p.x, fp.minX, fp.maxX), cz = clamp(p.z, fp.minZ, fp.maxZ), d = dist(cx, cz, p.x, p.z);
      if (d > REACH - 0.6) continue;
      const ang = d < 0.3 ? 0 : Math.abs(angleLerp(0, Math.atan2(cx - p.x, cz - p.z) - p.yaw, 1));
      if (ang > 0.75) continue;
      const sc = d + ang * 1.4 - (f.id === guideF ? 0.6 : 0);
      if (sc < bs) { bs = sc; best = { f, x: cx, z: cz }; }
    }
    if (!best) return null;
    const f = best.f, [lx, lz] = worldToLocal(f, best.x, best.z), hit = { type: 'fixture', fid: f.id, f, lx, lz, assist: true, point: { x: best.x, y: 0.9, z: best.z } };
    return this._subTarget(hit, hd);
  }
  // 料理を持って席を狙ったとき：その料理を待っているお客さんの席を選ぶ
  _bestSeat(f, d, si) {
    const st = this.store, fits = (o) => o && o[5].some((l) => !l[3] && (l[0] === 'ramen' ? d.k === 'bowl' && st.menu.find((m) => m.id === l[1])?.soup === d.soup : l[0] === 'beer' ? d.k === 'mug' : (l[0] === 'rice' || l[0] === 'chadon') ? d.k === 'bowlS' : d.k === 'plate' && d.side === l[0]));
    if (fits(this.orderAt(f.id, si))) return si;
    const n = FIXTURES[f.t].seats.length;
    for (let i = 0; i < n; i++) if (fits(this.orderAt(f.id, i))) return i;
    return null;
  }
  // 丼（スープ入り・麺なし）を持っているときは、注文の固さにいちばん近いてぼを選ぶ
  _bestBasket(f, hd, bi) {
    if (hd || f.bk[bi]) return bi;
    const clk = this.clk(), want = this._focusLine()?.[2] || 'futsu', [lo, hi] = HARD[want]?.t || [21, 27];
    let best = -1, bs = Infinity;
    f.bk.forEach((x, i) => { if (!x) return; const s = clk - x.t0, sc = (s < lo ? lo - s + 3 : s > hi ? s - hi : -s * 0.01) + (x.by ? 60 : 0); if (sc < bs) { bs = sc; best = i; } }); // アルバイトが茹でている麺はなるべく取らない
    return best >= 0 ? best : bi;
  }
  // ---------- 次にやること（ガイド） ----------
  _fxOf(pred, staffToo = false) { const p = this.pc; let best = null, bd = Infinity; for (const f of this.store.fixtures) { if (f.br || !FIXTURES[f.t] || (f.st && !staffToo) || !pred(f, FIXTURES[f.t])) continue; const d = dist(f.x, f.z, p.x, p.z); if (d < bd) { bd = d; best = f; } } return best || (staffToo ? null : this._fxOf(pred, true)); }
  // メニューを作るのに足りない食材（仕入れが必要な物）
  _lack() {
    const st = this.store, out = new Set(), extra = new Set(crateItems(st).map(([k]) => k));
    for (const x of [...Object.values(st.hand || {}), ...(st.floor || []).map((o) => o.it), ...st.fixtures.flatMap((f) => f.sl || [])]) if (x && (x.t === 'pack' || x.t === 'ing')) extra.add(x.k);
    const has = (k) => (st.stock[k] || 0) > 0 || extra.has(k);
    for (const m of st.menu.filter((x) => x.on && x.kind === 'ramen')) {
      const S = SOUPS[m.soup]; if (!S) continue;
      const B = BROTHS[S.broth], T = TARES[S.tare];
      if (!st.fixtures.some((f) => f.pot?.b === S.broth && f.pot.sv > 0) && !(st.keep || []).some((k) => k.b === S.broth) && !has(B.item)) out.add(INGREDIENTS[B.item].name);
      if (!((st.tare?.[S.tare] || 0) > 0) && !has(T.raw)) out.add(INGREDIENTS[T.raw].name);
      if (!has('men')) out.add('生麺');
      for (const t of m.tp) if (TOPPINGS[t] && !(topTotal(st, t) > 0) && !has(TOPPINGS[t].raw)) out.add(INGREDIENTS[TOPPINGS[t].raw].name);
    }
    return [...out];
  }
  _focusOrder() { const os = (this.dyn?.o || []).filter((o) => o[5].some((l) => !l[3] && !l[4])); return os.find((o) => o[0] === this.selOrder) || os.sort((a, b) => b[2] - a[2])[0] || null; }
  _focusLine() { const o = this._focusOrder(); return o ? o[5].find((x) => !x[3] && !x[4]) || null : null; }
  _guide() {
    const st = this.store, dyn = this.dyn, hd = this.hand(), clk = this.clk(), G = (text, f, extra) => ({ text, f: f || null, ...extra });
    const RACK = (f, D) => D.rack, serve = (who, seat) => G(`🙇 ${who}のお客さんに出そう（カウンター越しでもOK）`, seat), PC = () => this._fxOf((f) => f.t === 'pc');
    const POT = (D) => D.pot, TOP = (f, D) => D.topping;
    if (dyn?.f?.length) { const fire = this.fx(dyn.f[0][0]); if (hd?.t === 'ext') return G('🔥 火に向けて長押しで消火！', fire, { urgent: true }); return G('🔥 火事！消火器を取って消そう', this._fxOf((f) => f.t === 'ext') || fire, { urgent: true }); }
    if (dyn?.th && !['down', 'run'].includes(dyn.th[5])) { if (hd?.t === 'shuri') return G('🥷 泥棒を画面のまん中に入れて手裏剣を投げよう', null, { urgent: true, pos: { x: dyn.th[0], y: 2.1, z: dyn.th[1] } }); const sh = this._fxOf((f) => f.t === 'shuriken'); if (sh) return G('🥷 泥棒！手裏剣ケースから手裏剣を取ろう', sh, { urgent: true }); }
    if (hd?.t === 'ext' || hd?.t === 'shuri') return G('道具を使い終わったら「しまう」', null);
    const dryP = st.fixtures.find((f) => FIXTURES[f.t]?.pot && f.pot?.fire && !(f.pot.w > 0) && !f.br);
    if (dryP) return G('⚠ 空焚き！寸胴鍋の火を止めよう（このままだと火事になる）', dryP, { urgent: true });
    if (hd?.t === 'cash') return inHall(this.pc.x, this.pc.z, 0.5) ? G(`🎲 台でお金（${yen(hd.v)}）をセットして勝負！ 終わったらレジに戻そう`, this._fxOf((f, D) => D.gamble)) : G(`💴 お金（${yen(hd.v)}）を持っています：となりの賭場へ行くか、レジに戻そう`, this._fxOf((f, D) => D.gamble === 'chohan') || this._fxOf((f) => f.t === 'register'));
    if (hd?.t === 'clean') return G('🍽️ 洗った食器を食器棚にしまおう', this._fxOf(RACK));
    const SINK = (f, D) => D.sink, FR = () => this._fxOf((f, D) => D.cap);
    if (hd?.t === 'pot') { if (hd.dirty) return G('🧽 洗い場で鍋のだしがらを捨てて洗おう（長押し）', this._fxOf(SINK)); if (!(hd.w > 0) && (st.keep || []).length && (st.phase === 'prep' || st.phase === 'open')) return G('🍲 冷蔵庫のスープを使うので、水は張らずにそのまま鍋をコンロに戻そう', this.fx(hd.fid)); if (hd.w < 1) return G('🚰 洗い場の水道で鍋に水を張ろう（長押し）', this._fxOf(SINK)); return G('🍲 水の入った鍋をコンロに戻そう（重いのでゆっくり）', this.fx(hd.fid)); }
    if (hd?.t === 'ing' && INGREDIENTS[hd.k]) {
      const dest = this._fxOf((f, D) => ingFits(hd.k, D, hd)), nm = ingShort(hd.k), I = INGREDIENTS[hd.k];
      if (hd.k === 'kome') return (hd.ws || 0) < 1 ? G('🍚 洗い場で米を研ごう（長押し）', dest) : G('🍚 研いだ米を炊飯器に入れて炊こう', dest);
      if (hd.k === 'men') return G('🍜 茹で麺機の空いているてぼに麺を入れよう', dest);
      if (I.cat === 'soup') return G(`🍲 ${nm}を寸胴鍋に入れよう`, dest);
      if (I.cat === 'tare') return G(`🫙 トッピング台で${nm}をあけてタレを作ろう`, dest);
      if (I.cat === 'top') return G(`🔪 ${nm}をまな板にのせて切ろう`, dest);
      return G(`${I.icon} ${nm}を${carryInfo(hd.k)?.to || ''}へ運ぼう`, dest);
    }
    if (hd?.t === 'dirty') return G(hd.a.length >= DIRTY_MAX ? '🫧 洗い場のシンクに入れよう（遠くから投げ入れもできる）' : '🫧 食器を洗い場のシンクへ', this._fxOf((f, D) => D.sink));
    const late = st.phase === 'closing' || st.phase === 'summary';
    if (hd?.t === 'pack' && INGREDIENTS[hd.k]) return INGREDIENTS[hd.k].dish ? G(`🍽️ ${INGREDIENTS[hd.k].name}を食器棚にしまおう`, this._fxOf(RACK)) : G(`🧊 ${ingShort(hd.k)}を冷蔵庫に入れよう`, FR());
    // 持っている段ボール：冷蔵庫（器は食器棚）まで運んで入れる
    const hc = this.heldCrate();
    if (hc?.kind === 'food') { const k = hc.items[0]?.[0], P = INGREDIENTS[k]; if (P?.dish) return G(`📦 ${P.name}の段ボールを食器棚まで運んで、しまおう`, this._fxOf(RACK)); return fridgeUsed(st, [[k, 1]]) > fridgeCap(st) ? G('⚠ 冷蔵庫がいっぱい！段ボールを下ろして、冷蔵庫の物を先に使おう', null) : G(`📦 ${ingShort(k)}の段ボールを冷蔵庫まで運んで、入れよう`, FR()); }
    // てぼ：湯切り → 作業台の丼へ
    if (hd?.t === 'tebo') {
      const bf = this.fx(hd.fid), ws = this._fxOf((f, D) => D.slots && f.sl?.some((o) => o?.t === 'dish' && o.d.k === 'bowl' && o.d.broth && o.d.men == null));
      if ((hd.dr || 0) < 1) return G('♨️ てぼを振って湯切りしよう（長押し）', bf);
      return ws ? G('🍜 作業台の丼を狙って、麺を入れよう', ws) : G('🧰 スープを入れた丼が作業台にない！てぼを茹で麺機に戻して、丼を用意しよう', bf);
    }
    // 勝手口の外に届いた段ボール（食材）
    const boxC = (st.crates || []).find((c) => c.kind === 'food' && c.loc.t === 'f' && c.items.length);
    const boxStep = () => boxC && !hd && !hc ? G(`📦 勝手口の外に段ボールが届いた！持って、${INGREDIENTS[boxC.items[0][0]]?.dish ? '食器棚' : '冷蔵庫'}まで運ぼう`, null, { pos: { x: boxC.loc.x, y: 1.1, z: boxC.loc.z }, crate: boxC.id }) : null;
    if (hd?.t === 'top' && TOPPINGS[hd.k]) {
      const T = TOPPINGS[hd.k];
      const ws = this._fxOf((f, D) => D.slots && f.sl?.some((o) => o?.t === 'dish' && (o.d.broth || o.d.side === 'rice') && !(o.d.tp || []).includes(hd.k) && this.targetRecipe(o.d)?.tp.includes(hd.k)));
      if (ws && !late) return G(`🥢 作業台の丼に${T.name}をのせよう`, ws);
      const tb = this._fxOf((f, D) => D.topping && panRoom(f, hd.k) > 0);
      return tb && !late ? G(`🥢 ${T.name}をトッピング台のバットに並べよう（いっぱいなら冷蔵庫へ）`, tb) : G(`🧊 切った${T.name}を冷蔵庫にしまおう`, FR());
    }
    if (hd?.t === 'keep') {
      if (late) return G('🧊 スープの容器を冷蔵庫にしまおう（次の日に使える）', FR());
      const pot = this._fxOf((f, D) => D.pot && !f.away && !(f.pot && (f.pot.w > 0 || f.pot.b || f.pot.dirty)));
      return pot ? G('🍲 空の寸胴鍋にスープをあけて、火をつけて温め直そう', pot) : G('🧊 空いている鍋がない：冷蔵庫にしまうか、鍋を洗い場で洗ってからあけよう', FR());
    }
    // 閉店後の片付け：スープは保存容器へ → 冷蔵庫、まな板の切ったトッピングも冷蔵庫へ
    const storeStep = () => {
      const sp = st.fixtures.find((f) => FIXTURES[f.t]?.pot && !f.st && f.pot?.b && f.pot.sv > 0 && !f.br && potHeat(f.pot, clk) >= BROTHS[f.pot.b].ready);
      if (sp) return sp.pot.fire ? G('🫙 閉店！寸胴鍋の火を止めて、スープを保存容器に移そう', sp) : G('🫙 スープを保存容器に移して冷蔵庫へ（入れないと次の日に捨てられる）', sp);
      const cb = st.fixtures.find((f) => f.cut && !f.st && !f.br);
      if (cb) return G(`🔪 まな板の切った${TOPPINGS[cb.cut.tid].name}を1人前ずつ冷蔵庫へ`, cb);
      const ws = st.fixtures.find((f) => !f.st && f.sl?.some((o) => o?.t === 'top' || o?.t === 'keep'));
      if (ws) return G('🧰 作業台に置いたトッピング・スープも冷蔵庫へ', ws);
      const fl = (st.floor || []).find((o) => o.it?.t !== 'pack' || !INGREDIENTS[o.it.k]?.dish);
      if (fl && !hd) return G('⬇️ 床に落ちている物を拾って冷蔵庫へ', null, { pos: { x: fl.x, y: 0.6, z: fl.z } });
      return boxStep();
    };
    if (st.phase === 'summary') return storeStep() || G('☀️ 片付けが終わったら、上の「☀️ 次の日へ」で次の日を始めよう', null);
    // だしの準備（スープの種類ごと）
    const brothStep = (soupK) => {
      const S = SOUPS[soupK], B = BROTHS[S.broth];
      const ok = st.fixtures.find((f) => f.pot?.b === S.broth && f.pot.sv > 0 && !f.br);
      if (ok) {
        const P0 = ok.pot, aku = potAku(P0, clk);
        if (P0.fire && aku > 0.3) return G(`🥄 寸胴鍋のアクを取ろう（長押し）`, ok);
        // 火をつける前に：鍋に入るだけ骨を入れる → 香味野菜
        if (!P0.fire && !(P0.used > 0) && !P0.rh) {
          const cap = FIXTURES[ok.t].pot.sv / POT_PER, mains = Object.entries(P0.n || {}).filter(([k]) => INGREDIENTS[k]?.broth).reduce((t, [, v]) => t + v, 0);
          if (mains < cap && (st.stock[B.item] || 0) > 0) return G(`🧊 もう1つ${ingShort(B.item)}を入れよう（${(mains + 1) * POT_PER}杯分になる）`, FR(), { ing: B.item });
          if (!P0.n?.yasai && (st.stock.yasai || 0) > 0 && ingUnlocked('yasai', st.level)) return G('🧄 冷蔵庫の香味野菜も鍋に入れよう（だしがおいしくなる）', FR(), { ing: 'yasai' });
        }
        if (!P0.fire && !potReady(ok, clk)) return G(P0.rh ? '🔥 火をつけて、冷蔵庫から出したスープを温め直そう' : '🔥 寸胴鍋の火をつけよう', ok);
        return null;
      }
      const pot = this._fxOf((f, D) => D.pot && !f.br && (f.away || !f.pot || !(f.pot.w > 0) || !f.pot.b || f.pot.sv <= 0)) || this._fxOf((f, D) => D.pot);
      if (!pot || pot.away) return null; // 仲間が水を張りに行っている
      const P = pot.pot;
      if (P?.fire && !(P.w > 0)) return G('⚠ 空焚き！寸胴鍋の火を止めよう', pot, { urgent: true });
      const kc = (st.keep || []).find((k) => k.b === S.broth);
      if (kc && !(P?.w > 0)) return P?.dirty ? G(`🫕 冷蔵庫に${B.name}がある：先に寸胴鍋を持って洗い場で洗おう（洗ったら水は張らずに戻す）`, pot) : G(`🧊 冷蔵庫に${B.name}（${kc.sv}杯分）がある！容器を取って寸胴鍋にあけよう`, FR(), { keep: S.broth });
      if (!P || !(P.w > 0)) return G(P?.dirty ? `🫕 寸胴鍋を持って洗い場へ（だしがらを洗って水を張る）` : `🫕 寸胴鍋を持って、洗い場の水道で水を張ろう（${B.name}を炊く）`, pot);
      if (!P.b) return (st.stock[B.item] || 0) > 0 ? G(`🧊 冷蔵庫から${ingShort(B.item)}を取って、寸胴鍋に入れよう`, FR(), { ing: B.item }) : G(`💻 ${INGREDIENTS[B.item].name}がない！パソコンで仕入れよう`, PC());
      if (!P.fire && !P.n?.yasai && !(P.used > 0) && (st.stock.yasai || 0) > 0) return G('🧄 冷蔵庫の香味野菜も鍋に入れよう（だしがおいしくなる）', FR(), { ing: 'yasai' });
      if (!P.fire) return G('🔥 寸胴鍋の火をつけよう', pot);
      return null;
    };
    const tareStep = (soupK) => {
      const T = TARES[SOUPS[soupK].tare]; if ((st.tare?.[SOUPS[soupK].tare] || 0) > 0) return null;
      const tb = this._fxOf(TOP);
      if (tb?.tj) return G(`🥄 トッピング台でタレを混ぜよう（長押し）`, tb);
      return (st.stock[T.raw] || 0) > 0 ? G(`🧊 冷蔵庫から${ingShort(T.raw)}を取って、トッピング台で${T.short}を作ろう`, FR(), { ing: T.raw }) : G(`💻 ${INGREDIENTS[T.raw].name}がない！パソコンで仕入れよう`, PC());
    };
    if (st.phase === 'prep') {
      const bs = boxStep(); if (bs) return G('準備：' + bs.text, null, { pos: bs.pos, crate: bs.crate });
      const lack = this._lack();
      if (lack.length) return dyn?.dl?.length ? G('準備：🚁 ドローンが食材を運んでいます（勝手口の外に段ボールで届く）', null) : G(`準備：💻 食材がありません！パソコンで仕入れよう（${lack.slice(0, 4).join('・')}）`, PC());
      const soups = [...new Set(st.menu.filter((m) => m.on && m.kind === 'ramen').map((m) => m.soup))];
      for (const k of soups) { const g = brothStep(k); if (g) return G('準備：' + g.text, g.f, { ing: g.ing, urgent: g.urgent }); }
      for (const k of soups) { const g = tareStep(k); if (g) return G('準備：' + g.text, g.f, { ing: g.ing }); }
      const bd = this._fxOf((f, D) => D.board && f.job); if (bd) return G(`準備：🔪 まな板の${TOPPINGS[bd.job.tid].name}を切ろう（長押し）`, bd);
      const cb = this._fxOf((f, D) => D.board && f.cut); if (cb) return G(`準備：🔪 まな板の切った${TOPPINGS[cb.cut.tid].name}を1人前ずつトッピング台のバットへ（入らない分は冷蔵庫）`, cb);
      const need = new Set(st.menu.filter((m) => m.on && m.kind === 'ramen').flatMap((m) => m.tp)), tbP = this._fxOf(TOP);
      for (const t of need) {
        const T = TOPPINGS[t]; if (!T || (tbP?.tp?.[t] || 0) > 0) continue;
        if ((st.prep[t] || 0) > 0 && tbP) return G(`準備：🧊 冷蔵庫の切った${T.name}をトッピング台のバットに並べよう`, FR(), { top: t });
        if ((st.stock[T.raw] || 0) > 0) return G(`準備：🧊 冷蔵庫から${ingShort(T.raw)}を取って、まな板で${T.name}を切ろう（${CUT_N}人前になる）`, FR(), { ing: T.raw });
      }
      if (hd?.t === 'dish') return G('🍜 料理を持っています（受け渡し台に置けます）', this._fxOf((f, D) => D.pass));
      return G('🏮 準備ができたら、入口の札で「営業中」にしよう', this._fxOf((f) => f.t === 'opensign'));
    }
    const o = this._focusOrder();
    if (!o) {
      if (hd?.t === 'dish') return G('🍜 料理を持っています：受け渡し台に置くか、生ゴミ箱へ', this._fxOf((f, D) => D.pass));
      if (!hd) { const bs = boxStep(); if (bs) return bs; }
      if (late) { const dirtySeat0 = st.fixtures.find((f) => (f.dd || []).some((a) => a?.length)); if (dirtySeat0) return G('🍽️ 食べ終わった席の食器を下げよう', dirtySeat0); return st.phase === 'closing' ? G('⏳ 残りのお客さんが帰ったら1日が終わります（スープ・切ったトッピングは冷蔵庫へ）', null) : null; }
      const akuPot = st.fixtures.find((f) => f.pot?.fire && potAku(f.pot, clk) > 0.4); if (akuPot) return G('🥄 寸胴鍋のアクを取ろう（長押し）', akuPot);
      if (!hd) for (const k of new Set(st.menu.filter((m) => m.on && m.kind === 'ramen').map((m) => m.soup))) { const g0 = brothStep(k); if (g0) return g0; }
      const dirtySeat = st.fixtures.find((f) => (f.dd || []).some((a) => a?.length));
      if (dirtySeat) return G('🍽️ 食べ終わった席の食器を下げよう', dirtySeat);
      const dry = Object.values(st.dry || {}).reduce((a, b) => a + b, 0);
      if (Object.values(st.dirty || {}).reduce((a, b) => a + b, 0) >= 3 && dry < DRY_MAX) return G('🫧 洗い場で食器を洗おう（長押し）', this._fxOf((f, D) => D.sink));
      if (dry >= 3) return G('🍽️ 水切りかごの食器を食器棚にしまおう', this._fxOf((f, D) => D.sink));
      return null;
    }
    const seat = this.fx(o[6]), l = o[5].find((x) => !x[3] && !x[4]), who = o[1];
    if (!l) return null;
    const gr = (k) => this._fxOf((f, D) => D.griddle === k), S = SIDES[l[0]];
    if (hd?.t === 'dish') {
      const d = hd.d;
      if (l[0] === 'ramen') {
        const m = st.menu.find((x) => x.id === l[1]); if (!m) return null; const SP = SOUPS[m.soup], H = HARD[l[2]] || HARD.futsu;
        if (d.k !== 'bowl') return G('🗑️ この注文にはラーメン丼が必要です', this._fxOf((f) => f.t === 'trash'));
        if (d.tare && d.tare !== SP.tare) return G(`⚠ タレがちがいます（${m.name}は${TARES[SP.tare].short}）：生ゴミ箱へ`, this._fxOf((f) => f.t === 'trash'));
        if (d.broth && d.broth !== SP.broth) return G(`⚠ だしがちがいます（${m.name}は${BROTHS[SP.broth].short}スープ）：生ゴミ箱へ`, this._fxOf((f) => f.t === 'trash'));
        if (!d.tare) { const g = tareStep(m.soup); return g || G(`🫙 トッピング台で丼に${TARES[SP.tare].short}を入れよう`, this._fxOf(TOP)); }
        if (!d.broth) { const pot = this._fxOf((f, D) => D.pot && f.pot?.b === SP.broth && f.pot.sv > 0); if (!pot) return brothStep(m.soup) || G('🍲 だしを炊こう', this._fxOf(POT)); const B = BROTHS[SP.broth], h = potHeat(pot.pot, clk); return potReady(pot, clk) ? G(`🥣 寸胴鍋で${B.name}を注ごう`, pot) : G(`⏳ だしが炊けるのを待とう（あと${Math.ceil(B.ready - h)}秒）${potAku(pot.pot, clk) > 0.2 ? '・その間にアク取り' : ''}`, pot); }
        const WS = this._fxOf((f, D) => D.slots && f.sl?.some((o) => !o));
        if (d.men == null) return G('🧰 丼を作業台に置こう（麺は、てぼを上げて湯切りしてから入れる）', WS || this._fxOf((f, D) => D.slots));
        const miss = m.tp.filter((x) => !(d.tp || []).includes(x));
        if (miss.length) {
          if (miss.some((x) => topTotal(st, x) > 0 || (st.stock[TOPPINGS[x].raw] || 0) > 0)) return G('🧰 丼を作業台に置いて、トッピングを手に取ってのせよう', WS || this._fxOf((f, D) => D.slots));
          const T = TOPPINGS[miss[0]]; return G(`💻 ${INGREDIENTS[T.raw].name}がない！パソコンで仕入れよう`, PC());
        }
        return serve(who, seat);
      }
      if (l[0] === 'beer') { if (d.k !== 'mug') return G('🍺 ジョッキが必要です（食器棚）', this._fxOf(RACK)); if (d.side !== 'beer' && !((st.prep.beer || 0) > 0)) return G('🛢️ 樽が空！ジョッキを作業台に置いて、冷蔵庫からビール樽を運んでつなごう', this._fxOf((f, D) => D.slots && f.sl?.some((o) => !o)) || this._fxOf((f, D) => D.pass)); if (d.side !== 'beer' || (d.fill || 0) < 0.85) return G('🍺 ビールサーバーで注ごう（長押し・泡7:3で止める）', this._fxOf((f) => f.t === 'beer')); return serve(who, seat); }
      if (l[0] === 'rice' || l[0] === 'chadon') { if (d.k !== 'bowlS') return G('🍚 小丼が必要です（食器棚）', this._fxOf(RACK)); if (d.side !== 'rice') return G('🍚 炊飯器でごはんをよそおう', this._fxOf((f) => f.t === 'rice')); if (l[0] === 'chadon' && !(d.tp || []).includes('chashu')) return G('🧰 小丼を作業台に置いて、チャーシューを1人前手に取ってのせよう', this._fxOf((f, D) => D.slots && f.sl?.some((o) => !o)) || this._fxOf((f, D) => D.slots)); return serve(who, seat); }
      if (S && (l[0] === 'gyoza' || l[0] === 'karaage')) { const g = gr(l[0]); if (d.k !== 'plate') return G('🍽️ 皿が必要です（食器棚）', this._fxOf(RACK)); if (d.side !== l[0]) return G(g?.gr ? `🍽️ ${S.name}を皿に取ろう` : `🔥 先に${S.name}を作ろう`, g); return serve(who, seat); }
      return null;
    }
    if (l[0] === 'ramen') {
      const m = st.menu.find((x) => x.id === l[1]); if (!m) return null;
      // 作業台に置いてある、この注文の丼（スープ入り）
      let wsF = null, wsD = null;
      for (const f of st.fixtures) { if (f.st || f.br || !f.sl) continue; for (const x of f.sl) if (x?.t === 'dish' && x.d.k === 'bowl' && x.d.soup === m.soup) { wsF = f; wsD = x.d; break; } if (wsF) break; }
      if (wsD) {
        if (wsD.men == null) {
          const H = HARD[l[2]] || HARD.futsu, b = this._fxOf((f, D) => D.baskets && f.bk.some(Boolean));
          if (!b) return (st.stock.men || 0) > 0 ? G('🧊 冷蔵庫から麺を取って、茹で麺機のてぼに入れよう（丼は作業台に置いたまま）', FR(), { ing: 'men' }) : G('💻 生麺がない！パソコンで仕入れよう', PC());
          const sec = Math.max(...b.bk.filter(Boolean).map((x) => clk - x.t0));
          return sec < H.t[0] ? G(`♨️ 麺が茹で上がるのを待とう（${H.name}まで あと${Math.ceil(H.t[0] - sec)}秒）`, b) : G(`♨️ 茹で麺機のてぼを上げて、湯切りしよう（${H.name}：${H.t[0]}〜${H.t[1]}秒）`, b);
        }
        const miss = m.tp.filter((x) => !(wsD.tp || []).includes(x));
        if (miss.length) {
          const tb = this._fxOf((f, D) => D.topping && miss.some((x) => f.tp?.[x] > 0));
          if (tb) { const x = miss.find((y) => tb.tp?.[y] > 0); return G(`🥢 トッピング台で${TOPPINGS[x].name}を手に取って、作業台の丼にのせよう`, tb, { top: x }); }
          const x = miss[0], T = TOPPINGS[x], cb = this._fxOf((f, D) => D.board && f.cut?.tid === x);
          if (cb) return G(`🔪 まな板の切った${T.name}を1人前持って、作業台の丼にのせよう`, cb);
          if ((st.prep[x] || 0) > 0) return G(`🧊 冷蔵庫から切った${T.name}を1人前取って、作業台の丼にのせよう`, FR(), { top: x });
          if ((st.stock[T.raw] || 0) > 0) return G(`🔪 冷蔵庫の${ingShort(T.raw)}をまな板で切って、作業台の丼にのせよう`, FR(), { ing: T.raw });
        }
        return G('🧰 作業台の丼を持って、お客さんに出そう', wsF);
      }
      const g1 = brothStep(m.soup); if (g1) return g1;
      const g2 = tareStep(m.soup); if (g2) return g2;
      if (!st.fixtures.some((f) => FIXTURES[f.t].baskets && f.bk.some(Boolean))) return (st.stock.men || 0) > 0 ? G('🧊 冷蔵庫から麺を取って、茹で麺機のてぼに入れよう', FR(), { ing: 'men' }) : G('💻 生麺がない！パソコンで仕入れよう', PC());
      if (!((st.dish.bowl || 0) > 0)) return (st.dry?.bowl || 0) > 0 ? G('🍽️ 丼が水切りかごにある！持って食器棚にしまおう', this._fxOf((f, D) => D.sink)) : G('🫧 きれいな丼がない！洗い場で洗おう', this._fxOf((f, D) => D.sink));
      return G('🍜 食器棚でラーメン丼を取ろう', this._fxOf(RACK));
    }
    if (S && (l[0] === 'gyoza' || l[0] === 'karaage')) { const g = gr(l[0]); if (g && !g.gr) { const it = GRIDDLE[l[0]].item; return G(`🧊 冷蔵庫から${ingShort(it)}を取って、${FIXTURES[g.t].name}で${S.name}を作ろう`, FR(), { ing: it }); } return G('🍽️ 食器棚で皿を取ろう', this._fxOf(RACK)); }
    if (l[0] === 'chadon') {
      const wf = st.fixtures.find((f) => !f.st && !f.br && f.sl?.some((x) => x?.t === 'dish' && x.d.k === 'bowlS' && x.d.side === 'rice'));
      if (wf) {
        const wd = wf.sl.find((x) => x?.t === 'dish' && x.d.k === 'bowlS' && x.d.side === 'rice').d;
        if ((wd.tp || []).includes('chashu')) return G('🧰 作業台のチャーシュー丼を持って、お客さんに出そう', wf);
        const tb = this._fxOf((f, D) => D.topping && f.tp?.chashu > 0); if (tb) return G('🥢 トッピング台でチャーシューを手に取って、作業台の小丼にのせよう', tb, { top: 'chashu' });
        if ((st.prep.chashu || 0) > 0) return G('🧊 冷蔵庫から切ったチャーシューを1人前取って、作業台の小丼にのせよう', FR(), { top: 'chashu' });
      }
    }
    if (l[0] === 'rice' || l[0] === 'chadon') { const rc = this._fxOf((f) => f.t === 'rice'); if (rc && !rc.rc) return G('🧊 冷蔵庫から米を取って、洗い場で研いでから炊飯器で炊こう', FR(), { ing: 'kome' }); return G('🍚 食器棚で小丼を取ろう', this._fxOf(RACK)); }
    if (l[0] === 'beer') return (st.prep.beer || 0) > 0 ? G('🍺 食器棚でジョッキを取ろう', this._fxOf(RACK)) : G('🧊 冷蔵庫からビール樽を運んで、ビールサーバーにつなごう', FR(), { ing: 'taru' });
    return null;
  }
  _updateGuide(dt) {
    this._gT = (this._gT || 0) - dt;
    if (this._gT <= 0) { this._gT = 0.25; this._guideNow = this.app.settings.guide === false ? null : this._guide(); }
    const g = this._guideNow, cam = this.R.camera;
    let pos = null;
    if (g?.pos) pos = g.pos; else if (g?.f) { const def = FIXTURES[g.f.t]; pos = { x: g.f.x, y: (def.top || 1.0) + 0.75, z: g.f.z }; }
    this.R.setGuide(pos, !!g?.urgent);
    let edge = null;
    if (pos) {
      const v = new THREE.Vector3(pos.x, pos.y, pos.z).project(cam), behind = v.z > 1;
      if (behind || Math.abs(v.x) > 0.92 || Math.abs(v.y) > 0.9) { let x = behind ? -v.x : v.x, y = behind ? -v.y : v.y; if (behind && Math.abs(x) < 0.05) x = 0.05; edge = Math.atan2(-y, x); }
    }
    const near = g?.f && dist(g.f.x, g.f.z, this.pc.x, this.pc.z) < 1.6;
    this.ui.setGuide(g ? g.text : '', edge, !!g?.urgent, near);
  }
  cookTarget(f) { const d = FIXTURES[f.t]; return d.pot || d.baskets || d.topping || d.slots || d.rice || d.griddle || d.beer || d.pass || d.rack || d.sink || f.t === 'trash'; }
  // 料理ができあがっている（あとは出すだけ）
  _dishDone(d) {
    if (!d) return false;
    if (d.k === 'bowl') { if (!d.soup || d.men == null) return false; const r = this.targetRecipe(d), st = this.store; return !r || !r.miss.some((x) => topTotal(st, x) > 0 || (st.stock[TOPPINGS[x]?.raw] || 0) > 0); }
    if (d.k === 'bowlS') return d.side === 'rice'; if (d.k === 'mug') return (d.fill || 0) > 0.8; return !!d.side;
  }
  _custNear(R = 2.3) {
    const p = this.pc; let best = null, bd = R;
    for (const o of this.dyn?.o || []) {
      const c = (this.dyn.c || []).find((x) => x[0] === o[0]); if (!c) continue;
      const d = dist(c[2], c[3], p.x, p.z), ang = Math.abs(angleLerp(0, Math.atan2(c[2] - p.x, c[3] - p.z) - p.yaw, 1));
      if (d < bd && ang < 0.75) { bd = d; best = { type: 'cust', cid: o[0], fid: o[6], si: o[7], o, point: { x: c[2], y: 1, z: c[3] } }; }
    }
    if (best) { best.f = this.fx(best.fid); if (best.f) best.si ??= best.o[7]; }
    return best;
  }
  fx(id) { return this.store.fixtures.find((f) => f.id === id); }
  hand() { return this.store?.hand?.[this.me] || null; }
  heldCrate() { return (this.store?.crates || []).find((c) => c.loc.t === 'h' && c.loc.who === this.me); }
  orderAt(fid, si) { return (this.dyn?.o || []).find((o) => o[6] === fid && o[7] === si) || null; }
  // 長押し：前回からの時間ぶん（最大0.35秒）
  holdDur(k) { const now = performance.now() / 1000, last = this.hold[k] || 0; this.hold[k] = now; return now - last > 0.5 ? 0.13 : Math.min(0.35, now - last); }
  // ---------- 行動 ----------
  _actions(t) {
    const fc = this.heldCrate();
    if (fc?.kind === 'food') return this._foodCrateActions(t, fc);
    const A0 = this._actions0(t), f0 = t?.type === 'fixture' ? t.f : null;
    if (f0?.st && A0.info) A0.info = '🧑‍🍳<b>バイト用</b>　' + A0.info;
    // 手に持っている食材などは投げられる（向いている方へ。設備の上に落ちたらそこに入る・仲間が受け取れる）
    const hd = this.hand();
    if (hd && THROWABLE[hd.t]) {
      const aim = t?.point && t.type !== 'cust' ? t.point : null;
      const thr = { label: aim && t?.type === 'fixture' ? `🫳 ${FIXTURES[t.f.t]?.name || ''}へ投げる` : '🫳 投げる', icon: '🫳', fn: () => { const p = this.pc; this.act({ t: 'toss', x: p.x, z: p.z, a: p.yaw, ...(aim ? { tx: aim.x, tz: aim.z } : {}) }); this.anim = 'throw'; this.animT = 0.35; } };
      if (!A0.alt) A0.alt = thr; else if (!A0.box || A0.box.label === '動かす') A0.box = thr;
      if (!A0.info) A0.info = `${slotItemName(hd)}を持っています`;
    }
    return A0;
  }
  _actions0(t) {
    const st = this.store, clk = this.clk(), hd = this.hand();
    const A = { act: null, alt: null, box: null, hint: '', info: '', slot: null };
    if (t?.type === 'floor') {
      const o = (st.floor || []).find((x) => x.id === t.id);
      if (o) { A.info = `⬇️ 床に落ちている：<b>${slotItemName(o.it)}</b>`; A.act = { label: '拾う', icon: '✋', fn: () => this.act({ t: 'floorTake', id: o.id }) }; A.hint = '拾って、使う所へ持っていこう'; return A; }
    }
    if (t?.type === 'crate') {
      const c = (st.crates || []).find((o) => o.id === t.cid);
      if (c?.kind === 'food') {
        const [k, n] = c.items[0] || [], P = INGREDIENTS[k];
        A.info = `📦 <b>段ボール</b>：${P?.icon || ''}${P?.name || ''} ×${n}パック`;
        A.act = { label: '📦 持つ', fn: () => this.act({ t: 'cratePick', cid: c.id }) };
        A.alt = { label: `${P?.icon || ''}1パック取り出す`, fn: () => this.act({ t: 'crateTake', cid: c.id, k }) };
        A.hint = P?.dish ? '持って食器棚まで運んで「食器棚にしまう」' : '持って冷蔵庫まで運んで「冷蔵庫に入れる」。入れないまま次の日になると傷んで捨てることになる';
        return A;
      }
      if (c) {
        const def = FIXTURES[c.ft];
        A.info = `📦 <b>${def.icon} ${c.st ? '【バイト用】' : ''}${def.name}</b>の大きい段ボール`;
        A.act = { label: '持つ', fn: () => { this.crateR = 0; this.act({ t: 'cratePick', cid: c.id }); } };
        A.alt = { label: `返品 +${yen(def.price)}`, fn: async () => { this.setUIBlock(true); const ok = await confirmBox(`${def.icon} ${def.name}を返品しますか？（${yen(def.price)}もどります）`, '返品する'); this.setUIBlock(false); if (ok) this.act({ t: 'crateReturn', cid: c.id }); } };
        A.hint = '持って、置きたい場所で「開けて置く」';
        return A;
      }
    }
    // 手に持っている物
    if (hd?.t === 'ext') {
      A.info = `🧯 <b>消火器</b> 残り ${Math.round(hd.u * 100)}%`;
      A.act = { label: '🧯 消火（長押し）', repeat: true, fn: () => { const p = this.pc; this.act({ t: 'spray', x: p.x, z: p.z, a: p.yaw, dur: this.holdDur('spray') }); this.anim = 'spray'; } };
      A.alt = { label: 'しまう', fn: () => this.act({ t: 'handBack' }) };
      A.hint = this.dyn?.f?.length ? '🔥 火に向けて長押し！' : '火事のときに火に向けて長押しで消火';
      return A;
    }
    if (hd?.t === 'shuri') {
      A.info = `✴️ <b>手裏剣</b> 残り ${hd.n}枚`;
      A.act = { label: '✴️ 投げる', fn: () => { const p = this.pc; if (performance.now() - (this._thr || 0) < 280) return; this._thr = performance.now(); this.act({ t: 'throw', x: p.x, z: p.z, a: p.yaw }); this.anim = 'throw'; this.animT = 0.35; } };
      A.alt = { label: 'しまう', fn: () => this.act({ t: 'handBack' }) };
      A.hint = this.dyn?.th && this.dyn.th[5] !== 'down' ? '🥷 泥棒を画面のまん中に入れて投げよう！（2回当てると撃退）' : 'お客さんに当てないように注意';
      return A;
    }
    if (hd?.t === 'tebo') return this._teboActions(t, hd, A);
    if (t?.type === 'fixture' && FIXTURES[t.f.t]?.slots && !t.f.br) return this._slotActions(t, t.f, hd, A);
    if (t?.type === 'fixture' && FIXTURES[t.f.t]?.cap && !t.f.br) return this._fridgeActions(t, t.f, hd, A);
    if (hd?.t === 'pot' || hd?.t === 'ing' || hd?.t === 'top' || hd?.t === 'keep' || hd?.t === 'pack') return this._carryActions(t, hd, A);
    if (!t) {
      if (hd?.t === 'dish') { A.info = dishText(hd.d); A.hint = '料理を持って、お客さんの席を狙うと「出す」'; }
      if (hd?.t === 'dirty') { A.info = `🍽️ 下げた食器 ${hd.a.length}/${DIRTY_MAX}`; A.hint = '洗い場に持っていこう'; }
      return A;
    }
    if (t.type === 'cust') return this._seatActions(t, t.f, t.si, hd, A);
    const f = t.f, def = FIXTURES[f.t];
    if (!def.fixed) A.box = { label: '動かす', icon: '🔧', fn: () => this.startMove(f) };
    if (f.br) {
      const cost = repairCost(f);
      A.info = `💥 <b>${def.name}</b>（焼けて壊れています）`;
      A.act = { label: `🔧 修理 ${yen(cost)}`, fn: () => this.act({ t: 'repair', fid: f.id }) };
      A.hint = '修理するとまた使えるようになります';
      return A;
    }
    const dishInfo = hd?.t === 'dish' ? dishText(hd.d) + '<br>' : hd?.t === 'dirty' ? `🍽️ 下げた食器 ${hd.a.length}/${DIRTY_MAX}<br>` : '';
    // ---- 席 ----
    if (def.seats) return this._seatActions(t, f, t.si, hd, A);
    // ---- 寸胴鍋：（鍋を持って水道で水を張る）→ 冷蔵庫の材料を入れる → 火 → アク取り → 注ぐ ----
    if (def.pot) {
      if (f.away) { A.info = `🍲 <b>${def.name}</b>：鍋は持ち出し中（${this._who(f.away)}が洗い場で水を張っています）`; A.hint = '鍋がもどってくるのを待とう'; return A; }
      const P = f.pot, ready = potReady(f, clk), heat = potHeat(P, clk), aku = potAku(P, clk), B = P?.b && BROTHS[P.b];
      const ings = P ? Object.entries(P.n || {}).map(([k, n]) => `${INGREDIENTS[k]?.icon || ''}${ingShort(k)}${n > 1 ? '×' + n : ''}`).join('・') : '';
      const cap = def.pot.sv / POT_PER;
      if (!P || !(P.w > 0)) A.info = `🍲 <b>${def.name}</b>：${P?.fire ? '<b style="color:#ff6b6b">⚠ 空焚き中！</b>' : P?.dirty ? 'だしがらが残った空の鍋（洗い場で洗って水を張る）' : '空の鍋（洗い場の水道で水を張る）'}`;
      else if (!B) A.info = `🍲 <b>水</b>${P.fire ? '（🔥沸かしています）' : ''}${ings ? '・' + ings : ''}：冷蔵庫から鶏ガラ・豚骨・煮干しを運んで入れよう（${cap}つまで＝${def.pot.sv}杯分）`;
      else A.info = `🍲 <b>${B.name}</b> ${P.sv}/${def.pot.sv}杯・${ings}<br>${P.rh && potReheat(P, clk) < 1 ? `${P.fire ? '🔥' : '❄️'} 冷蔵庫から出したスープ：温め直し ${Math.round(potReheat(P, clk) * 100)}%${P.fire ? '' : '（火をつけよう）'}` : ready ? `コク ${Math.round(clamp((heat - B.ready) / (B.rich - B.ready), 0, 1) * 100)}%・品質 ${Math.round(soupQuality(f, clk) * 100)}点` : P.fire ? `炊いています… あと${Math.max(0, Math.ceil(B.ready - heat))}秒` : '火にかけよう'}${aku > 0.05 ? `・<b style="color:#e0a050">アク ${Math.round(aku * 100)}%</b>` : ''}${B.bitter && heat > B.bitter ? '・⚠苦い（炊きすぎ）' : ''}・${P.fire ? '🔥火' : '⚫火が止まっている'}`;
      A.info = dishInfo + A.info;
      if (P?.b) A.gauge = P.rh && potReheat(P, clk) < 1 ? [potReheat(P, clk), '🔥', '温め直しています'] : [clamp(heat / B.ready, 0, 1), ready ? '✅' : '🔥', ready ? 'だしができた' : 'だしを炊いています'];
      const skim = { label: '🥄 アクを取る（長押し）', repeat: true, fn: () => { this.act({ t: 'skim', fid: f.id, dur: this.holdDur('skim') }); this.anim = 'stir'; this.animT = 0.3; } };
      const fireT = { label: P?.fire ? '火を止める' : '火をつける', fn: () => this.act({ t: 'fire', fid: f.id }) };
      if (hd?.t === 'dish' && hd.d.k === 'bowl' && !hd.d.broth) {
        if (ready) A.act = { label: 'スープを注ぐ', icon: '🥣', fn: () => this.act({ t: 'soupPour', fid: f.id }) };
        else A.hint = !P?.b ? 'だしを炊こう（丼を置いてから）' : 'だしが炊けるまで待とう';
        if (!hd.d.tare) A.hint = (A.hint ? A.hint + '　' : '') + '※先にトッピング台でタレ（かえし）を入れておこう';
      } else if (hd && P?.fire && !(P.w > 0)) { A.act = fireT; A.hint = '⚠ 空焚き！火を止めよう（火事になる）'; }
      else if (!hd) {
        if (!P || !(P.w > 0)) {
          if (P?.fire) { A.act = fireT; A.hint = '⚠ 空焚き！火を止めよう（火事になる）'; }
          else { A.act = { label: '🫕 鍋を持つ', fn: () => this.act({ t: 'potLift', fid: f.id }) }; A.hint = P?.dirty ? '鍋を持って洗い場へ。だしがらを洗って、水を張って戻ってこよう' : '鍋を持って洗い場の水道へ。水を張ってここに戻そう'; }
        } else {
          if (P.rh && potReheat(P, clk) < 1 && !P.fire) { A.act = fireT; if (aku > 0.05) A.alt = skim; }
          else if (aku > 0.05 && P.b) { A.act = skim; A.alt = fireT; }
          else if (P.b) A.act = fireT; else A.alt = fireT;
          A.box = { label: 'だしを捨てる', icon: '🗑️', fn: async () => { this.setUIBlock(true); const ok = await confirmBox('寸胴鍋の中身を捨てますか？（鍋は洗い場で洗ってから使おう）', '捨てる'); this.setUIBlock(false); if (ok) this.act({ t: 'soupDump', fid: f.id }); } };
          // 炊けたスープは保存容器に移して冷蔵庫へ（閉店後はこれがいちばん）
          if (P.b && P.sv > 0 && heat >= B.ready) {
            const keep = { label: '🫙 保存容器に移す', fn: () => this.act({ t: 'soupKeep', fid: f.id }) }, late = st.phase === 'summary';
            if (late) { A.act = P.fire ? { ...fireT, label: '火を止める（保存の前に）' } : keep; A.alt = P.fire ? keep : fireT; A.hint = '閉店したら、火を止めてスープを保存容器に移し、冷蔵庫へ（入れないと次の日に捨てられる）'; }
            else A.box = keep;
          }
          A.hint = !P.b ? `冷蔵庫から鶏ガラなどを持ってきて入れよう（1つで${POT_PER}杯分）。香味野菜・昆布を足すとおいしくなる` : !P.fire ? '火をつけよう' : aku > 0.25 ? 'アクが出てきた！長押しで取ろう（取らないとにごって味が落ちる）' : ready ? 'タレを入れた丼を持ってくるとスープを注げます' : 'だしが炊けるまで待とう（アクが出たら取る）';
        }
      }
      return A;
    }
    // ---- 茹で麺機：麺をてぼに入れる → 茹で上がったら、てぼを上げて湯切り → 作業台の丼へ ----
    if (def.baskets) {
      const bi = t.bi ?? 0, b = f.bk[bi];
      const lines = f.bk.map((x, i) => { if (f.bo?.[i]) return `<span class="bk off${i === bi ? ' sel' : ''}">${i + 1}:${f.bo[i] === this.me ? '手に持っている' : '持ち出し中'}</span>`; if (!x) return `<span class="bk off">${i + 1}:空</span>`; const s = clk - x.t0; const lab = noodleLabel(s); return `<span class="bk ${s > NOODLE_OVER ? 'over' : s >= HARD.katame.t[0] ? 'ok' : ''}${i === bi ? ' sel' : ''}">${i + 1}:${s.toFixed(0)}秒 ${lab}</span>`; }).join(' ');
      A.info = dishInfo + `♨️ <b>茹で麺機</b>　${lines}<br><small>かため${HARD.katame.t[0]}〜${HARD.katame.t[1]}秒・ふつう〜${HARD.futsu.t[1]}秒・やわらかめ〜${HARD.yawa.t[1]}秒</small>`;
      const [bx, bz] = basketPos(f.t, bi); A.slot = [f.id, { x: bx, y: 0.86, z: bz, w: 0.2, h: 0.12, d: 0.2 }];
      if (hd?.t === 'dish' && hd.d.k === 'bowl') { A.hint = hd.d.broth ? '丼は作業台に置こう。手を空けて、てぼを上げて湯切りしてから、作業台の丼に麺を入れる' : '先にタレとスープを丼に入れて、作業台に置こう'; return A; }
      if (!hd && b) {
        const sec = clk - b.t0, want = this._focusLine()?.[2], H = HARD[want];
        A.act = { label: `♨️ てぼを上げる（${sec.toFixed(0)}秒・${noodleLabel(sec)}）`, fn: () => this.act({ t: 'teboLift', fid: f.id, bi }) };
        A.alt = { label: `${bi + 1}番の麺を捨てる`, fn: () => this.act({ t: 'noodleDump', fid: f.id, bi }) };
        A.hint = (H ? `注文は${H.name}（${H.t[0]}〜${H.t[1]}秒）。` : '') + 'てぼを上げて、長押しで湯切り → 作業台の丼を狙って麺を入れる';
      }
      if (!A.hint) A.hint = `生麺は冷蔵庫に${st.stock.men || 0}玉。冷蔵庫から麺を持ってきててぼに入れ、茹で上がったらてぼを上げて湯切り → 作業台の丼へ`;
      return A;
    }
    // ---- トッピング台 ----
    if (def.topping) {
      const list = Object.entries(f.tp || {}).filter(([, n]) => n > 0).map(([k, n]) => `${TOPPINGS[k]?.icon}${TOPPINGS[k]?.name}${n}`).join(' ') || '空っぽ（切ったトッピングを1人前ずつ並べよう）';
      A.info = dishInfo + `🥢 <b>トッピング台</b>（3℃の冷蔵バット）<br>${list}`;
      const tares = Object.entries(TARES).filter(([, T]) => st.level >= T.lv).map(([k, T]) => `${T.icon}${T.short}${st.tare?.[k] || 0}`).join(' ');
      A.info += `<br>🫙 タレ：${tares}${f.tj ? `<br>🥄 <b>${TARES[f.tj.k].name}</b>を作っています ${Math.round(f.tj.p * 100)}%` : ''}`;
      if (f.tj) { A.gauge = [f.tj.p, '🫙', `${TARES[f.tj.k].short}を混ぜています`]; if (!hd) { A.act = { label: '🥄 タレを混ぜる（長押し）', repeat: true, fn: () => { this.act({ t: 'tareMix', fid: f.id, dur: this.holdDur('tare') }); this.anim = 'stir'; this.animT = 0.3; } }; A.hint = '長押しで混ぜるとタレができる'; return A; } }
      if (hd?.t === 'dish' && hd.d.k === 'bowl' && !hd.d.tare) {
        const want = this.targetRecipe(hd.d), wk = want ? SOUPS[want.soup].tare : null;
        A.act = wk && (st.tare?.[wk] || 0) > 0 ? { label: `${TARES[wk].short}を入れる`, icon: '🫙', fn: () => this.act({ t: 'tareIn', fid: f.id, k: wk }) } : { label: 'タレを入れる', icon: '🫙', fn: () => this.ui.openTarePicker(f.id, 'in') };
        A.alt = { label: 'ほかのタレ', fn: () => this.ui.openTarePicker(f.id, 'in') };
        A.hint = want ? `「${want.name}」は ${soupRecipe(want.soup)}。丼にタレ（かえし）を先に入れよう` : '丼にタレ（かえし）を先に入れて、寸胴鍋でだしを注ごう';
        return A;
      }
      if (hd?.t === 'dish' && ((hd.d.k === 'bowl' && hd.d.broth) || (hd.d.k === 'bowlS' && hd.d.side === 'rice'))) { A.hint = '丼は作業台に置こう。トッピングは手に取って、作業台の丼にのせに行く'; return A; }
      const kinds = panKinds(f);
      if (!hd && kinds.length) {
        const k = kinds.includes(t.pk) ? t.pk : kinds[0], T = TOPPINGS[k], [px, pz] = toppingPans(f.t)[kinds.indexOf(k)];
        A.slot = [f.id, { x: px, y: 0.93, z: pz, w: 0.17, h: 0.08, d: 0.17 }];
        A.act = { label: `${T.icon}${T.name}を手に取る（残り${f.tp[k]}）`, fn: () => this.act({ t: 'panTake', fid: f.id, k }) };
        if (kinds.length > 1) A.alt = { label: 'ほかのトッピングを取る', fn: () => this.ui.openPanPicker(f.id) };
        A.hint = '1人前ずつ手に取って、作業台の丼を狙ってのせる（狙うバットを変えると、ほかのトッピング）';
        return A;
      }
      A.hint = hd ? 'スープを入れた丼は作業台に置こう。トッピングは手に取ってのせる' : 'タレ（かえし）は冷蔵庫から醤油などを運んできて、ここで混ぜて作る。トッピングはまな板で切って、1人前ずつバットに並べる';
      return A;
    }
    // ---- まな板 ----
    if (def.board) {
      const J = f.job;
      A.info = dishInfo + (J ? `🔪 <b>${TOPPINGS[J.tid].icon}${TOPPINGS[J.tid].name}</b>を仕込み中 ${Math.round(J.p * 100)}%` : f.cut ? `🔪 <b>切った${TOPPINGS[f.cut.tid].name}</b> ${f.cut.n}人前（1つずつ持って運ぼう）` : `🔪 <b>まな板</b>：冷蔵庫の食材を切ってトッピングを仕込む（1つで${CUT_N}人前）`);
      if (f.cut && !hd) { const T = TOPPINGS[f.cut.tid]; A.act = { label: `${T.name}を1人前持つ（残り${f.cut.n}）`, icon: T.icon, fn: () => this.act({ t: 'cutTake', fid: f.id }) }; A.hint = '丼（作業台の上）にのせるか、トッピング台のバット・冷蔵庫へ1つずつ運ぼう'; return A; }
      if (hd) { A.hint = '手を空けてから切ろう'; return A; }
      if (J) { A.act = { label: '🔪 切る（長押し）', repeat: true, fn: () => { this.act({ t: 'chop', fid: f.id, dur: this.holdDur('chop') }); this.anim = 'chop'; this.animT = 0.3; } }; if (J.p <= 0.05) A.alt = { label: '食材を手に戻す', fn: () => this.act({ t: 'chopCancel', fid: f.id }) }; }
      A.hint = J ? `長押しで切る（${CUT_N}人前がまな板に並ぶ）` : '冷蔵庫から食材（長ねぎ・豚バラ肉・メンマなど）を持ってきて、まな板にのせよう';
      return A;
    }
    // ---- 食器棚 ----
    if (def.rack) {
      A.info = dishInfo + `🍽️ <b>食器棚</b>：${Object.entries(DISHES).filter(([k]) => (st.dish[k] || 0) > 0 || k === 'bowl').map(([k, d]) => `${d.icon}${d.name} ${st.dish[k] || 0}`).join('・')}`;
      if (!hd) {
        A.act = { label: '丼を取る', icon: '🍜', fn: () => this.act({ t: 'take', fid: f.id, k: 'bowl' }) };
        A.alt = { label: 'ほかの器', fn: () => this.ui.openDishPicker(f.id) };
      } else if (hd.t === 'clean') A.act = { label: `食器をしまう（${hd.a.length}個）`, icon: '🍽️', fn: () => this.act({ t: 'rackPut', fid: f.id }) };
      else if (hd.t === 'dish' && !hd.d.broth && !hd.d.tare && !hd.d.side) A.act = { label: '器を戻す', fn: () => this.act({ t: 'handBack' }) };
      const dry = Object.values(st.dry || {}).reduce((a, b) => a + b, 0); if (dry && !hd) A.hint = `洗った食器が水切りかごに${dry}個あります（洗い場から持ってきてしまおう）`;
      return A;
    }
    // ---- 洗い場 ----
    if (def.sink) {
      const dirty = Object.values(st.dirty).reduce((a, b) => a + b, 0), dry = Object.values(st.dry || {}).reduce((a, b) => a + b, 0), far = dist(f.x, f.z, this.pc.x, this.pc.z) > REACH + 0.6;
      A.info = `🚰 <b>洗い場</b>：シンク ${dirty}個${f.wp ? `（${DISHES[f.wk]?.name || ''}を洗っています ${Math.round(f.wp * 100)}%）` : ''}・水切りかご ${dry}/${DRY_MAX}`;
      if (f.wp) A.gauge = [f.wp, '🧽', '洗っています'];
      if (hd?.t === 'dirty') {
        A.act = far ? { label: 'シンクに投げ入れる', icon: '🎯', fn: () => this.act({ t: 'dirtyThrow', fid: f.id }) } : { label: 'シンクに入れる', icon: '🧽', fn: () => this.act({ t: 'dirtyPut', fid: f.id }) };
        if (!far) A.alt = { label: '投げ入れる', fn: () => this.act({ t: 'dirtyThrow', fid: f.id }) };
        A.hint = far ? '遠くから投げると割れることも。お客さんに当てないように！' : '';
      } else if (!hd || hd.t === 'clean') {
        if (!hd && dirty > 0 && dry < DRY_MAX) A.act = { label: '🧽 洗う（長押し）', repeat: true, fn: () => { this.act({ t: 'wash', fid: f.id, dur: this.holdDur('wash') }); this.anim = 'wash'; this.animT = 0.3; } };
        if (dry > 0 && (!hd || hd.a.length < DIRTY_MAX)) { const take = { label: `洗った食器を持つ（${Math.min(DIRTY_MAX, dry + (hd?.a.length || 0))}個）`, icon: '🍽️', fn: () => this.act({ t: 'dryTake', fid: f.id }) }; if (!A.act) A.act = take; else A.alt = take; }
        A.hint = dry >= DRY_MAX ? '水切りかごがいっぱい！洗った食器を食器棚にしまおう' : dirty ? 'スポンジで1つずつ洗う（長押し）→ 水切りかご → 食器棚へ' : dry ? '洗った食器は持って食器棚にしまおう' : '洗い物はありません';
      }
      return A;
    }
    // ---- 冷蔵庫 ----
    if (def.cap) {
      A.info = dishInfo + `🧊 <b>${def.name}</b>：${fridgeUsed(st)}/${fridgeCap(st)}パック`;
      if (!hd) {
        const want = this._guideNow?.ing, C = want && carryInfo(want);
        if (C && ingUnlocked(want, st.level) && (st.stock[want] || 0) >= C.take) { A.act = { label: `${ingShort(want)}を取る`, icon: INGREDIENTS[want].icon, fn: () => this.act({ t: 'ingTake', fid: f.id, k: want }) }; A.alt = { label: 'ほかの食材を取る', fn: () => this.ui.openFridgePicker(f.id) }; }
        else { A.act = { label: '食材を取る', icon: '🧊', fn: () => this.ui.openFridgePicker(f.id) }; A.alt = { label: '在庫を見る', fn: () => this.ui.openStock() }; }
      }
      A.hint = '食材は手に持って、使う設備まで運ぼう（仕入れはパソコン・ドローンでここに届く）';
      return A;
    }
    // ---- 炊飯器 ----
    if (def.rice) {
      const rc = f.rc, ready = rc && clk - rc.t0 >= RICE_READY;
      A.info = dishInfo + `🍚 <b>炊飯器</b>：${!rc ? '空っぽ' : ready ? `炊けています ${rc.sv}杯` : `炊いています… あと${Math.ceil(RICE_READY - (clk - rc.t0))}秒`}`;
      if (hd?.t === 'dish' && hd.d.k === 'bowlS' && !hd.d.side && ready) A.act = { label: 'ライスをよそう', icon: '🍚', fn: () => this.act({ t: 'riceServe', fid: f.id }) };
      else if (!hd && !rc) A.hint = `冷蔵庫の米（${st.stock.kome || 0}袋）を持って、洗い場で研いでからここへ`;
      else if (!hd && ready) A.hint = '小丼を持ってくるとよそえます';
      return A;
    }
    // ---- 餃子焼き器・フライヤー ----
    if (def.griddle) {
      const G = GRIDDLE[def.griddle], gr = f.gr, sec = gr ? clk - gr.t0 : 0;
      const stage = !gr ? '空' : sec < G.ideal[0] ? `焼いています ${sec.toFixed(0)}秒` : sec <= G.ideal[1] ? `<b style="color:#4ade80">ちょうどいい！ ${sec.toFixed(0)}秒</b>` : sec <= G.burn ? `<b style="color:#fbbf24">焼きすぎ ${sec.toFixed(0)}秒</b>` : `<b style="color:#ff6b81">焦げてる！ ${sec.toFixed(0)}秒</b>`;
      A.info = dishInfo + `${SIDES[def.griddle].icon} <b>${def.name}</b>：${stage}<br><small>ちょうどいいのは ${G.ideal[0]}〜${G.ideal[1]}秒</small>`;
      if (gr && hd?.t === 'dish' && hd.d.k === 'plate' && !hd.d.side) A.act = { label: '皿に盛る', icon: '🍽️', fn: () => this.act({ t: 'grillTake', fid: f.id }) };
      else if (!gr && !hd) A.hint = `冷蔵庫から${ingShort(G.item)}（${G.use}個）を持ってこよう（在庫 ${st.stock[G.item] || 0}個）`;
      else if (gr) A.hint = '空の皿を持ってきて盛ろう（食器棚の「ほかの器」）';
      return A;
    }
    // ---- ビールサーバー ----
    if (def.beer) {
      A.info = dishInfo + `🍺 <b>ビールサーバー</b>：つないだ樽 のこり ${st.prep.beer || 0}杯（冷蔵庫に樽 ${st.stock.taru || 0}）`;
      if (hd?.t === 'dish' && hd.d.k === 'mug') { A.act = { label: '🍺 注ぐ（長押し）', repeat: true, fn: () => this.act({ t: 'pour', fid: f.id, dur: this.holdDur('pour') }) }; A.hint = (st.prep.beer || 0) > 0 || hd.d.side === 'beer' ? '泡が7:3くらい（93%）で止めるとおいしい。あふれさせないで！' : '樽が空です。冷蔵庫からビール樽を運んでつなごう'; }
      else A.hint = (st.prep.beer || 0) > 0 ? 'ジョッキを持ってこよう（食器棚の「ほかの器」）' : '樽が空です。冷蔵庫からビール樽を運んでつなごう';
      return A;
    }
    // ---- 受け渡し台 ----
    if (def.pass) {
      const pi = t.pi ?? 0, d = f.ps[pi];
      A.info = dishInfo + `🛎️ <b>受け渡し台</b>：${f.ps.map((x, i) => (x ? `${i + 1}:${dishText(x)}` : `${i + 1}:空`)).join('<br>')}`;
      if (hd?.t === 'dish') A.act = { label: '受け渡し台に置く', fn: () => this.act({ t: 'passPut', fid: f.id, pi }) };
      else if (!hd && (d || f.ps.some(Boolean))) A.act = { label: '料理を取る', fn: () => this.act({ t: 'passTake', fid: f.id, pi: d ? pi : -1 }) };
      A.hint = '置いた料理は接客のアルバイトが運んでくれます';
      return A;
    }
    if (f.t === 'trash') {
      A.info = dishInfo + '🗑️ <b>生ゴミ箱</b>';
      if (hd?.t === 'dish') A.act = { label: '捨てる', fn: () => this.act({ t: 'trash' }) };
      return A;
    }
    if (f.t === 'ext' || f.t === 'shuriken') {
      A.info = f.t === 'ext' ? '🧯 <b>消火器</b>' : '✴️ <b>手裏剣ケース</b>';
      if (!hd) A.act = { label: f.t === 'ext' ? '消火器を持つ' : '手裏剣を持つ', fn: () => this.act({ t: 'takeTool', fid: f.id }) };
      else A.hint = '手に持っている物を置いてから';
      return A;
    }
    if (f.t === 'ticket') { A.info = `🎫 <b>券売機</b>：お客さんはここで食券を買います（代金はレジへ）`; return A; }
    if (f.t === 'register') {
      A.info = `💴 <b>レジ</b>：中に <b>${yen(st.till)}</b>・金庫 ${yen(Math.max(0, st.money - st.till))}`;
      if (hd?.t === 'cash') { A.act = { label: `お金を戻す（${yen(hd.v)}）`, icon: '💴', fn: () => this.act({ t: 'cashBack', fid: f.id }) }; A.alt = { label: 'もっとつかむ', fn: () => this.ui.openCashPicker(f.id) }; A.hint = '賭場に持っていくと賭けられます'; return A; }
      if (hd) { A.hint = '手に持っている物を置いてから'; return A; }
      A.act = { label: 'レジを開ける', icon: '💴', fn: () => this.ui.openCashPicker(f.id) };
      if (st.till > 0) A.alt = { label: '金庫にしまう', fn: () => this.act({ t: 'collect', fid: f.id }) };
      A.hint = st.till > 3000 ? '⚠ お金がたまると泥棒に狙われます。金庫にしまおう' : 'お金をつかんで賭場へ行くと、丁半博打などで賭けられます';
      return A;
    }
    if (f.t === 'pc') { A.act = { label: 'パソコンを使う', icon: '💻', fn: () => this.ui.openPC('order') }; A.info = '💻 パソコン：仕入れ・設備（冷蔵庫・茹で麺機など）・メニュー・アルバイト・評判・お店・拡張'; return A; }
    if (f.t === 'opensign') return Object.assign(A, this._signAction(st));
    if (def.gamble) {
      const G = GAMBLES[def.gamble], ok = st.level >= G.lv;
      A.info = `${G.icon} <b>${G.name}</b>${ok ? '' : `（🔒 お店 Lv.${G.lv} から）`}`;
      if (ok) A.act = { label: hd?.t === 'cash' ? `お金をセットする（${yen(hd.v)}）` : '見る', icon: G.icon, fn: () => this.ui.openGamble(def.gamble, f.id) };
      A.hint = hd?.t === 'cash' ? G.desc : '💴 賭けるには、お店のレジを開けてお金をつかんでこよう';
      return A;
    }
    if (def.text) { A.act = { label: '文字を編集', fn: () => this.ui.openText(f.id) }; A.info = `${def.icon} ${def.name}`; return A; }
    if (def.turret) { A.info = '🛡️ <b>警備タレット</b>：近づいた泥棒に自動で手裏剣を撃つ'; return A; }
    A.info = `${def.icon} ${def.name}`;
    return A;
  }
  // てぼを持っているとき：長押しで湯切り → 作業台の丼を狙って麺を入れる
  _teboActions(t, hd, A) {
    const f = t?.type === 'fixture' ? t.f : null, def = f && FIXTURES[f.t], dr = hd.dr || 0, drained = dr >= 1;
    A.info = `♨️ <b>てぼ</b>：麺 ${hd.men.toFixed(0)}秒（${noodleLabel(hd.men)}）・湯切り ${Math.round(dr * 100)}%`;
    A.gauge = [clamp(dr, 0, 1), '💧', drained ? 'お湯が切れた！' : `湯切り ${Math.round(dr * 100)}%`];
    const drain = { label: '♨️ 湯切り（長押し）', repeat: true, fn: () => { this.act({ t: 'teboDrain', dur: this.holdDur('drain') }); this.anim = 'yugiri'; this.animT = 0.35; } };
    if (f && def.slots && !f.br) {
      const ok = (o) => o?.t === 'dish' && o.d.k === 'bowl' && o.d.broth && o.d.men == null;
      const i = ok(f.sl?.[t.i]) ? t.i : (f.sl || []).findIndex(ok);
      A.box = { label: '動かす', icon: '🔧', fn: () => this.startMove(f) };
      if (i >= 0) {
        const [sx] = slotPos(f.t, i); A.slot = [f.id, { x: sx, y: 0.92, z: 0, w: def.w / def.slots - 0.04, h: 0.16, d: def.d - 0.1 }];
        A.info += '<br>' + dishText(f.sl[i].d);
        A.act = { label: drained ? '🍜 丼に麺を入れる' : '🍜 丼に麺を入れる（湯切りが足りない）', fn: () => this.act({ t: 'teboPour', fid: f.id, i }) };
        if (!drained) { A.alt = drain; A.hint = 'しっかり湯切りしてから入れないと、水っぽくなっておいしくない'; }
        else A.hint = '';
        return A;
      }
      A.hint = (f.sl || []).some((o) => o?.t === 'dish' && o.d.k === 'bowl' && o.d.men == null) ? 'この丼にはまだタレとスープが入っていません' : '作業台にスープを入れた丼がありません';
    }
    if (f && def.baskets && f.id === hd.fid) {
      A.act = drained ? { label: 'てぼを戻す', fn: () => this.act({ t: 'teboBack', fid: f.id }) } : drain;
      if (!drained) A.alt = { label: 'てぼを戻す', fn: () => this.act({ t: 'teboBack', fid: f.id }) };
      A.box = { label: '麺を捨てる', icon: '🗑️', fn: () => this.act({ t: 'teboDump' }) };
      A.hint ||= drained ? '作業台の丼を狙って麺を入れよう（戻すとまた茹でる）' : '長押しでてぼを振ってお湯を切る → 作業台の丼を狙って麺を入れる';
      return A;
    }
    if (f?.t === 'trash') { A.act = { label: '麺を捨てる', fn: () => this.act({ t: 'teboDump' }) }; return A; }
    if (!drained) A.act = drain;
    A.hint ||= drained ? '作業台の丼を狙って「丼に麺を入れる」' : '長押しで湯切り → 作業台の丼を狙って麺を入れる';
    return A;
  }
  // 段ボールを持っているとき：冷蔵庫（器は食器棚）を狙って、中身をまとめて入れる
  _foodCrateActions(t, c) {
    const st = this.store, [k, n] = c.items[0] || [], P = INGREDIENTS[k];
    const A = { act: null, alt: null, box: null, hint: '', info: `📦 <b>段ボール</b>：${P?.icon || ''}${P?.name || ''} ×${n}パック`, slot: null };
    const drop = { label: '下ろす', icon: '📦', fn: () => this.act({ t: 'crateDrop', ...this.dropPoint() }) };
    A.box = drop;
    const f = t?.type === 'fixture' ? t.f : null, D = f && FIXTURES[f.t];
    if (f && !f.br && P && (P.dish ? D.rack : D.cap)) {
      A.act = { label: P.dish ? '📦 食器棚にしまう' : '📦 冷蔵庫に入れる', fn: () => this.act({ t: 'crateStore', fid: f.id }) };
      A.info += P.dish ? '' : `<br>🧊 冷蔵庫 ${fridgeUsed(st)}/${fridgeCap(st)}パック`;
      A.hint = !P.dish && fridgeUsed(st, [[k, 1]]) > fridgeCap(st) ? '⚠ 冷蔵庫がいっぱいです（使ってから入れよう）' : '';
      return A;
    }
    A.act = drop;
    A.hint = P?.dish ? '食器棚まで運んで「食器棚にしまう」' : '冷蔵庫まで運んで「冷蔵庫に入れる」（入れないまま次の日になると傷む）';
    return A;
  }
  // 作業台：何でも置ける・取れる
  _slotActions(t, f, hd, A) {
    const def = FIXTURES[f.t], i = t.i ?? 0, x = f.sl?.[i], name = (o) => slotItemName(o);
    A.box = { label: '動かす', icon: '🔧', fn: () => this.startMove(f) };
    A.info = `🧰 <b>${def.name}</b>：${(f.sl || []).map((o, k) => `${k === i ? '▶' : ''}${o ? name(o) : '・'}`).join('　')}`;
    const [sx] = slotPos(f.t, i); A.slot = [f.id, { x: sx, y: 0.92, z: 0, w: def.w / def.slots - 0.04, h: 0.16, d: def.d - 0.1 }];
    if (hd?.t === 'top') {
      const bw = (o) => o?.t === 'dish' && ((o.d.k === 'bowl' && o.d.broth) || (o.d.k === 'bowlS' && o.d.side === 'rice'));
      const bi = bw(x) ? i : (f.sl || []).findIndex(bw), T = TOPPINGS[hd.k];
      if (bi >= 0) {
        const d = f.sl[bi].d, [bx] = slotPos(f.t, bi); A.slot = [f.id, { x: bx, y: 0.92, z: 0, w: def.w / def.slots - 0.04, h: 0.16, d: def.d - 0.1 }];
        if ((d.tp || []).includes(hd.k)) A.hint = `${T.name}はもうのっています`;
        else { A.act = { label: `丼に${T.name}をのせる`, icon: T.icon, fn: () => this.act({ t: 'topOn', fid: f.id, i: bi }) }; const tg = this.targetRecipe(d); A.hint = tg ? `「${tg.name}」には ${tg.tp.map((k) => TOPPINGS[k]?.name).join('・')}` : ''; }
        if (!x) A.alt = { label: 'ここに置く', fn: () => this.act({ t: 'slotPut', fid: f.id, i }) };
        return A;
      }
    }
    if (hd) {
      if (!SLOT_OK[hd.t]) { A.hint = hd.t === 'cash' ? 'お金はレジに戻そう' : '道具は置けません'; return A; }
      if (x) A.hint = '作業台がいっぱいです';
      else { A.act = { label: `${name(hd)}を置く`, icon: '🧰', fn: () => this.act({ t: 'slotPut', fid: f.id, i }) }; A.hint = '置いておけば手が空くので、ほかの物を取りに行ける'; }
    } else if (x) { A.act = { label: `${name(x)}を取る`, icon: '✋', fn: () => this.act({ t: 'slotTake', fid: f.id, i }) }; A.hint = '狙う場所を変えると、ほかの物を取れる'; }
    else A.hint = '丼・食材・食器・鍋など、手に持っている物を何でも置ける台';
    return A;
  }
  // 冷蔵庫：扉を開けて、棚の物を狙って取る／しまう
  _fridgeActions(t, f, hd, A) {
    const st = this.store, def = FIXTURES[f.t], cells = fridgeLayout(st).get(f.id) || [], c = cells.find((o) => o.i === t.ci);
    A.box = { label: '動かす', icon: '🔧', fn: () => this.startMove(f) };
    A.info = (hd?.t === 'dish' ? dishText(hd.d) + '<br>' : '') + `🧊 <b>${def.name}</b>：${fridgeUsed(st)}/${fridgeCap(st)}パック${f.op ? '（開いています）' : ''}`;
    const door = { label: f.op ? '扉を閉める' : '🚪 扉を開ける', fn: () => this.act({ t: 'fridgeDoor', fid: f.id }) };
    const list = { label: '一覧から取る', fn: () => this.ui.openFridgePicker(f.id) };
    if (c && f.op) { const [cx, cy, cz] = fridgeCellPos(f.t, c.i), G = fridgeGrid(f.t); A.slot = [f.id, { x: cx, y: cy, z: cz, w: G.cw - 0.03, h: G.rh - 0.02, d: def.d - 0.2 }]; A.info += `<br>▶ ${fridgeItemName(c)}`; }
    if (hd) {
      const put = { label: hd.t === 'keep' ? '🫙 冷蔵庫にしまう' : hd.t === 'top' ? `切った${TOPPINGS[hd.k]?.name}をしまう` : hd.t === 'ing' ? '冷蔵庫に戻す' : hd.t === 'pack' ? `${INGREDIENTS[hd.k]?.icon || ''}${ingShort(hd.k)}を冷蔵庫に入れる` : 'しまう', fn: () => this.act({ t: 'frPut', fid: f.id }) };
      if (hd.t === 'pack' && INGREDIENTS[hd.k]?.dish) A.hint = '器は食器棚にしまおう';
      else if (['ing', 'top', 'keep', 'pack'].includes(hd.t)) A.act = put; else A.hint = hd.t === 'pot' ? 'スープはコンロで保存容器に移してから冷蔵庫へ' : '冷蔵庫に入れる物ではありません';
      if (hd.t === 'ing') { const C = carryInfo(hd.k); if (C && hd.n < C.max && (st.stock[hd.k] || 0) >= C.take) A.alt = { label: `もう${C.take}${C.unit}取る（${hd.n}→${hd.n + C.take}）`, fn: () => this.act({ t: 'frTake', fid: f.id, kind: 'ing', k: hd.k }) }; A.hint = `${carryInfo(hd.k)?.to || ''}へ持っていこう`; }
      else if (A.act) { A.alt = door; A.hint = '冷蔵庫に入れておけば、閉店しても次の日に持ち越せる'; }
      return A;
    }
    if (!f.op) { A.act = door; A.alt = list; A.hint = this._guideNow?.ing || this._guideNow?.top ? `扉を開けて、${this._guideNow.ing ? ingShort(this._guideNow.ing) : '仕込んだ' + TOPPINGS[this._guideNow.top]?.name}を取ろう` : '扉を開けると棚の中身が見える。ほしい物を狙って取ろう'; return A; }
    if (c?.kind === 'more') A.act = { label: `ほかの物を見る（${c.n}種類）`, icon: '🧊', fn: () => this.ui.openFridgePicker(f.id) };
    else if (c) {
      const icon = c.kind === 'keep' ? '🫙' : c.kind === 'top' ? TOPPINGS[c.k]?.icon : INGREDIENTS[c.k]?.icon;
      const nm = c.kind === 'keep' ? `スープ（${BROTHS[c.b]?.short}）の容器` : c.kind === 'top' ? `切った${TOPPINGS[c.k]?.name}（1人前）` : `${ingShort(c.k)}${carryInfo(c.k) ? `×${carryInfo(c.k).take}` : ''}`;
      A.act = { label: `${nm}を取る`, icon, fn: () => this.act({ t: 'frTake', fid: f.id, kind: c.kind, k: c.k, id: c.id }) };
      A.hint = c.kind === 'keep' ? '空の寸胴鍋にあけて、火にかけて温め直すと使える' : c.kind === 'top' ? '丼（作業台の上）にのせるか、トッピング台のバットに並べよう' : `→ ${carryInfo(c.k)?.to || ''}`;
    } else A.hint = cells.length ? '棚の物を狙おう' : '冷蔵庫は空っぽです（パソコンで仕入れよう）';
    if (!A.act) { A.act = door; A.alt = cells.length ? list : null; } else A.alt = door;
    return A;
  }
  _who(uid) { if (uid === this.me) return 'あなた'; if (String(uid).startsWith('ws:')) return '作業台の上'; if (String(uid).startsWith('s:')) { const s = this.store.staff.find((o) => 's:' + o.id === uid); return s ? `アルバイトの${s.name}さん` : 'アルバイト'; } return (this.players[uid]?.n || '仲間') + 'さん'; }
  // 手に持っている鍋・食材で、狙っている設備にできること
  _carryActions(t, hd, A) {
    const st = this.store, f = t?.type === 'fixture' ? t.f : null, def = f && FIXTURES[f.t];
    if (hd.t === 'pot') {
      const nm = hd.ft === 'pot2' ? '大寸胴鍋' : '寸胴鍋';
      A.info = `🫕 <b>${nm}</b>を持っています（${hd.dirty ? 'だしがらが残っている' : hd.w >= 1 ? '水いっぱい・重い！' : hd.w > 0 ? `水 ${Math.round(hd.w * 100)}%` : '空っぽ'}）`;
      if (def?.sink && !f.br) {
        const fill = (anim) => ({ repeat: true, fn: () => { this.act({ t: 'potFill', fid: f.id, dur: this.holdDur('potFill') }); this.anim = anim; this.animT = 0.3; } });
        if (hd.dirty) { A.act = { label: '🧽 鍋を洗う（長押し）', ...fill('wash') }; A.gauge = [hd.cl || 0, '🧽', 'だしがらを捨てて洗っています']; A.hint = '使い終わった鍋は、だしがらを捨てて洗ってから水を張ろう'; }
        else if (hd.w < 1) { A.act = { label: '🚰 水を入れる（長押し）', ...fill('wash') }; A.gauge = [hd.w, '🚰', `水 ${Math.round(hd.w * 100)}%`]; A.hint = '蛇口から水を張ろう（満タンまで長押し）'; }
        else A.hint = '水がいっぱい！コンロに戻そう（重いので走れません）';
      } else if (def?.pot) {
        if (f.id !== hd.fid) A.hint = 'この鍋は別のコンロのものです';
        else if (hd.w > 0 && hd.w < 1) A.hint = '水が少なすぎます。洗い場で満タンにしよう';
        else { A.act = { label: hd.w >= 1 ? '🍲 コンロにのせる' : '鍋をコンロに戻す', fn: () => this.act({ t: 'potSet', fid: f.id }) }; A.hint = hd.w >= 1 ? 'のせたら、冷蔵庫から鶏ガラなどを運んで入れよう' : '水を張らずに戻します'; }
      } else A.hint = hd.dirty || hd.w < 1 ? '🚰 洗い場の水道へ持っていこう' : '🍲 コンロに戻そう（重いので走れません）';
      return A;
    }
    if (hd.t === 'top') {
      const T = TOPPINGS[hd.k]; if (!T) return A;
      A.info = `${T.icon} <b>切った${T.name}</b>（1人前）を持っています`;
      if (def?.topping && !f.br) { const room = panRoom(f, hd.k); if (room > 0) A.act = { label: `バットに並べる（${f.tp?.[hd.k] || 0}→${(f.tp?.[hd.k] || 0) + 1}/${PAN_MAX}）`, icon: T.icon, fn: () => this.act({ t: 'panPut', fid: f.id }) }; else A.hint = 'バットがいっぱい（冷蔵庫にしまおう）'; if (room > 0) A.hint = 'トッピング台に並べておくと、丼を持ってきてのせられる（3℃の冷蔵台なので次の日も使える）'; return A; }
      if (def?.board && !f.br) { if (!f.job && (!f.cut || (f.cut.tid === hd.k && f.cut.n < CUT_N))) A.act = { label: 'まな板に戻す', fn: () => this.act({ t: 'cutPut', fid: f.id }) }; return A; }
      A.hint = '丼（作業台の上）にのせるか、トッピング台のバット・冷蔵庫へ';
      return A;
    }
    if (hd.t === 'pack') {
      const P = INGREDIENTS[hd.k]; if (!P) return A;
      A.info = `📦 <b>${P.icon} ${packName(hd.k)}</b>を持っています（届いたパック）`;
      if (P.dish) { if (def?.rack && !f.br) A.act = { label: `${DISHES[P.dish]?.name || '器'}を食器棚にしまう（${hd.n}個）`, icon: '🍽️', fn: () => this.act({ t: 'packRack', fid: f.id }) }; else A.hint = '🍽️ 食器棚にしまおう'; }
      else A.hint = '🧊 冷蔵庫にしまおう（パックのままでは使えません）';
      return A;
    }
    if (hd.t === 'keep') {
      A.info = `🫙 <b>スープの保存容器</b>：${BROTHS[hd.b]?.name} ${hd.sv}杯分`;
      if (def?.pot && !f.br) {
        const P = f.pot;
        if (f.away) A.hint = '鍋がコンロにのっていません';
        else if (P?.dirty) A.hint = '鍋にだしがらが残っています（鍋を洗い場で洗ってから）';
        else if (P && (P.w > 0 || P.b)) A.hint = 'この鍋は使っています（空の鍋にあけよう）';
        else { A.act = { label: '🍲 鍋にあける', fn: () => this.act({ t: 'keepPour', fid: f.id }) }; A.hint = 'あけたら火にかけて温め直そう'; }
        return A;
      }
      A.hint = this.store.phase === 'prep' || this.store.phase === 'open' ? '空の寸胴鍋にあけて温め直すか、冷蔵庫にしまおう' : '🧊 冷蔵庫にしまおう（入れないと次の日に捨てられる）';
      return A;
    }
    const I = INGREDIENTS[hd.k], C = carryInfo(hd.k), nm = ingShort(hd.k);
    if (!I) return A;
    const ws = hd.k === 'kome' ? ((hd.ws || 0) >= 1 ? '（研いだ米）' : hd.ws ? `（研いでいます ${Math.round(hd.ws * 100)}%）` : '（まだ研いでいない）') : '';
    A.info = `${I.icon} <b>${nm}</b> ×${hd.n}${C?.unit || ''}${ws} を持っています`;
    if (def?.cap && !f.br) {
      const more = C && hd.n < C.max && (st.stock[hd.k] || 0) >= C.take;
      const back = { label: '冷蔵庫に戻す', fn: () => this.act({ t: 'ingBack', fid: f.id }) };
      if (more) { A.act = { label: `もう${C.take}${C.unit}取る（${hd.n}→${hd.n + C.take}）`, icon: I.icon, fn: () => this.act({ t: 'ingTake', fid: f.id, k: hd.k }) }; A.alt = back; }
      else A.act = back;
      A.hint = `${C?.to || ''}へ持っていこう`;
      return A;
    }
    if (f && !f.br && ingFits(hd.k, def, hd)) {
      if (def.pot) {
        const P = f.pot;
        if (f.away) A.hint = '鍋がコンロにのっていません';
        else if (!(P?.w > 0)) A.hint = '先に鍋を洗い場に持っていって、水を張ってこよう';
        else if (P.used > 0) A.hint = '使いはじめた鍋には足せません（空になったら炊き直そう）';
        else { A.act = { label: `${nm}を鍋に入れる`, icon: I.icon, fn: () => this.act({ t: 'potAdd', fid: f.id }) }; A.hint = I.broth ? `1つで${POT_PER}杯分（この鍋は${FIXTURES[f.t].pot.sv / POT_PER}つまで）。入れたら火をつけよう` : '香りとうま味が出て、だしがおいしくなる'; }
        if (P?.w > 0) A.info += `<br>🍲 鍋の中：${Object.entries(P.n || {}).map(([k, n]) => `${INGREDIENTS[k]?.icon}${ingShort(k)}×${n}`).join('・') || '水だけ'}`;
      } else if (def.baskets) {
        const bi = t.bi != null && !f.bk[t.bi] ? t.bi : f.bk.findIndex((x) => !x);
        if (bi < 0) A.hint = 'てぼがいっぱいです（空くのを待とう）';
        else { A.act = { label: `${bi + 1}番のてぼに麺を入れる`, icon: '🍜', fn: () => this.act({ t: 'noodleIn', fid: f.id, bi }) }; const [bx, bz] = basketPos(f.t, bi); A.slot = [f.id, { x: bx, y: 0.86, z: bz, w: 0.2, h: 0.12, d: 0.2 }]; A.hint = '入れた瞬間から茹で時間が始まります（かため15秒〜）'; }
      } else if (def.topping) {
        if (f.tj) A.hint = 'いまタレを作っています（混ぜ終わってから）';
        else { const T = TARES[I.tare]; A.act = { label: `${T.short}を作る`, icon: '🫙', fn: () => this.act({ t: 'tareStart', fid: f.id }) }; A.hint = `ボウルにあけたら、手を空けて長押しで混ぜよう（${T.per}杯分）`; }
      } else if (def.board) {
        if (f.job) A.hint = 'まな板の上の食材を先に切ってしまおう';
        else { A.act = { label: 'まな板にのせる', icon: '🔪', fn: () => this.act({ t: 'boardPut', fid: f.id }) }; A.hint = 'のせたら長押しで切ろう'; }
      } else if (def.sink) {
        A.act = { label: '🍚 米を研ぐ（長押し）', repeat: true, fn: () => { this.act({ t: 'riceWash', fid: f.id, dur: this.holdDur('riceWash') }); this.anim = 'wash'; this.animT = 0.3; } };
        A.gauge = [hd.ws || 0, '🍚', `米を研いでいます ${Math.round((hd.ws || 0) * 100)}%`]; A.hint = '水を替えながら研ぐと、ふっくら炊ける';
      } else if (def.rice) {
        if (f.rc && f.rc.sv > 0) A.hint = 'まだごはんが残っています';
        else { A.act = { label: '炊飯器に入れて炊く', icon: '🍚', fn: () => this.act({ t: 'riceStart', fid: f.id }) }; }
      } else if (def.griddle) {
        const G = GRIDDLE[def.griddle];
        if (f.gr) A.hint = 'いま焼いています';
        else if (hd.n < G.use) A.hint = `${G.use}個いります（冷蔵庫でもう少し取ろう）`;
        else A.act = { label: `${G.name}を${def.griddle === 'gyoza' ? '焼く' : '揚げる'}`, icon: SIDES[def.griddle].icon, fn: () => this.act({ t: 'grillStart', fid: f.id }) };
      } else if (def.beer) {
        if ((st.prep.beer || 0) > 0) A.hint = `まだ樽に${st.prep.beer}杯分残っています`;
        else A.act = { label: '樽をつなぐ', icon: '🛢️', fn: () => this.act({ t: 'kegSet', fid: f.id }) };
      }
      return A;
    }
    A.hint = hd.k === 'kome' && (hd.ws || 0) < 1 ? '🚰 洗い場で米を研ごう' : `${nm}は${C?.to || '使う設備'}へ持っていこう`;
    return A;
  }
  // 席：料理を出す・食器を下げる
  _seatActions(t, f, si, hd, A) {
    const st = this.store;
    if (!f || si == null || si < 0) return A;
    const def = FIXTURES[f.t], o = this.orderAt(f.id, si), dd = f.dd?.[si] || [];
    if (!t.type || t.type !== 'cust') { const [sx, sz] = def.spots[si]; A.slot = [f.id, { x: sx, y: def.top - 0.02, z: sz, w: 0.32, h: 0.14, d: 0.3 }]; }
    let info = hd?.t === 'dish' ? dishText(hd.d) + '<br>' : hd?.t === 'dirty' ? `🍽️ 下げた食器 ${hd.a.length}/${DIRTY_MAX}<br>` : '';
    if (o) {
      const wait = o[2], lines = o[5].map((l) => `${l[3] ? '✅' : l[4] ? '⏳' : '⬜'} ${lineName(st, l)}${l[0] === 'ramen' ? `（${HARD[l[2]]?.name}）` : ''}`).join('　');
      info += `${o[4] ? '🕶️ <b>評論家</b>' : '🧑 お客さん'}［${o[1]}］ 待ち ${wait}秒<br>${lines}`;
    } else info += `${def.icon} ${def.name}${dd.length ? `　🍽️ 食べ終わった食器 ${dd.length}` : '（空き）'}`;
    A.info = info;
    if (hd?.t === 'dish' && o) {
      A.act = { label: '提供する', icon: '🙇', fn: () => this.act({ t: 'serve', cid: o[0], fid: f.id, si }) };
      const m = o[5].find((l) => !l[3] && l[0] === 'ramen'); if (m) { const menu = st.menu.find((x) => x.id === m[1]); if (menu) A.hint = `注文：${menu.name}（${SOUP_NAME(menu.soup)}・${menu.tp.map((x) => TOPPINGS[x]?.icon).join('')}・麺${HARD[m[2]]?.name}）`; }
    }
    if (dd.length && (!hd || (hd.t === 'dirty' && hd.a.length < DIRTY_MAX))) A[A.act ? 'alt' : 'act'] = { label: `食器を下げる（${dd.length}）`, icon: '🍽️', fn: () => this.act({ t: 'clear', fid: f.id, si }) };
    if (!A.hint && hd?.t === 'dirty') A.hint = hd.a.length >= DIRTY_MAX ? '洗い場に持っていこう' : '';
    return A;
  }
  // 持っている丼に合う注文（選んだ注文 → 同じスープでいちばん待っている注文）
  targetRecipe(d) {
    const st = this.store;
    const orders = (this.dyn?.o || []).slice();
    const sel = orders.find((o) => o[0] === this.selOrder);
    const want = (o) => o[5].filter((l) => !l[3]).map((l) => {
      if (l[0] === 'ramen') { const m = st.menu.find((x) => x.id === l[1]), S = m && SOUPS[m.soup]; return S && d.k === 'bowl' && (d.soup ? m.soup === d.soup : (!d.tare || S.tare === d.tare) && (!d.broth || S.broth === d.broth)) ? { name: m.name, tp: m.tp, soup: m.soup, h: l[2] } : null; }
      if (l[0] === 'chadon' && d.k === 'bowlS') return { name: 'チャーシュー丼', tp: ['chashu'] };
      return null;
    }).filter(Boolean)[0];
    let w = sel ? want(sel) : null;
    if (!w) for (const o of orders.sort((a, b) => b[2] - a[2])) { w = want(o); if (w) break; }
    if (!w) return null;
    return { ...w, miss: w.tp.filter((x) => !(d.tp || []).includes(x)) };
  }
  _signAction(st) {
    if (st.phase === 'prep') return { act: { label: '「営業中」にする', fn: () => this.act({ t: 'open' }) }, info: '🪧 札：<b style="color:#ff6b81">準備中</b>', hint: '営業中にするとのれんが出て、お客さんが来ます' };
    if (st.phase === 'open') return { act: { label: '「準備中」にする', fn: () => this.act({ t: 'open' }) }, info: '🪧 札：<b style="color:#4ade80">営業中</b>', hint: '準備中にすると新しいお客さんが来なくなり、店じまいします' };
    return { act: null, info: '🪧 札：<b style="color:#ff6b81">準備中</b>', hint: st.phase === 'closing' ? '店じまい中…残りのお客さんが食べ終わるのを待とう' : '' };
  }
  dropPoint() { const p = this.pc; return { x: p.x + Math.sin(p.ry) * 0.75, z: p.z + Math.cos(p.ry) * 0.75, ry: p.ry }; }
  _placeAim(type, r, ignoreId) {
    const cam = this.R.camera, p = this.pc;
    V2.set(0, 0); RAY.setFromCamera(V2, cam);
    const o = RAY.ray.origin, d = RAY.ray.direction;
    let x, z;
    if (d.y < -0.05) { const k = -o.y / d.y; x = o.x + d.x * k; z = o.z + d.z * k; } else { x = p.x + Math.sin(p.yaw) * 3; z = p.z + Math.cos(p.yaw) * 3; }
    const dd = dist(x, z, p.x, p.z); if (dd > 7) { x = p.x + (x - p.x) / dd * 7; z = p.z + (z - p.z) / dd * 7; }
    [x, z] = snapFixture(type, x, z, r);
    const overMe = (xx, zz) => { if (FIXTURES[type]?.air) return false; const f = fixtureFootprint(type, xx, zz, r); return p.x > f.minX - 0.3 && p.x < f.maxX + 0.3 && p.z > f.minZ - 0.3 && p.z < f.maxZ + 0.3; };
    for (let k = 1; k <= 16 && overMe(x, z); k++) [x, z] = snapFixture(type, x + Math.sin(p.yaw) * 0.25, z + Math.cos(p.yaw) * 0.25, r);
    return fitPlacement(this.store, type, x, z, r, ignoreId, overMe);
  }
  _crateActions(c, inp) {
    const def = FIXTURES[c.ft];
    if (inp.edges.has('rotate')) this.crateR = ((this.crateR || 0) + 1) % 4;
    const r = this.crateR || 0, P = this._placeAim(c.ft, r, null);
    this.R.setGhost(c.ft, P.x, P.z, r, P.ok, this.store); this._crateGhost = true;
    return {
      info: `📦 <b>${def.icon} ${def.name}</b>の大きい段ボール`,
      hint: P.ok ? '置きたい場所を狙って「開けて置く」（「回す」で向きを変える）' : '⚠ ' + P.why,
      act: { label: '📦 開けて置く', fn: () => { if (!P.ok) { toast(P.why, 'warn'); this.app.sfx.play('err'); return; } this.act({ t: 'unpack', x: P.x, z: P.z, r }); } },
      alt: { label: '回す', fn: () => { this.crateR = (r + 1) % 4; } },
      box: { label: '下ろす', icon: '📦', fn: () => this.act({ t: 'crateDrop', ...this.dropPoint() }) },
      slot: null,
    };
  }
  _interact(dt, inp) {
    const crate0 = this.heldCrate(), crate = crate0?.kind === 'food' ? null : crate0;
    const t = crate ? null : this._target();
    if (!crate && this._crateGhost) { this._crateGhost = false; this.R.setGhost(null); }
    const A = crate ? this._crateActions(crate, inp) : this._actions(t);
    const hlId = A.slot ? A.slot[0] : t?.type === 'fixture' ? t.fid : t?.type === 'cust' ? t.fid : null;
    this.R.setHighlight(hlId, A.slot ? (() => { const s = A.slot[1]; return [s.x, s.y, s.z, s.w, s.h ?? 0.35, s.d]; })() : null);
    this.input.setLabel('act', A.act?.label || '', !!A.act);
    this.input.setLabel('alt', A.alt?.label || '', !!A.alt);
    this.input.setLabel('box', A.box?.label || '', !!A.box, A.box?.icon || '📦'); this.input.setVisible('box', !!A.box);
    this.ui.setHint(A.hint, A.info);
    this._updateGuide(dt);
    this.ui.setHand(this.hand() || (crate0?.kind === 'food' ? { t: 'box', k: crate0.items[0]?.[0], n: crate0.items[0]?.[1] || 0 } : null));
    if (!crate && inp.taps?.length && this.app.settings.assist !== false) this._tapAct(inp.taps[inp.taps.length - 1]);
    const k = this.input.touchVisible ? '' : `${A.act ? 'E/左クリック：' + A.act.label + '　' : ''}${A.alt ? 'Q/右クリック：' + A.alt.label + '　' : ''}${A.box ? 'F：' + A.box.label + '　' : ''}B：建築　C：注文票　V：視点　Tab：評判　Esc：メニュー${this.room ? '　Enter：チャット' : ''}`;
    this.ui.setKeys(k);
    this.ui.showCross(true);
    this.timers.repeat -= dt;
    for (const id of ['act', 'alt', 'box']) {
      const a = A[id]; if (!a) continue;
      if (inp.edges.has(id)) { a.fn(); this.timers.repeat = 0.3; this.pc.ry = this.app.settings.cam === 'first' ? this.pc.ry : this.pc.yaw; this.reachT = 0.4; }
      else if (a.repeat && inp.held.has(id) && this.timers.repeat <= 0) { a.fn(); this.timers.repeat = 0.13; this.reachT = 0.3; }
    }
    this.reachT = Math.max(0, (this.reachT || 0) - dt);
    this.animT = Math.max(0, (this.animT || 0) - dt); if (!this.animT && !(inp.held.has('act') && this.hand()?.t === 'ext')) this.anim = null;
    // ゲージ（消火器・仕込み・ビール・洗い物）
    const hd = this.hand(), f = t?.f;
    let g = A?.gauge || null;
    if (g) { /* 設備のゲージ（だし・湯切り・タレ・洗い物） */ }
    else if (hd?.t === 'ext') g = [hd.u, '🧯'];
    else if (hd?.t === 'dish' && hd.d.k === 'mug' && hd.d.side === 'beer') g = [Math.min(1, (hd.d.fill || 0) / 1.1), '🍺', hd.d.fill > 1.08 ? 'あふれた！' : Math.abs(hd.d.fill - 0.93) < 0.06 ? 'ちょうどいい！' : ''];
    else if (f && FIXTURES[f.t].board && f.job) g = [f.job.p, '🔪'];
    else if (f && FIXTURES[f.t].sink && f.wp) g = [f.wp, '🧽'];
    this.ui.setGauge(g);
  }

  // ---------- 建築 ----------
  toggleBuild(on, move = null) {
    if (on && (this.hand() || this.heldCrate())) { toast('手に持っている物を置いてから建築モードにしてね', 'warn'); return; }
    this.state = on ? 'build' : 'walk';
    this.build = { sel: null, moving: null, r: 0, x: 0, z: 0, ok: false };
    this.R.setGhost(null); this.R.setFixtureHidden(null);
    if (on && move) { this.build.moving = move; this.build.r = move.r; this.build.quick = true; this.R.setFixtureHidden(move.id); }
    this.ui.showBuild(on, move ? move.t : null, (id, stf) => this.pickBuild(id, stf), move ? { type: move.t, ok: false, why: '' } : null);
    this.ui.setHint('', '');
    this.ui.setGauge(null);
  }
  startMove(f) {
    if (this.hand()) { toast('手に持っている物を置いてから動かしてね', 'warn'); return; }
    this.toggleBuild(true, f);
    if (this.state === 'build') toast(`${FIXTURES[f.t].icon} ${FIXTURES[f.t].name}を動かしています。置きたい場所を狙って「ここに移動」`, '', 3000);
  }
  pickBuild(id, stf = false) { this.build.sel = id; this.build.selSt = !!(stf && staffEq(id)); this.build.moving = null; this.R.setGhost(null); this.R.setFixtureHidden(null); this.ui.showBuild(true, id, (x, s2) => this.pickBuild(x, s2), null, this.build.selSt); }
  _updateBuild(dt, inp) {
    const B = this.build;
    if (B.sel && !B.moving) {
      const def = FIXTURES[B.sel];
      this.R.setGhost(null); this.R.setHighlight(null);
      this.ui.showBuild(true, B.sel, (xx, s2) => this.pickBuild(xx, s2), null, B.selSt);
      this.input.setLabel('act', `${B.selSt ? 'バイト用を' : ''}買う ${yen(def.price)}`, this.store.money >= def.price);
      const se = staffEq(B.sel) && !B.selSt;
      this.input.setLabel('alt', se ? 'バイト用で買う' : '', se && this.store.money >= def.price);
      this.input.setLabel('box', '選択解除', true, '✖'); this.input.setVisible('box', true);
      this.ui.setHint(this.store.money >= def.price ? '買うと勝手口の外に大きい段ボールで届きます。持って、置きたい場所で「開けて置く」' + (se ? '。「バイト用」で買うと、アルバイトはそれを使って働きます（アルバイトはバイト用の設備しか使いません）' : '') : '⚠ お金が足りません', `${def.icon} ${def.name}　${yen(def.price)}<br><small>${def.desc || ''}</small>`);
      this.ui.setKeys(this.input.touchVisible ? '' : `E：買う${se ? '　Q：バイト用で買う' : ''}　F：選択解除　B/Esc：終了`);
      if (inp.edges.has('box')) { this.pickBuild(null); return; }
      const buy = (stf) => { if (this.store.money < def.price) { toast('お金が足りません', 'warn'); this.app.sfx.play('err'); } else { this.act({ t: 'buy', ft: B.sel, st: stf ? 1 : 0 }); this.pickBuild(null); } };
      if (inp.edges.has('act')) buy(!!B.selSt); else if (se && inp.edges.has('alt')) buy(true);
      return;
    }
    const type = B.moving?.t;
    if (!type) this.ui.showBuild(true, null, (x, s2) => this.pickBuild(x, s2));
    if (inp.edges.has('rotate')) B.r = (B.r + 1) % 4;
    if (type) {
      const P = this._placeAim(type, B.r, B.moving?.id ?? null), x = P.x, z = P.z;
      B.x = x; B.z = z; B.ok = P.ok; B.why = P.why;
      this.ui.showBuild(true, type, (xx) => this.pickBuild(xx), { type, ok: B.ok, why: B.why });
      this.R.setGhost(type, x, z, B.r, B.ok, this.store);
      this.input.setLabel('act', 'ここに移動', B.ok); this.input.setLabel('alt', '回転', true);
      this.input.setLabel('box', 'やめる', true, '✖'); this.input.setVisible('box', true);
      if (inp.edges.has('box')) { if (B.quick) this.toggleBuild(false); else this.pickBuild(null); return; }
      this.ui.setHint(B.ok ? '' : '⚠ ' + B.why, `${FIXTURES[type].icon} ${FIXTURES[type].name}（移動中）`);
      this.ui.setKeys(this.input.touchVisible ? '' : 'E：移動　Q/R：回転　F：やめる　B/Esc：終了');
      if (inp.edges.has('alt')) B.r = (B.r + 1) % 4;
      if (inp.edges.has('act')) {
        if (!B.ok) { toast(B.why, 'warn'); this.app.sfx.play('err'); }
        else { this.act({ t: 'move', fid: B.moving.id, x, z, r: B.r }); B.moving = null; this.R.setGhost(null); this.R.setFixtureHidden(null); if (B.quick) { this.toggleBuild(false); return; } }
      }
      this.R.setHighlight(null);
      return;
    }
    const t = this._target(), f = t?.type === 'fixture' ? t.f : null, def = f && FIXTURES[f.t];
    this.R.setHighlight(f && !def.fixed ? f.id : null);
    const se = f && staffEq(f.t);
    this.input.setVisible('box', !!se); if (se) this.input.setLabel('box', f.st ? 'バイト用をやめる' : 'バイト専用にする', true, '🧑‍🍳');
    this.input.setLabel('act', f && !def.fixed ? '移動' : '', !!f && !def.fixed);
    this.input.setLabel('alt', f && !def.fixed && !def.keep ? `売却 +${yen(def.price / 2)}` : '', !!f && !def.fixed && !def.keep);
    this.ui.setHint(f ? (def.fixed ? 'これは動かせません' : def.keep ? '動かせます（売ることはできません）' : se ? (f.st ? 'バイト専用：アルバイトがここで働きます（みんなも使えます）' : 'バイト専用にすると、アルバイトがここで働きます') : '') : '置きたい設備をリストから選ぶか、動かしたい設備を狙ってね', f ? `${def.icon} ${f.st ? '【バイト用】' : ''}${def.name}` : '');
    this.ui.setKeys(this.input.touchVisible ? '' : `E：移動　Q：売却${se ? '　F：バイト専用' : ''}　B/Esc：終了`);
    if (se && inp.edges.has('box')) this.act({ t: 'staffEq', fid: f.id });
    if (f && !def.fixed) {
      if (inp.edges.has('act')) { B.moving = f; B.r = f.r; this.R.setFixtureHidden(f.id); }
      if (inp.edges.has('alt') && !def.keep) this.act({ t: 'sell', fid: f.id });
    }
  }
  // ---------- ネット送受信 ----------
  _net(dt) {
    if (!this.room) return;
    const T = this.timers, p = this.pc;
    T.net -= dt;
    if (T.net <= 0) {
      T.net = 0.1;
      const an = this.anim || (this.reachT > 0 ? 'reach' : this.moving ? 'walk' : 'idle');
      const s = { x: +p.x.toFixed(2), z: +p.z.toFixed(2), y: +p.y.toFixed(2), ry: +p.ry.toFixed(2), an };
      const k = JSON.stringify(s);
      if (k !== this._lastPl || (T.plForce = (T.plForce || 0) + 1) > 20) { this._lastPl = k; T.plForce = 0; this.room.sendPlayer(s); }
    }
    if (this.mode !== 'host') return;
    this.room.beat?.(); // ホストの生存確認（タイマーが間引かれても送れるように、毎フレームの処理からも送る）
    T.store -= dt; T.dyn -= dt;
    if (T.store <= 0) {
      T.store = 0.35;
      const st = this.store, core = { ...st }; delete core.fixtures; delete core.time; delete core.rev;
      const parts = { core: JSON.stringify(core), fx: JSON.stringify(st.fixtures) };
      for (const [k, v] of Object.entries(parts)) if (v !== this.lastParts[k]) { this.lastParts[k] = v; this.room.publishStorePart(k, v); }
    }
    if (T.dyn <= 0) { T.dyn = 0.16; this.room.publishDyn(JSON.stringify(this.dyn)); }
  }
  // ---------- 描画 ----------
  _render(dt) {
    const R = this.R, st = this.store, d = this.dyn || { c: [], s: [] }, s = this.app.settings, p = this.pc;
    R.setTime(st.time);
    R.syncStore(st);
    const hands = st.hand || {}, list = [];
    const myAn = this.anim || (this.reachT > 0 ? 'reach' : null);
    const fp = s.cam === 'first';
    list.push({ key: 'me', kind: 'player', av: this.app.profile.av, x: p.x, y: p.y, z: p.z, ry: p.ry, local: true, an: myAn, hand: fp ? null : hands[this.me] || null,
      name: s.names && this.room ? this.app.profile.name : null, nameColor: '#ffe14d', visible: !fp, bubble: this.chat[this.me] ? 'chat' : null, bubbleText: this.chat[this.me]?.text });
    for (const [uid, pl] of Object.entries(this.players)) {
      if (pl.x == null) continue;
      list.push({ key: 'p:' + uid, kind: 'player', av: pl.av, x: pl.x, y: pl.y || 0, z: pl.z, ry: pl.ry || 0, an: pl.an === 'walk' ? null : pl.an, hand: hands[uid] || null, name: s.names ? pl.n : null, bubble: this.chat[uid] ? 'chat' : null, bubbleText: this.chat[uid]?.text });
    }
    for (const c of d.c || []) list.push({ key: 'c:' + c[0] + (c[1] === 'critic' ? 'k' : ''), kind: 'cust', av: c[1] === 'critic' ? CRITIC_AV : c[1], seedAv: c[1] !== 'critic', x: c[2], z: c[3], ry: c[4], an: c[5], bubble: c[6] || null, y: c[7] || 0, small: true });
    const staffById = Object.fromEntries(st.staff.map((x) => [x.id, x]));
    for (const e of d.s || []) {
      const sd = staffById[e[0]]; if (!sd) continue;
      list.push({ key: 's:' + e[0] + ':' + sd.seed, kind: 'staff', av: sd.seed, seedAv: true, uniform: st.color, x: e[1], z: e[2], ry: e[3], an: e[4], hand: hands['s:' + e[0]] || null, name: s.names ? (STAFF_ROLES[sd.role]?.icon || '') + sd.name : null, nameColor: '#9fe8ff', small: true, bubble: e[5] || null });
    }
    if (d.th) list.push({ key: 'thief:' + d.th[6], kind: 'thief', av: THIEF_AV, x: d.th[0], z: d.th[1], ry: d.th[2], an: d.th[3], bubble: d.th[4] || null, small: true });
    // 賭場の壺振りと胴元
    list.push({ key: 'npc:dealer', kind: 'npc', av: DEALER_AV, x: 13, z: -0.75, ry: 0, an: d.ch?.ph === 'shake' ? 'zstir' : 'zsit', y: 0.05, small: true });
    if (st.level >= GAMBLES.chinchiro.lv) list.push({ key: 'npc:oya', kind: 'npc', av: { ...DEALER_AV, hat: 'none', acc: 'sun' }, x: 10.6, z: -2.65, ry: 0, an: 'zsit', y: 0.05, small: true });
    for (const e of list) if (e.seedAv) e.av = this.app.avatarFromSeed(e.av, e.kind);
    // 持っている料理・食器が設備や壁にめりこまないよう、前がつまっていたら体に引き寄せる
    for (const e of list) if (e.hand && e.hand.t !== 'ext' && e.hand.t !== 'shuri') { if (e.hand.t === 'pot') { e.hz = 0.4; continue; } const free = this._ahead(e.x, e.z, e.ry || 0, (e.y || 0) + 0.9, 0.56); e.hz = clamp(free - 0.18, 0.14, 0.34); }
    for (const k of Object.keys(this.chat)) { this.chat[k].t -= dt; if (this.chat[k].t <= 0) delete this.chat[k]; }
    R.syncChars(list, dt);
    const holders = (who) => { if (who === this.me) return R.getChar('me'); if (String(who).startsWith('s:')) { const sd = staffById[String(who).slice(2)]; return sd ? R.getChar(who + ':' + sd.seed) : null; } return R.getChar('p:' + who); };
    const fpH = fp ? { who: this.me, av: this.app.profile.av, bob: this.fpBob || 0, hand: hands[this.me] || null, shake: this.anim === 'yugiri' } : null;
    R.syncHands(list, fpH);
    R.syncCrates(st, holders, fpH);
    const clk = this.clk();
    R.syncProps(st, d, clk);
    R.syncFx(st, d);
    R.syncBlobs(st, list.filter((e) => e.visible !== false && e.kind !== 'npc').map((e) => { const c = R.getChar(e.key); return c ? [c.root.position.x, c.root.position.z] : [e.x, e.z]; }));
    R.world.update(dt, st.time, [[p.x, p.z], ...(d.c || []).map((c) => [c[2], c[3]]), ...(d.s || []).map((x) => [x[1], x[2]]), ...Object.values(this.players).map((pl) => [pl.x, pl.z]), ...(d.th ? [[d.th[0], d.th[1]]] : [])]);
    R.update(dt);
  }
  help(first) {
    const m = document.createElement('div');
    const steps = [
      ['💻', '最初は何も仕入れていません。まずは厨房のパソコンで食材を仕入れよう。ドローンが勝手口の外に、1つの商品につき1つの段ボールで置いていくので、勝手口から外に出て段ボールを持ち、冷蔵庫まで運んで「冷蔵庫に入れる」（器の段ボールは食器棚へ）。冷蔵庫に入れないまま次の日になると、外の食材は傷んで捨てることになる。冷蔵庫・茹で麺機・洗い場・寸胴鍋・席などの設備は、パソコンの「🛠️ 設備」か🔨建築モードで買える。買った設備も勝手口の外に大きい段ボールで届くので、持って置きたい場所で「開けて置く」'],
      ['🫳', '手に持っている食材・パック・切ったトッピング・スープの容器は「投げる」ことができる。狙った設備の上に落ちると、そこに入る（冷蔵庫・寸胴鍋・作業台・トッピング台・ゴミ箱など）。手が空いている仲間に向かって投げると受け取ってくれる。何もない所に落ちた物は拾える'],
      ['🏮', '外の札を「営業中」にすると、のれんが出てお客さんが来ます。お客さんは入口の券売機で食券を買って、空いている席に座ります'],
      ['📋', '注文は画面の左の「注文票」に出ます（Cキー／📋ボタンで開け閉め）。タップすると、その注文を選べます'],
      ['👉', '画面の上の「次」に、いまやることが出ます。黄色い矢印の設備へ行こう（画面の外なら、はしの矢印が向きを教えてくれます）。注文票をタップすると、その注文の手順に切りかわります'],
      ['🎯', '設備をまん中で狙わなくても、目の前の近くの設備が自動で選ばれます（狙いアシスト）。スマホは画面の設備を直接タップしても使えます。設定でオフにできます'],
      ['🧊', '食材はぜんぶ手で運びます（冷蔵庫に入れるのも自分で）。大型冷蔵庫の扉を開けると、棚に中身が並びます。ほしい物を狙って取ろう（同じ食材なら何個か重ねて持てる）。使う設備まで持っていこう。生麺は茹で麺機、鶏ガラ・豚骨・香味野菜は寸胴鍋、醤油などはトッピング台、長ねぎ・豚バラ肉などはまな板、米は洗い場で研いでから炊飯器、冷凍餃子は餃子焼き器、ビール樽はビールサーバーへ'],
      ['🍜', 'ラーメンの作り方：①冷蔵庫から生麺を持ってきて、茹で麺機のてぼに入れる（入れた瞬間から茹で時間が始まる）→ ②食器棚で「丼を取る」→ ③トッピング台で「タレ（かえし）を入れる」→ ④寸胴鍋で「だしを注ぐ」→ ⑤丼を作業台に置く → ⑥手を空けて茹で麺機で「てぼを上げる」→ 長押しで湯切り → 作業台の丼を狙って「丼に麺を入れる」→ ⑦トッピング台でトッピングを1人前ずつ手に取って、作業台の丼にのせる → ⑧丼を取ってお客さんに出す（カウンター越しでもOK）'],
      ['⏱️', '麺は、てぼをお湯から上げるまでの秒数でかたさが決まる（かため15〜21秒・ふつう21〜27秒・やわらかめ27〜33秒）。上げたあとはそれ以上茹だらないので、湯切りはあわてなくていい。湯切りが足りないと水っぽくなって点数が下がる。「てぼを戻す」とまた茹でられる'],
      ['🍲', 'だしは寸胴鍋で一から炊く：①空の鍋を「持つ」→ ②洗い場の水道で長押しして水を張る（使い終わった鍋は先にだしがらを捨てて洗う）→ ③重くなった鍋を持ってコンロに戻す（水が入った鍋は重くて走れない）→ ④冷蔵庫から鶏ガラ・豚骨・煮干しを運んで入れる（1つで10杯分。香味野菜・昆布も入れるとおいしい）→ ⑤火をつける → ⑥出てきたアクを長押しで取る。鶏ガラ30秒・豚骨50秒・煮干し25秒で使える。空になったら火を止めて炊き直し（空焚きは火事のもと・火がついたままの鍋は持てない）'],
      ['🫙', 'タレ（かえし）は、冷蔵庫から醤油の一升瓶などを持ってきて、トッピング台のボウルにあけ、長押しで混ぜて作る。スープの味は「だし＋タレ」の組み合わせで決まる（例：醤油＝鶏ガラ＋醤油ダレ、家系＝豚骨＋醤油ダレ）'],
      ['🔪', 'トッピングは、冷蔵庫から食材（長ねぎ・豚バラ肉・メンマなど）を持ってきてまな板にのせ、手を空けて長押しで切る。1つ切ると5人前がまな板に並ぶので、1人前ずつ持って、トッピング台のバット（1種類5人前まで）・冷蔵庫・作業台の丼へ運ぼう。丼は作業台に置いたまま、トッピング台のバットを狙って1人前ずつ手に取り、作業台の丼を狙ってのせる'],
      ['🌙', '閉店したら片付け：寸胴鍋の火を止めて「保存容器に移す」→ 冷蔵庫へ。切ったトッピングも冷蔵庫へ（トッピング台のバットは3℃の冷蔵台なのでそのまま）。冷蔵庫に入れていないスープ・切ったトッピング・作りかけの料理は、次の日になると捨てられます。次の日は冷蔵庫の容器を空の鍋にあけて、火にかけて温め直せば使える（タレはそのまま持ち越し）'],
      ['🍽️', 'お客さんが帰ったら席の食器を下げて（5個まで重ねて持てる）、洗い場のシンクに入れる（遠くから投げ入れもできるけど、割れたりお客さんに当たったりする）。スポンジで1つずつ洗う（長押し）→ 水切りかごに並ぶ → 持って食器棚にしまう'],
      ['🥟', 'レベルが上がると、ライス・餃子・生ビール・チャーシュー丼・唐揚げなどのサイドメニュー、新しいスープとトッピングが使えるようになります。パソコンの「メニュー」でオリジナルラーメンを作ろう'],
      ['🥷', '泥棒はレジのお金を狙ってくる。手裏剣ケースで手裏剣を持って投げよう（2回当てると捕まえて懸賞金）。アルバイトの役割を「🛡️警備」にすると、その人が手裏剣を投げたり取り押さえたりしてくれる。レジのお金はときどき「金庫にしまう」と安心'],
      ['🔥', '焦がした餃子・唐揚げや空焚きの鍋から火が出ることがある。消火器を持って火に向けて長押し！放っておくと設備が壊れて、お客さんも逃げてしまう'],
      ['🕶️', 'ときどきサングラスのラーメン評論家が来る。80点以上の一杯を出すと評判が大きく上がって賞金も！'],
      ['🎲', 'となりの「賭場」で丁半博打（Lv.8 チンチロリン・Lv.12 スロット）。賭けるには、お店のレジを開けてお金をつかみ、賭場の台で「お金をセット」する。丁半は壺が開くまでドキドキ、チンチロは自分で振る、スロットは自分でSTOP（リーチ・ジャックポットあり）。勝ったお金は手持ちになるので、レジに戻そう'],
      ['🧑‍🍳', 'Lv.3 からアルバイトを雇える（パソコン）。調理・接客・洗い場・おまかせ の仕事をまかせられる。アルバイトは「バイト用」の設備（麺茹で機・洗い場・コンロ・まな板・トッピング台など）でしか調理・洗い物をしないので、パソコンの「🛠️ 設備」の「バイト用で買う」か建築モードの「🧑‍🍳バイト用」で買うか、置いてある設備を「バイト専用にする」。レジ・冷蔵庫・食器棚・受け渡し台はみんなで共用。閉店後はアルバイトもスープを冷蔵庫にしまってくれる'],
      ['👥', 'ルームを作ると最大4人で一緒にお店を回せます。麺茹で・盛り付け・配膳・洗い物を分担しよう'],
      ['🔨', '建築ボタン（B）で麺茹で機・洗い場・コンロ（寸胴鍋つき）・作業台・冷蔵庫・テーブル席・カウンターなどを買って、好きな場所に置ける。置いてある設備は狙って「🔧動かす」（F）'],
      ['🏆', 'ランキングの「💰 総利益」は、毎日の利益（賭場の勝ち負けも含む）の合計です'], ['🎥', 'Vキー／設定で一人称と三人称を切り替え'],
    ];
    m.append(...steps.map(([i, t]) => h('div', { class: 'help-row' }, h('span', { class: 'hi' }, i), h('span', {}, t))));
    const md = modal('❓ 遊び方', [m, h('button', { class: 'btn big', onclick: () => md.close() }, 'わかった！')], { onClose: () => { this.ui.closed(); if (first) { this.app.profile.tutorialDone = true; this.app.saveLocal(); } } });
    this.ui.opened(md);
  }
  stop() {
    this.R.setViewShift?.(0);
    if (this.input.wheelOff) this.input.wheelOff();
    this.ui.closeAll(); this.ui.show(false);
    this.R.setHighlight(null); this.R.setGhost(null); this.R.setFixtureHidden(null);
    this.R.syncChars([], 0.016); this.R.syncHands([], null);
    clearInterval(this._stateRetry);
    if (this.room) { try { this.room.leave(); } catch (e) { /* noop */ } }
    this.input.setRoom(false);
    this.input.pointerFree = false;
  }
}
export { escapeText, evalDish, griddleQ };
