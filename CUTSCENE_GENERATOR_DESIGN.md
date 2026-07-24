# Harthmere Cutscene Generator — Design and Implementation

Date: 2026-07-24. Codebase survey, architecture, and implemented runtime contract for a standard, data-driven cutscene system.

> **Implementation status:** The generator, pure runtime, templates, client
> director, actor puppet bridge, dedicated cinematic fade/UI, ECS/Anima
> integration, promotional screenshot and video capture, MP4 export,
> validation, and test suite are implemented. `docs/cutscenes.md` is the
> authoritative authoring/API guide;
> this document retains the original design rationale and records where the
> production contract became stricter than the proposal.

---

## Part 1 — What the engine already gives us

The good news: **~70% of a cutscene system already exists** in the codebase as disconnected pieces. The design below is mostly a "director" layer that orchestrates them.

### 1.1 Camera (strongest asset)

| Capability                      | Where                                                                              | Notes                                                                                                                                                                                                                                                                                                                   |
| ------------------------------- | ---------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Total camera override**       | `CameraScript.tick()` — `/scene/waypoint_camera/active`                            | First check in tick; when active, position+orientation are taken verbatim and _all_ other camera logic is bypassed. This is our cutscene camera slot.                                                                                                                                                                   |
| **Keyframed camera paths**      | `interact/items/waypoint_cam.ts`                                                   | Already builds Three.js `VectorKeyframeTrack` + `QuaternionKeyframeTrack` with smooth position interpolation, slerped rotation, and speed-based timing via `AnimationMixer`. This is a working dolly/crane/tracking-shot engine — it just needs to be extracted from the hand-held camera item into a reusable builder. |
| **Smooth target transitions**   | `CameraTargetObject` in `camera.ts`                                                | 500ms eased transitions between tracked objects, with `onEnter`/`onAfterTick`/`onExit` hooks.                                                                                                                                                                                                                           |
| **Auto-framed dialogue camera** | `camera.ts` `talkingToNpc` branch                                                  | Already computes an over-the-shoulder two-shot: pull-out ratio 1.8×, azimuthal offset π/8, frames NPC at 5/6 height. Reusable as the "conversation shot" template.                                                                                                                                                      |
| **FOV, shake, far-plane fade**  | `camTweaks.fov` + `/scene/camera_effects` (shake) + `doFarPlaneFadeInTransition()` | FOV push-ins, impact shake, and world fade-in all exist.                                                                                                                                                                                                                                                                |
| **Fixed / isometric cam**       | `fixedCameraTick`                                                                  | Static locked-off shots.                                                                                                                                                                                                                                                                                                |
| **Easing/transition toolkit**   | `util/transitions.ts`, `bezier.ts`, `math/easing.ts`, `slerpOrientations`          | Bezier, smooth-constant, fixed-duration Vec3 transitions — everything needed for ease-in/out camera moves.                                                                                                                                                                                                              |

### 1.2 Screen & HUD

- `/canvas_effects/hide_chrome` — hides the entire HUD (consumed by `BiomesChrome.tsx`). Cutscene = set true.
- `/canvas_effect` — full-screen effects: `warp` (fade cover with `onBeginningFinished` callback — perfect for hard cuts and scene entry/exit), `bw`, `tvStatic`, `wakeUp`, `worldLoad`. A `fadeToBlack` variant is a trivial addition to this union.
- Letterbox bars don't exist yet — small React overlay, same pattern as `CanvasEffects.tsx`.

### 1.3 Actors — how each entity class can be puppeteered

| Actor class                                               | Control path                                                                                                                                                                                                                                   | Cutscene implication                                                                                                                                                                                                           |
| --------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Player**                                                | `/sim/player` resource writes (camera script already writes orientation this way); `eagerEmote()`; `warpToPosition()`                                                                                                                          | Fully drivable client-side. Input lock needed (see edge cases).                                                                                                                                                                |
| **ECS NPCs (villagers, quest NPCs)**                      | `SetNPCPositionEvent` (server-authoritative teleport/orient, handler in `handlers/npc.ts`); `become_npc.ts` proves streaming positions at a 100ms throttle works smoothly, incl. physics-correct walking via `moveBodySimple` + `walkingForce` | Two modes: **server-driven** (visible to all players, uses the event) and **client-only puppet** (visual override in the render layer, invisible to others, zero server load).                                                 |
| **Live-bridge creatures (muckers, animals, hexes, boss)** | `harthmere_live_creature_bridge_script.ts` publishes per-entity records every 0.25s; renderer interpolates                                                                                                                                     | Cutscene director can publish override records into the same bridge — monsters move exactly like they do in gameplay, no new render path.                                                                                      |
| **Server AI brains**                                      | `src/shared/npc/behavior/*` — meander, patrol, pathfinding, schedule (hour-of-day + anchors: stand/sit/sleep/work/shop_counter/guard_post), chase_attack, flee, socialize                                                                      | Authorized shared movement refreshes a short `cinematicPauseUntil` lease in `npc_state`; Anima merges the external state, zeros velocity, and yields while the lease is active. Client-puppet scenes do not disturb server AI. |
| **Temporary/ghost actors**                                | No system yet                                                                                                                                                                                                                                  | Client-side spawn of a renderer mesh with no ECS entity (same trick the live-creature renderer uses). Needed for flashbacks, crowds, "actors" that shouldn't persist.                                                          |

### 1.4 Animation

- Player/NPC **emotes**: `zEmoteType` — attack1/2, dance, wave, sit, eat, drink, point, laugh, applause, flex, rock, sick, splash, warp, fishing set, digging, watering, equip/unequip. Triggered instantly client-side via `eagerEmote` (server short-circuits `emoteEvent`, so it's cheap).
- **Harthmere NPC runtime set** (`animation_runtime_contracts.ts`): vendorIdle, talkGesture, questGesture, sit, eat, drink, sleep, workLoop, crowdEmote — plus locomotion (idle/walk/run/attack) auto-selected from velocity in `resources/npcs.ts`. Moving an NPC automatically animates it correctly. **This means a "walk to X" cutscene action needs no animation work at all.**
- `timeline_matcher.ts` exists for syncing animation timelines.

### 1.5 Dialogue

- `TalkDialogModal` / `TalkToNPCScreen` — typewriter dialog text, voice support, multi-step bundles. The camera auto-frames when `localPlayer.talkingToNpc` is set.
- Harthmere de-templated per-NPC dialogue already in place.
- For cutscenes we want a **non-modal subtitle bar** variant (speaker label + line + optional auto-advance), reusing the same text pipeline.

### 1.6 World state

- **Time of day**: `tweaks.overrideTimeOfDay` + `tweaks.timeOfDay` (0–100) already override the sun/moon client-side (`sky.ts`); night-vision does the same trick. Cutscene "shoot this scene at dusk" = set override, restore after. Purely visual, per-client — ideal (no world clock mutation).
- **Audio**: `AudioScript` + `audioManager.playSound`; background music already switches contextually (battle_music / muck_music / music by combat+muck state). Add a "cutscene music override" input to `selectBackgroundMusicTrack` — same precedent as combat music.
- **Weather/particles**: `particles.ts` script + `particles_systems.ts` for VFX beats.

### 1.7 Triggers (where cutscenes start)

Existing hook points, all client-side where Harthmere logic already lives:

- Quest runtime: `advanceHarthmereQuestObjective` / `completeHarthmereQuest` (+ party variants) — quest-start/quest-complete scenes.
- Dialogue steps (offer → accept) — scene before/after a conversation.
- Boss spawn: Thaedryn encounter (`thaedryn_boss.ts`) — boss-intro scene.
- Interaction (F on object), location entry (trigger volume — small new utility over position checks), item use, respawn/wake-up (`WakeUpScreen` precedent).

---

## Part 2 — Proposed architecture

### 2.1 Shape: declarative **shot list**, not raw keyframes

A cutscene is data (zod-validated JSON/TS), structured as **Scene → Shots → parallel Actions**. Shots map 1:1 to film shots (the unit a human or AI author thinks in); raw keyframe tracks are compiled from them at runtime. This keeps authoring easy and lets templates encode cinematography rules (rule of thirds, over-shoulder framing, start-late-end-early).

```
CutsceneDef
├─ id, name, version
├─ settings: skippable, lockPlayer, hideHud, letterbox,
│            timeOfDay?, music?, invulnerablePlayer, pauseNpcBrains[]
├─ cast: RoleBinding[]        // "elder" → byId | nearestNpcType | player | ghost(template)
├─ shots: Shot[]              // sequential
│   ├─ camera: CameraSpec     // static | dollyWaypoints | orbit(target) | trackEntity |
│   │                         // overShoulder(a,b) | pov(actor) | conversationAuto
│   ├─ duration | until: "dialogueDone" | "actorArrived" | "playerInput"
│   ├─ transitionIn: cut | fade | warp | blend(ms)
│   └─ actions: Action[]      // parallel, each with startOffset
│       moveTo | teleport | face | emote | animation | dialogueLine |
│       sfx | music | vfx | shake | fov | timeOfDay | wait | custom(hook)
└─ onEnd: EndState            // final placements + world-state commits (idempotent)
```

### 2.2 Runtime: `CutsceneDirector` client Script

A new `Script` registered in `init_renderer.ts` **before** `CameraScript` (script order = write-before-read of `/scene/waypoint_camera/active`). Per tick it:

1. Advances the timeline clock (`dt`-driven, pausable).
2. Evaluates the active shot with the shared deterministic camera math and
   writes `/scene/waypoint_camera/active` before `CameraScript` ticks.
3. Drives actors via per-class **ActorDrivers** (player writer, ECS-NPC streamer, bridge-creature publisher, ghost renderer).
4. Feeds the subtitle/letterbox overlay via a new `/scene/cutscene` resource (React consumes it like every other overlay).
5. On every exit: restores camera, HUD, time-of-day, music, actor authority,
   and invulnerability. It applies `onEnd` only for outcomes listed in
   `settings.commitOn` (default: completion and player skip).

New resource: `/scene/cutscene` — a stable UI/control state containing active
definition id, input and invulnerability ownership, subtitle/music/HUD state,
skip/advance readiness, and dedicated fade opacity. Player, interaction, and
camera-HUD input paths consult it directly.

### 2.3 The "generator" — three authoring layers

1. **Templates (the actual generator).** Parameterized scene archetypes that compile to shot lists from live world data (entity positions, landmark tables, anchor system):
   - `conversation(a, b, lines[])` — establishing two-shot → alternating over-shoulders → reaction close-ups. Reuses the existing NPC-cam math.
   - `bossIntro(boss, playerPos)` — fade in → low-angle orbit of boss → boss emote/roar + shake → whip to player → control handoff. (Thaedryn is the first customer.)
   - `questComplete(npc)` — NPC talkGesture/questGesture, reward VFX, short push-in.
   - `establishingFlyover(landmark)` — crane-down dolly from computed waypoints around a landmark AABB; terrain-collision-checked.
   - `reveal(object)` — slow dolly + fov tighten onto an object/door/crate.
     Because templates compute waypoints at runtime, one definition works wherever the actors happen to stand — this is what makes it a _generator_ rather than a bespoke-scene tool.
2. **Declarative JSON** for hand/AI-authored bespoke scenes (85-quest catalog: each `bible_quest_*` can name a cutscene id for offer/complete).
3. **In-game recorder** (later phase): the existing waypoint-cam item records camera paths; `become_npc` records actor paths. Serialize both into a `CutsceneDef` — machinima-style authoring with zero new interaction code.

### 2.4 Implemented files

```
src/shared/cutscene/schema.ts            zod CutsceneDef/Shot/Action/CameraSpec
src/shared/cutscene/templates.ts         scene archetype compilers
src/shared/cutscene/library.ts           registry, bounded queue, preemption
src/shared/cutscene/binding.ts           ECS/player/ghost/anchor cast resolution
src/shared/cutscene/director_core.ts     pure timeline and effect state machine
src/shared/cutscene/puppets.ts           renderer-bridge override merge
src/client/game/scripts/cutscene_director.ts client engine effect executor
src/client/game/cutscene/cutscene_service.ts registration, requests, hooks
src/client/game/cutscene/capture_service.ts deterministic promo still API
src/client/game/cutscene/video_capture_service.ts engine WebM recorder
src/client/game/cutscene/harthmere_library.ts authored registry/query tooling
src/client/game/cutscene/client_bindings.ts live ECS world index
src/client/game/resources/cutscene.ts        /scene/cutscene resource
src/client/components/CutsceneOverlay.tsx    fade, letterbox, subtitles, controls
scripts/cutscenes/encode-cutscene-mp4.sh      complete-timeline H.264 export
```

Touch points include `init_renderer.ts` (script registration), `camera.ts`
(waypoint cameras still receive shake/projection updates and hand off cleanly),
`BiomesChrome.tsx` and `CutsceneOverlay.tsx` (dedicated HUD/fade/letterbox),
audio selection, player/interact input gates, the live-creature bridge, and the
server NPC movement handler/Anima state merge.

---

## Part 3 — Edge cases and how the design handles them

**Player & combat**

- _Damage/death mid-scene_: the settings flag blocks client-predicted damage for
  the duration. If authoritative HP reaches zero anyway, the scene aborts,
  cleans up, and does **not** apply story commits unless `commitOn` explicitly
  opts into `aborted`. Never trap a dead player in a cutscene.
- _Input during scene_: movement, interaction, attack, and gameplay screenshots
  are gated through `/scene/cutscene` while `lockPlayer` is enabled. ESC requests
  skip; Space/Enter/click is consumed only while a `playerInput` shot is ready.
- _Player mid-air / swimming / on fire at trigger time_: director snapshots player physics state, zeroes velocity, optionally teleports to a scene mark; restore or keep end-mark on exit.

**Actors**

- _Cast member missing or dead at bind time_: binding fallback chain — exact id → nearest of npcType → spawn ghost stand-in → if `required`, cancel scene gracefully (skip to `onEnd`); never a half-cast scene.
- _NPC brain fights the director_: trusted `serverShared` movement refreshes a
  short pause lease that Anima observes; `update_spawn: false` preserves the
  spawn/schedule anchor. Client-puppet scenes never compete with server AI.
- _Bridge-creature throttle (0.25s publish)_: director publishes its own records each tick during a scene — smooth without touching the gameplay throttle.
- _Walk-to that can't path (blocked/gap)_: per-action timeout → grounded
  teleport under the dedicated cinematic black fade, or skip according to the
  action policy. `until: actorArrived` is valid only with a matching `moveTo`
  and always has a max duration.

**Camera & world**

- _Waypoints inside terrain / behind walls_: the client resolves sampled camera
  poses against loaded terrain and nudges upward up to a bounded limit; if no
  safe pose is found, the prior valid camera pose is held.
- _Unloaded shards at a far camera target_: check `allAabbShardsLoaded` (become_npc precedent) / preload; cover load with fade; cap first shot ≥ far-plane fade-in duration (the world-fade-in transition exists).
- _Time-of-day restore_: the tweak override is client-visual only. The director
  restores its snapshot only if no newer user/night-vision change has taken
  ownership while the scene was active.

**Multiplayer & sync**

- _Who sees it?_ Client-only puppet mode (default): other players see nothing unusual (NPCs briefly idle). Server mode (shared scenes): `SetNPCPositionEvent` stream is visible to everyone — only for party/world moments.
- _Second player interferes with a cast NPC_: cast members flagged non-interactable during scene (client cursor already routes through interaction gating).
- _/sync reconnect mid-scene_ (known live failure mode — reconnect cancels in-flight publishes): all `onEnd` world-state commits must be **idempotent and retryable**, and the scene must never block on a server ack to advance visuals. Visual-first, commit-after is the rule.
- _Live-mode write latency (4–29s observed)_: never put a live-mode mutation on the critical path of a shot. Fire-and-forget with the client instant-feedback layer, exactly like harvest/eat already do.

**Flow**

- _Skip_: cleanup is shared with every exit path. End placements/commits run
  only when the finish reason is listed in `commitOn`; defaults are
  `completed` and `skipped`. Commit tokens are marked only after successful
  work and transient failures are retried.
- _Cutscene triggers while another is active_: queue or drop by priority field; never overlap.
- _Save/disconnect mid-scene_: scenes are not persisted as "in progress"; on reload the trigger's quest state decides — either replay or treat as skipped (`onEnd` committed transactionally with the triggering quest step where possible).
- _Accessibility_: subtitles use an ARIA live status region, speaker labels are
  always rendered, and skip becomes available after the configured delay even
  for initially unskippable scenes.

---

## Part 4 — Delivered implementation

1. **Core/runtime:** bounded Zod schema, semantic validation, deterministic
   effect-emitting state machine, queue/preemption, camera math, prewarm, and
   outcome-gated cleanup/commit contracts.
2. **Actors/systems:** player, ECS NPC, static ECS target, anchor, and ghost
   bindings; renderer puppet overrides; procedural animation; authorized shared
   positioning with Anima pause leases; terrain grounding and Gaia-safe visual
   time override.
3. **Presentation:** camera ownership/handoff, FOV and shake, dedicated fades,
   HUD/letterbox/subtitles, music/spatial SFX, input/damage gates, and bounded
   player-input shots.
4. **Generation:** conversation, boss intro, quest completion, establishing
   flyover, reveal, and reusable hero-versus-creatures templates plus trusted
   registered and inline APIs. The first combat reference is the exact
   15-second `jackie-vs-muckers` scene.
5. **Promotional capture:** exact-timeline `capture` actions, sanitized
   client-only capture scenes, fixed-delta high-resolution renderer draws,
   download helpers, a readiness-aware dimensioned headless endpoint, native
   Bikkie held-item attachments, and query-tunable impact-frame bracketing.
6. **Video export:** direct registered-scene preview/recording URLs, real
   postprocessed game-frame capture through a reliable 2D staging canvas,
   lifecycle-aware failure reporting, best-effort game audio, WebM output, and
   full-timeline H.264/yuv420p MP4 retiming with faststart.
7. **Verification:** focused unit/contract tests cover schema, binding, camera
   math, runtime exits, templates, queues, puppets, capture sanitization,
   ECS/Anima/Gaia authorization, input, fades, and renderer wiring.

The first production reference shot binds the canonical Ashline refinery owner
as a real ECS entity, renders the generated native avatar rather than a
procedural human duplicate, attaches the Bikkie pickaxe to the authored avatar
equipment socket, runs `smithWork`, and layers engine-native Exotic Matter VFX.
The capture remains `clientPuppet`, so the promotional pose never mutates ECS,
Anima schedules, Gaia terrain, spawn anchors, or shared story state. The
repeatable operator workflow and troubleshooting checklist live in
`docs/cutscenes.md`.

The Jackie combat reference binds a co-streamable cluster of three canonical
Road Muckwad ECS entities from the installed May 16 snapshot, routes their
labels to the original Biomes Mucker GLTFs, and keeps `NpcRenderState` as the
sole visual owner. Missing required creatures cancel instead of falling back
to a generic humanoid. The sequence uses native Muck Buster equipment,
attack/hit/death reactions, impact VFX, camera shake, and a 4/6/5-second
encirclement/exchange/finisher structure. It remains `clientPuppet`, so ECS HP,
drops, Anima AI, Gaia, transforms, spawn anchors, and shared state are untouched.

The video path records the actual postprocessed game output. Because Chromium
can encode only one frame from a direct WebGL `captureStream`, render events
feed engine screenshots into a 2D recording canvas. Software-WebGL readback may
slow wall time, so the checked-in encoder uses source packet timestamps to
retime the complete capture to the authored duration instead of clipping the
ending.

An in-game path recorder remains a separate authoring convenience, not a
runtime requirement.

---

## 2026-07-24 video handoff

- The generic humanoid fallback is removed from the Jackie combat path.
  `heroVsCreaturesCutscene` uses a ghost only when the caller explicitly
  supplies a species-correct ghost asset; otherwise a missing required Mucker
  cancels cleanly. The seeded Road Muckwads route through their original
  `npcs/seedy_muckling` assets and the native NPC renderer.
- Rejected humanoid and bad-stage captures are isolated under
  `artifacts/cutscenes/rejected-humanoid-fallback/` and must never be promoted
  as deliverables.
- The latest engine take is retained as
  `artifacts/cutscenes/jackie-vs-muckers-native-cast-draft.webm` with a sibling
  draft contact sheet, not a final MP4. Its later frames show the native combat
  cast, but the sampled opening begins in empty/void space, so it needs one
  clean recapture before encoding.
- The largest avoidable delay was a production `next build`/Docker smoke run
  sharing `.next` with the dev web server. That produced Next's “missing
  required error components” page and `Cannot find module './undefined'` API
  failures. The authoritative prevention/recovery checklist is the **Fast
  operator path** in `docs/cutscenes.md`.
- The local capture sink now writes completed WebM data directly to
  `artifacts/cutscenes/`; future operators should not extract the base64 payload
  through browser-control output.
