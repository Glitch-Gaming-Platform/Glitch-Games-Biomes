# Biomes HUD/UI References V95

This patch keeps the HUD grounded in the uploaded rules, bibles, and lore instead of inventing a separate UI direction.

## Screens changed

### Bottom HUD bars
- Change: moved the Biomes utility/action bar above the native hotbar with extra spacing, horizontal overflow on small screens, and slightly larger gaps between buttons.
- Rule reference: Harthmere Town Design Bible section 14 says rich towns become confusing unless services and interactions are grouped and visible. This keeps the player-facing action row readable without covering the existing hotbar.

### Biomes map opened with M
- Change: the M key now opens the actual Biomes map first instead of a debug/objective stack. Snapshot/Grove/combat objective cards are still available below the map, but the map is the primary screen.
- Rule reference: Harthmere Town Design Bible section 14 requires district labels and service icons; Snapshot Map/Landscape Guide Rule 3 requires canonical terrain/entity-backed map positions; Snapshot Grove + Harthmere Lore Bible requires objective state to live in HUD, journal, and map markers rather than NPC dialogue.

### Map marker inspection and vertical terrain levels
- Change: map markers are buttons. Click or press a marker to inspect its objective status, district, distance, world Y, layer, and whether it is above/below the player.
- Rule reference: Snapshot Map/Landscape Guide says map, collision, labels, landmarks, and terrain must derive from the same world state. The vertical layer readout prevents underways/dungeons/raised streets from looking like the same flat plane.

### Biomes Systems menu
- Change: renamed the panel from Harthmere Systems to Biomes Systems, widened the panel slightly, made tabs evenly spaced, and added rule-reference copy in the header.
- Rule reference: MMO_RULES defines combat, skills, progression, and server validation as core systems; Harthmere Town Design Bible section 14 covers accessibility/readability; Wilds Bible covers danger clarity; Grove Bible covers objective placement in HUD/map/journal.

### Fight side controls
- Change: added missing visual icons for Target and Heavy Attack buttons using existing HUD assets, keeping touch/mobile controls clearer.
- Rule reference: Harthmere Town Design Bible section 14 says navigation and interaction should not depend on color alone; iconography and labels should work together.

### Combat health/nameplates
- Change: when the weapon is drawn or combat is fresh, selected/recent/in-combat targets display health bars and exact HP numbers in a visible combat nameplate cluster.
- Rule reference: MMO_RULES requires meaningful combat feedback; Wilds Bible requires danger to be readable before it becomes frustrating; Town Design Bible section 14 requires accessible UI that does not depend on color alone.

### Death and respawn
- Change: death state now reads/writes through the same user-scoped local-dev key as combat, adds a runtime controller, releases the player from downed state when the downed timer ends, forces a safe respawn when needed, and ends temporary respawn protection when the timer expires.
- Rule reference: Harthmere Town Design Bible section 14.1 says respawn pacing near town should avoid frustration and preserve roleplay space. MMO_RULES progression fairness is preserved by avoiding harsh XP/permanent item loss in this local-dev implementation.
