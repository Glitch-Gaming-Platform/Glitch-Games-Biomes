# Harthmere combat: doc-vs-code drift and playability audit

Date: 2026-08-02
Status: **all findings addressed 2026-08-03** — see "Resolution" at the end.
Scope: native ECS / Anima combat authority, player attack + special movement,
enemy pacing, boss attack catalog, projectile readability.
Lens: correctness (does the code do what the docs say) and playability (can a
player fight skillfully).

Graphics/asset quality is explicitly **out of scope** for this pass. Projectile
readability is in scope because it is a gameplay-legibility contract, not an
art-quality question.

## Sources read

Docs: `docs/docs/basics/native-ecs.md`, `docs/docs/basics/anima.md`,
`HARTHMERE_COMBAT_SYSTEM.md`, `HARTHMERE_NATIVE_ECS_COMBAT.md`,
`HARTHMERE_BOSS_COMBAT_AND_ANIMATION.md`.

Code: `src/shared/harthmere/deliberate_combat.ts`,
`src/shared/game/movement_actions.ts`,
`src/server/logic/events/handlers/movement_actions.ts`,
`src/server/logic/events/handlers/player_status.ts`,
`src/server/logic/events/handlers/npc.ts`,
`src/shared/harthmere/magic_charge.ts`,
`src/shared/harthmere/projectile_visual_manifest.ts`,
`src/shared/harthmere/boss_attack_catalog.ts`,
`src/shared/npc/behavior/chase_attack.ts`, `src/shared/npc/logic.ts`,
`src/shared/npc/creature_level.ts`,
`src/client/game/scripts/player.ts`,
`src/client/game/resources/npcs.ts`,
`src/client/game/renderers/local_dev/harthmere_projectiles.ts`,
`src/client/game/interact/item_types/attack_destroy_delegate_item_spec.ts`.

## Severity summary

| ID | Severity | Title |
| -- | -------- | ----- |
| B1 | **Critical** | Projectile flight-time floor is not applied on the authoritative path |
| D2 | **High** | A second, undocumented 2–10 s magic charge clock runs alongside the documented 460/700 ms magic timeline |
| P1 | **High** | No attack input buffering; attacks pressed during recovery are silently dropped |
| D4 | **High** | 45 of 55 authored boss cast times are dead values, silently clamped to the telegraph floor |
| P2 | Medium | Evade strictly dominates dodge on every defensive axis and costs less stamina |
| B2 | Medium | NPC evade i-frames start immediately; player i-frames are delayed |
| B3 | Medium | Label regex decides NPC i-frame duration, violating the stated one-authority contract |
| D1 | Medium | Stamina cost table contradicts both the prose in its own doc and the code |
| D5 | Medium | Enemy pacing table omits the runtime multipliers that actually set cadence |
| B5 | Low | Server does not validate double jump against jump count |
| B4 | Low | Player-vs-NPC i-frame semantics keyed on float duration equality |
| P4 | Low | Double jump is the most expensive special move and grants nothing defensively |

## What is correct

Worth stating plainly, because these were the highest-risk areas checked and
they hold up:

- **Special-movement authority is sound.** `movementActionEventHandler`
  (`src/server/logic/events/handlers/movement_actions.ts:44-80`) authors every
  timestamp from `secondsSinceEpoch()` and the authored timing table. The client
  supplies only action type, direction, and nonce. Cooldown and stamina are
  checked server-side before the state is written. There is no client-authored
  i-frame window and no clock-skew vector.
- **The i-frame math matches the doc.** Server writes
  `invulnerabilitySeconds: timing.invulnerabilityEndSeconds`, and
  `movementActionIsInvulnerable` derives the delayed start from the same table,
  yielding dodge `[0.10, 0.28]`, evade `[0.15, 0.40]`, double jump none —
  exactly the documented windows.
- **Creature level scaling is properly bounded.** `minAttackIntervalMultiplier:
  0.8` (`creature_level.ts:74`) caps cadence compression, and
  `attackStrikeMomentSecs` is deliberately excluded from
  `ScalableCreatureCombatStats`, so a high-level creature cannot shrink its own
  tell. The `Math.max(0.4, ...)` floor in `scaleCreatureCombatStats` is a
  safety net that level scaling never reaches.
- **Boss roster matches.** All eleven bosses in
  `HARTHMERE_BOSS_COMBAT_AND_ANIMATION.md` exist in `boss_attack_catalog.ts`
  with exactly five attacks each and matching display names (55 total).
- **Hit-stop and damage camera shake ship.** 65 ms hit-stop
  (`harthmere_assets.ts:31615`) and `onDamageCameraShake` (`player.ts:2075-2091`)
  are on the production path.

---

## B1 — Critical: projectile flight-time floor is not applied on the authoritative path

**This is the finding that most directly breaks "projectiles must be seeable so
they can be dodged."**

`projectile_visual_manifest.ts:10-11` establishes the intent:

```ts
// Projectiles need enough screen time to communicate direction and give a
// moving target a readable reaction cue.
export const HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS = 0.4;
export const HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS = 1.8;
export const HARTHMERE_AUTHORITATIVE_IMPACT_EPSILON_SECS = 1 / 240;
```

But `harthmereProjectileFlightDurationSecs` applies that 0.4 s floor **only on
the fallback distance/speed branch**:

```ts
if (Number.isFinite(authoritativeImpactSecs) && authoritativeImpactSecs >= 0) {
  return Math.min(
    HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS,
    Math.max(HARTHMERE_AUTHORITATIVE_IMPACT_EPSILON_SECS, authoritativeImpactSecs)
  );                       // ← floor is 1/240 s ≈ 4.2 ms, not 0.4 s
}
const rawDuration = distance / speed;
return Math.min(
  HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS,
  Math.max(HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS, rawDuration)   // ← 0.4 s applied here only
);
```

Every native hostile attack takes the authoritative branch. The value passed in
is a **remaining** time, computed against the client's own clock at the moment
the client observes the release (`npcs.ts:2730-2738`):

```ts
authoritativeImpactSecs: harthmereAuthoritativeImpactRemainingSecs({
  releaseTime: projectilePresentation.releaseTime,
  impactDelaySecs: projectilePresentation.windupSecs,
  now: secondsSinceEpoch,
})
// => Math.max(0, releaseTime + impactDelaySecs - now)
```

Consequence: the rendered flight time is the *residual* window after Anima tick
latency, `npc_state` serialization, and Sync replication have already consumed
part of it. Under normal latency the projectile loses a slice of its flight;
under a tick stall or latency spike the remaining time reaches 0 and clamps to
**4.2 ms** — the projectile is drawn for roughly one frame at 240 Hz and then
lands. The player sees a hit with no travelling object to react to.

The failure is silent and scales with how bad the connection is, which is
exactly backwards: the laggier the session, the less warning the player gets.

**Fix.** Apply the readability floor on both branches, and let the visual
under-run the authoritative impact rather than teleport:

```ts
if (Number.isFinite(authoritativeImpactSecs) && authoritativeImpactSecs >= 0) {
  return Math.min(
    HARTHMERE_PROJECTILE_MAX_FLIGHT_SECS,
    Math.max(HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS, authoritativeImpactSecs)
  );
}
```

Because damage is resolved server-side from the receipt, a visual that arrives
slightly after the authoritative impact is a cosmetic desync, whereas a
4 ms projectile is an unreadable mechanic. If exact visual/damage coincidence
matters, the better fix is to spawn the projectile at the *cast* time with the
full authored flight duration rather than at observed release.

**Also worth fixing alongside:** `boss_magic_presentation.ts:89-94` pulls the
charge/projectile origin toward the target when a large boss is close
(`targetConstrained`). That shortens the visible travel path further, so B1 and
close-range giant fights compound.

---

## D2 — High: an undocumented 2–10 second magic charge clock

`HARTHMERE_COMBAT_SYSTEM.md` documents magic as one line in the attack table:

| Attack class | Windup | Contact frame | Recovery |
| ------------ | -----: | ------------: | -------: |
| Magic        | 460 ms |        700 ms |   860 ms |

`magic_charge.ts` defines a completely separate clock that the combat doc never
mentions:

```ts
export const HARTHMERE_MAGIC_CHARGE_MIN_SECS = 2;
export const HARTHMERE_MAGIC_CHARGE_MAX_SECS = 10;
```

It is live on both sides:

- Player: `attack_destroy_delegate_item_spec.ts:142` calls
  `harthmereMagicChargeDurationSecs` for the selected magic item.
- NPC: `chase_attack.ts:1068-1076` computes
  `releaseTime = castTime + chargeTimeSecs` and
  `impactTime = releaseTime + selected.castTimeSecs`.

So a hostile spell's true time from cast start to impact is
`chargeTimeSecs (2–10 s) + castTimeSecs (≥1.10–1.35 s)` = **3.1 s to 11.35 s**,
against a documented magic contact frame of 700 ms.

Two consequences:

1. **Documentation is wrong** about the dominant timing of every spell.
2. **Player magic is close to unusable under pressure.** Enemy full intervals
   are 2.05–3.50 s (`HARTHMERE_ENEMY_MELEE_PACING`). A 2 s *minimum* charge
   means the cheapest spell in the game takes about as long as an enemy's entire
   attack cycle, and a high-power spell (10 s) spans three to five enemy swings.
   Since the player has no block or parry posture yet (stated as out of contract
   in `HARTHMERE_COMBAT_SYSTEM.md`), and dodge/evade cost from the same
   life-critical stamina bar, there is no defensive option that covers a
   10-second commitment.

**Recommendation.** Decide which clock owns magic and delete or subordinate the
other. If the charge system is intended, the realistic playable band is roughly
0.6–2.5 s, and the doc's magic row must be replaced by a charge table. If the
460/700 ms timeline is intended, `magic_charge.ts` should drive VFX intensity
only, not gate release.

This also invalidates two specific doc claims:

> Hex fireballs use a 1.3-second cast … Indisworm Poison Spit uses the same
> native ranged state and a 1.15-second cast.

Both families resolve as magic (`hex` and `nature`/`dark` projectile families
are in `MAGIC_PROJECTILE_FAMILIES`), so both pick up the ≥2 s charge on top of
the quoted cast time.

---

## P1 — High: no attack input buffering

The only input buffer in the combat system is the evade→attack transition
(`movement_actions.ts:180-226`, consumed at
`attack_destroy_delegate_item_spec.ts:194-262`), with a 0.15 s grace.

There is **no buffer for attack→attack**. `flushQueuedPrimaryAttack` bails when
an attack is already committed:

```ts
if (isAttacking(this.attackInfo, nowSeconds)) {
  return;
}
```

and nothing re-queues the press. A basic attack is committed for
`impactMs + recoveryMs` = **1.02 s**; a heavy for **1.64 s**. Any attack input
during that window is discarded, so the player must wait for full recovery and
then press again — and if they press even 30 ms early, nothing happens.

This is the single largest reason the combat will read as unresponsive rather
than deliberate. Commitment is a good design choice; *swallowing the input that
expresses intent during commitment* is not. Every action game that uses
committed attacks (Souls, Monster Hunter, God of War) pairs them with a
120–250 ms buffer at the tail of recovery.

**Recommendation.** Generalize the existing `queuedPrimaryAttack` mechanism to
all attack commitment, not just evade recovery. Concretely: accept a press
during the final ~180 ms of recovery, store it with an expiry, and flush it on
the first tick where `isAttacking()` goes false. The plumbing already exists —
`queuedPrimaryAttack`, `expiresAt`, and `flushQueuedPrimaryAttack` only need
their trigger condition widened.

Same argument applies to buffering dodge/evade pressed during attack recovery.
The doc deliberately forbids *cancelling* an attack into a dodge at button-down;
it does not require throwing the input away.

---

## D4 — High: 45 of 55 authored boss cast times are dead values

`boss_attack_catalog.ts:53-65` clamps every authored cast time up to the shape
floor:

```ts
castTimeSecs: Math.max(
  input.castTimeSecs,
  HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS[input.attackShape]
),
```

Measured across the catalog, **45 of 55 attacks (82%) author a cast time below
their shape floor** and are silently overridden. Examples:

| Attack | Shape | Authored | Effective |
| ------ | ----- | -------: | --------: |
| `vyrahel_tail_feint` | cone | 0.45 s | 1.15 s |
| `echo_copy_melee` | cone | 0.55 s | 1.15 s |
| `choir_apprentice_false_note` | projectile | 0.62 s | 1.15 s |
| `apprentice_shard_cast` | projectile | 0.65 s | 1.15 s |
| `vyrahel_wing_burst` | self_aoe | 0.65 s | 1.20 s |
| `root_dead_root_eruption` | ground_aoe | 1.00 s | 1.35 s |

Two problems.

**Correctness/maintenance.** The numbers in the source file are not the numbers
the game uses. Anyone tuning `castTimeSecs` below the floor changes nothing and
gets no warning. The catalog reads like authored design data while functioning
as decoration.

**Design.** The clamp flattens intra-boss attack variety. `vyrahel_tail_feint`
is named and lored as a feint — a fast mixup that punishes a premature dodge.
At 1.15 s it is exactly as slow as `vyrahel_vein_breath`, so Vyrahel's five
attacks all telegraph in a 1.15–1.35 s band and the fight has no rhythm to read.
The same flattening applies to `echo_copy_melee`, whose whole identity is that
the Echo-Singer mimics the *player's* faster melee.

A readable boss needs a spread — some attacks fast and low-commitment, some slow
and devastating. The floor was presumably added to guarantee reactability, but
it is applied uniformly instead of per-attack.

**Recommendation.** Keep a floor, but make it opt-outable per attack for
deliberately fast mixups, and make the clamp loud:

- add an explicit `allowFastTelegraph: true` flag for feints/mixups, gated to a
  lower floor (~0.45 s, still above human reaction time for a telegraphed cue);
- assert in `boss_attack_catalog.test.ts` that any attack *without* that flag
  authors a `castTimeSecs` at or above its floor, so the source stops carrying
  values that do nothing.

---

## P2 — Medium: evade strictly dominates dodge

From `PLAYER_MOVEMENT_ACTION_TIMING` and `HARTHMERE_SPECIAL_MOVEMENT_STAMINA`:

| | Stamina | i-frames | i-frame length | Distance | Duration | Cooldown |
| --- | --: | --- | --: | --: | --: | --: |
| Dodge | **3** | 0.10–0.28 s | 0.18 s | 4.75 m | 0.50 s | 0.85 s |
| Evade | **2** | 0.15–0.40 s | **0.25 s** | **5.25 m** | 0.75 s | 1.15 s |

Evade is cheaper *and* has 39% more invulnerability *and* travels further. Its
only costs are 0.25 s more commitment and 0.30 s more cooldown. For any
defensive purpose where the player is not immediately re-attacking, evade is the
correct answer every time, and dodge exists only as a slightly faster reset.

The doc's own table intended the opposite relationship — it lists dodge at 12
and evade at 16, i.e. evade as the *expensive* committed option. The code
inverted it.

**Recommendation.** Make the costs match the commitment: dodge cheaper and
twitchier, evade expensive and powerful. Swapping the two constants
(`HARTHMERE_DODGE_STAMINA_COST = 2`, `HARTHMERE_EVADE_STAMINA_COST = 3`) restores
the intended tension in one line and is consistent with the doc's ordering.

---

## B2 — Medium: NPC evade i-frames start immediately, player's do not

`movementActionIsInvulnerable` (`movement_actions.ts:745-769`) branches on
whether the replicated duration matches the player table:

```ts
const usesPlayerTiming =
  Math.abs(actionDuration - timing.durationSeconds) < 1e-3;
const invulnerabilityStart =
  state.action_start_time +
  (usesPlayerTiming
    ? actionDuration * (timing.invulnerabilityStartSeconds / timing.durationSeconds)
    : 0);          // ← NPCs: invulnerable from frame 0
```

NPC evade durations are 0.44–0.68 s (`NPC_EVADE_PROFILES`), never the player's
0.75 s, so every NPC evade takes the `0` branch and is invulnerable the instant
it begins.

The code comment states this is intentional. As a *gameplay* decision it works
against the document's own thesis. `HARTHMERE_COMBAT_SYSTEM.md` says:

> Dodge and evade protect only during their authored invulnerability window;
> pressing after impact is too late.

For the player, that creates a skill test: commit early and you eat the hit.
For NPCs, no such test exists — an NPC that reacts to your swing is immune
immediately, so a well-timed attack into a baited dodge cannot be rewarded. The
player is held to a stricter standard than the AI on the same mechanic, which
removes one of the more satisfying skill expressions available (bait → punish).

**Recommendation.** Give NPC evades a proportional delayed window (e.g. the same
20% of duration the player gets) so a read can beat a reactive dodge. If instant
protection is needed for specific agile families, scope it to those profiles
explicitly rather than deriving it from a duration mismatch.

---

## B3 — Medium: label regex decides NPC i-frame duration

`HARTHMERE_NATIVE_ECS_COMBAT.md` is unambiguous:

> No label regex is allowed to decide the behavior, damageability, drops, or
> quest kill identity of a native Harthmere NPC. Labels remain presentation only.

`npcEvadeFamilyForDescriptor` (`movement_actions.ts:778-793`) matches regexes
against free text and is called with the entity's label first
(`npc/logic.ts:373-378`):

```ts
const profile = npcEvadeProfileForDescriptor(
  npc.label,            // ← label participates in the match
  npc.type.name,
  npc.type.displayName,
  movementType
);
```

The selected profile sets `invulnerabilitySeconds` (0.26–0.34 s),
`speedMetersPerSecond` (5.2–12.0), `durationSeconds`, and `cooldownSeconds`.
Invulnerability duration is damage immunity — squarely "behavior" and
"damageability", not presentation.

This is the same class of bug the entity-identity rule in
`HARTHMERE_BOSS_COMBAT_AND_ANIMATION.md` exists to prevent: production actors
whose labels cannot safely be renamed (`Old Wood Mucker 1` is actually Alpha
Mucker, `Gravewood Pale Hexer 7` is actually Hex Wraith). Under the current
code, renaming a label silently changes how long that creature is invulnerable.
Note that `Gravewood Pale Hexer 7` matches `/\bhex(?:er)?\b/` and so receives
the `hexer` profile — 12 m/s, 0.32 s i-frames — purely from its label text.

**Recommendation.** Resolve the evade family from the entity-aware native
profile (the same lookup boss identity already uses), and pass label only as a
last-resort fallback for un-migrated actors — or drop it entirely.

---

## D1 — Medium: stamina cost table contradicts its own document

`HARTHMERE_COMBAT_SYSTEM.md` states costs twice, inconsistently.

Prose (correct, matches code):

> dodge costs 3, evade costs 2, and double jump costs 4 from this bar

Table (wrong):

| Action | Cost |
| ------ | ---: |
| Dodge | 12 |
| Evade | 16 |
| Double jump | 10 |

`deliberate_combat.ts:72-74` is the source of truth: `3`, `2`, `4`.

Fix the table. Note that its *ordering* (evade > dodge) encodes the intended
balance discussed in P2, so this should be resolved together with that decision
rather than by blindly overwriting the table with 3/2/4.

---

## D5 — Medium: enemy pacing table omits the runtime multipliers

The doc presents `HARTHMERE_ENEMY_MELEE_PACING` as the player-facing cadence:

| Enemy class | Strike tell | Full interval |
| ----------- | ----------: | ------------: |
| Ordinary    |      0.72 s |        2.40 s |

At runtime that base is modified by at least three independent multipliers:

- level scaling, down to `0.8×` (`creature_level.ts:74`, bounded — good);
- horned variants: `Math.max(0.8, interval * 0.7)` or `interval * 1.45`
  (`chase_attack.ts:321-323`);
- night muckers/hexers: `Math.max(0.55, interval * NIGHT_MUCKER_HEX_ATTACK_INTERVAL_MULTIPLIER)`
  and `attackAnimationMultiplier * 1.35` (`chase_attack.ts:629-636`).

The animation multiplier is the one that matters for readability, because the
tell is divided by it (`effectiveAttackStrikeDelaySecs`, `chase_attack.ts:139-148`):

```ts
const rawDelay = Math.max(0, params.attackStrikeMomentSecs) / animationMultiplier;
return Math.min(rawDelay, params.attackIntervalSecs * 0.95);
```

A night hexer's 1.35× animation multiplier turns a 0.72 s ordinary tell into
0.53 s of wall-clock warning.

To be fair to the existing code, this is *internally consistent*: the adjacent
comment shows `attackStrikeMomentSecs` is deliberately left unscaled precisely
so the contact frame stays aligned with the sped-up clip, rather than being
double-accelerated. The visible limb also moves 1.35× faster, so the animation
and the damage still agree. That is the correct call.

The residual concern is only that 0.53 s is approaching the practical floor for
reading and reacting to a new cue, and nothing structurally prevents a future
multiplier from going further: there is a *ceiling* on the strike delay (95% of
interval) but **no floor**. Bosses are protected by
`HARTHMERE_BOSS_MINIMUM_TELEGRAPH_SECS`; ordinary enemies have no equivalent.

**Recommendation.** Add a `HARTHMERE_MINIMUM_ENEMY_TELL_SECS` floor (~0.45 s)
applied inside `effectiveAttackStrikeDelaySecs`, and document the multiplier
chain in the pacing section so the table reads as "base" rather than "actual".

---

## B5 — Low: server does not validate double jump against jump count

`movementActionEventHandler` checks health, cooldown, and stamina, then writes
the state. It never consults jump count or grounded state. The
`isDoubleJumpAttempt` / `playerJumpCount` helpers exist
(`movement_actions.ts:172-178`) but are used only client-side
(`player.ts:2855`).

Impact is limited — position is client-integrated in Biomes generally, and the
0.5 s cooldown plus 4 stamina per use bound the abuse — but a modified client
can currently spend stamina on double jumps it has not earned, and any future
work that makes double jump grant i-frames or displacement would inherit an
unvalidated action.

**Recommendation.** Replicate jump count (or grounded state) and reject
`doubleJump` server-side when the player has no airborne jump available.

---

## B4 — Low: i-frame semantics keyed on float duration equality

`usesPlayerTiming` is decided by `Math.abs(actionDuration - timing.durationSeconds) < 1e-3`.
This couples a *semantic* decision (delayed vs immediate invulnerability) to
incidental numeric equality. `NPC_EVADE_PROFILES.swim.durationSeconds` is `0.5`,
which already equals `PLAYER_MOVEMENT_ACTION_TIMING.dodge.durationSeconds`; it
is only safe today because NPC evades are written with `action: "evade"` (0.75 s)
rather than `"dodge"`. A future NPC dodge action, or a profile retuned to 0.75 s,
would silently flip that creature to delayed i-frames.

**Recommendation.** Store the intent explicitly — an `actor_kind` on
`MovementState`, or a distinct action type for NPC evades — rather than
inferring it from duration.

---

## P4 — Low: double jump is the worst-value special move

Double jump costs **4** stamina — more than dodge (3) or evade (2) — from the
same life-critical bar, while granting no invulnerability, no distance
(`distanceMeters: 0`), and no control lock benefit. The doc correctly frames it
as "vertical mobility, not a damage escape", but pricing it as the most
expensive action in the set means the movement-expression option is also the
most punishing to use casually.

Given the bar does not regenerate with time and food is the only replenishment
path, this pushes players toward never using double jump outside required
traversal — which is the opposite of what a mobility verb should do.

**Recommendation.** Price double jump at or below dodge (1–2), or grant it a
small compensating benefit (brief airborne control, or landing-cancel into
attack).

---

## Cross-cutting note: `local_dev/` is production

`src/client/game/renderers/local_dev/harthmere_assets.ts` — 31,000+ lines,
containing production hit-stop, projectile dispatch, and boss presentation — is
imported by `src/client/game/renderers/renderers.ts:19`. Despite the directory
name it is **not** dev-only.

This is a live trap for exactly the kind of audit this document performs: a
reasonable reader greps for combat feedback, finds it only under `local_dev/`,
and concludes the feature does not ship. Recommend renaming the directory
(`renderers/harthmere/`) or, at minimum, a header comment in each file stating
it is on the production path.

---

## Suggested order of work

1. **B1** — one-line floor fix; restores the dodgeability contract the user
   explicitly asked for. Highest value per unit effort.
2. **P1** — generalize the existing buffer; largest improvement to how skilful
   the combat *feels*.
3. **D2** — decide the magic clock. This is a design decision, not a patch, and
   it blocks any honest balance pass on spells.
4. **P2 + D1** — swap the two stamina constants and fix the doc table together.
5. **D4** — add the fast-telegraph opt-out and the catalog assertion, so boss
   kits regain rhythm.
6. **B2, B3** — NPC evade fairness and identity resolution.
7. **D5, B4, B5, P4** — hardening and tuning.

## Verification not yet performed

This audit is static. The following should be confirmed in a rendered browser
session before acting on the design items:

- measured on-screen projectile flight time under realistic latency, to size the
  B1 fix (the static read predicts sub-frame flights, but the observed
  distribution determines whether 0.4 s is sufficient);
- whether the 2–10 s magic charge is reachable in practice for the player, or
  whether some other gate short-circuits it before release;
- felt reaction window on a 0.53 s night-hexer tell.

The existing batch is the right harness:

```bash
node scripts/harthmere/test-harthmere-combat-live-browser-batch.cjs
```

---

# Resolution (2026-08-03)

All twelve findings are addressed. Two were resolved as deliberate decisions
rather than code changes; the rest are implemented.

| ID | Resolution |
| -- | ---------- |
| B1 | Readability floor now applies on both branches of `harthmereProjectileFlightDurationSecs`. |
| D2 | Charge is presentation only. Release for players and NPCs uses `HARTHMERE_MAGIC_RELEASE_WINDUP_SECS`. |
| P1 | `HARTHMERE_ATTACK_INPUT_BUFFER_SECS` (0.18 s) buffers presses at the tail of attack commitment. |
| D4 | 40 dead cast times raised to their floors; 5 deliberate mixups opt in via `fastTelegraph`. Catalog test now rejects dishonest values. |
| P2 | **Decision: keep 3/2/4.** Recorded as a known balance tension in the combat doc rather than changed. |
| B2 | NPC evades now use the same delayed i-frame rule as players. |
| B3 | Evade descriptors are matched individually, type before label. |
| D1 | Stamina table corrected to 3/2/4. |
| D5 | `HARTHMERE_MINIMUM_ENEMY_TELL_SECS` (0.45 s) floors the tell; multipliers documented. |
| B5 | Server rejects a movement action while one is active. Residual gap documented. |
| B4 | Float-equality branch deleted along with B2. |
| P4 | **Decision: keep double jump at 4.** Recorded alongside P2. |

## How B2 and B4 were fixed together

Rather than adding an actor-kind field, `movementActionIsInvulnerable` now
derives the delay from a fixed proportion of the action's own duration
(`MOVEMENT_ACTION_INVULNERABILITY_START_RATIO`, 0.2).

Both authored player actions already sit exactly on that ratio — dodge
0.10/0.50 and evade 0.15/0.75 — so the change reproduces the documented player
windows precisely while giving NPC evades the same punishable opening. The
fragile float-equality branch disappears entirely, and no ECS schema change was
needed.

## Files changed

Source:

- `src/shared/harthmere/projectile_visual_manifest.ts` (B1)
- `src/shared/game/movement_actions.ts` (B2, B3, B4)
- `src/shared/npc/logic.ts` (B3)
- `src/shared/harthmere/magic_charge.ts` (D2)
- `src/shared/npc/behavior/chase_attack.ts` (D2, D5)
- `src/client/game/interact/item_types/attack_destroy_delegate_item_spec.ts` (D2, P1)
- `src/shared/harthmere/deliberate_combat.ts` (P1)
- `src/shared/harthmere/boss_attack_catalog.ts` (D4)
- `src/shared/harthmere/test/boss_attack_catalog.test.ts` (D4)
- `src/server/logic/events/handlers/movement_actions.ts` (B5)

Docs: `HARTHMERE_COMBAT_SYSTEM.md` (D1, D2, D4, D5, P1, P2, P4, B1, B2).

## Verification status

`tsc -p tsconfig.animacombat.json` passes clean. That project includes
`npc/logic.ts` and `behavior/chase_attack.ts`, so it transitively typechecks
`movement_actions.ts`, `magic_charge.ts`, `deliberate_combat.ts`, and
`projectile_visual_manifest.ts`.

A behavioural check of the new constants passed 23/23, confirming among other
things that the universal i-frame ratio reproduces both authored player windows
exactly, that a hypothetical 2.5x animation multiplier is floored to 0.45 s
while a short interval still keeps the damage branch reachable, and that no
below-floor boss cast times remain.

**Not yet run, and required before this is considered done:** the Mocha suites
and the client/server typechecks. Neither can execute in the audit sandbox —
`@swc/core` resolves to a macOS-native binding, and the client graph exceeds the
sandbox time budget. Run on the development machine:

```bash
NODE_OPTIONS=--max-old-space-size=8192 yarn tsc --noEmit --pretty false

node_modules/.bin/mocha --config .mocharc.fast.json \
  src/shared/game/test/movement_actions.test.ts \
  src/shared/harthmere/test/boss_attack_catalog.test.ts \
  src/client/components/challenges/harthmereDeliberateCombat.test.ts \
  src/shared/npc/behavior/test/chase_attack_logic.test.ts \
  src/shared/npc/behavior/test/harthmere_hex_ranged_attack.test.ts
```

Expect fallout in tests that assert the old behaviour, specifically:

- NPC evade tests asserting invulnerability from frame zero (B2);
- ranged-cast tests asserting `releaseTime === castTime + chargeTimeSecs` (D2);
- any test asserting a specific below-floor boss `castTimeSecs` (D4).

Those assertions encode the bugs and should be updated, not reverted.

The live browser batch remains the acceptance gate, and B1 in particular should
be confirmed visually under realistic latency:

```bash
node scripts/harthmere/test-harthmere-combat-live-browser-batch.cjs
```
