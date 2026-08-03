# Why combat effects were invisible — capture analysis and fix

Date: 2026-08-03
Evidence: `battle.log` and `battle.har` from a live session fighting a Hex and
the Muck-Scarred Helix.

## The short version

Effects were spawning correctly. The assets loaded, the sounds fired, the
projectile and telegraph GLBs were requested and returned. Nothing in the
combat logic was failing.

The session ran at **14 FPS**, and at 14 FPS a frame is 71 ms. Every combat
visual completes on `elapsed / duration >= 1` using wall-clock time, so any
effect whose duration is shorter than a single frame reaches completion on its
**first** update and is destroyed before it has been drawn a meaningful number
of times. The effect genuinely happened; it was never on screen long enough to
see.

That is why the symptom covered everything at once — projectiles, impacts,
telegraphs, charge-up. They share one lifecycle rule.

## What the capture proves

**The pipeline works.** From the HAR, during a fight with a Hex and a boss:

| Asset | Status |
| ----- | ------ |
| `glb/projectiles/fireball.glb` | 304 |
| `glb/projectiles/entangling_roots.glb` | 200 |
| `glb/boss_attack_shapes/self_aoe.glb` | 304 |
| `glb/boss_attack_shapes/ground_aoe.glb` | 200 |
| `audio/sfx/giant_boss_stomp.webm` | 304 |
| `audio/sfx/fireball_launch.webm` | 304 |
| `audio/sfx/creature_wilds_pack_hex_attack.webm` | 304 |
| `audio/sfx/dodge_roll.webm` | 304 |

582 requests total, 510 of them 200 and 15 304. No 404s, no failed asset loads.
The only error status in the whole capture is a single `409` on
`/api/glitch/harthmere`, which is a save-conflict unrelated to rendering.

Note the boss doc's own warning applies here: request counts are not effect
counts, because the browser caches GLB and audio. A 304 means the effect fired
at least once, not once total.

**The frame rate is the problem.** From `battle.log`:

```
Aegis Engine Report [warning]: Low FPS Detected: 14
[Violation] 'requestAnimationFrame' handler took <N>ms   (x7)
```

**And the client is pinned to the lowest graphics tier:**

```
GPU Tier Info is {"gpu":"glitch-local-assets","isMobile":false,"tier":1,"type":"FALLBACK"}
```

Zero GPU benchmark requests appear in the HAR because `genGPUTier()`
(`client_config.ts:379`) returns a hardcoded tier-1 fallback whenever
`NEXT_PUBLIC_GLITCH_LOCAL_ASSETS=1`, deliberately, to avoid a CORS-blocked
benchmark fetch from `storage.googleapis.com`.

Tier 1 is not a small penalty. From `graphics_settings.ts`:

- `renderScale` **0.5** — the frame is rendered at quarter area, so a thin
  projectile covers a quarter of the pixels it otherwise would;
- `entityDrawLimit` **15** (`ENTITY_DRAW_LIMITS.low`);
- bloom, SMAA and SSAO all off — and bloom is precisely what makes an emissive
  projectile or charge read against a dark cavern.

## The fix

`harthmere_projectiles.ts` now holds every combat visual for a minimum number
of **rendered frames** rather than only a minimum number of seconds:

```ts
const MIN_VISIBLE_FRAMES = 3;

const holdForVisibility = <T extends { framesRendered: number }>(
  visual: T,
  progress: number
) => {
  visual.framesRendered += 1;
  return progress >= 1 && visual.framesRendered >= MIN_VISIBLE_FRAMES;
};
```

Applied to all four lifecycles — magic charges, projectiles, attack-shape
telegraphs, and impacts (both `BasicImpact` and `MagicImpact`). There are no
remaining bare `progress >= 1` completion checks in the update loop.

Why frames rather than seconds: a seconds-based floor has to guess the frame
rate. A frame-based floor is correct at any frame rate by construction. At
60 FPS three frames is ~50 ms and changes nothing, because these effects are
already longer than that. At 14 FPS it is ~214 ms, which is the difference
between a visible telegraph and nothing at all.

This composes with the earlier B1 fix
(`HARTHMERE_PROJECTILE_MIN_FLIGHT_SECS` applied on the authoritative path).
B1 stops the *flight duration* from collapsing to 4 ms; this stops any visual
from being *culled before it is drawn*. Both are needed: B1 alone still yields a
0.4 s flight that at 14 FPS is only 5-6 frames, and impacts/charges were never
covered by B1 at all.

**Important:** the captured session predates B1. Neither fix has been built or
deployed, so this capture reflects the un-fixed client.

## What was already correct, and should not be "fixed"

- **Impacts already fire on a miss.** `finishProjectile()` calls
  `addResolvedImpact()` unconditionally; `result` only selects which *sound*
  plays (a missed arrow gets `arrow_impact_hard`). No change needed.
- **Wall-clock timeline progression is deliberate.** The comment in `update()`
  explains that capping timeline `dt` made a one-second Fireball take twenty
  seconds at 1 FPS while authoritative damage still landed after one second.
  The `safeDt` cap is correctly limited to mixer and particle integration. The
  frame floor added here does not disturb that: it delays *destruction*, not
  progression.
- **Melee body animation is not frame-starved.** Player attacks commit for
  1.02-1.64 s and enemy tells run 0.45-1.25 s, all far longer than a frame even
  at 14 FPS.

## Recommended follow-ups

1. **Fix the frame rate, which is the actual environment defect.** 14 FPS makes
   every timing-based system fragile, not just VFX.
2. **Revisit the tier-1 hardcode.** Every Glitch player currently gets
   `renderScale 0.5`, a 15-entity draw limit and no bloom regardless of their
   hardware. The repo ships local benchmark data at
   `public/assets/glitch/gpu-benchmarks/2023-06-16_cc4f7417/`, but it contains
   only `d-apple.json`, so pointing `detect-gpu` at it would classify Apple GPUs
   and no one else. Either complete that local benchmark set and serve it
   same-origin, or raise the fallback tier — but do not simply repoint the URL
   at the incomplete data.
3. **Consider bloom at tier 1 specifically for emissive combat VFX.** It is the
   cheapest single change that would make projectiles and charges read, and the
   projectile manifest already carries `lightIntensity` per projectile that
   currently drives nothing.

## Verification

Static checks on the change: all five visual types carry `framesRendered`, all
five construction sites initialise it to 0, four `holdForVisibility` call sites
cover charges/projectiles/shapes/impacts, and zero bare `progress >= 1`
completion checks remain.

The client typecheck did not complete in the audit sandbox (it exceeds the time
budget there). Run before shipping:

```bash
NODE_OPTIONS=--max-old-space-size=8192 yarn tsc --noEmit --pretty false
```

To confirm the fix in a live session, re-capture at a low frame rate and check
that projectiles remain on screen across multiple frames. The existing batch is
the right harness:

```bash
node scripts/harthmere/test-harthmere-combat-live-browser-batch.cjs
```
