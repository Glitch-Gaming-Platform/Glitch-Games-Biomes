# Home Decoration Item Audit v1

Generated: 2026-05-30T12:44:09.164Z

## System Answer

There is a home/decor-adjacent system, but it is split across two layers:

- The original Biomes placeable system lets items/blueprints become ECS placeable entities. It uses Bikkie metadata such as `isPlaceable`, `isBlueprint`, `boxSize`, `collidableSize`, and `galoisPath`.
- Harthmere has generated resident housing decor. Rooms are populated by authored decor arrays and runtime asset placements; this is currently world/NPC housing decoration, not a full player-facing freeform home decoration editor.

## Coverage

- Live Bikkie items decoded: 1722
- Bikkie placeable or blueprint items: 141
- Bikkie `action: "place"` items, including blocks/florae: 301
- Core exported placeable assets: 78
- Harthmere runtime assets parsed from renderer: 312
- Harthmere assets loaded/rendered in browser: 312/312
- Core placeable models loaded/rendered in browser: 75/75

## Visual Atlases

- Harthmere: harthmere-runtime-assets-atlas-page-01.png
- Harthmere: harthmere-runtime-assets-atlas-page-02.png
- Harthmere: harthmere-runtime-assets-atlas-page-03.png
- Harthmere: harthmere-runtime-assets-atlas-page-04.png
- Harthmere: harthmere-runtime-assets-atlas-page-05.png
- Harthmere: harthmere-runtime-assets-atlas-page-06.png
- Harthmere: harthmere-runtime-assets-atlas-page-07.png
- Harthmere: harthmere-runtime-assets-atlas-page-08.png
- Harthmere: harthmere-runtime-assets-atlas-page-09.png
- Harthmere: harthmere-runtime-assets-atlas-page-10.png
- Harthmere: harthmere-runtime-assets-atlas-page-11.png
- Harthmere: harthmere-runtime-assets-atlas-page-12.png
- Harthmere: harthmere-runtime-assets-atlas-page-13.png
- Core placeables: core-placeable-models-atlas-page-01.png
- Core placeables: core-placeable-models-atlas-page-02.png
- Core placeables: core-placeable-models-atlas-page-03.png

## Size Watchlist

Harthmere runtime assets with warnings:

- forest_tree_2d: resource/voxel prop is large; verify intended world scale; size={"x":4.7396,"y":8.0876,"z":4.0344}
- forest_tree_4c: resource/voxel prop is large; verify intended world scale; large bounds for non-architecture object; size={"x":3.7352,"y":10.774,"z":2.8691}
- forest_tree_bare_2b: resource/voxel prop is large; verify intended world scale; size={"x":1.7878,"y":5.5417,"z":0.6639}
- mine_stone_01: resource/voxel prop is large; verify intended world scale; size={"x":7.2,"y":4.5,"z":6.3}
- mine_stone_02: resource/voxel prop is large; verify intended world scale; size={"x":6.3,"y":3.6,"z":2.7}
- mine_coal_block: resource/voxel prop is large; verify intended world scale; size={"x":7.2,"y":7.2,"z":7.2}
- mine_pickaxe: decorative_tiny role but larger than expected; handheld/tabletop-looking prop appears oversized; resource/voxel prop is large; verify intended world scale; size={"x":5.6,"y":5.6,"z":0.8}
- mine_gold_block: resource/voxel prop is large; verify intended world scale; size={"x":6.4,"y":6.4,"z":6.4}
- mine_silver_block: resource/voxel prop is large; verify intended world scale; size={"x":6.4,"y":6.4,"z":6.4}
- banner_blue: decorative_tiny role but larger than expected; size={"x":1.23,"y":2.6208,"z":0.2558}
- banner_yellow: decorative_tiny role but larger than expected; size={"x":1.23,"y":2.6208,"z":0.2558}
- banner_white: decorative_tiny role but larger than expected; size={"x":1.23,"y":2.6208,"z":0.2558}
- banner_brown: decorative_tiny role but larger than expected; size={"x":1.23,"y":2.6208,"z":0.2558}
- sword_2h: decorative_tiny role but larger than expected; size={"x":0.6041,"y":1.7034,"z":0.1786}
- sword_2h_color: decorative_tiny role but larger than expected; size={"x":0.6041,"y":1.7034,"z":0.1786}
- staff: decorative_tiny role but larger than expected; size={"x":0.4322,"y":1.616,"z":0.2192}
- bookcase_2: decorative_tiny role but larger than expected; handheld/tabletop-looking prop appears oversized; size={"x":1.1982,"y":2.0868,"z":0.3518}
- obj_house_1: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":6.5,"y":4,"z":6.4}
- obj_house_2: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":4.8,"y":5.2,"z":6.1}
- obj_house_3: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":4.1,"y":6.7,"z":4}
- obj_shop_simple: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":2.4,"y":2,"z":2}
- obj_shop_closed: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":2.8,"y":2.3,"z":2.4}
- obj_kiosk: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":4.2,"y":4.8,"z":6}
- obj_tower_complex: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":6,"y":7.2,"z":6}
- obj_tower_door: renders mostly white/untextured; verify OBJ MTL/texture hookup; size={"x":1.6,"y":1.8,"z":0.4}

Bikkie placeable/blueprint items with warnings:

- Traditional Shelter Frame Blueprint: very large placeable bounds; box={"x":13,"y":12,"z":11} collidable=undefined galoisPath=items/blueprint
- Floor Plate: very thin/low placeable bounds; box={"x":1,"y":0.1,"z":1} collidable=undefined galoisPath=placeables/quests/plate_floor
- ???: missing boxSize; box=undefined collidable=undefined galoisPath=none
- Handcraft: missing boxSize; box=undefined collidable=undefined galoisPath=none
- Race Checkpoint — Wide: very thin/low placeable bounds; box={"x":1,"y":0.05,"z":2} collidable=undefined galoisPath=none
- Race Start Plate: very thin/low placeable bounds; box={"x":1,"y":2,"z":2} collidable={"x":1,"y":0.05,"z":2} galoisPath=none
- Space Age Shelter Frame Blueprint: very large placeable bounds; box={"x":13,"y":9,"z":13} collidable=undefined galoisPath=items/blueprint
- Race Checkpoint: very thin/low placeable bounds; box={"x":1,"y":0.05,"z":1} collidable=undefined galoisPath=none
- Unknown Item: missing boxSize; box=undefined collidable=undefined galoisPath=none
- Gate: very thin/low placeable bounds; box={"x":1,"y":2,"z":2} collidable={"x":1,"y":0.05,"z":2} galoisPath=none
- Needle: missing boxSize; box=undefined collidable=undefined galoisPath=none
- Container: missing boxSize; box=undefined collidable=undefined galoisPath=none
- Race End Plate: very thin/low placeable bounds; box={"x":1,"y":2,"z":2} collidable={"x":1,"y":0.05,"z":2} galoisPath=none
- Unknown Crafting Station: missing boxSize; box=undefined collidable=undefined galoisPath=none
- Race Checkpoint — Big: very thin/low placeable bounds; box={"x":2,"y":0.05,"z":2} collidable=undefined galoisPath=none
- Race Checkpoint — Ultra Wide: very thin/low placeable bounds; box={"x":1,"y":0.05,"z":3} collidable=undefined galoisPath=none
- Spleef Spawn Point: very thin/low placeable bounds; box={"x":1,"y":0.1,"z":1} collidable=undefined galoisPath=none
- Jumbotron XL: very large placeable bounds; box={"x":1,"y":11.2,"z":16.4} collidable=undefined galoisPath=none
- Palm Leaves: very large placeable bounds; box={"x":17,"y":6,"z":17} collidable=undefined galoisPath=none
- Modern Shelter Frame Blueprint: very large placeable bounds; box={"x":11,"y":11,"z":13} collidable=undefined galoisPath=items/blueprint
- Blueprint: missing boxSize; box=undefined collidable=undefined galoisPath=items/blueprint
- Robot Motor Unit: missing boxSize; box=undefined collidable=undefined galoisPath=items/robot_chipset
- Door: missing boxSize; box=undefined collidable=undefined galoisPath=none

## Resident Housing Decor

- Residential room decor items: bed_twin2 (bed), chest_wood_fp (storage), candlestick_fp (light), nightstand (table), book_stack_1 (personal), banner_green (wall)
- Slum room decor items: bed_twin2 (bed), crate_wooden_fp (storage), candle_1_fp (light), stool_fp (table), bag_fp (personal), banner_brown (wall)
- Housing buildings parsed: 14
- Resident/slum room capacity parsed from building definitions: 250

## Procedural / Voxel Generated Catalog

- **Core .vox-authored placeables**: Legacy Biomes placeables are authored from voxel/source assets and exported as GLTF/icon assets for the placeable ECS system.
- **Harthmere resident room decor placements**: NPC home rooms procedurally receive beds, storage, lights, tables, personal objects, and wall hangings from resident/slum decor arrays.
- **Procedural jobs board kiosks**: Two jobs board kiosks are generated entirely from Three.js boxes/lights: Grove market and town market boards.
- **Procedural quest object markers**: Quest-linked landmarks generate lightweight object meshes from boxes, cylinders, torus rings, flags, crates, ledgers, boards, paint pots, routes, material clusters, and active beacons.
- **Player voxel building blueprints**: Player buildings are defined as solid voxel structures; GLTFs may decorate, but the authoritative building geometry is generated as voxel foundation/floor/walls/roof/stair/door pieces.
- **Block-built service and town shells**: Town/service buildings are generated from 1m block wall and floor slab contracts with entrance clearances and story heights.
- **Procedural voxel actors**: Townsperson and animal proxies can be generated from rounded voxel body/head/face/clothing primitives before or instead of GLTF attachments.
- **Imported Harthmere voxel packs**: Imported voxel pack assets include mines, graveyard props, itch props, large trees, wild-west props, Kenney voxel pack files, and medieval voxel OBJ structures.

## Files

- `home-decoration-item-audit-v1.json`: full merged metadata, raw Bikkie snapshots, render measurements, colors, descriptions, warnings.
- `harthmere-runtime-assets.csv`: spreadsheet-friendly Harthmere asset table.
- `bikkie-placeable-items.csv`: spreadsheet-friendly Bikkie placeable/blueprint table.
- `core-placeable-assets.csv`: exported core placeable asset table.
- `bikkie-all-items-raw.json`: all decoded live Bikkie item metadata.

