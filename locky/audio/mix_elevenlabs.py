# "El choque" sound mix (v2.5): ElevenLabs takes laid on the timeline as stems, then mastered with ffmpeg.
#   python3 mix_elevenlabs.py [out.wav]      (default ../output/locky_sfx_v2_elevenlabs.wav)
# Stems: whistle / steps / impact / fx  ->  per-stem EQ, shared convolution reverb (synthetic room IR),
# bus compressor, limiter, loudness -16 LUFS / -1.5 dBTP, fade with the picture.
# Also writes build/whistle_env.js (whistle envelope + pitch per 60 fps frame) for the mouth animation.
import json, re, sys, wave, pathlib, subprocess, tempfile
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
CLIPS, CLIPS2 = HERE / 'elevenlabs', HERE / 'elevenlabs2'
TL = json.loads(re.sub(r'^window\.TL\s*=\s*', '', (HERE.parent / 'build' / 'timeline.js').read_text()))
OUT = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HERE.parent / 'output' / 'locky_sfx_v2_elevenlabs.wav'
SR = 48000; DUR = TL['dur'] + 0.2; N = int(SR * DUR)
stems = {k: np.zeros((N, 2)) for k in ('whistle', 'steps', 'impact', 'fx')}
rng = np.random.default_rng(3)

def load(name, rate=1.0):
    p = CLIPS / f'{name}.mp3'
    if not p.exists(): p = CLIPS2 / f'{name}.mp3'
    raw = subprocess.run(['ffmpeg', '-v', 'error', '-i', str(p), '-f', 'f32le', '-ac', '2', '-ar', str(int(SR / rate)), '-'], capture_output=True, check=True).stdout
    return np.frombuffer(raw, np.float32).reshape(-1, 2).astype(np.float64)
def segments(x, thr_db=-40, min_gap=0.12):
    env = np.abs(x).max(1); w = int(0.005 * SR); env = np.convolve(env, np.ones(w) / w, 'same')
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
def first(name, tail=0.6, maxlen=None):
    x = load(name); s, e = segments(x)[0]; L = (e - s) / SR + tail
    return clip(x, max(0, s / SR - 0.002), min(L, maxlen) if maxlen else L)
def norm(y, p=1.0): return y * (p / max(1e-9, np.abs(y).max()))
def put(stem, y, t, gain=1.0, pan=0.0):
    i = int(t * SR); n = min(len(y), N - i)
    if n <= 0: return
    l, r = np.cos((pan + 1) * np.pi / 4) * 1.4142, np.sin((pan + 1) * np.pi / 4) * 1.4142
    stems[stem][i:i + n, 0] += y[:n, 0] * gain * l; stems[stem][i:i + n, 1] += y[:n, 1] * gain * r
def tt(d): return np.arange(int(d * SR)) / SR
def env(t, a, d): return np.minimum(1, t / max(a, 1e-4)) * np.exp(-np.maximum(0, t - a) / d)
def mono(y): return np.stack([y, y], 1)

# ---- footsteps: one recorded step per foot contact (contacts every 1/stepRate s)
st = load('steps_a'); steps = [norm(clip(st, s / SR, min(0.13, (e - s) / SR + 0.04), 0.001, 0.03)) for s, e in segments(st)]
k = 1
while k / TL['stepRate'] < TL['impact'] - 0.06:
    ts = k / TL['stepRate']; prox = ts / TL['impact']
    put('steps', steps[k % len(steps)], ts - 0.008, 0.10 + 0.28 * prox ** 1.5, -0.2 if k % 2 else 0.2); k += 1

# ---- whistle: one continuous melody (take c, then take a continues it in the same register)
w_end = TL['whistleEnd']; t0 = 0.10
c = load('whistle2_c'); sc_, ec_ = segments(c, -35)[0][0], segments(c, -35)[-1][1]
part1 = clip(c, sc_ / SR, (ec_ - sc_) / SR, 0.02, 0.06)
a = load('whistle2_a'); part2 = clip(a, 0.21, max(0.1, w_end - (t0 + len(part1) / SR) + 0.05), 0.04, 0.12)
xf = int(0.05 * SR); wh = np.concatenate([part1[:-xf], part1[-xf:] + part2[:xf], part2[xf:]])
wh = norm(wh); ramp = np.clip((np.arange(len(wh)) / SR + t0) / TL['impact'], 0, 1) ** 1.2
put('whistle', wh * (0.55 + 0.45 * ramp)[:, None], t0, 0.32, -0.08)

# ---- impact: ElevenLabs plonk + sub thump + glass ting + smack transient
it = TL['impact'] - 0.004
put('impact', norm(first('plonk_a', 0.7)), it, 0.9)
t = tt(0.5); sub = np.sin(2 * np.pi * np.cumsum(48 + 70 * np.exp(-t * 30)) / SR) * env(t, 0.002, 0.13)
put('impact', mono(sub), it, 0.75)
t = tt(1.0); ting = (np.sin(2 * np.pi * 2630 * t) + 0.55 * np.sin(2 * np.pi * 4170 * t) + 0.25 * np.sin(2 * np.pi * 5890 * t)) * env(t, 0.001, 0.28)
put('impact', mono(ting), it + 0.008, 0.07, 0.1)
t = tt(0.05); smack = rng.standard_normal(len(t)) * env(t, 0.0004, 0.008)
put('impact', mono(smack), it, 0.35)

# ---- glass squeak (stretched across the slide), soft thud out of frame
sq = load('squeak_a'); s, e = segments(sq)[0][0], segments(sq)[-1][1]
slide = TL['slideEnd'] - TL['slideStart']; rate = (e - s) / SR / slide
put('fx', norm(clip(load('squeak_a', rate), s / SR / rate, slide, 0.01, 0.08)), TL['slideStart'], 0.32, 0.05)
put('fx', norm(first('thud_a', 0.3)), TL['slideEnd'] + 0.02, 0.5)
# ---- peek boop / shy giggle / wave sparkle / wink ting / closing chord / second-wave sparkle
put('fx', norm(first('boop_a', 0.2)), TL['peekStart'] + 0.12, 0.38)
put('fx', norm(clip(load('giggle_a'), 0.0, 1.1, 0.005, 0.25)), TL['embarrassed'], 0.4, -0.05)
put('fx', norm(first('sparkle_a', 0.4)), TL['waveStart'] + 0.06, 0.26, -0.3)
put('fx', norm(first('ting_b', 0.6)), TL['wink'] + 0.05, 0.32, 0.2)
put('fx', norm(first('chord_a', 1.0)), TL['settle'] + 0.05, 0.3)
put('fx', norm(first('sparkle_a', 0.4)), TL['wave2'] + 0.08, 0.2, 0.25)

# ---- whistle envelope + pitch per 60 fps frame -> mouth animation (build/whistle_env.js)
m = stems['whistle'].mean(1); hop = SR // 60; nf = int(TL['dur'] * 60) + 1; amp = np.zeros(nf); pit = np.zeros(nf); win = np.hanning(2048)
for f in range(nf):
    c0 = f * hop; seg = m[max(0, c0 - 1024):c0 + 1024]
    if len(seg) < 2048: seg = np.pad(seg, (0, 2048 - len(seg)))
    amp[f] = np.sqrt(np.mean(seg ** 2)); sp = np.abs(np.fft.rfft(seg * win)); fr = np.fft.rfftfreq(2048, 1 / SR); b = (fr > 700) & (fr < 4000)
    pit[f] = fr[b][np.argmax(sp[b])] if amp[f] > 1e-4 else 0
amp = amp / max(1e-9, amp.max()); amp = np.clip((amp - 0.08) / 0.6, 0, 1)
voiced = pit[amp > 0.2]; lo, hi = (np.percentile(voiced, 10), np.percentile(voiced, 90)) if len(voiced) else (1, 2)
pn = np.where(amp > 0.05, np.clip((pit - lo) / max(1, hi - lo), 0, 1), 0)
(HERE.parent / 'build' / 'whistle_env.js').write_text('window.WHISTLE = ' + json.dumps({'fps': 60, 'amp': [round(float(v), 3) for v in amp], 'pitch': [round(float(v), 3) for v in pn]}) + ';\n')

# ---- master with ffmpeg: per-stem EQ, convolution reverb send, bus comp, limiter, loudness, fade
tmp = pathlib.Path(tempfile.mkdtemp())
def wav(path, x):
    with wave.open(str(path), 'wb') as w:
        w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes((np.clip(x, -1, 1) * 32767).astype(np.int16).tobytes())
pk = max(np.abs(s_).max() for s_ in stems.values()) * 1.05
for k_, x in stems.items(): wav(tmp / f'{k_}.wav', x / pk)
# small bright room: early reflections + 0.55 s RT60 decorrelated tail, gently low-passed
L = int(0.9 * SR); ir = np.zeros((L, 2)); tt_ = np.arange(L) / SR
for ch in range(2):
    tail = rng.standard_normal(L) * np.exp(-6.9 * tt_ / 0.55) * (tt_ > 0.012)
    tail = np.convolve(tail, np.ones(6) / 6, 'same'); ir[:, ch] = tail
    for d, g in [(0.011, 0.5), (0.017, 0.35), (0.023, 0.3), (0.031, 0.22)]: ir[int((d + 0.002 * ch) * SR), ch] += g
ir /= np.abs(ir).sum(0).max() / 4; wav(tmp / 'ir.wav', ir / np.abs(ir).max() * 0.9)
fade_st, fade_d = TL.get('fade', TL['dur'] - 0.6), TL['dur'] - TL.get('fade', TL['dur'] - 0.6)
fc = ('[0]highpass=f=350,equalizer=f=2600:t=q:w=1.2:g=2,equalizer=f=6500:t=q:w=1:g=-2[w];'
      '[1]highpass=f=90,lowpass=f=9000,equalizer=f=220:t=q:w=1:g=-3[s];'
      '[2]highpass=f=25,equalizer=f=60:t=q:w=1:g=3,equalizer=f=450:t=q:w=1.4:g=-3,equalizer=f=3000:t=q:w=1:g=1.5[i];'
      '[3]highpass=f=70,equalizer=f=3500:t=q:w=1:g=1[e];'
      '[w]asplit[wd][ws];[s]asplit[sd][ss];[i]asplit[id][is];[e]asplit[ed][es];'
      '[ws]volume=0.30[w2];[ss]volume=0.16[s2];[is]volume=0.22[i2];[es]volume=0.24[e2];'
      '[w2][s2][i2][e2]amix=inputs=4:normalize=0[send];[send][4]afir=dry=0:wet=1[rev];'
      '[wd][sd][id][ed][rev]amix=inputs=5:normalize=0,'
      'acompressor=threshold=-20dB:ratio=2.5:attack=6:release=140:makeup=2,treble=g=1.5:f=9000,'
      f'alimiter=limit=0.89:level=false,afade=t=out:st={fade_st}:d={fade_d}:curve=qsin,'
      'loudnorm=I=-16:TP=-1.5:LRA=11,aresample=48000[out]')
OUT.parent.mkdir(parents=True, exist_ok=True)
subprocess.run(['ffmpeg', '-v', 'error', '-y'] + sum([['-i', str(tmp / f'{k_}.wav')] for k_ in ('whistle', 'steps', 'impact', 'fx')], []) +
               ['-i', str(tmp / 'ir.wav'), '-filter_complex', fc, '-map', '[out]', '-c:a', 'pcm_s16le', '-t', str(TL['dur']), str(OUT)], check=True)
print('wrote', OUT)
