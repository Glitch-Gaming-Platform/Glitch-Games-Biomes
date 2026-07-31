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
{ role: "spirit", binding: { kind: "ghost", asset: "townsperson_clergy", spawnAt: [640, 64, -268] } }
{ role: "gate", binding: { kind: "anchor", position: [640, 64, -268], height: 8 } }
```

- `nearestNpc` searches live NPCs around the player (or `near`), by label regex
  and/or **Bikkie** npc type id (`npc_metadata.type_id`).
- `ghost` is a client-only renderer mesh with **no ECS entity** — for
  flashbacks, crowds, stand-ins. Ghosts get negative ids, never carry HP, and
  can never be attacked or persisted.
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
```

Writes `artifacts/cutscenes/<filename>` (branded) and `-raw.png` (unbranded
engine frame), and exits non-zero if the capture did not happen.

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
