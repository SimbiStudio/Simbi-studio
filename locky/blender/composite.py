# Final comp: background plate (same maths as the v1 BG shader) + Blender RGBA frames
# + 2D glass FX from the WebGL overlay pass + audio  ->  MP4.
#   python3 composite.py [blender_frames_dir] [overlay_dir] [audio.wav] [out.mp4]
import os, re, sys, json, pathlib, subprocess, tempfile
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
a = sys.argv[1:]
FR = (pathlib.Path(a[0]) if len(a) > 0 else HERE / 'out').resolve()
OV = (pathlib.Path(a[1]) if len(a) > 1 else ROOT / 'frames_overlay').resolve()
AU = pathlib.Path(a[2]) if len(a) > 2 else ROOT / 'output' / 'locky_sfx_v2_elevenlabs.wav'
OUT = pathlib.Path(a[3]) if len(a) > 3 else ROOT / 'output' / 'locky_entrada_choque_v2.mp4'
W, H = 1920, 1080
TL = json.loads(re.sub(r'^window\.TL\s*=\s*', '', (ROOT / 'build' / 'timeline.js').read_text()))
STEP = int(os.environ.get('STEP', '1'))          # 2 = 30 fps delivery from the 60 fps timeline
FPS = 60 // STEP

# background plate: vertical light + off-centre spotlight vignette, BG ~#4E58DA
bg = np.array([0x4E, 0x58, 0xDA]) / 255
x = (np.arange(W) + 0.5) / W; y = 1 - (np.arange(H) + 0.5) / H
X, Y = np.meshgrid(x, y)
ss = lambda e0, e1, v: (lambda u: u * u * (3 - 2 * u))(np.clip((v - e0) / (e1 - e0), 0, 1))
r = np.hypot((X - 0.5) * W / H, Y - 0.62)
c = bg[None, None] * (0.88 + 0.22 * Y)[..., None] * (1.10 - 0.30 * ss(0.1, 1.15, r))[..., None]
plate = HERE / 'bg_plate.png'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-i', '-', str(plate)],
               input=(np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes(), check=True)

# contiguous symlinked sequences (every STEP-th frame of the 60 fps timeline)
tmp = pathlib.Path(tempfile.mkdtemp())
frames = sorted(int(p.stem[2:]) for p in FR.glob('f_*.png') if p.stat().st_size > 0 and int(p.stem[2:]) % STEP == 0)
for i, f in enumerate(frames):
    (tmp / f'b_{i:05d}.png').symlink_to(FR / f'f_{f:04d}.png'); (tmp / f'o_{i:05d}.png').symlink_to(OV / f'f_{f:05d}.png')
print('compositing', len(frames), 'frames @', FPS, 'fps')
subprocess.run(['ffmpeg', '-v', 'error', '-y',
    '-loop', '1', '-framerate', str(FPS), '-i', str(plate),
    '-framerate', str(FPS), '-i', str(tmp / 'b_%05d.png'),
    '-framerate', str(FPS), '-i', str(tmp / 'o_%05d.png'),
    '-i', str(AU),
    '-filter_complex', '[0][1]overlay=shortest=1[a];[a][2]overlay=shortest=1' + (f',fade=t=out:st={TL["fade"]}:d={TL["dur"] - TL["fade"]}' if 'fade' in TL else '') + ',format=yuv420p[v]',
    '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', str(OUT)], check=True)
print('wrote', OUT)
