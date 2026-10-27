exec(open(os.path.expanduser("~/Desktop/SignalDrive/blender/scripts/00_common.py")).read()) if "principled" not in globals() else None

# ---- textures (1024^2, tileable) -------------------------------------------------------------
N = 1024
rng = np.random.default_rng(7)
n_lo, n_hi = tile_noise(N, 3, 1), tile_noise(N, 12, 2)
asph = 0.040 + 0.055 * (0.55 * n_lo + 0.45 * n_hi)
asph += (rng.random((N, N)) > 0.996) * 0.14           # bright aggregate specks
asph += (rng.random((N, N)) > 0.9985) * -0.03         # dark pits
asph = np.clip(asph, 0, 1)
a_rgb = np.dstack([asph * 1.02, asph, asph * 1.05])
h = 0.5 * n_lo + 0.5 * n_hi + (rng.random((N, N)) > 0.996) * 0.4
save_png("asphalt_color", a_rgb)
save_png("asphalt_normal", normal_from_height(h, 3.0))

# sidewalk: 0.5 m pavers => 8 pavers per 4 m tile => 128 px each
sw = 0.50 + 0.10 * tile_noise(N, 6, 3) + 0.04 * rng.random((N, N))
px = np.arange(N)
grout = ((px % 128) < 3)[None, :] | ((px % 128) < 3)[:, None]
sw = np.where(grout, 0.22, sw)
tint = (tile_noise(N, 20, 4) - 0.5) * 0.06
sw_rgb = np.dstack([sw + tint + 0.01, sw + tint, sw + tint - 0.01])
hs = np.where(grout, 0.0, 0.7 + 0.3 * tile_noise(N, 4, 5))
save_png("sidewalk_color", sw_rgb)
save_png("sidewalk_normal", normal_from_height(hs, 2.0))

new_collection("RoadCol")
root = empty("RoadSegment")
root.location = (0, 20, 0)
asphalt = textured_mat("Asphalt", os.path.join(TEX, "asphalt_color.png"), os.path.join(TEX, "asphalt_normal.png"), rough=0.88)
walk = textured_mat("Sidewalk", os.path.join(TEX, "sidewalk_color.png"), os.path.join(TEX, "sidewalk_normal.png"), rough=0.8)
curbm = mat("Curb", (0.50, 0.50, 0.49), rough=0.75)
paintm = mat("LaneMarking", (0.85, 0.85, 0.82), rough=0.6)

L = 60.0; X0, X1 = -L / 2, L / 2
TILE = 4.0


def quad(name, y0, y1, z, material, parent, uv_tile=TILE):
    """Horizontal quad spanning x in [X0, X1], y in [y0, y1] at height z, UVs from world metres / tile size."""
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((X0, y0, z), (X1, y0, z), (X1, y1, z), (X0, y1, z))]
    f = bm.faces.new(vs)
    uv = bm.loops.layers.uv.new("UVMap")
    for lp in f.loops:
        lp[uv].uv = (lp.vert.co.x / uv_tile, lp.vert.co.y / uv_tile)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bmesh(name, bm, material, parent)


def slab(name, y0, y1, z0, z1, material, parent):
    """Box spanning x in [X0, X1]; top UVs in world metres / tile so textures stay constant."""
    bm = bmesh.new()
    vs = [bm.verts.new((x, y, z)) for z in (z0, z1) for y in (y0, y1) for x in (X0, X1)]
    bmesh.ops.convex_hull(bm, input=vs)
    uv = bm.loops.layers.uv.new("UVMap")
    for f in bm.faces:
        for lp in f.loops:
            c = lp.vert.co
            if abs(f.normal.z) > 0.5: lp[uv].uv = (c.x / TILE, c.y / TILE)
            elif abs(f.normal.y) > 0.5: lp[uv].uv = (c.x / TILE, c.z / TILE)
            else: lp[uv].uv = (c.y / TILE, c.z / TILE)
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bmesh(name, bm, material, parent)


# cross-section along Y:  sidewalk | curb | lane | lane | curb | sidewalk (road centre at y=0)
ROAD_HW = 3.5
CURB_W, CURB_H = 0.25, 0.15
quad("Asphalt", -ROAD_HW, ROAD_HW, 0.0, asphalt, root)
for s, nm in ((-1, "L"), (1, "R")):
    y_in, y_c, y_out = s * ROAD_HW, s * (ROAD_HW + CURB_W), s * (ROAD_HW + CURB_W + 3.0)
    a, b = sorted((y_in, y_c)); slab(f"Curb_{nm}", a, b, 0.0, CURB_H, curbm, root)
    a, b = sorted((y_c, y_out)); slab(f"Sidewalk_{nm}", a, b, 0.0, CURB_H, walk, root)
# gutter strips + an expansion joint every 4 m would be visible; the grout texture already covers it.

# lane markings, 5 mm above the asphalt
MZ = 0.006
for xa in np.arange(X0, X1, 10.0):  # dashed centre line: 4 m dash, 6 m gap; period divides 60 so tiles seam-free
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((xa, -0.075, MZ), (xa + 4, -0.075, MZ), (xa + 4, 0.075, MZ), (xa, 0.075, MZ))]
    bm.faces.new(vs); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh_from_bmesh("CentreDash", bm, paintm, root)
for s in (-1, 1):  # solid edge lines
    y0, y1 = sorted((s * (ROAD_HW - 0.30), s * (ROAD_HW - 0.45)))
    bm = bmesh.new()
    vs = [bm.verts.new(p) for p in ((X0, y0, MZ), (X1, y0, MZ), (X1, y1, MZ), (X0, y1, MZ))]
    bm.faces.new(vs); bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    mesh_from_bmesh("EdgeLine", bm, paintm, root)
print("road built:", len(root.children_recursive), "parts")
