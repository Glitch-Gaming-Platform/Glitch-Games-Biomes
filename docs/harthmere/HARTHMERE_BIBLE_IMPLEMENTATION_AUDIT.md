# Harthmere Bible Implementation Audit

Generated: 2026-05-30T20:08:23.986Z
Repo: `/Users/devindixon/Development/biomes-game`
Mode: report

## Bottom Line

The audit found missing implementation records. Do not ship until these are addressed.

Warnings to review: **0**. Missing critical records: **64**.

## Source Bible Inventory

| Bible | Status | Evidence / Expected Purpose |
| --- | --- | --- |
| Harthmere Expanded Medieval MMO Town Design Bible | FOUND | docs/harthmere/bibles/Harthmere_Medieval_MMO_Town_Design_Bible_Complete.pdf (filename) |
| Harthmere Bellbound Dragon Story Bible | FOUND | docs/harthmere/bibles/Harthmere_Bellbound_Dragon_Story_Bible (3).md (filename) |
| MMO Rules | FOUND | docs/harthmere/BIOMES_HUD_UI_REFERENCES.md (content), docs/harthmere/BIOMES_HUD_UI_SCREEN_REVIEW.md (content), docs/harthmere/bibles/MMO_RULES.txt (filename), .harthmere-backups/biomes-hud-ui.20260521-121944/docs/harthmere/BIOMES_HUD_UI_SCREEN_REVIEW.md (content) |
| Harthmere Wilds Outside Town Narrative Setting | FOUND | docs/harthmere/HARTHMERE_BRIDGE_WILDS_IMPLEMENTATION_AUDIT.md (content), docs/harthmere/bibles/Harthmere_Bellbound_Dragon_Story_Bible (3).md (content), docs/harthmere/bibles/Harthmere_Wilds_Outside_Town_Narrative_Setting.pdf (filename), .harthmere-backups/fix-biomes-ui-replace-runtime-1779939850/harthmere_assets.ts (content), .harthmere-player-avatar-full-polish-backup-20260522-172620/voxel_faces.ts (content) |

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

Residential buildings: **10**. Estimated residential room capacity from the current residential pattern: **160**.
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

Named NPC compendium count: **44**. Remaining/ambient/wildlife/etc. count: **141**. Total NPC records with implementation status: **185**.
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

Quest catalog count: **0** / minimum **85**.
Main Q1-Q12 missing: **Q1, Q2, Q3, Q4, Q5, Q6, Q7, Q8, Q9, Q10, Q11, Q12**. Optional main missing: **Q2.5**. Side quests SQ-001..SQ-042 missing: **SQ-001, SQ-002, SQ-003, SQ-004, SQ-005, SQ-006, SQ-007, SQ-008, SQ-009, SQ-010, SQ-011, SQ-012, SQ-013, SQ-014, SQ-015, SQ-016, SQ-017, SQ-018, SQ-019, SQ-020, SQ-021, SQ-022, SQ-023, SQ-024, SQ-025, SQ-026, SQ-027, SQ-028, SQ-029, SQ-030, SQ-031, SQ-032, SQ-033, SQ-034, SQ-035, SQ-036, SQ-037, SQ-038, SQ-039, SQ-040, SQ-041, SQ-042**. Starter quests missing: **starter_welcome_to_harthmere, starter_apples_for_dawnloaf, starter_missing_lockbox, starter_cold_iron_hot_temper, starter_fever_tea, starter_rumor_has_it, starter_loose_chickens, starter_whispering_crate, starter_the_missing_bell**.
Runtime files exist: **yes**. Every quest has objectives: **yes**. Rewards: **yes**. Dialogue states: **yes**.

| Quest Category | Count |
| --- | --- |

## Warnings / Incorrect or Unproven Areas

No warnings.

## Missing Critical Records

- mainQuest:Q1
- mainQuest:Q2
- mainQuest:Q3
- mainQuest:Q4
- mainQuest:Q5
- mainQuest:Q6
- mainQuest:Q7
- mainQuest:Q8
- mainQuest:Q9
- mainQuest:Q10
- mainQuest:Q11
- mainQuest:Q12
- optionalMainQuest:Q2.5
- sideQuest:SQ-001
- sideQuest:SQ-002
- sideQuest:SQ-003
- sideQuest:SQ-004
- sideQuest:SQ-005
- sideQuest:SQ-006
- sideQuest:SQ-007
- sideQuest:SQ-008
- sideQuest:SQ-009
- sideQuest:SQ-010
- sideQuest:SQ-011
- sideQuest:SQ-012
- sideQuest:SQ-013
- sideQuest:SQ-014
- sideQuest:SQ-015
- sideQuest:SQ-016
- sideQuest:SQ-017
- sideQuest:SQ-018
- sideQuest:SQ-019
- sideQuest:SQ-020
- sideQuest:SQ-021
- sideQuest:SQ-022
- sideQuest:SQ-023
- sideQuest:SQ-024
- sideQuest:SQ-025
- sideQuest:SQ-026
- sideQuest:SQ-027
- sideQuest:SQ-028
- sideQuest:SQ-029
- sideQuest:SQ-030
- sideQuest:SQ-031
- sideQuest:SQ-032
- sideQuest:SQ-033
- sideQuest:SQ-034
- sideQuest:SQ-035
- sideQuest:SQ-036
- sideQuest:SQ-037
- sideQuest:SQ-038
- sideQuest:SQ-039
- sideQuest:SQ-040
- sideQuest:SQ-041
- sideQuest:SQ-042
- starterQuest:starter_welcome_to_harthmere
- starterQuest:starter_apples_for_dawnloaf
- starterQuest:starter_missing_lockbox
- starterQuest:starter_cold_iron_hot_temper
- starterQuest:starter_fever_tea
- starterQuest:starter_rumor_has_it
- starterQuest:starter_loose_chickens
- starterQuest:starter_whispering_crate
- starterQuest:starter_the_missing_bell

## Recommended Next Fixes

1. Copy the source bibles into `docs/harthmere/bibles/` so future audits can prove they are present, not only encoded as implementation contracts.
2. Resolve any targeted requirement that says `NEEDS_REVIEW_OR_MISSING`, especially bridge parapets and wild-facing town-wall watchtowers if they still show as missing in your checkout.
3. Normalize Bram Holt's daughter name across story bible, NPC compendium, and side quest records.
4. Treat quest/NPC catalog coverage as implementation scaffolding; voiceover, cinematic recording, and final authored scene polish still need a production pass.
