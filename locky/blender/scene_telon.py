# "El telón" props for build_scene.py (exec'd with its globals: bpy, sc, arm, meshes, D, FR, v3, cam, floor ...)
# Curtain = cloth sim pinned to an invisible rail; Locky + floor collide with it.  Rope follows his hands.
import bmesh, math
import numpy as np
from mathutils import Vector, Matrix, Euler

FPS = D['fps']
T = None
def fr_of(t): return int(round(t * FPS))
CUT2 = 6.1

def velvet(name, base=(0.36, 0.012, 0.03)):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (*base, 1); b.inputs['Roughness'].default_value = 0.72
    b.inputs['Sheen Weight'].default_value = 1.0; b.inputs['Sheen Roughness'].default_value = 0.35
    b.inputs['Sheen Tint'].default_value = (1.0, 0.42, 0.45, 1)
    return m

def gold(name):
    m = bpy.data.materials.new(name); m.use_nodes = True
    b = m.node_tree.nodes['Principled BSDF']
    b.inputs['Base Color'].default_value = (0.85, 0.55, 0.12, 1); b.inputs['Metallic'].default_value = 0.6; b.inputs['Roughness'].default_value = 0.4
    return m

def link(o): sc.collection.objects.link(o); return o

def setup():
    global rail, curtain, mixmod, rope, tassel, discs, hood, hood_fly, coll_mods
    sc.render.fps = FPS; sc.frame_start = 0; sc.frame_end = len(FR) - 2
    # ---------------- rail (invisible empty the curtain hangs from)
    rail = link(bpy.data.objects.new('Rail', None)); rail.location = (0, 0.7, 4.0); rail.rotation_mode = 'XYZ'
    # ---------------- curtain: pleated grid 8 x 4.2 m, top row pinned
    W, H, NX, NY = 8.4, 4.25, 110, 56
    me = bpy.data.meshes.new('Curtain'); bm = bmesh.new()
    vs = [[bm.verts.new((-W / 2 + W * i / NX, 0.075 * math.sin(2 * math.pi * (W * i / NX) / 0.34), -H * j / NY)) for i in range(NX + 1)] for j in range(NY + 1)]
    for j in range(NY):
        for i in range(NX): bm.faces.new((vs[j][i], vs[j][i + 1], vs[j + 1][i + 1], vs[j + 1][i]))
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    curtain = link(bpy.data.objects.new('Curtain', me)); curtain.parent = rail
    vg = curtain.vertex_groups.new(name='pin'); vg.add([i for i in range(NX + 1)], 1.0, 'REPLACE')
    me.materials.append(velvet('Velvet'))
    # dynamic un-pinning: weight mix sets 'pin' to 0 when its influence is keyed to 1
    mixmod = curtain.modifiers.new('Unpin', 'VERTEX_WEIGHT_MIX')
    mixmod.vertex_group_a = 'pin'; mixmod.default_weight_b = 0.0; mixmod.mix_mode = 'SET'; mixmod.mix_set = 'A'; mixmod.mask_constant = 0.0
    cl = curtain.modifiers.new('Cloth', 'CLOTH'); cs = cl.settings
    cs.quality = 7; cs.mass = 0.55; cs.air_damping = 1.2
    cs.tension_stiffness = 30; cs.compression_stiffness = 30; cs.shear_stiffness = 8; cs.bending_stiffness = 1.2
    cs.vertex_group_mass = 'pin'; cs.pin_stiffness = 1.0
    cc = cl.collision_settings; cc.collision_quality = 4; cc.distance_min = 0.012
    cc.use_self_collision = True; cc.self_distance_min = 0.008
    cl.point_cache.frame_start = 0; cl.point_cache.frame_end = len(FR) - 1   # keeps simulating after the cut: the empty mound collapses
    curtain.modifiers.new('Thick', 'SOLIDIFY').thickness = 0.008
    sd = curtain.modifiers.new('Smooth', 'SUBSURF'); sd.levels = 0; sd.render_levels = 1
    # ---------------- colliders: Locky (until the cut) and the floor (holdout so nothing shows below it)
    coll_mods = []
    for o in meshes:
        if o.name in ('LockyBody', 'HandsFeet', 'ShackleMinus'):
            o.modifiers.new('Collision', 'COLLISION'); o.collision.thickness_outer = 0.025; o.collision.damping = 0.4; coll_mods.append(o)
    bpy.ops.mesh.primitive_plane_add(size=30, location=(0, 0, -0.001)); fl = bpy.context.active_object; fl.name = 'FloorCollider'
    fl.modifiers.new('Collision', 'COLLISION'); fl.collision.thickness_outer = 0.01; fl.collision.cloth_friction = 12
    hm = bpy.data.materials.new('Holdout'); hm.use_nodes = True; nt = hm.node_tree
    for n in list(nt.nodes):
        if n.type != 'OUTPUT_MATERIAL': nt.nodes.remove(n)
    nt.links.new(nt.nodes.new('ShaderNodeHoldout').outputs[0], nt.nodes['Material Output'].inputs['Surface']); fl.data.materials.append(hm)
    # ---------------- gold rope (2-point bezier, keyed per frame) + tassel
    cu = bpy.data.curves.new('Rope', 'CURVE'); cu.dimensions = '3D'; cu.bevel_depth = 0.022; cu.bevel_resolution = 4
    spl = cu.splines.new('BEZIER'); spl.bezier_points.add(1)
    for bp in spl.bezier_points: bp.handle_left_type = bp.handle_right_type = 'FREE'
    rope = link(bpy.data.objects.new('Rope', cu)); cu.materials.append(gold('Gold'))
    bpy.ops.mesh.primitive_cone_add(radius1=0.06, radius2=0.025, depth=0.16, location=(0, 0, 0)); tassel = bpy.context.active_object; tassel.name = 'Tassel'
    tassel.data.materials.append(bpy.data.materials['Gold'])
    # ---------------- dizzy spiral eyes: discs with a procedural spiral, parented to Hips
    N = 256; yy, xx = np.mgrid[-1:1:N * 1j, -1:1:N * 1j]; rr = np.hypot(xx, yy); th = np.arctan2(yy, xx)
    line = (np.sin(rr * 9 * math.pi - th * 2) > 0.35) & (rr < 0.95)
    rgba = np.ones((N, N, 4), np.float32); rgba[line, :3] = 0.03; rgba[rr > 0.98, 3] = 0.0
    edge = (rr > 0.9) & (rr <= 0.98); rgba[edge, :3] = 0.03
    img = bpy.data.images.new('Spiral', N, N, alpha=True); img.pixels.foreach_set(rgba.ravel()); img.pack()
    sm_ = bpy.data.materials.new('Spiral'); sm_.use_nodes = True; nt = sm_.node_tree; b = nt.nodes['Principled BSDF']
    tx = nt.nodes.new('ShaderNodeTexImage'); tx.image = img
    nt.links.new(tx.outputs['Color'], b.inputs['Base Color']); nt.links.new(tx.outputs['Alpha'], b.inputs['Alpha']); b.inputs['Roughness'].default_value = 0.5
    sm_.surface_render_method = 'BLENDED'
    eyes = next(o for o in meshes if o.name == 'Eyes')
    co = np.array([v.co[:] for v in eyes.data.vertices]); mi = np.array([p.material_index for p in eyes.data.polygons])
    eye_v = set(i for p in eyes.data.polygons if p.material_index == 0 for i in p.vertices)
    pts = co[sorted(eye_v)]; front = pts[:, 1].min()
    discs = []
    for side in (1, -1):
        s = pts[pts[:, 0] * side > 0.05]; cx, cz = s[:, 0].mean(), np.median(s[:, 2])
        bpy.ops.mesh.primitive_circle_add(vertices=32, radius=0.085, fill_type='NGON', location=(cx, front - 0.012, cz), rotation=(math.pi / 2, 0, 0))
        d = bpy.context.active_object; d.name = f'SpiralEye_{"L" if side > 0 else "R"}'
        uv = d.data.uv_layers.new(name='UVMap').data
        for li, l in enumerate(d.data.loops):
            v = d.data.vertices[l.vertex_index].co; uv[li].uv = (0.5 + v.x / 0.17, 0.5 + v.y / 0.17)
        d.data.materials.append(sm_)
        mw = d.matrix_world.copy(); d.parent = arm; d.parent_type = 'BONE'; d.parent_bone = 'Hips'; d.matrix_world = mw
        d.rotation_mode = 'XYZ'; discs.append(d)
    # ---------------- hood: draped velvet cap over the shackle, parented to Hips; a copy flies away on the throw
    hood = make_hood('Hood'); hood_fly = make_hood('HoodFly'); hood_fly.parent = None
    hood_fly.modifiers.new('Flutter', 'WAVE').height = 0.05

def make_hood(name):
    me = bpy.data.meshes.new(name); bm = bmesh.new(); n = 26
    def ssx(a, b, x): u = min(1, max(0, (x - a) / (b - a))); return u * u * (3 - 2 * u)
    grid = []
    for j in range(n + 1):
        row = []
        for i in range(n + 1):
            u = -1 + 2 * i / n; v = -1 + 2 * j / n                     # u: sides, v: front(-1) .. back(+1)
            z = 1.44 - 0.26 * u * u - 0.62 * ssx(0.7, 1.0, abs(u)) - 0.05 * v * v - 0.5 * ssx(0.25, 1.0, v)
            z += 0.022 * math.sin(9 * u + 2 * v) * (0.4 + abs(u))
            row.append(bm.verts.new((0.5 * u, 0.36 * v, z)))
        grid.append(row)
    for j in range(n):
        for i in range(n): bm.faces.new((grid[j][i], grid[j][i + 1], grid[j + 1][i + 1], grid[j + 1][i]))
    bm.to_mesh(me); bm.free()
    for p in me.polygons: p.use_smooth = True
    o = link(bpy.data.objects.new(name, me)); me.materials.append(bpy.data.materials['Velvet'])
    o.modifiers.new('Thick', 'SOLIDIFY').thickness = 0.012
    s = o.modifiers.new('Smooth', 'SUBSURF'); s.levels = 1; s.render_levels = 2
    mw = o.matrix_world.copy(); o.parent = arm; o.parent_type = 'BONE'; o.parent_bone = 'Hips'; o.matrix_world = mw
    o.rotation_mode = 'XYZ'
    return o

_prev = {}
def key_vis(o, vis, fr):
    if _prev.get(o.name) != vis:
        o.hide_render = not vis; o.hide_viewport = False; o.keyframe_insert('hide_render', frame=fr); _prev[o.name] = vis

def per_frame(f, fr):
    pr = f['props']
    # rail + un-pinning
    rl = pr['rail']; rail.location = (0, -rl['z'], rl['y']); rail.rotation_euler = (rl['tilt'], 0, 0)
    rail.keyframe_insert('location', frame=fr); rail.keyframe_insert('rotation_euler', frame=fr)
    mixmod.mask_constant = 1 - pr['pins']; mixmod.keyframe_insert('mask_constant', frame=fr)
    # Locky stops pushing the cloth at the cut (heap stays as it is)
    for o in coll_mods:
        if _prev.get('coll_' + o.name) != pr['collide']:
            o.collision.use = bool(pr['collide']); o.collision.keyframe_insert('use', frame=fr); _prev['coll_' + o.name] = pr['collide']
    # rope: top on the rail (falls with it), bottom in his hands while grabbing, else hanging / dropped
    top = Vector((1.5, -0.1, rl['y'] - 0.35)) if pr['pins'] > 0.5 else Vector((1.35, -0.4, 0.05))
    if pr['grab']:
        h = (v3(f['hands']['L']) + v3(f['hands']['R'])) / 2; bot = h + Vector((0, 0, -0.04))
    else:
        bot = Vector((top.x + 0.02 * math.sin(f['t'] * 2.1), top.y, max(0.06, top.z - 2.65)))
        if pr['pins'] < 0.5: bot = Vector((1.75, -0.6, 0.05))
    sp = rope.data.splines[0].bezier_points
    sp[0].co = top; sp[1].co = bot
    mid = (top + bot) / 2; sag = Vector((0, 0, -0.08 if pr['grab'] else 0))
    sp[0].handle_left = top + (top - mid) * 0.3; sp[0].handle_right = top + (mid - top) * 0.6 + sag
    sp[1].handle_left = bot + (mid - bot) * 0.6 + sag; sp[1].handle_right = bot + (bot - mid) * 0.3
    for bp in sp:
        for prop in ('co', 'handle_left', 'handle_right'): bp.keyframe_insert(prop, frame=fr)
    tassel.location = bot + Vector((0, 0, -0.07)); tassel.keyframe_insert('location', frame=fr)
    # spiral eyes
    s = pr['spiral']
    for d in discs:
        d.scale = (s['on'],) * 3; d.rotation_euler[1] = s['angle'] * (1 if d.name.endswith('L') else -1)
        d.keyframe_insert('scale', frame=fr); d.keyframe_insert('rotation_euler', frame=fr)
    key_vis(hood, bool(pr['hood']['on'] and not pr['hood']['thrown']), fr)
    key_vis(hood_fly, bool(pr['hood']['thrown']), fr)

def finalize():
    # hood flight: start exactly where the worn hood is on the throw frame, fly out to the left, spinning, opening up
    tf = fr_of(FR[0]['props']['throwT'])
    sc.frame_set(tf); mw = hood.matrix_world.copy()
    loc0, rot0, scl0 = mw.decompose()
    hood_fly.rotation_mode = 'XYZ'
    for k in range(0, 46):
        u = k / 45; fr = tf + k
        hood_fly.location = loc0 + Vector((-3.2 * u, 0.4 * u, 0.9 * u - 0.9 * u * u))
        e = rot0.to_euler('XYZ'); hood_fly.rotation_euler = (e.x + 1.2 * u, e.y + 4.5 * u, e.z + 0.8 * u)
        hood_fly.scale = (1 + 0.5 * u, 1 + 0.2 * u, 1 - 0.45 * u)
        for p in ('location', 'rotation_euler', 'scale'): hood_fly.keyframe_insert(p, frame=fr)
    # bake the cloth (Locky + rail animation are keyed by now)
    sc.frame_set(0)
    with bpy.context.temp_override(scene=sc):
        bpy.ops.ptcache.bake_all(bake=True)
    print('cloth baked')
