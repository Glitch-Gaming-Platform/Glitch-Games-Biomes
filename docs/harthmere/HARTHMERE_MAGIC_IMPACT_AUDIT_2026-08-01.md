# Harthmere Universal Magic Impact Audit — August 1, 2026

## Outcome

Successful magic attacks now end in one universal, data-driven impact effect
instead of the lightweight projectile puff. The effect is wired at the shared
projectile/attack-shape resolution boundary, so the same presentation applies
to player spells, ordinary monsters such as Hexes, live bosses, beams, cones,
ground areas, and direct projectiles after Native ECS/Anima reports a hit.

Misses, dodges, evades, and out-of-range resolutions do not create a magic
explosion. Physical and light-energy ammunition retain their lower-cost impact
path. No gameplay damage, hit selection, cooldown, or authority rule was moved
into the renderer.

No new Blender asset was required. The projectile catalogue already provides
the authored spell meshes and school palettes. The impact is intentionally a
procedural, instanced voxel effect so it can inherit every spell's direction,
radius, damage power, and colors without multiplying GLB files or draw calls.

## Shared effect contract

The balancing and performance constants live in
`src/shared/harthmere/magic_impact.ts` under version
`harthmere-aaa-magic-impact-v1`.

- Total effect duration is bounded from `0.95` to `1.8` seconds.
- The white contact flash lasts `0.08` seconds.
- Each explosion contains an expanding emissive core and wire shell, two to
  four shockwave rings, directional voxel debris, elongated sparks, lingering
  school-colored mist, low ground dust, and a decaying point light.
- Debris, sparks, mist, and dust use one instanced mesh per category.
- Per-impact ceilings are 28 debris pieces, 30 sparks, 12 mist particles, and
  12 dust particles.
- The renderer retains at most 12 simultaneous magic explosions and 28 total
  impacts, preventing spell-heavy encounters from growing without bound.
- Radius, light, duration, particle count, particle speed, and camera feedback
  scale with authored radius and final damage, but remain inside the shared
  ceilings.

Fire, lightning, holy, dark, hex, gravity, nature, sonic, mark, arcane, and
boss families have deliberately different silhouettes. For example, fire has
more upward sparks, lightning has the fastest and densest sparks, nature has
more ground dust, gravity has four heavy rings, and boss magic reaches the
largest bounded budget.

## Runtime wiring

`HarthmereProjectileVisualRuntime.addResolvedImpact` is now the single visual
resolution path for projectiles and authored attack shapes. It asks the shared
profile whether the resolved attack was a successful magic hit. A qualifying
hit creates the layered magic explosion; every other result uses the existing
basic impact.

The runtime propagates attack direction, target ground point, impact radius,
and final damage into the effect. A throttled, distance-falloff camera impulse
is emitted through `HarthmereMagicImpactFeedback`; the 70 ms throttle prevents
one area spell hitting several targets from stacking an excessive shake.

The query-gated visual audit panel reports:

- runtime marker `premium-clean-room-v4-aaa-magic-impacts`;
- impact profile version;
- total magic explosions;
- currently active magic explosions;
- loaded, failed, fallback, projectile spawn, and impact counts.

The implementation is presentation-only on the client. Native ECS and Anima
remain authoritative for cast, target, geometry, result, damage, and cooldown.

## Verification

### Unit, integration, and authority

- Shared/client focused batch: **21 passing**.
- Native Anima/server authority batch: **35 passing**.
- Every magic projectile definition produces a bounded layered profile on a
  successful hit.
- Miss, dodge, evade, out-of-range, physical, and light-energy cases are
  rejected from the expensive explosion path.
- School silhouettes differ while all particle counts and lifetimes remain
  inside the exported limits.
- Ordinary Hex Fireball still covers hit, miss, serialized Native ECS state,
  exact 20-second cooldown, and server-authoritative damage.
- All 55 live boss attacks still traverse the real behavior state machine,
  resolve projectile/beam/cone/ground/self-AOE geometry, and preserve their
  ability-specific damage receipts and replay rejection.
- Focused client renderer typecheck: pass.
- Premium projectile validator: **29 authored projectile GLBs pass**.
- Boss attack-shape validator: **4 authored GLBs pass**.
- Changed-file whitespace check: pass.

### Exact production build

- Build ID: `harthmere-aaa-magic-impact-final-20260801`.
- Web: `http://127.0.0.1:3097/at` returned HTTP 200.
- Sync: `127.0.0.1:4997` reachable.
- Redis: host port `6412` remained running.
- App container: `biomes-boss-audit-final-20260731`, restart count `0`, not
  OOM-killed.
- Current-build artifact assertion: pass.
- The accepted Next client and server page bundles both contain the v1 impact
  marker; the separate gameplay server bundle remains current by the artifact
  assertion and does not package this client-only renderer.

The source batch was completed before building. One Next build and one matching
server webpack build produced the accepted artifact set; the browser campaign
did not rebuild or clean `.next` or `dist`.

### Live browser/WebGL hit and miss batches

The exact production browser loaded all `30/30` projectile/shape assets with
`Failed 0` and `Fallbacks: none`.

The gravity/fire/lightning/holy hit batch showed the active spell set
`singularity_lance_beam`, `fireball`, `meteor`, `lightning_bolt`, `holy_light`,
and `smite`. Early captures recorded four, then ten simultaneous layered magic
explosions; the completed batched pass reached 54 successful magic impacts.

A clean miss batch then resolved 54 projectiles and 54 basic impacts while the
AAA counter remained exactly `0 total / 0 active`. This proves a visible miss
does not incorrectly explode at its endpoint.

Evidence:

- `artifacts/harthmere-magic-impact-final-20260801/02-magic-impact-shockwave-and-debris.png`
- `artifacts/harthmere-magic-impact-final-20260801/03-magic-impact-lingering-mist.png`
- `artifacts/harthmere-magic-impact-final-20260801/14-magic-miss-no-explosion.png`
- `artifacts/harthmere-magic-impact-final-20260801/16-magic-hit-sequence-full.png`

### Live Native ECS/Anima Hex Fireball

The accepted authority run used player `4376461056297148` and disposable Hex
`8999997000001008`:

- cast start: `1785589665.539`;
- charge: exactly `5.25` seconds;
- release: `1785589670.789`;
- projectile impact: `1785589671.789`, exactly `1.0` second after release;
- cooldown: exactly `20.0` seconds from release;
- result: hit;
- health: `100 -> 31`, exactly `69` authoritative damage;
- pending and hit records share the same cast timestamp;
- cleanup restored the player and deleted the disposable entities.

The browser's real-cast pass advanced the magic explosion counter by exactly
one for the matching Fireball impact.

Authority evidence:
`artifacts/harthmere-magic-impact-final-20260801/real-hex-fireball-impact-timed.json`.

The timed fixture was deliberately left alive for 15 seconds after the magic
hit while collecting evidence. That was long enough for a later melee strike
to reduce the remaining 31 health to zero and briefly expose an unrelated
post-death React page error. The report records both receipts. It is not
attributed to the Fireball impact renderer; cleanup restored the player, a
fresh page remained stable, and the container never restarted.

## Gaia boundary

This focused exact-source stack has Gaia disabled. The new effect does not
mutate terrain and needs no Gaia authority: collision and hit/miss geometry are
resolved by the existing Native ECS/Anima combat path, while the client renders
the returned endpoint. Terrain destruction would require a separate
Gaia-enabled gameplay feature and was not added or implied here.

## Evidence directory

All screenshots, contact sheets, and machine-readable real-Hex reports are in
`artifacts/harthmere-magic-impact-final-20260801/`.
