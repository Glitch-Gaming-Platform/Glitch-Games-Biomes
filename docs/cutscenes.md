# Creating Cutscenes

The cutscene system turns a declarative _shot list_ into an in-engine cinematic:
the camera detaches onto authored paths, actors walk/emote/talk on cue, the HUD
hides behind letterbox bars, subtitles render, and every exit path restores the
world. Story/end-state commits are outcome-gated and retried; by default they
run only for completion and player skip, never for death, abort, teardown, or
missing cast.

Everything is data-driven. You author a `CutsceneDef` (JSON-shaped object),
register it, and trigger it by id — or call a **template** that generates the
whole def from live world positions.

- Pure core: `src/shared/cutscene/` (schema, camera math, binding, runtime, templates, library, puppets)
- Client executor: `src/client/game/scripts/cutscene_director.ts`
- Front door API: `src/client/game/cutscene/cutscene_service.ts`
- Promotional capture API: `src/client/game/cutscene/capture_service.ts`
- UI: `src/client/components/CutsceneOverlay.tsx`
- Tests: `src/shared/cutscene/test/`
- Design rationale: `CUTSCENE_GENERATOR_DESIGN.md`

## Quick start

```ts
import {
  registerCutscene,
  requestCutsceneById,
  requestCutscene,
} from "@/client/game/cutscene/cutscene_service";

// 1. Register once (validated; throws on authoring mistakes):
registerCutscene({
  id: "elder-warning",
  name: "The Elder's Warning",
  cast: [
    { role: "player", binding: { kind: "player" } },
    {
      role: "elder",
      binding: { kind: "nearestNpc", labelMatch: "elder", within: 32 },
    },
  ],
  shots: [
    {
      id: "two-shot",
      duration: 3,
      until: { kind: "dialogueDone", maxDuration: 10 },
      camera: { kind: "overShoulder", from: "player", to: "elder" },
      actions: [
        { kind: "face", at: 0, role: "elder", towards: { role: "player" } },
        { kind: "emote", at: 0.3, role: "elder", emote: "talkGesture" },
        {
          kind: "dialogue",
          at: 0.3,
          role: "elder",
          speaker: "Elder Rowan",
          text: "The muck is spreading faster than we feared.",
        },
      ],
    },
  ],
});

// 2. Trigger it from anywhere client-side (quest step, dialogue, interaction):
requestCutsceneById("elder-warning");

// Or trigger an inline/template def directly:
requestCutscene(myGeneratedDef);
```

That's it. The director handles prewarm (shard loading behind a fade), input
lock, HUD/letterbox, camera, subtitles, skip, restore, and cleanup.

## Templates: the fastest way to a good-looking scene

Templates compile a full shot list from parameters + live world positions, so
one call works wherever the actors are standing. From
`@/shared/cutscene/templates`:

| Template                      | What it produces                                                                                                                             |
| ----------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- |
| `conversationCutscene`        | Establishing two-shot, then alternating over-shoulder coverage per line, emotes carried through, every shot time-capped.                     |
| `bossIntroCutscene`           | Fade in → low-angle orbit reveal → roar (emote + shake + sfx) → whip to over-shoulder player resolve. Priority 10 (preempts ambient scenes). |
| `questCompleteCutscene`       | NPC `questGesture` + thanks line → reward beat on the player; wires your quest-commit hook into `onEnd`.                                     |
| `establishingFlyoverCutscene` | Descending crane arc around a landmark, every waypoint framing it; optional title subtitle and time-of-day.                                  |
| `revealCutscene`              | Slow eased push-in on a world position (door, crate, clue).                                                                                  |
| `heroVsCreaturesCutscene`     | Finite encirclement → three-hit exchange → finishing blow/victory beat for one hero and three or four native creatures.                      |

```ts
import { bossIntroCutscene } from "@/shared/cutscene/templates";

requestCutscene(
  bossIntroCutscene({
    id: "thaedryn-intro",
    name: "Thaedryn Awakens",
    boss: { kind: "entity", entityId: THAEDRYN_ID },
    bossName: "Thaedryn",
    introLine: "You dare enter my domain?",
    music: "battle_music",
  }),
  { preempt: true }
);
```

## The definition format

### Cast

Each role names an actor and how to bind it:

```ts
{ role: "player", binding: { kind: "player" } }
{ role: "boss",   binding: { kind: "entity", entityId: 777 } }
{ role: "guard",  binding: { kind: "nearestNpc", labelMatch: "guard", npcTypeId: 123, within: 40 } }
{ role: "spirit", binding: { kind: "ghost", asset: "snapshot/player_mesh", appearanceSourceEntityId: 8810000000020501, spawnAt: [640, 64, -268] } }
{ role: "gate", binding: { kind: "anchor", position: [640, 64, -268], height: 8 } }
```

- `nearestNpc` searches live NPCs around the player (or `near`), by label regex
  and/or **Bikkie** npc type id (`npc_metadata.type_id`).
- `ghost` is a client-only renderer mesh with **no ECS entity** — for
  flashbacks, crowds, stand-ins. Ghosts get negative ids, never carry HP, and
  can never be attacked or persisted.
- Human ghosts must use `snapshot/player_mesh`. Set
  `appearanceSourceEntityId` when the memory represents a known person so the
  generated PlayerMesh keeps that actor's skin, hair, face, and clothing.
  Never author a `townsperson_*` human asset: those labels belong to the retired
  procedural Three.js body path. The binder canonicalizes stale aliases only as
  a last-resort compatibility guard; new scenes must be explicit.
- Binding failure handling per role: `required: true` (default) cancels the
  scene gracefully; cancelled scenes do not commit unless `commitOn` opts in;
  `fallback: "ghost"` + `ghostAsset` substitutes a stand-in;
  `fallback: "skipActions"` keeps the scene and drops that role's beats.
- `anchor` is a non-rendered target for buildings, items, doors, and landmarks.
  It can be framed by cameras but cannot be moved or animated.
- Non-NPC ECS entities can be static camera targets. Living-actor actions are
  rejected when the resolved entity has no actor driver.
- Two roles may never resolve to the same live entity.

### Shots

Sequential. Each has a camera, a nominal `duration`, an optional `until`
condition, a transition, and parallel `actions`.

Camera specs: `static` (+ optional `lookAtRole`), `dolly` (waypoints, eased,
per-waypoint orientations or `lookAtRole`), `orbit` (around a role),
`trackRole` (follow at offset), `overShoulder` (film two-shot, mirrors the
engine's NPC-talk framing), `pov` (from a role's eyes).

Transitions: `cut` (default), `blend` (eased camera interpolation over
`blendSeconds`), `fade` (covered cut).

`until` extends a shot past `duration` up to a **hard `maxDuration` ceiling**:
`dialogueDone`, `actorArrived` (a role's `moveTo` finished), `playerInput`
(Space/Enter/click). A shot can never hang — the ceiling always wins. The
camera finishes its move at `duration` and holds while the shot waits.

### Actions

All run in parallel within the shot, starting at `at` seconds:

`moveTo` (straight-line walk at `speed`; corners = several moveTos; on
`timeoutSeconds` it teleports under a sequenced black fade or skips), `teleport`,
`face`, `emote` (player emotes like `wave`/`attack1`/`sit` **or** Harthmere NPC
runtime clips like `talkGesture`/`workLoop` — validated at author time),
`dialogue` (subtitle; duration auto-computed from reading speed unless given),
`holdItem` (native Bikkie item in an ECS NPC's authored hand socket), `sfx`
(spatial with `atRole`), `music`, `shake`, `fov`, `fade`, `timeOfDay`, `custom`
(named hook + optional payload), and `capture`.

### How to fire a projectile in a cutscene

Use the registered cinematic projectile hook. Do not create a second Three.js
projectile, call the renderer directly, or publish a damage event. The hook
dispatches the normal Harthmere projectile presentation event, so cutscenes use
the same authored GLB, trail, flight timing, fallback reporting, impact effect,
and low-FPS lifetime rules as gameplay.

```ts
import {
  HARTHMERE_CUTSCENE_PROJECTILE_HOOK,
  type HarthmereCutsceneProjectilePayload,
} from "@/shared/cutscene/hex_fireball_dodge_showcase";

const fireball = {
  kind: "custom" as const,
  at: 1.2,
  hook: HARTHMERE_CUTSCENE_PROJECTILE_HOOK,
  payload: {
    projectileId: "fireball",
    origin: [497.65, 55.45, -140],
    target: [503, 53, -140],
    result: "dodge",
    windupSecs: 0.48,
    visualScale: 2.25,
  } satisfies HarthmereCutsceneProjectilePayload,
};
```

Add that action to the shot's `actions` array. `origin` and `target` are world
positions; calculate them from the staged cast/anchors when possible instead of
copying coordinates from an unrelated scene. `projectileId` must exist in
`src/shared/harthmere/projectile_visual_manifest.ts`. `visualScale` is only for
cinematic readability and should stay bounded; it does not change collision or
damage. `result` controls impact presentation, not gameplay authority.

The canonical working example is
`src/shared/cutscene/hex_fireball_dodge_showcase.ts`; the hook is registered in
`src/client/game/cutscene/harthmere_library.ts`. Preview it through the actual
game renderer:

```text
?cutscenePreview=harthmere-hex-fireball-dodge-showcase&previewRun=1
?cutsceneVideo=harthmere-hex-fireball-dodge-showcase&videoFps=30&videoRun=1
```

Acceptance requires the projectile prototype to be loaded, `Failed 0`, no
fallback, one new spawn, `Active: fireball` during travel, and one matching
impact. A custom action firing successfully is not by itself visual proof.

Before adding another projectile action, use this checklist:

1. Choose a `projectileId` from the shared visual manifest; never use an ability
   display name or invent a renderer-only id.
2. Stage/face the caster first, then calculate `origin` from its authored hand,
   mouth, staff, or body socket. Calculate `target` from the intended world mark
   or actor position. Both values are world coordinates.
3. Put the custom action at the release frame, not at charge start. If the shot
   needs visible charging, author that as an earlier action/beat and keep one
   projectile release. Charge/channel gesture code is presentation-only: it may
   play an emote or dispatch a charge visual, but it must not write
   `LocalPlayer.attackInfo` or otherwise claim gameplay combat authority.
4. Set `result` to the cinematic outcome (`hit`, `miss`, or `dodge` as supported
   by the payload). This controls presentation only; gameplay damage, cooldown,
   and inventory must never be published from the cutscene.
5. Preview through `/at`, observe active travel for more than one frame, and
   require a matching impact with no fallback. Asset HTTP 200/304 responses are
   not visual acceptance.

The release action must dispatch the projectile presentation even when an
earlier charge visual exists. Ending a charge is not itself a projectile spawn;
verify both counters/lifecycles independently (`charge released`, then
`projectile spawned -> active -> impact`).

Gameplay cooldown changes do not retime this hook. For example, the ordinary
Hex Fireball's 10-second combat cooldown controls when AI may choose Fireball
again; the cutscene fires only when its authored custom action executes. Do not
add a repeating timer to imitate the gameplay cooldown.

Likewise, player combo and held-heavy rules do not apply to a cutscene custom
projectile action. A cutscene projectile has one authored release timestamp and
presentation result; it does not increment the four-hit fight combo, wait for
the post-chain three-second cooldown, or infer a Heavy attack from how long a
shot lasts.

Fast source gate for this path:

```sh
node_modules/.bin/mocha --config .mocharc.json \
  src/shared/cutscene/test/hex_fireball_dodge_showcase.test.ts

node scripts/harthmere/test-harthmere-combat-animation-polish-magic-vfx.cjs
git diff --check
```

### First-class expressions and multi-actor emotion

Harthmere's body-language library is part of the normal `emote` action, not a
cutscene-only pose system. The same 71 public expression ids can be selected by
player chat (`/emote <name>`), replicated ECS `Emote` state, NPC renderer state,
or a cutscene. Each id maps to an authored Blender clip, a facial expression,
playback policy (`once`, `loop`, or `hold`), duration, interaction type, and
legacy fallback clips in
`src/shared/cutscene/cinematic_expression_catalog.json`.

Use `cutsceneExpressionSequence` when a shot has several reactions or when one
actor changes expression over time. It emits ordinary validated `face` and
`emote` actions, so generated scenes keep the existing director/runtime
contract:

```ts
import { cutsceneExpressionSequence } from "@/shared/cutscene/expression_actions";

actions: [
  ...cutsceneExpressionSequence([
    { role: "guard", expression: "alert", at: 0.2, faceTowardsRole: "hexer" },
    {
      role: "villager",
      expression: "terror",
      at: 0.2,
      faceTowardsRole: "hexer",
    },
    {
      role: "hexer",
      expression: "threatening",
      at: 0.4,
      faceTowardsRole: "guard",
    },
    {
      role: "guard",
      expression: "determined",
      at: 1.8,
      faceTowardsRole: "hexer",
    },
    {
      role: "villager",
      expression: "relief",
      at: 3.2,
      faceTowardsRole: "guard",
    },
  ]),
];
```

Different actors may emote at the same timestamp. Two expressions for the same
actor at the same timestamp are rejected because the winner would otherwise
depend on array order. A later cue replaces the earlier body and face state.
One-shot faces reset after their authored duration; loop and hold faces remain
until another expression, locomotion/combat ownership, or scene cleanup takes
over.

For `hug`, `handshake`, and `highFive`, use the paired helper. It faces both
actors and starts the two clips on the same director tick. Optional approach
moves only one actor, which avoids two actors continuously chasing each other:

```ts
import { pairedCutsceneExpressionActions } from "@/shared/cutscene/expression_actions";

actions: [
  ...pairedCutsceneExpressionActions({
    firstRole: "player",
    secondRole: "elder",
    expression: "handshake",
    at: 1.5,
    approach: true,
    arriveWithin: 1.05,
  }),
];
```

Authoring rules:

- Keep actor translation in `moveTo`/`teleport`; expression clips contain no
  horizontal root motion, so they cannot fight physics, Anima, or puppet
  placement.
- Stage paired actors roughly 0.9–1.2 metres apart and use front or
  three-quarter camera coverage so hand contact remains visible.
- Do not use `hug`, `handshake`, or `highFive` as a solo reaction. The schema
  accepts the emote, but only the paired helper supplies the required facing
  and synchronized partner action.
- `stagger`, `knockdown`, and `getUp` are presentation actions. They do not
  apply damage, change HP, or stand an authoritative physics body up. Gameplay
  systems must own those state transitions.
- The expression library does not replace `attack1`/`attack2` or alter attack
  timing. Combat attacks retain their existing clips and mechanics.
- Every exported player/NPC animation asset contains the same expression clip
  names. Rigs with fewer humanoid bones map the intent onto the available
  body, head, limb, wing, or fin controls; procedural ghosts use the matching
  runtime pose fallback.

The generated `harthmere-expression-showcase` scene is the visual acceptance
fixture. It exercises all public expressions, then the three paired gestures,
with `clientPuppet`, `commitOn: []`, and no end placements. It can be previewed
or recorded through the same game-engine cutscene path as a production scene:

```text
?cutscenePreview=harthmere-expression-showcase&previewRun=1
?cutsceneVideo=harthmere-expression-showcase&videoFps=30&videoRun=1
```

Directional dodge and roll clips have their own compact game-rendered fixture:

```text
?cutscenePreview=harthmere-movement-action-showcase&previewRun=1
?cutsceneVideo=harthmere-movement-action-showcase&videoFps=30&videoRun=1
```

It renders `dodgeLeft`, `dodgeRight`, `dodgeForward`, `dodgeBack`, and `evade`
through the same snapshot player mesh and animation mixer used by cutscene
ghosts. Keep its `clientPuppet` mode, empty commits/placements, camera-facing
anchor, and labeled shots: the fixture is a repeatable visual audit and must
never consume stamina, move an authoritative entity, or change combat state.
Standalone Blender stills are not final evidence for this rig; follow the
movement-animation gate in `docs/harthmere/TESTING_FASTER.md`.

Follow `docs/harthmere/TESTING_FASTER.md`: run the fast deterministic lanes
first, batch fixes, and build the exact current source only once for the final
engine capture. Never accept a capture from an older image merely because its
server is still reachable.

### Settings

```ts
settings: {
  skippable: true,        // ESC; ALWAYS allowed after skipAfterSeconds (default 3s)
  lockPlayer: true,       // freezes motion input (physics still grounds you)
  hideHud: true, letterbox: true,
  invulnerablePlayer: true, // blocks damage client-side for the duration
  timeOfDay: 0.75,        // visual-only override, 0=midnight 0.5=noon; restored after
  music: "battle_music",  // overrides contextual music; restored after
  mode: "clientPuppet",   // or "serverShared" — see multiplayer below
  prewarmTimeoutSeconds: 2,
  commitOn: ["completed", "skipped"],
  maxSceneDurationSeconds: 900,
}
```

### onEnd — the story-state contract

```ts
onEnd: {
  placements: [{ role: "elder", position: [630, 64, -270], orientation: [0, 1.6] }],
  commits: [{ hook: "quest.advance", payload: { questId: "bible_quest_12", step: 3 } }],
}
```

Cleanup is shared by every finish path. `onEnd` is applied only when the finish
reason appears in `settings.commitOn`; the safe default is `completed` and
`skipped`. Tokens are marked applied only after all work succeeds, and the
client retries transient failure. Hooks still must be server-idempotent because
a browser restart cannot provide durable exactly-once delivery. Register hooks:

```ts
import { registerCutsceneHook } from "@/client/game/cutscene/cutscene_service";
registerCutsceneHook("quest.advance", async (payload) => {
  // MUST be idempotent/retryable: /sync reconnects can cancel in-flight
  // publishes, and live-mode writes are slow. Visual-first, commit-after.
});
```

For important rewards and quest state, commit the authoritative result on the
server before triggering the cinematic. The cutscene should present an already
decided outcome rather than own the transaction.

## Triggering

Call `requestCutsceneById`/`requestCutscene` from any client code: a quest
runtime step, a dialogue accept handler, an interaction (F on an object), a
location check, or the boss spawn path. Requests are queued — **scenes never
overlap**; duplicates by id are dropped; higher `priority` requests with
`preempt: true` abort the active scene through the normal cleanup path.

## Engine integration notes (ECS, Gaia, Anima, Bikkie)

**Native ECS.** Real actors are ECS entities. In `clientPuppet` mode (default)
the entity itself never moves; the scene overrides only renderer records. In
`serverShared` mode the director can stream `SetNPCPositionEvent` at 100 ms so
everyone sees the motion. Shared mode is server-authorized for admins/trusted
cinematic tooling, and inline client definitions cannot request it.
`clientPuppet` end placements never publish ECS movement.

**Anima.** `clientPuppet` scenes never touch server authority. Authorized shared
position updates refresh a short `cinematicPauseUntil` lease in NPC state;
Anima observes external position/state changes, zeros velocity, and skips AI
while that lease is active. `update_spawn: false` preserves return-home and
schedule anchors.

**Gaia.** Terrain simulation is untouched. `timeOfDay` changes only the client
sky renderer. Prewarm includes explicit waypoints plus bounded samples across
generated shot paths and cast positions, waits for nearby shards behind a
black fade, and terrain-resolves camera poses.
Time restoration will not overwrite a newer user or night-vision change.

**Bikkie.** `nearestNpc.npcTypeId` matches the NPC's biscuit id
(`npc_metadata.type_id`). Emote names are validated against the engine's
`zEmoteType` plus the Harthmere runtime set, and non-NPC entities are accepted
as static camera targets without pretending they have living-actor drivers.
`holdItem` accepts a real Bikkie item id (or `null` to clear it). Player-like
Harthmere humans remain ECS NPCs, but the live bridge marks them for the native
generated-player/Grove avatar renderer; the procedural Harthmere renderer must
not draw a second blocky stand-in for the same record.

### Native NPC action-shot rules

For a present-day gameplay or promotional shot, bind the real seeded ECS NPC
with `entity` or `nearestNpc`. Do not use a `ghost` merely to get a human-shaped
actor: ghosts are intentionally stand-ins and do not guarantee the seeded
appearance, Bikkie equipment, Anima identity, or current snapshot data.

```ts
{
  cast: [{
    role: "worker",
    binding: { kind: "entity", entityId: Number(ownerSeed.entityId) },
  }],
  actions: [
    { kind: "teleport", at: 0, role: "worker", to: workMark },
    { kind: "face", at: 0, role: "worker", towards: { role: "matterCore" } },
    { kind: "holdItem", at: 0, role: "worker", itemId: Number(BikkieIds.pickaxe) },
    { kind: "emote", at: 2.15, role: "worker", emote: "smithWork" },
    { kind: "vfx", at: 2.7, effect: "exoticMatterCreation", atRole: "matterCore" },
  ],
}
```

The native attachment path prefers the avatar's authored `Equipped_Attach`
socket before arm/hand fallbacks. Do not attach a world-scale item directly to
the first vaguely matching arm mesh: generated avatars can expose `R_Arm`
before the real equipment socket, which makes held tools enormous or offset.

### Native combat-cutscene rules

`heroVsCreaturesCutscene` is the reusable combat generator. Give it one hero,
three or four creature bindings, a stage center, a native Bikkie weapon, and an
optional victory line. Its 15-second reference choreography is divided into a
4-second encirclement, 6-second exchange, and 5-second finishing beat. Other
allowed durations scale those beats proportionally.

The template drives `attack1`/`attack2`, `hitReact`, `death`,
`combatImpact`, camera shake, orbit/dolly/static coverage, FOV, and the held
item. These are renderer-only `clientPuppet` effects: they do not change HP,
drops, ECS transforms, Anima decisions, Gaia, spawn anchors, or shared quest
state.

For Muckers and Hexes, bind the live ECS entity and let the label select the
original Biomes creature asset (`npcs/seedy_muckling`, `npcs/tree_mucker`,
`npcs/stone_mucker`, `npcs/jugger_mucker`, `npcs/mossy_mucker`, or the authored
Hexer GLTF). `NpcRenderState` owns those GLTFs and receives the same cutscene
transform/animation overrides as other native NPCs. The local procedural life
renderer suppresses its compatibility body for records marked
`nativeNpcRenderer`, preventing a humanoid or duplicate from covering the
authored creature.

Do not assume consecutive canonical seed IDs are spatially close in an
installed snapshot. Before pinning a multi-actor cast, inspect the running ECS
records and choose entities that can be streamed by one observer. In the May
16 snapshot, the first Road Muckwad records are persisted hundreds of metres
apart; offsets 9472–9474 are the co-streamable Road Muckwad 7–9 cluster near
`[550, 70, -142]`. `jackie-vs-muckers` uses that cluster.

Use the checked-in read-only preflight to see identity, position, NPC type, HP,
selected native creature asset, centroid, and maximum spread:

```sh
GLITCH_REDIS_HOST=127.0.0.1 GLITCH_REDIS_PORT=6391 ALLOW_NON_K8_REDIS=1 \
  scripts/cutscenes/inspect-live-cast.cjs \
  8810000000019472 8810000000019473 8810000000019474
```

Creature ghost fallbacks are opt-in. If no species-correct `ghostAsset` is
provided, a missing required creature cancels the scene and publishes a
`cancelled` lifecycle result. This is intentional: capture automation must fail
loudly instead of silently replacing a Mucker with a generic humanoid.

## Promotional screenshots

### Fast path: the promo scene registry

A promotional still is now **data**, not client code. Register it in
`src/shared/cutscene/promo_scenes.ts` and capture it with one command:

```sh
node scripts/cutscenes/capture-promo-still.cjs --list
node scripts/cutscenes/capture-promo-still.cjs dungeon-portal
node scripts/cutscenes/capture-promo-still.cjs dungeon-portal --at 3.8 --run 2
node scripts/cutscenes/capture-promo-still.cjs boss-gilded-bull \
  --camera-preset three-quarter-left \
  --output-dir artifacts/cutscenes/bull-three-quarter-left \
  --run bull-left-1 \
  --print-url
```

Writes `artifacts/cutscenes/<filename>` (branded) and `-raw.png` (unbranded
engine frame), and exits non-zero if the capture did not happen.

For iterative art direction, always provide a unique `--output-dir`. The tool
then keeps the branded PNG, raw PNG, HAR, and `capture-metadata.json` together.
Metadata records the preset, registry waypoints, FOV, authored capture time,
and actual sampled camera. This prevents a new bracket from overwriting either
the current final filename or the evidence needed to avoid repeating it.
Use `--print-url` during source review: it validates the scene and named camera
preset and prints the exact local observer URL without taking the browser lane.

**Why this replaced the hand-driven URL.** `promo_capture.ts` used to hardcode
the query id, the brand subtitle, the output filename, the shot id, and the
`captureAt` ceiling as literals inside the React hook. Adding a second still
meant editing client code — enough friction that stills stopped getting made.
The registry entry carries all of it, and `promo_scenes.test.ts` validates the
scene, the shot id, the capture window, and the framing contract **without a
browser, a stack, or a GPU** — which matters because the capture itself needs
all three.

`?cutscenePromo=<id>` now dispatches through the registry. The legacy
`exotic-matter` id keeps its bespoke builder so the reference URLs below still
work.

### Framing a promo still (learned making the portal shot)

These are the mistakes that cost retakes. The portal still encodes each one,
and `promo_scenes.test.ts` asserts the ones that are checkable:

| Rule                                                  | Why                                                                                                                               |
| ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------- |
| **Narrow FOV (35–45)**                                | At 70+ the subject drifts away from the hero object and the shot reads as "person in a place" instead of "person before a thing". |
| **Camera below the object's centre, looking up**      | Looking _down_ at a portal makes it read as a puddle. Tested.                                                                     |
| **Three-quarter rear, ~35° off-axis**                 | A pure back view makes the player a silhouette blocking the hero object; a pure side view loses the "standing before it" read.    |
| **Push in across the shot (2+ dolly waypoints)**      | Every bracketed `--at` still lands on a composed frame, not just the default. Tested.                                             |
| **Light the subject deliberately**                    | The gate is emissive, so it needs a dark sky (`timeOfDay` 0.78) or the shader has nothing to fight. Tested.                       |
| **`commitOn: []`, `clientPuppet`, no end placements** | A screenshot must never write story state or move a real NPC. Tested.                                                             |
| **`priority: 100_000`**                               | Otherwise an ambient scene can preempt the capture. Tested.                                                                       |

### Boss and large-creature camera preflight

Large actors need a cheap geometry pass before the live browser pass. Run the
camera planner against the registry and canonical world-size bounds:

```sh
node scripts/cutscenes/preflight-boss-promo-angles.cjs \
  --recommended \
  --output artifacts/cutscenes/boss-camera-first-attempts.json \
  --strict

node scripts/cutscenes/preflight-boss-promo-angles.cjs \
  --boss gilded_bull \
  --preset three-quarter-left \
  --preset three-quarter-right \
  --preset environment-wide \
  --output artifacts/cutscenes/bull-camera-preflight.json \
  --strict
```

The planner uses the same eased dolly sampling as the cutscene director. It
rejects an out-of-range marketing FOV, a dolly that enters the canonical boss
body envelope, a reversed push-in, non-finite coordinates, or a camera move too
short to read. For Elsewhen bosses it also transforms the full dolly and three
camera-to-subject sightlines into authored dungeon coordinates, then rejects a
wall, roof, lintel, column, or other canonical terrain intersection before
Chromium. `--recommended` checks the first logged live-review candidate for
each boss; it does not claim that the composition has passed visual review.
Available review presets are `baseline`,
`three-quarter-left`, `three-quarter-right`, `environment-wide`, and
`reverse-inward`.

This is intentionally **not** terrain acceptance. Every generated candidate
still needs the live cutscene generator to prove all of the following:

- the actor's support surface is the intended floor, platform, or terrain;
- the complete far-to-near dolly is clear of terrain and architecture;
- the background is recognizable encounter scenery rather than void, a stale
  interest set, or a different district;
- the full silhouette is readable and the feet, roots, spectral base, or
  contact shadow visibly meet the support surface.

The live generator now performs the terrain half of that review before it asks
the renderer for a PNG. It samples 17 points along the exact eased dolly with a
small camera-body clearance envelope and three camera-to-subject sightlines
against the streamed `/terrain/tensor`. Missing tensors wait; a solid camera or
sightline voxel fails closed with the first world coordinate. This catches
ordinary-map and runtime-Underways terrain that the offline Elsewhen voxel
model cannot inspect. Runtime GLB/OBJ decor and the final composition still
require visual review.

Keep physical grounding and visual grounding separate. For example, the Sun
Court bull dais occupies world Y 43–45, so its top surface is Y 46 and a
grounded puppet at Y 46.08 is already on top. If a close lens makes the Bull
look embedded, raising it another metre creates a floating actor. The correct
bracket is a wider or more lateral three-quarter camera that leaves visible
gold cap around the feet.

Use at most three new live brackets for one scene before stopping to inspect a
contact sheet. Preserve rejected raw/branded frames outside the final filename
set, and record both the registry waypoints and the actual sampled camera from
the capture result. Once one bracket passes, move its values into the registry
and rerun only that scene; do not pay for the full boss batch.

After the representative scenes pass, capture all eleven logged first attempts
in one warm page:

```sh
node scripts/harthmere/e2e-jump.cjs promo-batch-url boss-marketing \
  --bossCameraPlan=recommended \
  --captureRun=final-boss-marketing-1
```

The batch applies each boss's own first-priority preset rather than one global
angle. Every capture result records `sceneId`, `cameraPreset`, and the sampled
camera position, and each branded/raw pair is persisted before the next scene
starts. Run this only after the bounded ordinary-map/Elsewhen/Underways/Wilds
preflight passes; a warm batch is a throughput tool, not a substitute for QA.

#### Fragmented horizon: terrain data versus capture sight

Do not immediately increase camera far distance when a promotional frame shows
isolated terrain columns over sky. First distinguish three independent radii:

1. camera far plane/draw distance;
2. Sync interest-set radius;
3. terrain combined meshes that have actually finished building.

The August 5 boss readback sampled retained Redis every 8 m through a 128 m
radius around Helix and Hex. Both targets had 797/797 solid support columns,
with zero missing shards and zero empty terrain tensors. The client already had
the desktop 128 m dynamic minimum and Sync radius. The broken horizon therefore
came from the old promo gate: it waited for five hand-picked floor shards but
not the camera-facing background meshes.

Boss promo scenes now add a bounded view-corridor gate. It samples center/left/
right lanes at 32, 64, 96, and 112 m through the horizontal frustum, warms the
lower, local, and upper vertical terrain bands in batches of four, and requires
each sampled column to expose an ECS terrain entity, an occluder, and at least
one non-empty combined mesh. A foreground slab can no longer authorize capture
while the horizon is still fragmented. If this gate passes and the horizon is
still wrong, investigate camera direction or authored scenery; do not blindly
raise draw distance beyond the performance contract.

#### No-build boss-still hotfix and single-subject gate

When the mounted client contains the mutable-hotfix bootstrap, boss camera,
staging, promo visibility, and capture-runner fixes do not require a Next,
server, Docker, or image rebuild. Run the focused source tests, apply an exact
build-compatible hotfix with `expectCount: 1` and old/new SHA-256 guards, verify
the served bytes, then open one fresh browser context and capture one scene.
Inspect that frame before applying the next delta.

A valid boss still must contain exactly one intended subject. Boss promo mode
suppresses ordinary `NpcRenderState`, Harthmere runtime-life placements, and
gameplay player rendering while preserving the canonical native synthetic
cutscene actor. A large foreground body that does not move when the promo stage
position changes is evidence of a duplicate live render path, not a need to
widen the body envelope or move the camera farther away.

For runtime Underways scenes, prefer the authenticated observer route if the
player route enters missing-shard recovery. Keep `streamingFocus` near the
encounter independently of the cinematic camera. Abort the row if it navigates
to a non-local Sync, Azure, `biomes.gg`, Firebase, or Google Cloud endpoint.

Use no more than three live camera brackets per scene before contact-sheet
review. Save branded PNG, raw PNG, HAR, capture metadata, registry waypoints,
and sampled camera for accepted and rejected rows. Evidence produced this way
must be labeled `mounted build + injected hotfix`; it is not proof of immutable
image packaging. Sequential delta manifests are suitable only for a disposable
continuous lane. Any restartable hotfix must be cumulative from the immutable
base or carry an explicit dependency chain.

### Capture gotchas that are now handled for you

- **Always enter through visual auth.** Use `promoCaptureAuthUrl()` for a single
  scene or `promoBatchCaptureAuthUrl()` / `e2e-jump.cjs promo-batch-url` for a
  group. A raw observer URL may render while anonymous; `Login to Play` means
  there is no valid distant streaming observer.
- **Renderer-ready is necessary, not sufficient.** A valid promotional frame
  requires the renderer-ready signal _and_ the route-appropriate authoritative
  streaming hook _and_ a confirmed interest-set move to the scene. Gameplay
  routes use the live-player teleport hook; `/at/` observer routes use
  `ClientIo.swapSyncTarget` through `__biomesObserverStreamingDebug`. The
  cinematic camera does not move the terrain/ECS interest set by itself.
- **Never substitute elapsed time for streaming readiness.** Wait for
  `biomes:promo-streaming-ready`, which is published only after the player or
  observer owns its mutation hook. The runner's overall timeout is a failure
  ceiling, not a readiness signal. This rule is source-tested because renderer
  readiness repeatedly arrived before observer authority during Chapter 1.
- **Wait for `status: "complete"`.** A queued request is not a started scene,
  and a started scene is not a finished one. Polling for the tab to load is the
  classic false pass.
- **Split the data URI on `;base64,`, never on the first comma.** Codec MIME
  types such as `codecs=vp9,opus` contain an earlier comma and corrupt the file.
- **A cancelled scene publishes `status: "error"`.** Surface it; do not write a
  blank PNG.
- **Software WebGL is slow.** The runner's default timeout is deliberately
  generous, and `--use-gl=swiftshader` is required on headless hosts.

### Environment requirements (non-negotiable)

Engine capture renders the real game, so it needs the real stack: **Redis, the
unified app (web/sync/logic/trigger/notify), and a Chromium with working
WebGL and its system libraries.** A sandbox without Redis, without Docker, or
without root to install browser deps cannot produce a frame — validate the
scene with `t.sh cutscene` there and capture on a machine with the stack.

Check readiness first: `node scripts/harthmere/e2e-jump.cjs ready`.

Any validated cutscene can run in a non-authoritative capture sandbox. The
capture service injects a deterministic `capture` action at an exact shot time,
forces `clientPuppet`, removes placements and commits, applies staged
camera/actors/FOV before drawing, and renders with a fixed zero delta.

```ts
import {
  downloadCutsceneCapture,
  requestCutsceneScreenshotById,
} from "@/client/game/cutscene/capture_service";

const result = await requestCutsceneScreenshotById("thaedryn-intro", {
  shotId: "roar",
  at: 0.8,
  width: 3840,
  height: 2160,
  format: "image/png",
  filename: "thaedryn-hero.png",
  preempt: true,
});

downloadCutsceneCapture(result);
```

Request the same scene at different dimensions for 16:9, 1:1, 4:5, or 9:16
marketing variants. Results include the data URI, dimensions, camera pose,
definition id, filename, and timestamp.

The renderer clones screenshot matrices before restoring aspect ratio. The
headless camera endpoint accepts width/height, waits for an explicit
renderer-ready signal, reuses its browser, and captures the requested viewport.

### Repeatable local promotional workflow

The checked-in `scripts/b/data_snapshot.py` is pinned to the
`data-snapshot-2026-05-16` release. Start the full local stack against that
snapshot before judging cast identity or Bikkie visuals:

```sh
LOCAL_REDIS_PORT=6391 \
GLITCH_REDIS_PORT=6391 \
GLITCH_REDIS_HOST=127.0.0.1 \
ALLOW_NON_K8_REDIS=1 \
BIOMES_CREATE_LOCAL_DEV_TERRAIN=0 \
BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
NEXT_PUBLIC_BIOMES_ENABLE_HARTHMERE_EXTRA_TOWN=1 \
NEXT_PUBLIC_BIOMES_RENDER_HARTHMERE_RUNTIME=1 \
./b data-snapshot run --no-pip-install
```

The first reference scene lives in
`src/client/game/cutscene/promo_capture.ts`. Load a fixed observer URL with
`cutscenePromo=exotic-matter`. Increment `captureRun` to force a fresh run, and
use `captureAt` to bracket a tool impact without editing or recompiling:

```text
/at/686.5/75/-68.5/-0.1/-2.45?hideChrome=1&allowSoftwareWebGL=1&cutscenePromo=exotic-matter&captureRun=1&captureAt=3.10
```

The page publishes a JSON result in the hidden
`#biomes-promo-capture-output` element. Save both `dataUri` (branded) and
`rawDataUri` (unbranded engine frame). The reference outputs are:

```text
artifacts/cutscenes/biomes-exotic-matter-creation.png
artifacts/cutscenes/biomes-exotic-matter-creation-raw.png
```

Before accepting a frame, verify all of the following:

- The cast id comes from the canonical seed/ECS record and only one renderer
  draws the actor.
- The held tool uses a Bikkie id and remains correctly scaled through the full
  animation arc.
- The actor faces the target; the camera is on a front or three-quarter angle,
  not directly behind the action axis.
- The capture lands after asynchronous VFX materials are ready. Bracket
  `captureAt` in 0.10–0.20 second steps around the impact.
- Save raw and branded frames, and inspect for nearby NPCs, terrain edges, and
  title-safe negative space before calling the shot final.

## Cutscene preview and video export

Authored Harthmere scenes are registered in
`src/client/game/cutscene/harthmere_library.ts`. The Jackie reference scene can
be previewed directly without a temporary component or console command:

```text
/at/535/78/-155/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1&cutscenePreview=jackie-vs-muckers&previewRun=1
```

The hidden `#biomes-cutscene-preview-output` JSON element reports `pending`,
`requested`, `started`, and `finished` (including the finish reason), or
`error`. Automation must wait for `started`; a successful queue request alone
does not prove that required cast binding succeeded.

Record the same scene from the real game renderer with:

```text
/at/535/78/-155/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1&cutsceneVideo=jackie-vs-muckers&videoFps=30&videoRun=1
```

The hidden `#biomes-cutscene-video-output` element publishes a `complete`
payload containing the WebM `dataUri`, filename, dimensions, frame rate,
wall-clock duration, finish reason, and `hasAudio`, or an `error`. The capture
service waits for the actual playback lifecycle and fails immediately if a
scene cancels before it starts.

On localhost, a completed capture is also POSTed to the local-only
`/api/dev/cutscene_video` sink and written directly to
`artifacts/cutscenes/<filename>`. Prefer that file over copying a multi-megabyte
base64 value through browser automation. The `dataUri` path remains useful for
non-local capture clients and debugging.

Chromium can accept a WebGL `captureStream()` while encoding only its first
frame. To avoid that browser edge case, the service captures the postprocessed
engine output into a 1280-wide 2D staging canvas after render events. It reads
up to eight fresh engine frames per second and explicitly feeds them onto the
requested 30 fps MediaRecorder track. Repeated frames keep playback smooth
without making software-WebGL screenshot readback stall the authored timeline.
Every pixel still comes from the game renderer; no image-generation service is
used.

Audio is best-effort. An interactive browser normally records the game mix,
but an unattended browser may block `AudioContext.resume()`. In that case the
video succeeds with `hasAudio: false` instead of hanging or failing the visual
capture.

When saving the WebM payload, find the `;base64,` delimiter. Do not use
`dataUri.split(",")[1]`: codec MIME types such as `codecs=vp9,opus` contain an
earlier comma.

Convert and retime the WebM to a distribution-ready MP4:

```sh
scripts/cutscenes/encode-cutscene-mp4.sh \
  artifacts/cutscenes/jackie-vs-muckers.webm \
  artifacts/cutscenes/jackie-vs-muckers.mp4 \
  15
```

The helper probes the final source packet timestamp, retimes the **complete**
capture to the requested authored duration, emits 30 fps H.264/yuv420p, and
adds `faststart`. If audio exists, it applies the matching `atempo` adjustment
and writes AAC. Retiming matters because software WebGL plus postprocessed
readback may take more than 15 wall-clock seconds to play a 15-second authored
timeline; simply using `-t 15` would clip the final victory beat.

Verify the deliverable before publishing:

```sh
ffprobe -v error \
  -show_entries format=duration,size:stream=codec_name,codec_type,width,height,r_frame_rate,pix_fmt,nb_frames \
  -of json artifacts/cutscenes/jackie-vs-muckers.mp4
```

Expected reference properties are 15.000 seconds, 1280×720, 30 fps, H.264,
`yuv420p`, and 450 frames. Extract a six-frame contact sheet spanning the full
duration and visually verify the opening cast, action beats, impact VFX, and
final pose—not merely the first frame.

### Hex Fireball dodge sequence

The reusable Hex fight reel is authored in
`src/shared/cutscene/hex_fireball_dodge_showcase.ts` and registered as
`harthmere-hex-fireball-dodge-showcase`. It is a 15-second, five-shot sequence:

1. A wide standoff establishes the hero and the authored Hex Wraith beast.
2. The Hex casts Fireball and the hero performs `dodgeRight` while moving clear
   of the projectile's fixed impact point.
3. The hero closes distance, counterattacks, and triggers `combatImpact` on the
   Hex.
4. A reverse angle shows a second Fireball and `dodgeLeft`.
5. A close third Fireball forces `dodgeBack`; the hero then rushes forward for
   a finishing `attack2` and a larger impact beat.

The projectile action uses the named custom hook
`harthmere.cutscene.projectile`. The client hook validates its world-space
origin and target and dispatches the normal
`biomes:harthmere-projectile-visual` event with `projectileVisualId: fireball`.
This keeps the cinematic on the same premium GLB, trail, launch effect, flight
timing, miss effect, lighting, and sound path as gameplay Fireball. Each target
is the hero's pre-dodge position, so the rendered projectile visibly misses
after the movement action starts.

The hero binds the local player while the enemy is a client-only
`/assets/harthmere/glb/bosses/hex_wraith.glb` cinematic puppet. This is the
production Hex Wraith graphic: a tall hollow revenant with a torn cowl,
lantern ribs, orbiting hex tablets, and no visible feet. Do not substitute the
small `npcs/purple_hexer` NPC. `clientPuppet` mode changes only the
local presentation: neither role writes an ECS position, HP, Anima decision,
inventory, quest, or Gaia state. The scene also declares `commitOn: []` and
empty end placements/commits, so previews and video retries are mutation-free.
The stage uses the visually validated Old Grove Road combat clearing at
`[500, 70, -140]`; the nearby `-150` position is terrain-occluded.

The cast role is deliberately named `hex-wraith` and points directly to the
boss GLB. The 15-second authored timeline also uses an 18-second
`maxSceneDurationSeconds` safety ceiling. The director checks that ceiling
before natural completion, so setting both values to 15 can report
`finishReason: aborted` on a slow software-WebGL frame after every authored
shot has otherwise played.

#### Verified capture recipe for this scene

Use the newest atomic image/build, but inspect its creation time and internal
`.next`/`dist` timestamps before starting. Do not assume a previously named
`final` tag is newer. Keep the exact selected image mounted unchanged for the
final visual proof.

This scene binds the real local player, so enter through
`/dev/harthmere-visual-auth` and redirect directly to `/at` without a coordinate
slug. Do not redirect through `/`: the splash redirect drops focused-E2E query
parameters and can silently reconnect to remote Sync. The final `/at` URL must
retain all of these parameters:

```text
hideChrome=1
allowSoftwareWebGL=1
glitch_auto_play=1
harthmere_native_ecs_e2e=1
e2e_run=<unique-run-id>
syncBaseUrl=http://127.0.0.1:<local-sync-port>
```

After visual auth redirects the iframe, reacquire `iframe.contentWindow` or
start only from the redirected iframe `load` event. Never retain the initial
`about:blank` Window object; it will never acquire the game bridge and creates
a misleading three-minute readiness timeout.

The capture preconditions are signals, not sleeps:

1. Wait for `__harthmereNativeEcsE2E.version === "native-ecs-e2e-v1"` and the
   authoritative `__harthmereLivePlayerDebug.teleportTo` hook.
2. Move that real player/streaming authority to `[500, 70, -140]`. A cutscene
   actor teleport or camera move does not move the terrain/ECS interest set.
3. Poll `chapter1TerrainSnapshot` at stage ground `[500, 69, -140]`, hero
   ground `[503, 69, -140]`, and Hex ground `[497, 69, -140]`. All three must
   report a synchronized terrain entity/shard before capture.
4. Wait for `__harthmereProjectileVisuals.loadedIds` to contain `fireball` and
   reject any `failedIds` entry for it. Starting while the rebuilt Harthmere
   renderer is still loading records the custom events but can omit the actual
   projectile mesh and trail.
5. Capture through `chapter1CaptureCutsceneVideo`, which saves through the
   local `/api/dev/cutscene_video` sink. Do not move a multi-megabyte data URI
   through browser automation.
6. Accept only `finishReason: completed`, three
   `biomes:harthmere-projectile-visual` events, a puppet sample whose label is
   `hex-wraith` and asset is
   `/assets/harthmere/glb/bosses/hex_wraith.glb`, and a full-duration contact
   sheet that visibly shows both actors, the dodge displacement, and Fireball
   travel/impact light.

The reusable local harness implementing these checks is
`artifacts/cutscenes/hex-fireball-dodge-capture.html`, served same-origin by
`artifacts/cutscenes/hex-fireball-dodge-capture-proxy.cjs`. It is a test/capture
harness only; the authored scene and production hook remain in source.

For a quick manual preview after those streaming preconditions are already
satisfied:

```text
/at/500/78/-140/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1&cutscenePreview=harthmere-hex-fireball-dodge-showcase&previewRun=1
```

The raw query recorder remains useful for a warm, already-staged page, but it
is not the cold-start acceptance path:

```text
/at/500/78/-140/-0.15/0.1?hideChrome=1&allowSoftwareWebGL=1&cutsceneVideo=harthmere-hex-fireball-dodge-showcase&videoFps=30&videoRun=1
```

On localhost the browser writes the result to
`artifacts/cutscenes/harthmere-hex-fireball-dodge-showcase.webm`. Convert it to
the reusable MP4 deliverable with:

```sh
scripts/cutscenes/encode-cutscene-mp4.sh \
  artifacts/cutscenes/harthmere-hex-fireball-dodge-showcase.webm \
  artifacts/cutscenes/harthmere-hex-fireball-dodge-showcase.mp4 \
  15
```

Before conversion, create and inspect the contact sheet. After conversion,
`ffprobe` must report H.264, 1280×720, 30 fps, `yuv420p`, 450 frames, and
15.000 seconds. A valid container is not acceptance if the opening is blank,
the actors are missing, the Hex is the wrong variant, or no Fireball is visible.

### Boss bodies and magic attacks

Cutscenes and gameplay must use the same authored boss identity and attack
catalogue. Do not create an oversized generic NPC, hand-place a substitute
spell mesh, or reproduce combat timing in the cutscene director.

#### Generate and register the boss body

1. Add the boss to `src/shared/harthmere/boss_visual_assets.ts`. The
   `worldSize` entry is the authoritative collision/render contract in metres;
   it is not decorative metadata. Include the shared `Idle`, `Walk`, `Run`,
   `RangedAttack`, `AreaAttack`, hit, phase, and death clips plus every bespoke
   attack clip referenced by the combat catalogue.
2. Author or update the VOX/GLB with
   `scripts/harthmere/generate_boss_voxel_assets.py`. Keep recognizable cast
   organs, mouths, bells, claws, cores, or hands near the outside of the
   silhouette. The renderer can place VFX on the body surface, but it cannot
   make a completely occluded casting feature readable.
3. Register exactly five attacks in
   `src/shared/harthmere/boss_attack_catalog.ts`. Each entry needs a stable
   `abilityId`, authored body clip, projectile visual id, attack shape, damage
   type, damage, range, hit radius, telegraph/travel time, and cooldown.
4. Use `projectile` only for a graphic that travels from boss to player.
   Beams and cones use the authored attack-shape GLBs; `ground_aoe` belongs at
   the aimed ground point and `self_aoe` belongs around the caster. Generate
   shared shape assets with
   `scripts/harthmere/generate_boss_attack_shape_effects.py` when a new shape
   is genuinely required.

Magic classification follows the attack's authoritative `damageType`, not
only the reused projectile mesh family. This matters when a magical attack
intentionally uses a physical or energy-looking mesh—for example a nature seed
barrage or an arcane projector beam. Such attacks must still receive universal
charge and hit-explosion presentation.

#### Preserve the full magic lifecycle

A boss magic attack has four separate authoritative times:

1. `castTime` starts Native ECS/Anima's cast and the visual charge;
2. `releaseTime` ends the charge and releases the projectile/shape;
3. `impactTime` resolves the aimed hit or miss after the authored travel or
   telegraph duration;
4. `cooldownUntil` controls when Anima may select the ability again.

Do not collapse charge and travel into one delay. The public
`npc_combat_state` projection carries only the sanitized cast fields the
client needs. Private paths, schedules, threat, and the complete `npc_state`
remain server-only.

During charge, the body loops `HarthmereBodyMagicChannel_Aligned_30` (falling
back through `ChannelMagic`, `BasicMagic`, `RangedAttack`, and `Idle`) while the
production projectile runtime creates gathering light, contracting rings, an
authored spell core, and inward-moving voxel particles. At release the body
switches to the attack's catalogued clip and the normal projectile/shape event
is emitted. A successful magic hit then uses the universal flash, expanding
core, shockwave, directional debris, sparks, mist, dust, point light, and
camera-feedback path. Miss, dodge, evade, and out-of-range results must not
create that explosion.

#### Massive-boss edge cases

Never use the bottom-center ECS position directly as the visible cast origin
for a large boss. Thaedryn is `20 × 14 × 58` metres, Ninth Winter is
`14 × 13 × 8`, and Alpha Mucker is `12 × 14 × 11`; a center-origin charge can
be completely buried inside those meshes. Resolve the presentation with
`harthmereBossMagicPresentation()`:

- it intersects the target-facing direction with the boss's horizontal
  elliptical footprint and places charge/projectile VFX just beyond that body
  surface;
- it constrains the origin before a close target, so the spell never begins
  beyond the player;
- it uses volume-based charge scaling capped at `7.5x` and a smaller projectile
  scaling capped at `2.75x`, avoiding both tiny raid-boss spells and
  screen-filling effects;
- self-AOEs use the selected player's direction for the visible charge even
  though their authoritative aim point remains the caster;
- the telegraph may extend to maximum range, but a successful cone's explosion
  is placed at the authoritative aimed player rather than the far edge of the
  cone;
- hit explosions use the attack's authored `hitRadius`, not the projectile
  mesh's generic preview radius. The universal impact profile still applies
  its hard radius, particle, light, and concurrency ceilings.

For a cinematic boss attack, bind the real ECS boss when gameplay authority is
required. A mutation-free showcase may use the authored boss GLB as a
`clientPuppet`, but it must dispatch the same
`biomes:harthmere-magic-charge` and
`biomes:harthmere-projectile-visual` contracts and use the same calculated
origin, attack shape, damage type, hit radius, and target point. Do not animate
a second decorative projectile alongside the production runtime.

#### Boss attack visual acceptance gate

Run the focused source/authority checks first, then the browser lifecycle
audit:

```sh
scripts/harthmere/t.sh file src/shared/harthmere/test/boss_magic_presentation.test.ts
scripts/harthmere/t.sh file src/shared/npc/behavior/test/harthmere_hex_ranged_attack.test.ts
scripts/harthmere/t.sh file src/server/logic/test/harthmere_npc_hit.test.ts
node scripts/harthmere/test-harthmere-premium-projectile-assets.cjs
node scripts/harthmere/test-harthmere-boss-attack-shape-assets.cjs
node scripts/harthmere/serve-boss-magic-lifecycle-visual-audit.cjs
```

The browser gate must cover all eleven live bosses and all forty magic attacks.
For every attack it captures three frames beside the correctly scaled body:
active visual charge, projectile travel or attack-shape telegraph, and the
successful-hit explosion. It also requires a real loaded asset, motion toward
the player for true projectiles, an active shape for beam/cone/AOE attacks,
exactly one magic-explosion counter increment, and nonzero changed-pixel scores
for all three phases. Keep one full-page lifecycle sheet per boss and preserve
the machine result JSON in
`artifacts/harthmere-boss-magic-lifecycle-audit/`.

### Capture troubleshooting

#### Fast operator path

1. Before starting the snapshot stack, confirm that no `next build`, Docker
   production smoke build, or `deploy-production-local-redis-smoke.sh` is
   running in this checkout. Next dev and Next production build both write
   `.next`; running them together corrupts route/runtime output.
2. Start one snapshot stack and one browser capture tab. Use a unique
   `videoRun` value only to force a new page run; do not open several capture
   tabs in parallel.
3. Wait for `#biomes-cutscene-video-output` to become `complete` or for
   `artifacts/cutscenes/jackie-vs-muckers.webm` to appear. A canvas existing is
   not sufficient—the client can still be constructing ECS resources.
4. Make a contact sheet before encoding:

   ```sh
   ffmpeg -y -loglevel error \
     -i artifacts/cutscenes/jackie-vs-muckers.webm \
     -vf "fps=1/5,scale=360:-1,tile=3x2:padding=8:margin=8" \
     -frames:v 1 -update 1 \
     artifacts/cutscenes/jackie-vs-muckers-contact-sheet.png
   ```

5. Reject the take before MP4 conversion if the opening is void/blank, the
   camera is inside terrain or architecture, any required creature is absent,
   or a generic humanoid/ghost stands in for a Mucker. Only then run the MP4
   helper and the `ffprobe` verification above.

- If fresh `/at/...` requests show `missing required error components`, or an
  API route reports `Cannot find module './undefined'` from
  `.next/server/webpack-api-runtime.js`, stop every process writing this
  checkout, stop the snapshot stack, move the generated `.next` directory out
  of the checkout, and restart once. Repeated browser reloads cannot repair a
  mixed production/dev `.next` tree.
- The combat template does not silently manufacture humanoids. A required
  Mucker uses its real ECS entity and native `npcs/*mucker` renderer; without
  an explicitly supplied species-correct ghost asset, failed binding cancels
  the scene. Preserve this rule when adding new combat templates.

- If `/at/...` SSR imports terrain/shape catalogues and fails around
  `definedOrThrow`, a browser scene module crossed the client/server boundary
  through a heavy seed catalogue. Keep scene IDs and identity constants in
  data-only modules such as `snapshot_grove_ids.ts` and
  `live_entity_seed_ids.ts`; dynamically import heavy catalogues only inside
  browser capture functions.
- If humanoid stand-ins appear where Muckers should be, check the lifecycle
  output for cast cancellation/fallback, inspect the actors' current ECS
  positions, and confirm their labels route to `npcs/*mucker` assets. Do not
  paper over the problem with `townsperson_undead`.
- If a WebM is only a few kilobytes or contains one frame, do not record the
  WebGL canvas directly. Use the postprocessed 2D staging-canvas path.
- If the WebM is longer than the authored scene in wall time, preserve it and
  pass the authored duration to the MP4 helper. The helper retimes the complete
  sequence; it does not truncate it.

### Chapter 1 batch-capture lessons

The July 25 Chapter 1 campaign exposed several rules that make a long capture
session both faster and more reliable:

- Generate every fresh batch URL with
  `node scripts/harthmere/e2e-jump.cjs promo-batch-url <group>`. This enforces
  the gated visual login before `/at/` mounts. Do not manually reconstruct the
  nested auth URL; a misplaced `&` changes the username/query and returns 400.
- `__biomesCaptureReady` proves only that the renderer can draw. It does not
  prove that the route can move its streaming authority. Wait for
  `biomes:promo-streaming-ready`; then use
  `__harthmereLivePlayerDebug.teleportTo` on gameplay routes or
  `__biomesObserverStreamingDebug.moveTo` on `/at/` routes, and verify the
  resulting position. That authoritative move is what causes the server to
  stream the distant terrain and ECS set before the camera captures.
- If the page says **Login to Play** or the route-appropriate hook is absent,
  stop before capture. Re-authenticate once and resume the batch; do not take an
  empty frame, do not overwrite passed outputs, and do not repeatedly restart
  the stack.
- Never add a fixed sleep/timeout to "fix" this startup race. The browser
  runner's timeout may terminate a broken run, but only the player/observer
  ready event can authorize capture. The source contract test rejects the old
  30-second polling deadline so this mistake stays fixed.
- Use one page at a time and rotate the page between scenes. A fresh page
  clears cutscene lifecycle state without paying for a stack restart; parallel
  software-WebGL pages exhaust memory and make every take slower.
- Record a 2D staging canvas no wider than 1280 pixels, with even dimensions.
  Composite letterbox bars, subtitles, fades, and the postprocessed engine
  frame into that canvas so the MP4 matches what the player saw rather than a
  raw WebGL surface.
- Feed the staging canvas at the requested frame rate while limiting expensive
  renderer readback. Repeated frames are preferable to stalling the authored
  timeline. A roughly 4 Mbps MediaRecorder bitrate is sufficient for the
  1280x720 capture path.
- Prefer the localhost file sink and a bind-mounted `artifacts/cutscenes`
  directory. Base64 payloads are a fallback; increasing API body limits is not
  a substitute for writing large captures directly to disk.
- Give asynchronous VFX/materials a settle frame before taking a still. For an
  action image, bracket nearby authored times in one batch, inspect a contact
  sheet, and keep the strongest frame instead of restarting the stack for each
  attempt.
- After increasing terrain/building density, validate the entire camera dolly
  against canonical voxel terrain before rebuilding. A clear far waypoint is
  not enough: the near waypoint or the segment between them can enter a newly
  authored wall or roof. The Chapter 1 final-resume contract samples all three
  unfinished winter dollies and rejects any solid voxel intersection.
- The MP4 helper runs ffmpeg with `-nostdin`, uses the final packet timestamp
  rather than container guesswork, applies matching `atempo` when audio exists,
  forces even dimensions and `yuv420p`, and retimes the complete take. These
  constraints prevent background ffmpeg jobs, clipped endings, and players
  that reject odd-sized H.264 video.
- Closing a capture page can abort its final request. Classify that exact
  page-close cancellation separately, but keep other same-origin request
  failures fatal; otherwise a real server error can be hidden as cleanup.

Existing Chapter 1 MP4s and approved stills remain in
`artifacts/cutscenes/`. Further screenshot and cutscene rendering was stopped
at the user's request after those outputs were saved; do not regenerate the
remaining scenes merely to refresh timestamps.

## Chapter 1 fast authoring and review playbook

Chapter 1 is the reference implementation for story cinematics. Its sixteen
registered scenes combine present-day ECS actors, snapshot PlayerMesh
stand-ins, robots, memory stages, hilly world coordinates, dungeon gates,
expressions, voice/subtitle delivery, and outcome-gated story commits. The
detailed visual history lives in
`docs/harthmere/HARTHMERE_CH1_CUTSCENE_AUDIT_2026-07-30.md`; this section is the
repeatable workflow distilled from that audit.

### 1. Establish the story and world contract first

Before writing a camera:

1. Identify the exact quest objective and the authoritative state that must be
   true before the scene starts.
2. Select a real shared anchor from `src/shared/harthmere/ch1_ids.ts`. Harthmere
   is hilly outside the additive town, so never copy a flat Y assumption from a
   different location.
3. Decide which cast members are real ECS entities and which are memory-only
   ghosts. Use canonical entity ids; do not seed or render a second copy of a
   known NPC.
4. Commit story progress before or through the scene's idempotent `onEnd`
   contract. A cinematic is presentation, not the sole owner of quest truth.

For memory interiors, stage the actors and camera inside the measured room
footprint. For gates and exterior reveals, inspect the full camera segment—not
only the final waypoint—against terrain and architecture.

### 2. Bind actors through the native avatar pipeline

Use the real ECS entity whenever it exists:

```ts
{
  role: "jackie",
  binding: {
    kind: "entity",
    entityId: Number(SNAPSHOT_GROVE_JACKIE_ENTITY_ID),
  },
  fallback: "ghost",
  ghostAsset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
}
```

For a known person who exists only as a memory projection:

```ts
{
  role: "lou-memory",
  binding: {
    kind: "ghost",
    asset: SNAPSHOT_CUTSCENE_PLAYER_MESH_ASSET,
    family: "human",
    appearanceSourceEntityId: Number(CH1_NPC_ENTITY_IDS.lou_ardan),
    spawnAt: [...CH1_ANCHORS.memory_corridor_stage],
  },
}
```

The rule is application-wide: humans use the original snapshot/generated
PlayerMesh; animals, robots, Muck creatures, and bosses use their original
native GLTF/Galois rigs. Blender expressions animate those native bodies. A
rounded-box or wardrobe-archetype body is a failed scene even when the camera,
dialogue, and expression are otherwise correct.

### 3. Stage, face, act, then speak

- Put every actor at an explicit mark before a close shot samples them.
- Face the speaking actor at shot start. `moveTo` owns yaw while moving, so add
  another `face` after arrival or at the next shot.
- Start dialogue or an expression about 0.2–0.3 seconds after staging/facing so
  the first readable frame is not a neutral back-of-head pose.
- Use the shared cinematic-expression catalog through normal `emote` actions.
  Choose reactions that support the line; do not use a human emotion clip on a
  robot or a sentimental paired gesture when the blocking says the actors are
  separating.
- Over-shoulder pullout should normally be at least 2.2 metres. Do not use POV
  for a synthetic human ghost unless a deliberate body-free POV is required.

### 4. Keep every scene finite and player-readable

Every shot and the full scene need hard ceilings. Chapter 1 dialogue shots use
`until: { kind: "dialogueDone", maxDuration: ... }` rather than unbounded
waiting. All Chapter 1 cinematics hide the gameplay HUD, preserve letterbox and
subtitle contrast, and restore camera/input/HUD state on completion, skip,
abort, death, or teardown.

Cleanup also owns actor/player presentation and regional audio. Every exit path
must cancel a cinematic emote or facial expression immediately, then restore
music from the visible local player's current region. Do not restart a generic
world theme and wait for the ordinary audio poll: at the Grove fence that
briefly selected the world track even though the player still saw the Grove.
The live regression deliberately starts `ch1-first-gate`, applies `shock`,
stops the scene, and requires both `emoteType === undefined` and
`currentTrack === "grove_music"`.

Stopping or replacing a scene may abort the outgoing regional MP3 fetch. The
Chapter 1 runner classifies only that exact `GET`/`ERR_ABORTED` transition as
cleanup; other same-origin audio failures remain fatal. A product-scenario pass
with that cleanup cancellation is focused evidence, but prefer a clean report
for final release sign-off.

Voice is additive to readable subtitles. Missing audio must never remove or
delay text. Subtitle speaker names must match the actor the camera is showing.

### 5. Test in the fastest safe order

Run one fix batch, then one test batch:

```sh
node_modules/.bin/prettier --check \
  src/shared/cutscene/ch1_scenes.ts \
  src/shared/cutscene/puppets.ts \
  src/shared/cutscene/binding.ts

node_modules/.bin/mocha --config .mocharc.fast.json \
  src/shared/cutscene/test/ch1_scenes.test.ts \
  src/shared/cutscene/test/binding.test.ts \
  src/shared/cutscene/test/client_integration_contract.test.ts

scripts/harthmere/t.sh cutscene
scripts/harthmere/t.sh types:stack
git diff --check
```

If an expression or animation asset changed, also run:

```sh
node scripts/harthmere/test-harthmere-cinematic-expression-assets.cjs
```

Then capture only the affected scene ids. Do not replay Chapter 1:

```sh
HARTHMERE_E2E_CHAPTER_1_CAPTURE_ONLY=1 \
HARTHMERE_E2E_CHAPTER_1_FEATURES=videos \
HARTHMERE_E2E_CHAPTER_1_CAPTURE_IDS=ch1-confrontation,ch1-recon-corridor \
HARTHMERE_E2E_CHAPTER_1_RUNTIME_INJECT=1 \
HARTHMERE_E2E_CHAPTER_1_CAPTURE_FORMAT=frames \
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:<web-port> \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:<sync-port> \
HARTHMERE_E2E_REDIS_PORT=<redis-port> \
HARTHMERE_E2E_STACK_CONTAINER=<container> \
HARTHMERE_E2E_CONTROL_TOKEN=<control-token> \
node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Runtime injection is for camera, staging, dialogue, and expression iteration.
If renderer, binding, PlayerMesh, animation, or asset code changed, the final
visual proof must use one exact-current-source build. Reconciliation is not
needed for that build when terrain did not change.

The scene attempt budget is three source revisions maximum. A failed startup,
missing terrain service, or capture precondition is infrastructure evidence,
not permission to make an unmeasured camera change. Preserve the report and
fix the precondition before the next visible take.

### Chapter 1 scene review checklist

| Scene                        | Required visual/story proof                                                                          | Current source review                                                                                      |
| ---------------------------- | ---------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `ch1-ignition`               | Native AUGUR-9 stands, studies the player, and reacts to the recording; no human robot stand-in.     | Native robot binding, finite shots, expression cues, voice/subtitle and hidden HUD verified.               |
| `ch1-first-gate`             | Jackie and player are readable before the real desert aperture; camera stays above the sloped shelf. | Canonical Jackie with snapshot fallback; gate anchor/cameras and hidden HUD verified.                      |
| `ch1-persistent-gate`        | Rook visibly guards the Mouth and speaks beside the persistent aperture.                             | Entity-backed Rook, native human fallback, terrain-safe static coverage and hidden HUD verified.           |
| `ch1-overlay-ive-got-you`    | External memory coverage shows the rescuer and injured player in the road-house aisle.               | Lou appearance source, grounded memory stage, native PlayerMesh and hidden HUD verified.                   |
| `ch1-recon-arrival`          | Carrier and injured player occupy separate readable marks during the road-house arrival.             | Jackie appearance source, separate movement paths, grounded opening and hidden HUD verified.               |
| `ch1-recon-corridor`         | Woman, player, and man remain in the aisle while the original memory facts play.                     | All human ghosts use snapshot PlayerMesh; Lou identity retained; shared corridor timing verified.          |
| `ch1-recon-corridor-revised` | Identical camera/timing to the original corridor; only identity and interpretation change.           | Same geometry/timing contract; Jackie and Lou appearance sources verified.                                 |
| `ch1-overlay-containment`    | Calla and the exhausted player are both visible when containment is revealed.                        | Entity-backed Calla, native fallback, reaction coverage and hidden HUD verified.                           |
| `ch1-the-flinch`             | Player flinch and Jackie's changing reaction are readable at the desert gate.                        | Canonical Jackie, explicit stage/facing, expression sequence and hidden HUD verified.                      |
| `ch1-confrontation`          | Road-house argument alternates readable Jackie/player coverage without clipping either head.         | Canonical Jackie, snapshot fallback, safe pullout, native-avatar prior acceptance and hidden HUD verified. |
| `ch1-sorrel-door`            | Sorrel is visible at the winter door through recognition, grief, shock, and resolve.                 | Canonical Sorrel, snapshot fallback, grounded winter anchor and hidden HUD verified.                       |
| `ch1-the-case`               | Lou's Returnstone argument and handover remain readable in daylight.                                 | Canonical Lou, snapshot fallback, Returnstone stage and hidden HUD verified.                               |
| `ch1-consolidation-revision` | Lou—not the board—owns the opening; all six revisions and “Seven” remain readable.                   | Canonical Lou, snapshot fallback, explicit stage anchor, HUD now hidden.                                   |
| `ch1-recon-intake`           | Grounded clinic two-shot shows Lou facing the player through the confession.                         | Lou appearance source, grounded road-house memory stage and hidden HUD verified.                           |
| `ch1-too-late`               | Lou's exhausted arrival, argument, and departure remain readable at Returnstone.                     | Canonical Lou, snapshot fallback, daylight stage and hidden HUD verified.                                  |
| `ch1-the-watch-house`        | Jackie is framed inside the measured room, owns the plan, and ends ready to act.                     | Canonical Jackie, snapshot fallback, measured interior cameras and hidden HUD verified.                    |

Before accepting any scene, inspect a contact sheet across its full duration and
confirm: correct native bodies, visible faces, no body/terrain clipping, all
dialogue present, expressions readable, no gameplay HUD/hotbar, no void or sky
opening, neutral recovery, and correct next-state commit. A stale contact sheet
from an older renderer is historical evidence, not current acceptance.

## Edge cases you get for free

Player dies mid-scene → abort through cleanup with no story commit by default.
Client-predicted damage is blocked while `invulnerablePlayer`; a server death
still aborts safely. Actor missing/dead at bind → fallback chain or graceful
cancel. `moveTo` grounds against terrain/water and timeout-teleports under a
fade. Camera role despawns
mid-shot → camera holds/orbits the last-known position, never snaps to origin
or NaNs. Frame hitch → `dt` clamps to 250 ms, and every scene has a finite
global ceiling. Unloaded world → path/cast prewarm gate + fade. Double trigger
→ queue dedupe and bounded queues.
Client teardown mid-scene → `clear()` aborts through the same finish path.
Skip spam / finish-after-skip → the commit token makes end-state application
idempotent.

## Testing

For the fast cutscene-generator lane, run:

```sh
scripts/harthmere/t.sh types
scripts/harthmere/t.sh cutscene
node scripts/harthmere/test-harthmere-cinematic-expression-assets.cjs
```

The expression asset audit checks all 24 player/NPC animation sets, all 70
unique authored clips behind the 71 public ids, valid named-node channels, and
the unchanged channel counts of the production attack clips. Then use one
exact-current-source engine run of `harthmere-expression-showcase`, inspect a
contact sheet spanning its full duration, and reject blank starts, missing
actors, clipped limbs, bad paired spacing, stuck faces, or poses that do not
read from the selected camera.

`./b test -p 'src/shared/cutscene/test/*.test.ts'` covers the schema,
camera math, binding fallbacks, the full runtime state machine (playthrough,
skip, abort, timeouts, holds, idempotency), templates, queue semantics, puppet
animation merging, sandboxed capture, ECS/Anima/Gaia contracts, and client
wiring (script order, input lock, damage gate, music, camera ownership, fades,
capture, bridge merge, resource registration).

When you add a cutscene feature: put the logic in `src/shared/cutscene/` (pure,
effect-emitting), execute the effect in `cutscene_director.ts`, and add a test
beside the logic. The director should stay a thin switch statement.
