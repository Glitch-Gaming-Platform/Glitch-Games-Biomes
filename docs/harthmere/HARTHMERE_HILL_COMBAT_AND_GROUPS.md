# Hill combat, creature levels, groups, and escorts

Implementation of the July 27 2026 Anima audit. Four systems changed together
because they share one failure: creatures could not reliably _engage_ on the
original map's hills, and the machinery around engagement (levels, packs,
escorts) had no per-entity identity to hang behaviour on.

Authority is unchanged. **Native ECS remains authoritative for creature combat**;
Anima simulates, the ECS stores, and live-mode is a mirror. Nothing here moves an
authority boundary.

---

## 1. Why the fight in the HAR looked broken

The recorded fight (2026-07-27, 14:38:03–14:38:59 UTC) has the player at
approximately `[351.44, 35, -404.28]` in the Watchtower Muck. Native ECS health
went **77 → 4 → 0 → 140** (respawn) inside about thirty seconds, so enemies were
clearly capable of hitting and killing. Terrain around the fight:

| Radius | Creature feet Y | Creature count |
| ------ | --------------- | -------------- |
| 24 m   | 31 – 39         | 22             |
| 45 m   | 31 – 48         | 32             |

The defect was never "they cannot deal damage". It was inconsistent engagement on
uneven ground, caused by four independent things.

### 1.1 Melee range was measured in full 3D

`chaseAttackTargetTick` compared `length(targetPosition - npcPosition)` against
`attackDistance`. A Mucker standing one metre horizontally from the player but
four metres down a ledge reads as 4.12 m away, outside its 2.4 m radius. Vertical
separation silently consumed the entire horizontal reach budget.

**Fix.** `@/shared/npc/behavior/combat_geometry` decomposes the test:

- horizontal distance decides _approach_;
- vertical **body overlap** decides whether a strike plane exists;
- the 0.55 m hitbox cushion now widens only the horizontal budget, which is what
  it was always for.

`bodyVerticalGap` returns `0` whenever the two feet-anchored bodies overlap on Y
at all, so a creature on a step or a shallow slope can hit; only fully disjoint
spans report a gap. `ATTACK_VERTICAL_REACH_METERS = 1.0` is roughly one voxel.

The corollary is enforced too: a creature three metres below a shelf **cannot**
strike through it. That case now returns `reposition`, and the caller strafes
around the base of the obstacle (deterministically, keyed on entity id) instead
of grinding into the cliff face while appearing to have given up.

> Deliberately **not** done: raising a single 3D attack radius. That would also
> have let creatures hit through floors.

### 1.2 One failed line-of-sight ray dropped the target

`shouldDropHarthmereChaseTargetForLineOfSight` cleared the target the instant a
single eye-to-eye trace failed. On rolling ground a one-block crest sits squarely
on that line while leaving the player plainly visible, producing continuous
aggro flicker: crest, lose, reacquire, crest.

**Fix, two parts.**

_Multi-sample visibility._ `hasTerrainLineOfSightToBody` traces up to three
samples — head, torso, feet — and stops at the first clear line, so the common
fully-visible case still costs exactly one trace.

_A retention window._ `evaluateChaseTargetRetention` replaces the instant drop:

| Condition                                        | Result                                                |
| ------------------------------------------------ | ----------------------------------------------------- |
| Visible                                          | Retain, refresh sighting                              |
| Never seen, no line of sight                     | **Drop immediately** — cannot acquire through terrain |
| Lost < 1.75 s ago                                | Retain (`grace`)                                      |
| Lost longer, last known position still reachable | Retain (`hunting_last_known`, ≤ 2.5 s more)           |
| Lost longer, unreachable                         | Drop                                                  |

Total worst case is 4.25 s, and only for a creature that genuinely saw the
player. Level 5+ creatures add 1.25 s (see §2).

### 1.3 The pathfinder was authored for flat floors

Three concrete problems in `pathfinding.ts`:

- **Cardinal movement only.** Every diagonal step cost an L-shaped detour, which
  on a slope becomes permanent zig-zag plus repeated stuck declarations.
- **`closestNode()` rounded both endpoints blindly.** A player at Y=34.6 rounds
  to Y=35; if that voxel is solid the destination can never be expanded, A*
  exhausts its budget, returns `undefined`, and the NPC falls back to blind
  direct pursuit into the hillside. This was probably the single largest
  contributor to "they can't reach me".
- **Any 3 m of target drift discarded the whole path**, so a moving player forced
  a full search almost every tick, per pursuing NPC.

**Fix** (`@/shared/npc/behavior/pathfinding_geometry`):

- diagonals at the same height, each requiring **both** orthogonal neighbours to
  be free, so a creature can never squeeze through a sealed corner. Weighted
  `√2` so A* stays admissible;
- `nearestStandingVoxel` searches the column (down first at equal distance,
  because feet rest on a surface) and returns `undefined` when nothing is
  standable — "unreachable" is now reported honestly instead of disguised as a
  failed search;
- `evaluatePathDestination` adds a middle gear: small drift **repairs** the path
  tail, real drift rebuilds, and rebuilds are rate limited to ~3/second.

> **Repairs must be measured from the searched destination, not the repaired
> tail.** Measuring from the last repair lets a player moving two metres per tick
> stay permanently "within repair range", so the tail follows them indefinitely
> while the route behind it still leads somewhere else. This was caught by the
> end-to-end simulation, not by the unit tests. `lastPathSearchDestination` is
> persisted in `npc_state` for exactly this.

Node budget raised 2,000 → 3,200 to pay for diagonals plus vertical relief.

### 1.4 Encounter density

The Watchtower Muck region resolves to 32 monsters and 11 livestock, while client
telemetry showed only 14 NPCs rendered against a draw limit of 15 — the player
can be attacked by creatures they cannot see. Making engagement reliable without
also bounding how many creatures engage _at once_ would have turned an
inconsistent fight into an unavoidable death. That bound is §3.

---

## 2. Per-entity creature levels

`@/shared/npc/creature_level`.

### The problem with the old `combatLevel`

It existed, but it was static profile metadata, not progression. It selected
which shared NPC **type** (biscuit) a creature received. Because entities of one
family share a type, `attackDamage`, `attackIntervalSecs`, `attackDistance`,
`walkSpeed`, and `runSpeed` are all type-owned — only `maxHp` is entity-owned.
Bumping one entity's HP alone produced a half-levelled creature. Emitting one
biscuit per family per level would multiply the checked-in NPC id manifest by the
level cap, and a missing manifest entry ships a biscuit with an undefined id,
which fails the Bikkie overlay and blocks server boot.

### The model

Level lives on the **entity**, in `npc_state.creatureProgression`. Anima derives
effective combat parameters at runtime from `shared base profile × level
multipliers`. No new NPC types, no manifest churn.

```
level, baseProfileVersion, levelSource, xp
levelSource ∈ migration | region_tier | authored | earned
```

**The migration is inert.** Every existing creature becomes level 1, and level 1
multiplies every stat by exactly 1.0. Reinterpreting today's `combatLevel: 4`
Hexes as _new_ level 4 would buff the whole world a second time, because their
production HP and damage already encode that tier.

### The curve, and why it is shaped this way

| Stat            | Per level         | Cap           | Rationale                                                  |
| --------------- | ----------------- | ------------- | ---------------------------------------------------------- |
| Max HP          | +14%              | —             | Fastest. More time to kill, not more lethality.            |
| Damage          | +7%               | —             | The only lethality dial, deliberately slow.                |
| Speed           | +1.5%             | **+12%**      | A creature must never outrun a sprinting player.           |
| Attack interval | −7% per 10 levels | ≥ 80% of base | Cadence is a milestone, not a curve.                       |
| Kill XP         | +18%              | ×3            | Reward tracks risk, with diminishing returns.              |
| Drops           | +1 per 5 levels   | +3            | Curve reserved; not installed in the drop transaction yet. |

**Never scaled:** attack reach, attack FOV, aggro radius, disengage distance, and
body size. Growing a creature's reach or aggro bubble with level makes encounters
feel arbitrary and silently invalidates every encounter-density assumption in the
seed data.

Implemented and reserved AI milestones are:

| Level | Ability                                                |
| ----- | ------------------------------------------------------ |
| 5     | +1.25 s lost-sight target retention                    |
| 10    | Reserved flag for level-gated authored group tactics   |
| 20    | 10% flat damage resistance                             |
| 30    | Reserved flag for encounter-owned family special moves |

### Where it is applied

| Stat            | Applied                                          | Where                                   |
| --------------- | ------------------------------------------------ | --------------------------------------- |
| Max HP          | At seed time (entity-owned)                      | `live_entity_ecs_seed.ts`               |
| Damage, cadence | Per tick                                         | `applyCreatureLevelToChaseAttackParams` |
| Speed           | Per tick, before every existing cap              | `boundedHarthmereNpcChaseSpeed`         |
| Kill XP         | On the authoritative death transaction           | `logic/events/handlers/npc.ts`          |
| Resistance      | On the authoritative incoming-damage transaction | `logic/events/handlers/npc.ts`          |

Ambient creatures use assigned levels (`migration`, `region_tier`, or
`authored`). The `earned` level source and drop-bonus helper are serialized and
tested APIs, but no companion-XP source or level-scaled drop transaction is wired
in this change; they must not be described as live progression yet.

### Balance ceiling

Native damage is _already_ severe: `monsterDamage()` multiplies the family base
by five, so a `combatLevel: 3` Hex deals about 90 into a 140 HP player. Layering
the progression multiplier on a `combatLevel: 5+` Hex produces a single hit above
140 — an unavoidable one-shot.

**`road_to_harthmere_groups.test.ts` asserts that no road creature can one-shot a
full-health player.** That gate is what fixes the road ramp at level 5, and it is
the gate to consult before raising any authored level.

---

## 3. Groups: explicit identity, coordinated response

`@/shared/npc/creature_group` (rules) and
`@/shared/harthmere/creature_groups` (data).

### What the old system did

`evaluateMixedCreatureGroupRetaliationTarget` answered "are we in the same pack?"
at runtime with three questions: within 18 m horizontally, within 10 m
vertically, and does your **label** match a Mucker/Hex/cow/sheep/rabbit regex.

Four failure modes, all visible in play:

1. **No group identity.** Two unrelated encounters that overlap assist each
   other, so one aggressive pull cascades into a swarm.
2. **The same brittle terrain LOS test** that broke target retention also gated
   the alert, so authored pack-mates failed to help each other over a one-block
   crest — exactly the terrain in the HAR.
3. **Livestock joined Muck combat** because "cow" is in the regex.
4. **Broad scanning.** Every hostile scanned nearby NPCs and then inferred group
   membership from names; in the Watchtower region that is 32 monsters against
   43 creatures. The new path still uses the spatial selector, but exact group
   identity removes false recruitment and avoids the old per-candidate terrain
   raycast. Replacing the spatial scan with a group-index lookup is a separate
   performance optimization.

### What replaces it

Membership is **data**, written into `npc_state.creatureGroup` at seed time from
the authored registry, and read straight off the entity by Anima. A seed may
declare `groupId` explicitly (the road packs do); otherwise its `areaId` names
the group, which is how the guarded-herd, open-Wilds, and scattered families were
already authored.

```
groupId, assistFaction, role, leashRadius, memberIndex
assistFaction ∈ muck | bandit | livestock | none
role          ∈ melee | ranged | skirmisher | prey
```

Alert rules:

- only real `Health` damage evidence (`lastDamageAmount < 0`, kind `attack`,
  inside the 30 s memory) raises an alert — **never another creature's alert
  state**, so an alerted creature cannot alert a second ring;
- the candidate must share the **exact** `groupId`;
- bounded by `leashRadius`, **not** by terrain visibility. Members of an authored
  pack know they are members;
- livestock never joins as a bystander; it flees and keeps only its own direct
  retaliation, which is a separate damage event.

The alert identifies the encounter opener; it does not force every responder to
focus that one player forever. Each active responder selects from the eligible
players inside the bounded retaliation vicinity. The opener is first, responder
rank offsets pack members across the ordered participant list, and the shared
six-second rotation advances later exchanges. This preserves understandable
direct retaliation while preventing a multiplayer encounter from collapsing
onto one player.

### Responder control

`groupResponderPlan` caps **all simultaneous responders** at **3**. Overflow
members hold until an active responder dies or despawns and deterministic ranking
opens a slot; elapsed alert time can never dissolve the cap. Ranged members
(Hexes) are tagged with a flank role when they own an active slot, although the
current chase locomotion still owns their physical approach. Prey never
participates.

Three simultaneous connections is already lethal against 140 HP — six is not a
fight, it is a cutscene.

The plan is computed **locally by each member** with no shared alert bus.
Determinism comes from ranking on a _quantized_ distance (4 m buckets) plus the
authored `memberIndex`, so two members with slightly different views of the same
fight still agree on the order.

Stand-down is explicit and complete: expiry, attacker death, attacker safe zone,
attacker escaping the leash, attacker unreachable. **Transient terrain occlusion
is not on that list.** That is the point.

---

## 4. Escorts

`@/shared/npc/behavior/escort` (policy), `escort_tick.ts` (execution).

### What existed

Two incompatible implementations.

**The committed jobs-board escort** rebuilt a large part of the companion entity
once a second from live-mode Redis and projected it into ECS. Its reconstructed
snapshot hard-coded `isAttackable: false`, `combatProtection:
"friendly_noncombatant"`, `retaliatesWhenAttacked: false`, and `aggroRange: 0`;
the reducer additionally suppressed attacks whenever `escortJobId` was set. It
**could not fight**, and it structurally could not be made to: enabling combat
would have let each projection clobber the health, velocity, target, and Anima
state that combat produces. It also never terrain-grounded each projected step,
so hills produced floating or buried companions, and its 5,000 m leash was the
absence of a catch-up policy rather than one.

**The Chapter 1 escort** wrote a player anchor into the companion's Anima
_schedule_. The ownership model was right — normal NPC physics carried the follow
— but a schedule entry cannot express a combat policy, follow distance, formation
slot, leash, destination, or death handling, and it collided with the quest-giver
"stay home" branch.

### The unified model

A scheduler's **only** job is to assign or clear `npc_state.escort`. Anima owns
movement, terrain physics, combat targeting, health, and recovery — the same
authorities that already work for every other NPC.

```
leaderId, combatPolicy, status, followDistance,
formationSlot, leashDistance, destination, assignmentId
```

| Policy          | Fights                                             |
| --------------- | -------------------------------------------------- |
| `noncombatant`  | nothing (an explicit authored protection)          |
| `defend_self`   | whatever attacks the escort                        |
| `defend_leader` | + whatever attacks the leader (jobs-board default) |
| `fight_muck`    | + hostile Muck within 12 m of the leader           |

**Restricting targets is as much a part of the design as enabling them.** An
escort that picks its own fights turns a delivery into an unwinnable brawl, and
one that can hit livestock or civilians is a griefing tool. Escorts never use
proximity aggro; `evaluateEscortCombatTarget` is the only source of their target.
Once an escort chooses a hostile, its public `npc_combat_state.attack_target`
makes it an active encounter participant. The hostile can then target and damage
the escort through the normal Anima/Logic receipt path; unrelated NPCs remain
ineligible.

Locomotion has three bands (hold inside the slot, walk small gaps, sprint out of
formation) plus catch-up past the leash, and formation slots fan a party out so
companions do not stack in one voxel. Combat outranks following in
`selectNpcLocomotion`, so a combat-capable escort interrupts, fights, and resumes
formation.

A warp requires **both** a broken leash **and** six seconds of continuous
navigation failure, and never happens during combat. A companion that is merely
slow walks.

Chapter 1 assignments: Dr. Sorrel `fight_muck` (the combat-capable escort the
audit asked for), Iris `defend_leader`, Marrow `defend_self`.

Schedulers now emit **partial** ECS updates carrying only `npc_state`, merged
into whatever Anima already wrote, and emit nothing at all when the assignment is
unchanged.

---

## 5. The Road to Harthmere groups

`@/shared/harthmere/road_to_harthmere_groups`.

Four groups of **2 Hexes, 4 Mucklings, 1 cow, 2 sheep, 4 rabbits** — 13
creatures each, 52 in total.

| Group   | Centreline anchor  | Shoulder | Level |
| ------- | ------------------ | -------- | ----- |
| 1 (20%) | `[784, 65, -192]`  | +10 m    | 2     |
| 2 (40%) | `[1020, 60, -200]` | −10 m    | 3     |
| 3 (60%) | `[1273, 56, -212]` | +10 m    | 4     |
| 4 (80%) | `[1538, 59, -211]` | −10 m    | 5     |

Anchors are measured centreline columns from the read-only production road
planner run (1,362 traversable columns, Y41–Y71, zero route-planning failures,
start ≈ `[561, 70, -181]`, end ≈ `[1792, 42, -209]`). They are treated as
**approximate**: every creature is offset onto a shoulder and grounded per column
from a read-only production-shaped terrain scan. The general production terrain
placement map predates this seed family, so the checked-in feet-Y samples are the
runtime fallback until that larger generated artifact is refreshed. The scan
selects the standable surface nearest the authored road elevation rather than
tree-canopy tops. One shared Y across 13 creatures on a hill road would bury or
float some of them.

Design notes worth keeping:

- **Groups alternate sides and sit 10 m off the centreline**, so a player always
  has a clear travel lane and chooses to engage.
- **`combatLevel` and `progressionLevel` are different fields.** `combatLevel`
  stays at the ordinary family baseline (Hex 3, Muckling 2); the ramp lives in
  `progressionLevel`. Driving both from the ramp buffs each creature twice — with
  the ×5 damage multiplier that pushed a single Hex hit past a full 140 HP bar.
- **Livestock stay level 1.** A level 5 rabbit is not the difficulty the ramp is
  asking for.
- One shared display name per creature kind across all four groups, because the
  native type key is `monster_${slug(displayName)}` and a per-group name would
  need a per-group manifest entry.
- The road areas pass `harthmereLiveEntityIsOpenWildsMixedGroup`, which is what
  keeps them out of ordinary Muck redistribution. Without it every road Hex and
  Muckling is deterministically scattered into an unrelated Muck region, leaving
  its animals alone on the roadside.

Id bands: monsters `10801–10824`, animals `10841–10868`.
`HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_PRODUCTION_COUNT` moved 176 → **200**.

---

## 6. Testing

### Fast lane

```sh
scripts/harthmere/t.sh combat
```

`anima_hill_combat_e2e.test.ts` is a deterministic integration-style simulation
of the decision helpers (acquire → climb → crest → strike → group alert →
responder cap → multiplayer target distribution). The same preset also covers
the target rotation helper and `SimulatedNpc` player-versus-NPC event routing.
It does not instantiate Anima, ECS, or terrain resources; the browser gate below
is the real end-to-end proof. During development this simulation still caught
defects that narrower unit cases missed: compounding path repair, the one-shot
damage break, and responders all selecting the opener.

The server-authority tests require the normal bootstrap:

```sh
NODE_OPTIONS=--no-experimental-strip-types \
  node_modules/.bin/mocha --config .mocharc.json \
  src/server/logic/test/harthmere_npc_hit.test.ts \
  src/server/harthmere/test/escort_system.test.ts
```

They prove hostile melee and Hex ranged receipts can damage an NPC escort once,
that replay is rejected, and that generic player escorts use `defend_leader`.

### Typecheck

`./b test` does **not** typecheck (ts-node runs `transpileOnly` + swc), so green
tests say nothing about type correctness.

```sh
scripts/harthmere/typecheck-anima-combat.sh          # both lanes
scripts/harthmere/typecheck-anima-combat.sh shared   # ~20 s
scripts/harthmere/typecheck-anima-combat.sh server   # ~26 s
```

The server lane omits `src/server/shared/config.ts` (which declares the global
`CONFIG`) because including it roughly triples the check time; the wrapper filters
the resulting TS2304 diagnostics in three exact transitive files **by file name**
and nothing else.

### Browser gate

The fast suites prove the rules. The browser gate proves the same behaviours
against real voxels, real Anima, real ECS, and real sync — the only place the
original defect was ever visible.

```sh
HARTHMERE_E2E_RETALIATION_ONLY=1 \
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3017 \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
HARTHMERE_E2E_URL=http://127.0.0.1:3017/at \
HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
  node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

That changed-slice command proves assertion 3 below with two real synchronized
players and no unrelated traversal setup. It stages the complete first authored
road pack, one different-group negative control, and the optional solitary
identity, then restores all canonical ECS entities during cleanup; this avoids
making the result depend on whether a freshly allocated NPC id's value shard has
been reacquired after an Anima restart. Before the real
`UpdateNpcHealthEvent`, the lane stages a `training_dagger` because Logic
authoritatively validates the selected item, level, cadence, reach, and player
health. It restores the player's complete inventory, selected item, trigger
state, health, and position afterward. The complete hill gate uses the same
command with `HARTHMERE_E2E_HILL_COMBAT_ONLY=1` instead and proves the terrain
assertions plus the multiplayer pack assertion:

It asserts four things:

1. **Ledge** — a Mucker at the edge of a 2 m shelf can hit the player's
   vertically reachable lower body, while the separate geometry test proves a
   3 m cliff remains unhittable.
2. **Crest** — a wall that breaks line of sight does **not** clear
   `npc_combat_state.attack_target`, sampled continuously for six seconds. Any
   single cleared sample fails.
3. **Group** — a damaged creature keeps the player who struck it, an authored
   pack-mate selects a second real nearby player, and a creature from a
   _different_ road group standing just as close does not join the shared alert.
4. **Rotation diagnostic** — deterministic unit tests prove that a solitary
   retaliation-only creature selects the opener and then rotates to the second
   nearby player after one six-second exchange. The production-terrain browser
   version is opt-in with `HARTHMERE_E2E_RETALIATION_SOLO_ROTATION=1`; it is not
   a default release gate because retained-body terrain and LOS timing are not
   deterministic.

`HARTHMERE_E2E_HILL_COMBAT_SKIP_GIANT=1` is the broader ledge/crest/group inner
loop: it skips only the independent full-size Helix traversal row. Prefer
`HARTHMERE_E2E_RETALIATION_ONLY=1` when only targeting changed. Omit both flags
for changes to oversized-boss locomotion or for the complete hill-combat release
batch. Do not weaken a Helix or ledge predicate merely to unblock an unrelated
targeting change.

Stack requirements are unchanged from the chase gate in
`NATIVE_ECS_END_TO_END_TESTING.md`: production-shaped image, Anima ready (HTTP 200
on `/ready`), and `HARTHMERE_NATIVE_ECS_E2E=1` with a control token. Gaia is not
required for this scenario. It opens a second real synchronized client only for
the bounded multiplayer row, restores that actor's movement tweak and position,
and closes its context in fixture cleanup.

---

## 7. Recommended follow-ups

Not done here, and worth doing next:

1. **Encounter-density controls for the Watchtower region.** 32 monsters plus 11
   livestock against a 15-NPC draw limit is still the wrong shape, and reliable
   engagement makes it worse, not better. Responder caps bound how many _attack_;
   they do not bound how many _exist_.
2. **Live-mode mirror parity for levels.** `live_mode_backend.ts` builds its own
   combat snapshots from seed `killXp` / `attackDamage` and does not consult
   `creatureProgression`. Native ECS is authoritative for the fight, so this is
   cosmetic today, but it will drift.
3. **`region_tier` level assignment.** `assignCreatureLevel` supports it and
   nothing uses it yet; ambient creatures are all level 1.
4. **Escort death and failure consequences.** `status: "down"` is recorded but no
   scheduler reacts to it.
