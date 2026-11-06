'use strict';
// ---------- helpers ----------
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, t) => { const u = cl((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const sm = (a, b, t) => { const u = cl((t - a) / (b - a)); return u * u * u * (u * (u * 6 - 15) + 10); };
const outBack = (x, s = 1.70158) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const outCubic = (x) => 1 - Math.pow(1 - cl(x), 3);
const wob = (t, f, z) => t < 0 ? 0 : Math.exp(-z * t) * Math.sin(2 * Math.PI * f * t); // decaying wobble
const PI = Math.PI, TAU = PI * 2;
const BG = [0x4E / 255, 0x58 / 255, 0xDA / 255];   // ~#4B55D6, a touch lighter
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const qa = Q.axis;
const qm = (...qs) => qs.reduce((a, b) => Q.mul(a, b));

const T = window.TL;
const CONTACT = T.glassZ - 0.235;          // hips z at the moment the face touches the glass
// forward walk z0 -> glass: steady stroll, a hair faster in the last steps (he never sees it coming)
const zAt = (t) => { const u = cl(t / T.impact); return lerp(T.z0, CONTACT, 0.9 * u + 0.1 * u * u); };
const V0 = 0.9 * (CONTACT - T.z0) / T.impact;                    // walking speed at t=0
const pz = (t) => t >= 0 ? zAt(t) : T.z0 + V0 * t;                // path, extrapolated before t=0

// ---------- walk cycle with planted feet (2-bone IK) ----------
// Leg geometry from the GLB (glTF space, y up, +z forward): hip joint, thigh, shin, ankle height, ankle->ball.
const LEG = { hipY: 0.270, hipZ: -0.006, L1: 0.082, L2: 0.141, ank: 0.047, ball: 0.109 };
const DUTY = 0.56, LIFT = 0.05, ROLL = 0.5, SLAP = -0.15;
// ankle target for one foot (absolute path z), foot pitch psi (+ = toes down) and stance flag
const footAt = (t, off) => {
  const W = T.stepRate / 2, c = t * W + off, k = Math.floor(c), f = c - k;
  const plant = (kk) => pz((kk - off) / W + DUTY / 2 / W) + LEG.hipZ;   // foot lands under the hip at mid-stance
  const rolled = (pzv, psi) => { const b = pzv + LEG.ball;                // heel lifts, foot pivots on the ball
    return { y: LEG.ank * Math.cos(psi) + LEG.ball * Math.sin(psi), z: b + LEG.ank * Math.sin(psi) - LEG.ball * Math.cos(psi) }; };
  if (f < DUTY) {
    const u = f / DUTY, psi = ROLL * ss(0.72, 1, u) + SLAP * (1 - ss(0, 0.18, u));
    const a = psi > 0 ? rolled(plant(k), psi) : { y: LEG.ank, z: plant(k) };
    return { y: a.y, z: a.z, psi, stance: 1 };
  }
  const u = (f - DUTY) / (1 - DUTY), a0 = rolled(plant(k), ROLL), z1 = plant(k + 1);
  return { y: lerp(a0.y, LEG.ank, ss(0, 1, u)) + LIFT * Math.sin(PI * u), z: lerp(a0.z, z1, sm(0, 1, u)),
           psi: lerp(ROLL, SLAP, ss(0, 0.8, u)), stance: 0 };
};
// analytic 2-bone IK in the sagittal plane -> world thigh pitch, knee flex, ankle, toes (bone deltas)
const legIK = (H, A) => {
  const { L1, L2 } = LEG, dy = A.y - H.y, dz = A.zl - H.z;
  const D = cl(Math.hypot(dy, dz), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const alpha = Math.atan2(-dz, -dy), beta = Math.acos(cl((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
  const p1 = alpha - beta;                                                // knee forward
  const ky = H.y - L1 * Math.cos(p1), kz = H.z - L1 * Math.sin(p1);
  const p2 = Math.atan2(-(A.zl - kz), -(A.y - ky));
  return { x: p1, k: p2 - p1, a: p2 - A.psi, toe: Math.max(0, A.psi) * (A.stance ? 1 : 0.4) };
};

// ---------- expressions ----------
const EX = [
  [0.00, { 'Eyes_Joy': 1 }, { 'Mouth_O': 0.8 }],
  [1.35, { 'Eyes_Joy': 1 }, { 'Mouth_U': 0.9 }],
  [2.05, { 'Eyes_Joy': 1 }, { 'Mouth_O': 1.0 }],
  [2.70, { 'Eyes_Joy': 1 }, { 'Mouth_U': 0.8 }],
  [3.35, { 'Eyes_Joy': 1 }, { 'Mouth_O': 0.9 }],
  [T.whistleEnd + 0.05, { 'Eyes_Joy': 1 }, { 'Mouth_Joy': 0.7 }],
  [T.impact, { 'Eyes_ .> <.': 1 }, { 'Mouth_O': 1.0 }],
  [T.slideStart + 0.15, { 'Eyes_ T T': 1 }, { 'Mouth_Sad': 1 }],
  [T.peekStart, { 'Eyes_ O O': 0.0 }, { 'Mouth_I': 0.6 }],
  [T.embarrassed, { 'Eyes_ .> <.': 1 }, { 'Mouth_Smirk L': 1 }],
  [T.waveStart + 0.05, { 'Eyes_Joy': 1 }, { 'Mouth_Joy': 1 }],
  [T.wink, { 'Eyes_Wink R': 1 }, { 'Mouth_Joy': 1 }],
];
const exprAt = (t) => {
  let i = 0; while (i < EX.length - 1 && EX[i + 1][0] <= t) i++;
  const cur = EX[i], prev = EX[Math.max(0, i - 1)];
  const fade = (cur[0] === T.impact) ? 0.035 : 0.09;
  const s = i === 0 ? 1 : sm(cur[0], cur[0] + fade, t);
  const w = {};
  const add = (o, k) => { for (const n in o) w[n] = (w[n] || 0) + o[n] * k; };
  add(prev[1], 1 - s); add(prev[2], 1 - s); add(cur[1], s); add(cur[2], s);
  const blinks = [T.peekStart + 0.13, T.peekStart + 0.41];
  let b = 0; blinks.forEach(bt => { b = Math.max(b, 1 - cl(Math.abs(t - bt) / 0.075)); });
  const open = 1 - cl((w['Eyes_Joy'] || 0) + (w['Eyes_ .> <.'] || 0) + (w['Eyes_ T T'] || 0) + (w['Eyes_Wink R'] || 0) + (w['Eyes_Fun'] || 0));
  if (b > 0) w['Eyes_Close'] = (w['Eyes_Close'] || 0) + b * open;
  return w;
};

// ---------- main pose ----------
window.stateAt = (t, eng) => {
  const B = {}; const S = {};
  let x = 0, y = 0, z = T.z0, rotY = 0, visible = true;
  let hipsX = 0, hipsZ = 0, hipsY = 0;
  let sqPivot = [0, 0, 0], sqScale = [1, 1, 1];
  let glassOn = false, glassC = [0, 0.72];
  const armL = { x: -1.12, z: 0, el: 0.15 }, armR = { x: -1.12, z: 0, el: 0.15 };
  const legL = { x: 0, k: 0 }, legR = { x: 0, k: 0 };
  let shadowA = 0.55, press = 0;

  const walking = t < T.impact;
  if (walking) {
    const phi = TAU * (T.stepRate / 2) * t;
    z = zAt(t);
    x = lerp(-0.3, 0, sm(0, T.impact, t)) + 0.02 * Math.sin(t * 1.3);
    const lookAround = 0.42 * Math.sin(1.05 * t + 0.4) + 0.12 * Math.sin(2.3 * t);
    rotY = 0 + lookAround * 0.35;   // facing camera, head-in-the-clouds sway
    hipsX = -0.30 + 0.03 * Math.cos(2 * phi);
    // feet: absolute path z -> root-local
    const fL = footAt(t, 0), fR = footAt(t, 0.5);
    fL.zl = fL.z - z; fR.zl = fR.z - z;
    // weight shifts over the planted foot (smoothed stance difference)
    const sw = (o) => { const c = t * T.stepRate / 2 + o, f = c - Math.floor(c); return Math.sin(PI * cl(f / DUTY)); };
    hipsZ = 0.04 * (sw(0) - sw(0.5)) * ss(0, 0.1, t);
    // exact hip joints: Hips rotation applied to the UpperLeg offsets
    const qh = qm(qa(X, hipsX), qa(Z, hipsZ));
    const rotv = (q, v) => { const [qx, qy, qz, qw] = q, u = [qx, qy, qz]; const c1 = V.cross(u, v).map((e, i) => e + qw * v[i]); const c2 = V.cross(u, c1); return v.map((e, i) => e + 2 * c2[i]); };
    const oL = rotv(qh, [0.154, 0.015, 0.014]), oR = rotv(qh, [-0.158, 0.015, 0.014]);
    const HIPS0 = [0.0016, 0.2551, -0.0201];
    // hips height = as high as the planted legs allow (smooth-min), hips settle slightly at rest
    const reach = 0.975 * (LEG.L1 + LEG.L2);
    const maxHips = (f, o) => f.y + Math.sqrt(Math.max(0, reach * reach - (f.zl - (HIPS0[2] + o[2])) ** 2)) - (HIPS0[1] + o[1]);
    const smin = (a, b, k = 0.006) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
    hipsY = smin(smin(-0.008, maxHips(fL, oL)), maxHips(fR, oR));
    const HL = { y: HIPS0[1] + hipsY + oL[1], z: HIPS0[2] + oL[2] }, HR = { y: HIPS0[1] + hipsY + oR[1], z: HIPS0[2] + oR[2] };
    Object.assign(legL, legIK(HL, fL), { roll: hipsZ }); Object.assign(legR, legIK(HR, fR), { roll: hipsZ });
    // arms swing against the legs (left arm back when the left foot lands)
    const cL = t * T.stepRate / 2;
    armL.z = -0.34 * Math.cos(TAU * cL); armR.z = 0.34 * Math.cos(TAU * cL); armL.el = 0.35; armR.el = 0.35;
    armL.x = -1.0; armR.x = -1.0;
    const bounce = Math.cos(2 * phi);
    sqScale = [1 - 0.015 * bounce, 1 + 0.022 * bounce, 1 - 0.015 * bounce];

    sqPivot = [x, 0, z];
  } else {
    const ti = t - T.impact;
    x = 0.0; rotY = 0;
    const slideU = cl((t - T.slideStart) / (T.slideEnd - T.slideStart));
    const n = T.slideStutters;
    const g = slideU - Math.sin(TAU * n * slideU) / (TAU * n) * 0.85;
    const drop = 1.75 * Math.pow(g, 1.55);
    const sag = 0.035 * ss(T.impact + 0.15, T.slideStart, t);
    y = -sag - drop;
    press = 0.145 * (1 - Math.exp(-ti / 0.016)) + 0.035 * wob(ti, 5.5, 8);
    press = lerp(press, 0.115, ss(0.25, 0.6, ti));
    z = CONTACT + press;
    glassOn = true;
    const faceY = 0.73 + y;
    glassC = [x, faceY];
    const jig = wob(ti, 4.2, 6.5);
    const w = 0.65 + 0.35 * Math.exp(-ti * 6) + 0.25 * jig;
    sqPivot = [x, faceY, T.glassZ];
    sqScale = [1 + 0.08 * w, 1 + 0.05 * w, 1 - 0.22 * w];
    hipsX = 0.04; hipsZ = 0.04 * jig;
    const fling = outBack(cl(ti / 0.12), 2.2);
    armL.x = lerp(-0.6, 0.45, fling) + 0.12 * jig; armR.x = armL.x;
    armL.z = lerp(0, 0.42, fling); armR.z = lerp(0, 0.42, fling);
    armL.el = 0.2 + 0.2 * jig; armR.el = armL.el;
    armL.x += 0.6 * ss(T.slideStart, T.slideEnd, t); armR.x = armL.x;
    legL.x = -0.55 * fling + 0.15 * Math.sin(ti * 9); legR.x = -0.45 * fling - 0.15 * Math.sin(ti * 9 + 1);
    legL.k = 0.9 * fling; legR.k = 0.8 * fling;
    shadowA = 0;
    if (t > T.slideEnd + 0.05) visible = false;

    if (t >= T.peekStart) {
      visible = true; glassOn = false; press = 0;
      const tp = t - T.peekStart;
      z = T.glassZ - 0.62; x = 0.0;
      const rise1 = outBack(cl(tp / 0.42), 1.5);
      const rise2 = outBack(cl((t - T.waveStart) / 0.38), 1.6);
      y = lerp(-1.25, -0.30, rise1) + lerp(0, 0.18, rise2);
      hipsZ = lerp(0, 0.16, ss(0, 0.35, tp)) * (1 - ss(T.embarrassed - 0.05, T.embarrassed + 0.2, t))
        + lerp(0, -0.10, ss(T.embarrassed - 0.05, T.embarrassed + 0.2, t)) * (1 - ss(T.waveStart, T.waveStart + 0.3, t))
        + 0.06 * Math.sin((t - T.waveStart) * TAU * 1.6) * ss(T.waveStart, T.waveStart + 0.3, t) * (1 - ss(T.waveDown - 0.1, T.waveDown + 0.1, t));
      const emb = ss(T.embarrassed - 0.03, T.embarrassed + 0.12, t) * (1 - ss(T.waveStart - 0.1, T.waveStart + 0.15, t));
      const shy = wob(t - T.embarrassed, 3.5, 6) * 0.04 * (t > T.embarrassed ? 1 : 0);
      sqPivot = [x, y, z];
      sqScale = [1 + 0.035 * emb + shy, 1 - 0.05 * emb - shy, 1 + 0.035 * emb];
      armL.x = -1.12 + 0.35 * emb; armR.x = armL.x; armL.el = 0.4 + 0.8 * emb; armR.el = armL.el;
      armL.z = 0.3 * emb; armR.z = 0.3 * emb;
      const wv = ss(T.waveStart, T.waveStart + 0.22, t) * (1 - ss(T.waveDown - 0.15, T.waveDown + 0.15, t));
      const wv2 = ss(T.wink - 0.1, T.wink + 0.15, t);
      const wave = Math.max(wv, wv2 * 0.8);
      armR.x = lerp(armR.x, 0.75, wave);
      armR.z = lerp(armR.z, 0.15, wave);
      armR.el = lerp(armR.el, 0.35 + 0.42 * Math.sin((t - T.waveStart) * TAU * 2.6), wave);
      // closing beat (no logo any more): little hop + head tilt into the wink
      const wk = t - T.wink;
      if (wk > 0) {
        const fl = wob(wk, 3.2, 7);
        y += 0.06 * Math.max(0, Math.sin(PI * cl(wk / 0.28)));
        sqScale = [sqScale[0] * (1 - 0.05 * fl), sqScale[1] * (1 + 0.08 * fl), sqScale[2] * (1 - 0.05 * fl)];
      }
      hipsZ += -0.09 * ss(T.wink - 0.1, T.wink + 0.25, t);
      hipsX = 0.05 * ss(T.wink - 0.1, T.wink + 0.25, t);
      legL.x = 0; legR.x = 0; legL.k = 0; legR.k = 0;
      const br = Math.sin(t * TAU * 0.9) * 0.012;
      sqScale = [sqScale[0] - br * 0.5, sqScale[1] + br, sqScale[2] - br * 0.5];
    }
  }

  B['Hips'] = qm(qa(X, hipsX), qa(Z, hipsZ));
  S['Hips'] = [0, hipsY, 0];
  B['UpperLeg_L'] = qm(qa(Z, legL.roll || 0), qa(X, legL.x - hipsX)); B['UpperLeg_R'] = qm(qa(Z, legR.roll || 0), qa(X, legR.x - hipsX));
  B['LowerLeg_L'] = qa(X, legL.k); B['LowerLeg_R'] = qa(X, legR.k);
  B['Ankle_L'] = qa(X, legL.a !== undefined ? legL.a : -0.4 * legL.k); B['Ankle_R'] = qa(X, legR.a !== undefined ? legR.a : -0.4 * legR.k);
  if (legL.toe !== undefined) { B['Toes_L'] = qa(X, legL.toe); B['Toes_R'] = qa(X, legR.toe); }
  // arm.z > 0 = forward (L bone: Z- forward, R bone: Z+ forward)
  B['UpperArm_L'] = qm(qa(X, armL.x), qa(Z, -armL.z));
  B['UpperArm_R'] = qm(qa(X, armR.x), qa(Z, armR.z));
  B['LowerArm_L'] = qa(X, armL.el); B['LowerArm_R'] = qa(X, armR.el);

  const root = M.trs([x, y, z], qa(Y, rotY), visible ? [1, 1, 1] : [0, 0, 0]);

  let camPos = [0, 1.0, 4.65 - 0.12 * ss(0, T.impact, t)];
  const target = [0, 0.72, 0];
  const ti = t - T.impact;
  if (ti > 0) { const sh = Math.exp(-ti * 9) * 0.035; camPos = [camPos[0] + sh * Math.sin(ti * 83), camPos[1] + sh * Math.sin(ti * 67 + 1), camPos[2]]; }
  const endEase = ss(T.peekStart - 0.2, T.peekStart + 1.0, t);
  camPos[2] += 0.12 * endEase;

  return {
    bg: BG, cam: { pos: camPos, target, fov: 32 },
    pose: { bones: B, boneT: S, morph: exprAt(t) }, root, sq: { pivot: sqPivot, scale: sqScale },
    glass: { z: T.glassZ, on: glassOn, c: glassC },
    shadow: { c: [x, 0.002, z], r: [0.42, 0.3], a: visible && walking ? shadowA : 0 },
    flash: t > T.impact ? 0.5 * Math.exp(-(t - T.impact) * 22) : 0,
    press, glassC, x, y, z,
  };
};

// ---------- 2D overlay: glass FX ----------
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
window.drawOverlay = (t, st, eng, cv) => {
  const c = cv.getContext('2d'); const W = cv.width, H = cv.height;
  c.clearRect(0, 0, W, H);
  const ti = t - T.impact;
  if (ti > 0) {
    const p0 = eng.project([0, 0.73, T.glassZ]);
    const fade = 1 - ss(T.slideEnd + 0.4, T.waveStart + 0.6, t);
    const grow = ss(0, 0.06, ti);
    const curY = eng.project([0, Math.max(st.glassC[1], -0.4), T.glassZ])[1];
    if (fade > 0) {
      c.save(); c.filter = 'blur(18px)'; c.globalAlpha = (0.05 + 0.10 * ss(T.slideStart, T.slideEnd, t)) * fade * grow; c.fillStyle = '#e8ecff';
      const hw = 430, hh = 300;
      c.beginPath(); c.roundRect(p0[0] - hw, p0[1] - hh * 0.9, hw * 2, hh * 1.75 + Math.max(0, curY - p0[1]), 140); c.fill(); c.restore();
      if (t > T.slideStart) {
        c.save(); c.filter = 'blur(6px)'; c.globalAlpha = 0.09 * fade; c.strokeStyle = '#ffffff'; c.lineCap = 'round';
        for (let i = 0; i < 7; i++) { const xx = p0[0] - 330 + i * 110 + (rnd(i) - 0.5) * 40; c.lineWidth = 10 + rnd(i + 9) * 18;
          c.beginPath(); c.moveTo(xx, p0[1] + 120); c.lineTo(xx + (rnd(i + 3) - 0.5) * 20, Math.max(p0[1] + 120, curY + 160)); c.stroke(); }
        c.restore();
      }
    }
    for (let k = 0; k < 2; k++) { const tk = ti - k * 0.07; if (tk <= 0 || tk > 0.6) continue;
      const r = 120 + outCubic(tk / 0.6) * 900; c.save(); c.globalAlpha = 0.55 * (1 - tk / 0.6) * (k ? 0.5 : 1);
      c.strokeStyle = '#ffffff'; c.lineWidth = 10 * (1 - tk / 0.6) + 1; c.beginPath(); c.ellipse(p0[0], p0[1], r, r * 0.82, 0, 0, TAU); c.stroke(); c.restore(); }
    const gt = ti / 0.55; if (gt > 0 && gt < 1) {
      c.save(); const gx = lerp(-600, W + 600, outCubic(gt)); c.globalAlpha = 0.20 * Math.sin(PI * gt);
      c.translate(gx, H / 2); c.rotate(-0.42);
      const gr = c.createLinearGradient(-160, 0, 160, 0); gr.addColorStop(0, 'rgba(255,255,255,0)'); gr.addColorStop(0.5, 'rgba(255,255,255,1)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      c.fillStyle = gr; c.fillRect(-160, -1400, 320, 2800); c.fillRect(220, -1400, 60, 2800); c.restore(); }
    const sa = ss(0.08, 0.2, ti) * (1 - ss(T.slideEnd - 0.35, T.slideEnd - 0.1, t));
    if (sa > 0) { const top = eng.project([0, 0.73 + st.y + 0.46, T.glassZ]);
      for (let i = 0; i < 4; i++) { const a = ti * 5.2 + i * TAU / 4; const sx = top[0] + Math.cos(a) * 300, sy = top[1] + Math.sin(a) * 55;
        const sz = (26 + 10 * Math.sin(a)) * sa;
        c.save(); c.globalAlpha = Math.sin(a) > 0 ? 1 : 0.75; c.translate(sx, sy); c.rotate(a * 0.8); c.fillStyle = '#ffd84a';
        c.beginPath(); for (let k = 0; k < 10; k++) { const rr = k % 2 ? sz * 0.42 : sz; const aa = k * PI / 5 - PI / 2; c.lineTo(Math.cos(aa) * rr, Math.sin(aa) * rr); }
        c.closePath(); c.fill(); c.restore(); } }
  }
};
