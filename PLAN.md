# SignalDrive — Execution Plan

> **Status (2026-10-26): executed.** All phases are built and verified in a headless Chrome play-through; see README.md for how to run it. Deviations from this plan: the Blender scripts differ from the snippets below (the car body is a lofted mesh, buildings are one joined mesh each), and `buildings` is optimised with `--join false --flatten false` like the car and signal.

An interactive physics mini-game: a car auto-accelerates down a city street, traffic signals change,
the player brakes. A live **speed–time (v–t) graph** is drawn as they drive. After the drive, the
player answers questions about motion, many of them computed from **their own graph**.

Design language is borrowed from GravityGrid (`~/Desktop/GravityGrid-App/GravityGrid-FE/apps/student`).
3D assets are modelled procedurally in Blender via the Blender MCP, exported as GLB, compressed with
gltf-transform, and loaded with react-three-fiber.

> Executor: work top to bottom. Each phase ends with a **Verify** step — do not skip it.
> The Blender scripts below are starting points written without being run; expect to fix small API
> errors and iterate on shapes using the `look` tool.

---

## 0. Preconditions (do first)

1. **Blender MCP addon: already updated** (2026-10-25, now addon 1.8 / protocol 15, `up_to_date: true`).
   Just run `get_addon_status` to confirm it's connected. If it ever goes stale again: run
   `uvx mcp-for-blender install-addon`, then reload it from inside Blender with a
   `bpy.app.timers` callback that runs `addon_disable` + `addon_enable` on module `blender_mcp`
   followed by `bpy.ops.blendermcp.start_server()`. Wait about 15 s for the server on 127.0.0.1:9876
   to come back.
2. All asset libraries (Poly Haven, Sketchfab, Poly Pizza) and generators are **off**. Everything is
   modelled procedurally with `bpy` + `bmesh`, and textures are generated with `numpy` (bundled with
   Blender). Don't call `search_assets`, `import_asset` or `generate_3d`.
3. Blender version is **5.2.1 LTS**. Per the MCP rules: find shader nodes by `type`, not by name, and
   read enum identifiers instead of hardcoding them.
4. Node ≥ 18 is available. The project lives at `~/Desktop/SignalDrive/`.

---

## 1. Project layout

```
~/Desktop/SignalDrive/
├── PLAN.md
├── blender/
│   ├── scripts/            # every script sent to execute_blender_code, saved for reproducibility
│   │   ├── 00_common.py    # helpers (clear, materials, images, export)
│   │   ├── 10_car.py
│   │   ├── 20_signal.py
│   │   ├── 30_road.py
│   │   ├── 40_props.py     # tree, streetlight
│   │   └── 50_buildings.py
│   ├── textures/           # numpy-generated PNGs (asphalt, sidewalk, facades)
│   ├── exports/            # raw, uncompressed GLBs straight out of Blender (git-ignored)
│   └── signaldrive.blend   # saved source scene
├── scripts/
│   ├── optimize-models.sh       # raw GLB → public/models (meshopt + webp)
│   └── check-models.mjs         # build guard: fail if any GLB is uncompressed or over budget
├── public/models/               # shipped, compressed GLBs
└── src/ ...                     # React app (section 4)
```

Scaffold:
```bash
cd ~/Desktop/SignalDrive
npm create vite@latest . -- --template react-ts   # accept "ignore existing files"
npm i three@0.182 @react-three/fiber@^9.4 @react-three/drei@^10.7 @react-three/postprocessing@^3 \
      postprocessing zustand@^5 react-router-dom@^7 lucide-react
npm i -D @types/three@0.182 tailwindcss@^4 @tailwindcss/vite@^4
```
Add `tailwindcss()` to `vite.config.ts` plugins; `src/index.css` = `@import "tailwindcss";`.
Copy `GeistVF.woff` / `GeistMonoVF.woff` from
`~/Desktop/GravityGrid-App/GravityGrid-FE/apps/student/app/fonts/` to `src/assets/fonts/` and register
them with `@font-face` (`--font-sans: "Geist"`, `--font-mono: "Geist Mono"` in a Tailwind `@theme` block).

---

## 2. Design language (taken from GravityGrid)

Use these exactly, so SignalDrive reads as part of the same family:

| Token | Value |
|---|---|
| Page background | `#050510` (landing), `bg-neutral-950` (game/analysis) |
| Grid overlay | `bg-[linear-gradient(rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:50px_50px] [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_100%)]` |
| Glows | `bg-indigo-600/10 blur-[120px] rounded-full` (top-right, `animate-pulse`), `bg-cyan-600/10 blur-[120px]` (bottom-left) |
| Glass card | `bg-white/5 border border-white/10 rounded-3xl backdrop-blur-xl`, hover `hover:border-indigo-500/40` |
| Navbar | `fixed h-20 border-b border-white/5 bg-[#050510]/60 backdrop-blur-xl` |
| Pill badge | `px-4 py-2 rounded-full bg-white/5 border border-white/10` + `w-2 h-2 bg-indigo-400 animate-ping` dot + `text-xs text-indigo-300 uppercase tracking-wider` |
| Headline gradient | `bg-clip-text text-transparent bg-gradient-to-r from-indigo-400 via-cyan-400 to-purple-400` |
| Primary CTA | `bg-white text-black rounded-xl font-bold hover:scale-105` ; secondary `bg-white/5 border border-white/10` ; nav CTA `bg-indigo-600 rounded-full hover:bg-indigo-500` |
| Body text | `text-slate-400`, headings `font-bold` white |
| Icons | `lucide-react` |
| Graph phase colours | accelerate `#22d3ee` (cyan-400), cruise `#818cf8` (indigo-400), brake `#fb7185` (rose-400), stopped `#94a3b8` (slate-400) |

Footer tagline in the GravityGrid style: “SignalDrive — every drive draws a graph.”

---

## 3. Blender: building the assets

### 3.1 Conventions (shared by every asset)

- **Units: metres.** Blender **Z-up, the car faces +X**. The glTF exporter converts Z-up to Y-up
  (Blender `(x, y, z)` → three `(x, z, -y)`), so in three.js the car faces **+X**, up is **+Y**, and
  the wheel axles run along **three Z**.
- Every asset has one root **Empty** named after the asset (`Car`, `Signal`, `RoadSegment`, …), with
  its origin on the ground at y = 0.
- Parts that code animates or queries are **separate named objects with their own named
  material**. Never merge them:
  - Car: `Wheel_FL`, `Wheel_FR`, `Wheel_RL`, `Wheel_RR` (origin at the wheel centre), material
    `BrakeLight`, material `Headlight`.
  - Signal: `Lamp_Red`, `Lamp_Yellow`, `Lamp_Green`, each with a material of the same name.
- glTF only exports Principled BSDF values and **image textures**. Procedural shader nodes (Noise,
  Voronoi…) are dropped on export. So any texture is generated as a PNG with numpy, saved to
  `blender/textures/`, loaded with `bpy.data.images.load`, and wired into the Principled BSDF.
- Exporter extensions that three.js supports and we rely on: clearcoat (car paint), transmission +
  IOR (glass), emissive_strength (lamps).
- After building each asset: `look` from 2–3 angles (max_size ≈ 768 to keep the session cheap), fix,
  then export. Save the `.blend` after each asset.

### 3.2 `00_common.py` — send first, in the same session

```python
import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

ROOT = os.path.expanduser("~/Desktop/SignalDrive/blender")
TEX = os.path.join(ROOT, "textures"); EXP = os.path.join(ROOT, "exports")

def principled(m):
    return next(n for n in m.node_tree.nodes if n.type == "BSDF_PRINCIPLED")

def mat(name, color, metallic=0.0, rough=0.5, coat=0.0, coat_rough=0.03,
        transmission=0.0, ior=1.45, emission=None, emit_strength=0.0):
    m = bpy.data.materials.get(name) or bpy.data.materials.new(name)
    m.use_nodes = True
    b = principled(m)
    b.inputs["Base Color"].default_value = (*color, 1)
    b.inputs["Metallic"].default_value = metallic
    b.inputs["Roughness"].default_value = rough
    b.inputs["Coat Weight"].default_value = coat
    b.inputs["Coat Roughness"].default_value = coat_rough
    b.inputs["Transmission Weight"].default_value = transmission
    b.inputs["IOR"].default_value = ior
    if emission:
        b.inputs["Emission Color"].default_value = (*emission, 1)
        b.inputs["Emission Strength"].default_value = emit_strength
    return m

def textured_mat(name, color_png, normal_png=None, rough=0.85):
    m = mat(name, (1, 1, 1), rough=rough)
    nt = m.node_tree; b = principled(m)
    img = nt.nodes.new("ShaderNodeTexImage"); img.image = bpy.data.images.load(color_png, check_existing=True)
    nt.links.new(img.outputs["Color"], b.inputs["Base Color"])
    if normal_png:
        nimg = nt.nodes.new("ShaderNodeTexImage"); nimg.image = bpy.data.images.load(normal_png, check_existing=True)
        nimg.image.colorspace_settings.is_data = True
        nmap = nt.nodes.new("ShaderNodeNormalMap")
        nt.links.new(nimg.outputs["Color"], nmap.inputs["Color"])
        nt.links.new(nmap.outputs["Normal"], b.inputs["Normal"])
    return m

def save_png(name, rgb):                       # rgb: (h, w, 3) floats 0..1, row 0 = bottom
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.concatenate([rgb, np.ones((h, w, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    path = os.path.join(TEX, name + ".png")
    img.filepath_raw = path; img.file_format = "PNG"; img.save()
    bpy.data.images.remove(img)
    return path

def tile_noise(n, blur, seed):                 # tileable: np.roll wraps around the edges
    a = np.random.default_rng(seed).random((n, n))
    for _ in range(blur):
        a = (a + np.roll(a, 1, 0) + np.roll(a, -1, 0) + np.roll(a, 1, 1) + np.roll(a, -1, 1)) / 5
    return (a - a.min()) / np.ptp(a)

def normal_from_height(h, strength=2.0):
    dx = (np.roll(h, -1, 1) - np.roll(h, 1, 1)) * strength
    dy = (np.roll(h, -1, 0) - np.roll(h, 1, 0)) * strength
    n = np.dstack([-dx, -dy, np.ones_like(h)]); n /= np.linalg.norm(n, axis=2, keepdims=True)
    return n * 0.5 + 0.5

def link(ob, parent=None):
    bpy.context.collection.objects.link(ob)
    if parent: ob.parent = parent
    return ob

def empty(name):
    e = bpy.data.objects.new(name, None); return link(e)

def mesh_from_bmesh(name, bm, material, parent):
    me = bpy.data.meshes.new(name); bm.to_mesh(me); bm.free()
    me.materials.append(material)
    return link(bpy.data.objects.new(name, me), parent)

def prism(name, pts_xz, width, material, parent, y0=0.0):
    """Extrude a closed side profile (list of (x, z)) across Y by `width`."""
    bm = bmesh.new(); h = width / 2
    L = [bm.verts.new((x, y0 - h, z)) for x, z in pts_xz]
    R = [bm.verts.new((x, y0 + h, z)) for x, z in pts_xz]
    bm.faces.new(L); bm.faces.new(list(reversed(R)))
    for i in range(len(L)):
        j = (i + 1) % len(L); bm.faces.new((L[i], L[j], R[j], R[i]))
    bmesh.ops.recalc_face_normals(bm, faces=bm.faces)
    return mesh_from_bmesh(name, bm, material, parent)

def bevel(ob, width=0.03, segments=3):
    m = ob.modifiers.new("Bevel", "BEVEL"); m.width = width; m.segments = segments
    m.limit_method = "ANGLE"; return m

def smooth(ob, angle=35):
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    ob.select_set(False)

def select_tree(root):
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root, *root.children_recursive]: o.select_set(True)
    bpy.context.view_layer.objects.active = root

def export_glb(root, filename):
    select_tree(root)
    fmt = [i.identifier for i in bpy.ops.export_scene.gltf.get_rna_type()
           .properties["export_format"].enum_items]
    bpy.ops.export_scene.gltf(
        filepath=os.path.join(EXP, filename),
        export_format="GLB" if "GLB" in fmt else fmt[0],
        use_selection=True, export_apply=True, export_yup=True,
        export_materials="EXPORT", export_cameras=False, export_lights=False,
    )

def new_collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children: bpy.context.scene.collection.children.link(c)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[c.name]
    return c
```

Start a clean scene once (`bpy.ops.wm.read_homefile(use_empty=True)`), then build each asset in its
own collection, offset along Blender Y (car at y=0, signal at y=6, road at y=20…), so `look` can
inspect them separately. `export_glb` exports only the root's tree, so these offsets don't matter:
**set each root's location to (0, 0, 0) just before exporting it**, then move it back.

### 3.3 `10_car.py` — sedan (target: ≤ 25k tris, ≤ 400 KB after compression)

Dimensions: length 4.6 m, width 1.85 m, height 1.45 m, wheelbase 2.75 m, wheel radius 0.34 m,
front axle x = +1.40, rear axle x = −1.35. Built as stacked profile prisms plus booleans, with a
glass greenhouse under a painted roof. That trick is what makes it read as a real car, not a box.

```python
new_collection("CarCol")
root = empty("Car")
paint  = mat("CarPaint", (0.55, 0.02, 0.03), metallic=0.9, rough=0.32, coat=1.0)   # deep metallic red
glass  = mat("Glass", (0.05, 0.07, 0.08), rough=0.05, transmission=0.9, ior=1.5)
trim   = mat("Trim", (0.02, 0.02, 0.02), rough=0.6)
chrome = mat("Chrome", (0.9, 0.9, 0.92), metallic=1.0, rough=0.12)
tyre   = mat("Tyre", (0.025, 0.025, 0.025), rough=0.9)
brake  = mat("BrakeLight", (0.35, 0.0, 0.0), rough=0.3, emission=(1, 0.02, 0.02), emit_strength=0.4)
head   = mat("Headlight", (0.9, 0.9, 0.9), rough=0.1, emission=(1, 0.95, 0.85), emit_strength=2.0)

# 1. Lower body (side profile, rear → front along the bottom, then back over the top)
body = prism("Body", [(-2.30,0.30),(2.25,0.30),(2.32,0.45),(2.30,0.66),(2.05,0.80),(1.05,0.88),
                      (-1.80,0.93),(-2.25,0.90),(-2.33,0.70),(-2.34,0.45)], 1.85, paint, root)
# 2. Wheel arches: boolean-subtract cylinders along Y at each axle
for x in (1.40, -1.35):
    bpy.ops.mesh.primitive_cylinder_add(radius=0.40, depth=2.2, location=(x, 0, 0.34), rotation=(math.pi/2, 0, 0))
    cutter = bpy.context.active_object
    b = body.modifiers.new("Arch", "BOOLEAN"); b.operation = "DIFFERENCE"; b.object = cutter
    bpy.context.view_layer.objects.active = body; bpy.ops.object.modifier_apply(modifier=b.name)
    bpy.data.objects.remove(cutter)
bevel(body, 0.05, 4); smooth(body)

# 3. Greenhouse: glass prism, slightly narrower; painted roof slab + pillars on top of it
cabin = [(1.05,0.86),(0.20,1.36),(-1.00,1.40),(-1.80,0.92)]
prism("Greenhouse", cabin, 1.58, glass, root)
roof = prism("Roof", [(0.12,1.37),(-0.95,1.41),(-1.0,1.45),(0.10,1.43)], 1.52, paint, root); bevel(roof, 0.02)
for name, x in (("Pillar_B", -0.42),):
    for y in (-0.78, 0.78):
        bpy.ops.mesh.primitive_cube_add(size=1, location=(x, y, 1.13), scale=(0.08, 0.02, 0.50))
        p = bpy.context.active_object; p.name = f"{name}_{'L' if y < 0 else 'R'}"; p.data.materials.append(paint); p.parent = root

# 4. Wheels — origin at wheel centre; tyre + chrome rim + 5 spokes, joined per wheel
WHEELS = {"Wheel_FL": (1.40, -0.80), "Wheel_FR": (1.40, 0.80), "Wheel_RL": (-1.35, -0.80), "Wheel_RR": (-1.35, 0.80)}
for name, (x, y) in WHEELS.items():
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.34, depth=0.24, location=(x, y, 0.34), rotation=(math.pi/2, 0, 0))
    t = bpy.context.active_object; t.data.materials.append(tyre); bevel(t, 0.05, 4)
    bpy.ops.mesh.primitive_cylinder_add(vertices=48, radius=0.22, depth=0.245, location=(x, y, 0.34), rotation=(math.pi/2, 0, 0))
    r = bpy.context.active_object; r.data.materials.append(chrome)
    # spokes: 5 thin boxes rotated around the axle (optional polish; skip if it fights the budget)
    bpy.ops.object.select_all(action="DESELECT"); t.select_set(True); r.select_set(True)
    bpy.context.view_layer.objects.active = t
    for m in t.modifiers: bpy.ops.object.modifier_apply(modifier=m.name)
    bpy.ops.object.join(); t.name = name
    bpy.ops.object.origin_set(type="ORIGIN_GEOMETRY", center="BOUNDS")
    t.parent = root; smooth(t, 40)

# 5. Lights, grille, mirrors, plate, underbody
for y in (-0.62, 0.62):
    bpy.ops.mesh.primitive_cube_add(size=1, location=(-2.33, y, 0.78), scale=(0.04, 0.42, 0.10))
    o = bpy.context.active_object; o.name = f"Tail_{'L' if y<0 else 'R'}"; o.data.materials.append(brake); o.parent = root; bevel(o, 0.015)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(2.27, y, 0.66), scale=(0.08, 0.36, 0.09))
    o = bpy.context.active_object; o.name = f"Head_{'L' if y<0 else 'R'}"; o.data.materials.append(head); o.parent = root; bevel(o, 0.02)
    bpy.ops.mesh.primitive_cube_add(size=1, location=(0.95, y * 1.55, 1.02), scale=(0.14, 0.10, 0.09))
    o = bpy.context.active_object; o.name = f"Mirror_{'L' if y<0 else 'R'}"; o.data.materials.append(paint); o.parent = root; bevel(o, 0.02)
bpy.ops.mesh.primitive_cube_add(size=1, location=(2.33, 0, 0.47), scale=(0.03, 0.9, 0.16))
o = bpy.context.active_object; o.name = "Grille"; o.data.materials.append(trim); o.parent = root
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 0.22), scale=(4.3, 1.6, 0.04))
o = bpy.context.active_object; o.name = "Underbody"; o.data.materials.append(trim); o.parent = root
```

**Iterate with `look`** (side, ¾ front, ¾ rear). Check: wheels sit on z=0 and are centred in the
arches, the greenhouse doesn't poke through the roof, and no faces are flipped (`get_scene_info`
with `fields=["topology"]`). Optional extra realism if time allows: door seam lines (thin trim
strips), side skirts, a slightly curved hood (one loop cut on the body top, raised 2 cm).

Export: `export_glb(bpy.data.objects["Car"], "car.raw.glb")`.

### 3.4 `20_signal.py` — traffic light (target ≤ 3k tris, ≤ 60 KB)

Post-mounted signal. Pole base at the origin; lamps face **−X** (towards the oncoming car, which
travels +X).

```python
new_collection("SignalCol")
root = empty("Signal")
metal = mat("PoleMetal", (0.08, 0.09, 0.10), metallic=0.8, rough=0.45)
housing = mat("Housing", (0.03, 0.03, 0.03), rough=0.55)
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.07, depth=3.0, location=(0, 0, 1.5))
p = bpy.context.active_object; p.name = "Pole"; p.data.materials.append(metal); p.parent = root
bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.16, depth=0.12, location=(0, 0, 0.06))
b = bpy.context.active_object; b.name = "Base"; b.data.materials.append(metal); b.parent = root
bpy.ops.mesh.primitive_cube_add(size=1, location=(0, 0, 3.45), scale=(0.32, 0.36, 1.02))
h = bpy.context.active_object; h.name = "Housing"; h.data.materials.append(housing); h.parent = root; bevel(h, 0.03)
bpy.ops.mesh.primitive_cube_add(size=1, location=(0.17, 0, 3.45), scale=(0.02, 0.52, 1.18))
bp = bpy.context.active_object; bp.name = "Backplate"; bp.data.materials.append(housing); bp.parent = root
for i, (name, col) in enumerate((("Lamp_Red", (1, 0.05, 0.03)), ("Lamp_Yellow", (1, 0.65, 0.0)), ("Lamp_Green", (0.1, 1, 0.35)))):
    z = 3.77 - i * 0.32
    lm = mat(name, tuple(c * 0.25 for c in col), rough=0.2, emission=col, emit_strength=0.0)  # runtime turns it on
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, location=(-0.15, 0, z), scale=(0.35, 1, 1))
    l = bpy.context.active_object; l.name = name; l.data.materials.append(lm); l.parent = root; smooth(l)
    # visor: half tube over each lamp
    bpy.ops.mesh.primitive_cylinder_add(vertices=24, radius=0.14, depth=0.18, location=(-0.25, 0, z), rotation=(0, math.pi/2, 0))
    v = bpy.context.active_object; v.name = f"Visor_{i}"; v.data.materials.append(housing); v.parent = root
    bm = bmesh.new(); bm.from_mesh(v.data)
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if f.calc_center_median().z < -0.02 or abs(f.normal.x) > 0.9], context="FACES")
    bm.to_mesh(v.data); bm.free()
    m = v.modifiers.new("Solid", "SOLIDIFY"); m.thickness = 0.012
```
`look` at it; then `export_glb(root, "signal.raw.glb")`.

### 3.5 `30_road.py` — tileable road segment (60 m long, ≤ 300 KB)

Cross-section along Blender Y (left to right): sidewalk 3 m | curb 0.25 m (raised 0.15 m) | 2 lanes
× 3.5 m = 7 m asphalt | curb | sidewalk 3 m. Segment spans x ∈ [−30, 30] so it tiles seamlessly
every 60 m.

Textures (numpy, 1024², tileable):
- **Asphalt** — `base = 0.045 + 0.05 * (0.6*tile_noise(1024,2,1) + 0.4*tile_noise(1024,12,2))`, plus
  ~0.4 % random bright aggregate specks (+0.12), plus a soft darker tyre-wear band along the centre
  of each lane. Height = the same noise → `normal_from_height(strength=3)`. Save
  `asphalt_color.png`, `asphalt_normal.png`. UVs: 1 texture tile = 4 m (scale the UVs with bmesh after
  `uv.smart_project`, or by setting UVs from world XY / 4).
- **Sidewalk** — 0.5 m square concrete pavers: light grey (0.55) noise with dark 1-px grout lines
  every 128 px; normal from height. `sidewalk_color.png`, `sidewalk_normal.png`.

Geometry: planes for asphalt and sidewalks, a beveled box for each curb, lane markings as separate
thin planes 5 mm above the asphalt (`LaneMarking` material, off-white 0.85, rough 0.6): dashed centre
line (3 m dash, 6 m gap, so it tiles in 60 m), solid edge lines 0.15 m wide. Root empty `RoadSegment`.
Export `road.raw.glb`.

The **stop line** and **zebra crossing** are *not* in the road GLB: three.js places them as simple
white planes at each signal, so signals can sit anywhere along the road.

### 3.6 `40_props.py` — `tree.glb`, `streetlight.glb` (each ≤ 80 KB)

- **Tree**: trunk = tapered cylinder (radius 0.18 → 0.10, 2.4 m, bark brown 0.12/0.07/0.04, rough 0.9).
  Canopy = 3 overlapping icospheres (subdiv 2, r 1.2–1.6) with a `DISPLACE` modifier driven by a
  Clouds texture (strength 0.35, applied before export), leaf green (0.06, 0.16, 0.04), rough 0.8,
  flat shading. Root `Tree`.
- **Streetlight**: 7 m pole, curved arm (bezier → mesh), lamp head with a `StreetLamp` emissive
  material (warm 1, 0.85, 0.6; strength 3). Root `Streetlight`.

These are instanced dozens of times at runtime, so keep them very low poly.

### 3.7 `50_buildings.py` — `buildings.glb` (≤ 400 KB)

Six building variants, `Building_0` … `Building_5`, each a beveled box (footprint 10–16 m,
height 9–30 m) with a flat roof parapet and a ground-floor awning strip. Facade textures are made
with numpy: a wall colour (one per variant: brick red, sand, grey concrete, off-white, teal glass,
dark glass) and a window grid (window 1.2 × 1.6 m on a 3 × 3.2 m pitch). Windows are dark, slightly
reflective blue; about 25 % of them are randomly "lit" warm yellow. Use the same image as the
emissive texture, masked to the lit windows only (strength 1.5), so the street glows at golden hour.
Box UVs are set from world coordinates so the window pitch stays constant across sizes. Two texture
atlases at most (1024 × 2048) shared by all six variants. Root `Buildings`, children = variants
(three.js instances them by name).

### 3.8 Compression — `scripts/optimize-models.sh`

```bash
#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
RAW=blender/exports; OUT=public/models; mkdir -p "$OUT"
T="npx --yes @gltf-transform/cli"
# Named-node assets: keep hierarchy, names and per-part materials (code looks them up)
for m in car signal; do
  $T optimize "$RAW/$m.raw.glb" "$OUT/$m.glb" --compress meshopt --texture-compress webp \
     --texture-size 1024 --simplify false --join false --flatten false --palette false
done
# Scenery: let it merge freely
for m in road tree streetlight buildings; do
  $T optimize "$RAW/$m.raw.glb" "$OUT/$m.glb" --compress meshopt --texture-compress webp --texture-size 1024
done
ls -lh "$OUT"
```
If a flag is rejected by the installed CLI version, check `npx @gltf-transform/cli optimize --help`
and adjust. **After optimizing, run `npx @gltf-transform/cli inspect public/models/car.glb`** and
confirm `Wheel_FL/FR/RL/RR` and the materials `BrakeLight` and `Headlight` survived. Do the same for
`signal.glb` and the three `Lamp_*` materials. If they didn't, drop `optimize` for that asset and
run `meshopt` + `webp` as separate commands instead.

`scripts/check-models.mjs`: port
`~/Desktop/GravityGrid-App/GravityGrid-FE/apps/student/scripts/check-models-compressed.mjs` (reads the
GLB JSON chunk, fails if neither `EXT_meshopt_compression` nor `KHR_draco_mesh_compression` is
used). Also fail if the total size of `public/models` exceeds **1.5 MB**. Wire it to `predev` and
`prebuild` in `package.json`.

**Size budget:** car 400 KB · signal 60 KB · road 300 KB · tree 80 KB · streetlight 80 KB ·
buildings 400 KB → total ≤ 1.4 MB.

**Verify (Blender phase):** six GLBs in `public/models`, budget met, node names intact, the
`.blend` saved, and every script saved under `blender/scripts/`.

---

## 4. React app architecture

### 4.1 Source layout

```
src/
├── main.tsx, App.tsx            # router: "/" Landing, "/drive" Drive, "/analyze" Analyze
├── index.css                    # tailwind + fonts + design tokens
├── assets/fonts/
├── models.ts                    # MODEL_PATHS registry + useGLTF.preload (as in GravityGrid)
├── sim/
│   ├── constants.ts             # physics + track constants (4.2)
│   ├── DriveSim.ts              # plain class: fixed-step physics, signals, recorder. No React.
│   ├── signals.ts               # signal state machine
│   └── analysis.ts              # segment detection, area/slope helpers, question generation
├── store/
│   └── useDriveStore.ts         # zustand: game phase, final DriveRecord, quiz answers
├── scene/
│   ├── Car.tsx                  # loads car.glb, spins wheels, drives BrakeLight emissive
│   ├── TrafficSignal.tsx        # loads signal.glb, drives Lamp_* emissive per state
│   ├── Street.tsx               # road tiles, buildings, trees, streetlights (instanced)
│   ├── ChaseCamera.tsx
│   ├── Environment.tsx          # sky, sun, Lightformer env, fog, postprocessing
│   └── HeroScene.tsx            # landing hero: car accelerating on a loop
├── ui/
│   ├── Navbar.tsx, GlassCard.tsx, Badge.tsx, Background.tsx
│   ├── Hud.tsx                  # speed, distance, time, next-signal, score
│   ├── LiveGraph.tsx            # <canvas> v–t graph, redrawn from the sim's sample buffer
│   ├── BrakeButton.tsx
│   ├── ResultGraph.tsx          # SVG v–t graph with phase colours, hover, region highlights
│   └── QuestionCard.tsx
└── pages/
    ├── Landing.tsx
    ├── Drive.tsx
    └── Analyze.tsx
```

### 4.2 Physics model (`sim/constants.ts`)

Keep it piecewise-constant on purpose, so the v–t graph is made of clean straight segments that
students can read slopes and areas from.

| Constant | Value |
|---|---|
| `ACCEL` (auto, brake released) | **2.0 m/s²** |
| `V_MAX` (then cruise, a = 0) | **16 m/s** (57.6 km/h) |
| `BRAKE_DECEL` (brake held) | **5.0 m/s²** (v clamped at 0) |
| `DT` (fixed step) | 1/120 s, accumulator pattern |
| `SAMPLE_DT` (graph recording) | 0.05 s |
| Signal stop-line positions (x, m) | 150, 300, 450, 600 (stop line 3 m before each pole) |
| Finish line | x = 700 m |

Acceleration is chosen as: brake held → −5 (until v = 0, then 0); else v < V_MAX → +2; else 0.
Phase label per sample: `accelerate | cruise | brake | stopped`.

### 4.3 Signals (`sim/signals.ts`)

Each signal has a seeded config (one fixed seed per "level", so replays are fair): `turnsRed`
(three of the four do; one stays green to test whether the student brakes when they don't need to),
`triggerDist` ∈ [45, 70] m, and `redDuration` ∈ [4, 6] s.

State machine: `GREEN` → (car's distance to the stop line ≤ `triggerDist`, and `turnsRed`) →
`YELLOW` for 2.0 s → `RED` for `redDuration` → `GREEN`. Sanity check: the stopping distance from
V_MAX is v²/2a = 256/10 = 25.6 m, so a 45–70 m trigger plus a 2 s amber is always stoppable if the
player reacts.

Rules and scoring (start at 100): crossing the stop line on RED → **−30**, "Ran the red light".
Crossing on YELLOW → 0, "Made it on amber". Stopping 0–2 m before the line → **+10** "Perfect stop";
2–6 m → +5; more than 10 m early → −5 "Too cautious". Braking to a full stop at a green signal →
−5. Show each result as a toast.

### 4.4 `DriveSim` — the one source of truth

A plain TS class (GravityGrid's `SimulationClock` philosophy):

```ts
class DriveSim {
  t = 0; x = 0; v = 0; a = 0; braking = false; finished = false;
  signals: SignalState[]; samples: Sample[] = [];   // {t, x, v, a, phase}
  events: DriveEvent[] = [];                          // {t, x, type, signal?}
  step(frameDt: number): void   // accumulator → fixed DT steps; records a sample every SAMPLE_DT
  setBrake(on: boolean): void   // also logs brake-start / brake-end events
  toRecord(): DriveRecord       // frozen copy for the store when finished
}
```
Event types: `signal-yellow`, `signal-red`, `signal-green`, `brake-start`, `brake-end`, `stopped`,
`moved-off`, `crossed-line` (with the signal colour), `finish`.

**Performance rule (from GravityGrid):** never call React `setState` per frame. `useFrame` calls
`sim.step(dt)` and writes straight to refs (car position, wheel rotation, lamp emissive). The HUD
reads the sim through a throttled hook (`useThrottled(sim => …, 10 Hz)`). `LiveGraph` draws on a 2D
`<canvas>` in its own rAF loop, reading `sim.samples` directly.

### 4.5 3D scene (realism checklist)

- `<Canvas shadows dpr={[1, 2]} gl={{ antialias: true, toneMapping: THREE.ACESFilmicToneMapping }}>`,
  sRGB output.
- **Golden-hour lighting:** drei `<Sky sunPosition={[100, 20, -60]} turbidity={6} rayleigh={1.5}/>`.
  A warm directional sun (intensity ~3, colour #ffd6a0) with a 2048 shadow map whose shadow camera
  follows the car (a tight ±25 m frustum), plus a soft hemisphere fill.
- **Reflections without downloading an HDRI:** drei `<Environment resolution={256}>` with 3–4
  `<Lightformer>`s (a big warm rectangle as the sky, a long strip above the road). This makes the
  clearcoat car paint and the glass read as real.
- `<fog attach="fog" args={["#e8c9a8", 60, 320]}/>` to hide the end of the road and add depth.
- Postprocessing (`@react-three/postprocessing`): `Bloom` (luminanceThreshold 0.9, mipmapBlur) so the
  lamps, brake lights and lit windows glow; a subtle `Vignette`; `SMAA`. Optional: `ToneMapping`.
- drei `<ContactShadows>` under the car for grounding.
- **Car:** wheels rotate around three's local **Z**: `wheel.rotation.z -= dx / 0.34`. The front
  wheels' rotation is also visual only, no steering. `BrakeLight` `emissiveIntensity` goes 0.4 → 6 when
  braking, lerped over 80 ms. Add a small body pitch: nose dips about 1.5° under braking and lifts
  about 0.8° under acceleration (spring-damped), which sells the weight transfer.
- **Signals:** clone `signal.glb` per signal and grab materials by name (clone the `Lamp_*`
  materials per instance). The active lamp gets `emissiveIntensity` 8, inactive lamps 0.05. Add a
  small `pointLight` in the lamp's colour (intensity 2, distance 12) so the road picks up the colour
  at night/dusk. Each signal also gets a white stop-line plane and a zebra crossing.
- **Street:** 12 road tiles (0–720 m). Buildings, trees and streetlights are placed with drei
  `<Instances>`/`<Merged>` from a seeded layout on both sides (buildings set back 8–12 m, trees every
  12 m on the sidewalk, streetlights every 30 m alternating sides). Add a few parked/static cars
  along the kerb by cloning `car.glb` with a different `CarPaint` colour (silver, white, navy).
- **Chase camera:** behind and above (−9, 3.2, 0 relative to the car), looking 8 m ahead. Lerp the
  position (critically damped, no jitter); FOV widens 55° → 63° with speed. Add a small camera shake
  over 12 m/s.
- Loading: `<Suspense>` with a GravityGrid-styled loader (pulsing indigo dot + "Warming up the
  engine…"). Preload all GLBs from `models.ts`.

---

## 5. Pages

### 5.1 Landing (`/`) — the hero is the accelerating car

Background, navbar and type follow §2. Layout:

1. **Navbar:** SignalDrive wordmark (Geist bold, with a small gradient dot), links "How it works",
   and an indigo pill CTA "Start Driving →".
2. **Hero** (full viewport). The `HeroScene` canvas is behind the copy, at reduced opacity on the
   left side via a gradient mask. In it, the car accelerates from rest along a short road at 2 m/s²,
   reaches V_MAX, brakes at a red signal, waits, then loops. The camera is a slow low-angle side
   tracking shot. Synchronised with the loop, a small glass card (bottom-right) draws the live v–t
   line of that hero car. That is the product pitch in one glance.
   - Badge: "PHYSICS IN MOTION"
   - H1: `Every drive draws a graph.` / gradient line `Can you read yours?`
   - Sub: "Hit the gas — well, the car does. You control the brake. Beat the signals, then decode the
     speed–time graph your drive leaves behind."
   - CTAs: white "Start Driving" (Zap icon) → `/drive`; secondary "How it works" (scrolls).
3. **How it works:** a 4-step glass card (GravityGrid's `Step` style): 1. Accelerate (the car does
   it for you) · 2. Brake (hold Space or the button) · 3. Watch the graph (live v–t) · 4. Analyze
   (answer questions from your own drive).
4. **Three feature cards:** "Slope = acceleration" (TrendingUp, cyan), "Area = distance"
   (AreaChart, purple), "Your data, your questions" (Target, emerald).
5. **Footer.**

### 5.2 Drive (`/drive`)

- 3-2-1 countdown overlay (big gradient numerals), then the car starts accelerating.
- **HUD** (glass cards, top-left): speed in km/h, big, monospaced, plus m/s underneath; distance;
  time; a "Next signal: 48 m · 🔴" chip; score.
- **LiveGraph** (bottom-right glass card, 360×200 on desktop, collapsible on mobile): axes
  `v (m/s)` 0–18 and `t (s)` scrolling over the last 30 s. The line is coloured by phase (§2 colours).
  Signal events are drawn as dashed vertical markers with tiny coloured dots.
- **BrakeButton** (bottom-centre, 88 px round, rose glow while held). Keyboard: **Space** or **↓**.
  Pointer down/up so it works on touch; `preventDefault` on Space so the page doesn't scroll.
- Toasts for signal results.
- On finish: freeze, store `sim.toRecord()` in `useDriveStore`, show a "Drive complete" card with the
  score, then a CTA "Analyze my drive →" `/analyze`.
- Pause on tab blur (`visibilitychange`), and a restart button.

### 5.3 Analyze (`/analyze`)

- Top: **ResultGraph** for the whole drive (SVG, responsive). Phase-coloured segments, signal markers,
  a hover crosshair showing `t, v, x`, and a legend.
- Stats row: total time, total distance, max speed, average speed, number of stops, score.
- Then the **question flow** (one `QuestionCard` at a time, with progress dots). When a question
  refers to part of the drive, the ResultGraph highlights that region: a shaded area for "area"
  questions, a tangent/slope triangle for "slope" questions.
- Numeric answers: tolerance ±5 % (or ±0.5 absolute for small values). MCQ: instant feedback. Every
  question has a **worked solution** that uses the student's own numbers.
- End: score summary plus "Drive again".
- If there's no `DriveRecord` (direct visit), use the bundled `REFERENCE_DRIVE` (a scripted drive
  generated by running `DriveSim` with a fixed brake schedule) and show a banner "Using a sample
  drive".

---

## 6. Question bank

`sim/analysis.ts` turns the samples into **segments** (consecutive samples with the same phase,
keeping only those ≥ 0.5 s long; micro-taps get merged into their neighbour). Each segment holds
`{phase, t0, t1, v0, v1, x0, x1}`. The slope of a segment is `(v1-v0)/(t1-t0)`; its area is
`x1 - x0` (also computed as `½(v0+v1)(t1-t0)` in the explanation). Every data-driven question below
declares which segments it needs. If the run doesn't have them (for example, the player never
stopped), substitute the matching segment from `REFERENCE_DRIVE` and say so in the question text.

Show 10 questions per round: all 6 data-driven ones (D) plus 4 conceptual ones (C) drawn at random.

### A. Data-driven — computed from the player's own graph (numeric input)

| # | Prompt (template) | Answer | Worked solution shown |
|---|---|---|---|
| D1 | "From t = {t0} s to t = {t1} s your speed rose from {v0} to {v1} m/s. What was the car's acceleration?" (first `accelerate` segment) | slope ≈ 2.0 m/s² | a = Δv/Δt = ({v1}−{v0})/({t1}−{t0}) |
| D2 | "How long did your car take to reach its top speed from rest at the start?" | t at first `cruise` start | read off where the line flattens; check: t = v/a = 16/2 = 8 s |
| D3 | "How far did the car travel during those first {t1} seconds?" (shaded triangle) | area = x1−x0 ≈ 64 m | area of triangle = ½ × base × height = ½ × {t} × {v} |
| D4 | "You braked for signal {n} from {v0} m/s to {v1} m/s in {Δt} s. What was the deceleration?" | 5.0 m/s² | a = (v1−v0)/Δt = negative → retardation of 5 m/s² |
| D5 | "How far did the car travel while braking for signal {n}?" (shaded trapezoid/triangle) | area | ½ (v0+v1) Δt ; cross-check with v² = u² − 2as |
| D6 | "What was your average speed for the whole drive?" | total x / total t | v_avg = total distance / total time = {X}/{T}. Note how it differs from the "average of speeds". |

Extra data-driven questions, used to vary repeat attempts:
- D7: "For how long was the car stationary at signal {n}?" (length of a `stopped` segment).
- D8: "At t = {t} s, what was the car's speed? Read it from the graph." (instantaneous read-off).
- D9: "When signal {n} turned yellow you were doing {v} m/s, {d} m from the line. What is the minimum
  braking distance at 5 m/s²? Could you have stopped?" (v²/2a vs d; yes/no plus the number).
- D10: "Between t = {ta} and {tb} the graph is flat at {v} m/s. How far did you travel in that
  interval?" (rectangle area = v·Δt).

### B. Conceptual — multiple choice (fixed, shuffled options)

| # | Question | Correct answer | Distractors |
|---|---|---|---|
| C1 | What does the **slope** of a speed–time graph represent? | Acceleration | Distance travelled · Speed · Time taken |
| C2 | What does the **area under** a speed–time graph represent? | Distance travelled | Acceleration · Average speed · Force |
| C3 | While your car waited at the red light, what did the graph look like? | A horizontal line on the time axis (v = 0) | A line sloping upward · A vertical line · The graph stops |
| C4 | While cruising at top speed, the car's acceleration was… | Zero — the line is horizontal | Maximum · Negative · Equal to its speed |
| C5 | The braking parts of your graph slope downward. This means… | The car has negative acceleration (it is decelerating) | The car is moving backward · Time is decreasing · The car has stopped |
| C6 | Which part of your graph is steeper, accelerating or braking? Why? | Braking: 5 m/s² is larger in size than 2 m/s² | Accelerating, because the engine is stronger · Both the same · Depends on the speed |
| C7 | If the brakes were twice as strong (10 m/s²), the stopping distance from the same speed would… | Halve (s = v²/2a) | Double · Quarter · Stay the same |
| C8 | If you were going twice as fast, the stopping distance at the same braking would become… | 4 times as long (s ∝ v²) | Twice as long · The same · Half as long |
| C9 | A driver reacts 0.5 s late while doing 16 m/s. How much extra distance do they cover before braking starts? | 8 m (16 × 0.5) | 4 m · 16 m · 32 m |
| C10 | A straight line sloping upward on a v–t graph means… | Uniform (constant) acceleration | Constant speed · Increasing acceleration · The car is at rest |
| C11 | Two cars reach 16 m/s; car A in 8 s, car B in 4 s. Whose v–t line is steeper, and what is B's acceleration? | Car B, 4 m/s² | Car A, 2 m/s² · Same steepness · Car B, 2 m/s² |
| C12 | Why did braking to a full stop at a green light lower your score, in physics terms? | It wasted time and the distance you could have covered; your average speed fell | It damaged the car · Green means accelerate harder · No physics reason |

Store questions as data (`{id, kind: "numeric" | "mcq", needs: SegmentQuery[], build(record) =>
{prompt, answer, unit, tolerance, highlight, solution}}`) in a registry array. Adding a question
means adding an entry, not editing `QuestionCard` (the open/closed pattern GravityGrid uses for
inputs).

---

## 7. Execution order and verification

1. §0 preconditions → §1 scaffold → `npm run dev` shows the default Vite page. **Verify.**
2. Design system and the Landing page with a **placeholder box car** in `HeroScene` → screenshot it
   in Chrome (claude-in-chrome) and compare with GravityGrid's landing (`npm run dev` in
   GravityGrid-FE/apps/student if needed, port 3000). **Verify the visual match.**
3. Blender §3.2 → §3.7, one asset at a time, each one checked with `look` → §3.8 optimize + inspect.
   **Verify the budget and node names.**
4. `DriveSim` + signals + analysis. Write a tiny node script (`scripts/sim-smoke.ts`, run with
   `npx tsx`) that runs a scripted drive and prints the segments. Check that slopes are exactly +2 /
   0 / −5 and that the areas add up to the final x. **Verify.**
5. Drive page: scene, HUD, LiveGraph, brake, scoring → play it through in Chrome, take screenshots,
   and check there are no console errors. FPS should be ≥ 55 on a laptop (use drei `<Perf>` or
   `<Stats>` temporarily).
6. Analyze page and the question bank → play a drive, answer all 10 questions, and check that the
   solutions show the right numbers. Also visit `/analyze` directly to check the reference-drive
   fallback.
7. Swap the hero placeholder for the real car, then polish (bloom, fog, camera).
8. Check mobile layout at 390 px width: the brake button can be reached with a thumb and the graph
   card collapses.
9. `npm run build` passes, including the model guard; `npm run lint` is clean. Write a short
   README (how to run, how to rebuild models).

## 8. Things that will bite (read before starting)

- Procedural Blender shader nodes **don't survive glTF export**: use image textures only.
- `gltf-transform optimize` defaults to join, flatten and palette, which merge the wheels and lamp
  materials. Keep them off for `car` and `signal` (§3.8) and confirm with `inspect`.
- The Blender Y axis becomes three −Z: the wheels spin around **Z** in three, not X.
- `export_apply=True` applies the modifiers (bevel, solidify, smooth-by-angle) at export time. Don't
  apply them by hand, except the booleans in the car script.
- Clone materials per instance before changing emissive values, or every signal lights up together.
- Never put per-frame values in React state; use refs, the canvas and throttled reads (§4.4).
- Drei's `<Environment preset=…>` downloads HDRIs from a CDN. Use the Lightformer approach (§4.5)
  so the app works offline and stays small.
