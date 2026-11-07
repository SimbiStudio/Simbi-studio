// Frame-by-frame capture of render.html with Playwright + headless Chromium (SwiftShader).
//   node capture.js <outdir> range <t0> <t1> <fps> [--overlay]
//   node capture.js <outdir> times '[3.4, 6.5]'          [--overlay]
// --overlay: hide the WebGL canvas and save only the 2D glass FX (ripples, glint, fog mark,
//            dizzy stars) as transparent PNGs, to composite over the Blender render.
'use strict';
const path = require('path'), fs = require('fs');
const { chromium } = require('playwright');
const args = process.argv.slice(2);
const overlay = args.includes('--overlay');
const [outDir, mode, ...rest] = args.filter(a => a !== '--overlay');
(async () => {
  fs.mkdirSync(outDir, { recursive: true });
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader',
    '--allow-file-access-from-files', '--ignore-gpu-blocklist'] });
  const pg = await b.newPage({ viewport: { width: 2048, height: 858 } });
  pg.on('console', m => console.log('console:', m.text()));
  await pg.goto('file://' + path.join(__dirname, 'render.html'));
  await pg.waitForFunction('window.READY || window.ERR', null, { timeout: 120000 });
  const err = await pg.evaluate('window.ERR'); if (err) { console.error(err); process.exit(1); }
  if (overlay) await pg.evaluate(() => { document.getElementById('gl').style.display = 'none';
    document.documentElement.style.background = document.body.style.background = 'transparent'; });
  // overlay frames are read straight from the 2D canvas: transparent page screenshots keep stale pixels
  // from previous frames in headless Chromium (rings/stars piled up)
  const shot = async (file) => {
    if (!overlay) return pg.screenshot({ path: path.join(outDir, file), clip: { x: 0, y: 0, width: 2048, height: 858 } });
    const url = await pg.evaluate(() => document.getElementById('ov').toDataURL('image/png'));
    fs.writeFileSync(path.join(outDir, file), Buffer.from(url.split(',')[1], 'base64')); };
  if (mode === 'times') {
    for (const t of JSON.parse(rest[0])) { await pg.evaluate(`window.renderAt(${t})`); await shot(`t_${t.toFixed(3).padStart(6, '0')}.png`); }
  } else {
    const [t0, t1, fps] = rest.map(Number); const st = Date.now();
    for (let f = Math.round(t0 * fps); f < Math.round(t1 * fps); f++) {
      await pg.evaluate(`window.renderAt(${f / fps})`); await shot(`f_${String(f).padStart(5, '0')}.png`);
      if (f % 60 === 0) console.log('frame', f, ((Date.now() - st) / 1000).toFixed(1) + 's');
    }
  }
  await b.close();
})();
