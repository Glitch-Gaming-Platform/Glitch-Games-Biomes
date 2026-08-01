# Harthmere attack-system audit — July 31, 2026

## Outcome

The melee, ranged, spell, boss, Native ECS, and Anima attack lanes are green at
source, serialization, authority, asset, controlled production-renderer, and
real live-cast browser levels. The final exact production build includes the
client-visible ranged-cast projection and has a captured real Hex Fireball from
launch through impact.

The hardware observation first proved the exact data-boundary defect:
`npc_state` is intentionally server-only, so the renderer could not receive the
Anima cast. The fix keeps that private state server-only and adds only sanitized
presentation fields to the already public `npc_combat_state`. The final browser
run received one real Fireball, showed it active on screen for its one-second
flight, completed one impact, and recorded no asset failure or fallback.

## Exact build under test

| Item | Value |
| --- | --- |
| Repository | `/Users/devindixon/Development/biomes-game` |
| Game URL | `http://127.0.0.1:3097/at` |
| Sync | `http://127.0.0.1:4997` |
| App container | `biomes-boss-audit-final-20260731` |
| Redis | `biomes-attack-audit-redis-20260731` on host port `6412` |
| Browser query requirement | `syncBaseUrl=http://127.0.0.1:4997` |
| Build state | complete `.next` and `dist`; current-artifact assertion passes |

The final coordinated Next build ID is
`42f0436aceafa250af79196d33b13d10251e1a6b-ch1-objective-handoff`.
The completed Next build and matching server webpack bundle both exited zero.
The server bundle emitted only the existing `mutable_hotfix` dynamic-require
warning. This was the one rebuild required by the client-visible cast fix; no
build was run between the accepted final cast frames and this report.

## Product fixes verified by this audit

1. Native ranged presentation now chooses the serialized Anima
   `rangedAttack.castTime` before unrelated melee emote or retaliation times.
   This prevents a valid authoritative cast from being rejected by timestamp
   mismatch and producing damage without a projectile request.
2. `npc_state` remains server-only. The already public `npc_combat_state` now
   projects only `abilityId`, `projectileVisualId`, `castTime`, `aimPoint`, and
   the optional hit/miss result for the active ranged cast. It does not expose
   paths, threat, schedules, cooldown selection, or other AI internals. The NPC
   renderer consumes this projection and retains the private-state read only as
   a server/test fallback. `SimulatedNpc.updateFromExternal()` also retains the
   synchronized public combat component, so an unchanged cast is not projected
   and published again on every Anima update.
3. Premium weapon combat classification uses the authored weapon profile.
   Bows/crossbows, darts, smoke bombs, staves, wands, spellbooks, scrolls,
   focuses, and energy weapons therefore take ranged/thrown/spell paths instead
   of falling back to display-name melee heuristics.
4. Ordinary Hexes retain melee combat and add Fireball. Fireball has a 1.0
   second cast and a 20.0 second cooldown. Hex bosses retain five authored
   attacks, including Fireball and at least one additional ranged attack.
5. Projectile timing is readable: the manifest clamps ordinary visual flights
   to 0.4–1.8 seconds, uses authored speeds from 16–58 metres/second, and honors
   authoritative impact time for hostile dodge windows. A 12-metre Fireball
   resolves visually in about 0.706 seconds unless the authoritative cast
   supplies a longer impact window.

## Attack coverage

### Player equipment

- Melee: all one/two-handed axes, double axes, daggers, double-headed hammers,
  one/two-handed swords, standard/golden swords, and great swords.
- Physical ranged: wooden/hunter, golden, and strung bows; one/two-handed
  crossbows; steel and golden darts.
- Magic/thrown: staff, wand, closed/open spellbooks, scroll, crystal/star/
  snowflake focuses, and smoke bomb.
- Energy ranged: Photon Sidearm, Pulse Carbine, Helix Projector, Nova Cannon,
  and Singularity Lance use the same native authority and projectile wiring.
- Shields remain defensive equipment and are not incorrectly classified as
  damaging ranged attacks.

The player projectile interaction tests cover both contact and zero-contact
misses, so a ranged miss still launches the visual without inventing a hit
entity.

### NPCs and bosses

The Anima matrix covers projectile, beam, cone, ground-area, and self-area
geometry, plus ordinary melee reach. All attacks serialize through native
`npc_state`, round-trip their ability/visual identity, and produce
ability-specific damage receipts.

All 11 live bosses have exactly five attacks, for 55 total:

- Muck-Scarred Helix
- The Gilded Bull
- The Ninth Winter
- The Failed Apprentice
- The First Choir
- The Echo-Singer
- Vyrahel, the Vein-Keeper
- Thaedryn the Bellbound
- Hex Wraith
- Alpha Mucker
- The Root-Crowned Dead

Entity-aware fixed-ID profiles preserve the correct Alpha Mucker and Hex Wraith
labels. The boss animation audit covers one walk state plus five attack states
for each boss: 66 screenshots and 55 real attack graphics.

## Real authority result

The final disposable-Hex run used player `560236630258162` and NPC
`8999997000000790` against the same Redis and server bundle as the browser.

| Phase | Result |
| --- | --- |
| Fireball cast | `abilityId=fireball`, `projectileVisualId=fireball` |
| Cast/impact | 1.000 seconds |
| Cooldown | exactly 20.000 seconds |
| Ranged authority | hit target; health `100 → 31` (`69` damage) |
| Melee authority | `attackTime` and `strikeTime` serialized; health `31 → 0` |
| Cleanup | original position, health, orientation, and iced state restored; temporary entities deleted |

Evidence:
`artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-and-melee-final.json`.

The server-authority matrix separately published all 55 boss
`UpdatePlayerHealthEvent` receipts, required native health to decrease, and
immediately replayed each receipt to verify duplicate rejection.

## Verification results

| Gate | Result |
| --- | --- |
| Focused boss/native/projectile Mocha batch | 49 passing |
| Player projectile contact/miss tests | 2 passing |
| All-55 server authority matrix | 1 matrix test passing; 55 attacks accepted and replay-protected |
| Anima/native behavior matrix | all 55 boss attacks plus hit, miss, cooldown, cone, ground, and self-area cases passing |
| Shared combat typecheck | passing |
| Server combat typecheck | passing |
| Premium projectile asset validator | 29 Blender-authored premium GLBs passing |
| Boss attack-shape assets | 4 shared Blender-authored shape GLBs passing |
| Boss browser visual validator | 11 bosses, 66 states, 55 attack GLBs passing |
| Build artifact assertion | passing |
| Production `/at` | HTTP 200; Sync port 4997 reachable |

The boss visual validator measured minimum body motion of 0.37%, minimum direct
graphic visibility of 2.45%, and minimum production-renderer visibility of
0.19%.

## Final live browser projectile gate

The hardware-backed in-app browser loaded the final `/at` chunks with the
explicit Sync override and ran the 30-entry projectile manifest in five batches
of six. Final counters were:

```text
Loaded 30/30
Failed 0
Spawned 270
Impacts 270
Fallbacks: none
Active: none
```

The 30 manifest entries include physical shots, thrown attacks, energy weapons,
Fireball/Meteor/lightning/holy magic, dark/nature/sonic effects, control marks,
Hex Bolt, and Thaedryn Resonance. The manifest uses 29 premium projectile GLBs;
the remaining boss-specific entry is validated with the boss attack assets.

After the public-cast projection rebuild, the entire five-batch manifest was
run again on build `42f0436aceafa250af79196d33b13d10251e1a6b`. The batched
delta was another 270 spawns and 270 impacts. The page's cumulative counter was
`273/273` because it also contained three preceding real-fixture flights; it
still reported `Loaded 30/30`, `Failed 0`, `Fallbacks: none`, and `Active: none`.

Visual evidence:

- `artifacts/harthmere-attack-audit-final-20260731/final-build-batch-1.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-build-batch-2.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-build-batch-3.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-build-batch-4.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-build-batch-5.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-build-all-batches-complete.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-projection-build-batch-1.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-projection-build-batch-2.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-projection-build-batch-3.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-projection-build-batch-4.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-projection-build-batch-5.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-projection-build-all-complete.png`
- `artifacts/harthmere-boss-animation-visual-audit/all-bosses.jpg`

### Real Hex hardware-browser observation and resolution

The diagnostic follow-up used persisted player `560236630258162` and disposable Hex
`8999997000000794` on the same build, Sync service, and Redis. Before unpausing
Anima, the hardware browser proved both exact IDs were present at client table
version `21643`. The Hex had the expected label, type, position, and health, and
the player had the expected position and `100/100` health. WebGL was active and
the projectile runtime was `Loaded 30/30`, `Failed 0`.

The browser observation then separated the synchronized fields:

- the Hex entity, position, label, metadata, health, and briefly
  `npc_combat_state.attack_target=560236630258162` reached the client;
- `/ecs/c/npc_state` was absent before, during, and after the cast;
- authority serialized Fireball at `1785557687.819`, resolved impact exactly
  one second later, applied `69` damage (`100 → 31`), and set the exact
  20-second cooldown;
- browser counters remained `Spawned 0`, `Impacts 0`, `Active: none`;
- cleanup restored the player to `100/100` and removed the disposable NPC.

The absence is required by the current generated serialization contract:
`src/shared/ecs/gen/components.ts` marks component ID 67 (`npc_state`) as
`server`, and `src/server/shared/ecs/lazy.ts` omits such components for client
targets. The renderer path in `src/client/game/resources/npcs.ts` depends on
that absent component for `rangedAttack.castTime`. This was the exact blocker to
closing the original live-Hex screenshot gate; it was not a WebGL, authentication,
interest-set, or NPC-presence failure.

Evidence:

- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-hardware-browser-observation.json`
- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-hardware-browser-observation-summary.json`
- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-hardware-browser-zero-counter.png`

The implementation then added the safe public projection and rebuilt once. The
final run used disposable Hex `8999997000000798` and the same persisted player,
Sync service, Redis, and hardware-backed game client. It produced exactly one
new projectile flight:

- browser counters changed from `Spawned 2 / Impacts 2` to
  `Spawned 3 / Impacts 3`;
- `Active: fireball` was observed during travel;
- `Loaded 30/30`, `Failed 0`, and `Fallbacks: none` remained true;
- authority serialized `castTime=1785558969.161` and
  `impactTime=1785558970.161`, an exact one-second flight;
- cooldown remained exactly 20 seconds;
- the hit applied 69 damage (`100 → 31`);
- cleanup restored the player and deleted the disposable NPC.

The three screenshots were captured roughly 180 ms apart and show the same
real Fireball approaching, reaching, and wrapping the player:

- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-client-projection-travel-1.png`
- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-client-projection-travel-2.png`
- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-client-projection-travel-3.png`
- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-client-projection-visual.json`
- `artifacts/harthmere-attack-audit-final-20260731/real-anima-fireball-client-projection-summary.json`

## August 1 coordinated handoff regression

The compact no-build regression reused the final coordinated `.next` and
`dist` trees. The current-artifact assertion passed, `/at` returned HTTP 200,
Sync port 4997 was reachable, and the application and Redis containers stayed
healthy. The only container operation was recreating the application container
once so its read-only bind mount followed the atomically replaced `.next`
directory; Redis was not restarted or rebuilt.

The final authority fixture used player `560236630258162` and disposable Hex
`8999997000000812`. It recorded one logical Fireball cast. The two serialized
entries are the pending and resolved states of the same cast and share
`castTime=1785565261.475`:

- impact time was exactly one second later at `1785565262.475`;
- cooldown was exactly 20 seconds, through `1785565281.475`;
- the cast resolved `hit` against the persisted player;
- health changed once from `100` to `31`, for 69 damage;
- cleanup completed and restored the player and removed the temporary entity.

On the matching production client, the known-zero projectile counters changed
to `Spawned 1 / Impacts 1`, and `Active: fireball` was observed during the
flight. The renderer reported `Loaded 30/30` and `Failed 0`. Its very first
active sample still contained the runtime's loading silhouette while the
already-resolved GLB promise attached on the following task; the completed
flight returned to `Fallbacks: none`. The current-build batched capture then
showed Fireball, Meteor, Lightning Bolt, Holy Light, Smite, and Singularity
Lance active together with `Fallbacks: none`, proving that the authored models
were attached and drawn by the production renderer.

The public-state retention regression is covered directly by the focused
`SimulatedNpc` test: feeding the synchronized entity back through
`updateFromExternal()` and finishing an unchanged cast produces no new update.
This closes the duplicate-publication defect exposed by the first coordinated
browser pass.

Final handoff evidence:

- `artifacts/harthmere-attack-audit-final-20260731/final-objective-handoff-real-fireball.json`
- `artifacts/harthmere-attack-audit-final-20260731/final-objective-handoff-fireball-live.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-objective-handoff-magic-batch-live.png`
- `artifacts/harthmere-attack-audit-final-20260731/final-objective-handoff-regression-summary.json`

Two later disposable-fixture repeats remained authority-green but were not
visible to the reloaded browser page before cleanup. They are retained as an
interest/streaming fixture limitation, not substituted for the accepted
known-zero-to-one observation above.

## Gaia boundary

The focused stack has Gaia disabled. That is intentional for this attack set:
`HARTHMERE_TERRAIN_MUTATING_PROJECTILE_VISUAL_IDS` is empty, so current
projectiles do not mutate terrain and neither presentation nor damage authority
depends on Gaia. Collision shapes and target inclusion are resolved by Anima
and native server authority. A future terrain-mutating projectile must add a
separate Gaia-enabled live collision gate; this report does not generalize the
current result to such a future attack.

## Honest fixture boundaries

- The user-provided `giant_boss.har` was empty (0 bytes).
- A generic chase fixture spawned a Mucker over absent terrain; it fell to
  `Y=-178` and Anima removed it as `farFromHome`.
- A generic skills fixture referenced missing navigation-aid entity
  `8997551883502307`.
- Chromium rejected Pointer Lock in the in-app session; the authority fixture
  uniced the player directly rather than disguising this as an attack failure.
- The standalone software-WebGL probe is invalid evidence: WebGL creation
  failed, `/sync/createPlayer` returned `UNKNOWN`, and the subscription entered
  `UNKNOWN`. Its zero local-NPC/event count is recorded as a probe failure, not
  a renderer failure.
- The first hardware observation correctly produced zero browser projectiles
  and is preserved as regression evidence for the old server-only boundary.
- Replacing `.next` atomically does not update an already-running Docker bind
  mount that still references the old directory inode. Recreate the application
  container against the finished artifact tree; a simple restart can expose an
  empty or stale `/app/.next` even though the host build is complete.
  The final screenshots are labeled as real live Fireball frames because the
  new public projection, browser spawn/impact counters, active visual ID, and
  authoritative cast all agree on the same final run.

These fixture limitations do not invalidate the green source, state-machine,
server-authority, asset, boss-animation, controlled production-renderer, or real
live-cast results.
