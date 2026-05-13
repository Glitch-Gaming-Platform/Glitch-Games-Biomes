from __future__ import annotations

from pathlib import Path, PurePosixPath
from collections import Counter, defaultdict
from datetime import datetime
from urllib.parse import quote
import csv
import hashlib
import json
import os
import re
import shutil
import sys
import zipfile

ROOT = Path(os.environ.get("BIOMES_ROOT", Path.cwd())).resolve()
HARTH = Path(os.environ.get("HARTHMERE_DIR", ROOT / "public/assets/harthmere")).resolve()
DOWNLOADS = Path(os.environ.get("VOXEL_ZIP_DIR", Path.home() / "Downloads")).resolve()

SOURCE_ROOT = HARTH / "_source/voxel_packs"
LICENSE_ROOT = HARTH / "_licenses"
MANIFEST_ROOT = HARTH / "manifest"

RUNTIME_ROOTS = ["glb", "gltf", "fbx", "obj", "png", "vox"]
MODEL_EXTS = {".glb", ".gltf", ".bin", ".fbx", ".obj", ".mtl", ".vox"}
TEXTURE_EXTS = {".png", ".jpg", ".jpeg", ".webp", ".svg", ".xml"}
RUNTIME_EXTS = MODEL_EXTS | TEXTURE_EXTS | {".json"}
LICENSE_EXTS = {".txt", ".md", ".pdf", ".rtf"}
SOURCE_SKIP_EXTS = {".url", ".swf", ".ai", ".psd", ".blend"}
LICENSE_RE = re.compile(r"(license|licence|readme|credit|credits|terms|copyright)", re.I)

PACKS = [
    {
        "key": "voxel_graveyard",
        "display": "Voxel Graveyard Assets",
        "patterns": ["VoxelGraveyard_Assets*.zip", "*Graveyard*Assets*.zip"],
    },
    {
        "key": "kyrises_voxel_mines",
        "display": "Kyrise's Voxel Mines Environment Pack",
        "patterns": ["kyrises-voxel-mines-environment-pack*.zip", "*voxel-mines*.zip", "*mines-environment*.zip"],
    },
    {
        "key": "large_tree",
        "display": "Large Tree Voxel Pack",
        "patterns": ["large_tree*.zip", "*large*tree*.zip"],
    },
    {
        "key": "kenney_voxel_pack",
        "display": "Kenney Voxel Pack",
        "patterns": ["kenney_voxel-pack*.zip", "*kenney*voxel*.zip"],
    },
    {
        "key": "wild_west_asset_pack",
        "display": "Wild West Asset Pack",
        "patterns": ["wild-west-asset-pack*.zip", "*wild*west*.zip"],
    },
    {
        "key": "itch_voxel_asset_pack",
        "display": "Asset Pack For Itch",
        "patterns": ["Asset Pack For Itch*.zip", "*Asset*Pack*Itch*.zip"],
    },
]

PACK_RUNTIME_DIRS = {
    "voxel_graveyard": [
        "obj/environment/graveyard/voxel_graveyard",
        "vox/environment/graveyard/voxel_graveyard",
    ],
    "kyrises_voxel_mines": [
        "glb/environment/mines/kyrises_voxel_mines",
        "fbx/environment/mines/kyrises_voxel_mines",
        "obj/environment/mines/kyrises_voxel_mines",
        "vox/environment/mines/kyrises_voxel_mines",
        "png/environment/mines/kyrises_voxel_mines",
    ],
    "large_tree": [
        "obj/environment/trees/large_tree",
        "vox/environment/trees/large_tree",
    ],
    "wild_west_asset_pack": [
        "fbx/environment/wild_west/wild_west_asset_pack",
    ],
    "itch_voxel_asset_pack": [
        "vox/props/itch_voxel_asset_pack",
        "png/props/itch_voxel_asset_pack",
    ],
}

def ensure(path: Path) -> None:
    path.mkdir(parents=True, exist_ok=True)

def is_safe_zip_path(name: str) -> bool:
    if not name or name.endswith("/"):
        return False
    p = PurePosixPath(name)
    if p.is_absolute():
        return False
    if any(part in ("", ".", "..") for part in p.parts):
        return False
    if any(part == "__MACOSX" for part in p.parts):
        return False
    if p.name in {".DS_Store", "Thumbs.db"}:
        return False
    return True

def find_zip(patterns: list[str]) -> Path | None:
    matches: list[Path] = []
    for pattern in patterns:
        matches.extend(DOWNLOADS.glob(pattern))
    matches = sorted(set(matches), key=lambda p: p.stat().st_mtime, reverse=True)
    return matches[0] if matches else None

def strip_single_root(names: list[str]) -> tuple[bool, str | None]:
    top = set()
    for name in names:
        parts = PurePosixPath(name).parts
        if len(parts) <= 1:
            return False, None
        top.add(parts[0])
    if len(top) == 1:
        return True, next(iter(top))
    return False, None

def sha256_file(path: Path) -> str:
    h = hashlib.sha256()
    with path.open("rb") as f:
        for chunk in iter(lambda: f.read(1024 * 1024), b""):
            h.update(chunk)
    return h.hexdigest()

def copy_file(src: Path, dest: Path) -> bool:
    ensure(dest.parent)
    if dest.exists():
        try:
            if src.stat().st_size == dest.stat().st_size and sha256_file(src) == sha256_file(dest):
                return False
        except FileNotFoundError:
            pass
    shutil.copy2(src, dest)
    return True

def rel_posix(path: Path, base: Path = HARTH) -> str:
    return path.relative_to(base).as_posix()

def classify_asset(path: Path) -> str:
    ext = path.suffix.lower()
    if ext in {".glb", ".gltf", ".fbx", ".obj", ".vox"}:
        return "model"
    if ext == ".bin":
        return "model-binary"
    if ext == ".mtl":
        return "material"
    if ext in {".png", ".jpg", ".jpeg", ".webp", ".svg"}:
        return "texture"
    if ext in {".xml", ".json"}:
        return "metadata"
    return "other"

def key_for_path(path: str, used: set[str]) -> str:
    key = re.sub(r"[^a-zA-Z0-9]+", "_", path.rsplit(".", 1)[0]).strip("_").lower() or "asset"
    base = key
    i = 2
    while key in used:
        key = f"{base}_{i}"
        i += 1
    used.add(key)
    return key

def extract_pack(zip_path: Path, pack: dict) -> tuple[Path, int, int]:
    source_dest = SOURCE_ROOT / pack["key"]
    if source_dest.exists():
        shutil.rmtree(source_dest)
    ensure(source_dest)

    copied = 0
    skipped = 0

    with zipfile.ZipFile(zip_path) as zf:
        safe_names = [info.filename for info in zf.infolist() if is_safe_zip_path(info.filename)]
        should_strip, _root_name = strip_single_root(safe_names)

        for info in zf.infolist():
            name = info.filename
            if not is_safe_zip_path(name):
                skipped += 1
                continue

            posix = PurePosixPath(name)
            ext = posix.suffix.lower()
            if ext in SOURCE_SKIP_EXTS:
                skipped += 1
                continue

            parts = posix.parts[1:] if should_strip and len(posix.parts) > 1 else posix.parts
            rel = Path(*parts)
            out = source_dest / rel
            ensure(out.parent)
            out.write_bytes(zf.read(info))
            copied += 1

    return source_dest, copied, skipped

def collect_licenses(source_dest: Path, zip_path: Path, pack: dict) -> int:
    copied = 0
    key = pack["key"]

    for old in LICENSE_ROOT.glob(f"{key}*"):
        if old.is_file():
            old.unlink()

    for src in sorted(source_dest.rglob("*")):
        if not src.is_file():
            continue
        rel = src.relative_to(source_dest).as_posix()
        if src.suffix.lower() in LICENSE_EXTS and LICENSE_RE.search(rel):
            if key == "kenney_voxel_pack" and src.name.lower() == "license.txt":
                dest = LICENSE_ROOT / "kenney_voxel-pack_LICENSE.txt"
            else:
                dest = LICENSE_ROOT / f"{key}__{rel.replace('/', '__')}"
            copy_file(src, dest)
            copied += 1

    note = LICENSE_ROOT / f"{key}_SOURCE_NOTE.txt"
    note.write_text(
        "\n".join([
            f"Pack: {pack['display']}",
            f"Source ZIP: {zip_path.name}",
            f"Imported from: {zip_path}",
            f"Imported into source folder: {source_dest}",
            f"Imported at: {datetime.now().isoformat(timespec='seconds')}",
            f"License/readme files found inside ZIP: {'yes' if copied else 'no'}",
            "",
            "Keep this file with the project so the source of the asset pack remains traceable.",
            "If no license/readme file was found inside the ZIP, copy the license text from the original download page into this _licenses folder before commercial use.",
            "",
        ]),
        encoding="utf-8",
    )
    return copied

def clean_previous_runtime(pack_key: str) -> None:
    for rel in PACK_RUNTIME_DIRS.get(pack_key, []):
        path = HARTH / rel
        if path.exists():
            shutil.rmtree(path)

def runtime_dest_for(pack: dict, src: Path, source_dest: Path) -> Path | None:
    key = pack["key"]
    rel = src.relative_to(source_dest)
    rel_parts = rel.parts
    ext = src.suffix.lower()

    if ext not in RUNTIME_EXTS:
        return None

    if key == "kenney_voxel_pack":
        if ext not in {".png", ".xml", ".svg"}:
            return None
        if rel_parts[0] == "PNG" and len(rel_parts) >= 3:
            section = rel_parts[1].lower()
            rest = Path(*rel_parts[2:])
            section_map = {
                "characters": "characters",
                "items": "items",
                "particles": "particles",
                "tiles": "tiles",
            }
            return HARTH / "png/kenney" / section_map.get(section, section) / rest
        if rel_parts[0] == "Spritesheets" and len(rel_parts) >= 2:
            return HARTH / "png/kenney/spritesheets" / Path(*rel_parts[1:])
        if rel_parts[0] == "Vector" and ext == ".svg" and len(rel_parts) >= 2:
            return HARTH / "png/kenney/vector" / Path(*rel_parts[1:])
        if src.name.lower() in {"preview.png", "sample_2d.png", "sample_3d.png"}:
            return HARTH / "png/kenney/preview" / src.name
        return None

    if key == "voxel_graveyard":
        first = rel_parts[0].lower() if rel_parts else ""
        rest = Path(*rel_parts[1:]) if first in {"assets", "vox"} and len(rel_parts) > 1 else rel
        if ext in {".obj", ".mtl", ".png", ".jpg", ".jpeg"}:
            return HARTH / "obj/environment/graveyard/voxel_graveyard" / rest
        if ext == ".vox":
            return HARTH / "vox/environment/graveyard/voxel_graveyard" / rest
        return None

    if key == "large_tree":
        if ext in {".obj", ".mtl", ".png", ".jpg", ".jpeg"}:
            return HARTH / "obj/environment/trees/large_tree" / rel
        if ext == ".vox":
            return HARTH / "vox/environment/trees/large_tree" / rel
        return None

    if key == "kyrises_voxel_mines":
        first = rel_parts[0].lower() if rel_parts else ""
        rest = Path(*rel_parts[1:]) if len(rel_parts) > 1 else Path(src.name)
        if first == "gltf" and ext == ".glb":
            return HARTH / "glb/environment/mines/kyrises_voxel_mines" / rest
        if first == "fbx" and ext in {".fbx", ".png", ".jpg", ".jpeg"}:
            return HARTH / "fbx/environment/mines/kyrises_voxel_mines" / rest
        if first == "obj" and ext in {".obj", ".mtl", ".png", ".jpg", ".jpeg"}:
            return HARTH / "obj/environment/mines/kyrises_voxel_mines" / rest
        if first == "voxel" and ext == ".vox":
            return HARTH / "vox/environment/mines/kyrises_voxel_mines" / rest
        if ext in {".png", ".jpg", ".jpeg"}:
            return HARTH / "png/environment/mines/kyrises_voxel_mines" / rel
        return None

    if key == "wild_west_asset_pack":
        if ext in {".fbx", ".png", ".jpg", ".jpeg"}:
            return HARTH / "fbx/environment/wild_west/wild_west_asset_pack" / rel
        return None

    if key == "itch_voxel_asset_pack":
        first = rel_parts[0].lower() if rel_parts else ""
        rest = Path(*rel_parts[1:]) if first == "objects" and len(rel_parts) > 1 else rel
        if ext == ".vox":
            return HARTH / "vox/props/itch_voxel_asset_pack" / rest
        if ext == ".png":
            return HARTH / "png/props/itch_voxel_asset_pack" / rest
        return None

    return None

def import_runtime(pack: dict, source_dest: Path) -> dict:
    clean_previous_runtime(pack["key"])
    copied = 0
    unchanged = 0
    skipped = 0

    for src in sorted(source_dest.rglob("*")):
        if not src.is_file():
            continue
        dest = runtime_dest_for(pack, src, source_dest)
        if dest is None:
            skipped += 1
            continue
        if copy_file(src, dest):
            copied += 1
        else:
            unchanged += 1

    return {"copied": copied, "unchanged": unchanged, "skipped": skipped}

def runtime_files() -> list[Path]:
    files: list[Path] = []
    for root_name in RUNTIME_ROOTS:
        folder = HARTH / root_name
        if folder.exists():
            files.extend([p for p in folder.rglob("*") if p.is_file()])
    return sorted(files, key=lambda p: rel_posix(p))

def source_files() -> list[Path]:
    source = HARTH / "_source"
    if not source.exists():
        return []
    return sorted([p for p in source.rglob("*") if p.is_file()], key=lambda p: rel_posix(p))

def license_files() -> list[Path]:
    if not LICENSE_ROOT.exists():
        return []
    return sorted([p for p in LICENSE_ROOT.rglob("*") if p.is_file()], key=lambda p: rel_posix(p))

def write_list(path: Path, files: list[Path]) -> None:
    ensure(path.parent)
    values = [rel_posix(p) for p in files]
    path.write_text("\n".join(values) + ("\n" if values else ""), encoding="utf-8")

def write_category_manifest(filename: str, folders: list[str]) -> None:
    files: list[Path] = []
    for rel in folders:
        folder = HARTH / rel
        if folder.exists():
            files.extend([p for p in folder.rglob("*") if p.is_file()])
    write_list(MANIFEST_ROOT / filename, sorted(files, key=lambda p: rel_posix(p)))

def regenerate_manifests(import_summary: dict | None = None) -> None:
    ensure(MANIFEST_ROOT)

    runtimes = runtime_files()
    sources = source_files()
    licenses = license_files()
    all_for_checksums = sorted(sources + runtimes + licenses, key=lambda p: rel_posix(p))

    write_list(MANIFEST_ROOT / "all-assets.txt", runtimes)
    write_list(MANIFEST_ROOT / "runtime-all-files.txt", runtimes)
    write_list(MANIFEST_ROOT / "harthmere-runtime-assets.txt", runtimes)
    write_list(MANIFEST_ROOT / "source-all-files.txt", sources)
    write_list(MANIFEST_ROOT / "all-model-files.txt", [p for p in runtimes if p.suffix.lower() in MODEL_EXTS])
    write_list(MANIFEST_ROOT / "all-texture-files.txt", [p for p in runtimes if p.suffix.lower() in TEXTURE_EXTS])

    category_folders = {
        "weapons.txt": ["glb/equipment/weapons", "fbx/equipment/weapons", "obj/equipment/weapons"],
        "shields.txt": ["glb/equipment/shields", "fbx/equipment/shields", "obj/equipment/shields"],
        "ranged-weapons.txt": ["glb/equipment/ranged", "fbx/equipment/ranged", "obj/equipment/ranged"],
        "magic-equipment.txt": ["glb/equipment/magic", "fbx/equipment/magic", "obj/equipment/magic"],
        "items.txt": ["glb/equipment/items", "fbx/equipment/items", "obj/equipment/items", "png/kenney/items"],
        "monsters-fbx.txt": ["fbx/creatures/monsters"],
        "monsters-obj.txt": ["obj/creatures/monsters"],
        "buildings.txt": ["glb/buildings", "fbx/buildings", "obj/buildings"],
        "trees.txt": ["glb/environment/trees", "fbx/environment/trees", "obj/environment/trees", "vox/environment/trees"],
        "shrubbery.txt": ["glb/environment/shrubbery", "fbx/environment/shrubbery", "obj/environment/shrubbery"],
        "rocks.txt": ["glb/environment/rocks", "fbx/environment/rocks", "obj/environment/rocks"],
        "roads.txt": ["glb/environment/roads", "fbx/environment/roads", "obj/environment/roads"],
        "fences.txt": ["glb/environment/fences", "fbx/environment/fences", "obj/environment/fences", "vox/environment/graveyard/voxel_graveyard"],
        "dungeon-props.txt": ["glb/props/dungeon", "fbx/props/dungeon", "obj/props/dungeon"],
        "magic-props.txt": ["glb/props/magic", "fbx/props/magic", "obj/props/magic"],
        "market-props.txt": ["glb/props/market", "fbx/props/market", "obj/props/market"],
        "town-props.txt": ["glb/props/town", "fbx/props/town", "obj/props/town", "vox/props/itch_voxel_asset_pack", "png/props/itch_voxel_asset_pack"],
        "voxel-graveyard.txt": ["obj/environment/graveyard/voxel_graveyard", "vox/environment/graveyard/voxel_graveyard"],
        "voxel-mines.txt": ["glb/environment/mines/kyrises_voxel_mines", "fbx/environment/mines/kyrises_voxel_mines", "obj/environment/mines/kyrises_voxel_mines", "vox/environment/mines/kyrises_voxel_mines", "png/environment/mines/kyrises_voxel_mines"],
        "voxel-large-tree.txt": ["obj/environment/trees/large_tree", "vox/environment/trees/large_tree"],
        "voxel-wild-west.txt": ["fbx/environment/wild_west/wild_west_asset_pack"],
        "voxel-itch-props.txt": ["vox/props/itch_voxel_asset_pack", "png/props/itch_voxel_asset_pack"],
        "kenney-voxel-pack.txt": ["png/kenney"],
        "vox-sources.txt": ["vox"],
        "png-assets.txt": ["png"],
    }

    for filename, folders in category_folders.items():
        write_category_manifest(filename, folders)

    write_list(MANIFEST_ROOT / "obj-models.txt", [p for p in runtimes if "/obj/" in f"/{rel_posix(p)}/" and p.suffix.lower() in {".obj", ".mtl"}])
    write_list(MANIFEST_ROOT / "obj-textures.txt", [p for p in runtimes if "/obj/" in f"/{rel_posix(p)}/" and p.suffix.lower() in TEXTURE_EXTS])

    with (MANIFEST_ROOT / "asset-index.csv").open("w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=["bucket", "category", "type", "size_bytes", "path"])
        writer.writeheader()
        for p in sorted(sources + runtimes, key=lambda p: rel_posix(p)):
            rel = rel_posix(p)
            parts = rel.split("/")
            writer.writerow({
                "bucket": parts[0] if parts else "",
                "category": "/".join(parts[:4]) if len(parts) >= 4 else "/".join(parts[:-1]),
                "type": p.suffix.lower().replace(".", ""),
                "size_bytes": p.stat().st_size,
                "path": rel,
            })

    checksum_rows: list[tuple[str, str]] = []
    checksum_map: dict[str, list[str]] = defaultdict(list)
    runtime_checksum_map: dict[str, list[str]] = defaultdict(list)
    filename_map: dict[str, list[str]] = defaultdict(list)

    for p in all_for_checksums:
        digest = sha256_file(p)
        rel = rel_posix(p)
        checksum_rows.append((digest, rel))
        checksum_map[digest].append(rel)
        filename_map[p.name].append(rel)
        if p in runtimes:
            runtime_checksum_map[digest].append(rel)

    (MANIFEST_ROOT / "checksums.txt").write_text(
        "".join(f"{digest}  {rel}\n" for digest, rel in sorted(checksum_rows, key=lambda x: (x[0], x[1]))),
        encoding="utf-8",
    )

    runtime_checksum_rows = [(sha256_file(p), rel_posix(p)) for p in runtimes]
    (MANIFEST_ROOT / "runtime-checksums.txt").write_text(
        "".join(f"{digest}  {rel}\n" for digest, rel in sorted(runtime_checksum_rows, key=lambda x: (x[0], x[1]))),
        encoding="utf-8",
    )

    duplicate_filenames = {name: paths for name, paths in filename_map.items() if len(paths) > 1}
    duplicate_checksums = {digest: paths for digest, paths in checksum_map.items() if len(paths) > 1}
    runtime_duplicate_checksums = {digest: paths for digest, paths in runtime_checksum_map.items() if len(paths) > 1}

    (MANIFEST_ROOT / "duplicate-filenames.txt").write_text(
        "\n".join(sorted(duplicate_filenames)) + ("\n" if duplicate_filenames else ""),
        encoding="utf-8",
    )
    (MANIFEST_ROOT / "duplicate-checksums.txt").write_text(
        "\n".join(sorted(duplicate_checksums)) + ("\n" if duplicate_checksums else ""),
        encoding="utf-8",
    )
    (MANIFEST_ROOT / "runtime-duplicate-checksums.txt").write_text(
        "\n".join(sorted(runtime_duplicate_checksums)) + ("\n" if runtime_duplicate_checksums else ""),
        encoding="utf-8",
    )

    def write_detailed(path: Path, groups: dict[str, list[str]]) -> None:
        lines: list[str] = []
        for key in sorted(groups):
            lines.append(key)
            for rel in sorted(groups[key]):
                lines.append(f"  {rel}")
            lines.append("")
        path.write_text("\n".join(lines), encoding="utf-8")

    write_detailed(MANIFEST_ROOT / "duplicate-filenames-detailed.txt", duplicate_filenames)
    write_detailed(MANIFEST_ROOT / "duplicate-checksums-detailed.txt", duplicate_checksums)
    write_detailed(MANIFEST_ROOT / "runtime-duplicate-checksums-detailed.txt", runtime_duplicate_checksums)

    ext_counts = Counter(p.suffix.lower().replace(".", "").upper() or "NO EXT" for p in runtimes)

    summary_lines = [
        "Harthmere Asset Manifest Summary",
        f"Generated: {datetime.now().isoformat(timespec='seconds')}",
        "",
        "SOURCE FILES:",
        str(len(sources)),
        "",
        "RUNTIME FILES:",
        str(len(runtimes)),
        "",
    ]

    for ext in ["GLB", "GLTF", "BIN", "FBX", "OBJ", "MTL", "PNG", "JPG", "JPEG", "WEBP", "SVG", "XML", "VOX"]:
        summary_lines.extend([f"{ext}:", str(ext_counts.get(ext, 0)), ""])

    summary_lines.extend([
        "DUPLICATE FILENAME GROUPS:",
        str(len(duplicate_filenames)),
        "",
        "DUPLICATE CHECKSUM GROUPS:",
        str(len(duplicate_checksums)),
        "",
        "RUNTIME DUPLICATE CHECKSUM GROUPS:",
        str(len(runtime_duplicate_checksums)),
        "",
    ])

    (MANIFEST_ROOT / "summary.txt").write_text("\n".join(summary_lines), encoding="utf-8")

    used_keys: set[str] = set()
    json_assets = []

    for p in runtimes:
        rel = rel_posix(p)
        fmt = p.suffix.lower().replace(".", "")
        json_assets.append({
            "key": key_for_path(rel, used_keys),
            "type": classify_asset(p),
            "format": fmt,
            "path": rel,
            "url": f"/assets/harthmere/{'/'.join(quote(part) for part in rel.split('/'))}",
            "sizeBytes": p.stat().st_size,
            "browserSafe": fmt in {"glb", "gltf", "png", "jpg", "jpeg", "webp", "svg", "xml", "json"},
            "needsSpecialLoader": fmt in {"fbx", "obj", "vox"},
        })

    public_manifest = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "rootUrl": "/assets/harthmere",
        "total": len(json_assets),
        "counts": {
            "runtimeFiles": len(runtimes),
            "sourceFiles": len(sources),
            "licenses": len(licenses),
            "duplicateFilenameGroups": len(duplicate_filenames),
            "duplicateChecksumGroups": len(duplicate_checksums),
            "runtimeDuplicateChecksumGroups": len(runtime_duplicate_checksums),
            **{k.lower(): v for k, v in ext_counts.items()},
        },
        "assets": json_assets,
    }

    (MANIFEST_ROOT / "harthmere-runtime-assets.json").write_text(
        json.dumps(public_manifest, indent=2),
        encoding="utf-8",
    )

    if import_summary is not None:
        (MANIFEST_ROOT / "voxel-import-summary.json").write_text(
            json.dumps(import_summary, indent=2),
            encoding="utf-8",
        )

    ts_path = ROOT / "src/shared/game/medieval/harthmereAssetManifest.generated.ts"
    if ts_path.parent.exists():
        ts = f'''// Auto-generated by scripts/harthmere/import_voxel_asset_packs.py
// Generated at: {datetime.now().isoformat(timespec="seconds")}
// Do not hand-edit. Re-run the importer after adding/removing Harthmere assets.

export type HarthmereAssetType = "model" | "model-binary" | "material" | "texture" | "metadata" | "other";

export type HarthmereAsset = {{
  key: string;
  type: HarthmereAssetType;
  format: string;
  path: string;
  url: string;
  sizeBytes: number;
  browserSafe: boolean;
  needsSpecialLoader: boolean;
}};

export const HARTHMERE_ASSET_ROOT_URL = "/assets/harthmere";

export const HARTHMERE_ALL_ASSETS: HarthmereAsset[] = {json.dumps(json_assets, indent=2)};

export const HARTHMERE_MODEL_ASSETS: HarthmereAsset[] = HARTHMERE_ALL_ASSETS.filter(
  (asset) => asset.type === "model"
);

export const HARTHMERE_TEXTURE_ASSETS: HarthmereAsset[] = HARTHMERE_ALL_ASSETS.filter(
  (asset) => asset.type === "texture"
);

export const HARTHMERE_BROWSER_SAFE_ASSETS: HarthmereAsset[] = HARTHMERE_ALL_ASSETS.filter(
  (asset) => asset.browserSafe
);

export const HARTHMERE_SPECIAL_LOADER_ASSETS: HarthmereAsset[] = HARTHMERE_ALL_ASSETS.filter(
  (asset) => asset.needsSpecialLoader
);
'''
        ts_path.write_text(ts, encoding="utf-8")

def main() -> None:
    if not HARTH.exists():
        raise SystemExit(f"Missing Harthmere directory: {HARTH}")

    ensure(SOURCE_ROOT)
    ensure(LICENSE_ROOT)
    ensure(MANIFEST_ROOT)

    missing = []
    import_summary = {
        "generatedAt": datetime.now().isoformat(timespec="seconds"),
        "downloads": str(DOWNLOADS),
        "harthmere": str(HARTH),
        "packs": [],
    }

    for pack in PACKS:
        zip_path = find_zip(pack["patterns"])
        if zip_path is None:
            missing.append(pack["display"])
            continue

        source_dest, source_copied, source_skipped = extract_pack(zip_path, pack)
        license_count = collect_licenses(source_dest, zip_path, pack)
        runtime_result = import_runtime(pack, source_dest)

        import_summary["packs"].append({
            "key": pack["key"],
            "display": pack["display"],
            "zip": str(zip_path),
            "sourceFilesCopied": source_copied,
            "sourceFilesSkipped": source_skipped,
            "licenseFilesCopied": license_count,
            **runtime_result,
        })

    if missing:
        print("Missing ZIP files in:", DOWNLOADS)
        for item in missing:
            print(f"  - {item}")
        print("No manifest regeneration was performed because one or more packs were missing.")
        sys.exit(1)

    regenerate_manifests(import_summary)

    print("Imported voxel asset packs into:", HARTH)
    for pack in import_summary["packs"]:
        print(f"- {pack['display']}: copied={pack['copied']} unchanged={pack['unchanged']} skipped={pack['skipped']} licenses={pack['licenseFilesCopied']}")
    print("Wrote manifests under:", MANIFEST_ROOT)
    print("Wrote TypeScript manifest if src/shared/game/medieval exists.")

if __name__ == "__main__":
    main()
