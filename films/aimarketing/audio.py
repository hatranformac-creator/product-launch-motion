# Original score + synthesized UI sounds for the AIMarketing film.
# 120 BPM, A minor / C major, Am-F-C-G. Build 28-34 s, drop at 34 s, resolve to C at 54 s.
# python3 audio.py cues.json out_dir
import sys, json, os
import numpy as np
from scipy import signal
from scipy.io import wavfile

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
rng = np.random.default_rng(7)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR
def env_exp(d, k): return np.exp(-tt(d) * k)
def adsr(d, a=0.005, r=0.05):
    n = int(d * SR); e = np.ones(n); na = max(1, int(a * SR)); nr = max(1, int(r * SR))
    e[:na] = np.linspace(0, 1, na); e[-nr:] *= np.linspace(1, 0, nr); return e
def saw(f, d, ph=0.0): x = (tt(d) * f + ph) % 1.0; return 2 * x - 1
def sq(f, d): return np.sign(np.sin(2 * np.pi * f * tt(d)))
def lp(x, fc, o=2): return signal.sosfilt(signal.butter(o, min(fc, SR * 0.45), 'low', fs=SR, output='sos'), x)
def hp(x, fc, o=2): return signal.sosfilt(signal.butter(o, fc, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return signal.sosfilt(signal.butter(o, [lo, min(hi, SR * 0.45)], 'band', fs=SR, output='sos'), x)
def noise(d): return rng.uniform(-1, 1, int(d * SR))
def add(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    j = min(len(buf), i + len(x))
    if j > i: buf[i:j] += g * x[:j - i]
def sweep_lp(x, f0, f1, block=256):
    out = np.zeros_like(x); zi = None; n = len(x)
    for s in range(0, n, block):
        u = s / max(1, n - 1); fc = f0 * (f1 / f0) ** u
        sos = signal.butter(2, min(fc, SR * 0.45), 'low', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        out[s:s + block], zi = signal.sosfilt(sos, x[s:s + block], zi=zi)
    return out

# ---------------- instruments ----------------
def kick(g=1.0):
    d = 0.42; t = tt(d); f = 46 + 110 * np.exp(-t * 28)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sin(ph) * np.exp(-t * 7.5) + 0.35 * hp(noise(d), 2500) * np.exp(-t * 180)
    return g * np.tanh(1.6 * x)
def clap():
    d = 0.35; x = np.zeros(int(d * SR))
    for k, o in enumerate([0, 0.011, 0.022]):
        n = bp(noise(0.3), 900, 3200) * env_exp(0.3, 60 if k < 2 else 16)
        add(x, n, o, 0.8)
    return x
def hat(open_=False):
    d = 0.25 if open_ else 0.06
    return hp(noise(d), 7000, 4) * env_exp(d, 14 if open_ else 70)
def snare():
    d = 0.22; t = tt(d)
    return 0.6 * bp(noise(d), 1500, 7000) * np.exp(-t * 22) + 0.5 * np.sin(2 * np.pi * 190 * t) * np.exp(-t * 30)
def pluck(m, d=0.32, bright=4000):
    f = mtof(m); x = saw(f, d) * 0.6 + sq(f * 2, d) * 0.15
    e = env_exp(d, 9) * adsr(d, 0.002, 0.03)
    x = sweep_lp(x * e, bright, 500, block=512)
    return x
def pad(ms, d, fc=1400):
    x = np.zeros(int(d * SR))
    for m in ms:
        for dt in (-0.12, -0.04, 0.05, 0.13):
            x += saw(mtof(m) * 2 ** (dt / 12), d, rng.random())
    x = lp(x / (len(ms) * 4), fc, 2) * adsr(d, 0.25, 0.4)
    return x
def supersaw(ms, d, fc=5000):
    x = np.zeros(int(d * SR))
    for m in ms:
        for dt in (-0.2, -0.11, -0.04, 0, 0.05, 0.12, 0.21):
            x += saw(mtof(m) * 2 ** (dt / 12), d, rng.random())
    e = adsr(d, 0.004, 0.06) * (0.55 + 0.45 * env_exp(d, 6))
    return lp(x / (len(ms) * 7), fc, 2) * e
def bass(m, d):
    x = saw(mtof(m), d) + 0.5 * np.sin(2 * np.pi * mtof(m - 12) * tt(d))
    return lp(x, 520, 2) * adsr(d, 0.004, 0.04)
def lead(m, d):
    f = mtof(m); t = tt(d); vib = 1 + 0.004 * np.sin(2 * np.pi * 5.5 * t) * np.clip(t * 4, 0, 1)
    ph = np.cumsum(f * vib) / SR
    x = 0.6 * (2 * (ph % 1) - 1) + 0.4 * np.sign(np.sin(2 * np.pi * ph))
    return lp(x, 3800, 2) * adsr(d, 0.006, 0.08) * (0.7 + 0.3 * env_exp(d, 3))
def riser(d):
    t = tt(d); u = t / d
    n = noise(d); x = np.zeros_like(n); blk = 512; zi = None
    for s in range(0, len(n), blk):
        fc = 400 * (9000 / 400) ** (s / len(n))
        sos = signal.butter(2, [fc * 0.7, min(fc * 1.4, 20000)], 'band', fs=SR, output='sos')
        if zi is None: zi = signal.sosfilt_zi(sos) * 0
        x[s:s + blk], zi = signal.sosfilt(sos, n[s:s + blk], zi=zi)
    f = 200 * (1400 / 200) ** u
    tone = np.sin(2 * np.pi * np.cumsum(f) / SR) * 0.25
    return (x * 1.4 + tone) * u ** 2.2
def impact():
    d = 3.0; t = tt(d)
    sub = np.sin(2 * np.pi * (40 + 60 * np.exp(-t * 9)) * t) * np.exp(-t * 2.4)
    crash = hp(noise(d), 3000) * np.exp(-t * 2.2) * 0.35
    return np.tanh(1.5 * sub) * 0.9 + crash

# ---------------- reverb ----------------
def reverb(x, dec=1.8, mix=0.25):
    ir_t = tt(dec); ir = noise(dec) * np.exp(-ir_t * 4.0 / dec); ir = lp(ir, 6000); ir /= np.sqrt(np.sum(ir ** 2))
    wet = signal.fftconvolve(x, ir)[:len(x)]
    return x + mix * wet

# ---------------- the score ----------------
CH = [[57, 60, 64], [53, 57, 60], [55, 60, 64], [55, 59, 62]]   # Am F C G
ROOT = [45, 41, 48, 43]
CMAJ = [48, 55, 60, 64, 67]
LEAD = [  # eighth notes per chord (None = rest)
    [76, None, 72, 74, 76, None, 79, 76],
    [81, None, 79, 76, 74, None, 72, 74],
    [76, None, 79, 81, 79, 76, 74, 72],
    [74, None, None, 71, 74, None, 76, None],
]
def bars(a, b_): return range(a, b_)
drums = np.zeros(N); music = np.zeros(N); padbus = np.zeros(N); lead_b = np.zeros(N); fx = np.zeros(N)
side = np.ones(N)
def duck(t, depth=0.55, rel=0.22):
    i = int(t * SR); n = int(rel * SR); e = 1 - depth * (1 - np.linspace(0, 1, n)) ** 2
    j = min(N, i + n); side[i:j] = np.minimum(side[i:j], e[:j - i])

for bar in range(30):
    t0 = bar * BAR; c = bar % 4; chord = CH[c]
    final = bar >= 27
    if final: chord = [55, 60, 64]
    # pad
    if bar < 27:
        fc = 700 if bar < 4 else 1400 if bar < 14 else 1400 + (bar - 14) * 900 if bar < 17 else 2600
        if bar in (14, 15, 16): add(padbus, sweep_lp(pad(chord, BAR + 0.3, 6000), 900 + (bar - 14) * 1300, 2200 + (bar - 14) * 2600), t0, 0.5)
        else: add(padbus, pad(chord, BAR + 0.3, fc), t0, 0.75 if bar < 6 else 0.34 if bar < 17 or bar > 24 else 0.45)
    # pluck arpeggio (16ths)
    if bar < 14 or 25 <= bar < 27:
        pat = [0, 1, 2, 1, 3, 2, 1, 2]
        notes = chord + [chord[0] + 12]
        for k in range(16):
            if bar < 2 and k % 2: continue
            m = notes[pat[k % 8]] + 12
            add(music, pluck(m, 0.3, 2500 if bar < 4 else 4200), t0 + k * 0.125, 0.26 if bar < 4 else 0.13)
    # drums
    if 4 <= bar < 6:
        add(drums, kick(0.9), t0); duck(t0)
        add(drums, kick(0.6), t0 + 1.5); duck(t0 + 1.5, 0.4)
    if 6 <= bar < 16 or 17 <= bar < 27:
        for k in range(4):
            if bar == 26 and k >= 2: continue
            add(drums, kick(0.62 if bar < 14 else 0.8 if bar < 17 else 1.0), t0 + k * BEAT); duck(t0 + k * BEAT, 0.4 if bar < 17 else 0.6)
        if 8 <= bar < 14 or bar >= 17:
            add(drums, clap(), t0 + 0.5, 0.55); add(drums, clap(), t0 + 1.5, 0.55)
    if bar >= 2 and bar < 27 and bar != 16:
        for k in range(16):
            if k % 4 == 2: add(drums, hat(open_=bar >= 17 and k == 14), t0 + k * 0.125, 0.22)
            elif (bar >= 10 and bar != 16) and k % 2 == 1: add(drums, hat(), t0 + k * 0.125, 0.1)
    # build: snare roll bars 14-16
    if 14 <= bar <= 16:
        step = {14: 0.5, 15: 0.25, 16: 0.125}[bar]
        n = int(BAR / step)
        for k in range(n):
            tk = t0 + k * step
            if bar == 16 and k >= 8: # last beat: 32nds
                for q in range(2): add(drums, snare(), tk + q * 0.0625, 0.25 + 0.35 * (k / n))
            else: add(drums, snare(), tk, 0.2 + 0.3 * ((bar - 14) * BAR + k * step) / 6)
    # bass
    if 6 <= bar < 16 or 17 <= bar < 27:
        r = ROOT[c]
        for k in range(8):
            if k % 2 == 1 or bar >= 17: add(music, bass(r, 0.24), t0 + k * 0.25, 0.48 if bar >= 17 else 0.26)
    # drop: supersaw stabs + lead
    if 17 <= bar < 25:
        for k in range(8):
            if k % 2 == 1: add(music, supersaw(chord, 0.22, 4500), t0 + k * 0.25, 0.6)
        for k, m in enumerate(LEAD[c]):
            if m is not None: add(lead_b, lead(m, 0.24), t0 + k * 0.25, 0.36)
# risers and impacts
add(fx, riser(1.9), 6.1, 0.35)
add(fx, impact(), 8.0, 0.6)
add(fx, riser(4.0), 30.0, 0.45)
add(fx, impact(), 34.0, 0.7)
add(fx, riser(1.9), 52.1, 0.3)
add(fx, impact(), 54.0, 0.75)
# final chord: C major, big and long
add(padbus, pad(CMAJ, 6.0, 2200) * env_exp(6.0, 0.22), 54.0, 1.4)
add(music, supersaw([60, 64, 67], 3.0, 3500) * env_exp(3.0, 1.2), 54.0, 0.6)
for k, m in enumerate([79, 76, 72, 74, 76]):
    add(music, pluck(m, 0.6, 3500), 55.0 + k * 0.5 + (0.25 if k == 4 else 0), 0.24)
add(music, pluck(84, 1.2, 4000), 58.0, 0.2)

mix = drums * 0.9 + (music + padbus * 0.9) * side + lead_b * side
mix = reverb(mix, 1.6, 0.18) + reverb(fx, 2.5, 0.3)
mix = hp(mix, 30)
fade = np.ones(N); nf = int(1.4 * SR); fade[-nf:] = np.linspace(1, 0, nf) ** 2
mix *= fade

# ---------------- UI sounds ----------------
PENTA = [69, 72, 74, 76, 79, 81, 84, 86, 88, 91]
def s_click():
    x = np.zeros(int(0.09 * SR))
    add(x, hp(noise(0.012), 2000) * env_exp(0.012, 300), 0, 0.7)
    add(x, np.sin(2 * np.pi * 2400 * tt(0.02)) * env_exp(0.02, 250), 0, 0.5)
    add(x, hp(noise(0.01), 3000) * env_exp(0.01, 400), 0.05, 0.35)
    return x
def s_key(n):
    f = 1800 + (n * 397) % 900
    return hp(noise(0.02), 1500) * env_exp(0.02, 260) * 0.5 + np.sin(2 * np.pi * f * tt(0.02)) * env_exp(0.02, 300) * 0.25
def s_pop(n, g=1.0):
    m = PENTA[n % len(PENTA)]; d = 0.22; t = tt(d); f = mtof(m) * (1 + 0.5 * np.exp(-t * 60))
    return g * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16) * adsr(d, 0.002, 0.02)
def s_whoosh(d=0.45, lo=300, hi=4000):
    n = noise(d); u = tt(d) / d; e = np.sin(np.pi * u) ** 2
    return bp(n, lo, hi) * e
def s_thump():
    d = 0.25; t = tt(d); return np.sin(2 * np.pi * (60 + 90 * np.exp(-t * 30)) * t) * np.exp(-t * 14)
def s_chime(ms=(84, 88, 91)):
    x = np.zeros(int(1.2 * SR))
    for k, m in enumerate(ms):
        d = 1.0; t = tt(d); add(x, (np.sin(2 * np.pi * mtof(m) * t) + 0.3 * np.sin(4 * np.pi * mtof(m) * t)) * np.exp(-t * 4) * adsr(d, 0.003, 0.05), k * 0.06, 0.4)
    return x
def s_roll(d):
    x = np.zeros(int((d + 0.1) * SR)); tk = 0.0; k = 0
    while tk < d:
        u = tk / d; add(x, s_key(k) * (1 - u * 0.6), tk, 0.6); k += 1; tk += 0.028 + 0.11 * u ** 2
    return x
def mx(*xs):
    n = max(len(x) for x in xs); o = np.zeros(n)
    for x in xs: o[:len(x)] += x
    return o
def make(c):
    ty = c['type']; n = c.get('n', 0); g = c.get('g', 1.0)
    if ty == 'click': return s_click(), 0.55, 'peak'
    if ty == 'key': return s_key(n), 0.28, 'peak'
    if ty == 'type': return mx(s_pop(n + 3, 0.5) * 0.5, s_key(n) * 0.5), 0.3 * g, 'peak'
    if ty == 'pop': return s_pop(n), 0.5, 'peak'
    if ty == 'tick': return s_pop(n + 4, 0.6), 0.3 * g, 'peak'
    if ty == 'blip': return s_pop(n + 2), 0.4, 'peak'
    if ty == 'check': return s_pop(n + 3) * 0.7 + np.pad(s_click(), (0, int(0.13 * SR)))[:int(0.22 * SR)] * 0.4, 0.45, 'peak'
    if ty == 'whoosh': return s_whoosh(0.5), 0.5 * g, 'peak'
    if ty == 'swoosh': return s_whoosh(0.3, 600, 5000), 0.32, 'peak'
    if ty == 'slide': return s_whoosh(0.22, 1200, 6000), 0.3, 'peak'
    if ty == 'rail': return s_whoosh(0.18, 2000, 8000), 0.16, 'peak'
    if ty == 'toggle': return s_click() * 0.7 + np.pad(s_pop(5, 0.5), (0, 0))[:len(s_click())], 0.5, 'peak'
    if ty == 'drop': x = s_thump() * 0.6; add(x, s_pop(n + 5, 0.6), 0.0); return x, 0.45, 'peak'
    if ty == 'stamp': x = np.zeros(int(1.2 * SR)); add(x, s_thump(), 0); add(x, s_chime((79, 84, 88)), 0.02, 0.8); return x, 0.55, 'start'
    if ty == 'approve': x = np.zeros(int(1.2 * SR)); add(x, s_click(), 0); add(x, s_chime((76, 81, 84)), 0.03); return x, 0.55, 'start'
    if ty == 'pressdown': return s_thump() * 0.4, 0.4, 'peak'
    if ty == 'release': x = np.zeros(int(0.3 * SR)); add(x, s_click(), 0); return x, 0.6, 'peak'
    if ty == 'slam': x = s_thump(); add(x, s_click(), 0, 0.6); add(x, s_pop(n + 1, 0.5), 0); return x, 0.5 * g, 'peak'
    if ty == 'roll': return s_roll(c.get('d', 1.0)), 0.35 * g, 'start'
    if ty == 'draw': d = c.get('d', 2.0); return s_whoosh(d, 800, 3000) * 0.6, 0.35, 'start'
    if ty == 'chime': return s_chime(), 0.4, 'start'
    if ty == 'suck': return s_whoosh(0.5, 300, 6000)[::-1].copy() * np.linspace(0.3, 1, int(0.5 * SR)), 0.4, 'end'
    if ty in ('riser', 'impact'): return None, 0, None  # these live in the score
    raise ValueError(ty)

if __name__ == '__main__':
    cues = json.load(open(sys.argv[1])); out = sys.argv[2]; os.makedirs(out, exist_ok=True)
    sfx = np.zeros(N)
    for c in cues:
        x, g, mode = make(c)
        if x is None: continue
        if mode == 'peak': off = np.argmax(np.abs(x)) / SR
        elif mode == 'end': off = len(x) / SR
        else: off = 0
        add(sfx, x, c['t'] - off, g)
    music_only = mix
    final = mix * 0.5 + sfx * 0.6
    final *= 0.93 / np.max(np.abs(final))
    st = np.stack([final, final], 1)
    # light stereo width on the music
    wavfile.write(f'{out}/mix.wav', SR, (st * 32767).astype(np.int16))
    wavfile.write(f'{out}/music.wav', SR, (music_only / np.max(np.abs(music_only)) * 0.9 * 32767).astype(np.int16))
    wavfile.write(f'{out}/sfx.wav', SR, (sfx / np.max(np.abs(sfx)) * 0.9 * 32767).astype(np.int16))
    print('ok', np.max(np.abs(mix)), np.max(np.abs(sfx)))
