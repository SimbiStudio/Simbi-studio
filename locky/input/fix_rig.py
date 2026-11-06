# Re-skins Locky's legs/feet (HandsFeet "Legs" primitive) with clean, rigid segments and writes
# LockyBase2026_rigfix.glb next to the original.  Same vertices, same bones, same buffer layout:
# only JOINTS_0 / WEIGHTS_0 of the leg vertices change, so both renderers just load the new file.
#
# Original problems (measured): every sole vertex was ~50/50 Ankle/Toes whatever its position,
# the heel took 25-50% shin, LowerLeg influence ran from the floor to the hip and the top of the
# thigh was ~50% Hips -> the foot squashed like rubber and the leg bent like a noodle.
#
# New weights (glTF space: y up, +z forward), per leg:
#   Hips    <- top of the leg tube hidden inside the body  (y 0.255 -> 0.29)
#   UpperLeg / LowerLeg  short blend around the knee        (y 0.205 -> 0.17, knee at 0.188)
#   LowerLeg / foot      short blend above the ankle        (y 0.115 -> 0.07, ankle at 0.047)
#   foot: Ankle (heel + arch) / Toes (front) around the ball (z 0.07 -> 0.13, ball at 0.10)
#   usage: python3 fix_rig.py
import json, struct, pathlib
import numpy as np

HERE = pathlib.Path(__file__).resolve().parent
SRC, DST = HERE / 'LockyBase2026.glb', HERE / 'LockyBase2026_rigfix.glb'
raw = bytearray(SRC.read_bytes())
jl = struct.unpack('<I', raw[12:16])[0]; j = json.loads(raw[20:20 + jl]); bin0 = 20 + jl + 8

def view(acc_i, dtype, ncomp):
    a = j['accessors'][acc_i]; bv = j['bufferViews'][a['bufferView']]
    off = bin0 + bv.get('byteOffset', 0) + a.get('byteOffset', 0)
    stride = bv.get('byteStride', 0); size = np.dtype(dtype).itemsize * ncomp
    assert stride in (0, size), 'interleaved buffers not supported'
    return off, a['count']

def ss(e0, e1, x):
    u = np.clip((x - e0) / (e1 - e0), 0, 1); return u * u * (3 - 2 * u)

J = {j['nodes'][ji]['name']: k for k, ji in enumerate(j['skins'][0]['joints'])}
node = next(nd for nd in j['nodes'] if nd['name'] == 'HandsFeet')
mesh = j['meshes'][node['mesh']]
done = 0
for p in mesh['primitives']:
    if j['materials'][p['material']]['name'] != 'Legs': continue
    po, n = view(p['attributes']['POSITION'], np.float32, 3)
    P = np.frombuffer(bytes(raw[po:po + n * 12]), np.float32).reshape(n, 3)
    jo, _ = view(p['attributes']['JOINTS_0'], np.uint8, 4)
    wo, _ = view(p['attributes']['WEIGHTS_0'], np.float32, 4)
    assert j['accessors'][p['attributes']['JOINTS_0']]['componentType'] == 5121
    joints = np.frombuffer(bytes(raw[jo:jo + n * 4]), np.uint8).reshape(n, 4).copy()
    weights = np.frombuffer(bytes(raw[wo:wo + n * 16]), np.float32).reshape(n, 4).copy()
    x, y, z = P[:, 0], P[:, 1], P[:, 2]
    hips = ss(0.255, 0.29, y)
    lower = ss(0.205, 0.17, y)
    foot = ss(0.115, 0.07, y)
    toes = ss(0.07, 0.13, z)
    for side, sel in (('L', x > 0), ('R', x <= 0)):
        idx = np.where(sel)[0]
        w = np.stack([hips, (1 - hips) * (1 - lower), (1 - hips) * lower * (1 - foot),
                      (1 - hips) * lower * foot * (1 - toes), (1 - hips) * lower * foot * toes], 1)[idx]
        names = ['Hips', f'UpperLeg_{side}', f'LowerLeg_{side}', f'Ankle_{side}', f'Toes_{side}']
        for r, vi in enumerate(idx):
            order = np.argsort(-w[r])[:4]; ww = w[r][order]; ww = np.where(ww < 0.005, 0, ww); ww /= ww.sum()
            joints[vi] = [J[names[k]] if ww[q] > 0 else 0 for q, k in enumerate(order)]
            weights[vi] = ww
    raw[jo:jo + n * 4] = joints.tobytes(); raw[wo:wo + n * 16] = weights.astype(np.float32).tobytes()
    done += n
assert done, 'Legs primitive not found'
DST.write_bytes(bytes(raw))
print('re-skinned', done, 'leg vertices ->', DST)
