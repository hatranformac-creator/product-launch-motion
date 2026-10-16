// AIMarketing launch film. Every style is computed from time inside seek(t).
// 120 BPM: one beat = 0.5 s, 120 beats, drop on beat 68 (34 s).
'use strict';

// ---------- core ----------
const DUR = 60, B = 0.5, b = n => n * B;
const clamp = (x, a = 0, c = 1) => Math.max(a, Math.min(c, x));
const lerp = (a, c, u) => a + (c - a) * u;
const outQ = u => 1 - Math.pow(1 - clamp(u), 4);
const inC = u => Math.pow(clamp(u), 3);
const smooth = u => { u = clamp(u); return u * u * (3 - 2 * u); };
const $ = id => document.getElementById(id);
// ?v=1 renders the 9:16 vertical cut (1080x1920) from the same timeline
const V = new URLSearchParams(location.search).has('v');
const SW = V ? 1080 : 1920, SH = V ? 1920 : 1080, SCX = SW / 2, SCY = V ? 900 : 540;
const vz = (a, v) => V ? v : a;
document.querySelectorAll('#stage, .layer').forEach(e => { e.style.width = SW + 'px'; e.style.height = SH + 'px'; });
$('trail').width = SW; $('trail').height = SH;

function stepR(tau, { w, z }) {
  if (tau <= 0) return 0;
  if (z >= 1) { const x = w * tau; return 1 - Math.exp(-x) * (1 + x); }
  const wd = w * Math.sqrt(1 - z * z);
  return 1 - Math.exp(-z * w * tau) * (Math.cos(wd * tau) + (z * w / wd) * Math.sin(wd * tau));
}
class Track { // absolute targets, sorted by time, so calls may be issued in any order
  constructor(v0) { this.v0 = v0; this.tg = []; this.ev = null; }
  get cur() { return this.tg.length ? this.tg.reduce((a, c) => c[0] >= a[0] ? c : a)[1] : this.v0; }
  set cur(v) { this.v0 = v; }
  to(t, v, sp = SP.card) { this.tg.push([t, v, sp, this.tg.length]); this.ev = null; return this; }
  at(t) {
    if (!this.ev) { let c = this.v0; this.ev = [];
      for (const [ti, v, sp] of [...this.tg].sort((a, q) => a[0] - q[0] || a[3] - q[3])) { if (v !== c) this.ev.push([ti, v - c, sp]); c = v; } }
    let v = this.v0; for (const [ti, d, sp] of this.ev) v += d * stepR(t - ti, sp); return v;
  }
}
const hex = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
class CTrack {
  constructor(h) { const c = hex(h); this.c = c.map(v => new Track(v)); }
  to(t, h, sp = SP.card) { hex(h).forEach((v, i) => this.c[i].to(t, v, sp)); return this; }
  at(t) { return `rgb(${this.c.map(k => Math.round(clamp(k.at(t), 0, 255))).join(',')})`; }
}
const SP = {
  card: { w: 15, z: 0.84 }, snap: { w: 24, z: 0.8 }, soft: { w: 9, z: 1 }, cam: { w: 6.5, z: 1 },
  pop: { w: 20, z: 0.72 }, text: { w: 26, z: 1 }, cur: { w: 12, z: 1 }, fast: { w: 30, z: 0.9 },
  lead: { w: 34, z: 0.9 }, trail: { w: 17, z: 0.9 },
};
// enter on a spring, exit short and early
function vis(t, tin, tout, dOut = 0.12, dist = 16) {
  const e = stepR(t - tin, SP.text), x = tout == null ? 0 : clamp((t - tout) / dOut), xo = x * x;
  return { o: e * (1 - xo), b: (1 - e) * 10 + xo * 10, dy: (1 - e) * dist - xo * 10, e };
}
function show(el, v, extra = '') {
  if (v.o < 0.002) { el.style.visibility = 'hidden'; return false; }
  el.style.visibility = 'visible';
  el.style.opacity = v.o.toFixed(4);
  el.style.filter = v.b > 0.06 ? `blur(${v.b.toFixed(2)}px)` : 'none';
  el.style.transform = `translateY(${v.dy.toFixed(2)}px) ${extra}`;
  return true;
}
function place(el, x, y, w, h, extra = '') {
  el.style.width = w + 'px'; el.style.height = h + 'px';
  el.style.transform = `translate(${(x - w / 2).toFixed(2)}px,${(y - h / 2).toFixed(2)}px) ${extra}`;
}
function mk(html, parent) {
  const d = document.createElement('div'); d.innerHTML = html.trim();
  const el = d.firstElementChild; parent.appendChild(el); return el;
}
const CUES = [];
const cue = (t, type, o = {}) => CUES.push({ t: +t.toFixed(4), type, ...o });
const press = (t, tc) => 1 - 0.16 * Math.exp(-Math.pow((t - tc) / 0.045, 2));

// ---------- layers ----------
const world = $('world'), hud = $('hud'), bgL = $('bg'), trail = $('trail').getContext('2d');

// ---------- camera ----------
const CX = new Track(0), CY = new Track(0), LZ = new Track(Math.log(0.9));
const cam = (t, x, y, z, sp = SP.cam) => { CX.to(t, x, sp); CY.to(t, y, sp); LZ.to(t, Math.log(z), sp); };
const camAt = t => ({ x: CX.at(t), y: CY.at(t), z: Math.exp(LZ.at(t)) });
const toScreen = (t, x, y) => { const c = camAt(t); return [SCX + (x - c.x) * c.z, SCY + (y - c.y) * c.z]; };

// ---------- background ----------
bgL.innerHTML = `
  <div id="pool1" class="abs" style="width:1400px;height:1400px;border-radius:50%;background:radial-gradient(closest-side,rgba(34,142,205,.16),rgba(34,142,205,0))"></div>
  <div id="pool2" class="abs" style="width:1300px;height:1300px;border-radius:50%;background:radial-gradient(closest-side,rgba(36,178,75,.11),rgba(36,178,75,0))"></div>
  <svg id="sky" class="abs" width="${SW}" height="${SH}" style="opacity:.6"></svg>
  <svg id="wave" class="abs" width="1100" height="520" viewBox="0 0 1100 520">
    <defs>
      <linearGradient id="wg1" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#5AA9E6"/><stop offset="1" stop-color="#0B4DA2"/></linearGradient>
      <linearGradient id="wg2" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#C9E2F7"/><stop offset="1" stop-color="#3B8FD9"/></linearGradient>
    </defs>
    <path d="M1100 520 L1100 60 C 880 300, 560 440, 40 520 Z" fill="url(#wg2)" opacity=".75"/>
    <path d="M1100 520 L1100 170 C 900 360, 640 470, 260 520 Z" fill="url(#wg1)"/>
    <path d="M1100 520 L1100 330 C 980 430, 820 495, 620 520 Z" fill="#0A3F8C"/>
  </svg>`;
{ // faint skyline, the deck's backdrop motif
  let s = '', x = 0, k = 7;
  while (x < SW) { k = (k * 9301 + 49297) % 233280; const w = 50 + (k % 70), h = 90 + ((k >> 3) % 260);
    s += `<rect x="${x}" y="${SH - h}" width="${w}" height="${h}" fill="#E4ECF7"/>`;
    if (k % 3 === 0) s += `<rect x="${x + w / 2 - 4}" y="${SH - h - 40}" width="8" height="40" fill="#E4ECF7"/>`;
    x += w + 6; }
  $('sky').innerHTML = s;
}
function drawBg(t) {
  $('pool1').style.transform = `translate(${vz(1050, 250) + 60 * Math.sin(t * 0.21)}px,${vz(-560, -420) + 40 * Math.cos(t * 0.17)}px)`;
  $('pool2').style.transform = `translate(${vz(-520, -560) + 50 * Math.cos(t * 0.19)}px,${vz(300, 1150) + 40 * Math.sin(t * 0.23)}px)`;
  let o, off;
  if (t < 30) { const e = stepR(t, SP.soft), x = smooth((t - b(14.5)) / 0.9); o = 1 - x; off = (1 - e) * 260 + x * 320; }
  else { const e = stepR(t - b(109), SP.soft); o = clamp(e * 1.3); off = (1 - e) * 260; }
  const el = $('wave');
  el.style.opacity = o;
  el.style.transform = `translate(${SW - 1040 + off + 8 * Math.sin(t * 0.8)}px,${SH - 480 + off * 0.5}px)`;
}

// ---------- hero shape: one element, never cut ----------
const hero = mk(`<div id="hero"></div>`, world);
const HX = new Track(0), HY = new Track(0), HW = new Track(0), HH = new Track(0), HR = new Track(999);
const HC = new CTrack('#24B24B'), HA = new Track(0), HS = new Track(0), HSC = new Track(1);
function heroTo(t, x, y, w, h, r, col, sp = SP.card) {
  HX.to(t, x, sp); HY.to(t, y, sp); HW.to(t, w, sp); HH.to(t, h, sp); HR.to(t, r, sp);
  if (col) HC.to(t, col, { w: 38, z: 1 });
}
const heroPresses = [];
function drawHero(t) {
  const w = Math.max(0, HW.at(t)), h = Math.max(0, HH.at(t));
  if (w < 0.5) { hero.style.display = 'none'; return; }
  hero.style.display = '';
  let s = HSC.at(t);
  for (const tc of heroPresses) s *= press(t, tc);
  if (t > b(67.5) && t < b(68)) s *= 0.93 + 0.07 * (1 - stepR(t - b(67.5), SP.fast));
  else if (t >= b(68)) s *= lerp(0.93, 1, stepR(t - b(68), SP.pop)) / 1 * (t < b(69) ? 1 : 1);
  place(hero, HX.at(t), HY.at(t), w, h, `scale(${s.toFixed(4)})`);
  hero.style.borderRadius = Math.min(HR.at(t), Math.min(w, h) / 2) + 'px';
  const a = clamp(HA.at(t));
  const col = HC.at(t).replace('rgb', 'rgba').replace(')', `,${a.toFixed(3)})`);
  hero.style.background = col;
  const sh = clamp(HS.at(t));
  hero.style.boxShadow = sh > 0.01 ? `0 ${30 * sh}px ${90 * sh}px rgba(25,71,157,${0.13 * sh}), 0 ${2 * sh}px ${6 * sh}px rgba(14,27,61,${0.06 * sh})` : 'none';
}
// content groups sized to their final card, centred in the hero
function group(w, h) { const g = mk(`<div class="content" style="width:${w}px;height:${h}px;margin-left:${-w / 2}px;margin-top:${-h / 2}px"></div>`, hero); return g; }
function kid(g, x, y, html) { const el = mk(html, g); el.style.position = 'absolute'; el.style.left = x + 'px'; el.style.top = y + 'px'; return el; }

// ---------- cursors (screen space, targets in world space) ----------
function makeCursor(kind, label) {
  const grad = kind === 'ai';
  const el = mk(`<div class="cursor">
      <div class="rip ripple"></div>
      <svg class="arrow" width="40" height="44" viewBox="0 0 40 44" style="position:absolute;left:-4px;top:-3px">
        <defs><linearGradient id="cg_${kind}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#24B24B"/><stop offset="1" stop-color="#228ECD"/></linearGradient></defs>
        <path d="M5 3 L5 33 L13.5 25.5 L19 38 L24.5 35.6 L19 23.5 L30 23 Z" fill="${grad ? `url(#cg_${kind})` : '#0E1B3D'}" stroke="#fff" stroke-width="2.6" stroke-linejoin="round"/>
      </svg>
      <div class="pill" style="background:${grad ? 'linear-gradient(90deg,#24B24B,#228ECD)' : '#0E1B3D'}"><span class="lab">${label}</span><span class="lab2" style="position:absolute;left:14px"></span></div>
    </div>`, hud);
  return { el, X: new Track(0), Y: new Track(0), O: new Track(0), clicks: [], holds: [], labels: [], kind, born: 0 };
}
const you = makeCursor('you', 'You'), ai = makeCursor('ai', 'AIMarketing AI');
function mv(c, tArr, x, y, lead = 0.42, sp = SP.cur) { c.X.to(tArr - lead, x, sp); c.Y.to(tArr - lead, y, sp); }
function jump(c, t, x, y) { c.X.to(t, x, { w: 400, z: 1 }); c.Y.to(t, y, { w: 400, z: 1 }); }
function click(c, t, snd = 'click') { c.clicks.push(t); cue(t, snd); }
function drawCursor(c, t) {
  const o = clamp(c.O.at(t));
  if (o < 0.01) { c.el.style.display = 'none'; return; }
  c.el.style.display = '';
  const [sx, sy] = toScreen(t, c.X.at(t), c.Y.at(t));
  const [px] = toScreen(t - 1 / 120, c.X.at(t - 1 / 120), c.Y.at(t - 1 / 120));
  const vx = (sx - px) * 120;
  let s = 1;
  for (const tc of c.clicks) s *= press(t, tc);
  for (const [h0, h1] of c.holds) if (t > h0 && t < h1) s *= 0.86;
  const lean = clamp(-vx * 0.0045, -14, 14);
  c.el.style.opacity = o;
  c.el.style.transform = `translate(${sx.toFixed(2)}px,${sy.toFixed(2)}px)`;
  c.el.querySelector('.arrow').style.transform = `rotate(${lean.toFixed(2)}deg) scale(${s.toFixed(3)})`;
  const pill = c.el.querySelector('.pill');
  pill.style.transform = `translateX(${clamp(-vx * 0.012, -22, 22).toFixed(2)}px) scale(${(0.6 + 0.4 * o).toFixed(3)})`;
  // label swaps with blur
  const l1 = c.el.querySelector('.lab'), l2 = c.el.querySelector('.lab2');
  let cur = c.labels.filter(L => t >= L[0]).pop();
  if (cur) {
    const prev = c.labels[c.labels.indexOf(cur) - 1];
    const vin = vis(t, cur[0] + 0.1, null), vout = vis(t, -1, cur[0], 0.1);
    l2.textContent = cur[1]; show(l2, vin);
    l1.textContent = prev ? prev[1] : l1.dataset.base; show(l1, vout);
    l2.style.position = 'static'; l1.style.position = 'absolute';
  }
  const last = c.clicks.filter(tc => t >= tc).pop();
  const rip = c.el.querySelector('.rip');
  if (last != null && t - last < 0.45) {
    const u = (t - last) / 0.45, r = 10 + 46 * outQ(u);
    rip.style.visibility = 'visible'; rip.style.opacity = (1 - u) * 0.8;
    rip.style.width = rip.style.height = 2 * r + 'px';
    rip.style.transform = `translate(${-r + 5}px,${-r + 3}px)`;
    rip.style.borderColor = c.kind === 'ai' ? '#24B24B' : '#228ECD';
  } else rip.style.visibility = 'hidden';
}
you.el.querySelector('.lab').dataset.base = 'You';
ai.el.querySelector('.lab').dataset.base = 'AIMarketing AI';
function drawTrail(t) {
  trail.clearRect(0, 0, SW, SH);
  const c = ai, o = clamp(c.O.at(t));
  if (o < 0.05) return;
  const pts = [];
  for (let k = 0; k <= 20; k++) { const tk = t - k * 0.009; pts.push(toScreen(tk, c.X.at(tk), c.Y.at(tk))); }
  const sp = Math.hypot(pts[0][0] - pts[3][0], pts[0][1] - pts[3][1]) / 0.027;
  const a = clamp((sp - 500) / 2500) * o;
  if (a < 0.02) return;
  for (let k = 0; k < 20; k++) {
    trail.strokeStyle = `rgba(${k < 10 ? '36,178,75' : '34,142,205'},${(a * 0.55 * (1 - k / 20)).toFixed(3)})`;
    trail.lineWidth = 7 * (1 - k / 20) + 0.5; trail.lineCap = 'round';
    trail.beginPath(); trail.moveTo(pts[k][0] + 4, pts[k][1] + 4); trail.lineTo(pts[k + 1][0] + 4, pts[k + 1][1] + 4); trail.stroke();
  }
}

// ---------- odometer ----------
class Odo {
  constructor(parent, finalStr, fs, cls = '', style = '') {
    this.fs = fs; this.lh = Math.round(fs * 1.15); this.final = finalStr;
    this.dec = (finalStr.split('.')[1] || '').replace(/\D/g, '').length;
    this.el = mk(`<div class="${cls} tnum" style="display:flex;align-items:flex-start;height:${this.lh}px;font-size:${fs}px;line-height:${this.lh}px;${style}"></div>`, parent);
    this.slots = [];
    const digits = finalStr.replace(/[^0-9]/g, '').length;
    let p = digits - 1;
    for (const ch of finalStr) {
      if (/[0-9]/.test(ch)) {
        const s = mk(`<span style="display:inline-block;height:${this.lh}px;clip-path:inset(0 -60px)"><span style="display:block">${[0,1,2,3,4,5,6,7,8,9,0].map(d => `<span style="display:block;height:${this.lh}px">${d}</span>`).join('')}</span></span>`, this.el);
        this.slots.push({ s, strip: s.firstChild, p: p-- });
      } else { const sp = mk(`<span style="display:inline-block">${ch}</span>`, this.el); if (this.slots.length && ch !== '.') this.seps = (this.seps || []).concat([[sp, this.slots[this.slots.length - 1]]]); }
    }
    this.target = parseFloat(finalStr.replace(/[^0-9.]/g, '')) * Math.pow(10, this.dec);
  }
  set(u) {
    const v = this.target * clamp(u);
    for (const { s, strip, p } of this.slots) {
      const P = Math.pow(10, p);
      const d = Math.floor(v / P) % 10 + Math.max(0, (v % P) - (P - 1));
      strip.style.transform = `translateY(${(-d * this.lh).toFixed(2)}px)`;
      const lead = p > 0 && p >= this.dec + 1 ? clamp((v - P * 0.6) / (P * 0.4)) : 1;
      s.style.opacity = this.target < P ? 1 : lead;
    }
    for (const [sp, sl] of this.seps || []) sp.style.opacity = sl.s.style.opacity;
  }
}

// =====================================================================
// SCENE 1 · Problem (b0–b16)
// =====================================================================
const h1 = mk(`<div class="abs disp" style="width:${SW}px;top:${vz(470, 735)}px;text-align:center;font-weight:800;font-size:${vz(104, 124)}px;letter-spacing:-3px;line-height:1.1">
  <span id="h1a" style="display:inline-block">One campaign.</span> <span id="h1b" style="display:inline-block;color:var(--navy)">Nine tools.</span></div>`, hud);
const PAINS = ['Content scattered across tabs.', 'Approvals lost in chat threads.', 'Results tallied by hand.'];
const painEls = PAINS.map(p => mk(`<div class="abs disp" style="width:${SW}px;top:${vz(492, 730)}px;box-sizing:border-box;padding:0 ${vz(0, 70)}px;text-align:center;font-weight:700;font-size:${vz(74, 80)}px;letter-spacing:-2px;line-height:1.1">
  <span style="display:inline-flex;align-items:center;gap:${vz(26, 22)}px;flex-direction:${V ? 'column' : 'row'}"><span style="display:inline-flex;width:62px;height:62px;border-radius:50%;background:#FDEBD8;color:#E07B1F;align-items:center;justify-content:center;font:800 40px Inter">×</span>${p}</span></div>`, hud));
const TOOLS = [
  ['Docs', '#4285F4', 'D', -650, -300, -5], ['Sheets', '#0F9D58', 'S', 540, -330, 4], ['ChatGPT', '#10A37F', 'G', -110, -385, 2],
  ['WordPress', '#21759B', 'W', 790, -190, -3], ['Facebook', '#1877F2', 'f', -800, 30, 3], ['LinkedIn', '#0A66C2', 'in', 320, 340, -4],
  ['Instagram', '#E1306C', 'IG', -430, 330, 5], ['Excel', '#1D6F42', 'X', 700, 225, 3], ['Email', '#6B7A93', '@', -60, 410, -2],
];
const toolEls = TOOLS.map(([n, c, l]) => mk(`<div class="chip abs"><div class="ico" style="width:40px;height:40px;border-radius:12px;background:${c}">${l}</div>${n}</div>`, world));
const tangle = mk(`<svg class="abs" width="10" height="10"><defs><mask id="tm" maskUnits="userSpaceOnUse" x="-2000" y="-2000" width="4000" height="4000"></mask></defs><g id="tl" mask="url(#tm)"></g></svg>`, world);
world.insertBefore(tangle, world.firstChild);
const PAIRS = [[0, 5], [1, 6], [2, 7], [3, 4], [8, 1], [4, 2], [6, 3], [7, 0], [5, 2]];
const tl = tangle.querySelector('#tl'), tmask = tangle.querySelector('#tm');
const tPaths = PAIRS.map(() => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#AFC0D8'); p.setAttribute('stroke-width', '3'); p.setAttribute('stroke-dasharray', '9 11'); tl.appendChild(p); return p; });
const tMasks = PAIRS.map(() => { const p = document.createElementNS('http://www.w3.org/2000/svg', 'path'); p.setAttribute('fill', 'none'); p.setAttribute('stroke', '#fff'); p.setAttribute('stroke-width', '8'); tmask.appendChild(p); return p; });
const TOOL_T = TOOLS.map((_, i) => b(1 + i));
TOOL_T.forEach((t, i) => cue(t, 'pop', { n: i }));
[b(9), b(11), b(13)].forEach(t => cue(t, 'whoosh', { g: 0.5 }));
cue(b(14), 'riser', { d: 2.0 });
const TOOLS_V = [[-300, -650, -5], [260, -560, 4], [-40, -470, 2], [330, -330, -3], [-330, -310, 3], [280, 330, -4], [-300, 430, 5], [250, 560, 3], [-60, 650, -2]];
function toolPos(t, i) {
  const [x, y, r] = V ? TOOLS_V[i] : TOOLS[i].slice(3);
  const fx = x + 7 * Math.sin(t * 1.1 + i * 1.7), fy = y + 7 * Math.cos(t * 1.3 + i * 2.3);
  const e = inC((t - (b(14) + i * 0.07)) / 0.95);
  return { x: lerp(fx, 0, e), y: lerp(fy, 0, e), r: r + e * 120, s: lerp(1, 0.12, e), o: 1 - smooth((e - 0.82) / 0.18), e };
}
function drawScene1(t) {
  if (t > b(17)) { [h1, ...painEls, ...toolEls, tangle].forEach(e => e.style.display = 'none'); return; }
  [h1, ...painEls, ...toolEls, tangle].forEach(e => e.style.display = '');
  show($('h1a'), vis(t, 0.05, b(9) - 0.08));
  show($('h1b'), vis(t, b(2), b(9) - 0.08));
  h1.style.visibility = 'visible';
  painEls.forEach((el, i) => show(el, vis(t, b(9 + 2 * i) + 0.02, i < 2 ? b(11 + 2 * i) - 0.1 : b(14.6), 0.12, 22)));
  const P = [];
  toolEls.forEach((el, i) => {
    const p = toolPos(t, i); P.push(p);
    const e = stepR(t - (TOOL_T[i] - 0.1), SP.pop);
    const o = clamp(e * 1.4) * p.o;
    if (o < 0.002) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = 'visible'; el.style.opacity = o;
    el.style.filter = e < 0.9 ? `blur(${((1 - e) * 8).toFixed(2)}px)` : 'none';
    const w = el.offsetWidth, h = el.offsetHeight;
    el.style.transform = `translate(${p.x - w / 2}px,${p.y - h / 2}px) rotate(${p.r}deg) scale(${(lerp(0.55, 1, e) * p.s).toFixed(4)})`;
  });
  tangle.style.visibility = 'visible';
  PAIRS.forEach(([i, j], k) => {
    const a = P[i], c = P[j];
    const mx = (a.x + c.x) / 2 + (k % 2 ? 1 : -1) * 120, my = (a.y + c.y) / 2 + (k % 3 - 1) * 110;
    const d = `M${a.x} ${a.y} Q${mx} ${my} ${c.x} ${c.y}`;
    tPaths[k].setAttribute('d', d); tMasks[k].setAttribute('d', d);
    const L = 2400, u = outQ((t - (b(3) + k * 0.35)) / 1.4);
    tMasks[k].setAttribute('stroke-dasharray', `${L} ${L}`); tMasks[k].setAttribute('stroke-dashoffset', L * (1 - u));
    tPaths[k].style.opacity = Math.min(a.o, c.o) * 0.9;
  });
}
// hero during scene 1/2: a green dot that becomes the logo ring
HC.to(0, '#24B24B');
HA.to(0, 1, { w: 400, z: 1 });
HX.to(0, 0); HY.to(0, 0);
HW.to(b(14.4), 34, SP.soft); HH.to(b(14.4), 34, SP.soft);
HW.to(b(15.3), 64, SP.soft); HH.to(b(15.3), 64, SP.soft);
cam(0.0, 0, 0, 1.0, { w: 1.1, z: 1 });
cam(b(14), 0, 0, 1.12, { w: 3, z: 1 });

// =====================================================================
// SCENE 2 · Logo (b16–b24)
// =====================================================================
const LOGO = { x: 0, y: -40, w: 900 };
const LS = LOGO.w / 1940, RING = { w: 553 * LS, h: 604 * LS, dx: (323.5 - 970) * LS, dy: (355 - 350) * LS };
const ringG = group(RING.w, RING.h);
const ringImg = kid(ringG, 0, 0, `<img src="brand/ring_crop.png" style="width:${RING.w}px;height:${RING.h}px">`);
const wordEl = mk(`<img class="abs" src="brand/word.png" style="width:${LOGO.w}px">`, world);
const PILLARS = [['Create', '#19479D'], ['Control', '#24B24B'], ['Publish', '#228ECD'], ['Measure', '#F4A04C']];
const pillarRow = mk(`<div class="abs row" style="gap:${vz(46, 30)}px;font:600 ${vz(40, 34)}px Inter;color:var(--ink)">${PILLARS.map(([p, c]) => `<span class="pl row" style="gap:14px"><span style="width:16px;height:16px;border-radius:50%;background:${c}"></span>${p}</span>`).join('')}</div>`, world);
const pillarEls = [...pillarRow.querySelectorAll('.pl')];
function lockup(t0, cx, cy) { // returns timings, sets tracks: dot hits at t0 and becomes the ring
  heroTo(t0, cx, cy, RING.w, RING.h, 999, '#24B24B', SP.pop);
  HA.to(t0 + 0.02, 0, { w: 40, z: 1 });
  HC.to(t0 + 0.2, '#FFFFFF', { w: 400, z: 1 });
  HX.to(t0 + 0.32, cx + RING.dx, SP.card); HY.to(t0 + 0.32, cy + RING.dy, SP.card);
  cue(t0, 'impact');
}
lockup(b(16), LOGO.x, LOGO.y);
PILLARS.forEach((_, i) => cue(b(19 + i), 'blip', { n: i + 2 }));
function drawWord(t, t0, tout, cx, cy) {
  const u = stepR(t - (t0 + 0.3), { w: 9, z: 1 });
  const v = vis(t, t0 + 0.28, tout, 0.16, 0);
  if (!show(wordEl, v)) return;
  const h = LOGO.w * 700 / 1940;
  wordEl.style.transform = `translate(${cx - LOGO.w / 2}px,${cy - h / 2 + v.dy}px)`;
  wordEl.style.clipPath = `inset(-10px ${(1 - u) * 78}% -10px 0)`;
}
function drawScene2(t) {
  // ring image inside the hero (also used by the end lockup)
  const rv = t < 40 ? vis(t, b(16) - 0.02, b(23.7), 0.18, 0) : vis(t, b(108) - 0.02, null, 0.12, 0);
  const rs = t < 40 ? stepR(t - b(16), SP.pop) : stepR(t - b(108), SP.pop);
  show(ringImg, rv, `scale(${lerp(0.25, 1, rs).toFixed(4)}) rotate(${(1 - rs) * -70}deg)`);
  if (t < 40) drawWord(t, b(16), b(23.5), LOGO.x, LOGO.y);
  else drawWord(t, b(108), null, END.x, END.y);
  if (t > b(25) && t < b(107)) wordEl.style.visibility = 'hidden';
  if (t > b(26)) { pillarRow.style.visibility = 'hidden'; return; }
  pillarRow.style.visibility = 'visible';
  const w = pillarRow.offsetWidth;
  pillarRow.style.transform = `translate(${-w / 2}px,${170}px)`;
  pillarEls.forEach((el, i) => show(el, vis(t, b(19 + i) - 0.06, b(23.5)), `scale(${lerp(0.7, 1, stepR(t - b(19 + i) + 0.06, SP.pop)).toFixed(4)})`));
}
cam(b(16) - 0.05, 0, 0, 1.06, { w: 14, z: 0.7 });
cam(b(16.6), 0, 10, 1.0, { w: 5, z: 1 });

// =====================================================================
// SCENE 3 · Brief (b24–b36)
// =====================================================================
const C3 = { w: 1000, h: 540 }, O3 = { x: -500, y: -270 };
const g3 = group(C3.w, C3.h);
const s3 = {
  k1: kid(g3, 40, 34, `<div class="row" style="height:44px;padding:0 18px;border-radius:22px;background:#E5F3EE;color:var(--teal);font:700 19px Inter;gap:8px">✦ New content</div>`),
  k2: kid(g3, 238, 34, `<div class="row" style="height:44px;padding:0 18px;border-radius:22px;background:#EEF2F8;color:var(--ink2);font:600 19px Inter;gap:10px"><span style="width:12px;height:12px;border-radius:4px;background:#8A5A3B"></span>Saigon Roast · F&amp;B</div>`),
  k3: kid(g3, 830, 34, `<div class="row" style="height:44px;padding:0 18px;border-radius:22px;border:2px solid var(--line);color:var(--gray);font:600 19px Inter">Draft</div>`),
  lb: kid(g3, 40, 108, `<div style="font:600 19px Inter;color:var(--gray)">Brief</div>`),
  inp: kid(g3, 40, 138, `<div style="width:920px;height:88px;border-radius:18px;background:#F8FAFD;box-sizing:border-box"></div>`),
  txt: kid(g3, 70, 160, `<div style="font:500 32px Inter;color:var(--ink);white-space:nowrap"><span class="ty"></span><span class="caret" style="display:inline-block;width:3px;height:36px;background:var(--teal);vertical-align:-6px;margin-left:2px"></span></div>`),
  ph: kid(g3, 70, 162, `<div style="font:500 30px Inter;color:#A9B5C7">Describe what you need…</div>`),
  tog: kid(g3, 40, 258, `<div style="width:88px;height:50px;border-radius:25px;position:relative"><div class="knob" style="position:absolute;top:5px;height:40px;border-radius:20px;background:#fff;box-shadow:0 2px 6px rgba(14,27,61,.2)"></div></div>`),
  tl: kid(g3, 150, 262, `<div style="font:600 22px Inter;color:var(--ink);line-height:42px">Brand voice <span style="color:var(--gray);font-weight:500">· Saigon Roast: warm, expert, no jargon</span></div>`),
  lc: kid(g3, 40, 338, `<div style="font:600 19px Inter;color:var(--gray)">Channels</div>`),
  btn: kid(g3, 630, 432, `<div class="row disp" style="width:330px;height:76px;border-radius:22px;background:var(--teal);color:#fff;justify-content:center;gap:12px;font-weight:700;font-size:26px">✦ Generate with AI</div>`),
};
const CH3 = ['Website', 'Facebook', 'LinkedIn', 'Instagram'];
const chips3 = CH3.map((n, i) => kid(g3, 40 + i * 206, 368, `<div class="row" style="width:190px;height:58px;border-radius:29px;box-sizing:border-box;justify-content:center;gap:10px;font:600 21px Inter"><span class="ck" style="font-weight:800">✓</span>${n}</div>`));
const BRIEF = "Cold brew at home: a beginner's guide";
const TY0 = b(25.5), TY1 = b(28.5);
const w3 = (x, y) => [O3.x + x, O3.y + y];
// shape: ring → brief card
heroTo(b(24) - 0.08, 0, 0, C3.w, C3.h, 32, '#FFFFFF', SP.card);
HA.to(b(24) - 0.1, 1, { w: 22, z: 1 }); HS.to(b(24), 1, SP.soft);
cam(b(24) - 0.1, 0, 0, vz(1.3, 1.02), { w: 6, z: 1 });
cue(b(24) - 0.08, 'swoosh');
// You: click input, type, toggle, channels, generate
you.O.to(b(24.4), 1, SP.text);
jump(you, 0, vz(520, 380), vz(420, 640));
mv(you, b(25), ...w3(330, 182)); click(you, b(25));
mv(you, b(25.9), ...w3(900, 238), 0.5, SP.soft);
for (let i = 0; i < BRIEF.length; i++) cue(lerp(TY0, TY1, i / BRIEF.length), 'key', { n: i });
mv(you, b(30), ...w3(84, 283)); click(you, b(30), 'toggle');
chips3.forEach((_, i) => { mv(you, b(31 + 0.5 * i), ...w3(135 + i * 206, 397), 0.3, SP.fast); click(you, b(31 + 0.5 * i), 'tick'); });
mv(you, b(34), ...w3(780, 470), 0.6); click(you, b(34));
heroPresses.push(b(34));
const tPress3 = b(34);
function drawScene3(t) {
  if (t < b(23.8) || t > b(36.5)) { g3.style.display = 'none'; return; }
  g3.style.display = '';
  const out = b(34.25);
  const it = [s3.k1, s3.k2, s3.k3, s3.lb, s3.inp, s3.tog, s3.tl, s3.lc, ...chips3];
  it.forEach((el, i) => show(el, vis(t, b(24.3) + i * 0.035, out)));
  show(s3.btn, vis(t, b(24.7), out + 0.05), `scale(${press(t, tPress3).toFixed(4)})`);
  // input focus + typing
  const foc = stepR(t - b(25), SP.snap);
  s3.inp.style.border = `2px solid ${foc > 0.5 ? '#13795B' : '#DCE4EF'}`;
  s3.inp.style.boxShadow = `0 0 0 ${(6 * foc).toFixed(2)}px rgba(19,121,91,${(0.12 * foc).toFixed(3)})`;
  const n = Math.round(clamp((t - TY0) / (TY1 - TY0)) * BRIEF.length);
  s3.txt.querySelector('.ty').textContent = BRIEF.slice(0, n);
  const caretOn = t > b(25) && (t < TY1 + 0.2 || Math.floor(t * 2.2) % 2 === 0);
  show(s3.txt, vis(t, b(25), out));
  s3.txt.querySelector('.caret').style.opacity = caretOn ? 1 : 0;
  show(s3.ph, vis(t, b(24.5), TY0 - 0.05, 0.08));
  // toggle: edge-split knob
  const TOG = b(30);
  const L = new Track(5).to(TOG, 43, SP.trail).at(t), R = new Track(45).to(TOG, 83, SP.lead).at(t);
  const knob = s3.tog.querySelector('.knob');
  knob.style.left = L + 'px'; knob.style.width = (R - L) + 'px';
  const on = clamp((L - 5) / 38);
  s3.tog.style.background = `rgb(${lerp(214, 19, on)},${lerp(222, 121, on)},${lerp(234, 91, on)})`;
  // channel chips
  chips3.forEach((el, i) => {
    const u = stepR(t - b(31 + 0.5 * i), SP.snap);
    const d = el;
    d.style.background = u > 0.02 ? `rgba(19,121,91,${clamp(u)})` : '#fff';
    d.style.border = `2px solid ${u > 0.5 ? '#13795B' : '#DCE4EF'}`;
    d.style.color = u > 0.5 ? '#fff' : '#42506A';
    d.querySelector('.ck').style.display = u > 0.3 ? 'inline' : 'none';
    d.style.transform = `scale(${press(t, b(31 + 0.5 * i)).toFixed(4)})`;
  });
}
// button shrinks into the "Drafting" pill (the hero itself)
const P3 = w3(795, 470);
heroTo(b(34.3), P3[0], P3[1], 360, 84, 42, '#13795B', SP.card);
cam(b(34.3), P3[0] - vz(60, 100), P3[1] - 40, vz(1.75, 1.5), { w: 6.5, z: 1 });
const gPill = group(360, 84);
const pillTxt = kid(gPill, 0, 0, `<div class="row disp" style="width:360px;height:84px;justify-content:center;gap:16px;color:#fff;font-weight:700;font-size:28px"><svg width="34" height="34" viewBox="0 0 34 34"><circle cx="17" cy="17" r="13" fill="none" stroke="rgba(255,255,255,.3)" stroke-width="4"/><path class="spin" d="M17 4 A13 13 0 0 1 30 17" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>Drafting with AI…</div>`);
function drawPill(t) {
  if (!show(pillTxt, vis(t, b(34.55), b(35.85), 0.1))) return;
  pillTxt.querySelector('svg').style.transform = `rotate(${t * 520}deg)`;
}
you.O.to(b(34.8), 0, SP.soft);

// =====================================================================
// SCENE 4 · AI draft (b36–b46)
// =====================================================================
const C4 = V ? { w: 840, h: 1250 } : { w: 1240, h: 660 }, O4 = { x: -C4.w / 2, y: 20 - C4.h / 2 };
const g4 = group(C4.w, C4.h);
const w4 = (x, y) => [O4.x + x, O4.y + y];
const TITLE = 'Cold Brew at Home: The Complete Beginner’s Guide';
const SAPO = 'Smooth, low-acid and easy to make. Here’s how to brew café-quality cold brew in your own kitchen.';
const H2S = ['1. Pick a medium roast', '2. Grind coarse, like sea salt', '3. Steep 12–18 hours, then strain'];
const s4 = {
  hd: kid(g4, 48, 32, `<div class="row" style="gap:12px"><span class="row" style="height:40px;padding:0 16px;border-radius:20px;background:#EEF2F8;color:var(--ink2);font:600 18px Inter">Draft v1</span><span class="row" style="height:40px;padding:0 16px;border-radius:20px;background:#E5F3EE;color:var(--teal);font:700 18px Inter;gap:8px">✓ Saigon Roast voice</span></div>`),
  title: kid(g4, 48, 98, `<div class="disp" style="width:720px;font-weight:700;font-size:42px;line-height:1.18;letter-spacing:-.8px">${TITLE.split(' ').map(w => `<span class="w" style="display:inline-block">${w}&nbsp;</span>`).join('')}</div>`),
  sapo: kid(g4, 48, 214, `<div style="width:700px;font:400 23px Inter;line-height:1.5;color:var(--ink2)">${SAPO.split(' ').map(w => `<span class="w" style="display:inline-block">${w}&nbsp;</span>`).join('')}</div>`),
  div: V ? kid(g4, 48, 638, `<div style="width:744px;height:2px;background:#EDF1F7"></div>`) : kid(g4, 806, 32, `<div style="width:2px;height:596px;background:#EDF1F7"></div>`),
  rl: kid(g4, vz(836, 48), vz(34, 654), `<div style="font:600 19px Inter;color:var(--gray);line-height:40px">Channel versions</div>`),
};
const h2Els = H2S.map((h, i) => kid(g4, 48, 330 + i * 98, `<div><div style="font:700 26px Inter;color:var(--ink)">${h}</div><div class="skel" style="left:0;top:44px;width:${[660, 600, 640][i]}px"></div><div class="skel" style="left:0;top:64px;width:${[480, 520, 430][i]}px"></div></div>`));
const VERS = [
  ['Facebook', '#1877F2', 'f', 'Cold brew, minus the café line. Our 3-step guide is live.'],
  ['LinkedIn', '#0A66C2', 'in', 'Why we teach customers to brew at home, and what it did for loyalty.'],
  ['Instagram', '#E1306C', 'IG', 'Ice. Coffee. Patience. #coldbrew #saigonroast'],
];
const verEls = VERS.map(([n, c, l, x], i) => kid(g4, vz(836, 48), V ? 704 + i * 176 : 92 + i * 184, `<div style="width:${vz(356, 744)}px;height:${vz(164, 156)}px;border-radius:20px;background:var(--soft);border:2px solid #E6ECF5;box-sizing:border-box;padding:18px 20px">
  <div class="row" style="gap:10px;font:700 20px Inter"><span class="ico" style="width:32px;height:32px;border-radius:9px;background:${c};font-size:14px">${l}</span>${n}<span style="margin-left:auto;font:600 15px Inter;color:var(--teal)">✓ Ready</span></div>
  <div style="margin-top:12px;font:400 19px Inter;line-height:1.42;color:var(--ink2)">${x}</div></div>`));
const T4 = { title: b(36.7), titleD: 0.11, sapo: b(38.6), sapoD: 0.07, h2: [b(41), b(41.5), b(42)], ver: [b(42.75), b(43.75), b(44.75)], out: b(45.75) };
function words(el) { return [...el.querySelectorAll('.w')]; }
let W4 = null;
function measure4() { // world-space caret points for the AI cursor
  const tw = words(s4.title), sw = words(s4.sapo);
  const pt = (el, base) => [base.x + el.offsetLeft + el.offsetWidth - 10, base.y + el.offsetTop + el.offsetHeight - 6];
  W4 = { title: tw.map(e => pt(e, { x: 48, y: 98 })), sapo: sw.map(e => pt(e, { x: 48, y: 214 })) };
}
heroTo(b(36) - 0.06, 0, 20, C4.w, C4.h, 28, '#FFFFFF', SP.card);
cam(b(36) - 0.1, 0, 30, vz(1.13, 1.06), { w: 6, z: 1 });
cue(b(36) - 0.06, 'swoosh');
function schedule4() {
  measure4();
  const tw = W4.title, sw = W4.sapo;
  jump(ai, 0, ...w4(60, 120));
  ai.O.to(b(36.2), 1, SP.text);
  tw.forEach((p, i) => { mv(ai, T4.title + i * T4.titleD + 0.08, ...w4(p[0] + 16, p[1]), 0.12, SP.fast); cue(T4.title + i * T4.titleD, 'type', { n: i }); });
  sw.forEach((p, i) => { if (i % 2 === 0 || i === sw.length - 1) mv(ai, T4.sapo + i * T4.sapoD + 0.08, ...w4(p[0] + 16, p[1]), 0.14, SP.fast); if (i % 2 === 0) cue(T4.sapo + i * T4.sapoD, 'type', { n: i + 3, g: 0.6 }); });
  T4.h2.forEach((tt, i) => { mv(ai, tt, ...w4(420, 352 + i * 98), 0.25, SP.fast); cue(tt, 'tick', { n: i }); });
  T4.ver.forEach((tt, i) => { mv(ai, tt, ...(V ? w4(700, 764 + i * 176) : w4(1150, 150 + i * 184)), 0.4); click(ai, tt, 'drop'); });
  ai.O.to(T4.out, 1, SP.text);
}
function drawScene4(t) {
  if (t < b(35.8) || t > b(46.5)) { g4.style.display = 'none'; return; }
  g4.style.display = '';
  const out = T4.out;
  show(s4.hd, vis(t, b(36.3), out)); show(s4.div, vis(t, b(36.4), out)); show(s4.rl, vis(t, b(36.5), out));
  s4.title.style.visibility = s4.sapo.style.visibility = 'visible';
  words(s4.title).forEach((w, i) => show(w, vis(t, T4.title + i * T4.titleD, out, 0.12, 8)));
  words(s4.sapo).forEach((w, i) => show(w, vis(t, T4.sapo + i * T4.sapoD, out, 0.12, 6)));
  h2Els.forEach((el, i) => show(el, vis(t, T4.h2[i], out)));
  verEls.forEach((el, i) => show(el, vis(t, T4.ver[i] - 0.04, out, 0.12, -24), `scale(${lerp(0.86, 1, stepR(t - T4.ver[i] + 0.04, SP.pop)).toFixed(4)})`));
}

// =====================================================================
// SCENE 5 · QC (b46–b56)
// =====================================================================
const C5 = V ? { w: 860, h: 1000 } : { w: 1000, h: 560 }, O5 = { x: -C5.w / 2, y: -C5.h / 2 };
const R5 = V ? { x: 250, y: -20 } : { x: 70, y: 0 }, L5 = V ? { x: 110, y: 470 } : { x: 500, y: 0 };
const g5 = group(C5.w, C5.h);
const w5 = (x, y) => [O5.x + x, O5.y + y];
const CHECKS = ['Spelling & grammar', 'Heading structure', 'Title & meta description', 'Target keywords', 'Image alt text', 'Internal links'];
const s5 = {
  ring: kid(g5, R5.x, 60 + R5.y, `<svg width="360" height="360" viewBox="0 0 360 360"><circle cx="180" cy="180" r="160" fill="none" stroke="#EDF1F7" stroke-width="24"/><circle class="arc" cx="180" cy="180" r="160" fill="none" stroke="#13795B" stroke-width="24" stroke-linecap="round" transform="rotate(-90 180 180)" stroke-dasharray="1005.3 1005.3"/></svg>`),
  lbl: kid(g5, R5.x, 166 + R5.y, `<div style="width:360px;text-align:center;font:600 20px Inter;color:var(--gray)">QC score</div>`),
  num: kid(g5, R5.x, 196 + R5.y, `<div class="row disp" style="width:360px;justify-content:center;align-items:baseline;gap:4px;font-weight:800;color:var(--ink)"></div>`),
  of: kid(g5, R5.x, 296 + R5.y, `<div style="width:360px;text-align:center;font:600 22px Inter;color:var(--gray)">out of 100</div>`),
  hd: kid(g5, L5.x, 58 + L5.y, `<div style="font:700 26px Inter">Quality &amp; SEO checklist</div>`),
  stamp: kid(g5, vz(135, 315), vz(452, 418), `<div class="row disp" style="width:230px;height:62px;border-radius:31px;justify-content:center;gap:10px;background:#24B24B;color:#fff;font-weight:700;font-size:24px">✓ Passed QC</div>`),
};
const qcOdo = new Odo(s5.num, '92.4', 96, 'disp', 'font-weight:800;letter-spacing:-2px');
const rows5 = CHECKS.map((c, i) => kid(g5, L5.x, 118 + L5.y + i * 64, `<div class="row" style="gap:18px;font:500 24px Inter;color:var(--ink);height:48px">
  <span class="cb" style="width:38px;height:38px;border-radius:50%;box-sizing:border-box;display:flex;align-items:center;justify-content:center;color:#fff;font:800 20px Inter"></span>${c}${i === 5 ? '<span class="add" style="margin-left:6px;height:34px;padding:0 12px;border-radius:17px;background:#E5F3EE;color:var(--teal);font:700 17px Inter;display:inline-flex;align-items:center">+3 added</span>' : ''}</div>`));
const T5 = { in: b(46.12), score0: b(47.5), score1: b(53.5), ck: CHECKS.map((_, i) => b(48 + i)), stamp: b(54), out: b(55.75) };
heroTo(b(46) - 0.06, 0, 0, C5.w, C5.h, 30, '#FFFFFF', SP.card);
cam(b(46) - 0.1, 0, 0, vz(1.3, 1.15), { w: 6, z: 1 });
cue(b(46) - 0.06, 'swoosh');
T5.ck.forEach((tt, i) => { mv(ai, tt, ...w5(L5.x + 20, 142 + L5.y + i * 64), 0.32, SP.fast); click(ai, tt, 'check'); });
cue(T5.stamp, 'stamp');
ai.O.to(T5.ck[5] + 0.6, 0, SP.soft);
function drawScene5(t) {
  if (t < b(45.8) || t > b(56.5)) { g5.style.display = 'none'; return; }
  g5.style.display = '';
  const out = T5.out;
  [s5.ring, s5.lbl, s5.num, s5.of, s5.hd].forEach((el, i) => show(el, vis(t, T5.in + i * 0.04, out)));
  const u = outQ((t - T5.score0) / (T5.score1 - T5.score0));
  qcOdo.set(u);
  s5.ring.querySelector('.arc').setAttribute('stroke-dashoffset', (1005.3 * (1 - 0.924 * u)).toFixed(2));
  rows5.forEach((el, i) => {
    show(el, vis(t, T5.in + 0.15 + i * 0.05, out));
    const k = stepR(t - T5.ck[i], SP.pop), cb = el.querySelector('.cb');
    cb.style.background = k > 0.02 ? `rgba(19,121,91,${clamp(k)})` : 'transparent';
    cb.style.border = k > 0.5 ? 'none' : '3px solid #CBD5E3';
    cb.textContent = k > 0.2 ? '✓' : '';
    cb.style.transform = `scale(${(k > 0.02 ? lerp(0.6, 1, k) : 1).toFixed(4)})`;
    const add = el.querySelector('.add'); if (add) show(add, vis(t, T5.ck[i] + 0.12, out), `scale(${lerp(0.7, 1, stepR(t - T5.ck[i] - 0.12, SP.pop)).toFixed(3)})`);
  });
  show(s5.stamp, vis(t, T5.stamp - 0.04, out, 0.12, 0), `scale(${lerp(1.5, 1, stepR(t - T5.stamp + 0.04, SP.pop)).toFixed(4)}) rotate(${lerp(-8, -3, stepR(t - T5.stamp, SP.pop)).toFixed(2)}deg)`);
}

// =====================================================================
// SCENE 6 · Approval (b56–b68), the build
// =====================================================================
const C6 = V ? { w: 980, h: 520 } : { w: 1440, h: 450 }, O6 = { x: -C6.w / 2, y: -C6.h / 2 };
const g6 = group(C6.w, C6.h);
const w6 = (x, y) => [O6.x + x, O6.y + y];
const STATES = V ? ['Draft', 'Editing', 'Review', 'Approved', 'Scheduled', 'Live'] : ['Draft', 'Editing', 'Pending approval', 'Approved', 'Scheduled', 'Published'];
const TRK = { x: 56, y: 156, w: vz(1328, 868), h: 76 }, IW = TRK.w / 6;
const s6 = {
  title: kid(g6, 56, 44, `<div class="disp" style="font-weight:700;font-size:36px;letter-spacing:-.6px">Cold brew at home: a beginner’s guide</div>`),
  sub: kid(g6, 56, 98, `<div style="font:500 21px Inter;color:var(--gray)">v3 · Saigon Roast · Website + 3 channels</div>`),
  trk: kid(g6, TRK.x, TRK.y, `<div style="width:${TRK.w}px;height:${TRK.h}px;border-radius:38px;background:#EEF2F8"><div class="ind" style="position:absolute;top:6px;height:${TRK.h - 12}px;border-radius:32px;background:var(--teal)"></div></div>`),
  who: kid(g6, 56, 276, `<div class="row" style="gap:16px;height:64px"><span class="ico" style="width:52px;height:52px;border-radius:50%;background:#228ECD;font-size:22px">L</span><span style="font:600 23px Inter">Linh Tran <span style="color:var(--gray);font-weight:500">· Approver · reviewing v3</span></span></div>`),
  rq: kid(g6, vz(900, 450), vz(276, 350), `<div class="row" style="width:230px;height:64px;border-radius:20px;border:2px solid var(--line);box-sizing:border-box;justify-content:center;font:600 21px Inter;color:var(--ink2)">Request changes</div>`),
  ap: kid(g6, vz(1150, 700), vz(276, 350), `<div class="row disp" style="width:234px;height:64px;border-radius:20px;background:var(--teal);color:#fff;justify-content:center;gap:10px;font-weight:700;font-size:24px">✓ Approve</div>`),
  sch: kid(g6, vz(1000, 550), vz(276, 350), `<div class="row" style="width:384px;height:64px;border-radius:20px;border:2px solid var(--teal);box-sizing:border-box;justify-content:center;gap:12px;font:700 21px Inter;color:var(--teal)"><span>◷</span>Schedule · Tomorrow 8:00 AM</div>`),
  log: kid(g6, 56, vz(372, 446), `<div class="row" style="gap:12px;font:500 20px Inter;color:var(--ink2)"><span style="color:var(--teal);font-weight:800">✓</span>Approved by Linh · 15:30 · v3 <span class="lg2" style="margin-left:18px;color:var(--gray)">→ Scheduled · Tomorrow 8:00 AM</span></div>`),
};
const stEls = STATES.map((s, i) => mk(`<div style="position:absolute;top:0;left:${i * IW}px;width:${IW}px;height:${TRK.h}px;display:flex;align-items:center;justify-content:center;font:600 ${vz(21, 19)}px Inter;white-space:nowrap">${s}</div>`, s6.trk));
const T6 = { in: b(56.12), st: [[b(56), 1], [b(57), 2], [b(60), 3], [b(62.5), 4]], ap: b(60), sch: b(62.5), push: b(64), out: b(65.4) };
const indL = new Track(IW * 0 + 4), indR = new Track(IW * 1 - 4);
for (const [tt, k] of T6.st) { indL.to(tt, IW * k + 4, SP.trail); indR.to(tt, IW * (k + 1) - 4, SP.lead); }
heroTo(b(56) - 0.06, 0, 0, C6.w, C6.h, 30, '#FFFFFF', SP.card);
cam(b(56) - 0.1, 0, 0, vz(1.18, 1.05), { w: 6, z: 1 });
cue(b(56) - 0.06, 'swoosh');
T6.st.slice(1).forEach(([tt]) => cue(tt, 'slide'));
// Linh drives the approval
you.labels.push([b(57.4), 'Linh · Approver']);
jump(you, b(57), vz(760, 440), vz(420, 760));
you.O.to(b(58), 1, SP.text);
mv(you, T6.ap, ...w6(vz(1270, 820), vz(310, 384)), 0.6); click(you, T6.ap, 'approve');
mv(you, T6.sch, ...w6(vz(1250, 800), vz(310, 384)), 0.5); click(you, T6.sch);
// push in on "Published": the card becomes the Publish button
const PUB = w6(TRK.x + IW * 5.5, TRK.y + TRK.h / 2);
cam(T6.push, PUB[0] - vz(120, 60), PUB[1], vz(1.75, 1.6), { w: 3.2, z: 1 });
mv(you, b(65.2), PUB[0] + 160, PUB[1] + 70, 0.8, SP.soft);
heroTo(T6.out + 0.05, PUB[0], PUB[1], 440, 132, 66, '#13795B', SP.card);
HS.to(T6.out + 0.05, 1);
cam(T6.out + 0.1, PUB[0], PUB[1] + 10, vz(1.55, 1.45), { w: 5, z: 1 });
const gBtn = group(440, 132);
const pubTxt = kid(gBtn, 0, 0, `<div class="row disp" style="width:440px;height:132px;justify-content:center;gap:18px;color:#fff;font-weight:800;font-size:44px;letter-spacing:-.5px">Publish now <svg width="40" height="40" viewBox="0 0 40 40"><path d="M6 20 H32 M22 9 L33 20 L22 31" fill="none" stroke="#fff" stroke-width="5" stroke-linecap="round" stroke-linejoin="round"/></svg></div>`);
mv(you, b(67.4), PUB[0] + 70, PUB[1] + 20, 0.7, SP.soft);
you.holds.push([b(67.5), b(68)]); cue(b(67.5), 'pressdown');
click(you, b(68), 'release');
cue(b(64), 'riser', { d: 3.5 });
function drawScene6(t) {
  if (t < b(55.8) || t > b(66.2)) { g6.style.display = 'none'; } else {
    g6.style.display = '';
    const out = T6.out;
    [s6.title, s6.sub, s6.trk, s6.who].forEach((el, i) => show(el, vis(t, T6.in + i * 0.05, out)));
    show(s6.rq, vis(t, b(58), b(60.6))); show(s6.ap, vis(t, b(58.2), b(60.6)), `scale(${press(t, T6.ap).toFixed(4)})`);
    show(s6.sch, vis(t, b(61.2), out), `scale(${press(t, T6.sch).toFixed(4)})`);
    show(s6.log, vis(t, b(60.6), out));
    show(s6.log.querySelector('.lg2'), vis(t, b(62.8), out));
    const L = indL.at(t), R = indR.at(t), ind = s6.trk.querySelector('.ind');
    ind.style.left = L + 'px'; ind.style.width = Math.max(0, R - L) + 'px';
    stEls.forEach((el, i) => {
      const c0 = i * IW, c1 = c0 + IW, cov = clamp((Math.min(R, c1 - 20) - Math.max(L, c0 + 20)) / (IW - 40));
      el.style.color = `rgb(${lerp(107, 255, cov)},${lerp(122, 255, cov)},${lerp(147, 255, cov)})`;
      el.style.fontWeight = i === 5 ? 700 : 600;
    });
  }
  show(pubTxt, vis(t, T6.out + 0.25, b(68) + 0.02, 0.1));
}

// =====================================================================
// SCENE 7 · Publish, the drop (b68–b84)
// =====================================================================
const G = { x: PUB[0], y: PUB[1] };
const CW = 520, CHh = 400, PX = 580, PY = 460;
const CHANNELS = [
  ['Your website', '#19479D', 'W', 'saigonroast.vn'], ['WordPress', '#21759B', 'Wp', 'blog.saigonroast.vn'], ['Facebook', '#1877F2', 'f', '@saigonroast'],
  ['LinkedIn', '#0A66C2', 'in', 'Saigon Roast'], ['Instagram', '#E1306C', 'IG', '@saigonroast'], ['X', '#111111', 'X', '@saigonroast'],
];
const COL0 = vz(0, -PX / 2), ROW0 = vz(-PY / 2, -PY);
const SLOTS = (V ? [[0, 0], [1, 0], [0, 1], [1, 1], [0, 2], [1, 2]] : [[-1, 0], [0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]]).map(([i, j]) => [G.x + COL0 + i * PX, G.y + ROW0 + j * PY]);
function glass(scale = 1) {
  return `<svg width="${476 * scale}" height="${190 * scale}" viewBox="0 0 476 190"><rect width="476" height="190" rx="16" fill="#F2E6D8"/>
    <circle cx="380" cy="60" r="70" fill="#EAD8C4"/><rect x="40" y="150" width="400" height="14" rx="7" fill="#E6D3BE"/>
    <path d="M196 40 L280 40 L270 160 Q268 170 258 170 L218 170 Q208 170 206 160 Z" fill="#5B3A26"/>
    <path d="M196 40 L280 40 L278 64 L198 64 Z" fill="#8A5A3B"/>
    <rect x="214" y="78" width="22" height="22" rx="4" fill="#fff" opacity=".55" transform="rotate(12 225 89)"/>
    <rect x="242" y="98" width="20" height="20" rx="4" fill="#fff" opacity=".45" transform="rotate(-10 252 108)"/>
    <rect x="252" y="12" width="7" height="80" rx="3.5" fill="#24B24B" transform="rotate(14 255 52)"/></svg>`;
}
function channelCard(c, big) {
  const [n, col, l, hdl] = c;
  return `<div style="width:${CW}px;height:${CHh}px;border-radius:26px;background:#fff;box-sizing:border-box;padding:22px;box-shadow:0 24px 70px rgba(25,71,157,.12),0 2px 6px rgba(14,27,61,.06)">
    <div class="row" style="gap:14px"><span class="ico" style="width:46px;height:46px;border-radius:13px;background:${col};font-size:${l.length > 1 ? 17 : 22}px">${l}</span>
    <div><div style="font:700 22px Inter">${n}</div><div style="font:500 16px Inter;color:var(--gray)">${hdl}</div></div>
    <span class="live" style="margin-left:auto;height:36px;padding:0 14px;border-radius:18px;background:#E3F5E8;color:#168A3A;font:700 17px Inter;display:inline-flex;align-items:center;gap:8px"><span style="width:10px;height:10px;border-radius:50%;background:#24B24B"></span>Live</span></div>
    <div style="margin-top:16px">${glass()}</div>
    <div style="margin-top:14px;font:700 24px Inter;line-height:1.25">Cold brew at home: a beginner’s guide</div></div>`;
}
const cardEls = CHANNELS.map((c, i) => i === 0 ? null : mk(`<div class="abs">${channelCard(c)}</div>`, world));
const g7 = group(CW, CHh);
const heroCard = kid(g7, 0, 0, channelCard(CHANNELS[0]));
heroCard.style.boxShadow = 'none';
const T7 = { c: CHANNELS.map((_, i) => b(68 + i)), pull: b(76), push: b(81.5), out: b(82.6) };
// hero: Publish button → first channel card
heroTo(b(68), SLOTS[0][0], SLOTS[0][1], CW, CHh, 26, '#FFFFFF', SP.card);
cam(b(68), G.x, G.y + vz(30, 0), 0.86, { w: 7, z: 1 });
T7.c.forEach((tt, i) => { cue(tt, 'slam', { n: i }); cue(tt + 0.25, 'tick', { n: i + 2, g: 0.5 }); });
you.O.to(b(68.6), 0, SP.soft);
const cap7 = mk(`<div class="abs disp" style="width:${SW}px;top:${vz(962, 1520)}px;text-align:center;font-weight:800;font-size:52px;letter-spacing:-1.2px;color:var(--navy)">One click. Every channel.</div>`, hud);
// the wall
const wall = mk(`<div class="abs"></div>`, world);
const tiles = [];
const TCOL = ['#19479D', '#21759B', '#1877F2', '#0A66C2', '#E1306C', '#111111', '#24B24B', '#228ECD'];
for (let j = vz(-8, -13); j <= vz(9, 15); j++) for (let i = vz(-12, -7); i <= vz(12, 8); i++) {
  const sl = SLOTS.findIndex(([x, y]) => Math.abs(x - (G.x + COL0 + i * PX)) < 1 && Math.abs(y - (G.y + ROW0 + j * PY)) < 1);
  if (sl >= 0) continue;
  const d = V ? Math.hypot(i - 0.5, (j - 1) * 1.2) : Math.hypot(i, (j - 0.5) * 1.2), k = Math.abs((i * 7 + j * 13) % 8);
  const el = mk(`<div class="abs" style="width:${CW}px;height:${CHh}px;border-radius:26px;background:#fff;box-sizing:border-box;padding:28px;box-shadow:0 18px 50px rgba(25,71,157,.10)">
    <div class="row" style="gap:16px"><span style="width:56px;height:56px;border-radius:15px;background:${TCOL[k]}"></span><span style="width:${150 + (k * 37) % 140}px;height:20px;border-radius:10px;background:#E6ECF5"></span>
    <span style="margin-left:auto;width:90px;height:40px;border-radius:20px;background:#E3F5E8"></span></div>
    <div style="margin-top:22px;height:170px;border-radius:16px;background:${['#F2E6D8', '#E3EEF9', '#E3F5E8', '#FCEBDD'][k % 4]}"></div>
    <div style="margin-top:22px;width:${300 + (k * 53) % 150}px;height:22px;border-radius:11px;background:#DCE4EF"></div>
    <div style="margin-top:14px;width:${200 + (k * 29) % 120}px;height:22px;border-radius:11px;background:#E6ECF5"></div></div>`, wall);
  el.style.transform = `translate(${G.x + COL0 + i * PX - CW / 2}px,${G.y + ROW0 + j * PY - CHh / 2}px)`;
  tiles.push({ el, d });
}
const plate = mk(`<div class="abs" style="width:700px;height:300px;border-radius:44px;background:#fff;box-shadow:0 30px 90px rgba(14,27,61,.20);display:flex;flex-direction:column;align-items:center;justify-content:center"></div>`, hud);
const pubOdo = new Odo(plate, '1,240', 140, 'disp', 'font-weight:800;letter-spacing:-4px;color:var(--navy)');
mk(`<div style="font:600 34px Inter;color:var(--ink2);margin-top:6px">posts published</div>`, plate);
cam(T7.pull, G.x, G.y + 40, 0.165, { w: 4.2, z: 1 });
cue(T7.pull, 'whoosh', { g: 1 });
cue(b(77.2), 'roll', { d: 2.6 });
const P1 = SLOTS[0];
cam(T7.push, P1[0], P1[1], 1.0, { w: 3.6, z: 1 });
cue(T7.push, 'whoosh', { g: 0.8 });
function drawScene7(t) {
  const on = t > b(67.6) && t < b(84);
  g7.style.display = on ? '' : 'none';
  if (on) { show(heroCard, vis(t, b(68) + 0.06, T7.out, 0.12, 0)); const lv = heroCard.querySelector('.live'); show(lv, vis(t, T7.c[0] + 0.25, T7.out), `scale(${lerp(0.5, 1, stepR(t - T7.c[0] - 0.25, SP.pop)).toFixed(3)})`); }
  cardEls.forEach((el, i) => {
    if (!el) return;
    const tt = T7.c[i];
    if (t < tt - 0.1 || t > T7.push + 0.8) { el.style.display = 'none'; return; }
    el.style.display = '';
    const e = stepR(t - tt + 0.08, SP.card), o = clamp(stepR(t - tt + 0.08, SP.text) * 1.5) * (1 - smooth((t - T7.push - 0.1) / 0.5));
    const x = lerp(G.x, SLOTS[i][0], e), y = lerp(G.y, SLOTS[i][1], e);
    el.style.visibility = 'visible'; el.style.opacity = o;
    el.style.filter = e < 0.85 ? `blur(${((1 - e) * 10).toFixed(2)}px)` : 'none';
    el.style.transform = `translate(${x - CW / 2}px,${y - CHh / 2}px) scale(${lerp(0.4, 1, e).toFixed(4)})`;
    const lv = el.querySelector('.live'); show(lv, vis(t, tt + 0.25, null), `scale(${lerp(0.5, 1, stepR(t - tt - 0.25, SP.pop)).toFixed(3)})`);
  });
  show(cap7, vis(t, b(69), b(75.6), 0.14, 20));
  const wv = t > T7.pull - 0.2 && t < T7.push + 1.0;
  wall.style.display = wv ? '' : 'none';
  if (wv) tiles.forEach(({ el, d }) => {
    const e = stepR(t - (T7.pull + 0.1 + d * 0.055), SP.text) * (1 - smooth((t - T7.push - 0.05) / 0.45));
    if (e < 0.003) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = 'visible'; el.style.opacity = e.toFixed(3);
  });
  if (show(plate, vis(t, b(77), b(81.3), 0.16, 0), `scale(${lerp(0.8, 1, stepR(t - b(77), SP.pop)).toFixed(4)})`)) {
    plate.style.transform = `translate(${SCX - 350}px,${SCY - 150}px) ${plate.style.transform}`;
    pubOdo.set(outQ((t - b(77.2)) / 2.6));
  }
}

// =====================================================================
// SCENE 8 · Measure (b84–b100)
// =====================================================================
const C8 = V ? { w: 996, h: 1410 } : { w: 1520, h: 800 }, O8 = { x: P1[0] - C8.w / 2, y: P1[1] - C8.h / 2 };
const CHART_Y = vz(316, 500), TOP = V ? { x: 48, y: 970, w: 900, h: 400 } : { x: 972, y: 316, w: 500, h: 446 }, TW = TOP.w - 56;
const g8 = group(C8.w, C8.h);
const w8 = (x, y) => [O8.x + x, O8.y + y];
const KPIS = [['Views', '24K', '30%', '#228ECD', '◉'], ['Likes', '1.2K', '49%', '#24B24B', '♥'], ['Comments', '2K', '12%', '#19479D', '❝'], ['Shares', '4K', '3%', '#F4A04C', '↗']];
const s8 = {
  hd: kid(g8, 48, 34, `<div class="disp" style="font-weight:700;font-size:36px;letter-spacing:-.6px">Performance</div>`),
  sub: kid(g8, 48, 84, `<div style="font:500 20px Inter;color:var(--gray)">Last 30 days · all channels</div>`),
  chs: kid(g8, vz(1160, 634), 44, `<div class="row" style="gap:10px">${CHANNELS.map(([, c, l]) => `<span class="ico" style="width:44px;height:44px;border-radius:12px;background:${c};font-size:${l.length > 1 ? 15 : 19}px">${l}</span>`).join('')}</div>`),
  chart: kid(g8, 48, CHART_Y, `<div style="width:900px;height:446px;border-radius:22px;background:var(--soft);border:2px solid #E9EEF6;box-sizing:border-box"></div>`),
  top: kid(g8, TOP.x, TOP.y, `<div style="width:${TOP.w}px;height:${TOP.h}px;border-radius:22px;background:var(--soft);border:2px solid #E9EEF6;box-sizing:border-box;padding:26px 28px"><div style="font:700 22px Inter">Top content</div></div>`),
};
const kpiEls = KPIS.map(([n, v, d, c, ic], i) => {
  const el = kid(g8, V ? 48 + (i % 2) * 460 : 48 + i * 362, V ? 132 + Math.floor(i / 2) * 176 : 132, `<div style="width:${vz(340, 440)}px;height:156px;border-radius:22px;background:var(--soft);border:2px solid #E9EEF6;box-sizing:border-box;padding:22px 24px">
    <div class="row" style="gap:12px;font:600 21px Inter;color:var(--gray)"><span class="ico" style="width:38px;height:38px;border-radius:50%;background:${c}1F;color:${c};font-size:19px">${ic}</span>${n}</div>
    <div class="row vrow" style="margin-top:14px;gap:16px;align-items:center"></div></div>`);
  const vr = el.querySelector('.vrow');
  const odo = new Odo(vr, v, 58, 'disp', 'font-weight:800;letter-spacing:-1.5px');
  mk(`<span class="row" style="height:34px;padding:0 12px;border-radius:17px;background:#E3F5E8;color:#168A3A;font:700 18px Inter">↑ ${d}</span>`, vr);
  return { el, odo };
});
// chart series
const CHW = 820, CHH = 300, CHX = 40, CHY = 110, NPT = 30;
const ser = k => Array.from({ length: NPT }, (_, i) => { const x = i / (NPT - 1); return 0.42 + 0.22 * Math.sin(x * 9.2 + k * 0.6) + 0.16 * x + 0.06 * Math.sin(x * 23 + k * 2) - k * 0.06 + (i === 22 ? 0.18 : 0) * (1 - k * 0.3); });
const pathD = ys => ys.map((y, i) => { const X = CHX + CHW * i / (NPT - 1), Y = CHY + CHH * (1 - clamp(y, 0.02, 0.98)); return (i ? 'L' : 'M') + X.toFixed(1) + ' ' + Y.toFixed(1); }).join(' ');
const S1 = ser(0), S2 = ser(1);
const chartSvg = mk(`<svg class="abs" width="900" height="446" style="left:0;top:0">
  <defs><linearGradient id="ar" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#24B24B" stop-opacity=".22"/><stop offset="1" stop-color="#24B24B" stop-opacity="0"/></linearGradient></defs>
  <text x="40" y="58" font-family="Inter" font-weight="700" font-size="22" fill="#0E1B3D">Created vs. published</text>
  <circle cx="560" cy="51" r="7" fill="#19479D"/><text x="574" y="58" font-family="Inter" font-weight="600" font-size="18" fill="#6B7A93">Created</text>
  <circle cx="680" cy="51" r="7" fill="#24B24B"/><text x="694" y="58" font-family="Inter" font-weight="600" font-size="18" fill="#6B7A93">Published</text>
  ${[0, 1, 2, 3].map(i => `<line x1="${CHX}" x2="${CHX + CHW}" y1="${CHY + i * CHH / 3}" y2="${CHY + i * CHH / 3}" stroke="#E3E9F2" stroke-width="2"/>`).join('')}
  <path class="area" d="${pathD(S2)} L${CHX + CHW} ${CHY + CHH} L${CHX} ${CHY + CHH} Z" fill="url(#ar)"/>
  <path class="l1" d="${pathD(S1)}" fill="none" stroke="#19479D" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  <path class="l2" d="${pathD(S2)}" fill="none" stroke="#24B24B" stroke-width="5" stroke-linejoin="round" stroke-linecap="round"/>
  <line class="gd" x1="0" x2="0" y1="${CHY}" y2="${CHY + CHH}" stroke="#19479D" stroke-width="2" stroke-dasharray="6 6"/>
  <circle class="dot" r="11" fill="#fff" stroke="#24B24B" stroke-width="5"/>
</svg>`, s8.chart);
const PK = 22, PKX = CHX + CHW * PK / (NPT - 1), PKY = CHY + CHH * (1 - S2[PK]);
const tip = kid(s8.chart, PKX - 150, PKY - 118, `<div style="width:300px;height:86px;border-radius:16px;background:#0E1B3D;color:#fff;box-sizing:border-box;padding:14px 18px"><div style="font:700 19px Inter">Cold brew at home</div><div style="font:500 17px Inter;color:#B9C6DA;margin-top:4px">8.4K views · Website + 3 channels</div></div>`);
const TOPS = [['Cold brew at home: guide', 'Likes', 0.92, '#13795B'], ['Product intro video', 'Views', 0.74, '#228ECD'], ['Barista tips & stories', 'Comments', 0.58, '#19479D']];
const topEls = TOPS.map(([n, ty, f, c], i) => mk(`<div class="abs" style="left:28px;top:${84 + i * vz(116, 104)}px;width:${TW}px">
  <div class="row" style="gap:12px"><span class="row disp" style="width:40px;height:40px;border-radius:12px;background:${c}1A;color:${c};justify-content:center;font-weight:800;font-size:18px">#${i + 1}</span>
  <div><div style="font:600 21px Inter">${n}</div><div style="font:500 16px Inter;color:var(--gray)">${ty}</div></div></div>
  <div style="margin-top:14px;height:12px;border-radius:6px;background:#E3E9F2"><div class="fill" style="height:12px;border-radius:6px;background:${c}"></div></div></div>`, s8.top));
const T8 = { in: b(83), k: [b(84), b(85), b(86), b(87)], c0: b(88), c1: b(90.5), hov: b(92.3), top: [b(94), b(95), b(96)], out: b(99.6) };
heroTo(b(82.6), P1[0], P1[1], C8.w, C8.h, 30, '#FFFFFF', SP.card);
HS.to(b(82.6), 1);
cam(b(82.4), P1[0], P1[1] + 10, vz(1.09, 0.95), { w: 5, z: 1 });
cue(b(82.6), 'swoosh');
T8.k.forEach((tt, i) => { cue(tt, 'slam', { n: i + 1, g: 0.55 }); cue(tt + 0.05, 'roll', { d: 0.8, g: 0.5 }); });
cue(T8.c0, 'draw', { d: 2.5 });
T8.top.forEach((tt, i) => cue(tt, 'tick', { n: 4 + i }));
you.labels.push([b(88), 'You']);
jump(you, b(88), P1[0] + vz(700, 420), P1[1] + vz(500, 900));
you.O.to(b(90.5), 1, SP.text);
const PKW = w8(48 + PKX, CHART_Y + PKY);
mv(you, T8.hov, PKW[0] + 12, PKW[1] + 26, 0.7, SP.soft); cue(T8.hov, 'blip', { n: 4 });
T8.top.forEach((tt, i) => mv(you, tt, ...w8(TOP.x + TOP.w - 120, TOP.y + 84 + i * vz(116, 104) + 64), 0.4));
you.O.to(b(97.5), 0, SP.soft);
function drawScene8(t) {
  if (t < b(82.3) || t > b(100.5)) { g8.style.display = 'none'; return; }
  g8.style.display = '';
  const out = T8.out;
  [s8.hd, s8.sub, s8.chs].forEach((el, i) => show(el, vis(t, T8.in + i * 0.05, out)));
  kpiEls.forEach(({ el, odo }, i) => { show(el, vis(t, T8.k[i] - 0.05, out), `scale(${lerp(0.85, 1, stepR(t - T8.k[i] + 0.05, SP.pop)).toFixed(4)})`); odo.set(outQ((t - T8.k[i]) / 0.9)); });
  show(s8.chart, vis(t, b(87.4), out)); show(s8.top, vis(t, b(87.6), out));
  const u = smooth((t - T8.c0) / (T8.c1 - T8.c0));
  for (const [cls, L] of [['l1', 1900], ['l2', 1900]]) { const p = chartSvg.querySelector('.' + cls); p.setAttribute('stroke-dasharray', `${L} ${L}`); p.setAttribute('stroke-dashoffset', (L * (1 - u)).toFixed(1)); }
  chartSvg.querySelector('.area').style.opacity = smooth((t - T8.c1 + 0.6) / 0.7);
  const hv = vis(t, T8.hov, out);
  const gd = chartSvg.querySelector('.gd'), dot = chartSvg.querySelector('.dot');
  gd.setAttribute('x1', PKX); gd.setAttribute('x2', PKX); gd.style.opacity = hv.o;
  dot.setAttribute('cx', PKX); dot.setAttribute('cy', PKY); dot.style.opacity = hv.o;
  dot.setAttribute('r', (11 * lerp(0.3, 1, stepR(t - T8.hov, SP.pop))).toFixed(2));
  show(tip, vis(t, T8.hov + 0.08, out, 0.12, 12));
  topEls.forEach((el, i) => { show(el, vis(t, T8.top[i] - 0.25, out)); el.querySelector('.fill').style.width = (TW * TOPS[i][2] * outQ((t - T8.top[i]) / 0.7)).toFixed(1) + 'px'; });
}

// =====================================================================
// SCENE 9 · AI cost (b100–b108)
// =====================================================================
const C9 = V ? { w: 996, h: 940 } : { w: 1240, h: 620 }, O9 = { x: P1[0] - C9.w / 2, y: P1[1] - C9.h / 2 };
const BW = vz(1144, 900), DY9 = vz(0, 124);
const g9 = group(C9.w, C9.h);
const w9 = (x, y) => [O9.x + x, O9.y + y];
const PROV = [['Anthropic Claude', 0.46, '#228ECD'], ['OpenAI', 0.22, '#19479D'], ['Google Gemini', 0.22, '#24B24B'], ['DeepSeek', 0.10, '#F4A04C']];
const s9 = {
  hd: kid(g9, 48, 40, `<div class="disp" style="font-weight:700;font-size:38px;letter-spacing:-.6px">AI usage</div>`),
  sub: kid(g9, 48, 94, `<div style="font:500 20px Inter;color:var(--gray)">Last 30 days · all projects</div>`),
  tk: kid(g9, vz(640, 48), vz(36, 150), `<div><div style="font:600 19px Inter;color:var(--gray)">Tokens</div><div class="v"></div></div>`),
  cs: kid(g9, vz(950, 420), vz(36, 150), `<div><div style="font:600 19px Inter;color:var(--gray)">Est. cost</div><div class="v"></div></div>`),
  bar: kid(g9, 48, 176 + vz(0, 96), `<div style="width:${BW}px;height:52px;border-radius:26px;background:#EEF2F8;overflow:hidden;display:flex;gap:4px"></div>`),
  lg: kid(g9, 48, 252 + vz(0, 96), `<div class="row" style="width:${BW}px;flex-wrap:wrap;row-gap:12px;column-gap:${vz(40, 36)}px;font:600 20px Inter;color:var(--ink2)">${PROV.map(([n, f, c]) => `<span class="row" style="gap:10px"><span style="width:14px;height:14px;border-radius:50%;background:${c}"></span>${n} <span style="color:var(--gray);font-weight:500">${Math.round(f * 100)}%</span></span>`).join('')}</div>`),
  ml: kid(g9, 48, 336 + DY9, `<div style="font:600 19px Inter;color:var(--gray)">Default model · Saigon Roast</div>`),
  dd: kid(g9, 48, 370 + DY9, `<div class="row" style="width:440px;height:76px;border-radius:20px;border:2px solid var(--line);box-sizing:border-box;padding:0 24px;gap:14px;font:600 25px Inter;background:#fff"><span class="mdot" style="width:14px;height:14px;border-radius:50%"></span><span class="mn" style="position:relative;display:inline-block;width:300px;height:32px"><span class="m1 abs">Claude Sonnet</span><span class="m2 abs">Gemini Flash</span></span><span style="margin-left:auto;color:var(--gray)">⌄</span></div>`),
  menu: kid(g9, 48, 454 + DY9, `<div style="width:440px;border-radius:20px;background:#fff;box-shadow:0 20px 60px rgba(14,27,61,.16);padding:8px;box-sizing:border-box;font:600 22px Inter">${['GPT-4.1 mini', 'Gemini Flash', 'DeepSeek V3'].map((m, i) => `<div class="mo row" style="height:52px;padding:0 18px;border-radius:14px;gap:12px"><span style="width:12px;height:12px;border-radius:50%;background:${['#19479D', '#24B24B', '#F4A04C'][i]}"></span>${m}</div>`).join('')}</div>`),
  msg: kid(g9, vz(560, 48), vz(386, 800), `<div class="disp" style="width:620px;font-weight:700;font-size:34px;line-height:1.25;letter-spacing:-.6px;color:var(--navy)">Switch models anytime.<br><span style="color:var(--ink)">No vendor lock-in.</span></div>`),
};
const segs = PROV.map(([, f, c]) => mk(`<div style="height:52px;background:${c};flex:none"></div>`, s9.bar));
const tokOdo = new Odo(s9.tk.querySelector('.v'), '315,502', 54, 'disp', 'font-weight:800;letter-spacing:-1.5px');
const costOdo = new Odo(s9.cs.querySelector('.v'), '$2.32', 54, 'disp', 'font-weight:800;letter-spacing:-1.5px;color:var(--teal)');
const T9 = { in: b(100.05), seg: PROV.map((_, i) => b(100.6 + i * 0.5)), odo0: b(100.6), dd: b(103.5), pick: b(105), msg: b(105.6), out: b(107.3) };
heroTo(b(99.9), P1[0], P1[1], C9.w, C9.h, 30, '#FFFFFF', SP.card);
cam(b(99.8), P1[0], P1[1], vz(1.22, 1.08), { w: 6, z: 1 });
cue(b(99.9), 'swoosh');
T9.seg.forEach((tt, i) => cue(tt, 'blip', { n: i + 1 }));
cue(T9.odo0, 'roll', { d: 2.0, g: 0.6 });
you.O.to(b(102.4), 1, SP.text);
jump(you, b(101), P1[0] + 300, P1[1] + vz(420, 700));
mv(you, T9.dd, ...w9(330, 408 + DY9), 0.6); click(you, T9.dd);
mv(you, T9.pick, ...w9(250, 454 + DY9 + 8 + 52 + 26), 0.45); click(you, T9.pick);
mv(you, b(106.4), ...w9(vz(420, 600), vz(560, 720)), 0.4, SP.soft);
cue(T9.msg, 'chime');
you.O.to(b(106.8), 0, SP.soft);
function drawScene9(t) {
  if (t < b(99.6) || t > b(108.4)) { g9.style.display = 'none'; return; }
  g9.style.display = '';
  const out = T9.out;
  [s9.hd, s9.sub, s9.tk, s9.cs, s9.bar, s9.lg, s9.ml].forEach((el, i) => show(el, vis(t, T9.in + i * 0.04, out)));
  show(s9.dd, vis(t, T9.in + 0.3, out), `scale(${press(t, T9.dd).toFixed(4)})`);
  segs.forEach((el, i) => { el.style.width = (BW * PROV[i][1] * stepR(t - T9.seg[i], SP.card) - 4).toFixed(1) + 'px'; });
  const u = outQ((t - T9.odo0) / 2.0); tokOdo.set(u); costOdo.set(u);
  const mo = vis(t, T9.dd + 0.08, T9.pick + 0.12, 0.12, -10);
  show(s9.menu, mo);
  s9.menu.querySelectorAll('.mo').forEach((el, i) => el.style.background = i === 1 && t > T9.pick - 0.35 ? '#EEF2F8' : 'transparent');
  const sw = t > T9.pick + 0.05;
  show(s9.dd.querySelector('.m1'), vis(t, T9.in + 0.3, T9.pick + 0.05, 0.1)); show(s9.dd.querySelector('.m2'), vis(t, T9.pick + 0.15, out));
  s9.dd.querySelector('.mdot').style.background = sw ? '#24B24B' : '#228ECD';
  show(s9.msg, vis(t, T9.msg, out));
}

// =====================================================================
// SCENE 10 · End (b108–b120)
// =====================================================================
const END = { x: P1[0], y: P1[1] - 40 };
heroTo(b(107.5), P1[0], P1[1], 64, 64, 999, '#24B24B', { w: 14, z: 1 });
HS.to(b(107.5), 0, SP.soft);
cue(b(107.4), 'suck');
lockup(b(108), END.x, END.y);
cam(b(107.5), P1[0], P1[1], 1.12, { w: 5, z: 1 });
cam(b(108) - 0.05, END.x, END.y + vz(70, 120), 1.04, { w: 14, z: 0.7 });
cam(b(108.6), END.x, END.y + vz(70, 120), 1.0, { w: 2.5, z: 1 });
const W10 = vz(1600, 900);
const tag = mk(`<div class="abs disp" style="width:${W10}px;text-align:center;font-weight:700;font-size:${vz(50, 58)}px;line-height:1.2;letter-spacing:-1px;color:var(--ink)">Turn AI into your marketing operations system.</div>`, world);
const contact = mk(`<div class="abs row" style="width:${W10}px;justify-content:center;gap:28px;font:600 30px Inter;color:var(--navy)"><span>aipower.vn</span><span style="width:8px;height:8px;border-radius:50%;background:var(--green)"></span><span style="color:var(--ink2);font-weight:500">contact@aipower.vn</span></div>`, world);
cue(b(111), 'chime'); cue(b(113), 'blip', { n: 5 });
function drawScene10(t) {
  if (t < b(110)) { tag.style.visibility = contact.style.visibility = 'hidden'; return; }
  show(tag, vis(t, b(111), null, 0.12, 18), ''); tag.style.transform = `translate(${END.x - W10 / 2}px,${END.y + 210 + vis(t, b(111), null, 0.12, 18).dy}px)`;
  show(contact, vis(t, b(113), null, 0.12, 18)); contact.style.transform = `translate(${END.x - W10 / 2}px,${END.y + vz(300, 390) + vis(t, b(113), null, 0.12, 18).dy}px)`;
}

// =====================================================================
// HUD step rail (b24–b107)
// =====================================================================
const STEPS = ['Brief', 'AI draft', 'QC', 'Approve', 'Publish', 'Measure', 'AI cost'];
const STEP_T = [b(24), b(36), b(46), b(56), b(68), b(84), b(100)];
const RH = vz(56, 54);
const rail = mk(`<div class="abs row" style="height:${RH}px;padding:0 6px;border-radius:${RH / 2}px;background:rgba(255,255,255,.92);box-shadow:0 10px 30px rgba(25,71,157,.10);font:600 ${vz(19, 17.5)}px Inter">
  <div class="rind" style="position:absolute;top:6px;height:${RH - 12}px;border-radius:${RH / 2 - 6}px;background:#0E1B3D"></div>
  ${STEPS.map((s, i) => `<span class="rs" style="position:relative;padding:0 ${vz(22, 10)}px;line-height:${RH}px">${String(i + 1).padStart(2, '0')}&nbsp;&nbsp;${s}</span>`).join('')}</div>`, hud);
let RAIL = null;
const rL = new Track(0), rR = new Track(0);
function measureRail() {
  RAIL = [...rail.querySelectorAll('.rs')].map(e => [e.offsetLeft, e.offsetLeft + e.offsetWidth]);
  rL.v0 = rL.cur = RAIL[0][0]; rR.v0 = rR.cur = RAIL[0][1];
  STEP_T.forEach((tt, i) => { if (i) { rL.to(tt, RAIL[i][0], SP.trail); rR.to(tt, RAIL[i][1], SP.lead); } });
}
function drawRail(t) {
  if (!show(rail, vis(t, b(24.4), b(107.2), 0.15, -14))) return;
  rail.style.transform = `translate(${SCX - rail.offsetWidth / 2}px,${vz(28, 150) + vis(t, b(24.4), b(107.2), 0.15, -14).dy}px)`;
  const L = rL.at(t), R = rR.at(t), ind = rail.querySelector('.rind');
  ind.style.left = (L + 2) + 'px'; ind.style.width = (R - L - 4) + 'px';
  [...rail.querySelectorAll('.rs')].forEach((el, i) => {
    const [a, c] = RAIL[i], cov = clamp((Math.min(R, c) - Math.max(L, a)) / (c - a));
    el.style.color = `rgb(${lerp(107, 255, cov)},${lerp(122, 255, cov)},${lerp(147, 255, cov)})`;
  });
}
STEP_T.slice(1).forEach(tt => cue(tt, 'rail'));

// ---------- seek ----------
function seek(t) {
  t = clamp(t, 0, DUR);
  drawBg(t);
  const c = camAt(t);
  world.style.transform = `translate(${SCX}px,${SCY}px) scale(${c.z.toFixed(5)}) translate(${(-c.x).toFixed(3)}px,${(-c.y).toFixed(3)}px)`;
  drawHero(t);
  drawScene1(t); drawScene2(t); drawScene3(t); drawPill(t); drawScene4(t); drawScene5(t); drawScene6(t);
  drawScene7(t); drawScene8(t); drawScene9(t); drawScene10(t); drawRail(t);
  drawCursor(you, t); drawCursor(ai, t); drawTrail(t);
}

async function init() {
  await document.fonts.load("700 40px Montserrat"); await document.fonts.load("800 40px Montserrat");
  await document.fonts.load("600 20px Inter"); await document.fonts.ready;
  await Promise.all([...document.images].map(im => im.decode().catch(() => 0)));
  schedule4(); measureRail();
  CUES.sort((a, c) => a.t - c.t);
  window.M = { dur: DUR, seek, cues: CUES };
  const q = new URLSearchParams(location.search);
  seek(q.has('t') ? parseFloat(q.get('t')) : 0);
  if (q.has('play')) { const t0 = performance.now(); const f = () => { seek(((performance.now() - t0) / 1000) % DUR); requestAnimationFrame(f); }; f(); }
  window.READY = true;
}
init();
