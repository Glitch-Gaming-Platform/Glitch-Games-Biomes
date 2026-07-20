# Native ECS Restoration — 2026-07-19

This change restores the original `data-snapshot-2026-05-16` ownership model
for the production issues reported in the July HAR/browser logs. It does not
deploy or mutate production.

The follow-up world-systems implementation is documented in
`NATIVE_ECS_WORLD_SYSTEMS_IMPLEMENTATION_2026-07-20.md`. That pass extends this
contract to NPC range/death/respawn, robot ECS batteries, native crop drops,
server-owned gathering, shared positioned loot, jobs field/tool proof, global
property/decor/placeable state, and conflict-safe terrain materialization.

## Corrected paths

| Area               | Failure                                                                                                                                                       | Restored behavior                                                                                                                                                                                             |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| World loading      | The capped bootstrap ranked raw ids by insertion order, so scenery could precede nearby terrain.                                                              | Bootstrap ids are ranked terrain-first and nearest-first; overflow remains queued and is delivered by subsequent socket batches.                                                                              |
| Health/death       | Fall and drowning damage were sent to native ECS and Redis, with a second optimistic HUD delta. GET status polling could also tick stamina and persist death. | Native `Health` is the only production authority. Native mode suppresses Redis environment-damage mirrors and makes status GET projection-only.                                                               |
| Redis latency      | Each actor record duplicated roughly 33 MB of shared economy/building data, and actor-only actions serialized the shared world twice.                         | Actor persistence omits shared-owned branches and auto-migrates legacy records. Actor-only actions skip the full shared comparison.                                                                           |
| Hotbar/inventory   | Hotbar stacks could be hidden from the inventory view or replaced by local shortcut overlays.                                                                 | Native slots win. A real hotbar stack is also shown in the inventory list with its authoritative count; only eligible non-wearable items can move to the hotbar.                                              |
| Muckwad            | Custom throw/placement paths could debit without a world drop or route block use into combat.                                                                 | The native Bikkie Muckwad remains a native stack. Native throw uses `InventoryThrowEvent`; custom positioned drops debit only if a world drop can be created. Block selection is not an attack.               |
| Crates             | HTTP 200 gameplay rejection caused local crate contents to disappear; Take All was not one transaction.                                                       | Single-take and Take All wait for an applied backend mutation. Take All commits the container only after the atomic server transfer succeeds.                                                                 |
| Clothing/equipment | Live Redis hydration blocked native swaps; slot aliases collapsed clothing layers; local projections overwrote wearing.                                       | Native swaps always publish. Every wearable slot has a distinct UI id. The player mesh reads the complete ECS wearing assignment. Full backpacks leave equipment in place instead of swapping with slot zero. |
| Quest progress     | Synthetic Road Ahead/local object handling bypassed native reward, collect, and wear triggers.                                                                | Native quest-giver objects route through dialog and `CompleteQuestStepAtEntityEvent`. The journal reads all native challenge bundles and trigger leaves. Synthetic Road Ahead is explicit diagnostic-only.    |
| Slow buttons       | Inventory, container, and dialog actions appeared inert while requests ran.                                                                                   | Buttons enter a disabled `Working…`, `Taking…`, `Equipping…`, or equivalent state until authoritative state changes or the request completes.                                                                 |
| Dialogue variety   | NPC opener pool was too repetitive.                                                                                                                           | The production opener builder contains exactly 30 distinct, tested openers.                                                                                                                                   |

## Interaction and harvest follow-up — 2026-07-20

The production Clothing Crate report exposed a routing regression that was not
covered by the earlier source-string checks:

- Native quest-giver picture frames remain discoverable through direct cursor
  hits and the proximity world-object selector, but their F action is native
  dialogue rather than the label/localStorage container panel.
- Claim-reward identity now uses the same entity-instance, NPC-type, and
  placeable-item matching on the client and server. After validation, the
  firehose event records the trigger leaf's canonical authored id so the
  `challengeClaimRewards` leaf can actually advance.
- Native storage opening and inventory transfer use the `interact` ACL. Storage
  access no longer requires permission to demolish the container.
- Native crop harvesting validates the server-read plant id, state, and
  distance without requiring the cursor-hit voxel to equal the plant root.
  Rejected harvests return a rollback error, and the client remains in a
  `Harvesting…` state until Gaia/world synchronization removes the plant.
- Native GrabBags have an explicit F pickup action in addition to automatic
  pickup. Bespoke Harthmere gathering/loot capture listeners yield while a
  native cursor target is active.

The regression suite must cover the complete identity chain, not only label
semantics: live ECS entity components -> inspect overlay -> F shortcut -> quest
dialog -> `CompleteQuestStepAtEntityEvent` -> canonical firehose identity ->
native reward/inventory trigger.

## Auth, ECS, and Redis latency follow-up — 2026-07-20

The July 19 production HAR showed two sequential startup requests taking about
12 seconds in total: `autoLogin` created/ensured the native ECS player and a
Biomes session, then `claimSession` repeated the same account lookup, player
bootstrap, and session creation before it claimed the Harthmere server session.

The optimized path keeps the same authority boundaries:

- Glitch install validation still runs first and remains the external identity
  authority.
- The existing Biomes session is verified through the normal cookie/header
  authentication helper. The client sends the `X-Biomes-User-Id` and
  `X-Biomes-Session-Id` fallback headers for same-origin Glitch bridge requests,
  so private-window iframe cookie restrictions do not force another login.
- Redis batch-reads the durable install-to-Biomes-user and
  install-to-Glitch-game-user bindings in one `MGET`. Reuse is allowed only when
  both bindings match the authenticated session and the newly validated Glitch
  identity.
- First login, expired auth, missing Redis bindings, an account switch, and any
  Redis failure all fall back to `createBiomesAuthForGlitchIdentity`, including
  `ensurePlayerExists`. Native ECS therefore remains the player authority; the
  fast path only removes duplicate work for an already-established player.
- `autoLogin` and `claimSession` return `biomes_auth_reused` so a future HAR can
  distinguish the one-time ECS bootstrap from the verified repeat path.

## Native Road Ahead contract

- Quest: `6193612340426932`
- Muckwad item: `4603863378554668`
- Ordered trigger ids: recorded in
  `src/shared/harthmere/native_road_ahead_contract.ts`
- Clothing Crate and Billy's Toolbag are native quest-giver objects, not generic
  loot containers.
- Collection and wearing advance from native `collect` and `wearing` firehose
  events. The UI does not mark those steps complete optimistically.

## Focused verification

```bash
NODE_OPTIONS=--max-old-space-size=8192 ./b typecheck

./b test --grep "native Road Ahead inventory trigger events|native Road Ahead Muckwad inventory projection|native wearable BiomesUI slot mapping"
./b test --grep "harthmere object container|container transfer interaction|Take All"
./b test --grep "retains every entity beyond the capped first bootstrap batch|prioritizes nearby terrain during a capped initial bootstrap"
./b test --grep "Harthmere live environment damage client|live_mode_player_status_state API route integration"
./b test --grep "live_mode API Redis persistence|persists only actor-owned state"
./b test --grep "Harthmere Glitch Biomes auth session reuse|glitch harthmere resource guards|Harthmere Glitch auth reload policy"

node scripts/glitch/test-glitch-install-auto-auth.cjs .
node scripts/harthmere/test-harthmere-glitch-cloud-save-all-state.cjs .
node scripts/harthmere/test-harthmere-install-id-flow-unit.cjs .
```

## Verification completed

The expanded local release gate completed on July 20, 2026 without deploying:

- TypeScript typecheck: passed.
- Complete non-browser suite after the auth/ECS/Redis latency follow-up:
  `3355 passing`, `5 pending`, `0 failing`.
- Rendered Chromium dialogue flow: passed, including the disabled `Working…`
  state while an asynchronous quest action is unresolved.
- Production deploy/local Redis guardrail: passed every assertion.
- Prettier check across every modified and new source/document file: passed.
- `git diff --check`: passed.
- Native ECS authority scan: no client `set`/`update` writes to inventory,
  wearing, health, or challenges.

The five pending tests are repository-declared pending cases; they are not
failures introduced by this restoration.

Before the next paid production deployment, run the full changed-area suite and
the production image guardrail. After deployment, verify with a throwaway actor:
native Road Ahead acceptance, six Muckwad collection, hotbar count visibility,
one-item throw/world drop, both clothing pieces visible, wearing-trigger
advancement, Billy's bag reward, container Take All, immediate damage HUD, and
terrain completion around the spawn radius.
