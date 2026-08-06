# Harthmere combat system

This document explains the current Harthmere combat rules for players,
designers, implementers, and testers. The central rule is simple: an attack is
not a button-down damage event. It is a committed timeline with a readable
windup, one authored contact frame, and a recovery window that an opponent can
punish.

## Player decision loop

Every close fight is built around five decisions:

1. read the opponent's tell and current spacing;
2. commit to an attack, reposition, dodge, or evade;
3. let the authored impact frame decide whether contact exists;
4. manage the survival stamina that dodge, evade, and double jump consume;
5. respect recovery before beginning the next full action.

Attacks reduce movement speed during commitment and cannot be cancelled into a
dodge or evade at button-down. Evade has a late attack buffer: attack input is
blocked during the roll, queued during landing, and allowed to take over during
recovery. This preserves a readable defensive animation while still rewarding
deliberate counterattacks.

Attack input is also buffered against attack commitment itself. A press landing
within `HARTHMERE_ATTACK_INPUT_BUFFER_SECS` (0.18 s) of the end of the current
attack is held and spent the moment recovery finishes. Committing the character
and discarding the player's input are different things: the swing stays
uncancellable and the recovery stays punishable, but a player who reads the
opening does not have to also guess the exact frame to press on. Presses earlier
than the buffer window are still dropped, so one input cannot queue an
exchange.

## Attack timelines

The shared timing source is
`src/shared/harthmere/deliberate_combat.ts`. Animation, weapon presentation,
damage, movement commitment, cooldown validation, and debug telemetry must use
the same values.

| Attack class | Windup | Contact frame | Recovery | Extra stamina cost | Movement scale |
| ------------ | -----: | ------------: | -------: | -----------------: | -------------: |
| Basic/light  | 135 ms |        160 ms |   458 ms |                  0 |           0.38 |
| Heavy        | 480 ms |        720 ms |   920 ms |                  0 |           0.18 |
| Ranged       | 340 ms |        520 ms |   680 ms |                  0 |           0.30 |
| Magic        | 460 ms |        700 ms |   860 ms |                  0 |           0.24 |

`Contact frame` is when the game re-reads the target and is allowed to publish
damage. `Recovery` is added after contact, so a basic attack remains committed
for 1.02 seconds and a heavy attack for 1.64 seconds. A visible swing that
misses still consumes its local commitment plus any authored mana, durability,
or cooldown budget; a target is never reserved as a future hit merely because
it was under the cursor when the button was pressed. Attacks do not spend
stamina.

## Weapon and tool identity

Native items are classified by authored metadata first and by conservative
name/category fallbacks second:

- unarmed attacks use the basic timeline and add no stamina cost;
- ordinary one-handed weapons and combat-capable tools use the basic timeline;
- bare-hand body contact reaches 1.75 units and uses a compact 0.48-unit swept
  hand radius;
- legacy held gathering tools reach 2.75 units;
- premium melee reach is the authored visible `targetLength` plus 2.25 units of
  arm/body extension, clamped to 2.8–4.5 units, so a great sword reaches farther
  than a one-handed sword;
- two-handed weapons, greatswords, mauls, and equivalent heavy tools use the
  heavy timeline, a wider swing arc, and the largest movement/recovery
  commitment;
- daggers have a shorter server cadence, while axes are slower than ordinary
  one-handed weapons;
- bows, crossbows, darts, thrown weapons, and energy weapons use the ranged
  timeline and server-authored range;
- staves, wands, tomes, scrolls, focuses, and spell items use the magic
  timeline, spend mana where authored, and use their projectile or attack-shape
  definition.

Tools with attack points can fight, but their damage, durability use, timing,
reach, and level requirements still come from the native item profile. Visual
weapon animation does not grant contact by itself.

## Contact and damage authority

Melee acquisition is body-aware rather than cursor-only. A valid combat lock or
direct cursor body remains first priority. If both miss, the client tests the
nearby native NPC ECS bodies against the horizontal hand/weapon sweep, using
each target's AABB at its smoothed rendered position when available. The
renderer registry contributes fresh visibility and position data, but is not
required for authority; a small native ECS spatial scan runs only on attack
input so a newly streamed body cannot become unhittable while its presentation
bridge catches up. A weapon passing through a Mucker's shoulder can therefore
connect even when the reticle is above or beside the body. The nearest
unobstructed body wins; bodies wholly behind the player, behind terrain,
outside the selected item's reach, dead, or protected are rejected. This is a
single-target melee fallback, not an area-of-effect damage multiplier, and it
adds no per-frame NPC scan.

Melee contact is evaluated at the animation's impact frame. The selected entity
identity is refreshed from ECS and its health, protection, and selected-item
reach are revalidated. If the target moved outside the hard body-distance
boundary, died, or became protected, the swing whiffs. Camera motion after the
press does not erase a contact already authored against that body.

Enemy directional melee also locks its facing arc when the windup begins. The
attacker may turn or move during later simulation frames, but that does not
rotate the already-committed hit cone onto a player who dodged behind it. The
impact frame checks the stored cast yaw, current target position, current
vertical overlap, and current line of sight. A player standing on the upper
body, shell, shoulder, or back of a giant is inside the giant's broad ECS AABB
but outside its feet-level directional strike volume, so ordinary melee must
miss. Explicitly telegraphed self-area, ground-area, cone, and projectile boss
attacks keep their authored shapes; the back exclusion is not a hidden immunity
to an area attack whose visible warning actually covers that space.

The server then validates the accepted native transaction again. It checks the
attacker, selected item, level requirement, mana, cooldown, range,
authoritative target body, damage profile, and replay identity before changing
native `Health`. NPC receipts are also rechecked against their committed facing
and the giant-back exclusion. Damage cannot be accepted merely because a client
played an animation or requested a large HP delta.

NPC melee uses a receipt containing the authored attack start, impact time,
distance, field of view, vertical reach, and damage. The player-health handler
rejects mismatched or replayed receipts. Large creatures keep their full ECS
size for combat and rendering even when a smaller locomotion footprint is used
to navigate terrain.

## Survival stamina and special movement

Harthmere has one life-critical stamina bar. It already declines gradually
during active play and can kill the player at zero. Dodge, evade, and double
jump subtract an immediate extra cost from that same bar, so repeated defensive
movement during a long battle can become deadly.

- the bar continuously declines during active gameplay;
- it does not regenerate with time, in combat or out of combat;
- while alive, food is the only replenishment path;
- dodge costs 3, evade costs 2, and double jump costs 4 from this bar;
- those values are named balance constants in
  `src/shared/harthmere/deliberate_combat.ts`, so all client/server consumers
  change together when combat balance is revised;
- ordinary walking, tool use, and attacks add no extra stamina cost;
- reaching zero enters the existing stamina-death path;
- respawn performs the existing full vital-state reset;
- the HUD's green stamina bar reads this same native survival value.

The server is authoritative for accepted hits and special movement actions.
It rejects a special move that costs more than the remaining stamina. Spending
the last available stamina can still leave the player at zero for the existing
survival scheduler to kill; ordinary actions do not create a second resource
pool or a hidden recharge path.

## Dodge, evade, and double jump

| Action      | Cost | Duration | Distance | Invulnerability | Cooldown | Purpose                                  |
| ----------- | ---: | -------: | -------: | --------------- | -------: | ---------------------------------------- |
| Dodge       |    3 |   0.50 s |   4.75 m | 0.10-0.28 s     |   0.85 s | Directional quick escape                 |
| Evade       |    2 |   0.75 s |   5.25 m | 0.15-0.40 s     |   1.15 s | Committed lateral roll and counter setup |
| Double jump |    4 |   0.50 s |      0 m | None            |   0.50 s | Vertical mobility, not a damage escape   |

Invulnerability is delayed; pressing the button after the strike already
reaches its active frame is too late. The server player-health handler reads
the replicated movement state and rejects attack damage only inside the
authored window. Evade is strictly lateral, chosen from current input, residual
lateral velocity, or the previous side. It must not silently become a forward
dash.

The delay is a fixed proportion of the action's own duration
(`MOVEMENT_ACTION_INVULNERABILITY_START_RATIO`, 20%), which reproduces the
authored player windows above and applies the same rule to NPC evades. An NPC
that dodges is therefore also punishable during its opening frames, so baiting a
creature's evade and catching it on the way in is a real option rather than a
guaranteed whiff.

Known balance tension, deliberately left as-is for now: evade costs less than
dodge while granting more invulnerability and more distance, so it dominates
dodge whenever the extra commitment is affordable. Double jump is the most
expensive of the three and grants nothing defensively. Both are accepted
trade-offs pending a balance pass, not oversights.

Desktop bindings are routed through configurable input actions. The legacy
Harthmere combat panel also exposes B for basic, H for heavy, and L for Spark;
those compatibility keys call the same attack timelines. Mobile uses the
directional double-tap movement route.

## Enemy melee pacing

An enemy must enter the shared brain and move through awareness/pursuit,
windup, impact validation, and recovery. A player hit never triggers an
immediate same-call-stack counterattack.

| Enemy class | Strike tell | Full interval |
| ----------- | ----------: | ------------: |
| Agile       |      0.56 s |        2.05 s |
| Ordinary    |      0.72 s |        2.40 s |
| Heavy       |      0.90 s |        2.85 s |
| Indisworm   |      0.95 s |        2.90 s |
| Boss        |      1.08 s |        3.15 s |
| Remote apex |      1.25 s |        3.50 s |

The interval includes the punishable opening after the strike. Slowing only the
cooldown is not enough: the tell must be long enough to read, and contact must
still be checked at the strike moment.

These are **base** values, not the numbers a player experiences. Runtime applies
several multipliers on top:

- creature level scaling compresses the interval, bounded by
  `minAttackIntervalMultiplier` (0.8) so cadence can never run away;
- horned variants use `max(0.8, interval * 0.7)` or `interval * 1.45`;
- night muckers and hexers scale the interval and multiply
  `attackAnimationMultiplier` by 1.35.

The animation multiplier shortens the tell, because the strike delay is the
authored strike moment divided by it. That is intentional and internally
consistent — the strike moment is deliberately left unscaled so the contact
frame stays aligned with the sped-up clip rather than being double-accelerated.
The tell is nonetheless floored at `HARTHMERE_MINIMUM_ENEMY_TELL_SECS` (0.45 s)
so no stack of multipliers can push an ordinary enemy below a readable window,
mirroring the protection bosses get from their shape telegraph floors.

### Aiming, evasion, and line of sight

- Windup publishes intent: animation, target, cast yaw, and the future impact
  time become observable together.
- Impact re-samples current range, vertical body overlap, committed facing, and
  terrain line of sight. Leaving any one of those volumes makes the attack miss.
- Dodge and evade protect only during their authored invulnerability window;
  pressing after impact is too late.
- Moving behind an attacker during windup is a valid positional defense because
  the hit cone does not snap to the attacker's last-frame orientation.
- Standing on a giant's back is not valid contact for feet-level directional
  melee. A visibly telegraphed area or projectile attack can still connect if
  its authored shape covers the player.
- The server consumes one receipt per accepted NPC impact, so replaying an old
  hit, changing its point, widening its cone, or substituting another target is
  rejected.

## Magic charge is presentation

Charge-up is a graphic, not a gate. `harthmereMagicChargeDurationSecs` returns
2-10 seconds scaled by spell power, and that value sizes the charge effect and
nothing else. Release timing for both players and NPCs comes from the one combat
clock: `HARTHMERE_MAGIC_RELEASE_WINDUP_SECS` (the authored 460 ms magic windup),
after which the attack exists and its authored shape telegraph owns the readable
window before impact.

This used to work the other way — the charge delayed release, so cast-to-impact
ran 3.1 to 11.35 seconds against an enemy cadence of 2.05-3.50 s, with no block
or parry posture to cover the commitment. Power scaled the one thing that made a
spell unusable. Consumers that want charge intensity should read
`harthmereMagicChargeIntensity()` and take their timing from the release window
supplied alongside it.

## Hexes and Indisworms

Hex fireballs use a 1.3-second telegraph and retain minimum/maximum range
checks, so the Hex should reposition rather than launch a point-blank
projectile. Its projectile identity, release time, aim point, hit radius, and
damage receipt are serialized through native NPC state.

Indisworm Poison Spit uses the same native ranged state and a 1.15-second
telegraph. As above, these telegraphs run after the shared magic windup; they
are not preceded by a multi-second charge.
Indisworms also use their deliberate 0.95-second melee tell and 2.9-second full
cadence. Their cavern positions remain authored encounter positions; combat
changes must not project them onto outdoor terrain or relocate them into an
unrelated building. Idle, walk, run, hit reaction, Poison Spit, melee, death,
and native-health mutation are covered by the focused rendered-browser audit.

## Bosses and giant traversal

All eleven live bosses have exactly five authoritative attacks. See
`HARTHMERE_BOSS_COMBAT_AND_ANIMATION.md` for the roster and attack matrix.
Boss telegraphs have shape-specific minimums: projectile and cone attacks are
at least 1.15 seconds, beams 1.10 seconds, self area attacks 1.20 seconds, and
ground area attacks 1.35 seconds.

An attack may opt out with `fastTelegraph: true` and is then held to
`HARTHMERE_BOSS_FAST_TELEGRAPH_SECS` (0.45 s) instead. This exists so a boss can
have more than one rhythm. Applying the shape floors uniformly put every attack
in a 1.15-1.35 s band, which made `vyrahel_tail_feint` — authored and lored as a
feint that punishes a premature dodge — telegraph exactly as slowly as the same
boss's committed breath attack. Five attacks that all read the same way are not
five attacks. Use the opt-out sparingly and only for deliberate mixups; the
floors remain the default and the catalog test rejects a below-floor cast time
that has not opted in.

Oversized bosses use finite-orientation guards and a compact terrain-navigation
core while retaining the full authored body/hit volume. On uneven ground they
must increase displacement, select Walk or Run, climb supported steps, remain
blocked by true cliffs, and never emit `NaN` position, orientation, or
velocity. Giant footstep audio is distance-driven while grounded locomotion is
active; idle, airborne, death, and teleport-sized moves reset the cadence.

## Escorts and allied combat movement

Escort schedulers assign intent in `npc_state.escort`; Anima owns the actual
follow movement, hill collision, grounding, finite orientation, and any combat
target permitted by the escort's policy. A live escort check must move the
leader, observe the companion's authoritative ECS position change, receive the
same position through Sync, and show Walk or Run in the rendered client. A test
that teleports the companion to the destination proves quest bookkeeping, not
escorting.

### Multiplayer retaliation and player escorts

A real negative `Health` damage event opens a bounded retaliation encounter.
The creature keeps the opener first, then distributes later exchanges across
eligible players within 18 metres (capped by the creature's disengage leash).
Authored group responders use their responder rank to spread across the same
participant list immediately; a solitary creature advances every six seconds.
An authored taunt remains an absolute target override.

Eligibility is intentionally narrow:

- players must be alive and outside peace mode. Once a real hit opens the
  bounded encounter, nearby players remain participants even on protected or
  clean terrain; safe zones still suppress proactive aggro before a hit;
- an NPC joins only when it opened the encounter or is actively attacking that
  creature, which includes combat-capable player escorts;
- unrelated escorts, civilians, quest givers, livestock, and monsters are not
  collateral targets;
- only the bounded 18-metre encounter is recruited; players outside it and
  unrelated NPCs remain uninvolved.

`SimulatedNpc.attack()` publishes `UpdatePlayerHealthEvent` for players and
`UpdateNpcHealthEvent` for NPC opponents. Logic accepts NPC-to-NPC damage only
when the attacking NPC owns the matching unresolved Anima melee or ranged
receipt; accepted receipt identities are kept in a short target-side replay
ledger. This lets Hex projectiles and ordinary melee damage escorts without
turning an NPC-authored damage number into client authority.

Jobs-board player escorts default to `defend_leader`: they do not initiate
proximity fights, but they defend themselves and their player. Explicit
`noncombatant` assignments remain noncombatant, and Chapter 1's authored
unkillable escorts still reject harmful health mutations even when they assist.

## Feedback and readability

The contact frame is shared by body animation, held-weapon animation, damage,
audio, and combat telemetry. Boss and spell attacks additionally expose their
telegraph/projectile graphic. The system records start and impact separately so
a HAR or browser report can distinguish a committed whiff from a networking
failure. Asset request counts are not attack counts because the browser caches
audio and GLB files.

### Projectiles must stay visible

A projectile the player cannot see is not a mechanic they can answer, so flight
time is floored at `HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS` (0.4 s) regardless of
which timing source is used.

This matters because the authoritative path supplies the impact time
_remaining_, measured against the client's clock when it observes the release.
Anima tick latency, `npc_state` serialization, and Sync replication have already
consumed part of the authored flight by then, so under load the remainder trends
toward zero. That branch previously clamped only to a frame epsilon, which meant
a laggy session drew the projectile for roughly one frame and then dealt damage
— the player got the least warning exactly when they needed the most. Damage is
resolved server-side from the receipt either way, so a visual that under-runs
its authoritative impact is an acceptable cosmetic desync; an invisible
projectile is not.

Note that `harthmereBossMagicPresentation` pulls the charge and projectile
origin toward the target when a large boss is close (`targetConstrained`), which
shortens the visible travel path. Close-range giant fights are therefore the
worst case for projectile readability and the right place to check it.

## Current boundaries

This pass establishes attack commitment, survival-resource pressure, movement
commitment, authoritative i-frames, precise impact-frame contact, enemy tells,
and recovery openings. A dedicated shield block/parry posture and a generalized
poise/hyper-armor meter are not part of this contract yet; they should be added
as explicit state machines rather than hidden random hit outcomes.

There is no separate server resource charge for swinging into empty air.
Empty-air swings are still locally committed through windup and recovery, while
mana, item durability, and authored cooldowns remain authoritative where the
selected attack defines them.

## Verification contract

Fast source tests prove timing, survival stamina, movement, receipt validation,
multiplayer retaliation, NPC-to-NPC escort damage, boss catalogs, and
Indisworm/Hex profiles. Rendered acceptance must use an exact-current client and
server bundle against the same native ECS world.

The browser batch is:

```bash
node scripts/harthmere/test-harthmere-combat-live-browser-batch.cjs
```

It runs the independent giant/hill, ordinary chase/melee, Anima escort, and
Indisworm slices serially, saves each child log/report, and does not stop at the
first failure. The batch is functional evidence, not a frame-rate benchmark.
Any app, Redis, or Anima OOM/restart invalidates that lane.
