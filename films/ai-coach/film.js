'use strict';
// AI Coach — launch film. Every pixel is a pure function of t inside seek(t).
// 120 BPM: one beat = 0.5 s, one bar = 2 s. The drop lands at 16.0 s on "AI COACH".

// ---------------------------------------------------------------- math
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const lerp = (a, b, k) => a + (b - a) * k;
const outQ = k => 1 - Math.pow(1 - clamp(k), 4);
function stepR(tau, { w, z }) {
  if (tau <= 0) return 0;
  if (z >= 1) { const x = w * tau; return 1 - Math.exp(-x) * (1 + x); }
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
class Track {
  constructor(v0) { this.v0 = v0; this.cur = v0; this.ev = []; }
  to(t, v, sp) { if (v !== this.cur) { this.ev.push([t, v - this.cur, sp]); this.cur = v; } return this; }
  at(t) { let v = this.v0; for (const [ti, d, sp] of this.ev) v += d * stepR(t - ti, sp); return v; }
}
const SP = {
  shape: { w: 14, z: 0.82 }, cam: { w: 6.5, z: 1 }, ui: { w: 22, z: 0.8 }, pop: { w: 26, z: 0.62 },
  soft: { w: 12, z: 1 }, cur: { w: 12.5, z: 0.93 }, lead: { w: 34, z: 0.9 }, trail: { w: 17, z: 0.9 },
};
function vis(t, tin, tout, dOut = 0.14) {
  if (t < tin) return { o: 0, b: 10, dy: 16, e: 0 };
  const e = stepR(t - tin, { w: 24, z: 1 }), x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
  return { o: e * (1 - xo), b: (1 - e) * 10 + xo * 10, dy: (1 - e) * 16 - xo * 10, e };
}
const rgb = hex => [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16));
const mixc = (a, b, k) => a.map((v, i) => Math.round(lerp(v, b[i], k)));
class CTrack {
  constructor(hex, a = 1) { const [r, g, b] = rgb(hex); this.c = [new Track(r), new Track(g), new Track(b), new Track(a)]; }
  to(t, hex, a, sp) { [...rgb(hex), a].forEach((v, i) => this.c[i].to(t, v, sp)); return this; }
  css(t) { const [r, g, b, a] = this.c.map(c => c.at(t)); return `rgba(${clamp(r, 0, 255) | 0},${clamp(g, 0, 255) | 0},${clamp(b, 0, 255) | 0},${clamp(a).toFixed(3)})`; }
}
const C = { mint: '#2EE6A0', red: '#FF4D57', ink: '#F4F7F5', mute: '#8C9792', card: '#0A0F0D' };
const INK = rgb(C.ink), DARK = [3, 19, 12], MINT = rgb(C.mint);

// ---------------------------------------------------------------- dom helpers
const $ = s => document.querySelector(s);
const world = $('#world'), hud = $('#hud'), shapeEl = $('#shape'), bgEl = $('#bg'), fadeEl = $('#fade');
function h(html, parent = world) { const d = document.createElement('div'); d.innerHTML = html.trim(); const e = d.firstElementChild; parent.appendChild(e); return e; }
function group(cx, cy, w, ht, html) { return h(`<div class="g" style="left:${cx - w / 2}px;top:${cy - ht / 2}px;width:${w}px;height:${ht}px">${html}</div>`); }
function hide(el) { if (el._h !== 1) { el.style.visibility = 'hidden'; el._h = 1; } }
function show(el) { if (el._h !== 0) { el.style.visibility = 'visible'; el._h = 0; } }
function fx(el, v, s = 1, x = 0) {
  const o = clamp(v.o);
  if (o < 0.003) return hide(el);
  show(el);
  el.style.opacity = o.toFixed(4);
  el.style.filter = v.b > 0.08 ? `blur(${v.b.toFixed(2)}px)` : 'none';
  el.style.transform = `translate(${x.toFixed(2)}px,${v.dy.toFixed(2)}px) scale(${s.toFixed(4)})`;
}
function gate(g, t, t0, t1) {           // group lives in [t0, t1] and exits short, with blur
  if (t < t0 - 0.001 || t > t1 + 0.15) { if (g._d !== 0) { g.style.display = 'none'; g._d = 0; } return false; }
  const x = clamp((t - t1) / 0.14), xo = x * x;
  if (g._d !== 1) { g.style.display = 'block'; g._d = 1; } g.style.opacity = (1 - xo).toFixed(4); g.style.filter = xo > 0.01 ? `blur(${(xo * 10).toFixed(2)}px)` : 'none';
  return true;
}
function cen(el) {                       // world-space centre of an element at rest (transforms ignored)
  let x = el.offsetWidth / 2, y = el.offsetHeight / 2, e = el;
  while (e && e !== world) { x += e.offsetLeft; y += e.offsetTop; e = e.offsetParent; }
  return [x, y];
}
function setHTML(el, s) { if (el._s !== s) { el.innerHTML = s; el._s = s; } }
const words = s => s.split(' ').map((w, i, a) => `<span>${w}${i < a.length - 1 ? ' ' : ''}</span>`).join('');
const ring = (d, col, sw = 4) => `<svg width="${d}" height="${d}" style="position:absolute;left:0;top:0;overflow:visible"><circle cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 6}" fill="none" stroke="#1E2723" stroke-width="${sw}"/><circle class="rg" cx="${d / 2}" cy="${d / 2}" r="${d / 2 - 6}" fill="none" stroke="${col}" stroke-width="${sw}" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1" stroke-linecap="round" transform="rotate(-90 ${d / 2} ${d / 2})"/></svg>`;
const draw = (el, k) => el.setAttribute('stroke-dashoffset', (1 - clamp(k)).toFixed(4));

// Odometer: per-digit strips, a digit only moves while the one below carries.
function odo(el, digits, suffix = '') {
  const fs = parseFloat(el.style.fontSize), lh = Math.round(fs * 1.1);
  const probe = document.createElement('span'); probe.textContent = '0'; el.appendChild(probe);
  const dw = probe.getBoundingClientRect().width; probe.remove();
  const slots = [];
  for (let p = digits - 1; p >= 0; p--) {
    const s = document.createElement('span');
    s.style.cssText = `display:inline-block;position:relative;width:${dw}px;height:${lh}px;clip-path:inset(0 -80px);vertical-align:top`;
    const strip = document.createElement('span');
    strip.style.cssText = 'position:absolute;left:0;top:0;display:block';
    strip.innerHTML = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 0].map(d => `<span style="display:block;height:${lh}px;line-height:${lh}px">${d}</span>`).join('');
    s.appendChild(strip); el.appendChild(s); slots.push({ p, s, strip });
  }
  if (suffix) { const sf = document.createElement('span'); sf.textContent = suffix; sf.style.cssText = `display:inline-block;height:${lh}px;line-height:${lh}px;vertical-align:top`; el.appendChild(sf); }
  return v => {
    for (const { p, s, strip } of slots) {
      const P = 10 ** p, d = Math.floor(v / P) % 10 + Math.max(0, (v % P) - (P - 1));
      strip.style.transform = `translateY(${(-d * lh).toFixed(2)}px)`;
      if (p > 0) { const k = clamp((v - P * 0.8) / (P * 0.25)); s.style.width = (dw * k).toFixed(2) + 'px'; strip.style.opacity = k.toFixed(3); }
    }
  };
}

// ---------------------------------------------------------------- state
const CUES = []; const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(4), type, ...o });
const DRAW = [];
const SH = { x: new Track(960), y: new Track(540), w: new Track(0), h: new Track(0), r: new Track(14), fill: new CTrack(C.mint, 1), stroke: new CTrack(C.mint, 0) };
function morph(t, o, sp = SP.shape) {
  for (const k of ['x', 'y', 'w', 'h', 'r']) if (o[k] != null) SH[k].to(t, o[k], sp);
  if (o.fill) SH.fill.to(t, o.fill[0], o.fill[1], sp);
  if (o.stroke) SH.stroke.to(t, o.stroke[0], o.stroke[1], sp);
}
const CAM = { x: new Track(960), y: new Track(540), lz: new Track(Math.log(2.3)) };
function cam(t, x, y, z, sp = SP.cam) { CAM.x.to(t, x, sp); CAM.y.to(t, y, sp); CAM.lz.to(t, Math.log(z), sp); }
const BGR = new Track(0);              // background tint 0 = mint, 1 = red

// ---------------------------------------------------------------- cursors
function makeCursor(kind) {
  const you = kind === 'you', col = you ? '#FFFFFF' : C.mint;
  const el = h(`<div class="cur"><svg width="30" height="34" viewBox="0 0 30 34" style="position:absolute;left:-2px;top:-2px"><path d="M2 2 L2 27 L8.5 21 L13 31.5 L17.5 29.5 L13 19.5 L22 19.5 Z" fill="${col}" stroke="#03130C" stroke-width="1.8" stroke-linejoin="round"/></svg><div class="tag" style="background:${col};color:#03130C">${you ? 'You' : 'AI Coach'}</div></div>`, hud);
  const rip = h(`<div class="rip" style="border-color:${col}"></div>`, hud);
  return { el, rip, tag: el.querySelector('.tag'), X: null, Y: null, clicks: [], wins: [], birth: null };
}
const YOU = makeCursor('you'), COACH = makeCursor('coach');
function go(c, t, [x, y], sp = SP.cur) { if (!c.X) { c.X = new Track(x); c.Y = new Track(y); } else { c.X.to(t, x, sp); c.Y.to(t, y, sp); } }
function click(c, t, sound = 'click') { c.clicks.push(t); cue(t, sound); }
function drawCursor(c, t, cm) {
  let o = 0; for (const [a, b] of c.wins) o = Math.max(o, vis(t, a, b, 0.18).o);
  if (o < 0.003 || !c.X) { hide(c.el); hide(c.rip); return; }
  show(c.el);
  const sx = (c.X.at(t) - cm.x) * cm.z + 960, sy = (c.Y.at(t) - cm.y) * cm.z + 540;
  const dt = 1 / 120, vx = (c.X.at(t) - c.X.at(t - dt)) / dt * cm.z;
  const lean = clamp(-vx * 0.0045, -14, 14);
  let press = 1; for (const tc of c.clicks) press -= 0.16 * Math.exp(-(((t - tc) / 0.045) ** 2));
  const born = c.birth != null ? stepR(t - c.birth, { w: 22, z: 0.7 }) : 1;
  c.el.style.opacity = o.toFixed(3);
  c.el.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px) rotate(${lean.toFixed(2)}deg) scale(${(1.3 * press * born).toFixed(4)})`;
  c.tag.style.transform = `translateX(${clamp(-vx * 0.012, -24, 24).toFixed(2)}px)`;
  let tc = null; for (const c0 of c.clicks) if (t >= c0 && t - c0 < 0.45) tc = c0;
  if (tc == null) return hide(c.rip);
  const k = (t - tc) / 0.45; show(c.rip);
  c.rip.style.opacity = ((1 - k) * 0.85 * o).toFixed(3);
  c.rip.style.transform = `translate(${sx}px,${sy}px) scale(${(0.25 + 1.3 * outQ(k)).toFixed(3)})`;
}

// ---------------------------------------------------------------- HUD text (sources, captions)
function hudLine(id, list, cls) {
  for (const [a, b, html] of list) {
    const el = h(`<div ${cls}>${html}</div>`, hud);
    DRAW.push(t => fx(el, vis(t, a, b, 0.16)));
  }
}

// ================================================================ BUILD
function build() {
  // ------------------------------------------------ S1 · 0.0–3.0 · the dot becomes "81%"
  morph(0.0, { w: 28, h: 28, r: 14 }, { w: 30, z: 0.7 }); cue(0.0, 'pop', { p: 0 });
  morph(0.5, { w: 1080, h: 400, r: 44, fill: [C.card, 1], stroke: [C.mint, 0.35] }); cue(0.5, 'whoosh');
  cam(0.45, 960, 540, 1.42);
  const g1 = group(960, 540, 1080, 400, `
    <div class="k" style="left:72px;top:62px">AI is already a daily habit</div>
    <div class="abs num" id="o1" style="left:62px;top:96px;font-size:190px;color:var(--mint)"></div>
    <div class="abs" id="c1" style="left:72px;top:306px;width:540px;font-size:27px;line-height:1.3;color:#C9D2CE">of Vietnamese AI users interact with AI tools every day</div>
    <div class="abs" id="mx" style="left:676px;top:56px;width:300px;height:300px"></div>`);
  const o1 = odo(g1.querySelector('#o1'), 2, '%');
  const mx = g1.querySelector('#mx'), dots = [];
  for (let i = 0; i < 100; i++) dots.push(h(`<div class="abs" style="left:${(i % 10) * 30}px;top:${Math.floor(i / 10) * 30}px;width:14px;height:14px;border-radius:7px;background:#25302B"></div>`, mx));
  const [k1, n1, c1] = ['.k', '#o1', '#c1'].map(s => g1.querySelector(s));
  for (let i = 0; i < 8; i++) cue(0.9 + i * 0.125, 'tick', { p: i });
  DRAW.push(t => {
    if (!gate(g1, t, 0.5, 2.85)) return;
    fx(k1, vis(t, 0.72)); fx(n1, vis(t, 0.8)); fx(c1, vis(t, 1.25));
    o1(81 * outQ((t - 0.9) / 1.0));
    const fill = 81 * outQ((t - 1.0) / 1.05);
    dots.forEach((d, i) => {
      const r = Math.floor(i / 10), e = stepR(t - 0.66 - r * 0.03, SP.ui), on = clamp(fill - i);
      d.style.opacity = e.toFixed(3); d.style.transform = `scale(${(0.4 + 0.6 * e + 0.25 * on * Math.exp(-(((fill - i) / 1.5) ** 2))).toFixed(3)})`;
      d.style.background = `rgb(${mixc([37, 48, 43], MINT, on).join(',')})`;
    });
  });

  // ------------------------------------------------ S2 · 3.0–6.0 · Vietnam 39% vs Global 16%
  morph(3.0, { w: 1160, h: 420 }); cue(3.0, 'whoosh'); cam(3.0, 960, 540, 1.36);
  const g2 = group(960, 540, 1160, 420, `
    <div class="k" style="left:72px;top:58px">Zoom into the professionals</div>
    <div class="abs t" style="left:72px;top:92px;font-size:36px">Share of knowledge workers who are “Frontier Professionals”</div>
    <div class="abs t" id="l1" style="left:72px;top:212px;font-size:24px;letter-spacing:.06em">VIETNAM</div>
    <div class="abs" id="tr1" style="left:262px;top:198px;width:640px;height:56px;border-radius:28px;background:#151D1A"><div id="f1" style="height:56px;border-radius:28px;background:var(--mint);width:0"></div></div>
    <div class="abs num" id="v1" style="left:930px;top:190px;font-size:60px;color:var(--mint)"></div>
    <div class="abs t" id="l2" style="left:72px;top:316px;font-size:24px;letter-spacing:.06em;color:var(--mute)">GLOBAL</div>
    <div class="abs" id="tr2" style="left:262px;top:302px;width:640px;height:56px;border-radius:28px;background:#151D1A"><div id="f2" style="height:56px;border-radius:28px;background:#9AA5A0;width:0"></div></div>
    <div class="abs num" id="v2" style="left:930px;top:294px;font-size:60px;color:#B9C2BE"></div>
    <div class="abs" id="tip" style="left:${262 + 555}px;top:146px"><div class="chip fill" style="transform:translate(-50%,-50%);position:absolute;left:0;top:0">2.4× the global share</div></div>`);
  const q2 = s => g2.querySelector(s);
  const [k2, t2, l1, tr1, f1, v1el, l2, tr2, f2, v2el, tip] = ['.k', '.t', '#l1', '#tr1', '#f1', '#v1', '#l2', '#tr2', '#f2', '#v2', '#tip'].map(q2);
  const v1 = odo(v1el, 2, '%'), v2 = odo(v2el, 2, '%');
  const W1 = 640 * 39 / 45, W2 = 640 * 16 / 45;      // bars on a 0–45% scale: proportions stay true
  cue(3.5, 'bar', { p: 4 }); cue(4.0, 'bar', { p: 1 }); cue(4.75, 'pop', { p: 4 });
  YOU.wins.push([4.1, 5.85]);
  const barEnd = [380 + 262 + W1 - 30, 330 + 226];
  go(YOU, 0, [1560, 900]); go(YOU, 4.15, barEnd); go(YOU, 5.3, [barEnd[0] + 40, barEnd[1] + 30]);
  DRAW.push(t => {
    if (!gate(g2, t, 3.0, 5.85)) return;
    fx(k2, vis(t, 3.08)); fx(t2, vis(t, 3.18));
    fx(l1, vis(t, 3.32)); fx(tr1, vis(t, 3.32)); fx(v1el, vis(t, 3.5));
    fx(l2, vis(t, 3.6)); fx(tr2, vis(t, 3.6)); fx(v2el, vis(t, 4.0));
    f1.style.width = (W1 * stepR(t - 3.5, { w: 15, z: 0.85 })).toFixed(1) + 'px';
    f2.style.width = (W2 * stepR(t - 4.0, { w: 15, z: 0.85 })).toFixed(1) + 'px';
    v1(39 * outQ((t - 3.5) / 0.7)); v2(16 * outQ((t - 4.0) / 0.6));
    const tv = vis(t, 4.75); fx(tip, tv, 0.85 + 0.15 * stepR(t - 4.75, SP.pop));
  });

  // ------------------------------------------------ S3 · 6.0–8.5 · the pain point (red)
  morph(6.0, { w: 1160, h: 500, stroke: [C.red, 0.6] }); cue(6.0, 'low'); cam(6.0, 960, 540, 1.34);
  BGR.to(6.0, 1, SP.soft); BGR.to(8.5, 0, SP.soft);
  const g3 = group(960, 540, 1160, 500, `
    <div class="k" style="left:72px;top:56px;color:var(--red)">The pain point</div>
    <div class="abs t" id="ln" style="left:72px;top:90px;font-size:32px;font-weight:600">People learn to appear capable before they become capable.</div>
    <div class="abs" id="rL" style="left:${330 - 110}px;top:160px;width:220px;height:220px">${ring(220, C.red)}<div class="num" id="nL" style="position:absolute;left:0;right:0;top:72px;text-align:center;font-size:66px;color:var(--red)"></div></div>
    <div class="abs" id="cL" style="left:130px;top:396px;width:400px;text-align:center;font-size:23px;line-height:1.3;color:#C9D2CE">exaggerated their AI use or expertise</div>
    <svg class="abs" id="ar" style="left:470px;top:255px;overflow:visible" width="220" height="30"><path class="rg" d="M0 15 H210 M196 4 L210 15 L196 26" fill="none" stroke="${C.mint}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
    <div class="abs" id="rR" style="left:${830 - 110}px;top:160px;width:220px;height:220px">${ring(220, '#FFFFFF')}<div class="num" id="nR" style="position:absolute;left:0;right:0;top:72px;text-align:center;font-size:66px"></div></div>
    <div class="abs" id="cR" style="left:630px;top:396px;width:400px;text-align:center;font-size:23px;line-height:1.3;color:#C9D2CE">felt pressure to use AI without confidence</div>`);
  const q3 = s => g3.querySelector(s);
  const [k3, ln, rL, rR, cL, cR, ar] = ['.k', '#ln', '#rL', '#rR', '#cL', '#cR', '#ar'].map(q3);
  const nLel = q3('#nL'), nRel = q3('#nR'); nLel.style.fontSize = '66px'; nRel.style.fontSize = '66px';
  // centre the odometer rows inside the rings
  nLel.style.display = nRel.style.display = 'flex'; nLel.style.justifyContent = nRel.style.justifyContent = 'center';
  const nL = odo(nLel, 2, '%'), nR = odo(nRel, 2, '%');
  const rgL = rL.querySelector('.rg'), rgR = rR.querySelector('.rg'), arP = ar.querySelector('.rg');
  cue(6.5, 'tick', { p: 2 }); cue(7.0, 'thump'); cue(7.5, 'tick', { p: 1 });
  DRAW.push(t => {
    if (!gate(g3, t, 6.0, 8.35)) return;
    fx(k3, vis(t, 6.05)); fx(ln, vis(t, 6.15));
    fx(rL, vis(t, 6.25)); draw(rgL, 0.48 * outQ((t - 6.3) / 0.75)); nL(48 * outQ((t - 6.3) / 0.75)); fx(cL, vis(t, 6.6));
    draw(arP, stepR(t - 6.95, { w: 16, z: 1 })); show(ar);
    fx(rR, vis(t, 7.0)); draw(rgR, 0.45 * outQ((t - 7.05) / 0.7)); nR(45 * outQ((t - 7.05) / 0.7)); fx(cR, vis(t, 7.3));
  });

  // ------------------------------------------------ S4 · 8.5–10.0 · the headline
  morph(8.5, { w: 1400, h: 170, r: 85, stroke: ['#FFFFFF', 0.16] }); cue(8.5, 'whoosh'); cam(8.5, 960, 540, 1.26);
  const hw = [['AI', 'ink'], ['adoption', 'ink'], ['is', 'mute'], ['moving', 'mute'], ['faster', 'mute'], ['than', 'mute'], ['capability.', 'mint']];
  const g4 = group(960, 540, 1400, 170, `<div class="abs hl t" style="left:0;right:0;top:0;height:170px;display:flex;align-items:center;justify-content:center;font-size:56px">${hw.map(([w, c]) => `<span style="color:var(--${c});margin:0 9px">${w}</span>`).join('')}</div>`);
  const hws = [...g4.querySelectorAll('span')];
  hws.forEach((_, i) => cue(8.6 + i * 0.125, 'key', { p: i }));
  DRAW.push(t => { if (!gate(g4, t, 8.5, 9.85)) return; hws.forEach((s, i) => fx(s, vis(t, 8.6 + i * 0.125))); });

  // ------------------------------------------------ S5 · 10.0–12.25 · Train → Practice → Upskill
  morph(10.0, { w: 960, h: 116, r: 58, stroke: ['#FFFFFF', 0.14] }); cue(10.0, 'whoosh'); cam(10.0, 960, 520, 1.62);
  const SEG = { l: 480, t: 482 };
  const g5 = group(960, 540, 960, 116, `
    <div class="k" style="left:0;right:0;top:-74px;text-align:center;color:var(--mute)">What they need</div>
    ${['Train', 'Practice', 'Upskill'].map((s, i) => `<div class="abs t lab" style="left:${24 + 304 * i}px;top:0;width:304px;height:116px;line-height:116px;text-align:center;font-size:34px">${s}</div>`).join('')}`);
  const ind = h(`<div class="abs" style="background:var(--mint)"></div>`);
  world.insertBefore(ind, g5);                       // indicator sits under the labels
  const labs = [...g5.querySelectorAll('.lab')], k5 = g5.querySelector('.k');
  const IL = new Track(SEG.l + 176), IR = new Track(SEG.l + 176), IY = new Track(SEG.t + 16), IH = new Track(84);
  const tabL = i => SEG.l + 24 + 304 * i, tabR = i => tabL(i) + 304;
  IL.to(10.5, tabL(0), SP.pop); IR.to(10.5, tabR(0), SP.pop);
  IL.to(11.0, tabL(1), SP.trail); IR.to(11.0, tabR(1), SP.lead);
  IL.to(11.5, tabL(2), SP.trail); IR.to(11.5, tabR(2), SP.lead);
  // the Upskill indicator grows into the chat input
  IL.to(12.25, 370 + 10, SP.shape); IR.to(12.25, 1550 - 10, SP.shape); IY.to(12.25, 480 + 10, SP.shape); IH.to(12.25, 100, SP.shape);
  YOU.wins.push([10.05, 18.4]);
  const labC = i => [SEG.l + 24 + 304 * i + 152 - 20, SEG.t + 72];
  go(YOU, 9.9, [1380, 820]); go(YOU, 10.12, labC(0)); click(YOU, 10.5);
  go(YOU, 10.68, labC(1)); click(YOU, 11.0); go(YOU, 11.18, labC(2)); click(YOU, 11.5);
  cue(10.5, 'note', { p: 0 }); cue(11.0, 'note', { p: 2 }); cue(11.5, 'note', { p: 4 });
  cue(11.0, 'swish'); cue(11.5, 'swish');
  DRAW.push(t => {
    const e = stepR(t - 10.5, SP.pop), fade = 1 - clamp((t - 12.42) / 0.22);
    if (t < 10.45 || fade <= 0) hide(ind); else {
      show(ind);
      const L = IL.at(t), R = IR.at(t), cx = (L + R) / 2, w = Math.max(0, R - L) * Math.min(1, e * 1.4), hh = IH.at(t);
      Object.assign(ind.style, { left: (cx - w / 2).toFixed(2) + 'px', top: IY.at(t).toFixed(2) + 'px', width: w.toFixed(2) + 'px', height: hh.toFixed(2) + 'px', borderRadius: (hh / 2).toFixed(1) + 'px', opacity: fade.toFixed(3) });
    }
    if (!gate(g5, t, 10.0, 12.3)) return;
    fx(k5, vis(t, 10.1));
    const L = IL.at(t), R = IR.at(t);
    labs.forEach((lb, i) => {
      fx(lb, vis(t, 10.15 + i * 0.07));
      const cov = t < 10.45 ? 0 : clamp((Math.min(R, tabR(i)) - Math.max(L, tabL(i))) / 304);
      lb.style.color = `rgb(${mixc(INK, DARK, cov).join(',')})`;
    });
  });

  // ------------------------------------------------ S6 · 12.25–16.0 · the KAM asks the coach
  morph(12.25, { w: 1180, h: 120, r: 60, stroke: ['#FFFFFF', 0.16] }); cam(12.25, 960, 540, 1.48);
  morph(12.6, { stroke: [C.mint, 0.65] }, SP.ui);
  const TYPED = 'New KAM. Chain negotiation on Friday.';
  const g6 = group(960, 540, 1180, 120, `
    <div class="abs" style="left:44px;top:49px;width:22px;height:22px;border-radius:11px;background:var(--mint)" id="ico"></div>
    <div class="abs m" id="ph" style="left:92px;top:0;line-height:120px;font-size:34px">Ask your AI Coach…</div>
    <div class="abs" id="ty" style="left:92px;top:0;line-height:120px;font-size:34px;font-weight:500;white-space:pre"></div>
    <div class="abs" id="send" style="left:1082px;top:22px;width:76px;height:76px;border-radius:38px;background:var(--mint)">
      <svg width="76" height="76" viewBox="0 0 76 76"><path d="M38 52 V25 M27 35 L38 24 L49 35" stroke="#03130C" stroke-width="4" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`);
  const [ico, ph, ty, send] = ['#ico', '#ph', '#ty', '#send'].map(s => g6.querySelector(s));
  const T0 = 12.75, DT = 0.0625;
  for (let i = 0; i < TYPED.length; i++) cue(T0 + i * DT, 'key', { p: i % 5, soft: TYPED[i] === ' ' ? 1 : 0 });
  go(YOU, 12.3, [640, 556]); click(YOU, 12.6); go(YOU, 12.8, [760, 650]);
  go(YOU, 15.1, [1120 + 370 - 6, 548]); click(YOU, 15.5); cue(15.56, 'send');
  DRAW.push(t => {
    if (!gate(g6, t, 12.3, 15.92)) return;
    fx(ico, vis(t, 12.38), 1 + 0.25 * Math.exp(-(((t - 12.6) / 0.08) ** 2)));
    fx(ph, vis(t, 12.38, 12.66, 0.1));
    const n = clamp(Math.floor((t - T0) / DT) + 1, 0, TYPED.length);
    const caret = (t > 12.62 && t < 15.5) && (n < TYPED.length || (t * 2) % 1 < 0.55);
    setHTML(ty, TYPED.slice(0, n).replace(/&/g, '&amp;') + `<span style="display:inline-block;width:3px;height:40px;margin-left:3px;vertical-align:-6px;background:var(--mint);opacity:${caret ? 1 : 0}"></span>`);
    fx(ty, { o: t > 12.62 ? 1 : 0, b: 0, dy: 0 });
    const sv = vis(t, 12.4), ready = stepR(t - 15.06, SP.pop);
    fx(send, sv, (0.82 + 0.18 * ready) * (1 - 0.12 * Math.exp(-(((t - 15.5) / 0.05) ** 2))));
    send.style.background = `rgb(${mixc([42, 54, 49], MINT, ready).join(',')})`;
  });

  // ------------------------------------------------ S7 · 16.0–20.0 · DROP · AI COACH + the 7-step loop
  morph(16.0, { w: 1560, h: 600, r: 40, stroke: [C.mint, 0.35] }, { w: 13, z: 0.78 }); cam(15.98, 960, 540, 1.16, { w: 8, z: 1 });
  cue(16.0, 'impact');
  const STEPS = [['Goal', 'What must improve?'], ['RAG', 'Retrieve approved context'], ['Plan', 'Choose the learning strategy'], ['Act', 'Teach · role-play · quiz'], ['Verify', 'Check grounding + policy'], ['Evaluate', 'Rubric + gap'], ['Adapt', 'Select the next action']];
  const g7 = group(960, 540, 1560, 600, `
    <div class="abs t" id="ttl" style="left:0;right:0;top:44px;text-align:center;font-size:120px;font-weight:800;letter-spacing:-.035em;line-height:1">AI <span style="color:var(--mint)">COACH</span></div>
    <div class="abs m" id="sub" style="left:0;right:0;top:184px;text-align:center;font-size:30px">Built from your real capability gap.</div>
    ${STEPS.map(([a, b], i) => `<div class="pill" style="left:${58 + 208 * i}px;top:286px"><div class="n">${i + 1}</div><div class="ti">${a.toUpperCase()}</div><div class="de">${b}</div></div>`).join('')}`);
  const ttl = g7.querySelector('#ttl'), sub = g7.querySelector('#sub'), pills = [...g7.querySelectorAll('.pill')];
  pills.forEach((_, i) => cue(16.5 + i * 0.25, 'pop', { p: i }));
  for (let i = 0; i < 7; i++) cue(18.25 + i * 0.125, 'tick', { p: i + 3 });
  COACH.wins.push([18.5, 37.15]); COACH.birth = 18.5; cue(18.5, 'chime');
  const ragC = cen(pills[1]);
  go(COACH, 0, [1120 + 370 - 6, 560]); go(COACH, 18.75, [ragC[0] + 40, ragC[1] + 92]); click(COACH, 19.5);
  DRAW.push(t => {
    if (!gate(g7, t, 16.0, 19.85)) return;
    const tv = vis(t, 16.0); fx(ttl, tv, 1.22 - 0.22 * stepR(t - 16.0, { w: 20, z: 0.75 }));
    fx(sub, vis(t, 16.25));
    pills.forEach((p, i) => {
      const t0 = 16.5 + i * 0.25; fx(p, vis(t, t0), 0.86 + 0.14 * stepR(t - t0, SP.pop));
      const sw = Math.exp(-(((t - (18.25 + i * 0.125 + 0.06)) / 0.09) ** 2));
      const perm = (i === 1 || i === 4) ? stepR(t - 19.1, SP.soft) : 0;
      const press = i === 1 ? Math.exp(-(((t - 19.5) / 0.06) ** 2)) : 0;
      const a = Math.max(sw, perm);
      p.style.borderColor = `rgba(${mixc([35, 48, 43], MINT, a).join(',')},1)`;
      p.style.background = `rgba(46,230,160,${(0.05 * a + 0.08 * press).toFixed(3)})`;
    });
  });

  // ------------------------------------------------ S8 · 20.0–23.0 · RAG: built on trusted knowledge
  morph(20.0, { w: 1320, h: 560, r: 40 }); cue(20.0, 'whoosh'); cam(20.0, 960, 540, 1.34);
  const docIco = `<svg width="28" height="34" viewBox="0 0 28 34"><rect x="1.5" y="1.5" width="25" height="31" rx="4" fill="none" stroke="${C.mint}" stroke-width="2"/><path d="M7 11 H21 M7 17 H21 M7 23 H16" stroke="${C.mint}" stroke-width="2" stroke-linecap="round"/></svg>`;
  const g8 = group(960, 540, 1320, 560, `
    <div class="k" style="left:64px;top:54px">Step 2 · RAG</div>
    <div class="abs t" id="h8" style="left:64px;top:88px;font-size:48px">Built on trusted knowledge.</div>
    ${['Sales Playbook', 'Selling Skills', 'JBP Scenarios'].map((s, i) => `<div class="doc" style="left:64px;top:${206 + 92 * i}px">${docIco}${s}</div>`).join('')}
    <svg class="abs" id="fl" style="left:0;top:0;overflow:visible" width="1320" height="560">
      ${[0, 1, 2].map(i => `<path class="rg" d="M364 ${243 + 92 * i} C 440 ${243 + 92 * i}, 450 335, 535 335" fill="none" stroke="${C.mint}" stroke-opacity=".7" stroke-width="2.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>`).join('')}
      <path class="rg" d="M705 335 H780" fill="none" stroke="${C.mint}" stroke-width="2.5" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/>
    </svg>
    <div class="abs" id="node" style="left:535px;top:250px;width:170px;height:170px;border-radius:85px;border:2.5px solid var(--mint);box-sizing:border-box;background:rgba(46,230,160,.07);display:flex;align-items:center;justify-content:center;font-size:42px;font-weight:800;color:var(--mint)">RAG</div>
    <div class="abs m" id="rl" style="left:470px;top:440px;width:300px;text-align:center;font-size:21px">Retrieve · Ground · Cite</div>
    <div class="abs" id="ans" style="left:792px;top:196px;width:466px;height:278px;border-radius:24px;background:#111815;border:1.5px solid #24302B;box-sizing:border-box">
      <div class="k" style="left:26px;top:24px;font-size:16px">Retrieved</div>
      <div class="abs" style="left:26px;top:58px;width:414px;font-size:27px;line-height:1.32;font-weight:500">Lead with shopper data, then propose a joint business plan.</div>
      <div class="chip" id="ch1" style="left:26px;top:200px">Playbook §3.2</div>
      <div class="chip" id="ch2" style="left:212px;top:200px">JBP Scenario 07</div>
    </div>`);
  const q8 = s => g8.querySelector(s);
  const [k8, h8, node, rl, ans, ch1, ch2] = ['.k', '#h8', '#node', '#rl', '#ans', '#ch1', '#ch2'].map(q8);
  const docs = [...g8.querySelectorAll('.doc')], flows = [...g8.querySelectorAll('#fl .rg')];
  docs.forEach((_, i) => cue(20.25 + i * 0.25, 'tick', { p: i * 2 }));
  cue(21.0, 'thump'); cue(21.5, 'pop', { p: 3 }); cue(21.75, 'tick', { p: 5 }); cue(22.0, 'tick', { p: 6 });
  const c1p = cen(ch1); go(COACH, 21.95, [c1p[0] + 20, c1p[1] + 8]); click(COACH, 22.5);
  DRAW.push(t => {
    if (!gate(g8, t, 20.0, 22.85)) return;
    fx(k8, vis(t, 20.05)); fx(h8, vis(t, 20.12));
    docs.forEach((d, i) => { const v = vis(t, 20.25 + i * 0.25); fx(d, v, 1, -60 * (1 - stepR(t - 20.25 - i * 0.25, SP.ui))); });
    flows.slice(0, 3).forEach((f, i) => draw(f, stepR(t - 20.8 - i * 0.06, { w: 14, z: 1 })));
    draw(flows[3], stepR(t - 21.35, { w: 16, z: 1 }));
    fx(node, vis(t, 20.4), 0.9 + 0.1 * stepR(t - 20.4, SP.ui) + 0.08 * Math.exp(-(((t - 21.05) / 0.08) ** 2)));
    fx(rl, vis(t, 21.25)); fx(ans, vis(t, 21.5), 0.94 + 0.06 * stepR(t - 21.5, SP.pop));
    fx(ch1, vis(t, 21.75), 1 - 0.08 * Math.exp(-(((t - 22.5) / 0.05) ** 2))); fx(ch2, vis(t, 22.0));
    ch1.style.background = `rgba(46,230,160,${(0.06 + 0.25 * stepR(t - 22.5, SP.ui)).toFixed(3)})`;
  });

  // ------------------------------------------------ chat scenes (one helper, three use cases)
  function chatHeader(av, name, sub) {
    return `<div class="av" style="left:36px;top:30px">${av}</div>
      <div class="abs t" style="left:114px;top:32px;font-size:27px">${name}</div>
      <div class="abs m" style="left:114px;top:68px;font-size:19px">${sub}</div>
      <div class="chip" style="right:36px;top:37px">ROLE-PLAY</div>
      <div class="abs" style="left:0;right:0;top:120px;height:1.5px;background:#1F2925"></div>`;
  }
  const headEls = g => [...g.querySelectorAll(':scope > .av, :scope > .t, :scope > .m, :scope > .chip:not([id]), :scope > .abs:not([id])')];

  // S9 · 23.0–26.0 · New Sales KAM role-plays the chain buyer
  morph(23.0, { w: 1040, h: 640, r: 36, stroke: ['#FFFFFF', 0.14] }); cue(23.0, 'whoosh'); cam(23.0, 960, 540, 1.45);
  const B1 = 'Your terms are too high. Why should we list you?';
  const B2 = 'Category shoppers grew 18% with us. Let’s build a joint plan.';
  const g9 = group(960, 540, 1040, 640, `${chatHeader('CB', 'Chain buyer · AI persona', 'Simulation · New Sales KAM')}
    <div class="bub them" id="b1" style="left:36px;top:154px">${words(B1)}</div>
    <div class="chip" id="tp" style="left:36px;top:306px"><span class="d"></span>Coach: lead with shopper data · Playbook §3.2</div>
    <div class="bub me" id="b2" style="right:36px;top:384px">${words(B2)}</div>
    <div class="abs m" id="cmp" style="left:36px;right:36px;top:556px;height:54px;border-radius:27px;border:1.5px solid #222C28;box-sizing:border-box;line-height:52px;padding-left:24px;font-size:20px">Reply to the buyer…</div>`);
  const [b1, tp, b2, cmp] = ['#b1', '#tp', '#b2', '#cmp'].map(s => g9.querySelector(s));
  const h9 = headEls(g9), w1 = [...b1.querySelectorAll('span')], w2 = [...b2.querySelectorAll('span')];
  cue(23.5, 'msg', { p: 0 }); cue(24.25, 'chime'); cue(24.75, 'msg', { p: 2 });
  w2.forEach((_, i) => i % 2 === 0 && cue(24.8 + i * 0.07, 'tick', { p: 7, soft: 1 }));
  const tpc = cen(tp); go(COACH, 23.85, [tpc[0] + tp.offsetWidth / 2 - 30, tpc[1] + 10]); click(COACH, 24.25, 'none');
  DRAW.push(t => {
    if (!gate(g9, t, 23.0, 25.85)) return;
    h9.forEach((e, i) => fx(e, vis(t, 23.05 + i * 0.03)));
    fx(cmp, vis(t, 23.2));
    fx(b1, vis(t, 23.5), 0.92 + 0.08 * stepR(t - 23.5, SP.pop)); w1.forEach((w, i) => fx(w, vis(t, 23.52 + i * 0.035)));
    fx(tp, vis(t, 24.25), 0.9 + 0.1 * stepR(t - 24.25, SP.pop));
    fx(b2, vis(t, 24.75), 0.92 + 0.08 * stepR(t - 24.75, SP.pop)); w2.forEach((w, i) => fx(w, vis(t, 24.8 + i * 0.07)));
  });

  // S10 · 26.0–28.0 · evaluation against a rubric
  morph(26.0, { w: 1040, h: 600 }); cue(26.0, 'whoosh'); cam(26.0, 960, 540, 1.52);
  const RUB = [['Opening', 4], ['Value story', 5], ['Objection handling', 4], ['Close', 4]];
  const g10 = group(960, 540, 1040, 600, `
    <div class="k" style="left:52px;top:50px">Evaluation · rubric</div>
    <div class="abs t" id="h10" style="left:52px;top:84px;font-size:44px">Skill evidence, not guesswork.</div>
    ${RUB.map(([n, s], i) => `<div class="abs row" style="left:52px;top:${190 + 70 * i}px;width:640px;height:40px">
      <div class="abs" style="left:0;top:4px;font-size:25px;font-weight:600">${n}</div>
      <div class="abs" style="left:260px;top:13px;width:300px;height:14px;border-radius:7px;background:#1A2320"><div class="rf" style="height:14px;border-radius:7px;background:var(--mint);width:0"></div></div>
      <div class="abs m num" style="left:590px;top:4px;font-size:24px;font-weight:600">${s}/5</div></div>`).join('')}
    <div class="abs" id="rd" style="left:760px;top:168px;width:240px;height:250px;border-radius:24px;background:#111815;border:1.5px solid #24302B;box-sizing:border-box">
      <div class="k" style="left:28px;top:26px;font-size:16px;color:var(--mute)">Readiness</div>
      <div class="abs num" id="o10" style="left:22px;top:60px;font-size:112px;color:var(--mint)"></div>
      <div class="abs" id="up" style="left:28px;top:190px;font-size:20px;font-weight:600;color:var(--mint)">+45 this week</div></div>
    <div class="chip fill" id="nx" style="left:52px;top:494px"><span class="d"></span>Next action — practise price objections · 10 min</div>`);
  const q10 = s => g10.querySelector(s);
  const [k10, h10, rd, up, nx] = ['.k', '#h10', '#rd', '#up', '#nx'].map(q10);
  const rows = [...g10.querySelectorAll('.row')], rfs = [...g10.querySelectorAll('.rf')];
  const o10 = odo(q10('#o10'), 2);
  rows.forEach((_, i) => cue(26.25 + i * 0.25, 'bar', { p: 2 + i }));
  for (let i = 0; i < 6; i++) cue(26.5 + i * 0.125, 'tick', { p: 3 + i, soft: 1 });
  const nxc = cen(nx); go(COACH, 26.9, [nxc[0] + 120, nxc[1] + 8]); click(COACH, 27.5); cue(27.5, 'chime');
  DRAW.push(t => {
    if (!gate(g10, t, 26.0, 27.85)) return;
    fx(k10, vis(t, 26.05)); fx(h10, vis(t, 26.12));
    rows.forEach((r, i) => { fx(r, vis(t, 26.25 + i * 0.25)); rfs[i].style.width = (300 * RUB[i][1] / 5 * stepR(t - 26.3 - i * 0.25, { w: 15, z: 0.85 })).toFixed(1) + 'px'; });
    fx(rd, vis(t, 26.4)); o10(41 + 45 * outQ((t - 26.5) / 0.9)); fx(up, vis(t, 27.35));
    fx(nx, vis(t, 27.5), (0.9 + 0.1 * stepR(t - 27.5, SP.pop)));
  });

  // S11 · 28.0–31.0 · New employee role-plays the manager
  morph(28.0, { w: 1040, h: 520 }); cue(28.0, 'whoosh'); cam(28.0, 960, 540, 1.62);
  const g11 = group(960, 540, 1040, 520, `${chatHeader('MG', 'Your manager · AI persona', 'Simulation · New employee')}
    <div class="bub them" id="b3" style="left:36px;top:154px">${words('Walk me through your plan for the first 30 days.')}</div>
    <div class="chip" id="tp3" style="left:36px;top:306px"><span class="d"></span>Coach: use the onboarding playbook, week by week</div>
    <div class="chip fill" id="nx3" style="left:36px;top:390px"><span class="d"></span>Next action — shadow two customer calls</div>`);
  const [b3, tp3, nx3] = ['#b3', '#tp3', '#nx3'].map(s => g11.querySelector(s));
  const h11 = headEls(g11), w3 = [...b3.querySelectorAll('span')];
  cue(28.5, 'msg', { p: 1 }); cue(29.25, 'chime');
  const nx3c = cen(nx3); go(COACH, 29.3, [nx3c[0] + 100, nx3c[1] + 8]); click(COACH, 29.75);
  DRAW.push(t => {
    if (!gate(g11, t, 28.0, 30.85)) return;
    h11.forEach((e, i) => fx(e, vis(t, 28.05 + i * 0.03)));
    fx(b3, vis(t, 28.5), 0.92 + 0.08 * stepR(t - 28.5, SP.pop)); w3.forEach((w, i) => fx(w, vis(t, 28.52 + i * 0.035)));
    fx(tp3, vis(t, 29.25), 0.9 + 0.1 * stepR(t - 29.25, SP.pop)); fx(nx3, vis(t, 29.75), 0.9 + 0.1 * stepR(t - 29.75, SP.pop));
  });

  // S12 · 31.0–34.0 · New medical rep role-plays the HCP
  morph(31.0, { w: 1040, h: 560 }); cue(31.0, 'whoosh'); cam(31.0, 960, 540, 1.56);
  const B5 = 'Here’s the approved study summary, and what it doesn’t claim.';
  const g12 = group(960, 540, 1040, 560, `${chatHeader('Dr', 'Pediatrician · AI persona', 'Simulation · New medical rep')}
    <div class="bub them" id="b4" style="left:36px;top:154px">${words('What’s the evidence behind that claim?')}</div>
    <div class="bub me" id="b5" style="right:36px;top:262px">${words(B5)}</div>
    <div class="chip fill" id="vf" style="left:36px;top:446px"><span style="font-weight:800">✓</span>VERIFIED — grounded in approved claims</div>
    <div class="chip" id="mr" style="left:500px;top:446px"><span class="d"></span>Medical review</div>`);
  const [b4, b5, vf, mr] = ['#b4', '#b5', '#vf', '#mr'].map(s => g12.querySelector(s));
  const h12 = headEls(g12), w4 = [...b4.querySelectorAll('span')], w5 = [...b5.querySelectorAll('span')];
  cue(31.5, 'msg', { p: 0 }); cue(32.0, 'msg', { p: 2 });
  w5.forEach((_, i) => i % 2 === 0 && cue(32.05 + i * 0.06, 'tick', { p: 7, soft: 1 }));
  cue(33.0, 'pop', { p: 5 }); cue(33.25, 'tick', { p: 6 });
  const vfc = cen(vf); go(COACH, 32.55, [vfc[0] + 140, vfc[1] + 8]); click(COACH, 33.0, 'none');
  DRAW.push(t => {
    if (!gate(g12, t, 31.0, 33.85)) return;
    h12.forEach((e, i) => fx(e, vis(t, 31.05 + i * 0.03)));
    fx(b4, vis(t, 31.5), 0.92 + 0.08 * stepR(t - 31.5, SP.pop)); w4.forEach((w, i) => fx(w, vis(t, 31.52 + i * 0.04)));
    fx(b5, vis(t, 32.0), 0.92 + 0.08 * stepR(t - 32.0, SP.pop)); w5.forEach((w, i) => fx(w, vis(t, 32.05 + i * 0.06)));
    fx(vf, vis(t, 33.0), 0.84 + 0.16 * stepR(t - 33.0, SP.pop)); fx(mr, vis(t, 33.25));
  });

  // ------------------------------------------------ S13 · 34.0–37.0 · pull back: one coach, five roles
  morph(34.0, { w: 460, h: 140, r: 70, stroke: [C.mint, 0.8] }); cue(34.0, 'whoosh'); cam(34.0, 960, 550, 1.04);
  const AG = [['Assess', 'Find skill gaps', -440, -228], ['Coach', 'Explain the skill', 440, -228], ['Simulate', 'Role-play', -560, 40], ['Evaluate', 'Review vs rubric', 560, 40], ['Next action', 'Plan practice', 0, 262]];
  const g13 = group(960, 540, 1500, 800, `
    <svg class="abs" style="left:0;top:0;overflow:visible" width="1500" height="800"><ellipse class="rg" cx="750" cy="400" rx="560" ry="262" fill="none" stroke="${C.mint}" stroke-opacity=".35" stroke-width="2" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/></svg>
    <div class="abs" id="core" style="left:${750 - 230}px;top:${400 - 70}px;width:460px;height:140px;display:flex;flex-direction:column;align-items:center;justify-content:center">
      <div style="font-size:44px;font-weight:800;letter-spacing:-.02em">AI <span style="color:var(--mint)">COACH</span></div>
      <div class="m" style="font-size:19px;margin-top:2px;letter-spacing:.1em">ORCHESTRATOR</div></div>
    ${AG.map(([a, b, x, y], i) => `<div class="abs ag" style="left:${750 + x}px;top:${400 + y}px"><div class="agent" style="position:absolute;transform:translate(-50%,-50%)"><i>${i + 1}</i><span>${a}<span class="m" style="font-size:18px;font-weight:500;margin-left:12px">${b}</span></span></div></div>`).join('')}
    <div class="abs t" id="top" style="left:0;right:0;top:-6px;text-align:center;font-size:40px">Five specialist roles. One coach.</div>
    <div class="abs hl" id="gr" style="left:0;right:0;top:742px;text-align:center;font-size:22px;color:var(--mute)">${['Human oversight', 'Approved content', 'Privacy', 'Access controls'].map(s => `<span style="margin:0 18px">${s}</span>`).join('<span style="color:var(--dim)">·</span>')}</div>`);
  const core = g13.querySelector('#core'), ell = g13.querySelector('ellipse'), ags = [...g13.querySelectorAll('.ag')], top13 = g13.querySelector('#top');
  const grs = [...g13.querySelectorAll('#gr > span')];
  ags.forEach((_, i) => cue(34.5 + i * 0.25, 'pop', { p: i + 1 }));
  cue(35.75, 'whoosh'); grs.forEach((_, i) => i % 2 === 0 && cue(36.0 + i * 0.06, 'tick', { p: 4 + i / 2, soft: 1 }));
  go(COACH, 36.3, [990, 560]); click(COACH, 36.75);
  DRAW.push(t => {
    if (!gate(g13, t, 34.0, 36.9)) return;
    fx(core, vis(t, 34.12), 1 - 0.06 * Math.exp(-(((t - 36.75) / 0.06) ** 2)));
    draw(ell, stepR(t - 34.2, { w: 6, z: 1 })); show(ell);
    ags.forEach((a, i) => { const t0 = 34.5 + i * 0.25; fx(a, vis(t, t0), 0.8 + 0.2 * stepR(t - t0, SP.pop)); });
    fx(top13, vis(t, 35.75)); grs.forEach((s, i) => fx(s, vis(t, 36.0 + i * 0.06)));
  });

  // ------------------------------------------------ S14 · 37.0–42.0 · the shape becomes the full stop
  morph(37.0, { w: 34, h: 34, r: 17, fill: [C.mint, 1], stroke: [C.mint, 0] }, { w: 16, z: 0.75 }); cam(37.0, 960, 560, 1.22);
  cue(37.0, 'impact'); cue(37.5, 'whoosh'); cue(38.3, 'chime');
  const g14 = group(960, 540, 1400, 400, `
    <div class="abs t" id="wm" style="left:0;top:40px;font-size:176px;font-weight:800;letter-spacing:-.045em;line-height:1;white-space:nowrap">AI Coach</div>
    <div class="abs" id="tag" style="left:0;right:0;top:240px;text-align:center;font-size:42px;font-weight:500;color:#C9D2CE">A place to practise before it counts.</div>
    <div class="abs hl" id="row" style="left:0;right:0;top:322px;text-align:center;font-size:23px;font-weight:600;color:var(--mint);letter-spacing:.02em">${['Skill gap', 'AI Coach', 'Practice', 'Feedback', 'Launch'].map(s => `<span>${s}</span>`).join('<span style="color:var(--dim);margin:0 14px">→</span>')}</div>`);
  const wm = g14.querySelector('#wm'), tagl = g14.querySelector('#tag'), rowEls = [...g14.querySelectorAll('#row > span')];
  const WMW = wm.offsetWidth, GAP = 16, DOT = 34;
  const wmL = 700 - (WMW + GAP + DOT) / 2; wm.style.left = wmL + 'px';
  const wmLeftWorld = 960 - 700 + wmL, dotY = 540 - 200 + 40 + 176 * 0.76 - DOT / 2;
  const END = { k: t => stepR(t - 37.5, { w: 9, z: 1 }), blend: t => stepR(t - 37.5, { w: 20, z: 1 }), x: k => wmLeftWorld + k * WMW + GAP + DOT / 2 };
  DRAW.push(t => {
    if (!gate(g14, t, 37.0, 99)) return;
    const k = END.k(t);
    show(wm); wm.style.clipPath = `inset(-20px ${(100 * (1 - k)).toFixed(2)}% -40px -20px)`;
    fx(tagl, vis(t, 38.3)); rowEls.forEach((s, i) => fx(s, vis(t, 38.8 + i * 0.06)));
    fadeEl.style.opacity = clamp((t - 41.2) / 0.8).toFixed(3);
  });

  // ------------------------------------------------ HUD sources and captions
  hudLine('src', [
    [0.7, 2.85, 'Source: consumer survey of Vietnamese AI users'],
    [3.15, 5.85, 'Source: Microsoft Work Trend Index Vietnam 2026 · survey of 2,000 knowledge workers'],
    [6.15, 8.35, 'Source: Visier survey of 1,000 US full-time employees, 2026 · separate questions'],
  ], 'id="src" style="position:absolute;left:72px;bottom:50px;font-size:17px;color:var(--dim)"');
  hudLine('cap', [
    [23.25, 27.85, '<b>NEW SALES KAM</b>from fear of rejection to a confident close'],
    [28.2, 30.85, '<b>NEW EMPLOYEE</b>from the ocean of unknown to a guided swim'],
    [31.2, 33.85, '<b>NEW MEDICAL REP</b>HCP detailing with scientific confidence'],
  ], 'style="position:absolute;left:0;right:0;bottom:58px;text-align:center;font-size:25px;font-weight:600;white-space:nowrap"');

  // ------------------------------------------------ shape, camera, background, cursors
  DRAW.unshift(t => {
    const z = Math.exp(CAM.lz.at(t)), cx = CAM.x.at(t), cy = CAM.y.at(t);
    world.style.transform = `translate(960px,540px) scale(${z.toFixed(5)}) translate(${(-cx).toFixed(2)}px,${(-cy).toFixed(2)}px)`;
    let x = SH.x.at(t), y = SH.y.at(t);
    if (t >= 37.5) { x = lerp(x, END.x(END.k(t)), END.blend(t)); y = lerp(y, dotY + DOT / 2, END.blend(t)); }
    const w = Math.max(0, SH.w.at(t)), hh = Math.max(0, SH.h.at(t)), r = Math.min(Math.max(0, SH.r.at(t)), w / 2, hh / 2);
    Object.assign(shapeEl.style, { left: (x - w / 2).toFixed(2) + 'px', top: (y - hh / 2).toFixed(2) + 'px', width: w.toFixed(2) + 'px', height: hh.toFixed(2) + 'px', borderRadius: r.toFixed(2) + 'px', background: SH.fill.css(t), borderColor: SH.stroke.css(t), borderWidth: w < 60 ? '0px' : '2px' });
    const red = clamp(BGR.at(t)), c1 = mixc([46, 230, 160], [255, 77, 87], red).join(',');
    const p1x = 24 + 5 * Math.sin(t * 0.33), p1y = 16 + 4 * Math.cos(t * 0.27), p2x = 80 - 4 * Math.sin(t * 0.29);
    bgEl.style.background = `radial-gradient(52% 62% at ${p1x.toFixed(2)}% ${p1y.toFixed(2)}%, rgba(${c1},${(0.085 + 0.03 * red).toFixed(3)}), transparent 70%), radial-gradient(48% 56% at ${p2x.toFixed(2)}% 88%, rgba(30,170,190,.065), transparent 70%), #030504`;
    CAMNOW.x = cx; CAMNOW.y = cy; CAMNOW.z = z;
  });
  DRAW.push(t => { drawCursor(YOU, t, CAMNOW); drawCursor(COACH, t, CAMNOW); });
}
const CAMNOW = { x: 960, y: 540, z: 1 };

// ---------------------------------------------------------------- entry
window.DUR = 42;
window.seek = t => { for (const f of DRAW) f(t); };
(async () => {
  await document.fonts.load('700 40px Geist'); await document.fonts.load('500 40px Geist'); await document.fonts.ready;
  build();
  CUES.sort((a, b) => a.t - b.t);
  window.CUES = CUES.filter(c => c.type !== 'none');
  const q = new URLSearchParams(location.search);
  window.seek(q.has('t') ? +q.get('t') : 0);
  window.READY = true;
})();
