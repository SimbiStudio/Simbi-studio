import sys, json, time, pathlib
from playwright.sync_api import sync_playwright
# usage: capture.py outdir t0 t1 fps [single times as json]
out = pathlib.Path(sys.argv[1]); out.mkdir(parents=True, exist_ok=True)
mode = sys.argv[2]
with sync_playwright() as p:
    b = p.chromium.launch(executable_path='/usr/bin/google-chrome', headless=True,
        args=['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--allow-file-access-from-files', '--ignore-gpu-blocklist'])
    pg = b.new_page(viewport={'width': 1920, 'height': 1080})
    pg.on('console', lambda m: print('console:', m.text))
    pg.goto('file:///home/claude/build/render.html')
    for _ in range(600):
        if pg.evaluate('window.READY || window.ERR'): break
        time.sleep(0.1)
    err = pg.evaluate('window.ERR')
    if err: print(err); sys.exit(1)
    if mode == 'times':
        times = json.loads(sys.argv[3])
        for i, t in enumerate(times):
            pg.evaluate(f'window.renderAt({t})')
            pg.screenshot(path=str(out / f't_{t:06.3f}.png'), clip={'x':0,'y':0,'width':1920,'height':1080})
    else:
        t0, t1, fps = float(sys.argv[3]), float(sys.argv[4]), int(sys.argv[5])
        start = int(round(t0*fps)); end = int(round(t1*fps))
        st = time.time()
        for f in range(start, end):
            pg.evaluate(f'window.renderAt({f/fps})')
            pg.screenshot(path=str(out / f'f_{f:05d}.png'), clip={'x':0,'y':0,'width':1920,'height':1080})
            if f % 60 == 0: print('frame', f, round(time.time()-st,1), flush=True)
    b.close()
