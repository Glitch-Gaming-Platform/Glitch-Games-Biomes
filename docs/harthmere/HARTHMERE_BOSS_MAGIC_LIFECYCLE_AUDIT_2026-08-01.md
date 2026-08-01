# Harthmere Boss Magic Lifecycle Audit — August 1, 2026

## Outcome

All eleven live Harthmere bosses and all forty of their magic attacks now pass
the complete visual lifecycle:

1. an active, body-scaled magic charge during Anima's authoritative charge
   interval;
2. a visible projectile moving toward the aimed player, or the correct
   beam/cone/ground/self-AOE attack shape;
3. exactly one successful-hit AAA magic explosion at the authoritative impact
   point.

The audit covers every one of the 55 boss attacks. Fifteen are intentionally
physical and remain outside the magic-charge/explosion contract. The remaining
forty are distributed as seven true projectiles, eight beams, fourteen targeted
ground AOEs, eight self-AOEs, and three cones.

## Boss and magic-attack matrix

| Boss                     |  World size (m) | Magic attacks                                                                 | Result   |
| ------------------------ | --------------: | ----------------------------------------------------------------------------- | -------- |
| Muck-Scarred Helix       | 6.8 × 4.8 × 8.4 | Siphon Volley; Helix Pulse; Spore Cast; Breach Rupture                        | 4/4 pass |
| The Gilded Bull          | 3.9 × 2.7 × 5.6 | Sun-Core Beam; Core Rupture                                                   | 2/2 pass |
| The Ninth Winter         |     14 × 13 × 8 | Failed-Dawn Shard; Blizzard; Same Day Again; The Year Breaks                  | 4/4 pass |
| The Failed Apprentice    | 4.8 × 5.6 × 3.8 | Shard Cast; Failed Ward; Wrong Note; Last Lesson                              | 4/4 pass |
| The First Choir          | 4.2 × 2.7 × 4.2 | Crone's Rebuke; Apprentice's False Note; Threefold Canon; Harmony Break       | 4/4 pass |
| The Echo-Singer          | 6.2 × 5.6 × 5.8 | Copy Magic; Echo Delay; Resonance Overload                                    | 3/3 pass |
| Vyrahel, the Vein-Keeper | 3.8 × 2.6 × 6.4 | Vein Breath; Wing Burst; Burrow Rush; Crystal Guard Shatter                   | 4/4 pass |
| Thaedryn the Bellbound   |    20 × 14 × 58 | Sound Cloud; River-Force Breath; Vein Call                                    | 3/3 pass |
| Hex Wraith               | 2.5 × 3.8 × 2.5 | Hex Volley; Grave-Violet Beam; Lantern-Rib Pulse; Tablet Prison; Phase Scythe | 5/5 pass |
| Alpha Mucker             |    12 × 14 × 11 | Seed Barrage; Root Cage; Muckheart Pulse                                      | 3/3 pass |
| The Root-Crowned Dead    | 4.5 × 5.5 × 4.5 | Root Eruption; Grave Sap; Crown-Seed Barrage; Rootling Swarm                  | 4/4 pass |

## Defects found and fixed

### Giant-boss charge and projectile origins

The previous client presentation emitted charge and projectile graphics from
the bottom-center ECS position. This works for ordinary creatures but can bury
the entire effect inside a raid-scale body. Thaedryn is 58 metres long, Ninth
Winter is 13 metres tall, and Alpha Mucker is 14 metres tall.

`src/shared/harthmere/boss_magic_presentation.ts` now treats the horizontal
body footprint as an ellipse, finds its intersection in the player's
direction, and moves the visible origin just beyond that body surface. The
origin is constrained before close targets so it cannot cross through or begin
beyond the player. Self-AOEs retain caster-centered authority while using the
selected player's direction for the readable charge.

### Bounded scaling for massive bodies

The same shared presentation calculates a volume-based characteristic size.
Charge VFX scales from `1x` to a hard `7.5x` maximum; projectiles and trails use
a smaller `1x` to `2.75x` scale. Volume-based scaling avoids using Thaedryn's
single 58-metre axis directly, which would make the effect fill the screen.

### Magic attacks reusing physical or energy meshes

Four magical boss attacks deliberately reuse a physical or energy-looking
mesh:

- Muck-Scarred Helix's Helix Pulse uses `helix_projector_beam`;
- First Choir's Threefold Canon uses `multi_shot`;
- Alpha Mucker's Seed Barrage uses `multi_shot`;
- Root-Crowned Dead's Crown-Seed Barrage uses `multi_shot`.

The impact selector previously classified only by projectile family, allowing
these four attacks to use a lightweight impact. It now uses the authoritative
attack `damageType` first and maps reused meshes into the correct arcane,
nature, or sonic explosion family.

### Boss hit radius was not reaching the explosion

The universal impact profile previously received the projectile asset's
generic preview radius. It now receives the attack's authored `hitRadius`, so
large boss ground and self-AOEs produce appropriately sized explosions while
remaining inside the existing ten-metre, particle, light, and concurrency
ceilings.

### Cone explosions at maximum telegraph range

Cone graphics intentionally extend to their maximum dodge range. The impact
code also used that far endpoint, causing a closer player's explosion to occur
behind them. Successful cone hits now keep the full telegraph but place the
explosion at the authoritative aimed target. This directly fixes Vyrahel's
Vein Breath and tightens Hex Wraith's Phase Scythe.

## Native ECS and Anima contract

Gameplay authority did not move to the renderer. Native ECS/Anima still owns:

- attack selection and round-robin cooldowns;
- `castTime`, charge duration, `releaseTime`, `impactTime`, and
  `cooldownUntil`;
- fixed aim points and projectile/beam/cone/ground/self-AOE hit geometry;
- hit/miss results and the exact list of hit players;
- damage receipts, native player health mutation, and duplicate replay
  rejection.

The renderer consumes the sanitized public combat projection, places the
body-scaled presentation origin, shows the charge, releases the premium
projectile or shape, and creates the explosion only after a successful magic
resolution.

## Verification

### Focused source, authority, and asset checks

- Combined focused test batch: **60 passing**.
- Boss magic presentation, magic charge, magic impact, and projectile wiring:
  **25 passing**.
- Native ECS/Anima and server-authority boss attack tests: **35 passing**.
- All 55 boss attacks cast, serialize, resolve their real geometry, publish
  ability-specific damage receipts, reduce native health, and reject replay.
- Client renderer typecheck: pass.
- Premium projectile validator: **29 GLBs pass**.
- Boss attack-shape validator: **4 GLBs pass**.
- Formatting and changed-file whitespace checks: pass.

### Browser/WebGL lifecycle audit

The browser harness uses the production `HarthmereProjectileVisualRuntime`,
real boss GLBs at their authoritative world dimensions, real projectile and
attack-shape GLBs, and the shared charge/impact profiles.

- Bosses: **11/11 pass**.
- Magic attacks: **40/40 pass**.
- Captured lifecycle phases: **120/120 visible**.
- Each row contains charge, travel/shape, and hit-explosion images.
- True projectiles move closer to the player during the travel sample.
- Shape attacks require an active production beam/cone/AOE graphic.
- Successful hits require exactly one magic-explosion counter increment.
- Every saved frame has a nonzero changed-pixel score.
- No final lifecycle row reports an asset fallback or failure.

Machine results:
`artifacts/harthmere-boss-magic-lifecycle-audit/results.json`.

Validator:

```sh
node scripts/harthmere/validate-boss-magic-lifecycle-audit.cjs
```

Result: `PASS 11 bosses, 40 magic attacks, 120 visible lifecycle phases, 11 boss sheets, and one master contact sheet.`

### Exact production build

- Build ID: `harthmere-boss-magic-lifecycle-final-20260801`.
- Web: `http://127.0.0.1:3097/at` returned HTTP 200.
- Sync: `127.0.0.1:4997` reachable.
- Redis: host port `6412` remained intact.
- App container: `biomes-boss-audit-final-20260731`.
- One Next build and one matching server webpack build completed.
- The application container was restarted once after both artifacts completed;
  Redis and persisted world state were not restarted.
- Post-restart status: running, `restartCount=0`, `OOMKilled=false`.
- Current-build artifact assertion: pass.
- The final client/server Next chunks contain the boss magic presentation
  marker and target-centered cone impact implementation.

The exact built `/at` route was then opened through the visual-auth bridge with
`syncBaseUrl=http://127.0.0.1:4997`. Its production audit panel loaded `30/30`
projectile/shape assets with `Failed 0` and `Fallbacks: none`. The live
gravity/fire/lightning/holy batch visibly activated all six spell graphics,
showed four concurrent AAA impacts in the first captured frame, and completed
at `Spawned 54 / Impacts 54 / AAA magic impacts 54 total / 0 active`.

## Documentation updates

`docs/cutscenes.md` now documents how to generate and register boss bodies,
five-attack combat catalogues, magic timing, production projectile/shape
routing, giant-body origins and scaling, cone endpoints, hit-radius
propagation, and the 40-attack browser acceptance gate.

`docs/harthmere/TESTING_FASTER.md` now documents the fast 40-attack matrix,
authoritative damage-type classification, giant-boss origin checks, separate
phase cameras, and why a zero changed-pixel frame should be fixed through
framing rather than by weakening the gate or rebuilding repeatedly.

## Visual evidence

Master sheet:
`artifacts/harthmere-boss-magic-lifecycle-audit/all-bosses.png`.

Exact final production-build smoke images:

- `artifacts/harthmere-boss-magic-lifecycle-audit/final-production-magic-batch.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/final-production-magic-batch-complete.png`

Individual full-resolution sheets:

- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/muck_scarred_helix.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/gilded_bull.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/ninth_winter.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/failed_apprentice.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/first_choir.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/echo_singer.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/vyrahel_vein_keeper.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/thaedryn_bellbound.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/hex_wraith.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/alpha_mucker.png`
- `artifacts/harthmere-boss-magic-lifecycle-audit/screenshots/root_crowned_dead.png`
