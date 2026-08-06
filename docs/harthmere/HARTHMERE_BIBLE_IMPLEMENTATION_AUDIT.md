# Harthmere Bible Implementation Audit current

Generated: 2026-07-14T18:26:22.072Z
Repo: `/sessions/quirky-hopeful-clarke/mnt/biomes-game`
Mode: report

## Bottom Line

The encoded implementation coverage is mostly complete: required buildings, dungeon spaces, named NPC catalog, and required quest catalog are present. Remaining issues are design/production warnings, not missing core catalog records.

Warnings to review: **0**. Missing critical records: **0**.

## Source Bible Inventory

| Bible | Status | Evidence / Expected Purpose |
| --- | --- | --- |
| Harthmere Expanded Medieval MMO Town Design Bible | FOUND | docs/harthmere/bibles/Harthmere_Medieval_MMO_Town_Design_Bible_Complete.pdf (filename) |
| Harthmere Bellbound Dragon Story Bible | FOUND | docs/harthmere/bibles/Harthmere_Bellbound_Dragon_Story_Bible (3).md (filename), HARTHMERE_SYSTEMS_AUDIT_2026-07-14.md (content) |
| MMO Rules | FOUND | docs/harthmere/BIOMES_HUD_UI_REFERENCES.md (content), docs/harthmere/BIOMES_HUD_UI_SCREEN_REVIEW.md (content), docs/harthmere/bibles/MMO_RULES.txt (filename) |
| Harthmere Wilds Outside Town Narrative Setting | FOUND | docs/harthmere/HARTHMERE_BRIDGE_WILDS_IMPLEMENTATION_AUDIT.md (content), docs/harthmere/HARTHMERE_NPC_CONVERSATION_TONE_MAP.md (content), docs/harthmere/bibles/Harthmere_Bellbound_Dragon_Story_Bible (3).md (content), docs/harthmere/bibles/Harthmere_Wilds_Outside_Town_Narrative_Setting.pdf (filename) |

## Building Implementation

Required buildings in contract: **25**. Implemented: **25**. Partial/incorrect: **0**. Missing: **0**.

| Building | District | Floors | Status | Bible |
| --- | --- | --- | --- | --- |
| North Gate Gatehouse | North Gate | 2 | IMPLEMENTED | §IV.1 SERGEANT BRAM HOLT (North Gate) |
| Toll Booth | North Gate | 1 | IMPLEMENTED | §IV.1 gate ledger and toll |
| Stable Yard Office | North Gate | 1 | IMPLEMENTED | §III.6 Old Jory the stable master |
| Mara Thistle Two-Story House | Market Square | 2 | IMPLEMENTED | §III.3 Mara Thistle two-story behind market |
| fountain_square | Market Square | 0 | IMPLEMENTED | §II town hub: market fountain |
| Black Anvil Smithy | Craftsman Row | 2 | IMPLEMENTED | §III.4 Master Osric Vale; apartment above smithy |
| Carpenter and Tailor Workshop | Craftsman Row | 1 | IMPLEMENTED | §III.4 Garrik Fen workshop-and-home complex |
| Green Mortar Apothecary | Apothecary | 1 | IMPLEMENTED | §IV.8 Ysabet Fenlow |
| Wyrm and Candle Magic Shop | Magic Shop | 1 | IMPLEMENTED | §V.3 magic shop / Bellbinder lore shelf |
| Copper Kettle Inn | Copper Kettle | 2 | IMPLEMENTED | §III.6 Elowen Pike, multi-room upstairs |
| Reeve Hall | Noble Rise | 2 | IMPLEMENTED | §III.3 Reeve Caldus Merrow |
| Edrik Vane Estate | Noble Rise | 2 | IMPLEMENTED | §III.3 Edrik Vane large house on Noble Rise |
| Chapel of Saint Verena | Temple Green | 2 | IMPLEMENTED | §III.5 Father Aldren; bell tower |
| Brother Vance Cottage | Temple Green | 1 | IMPLEMENTED | §II.4 small cottage on chapel grounds |
| Player Services Hall | Player Services | 2 | IMPLEMENTED | §II town services hub: bank, mail, auction, storage |
| Brass Scale Moneylender | Player Services | 1 | IMPLEMENTED | §III.8 Banker Merl Voss |
| Mudden Lean-To Home | Mudden Ward | 1 | IMPLEMENTED | §III.7 Mudden Ward poor housing |
| Mudden Wash House | Mudden Ward | 1 | IMPLEMENTED | §III.7 Mudden Ward shared services |
| Mudden Tam Crowe Lean-To | Mudden Ward | 1 | IMPLEMENTED | §III.7 Nessa Crowe family lean-to |
| Dock Ledger Warehouse | River Docks | 1 | IMPLEMENTED | §III.10 Tovin Reed dockmaster ledger warehouse |
| River Dock Supply | River Docks | 1 | IMPLEMENTED | §III.10 dockside supply shop |
| Guard Barracks | Guard Yard | 2 | IMPLEMENTED | §III.2 Bram Holt's quarters above the Guard Yard |
| Roadside Family Cottage | Residential District | 1 | IMPLEMENTED | §III generic residential cottage |
| Dawn Loaf Bakery | Market District | 1 | IMPLEMENTED | §III.3 marketgoer staple |
| Brindle Provision House | Market District | 1 | IMPLEMENTED | §III.3 staple goods provision |

### Targeted Building / Visual Requirements

| Requirement | Status |
| --- | --- |
| North Gate gatehouse | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Toll booth | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Brother Vance cottage | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Mara Thistle two-story house | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Edrik Vane Noble Rise estate | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Real walkable bridge with parapets | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Town-wall watchtowers facing the wilds | IMPLEMENTED_OR_EVIDENCE_FOUND |
| Transparent homes outside/in town removed or rebuilt | IMPLEMENTED_OR_EVIDENCE_FOUND |

### Residential and Slum Housing

Residential buildings: **10**. Estimated residential room capacity from current pattern: **160**.
Slum stacks: **4**. Slum room capacity from declared floors/rooms: **90**.
Solid voxel/block evidence: **yes**. Stair/accessibility evidence: **yes**. Room decor manifest evidence: **yes**.

## Dungeon / Main-Quest Space Implementation

Required dungeon rooms/spaces: **18**. Implemented: **18**. Missing: **0**.
Collision plan evidence: **yes**. Six Bellward chambers found: **Aevith, Karag-Drath, Vyrenia, Murvath, Sylenne, Korruthax**. Regalia found: **Stole, Hammer, Tuning Fork, Handbell, Chain, Ring**.

| Dungeon / Space | Quest | Status | Bible |
| --- | --- | --- | --- |
| Chapel Cellar Undercroft | Q5/Q6 | IMPLEMENTED | §II.5 chapel cellar, low stone, single oil lamp |
| Hidden Door Encounter | Q6 | IMPLEMENTED | §II.5 brick wall behind wine rack |
| Old Well Underways Landmark | Q2 | IMPLEMENTED | §II.3 sealed well with iron bars |
| Bellward Halls Central Pillar | Q7 | IMPLEMENTED | §II.6 first underways ring central hub |
| Chamber of Aevith | Q7 | IMPLEMENTED | §II.6 prayer chamber: river-wyrm Aevith |
| Chamber of Karag-Drath | Q7 | IMPLEMENTED | §II.6 prayer chamber: mountain-wyrm |
| Chamber of Vyrenia | Q7 | IMPLEMENTED | §II.6 prayer chamber: sky-wyrm |
| Chamber of Murvath | Q7 | IMPLEMENTED | §II.6 prayer chamber: sea-wyrm |
| Chamber of Sylenne | Q7 | IMPLEMENTED | §II.6 prayer chamber: forest-wyrm |
| Chamber of Korruthax | Q7 | IMPLEMENTED | §II.6 prayer chamber: volcanic-wyrm |
| Listening Chamber | Q7 | IMPLEMENTED | §II.6 Bellward Halls inner listening sanctum |
| Old Harth Antechamber Sarcophagus | Q10 | IMPLEMENTED | §II.7 sealed tomb of the last Bellbinder |
| Bellbinder Tomb Regalia Hall | Q10 | IMPLEMENTED | §II.7 six Bellbinder regalia plinths |
| Pulse Hall | Q9 | IMPLEMENTED | §II.7 Veins of the Wyrm: dragon-vein glow |
| Echo Hall | Q9 | IMPLEMENTED | §II.7 Veins of the Wyrm: phase-safe essence pool |
| Spine Hall | Q9 | IMPLEMENTED | §II.7 Veins of the Wyrm: rib wall |
| Bellward Chamber True Bell | Q11 | IMPLEMENTED | §II.8 the True Bell hanging chamber |
| Wyrm's Bed Thaedryn Arena | Q12 | IMPLEMENTED | §II.8 Thaedryn's resting bed boss arena |

## NPC Implementation

Named NPC compendium current count: **185**. Remaining/ambient/wildlife/etc. current count: **185**. Total NPC records with implementation status: **370**.
Required named NPCs checked from the story bible list: **44**. Missing named NPCs: **none**.
Route evidence: **yes**. Dialogue evidence: **yes**.

| Remaining NPC Category | Count |
| --- | --- |
| quest_named | 20 |
| ambient_guard | 3 |
| ambient_town | 43 |
| wilds_guard | 2 |
| wilds_human | 6 |
| animal | 33 |
| bandit_type | 10 |
| undead_type | 9 |
| forest_monster_type | 8 |
| smuggler_type | 7 |

## Quest Implementation

Quest catalog count: **85** / minimum **85**.
Main Q1-Q12 missing: **none**. Optional main missing: **none**. Side quests SQ-001..SQ-042 missing: **none**. Starter quests missing: **none**.
Runtime files exist: **yes**. Every quest has objectives: **yes**. Rewards: **yes**. Dialogue states: **yes**.

| Quest Category | Count |
| --- | --- |
| main | 13 |
| side | 39 |
| side_hidden | 3 |
| starter | 9 |
| repeatable | 21 |

## Warnings / Incorrect or Unproven Areas

No warnings.

## Missing Critical Records

None.

## Recommended Next Fixes

1. Copy the source bibles into `docs/harthmere/bibles/` so future audits can prove they are present, not only encoded as implementation contracts.
2. Resolve any targeted requirement that says `NEEDS_REVIEW_OR_MISSING`, especially bridge parapets and wild-facing town-wall watchtowers if they still show as missing in your checkout.
3. Normalize Bram Holt's daughter name across story bible, NPC compendium, and side quest records.
4. Treat quest/NPC catalog coverage as implementation scaffolding; voiceover, cinematic recording, and final authored scene polish still need a production pass.
