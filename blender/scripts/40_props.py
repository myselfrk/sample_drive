exec(open(os.path.expanduser("~/Desktop/SignalDrive/blender/scripts/00_common.py")).read()) if "principled" not in globals() else None

new_collection("PropsCol")

# ---------------- Tree -----------------------------------------------------------------------
tree = empty("Tree"); tree.location = (0, 40, 0)
bark = mat("Bark", (0.12, 0.07, 0.04), rough=0.9)
leaf = mat("Leaves", (0.06, 0.16, 0.04), rough=0.8)
leaf2 = mat("LeavesLight", (0.12, 0.26, 0.05), rough=0.8)

bpy.ops.mesh.primitive_cone_add(vertices=12, radius1=0.20, radius2=0.10, depth=2.6, location=(0, 0, 1.3))
tr = bpy.context.active_object; tr.name = "Trunk"; tr.data.materials.append(bark); tr.parent = tree
smooth(tr)

clouds = bpy.data.textures.new("LeafClouds", "CLOUDS"); clouds.noise_scale = 0.9
rng = np.random.default_rng(11)
for i, (loc, r, m) in enumerate((((0, 0, 3.4), 1.55, leaf), ((0.7, 0.25, 3.0), 1.1, leaf2), ((-0.6, -0.3, 3.9), 1.2, leaf2), ((0.1, -0.6, 3.2), 1.0, leaf))):
    bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=3, radius=r, location=loc)
    c = bpy.context.active_object; c.name = f"Canopy_{i}"; c.data.materials.append(m); c.parent = tree
    d = c.modifiers.new("Displace", "DISPLACE"); d.texture = clouds; d.strength = 0.38; d.mid_level = 0.5
    c.scale = (1, 1, 0.85); apply_mods(c); smooth(c, 60)
    # decimate the dense ico so the tree stays light
    dm = c.modifiers.new("Dec", "DECIMATE"); dm.ratio = 0.35; apply_mods(c)
for o in tree.children_recursive:
    if o.name.startswith("Canopy"):
        o.rotation_euler[2] = rng.random() * 6.28

# ---------------- Streetlight ----------------------------------------------------------------
sl = empty("Streetlight"); sl.location = (0, 50, 0)
pole = mat("LightPole", (0.10, 0.11, 0.12), metallic=0.7, rough=0.5)
lampm = mat("StreetLamp", (1, 0.85, 0.6), rough=0.3, emission=(1, 0.82, 0.55), emit_strength=3.0)
hous = mat("LampHousing", (0.05, 0.05, 0.06), metallic=0.5, rough=0.5)
cyl("Pole", (0, 0, 3.5), 0.075, 7.0, pole, sl, verts=16)
cyl("Foot", (0, 0, 0.12), 0.16, 0.24, pole, sl, verts=16)
# curved arm: quarter arc from the pole top toward +Y (towards the road when placed on the -Y side)
cu = bpy.data.curves.new("ArmCurve", "CURVE"); cu.dimensions = "3D"; cu.bevel_depth = 0.05; cu.bevel_resolution = 3
sp = cu.splines.new("POLY"); arc = [(0, 1.8 * s, 7.0 + 0.45 * (1 - (1 - s) ** 2) * (1 - 0.0)) for s in np.linspace(0, 1, 10)]
sp.points.add(len(arc) - 1)
for p, (x, y, z) in zip(sp.points, arc): p.co = (x, y, z, 1)
arm = bpy.data.objects.new("Arm", cu); link(arm, sl); arm.data.materials.append(pole)
bpy.ops.object.select_all(action="DESELECT"); bpy.context.view_layer.objects.active = arm; arm.select_set(True)
bpy.ops.object.convert(target="MESH"); arm = bpy.context.active_object; arm.name = "Arm"; arm.parent = sl
ez = arc[-1][2]
box("LampHead", (0, 1.95, ez + 0.02), (0.55, 0.95, 0.14), hous, sl, 0.04)
box("LampLens", (0, 1.95, ez - 0.06), (0.46, 0.80, 0.03), lampm, sl, 0.01)
print("props built")
