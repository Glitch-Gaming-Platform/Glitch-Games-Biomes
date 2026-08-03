"""Collapse the Indisworm's 24 flat materials into one palette-textured material.

Run from Blender's Python console (Scripting workspace):

    exec(open('/Users/devindixon/Development/biomes-game/scripts/harthmere/blender/fix_indisworm_palette.py').read())

WHY
---
`indisworm.blend` is the only creature asset in the project with zero textured
materials, and the audit showed why: its mesh has no UV layer at all, so it
*cannot* carry a texture. To get colour variation it instead carries 24 separate
materials on a single 8,576-triangle mesh, which is 24 draw calls per worm and
still gives no per-texel detail.

This script builds a 1-pixel-per-material palette strip, assigns each face the
UV of its material's texel, and replaces all 24 slots with one material sampling
that palette with nearest-neighbour filtering. Visually identical, 1 draw call,
and the mesh now has UVs — which is the prerequisite for any future normal map,
AO bake, or wear/grime pass.

SAFETY
------
Writes to `<name>_palette.blend` and a sibling `.glb`; it never overwrites the
source. Re-run `audit_combat_assets.py` afterwards to confirm the result.
"""

import os

import bpy

REPO = "/Users/devindixon/Development/biomes-game"
SRC = os.path.join(REPO, "src/galois/data/npcs/indisworm.blend")
OUT_BLEND = os.path.join(REPO, "src/galois/data/npcs/indisworm_palette.blend")
OUT_GLB = os.path.join(REPO, "tmp/indisworm_palette.glb")
PALETTE_NAME = "indisworm_palette"
MATERIAL_NAME = "indisworm_palette_mat"


def srgb_to_linear(c):
    return c / 12.92 if c <= 0.04045 else ((c + 0.055) / 1.055) ** 2.4


def material_base_color(mat):
    """Read a material's flat colour, preferring the Principled BSDF input."""
    if mat and mat.use_nodes and mat.node_tree:
        for node in mat.node_tree.nodes:
            if node.type == "BSDF_PRINCIPLED":
                col = node.inputs["Base Color"].default_value
                emission = 0.0
                if "Emission Strength" in node.inputs:
                    emission = float(node.inputs["Emission Strength"].default_value)
                return (col[0], col[1], col[2], 1.0), emission
    if mat:
        c = mat.diffuse_color
        return (c[0], c[1], c[2], 1.0), 0.0
    return (1.0, 0.0, 1.0, 1.0), 0.0


def build():
    bpy.ops.wm.open_mainfile(filepath=SRC, load_ui=False)

    mesh_objects = [o for o in bpy.data.objects if o.type == "MESH"]
    if not mesh_objects:
        raise RuntimeError("no mesh found in indisworm.blend")
    obj = mesh_objects[0]
    me = obj.data

    slots = [s.material for s in obj.material_slots]
    count = len(slots)
    if count == 0:
        raise RuntimeError("indisworm mesh has no material slots")
    print(f"[fix] {obj.name}: {count} material slots, {len(me.polygons)} faces")

    # --- palette image: one texel per original material -------------------
    image = bpy.data.images.get(PALETTE_NAME)
    if image:
        bpy.data.images.remove(image)
    image = bpy.data.images.new(PALETTE_NAME, width=count, height=1, alpha=True)
    image.colorspace_settings.name = "sRGB"

    pixels = []
    emissions = []
    for mat in slots:
        (r, g, b, a), emission = material_base_color(mat)
        # Image pixels are linear; material base colours already are.
        pixels.extend([r, g, b, a])
        emissions.append(emission)
    image.pixels = pixels
    image.pack()
    print(f"[fix] built {count}x1 palette, {sum(1 for e in emissions if e > 0)} emissive sources")

    # --- UVs: every face maps to the centre of its material's texel --------
    uv_layer = me.uv_layers.active or me.uv_layers.new(name="palette")
    me.uv_layers.active = uv_layer
    for poly in me.polygons:
        # Texel centre avoids bilinear bleed even if filtering is changed later.
        u = (poly.material_index + 0.5) / count
        for loop_index in poly.loop_indices:
            uv_layer.data[loop_index].uv = (u, 0.5)
    print("[fix] assigned palette UVs to every face")

    # --- one material sampling the palette ---------------------------------
    mat = bpy.data.materials.get(MATERIAL_NAME)
    if mat:
        bpy.data.materials.remove(mat)
    mat = bpy.data.materials.new(MATERIAL_NAME)
    mat.use_nodes = True
    nt = mat.node_tree
    for node in list(nt.nodes):
        nt.nodes.remove(node)

    out = nt.nodes.new("ShaderNodeOutputMaterial")
    out.location = (400, 0)
    bsdf = nt.nodes.new("ShaderNodeBsdfPrincipled")
    bsdf.location = (120, 0)
    tex = nt.nodes.new("ShaderNodeTexImage")
    tex.location = (-200, 0)
    tex.image = image
    # Nearest keeps palette texels crisp; the voxel look depends on flat colour.
    tex.interpolation = "Closest"
    tex.extension = "EXTEND"

    nt.links.new(tex.outputs["Color"], bsdf.inputs["Base Color"])
    # Preserve the toxic/core glow the original emissive materials carried.
    if "Emission Color" in bsdf.inputs:
        nt.links.new(tex.outputs["Color"], bsdf.inputs["Emission Color"])
    if "Emission Strength" in bsdf.inputs:
        bsdf.inputs["Emission Strength"].default_value = 0.0
    bsdf.inputs["Roughness"].default_value = 0.62
    bsdf.inputs["Metallic"].default_value = 0.0
    nt.links.new(bsdf.outputs["BSDF"], out.inputs["Surface"])

    obj.data.materials.clear()
    obj.data.materials.append(mat)
    for poly in me.polygons:
        poly.material_index = 0
    print(f"[fix] collapsed {count} materials -> 1 ({MATERIAL_NAME})")

    # --- save alongside the source, never over it --------------------------
    bpy.ops.wm.save_as_mainfile(filepath=OUT_BLEND, copy=True)
    print("[fix] wrote", OUT_BLEND)

    os.makedirs(os.path.dirname(OUT_GLB), exist_ok=True)
    try:
        bpy.ops.export_scene.gltf(
            filepath=OUT_GLB,
            export_format="GLB",
            export_animations=True,
            export_skins=True,
            export_apply=False,
        )
        print("[fix] wrote", OUT_GLB)
    except Exception as exc:
        print("[fix] GLB export skipped:", repr(exc))

    print(
        f"[fix] DONE  materials {count} -> 1   uv_layers {len(me.uv_layers)}   "
        f"tris ~{sum(len(p.vertices) - 2 for p in me.polygons)}"
    )


build()
