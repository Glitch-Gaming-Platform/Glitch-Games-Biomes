# Harthmere boss combat and animation

This document is the runtime contract for the eleven live Harthmere bosses.
Every boss has exactly five authoritative attacks, at least one magical attack,
an exported body animation for each attack, and a shape-correct telegraph or
projectile graphic. The release gate also requires every attack to pass through
the server player-health handler as an accepted native ECS damage receipt.

## Live boss roster and attacks

| Boss | Five attacks |
| --- | --- |
| Muck-Scarred Helix | Maul Crush; Siphon Volley; Helix Pulse; Spore Cast; Breach Rupture |
| The Gilded Bull | Sun Court Charge; Pillar Crash; Sun-Core Beam; Hoof Quake; Core Rupture |
| The Ninth Winter | Roofbeam Sweep; Failed-Dawn Shard; Blizzard; Same Day Again; The Year Breaks |
| The Failed Apprentice | Bell-Fist; Shard Cast; Failed Ward; Wrong Note; Last Lesson |
| The First Choir | Crone's Rebuke; Stonemason's Toll; Apprentice's False Note; Threefold Canon; Harmony Break |
| The Echo-Singer | Copy Melee; Copy Ranged; Copy Magic; Echo Delay; Resonance Overload |
| Vyrahel, the Vein-Keeper | Tail Feint; Vein Breath; Wing Burst; Burrow Rush; Crystal Guard Shatter |
| Thaedryn the Bellbound | Sleeper Sweep; Sound Cloud; River-Force Breath; Cathedral Wing Gust; Vein Call |
| Hex Wraith | Hex Volley; Grave-Violet Beam; Lantern-Rib Pulse; Tablet Prison; Phase Scythe |
| Alpha Mucker | Branch Slam; Seed Barrage; Road Uproot; Root Cage; Muckheart Pulse |
| The Root-Crowned Dead | Root Eruption; Crown Sweep; Grave Sap; Crown-Seed Barrage; Rootling Swarm |

The authoritative definitions live in
`src/shared/harthmere/boss_attack_catalog.ts`. Attack geometry is one of
`projectile`, `beam`, `cone`, `ground_aoe`, or `self_aoe`. Anima selects and
serializes casts into native `npc_state`; server event handlers validate the
ability identity, reach, and damage before changing player health. Gaia-backed
terrain collision and line of sight are used by the projectile and shape
resolvers.

## Entity identity

Boss combat must resolve from the concrete entity, not only from its visible
label. This matters for older production actors whose labels cannot be safely
renamed. In particular:

- entity `8810000000019509` is Alpha Mucker even when its label is
  `Old Wood Mucker 1`;
- entity `8810000000019543` is Hex Wraith even when its label is
  `Gravewood Pale Hexer 7`.

Client animation, Anima chase/attack selection, player-damage validation,
incoming boss damage/progression, and boss GLB selection all use the same
entity-aware profile lookup.

## Animation contract

Boss GLBs use Blender-style dotted bone names such as `Branch.L`, `RootLeg.L`,
and `Leg.FL`. Animation track pruning must parse track names with Three.js
`PropertyBinding.parseTrackName`; splitting at the first period discards these
tracks and produces a visually static boss even though the GLB contains valid
keyframes.

Boss-only special clips are loaded lazily from the selected GLB. They are not
registered globally for every NPC. While a special attack is active it owns the
body pose; locomotion and generic attack actions are muted until the one-shot
finishes.

The browser visual audit uses the same `AnimationSystem` track pruning as the
game and independently measures body pixels before attack graphics are added.
It then loads the real projectile or attack-shape GLB and also spawns the same
attack through `HarthmereProjectileVisualRuntime`, the production projectile
renderer. A state passes only when the body pose changes, the direct GLB is
visible, and the production runtime produces visible pixels using the loaded
asset instead of its loading fallback.

## Giant footsteps

Grounded giant bosses use the generated positional sound
`/assets/harthmere/audio/sfx/giant_boss_stomp.webm`. The sound is driven by
horizontal distance traveled while walk/run animation weight is active, rather
than by a blind timer. Idle, death, hovering bosses, and teleport-sized position
jumps reset the cadence. Current stomp-enabled bosses are Muck-Scarred Helix,
The Gilded Bull, The Ninth Winter, Alpha Mucker, and The Root-Crowned Dead.

## Focused verification

Follow `TESTING_FASTER.md`: use the fast Mocha config and run tests serially.

```bash
node_modules/.bin/mocha --config .mocharc.fast.json \
  src/client/game/util/test/animation_system.test.ts \
  src/shared/harthmere/test/boss_attack_catalog.test.ts \
  src/shared/harthmere/test/boss_footsteps.test.ts \
  src/shared/harthmere/test/sound_effect_manifest.test.ts \
  src/shared/npc/behavior/test/harthmere_hex_ranged_attack.test.ts
```

The attack behavior test casts all 55 attacks through Anima's real ranged
state machine, round-trips the cast through native `npc_state`, resolves the
shape against a player target, and checks the damage receipt's ability ID.
The server integration test publishes all 55 corresponding
`UpdatePlayerHealthEvent` receipts through Logic and requires authoritative
native player health to decrease. It immediately replays every receipt and
requires the replay ledger to reject the duplicate.

Run the server receipt matrix with the required server/Bikkie bootstrap:

```bash
MOCHA_TEST=1 npx ts-mocha --no-config \
  --require ts-node/register/transpile-only \
  --require tsconfig-paths/register \
  --project tsconfig.json \
  --require src/server/test/global_setup.ts \
  --timeout 60000 \
  src/server/logic/test/harthmere_npc_hit.test.ts \
  --grep 'all 55 live boss attacks'
```

For live WebGL proof, start
`node scripts/harthmere/serve-boss-animation-visual-audit.cjs`, capture each
`boss` and `state` query through the browser, and validate the resulting local
evidence with:

```bash
node scripts/harthmere/validate-boss-animation-visual-audit.cjs
```

The July 31, 2026 run produced 66 passing screenshots under
`artifacts/harthmere-boss-animation-visual-audit/`: eleven walk cycles and all
55 attacks. The minimum measured body change was 0.37%, the minimum direct GLB
visibility was 2.45%, and the minimum production-renderer visibility was 0.19%.

For a live browser pass, use the production-shaped native ECS stack described
in `NATIVE_ECS_END_TO_END_TESTING.md`, with Anima and Gaia ready. Observe each
boss long enough to cycle all five attacks and confirm:

1. walk/run produces visible limb motion;
2. grounded giant strides produce positional stomps;
3. every telegraph is visible for the catalog minimum duration;
4. staying inside the final attack shape changes native player health;
5. leaving the telegraph before impact produces a miss;
6. the browser animation audit reports the selected special clip and attack
   ability rather than only a generic retaliation animation.
