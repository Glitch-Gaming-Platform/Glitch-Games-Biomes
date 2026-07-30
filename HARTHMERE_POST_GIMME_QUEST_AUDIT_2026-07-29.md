# Post-Gimme snapshot quest arc: audit and repair (2026-07-29)

Scope: the six original-Biomes quests that follow **Gimme Shelter** in the
`data-snapshot-2026-05-16` release — **Hoedown**, **Parcel Pursuit**, **Fish
Food**, **In Storage**, **Bready, Set, Grow** and **Battery Not Included**.

Everything from **The Road Ahead through Gimme Shelter** is untouched and was
used as the compatibility baseline; its tests still pass unchanged.

---

## 1. How the audit was done

The handed-in audit was re-derived from primary data rather than taken on
trust. The Bikkie tray embedded in `snapshot_backup.json` was decoded directly
(msgpack, attribute ids mapped from `src/shared/bikkie/schema/attributes.ts`),
and the 229k non-terrain entities in the same backup were indexed for labels,
NPC metadata, quest givers, buyers, minigames and `iced` state.

That gave the exact authored `trigger` and `unlock` trees for all six quests,
plus ground truth on every entity and item they reference.

### Confirmed from the handed-in audit

| Claim | Verdict |
|---|---|
| Hoedown and Parcel Pursuit both unlock on `challengeComplete(Gimme Shelter)` | **Confirmed** (unlock trigger ids 8778418736615201 / 2812897816425039) |
| Fish Food and In Storage unlock on eight `plantSeed` events mid-Hoedown | **Confirmed** — the seed is Raspberry Seed 7539420629350033, and Hoedown itself asks for **nine** plants, so both quests open one plant before Hoedown's own leaf closes |
| Bready, Set, Grow and Battery Not Included need all three of Hoedown / Fish Food / In Storage | **Confirmed** |
| In Storage is blocked on Mucker Teeth | **Confirmed, and it is the only hard blocker in the arc** |
| Neither Hoedown nor Parcel Pursuit should be forced into auto-continuation | **Confirmed** — both carry an authored `questGiver`, so the stock `QuestExecutor` already offers rather than starts them |

### Corrected or added by this audit

1. **Bready, Set, Grow's `seq` unlock is *not* an ordering requirement.**
   The audit flagged this shape as a risk. It is safe: `ChallengeCompleteTrigger`
   is stateless and answers from the player's current `challenges.complete` set,
   so a `seq` of three `challengeComplete` leaves passes in one tick regardless
   of completion order. This is now pinned by a test so a future engine change
   cannot silently make the authored order load-bearing.

2. **Two snapshot leaves ship with no authored `name` at all.**
   `In Storage` step 1 (6229445433632765) and `Bready, Set, Grow` step 1
   (7990090686166543) are `completeQuestStepAtMyRobot` leaves with `name`
   undefined. Both quests therefore open on a **blank objective row** in the
   journal, map and HUD. Not previously reported.

3. **Bready, Set, Grow sends the player to a plant that does not exist.**
   The leaf reads "Harvest 16 Wheat Seeds from **Long Grass**". No biscuit in
   the tray is named Long Grass. Wheat Seed (1534621126189364) drops from
   **Switch Grass** (7539420629350336). Same class of bug as the unnamed Mossy
   Muckling pack fixed on 2026-07-28. Not previously reported.

4. **That leaf counts harvest *actions*, not seeds.**
   It is an `event`/`collect` leaf, not a `collect` leaf, so `BaseEventTrigger`
   adds 1 per matching event. Sixteen swings at Switch Grass, not one
   sixteen-seed bag. Correct as authored; now documented and covered so nobody
   "fixes" it into a per-item count.

5. **Everything else the arc references is present and un-iced.**
   Budd Sower, Petunia (Fruit & Vegetable Buyer, attribute ids 354/355), Anne
   Choveigh, Goldie (Fish Buyer, attribute id 265 = `isFish`), Ol' Coop,
   Lauriel, Lawto, Nico Ballato and Sophia all exist in the snapshot; so do the
   Muckerhorn Mines minigame (5221984236294250) and its race start
   (2050066389949107), and every item the six quests move — Training Rod, Koi /
   Clownfish / Mackerel, LEDs, dyes, Mailbox, Small Chest + recipe, Wood Sign,
   Wood Text Sign, Empty Power Cell and Power Cell.

   The boards and minigame starts the handed-in audit flagged as iced belong to
   quests **downstream** of this arc and were left alone.

---

## 2. The one hard blocker, and how it was repaired

**In Storage** step 4 is `inventoryHas(Mucker Tooth 1534621126189454, 6)`, and
Ol' Coop's dialogue sends the player "up Muckerhorn to clobber a few of those
**Cobbled Mucklings**".

In the restored Harthmere world:

* no seeded creature is named Cobbled Muckling;
* **no drop table anywhere contains a Mucker Tooth**; and
* because the objective is `inventoryHas` rather than `npcKilled`, the existing
  legacy kill-id aliases in `native_combat_quest_routing.ts` (which already map
  the legacy Cobbled Muckling type onto Gravewood Pale Mucklings for the *kill
  count* quest "Nuthin' to Muck With") cannot help — an alias never puts an item
  in the player's bag.

The quest was unfinishable, and with it both second-tier unlocks.

### Repair — `HARTHMERE_COBBLED_MUCKLING_HUNT`

Modelled exactly on the 2026-07-28 `HARTHMERE_MOSSY_MUCKLING_HUNT` fix:

* A real, named, six-strong **Cobbled Muckling** pack in
  `live_entity_production_seed.ts`, with its own checked-in native type identity
  `monster_cobbled_muckling` (8722087466111638) in the NPC id manifest. Six
  members, no Hexer, so six kills means six teeth.
* A **guaranteed** Mucker Tooth drop, via a new `questDropBikkieItems` field
  that carries an original-snapshot Bikkie id straight through to the NPC
  biscuit's `drop` table. It joins the same `"guaranteed"` bucket as the family
  loot — `rollSpec` rolls each bucket independently, so a separate bucket would
  have made the quest item probabilistic.
* Deliberately typed as a `BiomesId`, not a Harthmere item slug: minting
  `mucker_tooth` in `HARTHMERE_NATIVE_ITEM_ID_MANIFEST` would give a snapshot
  item a second identity and a reverse projection into the live-mode inventory
  bridge.
* **Grounding.** The six columns are the exact positions the original May 2026
  snapshot placed Cobbled Muckling entities on — source entities
  7730989858431516, 4798878097356869, 7316152894825690, 3830695482962746,
  4547357347013313 and 8158919683013070 — on the Muckerhorn slope 70–85 blocks
  west-north-west of Ol' Coop, on the way up to Lauriel and the mine. Each keeps
  its own measured Y (the pack spans eleven voxels of relief), so
  `authoredMuckPack` stops the in-area re-roll from flattening it.
* **Placement**, all asserted in tests: outside every safe zone, Muck
  containment area, business safe site, authored building plot and
  robot-protected area; west of `HARTHMERE_ORIGINAL_WORLD_EAST_EDGE_X`; and
  139 blocks from the nearest other seeded creature, well past the 60-block
  minimum — so the pack can never repeat the pre-relocation Watchtower pile-up.
* A map marker at `[115.5, 73, 121.5]`, kept in lockstep with the pack anchor
  by test.

---

## 3. Everything else changed

| Problem | Repair |
|---|---|
| Two blank objective rows | Projected wording from each leaf's own authored `acceptText`, through the existing single choke point `nativeQuestProjectedTriggerName` |
| "Long Grass" | Projected to "Switch Grass", preserving the `{count}`/`{countTarget}` placeholders |
| Tooth objective named a creature the world lacked | Projected to name the Cobbled Mucklings |
| `inventoryHas` leaves cannot author navigation | `nativePostGimmeProjectedNavigationAid` fills only that gap; an authored aid always wins. Repeated in `nativeQuestMapAdapter` so a bundle rebuilt from cached progress still produces a marker |
| Battery Not Included vs. Chapter 1 | Added to the main-story identity set (so tracking carries forward when it completes) but sorted **after** every Chapter 1 entry, so the automatic default never yanks tracking off an in-progress Chapter 1. Choosing it stays an explicit player action |
| Talking to an NPC out of order | `nativePostGimmeFirstIncompletePriorStep` mirrors the Road Ahead preflight so the client reports the real gate instead of publishing a transaction the server rolls back. The server remains authoritative (`quest_step_validation.ts` → `prior_step_incomplete`) |

**No engine change was needed for the post-Gimme handoff.** `TriggerEngine`
already runs every quest root against every event batch, and `QuestExecutor`
already moves a quest with an authored `questGiver` to `available`. Both
Hoedown and Parcel Pursuit therefore appear as robot transmissions the moment
Gimme Shelter completes, and neither auto-starts. That behaviour is now locked
down by test rather than left to chance.

### New / changed files

```
src/shared/harthmere/native_post_gimme_contract.ts          (new)
src/shared/harthmere/native_road_ahead_contract.ts          (delegates projections)
src/shared/harthmere/live_entity_production_seed.ts         (Cobbled Muckling pack)
src/shared/harthmere/harthmere_native_combat.ts             (questDropBikkieItems)
src/shared/harthmere/harthmere_native_id_manifest.ts        (monster_cobbled_muckling)
src/client/components/biomes_ui/adapters/mainQuestSelection.ts
src/client/components/biomes_ui/adapters/nativeQuestMapAdapter.ts
```

---

## 4. Engine compatibility

* **Native ECS** — no new quest authority. Progression stays in the ECS
  `challenges` / `trigger_state` components driven by the stock trigger engine;
  every change here is either world data or a display projection. The teeth
  arrive through the normal `npcKilled` → `npcTypeInfo.drop` → `rollSpec` →
  `createDropsForBag` path, so the `inventoryHas` leaf reads the same
  authoritative ECS inventory as every other quest.
* **Gaia** — untouched. Hoedown and Bready run on Gaia's existing farming
  simulation; Raspberry Seed (20 min growth) and Wheat Seed (2 h, `requiresSun`)
  both have complete `farming` definitions with guaranteed drop tables, and no
  new plant, block or growth rule was introduced.
* **Anima** — the new pack is an ordinary `ambient_muck_monster` seed. It gets
  its behaviour from `harthmereNativeNpcCombatProfileForSeed` and
  `harthmereNativeNpcChaseAttackParams` exactly like every other Muckling
  family, so aggro, chase, retaliation, hits, death and the five-minute respawn
  are all the shared code path. The only per-pack deviations are the ones the
  quest requires: no Hexer, and one guaranteed quest drop.

---

## 5. Tests

All new tests are pure in-memory — no Redis, no ECS backend, no browser — and
the whole set runs in well under a second.

| File | Coverage |
|---|---|
| `src/server/shared/triggers/test/native_post_gimme_progression.test.ts` (12) | **End-to-end**: replays all six authored trigger trees through the real `deserializeTrigger`, real leaf classes, `SeqTrigger` and `QuestExecutor`, driven by synthetic firehose events the way `TriggerEngine.processAllTriggers` drives them. Covers the Gimme handoff, the "never auto-starts" contract, the eighth-plant unlock, all six quests played to completion, the three-quest gate, the any-order `seq` proof, and a drift check that the contract's ordered-step table still matches the authored trees |
| `src/shared/harthmere/test/native_post_gimme_contract.test.ts` (15) | Quest/step identity, prerequisite tables, the three wording projections (including "no Long Grass"), navigation projection and its precedence rules, and the out-of-order claim preflight |
| `src/shared/harthmere/test/native_post_gimme_world.test.ts` (11) | The Cobbled Muckling pack: count, naming, no hidden Hexer, verbatim measured columns, legal open ground, crowding distance, unique type identity, guaranteed-drop shape, six-kills-six-teeth arithmetic, marker/anchor pairing, and id-band collisions |
| `mainQuestSelection.test.ts` (+4) | Battery Not Included never displaces an in-progress Chapter 1, is selectable, carries tracking forward, and becomes the default only when nothing precedes it |
| `nativeQuestNavAidMarkers.test.ts` (+1) | The Mucker Teeth objective produces a real map marker at the pack |

Regression: `native_robot_story_continuation`, `native_road_ahead_contract`,
`native_get_muck_out_muckling_compat`, `native_legacy_combat_quest_compat`,
`muck_pack_relocation` and `native_combat_quest_routing` all pass unchanged.

---

## 6. Known-good but worth watching

These are **not** blockers and were deliberately left as authored, but they are
the sharp edges a playtest should look at first:

1. **Hoedown has no spare Raspberry Seeds.** The robot grants exactly nine and
   the quest requires nine planted, nine grown and nine raspberries in bag. The
   plant's `seedDropTable` returns a seed only on a `common` roll, and nothing
   else in the world drops Raspberry Seed. A player who loses seeds before
   planting has no authored recovery path. Worth a soft-lock decision before
   launch (the same class of issue as the muck-buster soft-lock).
2. **Hoedown assumes the player already has Tilled Soil.** Raspberry Seed's
   `plantableBlocks` is `[Tilled Soil]`, and neither Hoedown nor Gimme Shelter
   grants a Hoe.
3. **Bready, Set, Grow is a two-hour real-time grow.** Wheat is `timeMs`
   7,200,000 and `requiresSun`. Authored, but it is by far the longest wait in
   the arc.
4. Wheat Seed's drop from Switch Grass is on the `rare` bucket, so sixteen
   seeds is a genuine grind. `partialGrowthDropTable` gives a guaranteed seed
   back, which softens it once the player has one plant going.

Downstream of this arc (the ~79-quest Hoedown descendant graph), the handed-in
audit's remaining items still stand and were not touched: the missing Albert
interaction target, the four iced boards, and the two iced minigame starts.
