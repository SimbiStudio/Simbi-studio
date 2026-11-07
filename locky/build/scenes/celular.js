// "El último celular" — a giant phone falls buzzing; Locky climbs it and sits on the front camera
// (like the loomlock card), the phone goes dark and silent, he waves.  ~10 s, scope 2.39:1.
'use strict';
(() => {
const { cl, lerp, ss, sm, outBack, wob, bump, kf, PI, TAU, walker, walkLegs, standLegs, expr, newPose, assemble, shake } = window.LK;

const T = { dur: 10.0, land: 1.0, fright: 1.05, frightEnd: 1.5, walk2: 1.5, walk2End: 2.3, lookUp: 2.35, lookDown: 2.7,
  scratch: 2.6, scratchEnd: 3.05, idea: 3.15, walk3: 3.35, climb: 3.6, climbEnd: 5.0, mantleEnd: 5.35, sit: 5.45, click: 5.6,
  off: 6.6, peek: 6.95, pullBack: 7.5, sigh: 7.7, wave: 8.6, fade: 9.3 };
const PHONE = { x: 0.3, z: -0.2, h: 2.6, w: 1.25, d: 0.12 };
const EDGE_X = PHONE.x - PHONE.w / 2;                       // left side of the phone (-0.325)
const X0 = -2.6, CLIMB_X = EDGE_X - 0.29, SIT_Y = PHONE.h - 0.32, SIT_Z = PHONE.z + 0.05;   // sits a bit low/forward: covers the front camera
// walking distance along +x (stops while frightened, looking, scratching)
const path = (t) => {
  const v1 = 0.75, w1 = v1 * T.fright;                       // walk 1: constant speed until the fright
  if (t < T.fright) return v1 * t;
  const w2 = (-0.96 - X0) - w1, w3 = (CLIMB_X - X0) - w1 - w2;
  return w1 + w2 * sm(T.walk2, T.walk2End, t) + w3 * sm(T.walk3, T.climb, t); };
const wk = walker(path, 6.5);

const WIDE = { pos: [0.0, 1.3, 7.6], target: [0.0, 1.3, 0], fov: 24 };
const MED = { pos: [-0.75, 1.0, 4.0], target: [-0.45, 1.0, 0], fov: 27 };
const TOP = { pos: [0.3, 2.62, 3.7], target: [0.3, 2.5, -0.2], fov: 26 };
const END = { pos: [0.3, 1.85, 6.6], target: [0.3, 1.75, 0], fov: 24 };
const climbY = (t) => {                                      // pulls up in bursts, small slips from the vibration
  const u = cl((t - T.climb) / (T.climbEnd - T.climb)), n = 6;
  const stair = u - Math.sin(TAU * n * u) / (TAU * n) * 0.8;
  const slip = 0.05 * (bump(u, 0.38, 0.46) + bump(u, 0.72, 0.8));
  return (SIT_Y - 0.25) * stair - slip; };

const EXPR = [
  [0.0, { 'Mouth_Joy': 0.4 }],
  [T.fright, { 'Eyes_ O O': 1, 'Mouth_O': 1 }, 0.03],
  [T.frightEnd, { 'Mouth_I': 0.6 }],
  [T.lookUp, { 'Mouth_O': 0.45 }],
  [T.scratch, { 'Mouth_Smirk L': 0.7, 'Eyes_Sad': 0.25 }],
  [T.idea, { 'Eyes_Fun': 1, 'Mouth_Smirk R': 0.8 }, 0.04],
  [T.climb, { 'Eyes_Angry': 0.6, 'Mouth_Angry': 0.5 }],
  [T.climbEnd, { 'Eyes_ .> <.': 1, 'Mouth_Angry': 0.6 }],
  [T.sit, { 'Eyes_Close': 1, 'Mouth_Smirk R': 0.6 }],
  [T.peek, { 'Eyes_Wink R': 1, 'Mouth_I': 0.5 }],                          // opens one eye: checks
  [T.pullBack, { 'Eyes_Joy': 1, 'Mouth_Joy': 0.8 }],
  [T.wave, { 'Eyes_Joy': 1, 'Mouth_Joy': 1 }],
];

window.SCENE = { name: 'celular', dur: T.dur, aspect: 2.39, T, PHONE, stateAt: (t) => {
  const P = newPose();
  // ---------------- camera
  let cam;
  if (t < T.walk2) cam = { ...WIDE, cut: false };
  else if (t < T.climb) cam = { ...MED, cut: t - T.walk2 < 0.5 / 60 };
  else if (t < T.mantleEnd) { const y = Math.max(1.0, climbY(t) + 0.95);         // camera rises with him
    cam = { pos: [-0.55, y + 0.05, 4.1], target: [-0.3, y, 0], fov: 27, cut: false }; }
  else if (t < T.pullBack) cam = { ...TOP, cut: t - T.mantleEnd < 0.5 / 60 };
  else { const u = sm(T.pullBack, T.pullBack + 0.9, t);
    cam = { pos: TOP.pos.map((v, i) => lerp(v, END.pos[i], u)), target: TOP.target.map((v, i) => lerp(v, END.target[i], u)), fov: lerp(TOP.fov, END.fov, u), cut: false }; }
  cam.pos = shake(cam.pos, t, T.land, 0.03, 8);
  P.cam = cam;
  // ---------------- 01-03 walk past, fright jump, approach, look up/down, scratch, idea
  P.x = X0 + path(t); P.z = 0.15;
  P.rotY = PI / 2;
  P.hipsX = 0.0;
  if (t < T.climb) walkLegs(P, wk, t, { arms: true });
  // fright: jumps with arms up, lands facing the phone
  const fj = bump(t, T.fright, T.fright + 0.32);
  P.y += 0.28 * fj;
  P.sqScale = [P.sqScale[0] * (1 - 0.06 * fj), P.sqScale[1] * (1 + 0.1 * fj), P.sqScale[2] * (1 - 0.06 * fj)];
  const fr = ss(T.fright, T.fright + 0.08, t) * (1 - ss(T.frightEnd - 0.1, T.frightEnd + 0.1, t));
  P.armL.x = lerp(P.armL.x, 1.1, fr); P.armR.x = lerp(P.armR.x, 1.1, fr); P.armL.el = lerp(P.armL.el, 0.6, fr); P.armR.el = P.armL.el;
  if (fj > 0) for (const l of [P.legL, P.legR]) { l.x = lerp(l.x, -0.6, fj); l.k = lerp(l.k, 1.1, fj); }
  P.rotY = lerp(P.rotY, PI / 2 - 0.5, ss(T.fright + 0.1, T.frightEnd, t));     // turns towards the noise
  P.rotY = lerp(P.rotY, PI / 2 - 0.85, ss(T.walk2End - 0.1, T.lookUp, t));   // 3/4 to camera while inspecting
  P.shPitch += -0.35 * wob(t - T.fright - 0.3, 3.2, 4.5) * (t > T.fright + 0.3 ? 1 : 0);
  // looks up (lean back) and down, scratches his head with the right hand
  const look = kf([[T.lookUp - 0.1, 0], [T.lookUp + 0.12, -0.45], [T.lookDown, -0.45], [T.lookDown + 0.2, 0.12], [T.idea - 0.05, 0.05], [T.idea + 0.1, -0.05]], t);
  if (t > T.walk2End && t < T.climb) P.hipsX += look;
  const sc_ = ss(T.scratch, T.scratch + 0.15, t) * (1 - ss(T.scratchEnd - 0.08, T.scratchEnd + 0.08, t));
  P.armR.x = lerp(P.armR.x, 1.35, sc_); P.armR.z = lerp(P.armR.z, -0.2, sc_); P.armR.el = lerp(P.armR.el, 1.7 + 0.25 * Math.sin((t - T.scratch) * TAU * 5), sc_);
  P.armR.hx = 0.4 * Math.sin((t - T.scratch) * TAU * 5 - 1) * sc_;
  // idea: looks at camera, quick pop up with the left arm
  const id = ss(T.idea - 0.05, T.idea + 0.08, t) * (1 - ss(T.walk3 - 0.05, T.walk3 + 0.1, t));
  P.rotY = lerp(P.rotY, 0.05, id);
  const pop = bump(t, T.idea, T.idea + 0.25);
  P.y += 0.05 * pop; P.armL.x = lerp(P.armL.x, 0.9, pop); P.armL.el = lerp(P.armL.el, 0.9, pop);
  P.shPitch += 0.25 * wob(t - T.idea - 0.05, 3.5, 5) * (t > T.idea + 0.05 ? 1 : 0);
  P.rotY = lerp(P.rotY, PI / 2, ss(T.walk3, T.walk3 + 0.15, t));             // walks to the side of the phone
  // ---------------- 04 climbs the side: hand over hand, legs pushing, slips with the buzz
  if (t >= T.climb && t < T.climbEnd) {
    P.x = CLIMB_X; P.y = climbY(t); P.rotY = PI / 2; P.hipsX = 0.18; P.shadow = 0;
    const ph = (t - T.climb) / (T.climbEnd - T.climb) * 6 * TAU;
    P.armL.x = 0.85 + 0.45 * Math.sin(ph); P.armR.x = 0.85 - 0.45 * Math.sin(ph);
    P.armL.z = 0.9; P.armR.z = 0.9; P.armL.el = 0.6 - 0.4 * Math.sin(ph); P.armR.el = 0.6 + 0.4 * Math.sin(ph);
    P.legL.x = -0.55 + 0.35 * Math.sin(ph + 1.6); P.legL.k = 0.9 + 0.5 * Math.sin(ph + 1.6);
    P.legR.x = -0.55 - 0.35 * Math.sin(ph + 1.6); P.legR.k = 0.9 - 0.5 * Math.sin(ph + 1.6);
    P.legL.a = P.legR.a = 0.3;
    P.hipsZ = 0.05 * Math.sin(ph);
    P.sqScale = [1 + 0.03 * Math.sin(2 * ph), 1 - 0.04 * Math.sin(2 * ph), 1 + 0.03 * Math.sin(2 * ph)];
    P.shPitch = -0.12 * Math.sin(2 * ph - 1) + 0.03 * Math.sin(t * TAU * 29) * 1;
  }
  // ---------------- 05 mantles onto the top and sits on the front camera
  if (t >= T.climbEnd) {
    const u = sm(T.climbEnd, T.mantleEnd, t);
    P.x = lerp(CLIMB_X, PHONE.x, u); P.z = lerp(0.15, SIT_Z, u);
    P.y = lerp(climbY(T.climbEnd), SIT_Y, u) + 0.22 * bump(t, T.climbEnd, T.mantleEnd);
    P.rotY = lerp(PI / 2, 0, u); P.hipsX = lerp(0.18, 0, u); P.shadow = 0;
    const sitU = ss(T.mantleEnd - 0.1, T.sit, t);
    const legSit = { x: -1.45, k: 1.45, a: -0.1 };
    for (const l of [P.legL, P.legR]) { l.x = lerp(-0.4, legSit.x, sitU); l.k = lerp(0.7, legSit.k, sitU); l.a = lerp(0.2, legSit.a, sitU); }
    P.armL.x = lerp(0.8, -1.05, u); P.armR.x = P.armL.x; P.armL.z = lerp(0.9, 0.25, u); P.armR.z = P.armL.z; P.armL.el = P.armR.el = 0.3;
    // the "click": settles down with a little squash
    const ck = wob(t - T.click, 3.6, 7) * (t > T.click ? 1 : 0);
    P.sqPivot = [P.x, PHONE.h, P.z];
    P.sqScale = [1 + 0.05 * ck, 1 - 0.07 * ck, 1 + 0.05 * ck];
    P.shPitch = 0.2 * wob(t - T.click, 3, 5) * (t > T.click ? 1 : 0);
    // 06 peeks with one eye, a tiny lean; 07 legs dangle and swing, contented sigh; 08 waves
    P.hipsZ = 0.07 * ss(T.peek, T.peek + 0.2, t) * (1 - ss(T.pullBack - 0.1, T.pullBack + 0.1, t));
    const dang = ss(T.pullBack, T.pullBack + 0.4, t);
    P.legL.x += 0.18 * Math.sin((t - T.pullBack) * TAU * 1.6) * dang; P.legL.k += 0.3 * Math.sin((t - T.pullBack) * TAU * 1.6 - 0.6) * dang;
    P.legR.x -= 0.18 * Math.sin((t - T.pullBack) * TAU * 1.6) * dang; P.legR.k -= 0.3 * Math.sin((t - T.pullBack) * TAU * 1.6 - 0.6) * dang;
    const inh = bump(t, T.sigh, T.sigh + 0.55), exh = bump(t, T.sigh + 0.55, T.sigh + 1.0);
    P.sqScale = [P.sqScale[0] * (1 - 0.03 * inh + 0.04 * exh), P.sqScale[1] * (1 + 0.06 * inh - 0.05 * exh), P.sqScale[2]];
    P.armL.x += 0.25 * inh; P.armR.x += 0.25 * inh;
    const wave = ss(T.wave, T.wave + 0.2, t), wph = (t - T.wave) * TAU * 2.4;
    P.armR.x = lerp(P.armR.x, 0.75, wave); P.armR.z = lerp(P.armR.z, 0.15, wave);
    P.armR.el = lerp(P.armR.el, 0.35 + 0.42 * Math.sin(wph), wave); P.armR.hx = 0.45 * Math.sin(wph - 1.1) * wave;
    P.shPitch += -0.12 * wob(t - T.wave - 0.1, 3.4, 5) * (t > T.wave + 0.1 ? 1 : 0);
    const br = Math.sin(t * TAU * 0.9) * 0.012 * ss(T.wave, T.wave + 0.3, t);
    P.sqScale = [P.sqScale[0] - br * 0.5, P.sqScale[1] + br, P.sqScale[2] - br * 0.5];
  }
  P.morph = expr(EXPR, t, [0.5, 1.75, 3.0, 8.3, 9.3]);
  // ---------------- props: phone fall / bounce / buzz, screen, ripples
  let py = t < T.land ? 4.9 * (1 - (t / T.land) ** 2) : 0.13 * Math.abs(wob(t - T.land, 2.2, 5.5));
  const buzzing = t > T.land + 0.08 && t < T.off ? (((t - T.land) / 0.8) % 1 < 0.55 ? 1 : 0) : 0;
  const jx = 0.007 * buzzing * Math.sin(t * TAU * 29), jr = 0.012 * buzzing * Math.sin(t * TAU * 31 + 1);
  const tilt = (t < T.land ? 0.06 * Math.sin(t * 5) : 0) + 0.05 * wob(t - T.land, 2.6, 5);
  P.props = {
    phone: { ...PHONE, y: py, tilt, jx, jr }, buzz: buzzing,
    screen: 1 - ss(T.off, T.off + 0.12, t), ripple: Math.max(0, t - T.off), clickT: T.click, fade: T.fade,
  };
  if (buzzing && t > T.climb && t < T.climbEnd) { P.x += jx * 0.6; }
  return assemble(P);
} };
})();
