# Chapter 1 ("Identity") — Full Implementation Audit, 2026-07-24

Audit of everything built across the Chapter 1 sessions, against the writer's
journal, the ECS/Gaia/Anima source-of-truth contract, the snapshot map guide,
and the building/decoration design guide. Every finding below is either fixed
in this pass or explicitly listed as remaining work.

**Result: 178 Chapter 1 tests passing (290 including shared-cutscene regression suites)** (`./b test -p 'src/shared/harthmere/test/ch1_*.test.ts' ...`),
scoped typecheck clean (`tsconfig.ch1check.json`).

**July 25 production follow-up:** the current fast Chapter 1 batch is **255
passing**. Native objective completion now applies durable fragments, choices,
items, testimonies, skills, AUGUR state, endings, and person-retrieval flags;
the Recovered journal and consequential choice UI are wired to authenticated
server authority and covered by a retained-checkpoint live browser pass.

## July 25, 2026 live quest/browser addendum

The HAR and focused production-browser evidence close the blocker immediately
before Chapter 1. They do not replace the dungeon visual/capture checklist
later in this document.

- The supplied HAR contains no HTTP 4xx/5xx gameplay response. The Road Ahead
  Clothing Crate native-container request completed at `03:17:17.631Z`, Billy's
  Toolbag completed at `03:18:17.785Z`, the selfie completed, Jackie accepted
  the shell, and Busted advanced to Doc's sunken-boat instruction. There is no
  underwater native-container request afterward. The failure happened before
  the API: the player never received a discoverable F prompt at the chest.
- `native_road_ahead_contract.ts`, `overlays.ts`, and
  `harthmere_world_object_inspectable.ts` now keep every native quest container
  in the proximity-discovery path even when the original snapshot gives it
  `placed_by`, its own container overlay, and `quest_giver`. Close underwater
  containers tolerate swimming yaw drift while server range/quest authority
  remains unchanged.
- `1784962944155-29904-report.json` proves the real F prompt, real container UI,
  accessible Water-logged Muck Buster item, real Take All transaction, every
  Busted delivery/craft/place/collect/dialogue step, and final chapter
  completion. Every authored Busted scenario passed. The report's outer status
  is red only because three local `/buckets/biomes-social/.../profile_pic/`
  images returned 404; server logs identify all three URLs, and the runner now
  records those local placeholder fallbacks as transients while retaining all
  other same-origin 4xx/5xx responses as failures.
- `1784963562747-35318-report.json` is a green 33-second production-browser
  batch for the dedicated J-key Quests tab: five status filters, Failed count
  behavior, quest detail, no embedded map, 720px stacked layout, and Show on
  Map all pass with zero browser/network failures.
- The local zRPC root health route returned `200 OK` and the unified container
  remained healthy, confirming that the old `res.send is not a function`
  stack-kill path is removed.

Passed quest chapters and browser surfaces are locked evidence. Do not replay
Road Ahead, Get the Muck Out, Muck vs. Machine, Busted, or the Quests UI unless
their product/authority path changes; batch new failures and verify them once.

---

## 1. Gaps found by this audit, now fixed

### 1.1 AUGUR-9's core charge had no machine behind it

Journal §13.1 names "Auggie core charge" as a system. What existed: a default
value and per-fragment costs. What was missing: spend, recharge, shutdown at
zero, lost-log accounting, environmental drain. Built as `ch1_augur9.ts`:

- playback costs charge once; replays are free (the recording is in the ledger)
- the final affordable log plays **in full**, then he stops — no mid-sentence death
- an unaffordable log is refused, forcing the cell-or-memory choice
- shutdown loses the unplayed logs for the run (`ch1Augur9LostLogs`)
- desert drains 3×, the fjord drains at half rate (his one mercy)
- **completability proof by test**: initial charge + obtainable recharges must
  cover every authored log, with bounded headroom so the tension stays real

### 1.2 No multiplayer answer (this is an MMO)

Journal §13.3 #2 left the amnesia-frame/multiplayer question open. Decided and
implemented in `ch1_party.ts` — see the journal for the full model. Edge cases
covered by test: story-gated admission (no spoiler-carrying), per-member
provisioning (no mule exploit), slot exclusivity (one Iris), death without
breaking the one-way rule, wipes, disconnects, leadership transfer, last-out
eviction (no squatting the past), and story credit only where earned.

### 1.3 Hallr's choice was never recorded

`ch1_hallr_choice` appeared in the carry-forward list and the dungeon's choice
definition, but no code path recorded it — Chapter 2 would have read nothing
for the chapter's second-biggest decision. Fixed: `ch1RecordHallrChoice` /
`ch1HallrChoiceMade` in `ch1_chapter.ts`, first-answer-wins, tested.

### 1.4 Dungeons had no background stories

`CHAPTER_1_DUNGEON_LORE.md`: Nerash-Utu ("the City that Weighs") and
Hrafnsfjörðr ("Raven's Firth") — full histories, why each aperture opened
where it did, what every retrieval means, and the cross-dungeon rhyme table.
Includes constraints on the two deliberately-unexplained threats so future
chapters don't contradict Chapter 1.

### 1.5 No asset memory budget

Measured: the 28 unique decor assets total **~968 KB** on disk (obj+png/vox).
Codified as `CH1_DUNGEON_DECOR_UNIQUE_ASSET_BUDGET_BYTES` (1.5 MB) and a
40-asset cap, enforced by a test that stats the real files — Chapter 1 cannot
quietly become a 50 MB download. Memory strategy documented in
`ch1_dungeon_decor.ts`: authoring data in the bundle (KBs); models lazy-loaded
client-side only inside the owning slot; disposed on the exit warp; duplicate
props share geometry; **the server loads none of it** (voxel terrain is the
server's only physical truth). Also added a scale-range test (0.25–1.3,
matching the vetted business-outpost decor range).

## 2. Verified complete (no action needed)

| Journal system (§13.1)                                        | Where                           | Tested                       |
| ------------------------------------------------------------- | ------------------------------- | ---------------------------- |
| Fragment Ledger (30 fragments, confidence, linking, revision) | `ch1_fragment_ledger.ts`        | unit + E2E                   |
| Fragment truth authority (server-only, never on the wire)     | `ch1_fragment_authority.ts`     | projection + fair-play suite |
| Latent Skills (4, pre-mastered, inexplicable)                 | `ch1_latent_skills.ts`          | unit + E2E                   |
| Fracture Gates (spawn flags, dilation, provisioning)          | `ch1_fracture_gates.ts`         | unit + E2E                   |
| Dungeon narrative (7 zones each, retrievals, bosses, Hallr)   | `ch1_dungeons.ts`               | unit + E2E                   |
| Dungeon terrain (23 volumes, cuts, water, stairs, shards)     | `ch1_dungeon_terrain.ts`        | voxel-walker E2E             |
| Dungeon interiors (37 props, lighting, layer rule)            | `ch1_dungeon_decor.ts`          | placement + budget           |
| Elsewhen band (void gap, warp-only admission, eviction)       | `ch1_elsewhen_region.ts`        | unit + E2E                   |
| Cutscenes (16, incl. revision sequence + corridor pair)       | `ch1_scenes.ts`                 | validity + revision-promise  |
| Portal visual (vesica shader, per-gate seed, open curve)      | `ch1_fracture_gate_material.ts` | curve/seed tests             |
| Quests (28 across 6 acts + prologue ignition)                 | `ch1_quests.ts`                 | full-playthrough E2E         |
| Engine contracts (ECS/Anima/Gaia, machine-checked)            | `ch1_engine_contracts.ts`       | contract suite               |
| Endings (3, none canon) + carry-forward                       | `ch1_chapter.ts`                | E2E, all three               |

**ECS/Gaia/Anima:** re-ran the contract suite after all audit changes. Gates
are still not entities; every cutscene is still clientPuppet with zero onEnd
placements; ghosts appear only in memory scenes; non-combatants appear in no
encounter; the Elsewhen void gap admits no shard; all commit hooks are
registered and idempotent-by-contract. `ch1_party.ts` adds no ECS writes — it
is pure run-state logic for the server to apply through existing signed paths.

**Terrain/buildings/interiors vs. snapshot:** dungeon terrain follows the
`HARTHMERE_DUNGEON_AREAS` seeder shape; materials are validated against
`localDevMaterials()` by string-match test; the voxel/prop layer split follows
the building guide; water is `shard_water` with basin floors; every vertical
transition has stairs (recipe Step 5); coordinates are local with one
transform (recipe Step 1, double-application tested).

**Playability of what the chapter asks the player to do:** the E2E playthrough
executes every quest step through the real availability gate — wake/eat/talk,
naming, robot repair, testimonies, clinic visit, provisioning runs, both
dungeons, the tin search, the interrogation, the confrontation, the letter,
the oath, the handover, the consolidation, the watch house, all three endings.
Every step trigger is one of 13 verbs the engine already implements for
existing quests (`talk_npc`, `near_location`, `collect`, `minigame`, ...).

## 3. Performance posture

- **Renderer:** gates draw only within 220 m, one material per gate, disposed
  on despawn/expiry; billboard is Y-only (no per-frame matrix inversion); the
  shader is fully procedural (zero texture memory).
- **Terrain:** standard shard pipeline; no new streaming cost class. The
  Elsewhen band is far from the playable world, so its shards only stream for
  players warped there.
- **Decor:** ~968 KB unique assets, lazy per-slot, disposed on exit, budget-tested.
- **Bundle:** all ch1 authoring data is plain objects, a few tens of KB total.
  Fragment _truth_ never ships. The build-perf findings for the pre-existing
  5.5 MB generated literals are in `BUILD_PERFORMANCE_FINDINGS_2026-07-24.md`.
- **Tests:** the whole ch1 suite runs in ~3 s; scoped typecheck in seconds
  (`tsconfig.ch1check.json` — note ts-node is transpileOnly, so `./b test`
  alone never typechecks).

## 4. Test inventory (178 Chapter 1 tests; 290 with regression suites)

| Suite                                     | Tests | Covers                                                                                                 |
| ----------------------------------------- | ----- | ------------------------------------------------------------------------------------------------------ |
| `ch1_chapter.test.ts`                     | 49    | ledger, skills, gates, dungeons, Elsewhen, quests, items, naming discipline, endings, engine contracts |
| `ch1_dungeon_terrain.test.ts`             | 29    | structure, transforms, voxel queries, shards, decor placement, memory budget, scales                   |
| `ch1_gate_visual.test.ts`                 | 7     | open curve, monotonic close, seeds                                                                     |
| `ch1_e2e_playthrough.test.ts`             | 23    | full chapter, memory arc, tragedy ordering, failure modes                                              |
| `ch1_e2e_dungeon_traversal.test.ts`       | 22    | voxel flood-fill traversal, puzzles, portal lifecycle, admission                                       |
| `ch1_augur9_party.test.ts`                | 20    | charge economy, MMO party runs, Hallr choice, playback economy                                         |
| `ch1_scenes.test.ts` (cutscene)           | 17    | validity, revision promise, consolidation, ignition                                                    |
| `ch1_fragment_authority.test.ts` (server) | 12    | fair-play rules, wire projection                                                                       |
| existing cutscene suites                  | 112   | regression: shared generator untouched                                                                 |

Bugs found **by tests** across these sessions, all fixed: dungeon-exit closing
its own act; floor slab sealing the descent shaft; doorway/volume Y mismatches;
props blocking doorways; unlit enclosed zones; non-monotonic gate close;
`settings.music` nullability; the falsy-zero elapsed-time bug.

## 5. Remaining work (known, deliberate)

1. **Remaining Chapter 1 visual gate.** The native pre-Chapter-1 quest chain,
   Busted physical container path, and dedicated Quests UI now have retained
   browser evidence above. The Chapter 1 dungeon interior/escort/puzzle visual
   walk and Layer 3 cinematic captures in `CHAPTER_1_E2E_RUNBOOK.md` remain
   human release-gate work; do not conflate them with the completed quest
   blocker regression.
2. **Voice/audio.** Cue ids are authored (`snapshot.*`); the actual audio
   assets and the Azure/ElevenLabs voice passes for the new cast are not.
3. **Playtest-only questions.** The handover must feel complicit, not cheated;
   the buried surname needs a real mix level (§10, §13.4).
4. **Pre-existing red test.** `additive_world_extension.test.ts` has one
   failing assertion that predates Chapter 1 (verified byte-identical inputs).
