#!/usr/bin/env python3
"""Generate reusable native-placeable Harthmere furniture and exact icons.

The meshes share the same procedural builders and visual language as the 19
business interiors. Each catalogue item exports a compressed near mesh, a
compressed low-detail mesh, a transparent 256px inventory icon, a JSON runtime
manifest, and a generated TypeScript lookup used by native ECS/Bikkie loading.

Run:
  blender --factory-startup --background \
    --python scripts/harthmere/blender/generate_business_furniture_catalogue.py -- \
    --repo-root "$PWD"
"""

from __future__ import annotations

import argparse
import json
import subprocess
import sys
from dataclasses import dataclass
from pathlib import Path

import bpy
from mathutils import Vector

SCRIPT_DIR = Path(__file__).resolve().parent
if str(SCRIPT_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPT_DIR))

from generate_business_interiors import (  # noqa: E402
    Business,
    Piece,
    box,
    build_piece,
    clear_scene,
    compress_glb,
    create_context,
    delete_context,
    export_context,
    finish_object,
    gltfpack_path,
    join_by_material,
    look_at,
    make_material,
    move_to_collection,
    tint,
    torus,
)


GENERATOR_VERSION = 2
ASSET_VERSION = "harthmere-business-furniture-blender-v2-town-accents"


@dataclass(frozen=True)
class FurnitureAsset:
    item_id: str
    display_name: str
    kind: str
    dimensions: tuple[float, float, float]
    box_size: tuple[float, float, float]
    collidable_size: tuple[float, float, float]
    surface: str = "floor"
    placement_type: str = "floorCenter"
    category: str = "furniture"
    variant: str = "standard"


CATALOGUE: tuple[FurnitureAsset, ...] = (
    FurnitureAsset("business_service_counter", "Service Counter", "counter", (1.90, 0.84, 0.95), (2, 1, 1), (1.88, 0.95, 0.82), category="business"),
    FurnitureAsset("bench", "Bench", "bench", (1.80, 0.68, 0.95), (2, 1, 1), (1.78, 0.95, 0.66)),
    FurnitureAsset("table", "Table", "table", (1.80, 1.35, 0.95), (2, 1, 2), (1.78, 0.95, 1.33)),
    FurnitureAsset("t_table", "T-Table", "t_table", (1.80, 1.80, 0.95), (2, 1, 2), (1.78, 0.95, 1.78)),
    FurnitureAsset("wooden_chair", "Wooden Chair", "wooden_chair", (0.72, 0.72, 0.95), (1, 1, 1), (0.70, 0.95, 0.70)),
    FurnitureAsset("padded_chair", "Padded Chair", "padded_chair", (0.78, 0.78, 0.98), (1, 1, 1), (0.76, 0.98, 0.76), variant="upholstered"),
    FurnitureAsset("small_bed", "Small Bed", "bed", (1.80, 2.70, 0.90), (2, 1, 3), (1.78, 0.90, 2.68)),
    FurnitureAsset("fancy_bed", "Fancy Bed", "bed", (1.90, 2.78, 0.95), (2, 1, 3), (1.88, 0.95, 2.76), variant="fancy"),
    FurnitureAsset("shelf", "Shelf", "shelf", (0.86, 0.52, 1.86), (1, 2, 1), (0.84, 1.86, 0.50)),
    FurnitureAsset("display_shelf", "Display Shelf", "shelf", (0.90, 0.56, 1.90), (1, 2, 1), (0.88, 1.90, 0.54), variant="display"),
    FurnitureAsset("wood_container", "Wood Container", "wood_container", (0.88, 0.82, 0.86), (1, 1, 1), (0.86, 0.86, 0.80), category="storage"),
    FurnitureAsset("treasure_chest", "Treasure Chest", "treasure_chest", (0.94, 0.82, 0.90), (1, 1, 1), (0.92, 0.90, 0.80), category="storage", variant="ornate"),
    FurnitureAsset("cargo_crate", "Cargo Crate", "cargo_crate", (0.92, 0.88, 0.92), (1, 1, 1), (0.90, 0.92, 0.86), category="storage"),
    FurnitureAsset("lockbox", "Lockbox", "lockbox", (0.78, 0.68, 0.62), (1, 1, 1), (0.76, 0.62, 0.66), category="storage"),
    FurnitureAsset("wardrobe_storage", "Wardrobe", "cabinet", (1.82, 0.78, 2.72), (2, 3, 1), (1.80, 2.72, 0.76), category="storage"),
    FurnitureAsset("wall_lantern", "Wall Lantern", "wall_lantern", (0.52, 0.38, 0.82), (1, 1, 1), (0.50, 0.82, 0.36), surface="wall", placement_type="wallCenter", category="lighting"),
    # Harthmere-authored town accents. These replace the mixed legacy OBJ and
    # third-party prop-pack pieces that were visually inconsistent and much
    # heavier than the shared furniture catalogue. Every accent is deliberately
    # reusable, native-placeable and inventory-backed rather than welded into a
    # one-off building mesh.
    FurnitureAsset("town_forge_anvil", "Harthmere Forge Anvil", "anvil", (1.16, 0.76, 0.88), (2, 1, 1), (1.14, 0.88, 0.74), category="fixture", variant="forge"),
    FurnitureAsset("town_workbench", "Harthmere Workbench", "workbench", (1.82, 0.86, 0.98), (2, 1, 1), (1.78, 0.98, 0.82), category="fixture", variant="workbench"),
    FurnitureAsset("town_tool_rack", "Harthmere Tool Rack", "rack", (1.46, 0.52, 1.82), (2, 2, 1), (1.42, 1.80, 0.50), category="fixture", variant="tools"),
    FurnitureAsset("town_rope_rack", "Harthmere Rope Rack", "rack", (1.38, 0.52, 1.68), (2, 2, 1), (1.34, 1.66, 0.50), category="fixture", variant="rope"),
    FurnitureAsset("town_produce_crate", "Harthmere Produce Crate", "produce_bins", (1.22, 0.92, 0.86), (2, 1, 1), (1.18, 0.84, 0.88), category="storage", variant="produce"),
    FurnitureAsset("town_wash_tub", "Harthmere Wash Tub", "trough", (1.42, 0.92, 0.82), (2, 1, 1), (1.38, 0.80, 0.88), category="fixture", variant="wash"),
    FurnitureAsset("town_textile_drape", "Harthmere Textile Drape", "board", (1.32, 0.18, 1.50), (2, 2, 1), (1.28, 1.48, 0.16), surface="wall", placement_type="wallCenter", category="wall_decor", variant="textile"),
    FurnitureAsset("town_record_stack", "Harthmere Record Stack", "shelf", (0.86, 0.56, 0.88), (1, 1, 1), (0.82, 0.86, 0.54), category="storage", variant="records"),
    FurnitureAsset("town_reagent_shelf", "Harthmere Reagent Shelf", "potion_shelf", (1.22, 0.48, 1.68), (2, 2, 1), (1.18, 1.66, 0.46), category="storage", variant="reagents"),
    FurnitureAsset("town_ward_focus", "Harthmere Ward Focus", "ward_plinth", (1.02, 1.02, 1.18), (2, 2, 2), (0.98, 1.16, 0.98), category="fixture", variant="ward"),
    FurnitureAsset("town_chapel_pew", "Harthmere Chapel Pew", "bench", (2.42, 0.82, 1.00), (3, 1, 1), (2.38, 0.98, 0.78), category="furniture", variant="chapel"),
    FurnitureAsset("town_chapel_altar", "Harthmere Chapel Altar", "plinth", (1.34, 1.02, 1.46), (2, 2, 2), (1.30, 1.44, 0.98), category="fixture", variant="chapel"),
    FurnitureAsset("town_grave_tool_rack", "Harthmere Grave Tool Rack", "rack", (1.34, 0.48, 1.72), (2, 2, 1), (1.30, 1.70, 0.46), category="fixture", variant="grave_tools"),
    FurnitureAsset("town_firewood_stack", "Harthmere Firewood Stack", "crate_cluster", (1.42, 0.82, 0.82), (2, 1, 1), (1.38, 0.80, 0.78), category="storage", variant="firewood"),
    FurnitureAsset("town_cookpot", "Harthmere Cookpot", "cauldron", (1.24, 1.24, 1.12), (2, 2, 2), (1.20, 1.10, 1.20), category="fixture", variant="cooking"),
    FurnitureAsset("town_oven_range", "Harthmere Oven Range", "kitchen_range", (1.48, 1.42, 2.42), (2, 3, 2), (1.44, 2.38, 1.38), category="fixture", variant="cooking"),
)


def parse_args() -> argparse.Namespace:
    argv = sys.argv[sys.argv.index("--") + 1 :] if "--" in sys.argv else []
    parser = argparse.ArgumentParser()
    parser.add_argument("--repo-root", type=Path, default=Path.cwd())
    parser.add_argument("--only", action="append", default=[])
    return parser.parse_args(argv)


def palette_for(asset: FurnitureAsset):
    if asset.category == "lighting":
        return ((0.20, 0.12, 0.055), (0.86, 0.48, 0.10), (0.96, 0.78, 0.25))
    if asset.variant in ("ornate", "fancy"):
        return ((0.24, 0.11, 0.055), (0.66, 0.26, 0.12), (0.76, 0.58, 0.20))
    if asset.variant == "upholstered":
        return ((0.27, 0.15, 0.075), (0.16, 0.40, 0.48), (0.73, 0.61, 0.42))
    if asset.category == "storage":
        return ((0.24, 0.14, 0.07), (0.40, 0.27, 0.13), (0.66, 0.46, 0.20))
    if asset.category == "business":
        return ((0.24, 0.14, 0.07), (0.18, 0.43, 0.52), (0.71, 0.55, 0.25))
    if asset.category == "wall_decor":
        return ((0.25, 0.13, 0.06), (0.39, 0.12, 0.10), (0.70, 0.57, 0.36))
    if asset.category == "fixture":
        return ((0.23, 0.13, 0.06), (0.28, 0.32, 0.34), (0.66, 0.48, 0.21))
    return ((0.28, 0.17, 0.085), (0.40, 0.24, 0.11), (0.70, 0.55, 0.30))


def synthetic_business(asset: FurnitureAsset) -> Business:
    return Business(
        slug=asset.item_id,
        name=asset.display_name,
        business_type="reusable_business_furniture",
        footprint=(4, 4),
        origin=(0, 0, 0),
        desk_world=(0, 0, 0),
        palette=palette_for(asset),
        pieces=(
            Piece(
                label=asset.display_name,
                kind=asset.kind,
                zone=None,
                dimensions=asset.dimensions,
                location=(0.0, 0.0, 0.0),
                role=asset.category,
                collidable=True,
            ),
        ),
    )


def add_variant_details(ctx, asset: FurnitureAsset) -> None:
    w, d, h = asset.dimensions
    if asset.item_id == "fancy_bed":
        box(ctx, "Fancy_Bed_headboard", (w, 0.16, 1.30), (0, d * 0.44, 0.82), "wood_dark", bevel=0.05)
        for x in (-w * 0.34, w * 0.34):
            box(ctx, f"Fancy_Bed_finial_{'left' if x < 0 else 'right'}", (0.13, 0.13, 1.55), (x, d * 0.44, 0.78), "accent", bevel=0.025)
    elif asset.item_id == "display_shelf" and ctx.lod == 0:
        box(ctx, "Display_Shelf_header", (w * 0.82, 0.08, 0.22), (0, -d * 0.49, h * 0.91), "accent", bevel=0.025)
    elif asset.item_id == "town_tool_rack":
        for index, x in enumerate((-w * 0.28, 0.0, w * 0.28)):
            box(ctx, f"Tool_Rack_handle_{index}", (0.08, d * 0.35, h * (0.55 + 0.08 * (index % 2))), (x, -d * 0.18, h * 0.48), "metal", rotation=(0, 0, (-0.22 + index * 0.22)), bevel=0.012)
            if ctx.lod == 0:
                box(ctx, f"Tool_Rack_head_{index}", (0.26, d * 0.38, 0.10), (x, -d * 0.18, h * (0.72 + 0.04 * (index % 2))), "accent", rotation=(0, 0, (-0.22 + index * 0.22)), bevel=0.012)
    elif asset.item_id == "town_rope_rack":
        for index, x in enumerate((-w * 0.26, 0.0, w * 0.26)):
            bpy.ops.mesh.primitive_torus_add(
                major_radius=0.18,
                minor_radius=0.035,
                major_segments=10 if ctx.lod == 0 else 6,
                minor_segments=5 if ctx.lod == 0 else 3,
                location=(x, -d * 0.32, h * (0.42 + 0.12 * (index % 2))),
                rotation=(1.5708, 0, 0),
            )
            finish_object(ctx, bpy.context.object, "stock", 0.0)
    elif asset.item_id == "town_textile_drape":
        box(ctx, "Textile_Drape_cloth", (w * 0.82, d * 0.45, h * 0.78), (0, -d * 0.38, h * 0.48), "accent", bevel=0.035)
        if ctx.lod == 0:
            box(ctx, "Textile_Drape_band", (w * 0.62, d * 0.50, 0.10), (0, -d * 0.42, h * 0.62), "stock", bevel=0.012)
    elif asset.item_id == "town_record_stack" and ctx.lod == 0:
        for index in range(3):
            box(ctx, f"Record_Stack_ledger_{index}", (w * (0.64 - 0.06 * index), d * 0.56, 0.10), (0.05 * (index - 1), -d * 0.08, h * (0.33 + 0.18 * index)), "neutral" if index != 1 else "accent", rotation=(0, 0, 0.05 * (index - 1)), bevel=0.012)
    elif asset.item_id == "town_ward_focus":
        torus(ctx, "Ward_Focus_ring", min(w, d) * 0.27, 0.055, (0, 0, h * 0.78), "light")
        box(ctx, "Ward_Focus_crystal", (0.18, 0.18, h * 0.42), (0, 0, h * 0.78), "light", rotation=(0, 0, 0.785), bevel=0.025)
    elif asset.item_id == "town_chapel_pew":
        box(ctx, "Chapel_Pew_blue_ribbon", (w * 0.22, d * 0.06, h * 0.22), (0, -d * 0.52, h * 0.70), "accent", bevel=0.012)
    elif asset.item_id == "town_chapel_altar":
        box(ctx, "Chapel_Altar_cloth", (w * 0.84, d * 0.12, h * 0.58), (0, -d * 0.52, h * 0.54), "accent", bevel=0.025)
        if ctx.lod == 0:
            box(ctx, "Chapel_Altar_ribbon", (w * 0.14, d * 0.15, h * 0.74), (0, -d * 0.56, h * 0.56), "light", bevel=0.012)
    elif asset.item_id == "town_grave_tool_rack":
        for index, x in enumerate((-w * 0.24, w * 0.10, w * 0.30)):
            box(ctx, f"Grave_Tool_handle_{index}", (0.07, d * 0.26, h * 0.72), (x, -d * 0.25, h * 0.47), "wood_dark", rotation=(0, 0, 0.08 * (index - 1)), bevel=0.01)
            if ctx.lod == 0:
                box(ctx, f"Grave_Tool_head_{index}", (0.26, d * 0.34, 0.12), (x, -d * 0.25, h * 0.78), "metal", rotation=(0, 0, 0.08 * (index - 1)), bevel=0.012)
    elif asset.item_id == "town_firewood_stack":
        for index, (x, z) in enumerate(((-0.34, 0.24), (0.0, 0.24), (0.34, 0.24), (-0.18, 0.52), (0.18, 0.52))):
            bpy.ops.mesh.primitive_cylinder_add(
                vertices=8 if ctx.lod == 0 else 6,
                radius=0.16,
                depth=d * 0.72,
                location=(x * w, 0, z * h),
                rotation=(1.5708, 0, 0),
            )
            finish_object(ctx, bpy.context.object, "wood_dark" if index % 2 else "wood", 0.01)


def supported_eevee_engine(scene: bpy.types.Scene) -> str:
    engine_property = scene.bl_rna.properties["render"].fixed_type.properties["engine"]
    engines = {item.identifier for item in engine_property.enum_items}
    return "BLENDER_EEVEE" if "BLENDER_EEVEE" in engines else "BLENDER_EEVEE_NEXT"


def render_icon(ctx, asset: FurnitureAsset, output: Path) -> None:
    icon_collection = bpy.data.collections.new(f"{asset.item_id}_icon")
    bpy.context.scene.collection.children.link(icon_collection)
    key_color = tint(palette_for(asset)[1], 0.35)

    for location, energy, size, color in (
        ((3.6, -4.8, 5.8), 850, 4.0, (1.0, 0.86, 0.68)),
        ((-3.2, -2.0, 3.8), 520, 3.0, key_color),
        ((0.0, 3.6, 4.8), 680, 3.2, (0.62, 0.72, 1.0)),
    ):
        bpy.ops.object.light_add(type="AREA", location=location)
        light = bpy.context.object
        move_to_collection(light, icon_collection)
        light.data.energy = energy
        light.data.shape = "DISK"
        light.data.size = size
        light.data.color = color
        look_at(light, (0, 0, asset.dimensions[2] * 0.48))

    largest = max(asset.dimensions)
    camera_distance = max(4.2, largest * 2.4)
    bpy.ops.object.camera_add(location=(camera_distance * 0.82, -camera_distance, camera_distance * 0.72))
    camera = bpy.context.object
    move_to_collection(camera, icon_collection)
    camera.data.type = "ORTHO"
    camera.data.ortho_scale = largest * 1.42
    look_at(camera, (0, 0, asset.dimensions[2] * 0.46))

    scene = bpy.context.scene
    scene.camera = camera
    scene.render.engine = supported_eevee_engine(scene)
    scene.render.resolution_x = 256
    scene.render.resolution_y = 256
    scene.render.resolution_percentage = 100
    scene.render.image_settings.file_format = "PNG"
    scene.render.image_settings.color_mode = "RGBA"
    scene.render.film_transparent = True
    scene.render.filepath = str(output)
    scene.world.color = (0.012, 0.016, 0.024)
    scene.view_settings.look = "AgX - Medium High Contrast"
    output.parent.mkdir(parents=True, exist_ok=True)
    bpy.ops.render.render(write_still=True)

    for obj in list(icon_collection.objects):
        bpy.data.objects.remove(obj, do_unlink=True)
    bpy.data.collections.remove(icon_collection)


def public_url(path: Path, repo_root: Path) -> str:
    return "/" + str(path.relative_to(repo_root / "public"))


def write_typescript_manifest(entries: list[dict], output: Path) -> None:
    serialized = json.dumps(
        {
            entry["itemId"]: {
                "displayName": entry["displayName"],
                "lod0Url": entry["assets"]["lod0"],
                "lod1Url": entry["assets"]["lod1"],
                "iconUrl": entry["iconUrl"],
                "boxSize": entry["boxSize"],
                "collidableSize": entry["collidableSize"],
                "surface": entry["surface"],
                "placementType": entry["placementType"],
                "frontAxis": entry["frontAxis"],
                "yawCorrectionRadians": entry["yawCorrectionRadians"],
            }
            for entry in entries
        },
        indent=2,
    )
    output.parent.mkdir(parents=True, exist_ok=True)
    output.write_text(
        "// Generated by scripts/harthmere/blender/generate_business_furniture_catalogue.py.\n"
        "// Do not hand-edit; rebuild the Blender business furniture catalogue.\n\n"
        'import { HARTHMERE_NATIVE_ITEM_ID_MANIFEST } from "@/shared/harthmere/harthmere_native_id_manifest";\n\n'
        'export type HarthmereBusinessFurniturePlacementType = "floorCenter" | "wallCenter" | "any";\n\n'
        "export interface HarthmereBusinessFurnitureAsset {\n"
        "  readonly displayName: string;\n"
        "  readonly lod0Url: string;\n"
        "  readonly lod1Url: string;\n"
        "  readonly iconUrl: string;\n"
        "  readonly boxSize: readonly [number, number, number];\n"
        "  readonly collidableSize: readonly [number, number, number];\n"
        "  readonly surface: string;\n"
        "  readonly placementType: HarthmereBusinessFurniturePlacementType;\n"
        "  readonly frontAxis: \"+Z\";\n"
        "  readonly yawCorrectionRadians: number;\n"
        "}\n\n"
        f"export const HARTHMERE_BUSINESS_FURNITURE_ASSETS = {serialized} as const satisfies Readonly<Record<string, HarthmereBusinessFurnitureAsset>>;\n\n"
        "const HARTHMERE_BUSINESS_FURNITURE_ITEM_ID_BY_NATIVE_ID = new Map<number, string>();\n"
        "for (const [itemId, nativeId] of Object.entries(HARTHMERE_NATIVE_ITEM_ID_MANIFEST)) {\n"
        "  if (\n"
        "    !HARTHMERE_BUSINESS_FURNITURE_ITEM_ID_BY_NATIVE_ID.has(nativeId) ||\n"
        '    itemId === "muckwad"\n'
        "  ) {\n"
        "    HARTHMERE_BUSINESS_FURNITURE_ITEM_ID_BY_NATIVE_ID.set(nativeId, itemId);\n"
        "  }\n"
        "}\n\n"
        "export function harthmereBusinessFurnitureAsset(\n"
        "  itemId: string | number | undefined\n"
        "): HarthmereBusinessFurnitureAsset | undefined {\n"
        "  if (itemId === undefined || itemId === null) return undefined;\n"
        "  const raw = String(itemId).trim();\n"
        "  if (!raw) return undefined;\n"
        '  const normalized = raw.replace(/^b:/, "");\n'
        "  const direct = HARTHMERE_BUSINESS_FURNITURE_ASSETS[\n"
        "    normalized as keyof typeof HARTHMERE_BUSINESS_FURNITURE_ASSETS\n"
        "  ];\n"
        "  if (direct) return direct;\n"
        "  if (!/^[0-9]+$/.test(normalized)) return undefined;\n"
        "  const semanticItemId =\n"
        "    HARTHMERE_BUSINESS_FURNITURE_ITEM_ID_BY_NATIVE_ID.get(\n"
        "      Number(normalized)\n"
        "    );\n"
        "  return semanticItemId\n"
        "    ? HARTHMERE_BUSINESS_FURNITURE_ASSETS[\n"
        "        semanticItemId as keyof typeof HARTHMERE_BUSINESS_FURNITURE_ASSETS\n"
        "      ]\n"
        "    : undefined;\n"
        "}\n",
        encoding="utf8",
    )
    prettier = output.parents[4] / "node_modules" / ".bin" / "prettier"
    if prettier.exists():
        subprocess.run([str(prettier), "--write", str(output)], check=True)


def main() -> None:
    args = parse_args()
    repo_root = args.repo_root.resolve()
    output_root = repo_root / "public" / "assets" / "harthmere" / "glb" / "business_furniture"
    icon_root = repo_root / "public" / "assets" / "harthmere" / "inventory_icons" / "business_furniture"
    report_root = repo_root / "output" / "harthmere-business-furniture" / "gltfpack-reports"
    manifest_path = repo_root / "public" / "assets" / "harthmere" / "manifest" / "business-furniture-catalogue.json"
    ts_manifest_path = repo_root / "src" / "shared" / "harthmere" / "generated" / "harthmere_business_furniture_manifest.ts"
    for path in (output_root, icon_root, report_root, manifest_path.parent, ts_manifest_path.parent):
        path.mkdir(parents=True, exist_ok=True)

    packer = gltfpack_path(repo_root)
    clear_scene()
    selected = set(args.only)
    assets = [asset for asset in CATALOGUE if not selected or asset.item_id in selected]
    entries: list[dict] = []

    for index, asset in enumerate(assets):
        print(f"[business-furniture] building {asset.item_id} ({index + 1}/{len(assets)})", flush=True)
        business = synthetic_business(asset)
        asset_dir = output_root / asset.item_id
        asset_dir.mkdir(parents=True, exist_ok=True)

        lod0 = create_context(business, 0)
        build_piece(lod0, business.pieces[0])
        add_variant_details(lod0, asset)
        join_by_material(lod0)
        raw_lod0 = asset_dir / f"{asset.item_id}.raw.glb"
        final_lod0 = asset_dir / f"{asset.item_id}.glb"
        export_context(lod0, raw_lod0)
        compress_glb(packer, raw_lod0, final_lod0, report_root / f"{asset.item_id}-lod0.json")
        icon_path = icon_root / f"{asset.item_id}.png"
        render_icon(lod0, asset, icon_path)
        delete_context(lod0)

        lod1 = create_context(business, 1)
        build_piece(lod1, business.pieces[0])
        add_variant_details(lod1, asset)
        join_by_material(lod1)
        raw_lod1 = asset_dir / f"{asset.item_id}.lod1.raw.glb"
        final_lod1 = asset_dir / f"{asset.item_id}.lod1.glb"
        export_context(lod1, raw_lod1)
        compress_glb(packer, raw_lod1, final_lod1, report_root / f"{asset.item_id}-lod1.json")
        delete_context(lod1)

        entries.append(
            {
                "itemId": asset.item_id,
                "displayName": asset.display_name,
                "category": asset.category,
                "surface": asset.surface,
                "placementType": asset.placement_type,
                "boxSize": list(asset.box_size),
                "collidableSize": list(asset.collidable_size),
                "modelBoundsMeters": {
                    "widthX": asset.dimensions[0],
                    "heightY": asset.dimensions[2],
                    "depthZ": asset.dimensions[1],
                },
                "pivot": "bottom-center",
                "frontAxis": "+Z",
                "yawCorrectionRadians": 0,
                "assets": {
                    "lod0": public_url(final_lod0, repo_root),
                    "lod1": public_url(final_lod1, repo_root),
                },
                "iconUrl": public_url(icon_path, repo_root),
                "lodPolicy": {"lod0MaxDistanceMeters": 16, "lod1MaxDistanceMeters": 28},
                "ecs": {
                    "component": "placeable_component",
                    "inventoryIdentity": "native Bikkie id from harthmere_native_id_manifest",
                    "terrainAuthority": "native occupancy via checkAndOccupyTerrainForPlaceable",
                    "gaiaSimulation": "not required for static furniture",
                },
            }
        )

    manifest = {
        "version": ASSET_VERSION,
        "generatorVersion": GENERATOR_VERSION,
        "generatedWith": bpy.app.version_string,
        "coordinateConvention": {
            "units": "meters",
            "pivot": "bottom-center",
            "frontAxis": "+Z after Blender glTF Y-up conversion",
        },
        "performanceContract": {
            "geometryCompression": "EXT_meshopt_compression via gltfpack -cc",
            "textures": "none; compact PBR material colors only",
            "iconResolution": [256, 256],
            "iconFormat": "transparent RGBA PNG rendered from the exact LOD0 mesh",
            "sharedByType": "native /scene/placeable/type_mesh resource loads one GLTF per Bikkie item type",
            "collision": "native boxSize occupancy plus collidableSize; render meshes are not collision meshes",
        },
        "items": entries,
    }
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n", encoding="utf8")
    write_typescript_manifest(entries, ts_manifest_path)
    print(f"[business-furniture] wrote {manifest_path}", flush=True)
    print(f"[business-furniture] wrote {ts_manifest_path}", flush=True)


if __name__ == "__main__":
    main()
