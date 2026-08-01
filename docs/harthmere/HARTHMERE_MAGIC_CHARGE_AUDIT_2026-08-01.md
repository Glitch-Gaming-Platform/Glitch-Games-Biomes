# Harthmere Universal Magic Charge Audit — August 1, 2026

## Outcome

Universal magic charging is implemented across Native ECS/Anima NPC attacks,
native hotbar magic weapons, class abilities, and the local combat bridge.
Physical attacks remain immediate. Magic attacks now have a data-driven charge
between two and ten seconds, release only after the charge completes, and then
use their existing projectile/beam/area travel or telegraph time.

No new Blender export was required. The repository already contains the
authored `HarthmereBodyMagicChannel_Aligned_30` and
`HarthmereBodyMagicCast_Aligned_30` clips, and the charge effect reuses each
spell's premium authored projectile GLB as its gathering core.

## Shared timing contract

The authoritative constants live in
`src/shared/harthmere/magic_charge.ts`:

- minimum charge: `2` seconds;
- maximum charge: `10` seconds;
- balancing quantum: `0.25` seconds;
- damage ceiling: `150`;
- resource ceiling: `90`;
- cooldown ceiling: `180` seconds;
- beam, cone, and area spells receive small shape-power bonuses.

Power is the largest normalized damage, resource-cost, or cooldown score plus
the applicable shape bonus. Ultimate magic is clamped to the ten-second
maximum. Explicit physical/slashing/piercing/blunt attacks always return zero
charge even when their telegraph happens to reuse a magic-looking asset.

## Native ECS and Anima flow

The NPC state machine now records four distinct moments:

1. `castTime`: charge begins;
2. `releaseTime`: charge completes and the spell leaves the caster;
3. `impactTime`: projectile/shape resolution occurs;
4. `cooldownUntil`: the authored cooldown expires.

`chargeTimeSecs` and `releaseTime` serialize through private `npc_state` and
are projected through the sanitized public `npc_combat_state` fields needed by
the renderer. The server validates ranged damage receipts against
`releaseTime`, rejects forged pre-release receipts, retains duplicate replay
protection, and measures the 20-second ordinary-Hex Fireball cooldown from
release rather than from the beginning of the wind-up.

The renderer plays the looping magic-channel body clip during the charge,
switches to the release/attack animation at `releaseTime`, and only then emits
the existing projectile visual request.

## Monster and beast presentation

Monster charging is intentionally more visible than a plain humanoid hand
pose. The production projectile runtime builds a gathering effect from:

- an emissive octahedral core using the spell's primary color;
- the authored projectile GLB rotating inside the core;
- three contracting rune rings;
- 24 inward-orbiting voxel particles;
- a pulsing wireframe shell;
- a spell-colored point light that intensifies toward release.

The effect scales from the creature's body dimensions. Human-scale casters use
the baseline size; large beasts and bosses scale up to `3.5x`, keeping the
charge readable around broad torsos, horns, roots, or floating boss rigs.

## Player attack paths

- Native staff, wand, spellbook, scroll, crystal-focus, star-focus, and
  snowflake-focus hotbar attacks delay their Native ECS interaction until
  release.
- Offensive class spells consume their resource and start cooldown normally,
  then delay damage/projectile emission until release.
- Direct local-combat Spark calls use the same charge bridge, preventing debug,
  multiplayer, and alternate UI paths from bypassing the universal rule.
- The HUD converts charge start/release into the authored `magicChannel` and
  `magicCast` player emotes.

## Verification

### Unit and integration

- Shared/client focused batch: **41 passing**.
- Server/ECS authority batch: **54 passing**.
- All 55 live boss attacks cast, serialize, charge when magical, resolve their
  geometry, and preserve ability-specific damage receipts.
- Ordinary Hex Fireball covers charging, in-flight, hit, miss, exact
  20-second cooldown, and private-state round trip.
- Server tests reject a Fireball receipt carrying the charge-start timestamp,
  accept the release timestamp once, and reject replay.
- Focused stack typecheck: pass.
- Client renderer typecheck: pass.
- Premium projectile validator: **29 authored GLBs pass**.

### Exact production build

- Build ID: `magic-charge-final-20260801`.
- Web: `http://127.0.0.1:3097/at` returned HTTP 200.
- Sync: `127.0.0.1:4997` reachable.
- Redis: host port `6412` remained running.
- App container: `biomes-boss-audit-final-20260731`, restart count `0`, not
  OOM-killed.
- Current-artifact assertion: pass.

The first client build was deliberately rejected after another task disclosed
that it had moved `.next` while the compiler was running. That output is
quarantined under
`artifacts/harthmere-magic-charge-final-20260801/next-mixed-after-concurrent-swap`.
One exclusive replacement Next build produced the accepted build above. The
already-current matching server webpack output was preserved; no additional
source change occurred between the server bundle and accepted Next build.

### Live Native ECS/Anima Hex Fireball

The accepted disposable Hex run used player `560236630258162` and NPC
`8999997000000902`:

- charge: exactly `5.25` seconds;
- projectile flight: exactly `1.0` second;
- cooldown: exactly `20.0` seconds from release;
- result: hit;
- health: `100 -> 31`, exactly `69` authoritative damage;
- pending and hit records share one cast timestamp;
- cleanup restored the player and deleted the disposable NPC without error.

Authority evidence:
`artifacts/harthmere-magic-charge-final-20260801/real-hex-fireball-hit.json`.

### Live browser/WebGL

The production audit panel reported `Loaded 30/30`, `Failed 0`, and
`Fallbacks: none` throughout the accepted checks.

- The two-second Spark control showed one active charge, then one release, one
  projectile spawn, and one impact.
- The ten-second Meteor control remained active long enough to visibly show the
  gathering rune/light effect and then released successfully.
- The accepted real Hex cast changed browser counters from charge
  `Started 1 / Released 1` to `Started 2 / Released 2` and projectile
  `Spawned 1 / Impacts 1` to `Spawned 2 / Impacts 2`, while the authority run
  recorded the matching 69-damage hit.
- The final browser state after additional visual iterations was
  `Started 4 / Released 4`, `Spawned 5 / Impacts 5`, `Loaded 30/30`,
  `Failed 0`, and `Fallbacks: none`.

Visual evidence:

- `artifacts/harthmere-magic-charge-final-20260801/minimum-spark-charge-live.png`
- `artifacts/harthmere-magic-charge-final-20260801/maximum-meteor-charge-live.png`
- `artifacts/harthmere-magic-charge-final-20260801/real-hex-before-charge.png`
- `artifacts/harthmere-magic-charge-final-20260801/browser-final-state.png`

The in-app Chromium session could not acquire Pointer Lock, so its center
`Enter Game` overlay remained in the screenshots. The renderer counters,
visible Hex body, visible gathering ring, WebGL scene, and authoritative cast
remain valid; the overlay limitation is not disguised as a product result.
Existing unrelated navigation-aid, legacy FBX n-gon, and mixed-material log
noise was also present and is unchanged by this work.
