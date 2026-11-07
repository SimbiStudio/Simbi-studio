// "El telón" — Locky tries to open the cinema curtain, it jams, falls on him, he fights inside the
// cloth and comes out waving as if nothing happened.  ~10 s, scope 2.39:1.
// Character only (+ prop cues in P.props); the curtain is a Blender cloth sim driven by those cues.
'use strict';
(() => {
const { cl, lerp, ss, sm, outBack, wob, bump, kf, PI, TAU, walker, walkLegs, standLegs, expr, newPose, assemble, shake } = window.LK;

const T = {
  dur: 10.0, walkEnd: 1.7, turn: 1.55, grab: 1.85, pull1: 1.95, slip: 2.45, recover: 2.62, pull2: 2.68,
  hang: 3.0, crack: 3.42, release: 3.75, sitFall: 3.82, covered: 4.35, struggle: 4.6, slipOut: 5.6, cut2: 6.1,
  emerge: 6.1, dizzy: 6.55, shakeOff: 7.3, reach: 7.62, yank: 7.85, throwT: 7.95, straighten: 8.3,
  smile: 8.6, wave: 8.9, fade: 9.3,
};
const START_X = 3.3, STOP_X = 1.95, ROPE = [1.5, 3.6, 0.1];
const D = START_X - STOP_X, V = D / 1.5;                            // constant speed, then 0.4 s to stop
const path = (t) => t < 1.3 ? V * t : t < 1.7 ? V * 1.3 + V * (t - 1.3) - V * (t - 1.3) ** 2 / (2 * 0.4) : D;
const wk = walker(path, 7.0);

// cameras (cut = true on the first frame of a new shot -> constant interpolation in Blender)
const WIDE = { pos: [0, 1.3, 7.4], target: [0, 1.3, 0], fov: 21 };
const MED1 = { pos: [1.65, 0.9, 4.4], target: [1.72, 0.74, 0], fov: 26 };
const MED2 = { pos: [1.9, 0.92, 4.6], target: [1.95, 0.72, 0.9], fov: 26 };
const camAt = (t) => {
  if (t < 1.0) return { ...WIDE, cut: false };
  if (t < T.release) { let c = { ...MED1, pos: [MED1.pos[0], MED1.pos[1], MED1.pos[2] - 0.15 * ss(1.0, T.release, t)] };
    c.pos = shake(c.pos, t, T.crack, 0.025, 7); return { ...c, cut: t - 1.0 < 0.5 / 60 }; }
  if (t < T.cut2) { let c = { ...WIDE }; c.pos = shake(c.pos, t, 4.3, 0.035, 8); return { ...c, cut: t - T.release < 0.5 / 60 }; }
  const c = { ...MED2, pos: [MED2.pos[0], MED2.pos[1], MED2.pos[2] - 0.12 * ss(T.cut2, T.dur, t)] };
  return { ...c, cut: t - T.cut2 < 0.5 / 60 };
};

const EXPR = [
  [0.0, { 'Mouth_Smirk L': 0.6 }],                                         // confident
  [T.pull1, { 'Eyes_Angry': 0.7, 'Mouth_Angry': 0.8 }],                    // effort
  [T.slip, { 'Eyes_ O O': 1, 'Mouth_O': 0.9 }, 0.03],                      // whoa
  [T.pull2, { 'Eyes_Angry': 1, 'Mouth_Angry': 1 }],                        // now with everything
  [T.crack, { 'Eyes_ O O': 1, 'Mouth_I': 0.6 }, 0.03],                     // ...uh oh
  [T.release, { 'Eyes_ .> <.': 1, 'Mouth_O': 1 }, 0.03],
  [T.emerge, { 'Eyes_': 1, 'Mouth_O': 0.5, 'Mouth_Smirk L': 0.4 }, 0.02],  // dizzy (spiral decals on)
  [T.shakeOff, { 'Eyes_ .> <.': 1, 'Mouth_Angry': 0.5 }, 0.04],
  [T.straighten, { 'Mouth_I': 0.4 }],
  [T.smile, { 'Mouth_Joy': 0.75, 'Mouth_Smirk L': 0.35 }],                 // forced "nothing happened" smile
];
const BLINKS = [0.6, 8.45, 9.4];

window.SCENE = { name: 'telon', dur: T.dur, aspect: 2.39, T, stateAt: (t) => {
  const P = newPose();
  P.cam = camAt(t);
  P.z = 0.0;
  // ---------------- 01 walk in from the right, facing left (-x)
  P.x = START_X - path(t);
  P.rotY = lerp(-PI / 2, -PI / 2 + 0.45, sm(T.turn, T.grab + 0.1, t));    // opens a little towards camera, rope in front of him
  P.hipsX = 0.06;                                                          // chest out, confident
  if (t < T.hang) walkLegs(P, wk, t, { arms: t < T.turn });
  else standLegs(P);
  // ---------------- 02-03 grab, pull, slip, pull, hang with all his weight
  const grab = ss(T.grab - 0.12, T.grab + 0.05, t) * (1 - ss(T.release, T.release + 0.06, t));
  if (grab > 0) {
    const reachArm = { x: 0.32, z: 1.2, el: 0.35 };
    for (const a of [P.armL, P.armR]) { a.x = lerp(a.x, reachArm.x, grab); a.z = lerp(a.z, reachArm.z, grab); a.el = lerp(a.el, reachArm.el, grab); a.hand = 0; }
    // pulls: lean back + dip; slip: feet shoot forward, he nearly falls; pull 2 + hang: lean back hard
    const lean = kf([[T.grab, 0.06], [T.pull1 + 0.2, -0.28], [T.slip, -0.22], [T.slip + 0.08, -0.62], [T.recover, -0.3],
                     [T.pull2 + 0.15, -0.38], [T.hang + 0.25, -0.62], [T.crack, -0.66], [T.release, -0.66]], t);
    P.hipsX = lerp(P.hipsX, lean, grab);
    const tug = Math.max(0, Math.sin(TAU * 2.2 * (t - T.pull1))) * (t > T.pull1 && t < T.slip ? 1 : 0)
              + Math.max(0, Math.sin(TAU * 3.0 * (t - T.pull2))) * (t > T.pull2 && t < T.hang ? 1 : 0);
    P.hipsY -= 0.025 * tug;
    for (const a of [P.armL, P.armR]) { a.x -= 0.25 * tug; a.el += 0.25 * tug; }
    // feet: shoot forward on the slip, then stay braced in front of him while hanging
    const brace = kf([[T.slip, 0], [T.slip + 0.07, 0.95], [T.recover, 0.15], [T.hang, 0.2], [T.hang + 0.25, 0.75], [T.release, 0.75]], t);
    for (const l of [P.legL, P.legR]) { l.x = lerp(l.x, -brace, cl(brace / 0.2)); l.k = lerp(l.k, 0.15, cl(brace / 0.2)); l.a = -l.x * 0.6; l.toe = 0; }
    P.hipsY -= 0.06 * brace;
    // effort tremble while hanging, freeze on the crack
    const shiver = 0.02 * Math.sin(t * TAU * 13) * ss(T.hang, T.hang + 0.2, t) * (1 - ss(T.crack, T.crack + 0.05, t));
    P.hipsZ += shiver; P.sqScale = [1 - 0.04 * brace, 1 + 0.06 * brace, 1 - 0.04 * brace];
    P.shPitch += -0.25 * wob(t - T.slip, 3.5, 4) + 0.06 * Math.sin(t * TAU * 13) * ss(T.hang, T.hang + 0.2, t) * (1 - ss(T.crack, T.crack + 0.05, t));
  }
  // ---------------- 04 rope goes slack: he falls back on his butt, arms flail; the curtain covers him
  if (t >= T.release && t < T.struggle) {
    const f = outBack(cl((t - T.release) / 0.22), 1.3);
    P.hipsX = lerp(-0.66, -0.35, f); P.hipsY = lerp(-0.06, -0.13, f);
    for (const l of [P.legL, P.legR]) { l.x = lerp(-0.75, -1.35, f); l.k = 0.25; l.a = 0.9; }
    const fl = Math.sin((t - T.release) * TAU * 5) * 0.4 * (1 - ss(T.covered - 0.2, T.covered, t));
    P.armL.x = 0.7 + fl; P.armR.x = 0.7 - fl; P.armL.z = 0.4; P.armR.z = 0.4; P.armL.el = 0.6; P.armR.el = 0.6;
    P.shPitch = -0.4 * wob(t - T.release, 3, 4);
  }
  // ---------------- 05 fight inside the cloth: hops, pokes with an arm, pushes up with the shackle
  if (t >= T.slipOut && t < T.cut2) P.visible = false;
  if (t >= T.struggle && t < T.cut2) {
    standLegs(P, 0.25);
    const u = t - T.struggle;
    P.x = STOP_X + kf([[0, 0], [0.35, -0.35], [0.7, -0.15], [1.0, 0.3], [1.25, 0.05], [1.5, -0.1]], u);
    P.y = 0.22 * (bump(u, 0.25, 0.45) + 0.8 * bump(u, 0.85, 1.05) + bump(u, 1.2, 1.38));
    P.rotY = kf([[0, -0.9], [0.4, 0.4], [0.8, -0.3], [1.2, 0.6], [1.5, 0]], u);
    P.hipsX = 0.1 * Math.sin(u * TAU * 2.3); P.hipsZ = 0.18 * Math.sin(u * TAU * 1.7);
    // right arm pokes up (bracito), later left arm; shackle pushes on the hops
    const pokeR = bump(u, 0.05, 0.4), pokeL = bump(u, 0.95, 1.3);
    P.armR.x = lerp(-0.9, 1.35, pokeR); P.armR.z = 0.2; P.armR.el = lerp(0.5, 0.0, pokeR);
    P.armL.x = lerp(-0.9, 1.35, pokeL); P.armL.z = 0.2; P.armL.el = lerp(0.5, 0.0, pokeL);
    P.sqScale = [1 - 0.06 * (pokeR + pokeL), 1 + 0.1 * (pokeR + pokeL), 1 - 0.06 * (pokeR + pokeL)];
    P.shPitch = 0.3 * Math.sin(u * TAU * 3.1);
  }
  // ---------------- 06 cut: rises out of the heap with a hood, dizzy, wobbling
  if (t >= T.cut2) {
    standLegs(P);
    P.x = STOP_X; P.z = 0.9; P.rotY = -0.25;
    const rise = outBack(cl((t - T.emerge) / 0.45), 1.6);
    P.y = lerp(-0.75, 0, rise);
    const dz = ss(T.dizzy - 0.2, T.dizzy, t) * (1 - ss(T.shakeOff - 0.05, T.shakeOff + 0.1, t));
    const wph = (t - T.dizzy) * TAU * 1.4;
    P.hipsZ = 0.13 * Math.sin(wph) * dz; P.hipsX = 0.08 * Math.cos(wph) * dz;
    P.x += 0.06 * Math.sin(wph * 0.5) * dz;
    P.armL.x = -0.8 + 0.25 * Math.sin(wph + 1) * dz; P.armR.x = -0.8 + 0.25 * Math.sin(wph + 2.5) * dz; P.armL.el = P.armR.el = 0.4;
    P.shPitch = 0.12 * Math.sin(wph - 0.8) * dz; P.shRoll = 0.15 * Math.sin(wph - 1.2) * dz;
    // 07 shake it off (dog shake), reach the hood, yank it and throw it out of frame (to the left)
    const shk = ss(T.shakeOff, T.shakeOff + 0.05, t) * (1 - ss(T.reach - 0.1, T.reach, t));
    P.rotY += 0.32 * Math.sin((t - T.shakeOff) * TAU * 6.5) * shk;
    P.hipsZ += 0.1 * Math.sin((t - T.shakeOff) * TAU * 6.5 + 1) * shk;
    P.sqScale = [1 + 0.05 * shk, 1 - 0.06 * shk, 1 + 0.05 * shk];
    P.shRoll += 0.35 * Math.sin((t - T.shakeOff) * TAU * 6.5 - 0.9) * shk;
    const reach = ss(T.reach, T.yank, t), thr = ss(T.yank, T.throwT + 0.1, t), back = ss(T.throwT + 0.15, T.straighten, t);
    P.armR.x = lerp(lerp(P.armR.x, 1.25, reach), 0.9, thr); P.armR.el = lerp(lerp(P.armR.el, 1.5, reach), 0.2, thr);
    P.armR.z = lerp(lerp(0, 0.2, reach), 1.6, thr);                               // swings across his body to the left
    P.armR.x = lerp(P.armR.x, -1.0, back); P.armR.el = lerp(P.armR.el, 0.3, back); P.armR.z = lerp(P.armR.z, 0, back);
    P.rotY += 0.35 * bump(t, T.yank, T.straighten);                              // body follows the throw
    // 08 straighten up (stretch -> settle), forced smile, wave
    const st = wob(t - T.straighten, 2.8, 6) * (t > T.straighten ? 1 : 0);
    P.sqScale = [P.sqScale[0] * (1 - 0.05 * st), P.sqScale[1] * (1 + 0.08 * st), P.sqScale[2] * (1 - 0.05 * st)];
    P.hipsX += -0.05 * ss(T.straighten, T.straighten + 0.2, t);
    P.rotY = lerp(P.rotY, 0, ss(T.straighten, T.smile, t));
    const wave = ss(T.wave, T.wave + 0.2, t);
    const wph2 = (t - T.wave) * TAU * 2.4;
    P.armR.x = lerp(P.armR.x, 0.75, wave); P.armR.z = lerp(P.armR.z, 0.15, wave);
    P.armR.el = lerp(P.armR.el, 0.35 + 0.42 * Math.sin(wph2), wave); P.armR.hx = 0.45 * Math.sin(wph2 - 1.1) * wave;
    P.shPitch += -0.12 * wob(t - T.wave - 0.1, 3.4, 5) * (t > T.wave + 0.1 ? 1 : 0);
    const br = Math.sin(t * TAU * 0.9) * 0.012 * ss(T.smile, T.smile + 0.3, t);
    P.sqScale = [P.sqScale[0] - br * 0.5, P.sqScale[1] + br, P.sqScale[2] - br * 0.5];
    P.shadow = 0;
  }
  P.morph = expr(EXPR, t, BLINKS);
  // ---------------- props for Blender
  const tip = cl((t - (T.crack + 0.1)) / (T.release + 0.05 - (T.crack + 0.1)));
  const rail = { y: 4.0 - 0.05 * ss(T.crack, T.crack + 0.05, t) + 0.02 * wob(t - T.crack, 9, 7) - 1.1 * tip * tip,
                 z: -0.7 + 2.0 * tip * tip,
                 tilt: 0.04 * wob(t - T.crack, 7, 6) };
  const pins = 1 - ss(T.release, T.release + 0.03, t);                 // 1 = curtain hanging, 0 = released
  P.props = {
    rail, pins, grab: grab > 0.5 ? 1 : 0,
    collide: t < T.slipOut ? 1 : 0,                                     // he slips out from under: the mound collapses (wide shot)
    spiral: { on: ss(T.emerge, T.emerge + 0.05, t) * (1 - ss(T.shakeOff - 0.05, T.shakeOff + 0.02, t)), angle: (t - T.emerge) * TAU * 1.7 },
    hood: { on: t >= T.cut2 ? 1 : 0, thrown: t >= T.throwT ? 1 : 0 },
    throwT: T.throwT, fade: T.fade,
  };
  return assemble(P);
} };
})();
