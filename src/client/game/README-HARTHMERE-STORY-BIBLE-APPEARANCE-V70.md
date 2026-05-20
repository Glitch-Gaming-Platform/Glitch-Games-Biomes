# Harthmere Story Bible Appearance v70

This patch applies the Harthmere Bellbound Dragon story/design bible to the local Harthmere voxel actor system.

## What v70 changes

- Snapshot NPCs still use the v69 snapshot-rich player-like wearable pipeline.
- Harthmere NPCs now get story-bible profiles based on name, role, district, and description text.
- Player defaults and starter clothing presets now include story-bible Harthmere silhouettes.

## NPC profile groups

The profile resolver is in:

```text
src/shared/harthmere/voxel_faces.ts
```

Main marker:

```ts
HARTHMERE_STORY_BIBLE_APPEARANCE_VERSION_V70
```

Profile groups:

- `town_watch_red_black` — Bram, Walt, guards, watch, patrol, sentries.
- `chapel_circle_verenine` — Father Aldren, Sister Maelle, Brother Vance, Brother Halpen, chapel/faith/temple actors.
- `merchant_compact_polished` — Edrik Vane, Compact, moneylender, Brass Scale actors.
- `market_square_vendor` — Mara, market vendors, merchants, bankers, auction clerks, registrars.
- `craftsman_black_anvil` — Osric, Luth, smiths, forge/anvil actors.
- `craftsman_scholar_apothecary` — Helna, Ysabet, alchemy/apothecary/scholar actors.
- `copper_kettle_inn_warm` — Elowen, Tisa, Cellan, bard/inn/tavern actors.
- `mudden_ward_scrap_layers` — Nessa, Tam, Mudden Ward, slum, rat, drain, fence actors.
- `river_docks_worker` and `river_knots_smuggler` — Henrick, Veska, ferry/dock/river/smuggler actors.
- `wilds_warden_hunter` — Edda, Merrit, Sella, Tamsin, hunter/warden/wilds actors.
- `wilds_moss_woman_veneth` — Moss-Woman / Veneth.

## Player support

New player defaults are less generic and read more like a Bellbound traveler. The wake-up character builder also gets these presets:

- Bellbound Traveler
- Town Watch Ally
- Chapel Initiate
- Mudden Ward Survivor

Existing localStorage customizations are not forcibly overwritten. To see the new defaults for an already-created local test user, either choose one of the new presets in the character builder or clear that user’s Harthmere localStorage keys.

## Verification

```bash
node scripts/harthmere/check-harthmere-story-bible-appearance-v70.cjs
```
