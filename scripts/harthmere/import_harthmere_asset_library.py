from pathlib import Path
import shutil
import csv
from datetime import datetime

HARTH = Path("/Users/devindixon/Development/biomes-game/public/assets/harthmere")

KAY = HARTH / "_source/kaykit_adventurers/KayKit_Adventurers_2.0_FREE"
KENNEY = HARTH / "_source/kenney_fantasy_town/Models/GLB format"
DUNGEON = HARTH / "_source/kaykit_dungeon/KayKit-Dungeon-Remastered-1.0-b0ca9bd96a8072ab36a3a5464f00ed1e06a16d07/addons/kaykit_dungeon_remastered/Assets/gltf"
QMON = HARTH / "_source/quaternius_monster_pack"
QULT = HARTH / "_source/quaternius_ultimate_monsters"

def ensure(path: Path):
    path.mkdir(parents=True, exist_ok=True)

def copy_file(src: Path, dest_dir: Path):
    if not src.exists() or not src.is_file():
        return False
    ensure(dest_dir)
    dest = dest_dir / src.name
    if dest.exists() and dest.stat().st_size == src.stat().st_size:
        return False
    shutil.copy2(src, dest)
    return True

def copy_globs(base: Path, patterns, dest_dir: Path):
    count = 0
    if not base.exists():
        return 0
    for pattern in patterns:
        for src in sorted(base.glob(pattern)):
            if copy_file(src, dest_dir):
                count += 1
    return count

def copy_recursive_globs(base: Path, patterns, dest_dir: Path):
    count = 0
    if not base.exists():
        return 0
    for pattern in patterns:
        for src in sorted(base.rglob(pattern)):
            if copy_file(src, dest_dir):
                count += 1
    return count

counts = {}

# Runtime folders.
folders = [
    "glb/characters/adventurers",
    "glb/characters/animations",
    "glb/equipment/weapons",
    "glb/equipment/shields",
    "glb/equipment/ranged",
    "glb/equipment/magic",
    "glb/equipment/items",
    "fbx/creatures/monsters/quaternius_basic",
    "fbx/creatures/monsters/quaternius_ultimate",
    "obj/creatures/monsters/quaternius_basic",
    "glb/buildings/fantasy_town",
    "glb/environment/trees",
    "glb/environment/shrubbery",
    "glb/environment/rocks",
    "glb/environment/roads",
    "glb/environment/fences",
    "glb/props/dungeon",
    "glb/props/magic",
    "glb/props/market",
    "glb/props/town",
]
for folder in folders:
    ensure(HARTH / folder)

# KayKit Adventurers characters.
counts["adventurer_characters"] = copy_globs(
    KAY / "Characters/gltf",
    ["*.glb"],
    HARTH / "glb/characters/adventurers",
)

counts["adventurer_animations"] = copy_globs(
    KAY / "Animations/gltf/Rig_Medium",
    ["*.glb"],
    HARTH / "glb/characters/animations",
)

# KayKit equipment, keeping .gltf and .bin pairs together.
asset_gltf = KAY / "Assets/gltf"

counts["weapons"] = copy_globs(
    asset_gltf,
    [
        "sword*.gltf", "sword*.bin",
        "axe*.gltf", "axe*.bin",
        "dagger*.gltf", "dagger*.bin",
        "mace*.gltf", "mace*.bin",
        "hammer*.gltf", "hammer*.bin",
        "spear*.gltf", "spear*.bin",
    ],
    HARTH / "glb/equipment/weapons",
)

counts["shields"] = copy_globs(
    asset_gltf,
    ["shield*.gltf", "shield*.bin"],
    HARTH / "glb/equipment/shields",
)

counts["ranged"] = copy_globs(
    asset_gltf,
    [
        "bow*.gltf", "bow*.bin",
        "crossbow*.gltf", "crossbow*.bin",
        "arrow*.gltf", "arrow*.bin",
        "quiver*.gltf", "quiver*.bin",
    ],
    HARTH / "glb/equipment/ranged",
)

counts["magic_equipment"] = copy_globs(
    asset_gltf,
    [
        "staff*.gltf", "staff*.bin",
        "wand*.gltf", "wand*.bin",
        "spellbook*.gltf", "spellbook*.bin",
        "smokebomb*.gltf", "smokebomb*.bin",
        "potion*.gltf", "potion*.bin",
        "scroll*.gltf", "scroll*.bin",
    ],
    HARTH / "glb/equipment/magic",
)

counts["items"] = copy_globs(
    asset_gltf,
    [
        "mug*.gltf", "mug*.bin",
        "coin*.gltf", "coin*.bin",
        "key*.gltf", "key*.bin",
        "bag*.gltf", "bag*.bin",
        "bottle*.gltf", "bottle*.bin",
    ],
    HARTH / "glb/equipment/items",
)

# Quaternius animated monster sources.
counts["basic_monsters_fbx"] = copy_globs(
    QMON / "FBX",
    ["*.fbx"],
    HARTH / "fbx/creatures/monsters/quaternius_basic",
)

counts["basic_monsters_obj"] = copy_globs(
    QMON / "OBJ",
    ["*.obj", "*.mtl"],
    HARTH / "obj/creatures/monsters/quaternius_basic",
)

counts["ultimate_monsters_fbx"] = copy_recursive_globs(
    QULT,
    ["*.fbx"],
    HARTH / "fbx/creatures/monsters/quaternius_ultimate",
)

# Kenney Fantasy Town.
kenney_files = list(KENNEY.glob("*.glb")) if KENNEY.exists() else []

building_prefixes = (
    "wall", "wall-", "wall_", "roof", "stairs", "balcony", "overhang",
    "pillar", "window", "door", "chimney", "watermill", "windmill",
    "wheel", "planks", "poles"
)

market_prefixes = (
    "stall", "cart", "fountain"
)

town_prefixes = (
    "banner", "lantern", "blade"
)

environment_trees = ("tree",)
environment_shrubs = ("hedge", "bush")
environment_rocks = ("rock",)
environment_roads = ("road",)
environment_fences = ("fence",)

def copy_by_prefix(files, prefixes, dest):
    count = 0
    for src in files:
        name = src.name.lower()
        if name.startswith(prefixes):
            if copy_file(src, dest):
                count += 1
    return count

counts["fantasy_town_buildings"] = copy_by_prefix(
    kenney_files,
    building_prefixes,
    HARTH / "glb/buildings/fantasy_town",
)

counts["market_props"] = copy_by_prefix(
    kenney_files,
    market_prefixes,
    HARTH / "glb/props/market",
)

counts["town_props"] = copy_by_prefix(
    kenney_files,
    town_prefixes,
    HARTH / "glb/props/town",
)

counts["trees"] = copy_by_prefix(
    kenney_files,
    environment_trees,
    HARTH / "glb/environment/trees",
)

counts["shrubbery"] = copy_by_prefix(
    kenney_files,
    environment_shrubs,
    HARTH / "glb/environment/shrubbery",
)

counts["rocks"] = copy_by_prefix(
    kenney_files,
    environment_rocks,
    HARTH / "glb/environment/rocks",
)

counts["roads"] = copy_by_prefix(
    kenney_files,
    environment_roads,
    HARTH / "glb/environment/roads",
)

counts["fences"] = copy_by_prefix(
    kenney_files,
    environment_fences,
    HARTH / "glb/environment/fences",
)

# KayKit Dungeon. These files are named like foo.gltf.glb.
dungeon_files = list(DUNGEON.glob("*.glb")) if DUNGEON.exists() else []

dungeon_prefixes = (
    "barrel", "box", "chest", "crate", "door", "floor", "key", "torch",
    "wall", "stairs", "gate", "column", "chain", "skull", "bone",
    "bridge", "cage", "table", "chair", "shelf", "ladder", "trap",
    "spike", "pillar", "platform"
)

magic_prefixes = (
    "book", "bottle", "candle", "crystal", "scroll", "potion", "rune",
    "altar", "orb", "magic", "banner", "cauldron"
)

counts["dungeon_props"] = copy_by_prefix(
    dungeon_files,
    dungeon_prefixes,
    HARTH / "glb/props/dungeon",
)

counts["magic_props"] = copy_by_prefix(
    dungeon_files,
    magic_prefixes,
    HARTH / "glb/props/magic",
)

# Write manifests.
manifest = HARTH / "manifest"
ensure(manifest)

def write_list(path: Path, files):
    path.write_text("\n".join(str(p) for p in sorted(files)) + ("\n" if files else ""))

write_list(manifest / "source-all-files.txt", [p for p in (HARTH / "_source").rglob("*") if p.is_file()])
write_list(manifest / "runtime-all-files.txt", [p for root in ["glb", "fbx", "obj", "png", "vox"] for p in (HARTH / root).rglob("*") if p.is_file()] if True else [])

categories = {
    "weapons.txt": HARTH / "glb/equipment/weapons",
    "shields.txt": HARTH / "glb/equipment/shields",
    "ranged-weapons.txt": HARTH / "glb/equipment/ranged",
    "magic-equipment.txt": HARTH / "glb/equipment/magic",
    "items.txt": HARTH / "glb/equipment/items",
    "monsters-fbx.txt": HARTH / "fbx/creatures/monsters",
    "monsters-obj.txt": HARTH / "obj/creatures/monsters",
    "buildings.txt": HARTH / "glb/buildings",
    "trees.txt": HARTH / "glb/environment/trees",
    "shrubbery.txt": HARTH / "glb/environment/shrubbery",
    "rocks.txt": HARTH / "glb/environment/rocks",
    "roads.txt": HARTH / "glb/environment/roads",
    "fences.txt": HARTH / "glb/environment/fences",
    "dungeon-props.txt": HARTH / "glb/props/dungeon",
    "magic-props.txt": HARTH / "glb/props/magic",
    "market-props.txt": HARTH / "glb/props/market",
    "town-props.txt": HARTH / "glb/props/town",
}

for filename, folder in categories.items():
    files = [p for p in folder.rglob("*") if p.is_file()] if folder.exists() else []
    write_list(manifest / filename, files)

all_files = []
for root in ["_source", "glb", "fbx", "obj", "png", "vox"]:
    folder = HARTH / root
    if folder.exists():
        all_files.extend([p for p in folder.rglob("*") if p.is_file()])

with (manifest / "asset-index.csv").open("w", newline="") as f:
    writer = csv.DictWriter(f, fieldnames=["bucket", "category", "type", "size_bytes", "path"])
    writer.writeheader()
    for p in sorted(all_files):
        rel = p.relative_to(HARTH)
        parts = rel.parts
        writer.writerow({
            "bucket": parts[0] if parts else "",
            "category": "/".join(parts[:4]) if len(parts) >= 4 else str(rel.parent),
            "type": p.suffix.lower().replace(".", ""),
            "size_bytes": p.stat().st_size,
            "path": str(rel),
        })

summary = f"""Harthmere Asset Manifest Summary
Generated: {datetime.now().isoformat(timespec="seconds")}

SOURCE FILES:
{sum(1 for p in (HARTH / "_source").rglob("*") if p.is_file())}

RUNTIME FILES:
{sum(1 for root in ["glb", "fbx", "obj", "png", "vox"] for p in (HARTH / root).rglob("*") if p.is_file())}

GLB:
{sum(1 for p in HARTH.rglob("*.glb"))}

GLTF:
{sum(1 for p in HARTH.rglob("*.gltf"))}

BIN:
{sum(1 for p in HARTH.rglob("*.bin"))}

FBX:
{sum(1 for p in HARTH.rglob("*.fbx"))}

OBJ:
{sum(1 for p in HARTH.rglob("*.obj"))}

MTL:
{sum(1 for p in HARTH.rglob("*.mtl"))}

PNG:
{sum(1 for p in HARTH.rglob("*.png"))}

VOX:
{sum(1 for p in HARTH.rglob("*.vox"))}

WEAPONS:
{sum(1 for p in (HARTH / "glb/equipment/weapons").rglob("*") if p.is_file())}

SHIELDS:
{sum(1 for p in (HARTH / "glb/equipment/shields").rglob("*") if p.is_file())}

RANGED:
{sum(1 for p in (HARTH / "glb/equipment/ranged").rglob("*") if p.is_file())}

MAGIC EQUIPMENT:
{sum(1 for p in (HARTH / "glb/equipment/magic").rglob("*") if p.is_file())}

MONSTER FBX:
{sum(1 for p in (HARTH / "fbx/creatures/monsters").rglob("*.fbx"))}

BUILDINGS:
{sum(1 for p in (HARTH / "glb/buildings").rglob("*") if p.is_file())}

TREES:
{sum(1 for p in (HARTH / "glb/environment/trees").rglob("*") if p.is_file())}

SHRUBBERY:
{sum(1 for p in (HARTH / "glb/environment/shrubbery").rglob("*") if p.is_file())}

ROCKS:
{sum(1 for p in (HARTH / "glb/environment/rocks").rglob("*") if p.is_file())}

ROADS:
{sum(1 for p in (HARTH / "glb/environment/roads").rglob("*") if p.is_file())}

FENCES:
{sum(1 for p in (HARTH / "glb/environment/fences").rglob("*") if p.is_file())}

DUNGEON PROPS:
{sum(1 for p in (HARTH / "glb/props/dungeon").rglob("*") if p.is_file())}

MAGIC PROPS:
{sum(1 for p in (HARTH / "glb/props/magic").rglob("*") if p.is_file())}

MARKET PROPS:
{sum(1 for p in (HARTH / "glb/props/market").rglob("*") if p.is_file())}

TOWN PROPS:
{sum(1 for p in (HARTH / "glb/props/town").rglob("*") if p.is_file())}
"""

(manifest / "summary.txt").write_text(summary)

print("Imported new files:")
for key, value in counts.items():
    print(f"{key}: {value}")

print()
print(summary)
