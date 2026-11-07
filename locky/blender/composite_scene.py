# Comp for the new entrances: background plate + Blender RGBA frames + fade to black + audio -> MP4.
#   python3 composite_scene.py telon|celular [frames_dir=out_<scene>] [out.mp4]      (STEP=2 for 30 fps)
import os, sys, json, pathlib, subprocess, tempfile
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent; ROOT = HERE.parent
SCENE = sys.argv[1]
FR = (pathlib.Path(sys.argv[2]) if len(sys.argv) > 2 else HERE / f'out_{SCENE}').resolve()
OUT = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else ROOT / 'output' / f'locky_entrada_{SCENE}.mp4'
AU = ROOT / 'output' / f'locky_{SCENE}_sfx.wav'
T = json.loads((HERE / f'anim_frames_{SCENE}.json').read_text())['timeline']
STEP = int(os.environ.get('STEP', '1')); FPS = 60 // STEP
frames = sorted(int(p.stem[2:]) for p in FR.glob('f_*.png') if p.stat().st_size > 0 and int(p.stem[2:]) % STEP == 0)
W, H = map(int, subprocess.run(['ffprobe', '-v', 'error', '-select_streams', 'v', '-show_entries', 'stream=width,height', '-of', 'csv=p=0',
                                str(FR / f'f_{frames[0]:04d}.png')], capture_output=True, text=True).stdout.strip().split(','))
# plate: brand blue (#4B55D6-ish, as in the storyboards), soft vertical light + spotlight vignette
bg = np.array([0x4E, 0x58, 0xDA]) / 255
X, Y = np.meshgrid((np.arange(W) + 0.5) / W, 1 - (np.arange(H) + 0.5) / H)
ss = lambda e0, e1, v: (lambda u: u * u * (3 - 2 * u))(np.clip((v - e0) / (e1 - e0), 0, 1))
r = np.hypot((X - 0.5) * W / H / 1.6, Y - 0.6)
c = bg[None, None] * (0.9 + 0.18 * Y)[..., None] * (1.08 - 0.22 * ss(0.1, 1.1, r))[..., None]
plate = HERE / f'bg_plate_{SCENE}.png'
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-f', 'rawvideo', '-pix_fmt', 'rgb24', '-s', f'{W}x{H}', '-i', '-', str(plate)],
               input=(np.clip(c, 0, 1) * 255 + 0.5).astype(np.uint8).tobytes(), check=True)
tmp = pathlib.Path(tempfile.mkdtemp())
for i, f in enumerate(frames): (tmp / f'b_{i:05d}.png').symlink_to(FR / f'f_{f:04d}.png')
fd = T['dur'] - T['fade']
print('compositing', len(frames), 'frames @', FPS, 'fps', f'{W}x{H}')
subprocess.run(['ffmpeg', '-v', 'error', '-y', '-loop', '1', '-framerate', str(FPS), '-i', str(plate),
    '-framerate', str(FPS), '-i', str(tmp / 'b_%05d.png'), '-i', str(AU),
    '-filter_complex', f'[0][1]overlay=shortest=1,fade=t=out:st={T["fade"]}:d={fd},scale=trunc(iw/2)*2:trunc(ih/2)*2,format=yuv420p[v]',
    '-map', '[v]', '-map', '2:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16', '-c:a', 'aac', '-b:a', '192k', '-shortest', str(OUT)], check=True)
print('wrote', OUT)
