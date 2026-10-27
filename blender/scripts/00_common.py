import bpy, bmesh, math, os
import numpy as np
from mathutils import Vector

ROOT = os.path.expanduser("~/Desktop/SignalDrive/blender")
TEX = os.path.join(ROOT, "textures"); EXP = os.path.join(ROOT, "exports")
os.makedirs(TEX, exist_ok=True); os.makedirs(EXP, exist_ok=True)


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


def textured_mat(name, color_png, normal_png=None, rough=0.85, emissive_png=None, emit_strength=1.0):
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
    if emissive_png:
        eimg = nt.nodes.new("ShaderNodeTexImage"); eimg.image = bpy.data.images.load(emissive_png, check_existing=True)
        nt.links.new(eimg.outputs["Color"], b.inputs["Emission Color"])
        b.inputs["Emission Strength"].default_value = emit_strength
    return m


def save_png(name, rgb):  # rgb: (h, w, 3) floats 0..1, row 0 = bottom
    h, w, _ = rgb.shape
    img = bpy.data.images.new(name, w, h, alpha=False)
    rgba = np.concatenate([np.clip(rgb, 0, 1), np.ones((h, w, 1))], axis=2).astype(np.float32)
    img.pixels.foreach_set(rgba.ravel())
    path = os.path.join(TEX, name + ".png")
    img.filepath_raw = path; img.file_format = "PNG"; img.save()
    bpy.data.images.remove(img)
    return path


def tile_noise(n, blur, seed):  # tileable: np.roll wraps around the edges
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
    if material: me.materials.append(material)
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


def box(name, loc, size, material, parent, bev=0.0):
    """Axis-aligned box with `size` = full extents (x, y, z) centred on `loc`."""
    bpy.ops.mesh.primitive_cube_add(size=1, location=loc)
    o = bpy.context.active_object; o.name = name; o.scale = size
    bpy.ops.object.transform_apply(scale=True)
    o.data.materials.append(material)
    if parent: o.parent = parent
    if bev: bevel(o, bev, 3)
    return o


def cyl(name, loc, radius, depth, material, parent, rot=(0, 0, 0), verts=32):
    bpy.ops.mesh.primitive_cylinder_add(vertices=verts, radius=radius, depth=depth, location=loc, rotation=rot)
    o = bpy.context.active_object; o.name = name; o.data.materials.append(material)
    if parent: o.parent = parent
    return o


def bevel(ob, width=0.03, segments=3):
    m = ob.modifiers.new("Bevel", "BEVEL"); m.width = width; m.segments = segments
    m.limit_method = "ANGLE"; return m


def smooth(ob, angle=35):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    try:
        bpy.ops.object.shade_smooth_by_angle(angle=math.radians(angle))
    except Exception:
        bpy.ops.object.shade_smooth()
    ob.select_set(False)


def apply_mods(ob):
    bpy.ops.object.select_all(action="DESELECT")
    bpy.context.view_layer.objects.active = ob; ob.select_set(True)
    for m in list(ob.modifiers):
        bpy.ops.object.modifier_apply(modifier=m.name)
    ob.select_set(False)


def select_tree(root):
    bpy.ops.object.select_all(action="DESELECT")
    for o in [root, *root.children_recursive]: o.select_set(True)
    bpy.context.view_layer.objects.active = root


def export_glb(root, filename):
    """Export `root` and its children at the origin, then put root back where it was."""
    old = root.location.copy(); root.location = (0, 0, 0)
    bpy.context.view_layer.update()
    select_tree(root)
    kw = dict(filepath=os.path.join(EXP, filename), use_selection=True, export_apply=True, export_yup=True,
              export_materials="EXPORT", export_cameras=False, export_lights=False)
    try:
        bpy.ops.export_scene.gltf(export_format="GLB", **kw)
    except TypeError as e:  # the message lists the valid enum values
        print("GLB rejected:", e); raise
    root.location = old
    p = os.path.join(EXP, filename)
    print("exported", p, os.path.getsize(p) // 1024, "KB")


def new_collection(name):
    c = bpy.data.collections.get(name) or bpy.data.collections.new(name)
    if c.name not in bpy.context.scene.collection.children:
        bpy.context.scene.collection.children.link(c)
    bpy.context.view_layer.active_layer_collection = bpy.context.view_layer.layer_collection.children[c.name]
    return c


def clear_scene():
    for o in list(bpy.data.objects): bpy.data.objects.remove(o, do_unlink=True)
    for c in list(bpy.data.collections): bpy.data.collections.remove(c)
    for blk in (bpy.data.meshes, bpy.data.materials, bpy.data.images):
        for x in list(blk):
            if x.users == 0: blk.remove(x)
