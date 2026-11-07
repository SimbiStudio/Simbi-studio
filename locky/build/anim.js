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
const DUTY = 0.5, LIFT = 0.06, ROLL = 0.5, SLAP = -0.15;
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

// ---------- whistle (audio envelope -> mouth) ----------
const whistleAt = (t) => { const W = window.WHISTLE; if (!W) return { amp: 0, pitch: 0, slow: 0 };
  const at = (arr, tt) => { const f = cl(tt * W.fps, 0, arr.length - 1), i = Math.floor(f), u = f - i; return lerp(arr[i], arr[Math.min(arr.length - 1, i + 1)], u); };
  let slow = 0; for (let d = -0.12; d <= 0.121; d += 0.03) slow = Math.max(slow, at(W.amp, t + d));
  return { amp: at(W.amp, t), pitch: at(W.pitch, t), slow }; };

// ---------- expressions ----------
const EX = [
  [0.00, { 'Eyes_Joy': 1 }, { 'Mouth_O': 0.8 }],
  [T.whistleEnd + 0.05, { 'Eyes_Joy': 1 }, { 'Mouth_Joy': 0.7 }],
  [T.impact - 0.12, { 'Eyes_ O O': 1 }, { 'Mouth_O': 0.45 }],      // take: "uh-oh"
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
  const fade = (cur[0] === T.impact || cur[0] === T.impact - 0.12) ? 0.03 : 0.06;
  const s = i === 0 ? 1 : sm(cur[0], cur[0] + fade, t);
  const w = {};
  const add = (o, k) => { for (const n in o) w[n] = (w[n] || 0) + o[n] * k; };
  add(prev[1], 1 - s); add(prev[2], 1 - s); add(cur[1], s); add(cur[2], s);
  // whistling mouth: puckered lips (U) that tighten on louder / higher notes, small side pucker,
  // open a touch (O) on attacks and relax into a smile between phrases
  const wm = 1 - ss(T.whistleEnd - 0.05, T.whistleEnd + 0.1, t);
  if (wm > 0) { const wh = whistleAt(t);
    for (const k in w) if (k.startsWith('Mouth')) w[k] *= 1 - wm;
    const pucker = 0.3 + 0.7 * wh.slow;
    const sh = { 'Mouth_U': pucker * (0.55 + 0.3 * wh.amp + 0.15 * wh.pitch), 'Mouth_O': 0.35 * wh.slow * (1 - wh.amp) + 0.15 * (1 - wh.pitch) * wh.amp,
                 'Mouth_Smirk L': 0.35 * wh.slow, 'Mouth_Joy': 0.55 * (1 - wh.slow) };
    for (const k in sh) w[k] = (w[k] || 0) + sh[k] * wm; }
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
  let shadowA = 0.55, press = 0, shPitch = 0, shRoll = 0;

  const walking = t < T.impact;
  if (walking) {
    const phi = TAU * (T.stepRate / 2) * t;
    z = zAt(t);
    x = lerp(-0.3, 0, sm(0, T.impact, t)) + 0.02 * Math.sin(t * 1.3);
    const lookAround = 0.42 * Math.sin(1.05 * t + 0.4) + 0.12 * Math.sin(2.3 * t);
    rotY = 0 + lookAround * 0.35;   // facing camera, head-in-the-clouds sway
    hipsX = -0.30 + 0.045 * Math.cos(2 * phi);
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
    armL.z = -0.5 * Math.cos(TAU * cL); armR.z = 0.5 * Math.cos(TAU * cL);
    armL.el = 0.3 + 0.35 * Math.max(0, armL.z / 0.5); armR.el = 0.3 + 0.35 * Math.max(0, armR.z / 0.5);   // elbow bends on the forward swing
    armL.x = -0.95 + 0.06 * Math.abs(Math.cos(TAU * cL)); armR.x = armL.x;
    // contact/down = squash, passing/up = stretch (slight lag after the foot lands), volume preserved
    const dn = Math.cos(TAU * T.stepRate * (t - 0.035));
    sqScale = [1 + 0.03 * dn, 1 - 0.055 * dn, 1 + 0.03 * dn];
    // overlap: shoulders twist with the arm swing, hands drag behind the arms
    rotY += 0.06 * Math.sin(TAU * cL);
    armL.hand = 0.35 * Math.sin(TAU * cL - 0.9 + PI); armR.hand = -armL.hand;
    // TAKE: last ~0.12 s he notices the glass: head snaps level, body stiffens/stretches, arms flinch up
    const take = ss(T.impact - 0.15, T.impact - 0.09, t);
    hipsX = lerp(hipsX, -0.04, take);
    sqScale = [sqScale[0] * (1 - 0.04 * take), sqScale[1] * (1 + 0.08 * take), sqScale[2] * (1 - 0.04 * take)];
    armL.x += 0.45 * take; armR.x = armL.x; armL.el += 0.5 * take; armR.el += 0.5 * take;
    shPitch = 0.08 * Math.sin(TAU * T.stepRate * t - 1.4);     // shackle bobs a beat behind the body
    shRoll = -0.07 * Math.sin(TAU * cL - 0.6) * (1 - take);
    // whistling: head goes up a bit on the loud notes and tilts with the melody
    const wh = whistleAt(t);
    hipsX += -0.06 * wh.amp * (1 - take); hipsZ += 0.05 * (wh.pitch - 0.5) * wh.amp;

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
    // hit hard, bounce off the glass a few cm, get sucked back on and stick (with a little jelly settle)
    const PRESS = [[0, 0], [0.035, 0.21], [0.075, 0.21], [0.135, 0.05], [0.20, -0.04], [0.30, 0.15], [0.40, 0.10], [0.52, 0.125], [0.66, 0.115]];
    const kf = (pts, tt) => { if (tt >= pts[pts.length - 1][0]) return pts[pts.length - 1][1]; let i = 0; while (pts[i + 1][0] < tt) i++;
      const [t0, v0] = pts[i], [t1, v1] = pts[i + 1]; return lerp(v0, v1, sm(t0, t1, tt)); };
    press = kf(PRESS, ti) + 0.008 * wob(ti - 0.62, 5, 6);
    z = CONTACT + press;
    glassOn = true;
    const faceY = 0.73 + y;
    glassC = [x, faceY];
    const jig = wob(ti, 4.2, 6.5);
    // squash follows how hard he is pressed (flattened on the hit, slightly stretched while bouncing off)
    const q = cl(press / 0.21, -0.25, 1), settle = 0.55 * ss(0.2, 0.6, ti);
    const w = Math.max(q, settle) + 0.2 * jig * ss(0.2, 0.4, ti);
    sqPivot = [x, faceY, T.glassZ];
    sqScale = [1 + 0.24 * w, 1 + 0.12 * w, 1 - 0.36 * w];
    const brs = 0.012 * Math.sin(ti * TAU * 1.2) * ss(0.55, 0.75, ti);            // breathing: moving hold
    sqScale[1] += brs; sqScale[0] -= brs * 0.5;
    // shackle whips onto the glass and wobbles; jitters on every stick-slip of the slide
    shPitch = 0.45 * wob(ti, 4.5, 4.5) + 0.06 * Math.sin(TAU * T.slideStutters * cl((t - T.slideStart) / (T.slideEnd - T.slideStart))) * ss(T.slideStart, T.slideStart + 0.1, t);
    shRoll = 0.12 * wob(ti - 0.02, 3.3, 4);
    hipsX = 0.08; hipsZ = 0.04 * jig;
    // starfish splat: arms and legs fly forward and flatten on the glass, then twitch
    const fling = outBack(cl(ti / 0.09), 2.4);
    armL.x = lerp(-0.95, 0.5, fling) + 0.12 * jig; armR.x = armL.x;
    armL.z = lerp(0, 1.15, fling); armR.z = armL.z;
    armL.el = lerp(0.4, 0.05, fling) + 0.15 * jig; armR.el = armL.el;
    armL.x += 0.5 * ss(T.slideStart, T.slideEnd, t); armR.x = armL.x;
    const kick = Math.exp(-ti * 3) * 0.18;
    legL.x = -0.75 * fling + kick * Math.sin(ti * 11); legR.x = -0.65 * fling - kick * Math.sin(ti * 11 + 1.3);
    legL.k = 0.35 * fling + 0.25 * Math.max(0, Math.sin(ti * 11)) * kick / 0.18; legR.k = 0.35 * fling;
    shadowA = 0;
    if (t > T.slideEnd + 0.05) visible = false;

    if (t >= T.peekStart) {
      visible = true; glassOn = false; press = 0;
      const tp = t - T.peekStart;
      z = T.glassZ - 0.62; x = 0.0;
      const rise1 = outBack(cl(tp / 0.42), 1.5);
      const rise2 = outBack(cl((t - T.waveStart) / 0.38), 1.6);
      // anticipation dip before the wave pop-up
      const dip = Math.sin(PI * cl((t - (T.waveStart - 0.14)) / 0.14));
      y = lerp(-1.25, -0.30, rise1) + lerp(0, 0.18, rise2) - 0.035 * dip;
      hipsZ = lerp(0, 0.16, ss(0, 0.35, tp)) * (1 - ss(T.embarrassed - 0.05, T.embarrassed + 0.2, t))
        + lerp(0, -0.10, ss(T.embarrassed - 0.05, T.embarrassed + 0.2, t)) * (1 - ss(T.waveStart, T.waveStart + 0.3, t))
        + 0.06 * Math.sin((t - T.waveStart) * TAU * 1.6) * ss(T.waveStart, T.waveStart + 0.3, t) * (1 - ss(T.waveDown - 0.1, T.waveDown + 0.1, t));
      const emb = ss(T.embarrassed - 0.03, T.embarrassed + 0.12, t) * (1 - ss(T.waveStart - 0.1, T.waveStart + 0.15, t));
      const shy = wob(t - T.embarrassed, 3.5, 6) * 0.04 * (t > T.embarrassed ? 1 : 0);
      sqPivot = [x, y, z];
      sqScale = [1 + 0.035 * emb + shy + 0.04 * dip, 1 - 0.05 * emb - shy - 0.07 * dip, 1 + 0.035 * emb + 0.04 * dip];
      armL.x = -1.12 + 0.35 * emb; armR.x = armL.x; armL.el = 0.4 + 0.8 * emb; armR.el = armL.el;
      armL.z = 0.3 * emb; armR.z = 0.3 * emb;
      const wv = ss(T.waveStart, T.waveStart + 0.22, t) * (1 - ss(T.waveDown - 0.15, T.waveDown + 0.15, t));
      const wv2 = ss(T.wink - 0.1, T.wink + 0.15, t);
      const wave = Math.max(wv, wv2 * 0.8);
      armR.x = lerp(armR.x, 0.75, wave);
      armR.z = lerp(armR.z, 0.15, wave);
      armR.el = lerp(armR.el, 0.35 + 0.42 * Math.sin((t - T.waveStart) * TAU * 2.6), wave);
      armR.hx = 0.45 * Math.sin((t - T.waveStart) * TAU * 2.6 - 1.1) * wave;          // hand flops after the forearm
      // closing beat (no logo any more): little hop + head tilt into the wink
      const wk = t - T.wink;
      // anticipation crouch -> hop (stretched in the air) -> squash on landing -> settle
      const crouch = Math.sin(PI * cl((t - (T.wink - 0.16)) / 0.16));
      y -= 0.03 * crouch; sqScale = [sqScale[0] * (1 + 0.05 * crouch), sqScale[1] * (1 - 0.08 * crouch), sqScale[2] * (1 + 0.05 * crouch)];
      if (wk > 0) {
        const air = Math.max(0, Math.sin(PI * cl(wk / 0.28)));
        const land = wob(wk - 0.28, 3.4, 6) * (wk > 0.28 ? 1 : 0);
        y += 0.07 * air;
        sqScale = [sqScale[0] * (1 - 0.04 * air + 0.06 * land), sqScale[1] * (1 + 0.07 * air - 0.09 * land), sqScale[2] * (1 - 0.04 * air + 0.06 * land)];
      }
      hipsZ += -0.09 * ss(T.wink - 0.1, T.wink + 0.25, t);
      hipsX = 0.05 * ss(T.wink - 0.1, T.wink + 0.25, t);
      legL.x = 0; legR.x = 0; legL.k = 0; legR.k = 0;
      // shackle follow-through: lags the pop-ups and the hop, shivers when shy
      shPitch = -0.22 * wob(t - T.peekStart - 0.25, 3, 4.5) * (t > T.peekStart + 0.25 ? 1 : 0)
        - 0.12 * wob(t - T.waveStart - 0.12, 3.4, 5) * (t > T.waveStart + 0.12 ? 1 : 0)
        + 0.2 * wob(wk - 0.3, 3.6, 5) * (wk > 0.3 ? 1 : 0) - 0.1 * Math.sin(PI * cl(wk / 0.28));
      shRoll = 2.5 * shy + 0.05 * Math.sin((t - T.waveStart) * TAU * 1.6 - 0.8) * wave;
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
  // hands: drag (forward/back, mirrored like the arms) + flop (same axis as the elbow)
  B['Hand_L'] = qm(qa(X, armL.hx || 0), qa(Z, -(armL.hand || 0))); B['Hand_R'] = qm(qa(X, armR.hx || 0), qa(Z, armR.hand || 0));

  const root = M.trs([x, y, z], qa(Y, rotY), visible ? [1, 1, 1] : [0, 0, 0]);

  let camPos = [0, 1.0, 4.65 - 0.12 * ss(0, T.impact, t)];
  const target = [0, 0.72, 0];
  const ti = t - T.impact;
  if (ti > 0) { const sh = Math.exp(-ti * 10) * 0.06; camPos = [camPos[0] + sh * Math.sin(ti * 83), camPos[1] + sh * Math.sin(ti * 67 + 1), camPos[2]];
    camPos[2] -= 0.16 * ss(0, 0.035, ti) * (1 - ss(0.06, 0.45, ti)); }   // punch-in on the hit
  const endEase = ss(T.peekStart - 0.2, T.peekStart + 1.0, t);
  camPos[2] += 0.12 * endEase;

  return {
    bg: BG, cam: { pos: camPos, target, fov: 32 },
    pose: { bones: B, boneT: S, morph: exprAt(t), shackle: qm(qa(X, shPitch), qa(Z, shRoll)) }, root, sq: { pivot: sqPivot, scale: sqScale },
    glass: { z: T.glassZ, on: glassOn, c: glassC },
    shadow: { c: [x, 0.002, z], r: [0.42, 0.3], a: visible && walking ? shadowA : 0 },
    flash: t > T.impact ? 0.5 * Math.exp(-(t - T.impact) * 22) : 0,
    press, glassC, x, y, z,
  };
};

// ---------- 2D overlay: glass FX ----------
const rnd = (i) => { const s = Math.sin(i * 127.1 + 311.7) * 43758.5453; return s - Math.floor(s); };
window.drawOverlay = (t, st, eng, cv) => {
  cv.width = cv.width;            // full reset: clearRect left the previous frames' FX behind
  const c = cv.getContext('2d'); const W = cv.width, H = cv.height;
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
  // sweat drop when he gets embarrassed (secondary action): pops in, slides down the side of his head, fades
  const sd = t - (T.embarrassed + 0.06);
  if (sd > 0 && t < T.waveStart + 0.1) {
    const head = eng.project([st.x + 0.36, st.y + 1.0 - 0.06 * ss(0.15, 0.5, sd), st.z + 0.25]);
    const sc = outBack(cl(sd / 0.14), 2.5) * (1 - ss(T.waveStart - 0.15, T.waveStart + 0.1, t)), r = 40 * sc;
    if (r > 0.5) { c.save(); c.translate(head[0], head[1]);
      c.fillStyle = '#bfe6ff'; c.strokeStyle = '#3a6fd1'; c.lineWidth = 4 * sc;
      c.beginPath(); c.moveTo(0, -r * 1.9); c.bezierCurveTo(r * 0.95, -r * 0.5, r, r * 0.9, 0, r); c.bezierCurveTo(-r, r * 0.9, -r * 0.95, -r * 0.5, 0, -r * 1.9);
      c.closePath(); c.fill(); c.stroke();
      c.fillStyle = 'rgba(255,255,255,0.9)'; c.beginPath(); c.ellipse(-r * 0.32, r * 0.05, r * 0.18, r * 0.32, -0.3, 0, TAU); c.fill();
      c.restore(); }
  }
};
