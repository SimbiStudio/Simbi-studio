# Placeholder SFX synthesised with numpy (the ElevenLabs version lives in ../audio/).
# usage: python3 sfx.py [out.wav]   (default ../output/locky_sfx_v2.wav)
import json, re, sys, wave, pathlib, numpy as np
HERE = pathlib.Path(__file__).resolve().parent
TL = json.loads(re.sub(r'^window\.TL\s*=\s*', '', (HERE / 'timeline.js').read_text()))
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'output' / 'locky_sfx_v2.wav'
SR = 48000; DUR = TL['dur'] + 0.4
L = np.zeros(int(SR * DUR)); R = np.zeros_like(L)
rng = np.random.default_rng(7)

def put(sig, t, gain=1.0, pan=0.0):
    i = int(t * SR); n = min(len(sig), len(L) - i)
    if n <= 0: return
    l = np.cos((pan + 1) * np.pi / 4) * 1.4142; r = np.sin((pan + 1) * np.pi / 4) * 1.4142
    L[i:i+n] += sig[:n] * gain * l; R[i:i+n] += sig[:n] * gain * r

def tt(d): return np.arange(int(d * SR)) / SR
def env(t, a, d): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def sweep(f, t): return 2 * np.pi * np.cumsum(f) / SR
def lp(x, a):  # one-pole lowpass, a in (0,1)
    y = np.zeros_like(x); s = 0.0
    for i in range(len(x)): s += a * (x[i] - s); y[i] = s
    return y
def bp_noise(d, lo_a, hi_a):
    n = rng.standard_normal(int(d * SR)); return lp(n, hi_a) - lp(n, lo_a)

# ---- footsteps: soft rubbery taps ----
def step():
    t = tt(0.12); f = 260 * np.exp(-t * 30) + 120
    body = np.sin(sweep(f, t)) * env(t, 0.002, 0.035)
    click = bp_noise(0.12, 0.05, 0.6) * env(t, 0.0005, 0.008)
    return body * 0.8 + click * 0.5
rate = TL['stepRate']; k = 1
while k / rate < TL['impact'] - 0.02:
    ts = k / rate; prox = (ts / TL['impact'])
    put(step(), ts, 0.10 + 0.32 * prox ** 1.5, -0.25 if k % 2 else 0.25); k += 1

# ---- whistling while strolling ----
notes = [(0.15, 79), (0.42, 76), (0.62, 79), (0.95, 81), (1.2, 79), (1.38, 76), (1.62, 74), (1.95, 76),
         (2.2, 79), (2.4, 83), (2.62, 81), (2.85, 79)]
wt = tt(TL['whistleEnd'] + 0.05)
freq = np.zeros_like(wt); amp = np.zeros_like(wt)
for i, (st, m) in enumerate(notes):
    en = notes[i + 1][0] if i + 1 < len(notes) else TL['whistleEnd'] - 0.02
    f0 = 440 * 2 ** ((m - 69) / 12)
    sel = (wt >= st) & (wt < en)
    u = (wt[sel] - st)
    prevf = 440 * 2 ** ((notes[i - 1][1] - 69) / 12) if i else f0
    glide = np.exp(-u / 0.025)
    freq[sel] = f0 + (prevf - f0) * glide
    amp[sel] = np.minimum(1, u / 0.03) * np.minimum(1, (en - wt[sel]) / 0.04) * (0.85 + 0.15 * np.sin(u * 30))
freq[freq == 0] = 600
vib = 1 + 0.012 * np.sin(2 * np.pi * 5.8 * wt)
amp = lp(amp, 0.01)
whistle = np.sin(sweep(freq * vib, wt)) * amp + 0.06 * bp_noise(len(wt) / SR, 0.2, 0.5)[:len(wt)] * amp
dist = np.clip(wt / TL['impact'], 0, 1)
put(whistle * (0.08 + 0.16 * dist ** 1.3), 0.0, 1.0, -0.1)

# ---- PLONK ----
t = tt(1.2)
f1 = 300 * (1 + 0.45 * np.exp(-t * 60)); f2 = 760 * (1 + 0.2 * np.exp(-t * 50))
plonk = (np.sin(sweep(f1, t)) * env(t, 0.001, 0.13) * 1.0 + np.sin(sweep(f2, t)) * env(t, 0.001, 0.05) * 0.45)
thump = np.sin(sweep(70 + 90 * np.exp(-t * 40), t)) * env(t, 0.001, 0.09)
ting = (np.sin(2 * np.pi * 2630 * t) * 0.5 + np.sin(2 * np.pi * 4170 * t) * 0.3 + np.sin(2 * np.pi * 5890 * t) * 0.15) * env(t, 0.0008, 0.32)
smack = bp_noise(1.2, 0.08, 0.7) * env(t, 0.0005, 0.012)
put(plonk * 0.9 + thump * 0.9 + ting * 0.13 + smack * 0.35, TL['impact'], 0.85)
# squishy wobble after the hit
t = tt(0.5); wobf = 140 + 30 * np.sin(2 * np.pi * 9 * t)
put(np.sin(sweep(wobf, t)) * env(t, 0.02, 0.12) * 0.25, TL['impact'] + 0.05, 0.6)

# ---- squeak while sliding down the glass (stick-slip) ----
s0, s1, n = TL['slideStart'], TL['slideEnd'], TL['slideStutters']
t = tt(s1 - s0 + 0.05); u = np.clip(t / (s1 - s0), 0, 1)
slip = 1 - 0.85 * np.cos(2 * np.pi * n * u)  # derivative of stick-slip curve -> speed
spd = slip * (0.4 + 1.2 * u)
f = 1050 + 380 * (spd / spd.max()) + 60 * np.sin(2 * np.pi * 33 * t) - 250 * u
ph = sweep(f, t)
sq = (np.sin(ph) + 0.45 * np.sin(2 * ph) + 0.2 * np.sin(3 * ph)) * (0.5 + 0.5 * np.sin(2 * np.pi * 47 * t)) ** 2
a = np.clip(slip - 0.25, 0, None) / 1.6; a = lp(a, 0.01)
put(sq * a, s0, 0.16, 0.05)
# soft bump when he lands out of frame
t = tt(0.4); put(np.sin(sweep(55 + 60 * np.exp(-t * 30), t)) * env(t, 0.002, 0.08), s1 + 0.02, 0.45)

# ---- peek "boop" ----
t = tt(0.22); put(np.sin(sweep(260 + 520 * (t / 0.22) ** 0.7, t)) * env(t, 0.01, 0.06), TL['peekStart'] + 0.12, 0.28)
# ---- shy little giggle-ish notes ----
for i, (dt_, m) in enumerate([(0.0, 84), (0.09, 81), (0.18, 84)]):
    t = tt(0.12); f0 = 440 * 2 ** ((m - 69) / 12)
    put(np.sin(sweep(f0 * (1 + 0.03 * np.sin(2 * np.pi * 14 * t)), t)) * env(t, 0.005, 0.04), TL['embarrassed'] + dt_, 0.12)

def bell(f0, d=0.9):
    t = tt(d); return (np.sin(2 * np.pi * f0 * t) + 0.35 * np.sin(2 * np.pi * f0 * 2.76 * t) * np.exp(-t * 6) + 0.15 * np.sin(2 * np.pi * f0 * 5.4 * t) * np.exp(-t * 10)) * env(t, 0.002, 0.25)
# ---- wave sparkle ----
for i, m in enumerate([84, 88, 91, 96]):
    put(bell(440 * 2 ** ((m - 69) / 12)), TL['waveStart'] + 0.06 + i * 0.06, 0.07, -0.4 + i * 0.1)

# ---- wink 'ting' ----
put(bell(440 * 2 ** ((101 - 69) / 12), 1.2), TL['wink'] + 0.05, 0.09, 0.2)

# ---- master ----
mix = np.stack([L, R], 1)
# gentle reverb-ish: a few delayed taps
out = mix.copy()
for dl, gn in [(0.031, 0.18), (0.053, 0.14), (0.087, 0.10), (0.131, 0.07)]:
    k = int(dl * SR); out[k:] += mix[:-k][:, ::-1] * gn
fade = np.ones(len(out)); fl = int(0.35 * SR); fade[-fl:] = np.linspace(1, 0, fl)
out *= fade[:, None]
out = np.tanh(out * 1.1) / np.tanh(1.1)
out *= 0.89 / np.abs(out).max()
pcm = (out * 32767).astype(np.int16)
OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(pcm.tobytes())
print('wrote', OUT, len(pcm) / SR, 's')
