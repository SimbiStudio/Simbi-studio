// Bakes build/anim.js (the single source of truth for the choreography) into per-frame data
// for Blender: skinning deltas per joint, morph weights, root, squash, glass contact, camera.
//   node export_anim.js [fps=60] [out=anim_frames.json]
'use strict';
const fs = require('fs'), path = require('path');
const B = path.join(__dirname, '..', 'build');
global.window = global;
eval(fs.readFileSync(path.join(B, 'timeline.js'), 'utf8'));
eval(fs.readFileSync(path.join(B, 'whistle_env.js'), 'utf8'));
eval(fs.readFileSync(path.join(B, 'engine.js'), 'utf8').replace(/class Engine[\s\S]*$/, 'window.M=M;window.Q=Q;window.V=V;'));
eval(fs.readFileSync(path.join(B, 'anim.js'), 'utf8'));

const T = window.TL;
const fps = Number(process.argv[2] || 60), out = process.argv[3] || path.join(__dirname, 'anim_frames.json');
const raw = fs.readFileSync(path.join(__dirname, '..', 'input', 'LockyBase2026_rigfix.glb'));
const jl = raw.readUInt32LE(12), j = JSON.parse(raw.slice(20, 20 + jl).toString()), binOff = 20 + jl + 8;
const nodes = j.nodes.map((n, i) => ({ i, name: n.name, t: n.translation || [0, 0, 0], r: n.rotation || [0, 0, 0, 1], s: n.scale || [1, 1, 1], children: n.children || [], parent: -1 }));
nodes.forEach(n => n.children.forEach(c => nodes[c].parent = n.i));
const skin = j.skins[0], ia = j.accessors[skin.inverseBindMatrices], ibv = j.bufferViews[ia.bufferView];
const ibmOff = binOff + (ibv.byteOffset || 0) + (ia.byteOffset || 0);
const ibm = new Float32Array(raw.buffer.slice(raw.byteOffset + ibmOff, raw.byteOffset + ibmOff + ia.count * 64));
const hipsK = skin.joints.findIndex(ji => nodes[ji].name === 'Hips');

// same maths as Engine.computeJoints (neutral_bone follows Hips)
const joints = (pose) => { const W = [];
  const world = (i) => { if (W[i]) return W[i]; const n = nodes[i]; let r = n.r, t = n.t, s = n.s;
    const dq = pose.bones[n.name]; if (dq) r = Q.mul(r, dq);
    const dt = pose.boneT && pose.boneT[n.name]; if (dt) t = [t[0] + dt[0], t[1] + dt[1], t[2] + dt[2]];
    const l = M.trs(t, r, s); return (W[i] = n.parent >= 0 ? M.mul(world(n.parent), l) : l); };
  const jm = skin.joints.map((ji, k) => M.mul(world(ji), ibm.subarray(k * 16, k * 16 + 16)));
  return skin.joints.map((ji, k) => Array.from(nodes[ji].name === 'neutral_bone' ? jm[hipsK] : jm[k], v => +v.toFixed(6))); };

const r6 = (a) => a.map(v => +(+v).toFixed(6));
const frames = [];
const N = Math.round(T.dur * fps);
for (let f = 0; f <= N; f++) {
  const t = f / fps, st = stateAt(t);
  frames.push({ t, joints: joints(st.pose), morph: Object.fromEntries(Object.entries(st.pose.morph).map(([k, v]) => [k, +v.toFixed(5)])),
    root: r6(Array.from(st.root)), visible: st.root[0] !== 0 || st.root[5] !== 0,
    sq: { pivot: r6(st.sq.pivot), scale: r6(st.sq.scale) }, glass: { on: st.glass.on ? 1 : 0, c: r6(st.glass.c) },
    shackle: r6(st.pose.shackle || [0, 0, 0, 1]),
    cam: { pos: r6(st.cam.pos), target: r6(st.cam.target), fov: st.cam.fov }, shadow: +st.shadow.a.toFixed(4), flash: +(st.flash || 0).toFixed(4) });
}
fs.writeFileSync(out, JSON.stringify({ fps, dur: T.dur, glassZ: T.glassZ, timeline: T, jointNames: skin.joints.map(ji => nodes[ji].name), frames }));
console.log('wrote', out, frames.length, 'frames');
