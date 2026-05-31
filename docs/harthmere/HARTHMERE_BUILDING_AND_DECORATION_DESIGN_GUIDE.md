# Harthmere Building and Decoration Design Guide

This guide captures the production rules for player buildings, business outposts, home interiors, furniture, and the in-world interface access points used to open dashboards.

The short version:

> A building is not complete until the backend generates a grounded voxel structure, the player can enter it, furniture is supported and passable, NPC/customer paths have room to work, and every interface has a visible in-world access point.

## Source of truth

Use backend/shared data as the source of truth for building layout and access records.

- `src/shared/harthmere/building_system_v1.ts` owns player property plots, blueprints, voxel materialization, storage, doors, home console markers, and business counter markers.
- `src/shared/harthmere/business_customer_simulator_v1.ts` owns business outpost records, customer pools, minigame business types, and outpost building metadata.
- `src/shared/harthmere/live_mode_backend_v1.ts` owns live-mode placement, property persistence, physical access records, and proximity gates.
- `src/client/components/biomes_ui/tabs/LandTab.tsx` owns the Building System UI.
- `src/client/components/harthmere_home/*` owns the separate in-building Home Console UI.

Do not make structural buildings by stacking GLB/OBJ pieces in the renderer. Visual props may dress a building, but the building shell, access markers, and gameplay records must come from backend/shared building data.

## Building shell rules

Every playable building shell should include:

- A grounded foundation, walkable floor, walls, and roof.
- A clear front entrance with a two-block-tall opening or an equivalent validated doorway.
- A stair or threshold when the entrance is one block above nearby ground.
- Interior or exterior stairs for every reachable upper floor, balcony, loft, roof deck, or raised platform.
- Safe ground for purchased Grove plots when the plot starts mucked.
- A deterministic origin derived from the plot/outpost record, not from ad hoc renderer offsets.
- Physical voxel edits for the door access point, storage, home console, or business counter when those features exist.

Avoid floating structures. If terrain is sloped, add procedural supports, retaining walls, stairs, or a cut/fill pad. Never leave the player looking at objects suspended in air.

## Stairs and multi-floor buildings

Multi-floor buildings are allowed only when the extra floor is actually usable.

- A second floor, loft, roof deck, or raised service platform must have stairs, a landing, and enough headroom.
- Stairs should start from a clear interior aisle or exterior entry path, not from inside furniture or behind a counter.
- Stairs must not block the front door, customer queue, service counter, Home Console, Customer Counter, storage, or emergency exit route.
- Landings should be at least 2 voxels deep where a player or NPC changes direction.
- A multi-floor business should put the customer mini-game on the first floor unless the pathing system proves customers can use the stairs.
- Upper floors should carry a purpose: inn rooms, office, staff room, storage loft, guild meeting room, clinic recovery bed, or manager dashboard.
- If the building shell has a roof deck, add a visible parapet, rail, or wall edge so it does not read as unfinished geometry.
- If a future blueprint declares multiple floors but lacks validated stairs, add a safety exterior stair/landing or reject the blueprint.

## Size and passability

Mini-game businesses must be larger than decorative buildings. A player, customers, and employees need room to move.

Required clearances:

- Front door: at least 2 voxels clear.
- Public entrance approach: at least 3 voxels clear.
- Customer floor area: at least 4 voxels of clear working depth, with larger footprints for restaurants, inns, smithies, refineries, clinics, and warehouses.
- Queue path: entrance to queue to service counter to exit must remain unblocked.
- Employee path: employee entry, stock room, prep station, cleanup station, dispatch desk, and branch desk paths must not cross solid props.

Furniture must never block:

- Door openings.
- Home Console.
- Customer Counter.
- Jobs Board.
- Storage Chest.
- Stairs.
- Critical queue or service paths.

If a pathing system cannot prove a prop is passable, treat that prop as blocking and move it against a wall or into a non-route corner.

## Doors, windows, signs, and access points

Doors and access points are gameplay objects, not just decoration.

- Door records must use the real building origin.
- Door labels shown to players should be readable, such as `Voxel Cottage Door`, not property ids or backend codes.
- Home Console markers belong inside homes and are owner-only.
- Business Counter markers belong inside businesses and are customer/owner-facing.
- Storage Chest markers should be inside the building near a wall, not in the doorway.
- Jobs Boards belong outside or at a public threshold, visible from the approach path.

Windows can be voxel cutouts, shaped blocks, or renderer dressing, but they must be anchored to real walls and must not create invisible collision surprises. If a window is decorative only, keep it visually aligned with the wall and do not rely on it for pathing.

## Interior furniture rules

Furniture should make the building read as its profession while preserving the route graph.

Use supported, grounded furniture:

- Tables, counters, benches, cabinets, shelves, storage chests, bookcases, lamps, candles, crates, beds, rugs, planters, machines, workstations, and signs.
- Wall furniture should touch a wall or support post.
- Small props should sit on a table, shelf, counter, cabinet, or floor.
- Hanging objects need a visible wall, ceiling, beam, or post.
- No floating bottles, lamps, shelves, signs, counters, or dashboards.

Business-specific examples:

- Restaurant: counter, prep table, oven/stove station, food shelves, tables, stools, cleanup corner, ingredient storage.
- Clinic: intake counter, treatment bed, medicine shelf, wash station, privacy divider, record shelf.
- Smithy: forge or hot station, anvil/workbench, tool rack, quench barrel, repair counter, ore crates.
- Inn: check-in counter, beds or room markers, luggage rack, warm lighting, food corner, cleaning storage.
- Courier: dispatch desk, parcel shelves, sorting table, route board, package crates.
- Refinery/portal: containment table, machine core, storage tanks/crates, warning sign, safety rail, inspection station.
- Home: Home Console, storage, bed/rest area, furniture, crafting station space, lighting, plant/garden area if owned.

The player should understand what the building does from the first room without reading debug text.

## Consumable and service items

Businesses should not look empty. Consumable or service items should appear as supported stock, tools, or display items inside the building, and the backend should know what they represent.

- Restaurants need visible food prep items, ingredient storage, plated meals, water/tea/coffee props, and cleanup supplies.
- Clinics need medicine bottles, bandages, treatment tools, clean water, recovery beds, and patient intake records.
- Magic shops need potions, charms, scrolls, candles, warding materials, and rare component storage.
- General traders need shelf stock, crates, seed bags, basic tools, packaged food, and visible price/display areas.
- Smithies need repair tools, ore, metal bars, quench water, finished tools/weapons, and work orders.
- Inns need consumable linens, food service supplies, room keys/markers, luggage, and cleaning supplies.
- Refineries and portal shops need fuel canisters, stabilized matter containers, safety kits, gauges, and inspection logs.
- Couriers need packages, letters, route tags, parcel shelves, and dispatch tokens.

Consumable/service items must be grounded or supported. A bottle belongs on a shelf or counter, not in mid-air. A crate belongs on the floor or against a wall. A hanging sign needs a post, wall, or beam.

Gameplay stock should be data-backed:

- A customer request must map to an offer the business can produce or stock.
- The visible item category should match the backend business inventory/catalogue.
- Wrong, missing, expired, or low-quality stock should affect service outcomes when the mini-game uses it.
- High-tier businesses should show better tools, cleaner storage, rarer stock, and more specialized service props.

## Interface rules

Business and home interfaces are opened from inside the relevant building.

- The Home Console UI is separate from BiomesUI but should follow BiomesUI interaction standards: pointer unlock while open, mouse visible while open, keyboard traversal, mobile responsive layout, player-facing labels, and no raw ids.
- The business dashboard should be available at the Customer Counter or owner dashboard inside the building.
- Access points must be obvious and polished. Do not hide them as tiny or invisible markers.
- Every access point should have both a physical voxel/edit representation and a marker record.
- The prompt text should be player-facing: `Open Home Console`, `Open Shop`, `Open Storage`, not raw action names.

## Exterior and safe zone rules

The outside of a building should look intentional.

- Add safe ground or a clean path from the road/approach to the entrance.
- Use signs, lights, planters, small walls, benches, crates, barrels, or fences as dressing only when they do not block approach paths.
- Keep customer/NPC spawn points out of muck, walls, stairs, furniture, and road-blocking positions.
- Do not cluster all businesses together unless the design calls for a market district.
- Make businesses visible on map systems when they are real destinations.

## Reference-derived style cues

The Grove reference scans and construction reports should guide new procedural buildings.

- Use supported wall cabinets, bottle shelves, bookcases, cabinets, benches, long service tables, reading tables, crates, chests, candles, lanterns, signs, and scrolls.
- Keep aisles clear around benches, shelves, tables, and plantings.
- Put shelves and cabinets against walls.
- Put recipe books, scrolls, bottles, candles, and lamps on a supporting surface.
- Use wide stone stairs, low stone boundary walls, wood/glass doors, framed windows, and visible signage where appropriate.
- Use plants, hedges, rocks, logs, flowers, and small walls outside, but keep the approach path readable.
- Match the material mood of nearby Grove buildings: stone/cobblestone foundations, wood or stone walls, framed glass, warm light, signs, and grounded landscape dressing.
- Avoid clustered, copy-pasted buildings. Businesses should share a standard construction language while still having profession-specific silhouettes, colors, signs, and interiors.

## NPC and customer layout rules

Any customer-facing business needs at least these logical points:

- Customer entrance.
- Queue/wait point.
- Service counter.
- Customer service spot.
- Exit or return path.
- Employee station.
- Stock/storage point.
- Owner dashboard/access point.

Customer-only NPCs should remain session-only unless they are intended to become town residents. Employee NPCs should use deterministic Biomes-style/procedural appearance data and should not rely on one-off mannequin meshes.

## Product text rules

Visible UI and prompts must be production copy.

- No snake case, camel case, raw ids, request ids, backend warnings, debug labels, or internal model names.
- Convert backend warnings through player-facing formatters before display.
- Button text should describe the player action: `Open Door`, `Open Storage`, `Pay Taxes`, `Repair`, `Upgrade`.
- Data attributes can keep test identifiers, but visible text should stay clean.

## Required tests

Add or update tests whenever a building rule changes.

Backend/shared tests should verify:

- Building materialization emits grounded foundation, floor, walls, roof, and entrance edits.
- Multi-floor blueprints have reachable stairs or are rejected.
- Raised decks, balconies, and roofs have safe access and edge treatment.
- Home buildings emit storage, door, and Home Console markers.
- Business buildings emit storage, door, and Business Counter markers, not Home Console markers.
- Marker positions use the real origin and do not overlap doors/storage.
- Staged construction emits access markers only when utilities are complete.
- Live placement persists the same markers into building state.
- Product labels are player-facing.
- Consumable/service props map to real stock, offers, or decoration definitions.
- Furniture and stock props do not block validated customer or employee paths.

UI tests should verify:

- The Building System UI shows property access points and actions.
- Home Console and business dashboards are discoverable only in the correct in-world context.
- Pointer/mouse policies are set for separate interfaces.
- No visible snake case, camel case, backend codes, or debug copy leaks.

Visual tests are valuable for final polish, but only run them when explicitly requested or when the change affects rendering in a way automated tests cannot cover.

## Review checklist

Before calling a building done, answer yes to all of these:

- Is the structure generated from backend/shared procedural data?
- Is it grounded?
- Can a player enter it?
- If it has multiple levels, can the player and intended NPCs reach them by stairs?
- Are doors, windows, signs, counters, and consoles supported by the building?
- Is the inside decorated for the business/home type?
- Are consumable and service items visible, supported, and data-backed?
- Is there clear room for customers and employees?
- Does every interface have a visible access point?
- Are safe zones, markers, storage, doors, and dashboards persisted?
- Is player-visible text clean?
- Are backend, live-mode, and UI tests covering the behavior?
