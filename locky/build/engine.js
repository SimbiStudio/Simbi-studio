// Minimal glTF skinned/morph renderer for Locky (WebGL2)
'use strict';
const M = {
  ident() { const m = new Float32Array(16); m[0]=m[5]=m[10]=m[15]=1; return m; },
  mul(a, b) { const o = new Float32Array(16);
    for (let c = 0; c < 4; c++) for (let r = 0; r < 4; r++) {
      o[c*4+r] = a[r]*b[c*4] + a[4+r]*b[c*4+1] + a[8+r]*b[c*4+2] + a[12+r]*b[c*4+3]; }
    return o; },
  trs(t, q, s) { const [x,y,z,w] = q; const [sx,sy,sz] = s;
    const xx=x*x, yy=y*y, zz=z*z, xy=x*y, xz=x*z, yz=y*z, wx=w*x, wy=w*y, wz=w*z;
    const o = new Float32Array(16);
    o[0]=(1-2*(yy+zz))*sx; o[1]=2*(xy+wz)*sx; o[2]=2*(xz-wy)*sx;
    o[4]=2*(xy-wz)*sy; o[5]=(1-2*(xx+zz))*sy; o[6]=2*(yz+wx)*sy;
    o[8]=2*(xz+wy)*sz; o[9]=2*(yz-wx)*sz; o[10]=(1-2*(xx+yy))*sz;
    o[12]=t[0]; o[13]=t[1]; o[14]=t[2]; o[15]=1; return o; },
  persp(fovy, asp, n, f) { const t = 1/Math.tan(fovy/2), o = new Float32Array(16);
    o[0]=t/asp; o[5]=t; o[10]=(f+n)/(n-f); o[11]=-1; o[14]=2*f*n/(n-f); return o; },
  lookAt(e, c, u) { const z = V.norm(V.sub(e,c)), x = V.norm(V.cross(u,z)), y = V.cross(z,x);
    const o = new Float32Array(16);
    o[0]=x[0]; o[4]=x[1]; o[8]=x[2]; o[1]=y[0]; o[5]=y[1]; o[9]=y[2]; o[2]=z[0]; o[6]=z[1]; o[10]=z[2];
    o[12]=-V.dot(x,e); o[13]=-V.dot(y,e); o[14]=-V.dot(z,e); o[15]=1; return o; },
  xf(m, p) { const w = m[3]*p[0]+m[7]*p[1]+m[11]*p[2]+m[15];
    return [(m[0]*p[0]+m[4]*p[1]+m[8]*p[2]+m[12])/w,(m[1]*p[0]+m[5]*p[1]+m[9]*p[2]+m[13])/w,(m[2]*p[0]+m[6]*p[1]+m[10]*p[2]+m[14])/w]; },
};
const V = {
  sub:(a,b)=>[a[0]-b[0],a[1]-b[1],a[2]-b[2]], dot:(a,b)=>a[0]*b[0]+a[1]*b[1]+a[2]*b[2],
  cross:(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]],
  norm:(a)=>{const l=Math.hypot(a[0],a[1],a[2])||1;return [a[0]/l,a[1]/l,a[2]/l];},
};
const Q = {
  axis(ax, ang) { const s = Math.sin(ang/2), n = V.norm(ax); return [n[0]*s,n[1]*s,n[2]*s,Math.cos(ang/2)]; },
  mul(a, b) { return [a[3]*b[0]+a[0]*b[3]+a[1]*b[2]-a[2]*b[1], a[3]*b[1]-a[0]*b[2]+a[1]*b[3]+a[2]*b[0],
    a[3]*b[2]+a[0]*b[1]-a[1]*b[0]+a[2]*b[3], a[3]*b[3]-a[0]*b[0]-a[1]*b[1]-a[2]*b[2]]; },
  euler(x, y, z) { return Q.mul(Q.mul(Q.axis([0,1,0],y), Q.axis([1,0,0],x)), Q.axis([0,0,1],z)); },
};

const VS = `#version 300 es
precision highp float;
in vec3 aPos; in vec3 aNrm; in vec2 aUv; in vec4 aJ; in vec4 aW;
uniform mat4 uJ[28]; uniform mat4 uVP; uniform mat4 uRoot;
uniform vec3 uSqPivot; uniform vec3 uSqScale;
uniform float uGlassZ; uniform float uGlassOn; uniform vec2 uGlassC; uniform float uLayer;
out vec3 vN; out vec2 vUv; out vec3 vW; out float vPress;
void main(){
  mat4 sk = aW.x*uJ[int(aJ.x)] + aW.y*uJ[int(aJ.y)] + aW.z*uJ[int(aJ.z)] + aW.w*uJ[int(aJ.w)];
  vec4 w = uRoot * sk * vec4(aPos,1.0);
  vec3 n = normalize(mat3(uRoot) * mat3(sk) * aNrm);
  vec3 p = w.xyz;
  // squash & stretch around pivot (world space)
  p = uSqPivot + (p - uSqPivot) * uSqScale;
  n = normalize(n / uSqScale);
  float press = 0.0;
  if (uGlassOn > 0.5) {
    float d = p.z - uGlassZ;
    if (d > 0.0) {
      press = d;
      p.xy += (p.xy - uGlassC) * min(d, 0.13) * 2.6;
      p.z = uGlassZ + d * 0.015 + uLayer;
      n = normalize(mix(n, vec3(0.0,0.0,1.0), clamp(d*12.0,0.0,0.8)));
    }
  }
  vN = n; vUv = aUv; vW = p; vPress = press;
  gl_Position = uVP * vec4(p,1.0);
}`;
const FS = `#version 300 es
precision highp float;
in vec3 vN; in vec2 vUv; in vec3 vW; in float vPress;
uniform vec4 uBase; uniform sampler2D uTex; uniform float uHasTex; uniform float uRough;
uniform vec3 uEye; uniform float uAlphaMode; uniform vec3 uBg; uniform float uFlash;
out vec4 o;
vec3 toLin(vec3 c){ return pow(c, vec3(2.2)); }
void main(){
  vec4 base = uBase;
  if (uHasTex > 0.5) { vec4 t = texture(uTex, vUv); base.rgb *= toLin(t.rgb); base.a *= t.a; }
  if (uAlphaMode > 0.5 && base.a < 0.02) discard;
  vec3 N = normalize(vN); if (!gl_FrontFacing) N = -N;
  vec3 Vd = normalize(uEye - vW);
  vec3 L1 = normalize(vec3(-0.55, 0.9, 0.75));   // key, warm
  vec3 L2 = normalize(vec3(0.8, 0.25, 0.45));    // fill, cool
  vec3 L3 = normalize(vec3(0.2, 0.6, -1.0));     // rim from behind
  float k1 = max((dot(N,L1)+0.35)/1.35, 0.0); k1 = k1*k1*(3.0-2.0*k1);
  float k2 = max((dot(N,L2)+0.5)/1.5, 0.0);
  vec3 skyC = vec3(0.62,0.70,1.0), grdC = toLin(uBg)*1.4;
  vec3 amb = mix(grdC, skyC, N.y*0.5+0.5) * 0.42;
  // cheap AO toward the ground
  float ao = mix(0.72, 1.0, smoothstep(-0.05, 0.6, vW.y));
  vec3 diff = base.rgb * (amb*ao + vec3(1.0,0.95,0.88)*k1*1.05 + vec3(0.55,0.62,1.0)*k2*0.30);
  float shin = mix(90.0, 12.0, uRough);
  vec3 H = normalize(L1 + Vd);
  float spec = pow(max(dot(N,H),0.0), shin) * (1.0-uRough) * 0.55;
  float fres = pow(1.0 - max(dot(N,Vd),0.0), 3.0);
  float rim = fres * (0.35 + 0.65*max(dot(N,L3),0.0));
  vec3 col = diff + spec*vec3(1.0,0.97,0.92) + rim*vec3(0.55,0.65,1.0)*0.55;
  // pressed-against-glass highlight
  col *= 1.0 + uFlash * 0.35;
  col = col / (1.0 + col*0.18);           // soft tonemap
  float fog = smoothstep(4.0, 10.0, length(uEye - vW)) * 0.35;
  col = mix(col, toLin(uBg), fog);
  o = vec4(pow(col, vec3(1.0/2.2)), uAlphaMode > 0.5 ? base.a : 1.0);
}`;
const BG_VS = `#version 300 es
in vec2 aP; out vec2 vP; void main(){ vP = aP; gl_Position = vec4(aP, 0.9999, 1.0); }`;
const BG_FS = `#version 300 es
precision highp float; in vec2 vP; uniform vec3 uBg; uniform vec2 uRes; out vec4 o;
void main(){
  vec2 uv = vP*0.5+0.5;
  vec3 c = uBg;
  c *= mix(0.88, 1.10, uv.y);                               // vertical light
  float r = length((uv-vec2(0.5,0.62))*vec2(uRes.x/uRes.y,1.0));
  c *= mix(1.10, 0.80, smoothstep(0.1, 1.15, r));            // vignette / spotlight
  o = vec4(c, 1.0);
}`;
const SH_VS = `#version 300 es
in vec2 aP; uniform mat4 uVP; uniform vec3 uC; uniform vec2 uR; out vec2 vL;
void main(){ vL = aP; vec3 p = uC + vec3(aP.x*uR.x, 0.0, aP.y*uR.y); gl_Position = uVP*vec4(p,1.0); }`;
const SH_FS = `#version 300 es
precision highp float; in vec2 vL; uniform float uA; out vec4 o;
void main(){ float d = length(vL); float a = (1.0 - smoothstep(0.0, 1.0, d)); a = a*a*uA; o = vec4(0.06,0.05,0.25,a); }`;

class Engine {
  constructor(canvas) {
    this.cv = canvas;
    const gl = canvas.getContext('webgl2', { antialias: true, alpha: false, preserveDrawingBuffer: true, premultipliedAlpha: false });
    this.gl = gl;
    this.prog = this.mkProg(VS, FS);
    this.bgProg = this.mkProg(BG_VS, BG_FS);
    this.shProg = this.mkProg(SH_VS, SH_FS);
    this.quad = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1,-1,1,-1,-1,1,1,1]), gl.STATIC_DRAW);
  }
  mkProg(vs, fs) { const gl = this.gl;
    const sh = (t, s) => { const o = gl.createShader(t); gl.shaderSource(o, s); gl.compileShader(o);
      if (!gl.getShaderParameter(o, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(o)); return o; };
    const p = gl.createProgram(); gl.attachShader(p, sh(gl.VERTEX_SHADER, vs)); gl.attachShader(p, sh(gl.FRAGMENT_SHADER, fs));
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    const u = {}; const n = gl.getProgramParameter(p, gl.ACTIVE_UNIFORMS);
    for (let i = 0; i < n; i++) { const inf = gl.getActiveUniform(p, i); u[inf.name.replace('[0]','')] = gl.getUniformLocation(p, inf.name); }
    return { p, u }; }

  async load(b64) {
    const gl = this.gl;
    const raw = Uint8Array.from(atob(b64), c => c.charCodeAt(0)).buffer;
    const dv = new DataView(raw); const jl = dv.getUint32(12, true);
    const j = JSON.parse(new TextDecoder().decode(new Uint8Array(raw, 20, jl)));
    const binOff = 20 + jl + 8;
    const acc = (i) => { const a = j.accessors[i], bv = j.bufferViews[a.bufferView];
      const n = { SCALAR:1, VEC2:2, VEC3:3, VEC4:4, MAT4:16 }[a.type];
      const T = { 5126: Float32Array, 5123: Uint16Array, 5121: Uint8Array, 5125: Uint32Array }[a.componentType];
      if (a.bufferView === undefined) {
        const z = new T(a.count*n);
        if (a.sparse) { const s = a.sparse;
          const IT = { 5123: Uint16Array, 5121: Uint8Array, 5125: Uint32Array }[s.indices.componentType];
          const ib = j.bufferViews[s.indices.bufferView], vb = j.bufferViews[s.values.bufferView];
          const io = binOff + (ib.byteOffset||0) + (s.indices.byteOffset||0), vo = binOff + (vb.byteOffset||0) + (s.values.byteOffset||0);
          const idx = new IT(raw.slice(io, io + s.count*IT.BYTES_PER_ELEMENT)), val = new T(raw.slice(vo, vo + s.count*n*T.BYTES_PER_ELEMENT));
          for (let q = 0; q < s.count; q++) for (let c = 0; c < n; c++) z[idx[q]*n+c] = val[q*n+c]; }
        return z; }
      const off = binOff + (bv.byteOffset||0) + (a.byteOffset||0);
      return new T(raw.slice(off, off + a.count*n*T.BYTES_PER_ELEMENT)); };
    this.j = j;
    // textures
    this.tex = await Promise.all(j.textures.map(async t => {
      const im = j.images[t.source], bv = j.bufferViews[im.bufferView];
      const blob = new Blob([new Uint8Array(raw, binOff + (bv.byteOffset||0), bv.byteLength)], { type: im.mimeType });
      const bmp = await createImageBitmap(blob, { premultiplyAlpha: 'none', colorSpaceConversion: 'none' });
      const tx = gl.createTexture(); gl.bindTexture(gl.TEXTURE_2D, tx);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, bmp);
      gl.generateMipmap(gl.TEXTURE_2D);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR_MIPMAP_LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      return tx; }));
    // nodes
    this.nodes = j.nodes.map((n, i) => ({ i, name: n.name, t: n.translation||[0,0,0], r: n.rotation||[0,0,0,1], s: n.scale||[1,1,1],
      children: n.children||[], parent: -1, mesh: n.mesh, skin: n.skin }));
    this.nodes.forEach(n => n.children.forEach(c => this.nodes[c].parent = n.i));
    this.byName = {}; this.nodes.forEach(n => this.byName[n.name] = n);
    const sk = j.skins[0]; this.joints = sk.joints;
    this.ibm = acc(sk.inverseBindMatrices);
    // meshes
    this.prims = [];
    j.nodes.forEach((n) => { if (n.mesh === undefined) return;
      j.meshes[n.mesh].primitives.forEach(p => {
        const A = p.attributes; const pos = acc(A.POSITION), nrm = acc(A.NORMAL);
        const pr = { mat: j.materials[p.material], node: n.name, count: 0, pos, nrm,
          targets: (p.targets||[]).map(t => ({ p: acc(t.POSITION), n: t.NORMAL!==undefined ? acc(t.NORMAL) : null })),
          names: (j.meshes[n.mesh].extras||{}).targetNames || [] };
        pr.vao = gl.createVertexArray(); gl.bindVertexArray(pr.vao);
        const buf = (data, loc, size, type = gl.FLOAT, dyn = false) => { const b = gl.createBuffer(); gl.bindBuffer(gl.ARRAY_BUFFER, b);
          gl.bufferData(gl.ARRAY_BUFFER, data, dyn ? gl.DYNAMIC_DRAW : gl.STATIC_DRAW); gl.enableVertexAttribArray(loc);
          gl.vertexAttribPointer(loc, size, type, false, 0, 0); return b; };
        const P = this.prog.p, L = (nm) => gl.getAttribLocation(P, nm);
        pr.pb = buf(new Float32Array(pos), L('aPos'), 3, gl.FLOAT, true);
        pr.nb = buf(new Float32Array(nrm), L('aNrm'), 3, gl.FLOAT, true);
        buf(acc(A.TEXCOORD_0), L('aUv'), 2);
        const jj = acc(A.JOINTS_0); buf(new Float32Array(jj), L('aJ'), 4);
        buf(acc(A.WEIGHTS_0), L('aW'), 4);
        const idx = acc(p.indices); const ib = gl.createBuffer(); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, ib);
        gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, idx, gl.STATIC_DRAW);
        pr.count = idx.length; pr.itype = idx instanceof Uint32Array ? gl.UNSIGNED_INT : (idx instanceof Uint8Array ? gl.UNSIGNED_BYTE : gl.UNSIGNED_SHORT);
        pr.lastW = '';
        this.prims.push(pr);
        gl.bindVertexArray(null);
      }); });
  }

  // pose: { bones: {name: quatDelta}, boneT: {name:[dx,dy,dz]}, boneS: {name:[sx,sy,sz]}, morph: {name: w} }
  computeJoints(pose) {
    const W = new Array(this.nodes.length);
    const world = (i) => { if (W[i]) return W[i]; const n = this.nodes[i];
      let r = n.r, t = n.t, s = n.s;
      const dq = pose.bones[n.name]; if (dq) r = Q.mul(r, dq);
      const dt = pose.boneT && pose.boneT[n.name]; if (dt) t = [t[0]+dt[0], t[1]+dt[1], t[2]+dt[2]];
      const ds = pose.boneS && pose.boneS[n.name]; if (ds) s = [s[0]*ds[0], s[1]*ds[1], s[2]*ds[2]];
      const l = M.trs(t, r, s); W[i] = n.parent >= 0 ? M.mul(world(n.parent), l) : l; return W[i]; };
    const out = new Float32Array(28*16);
    const hipsIdx = this.joints.indexOf(this.byName['Hips'].i);
    const jm = this.joints.map((ji, k) => M.mul(world(ji), this.ibm.subarray(k*16, k*16+16)));
    this.joints.forEach((ji, k) => {
      // body + shackle are bound rigidly to neutral_bone: make them follow the hips (chest-ish) instead
      const m = this.nodes[ji].name === 'neutral_bone' ? (pose.bodyMatrix || jm[hipsIdx]) : jm[k];
      out.set(m, k*16); });
    this.W = W; this.jm = jm; this.hipsIdx = hipsIdx;
    // shackle secondary motion: its own rotation (pose.shackle = quat) about its base, on top of the hips
    this.Jsh = null;
    if (pose.shackle) { const P = [0, 1.0, 0], nk = this.joints.findIndex(ji => this.nodes[ji].name === 'neutral_bone');
      const R = M.mul(M.mul(M.trs(P, [0,0,0,1], [1,1,1]), M.trs([0,0,0], pose.shackle, [1,1,1])), M.trs([-P[0], -P[1], -P[2]], [0,0,0,1], [1,1,1]));
      this.Jsh = new Float32Array(out); this.Jsh.set(M.mul(jm[hipsIdx], R), nk * 16); }
    return out;
  }

  applyMorphs(pr, morph) {
    if (!pr.targets.length) return;
    const ws = pr.names.map(n => morph[n] || 0); const key = ws.map(w => w.toFixed(4)).join(',');
    if (key === pr.lastW) return; pr.lastW = key;
    const P = new Float32Array(pr.pos), N = new Float32Array(pr.nrm);
    ws.forEach((w, ti) => { if (Math.abs(w) < 1e-4) return; const t = pr.targets[ti];
      for (let i = 0; i < P.length; i++) P[i] += w * t.p[i];
      if (t.n) for (let i = 0; i < N.length; i++) N[i] += w * t.n[i]; });
    const gl = this.gl; gl.bindBuffer(gl.ARRAY_BUFFER, pr.pb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, P);
    gl.bindBuffer(gl.ARRAY_BUFFER, pr.nb); gl.bufferSubData(gl.ARRAY_BUFFER, 0, N);
  }

  render(st) {
    const gl = this.gl, W = this.cv.width, H = this.cv.height;
    gl.viewport(0, 0, W, H);
    const bg = st.bg;
    gl.disable(gl.DEPTH_TEST); gl.disable(gl.BLEND);
    // background
    gl.useProgram(this.bgProg.p); gl.uniform3fv(this.bgProg.u.uBg, bg); gl.uniform2f(this.bgProg.u.uRes, W, H);
    gl.bindVertexArray(null); gl.bindBuffer(gl.ARRAY_BUFFER, this.quad);
    let la = gl.getAttribLocation(this.bgProg.p, 'aP'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    const proj = M.persp(st.cam.fov*Math.PI/180, W/H, 0.05, 100);
    const view = M.lookAt(st.cam.pos, st.cam.target, [0,1,0]);
    const VP = M.mul(proj, view); this.VP = VP;
    // contact shadow on the floor
    if (st.shadow && st.shadow.a > 0.001) {
      gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);
      gl.useProgram(this.shProg.p); const u = this.shProg.u;
      gl.uniformMatrix4fv(u.uVP, false, VP); gl.uniform3fv(u.uC, st.shadow.c); gl.uniform2fv(u.uR, st.shadow.r); gl.uniform1f(u.uA, st.shadow.a);
      la = gl.getAttribLocation(this.shProg.p, 'aP'); gl.enableVertexAttribArray(la); gl.vertexAttribPointer(la, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4); gl.disable(gl.BLEND);
    }
    // character
    gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL); gl.clear(gl.DEPTH_BUFFER_BIT);
    gl.disable(gl.CULL_FACE);
    const p = this.prog, u = p.u; gl.useProgram(p.p);
    const J = this.computeJoints(st.pose);
    gl.uniformMatrix4fv(u.uJ, false, J);
    gl.uniformMatrix4fv(u.uVP, false, VP);
    gl.uniformMatrix4fv(u.uRoot, false, st.root);
    gl.uniform3fv(u.uSqPivot, st.sq.pivot); gl.uniform3fv(u.uSqScale, st.sq.scale);
    gl.uniform1f(u.uGlassZ, st.glass.z); gl.uniform1f(u.uGlassOn, st.glass.on ? 1 : 0); gl.uniform2fv(u.uGlassC, st.glass.c);
    gl.uniform3fv(u.uEye, st.cam.pos); gl.uniform3fv(u.uBg, bg); gl.uniform1f(u.uFlash, st.flash||0);
    const draw = (pr) => {
      this.applyMorphs(pr, st.pose.morph);
      const m = pr.mat, pb = m.pbrMetallicRoughness || {};
      const bc = pb.baseColorFactor || [1,1,1,1];
      gl.uniform4fv(u.uBase, bc); gl.uniform1f(u.uRough, pb.roughnessFactor !== undefined ? pb.roughnessFactor : 0.6);
      const layer = { Eyes: 0.0012, Expressions: 0.0024, Mouth: 0.0040 }[m.name] || 0.0;
      gl.uniform1f(u.uLayer, layer);
      if (pb.baseColorTexture) { gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, this.tex[pb.baseColorTexture.index]); gl.uniform1i(u.uTex, 0); gl.uniform1f(u.uHasTex, 1); }
      else gl.uniform1f(u.uHasTex, 0);
      gl.uniform1f(u.uAlphaMode, m.alphaMode === 'BLEND' ? 1 : 0);
      const sh = this.Jsh && pr.node === 'ShackleMinus';
      if (sh) gl.uniformMatrix4fv(u.uJ, false, this.Jsh);
      gl.bindVertexArray(pr.vao); gl.drawElements(gl.TRIANGLES, pr.count, pr.itype, 0);
      if (sh) gl.uniformMatrix4fv(u.uJ, false, J); };
    this.prims.filter(pr => pr.mat.alphaMode !== 'BLEND').forEach(draw);
    gl.enable(gl.BLEND); gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA); gl.depthMask(false);
    this.prims.filter(pr => pr.mat.alphaMode === 'BLEND').forEach(draw);
    gl.depthMask(true); gl.disable(gl.BLEND); gl.bindVertexArray(null);
  }
  project(p) { const c = M.xf(this.VP, p); return [(c[0]*0.5+0.5)*this.cv.width, (0.5-c[1]*0.5)*this.cv.height, c[2]]; }
}
window.Engine = Engine; window.M = M; window.Q = Q; window.V = V;
