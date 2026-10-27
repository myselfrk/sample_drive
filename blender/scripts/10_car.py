exec(open(os.path.expanduser("~/Desktop/SignalDrive/blender/scripts/00_common.py")).read()) if "principled" not in globals() else None

new_collection("CarCol")
root = empty("Car")
paint  = mat("CarPaint", (0.55, 0.02, 0.03), metallic=0.9, rough=0.32, coat=1.0)
glass  = mat("Glass", (0.05, 0.07, 0.08), rough=0.05, transmission=0.9, ior=1.5)
trim   = mat("Trim", (0.02, 0.02, 0.02), rough=0.6)
chrome = mat("Chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
tyre   = mat("Tyre", (0.025, 0.025, 0.025), rough=0.9)
disc   = mat("BrakeDisc", (0.25, 0.25, 0.27), metallic=0.8, rough=0.4)
brake  = mat("BrakeLight", (0.35, 0.0, 0.0), rough=0.3, emission=(1, 0.02, 0.02), emit_strength=0.4)
head   = mat("Headlight", (0.9, 0.9, 0.9), rough=0.1, emission=(1, 0.95, 0.85), emit_strength=2.0)
plate  = mat("Plate", (0.9, 0.9, 0.85), rough=0.5)


def loft(name, stations, ring, mats, parent, face_mat=None):
    """stations: [(x, zb, zt, hw)], ring: [(y_frac, z_frac)] right side bottom->top, mirrored for the left."""
    right = ring
    left = [(-y, z) for (y, z) in reversed(ring[1:-1])]
    pts = right + left
    bm = bmesh.new(); rings = []
    for (x, zb, zt, hw) in stations:
        rings.append([bm.verts.new((x, yf * hw, zb + zf * (zt - zb))) for (yf, zf) in pts])
    n = len(pts)
    for i in range(len(rings) - 1):
        for j in range(n):
            k = (j + 1) % n
            bm.faces.new((rings[i][j], rings[i][k], rings[i + 1][k], rings[i + 1][j]))
    bm.faces.new(rings[0]); bm.faces.new(list(reversed(rings[-1])))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    if face_mat:
        for f in bm.faces: f.material_index = face_mat(f.calc_center_median(), f.normal)
    ob = mesh_from_bmesh(name, bm, None, parent)
    for m in mats: ob.data.materials.append(m)
    return ob


def smoothstep(a, b, x):
    t = min(max((x - a) / (b - a), 0), 1); return t * t * (3 - 2 * t)


# 1. Lofted lower body: top deck profile, tapered nose/tail, rounded tumblehome cross-section
TOP = [(-2.34, 0.74), (-2.25, 0.88), (-1.80, 0.95), (-1.0, 0.93), (0.0, 0.90), (1.05, 0.88), (1.90, 0.80), (2.20, 0.68), (2.32, 0.56)]
tx = [p[0] for p in TOP]; tz = [p[1] for p in TOP]
xs = sorted(set(list(np.linspace(-2.20, 2.18, 27)) + [-2.34, -2.335, -2.32, -2.29, 2.32, 2.315, 2.30, 2.27]))
stations = []
for x in xs:
    zt = float(np.interp(x, tx, tz))
    zb = 0.27 + 0.10 * smoothstep(1.9, 2.32, x) + 0.10 * smoothstep(-1.9, -2.34, x)
    hw = 0.925 * (1 - 0.16 * smoothstep(1.3, 2.32, x) ** 1.5 - 0.10 * smoothstep(-1.5, -2.34, x) ** 1.5)
    # round the very end faces so the nose/tail aren't flat slabs
    for xe, sgn in ((2.32, 1), (-2.34, -1)):
        d = (xe - x) * sgn
        if d < 0.10: hw *= math.sqrt(max(1 - ((0.10 - d) / 0.10) ** 2 * 0.55, 0.2))
    stations.append((x, zb, zt, hw))
BODY_RING = [(0, 0), (0.80, 0), (0.96, 0.10), (1.0, 0.35), (0.97, 0.65), (0.90, 0.90), (0.76, 1.0), (0.40, 1.035), (0, 1.05)]
body = loft("Body", stations, BODY_RING, [paint], root)

# 2. Wheel arches
for x in (1.40, -1.35):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.41, depth=2.2, location=(x, 0, 0.34), rotation=(math.pi/2, 0, 0))
    cutter = bpy.context.active_object
    b = body.modifiers.new("Arch", "BOOLEAN"); b.operation = "DIFFERENCE"; b.object = cutter
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = body; body.select_set(True)
    bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.data.objects.remove(cutter)
smooth(body, 40)

# 3. Greenhouse: glass loft with painted roof + C-pillar faces
CAB = [(1.05, 0.88), (0.85, 1.03), (0.55, 1.20), (0.20, 1.34), (-0.1, 1.385), (-0.36, 1.405), (-0.40, 1.408), (-0.46, 1.41), (-0.50, 1.41), (-1.0, 1.40),
       (-1.35, 1.30), (-1.60, 1.12), (-1.82, 0.94)]
cstations = []
for i, (x, zt) in enumerate(CAB):
    hw = 0.80 if 0.0 <= x <= 1.05 else 0.80 - 0.05 * smoothstep(0.0, -1.8, x)
    cstations.append((x, 0.86, zt, hw))
CAB_RING = [(0, 0), (0.98, 0), (0.97, 0.30), (0.88, 0.62), (0.74, 0.90), (0.55, 1.0), (0.0, 1.02)]


def cab_mat(c, n):  # 0 = glass, 1 = paint
    if c.z > 1.30 and -1.02 < c.x < 0.12 and n.z > 0.5: return 1  # roof skin
    if c.x < -1.28 and abs(n.y) > 0.3: return 1                   # C pillar
    if -0.47 < c.x < -0.39 and n.z < 0.8: return 1                # B pillar
    return 0


cab = loft("Greenhouse", cstations, CAB_RING, [glass, paint], root, cab_mat)
smooth(cab, 50)
for y, s in ((-0.78, "L"), (0.78, "R")):
    box(f"Sill_{s}", (-0.05, y * 1.17, 0.35), (3.0, 0.06, 0.10), trim, root, 0.02)
    box(f"DoorSeam_{s}", (0.45, y * 1.185, 0.62), (0.012, 0.012, 0.42), trim, root)
    box(f"DoorSeam2_{s}", (-0.95, y * 1.185, 0.64), (0.012, 0.012, 0.42), trim, root)
    box(f"DoorHandle_{s}", (0.1, y * 1.19, 0.80), (0.16, 0.02, 0.03), chrome, root, 0.008)

# 4. Wheels (origin at wheel centre) -- tyre + chrome rim + brake disc + 5 spokes
WHEELS = {"Wheel_FL": (1.40, -0.80), "Wheel_FR": (1.40, 0.80), "Wheel_RL": (-1.35, -0.80), "Wheel_RR": (-1.35, 0.80)}
for name, (x, y) in WHEELS.items():
    side = -1 if y < 0 else 1
    t = cyl(name, (x, y, 0.34), 0.34, 0.24, tyre, None, rot=(math.pi/2, 0, 0), verts=48); bevel(t, 0.05, 4)
    parts = [cyl("r", (x, y + side * 0.02, 0.34), 0.225, 0.22, chrome, None, rot=(math.pi/2, 0, 0), verts=48),
             cyl("d", (x, y, 0.34), 0.19, 0.16, disc, None, rot=(math.pi/2, 0, 0), verts=32)]
    for k in range(5):
        ang = k * 2 * math.pi / 5
        bpy.ops.mesh.primitive_cube_add(
            size=1, location=(x + 0.12 * math.cos(ang), y + side * 0.125, 0.34 + 0.12 * math.sin(ang)),
            rotation=(0, -ang + math.pi / 2, 0))
        sp = bpy.context.active_object; sp.name = "spoke"
        sp.dimensions = (0.06, 0.02, 0.24)
        sp.data.materials.append(chrome)
        parts.append(sp)
    bpy.context.view_layer.update()
    apply_mods(t)
    bpy.ops.object.select_all(action="DESELECT")
    for p in parts: p.select_set(True)
    t.select_set(True); bpy.context.view_layer.objects.active = t
    bpy.ops.object.join(); t.name = name
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    t.parent = root; smooth(t, 40)

# 5. Lights, grille, mirrors, plates, bumpers, underbody
for y, s in ((-0.60, "L"), (0.60, "R")):
    box(f"Tail_{s}", (-2.285, y, 0.79), (0.06, 0.36, 0.09), brake, root, 0.012)
    box(f"Head_{s}", (2.245, y * 0.86, 0.585), (0.10, 0.27, 0.07), head, root, 0.015)
    box(f"Mirror_{s}", (0.95, y * 1.37, 1.00), (0.10, 0.17, 0.10), paint, root, 0.03)
    box(f"MirrorStalk_{s}", (1.0, y * 1.21, 0.98), (0.06, 0.18, 0.03), trim, root)
box("Grille", (2.30, 0, 0.55), (0.05, 0.62, 0.10), trim, root, 0.01)
box("PlateF", (2.33, 0, 0.42), (0.02, 0.48, 0.11), plate, root)
box("PlateR", (-2.335, 0, 0.55), (0.02, 0.48, 0.11), plate, root)
box("Underbody", (0, 0, 0.24), (4.3, 1.5, 0.04), trim, root)
box("BumperF", (2.28, 0, 0.33), (0.10, 1.55, 0.10), trim, root, 0.03)
box("BumperR", (-2.30, 0, 0.35), (0.10, 1.55, 0.10), trim, root, 0.03)
print("car built:", len(root.children_recursive), "parts; tris~", sum(len(o.data.polygons) for o in root.children_recursive if o.type == "MESH"))
