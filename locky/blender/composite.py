# Final comp: background plate (same maths as the v1 BG shader) + Blender RGBA frames
# + 2D glass FX from the WebGL overlay pass + audio  ->  MP4.
#   python3 composite.py [blender_frames_dir] [overlay_dir] [audio.wav] [out.mp4]
import sys, pathlib, subprocess
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
ROOT = HERE.parent
a = sys.argv[1:]
FR = pathlib.Path(a[0]) if len(a) > 0 else HERE / 'out'
OV = pathlib.Path(a[1]) if len(a) > 1 else ROOT / 'frames_overlay'
AU = pathlib.Path(a[2]) if len(a) > 2 else ROOT / 'output' / 'locky_sfx_v2_elevenlabs.wav'
OUT = pathlib.Path(a[3]) if len(a) > 3 else ROOT / 'output' / 'locky_entrada_choque_v2.mp4'
W, H = 1920, 1080

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

subprocess.run(['ffmpeg', '-v', 'error', '-y',
    '-loop', '1', '-framerate', '60', '-i', str(plate),
    '-framerate', '60', '-i', str(FR / 'f_%04d.png'),
    '-framerate', '60', '-i', str(OV / 'f_%05d.png'),
    '-i', str(AU),
    '-filter_complex', '[0][1]overlay=shortest=1[a];[a][2]overlay=shortest=1,format=yuv420p[v]',
    '-map', '[v]', '-map', '3:a', '-c:v', 'libx264', '-preset', 'slow', '-crf', '16',
    '-c:a', 'aac', '-b:a', '192k', '-shortest', str(OUT)], check=True)
print('wrote', OUT)
