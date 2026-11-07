# "El último celular" props for build_scene.py (exec'd with its globals: bpy, sc, arm, meshes, D, FR, v3, floor ...)
# Generic giant phone (no brand / UI), screen glow that switches off, buzz jitter, ripples when it goes silent.
import math
from mathutils import Vector

FPS = D['fps']
def link(o): sc.collection.objects.link(o); return o

def mat_principled(name, color, rough=0.3, metal=0.0, coat=0.0):
    m = bpy.data.materials.new(name); m.use_nodes = True; b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*color, 1); b.inputs['Roughness'].default_value = rough
    b.inputs['Metallic'].default_value = metal; b.inputs['Coat Weight'].default_value = coat
    return m

def setup():
    global root, screen_val, rings, ring_alpha
    sc.render.fps = FPS; sc.frame_start = 0; sc.frame_end = len(FR) - 2
    P = FR[0]['props']['phone']
    root = link(bpy.data.objects.new('PhoneRoot', None)); root.rotation_mode = 'XYZ'
    # body: rounded slab, origin at the bottom centre (rotations pivot on the base)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, P['h'] / 2)); body = bpy.context.active_object; body.name = 'Phone'
    body.scale = (P['w'], P['d'], P['h']); bpy.ops.object.transform_apply(scale=True)
    bv = body.modifiers.new('Round', 'BEVEL'); bv.width = 0.05; bv.segments = 6; bv.limit_method = 'ANGLE'
    body.data.materials.append(mat_principled('PhoneBody', (0.02, 0.025, 0.06), 0.25, 0.3, 0.6))
    for p in body.data.polygons: p.use_smooth = True
    body.parent = root
    # screen: rounded inset panel on the front face (-y), emissive gradient, keyed brightness
    bpy.ops.mesh.primitive_plane_add(size=1, location=(0, -P['d'] / 2 - 0.004, P['h'] / 2), rotation=(math.pi / 2, 0, 0))
    scr = bpy.context.active_object; scr.name = 'Screen'; scr.scale = (P['w'] - 0.1, P['h'] - 0.12, 1); bpy.ops.object.transform_apply(scale=True, rotation=True)
    rb = scr.modifiers.new('Corners', 'BEVEL'); rb.affect = 'VERTICES'; rb.width = 0.11; rb.segments = 8
    m = bpy.data.materials.new('ScreenGlow'); m.use_nodes = True; nt = m.node_tree; nl = nt.links
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    tc = nt.nodes.new('ShaderNodeTexCoord'); sx = nt.nodes.new('ShaderNodeSeparateXYZ'); ramp = nt.nodes.new('ShaderNodeValToRGB')
    nl.new(tc.outputs['Generated'], sx.inputs[0]); nl.new(sx.outputs[2], ramp.inputs[0])
    ramp.color_ramp.elements[0].color = (0.30, 0.55, 1.0, 1); ramp.color_ramp.elements[1].color = (0.72, 0.87, 1.0, 1)
    em = nt.nodes.new('ShaderNodeEmission'); nl.new(ramp.outputs[0], em.inputs['Color'])
    val = nt.nodes.new('ShaderNodeValue'); val.outputs[0].default_value = 1.0; screen_val = val
    mul = nt.nodes.new('ShaderNodeMath'); mul.operation = 'MULTIPLY'; mul.inputs[1].default_value = 0.9
    nl.new(val.outputs[0], mul.inputs[0]); nl.new(mul.outputs[0], em.inputs['Strength'])
    glass = nt.nodes.new('ShaderNodeBsdfPrincipled'); glass.inputs['Base Color'].default_value = (0.005, 0.006, 0.012, 1); glass.inputs['Roughness'].default_value = 0.08
    mix = nt.nodes.new('ShaderNodeMixShader'); nl.new(val.outputs[0], mix.inputs[0]); nl.new(glass.outputs[0], mix.inputs[1]); nl.new(em.outputs[0], mix.inputs[2])
    nl.new(mix.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    scr.data.materials.append(m); scr.parent = root
    # front camera: small dark pill at the top of the screen (the spot Locky sits on)
    bpy.ops.mesh.primitive_cylinder_add(radius=0.032, depth=0.11, location=(0, -P['d'] / 2 - 0.007, P['h'] - 0.085), rotation=(0, math.pi / 2, 0))
    cam_pill = bpy.context.active_object; cam_pill.name = 'FrontCam'; cam_pill.scale = (1, 1, 1)
    cam_pill.data.materials.append(mat_principled('Pill', (0.0, 0.0, 0.0), 0.15)); cam_pill.parent = root
    for i, (z, w) in enumerate(((1.35, 0.12), (1.0, 0.22))):        # side buttons
        bpy.ops.mesh.primitive_cube_add(size=1, location=(-P['w'] / 2 - 0.01, 0, P['h'] * z / 2.6 * 1.6))
        bt = bpy.context.active_object; bt.name = f'Button{i}'; bt.scale = (0.03, 0.05, w); bt.data.materials.append(bpy.data.materials['PhoneBody']); bt.parent = root
    # ripples: 3 soft rings around the phone when it goes silent
    rm = bpy.data.materials.new('Ripple'); rm.use_nodes = True; nt = rm.node_tree; nl = nt.links
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    e = nt.nodes.new('ShaderNodeEmission'); e.inputs['Color'].default_value = (0.85, 0.92, 1.0, 1); e.inputs['Strength'].default_value = 1.6
    tr = nt.nodes.new('ShaderNodeBsdfTransparent'); mx = nt.nodes.new('ShaderNodeMixShader')
    av = nt.nodes.new('ShaderNodeValue'); ring_alpha = av
    nl.new(av.outputs[0], mx.inputs[0]); nl.new(tr.outputs[0], mx.inputs[1]); nl.new(e.outputs[0], mx.inputs[2]); nl.new(mx.outputs[0], nt.nodes['Material Output'].inputs['Surface'])
    rm.surface_render_method = 'BLENDED'
    rings = []
    for i in range(3):
        bpy.ops.mesh.primitive_torus_add(major_radius=1.0, minor_radius=0.012, major_segments=96, minor_segments=8,
                                         location=(P['x'], -P['z'] + 0.25, 1.35), rotation=(math.pi / 2, 0, 0))
        r = bpy.context.active_object; r.name = f'Ripple{i}'
        rmi = rm.copy(); r.data.materials.append(rmi); rings.append((r, rmi))

def per_frame(f, fr):
    pr = f['props']; P = pr['phone']
    root.location = (P['x'] + P['jx'], -P['z'], P['y']); root.rotation_euler = (0, P['tilt'] + P['jr'], 0)
    root.keyframe_insert('location', frame=fr); root.keyframe_insert('rotation_euler', frame=fr)
    screen_val.outputs[0].default_value = pr['screen']; screen_val.outputs[0].keyframe_insert('default_value', frame=fr)
    for i, (r, m) in enumerate(rings):
        u = max(0.0, min(1.0, (pr['ripple'] - 0.18 * i) / 1.3)); rad = 0.9 + 2.6 * u
        r.scale = (rad, rad, 1.0 + 0 * u); r.keyframe_insert('scale', frame=fr)
        a = (1 - u) ** 2 * 0.65 if 0 < u < 1 else 0.0
        v = next(n for n in m.node_tree.nodes if n.type == 'VALUE'); v.outputs[0].default_value = a; v.outputs[0].keyframe_insert('default_value', frame=fr)
        r.hide_render = a <= 0.001; r.keyframe_insert('hide_render', frame=fr)
    # shadow catcher stays under the phone + Locky the whole time
    floor.hide_render = False; floor.keyframe_insert('hide_render', frame=fr)
    floor.location = (0.0, 0.3, 0); floor.keyframe_insert('location', frame=fr)
