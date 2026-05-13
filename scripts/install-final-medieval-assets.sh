#!/usr/bin/env bash
set -euo pipefail

# Installs the final medieval MMO asset packs into the Biomes/static asset bucket.
# Usage from repo root:
#   PACK_DIR=/path/to/downloaded/zips ./scripts/install-final-medieval-assets.sh
#
# Default PACK_DIR is ./asset-packs.
# Default ASSET_ROOT is ./public/buckets/biomes-static/asset_data.

PACK_DIR="${PACK_DIR:-asset-packs}"
ASSET_ROOT="${ASSET_ROOT:-public/buckets/biomes-static/asset_data}"
VENDOR_ROOT="$ASSET_ROOT/vendor"

require_zip() {
  local pattern="$1"
  local found
  found=$(find "$PACK_DIR" -maxdepth 1 -type f -name "$pattern" | head -n 1 || true)
  if [[ -z "$found" ]]; then
    echo "Missing required zip matching: $PACK_DIR/$pattern" >&2
    exit 1
  fi
  printf '%s' "$found"
}

extract_dir() {
  local zip="$1"
  local zip_prefix="$2"
  local dest="$3"

  mkdir -p "$dest"
  local tmp
  tmp=$(mktemp -d)
  unzip -q "$zip" "$zip_prefix/*" -d "$tmp"

  # Copy the contents of the zip prefix into dest, not the prefix directory itself.
  local source_dir="$tmp/$zip_prefix"
  if [[ ! -d "$source_dir" ]]; then
    echo "Expected extracted directory not found: $source_dir" >&2
    rm -rf "$tmp"
    exit 1
  fi

  rsync -a --delete "$source_dir/" "$dest/"
  rm -rf "$tmp"
}

extract_file() {
  local zip="$1"
  local zip_path="$2"
  local dest_dir="$3"
  mkdir -p "$dest_dir"
  unzip -q -j "$zip" "$zip_path" -d "$dest_dir"
}

echo "Installing final medieval MMO assets"
echo "PACK_DIR=$PACK_DIR"
echo "ASSET_ROOT=$ASSET_ROOT"

mkdir -p "$VENDOR_ROOT"

KAYKIT_ZIP=$(require_zip 'KayKit_Forest_Nature_Pack_1.0_FREE.zip')
FANTASY_ZIP=$(require_zip 'Fantasy Props MegaKit[Standard].zip')
FARM_ZIP=$(require_zip 'Farm Animals by @Quaternius*.zip')
FOOD_ZIP=$(require_zip 'Ultimate Food Pack - Oct 2019*.zip')
RPG_ZIP=$(require_zip 'Ultimate RPG Items Pack - Aug 2019*.zip')
KENNEY_ZIP=$(require_zip 'kenney_game-icons.zip')

# Browser-safe GLTF packs. These MUST preserve .gltf sidecar .bin/.png files in the same folder.
extract_dir "$KAYKIT_ZIP" 'KayKit_Forest_Nature_Pack_1.0_FREE/Assets/gltf' \
  "$VENDOR_ROOT/kaykit/forest_nature/gltf"
extract_file "$KAYKIT_ZIP" 'KayKit_Forest_Nature_Pack_1.0_FREE/License.txt' \
  "$VENDOR_ROOT/kaykit/forest_nature"

extract_dir "$FANTASY_ZIP" 'Exports/glTF' \
  "$VENDOR_ROOT/quaternius/fantasy_props/gltf"
extract_file "$FANTASY_ZIP" 'License_Standard.txt' \
  "$VENDOR_ROOT/quaternius/fantasy_props"

# FBX-only/OBJ-only packs. These are copied, but must be loaded through FBXLoader/OBJLoader or converted later.
# Do not fake these as .glb paths. That is what causes the broken asset references.
extract_dir "$FARM_ZIP" 'Farm Animals by @Quaternius/FBX' \
  "$VENDOR_ROOT/quaternius/farm_animals/fbx"
extract_file "$FARM_ZIP" 'Farm Animals by @Quaternius/License.txt' \
  "$VENDOR_ROOT/quaternius/farm_animals"

extract_dir "$FOOD_ZIP" 'Ultimate Food Pack - Oct 2019/FBX' \
  "$VENDOR_ROOT/quaternius/ultimate_food/fbx"
extract_file "$FOOD_ZIP" 'Ultimate Food Pack - Oct 2019/License.txt' \
  "$VENDOR_ROOT/quaternius/ultimate_food"

extract_dir "$RPG_ZIP" 'Ultimate RPG Items Pack - Aug 2019/FBX' \
  "$VENDOR_ROOT/quaternius/ultimate_rpg_items/fbx"
extract_dir "$RPG_ZIP" 'Ultimate RPG Items Pack - Aug 2019/Icons' \
  "$VENDOR_ROOT/quaternius/ultimate_rpg_items/icons"
extract_file "$RPG_ZIP" 'Ultimate RPG Items Pack - Aug 2019/License.txt' \
  "$VENDOR_ROOT/quaternius/ultimate_rpg_items"

# UI icons for controls/inventory/HUD.
extract_dir "$KENNEY_ZIP" 'PNG/White/2x' \
  "$VENDOR_ROOT/kenney/game_icons/white_2x"
extract_dir "$KENNEY_ZIP" 'PNG/Black/2x' \
  "$VENDOR_ROOT/kenney/game_icons/black_2x"
extract_file "$KENNEY_ZIP" 'license.txt' \
  "$VENDOR_ROOT/kenney/game_icons"

cat > "$VENDOR_ROOT/medieval_asset_manifest.json" <<'JSON'
{
  "installed": true,
  "assetRoot": "/buckets/biomes-static/asset_data",
  "packs": {
    "kaykitForestNature": "vendor/kaykit/forest_nature/gltf",
    "quaterniusFantasyProps": "vendor/quaternius/fantasy_props/gltf",
    "quaterniusFarmAnimals": "vendor/quaternius/farm_animals/fbx",
    "quaterniusUltimateFood": "vendor/quaternius/ultimate_food/fbx",
    "quaterniusUltimateRpgItems": "vendor/quaternius/ultimate_rpg_items/fbx",
    "quaterniusUltimateRpgItemIcons": "vendor/quaternius/ultimate_rpg_items/icons",
    "kenneyGameIconsWhite": "vendor/kenney/game_icons/white_2x",
    "kenneyGameIconsBlack": "vendor/kenney/game_icons/black_2x"
  },
  "notes": [
    "KayKit forest and Quaternius fantasy props are GLTF and can be used directly with GLTFLoader.",
    "Farm animals, food, and RPG item models are FBX. Use FBXLoader or convert them before referencing them in GLTF-only code.",
    "All referenced .gltf sidecar .bin/.png files are preserved in the same directory."
  ]
}
JSON

echo "Done. Installed assets under: $VENDOR_ROOT"
