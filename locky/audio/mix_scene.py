# Mixes the ElevenLabs takes for "El telón" / "El último celular" onto each scene's timeline.
#   python3 mix_scene.py telon|celular [out.wav]
# Cue times come from blender/anim_frames_<scene>.json (exported from build/scenes/<scene>.js),
# so re-timing the choreography re-times the audio.  Takes: elevenlabs2/ (+ footsteps/sparkle from elevenlabs/).
import json, sys, wave, pathlib, subprocess
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
SCENE = sys.argv[1]
OUT = pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE.parent / 'output' / f'locky_{SCENE}_sfx.wav'
D = json.loads((HERE.parent / 'blender' / f'anim_frames_{SCENE}.json').read_text())
T = D['timeline']; SR = 48000; DUR = T['dur'] + 0.3
mix = np.zeros((int(SR * DUR), 2))

def load(name, rate=1.0):
    p = HERE / 'elevenlabs2' / f'{name}.mp3'
    if not p.exists(): p = HERE / 'elevenlabs' / f'{name}.mp3'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-f', 'f32le', '-ac', '2', '-ar', str(int(SR / rate)), '-'],
                         capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
def segments(x, thr_db=-38, min_gap=0.1):
    env = np.abs(x).max(1); win = int(0.005 * SR); env = np.convolve(env, np.ones(win) / win, 'same')
    on = env > 10 ** (thr_db / 20); out = []; i = 0; n = len(on); g = int(min_gap * SR)
    while i < n:
        if on[i]:
            j = i
            while j < n and (on[j] or on[j:j + g].any()): j += 1
            out.append((i, j)); i = j
        else: i += 1
    return out or [(0, len(x))]
def clip(x, start=0.0, length=None, fi=0.003, fo=0.05):
    a = int(start * SR); b = len(x) if length is None else min(len(x), a + int(length * SR)); y = x[a:b].copy()
    fi, fo = int(fi * SR), min(int(fo * SR), len(y) // 2)
    if fi: y[:fi] *= np.linspace(0, 1, fi)[:, None]
    if fo: y[-fo:] *= np.linspace(1, 0, fo)[:, None]
    return y
def first(name, maxlen=None, tail=0.15, rate=1.0, idx=0):
    x = load(name, rate); s, e = segments(x)[min(idx, len(segments(x)) - 1)]
    L = (e - s) / SR + tail; return clip(x, max(0, s / SR - 0.003), min(L, maxlen) if maxlen else L)
def norm(y, p=1.0): return y * (p / max(1e-9, np.abs(y).max()))
def put(y, t, gain=1.0, pan=0.0):
    i = int(t * SR); n = min(len(y), len(mix) - i)
    if n <= 0 or i < 0: return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
    mix[i:i + n, 0] += y[:n, 0] * gain * l; mix[i:i + n, 1] += y[:n, 1] * gain * r
def bed(name, t0, t1, gain, fade=0.4):
    """loop a short ambience with crossfades to fill t0..t1"""
    x = norm(load(name)); s, e = segments(x, -50)[0]; x = x[s:e]; L = len(x); xf = int(min(0.25, L / SR / 3) * SR)
    n = int((t1 - t0) * SR); out = np.zeros((n, 2)); pos = 0; k = 0
    while pos < n:
        seg = x[::-1] if k % 2 else x                                   # alternate direction: hides the loop
        w = np.ones(len(seg)); w[:xf] = np.linspace(0, 1, xf); w[-xf:] = np.linspace(1, 0, xf)
        m = min(len(seg), n - pos); out[pos:pos + m] += seg[:m] * w[:m, None]; pos += L - xf; k += 1
    f = int(fade * SR); out[:f] *= np.linspace(0, 1, f)[:, None]; out[-f:] *= np.linspace(1, 0, f)[:, None]
    put(out, t0, gain)
def steps(intervals, rate, g0=0.25, g1=0.3, pan=0.0):
    st = load('steps_a'); sl = [norm(clip(st, s / SR, min(0.13, (e - s) / SR + 0.04), 0.001, 0.03)) for s, e in segments(st)]
    for a, b in intervals:
        k = int(np.ceil(a * rate))
        while k / rate < b:
            put(sl[k % len(sl)], k / rate, g0 + (g1 - g0) * (k / rate / max(1e-3, T.get('walkEnd', b))), pan + (0.1 if k % 2 else -0.1)); k += 1

if SCENE == 'telon':
    bed('crowd_b', 0.0, T['release'] + 0.3, 0.32)
    steps([(0.05, T['walkEnd'] - 0.05)], 7.0, 0.18, 0.32, 0.25)
    put(norm(first('effort_a', 0.45)), T['pull1'] + 0.05, 0.55)
    put(norm(first('rope_a', 0.6)), T['pull1'] + 0.08, 0.4, -0.2)
    put(norm(first('slip_a', 0.45)), T['slip'], 0.5)
    put(norm(first('effort_b', 0.5)), T['pull2'] + 0.05, 0.6)
    put(norm(first('rope_b', 0.8)), T['pull2'] + 0.05, 0.45, -0.2)
    put(norm(first('effort_a', 0.45, idx=1)), T['hang'] + 0.1, 0.6)
    put(norm(first('rope_a', 0.4)), T['hang'] + 0.15, 0.35, -0.2)
    put(norm(first('crack_a')), T['crack'], 0.95)
    put(norm(first('fall_a', 0.7)), T['release'], 0.9)
    put(norm(first('fall_b', 0.6)), T['covered'] - 0.12, 0.6)
    put(norm(first('struggle_b', 0.7)), T['struggle'], 0.5)
    put(norm(first('struggle_a', 0.9)), T['struggle'] + 0.55, 0.45, 0.15)
    put(norm(first('struggle_b', 0.5)), T['slipOut'] - 0.35, 0.4, -0.1)
    put(norm(first('boing_a', 1.3)), T['emerge'] + 0.2, 0.5)
    put(norm(first('shake_b', 0.45)), T['shakeOff'], 0.5)
    put(norm(first('fwip_a')), T['throwT'] - 0.03, 0.75, -0.4)
    put(norm(first('chord_a')), T['smile'], 0.55)
    put(norm(first('sparkle_a', 0.6)), T['wave'] + 0.05, 0.3, 0.2)
elif SCENE == 'celular':
    put(norm(load('fallwhistle_b', 1.0)[:int(T['land'] * SR)]) * np.linspace(0.3, 1, int(T['land'] * SR))[:, None], 0.0, 0.45)
    put(norm(first('thud_a')), T['land'], 0.95)
    steps([(0.05, T['fright'] - 0.02), (T['walk2'] + 0.05, T['walk2End']), (T['walk3'], T['climb'])], 6.5, 0.25, 0.3, -0.2)
    bz = load('buzz_a'); bsegs = [norm(clip(bz, s / SR, min(0.42, (e - s) / SR + 0.02), 0.005, 0.04)) for s, e in segments(bz)]
    t = T['land'] + 0.08; k = 0
    while t < T['off'] - 0.05:
        y = bsegs[k % len(bsegs)][:int(min(0.44, T['off'] - t) * SR)]
        put(y, t, 0.45 if t < T['climbEnd'] else 0.55); t += 0.8; k += 1
    put(norm(first('notif_b', 1.0)), T['land'] + 0.25, 0.3, 0.3)
    put(norm(first('notif_a')), T['scratch'] + 0.2, 0.25, 0.3)
    put(norm(first('notif_b', 1.0)), T['climb'] + 0.6, 0.25, 0.3)
    put(norm(first('eep_a', 0.5)), T['fright'] + 0.02, 0.6, -0.2)
    put(norm(first('hmm_b')), T['scratch'] + 0.05, 0.6, -0.2)
    put(norm(first('idea_a')), T['idea'], 0.45)
    cl = load('climb_a'); csegs = [norm(clip(cl, s / SR, min(0.35, (e - s) / SR + 0.03), 0.004, 0.05)) for s, e in segments(cl)]
    t = T['climb'] + 0.05; k = 0
    while t < T['climbEnd']:
        put(csegs[k % len(csegs)], t, 0.42, -0.25); t += (T['climbEnd'] - T['climb']) / 6; k += 1
    put(norm(first('click_b', 0.4)), T['click'], 0.85)
    put(norm(first('off_a')), T['off'], 0.55)
    put(norm(first('sigh_b')), T['sigh'], 0.6)
    put(norm(first('chord_b')), T['wave'], 0.55)
    put(norm(first('sparkle_a', 0.6)), T['wave'] + 0.1, 0.3, 0.2)

# master: room taps, fade to black with the picture, soft clip, normalise
out = mix.copy()
for dl, gn in [(0.029, 0.1), (0.051, 0.08), (0.083, 0.05)]:
    k = int(dl * SR); out[k:] += mix[:-k][:, ::-1] * gn
f0 = int(T['fade'] * SR); f1 = int(T['dur'] * SR); out[f0:f1] *= np.linspace(1, 0, f1 - f0)[:, None] ** 1.5; out[f1:] = 0
out = np.tanh(out * 1.1) / np.tanh(1.1); out *= 0.89 / np.abs(out).max()
OUT.parent.mkdir(parents=True, exist_ok=True)
with wave.open(str(OUT), 'wb') as w:
    w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((out * 32767).astype(np.int16).tobytes())
print('wrote', OUT, round(len(out) / SR, 2), 's')
