import base64, pathlib
here = pathlib.Path(__file__).resolve().parent
glb = here.parent / 'input' / 'LockyBase2026_rigfix.glb'
(here / 'glb.js').write_text('window.GLB_B64="' + base64.b64encode(glb.read_bytes()).decode() + '";')
print('wrote', here / 'glb.js')
