# Mixes the ElevenLabs SFX takes (audio/elevenlabs/*.mp3) onto the v2 timeline.
#   python3 mix_elevenlabs.py [out.wav]      (default ../output/locky_sfx_v2_elevenlabs.wav)
# Cue times come from build/timeline.js, so re-timing the animation re-times the audio.
# Prompts / generation ids of every take are listed in elevenlabs/manifest.json.
import json, re, sys, wave, pathlib, subprocess
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
CLIPS = HERE / 'elevenlabs'
TL = json.loads(re.sub(r'^window\.TL\s*=\s*', '', (HERE.parent / 'build' / 'timeline.js').read_text()))
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'output' / 'locky_sfx_v2_elevenlabs.wav'
SR = 48000
DUR = TL['dur'] + 0.4
mix = np.zeros((int(SR * DUR), 2))

def load(name, rate=1.0):
    """decode mp3 -> float stereo @SR (rate > 1 = pitched up / shorter)"""
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(CLIPS / f'{name}.mp3'), '-f', 'f32le', '-ac', '2',
                          '-ar', str(int(SR / rate)), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)

def segments(x, thr_db=-40, min_gap=0.12):
    """non-silent regions [(start, end)] in samples"""
    env = np.abs(x).max(1); thr = 10 ** (thr_db / 20)
    win = int(0.005 * SR); env = np.convolve(env, np.ones(win) / win, 'same')
    on = env > thr; out = []; i = 0; n = len(on)
    while i < n:
        if on[i]:
            j = i
            while j < n and (on[j] or (j + int(min_gap * SR) < n and on[j:j + int(min_gap * SR)].any())): j += 1
            out.append((i, j)); i = j
        else: i += 1
    return out

def clip(x, start=0.0, length=None, fade_in=0.003, fade_out=0.05):
    a = int(start * SR); b = len(x) if length is None else min(len(x), a + int(length * SR))
    y = x[a:b].copy(); fi, fo = int(fade_in * SR), int(fade_out * SR)
    if fi: y[:fi] *= np.linspace(0, 1, fi)[:, None]
    if fo and len(y) > fo: y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return y

def first_event(x, tail=0.6):
    s, e = segments(x)[0]
    return clip(x, max(0, s / SR - 0.002), (e - s) / SR + tail)

def put(y, t, gain=1.0, pan=0.0):
    i = int(t * SR); n = min(len(y), len(mix) - i)
    if n <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
    mix[i:i + n, 0] += y[:n, 0] * gain * l; mix[i:i + n, 1] += y[:n, 1] * gain * r

def norm(y, peak=1.0): return y * (peak / max(1e-9, np.abs(y).max()))

# ---- footsteps: slice the recorded steps and lay one on every step of the walk cycle ----
st = load('steps_a'); steps = [norm(clip(st, s / SR, (e - s) / SR + 0.04, 0.001, 0.03)) for s, e in segments(st)]
k = 1
while k / TL['stepRate'] < TL['impact'] - 0.05:
    ts = k / TL['stepRate']; prox = ts / TL['impact']
    put(steps[k % len(steps)], ts - 0.01, 0.10 + 0.30 * prox ** 1.5, -0.25 if k % 2 else 0.25); k += 1

# ---- whistling stroll: chain the takes (slightly re-pitched so the repeat isn't obvious) ----
w_end = TL['whistleEnd']; t = 0.12; parts = [('whistle_a', 1.0), ('whistle_b', 1.0), ('whistle_a', 1.06), ('whistle_b', 0.95)]
for name, rate in parts:
    if t >= w_end - 0.2: break
    x = load(name, rate); segs = segments(x); s = segs[0][0] / SR; e = segs[-1][1] / SR
    y = clip(x, s, min(e - s, w_end - t), 0.01, 0.06)
    put(norm(y), t, 0.10 + 0.14 * (t / TL['impact']) ** 1.3, -0.1); t += len(y) / SR + 0.04

# ---- impact: plonk (first hit only) ----
put(norm(first_event(load('plonk_a'), 0.7)), TL['impact'] - 0.005, 0.95)

# ---- squeak down the glass (stretched across the slide) ----
sq = load('squeak_a'); s, e = segments(sq)[0][0], segments(sq)[-1][1]
slide = TL['slideEnd'] - TL['slideStart']; rate = (e - s) / SR / slide
put(norm(clip(load('squeak_a', rate), s / SR / rate, slide, 0.01, 0.08)), TL['slideStart'], 0.40, 0.05)

# ---- soft thud out of frame ----
put(norm(first_event(load('thud_a'), 0.3)), TL['slideEnd'] + 0.02, 0.55)

# ---- peek boop / shy giggle / wave sparkle / wink ting ----
put(norm(first_event(load('boop_a'), 0.2)), TL['peekStart'] + 0.12, 0.40)
put(norm(clip(load('giggle_a'), 0.0, 1.1, 0.005, 0.25)), TL['embarrassed'], 0.42, -0.05)
put(norm(first_event(load('sparkle_a'), 0.4)), TL['waveStart'] + 0.06, 0.30, -0.3)
put(norm(first_event(load('ting_b'), 0.6)), TL['wink'] + 0.05, 0.35, 0.2)

# ---- master: short room taps, fade, soft clip, normalise ----
out = mix.copy()
for dl, gn in [(0.031, 0.12), (0.053, 0.09), (0.087, 0.06)]:
    k = int(dl * SR); out[k:] += mix[:-k][:, ::-1] * gn
fl = int(0.35 * SR); out[-fl:] *= np.linspace(1, 0, fl)[:, None]
out = np.tanh(out * 1.1) / np.tanh(1.1); out *= 0.89 / np.abs(out).max()
OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
print('wrote', OUT, round(len(out) / SR, 2), 's')
