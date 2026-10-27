exec(open(os.path.expanduser("~/Desktop/SignalDrive/blender/scripts/00_common.py")).read()) if "principled" not in globals() else None

new_collection("BuildingsCol")

# Facade textures: 512^2 tile = 4 windows x 4 floors = 12 m x 12.8 m (window pitch 3.0 x 3.2 m, cell 128 px).
# Footprint widths are multiples of 3 m and heights multiples of 3.2 m, so tiled UVs always land on window edges.
PITCH_X, PITCH_Y = 3.0, 3.2
TILE_X, TILE_Y = 12.0, 12.8
CELL = 128

VARIANTS = [
    # name, wall rgb, glass rgb, window frac (w, h), brick, lit chance
    ("brick", (0.42, 0.16, 0.11), (0.05, 0.08, 0.12), (0.40, 0.50), True, 0.25),
    ("sand", (0.62, 0.52, 0.38), (0.05, 0.08, 0.12), (0.40, 0.50), False, 0.22),
    ("concrete", (0.43, 0.43, 0.44), (0.05, 0.08, 0.13), (0.45, 0.50), False, 0.28),
    ("offwhite", (0.74, 0.73, 0.69), (0.06, 0.09, 0.13), (0.42, 0.52), False, 0.20),
    ("teal", (0.08, 0.30, 0.32), (0.04, 0.12, 0.16), (0.88, 0.80), False, 0.25),
    ("darkglass", (0.05, 0.07, 0.10), (0.03, 0.08, 0.14), (0.86, 0.78), False, 0.30),
]


def facade(idx, name, wall, glass, frac, brick, lit_p):
    rng = np.random.default_rng(100 + idx)
    S = CELL * 4
    img = np.zeros((S, S, 3)); emi = np.zeros((S, S, 3))
    n = tile_noise(S, 3, 200 + idx)
    img[:] = np.array(wall) * (0.92 + 0.16 * n[..., None])
    if brick:
        y = np.arange(S)[:, None]; x = np.arange(S)[None, :]
        row = (y // 8)
        mortar = ((y % 8) < 1) | (((x + (row % 2) * 8) % 16) < 1)
        img[mortar] = np.array(wall) * 0.55 + 0.12
    ww, wh = int(CELL * frac[0]), int(CELL * frac[1])
    for r in range(4):
        for c in range(4):
            x0 = c * CELL + (CELL - ww) // 2; y0 = r * CELL + (CELL - wh) // 2
            lit = rng.random() < lit_p
            g = np.array(glass) * (0.8 + 0.5 * rng.random())
            yy = np.linspace(0, 1, wh)[:, None, None]
            win = g * (1.0 + 0.5 * yy)  # sky reflection gradient: lighter toward the top rows (higher y)
            if lit:
                warm = np.array([1.0, 0.78, 0.45]) * (0.55 + 0.45 * rng.random())
                win = np.broadcast_to(warm, (wh, ww, 3)) * (0.75 + 0.25 * yy)
                emi[y0:y0 + wh, x0:x0 + ww] = win
            img[y0:y0 + wh, x0:x0 + ww] = win
            fr = 2  # window frame
            img[y0 - fr:y0 + wh + fr, x0 - fr:x0] = np.array(wall) * 0.5
            img[y0 - fr:y0 + wh + fr, x0 + ww:x0 + ww + fr] = np.array(wall) * 0.5
            img[y0 - fr:y0, x0 - fr:x0 + ww + fr] = np.array(wall) * 0.5
            img[y0 + wh:y0 + wh + fr, x0 - fr:x0 + ww + fr] = np.array(wall) * 0.5
            # sill: slightly lighter
            img[y0 - fr - 2:y0 - fr, x0 - 4:x0 + ww + 4] = np.array(wall) * 1.15
    # floor-line band
    img[:3] *= 0.8; img[CELL * 1:CELL * 1 + 2] *= 0.85
    c_png = save_png(f"facade_{name}", img)
    e_png = save_png(f"facade_{name}_emit", emi)
    return c_png, e_png


roof_m = mat("Roof", (0.10, 0.10, 0.11), rough=0.9)
awn_m = mat("Awning", (0.12, 0.13, 0.16), rough=0.7)
unit_m = mat("RoofUnit", (0.45, 0.46, 0.48), metallic=0.5, rough=0.5)
root = empty("Buildings"); root.location = (0, 70, 0)

SIZES = [(18, 12, 4), (15, 15, 6), (12, 12, 9), (21, 15, 5), (15, 12, 8), (18, 18, 7)]  # (width x, depth y, floors)
for i, ((vn, wall, glass, frac, brick, lit_p), (w, d, floors)) in enumerate(zip(VARIANTS, SIZES)):
    cpng, epng = facade(i, vn, wall, glass, frac, brick, lit_p)
    fm = textured_mat(f"Facade_{vn}", cpng, rough=0.55 if i >= 4 else 0.85, emissive_png=epng, emit_strength=1.5)
    h = floors * PITCH_Y
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for z in (0, h) for y in (-d / 2, d / 2) for x in (-w / 2, w / 2)]
    bmesh.ops.convex_hull(bm, input=vs)
    bm.faces.ensure_lookup_table()
    uv = bm.loops.layers.uv.new("UVMap")
    for f in list(bm.faces):
        if f.normal.z < -0.5: bm.faces.remove(f); continue
    for f in bm.faces:
        if f.normal.z > 0.5:
            f.material_index = 1
            for lp in f.loops: lp[uv].uv = (0.0, 0.0)
        else:
            f.material_index = 0
            for lp in f.loops:
                c = lp.vert.co
                u = (c.x if abs(f.normal.y) > 0.5 else c.y) / TILE_X
                lp[uv].uv = (u, c.z / TILE_Y)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    ox = i * 24  # spaced out only so `look` can inspect them; the app resets each clone to the origin
    body = mesh_from_bmesh(f"Building_{i}", bm, None, None)
    body.data.materials.append(fm); body.data.materials.append(roof_m)
    body.location = (ox, 0, 0)
    parts = [body]
    parts.append(box(f"Parapet_{i}", (ox, 0, h + 0.25), (w + 0.1, d + 0.1, 0.5), unit_m, None, 0.02))
    parts.append(box(f"RoofTop_{i}", (ox, 0, h + 0.52), (w - 0.5, d - 0.5, 0.06), roof_m, None))
    parts.append(box(f"HVAC_{i}", (ox + w * 0.2, d * 0.15, h + 1.1), (2.4, 1.6, 1.0), unit_m, None, 0.03))
    # ground-floor awning toward Blender -Y (three +Z). The app rotates buildings on the far side of the road.
    parts.append(box(f"Awning_{i}", (ox, -d / 2 - 0.6, 3.5), (w - 1.0, 1.2, 0.12), awn_m, None, 0.02))
    for pt in parts[1:]: apply_mods(pt)
    # one mesh per building (4 material slots): fewer draw calls, and one node to clone by name
    bpy.ops.object.select_all(action="DESELECT")
    for pt in parts: pt.select_set(True)
    bpy.context.view_layer.objects.active = body
    bpy.ops.object.join()
    bpy.context.scene.cursor.location = (ox, 0, 0)
    bpy.ops.object.origin_set(type="ORIGIN_CURSOR")
    body.name = f"Building_{i}"; body.parent = root
bpy.context.scene.cursor.location = (0, 0, 0)
print("buildings built:", len(root.children_recursive), "tris", sum(len(o.data.polygons) for o in root.children_recursive))
