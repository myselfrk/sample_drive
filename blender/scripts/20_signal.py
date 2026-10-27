exec(open(os.path.expanduser("~/Desktop/SignalDrive/blender/scripts/00_common.py")).read()) if "principled" not in globals() else None

new_collection("SignalCol")
root = empty("Signal")
root.location = (0, 6, 0)
metal = mat("PoleMetal", (0.08, 0.09, 0.10), metallic=0.8, rough=0.45)
housing = mat("Housing", (0.03, 0.03, 0.03), rough=0.55)
cyl("Pole", (0, 0, 1.5), 0.07, 3.0, metal, root, verts=24)
cyl("Base", (0, 0, 0.07), 0.17, 0.14, metal, root, verts=24)
cyl("BaseCollar", (0, 0, 0.18), 0.10, 0.08, metal, root, verts=24)
# signal head: housing + backplate, lamps face -X (towards the oncoming car, which travels +X)
box("Housing", (0, 0, 3.45), (0.32, 0.36, 1.02), housing, root, 0.04)
box("Backplate", (0.17, 0, 3.45), (0.03, 0.62, 1.22), housing, root, 0.01)
box("Arm", (0, 0, 2.95), (0.12, 0.12, 0.10), metal, root, 0.01)
for i, (name, col) in enumerate((("Lamp_Red", (1, 0.05, 0.03)), ("Lamp_Yellow", (1, 0.65, 0.0)), ("Lamp_Green", (0.1, 1, 0.35)))):
    z = 3.77 - i * 0.32
    lm = mat(name, tuple(c * 0.25 for c in col), rough=0.2, emission=col, emit_strength=0.0)  # runtime turns it on
    bpy.ops.mesh.primitive_uv_sphere_add(radius=0.11, segments=24, ring_count=12, location=(-0.15, 0, z))
    l = bpy.context.active_object; l.name = name; l.scale = (0.35, 1, 1); l.data.materials.append(lm); l.parent = root
    bpy.ops.object.transform_apply(scale=True); smooth(l)
    # visor: half tube over each lamp
    v = cyl(f"Visor_{i}", (-0.25, 0, z), 0.14, 0.18, housing, root, rot=(0, math.pi / 2, 0), verts=24)
    bm = bmesh.new(); bm.from_mesh(v.data)
    # cylinder axis is local Z; rotating +90 deg about Y maps local +X to world -Z, so local x > 0 is the lower half
    bmesh.ops.delete(bm, geom=[f for f in bm.faces if abs(f.normal.z) > 0.9 or f.calc_center_median().x > 0.02], context="FACES")
    bm.to_mesh(v.data); bm.free()
    m = v.modifiers.new("Solid", "SOLIDIFY"); m.thickness = 0.012
    smooth(v)
print("signal built:", len(root.children_recursive), "parts")
