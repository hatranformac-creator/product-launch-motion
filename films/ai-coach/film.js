// AI Coach — 60 s launch film. Every style is a pure function of t inside seek(t).
// 120 BPM: one beat = 0.5 s, one bar = 2 s. Drop lands at 34.0 s (bar 18).
'use strict';

const M = (window.M = { dur: 60, cues: [], ready: false });
const cue = (t, type, g = 1, p = 0) => M.cues.push({ t: +t.toFixed(4), type, g, p });

// ---------- math ----------
const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, k) => a + (b - a) * k;
const smooth = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
const outC = (x) => 1 - Math.pow(1 - clamp(x), 3);
function stepR(tau, sp) {
  if (tau <= 0) return 0;
  if (!sp) return 1;                                   // instant set
  const { w, z } = sp;
  if (z >= 1) { const x = w * tau; return 1 - Math.exp(-x) * (1 + x); }
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
class Track {                 // targets may be issued in any order; deltas are taken in time order
  constructor(v0) { this.v0 = v0; this.cur = v0; this.ev = []; this.dirty = false; }
  to(t, v, sp) { this.ev.push({ t, v, sp }); this.cur = v; this.dirty = true; return this; }
  set(t, v) { return this.to(t, v, null); }
  at(t) {
    if (this.dirty) { this.ev.sort((a, b) => a.t - b.t); this.dirty = false; }
    let v = this.v0, prev = this.v0;
    for (const e of this.ev) { if (e.v !== prev) v += (e.v - prev) * stepR(t - e.t, e.sp); prev = e.v; }
    return v;
  }
}
class CTrack {
  constructor(c) { this.k = c.map((v) => new Track(v)); }
  to(t, c, sp) { c.forEach((v, i) => this.k[i].to(t, v, sp)); return this; }
  set(t, c) { return this.to(t, c, null); }
  at(t) { const [r, g, b, a] = this.k.map((k) => k.at(t)); return rgba([r, g, b, a]); }
}
const rgba = ([r, g, b, a = 1]) => `rgba(${clamp(r, 0, 255) | 0},${clamp(g, 0, 255) | 0},${clamp(b, 0, 255) | 0},${clamp(a).toFixed(3)})`;
const mixC = (c1, c2, k) => c1.map((v, i) => lerp(v, c2[i] ?? 1, k));
const bump = (tau, d = 0.06) => (tau <= 0 ? 0 : (tau / d) * Math.exp(1 - tau / d));
function vis(t, tin, tout, dOut = 0.14) {
  const e = stepR(t - tin, { w: 24, z: 1 });
  const x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
  return { o: e * (1 - xo), b: (1 - e) * 12 + xo * 12, dy: (1 - e) * 18 - xo * 12, e };
}

// ---------- palette ----------
const K = {
  black: [0, 0, 0, 1], mint: [46, 230, 166, 1], mint0: [46, 230, 166, 0], red: [255, 77, 90, 1],
  white: [244, 247, 245, 1], panel: [12, 17, 16, 1], panel0: [12, 17, 16, 0], line: [38, 50, 46, 1],
  grey: [140, 151, 146, 1], cyan: [86, 212, 236, 1], ink: [6, 10, 9, 1], deep: [10, 38, 29, 1],
};

// ---------- springs ----------
const SP = {
  snap: { w: 30, z: 0.86 }, morph: { w: 17, z: 0.84 }, soft: { w: 10, z: 1 }, text: { w: 24, z: 1 },
  cam: { w: 5.5, z: 1 }, camF: { w: 9, z: 1 }, slow: { w: 3.2, z: 1 }, pop: { w: 24, z: 0.74 },
  lead: { w: 34, z: 0.86 }, trail: { w: 17, z: 0.9 }, cur: { w: 11, z: 1 }, curF: { w: 15, z: 0.95 },
};

// ---------- DOM ----------
const world = document.getElementById('world');
const hud = document.getElementById('hud');
function mk(html, cls = '', parent = world, css = '') {
  const d = document.createElement('div');
  d.className = 'a ' + cls; d.innerHTML = html; if (css) d.style.cssText += css;
  parent.appendChild(d); return d;
}

// ---------- camera ----------
const CX = new Track(960), CY = new Track(470), LZ = new Track(Math.log(1.32));
function cam(t) { return { cx: CX.at(t), cy: CY.at(t), z: Math.exp(LZ.at(t)) }; }
const toScreen = (t, x, y) => { const c = cam(t); return [(x - c.cx) * c.z + 960, (y - c.cy) * c.z + 540]; };
const camTo = (t, cx, cy, z, sp = SP.cam) => { CX.to(t, cx, sp); CY.to(t, cy, sp); LZ.to(t, Math.log(z), sp); };

// ---------- THE shape ----------
const shapeEl = document.createElement('div'); shapeEl.id = 'shape'; world.appendChild(shapeEl);
const S = {
  X: new Track(960), Y: new Track(470), W: new Track(0), H: new Track(0), R: new Track(0),
  fill: new CTrack(K.mint), stroke: new CTrack(K.mint0), sw: new Track(0), bumps: [], useLR: null,
};
const sTo = (t, o, sp = SP.morph) => {
  for (const k of ['X', 'Y', 'W', 'H', 'R', 'sw']) if (o[k] != null) S[k].to(t, o[k], o.spk?.[k] || sp);
  if (o.fill) S.fill.to(t, o.fill, o.spc || SP.soft);
  if (o.stroke) S.stroke.to(t, o.stroke, o.spc || SP.soft);
};
const sBump = (t, a, d) => S.bumps.push([t, a, d]);

// ---------- generic items ----------
const items = [];
// anchor: c | l | r | tl | tr
function item(html, cls, x, y, tin, tout, o = {}) {
  const el = mk(html, cls, o.hud ? hud : world, o.css || '');
  const it = { el, x, y, tin, tout, a: o.a || 'c', s0: o.s0 ?? 1, fn: o.fn, dOut: o.dOut, pop: o.pop };
  items.push(it); return it;
}
const anchorT = { c: 'translate(-50%,-50%)', l: 'translate(0,-50%)', r: 'translate(-100%,-50%)', tl: '', tr: 'translate(-100%,0)' };
function drawItem(it, t) {
  const v = vis(t, it.tin, it.tout, it.dOut);
  if (v.o <= 0.002) { it.el.style.display = 'none'; return; }
  it.el.style.display = '';
  let x = it.x, y = it.y, s = 1, o = v.o, b = v.b, dy = v.dy;
  if (it.pop) { s = lerp(it.pop, 1, stepR(t - it.tin, SP.pop)); dy *= 0.3; }
  if (it.fn) { const r = it.fn(t, v, it) || {}; x = r.x ?? x; y = r.y ?? y; s *= r.s ?? 1; o *= r.o ?? 1; b = r.b ?? b; }
  it.el.style.opacity = o.toFixed(3);
  it.el.style.filter = b > 0.05 ? `blur(${b.toFixed(2)}px)` : 'none';
  it.el.style.transform = `translate(${x.toFixed(2)}px,${(y + dy).toFixed(2)}px) ${anchorT[it.a]} scale(${s.toFixed(4)})`;
}

// ---------- cursors ----------
const ARROW = (fill, stroke) => `<svg width="34" height="40" viewBox="-2 -2 30 38" style="position:absolute;left:-3px;top:-3px;overflow:visible">
  <path d="M0 0 L0 27 L7.2 20.6 L12 31.5 L17.2 29.2 L12.4 18.6 L21.6 18.6 Z" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/></svg>`;
class Cursor {
  constructor(name, fill, stroke, tagBg, tagFg) {
    this.el = mk(ARROW(fill, stroke) + `<div class="tag" style="background:${tagBg};color:${tagFg}">${name}</div>`, 'cur', hud);
    this.tag = this.el.querySelector('.tag');
    this.X = new Track(0); this.Y = new Track(0); this.on = new Track(0); this.clicks = []; this.ripC = fill;
    this.rips = [];
  }
  at(t, x, y, sp = SP.cur) { this.X.to(t, x, sp); this.Y.to(t, y, sp); return this; }
  place(t, x, y) { this.X.set(t, x); this.Y.set(t, y); return this; }
  show(t, v = 1, sp = SP.pop) { this.on.to(t, v, sp); return this; }
  click(t, sfx = true) {
    this.clicks.push(t);
    const r = mk('', 'ripple', hud, `box-shadow: inset 0 0 0 2.5px ${this.ripC}`); this.rips.push([t, r]);
    if (sfx) cue(t, 'click', 1);
    return this;
  }
  draw(t) {
    const on = this.on.at(t);
    if (on < 0.01) { this.el.style.display = 'none'; } else {
      this.el.style.display = '';
      const [sx, sy] = toScreen(t, this.X.at(t), this.Y.at(t));
      const [px] = toScreen(t - 1 / 240, this.X.at(t - 1 / 240), this.Y.at(t - 1 / 240));
      const vx = (sx - px) * 240;
      const lean = clamp(-vx * 0.0045, -14, 14);
      let press = 1; for (const c of this.clicks) press -= 0.16 * Math.exp(-(((t - c) / 0.05) ** 2));
      this.el.style.opacity = clamp(on).toFixed(3);
      this.el.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px) rotate(${lean.toFixed(2)}deg) scale(${(press * clamp(on, 0, 1.2)).toFixed(4)})`;
      this.tag.style.transform = `translateX(${clamp(-vx * 0.012, -26, 26).toFixed(2)}px)`;
    }
    for (const [tc, r] of this.rips) {
      const p = (t - tc) / 0.42;
      if (p <= 0 || p >= 1) { r.style.display = 'none'; continue; }
      const [rx, ry] = toScreen(t, this.X.at(tc), this.Y.at(tc));
      r.style.display = ''; r.style.opacity = ((1 - p) * 0.9).toFixed(3);
      r.style.transform = `translate(${rx}px,${ry}px) scale(${(0.25 + outC(p) * 1.1).toFixed(3)})`;
    }
  }
}

// ======================================================================
// SCENE 1 · 0–4 s · "81% use AI every day"
// ======================================================================
S.X.set(0, 960); S.Y.set(0, 470);
sTo(0.0, { W: 26, H: 26, R: 13 }, SP.pop);
cue(0.0, 'pop', 0.9);
sTo(0.5, { W: 400, H: 400, R: 200, sw: 6 }, SP.morph);
S.fill.to(0.5, K.mint0, { w: 14, z: 1 }); S.stroke.to(0.5, K.mint, { w: 20, z: 1 });
cue(0.5, 'whoosh', 0.55);
camTo(0.0, 960, 470, 1.0, { w: 3.4, z: 1 });

// odometer (one element; value tweens; colour track)
const odo = mk(`<div class="num"><span class="slot"><span class="strip"></span></span><span class="slot"><span class="strip"></span></span><span style="font-size:0.62em;margin-left:0.06em;transform:translateY(0.06em)">%</span></div>`, '');
const strips = [...odo.querySelectorAll('.strip')];
strips.forEach((s) => { s.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map((d) => `<span>${d}</span>`).join(''); });
const odoSeg = [[0.9, 1.4, 0, 81], [4.0, 0.9, 81, 48], [7.0, 0.6, 48, 45]];
const odoVal = (t) => { let v = 0; for (const [t0, d, a, b] of odoSeg) if (t >= t0) v = lerp(a, b, outC((t - t0) / d)); return v; };
const odoCol = new CTrack(K.mint).to(4.0, K.red, SP.soft).to(7.0, K.white, SP.soft);
const odoIt = item('', '', 960, 470, 0.6, 9.85, {
  fn: (t) => {
    const v = odoVal(t), h = 168 * 1.1;
    const ds = [Math.floor(v / 10) % 10 + Math.max(0, (v % 10) - 9), Math.floor(v) % 10 + (v % 1)];
    strips[0].parentElement.style.opacity = clamp(v - 9).toFixed(3);
    ds.forEach((d, i) => { strips[i].style.transform = `translateY(${(-d * h).toFixed(2)}px)`; });
    odo.style.color = odoCol.at(t);
    return { s: 1 + 0.05 * bump(t - 4.0, 0.08) + 0.05 * bump(t - 7.0, 0.08) };
  },
});
odoIt.el.remove(); odoIt.el = odo;
for (let k = 0; k < 10; k++) cue(0.9 + k * 0.125, 'tick', 0.35 + 0.04 * k, k);
item('VIETNAMESE AI USERS', 'over', 960, 222, 1.0, 3.85);
item('use AI tools every day', 'disp cap', 960, 760, 1.5, 3.85);
item('Consumer survey of Vietnamese AI users', 'foot', 80, 1030, 1.0, 3.85, { a: 'l', hud: true });

// ======================================================================
// SCENE 2 · 4–14 s · the pain: appearing capable ≠ being capable
// ======================================================================
S.stroke.to(4.0, K.red, SP.soft); sBump(4.0, 0.06, 0.08); cue(4.0, 'thump', 0.9);
item('BUT IN A 2026 SURVEY OF 1,000 US EMPLOYEES', 'over', 960, 222, 4.15, 9.85);
item('exaggerated their AI use or expertise', 'disp cap', 960, 760, 4.4, 6.85);
camTo(4.0, 960, 470, 1.05, SP.slow);
S.stroke.to(7.0, K.white, SP.soft); sBump(7.0, 0.06, 0.08); cue(7.0, 'thump', 0.9);
item('felt pressure to use AI without confidence', 'disp cap', 960, 760, 7.3, 9.85);
camTo(7.0, 960, 470, 1.1, SP.slow);
item('Visier survey of 1,000 US full-time employees, 2026', 'foot', 80, 1030, 4.15, 13.85, { a: 'l', hud: true });

// 10.0 — ring collapses into the Capability bar; Adoption races ahead
const BAR_L = 680;
sTo(10.0, { X: BAR_L + 130, Y: 600, W: 260, H: 24, R: 12, sw: 0 }, SP.morph);
S.fill.to(10.0, K.mint, SP.soft); S.stroke.to(10.0, K.mint0, SP.soft);
camTo(10.0, 960, 520, 1.0, SP.cam);
cue(10.0, 'whoosh', 0.7);
const adoW = new Track(0).to(10.25, 760, { w: 4.2, z: 1 });
item('', '', BAR_L, 500, 10.2, 13.85, {
  a: 'l', css: 'height:24px;border-radius:12px;background:#F4F7F5;',
  fn: (t, v, it) => { it.el.style.width = adoW.at(t).toFixed(1) + 'px'; },
});
cue(10.25, 'riserS', 0.6);
item('Adoption', 'disp', BAR_L - 36, 500, 10.3, 13.85, { a: 'r', css: 'font-size:36px;' });
item('Capability', 'disp', BAR_L - 36, 600, 10.5, 13.85, { a: 'r', css: 'font-size:36px;color:#2EE6A6;' });
item('Adoption is outrunning capability.', 'disp', 960, 340, 10.8, 13.85, { css: 'font-size:68px;' });

// ======================================================================
// SCENE 3 · 14–18 s · Train · Practise · Upskill (liquid indicator)
// ======================================================================
const tabs = [['Train', 620], ['Practise', 960], ['Upskill', 1300]].map(([w, x]) => ({ w, x, el: null, it: null }));
tabs.forEach((tb) => { tb.it = item(tb.w, 'disp tab', tb.x, 545, 13.85 + 0.0, 17.95); tb.el = tb.it.el; });
const TL = new Track(BAR_L), TR = new Track(BAR_L + 260);
let tabHalf = {};
function tabTo(t, i) {
  const x = tabs[i].x, half = tabHalf[i];
  const right = x > (TL.cur + TR.cur) / 2;
  TL.to(t, x - half, right ? SP.trail : SP.lead);
  TR.to(t, x + half, right ? SP.lead : SP.trail);
}
item('WHAT PEOPLE NEED', 'over', 960, 405, 14.0, 17.9);
const tabSub = [
  ['Learn from trusted knowledge', 14.1, 14.95], ['Rehearse the real conversation', 15.1, 15.95],
  ['Show evidence of growth', 16.1, 16.95], ['Rehearse the real conversation', 17.1, 17.9],
];
tabSub.forEach(([s, a, b]) => item(s, '', 960, 690, a, b, { css: 'font-size:34px;color:#8C9792;' }));
S.H.to(14.0, 104, SP.morph); S.R.to(14.0, 52, SP.morph); S.Y.to(14.0, 545, SP.morph);
cue(14.0, 'swish', 0.5); cue(15.0, 'swish', 0.5); cue(16.0, 'swish', 0.5); cue(17.0, 'swish', 0.5);

const you = new Cursor('You', '#F4F7F5', '#0A0E0D', '#F4F7F5', '#0A0E0D');
you.place(0, 1560, 1000).show(13.3).at(13.3, 640, 575, SP.cur);
you.click(14.0).at(14.45, 975, 575).click(15.0).at(15.45, 1315, 575).click(16.0).at(16.45, 980, 578).click(17.0);
you.at(17.45, 1450, 980, SP.cur).show(17.75, 0, SP.soft);

// ======================================================================
// SCENE 4 · 18–22 s · AI Coach reveal
// ======================================================================
sTo(18.0, { X: 960, Y: 530, W: 760, H: 440, R: 44, sw: 2 }, SP.morph);
S.fill.to(18.0, K.panel, { w: 28, z: 1 }); S.stroke.to(18.0, K.mint, SP.soft);
cue(18.0, 'whoosh', 0.8); cue(18.0, 'chime', 0.7, 0);
camTo(18.0, 960, 530, 1.0, SP.cam); camTo(18.6, 960, 530, 1.07, SP.slow);
const ROBOT = (s = 1) => `<div style="position:relative;width:${128 * s}px;height:${118 * s}px">
  <div style="position:absolute;left:${60 * s}px;top:0;width:${8 * s}px;height:${8 * s}px;"></div>
  <div style="position:absolute;left:${58 * s}px;top:${2 * s}px;width:${12 * s}px;height:${12 * s}px;border-radius:50%;background:#2EE6A6"></div>
  <div style="position:absolute;left:${62.5 * s}px;top:${12 * s}px;width:${3 * s}px;height:${14 * s}px;background:#2EE6A6"></div>
  <div style="position:absolute;left:${10 * s}px;top:${26 * s}px;width:${108 * s}px;height:${86 * s}px;border-radius:${30 * s}px;box-shadow:inset 0 0 0 ${4 * s}px #2EE6A6"></div>
  <div class="eye" style="position:absolute;left:${38 * s}px;top:${58 * s}px;width:${17 * s}px;height:${17 * s}px;border-radius:50%;background:#2EE6A6"></div>
  <div class="eye" style="position:absolute;left:${73 * s}px;top:${58 * s}px;width:${17 * s}px;height:${17 * s}px;border-radius:50%;background:#2EE6A6"></div>
  <div style="position:absolute;left:0;top:${56 * s}px;width:${8 * s}px;height:${24 * s}px;border-radius:${4 * s}px;background:#2EE6A6"></div>
  <div style="position:absolute;left:${120 * s}px;top:${56 * s}px;width:${8 * s}px;height:${24 * s}px;border-radius:${4 * s}px;background:#2EE6A6"></div></div>`;
const robot = item(ROBOT(1), '', 960, 418, 18.3, 21.85, {
  pop: 0.6,
  fn: (t, v, it) => {          // blink on the beat at 20.0
    const bl = Math.exp(-(((t - 20.0) / 0.05) ** 2));
    it.el.querySelectorAll('.eye').forEach((e) => { e.style.transform = `scaleY(${(1 - 0.9 * bl).toFixed(3)})`; });
  },
});
cue(18.3, 'pop', 0.6);
item('AI Coach', 'disp', 960, 556, 18.5, 21.85, { css: 'font-size:96px;' });
item('A place to practise before it counts.', '', 960, 640, 18.9, 21.85, { css: 'font-size:32px;color:#8C9792;' });

// ======================================================================
// SCENE 5 · 22–34 s · trusted knowledge → RAG, then the build
// ======================================================================
const NODE = [1250, 560];
sTo(22.0, { X: NODE[0], Y: NODE[1], W: 340, H: 210, R: 48, sw: 3 }, SP.morph);
cue(22.0, 'whoosh', 0.7);
camTo(22.0, 960, 540, 1.0, SP.cam);
item('Built on trusted knowledge.', 'disp', 960, 172, 22.3, 29.35, { css: 'font-size:64px;' });
item('RAG', 'disp', NODE[0], NODE[1] - 18, 22.35, 33.9, { css: 'font-size:84px;color:#2EE6A6;', dOut: 0.08 });
item('Retrieval-Augmented Generation', '', NODE[0], NODE[1] + 52, 22.45, 33.9, { css: 'font-size:19px;color:#8C9792;', dOut: 0.08 });
const docs = ['Account playbooks', 'JBP frameworks', 'Product & pricing', 'Category insights',
  'Negotiation guides', 'Execution standards', 'Best practices & cases', 'Policies & compliance'];
docs.forEach((d, i) => {
  const tin = 22.5 + i * 0.5, tf = 27.0 + i * 0.25, x0 = 330, y0 = 296 + i * 72;
  cue(tin, 'blip', 0.45, i % 5);
  cue(tf + 0.22, 'tick', 0.6, i);
  sBump(tf + 0.22, 0.035, 0.06);
  item(`<span class="doc"></span>${d}`, 'chip', x0, y0, tin, null, {
    a: 'l',
    fn: (t) => {
      const f = stepR(t - tf, { w: 13, z: 1 });
      const x = lerp(x0, NODE[0] - 120, f), y = lerp(y0, NODE[1], f);
      return { x, y, s: 1 - 0.7 * f, o: 1 - smooth((f - 0.55) / 0.35), b: f > 0.4 ? (f - 0.4) * 12 : null };
    },
  });
});
// the build: Retrieve · Ground · Cite
camTo(29.5, NODE[0], NODE[1] + 40, 1.22, SP.cam);
item('EVERY ANSWER GROUNDED IN APPROVED CONTENT', 'over', NODE[0], 385, 29.8, 33.7, { css: 'font-size:18px;' });
[['Retrieve', -230, 30.0], ['Ground', 0, 31.0], ['Cite', 200, 32.0]].forEach(([w, dx, ti], i) => {
  item(w, 'disp', NODE[0] + dx, 740, ti, 33.7, { css: 'font-size:44px;', pop: 1.25 });
  cue(ti, 'thump', 0.55); cue(ti, 'blip', 0.5, i + 2);
  sBump(ti, 0.05, 0.07);
  if (i < 2) item('·', 'disp', NODE[0] + (i ? 116 : -105), 740, ti + 0.5, 33.7, { css: 'font-size:44px;color:#2EE6A6;' });
});
for (let k = 0; k < 8; k++) sBump(33.0 + k * 0.125, 0.02 + 0.006 * k, 0.05);
camTo(32.9, NODE[0], NODE[1], 1.62, { w: 4.5, z: 1 });

// ======================================================================
// SCENE 6 · 34–41 s · DROP — the orchestrator and its five agents
// ======================================================================
sTo(34.0, { X: 960, Y: 540, W: 460, H: 176, R: 40, sw: 3 }, SP.snap);
camTo(34.0, 960, 540, 1.0, SP.camF);
sBump(34.0, 0.08, 0.09);
cue(34.0, 'impact', 1.0);
item('AI COACH', 'over', 960, 497, 34.12, 40.45, { css: 'color:#2EE6A6;font-size:20px;' });
item('Orchestrator', 'disp', 960, 545, 34.18, 40.45, { css: 'font-size:56px;' });
item('Plan · Coordinate · Adapt', '', 960, 598, 34.26, 40.45, { css: 'font-size:22px;color:#8C9792;' });
const RX = 560, RY = 330, PER = Math.PI * (3 * (RX + RY) - Math.sqrt((3 * RX + RY) * (RX + 3 * RY)));
const ring = mk(`<svg width="1920" height="1080" style="position:absolute;left:0;top:0;overflow:visible">
  <path d="M 960 ${540 - RY} A ${RX} ${RY} 0 0 1 960 ${540 + RY} A ${RX} ${RY} 0 0 1 960 ${540 - RY}" fill="none" stroke="#26322E" stroke-width="3"
    stroke-dasharray="${PER}" stroke-dashoffset="${PER}" /></svg>`, '');
world.insertBefore(ring, shapeEl);
const ringE = ring.querySelector('path');
const pulse = mk('', '', world, 'width:18px;height:18px;border-radius:50%;background:#2EE6A6;margin:-9px 0 0 -9px;');
const agents = [
  ['Assess', 'Find skill gaps', -90], ['Coach', 'Explain the skill', -18], ['Simulate', 'Role-play the customer', 54],
  ['Evaluate', 'Review against a rubric', 126], ['Next action', 'Plan the next practice', 198],
];
const angOf = (deg) => (deg * Math.PI) / 180;
const PULSE_T0 = 37.6, PULSE_D = 2.0;
const pulseAng = (t) => -90 + 360 * outC(clamp((t - PULSE_T0) / PULSE_D) ** 0.9 * 1.0);
agents.forEach(([n, sub, deg], i) => {
  const x = 960 + RX * Math.cos(angOf(deg)), y = 540 + RY * Math.sin(angOf(deg));
  const tin = 35.0 + i * 0.5;
  cue(tin, 'blip', 0.85, i); cue(tin, 'pop', 0.4);
  item(`<b>${n}</b><i>${sub}</i>`, 'node', x, y, tin, i === 2 ? 40.95 : 40.75, {
    pop: 0.55,
    fn: (t, v, it) => {
      const dA = ((pulseAng(t) - deg + 540) % 360) - 180;
      let a = Math.exp(-((dA / 14) ** 2));
      if (t < PULSE_T0) a = 0;
      if (t > 40.3 && i === 2) a = 1;
      const pressed = i === 2 ? 1 - 0.06 * bump(t - 40.5, 0.06) : 1;
      it.el.style.boxShadow = `inset 0 0 0 ${(2 + 1.5 * a).toFixed(2)}px ${rgba(mixC(K.line, K.mint, a))}`;
      return { s: pressed };
    },
  });
});
for (let k = 0; k < 5; k++) cue(PULSE_T0 + 0.3 + k * 0.33, 'tick', 0.55, k);
item('Five specialist agents. One coaching loop.', 'disp', 960, 985, 37.6, 40.6, { css: 'font-size:38px;' });
item('Human oversight · Approved content · Privacy · Access controls', 'foot', 960, 1040, 38.2, 40.6, { hud: true });

// the agent's own cursor
const coach = new Cursor('AI Coach', '#2EE6A6', '#04110C', '#2EE6A6', '#04110C');
coach.place(0, 990, 575).show(39.4).at(39.75, 1272, 830, SP.cur);
coach.click(40.5);
cue(39.4, 'pop', 0.6);
// shape slides under Simulate, then opens into the role-play window
sTo(40.5, { X: 960 + RX * Math.cos(angOf(54)), Y: 540 + RY * Math.sin(angOf(54)), W: 300, H: 104, R: 52 }, SP.snap);
camTo(40.3, 1120, 680, 1.12, SP.cam);
const WIN = { x: 960, y: 540, w: 1240, h: 760 };
sTo(40.85, { X: WIN.x, Y: WIN.y, W: WIN.w, H: WIN.h, R: 34, sw: 2 }, SP.morph);
S.stroke.to(40.85, K.line, SP.soft);
camTo(40.85, 960, 540, 1.0, SP.cam);
cue(40.85, 'whoosh', 0.8);

// ======================================================================
// SCENE 7 · 41–51 s · role-play: a new Sales KAM meets a chain buyer
// ======================================================================
const L0 = 400, R0 = 1520;
const TOUT7 = 50.9;
item('<span style="display:inline-block;width:12px;height:12px;border-radius:50%;background:#2EE6A6;margin-right:14px;transform:translateY(-3px)"></span>Role-play · New retail chain negotiation', 'disp', L0, 212, 41.25, TOUT7, { a: 'l', css: 'font-size:28px;' });
item('Simulation agent · Buyer is an AI persona', '', L0 + 26, 250, 41.35, TOUT7, { a: 'l', css: 'font-size:18px;color:#8C9792;' });
item('Grounded in Sales Playbook', 'pill', R0, 222, 41.45, TOUT7, { a: 'r', css: 'color:#2EE6A6;box-shadow:inset 0 0 0 1.5px #2EE6A6;' });
item('', '', 960, 285, 41.3, TOUT7, { css: 'width:1240px;height:1.5px;background:#26322E;' });

item('Buyer · AI persona', '', L0, 318, 41.45, TOUT7, { a: 'l', css: 'font-size:18px;color:#8C9792;' });
const buyerTxt = 'Your margin ask is too high. Why should we list you?';
const bw = buyerTxt.split(' ');
const buyer = item(bw.map((w) => `<span class="w">${w}&nbsp;</span>`).join(''), 'bub', L0, 336, 41.5, TOUT7, {
  a: 'tl', css: 'background:#141C1A;max-width:900px;',
  fn: (t, v, it) => {
    it.words.forEach((s, i) => { const e = vis(t, 41.6 + i * 0.125, null); s.style.opacity = e.o.toFixed(3); s.style.filter = e.b > 0.05 ? `blur(${e.b.toFixed(1)}px)` : 'none'; });
  },
});
buyer.words = [...buyer.el.querySelectorAll('.w')];
bw.forEach((_, i) => cue(41.6 + i * 0.125, 'key', 0.22, i));

// input bar → later "next action"
const INP = { y: 862 };
item('', '', 960, INP.y, 41.4, TOUT7, { css: 'width:1140px;height:72px;border-radius:36px;background:#0F1513;box-shadow:inset 0 0 0 1.5px #2A3632;' });
item('Type your reply…', '', L0 + 34, INP.y, 41.5, 43.62, { a: 'l', css: 'font-size:26px;color:#5D6864;', dOut: 0.05 });
const replyTxt = "Let's tie extra margin to sell-out growth.";
const T_TYPE = 43.7, DCH = 0.0625;
const typed = item('<span class="tx"></span><span class="caret" style="display:inline-block;width:2.5px;height:30px;background:#2EE6A6;margin-left:3px;transform:translateY(5px)"></span>', '', L0 + 34, INP.y, 43.6, 46.55, {
  a: 'l', css: 'font-size:26px;color:#F4F7F5;', dOut: 0.06,
  fn: (t, v, it) => {
    const n = clamp(Math.floor((t - T_TYPE) / DCH) + 1, 0, replyTxt.length);
    it.tx.textContent = replyTxt.slice(0, n);
    it.caret.style.opacity = (t - T_TYPE) % 0.5 < 0.3 || n < replyTxt.length ? 1 : 0;
  },
});
typed.tx = typed.el.querySelector('.tx'); typed.caret = typed.el.querySelector('.caret');
for (let i = 0; i < replyTxt.length; i++) if (replyTxt[i] !== ' ') cue(T_TYPE + i * DCH, 'key', 0.5, i);
item('<svg width="22" height="22" viewBox="0 0 22 22"><path d="M11 18 V4 M4.5 10.5 L11 4 L17.5 10.5" stroke="#04110C" stroke-width="2.8" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>', '', R0 - 30, INP.y, 41.6, TOUT7, {
  css: 'width:52px;height:52px;border-radius:26px;background:#2EE6A6;display:flex;align-items:center;justify-content:center;',
  fn: (t) => ({ s: 1 - 0.12 * bump(t - 46.5, 0.05) }),
});
you.place(42.0, 1500, 1100).show(42.6).at(42.6, L0 + 150, INP.y + 14, SP.cur).click(43.5)
  .at(44.0, 1180, 990, SP.soft).at(45.9, R0 - 26, INP.y + 8, SP.cur).click(46.5).at(47.0, 1620, 1120, SP.soft).show(47.4, 0, SP.soft);
cue(46.5, 'send', 0.8);
item('You · New Sales KAM', '', R0, 452, 46.55, TOUT7, { a: 'r', css: 'font-size:18px;color:#8C9792;' });
item(replyTxt, 'bub', R0, 470, 46.6, TOUT7, { a: 'tr', css: 'background:#0E2A20;box-shadow:inset 0 0 0 1.5px #1F6E50;', pop: 0.9 });

// coaching card (a secondary container that opens on a spring)
const CARD = { x: 960, y: 690, w: 1140, h: 238 };
const cardH = new Track(0).to(46.95, CARD.h, SP.morph);
item('', '', CARD.x, CARD.y, 46.95, TOUT7, {
  css: `width:${CARD.w}px;border-radius:26px;background:#0B1210;box-shadow:inset 0 0 0 2px #2EE6A6;`,
  fn: (t, v, it) => { it.el.style.height = Math.max(0, cardH.at(t)).toFixed(1) + 'px'; return { s: 1 + 0.03 * bump(t - 48.5, 0.07) }; },
});
cue(47.0, 'chime', 0.75, 1);
item('AI Coach', 'pill', L0 + 30, 614, 47.1, 48.35, { a: 'l', css: 'background:#2EE6A6;color:#04110C;' });
item('Strong value framing. Next: trade concessions, don’t gift them.', 'disp', L0 + 30, 680, 47.25, 48.35, { a: 'l', css: 'font-size:32px;font-weight:600;' });
item('↳ Cited: Negotiation guide · Sales playbook', '', L0 + 30, 742, 47.45, 48.35, { a: 'l', css: 'font-size:20px;color:#2EE6A6;' });
coach.at(41.1, L0 + 40, 420, SP.cur);
// the coach cursor rides the end of the buyer's streamed words
bw.forEach((_, i) => { if (i % 2 === 0) coach.at(41.6 + i * 0.125, L0 + 70 + i * 64, 395, SP.curF); });
coach.at(43.2, 1460, 400, SP.soft).at(46.75, 1420, 640, SP.cur).click(47.0, false);

// evaluation rubric (same card, content swaps with blur)
item('Evaluation', 'pill', L0 + 30, 614, 48.5, TOUT7, { a: 'l', css: 'background:#F4F7F5;color:#04110C;' });
[['Value framing', 4, 48.5], ['Objection handling', 3, 49.0], ['Closing the deal', 2, 49.5]].forEach(([lab, sc, ti], i) => {
  const y = 668 + i * 46;
  item(lab, '', L0 + 30, y, ti - 0.05, TOUT7, { a: 'l', css: 'font-size:25px;' });
  item('', '', 760, y, ti - 0.05, TOUT7, { a: 'l', css: 'width:560px;height:12px;border-radius:6px;background:#1E2926;' });
  const fw = new Track(0).to(ti, 560 * sc / 5, SP.morph);
  item('', '', 760, y, ti, TOUT7, { a: 'l', css: 'height:12px;border-radius:6px;background:#2EE6A6;', fn: (t, v, it) => { it.el.style.width = fw.at(t).toFixed(1) + 'px'; } });
  item(`${sc}/5`, 'disp', 1360, y, ti + 0.1, TOUT7, { a: 'l', css: 'font-size:26px;color:#2EE6A6;' });
  cue(ti, 'blip', 0.7, i + 1);
});
coach.at(48.4, 1120, 700, SP.cur).at(49.4, 1240, 760, SP.cur);
// next action replaces the input bar
item('', '', 960, INP.y, 50.0, TOUT7, { css: 'width:1140px;height:72px;border-radius:36px;background:#0E2A20;box-shadow:inset 0 0 0 2px #2EE6A6;', pop: 0.94 });
item('<b style="color:#2EE6A6;font-weight:700">Next practice →</b>&nbsp; Concession trading · 10 min tomorrow', '', 960, INP.y, 50.08, TOUT7, { css: 'font-size:27px;' });
coach.at(49.75, 1450, INP.y + 22, SP.cur).click(50.0, false).show(50.6, 0, SP.soft);
cue(50.0, 'chime', 0.8, 2);

// ======================================================================
// SCENE 8 · 51–55.5 s · one coach, three capability gaps (slams)
// ======================================================================
sTo(51.0, { X: 960, Y: 540, W: 820, H: 330, R: 40, sw: 3 }, SP.morph);
S.fill.to(51.0, K.panel, SP.soft); S.stroke.to(51.0, K.mint, SP.soft);
cue(51.0, 'whoosh', 0.7);
const cases = [
  ['USE CASE 01', 'New employee', 'From an ocean of unknowns to a guided swim', 51.5, 860, K.mint],
  ['USE CASE 02', 'New sales KAM', 'From fear of rejection to a confident close', 52.5, 940, K.cyan],
  ['USE CASE 03', 'New medical rep', 'HCP detailing with scientific confidence', 53.5, 900, K.white],
];
cases.forEach(([o, t1, t2, ti, w, col], i) => {
  const out = ti + 0.92;
  sTo(ti, { W: w }, SP.snap);
  S.stroke.to(ti, col, { w: 30, z: 1 });
  sBump(ti, 0.07, 0.07);
  cue(ti, 'thump', 1.0); cue(ti, 'blip', 0.5, i + 2);
  item(o, 'over', 960, 452, ti + 0.02, out, { css: `color:${rgba(col)};font-size:20px;`, dOut: 0.08 });
  item(t1, 'disp', 960, 528, ti, out, { css: 'font-size:76px;', pop: 1.18, dOut: 0.08 });
  item(t2, '', 960, 608, ti + 0.06, out, { css: 'font-size:29px;color:#8C9792;', dOut: 0.08 });
});
sTo(54.5, { W: 1080, H: 170, R: 85 }, SP.snap);
S.stroke.to(54.5, K.mint, SP.soft); sBump(54.5, 0.06, 0.07); cue(54.5, 'thump', 1.0);
item('One coach. Any capability gap.', 'disp', 960, 540, 54.55, 55.4, { css: 'font-size:60px;', pop: 1.15, dOut: 0.08 });
camTo(51.0, 960, 540, 1.0, SP.cam);

// ======================================================================
// SCENE 9 · 55.5–60 s · lockup
// ======================================================================
const LOCK = { y: 470, dot: 46, gap: 30 };
const word = item('AI Coach', 'disp', 0, LOCK.y, 56.0, null, { a: 'l', css: 'font-size:132px;', pop: 1.22 });
item('<span class="p">Trusted knowledge.</span> <span class="p">Guided practice.</span> <span class="p" style="color:#2EE6A6">Evidence of growth.</span>', '', 960, 600, 56.4, null, {
  css: 'font-size:36px;color:#C9D1CD;',
  fn: (t, v, it) => {
    it.el.querySelectorAll('.p').forEach((p, i) => {
      const e = vis(t, 56.5 + i * 0.5, null); p.style.opacity = e.o.toFixed(3);
      p.style.filter = e.b > 0.05 ? `blur(${e.b.toFixed(1)}px)` : 'none';
    });
  },
});
[56.5, 57.0, 57.5].forEach((ti, i) => cue(ti, 'blip', 0.55, i + 1));
item('Agentic AI × RAG for training &amp; capability upskilling', '', 960, 905, 58.0, null, { css: 'font-size:24px;color:#8C9792;' });
item('ANI Vietnam · Talent Innovator · Sponsor: Ha Tran', '', 960, 945, 58.25, null, { css: 'font-size:20px;color:#5D6864;' });
cue(55.5, 'whooshR', 0.7);
cue(56.0, 'impact', 0.9);
camTo(55.5, 960, 540, 1.0, SP.cam);
camTo(56.0, 960, 540, 1.06, { w: 1.1, z: 1 });

// ---------- build-time measurement, then the lockup geometry ----------
function measure() {
  world.style.transform = 'none';
  tabs.forEach((tb, i) => { tabHalf[i] = tb.el.offsetWidth / 2 + 48; });
  // tab indicator choreography (edges ride different springs)
  TL.set(13.0, BAR_L); TR.set(13.0, BAR_L + 260);
  tabTo(14.0, 0); tabTo(15.0, 1); tabTo(16.0, 2); tabTo(17.0, 1);
  S.useLR = [13.95, 18.0];
  S.X.set(13.97, 960); S.W.set(13.97, 2 * tabHalf[1]);   // hand-off from the L/R edges back to X/W
  const ww = word.el.offsetWidth, total = LOCK.dot + LOCK.gap + ww, left = 960 - total / 2;
  word.x = left + LOCK.dot + LOCK.gap;
  sTo(55.5, { X: left + LOCK.dot / 2, Y: LOCK.y + 4, W: LOCK.dot, H: LOCK.dot, R: LOCK.dot / 2, sw: 0 }, SP.morph);
  S.fill.to(55.5, K.mint, SP.soft); S.stroke.to(55.5, K.mint0, SP.soft);
  sBump(56.0, -0.12, 0.06);
  M.cues.sort((a, b) => a.t - b.t);
}

// ---------- frame ----------
function drawShape(t) {
  let X = S.X.at(t), W = S.W.at(t);
  if (S.useLR && t >= S.useLR[0] && t < S.useLR[1]) { const l = TL.at(t), r = TR.at(t); X = (l + r) / 2; W = r - l; }
  const Hh = S.H.at(t), R = Math.max(0, Math.min(S.R.at(t), Math.min(W, Hh) / 2));
  let sc = 1; for (const [tb, a, d] of S.bumps) sc += a * bump(t - tb, d);
  const st = shapeEl.style;
  st.width = Math.max(0, W).toFixed(2) + 'px'; st.height = Math.max(0, Hh).toFixed(2) + 'px';
  st.transform = `translate(${(X - W / 2).toFixed(2)}px,${(S.Y.at(t) - Hh / 2).toFixed(2)}px) scale(${sc.toFixed(4)})`;
  st.transformOrigin = '50% 50%';
  st.borderRadius = R.toFixed(2) + 'px';
  st.background = S.fill.at(t);
  const sw = S.sw.at(t);
  st.boxShadow = sw > 0.05 ? `inset 0 0 0 ${sw.toFixed(2)}px ${S.stroke.at(t)}` : 'none';
  return { X, W };
}
function drawTabs(t) {
  if (t < 13.8 || t > 18.1) return;
  const l = TL.at(t), r = TR.at(t);
  tabs.forEach((tb) => {
    const k = clamp(Math.min(tb.x - l, r - tb.x) / 50);
    tb.el.style.color = rgba(mixC(K.white, K.ink, k));
  });
}
function seek(t) {
  const c = cam(t);
  world.style.transform = `translate(960px,540px) scale(${c.z.toFixed(5)}) translate(${(-c.cx).toFixed(2)}px,${(-c.cy).toFixed(2)}px)`;
  drawShape(t);
  for (const it of items) drawItem(it, t);
  drawTabs(t);
  // ring + travelling pulse
  const dr = outC((t - 34.0) / 0.95), ro = 1 - smooth((t - 40.55) / 0.35);
  ringE.setAttribute('stroke-dashoffset', (PER * (1 - dr)).toFixed(1));
  ring.style.opacity = t < 34 ? 0 : ro.toFixed(3);
  const pa = angOf(pulseAng(t)), pOn = t > PULSE_T0 - 0.05 && t < PULSE_T0 + PULSE_D + 0.25;
  pulse.style.display = pOn ? '' : 'none';
  if (pOn) {
    const po = smooth((t - PULSE_T0 + 0.05) / 0.15) * (1 - smooth((t - PULSE_T0 - PULSE_D) / 0.25));
    pulse.style.opacity = po.toFixed(3);
    pulse.style.transform = `translate(${(960 + RX * Math.cos(pa)).toFixed(2)}px,${(540 + RY * Math.sin(pa)).toFixed(2)}px)`;
  }
  you.draw(t); coach.draw(t);
}
M.seek = seek;

(async () => {
  await document.fonts.load('700 60px "Inter Display"'); await document.fonts.load('400 30px Inter');
  await document.fonts.load('600 30px Inter'); await document.fonts.ready;
  measure(); seek(0); M.ready = true;
})();
