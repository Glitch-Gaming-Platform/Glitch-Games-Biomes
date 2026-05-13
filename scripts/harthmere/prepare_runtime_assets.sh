#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-public/assets/harthmere}"
SOURCE="$ROOT/_source"
MEDIEVAL_SRC="$SOURCE/medieval_voxel/Medieval Assets/GTLF"
MEDIEVAL_DST="$ROOT/glb/medieval"

mkdir -p "$MEDIEVAL_DST" "$ROOT/manifest"

copy_glb() {
  local from="$1"
  local to="$2"
  if [[ -f "$from" ]]; then
    cp "$from" "$to"
    echo "$to"
  else
    echo "WARN missing: $from" >&2
  fi
}

if [[ ! -d "$ROOT" ]]; then
  echo "Missing $ROOT. Run this from the repo root after extracting the Harthmere assets." >&2
  exit 1
fi

if [[ ! -d "$MEDIEVAL_SRC" ]]; then
  echo "Missing $MEDIEVAL_SRC" >&2
  echo "You can still use the OBJ interiors, but GLB banners/lamps/signposts will not be copied." >&2
else
  copy_glb "$MEDIEVAL_SRC/Flags And Banners/Banners/Base_Banner_Red.glb" "$MEDIEVAL_DST/base_banner_red.glb"
  copy_glb "$MEDIEVAL_SRC/Flags And Banners/Banners/Base_Banner_Blue.glb" "$MEDIEVAL_DST/base_banner_blue.glb"
  copy_glb "$MEDIEVAL_SRC/Flags And Banners/Banners/Base_Banner_Green.glb" "$MEDIEVAL_DST/base_banner_green.glb"
  copy_glb "$MEDIEVAL_SRC/Flags And Banners/Flags/Flag_Small_Red.glb" "$MEDIEVAL_DST/flag_small_red.glb"
  copy_glb "$MEDIEVAL_SRC/Lamps/Lamp_Ground_Large.glb" "$MEDIEVAL_DST/lamp_ground_large.glb"
  copy_glb "$MEDIEVAL_SRC/Lamps/Lamp_Ground_Small.glb" "$MEDIEVAL_DST/lamp_ground_small.glb"
  copy_glb "$MEDIEVAL_SRC/Lamps/Lamp_Wall.glb" "$MEDIEVAL_DST/lamp_wall.glb"
  copy_glb "$MEDIEVAL_SRC/Others/Kiosk.glb" "$MEDIEVAL_DST/kiosk.glb"
  copy_glb "$MEDIEVAL_SRC/Others/Sing_Post.glb" "$MEDIEVAL_DST/sign_post.glb"
  copy_glb "$MEDIEVAL_SRC/Others/Cart_Straight.glb" "$MEDIEVAL_DST/cart_straight.glb"
  copy_glb "$MEDIEVAL_SRC/Others/Cart_Inclined.glb" "$MEDIEVAL_DST/cart_inclined.glb"
  copy_glb "$MEDIEVAL_SRC/Shops/Shop_Simple.glb" "$MEDIEVAL_DST/shop_simple.glb"
  copy_glb "$MEDIEVAL_SRC/Shops/Shop_Closed.glb" "$MEDIEVAL_DST/shop_closed.glb"
fi

# Keep OBJ, MTL, and PNG files together. The renderer loads these names directly.
for dir in "$ROOT/obj/tavern" "$ROOT/obj/church_cemetery" "$ROOT/obj/town_sample"; do
  if [[ ! -d "$dir" ]]; then
    echo "WARN missing organized OBJ folder: $dir" >&2
  fi
done

find "$ROOT/glb" "$ROOT/obj" -type f 2>/dev/null | sort > "$ROOT/manifest/harthmere-runtime-assets.txt"

echo "Prepared Harthmere runtime assets."
echo "Manifest: $ROOT/manifest/harthmere-runtime-assets.txt"
echo "GLB count: $(find "$ROOT/glb" -type f -name '*.glb' 2>/dev/null | wc -l | tr -d ' ')"
echo "OBJ count: $(find "$ROOT/obj" -type f -name '*.obj' 2>/dev/null | wc -l | tr -d ' ')"
