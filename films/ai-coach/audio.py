"""Original score + synthesized UI sounds for the AI Coach film.

120 BPM, A minor, i-VI-III-VII (Am F C G). 42 s:
  0-6   intro     soft kick on beats, filtered pad, 8th plucks
  6-10  the turn  darker pad, low drone (pain point)
  10-16 build     snare 8ths -> 16ths -> 32nds, riser, filter opens, 0.5 s gap
  16-34 drop      four on the floor, offbeat bass, stabs, claps, 16th hats
  34-37 lift      drop + snare fill into the final hit
  37-42 ending    impact + sustained Am(add9), tail
Every SFX is placed so its own peak lands on its cue (events.json, exported from film.js).
Usage: python3 -I audio.py   (writes music.wav, sfx.wav, mix.wav)
"""
import json, sys, os
import numpy as np
from scipy.signal import butter, sosfilt, fftconvolve

SR = 48000
DUR = 42.0
N = int(SR * DUR)
BEAT = 0.5
HERE = os.path.dirname(os.path.abspath(__file__))
rng = np.random.default_rng(7)

def tt(d): return np.arange(int(SR * d)) / SR
def midi(m): return 440.0 * 2 ** ((m - 69) / 12)
def env_exp(d, tau, att=0.002):
    t = tt(d); e = np.exp(-t / tau)
    a = int(att * SR)
    if a > 0: e[:a] *= np.linspace(0, 1, a)
    return e
def lp(x, f, order=2): return sosfilt(butter(order, min(f, SR * 0.45), 'low', fs=SR, output='sos'), x)
def hp(x, f, order=2): return sosfilt(butter(order, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, order=2): return sosfilt(butter(order, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)
def add(buf, t0, sig, g=1.0):
    i = int(round(t0 * SR))
    if i < 0: sig = sig[-i:]; i = 0
    j = min(len(buf), i + len(sig))
    if j > i: buf[i:j] += g * sig[: j - i]
def put(buf, t, sig, g=1.0):           # place by the sound's own peak
    pk = int(np.argmax(np.abs(sig)))
    add(buf, t - pk / SR, sig, g)

def saw(f, n, ph0=0.0):
    dt = f / SR
    ph = (ph0 + dt * np.arange(n)) % 1.0
    y = 2 * ph - 1
    m = ph < dt; x = ph[m] / dt; y[m] -= x + x - x * x - 1
    m = ph > 1 - dt; x = (ph[m] - 1) / dt; y[m] -= x * x + x + x + 1
    return y
def supersaw(f, n, voices=5, spread=12):
    out = np.zeros(n)
    for k in range(voices):
        c = (k - (voices - 1) / 2) / ((voices - 1) / 2) * spread
        out += saw(f * 2 ** (c / 1200), n, rng.random())
    return out / voices
def lp_sweep(x, f0, f1, block=512):
    out = np.zeros_like(x); zi = None
    nb = (len(x) + block - 1) // block
    for b in range(nb):
        f = f0 * (f1 / f0) ** (b / max(1, nb - 1))
        sos = butter(2, min(f, SR * 0.45), 'low', fs=SR, output='sos')
        if zi is None: zi = np.zeros((sos.shape[0], 2))
        out[b * block:(b + 1) * block], zi = sosfilt(sos, x[b * block:(b + 1) * block], zi=zi)
    return out

CHORDS = [  # (pad voicing, bass root)
    ([57, 60, 64, 69], 45),   # Am
    ([53, 57, 60, 65], 41),   # F
    ([55, 60, 64, 67], 48),   # C
    ([55, 59, 62, 67], 43),   # G
]
def chord_at(t): return CHORDS[int(t // 2.0) % 4]

# ------------------------------------------------------------------ drums
def kick(hard=1.0):
    t = tt(0.45)
    f = 45 + 95 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    body = np.sin(ph) * np.exp(-t / (0.16 + 0.08 * hard))
    click = hp(rng.standard_normal(len(t)), 2500) * np.exp(-t / 0.004) * 0.35 * hard
    return np.tanh((body + click) * 1.6) * 0.9
def clap():
    t = tt(0.3); n = rng.standard_normal(len(t)); e = np.zeros(len(t))
    for d in (0, 0.011, 0.022): e += np.exp(-np.clip(t - d, 0, None) / 0.01) * (t >= d)
    e += 0.6 * np.exp(-t / 0.09)
    return bp(n, 900, 5000) * e * 0.6
def snare(level=1.0):
    t = tt(0.22)
    tone = np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.05)
    noise = bp(rng.standard_normal(len(t)), 1500, 9000) * np.exp(-t / 0.07)
    return (0.5 * tone + noise) * 0.5 * level
def hat(open_=False):
    d = 0.25 if open_ else 0.05
    t = tt(d)
    return hp(rng.standard_normal(len(t)), 7000, 4) * np.exp(-t / (0.08 if open_ else 0.014)) * 0.35

# ------------------------------------------------------------------ build the music
def music():
    dr = np.zeros(N); bass = np.zeros(N); pad = np.zeros(N); stab = np.zeros(N); pl = np.zeros(N); fxb = np.zeros(N)
    K = kick(1.0); Ks = kick(0.5)
    kicks = []
    for i in range(int(DUR / BEAT)):
        t = i * BEAT
        if t < 10: put(dr, t, Ks, 0.55 if t < 6 else 0.5); kicks.append(t)
        elif t < 15.5: put(dr, t, Ks, 0.6 + 0.25 * (t - 10) / 5.5); kicks.append(t)
        elif 16 <= t < 36: put(dr, t, K, 1.0); kicks.append(t)
        elif t == 37.0: put(dr, t, K, 1.0); kicks.append(t)
    for t in np.arange(14.0, 15.5, 0.25):
        if t % 0.5: put(dr, t, Ks, 0.55)
    # claps on 2 & 4, hats
    for i in range(int(DUR / BEAT)):
        t = i * BEAT
        if 16 <= t < 36 and i % 2 == 1: put(dr, t, clap(), 0.8)
    for k in range(int(DUR / 0.25)):
        t = k * 0.25
        if 2 <= t < 6 and k % 2 == 1: put(dr, t, hat(), 0.5)
        if 16 <= t < 36:
            put(dr, t, hat(open_=(k % 2 == 1 and k % 4 != 1)) if k % 2 else hat(), 0.55 if k % 2 else 0.35)
    # snare build 10 -> 15.5
    for t, step in ((10, 0.5), (12, 0.25), (14, 0.125)):
        for s in np.arange(t, t + 2 if t < 14 else 15.5, step):
            lvl = 0.35 + 0.65 * (s - 10) / 5.5
            put(dr, s, snare(lvl), 0.7)
    for s in np.arange(36, 37, 0.125): put(dr, s, snare(0.5 + 0.5 * (s - 36)), 0.6)

    # pad: supersaw chords, block-swept lowpass per section
    for bar in range(int(37 // 2)):
        t0 = bar * 2.0; notes, _ = chord_at(t0)
        n = int(SR * 2.2)
        x = sum(supersaw(midi(m), n, spread=14) for m in notes) / len(notes)
        a = np.minimum(1, tt(2.2) / 0.08) * np.minimum(1, np.maximum(0, (2.2 - tt(2.2)) / 0.25))
        if t0 < 6: f0, f1, g = 500 + t0 * 120, 600 + (t0 + 2) * 120, 0.32
        elif t0 < 10: f0, f1, g = 700, 600, 0.3
        elif t0 < 16: f0, f1, g = 900 * 2 ** ((t0 - 10) / 2), 900 * 2 ** ((t0 - 8) / 2), 0.3
        else: f0, f1, g = 4200, 4200, 0.22
        add(pad, t0, lp_sweep(x * a, f0, f1), g)
    # drone under the turn
    t = tt(4.2)
    add(pad, 6.0, np.sin(2 * np.pi * midi(33) * t) * np.minimum(1, t / 0.3) * np.minimum(1, (4.2 - t) / 0.6), 0.2)
    # bass: sustained sub in the intro, offbeat 8ths in the drop
    for bar in range(int(16 // 2)):
        t0 = bar * 2.0; _, r = chord_at(t0)
        if t0 < 10: continue
        t = tt(2.0); x = lp(saw(midi(r - 12), len(t)), 300) * np.minimum(1, t / 0.02) * np.minimum(1, (2.0 - t) / 0.05)
        add(bass, t0, x, 0.35)
    for k in range(int(16 / 0.25), int(36 / 0.25)):
        t0 = k * 0.25
        if k % 2 == 0: continue
        _, r = chord_at(t0)
        t = tt(0.22)
        x = (0.7 * lp(saw(midi(r - 12), len(t)), 700) + 0.5 * np.sin(2 * np.pi * midi(r - 12) * t)) * np.exp(-t / 0.12) * np.minimum(1, t / 0.004)
        add(bass, t0, x, 0.55)
    # stabs on the drop: dotted pattern
    for bar in range(8, 18):
        t0 = bar * 2.0; notes, _ = chord_at(t0)
        for off in (0.0, 0.75, 1.5, 1.75):
            t = tt(0.3)
            x = sum(supersaw(midi(m + 12), len(t), spread=18) for m in notes) / len(notes)
            add(stab, t0 + off, lp(x, 5200) * np.exp(-t / 0.09) * np.minimum(1, t / 0.003), 0.3)
    # plucks: chord-tone arpeggio
    for k in range(int(37 / 0.25)):
        t0 = k * 0.25
        notes, _ = chord_at(t0)
        if t0 < 2: continue
        if t0 < 10 and k % 2: continue
        if 15.5 <= t0 < 16: continue
        m = notes[[0, 2, 1, 3][k % 4]] + (12 if t0 >= 16 else 0)
        t = tt(0.25)
        x = (np.sin(2 * np.pi * midi(m) * t) + 0.35 * lp(saw(midi(m), len(t)), 3000)) * np.exp(-t / 0.08) * np.minimum(1, t / 0.002)
        add(pl, t0, x, 0.13 if t0 < 16 else 0.12)
    # riser 12 -> 15.5 and reverse swell into the drop
    t = tt(3.5); sw = rng.standard_normal(len(t)) * (t / 3.5) ** 2
    add(fxb, 12.0, lp_sweep(hp(sw, 300), 400, 9000), 0.35)
    t = tt(1.0); rev = hp(rng.standard_normal(len(t)), 4000) * (t / 1.0) ** 3
    add(fxb, 15.0, rev, 0.4); add(fxb, 36.0, rev, 0.35)
    # final chord at 37: Am(add9), long decay
    t = tt(5.0); notes = [45, 57, 64, 67, 71, 72]
    x = sum(supersaw(midi(m), len(t), spread=10) for m in notes) / len(notes)
    add(pad, 37.0, lp_sweep(x * np.exp(-t / 1.6) * np.minimum(1, t / 0.005), 5000, 900), 0.5)
    add(pl, 37.0, np.sin(2 * np.pi * midi(81) * t) * np.exp(-t / 0.9), 0.12)

    # sidechain pump from the kicks
    sc = np.ones(N); tk = tt(0.42)
    duck = 1 - 0.7 * np.exp(-tk / 0.11)
    for t0 in kicks:
        if t0 >= 16:
            i = int(t0 * SR); j = min(N, i + len(duck)); sc[i:j] = np.minimum(sc[i:j], duck[: j - i])
    bus = (pad + stab) * sc + bass * sc + pl
    # reverb send
    ir_t = tt(2.4); ir = rng.standard_normal(len(ir_t)) * np.exp(-ir_t / 0.55); ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
    wet = fftconvolve(pl * 1.0 + stab * 0.6 + pad * 0.3 + fxb * 0.3, ir)[:N] * 0.35
    mix = dr + bus + fxb + wet
    mix = np.tanh(mix * 1.1) / 1.1
    return mix / (np.max(np.abs(mix)) + 1e-9) * 0.89, kicks

# ------------------------------------------------------------------ SFX
PENT = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91, 93]   # A minor pentatonic from A4
def s_click():
    t = tt(0.05); n = hp(rng.standard_normal(len(t)), 2000)
    a = (n * 0.4 + np.sin(2 * np.pi * 3200 * t)) * np.exp(-t / 0.006)
    out = np.zeros(int(SR * 0.12)); out[:len(a)] += a; i = int(0.06 * SR); out[i:i + len(a)] += 0.5 * a
    return out * 0.5
def s_key(p=0, soft=0):
    t = tt(0.03); f = 1800 + 260 * p
    a = (hp(rng.standard_normal(len(t)), 1500) * 0.5 + np.sin(2 * np.pi * f * t) * 0.5) * np.exp(-t / 0.005)
    return a * (0.22 if soft else 0.34)
def s_tick(p=0, soft=0):
    t = tt(0.06); f = midi(PENT[p % len(PENT)] + 12)
    return np.sin(2 * np.pi * f * t) * np.exp(-t / 0.014) * np.minimum(1, t / 0.001) * (0.16 if soft else 0.26)
def s_pop(p=0):
    t = tt(0.16); f0 = midi(PENT[p % len(PENT)])
    f = f0 * (1 + 0.6 * np.exp(-t / 0.012)); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.05) * np.minimum(1, t / 0.0015) * 0.42
def s_note(p=0):
    t = tt(0.6); f = midi(PENT[p % len(PENT)])
    return (np.sin(2 * np.pi * f * t) + 0.3 * np.sin(2 * np.pi * 2 * f * t)) * np.exp(-t / 0.18) * np.minimum(1, t / 0.002) * 0.25
def s_bar(p=0):
    t = tt(0.3); f0 = midi(PENT[p % len(PENT)] - 12)
    f = f0 * 2 ** (t / 0.3); ph = 2 * np.pi * np.cumsum(f) / SR
    e = np.sin(np.pi * np.clip(t / 0.3, 0, 1)) ** 0.5 * np.exp(-t / 0.2)
    return np.sin(ph) * e * 0.22
def s_whoosh(d=0.4, lo=300, hi=3000, g=0.32):
    t = tt(d); n = rng.standard_normal(len(t))
    x = lp_sweep(hp(n, lo), lo * 1.5, hi, block=256) * np.sin(np.pi * t / d) ** 2
    return x * g
def s_low():
    t = tt(1.0); f = 40 + 30 * np.exp(-t / 0.08); ph = 2 * np.pi * np.cumsum(f) / SR
    return (np.sin(ph) * np.exp(-t / 0.35) + lp(rng.standard_normal(len(t)), 400) * np.exp(-t / 0.2) * 0.3) * 0.6
def s_thump():
    t = tt(0.3); f = 60 + 50 * np.exp(-t / 0.03); ph = 2 * np.pi * np.cumsum(f) / SR
    return np.sin(ph) * np.exp(-t / 0.09) * 0.5
def s_impact():
    t = tt(1.6); f = 38 + 70 * np.exp(-t / 0.05); ph = 2 * np.pi * np.cumsum(f) / SR
    boom = np.sin(ph) * np.exp(-t / 0.45)
    crash = hp(rng.standard_normal(len(t)), 3500) * np.exp(-t / 0.5) * 0.35
    return np.tanh((boom + crash) * 1.3) * 0.6
def s_chime():
    t = tt(1.0); f = midi(88)
    x = sum(a * np.sin(2 * np.pi * f * r * t) * np.exp(-t / d) for a, r, d in ((1, 1, 0.5), (0.5, 2.76, 0.25), (0.3, 5.4, 0.12)))
    return x * np.minimum(1, t / 0.002) * 0.2
def s_msg(p=0):
    a = s_tick(p + 3); b = s_tick(p + 5)
    out = np.zeros(int(SR * 0.16)); out[:len(a)] += a * 1.3; i = int(0.07 * SR); out[i:i + len(b)] += b * 1.3
    return out
def s_send():
    w = s_whoosh(0.3, 600, 6000, 0.25); b = s_tick(6)
    out = w.copy(); out[:len(b)] += b * 1.2
    return out

def sfx(cues):
    buf = np.zeros(N)
    for c in cues:
        ty, t, p, soft = c['type'], c['t'], c.get('p', 0), c.get('soft', 0)
        if ty == 'click': sig = s_click()
        elif ty == 'key': sig = s_key(p, soft)
        elif ty == 'tick': sig = s_tick(int(p), soft)
        elif ty == 'pop': sig = s_pop(int(p))
        elif ty == 'note': sig = s_note(int(p))
        elif ty == 'bar': sig = s_bar(int(p))
        elif ty == 'whoosh': sig = s_whoosh()
        elif ty == 'swish': sig = s_whoosh(0.18, 800, 5000, 0.18)
        elif ty == 'low': sig = s_low()
        elif ty == 'thump': sig = s_thump()
        elif ty == 'impact': sig = s_impact()
        elif ty == 'chime': sig = s_chime()
        elif ty == 'msg': sig = s_msg(int(p))
        elif ty == 'send': sig = s_send()
        else: print('unknown cue', ty, file=sys.stderr); continue
        if ty in ('whoosh', 'swish', 'send'): add(buf, t - 0.6 * len(sig) / SR, sig)   # whooshes swell into their cue
        else: put(buf, t, sig)
    return buf

def write_wav(path, x):
    import wave
    st = np.stack([x, x], 1) if x.ndim == 1 else x
    pcm = (np.clip(st, -1, 1) * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())

def verify_grid(x):
    """Re-derive tempo and phase from the rendered music: kick-band flux + autocorrelation."""
    k = lp(x, 150, 4); hop = 480; fr = len(k) // hop
    e = np.sqrt(np.mean(k[: fr * hop].reshape(fr, hop) ** 2, 1))
    fl = np.maximum(0, np.diff(e, prepend=e[0]))
    ac = np.correlate(fl - fl.mean(), fl - fl.mean(), 'full')[len(fl) - 1:]
    lags = np.arange(len(ac)) * hop / SR
    m = (lags > 0.3) & (lags < 1.0)
    period = lags[m][np.argmax(ac[m])]
    seg = slice(int(16 * SR / hop), int(34 * SR / hop))
    ph = np.angle(np.sum(fl[seg] * np.exp(-2j * np.pi * np.arange(fl.size)[seg] * hop / SR / period)))
    print(f'grid check: period {period:.4f}s = {60 / period:.1f} BPM, phase offset {(-ph / (2 * np.pi) * period) % period * 1000:.1f} ms')

if __name__ == '__main__':
    os.chdir(HERE)
    m, kicks = music()
    verify_grid(m)
    cues = json.load(open('events.json'))
    s = sfx(cues)
    write_wav('music.wav', m); write_wav('sfx.wav', s / (np.max(np.abs(s)) + 1e-9) * 0.9)
    mix = m * 0.5 + s * 0.62
    tail = np.ones(N); i = int(41.0 * SR); tail[i:] = np.linspace(1, 0, N - i) ** 2
    mix *= tail
    mix = mix / np.max(np.abs(mix)) * 0.93
    write_wav('mix.wav', mix)
    print('cues', len(cues), 'peak sfx', np.max(np.abs(s)).round(3))
