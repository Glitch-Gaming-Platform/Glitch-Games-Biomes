# Biomes HUD UI Screen Review

This review turns the May 21 HUD screenshots into testable HUD contracts.

## Rule / guide references used

- `biomes-rules/MMO_RULES.txt`: combat state, readable health, inventory/storage, progression, objectives, and player-facing system feedback.
- `biomes-rules/Harthmere_Medieval_MMO_Town_Design_Bible_Complete.pdf`: service-system readability and town UX, especially the rule that town systems should be understandable without forcing the player to decode debug output.
- `biomes-rules/Harthmere_Wilds_Outside_Town_Narrative_Setting.pdf`: hostile/wild danger should be readable while the player is moving through the world.
- `biomes-rules/snapshot_grove_harthmere_lore_bible.pdf`: Grove/Harthmere objective state must stay consistent across HUD, map, journal, and NPC dialogue.
- `biomes-rules/README-SNAPSHOT-MAP-LANDSCAPE-GUIDE.md`: map/landscape guidance, including canonical terrain positions, resource placement, and avoiding player-hostile UI overlays.

## Screenshot-by-screenshot findings and fixes

### `Screenshot 2026-05-21 at 11.33.19 AM.png` — active HUD/combat

Problem areas:
- The combat health panel was centered in the screen. That blocked the play view and made it look like a debug panel, not in-world combat UI.
- Enemy health was separated from the enemy, so the player had to match rows to targets mentally.
- The bottom action bar and numeric hotbar were still visually crowded.
- The left combat guide still claimed `N` was Heavy Attack while the bottom bar claimed `N` was Notifications.

Fixes:
- Removed the centered `HarthmereCombatNameplateHUD` panel.
- Added actor-anchored enemy HP bars through `HarthmereEnemyHealthBarsHUD` using projected screen positions from `harthmere_assets.ts`.
- Enemy bars now show above attackable visible actors instead of in the center of the screen.
- Moved Heavy Attack from `N` to `H` so `N` is reserved for Notifications.
- Increased the vertical spacing between the Biomes action bar and the numeric hotbar and reduced button size.

Rule refs: `MMO_RULES` combat visibility; Wilds Bible readable danger; Snapshot Map/Landscape guide avoiding UI that hides the world.

### `Screenshot 2026-05-21 at 11.33.56 AM.png` — systems panel + bottom bars

Problem areas:
- The systems panel opened, but the bottom bar key labels were not actually driving the matching panels.
- The panel and minimap/right debug area competed for space.
- Text in the systems header was compressed.

Fixes:
- Added `harthmere_hud_key_bindings.ts` as the central key contract.
- Wired bottom buttons and keyboard events through the same action router.
- Added tests/static checks for `I`, `C`, `M`, `J`, `K`, `Y`, `N`, `V`, and `Esc`.
- Made the systems panel header/tabs use wrapping, smaller tab minimums, and clearer line-height.

Rule refs: Town Design Bible service UX; Grove Lore objective state in HUD/map/journal.

### `Screenshot 2026-05-21 at 11.33.54 AM.png` — world/death tab

Problem areas:
- `Biomes Death & Respawn` was visually better than the earlier Harthmere title, but the panel content was still dense.
- The header/tabs could still mash together at smaller widths.

Fixes:
- Kept the `Biomes Systems` naming and improved padding/line-height around panel content.
- Preserved the death-system status inside World while the runtime controller applies safe respawn, protection, and downed/dead state handling.

Rule refs: `MMO_RULES` death/respawn loop; Town Design Bible readable service/system panels.

### `Screenshot 2026-05-21 at 11.33.52 AM.png` — skills tab

Problem areas:
- Skill/stat blocks were readable but packed tightly.
- The systems panel was too easy to clip vertically.

Fixes:
- Increased systems content padding and kept the panel internally scrollable.
- Maintained mobile max-height constraints so stats remain usable on shorter displays.

Rule refs: `MMO_RULES` progression clarity.

### `Screenshot 2026-05-21 at 11.33.51 AM.png` — standing tab

Problem areas:
- Reputation cards were readable, but the long explanations and recent events felt compressed.
- This panel needs clear consequences because reputation affects NPC behavior.

Fixes:
- Improved shared systems panel spacing and line-height.
- Kept this tab under `Biomes Systems` while preserving Harthmere-specific reputation data.

Rule refs: Town Design Bible NPC/social consequences; Grove Lore NPC dialogue and town relationship continuity.

### `Screenshot 2026-05-21 at 11.33.49 AM.png` — combat tab

Problem areas:
- Combat rules were useful, but the screen also displayed the bad centered health panel.
- `N` conflicted between Heavy Attack and Notifications.

Fixes:
- Actor-anchored health replaces the centered combat panel.
- `N` now opens Notifications; Heavy Attack is `H`.
- Static tests fail if combat steals `KeyN` again.

Rule refs: `MMO_RULES` combat and action routing; Wilds Bible readable danger.

### `Screenshot 2026-05-21 at 11.33.38 AM.png` — inventory tab

Problem areas:
- Inventory rows showed icons for some equipment/consumables, but gathered resources and storage still used generic symbols.
- Backpack/material storage needed resource-type symbols from the item/resource system.

Fixes:
- Added `harthmereResourceIconForItem()` so crafting materials get item-specific icons.
- Added matching gathering-storage icons through `harthmereGatheringResourceIcon()`.
- Material storage rows now show icon + readable name + quantity instead of plain text.

Rule refs: `MMO_RULES` resource/storage clarity; Snapshot Map/Landscape guide resource identity.

### `Screenshot 2026-05-21 at 11.33.37 AM.png` — journal tab

Problem areas:
- Journal content was useful, but it was still relying on panel routing that could drift from the bottom bar keys.
- Tasks (`K`) did nothing before.

Fixes:
- `K` now routes to the journal/tasks system view.
- Bottom action bar buttons and keyboard shortcuts share the same action contract.
- Tests assert that `K` maps to Tasks/Journal.

Rule refs: Grove Lore objective state in HUD/map/journal.

### `Screenshot 2026-05-21 at 11.33.30 AM.png` — map

Problem areas:
- The map is improved, but it still needed to stay separate from objective-list behavior and remain terrain-level aware.
- Map overlay must not become a pile of debug text.

Retained fixes protected by this review:
- `M` opens `Biomes Map`, not a Harthmere objective/debug list.
- Map markers are inspectable and expose distance, selected marker, active objective, district, terrain layer, and below/above relation.
- Hotkey tests keep `M` bound to the map panel.

Rule refs: Snapshot Map/Landscape guide canonical positions/layers; Grove Lore objective continuity.

## Files Changed

- `src/client/components/challenges/HarthmereUnifiedHUD.tsx`
- `src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx`
- `src/client/components/challenges/LocalDevHarthmereInventorySystem.tsx`
- `src/client/components/challenges/LocalDevHarthmereGatheringSystem.tsx`
- `src/client/game/renderers/local_dev/harthmere_assets.ts`
- `src/shared/harthmere/harthmere_hud_key_bindings.ts`
- `src/shared/harthmere/test/harthmere_hud_key_bindings.test.ts`
- `scripts/harthmere/check-biomes-hud-key-bindings.cjs`
- `docs/harthmere/BIOMES_HUD_UI_SCREEN_REVIEW.md`

## Validation commands

```bash
node scripts/harthmere/check-biomes-hud-key-bindings.cjs .
```

Optional, when repo dependencies are installed:

```bash
npx mocha src/shared/harthmere/test/harthmere_hud_key_bindings.test.ts
```
