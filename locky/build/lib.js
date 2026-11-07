// Shared Locky character toolkit for the new entrances ("El telón", "El último celular").
// A scene builds a plain pose object every frame and calls LK.assemble(P) to get the state that
// blender/export_anim.js bakes (same structure as anim.js stateAt, plus scene props).
'use strict';
(() => {
const cl = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
const lerp = (a, b, t) => a + (b - a) * t;
const ss = (a, b, t) => { const u = cl((t - a) / (b - a)); return u * u * (3 - 2 * u); };
const sm = (a, b, t) => { const u = cl((t - a) / (b - a)); return u * u * u * (u * (u * 6 - 15) + 10); };
const outBack = (x, s = 1.70158) => { x = cl(x); return 1 + (s + 1) * Math.pow(x - 1, 3) + s * Math.pow(x - 1, 2); };
const wob = (t, f, z) => t < 0 ? 0 : Math.exp(-z * t) * Math.sin(2 * Math.PI * f * t);
const bump = (t, a, b) => Math.sin(Math.PI * cl((t - a) / (b - a)));          // 0 -> 1 -> 0 between a and b
const PI = Math.PI, TAU = PI * 2;
const X = [1, 0, 0], Y = [0, 1, 0], Z = [0, 0, 1];
const qa = Q.axis, qm = (...qs) => qs.reduce((a, b) => Q.mul(a, b));
// smooth keyframe track: [[t, v], ...] (smootherstep between keys)
const kf = (pts, t) => { if (t <= pts[0][0]) return pts[0][1]; const n = pts.length; if (t >= pts[n - 1][0]) return pts[n - 1][1];
  let i = 0; while (pts[i + 1][0] < t) i++; const [t0, v0] = pts[i], [t1, v1] = pts[i + 1]; return lerp(v0, v1, sm(t0, t1, t)); };

// ---------------- legs: planted-foot walk along a heading (2-bone IK) ----------------
const LEG = { hipY: 0.270, hipZ: -0.006, L1: 0.082, L2: 0.141, ank: 0.047, ball: 0.109 };
const HIPS0 = [0.0016, 0.2551, -0.0201];
const DUTY = 0.5, LIFT = 0.06, ROLL = 0.5, SLAP = -0.15;
// walker(path, stepRate): path(t) = distance travelled along the heading (metres, non-decreasing).
// Steps scale down to nothing when the path stops, so he stands still without stepping in place.
const walker = (path, stepRate) => {
  const W = stepRate / 2, dt = 0.02;
  const speed = (t) => Math.abs(path(t + dt) - path(t - dt)) / (2 * dt);
  const footAt = (t, off) => {
    const c = t * W + off, k = Math.floor(c), f = c - k;
    const plant = (kk) => path((kk - off) / W + DUTY / 2 / W) + LEG.hipZ;
    const moving = cl(speed(t) / 0.25);                                 // lift / roll only while travelling
    const roll = ROLL * moving, slap = SLAP * moving;
    const rolled = (pzv, psi) => { const b = pzv + LEG.ball;
      return { y: LEG.ank * Math.cos(psi) + LEG.ball * Math.sin(psi), z: b + LEG.ank * Math.sin(psi) - LEG.ball * Math.cos(psi) }; };
    if (f < DUTY) { const u = f / DUTY, psi = roll * ss(0.72, 1, u) + slap * (1 - ss(0, 0.18, u));
      const a = psi > 0 ? rolled(plant(k), psi) : { y: LEG.ank, z: plant(k) }; return { y: a.y, z: a.z, psi, stance: 1 }; }
    const u = (f - DUTY) / (1 - DUTY), a0 = rolled(plant(k), roll), z1 = plant(k + 1);
    return { y: lerp(a0.y, LEG.ank, ss(0, 1, u)) + LIFT * moving * Math.sin(PI * u), z: lerp(a0.z, z1, sm(0, 1, u)),
             psi: lerp(roll, slap, ss(0, 0.8, u)), stance: 0 }; };
  const FK = [-3, -2, -1, 0, 1, 2, 3].map(i => [i * 0.012, Math.exp(-0.5 * (i * 0.012 / 0.016) ** 2)]);
  const FKW = FK.reduce((a, [, w]) => a + w, 0);
  const footS = (t, off) => { const o = { y: 0, z: 0, psi: 0, stance: 0 };
    for (const [d, w] of FK) { const f = footAt(t + d, off); o.y += f.y * w; o.z += f.z * w; o.psi += f.psi * w; o.stance += f.stance * w; }
    for (const k in o) o[k] /= FKW; return o; };
  return { W, speed, footS, path };
};
const legIK = (H, A) => {
  const { L1, L2 } = LEG, dy = A.y - H.y, dz = A.zl - H.z;
  const D = cl(Math.hypot(dy, dz), Math.abs(L1 - L2) + 1e-4, L1 + L2 - 1e-4);
  const alpha = Math.atan2(-dz, -dy), beta = Math.acos(cl((L1 * L1 + D * D - L2 * L2) / (2 * L1 * D), -1, 1));
  const p1 = alpha - beta, ky = H.y - L1 * Math.cos(p1), kz = H.z - L1 * Math.sin(p1);
  const p2 = Math.atan2(-(A.zl - kz), -(A.y - ky));
  return { x: p1, k: p2 - p1, a: p2 - A.psi, toe: Math.max(0, A.psi) };
};
const rotv = (q, v) => { const [qx, qy, qz, qw] = q, u = [qx, qy, qz]; const c1 = V.cross(u, v).map((e, i) => e + qw * v[i]); const c2 = V.cross(u, c1); return v.map((e, i) => e + 2 * c2[i]); };
// Fill P (legs, hips, arms swing, squash, shackle bob) for a walker at time t. P.hipsX/hipsZ may hold base values.
const walkLegs = (P, wk, t, opt = {}) => {
  const s = wk.path(t), mv = cl(wk.speed(t) / 0.25), cL = t * wk.W;
  const fL = wk.footS(t, 0), fR = wk.footS(t, 0.5); fL.zl = fL.z - s; fR.zl = fR.z - s;
  const sw = (o) => { const c = cL + o, f = c - Math.floor(c); return Math.sin(PI * cl(f / DUTY)); };
  P.hipsZ += 0.04 * (sw(0) - sw(0.5)) * mv;
  const qh = qm(qa(X, P.hipsX), qa(Z, P.hipsZ));
  const oL = rotv(qh, [0.154, 0.015, 0.014]), oR = rotv(qh, [-0.158, 0.015, 0.014]);
  const reach = 0.95 * (LEG.L1 + LEG.L2);
  const maxHips = (f, o) => f.y + Math.sqrt(Math.max(0, reach * reach - (f.zl - (HIPS0[2] + o[2])) ** 2)) - (HIPS0[1] + o[1]);
  const smin = (a, b, k = 0.008) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
  P.hipsY = smin(smin(opt.baseHips ?? -0.016, maxHips(fL, oL)), maxHips(fR, oR)) + (opt.hipsOffset || 0);
  const HL = { y: HIPS0[1] + P.hipsY + oL[1], z: HIPS0[2] + oL[2] }, HR = { y: HIPS0[1] + P.hipsY + oR[1], z: HIPS0[2] + oR[2] };
  Object.assign(P.legL, legIK(HL, fL), { roll: P.hipsZ }); Object.assign(P.legR, legIK(HR, fR), { roll: P.hipsZ });
  if (opt.arms !== false) {
    const a = 0.5 * mv * Math.cos(TAU * cL);
    P.armL.z = -a; P.armR.z = a; P.armL.el = 0.3 + 0.35 * Math.max(0, -a / 0.5); P.armR.el = 0.3 + 0.35 * Math.max(0, a / 0.5);
    P.armL.x = -0.95 + 0.06 * mv * Math.cos(TAU * cL) ** 2; P.armR.x = P.armL.x;
    P.armL.hand = 0.35 * mv * Math.sin(TAU * cL - 0.9 + PI); P.armR.hand = -P.armL.hand;
  }
  const dn = Math.cos(TAU * 2 * wk.W * (t - 0.035)) * mv;
  P.sqScale = [1 + 0.03 * dn, 1 - 0.055 * dn, 1 + 0.03 * dn];
  P.rotY += 0.06 * Math.sin(TAU * cL) * mv;
  P.shPitch += 0.08 * Math.sin(TAU * 2 * wk.W * t - 1.4) * mv; P.shRoll += -0.07 * Math.sin(TAU * cL - 0.6) * mv;
  P.shadow = 0.55;
  return P;
};
// standing legs (no walker): straight-ish, knees soft
const standLegs = (P, bend = 0.12) => { const lg = { x: -bend * 0.5, k: bend, a: bend * 0.5 };
  Object.assign(P.legL, lg); Object.assign(P.legR, lg); P.hipsY += -0.004 - 0.03 * bend; return P; };

// ---------------- expressions ----------------
// table: [[t, {morphs}], ...]  -> crossfaded morph weights (fade seconds per key, default 0.06), + blinks
const expr = (table, t, blinks = []) => {
  let i = 0; while (i < table.length - 1 && table[i + 1][0] <= t) i++;
  const cur = table[i], prev = table[Math.max(0, i - 1)], fade = cur[2] || 0.06;
  const s = i === 0 ? 1 : sm(cur[0], cur[0] + fade, t), w = {};
  for (const n in prev[1]) w[n] = (w[n] || 0) + prev[1][n] * (1 - s);
  for (const n in cur[1]) w[n] = (w[n] || 0) + cur[1][n] * s;
  let b = 0; blinks.forEach(bt => { b = Math.max(b, 1 - cl(Math.abs(t - bt) / 0.075)); });
  const closed = ['Eyes_Joy', 'Eyes_ .> <.', 'Eyes_ T T', 'Eyes_Wink R', 'Eyes_Wink L', 'Eyes_Fun', 'Eyes_Close', 'Eyes_'];
  const open = 1 - cl(closed.reduce((a, k) => a + (w[k] || 0), 0));
  if (b > 0) w['Eyes_Close'] = (w['Eyes_Close'] || 0) + b * open;
  return w;
};

// ---------------- pose -> state ----------------
const newPose = () => ({ x: 0, y: 0, z: 0, rotY: 0, visible: true, hipsX: 0, hipsY: 0, hipsZ: 0,
  legL: { x: 0, k: 0 }, legR: { x: 0, k: 0 },
  armL: { x: -1.12, z: 0, el: 0.15 }, armR: { x: -1.12, z: 0, el: 0.15 },
  sqPivot: null, sqScale: [1, 1, 1], shPitch: 0, shRoll: 0, morph: {}, shadow: 0, props: {},
  cam: { pos: [0, 1, 6], target: [0, 1, 0], fov: 24 }, flash: 0 });
const assemble = (P) => {
  const B = {}, S = {};
  B['Hips'] = qm(qa(X, P.hipsX), qa(Z, P.hipsZ)); S['Hips'] = [0, P.hipsY, 0];
  const L = P.legL, R = P.legR;
  B['UpperLeg_L'] = qm(qa(Z, L.roll || 0), qa(X, L.x - P.hipsX)); B['UpperLeg_R'] = qm(qa(Z, R.roll || 0), qa(X, R.x - P.hipsX));
  B['LowerLeg_L'] = qa(X, L.k); B['LowerLeg_R'] = qa(X, R.k);
  B['Ankle_L'] = qa(X, L.a !== undefined ? L.a : -0.4 * L.k); B['Ankle_R'] = qa(X, R.a !== undefined ? R.a : -0.4 * R.k);
  B['Toes_L'] = qa(X, L.toe || 0); B['Toes_R'] = qa(X, R.toe || 0);
  const aL = P.armL, aR = P.armR;
  B['UpperArm_L'] = qm(qa(X, aL.x), qa(Z, -aL.z)); B['UpperArm_R'] = qm(qa(X, aR.x), qa(Z, aR.z));
  B['LowerArm_L'] = qa(X, aL.el); B['LowerArm_R'] = qa(X, aR.el);
  B['Hand_L'] = qm(qa(X, aL.hx || 0), qa(Z, -(aL.hand || 0))); B['Hand_R'] = qm(qa(X, aR.hx || 0), qa(Z, aR.hand || 0));
  const root = M.trs([P.x, P.y, P.z], qa(Y, P.rotY), P.visible ? [1, 1, 1] : [0, 0, 0]);
  return {
    cam: P.cam, pose: { bones: B, boneT: S, morph: P.morph, shackle: qm(qa(X, P.shPitch), qa(Z, P.shRoll)) },
    root, sq: { pivot: P.sqPivot || [P.x, P.y, P.z], scale: P.sqScale },
    glass: { z: 99, on: false, c: [0, 0] }, shadow: { c: [P.x, 0.002, P.z], r: [0.42, 0.3], a: P.visible ? P.shadow : 0 },
    flash: P.flash, press: 0, glassC: [0, 0], x: P.x, y: P.y, z: P.z, props: P.props,
  };
};
// camera shake helper
const shake = (pos, t, t0, amp = 0.03, decay = 9) => { const u = t - t0; if (u <= 0) return pos;
  const a = amp * Math.exp(-u * decay); return [pos[0] + a * Math.sin(u * 83), pos[1] + a * Math.sin(u * 67 + 1), pos[2]]; };

window.LK = { cl, lerp, ss, sm, outBack, wob, bump, kf, PI, TAU, X, Y, Z, qa, qm, LEG, walker, walkLegs, standLegs, legIK, expr, newPose, assemble, shake };
})();
