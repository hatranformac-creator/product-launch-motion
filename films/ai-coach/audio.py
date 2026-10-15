# Original score + UI sound design for the AI Coach film. numpy only.
# python3 audio.py cues.json  →  song.wav, sfx.wav, mix.wav (48 kHz stereo)
import json, sys, wave
import numpy as np

SR = 48000
DUR = 60.0
N = int(SR * DUR)
BEAT = 0.5
BAR = 2.0
rng = np.random.default_rng(7)

def mtof(m): return 440.0 * 2 ** ((m - 69) / 12)
def tt(d): return np.arange(int(d * SR)) / SR

def add(buf, sig, t, g=1.0, pan=0.0):
    i = int(round(t * SR))
    if i >= buf.shape[1] or i + len(sig) <= 0: return
    j0 = max(0, -i); i = max(0, i); n = min(len(sig) - j0, buf.shape[1] - i)
    l, r = np.cos((pan + 1) * np.pi / 4), np.sin((pan + 1) * np.pi / 4)
    buf[0, i:i + n] += sig[j0:j0 + n] * g * l * 1.414
    buf[1, i:i + n] += sig[j0:j0 + n] * g * r * 1.414

def fftfilt(x, lo, hi, soft=0.15):
    X = np.fft.rfft(x); f = np.fft.rfftfreq(len(x), 1 / SR)
    m = 1 / (1 + (lo / np.maximum(f, 1)) ** 4) if lo > 0 else np.ones_like(f)
    m *= 1 / (1 + (f / hi) ** 4) if hi < SR / 2 else 1
    return np.fft.irfft(X * m, len(x))

def noise(d): return rng.standard_normal(int(d * SR))

def saw(f, d, cut=3000, det=0.0):
    t = tt(d); out = np.zeros_like(t); k = 1
    while k * f < min(cut * 2.5, 16000):
        w = np.exp(-k * f / cut) / k
        out += w * np.sin(2 * np.pi * k * f * (1 + det) * t + k * 0.7)
        k += 1
    return out

def env(d, a=0.005, dec=0.2, sus=0.0, rel=0.05, total=None):
    t = tt(d)
    e = np.where(t < a, t / a, sus + (1 - sus) * np.exp(-(t - a) / max(dec, 1e-4)))
    if rel > 0: e *= np.clip((d - t) / rel, 0, 1)
    return e

# ---------------- harmony ----------------
CH = {  # bass root, chord tones (voiced around C4–A4)
    'Am': (45, [57, 60, 64]), 'F': (41, [57, 60, 65]), 'C': (48, [55, 60, 64]),
    'G': (43, [55, 59, 62]), 'Dm': (38, [57, 62, 65]), 'E': (40, [56, 59, 64]),
}
BARS = ['Am', 'Am', 'Am', 'F', 'Dm', 'E', 'F', 'G',
        'Am', 'F', 'C', 'G', 'Am', 'F', 'C',
        'F', 'G',
        'Am', 'F', 'C', 'G', 'Am', 'F', 'C', 'G', 'Am',
        'F', 'G',
        'C', 'C']
assert len(BARS) == 30
def sec(b):
    if b < 2: return 'intro'
    if b < 8: return 'tension'
    if b < 15: return 'groove'
    if b < 17: return 'build'
    if b < 26: return 'drop'
    if b < 28: return 'pre'
    return 'end'

# ---------------- instruments ----------------
def kick(g=1.0):
    d = 0.42; t = tt(d)
    f = 48 + 110 * np.exp(-t / 0.035)
    ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t / 0.16)
    s[:240] += fftfilt(noise(0.005), 1500, 9000) * 0.4 * np.linspace(1, 0, 240)
    return np.tanh(s * 1.6) * g

def clap():
    d = 0.3; s = np.zeros(int(d * SR))
    for k, o in enumerate([0, 0.011, 0.022]):
        nb = fftfilt(noise(d), 900, 4200) * np.exp(-tt(d) / (0.012 if k < 2 else 0.09))
        i = int(o * SR); s[i:] += nb[:len(s) - i]
    return s * 0.5

def hat(open_=False):
    d = 0.22 if open_ else 0.05
    return fftfilt(noise(d), 7000, 16000) * np.exp(-tt(d) / (0.07 if open_ else 0.012)) * 0.5

def snare():
    d = 0.18; t = tt(d)
    return (fftfilt(noise(d), 1200, 7000) * np.exp(-t / 0.05) * 0.7 + np.sin(2 * np.pi * 190 * t) * np.exp(-t / 0.04) * 0.5)

def crash(d=2.2):
    return fftfilt(noise(d), 4000, 15000) * np.exp(-tt(d) / 0.6) * 0.45

def bass(m, d, cut=600):
    f = mtof(m)
    s = saw(f, d, cut) * 0.6 + np.sin(2 * np.pi * f * tt(d)) * 0.8
    return s * env(d, 0.004, d * 0.6, 0.55, 0.03)

def pluck(m, d=0.35, cut=2600):
    f = mtof(m)
    return (saw(f, d, cut) * 0.7 + np.sin(2 * np.pi * 2 * f * tt(d)) * 0.15) * env(d, 0.002, 0.11, 0, 0.03)

def pad(notes, d, cut=1400):
    s = np.zeros(int(d * SR))
    for m in notes:
        for det in (-0.004, 0.0, 0.0045):
            s += saw(mtof(m), d, cut, det) * 0.33
    a = min(0.35, d / 3)
    return s * env(d, a, 10, 1.0, min(0.4, d / 3))

def stab(notes, d=0.22):
    s = np.zeros(int(d * SR))
    for m in notes:
        for det in (-0.006, 0.006): s += saw(mtof(m + 12), d, 3500, det) * 0.3
    return s * env(d, 0.003, 0.09, 0, 0.04)

# ---------------- score ----------------
def song():
    dry = np.zeros((2, N)); verb = np.zeros((2, N)); dly = np.zeros((2, N))
    kicks = []
    K = kick()
    for b in range(30):
        t0 = b * BAR; name = BARS[b]; root, tones = CH[name]; s = sec(b)
        # kick
        if s == 'intro':
            for q in (0, 2): add(dry, K, t0 + q * BEAT, 0.55); kicks.append(t0 + q * BEAT)
        elif s in ('tension', 'groove', 'drop', 'pre') or (s == 'build' and b == 15):
            for q in range(4):
                g = 0.7 if s == 'tension' else 0.95
                add(dry, K, t0 + q * BEAT, g); kicks.append(t0 + q * BEAT)
        # bass
        if s in ('tension', 'groove', 'drop', 'pre', 'build'):
            for e in range(8):
                if s == 'build' and b == 16: break
                m = root + (12 if (s in ('drop', 'pre') and e % 2) else 0)
                g = 0.55 if s == 'tension' else 0.7
                if s in ('groove', 'drop', 'pre') and e % 2 == 0: g *= 0.55   # off-beat pump
                add(dry, bass(m, 0.24, 500 if s == 'tension' else 900), t0 + e * 0.25, g)
        # pad
        padg = {'intro': 0.16, 'tension': 0.17, 'groove': 0.13, 'build': 0.14, 'drop': 0.12, 'pre': 0.12, 'end': 0.0}[s]
        if padg:
            cut = {'intro': 900, 'tension': 800, 'groove': 1600, 'build': 900 + 1400 * (b - 15), 'drop': 2600, 'pre': 2200}[s]
            p = pad(tones, BAR + 0.15, cut)
            add(dry, p, t0, padg * 0.8, -0.25); add(dry, p, t0, padg * 0.8, 0.25); add(verb, p, t0, padg * 0.5)
        # hats
        if s in ('intro', 'tension'):
            for e in range(4): add(dry, hat(), t0 + e * BEAT + 0.25, 0.18 if s == 'intro' else 0.25, 0.3)
        if s in ('groove', 'pre'):
            for e in range(8): add(dry, hat(), t0 + e * 0.25, 0.32 if e % 2 else 0.18, 0.3)
        if s == 'drop':
            for e in range(16): add(dry, hat(), t0 + e * 0.125, 0.22 if e % 2 else 0.12, 0.35)
            for q in range(4): add(dry, hat(True), t0 + q * BEAT + 0.25, 0.32, -0.2)
        # claps
        if (s == 'tension' and b >= 4) or s in ('groove', 'drop', 'pre'):
            for q in (1, 3): add(dry, clap(), t0 + q * BEAT, 0.55); add(verb, clap(), t0 + q * BEAT, 0.25)
        # plucks / arps
        arp = tones + [tones[0] + 12, tones[1] + 12]
        if s == 'intro':
            for q in range(4): add(dly, pluck(tones[q % 3] + 12, 0.4, 1800), t0 + q * BEAT, 0.16, 0.3 * (-1) ** q)
        if s == 'tension':
            for e in range(4): add(dly, pluck(arp[(e * 2) % 5] + 12, 0.3, 1500), t0 + e * BEAT + 0.25, 0.12, -0.3)
        if s == 'groove':
            for e in range(8): add(dly, pluck(arp[e % 5] + 12, 0.3, 2400), t0 + e * 0.25, 0.14, 0.4 * (-1) ** e)
        if s in ('drop', 'pre'):
            seq = [0, 2, 4, 1, 3, 4, 2, 0]
            for e in range(16): add(dly, pluck(arp[seq[e % 8]] + 12, 0.22, 3600), t0 + e * 0.125, 0.13, 0.45 * (-1) ** e)
        if s == 'drop':
            for q in range(4): add(dry, stab(tones), t0 + q * BEAT + 0.25, 0.22); add(verb, stab(tones), t0 + q * BEAT + 0.25, 0.08)
        # crashes on phrase starts
        if b in (8, 17, 21, 25) : add(dry, crash(), t0, 0.5); add(verb, crash(), t0, 0.2)
    # build: snare roll 30–34 accelerating, riser, gap before the drop
    for k in range(8): add(dry, snare(), 30 + k * 0.25, 0.25 + 0.03 * k)
    for k in range(8): add(dry, snare(), 32 + k * 0.125, 0.45 + 0.02 * k)
    for k in range(14): add(dry, snare(), 33 + k * 0.0625, 0.6 + 0.02 * k)
    rd = 4.0; rt = tt(rd)
    rise = noise(rd); rise = fftfilt(rise, 300, 9000) * (rt / rd) ** 2.2 * 0.35
    add(dry, rise, 30.0, 1.0); add(verb, rise, 30.0, 0.4)
    sw = np.sin(2 * np.pi * np.cumsum(220 * 2 ** (2 * rt / rd)) / SR) * (rt / rd) ** 2 * 0.12
    add(dry, sw, 30.0, 1.0)
    # pre-end short riser into the lockup
    rd2 = 1.5; rt2 = tt(rd2)
    add(dry, fftfilt(noise(rd2), 600, 9000) * (rt2 / rd2) ** 2.5 * 0.3, 54.5, 1.0)
    # the ending: C major bloom at 56 with a slow pluck pulse
    add(dry, K, 56.0, 1.0); kicks.append(56.0)
    add(dry, crash(3.5), 56.0, 0.6); add(verb, crash(3.5), 56.0, 0.3)
    endpad = pad([48, 55, 60, 64, 67, 72], 4.0, 1800)
    add(dry, endpad, 56.0, 0.14, -0.2); add(dry, endpad, 56.0, 0.14, 0.2); add(verb, endpad, 56.0, 0.12)
    add(dry, bass(36, 3.5, 300), 56.0, 0.8)
    for q, m in enumerate([72, 76, 79, 84, 79, 76, 72, 67]):
        add(dly, pluck(m, 0.5, 2000), 56.5 + q * 0.4, 0.12 * (1 - q / 10), 0.4 * (-1) ** q)
    # sidechain duck
    t = np.arange(N) / SR; duck = np.ones(N)
    for kt in kicks:
        i = int(kt * SR); n = min(N - i, int(0.35 * SR))
        duck[i:i + n] = np.minimum(duck[i:i + n], 1 - 0.55 * np.exp(-np.arange(n) / SR / 0.09))
    # delay (dotted eighth, ping-pong) then reverb
    out_d = dly.copy(); fb = 0.38
    for k in range(1, 5):
        dd = int(0.375 * k * SR); g = fb ** k
        out_d[k % 2, dd:] += dly[(k + 1) % 2, :N - dd] * g
    verb += out_d * 0.25
    ir_d = 2.4; irt = tt(ir_d)
    ir = np.stack([fftfilt(noise(ir_d), 200, 7000) * np.exp(-irt / 0.55) for _ in range(2)])
    ir /= np.abs(ir).sum(axis=1, keepdims=True) ** 0.5 * 40
    L = 1 << int(np.ceil(np.log2(N + len(irt))))
    wet = np.stack([np.fft.irfft(np.fft.rfft(verb[c], L) * np.fft.rfft(ir[c], L), L)[:N] for c in range(2)])
    mixd = (dry + out_d) * duck + wet * 0.9 * duck ** 0.5
    # section dynamics: intro 0.55 → tension 0.62 → groove 0.72 → build ramps → drop 1.0 → pre 0.85 → end 1.0
    pts = [(0, .55), (4, .55), (4.05, .62), (16, .62), (16.05, .72), (30, .72), (33.9, .95), (34.0, 1.0), (52, 1.0), (52.05, .85), (56, .85), (56.01, 1.0), (60, 1.0)]
    gcurve = np.interp(t, [a for a, _ in pts], [b for _, b in pts])
    mixd = mixd * gcurve
    # fade the tail
    fade = np.clip((DUR - t) / 1.2, 0, 1); mixd *= fade
    return mixd

# ---------------- UI sound design ----------------
PENTA = [69, 72, 74, 76, 79, 81, 84, 86]
def sfx_sig(c):
    ty, p = c['type'], int(c.get('p', 0))
    if ty == 'click':
        a = fftfilt(noise(0.006), 2000, 12000) * np.linspace(1, 0, int(0.006 * SR)) * 0.6
        a = np.pad(a, (0, int(0.08 * SR))); s = tt(0.012)
        a[:len(s)] += np.sin(2 * np.pi * 2300 * s) * np.exp(-s / 0.003) * 0.5
        r = fftfilt(noise(0.005), 2500, 12000) * 0.3 * np.linspace(1, 0, int(0.005 * SR))
        i = int(0.07 * SR); a[i:i + len(r)] += r
        return a
    if ty == 'tick':
        s = tt(0.03); f = 2400 + 90 * (p % 8)
        return np.sin(2 * np.pi * f * s) * np.exp(-s / 0.006) * 0.6
    if ty == 'key':
        d = 0.03; s = tt(d)
        return (fftfilt(noise(d), 1800 + 300 * (p % 4), 8000) * np.exp(-s / 0.005) * 0.55 +
                np.sin(2 * np.pi * (170 + 15 * (p % 3)) * s) * np.exp(-s / 0.008) * 0.35)
    if ty == 'pop':
        d = 0.08; s = tt(d); f = 280 + 900 * (s / d) ** 0.6
        return np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-s / 0.025) * 0.7
    if ty == 'blip':
        d = 0.3; s = tt(d); f = mtof(PENTA[p % len(PENTA)])
        return (np.sin(2 * np.pi * f * s) + 0.25 * np.sin(4 * np.pi * f * s)) * env(d, 0.003, 0.07, 0, 0.05) * 0.5
    if ty == 'chime':
        d = 1.4; s = tt(d); notes = [[81, 88], [84, 91], [81, 86, 93]][p % 3]; o = np.zeros_like(s)
        for k, m in enumerate(notes):
            f = mtof(m); sh = int(k * 0.06 * SR)
            v = sum(a * np.sin(2 * np.pi * f * r * s) * np.exp(-s / dd) for r, a, dd in ((1, 1, 0.5), (2.76, 0.3, 0.18), (5.4, 0.12, 0.08)))
            o[sh:] += v[:len(o) - sh]
        return o * 0.28
    if ty == 'thump':
        d = 0.35; s = tt(d); f = 46 + 90 * np.exp(-s / 0.03)
        return np.tanh(1.5 * np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-s / 0.11)) * 0.8
    if ty in ('whoosh', 'whooshR', 'swish', 'send'):
        d = {'whoosh': 0.42, 'whooshR': 0.6, 'swish': 0.2, 'send': 0.25}[ty]; s = tt(d)
        nb = noise(d); lo, hi = (500, 5000) if ty != 'swish' else (1500, 9000)
        shape = (s / d) ** (2.5 if ty == 'whooshR' else 1.6)
        shape = np.where(s < d * 0.85, shape, shape * np.exp(-(s - d * 0.85) / 0.02))
        o = fftfilt(nb, lo, hi) * shape * 0.6
        return o
    if ty == 'riserS':
        d = 1.2; s = tt(d)
        return fftfilt(noise(d), 800, 6000) * np.sin(np.pi * s / d) ** 2 * 0.25
    if ty == 'impact':
        d = 1.6; s = tt(d); f = 38 + 70 * np.exp(-s / 0.05)
        boom = np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-s / 0.45)
        return np.tanh(boom * 1.4) * 0.8 + fftfilt(noise(d), 2000, 14000) * np.exp(-s / 0.25) * 0.25
    raise ValueError(ty)

START_ALIGNED = {'riserS'}
def sfx(cues):
    buf = np.zeros((2, N)); marks = []
    for c in cues:
        x = sfx_sig(c)
        pk = 0 if c['type'] in START_ALIGNED else int(np.argmax(np.abs(x)))
        pan = {'key': -0.15, 'tick': 0.15, 'blip': 0.1 * ((c.get('p', 0) % 3) - 1)}.get(c['type'], 0)
        add(buf, x, c['t'] - pk / SR, c['g'], pan)
        marks.append((c['t'], c['type']))
    return buf, marks

def write(path, x):
    x = np.clip(x, -1, 1); d = (x.T * 32767).astype('<i2')
    with wave.open(path, 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(d.tobytes())

if __name__ == '__main__':
    cues = json.load(open(sys.argv[1]))
    s = song(); s /= np.abs(s).max(); write('song.wav', s * 0.9)
    f, marks = sfx(cues); f /= np.abs(f).max(); write('sfx.wav', f * 0.9)
    m = s * 0.6 + f * 0.42
    m *= 0.93 / np.abs(m).max()
    write('mix.wav', m)
    # verify: every cue's measured onset vs its intended time
    env_ = np.abs(f).max(axis=0); err = []
    for t, ty in marks:
        if ty in START_ALIGNED: continue
        i0, i1 = max(0, int((t - 0.03) * SR)), int((t + 0.03) * SR)
        err.append(abs((i0 + np.argmax(env_[i0:i1])) / SR - t))
    print('cues', len(marks), 'max |peak - cue| ms', round(max(err) * 1000, 2), 'median', round(float(np.median(err)) * 1000, 2))
