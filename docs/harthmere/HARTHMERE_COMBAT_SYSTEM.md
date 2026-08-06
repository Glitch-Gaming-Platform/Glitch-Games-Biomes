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

Attack input is also buffered against attack commitment itself. The first real
follow-up press during commitment is retained, including its selected target
and light/heavy intent. `HARTHMERE_ATTACK_INPUT_BUFFER_SECS` provides a 0.5 s
post-readiness grace for a slow render/input tick; it is not a second attack
delay. A melee combo spends that press on the current contact clock, while a
non-combo action waits for commitment/recovery to finish. Committing the
character and discarding the player's input are different things: the swing
stays uncancellable and the recovery stays punishable, but a player who reads
the opening does not have to guess one exact render frame. Repeated presses do
not replace the retained target or queue an unbounded exchange.

## Attack timelines

The shared timing source is
`src/shared/harthmere/deliberate_combat.ts`. Animation, weapon presentation,
damage, movement commitment, cooldown validation, and debug telemetry must use
the same values.

| Attack class | Windup | Contact frame | Recovery | Extra stamina cost | Movement scale |
| ------------ | -----: | ------------: | -------: | -----------------: | -------------: |
| Basic/light  | 135 ms |        250 ms |   458 ms |                  0 |           0.38 |
| Heavy        | 229 ms |        417 ms |   666 ms |                  0 |           0.18 |
| Ranged       | 340 ms |        520 ms |   680 ms |                  0 |           0.30 |
| Magic        | 460 ms |        700 ms |   860 ms |                  0 |           0.24 |

`Contact frame` is when the game re-reads the target and is allowed to publish
damage. The melee values are frame-authored at 24 fps: light contact is frame 6
(0.250 s) with a frame-17 endpoint (0.708 s), and heavy contact is frame 10
(0.417 s after millisecond rounding) with a frame-26 endpoint (1.083 s).
`Recovery` is added after contact. A visible swing that
misses still consumes its local commitment plus any authored mana, durability,
or cooldown budget; a target is never reserved as a future hit merely because
it was under the cursor when the button was pressed. Attacks do not spend
stamina.

### Four-hit melee combo animation contract

Combat-targeted light and heavy attacks share one four-hit chain. The chain is
presentation-aware but remains damage-authority neutral: the server still
derives item, range, cadence, and damage, while the client selects one authored
body animation for the accepted combo step.

Each chain consumes all four variation indices exactly once, including mixed
light/heavy input. A chain may rotate its opening direction between exchanges,
but within one exchange the visible clip and emote pair must be unique:

| Combo step | Required weapon path | Light animation | Heavy animation  |
| ---------- | -------------------- | --------------- | ---------------- |
| Opener     | left to right        | quick crosscut  | power sweep      |
| Return     | right to left        | forehand return | power return     |
| Power      | overhead to low      | overhead cleave | overhead crusher |
| Finisher   | low to high          | rising cut      | rising finisher  |

The path belongs to the combo step, not to the light/heavy input. A mixed
combo therefore cannot accidentally repeat a trajectory: step one always
crosses left-to-right, step two reverses it, step three drops vertically from
overhead, and step four rises from a low guard. Light and heavy clips change
commitment, reach, and follow-through inside that path family while preserving
the four-step visual grammar.

A buffered follow-up becomes eligible on the current attack's gameplay contact
clock—250 ms for light and 417 ms for heavy—never on a separate earlier or later
combo timer. The outgoing contact pose eases into the next variation while a
stopped chain continues through follow-through and recovery. Ranged attacks,
magic releases, mining, and empty exploration swings do not consume this
four-hit melee budget.

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

Native non-boss creature bodies receive a 0.18 m horizontal melee-contact
allowance. It expands only the client/server combat target AABB for Muckers,
Hexes, eligible livestock, and other hostile/retaliating creatures. It does not
change physics collision, vertical reach, authored weapon reach, bosses, or
player-like NPCs. This makes a visible blade/fist brushing the creature's outer
body count without enabling attacks through floors or distant targets.

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
- hostile creature pursuit retains the earlier 30% slowdown and applies the
  August 6 follow-up 10% reduction cumulatively (`0.7 * 0.9 = 0.63` of the
  previously boosted speed). The pursuit cap and minimum effective speed use
  the same factor so fast or slow creature classes cannot bypass it.

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
- Night Mucker/Hex pressure no longer widens ordinary melee to 175 degrees.
  Non-boss creature melee is capped at 125 degrees around the committed cast
  yaw, so circling to the rear is consistently defensive in daytime and at
  night.
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

Confirmed player melee damage also spawns one compact, text-free white-gold
contact spark on the attacker-facing surface of the target's upper body. Its
bright core and short radial streaks expand and fade for exactly 0.2 seconds.
The spark is driven by the replicated health mutation plus the attacker's
active `attack1`/`attack2` emote, so an animation contact, whiff, ranged release,
magic cast, heal, fire tick, or environmental damage cannot display it. NPC and
remote-player targets share the same cue.

That same confirmed contact emits one 0.15-second positional impact sound. A
bare-handed hit uses a dry slap, a held tool uses a compact axe-on-wood chop,
and a held weapon uses a bright high-pitched metal clink. Classification uses
the item captured on the attack emote before falling back to the current
selected item, so changing equipment after commitment cannot change the sound
of an already-authored hit. Desktop and capable Android browsers use normalized
mono Opus; iOS/mobile WebKit uses the generated AAC-LC `.m4a` variant.

### Creature and boss stun/stagger presentation

Eligible non-boss Muckers, Hexers, and huntable wildlife select a distinct
full-body clip for each native poise reaction:

| Reaction | Authored length | Visual behavior                                                       |
| -------- | --------------: | --------------------------------------------------------------------- |
| Light    |       10 frames | sharp recoil and immediate balance recovery                           |
| Medium   |       23 frames | larger body turn, foot/limb brace, and delayed settle                 |
| Heavy    |       52 frames | full balance loss, secondary-part lag, brace, and controlled recovery |

The animation family is rig-aware. Muckers use head/body counter-rotation and
leg bracing; Hexers drop their hands while the lantern and cloak strips lag;
cows and sheep redistribute all four legs; rabbits fold the body while ears,
tail, feet, and hind legs react independently. Assets without these authored
clips retain `HitReact` as a compatibility fallback. All eleven live bosses now
participate in the same authoritative poise-break state machine with a larger
boss poise pool. A break cancels pending melee contact, interrupts an unreleased
ranged or magical cast, ends an active evade, stops AI-authored movement, and
holds the boss disabled until the replicated stagger window expires. Bosses use
their rig-specific `BossStaggerLight`, `BossStaggerMedium`, or
`BossStaggerHeavy` clip. Boss-only recovery extends each authored clip by two
seconds, producing 2.58-second light, 3.25-second medium, and 4.42-second heavy
disable windows. Longer post-stagger immunity prevents coordinated players from
permanently locking a boss. Indisworm retains its polished bespoke `HitReact`
because it is not one of the eleven boss profiles.

### Projectiles must stay visible

A projectile the player cannot see is not a mechanic they can answer, so flight
time is floored at `HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS` (0.4 s) regardless of
which timing source is used.

Projectile audio follows the same visible lifecycle without replacing true
lifecycle sounds that already exist. Arrows, bolts, and darts layer their
existing flyby whoosh over the flight interval. Every magical, elemental,
energy, Hex, mark, and boss projectile instead has a newly authored in-flight
sound that is distinct from its cast/release sound. Contact keeps the existing
short projectile-specific impact, while a separately authored explosion layer
is time-fit to the actual magic explosion duration and linearly fades during
its final portion so it ends with the visible particles and light. Boss attacks
that reuse a physical or energy projectile mesh resolve the flight and
explosion layers from their authoritative magic damage family, preventing a
nature, sonic, or arcane attack from inheriting an arrow or energy-beam
lifecycle merely because it shares a visual mesh. The explosion asset is
prefetched when visible flight begins so a cold production CDN/decode cannot
push first-use audio behind the impact. Explosion playback also uses a bounded
7-metre reference distance and gentler positional falloff; ordinary contact
ticks retain the tighter default profile.

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
ordinary-creature poise reactions, and recovery openings. A dedicated shield
block/parry posture and generalized boss/player hyper-armor are not part of
this contract yet; they should be added as explicit state machines rather than
hidden random hit outcomes.

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
