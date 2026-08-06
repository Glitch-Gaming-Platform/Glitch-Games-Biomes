# Chapter 1 — Final Production Readiness Audit

> **August 5, 2026 update:** the Core Cell/map-marker, staged Jackie Talk,
> cutscene cleanup/regional music, and fifteen Chapter 1 plot-item presentation
> hotfixes are documented in
> `CHAPTER_1_HOTFIX_AUDIT_2026-08-05.md`. Focused product evidence is green,
> but the complete quest progression and front-facing held-item visual review
> have not passed on the final combined artifact. The production-ready verdict
> in this historical audit therefore remains open.

**Date:** 2026-08-03
**Scope:** the complete Chapter 1 “Identity” line: prologue handoff, 31 quests,
80 objectives, two Elsewhen dungeons, all six acts, all endings, production
seeding, NPC staging, native objective authority, and browser presentation.
**Plan reviewed:** `CHAPTER_1_IDENTITY_WRITERS_JOURNAL.md`, the migration and
objective-execution audits, the Chapter 1 E2E runbook, and the fast/full testing
guides.
**Verdict:** **not yet production-ready. Source and local gates are green; one
rebuilt exact-image E2E/browser verification batch is still required.**

This is the readiness document. `CHAPTER_1_AUDIT_FIXES_COMPLETE.md` is only the
fix log for the earlier 2026-07-31 objective audit.

---

## 1. Current result

The authored chapter, native authority path, production seed contracts, and
local regression suite are in ship shape. All previously reported B1–B7 gaps
are closed in source and covered by tests. The final exact-image browser pass
found two additional staging defects rather than being waved through:

1. the Grove watch-house needed separate Talk posts for Holt, Teak, and Jackie;
2. Act 6 placed Lou and Nadia on the same Greenlamp coordinate;
3. “The Flinch” placed Jackie and Rook on the same Old Wood coordinate.

The watch-house fix passed exact-image browser E2E. The Greenlamp and Old Wood
fixes are in source as staging v5, with matching objective targets,
deterministic Talk-selection tests, and a generic no-co-location staging test,
but the exact app image predates those source changes. Shipping before the
rebuilt browser pass would therefore be claiming evidence for code that was
not in the tested image.

---

## 2. Test evidence from the final source tree

| Gate                                  | Result on 2026-08-03                                                   |
| ------------------------------------- | ---------------------------------------------------------------------- |
| `scripts/harthmere/t.sh ch1`          | **555 passing, 0 failing**; production Chapter 1 seed gate also passed |
| `scripts/harthmere/t.sh types`        | **clean**                                                              |
| `scripts/harthmere/t.sh types:client` | **clean**                                                              |
| `scripts/harthmere/t.sh gate`         | **405 passing, 1 intentional pending**; scoped typecheck clean         |
| `scripts/harthmere/t.sh visuals`      | **82 passing, 0 failing**                                              |
| `git diff --check`                    | **clean**                                                              |

The Chapter 1 preset covers shared data/logic, server authority, API slices,
cutscene bindings, client projection contracts, terrain/dungeon traversal,
dialogue, objectives, staging, production seed wiring, and native E2E runner
contracts. It does not replace a live browser run.

---

## 3. Earlier audit findings are closed

| Finding                                                    | Resolution                                                                                     | Proof                                    |
| ---------------------------------------------------------- | ---------------------------------------------------------------------------------------------- | ---------------------------------------- |
| B1: 30 choice options had no spoken response               | Completion dialogue and expression coverage authored for every accepted narrative/route choice | `ch1_choice_completion_dialogue.test.ts` |
| B2: `come_out` promised an escort check it did not perform | Rewritten as the intended arrival beat after Sorrel's already-gated Breaking Year escort       | objective/dialogue contract tests        |
| B3: survival crossings said “Complete challenge”           | Route choices say “Choose route”; resource crossings say “Make the crossing”                   | objective-target tests                   |
| B4: old fix log was treated as a ship signal               | Retitled and explicitly linked to this readiness audit                                         | documentation contract                   |
| B5: deploy had no Chapter 1 readback                       | Fatal production readback added after seed/terrain work and before readiness                   | deploy seed-gate contract                |
| B6: fragment acquisition was not total                     | Every fragment now has a quest, ambient, AUGUR-9, or revision route                            | fragment reachability test               |
| B7: Marrow looked accidentally uncast                      | Explicitly documented and tested as a non-speaking dog                                         | voice/dialogue test                      |

The earlier material-acquisition, objective-clarity, world-object, and Act 6
guidance findings also remain closed.

---

## 4. NPC identity and movement audit

### One identity, one visible body

Chapter 1 uses one canonical entity id per actor. Story movement is a
per-player `clientPuppet` presentation override keyed by that same id. It does
not publish an ECS move and does not spawn a second character. This preserves
the MMO rule that players at different story phases can see the same canonical
actor at the phase-appropriate location.

For Jackie specifically:

- before Chapter 1, the canonical shared body remains at the original Road
  Ahead home so an eligible player can still receive the prologue content;
- after Chapter 1 starts for a player, that same id is projected to the
  road-house/fence/gate/watch-house/ending location for that player;
- the obsolete May-snapshot Jackie id and four other replaced Grove ids are
  deleted during runtime reconciliation, so the old and canonical selves
  cannot both render;
- the live E2E catalog requires every retired id to be absent from
  authoritative ECS and every expected actor id to render exactly once.

Exact Redis readback on the preserved Chapter 1 lane confirmed all five legacy
ids were deleted/tombstoned and the canonical Jackie identity was unique.

### Collision-free story posts

Separate interaction posts now exist for:

- Holt, Teak, and Jackie at the Grove watch-house;
- Iris and Marrow at Lovely Locks, clear of Emily and Alexis;
- Lou and Nadia at Greenlamp;
- Lou and Cressa at Returnstone.
- Jackie and Rook at the Old Wood aperture.

Unit tests replay the same six approach offsets as the browser runner and
assert that the aimed actor, not a nearby story NPC, owns `F — Talk`.
Objective targets resolve to the same posts as staging, so the marker, visible
body, and interaction target cannot disagree.

### Native ECS / Gaia / Anima boundary

- **Native ECS** owns canonical identities, health, encounter bodies, props,
  quest authority, and authoritative deletion of retired duplicates.
- **Gaia/native terrain** owns dungeon voxels, buildings, floors, collision,
  water basins, and walkable placement.
- **Anima** owns ambient NPC simulation from exact authored homes; named quest
  NPCs use zero spawn jitter so they return to the post referenced by maps and
  objectives.
- **Client puppets** own only per-player Chapter 1 presentation. They never
  mutate shared world identity or terrain.

That split matches the writer's-journal multiplayer rule: “your story, their
world.”

---

## 5. Exact-image runtime evidence already obtained

The preserved isolated Chapter 1 Redis was prepared with the focused native
installer and audited successfully:

- 10 cast NPCs;
- 12 encounter NPCs;
- 3 escort NPCs;
- 12 testimony NPCs;
- 49 desert terrain shards;
- 60 winter terrain shards.

The exact-image NPC browser matrix then proved stages serially through the Act
5 Hallr settlement. It found and drove fixes for:

- missing canonical Holt in the focused installer;
- watch-house Talk competition;
- the Act 6 Greenlamp Lou/Nadia coordinate collision.

The most recent report is
`artifacts/harthmere-native-ecs-e2e/1785759389680-71606-report.json`. It fails
at `act6-greenlamp` because the tested image contains the old shared
`[656, 65, -193]` post. The source now uses distinct Greenlamp posts and the
local regression suite passes, but that exact-image failure remains the last
runtime checkpoint until a new image is built.

---

## 6. Remaining work before a ship verdict

The source batch is complete. The remaining work is one coordinated runtime
batch, kept serial to avoid the documented Redis/Anima memory contention:

1. Build a new exact app image from staging/audit version v5.
2. Start only the isolated Chapter 1 app, Redis, and forwarder.
3. Re-run the production seed readback and verify zero OOM/restarts.
4. Resume the NPC matrix after `act5-hallr-settlement` and pass Greenlamp,
   Returnstone, watch-house, all ending presence/absence cases, and shared NPC
   Talk checks.
5. Run the complete native 80-objective/31-quest browser progression through
   all three ending branches, retaining the non-fail-fast report.
6. Perform the in-app live browser pass for visible prompts, dialogue,
   movement, gates, dungeon arrival/exit, Gather Parts without item fixtures,
   Act 6 handover/oath wording, and final-world consequences.

The runtime containers and Redis data are preserved but currently stopped by
coordination request. No new runtime batch should begin until that lane is
released for use.

---

## 7. Ship gate

Chapter 1 can be marked production-ready only when all of the following are
true for the same source/build:

- [x] Chapter 1 unit/integration suite passes.
- [x] Shared and client type checks pass.
- [x] Broader gate and visual suites pass.
- [x] Production seed readback contract is wired and has passed on the
      preserved Redis data.
- [x] Legacy duplicate Grove identities are absent in authoritative ECS.
- [ ] Rebuilt exact-image NPC matrix passes all 24 stages and shared NPCs.
- [ ] Complete native quest browser progression passes all 31 quests and 80
      objectives.
- [ ] In-app browser smoke passes Gather Parts, Act 6, both dungeons, and the
      final-world consequences without fixture-only success.
- [ ] Exact app and Redis finish with zero OOM kills and zero unexpected
      restarts.

Until the four unchecked runtime items pass, the correct verdict remains:
**not yet production-ready, with no known source-level blocker.**
