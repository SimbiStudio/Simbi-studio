# Builds the production Blender scene for "Locky - El choque" v2 from anim_frames.json.
#   blender -b --python build_scene.py -- [anim_frames.json] [out.blend]
# Every value comes from build/anim.js (exported by export_anim.js), so the Blender render and the
# WebGL preview share one choreography.  Coordinates: glTF (Y up, +Z to camera) -> Blender (Z up, -Y to camera).
import bpy, json, math, sys, pathlib
from mathutils import Matrix, Vector, Quaternion

HERE = pathlib.Path(__file__).resolve().parent
argv = sys.argv[sys.argv.index('--') + 1:] if '--' in sys.argv else []
DATA = pathlib.Path(argv[0]) if len(argv) > 0 else HERE / 'anim_frames.json'
OUT = pathlib.Path(argv[1]) if len(argv) > 1 else HERE / 'locky_v2.blend'
GLB = HERE.parent / 'input' / 'LockyBase2026.glb'
D = json.loads(DATA.read_text())
FR = D['frames']

C = Matrix(((1, 0, 0, 0), (0, 0, -1, 0), (0, 1, 0, 0), (0, 0, 0, 1)))   # glTF -> Blender
Ci = C.inverted()
def v3(p): return Vector((p[0], -p[2], p[1]))
def mat(a):  # column-major JS Float32Array -> Matrix
    return Matrix([[a[c * 4 + r] for c in range(4)] for r in range(4)])

# ---------------------------------------------------------------- scene + import
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.preferences.edit.keyframe_new_interpolation_type = 'LINEAR'
bpy.ops.import_scene.gltf(filepath=str(GLB))
sc = bpy.context.scene
arm = next(o for o in sc.objects if o.type == 'ARMATURE')
for o in list(sc.objects):
    if o.type == 'MESH' and o.parent is None:      # importer's bone-shape icosphere
        bpy.data.objects.remove(o)
meshes = [o for o in sc.objects if o.type == 'MESH']
body_parts = [o for o in meshes if o.name in ('LockyBody', 'ShackleMinus')]

# rigid body + shackle follow Hips (as in Engine.computeJoints). The v1 engine ignores their glTF node
# transform (x2.162 scale + offset) and draws the raw vertices, which is what lines up with eyes/mouth.
for o in body_parts:
    mw = arm.matrix_world.copy()
    o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = 'Hips'
    o.matrix_world = mw

# squash & stretch: armature hangs from an empty placed at the squash pivot
sq = bpy.data.objects.new('Squash', None); sc.collection.objects.link(sq)
arm.parent = sq; arm.matrix_parent_inverse = Matrix.Identity(4)
arm.rotation_mode = 'XYZ'

# glass plane marker read by the GlassPress node group (location = contact centre, scale.x = on/off)
glass = bpy.data.objects.new('Glass', None); sc.collection.objects.link(glass)
glass.empty_display_type = 'PLAIN_AXES'

# ---------------------------------------------------------------- GlassPress geometry nodes
def glass_group():
    ng = bpy.data.node_groups.new('GlassPress', 'GeometryNodeTree')
    io = ng.interface
    io.new_socket('Geometry', in_out='INPUT', socket_type='NodeSocketGeometry')
    io.new_socket('Glass', in_out='INPUT', socket_type='NodeSocketObject')
    io.new_socket('Layer0', in_out='INPUT', socket_type='NodeSocketFloat')
    io.new_socket('Layer1', in_out='INPUT', socket_type='NodeSocketFloat')
    io.new_socket('Geometry', in_out='OUTPUT', socket_type='NodeSocketGeometry')
    N, L = ng.nodes, ng.links
    gi = N.new('NodeGroupInput'); go = N.new('NodeGroupOutput')
    selfo = N.new('GeometryNodeSelfObject')
    me = N.new('GeometryNodeObjectInfo'); me.transform_space = 'ORIGINAL'
    L.new(selfo.outputs[0], me.inputs['Object'])
    gl = N.new('GeometryNodeObjectInfo'); gl.transform_space = 'ORIGINAL'
    L.new(gi.outputs['Glass'], gl.inputs['Object'])
    inv = N.new('FunctionNodeInvertMatrix'); L.new(me.outputs['Transform'], inv.inputs[0])
    pos = N.new('GeometryNodeInputPosition')
    tw = N.new('FunctionNodeTransformPoint'); L.new(pos.outputs[0], tw.inputs['Vector']); L.new(me.outputs['Transform'], tw.inputs['Transform'])
    sp = N.new('ShaderNodeSeparateXYZ'); L.new(tw.outputs[0], sp.inputs[0])
    gls = N.new('ShaderNodeSeparateXYZ'); L.new(gl.outputs['Location'], gls.inputs[0])
    glsc = N.new('ShaderNodeSeparateXYZ'); L.new(gl.outputs['Scale'], glsc.inputs[0])
    def m(op, a, b=None, c=None):
        n = N.new('ShaderNodeMath'); n.operation = op
        for k, x in enumerate((a, b, c)):
            if x is None: continue
            if isinstance(x, (int, float)): n.inputs[k].default_value = x
            else: L.new(x, n.inputs[k])
        return n.outputs[0]
    x, y, z = sp.outputs[0], sp.outputs[1], sp.outputs[2]
    cx, gy, cz = gls.outputs[0], gls.outputs[1], gls.outputs[2]
    d = m('SUBTRACT', gy, y)                                   # depth past the glass (towards camera)
    dc = m('MULTIPLY', m('MINIMUM', m('MAXIMUM', d, 0.0), 0.13), 2.6)
    nx = m('ADD', x, m('MULTIPLY', m('SUBTRACT', x, cx), dc))
    nz = m('ADD', z, m('MULTIPLY', m('SUBTRACT', z, cz), dc))
    mi = N.new('GeometryNodeInputMaterialIndex')
    is0 = m('LESS_THAN', mi.outputs[0], 0.5)
    lay = m('ADD', m('MULTIPLY', is0, gi.outputs['Layer0']), m('MULTIPLY', m('SUBTRACT', 1.0, is0), gi.outputs['Layer1']))
    ny = m('SUBTRACT', m('SUBTRACT', gy, m('MULTIPLY', d, 0.015)), lay)
    cb = N.new('ShaderNodeCombineXYZ'); L.new(nx, cb.inputs[0]); L.new(ny, cb.inputs[1]); L.new(nz, cb.inputs[2])
    tl = N.new('FunctionNodeTransformPoint'); L.new(cb.outputs[0], tl.inputs['Vector']); L.new(inv.outputs[0], tl.inputs['Transform'])
    sel = m('MULTIPLY', m('GREATER_THAN', d, 0.0), m('GREATER_THAN', glsc.outputs[0], 0.5))
    setp = N.new('GeometryNodeSetPosition')
    L.new(gi.outputs['Geometry'], setp.inputs['Geometry']); L.new(sel, setp.inputs['Selection']); L.new(tl.outputs[0], setp.inputs['Position'])
    L.new(setp.outputs[0], go.inputs[0])
    return ng
GP = glass_group()
LAYERS = {'Eyes': 0.0012, 'Expressions': 0.0024, 'Mouth': 0.0040}
for o in meshes:
    mod = o.modifiers.new('GlassPress', 'NODES'); mod.node_group = GP
    ids = {s.name: s.identifier for s in GP.interface.items_tree if getattr(s, 'in_out', '') == 'INPUT'}
    mats = [m.name for m in o.data.materials]
    mod[ids['Glass']] = glass
    mod[ids['Layer0']] = LAYERS.get(mats[0], 0.0) if mats else 0.0
    mod[ids['Layer1']] = LAYERS.get(mats[1], 0.0) if len(mats) > 1 else 0.0

# ---------------------------------------------------------------- materials (toy-plastic look)
for m in bpy.data.materials:
    if not m.node_tree: continue
    b = next((n for n in m.node_tree.nodes if n.type == 'BSDF_PRINCIPLED'), None)
    if not b: continue
    if m.name in ('LockyBody', 'LockyShackle', 'Hands', 'Legs'):
        b.inputs['Coat Weight'].default_value = 0.35
        b.inputs['Coat Roughness'].default_value = 0.18
        b.inputs['Roughness'].default_value = max(0.35, b.inputs['Roughness'].default_value * 0.8)
        b.inputs['Subsurface Weight'].default_value = 0.06
        b.inputs['Subsurface Radius'].default_value = (0.2, 0.25, 0.6)
        b.inputs['Subsurface Scale'].default_value = 0.02
    if m.name in ('Eyes', 'Expressions', 'Mouth'):
        b.inputs['Roughness'].default_value = 0.45
    m.surface_render_method = 'DITHERED' if m.name != 'Eyes' else 'BLENDED'

# ---------------------------------------------------------------- camera, lights, world, floor
cam = bpy.data.objects.new('Camera', bpy.data.cameras.new('Camera')); sc.collection.objects.link(cam); sc.camera = cam
cam.data.sensor_fit = 'VERTICAL'; cam.data.angle_y = math.radians(FR[0]['cam']['fov'])
cam.data.clip_start = 0.05; cam.data.clip_end = 100
cam.rotation_mode = 'QUATERNION'

def sun(name, d_gltf, color, energy, angle):
    l = bpy.data.lights.new(name, 'SUN'); l.color = color; l.energy = energy; l.angle = math.radians(angle)
    o = bpy.data.objects.new(name, l); sc.collection.objects.link(o)
    o.rotation_mode = 'QUATERNION'; o.rotation_quaternion = v3(d_gltf).normalized().to_track_quat('Z', 'Y')
    return o
sun('Key', (-0.55, 0.9, 0.75), (1.0, 0.93, 0.84), 3.6, 18)
sun('Fill', (0.8, 0.25, 0.45), (0.62, 0.68, 1.0), 1.0, 30)
sun('Rim', (0.2, 0.6, -1.0), (0.6, 0.7, 1.0), 4.5, 8)

BG = (0x4E / 255, 0x58 / 255, 0xDA / 255)
def lin(c): return tuple(((x + 0.055) / 1.055) ** 2.4 if x > 0.04045 else x / 12.92 for x in c)
w = bpy.data.worlds.new('World'); sc.world = w; w.use_nodes = True
wn, wl = w.node_tree.nodes, w.node_tree.links
bgn = wn['Background']; tc = wn.new('ShaderNodeTexCoord'); sx = wn.new('ShaderNodeSeparateXYZ'); ramp = wn.new('ShaderNodeValToRGB')
mr = wn.new('ShaderNodeMapRange'); mr.inputs['From Min'].default_value = -1; mr.inputs['From Max'].default_value = 1
wl.new(tc.outputs['Generated'], sx.inputs[0]); wl.new(sx.outputs[2], mr.inputs['Value']); wl.new(mr.outputs[0], ramp.inputs[0])
g = lin(BG); ramp.color_ramp.elements[0].color = (g[0] * 1.4, g[1] * 1.4, g[2] * 1.4, 1)
ramp.color_ramp.elements[1].color = (0.62, 0.70, 1.0, 1)
wl.new(ramp.outputs[0], bgn.inputs['Color']); bgn.inputs['Strength'].default_value = 0.55

bpy.ops.mesh.primitive_plane_add(size=40, location=(0, 0, 0)); floor = bpy.context.active_object; floor.name = 'ShadowCatcher'
floor.is_shadow_catcher = True

# ---------------------------------------------------------------- bake keyframes
names = D['jointNames']
pb = arm.pose.bones
rest = {n: arm.data.bones[n].matrix_local.copy() for n in names}
parent = {n: (arm.data.bones[n].parent.name if arm.data.bones[n].parent else None) for n in names}
for p in pb: p.rotation_mode = 'QUATERNION'
morph_names = sorted({k for f in FR for k, v in f['morph'].items() if v > 1e-4})
key_owner = {}
for o in meshes:
    if o.data.shape_keys:
        for kb in o.data.shape_keys.key_blocks[1:]: key_owner[kb.name] = kb
chars = meshes
prev_vis = None
for fi, f in enumerate(FR):
    fr = fi
    # bones: matrix_basis = rest^-1 * Dparent^-1 * D * rest   (D = skinning delta in armature space)
    Dm = {n: C @ mat(f['joints'][k]) @ Ci for k, n in enumerate(names)}
    for n in names:
        Dp = Dm[parent[n]] if parent[n] else Matrix.Identity(4)
        mb = rest[n].inverted() @ Dp.inverted() @ Dm[n] @ rest[n]
        loc, rot, scl = mb.decompose()
        b = pb[n]; b.location = loc; b.rotation_quaternion = rot; b.scale = scl
        b.keyframe_insert('location', frame=fr); b.keyframe_insert('rotation_quaternion', frame=fr); b.keyframe_insert('scale', frame=fr)
    # root (in squash-pivot space) + squash
    r = f['root']; piv = v3(f['sq']['pivot']); s = f['sq']['scale']
    rot_y = math.atan2(r[8], r[0]) if f['visible'] else 0.0
    arm.location = v3((r[12], r[13], r[14])) - piv; arm.rotation_euler = (0, 0, rot_y)
    arm.keyframe_insert('location', frame=fr); arm.keyframe_insert('rotation_euler', frame=fr)
    sq.location = piv; sq.scale = (s[0], s[2], s[1])
    sq.keyframe_insert('location', frame=fr); sq.keyframe_insert('scale', frame=fr)
    # glass contact
    gz = D['glassZ']; gc = f['glass']['c']
    glass.location = (gc[0], -gz, gc[1]); glass.scale = (1.0 if f['glass']['on'] else 0.0, 1, 1)
    glass.keyframe_insert('location', frame=fr); glass.keyframe_insert('scale', frame=fr)
    # expressions
    for nme in morph_names:
        if nme in key_owner:
            kb = key_owner[nme]; kb.value = min(1.0, f['morph'].get(nme, 0.0)); kb.keyframe_insert('value', frame=fr)
    # camera
    cp, ct = v3(f['cam']['pos']), v3(f['cam']['target'])
    cam.location = cp; cam.rotation_quaternion = (ct - cp).to_track_quat('-Z', 'Y')
    cam.keyframe_insert('location', frame=fr); cam.keyframe_insert('rotation_quaternion', frame=fr)
    # visibility (character leaves frame after sliding down) and floor shadow only while walking
    if f['visible'] != prev_vis:
        for o in chars:
            o.hide_render = not f['visible']; o.keyframe_insert('hide_render', frame=fr)
        prev_vis = f['visible']
    floor.hide_render = f['shadow'] <= 0.001; floor.keyframe_insert('hide_render', frame=fr)

for ad in [o.animation_data for o in sc.objects if o.animation_data] + [o.data.shape_keys.animation_data for o in meshes if o.data.shape_keys and o.data.shape_keys.animation_data]:
    act = ad.action
    if not act: continue
    fcs = act.fcurves if hasattr(act, 'fcurves') else []
    for fc in fcs:
        for k in fc.keyframe_points:
            if fc.data_path != 'hide_render': k.interpolation = 'LINEAR'

# ---------------------------------------------------------------- render settings
sc.frame_start = 0; sc.frame_end = len(FR) - 2          # 0 .. dur*fps-1
sc.render.fps = D['fps']
sc.render.resolution_x, sc.render.resolution_y, sc.render.resolution_percentage = 1920, 1080, 100
sc.render.engine = 'CYCLES'
cy = sc.cycles
cy.device = 'CPU'; cy.samples = 64; cy.adaptive_threshold = 0.02; cy.use_denoising = True; cy.denoiser = 'OPENIMAGEDENOISE'
cy.max_bounces = 6; cy.diffuse_bounces = 3; cy.glossy_bounces = 3; cy.transmission_bounces = 4; cy.transparent_max_bounces = 8
sc.render.film_transparent = True
sc.render.use_motion_blur = True; sc.render.motion_blur_shutter = 0.5
sc.view_settings.view_transform = 'Standard'; sc.view_settings.look = 'None'
sc.render.image_settings.file_format = 'PNG'; sc.render.image_settings.color_mode = 'RGBA'
sc.render.filepath = str(HERE / 'out' / 'f_')
sc.frame_set(0)
bpy.ops.wm.save_as_mainfile(filepath=str(OUT))
print('saved', OUT, 'frames', sc.frame_start, sc.frame_end)
