# Chapter 1 cutscene visual audit — July 30, 2026

This is the retained visual-improvement log for the Chapter 1 audit. It is
deliberately separate from quest-completion evidence: camera, staging, terrain,
dialogue and gate presentation are verified through focused catalog playback,
not by replaying the Chapter 1 quest campaign.

## Source and evidence

- Catalog: 16 registered Chapter 1 scenes.
- Authored dialogue: all 16 definitions contain their intended dialogue
  actions; 53 subtitle lines are present across the catalog.
- Fresh exact-image capture attempt:
  `artifacts/harthmere-ch1-cutscene-audit-r6b-20260730/1785456401901-50346-report.json`.
- Contact sheets and MP4s: `artifacts/cutscenes/`.
- The attempt reached every Chapter 1 scene. It was intentionally stopped in
  the optional second promo export after the scene evidence was collected. The
  report also retains the separate branded-still timeout.

## Scene-by-scene findings

| Scene                        | Dialogue | July 30 visual finding                                                                                                                                                                                                                                                                                | Required correction                                                                                                                         |
| ---------------------------- | -------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| `ch1-ignition`               | Present  | Establishing shot reads; reaction coverage is too tight and can fill the frame with the player head.                                                                                                                                                                                                  | Increase the reaction over-shoulder pullout.                                                                                                |
| `ch1-first-gate`             | Present  | Direct playback streamed Jackie's seeded Grove body instead of the hilly fence seam; the camera found empty floor and the gate was not active.                                                                                                                                                        | Install the `the_seam` story stage, focus authored/staged positions first, and activate the fence gate renderer.                            |
| `ch1-persistent-gate`        | Present  | Terrain was present but the persistent aperture was absent in direct catalog playback. July 31 source correction adds explicit eye-line dolly orientations and the real gate renderer, but both permitted live attempts stalled before desert terrain readiness under the shared software-WebGL load. | Retain the source/test fix; final exact-source browser batch must confirm the aperture. Do not spend a third iterative attempt.             |
| `ch1-overlay-ive-got-you`    | Present  | Grove NPCs and terrain fragments floated around a sky-stage camera. July 31 attempt 1 proved the Greenlamp coordinate is an outdoor frontage with interface boards, not a corridor.                                                                                                                   | Ground the shared memory stage in the enclosed road-house aisle and use attempt 2 once.                                                     |
| `ch1-recon-arrival`          | Present  | Attempt 1 on the grounded set kept subtitles/actors alive but drifted across unrelated Grove buildings and clipped a wall.                                                                                                                                                                            | Use its own measured road-house exterior approach and explicit outside camera poses; attempt 2 is final.                                    |
| `ch1-recon-corridor`         | Present  | Attempt 1 is grounded and the room/subtitles render, but both memory actors are absent because the woman was on the shell edge and the rear figure directly behind POV.                                                                                                                               | Compress both actors into the visible enclosed aisle without changing timing or camera specs; attempt 2 is final.                           |
| `ch1-recon-corridor-revised` | Present  | Attempt 1 reproduced the original corridor's empty-ghost frames while correctly showing Jackie/Lou revised subtitles.                                                                                                                                                                                 | Log the shared ghost-render integration defect; do not spend a second identical attempt after the original already exhausted the same path. |
| `ch1-overlay-containment`    | Present  | Direct capture began before the Ashline target terrain was ready and mostly showed void/sky/floor.                                                                                                                                                                                                    | Focus the authored reveal anchor and require its terrain shard before recording.                                                            |
| `ch1-the-flinch`             | Present  | First sample is unhydrated; later Jackie/player framing and subtitles are readable.                                                                                                                                                                                                                   | Install the `the_flinch` stage at the aperture and wait for terrain before recording.                                                       |
| `ch1-confrontation`          | Present  | Dialogue coverage is readable, but direct playback uses the current/seeded Grove scene instead of the Road-House beat.                                                                                                                                                                                | Install the confrontation story stage at the Road-House before playback.                                                                    |
| `ch1-sorrel-door`            | Present  | Sorrel/player framing, room and subtitles are readable.                                                                                                                                                                                                                                               | Retain; focused recapture is a regression check only.                                                                                       |
| `ch1-the-case`               | Present  | Lou and all argument lines are readable, but the direct catalog does not guarantee the Returnstone handover stage.                                                                                                                                                                                    | Install the `hear_him_out` stage before playback.                                                                                           |
| `ch1-consolidation-revision` | Present  | The board dominates the POV and Lou can be absent because direct playback has no active `the_word` projection.                                                                                                                                                                                        | Install the `the_word` stage and keep Lou's projected puppet stable for the sequence.                                                       |
| `ch1-recon-intake`           | Present  | Subtitles render, but the scene begins among floating Grove bodies and finishes on sky.                                                                                                                                                                                                               | Use the grounded clinic memory stage.                                                                                                       |
| `ch1-too-late`               | Present  | Lou/player dialogue is readable; direct playback must still reproduce the Returnstone departure beat.                                                                                                                                                                                                 | Install the `watch_him_go` stage.                                                                                                           |
| `ch1-the-watch-house`        | Present  | The camera is inside the player head and Jackie is not framed in the room.                                                                                                                                                                                                                            | Install the `the_whole_plan` Watch House stage before calculating interaction spacing.                                                      |

## Fix batch

1. `CH1_MEMORY_STAGE` now uses `CH1_ANCHORS.greenlamp_clinic`, preserving the
   project's hilly/interior coordinate authority instead of inventing a flat Y.
2. The ignition reaction shot uses a wider pullout.
3. Focused catalog playback installs scene-specific `ch1StageDirections`
   projection for Jackie and Lou and holds it against the normal story poll
   until playback ends.
4. First Gate and Persistent Gate catalog playback activate their real gate
   renderer IDs.
5. Capture focus order is story-staged cast, authored anchors/ghosts, authored
   cameras, then unstaged ECS cast.
6. MediaRecorder waits for the focused terrain shard/seed and one complete
   renderer frame.
7. Same-user capture pages close before their replacement opens, preventing
   stale-session teardown during scene isolation.
8. Current source definitions can be registered into the intact frozen browser
   runtime without rebuilding. The injector resolves the minified cutscene
   library from webpack factory signatures, keeps the selected audit gate
   client-local, and defaults to timed live screenshots/contact sheets instead
   of waiting on MediaRecorder during camera iteration.

## Focused verification contract

No full quest replay is permitted for this work. Recapture only affected IDs
with `HARTHMERE_E2E_CHAPTER_1_CAPTURE_IDS` and require:

- all selected recordings encode and produce contact sheets;
- every dialogue scene visibly displays its authored subtitles;
- memory scenes show grounded clinic staging with no falling camera or floating
  Grove population;
- First Gate and Persistent Gate visibly contain their apertures;
- Road-House, Returnstone and Watch House conversations use their authored
  locations and projected cast;
- no camera begins inside the player or speaker model;
- no capture begins on an unloaded void/sky frame.

## July 31 two-attempt handoff

- `ch1-first-gate`: moved to the measured open shelf at `[543,69,-221]`;
  focused playback proved grass terrain, an open visible aperture, Jackie and
  `You` dialogue. The final sheet still contained local test-world residue and
  wall-heavy composition, so it was logged and closed after the user-directed
  attempt limit.
- `ch1-persistent-gate`: explicit two-metre target and eye-line dolly are green
  in source/unit/type checks. Two live attempts did not pass the desert terrain
  readiness gate while other shared graphics work was active; no third attempt
  is permitted.
- `ch1-overlay-ive-got-you`: attempt 1 proved the Greenlamp coordinate was an
  outdoor frontage with interface boards. The memory set moved to the real
  enclosed road-house aisle at `[474,70,-133]`; attempt 2 proved that terrain
  has a stone floor and oak upper floor, then the browser network changed while
  loading the replacement page. The grounded source/test correction is kept;
  no third attempt is permitted.
- `ch1-recon-arrival`: attempt 1 clipped walls and wandered across unrelated
  Grove buildings. Attempt 2 used an explicit road-house exterior path and
  rendered all three witness lines, but the available terrain still read as
  generic walls/roof rather than a clear carried-arrival tableau. The stable
  camera correction is kept and the remaining world-art gap is logged; no
  third attempt is permitted.
- `ch1-recon-corridor`: both attempts rendered the enclosed room and authored
  subtitles. Attempt 2 moved both ghosts off the shell edge and into the aisle,
  but neither memory actor appeared in the POV frames. This is retained as a
  ghost-render integration gap, not a third staging experiment.
- `ch1-recon-corridor-revised`: one focused attempt reproduced the same empty
  ghost frames with the correct revised Jackie and Lou lines. Because it shares
  the original's identical runtime path, no redundant second attempt was used.

## Unit and contract evidence after the fix batch

- Cutscene suite: 167 passing.
- Chapter 1 suite: 387 passing.
- Native Chapter 1 browser-runner contract: 16 passing.
- Gate assertion batch before scoped typecheck: 394 passing, 1 pending.
- Full repository suite: 5,388 passing, 7 pending; seven failures belonged to
  the concurrently active boss-asset and movement/Anima tasks and were not
  modified by this audit.

## July 31 complete performance rewrite — revision 1 of 3

The user capped every scene at three source revisions. This batch is revision
1 for all sixteen registered scenes. A scene may receive at most two more
changes, and only in response to concrete unit, browser, or rendered-frame
evidence. Rebuilding or replaying the Chapter 1 quest is not an iteration.

| Scene                        | Revision 1 acting/camera intent                                                                                                                    | Corrections remaining |
| ---------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------- |
| `ch1-ignition`               | AUGUR-9 gets up, studies the player, then visibly fails to understand the player's recording.                                                      | 2                     |
| `ch1-first-gate`             | Player recoils from the hot card; Jackie masks fear as uncertainty; the opening frames people before the aperture.                                 | 2                     |
| `ch1-persistent-gate`        | Rook is now an actual cast member, guards the Mouth, and delivers his line in visible over-shoulder coverage.                                      | 2                     |
| `ch1-overlay-ive-got-you`    | Replaces the empty first-person ghost framing with grounded external coverage; the player fears while the rescuer commands movement.               | 2                     |
| `ch1-recon-arrival`          | The carrier pushes through exhaustion while the carried player uses the injury performance instead of a generic sleep clip.                        | 2                     |
| `ch1-recon-corridor`         | External aisle coverage makes the woman, player, and man readable; terror, resolve, beckoning, and stagger support the existing facts.             | 2                     |
| `ch1-recon-corridor-revised` | Uses the original corridor's exact camera, timing, movement, and expression sequence; only identity and already-seen object interpretation change. | 2                     |
| `ch1-overlay-containment`    | Calla is now an actual cast member; the reveal cuts to her shock and the player's exhausted relief.                                                | 2                     |
| `ch1-the-flinch`             | Jackie's shock, nerves, frustration, and exhausted release replace generic talk gestures; the player visibly flinches.                             | 2                     |
| `ch1-confrontation`          | Shame and uncertainty oppose the player's anger and disgust before Jackie settles into resolve.                                                    | 2                     |
| `ch1-sorrel-door`            | Sorrel moves from annoyance through recognition, grief, shock, and deliberate resolve.                                                             | 2                     |
| `ch1-the-case`               | Lou's apology and uncertainty give way to frustration, grief over the homes, and a final controlled demand.                                        | 2                     |
| `ch1-consolidation-revision` | The opening now shows Lou rather than a board-dominated POV; relief collapses into shame when “Seven” lands.                                       | 2                     |
| `ch1-recon-intake`           | Grounded two-shot and Lou-facing coverage replace the floating POV; anger, shame, uncertainty, and apology carry the confession.                   | 2                     |
| `ch1-too-late`               | Lou enters exhausted, admits shame, defends the third choice, loses patience, and ends in defeat.                                                  | 2                     |
| `ch1-the-watch-house`        | Jackie begins exhausted, owns the shame and apology, then finishes ready to act; no sentimental paired gesture contradicts the exit request.       | 2                     |

Cross-scene safeguards introduced in this revision:

- every registered scene must contain a cinematic expression from the shared
  catalog;
- expression cues must reference real cast roles and begin inside their shot;
- Chapter 1 over-shoulder coverage cannot use the model-clipping pullouts that
  previously placed the camera inside the player;
- Rook and Calla dialogue is role-bound to visible, production entity-backed
  cast members with renderer-valid ghost fallbacks;
- the memory scenes that repeatedly lost ghost actors in POV now open with
  explicit, oriented external cameras on the measured road-house aisle.

## July 31 revision 2 — complete catalog playback

All sixteen registered Chapter 1 scenes were played through the real cutscene
director in one capture-only browser campaign. Fifteen scene manifests and
contact sheets were written; `ch1-confrontation` also played and displayed its
line, but the harness rejected the runtime speaker `You` because the source role
was named `b`. That was a harness-normalization defect, not missing dialogue.

Revision 2 grounded the present-day conversations at their authored world
locations, materialized the Road-House and Watch House into authoritative Redis
terrain, added exact entity-to-ghost fallback staging, and captured all six
consolidation ledger rewrites. It also proved the exact Sorrel winter-dungeon
coordinate and the Returnstone handover location. The batch identified the
remaining composition failures used for the final correction: wall-heavy First
Gate coverage, terrain-clipped Persistent Gate cameras, a sky-heavy arrival
opening, corridor movement leaving frame too early, an unstaged consolidation
focus, dark Returnstone scenes, and Watch House cameras inside its shell.

The same batch exposed a renderer precedence bug outside the scene definitions:
authored cutscene orientation was discarded whenever it was truthy, so a native
NPC freshly faced the live player instead of the director target. That is why
several sheets show the featureless back of a head. The native renderer now
groups the ordinary talk-facing fallback correctly, and a focused integration
contract locks the precedence. The frozen July 31 runtime predates that compiled
fix; the final deploy build must provide the visual face-orientation proof.

## July 31 revision 3 — final allowed scene corrections

This is the last source revision permitted for the affected scenes. No further
camera or acting edits are allowed after this batch; any remaining visual issue
is reported rather than iterated again.

- First Gate now covers the sloped shelf and aperture from the open western
  side, above the ridge instead of through the neighboring structure.
- Persistent Gate uses high, static terrain-safe reveal and dialogue cameras.
- Arrival uses a grounded static opening and separate carrier/player movement
  marks so the injured player no longer occupies the carrier's exact path.
- Both corridor renderings slow the same authored movement identically, keeping
  the running woman in frame without violating the revision promise.
- The Case, consolidation, and Too Late use readable Returnstone daylight;
  consolidation includes an explicit non-rendered Returnstone stage anchor.
- The Watch House uses only measured interior cameras and actor marks within the
  materialized room footprint.
- The frame-sequence harness compares dialogue completeness by authored text,
  while preserving runtime speaker labels in each screenshot manifest.

Scenes not listed above were accepted from revision 2 and were not changed a
third time. Final verification is intentionally limited to these corrected IDs;
the Chapter 1 quest campaign will not be replayed.

## Native snapshot avatar correction — renderer fix, not scene revision

The final gate captures exposed a cross-scene renderer defect: memory actors
and temporarily unavailable story cast were visible, but their bodies came from
the later rounded-box `townsperson_*` procedural renderer rather than the May 16
snapshot's NPC/player mesh pipelines. This did not consume a fourth scene
revision because no camera, dialogue, timing, action, or scene definition was
changed.

The application-wide correction is:

- player-like ECS humans render through `/api/assets/player_mesh.glb`;
- synthetic human flashback cast uses that same generated snapshot player mesh;
- animals, Muck creatures, robots, and bosses use original Galois/GLTF rigs;
- the Blender cinematic-expression clips remain attached to those native rigs;
- real ECS actors are never duplicated by the local runtime life renderer;
- procedural NPC construction and procedural visibility fallback call sites
  are disabled; an invalid native mesh is now a release error.

Future cutscene reviews must verify avatar provenance, not only that a body is
present. A block actor with readable expressions is still the wrong actor.

## Final native-avatar browser acceptance — attempt 2 of 3

No scene definition changed during this acceptance pass, so the catalog remains
at its final permitted revision 3. The focused current-source browser report is:

- `artifacts/harthmere-native-ecs-e2e/1785508648623-2630-report.json`;
- `ch1-recon-corridor` contact sheet:
  `artifacts/harthmere-native-ecs-e2e/cutscenes/ch1-recon-corridor-1785508648623-2630-contact-sheet.png`;
- `ch1-confrontation` contact sheet:
  `artifacts/harthmere-native-ecs-e2e/cutscenes/ch1-confrontation-1785508648623-2630-contact-sheet.png`.

The report passed both selected playback groups with no browser failures and
the app container retained restart count 0. Confrontation visibly proves the
May 16 snapshot PlayerMesh route: Jackie and the player have original voxel
faces, hair, clothing, body proportions and authored dialogue. No rounded-box
townsperson or procedural visibility substitute appears. The player's flat red
rear head surface in over-shoulder frames is the back of the original voxel
hair/head, not a missing face; Jackie's face is visible in the reverse angle.

Recon Corridor's accepted sheet is intentionally dominated by the opaque
purple memory-introduction card (“You are in a dark place with a mucky
feeling…”). It proves the scene starts and its text is present, but it is not
used as independent body-provenance evidence. The application-wide native
asset guards, snapshot PlayerMesh URL assertions and renderer typecheck provide
that proof. The earlier empty-ghost composition finding remains logged; the
scene has exhausted its allowed source revisions and is not changed again.

Attempt 1 reached both groups but exposed a product defect before clean
acceptance: negative synthetic ghost ids produced negative mixed-radix avatar
indices, undefined wearable ids and a PlayerMesh query-string crash. The
variant modulo is now normalized into the valid non-negative range and has
direct negative-id coverage. Attempt 2 passed. No third attempt was used.

## Final deterministic evidence

- Full repository unit suite: 5,504 passing, 7 pending, 0 failing.
- Native Chapter 1 browser-runner contract: 17 passing.
- Final native-avatar, ECS-bridge, negative-ghost and runner batch: 59 passing.
- Renderer scoped TypeScript project: passing.
- Production-safe mixed-scene routing guard: passing. An unmarked mixed stock-
  material root choosing the renderer's `three` pass is not the prohibited
  procedural Three.js NPC pipeline; marked PlayerMesh roots remain coerced to
  the native base pass.

## July 31 production-world follow-up (not a scene revision)

The post-cutscene live review identified three world/UI defects outside the
locked scene definitions. None changes a cutscene camera, dialogue line,
timing, expression or action, so the three-revision cap remains intact.

- `roadhouse_sign` shared `[474,70,-137]` with `roadhouse_door`, physically
  blocking the spare-house entrance. The sign is now beside the east façade at
  `[481,70,-136]`; the prop seed version is advanced and a clearance regression
  prevents another sign/door overlap.
- The May snapshot still contained obsolete Jackie, Ranger Jane, Luis, Taye
  and Rosalyn entities beside their canonical Grove seeds. Production
  reconciliation now validates the five known legacy IDs, protects player
  rows, deletes only matching obsolete NPC selves from primary and HFC ECS,
  and verifies absence. Maps, NUX and new quest targets use canonical IDs;
  immutable old trigger leaves remain compatible through explicit identity
  aliases. Committed voice recordings retain their historical actor key and do
  not require paid regeneration.
- Ordinary Chapter 1 speech now uses the original in-world
  `TalkDialogModal`/`GenericTalkDialogModalStep` presentation. The custom
  centered dark panel is removed for regular dialogue; authored choice and
  text-entry decisions remain modal.

Live acceptance for this follow-up is deliberately deferred until one
exact-current source build is available. It consists only of Road-House entry,
canonical NPC uniqueness, original dialogue presentation and the retained
Sophia-only checkpoint—never another full Chapter 1 quest replay.
