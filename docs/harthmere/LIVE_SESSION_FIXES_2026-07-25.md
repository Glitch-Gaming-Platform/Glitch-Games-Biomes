# Live Session Fixes — 2026-07-25

Five issues raised from a live production session, with the HAR
(`www.glitch.fun-…har`, 312 MB) and browser console log as evidence.

**Result:** focused quest/UI/type batches pass; Busted is completeable through
every authored action; the dedicated Quests UI has a green production-browser
report; all 31 Chapter 1 quests / 80 objectives have retained live-browser
passes ending in `1784986267883-76489-report.json`; and Cloud Save now restores
the server-authoritative live actor instead of only browser compatibility
state. Retained reports are listed below so passed paths are not replayed.

---

## What the HAR actually showed

Reading the capture before writing any code changed two of the five fixes.

| Observation                     | Count / value                                                                                                                                                 | What it means                                                                                                               |
| ------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| `api/glitch/harthmere`          | 301 calls                                                                                                                                                     | The Glitch bridge is alive and restoring                                                                                    |
| `live_mode_player_status_state` | 120 calls                                                                                                                                                     | HUD reads come from **server Redis**                                                                                        |
| `live_mode_quest_state`         | 54 calls                                                                                                                                                      | Quest log reads come from **server Redis**                                                                                  |
| `api.glitch.fun/.../events`     | 7 calls                                                                                                                                                       | Only platform events — `game_iframe_loaded`, `load_success`, `game_first_interaction`. **Zero in-game behavioural events.** |
| Quest state payload             | `active: {building_system_intro…, tools_before_treasure, road_ready_bag_check}`, `completed: {fountain_buttons_first, read-the-jobs-board}`, `playerLevel: 1` | The exact run that was lost                                                                                                 |
| Actor                           | `glitch:43af071c-…`, install `25f687dd-…`                                                                                                                     | Login-backed, so Cloud Save is permitted                                                                                    |

The console log is dominated by React #418/#423 hydration warnings from
`www.glitch.fun`'s own page shell (not the game build) plus ad-tag noise.

---

## 1. Progress lost on every deployment

**Root cause.** Cloud Save was present, but both restore targets were wrong.

The bridge restores the latest save on boot into the **browser's localStorage
compatibility cache** (`harthmere_glitch_bridge.ts` → `applySnapshot`). But as
the HAR proves, the live client reads quest/level/status from **server Redis**.
A deploy resets Redis; the server then serves an empty player record; the HUD
and journal render a fresh level-1 player; and the restored localStorage is
treated as stale. The durable save existed the entire time — the player just
never saw it again.

There was also a second server-side actor split found by the live browser gate.
The authenticated request authorized the numeric Biomes user, while all
`live_mode_*` readers intentionally prefer the stable `glitch:<account>` actor.
The first rehydration integration therefore populated a healthy numeric Redis
record while the HUD, inventory, and quest APIs kept reading an empty stable
actor. Authorization and storage identity are now separate: the numeric link
proves that the signed-in user owns the install, then the existing live-mode
actor planner selects the durable Glitch gameplay actor.

If an older build already left meaningful progress under that numeric actor,
login performs a conservative one-time copy into the stable actor before
consulting Cloud Save. It runs under the target actor lock, only when the
target has no meaningful progress, preserves the numeric source as a rollback
copy, and rebinds only the player actor identity. Authored quest, challenge,
objective, and item IDs remain unchanged string keys.

**Fix.** `harthmere_cloud_save_rehydration.ts` plus the authenticated
`listSaves` proxy path implement server-side rehydration. During login the
server fetches the latest valid slot-0 save and seeds the selected live actor
before normal live-mode polling continues. This finally honours the documented
authority model ("Cloud Save is the durable player record; Redis is
resettable") instead of only letting the browser cache benefit from it.

Safety rails, all tested:

- **Live progress always wins.** Rehydration only fires when the record is
  missing or empty. It is disaster recovery, not a sync channel.
- **Guests refused** — Glitch returns `GUEST_NOT_ALLOWED` for guest saves.
- **Version marker** (`rehydratedFromCloudSaveVersion`) so a player who resets
  their own progress isn't endlessly re-seeded; a _newer_ save still applies.
- **Corruption is survivable.** A bad reputation blob must not cost the player
  their quest log, so sections are parsed independently.
- Chapter 1 rides along automatically: `ch1_*` flags/ledger live inside
  `questState`.
- Slot 0 is the only gameplay snapshot considered for restore. Slot versions
  are scoped per slot, so slot 90's compatibility-store version must never be
  compared with slot 0's gameplay version.
- Pre-encoded slot-90 saves keep their original payload and checksum, and learn
  the returned server version so later writes do not remain pinned to
  `base_version: 0`.
- A 409 pauses autosave and surfaces the conflict; it is never silently
  resolved with `keep_server`.
- The live Glitch payload limit is **50 MB decoded**, not the stale 10 MB value
  in the pasted integration notes. The API accepts Base64/JSON framing up to
  72 MB while independently enforcing the 50 MB decoded-byte ceiling and a
  canonical Base64/checksum contract.

## 2. No event tracking on the new content

The HAR showed **zero** in-game behavioural events. `ch1_analytics.ts` adds the
full catalogue, following the Glitch doc exactly (stable machine keys, labels
in their own fields, funnels built from `step_key` only, no PII in metadata):

- 12 step keys: ignition, six acts, both gates, both dungeons, ending
- Events for act start/complete, per-quest completion, fragment recovery,
  latent-skill unlocks, the dosing stop/resume beats, gate provisioning
  blocks, zone reached, boss defeated, member downed, exit complete/blocked,
  both puzzles, the ledger handover, and the ending choice
- 3 dashboard funnels: story progression, and one per dungeon

Emission rule documented in the module: fire on the **server-confirmed**
transition, not the optimistic client action — the deploy-loss bug is exactly
what client-only state is worth.

## 3. "Recover Some Muck Busters" — no F prompt (quest-blocking)

**Root cause.** Busted's sunken chest is an _original-snapshot container
placeable_: it has `placed_by` set and its item is a real container with its
own aimed overlay. `overlays.ts` deliberately skips such entities in the
proximity scanner so the richer cursor-ray overlay wins — but the chest sits
underwater inside the hull, where the ray hits hull, water, or terrain first.
The aimed overlay never fires, the proximity path skips it, and the
Water-logged Muck Buster can never be collected.

Road Ahead works because its containers are authored _frame_ placeables with a
`quest_giver` and no container overlay of their own — a different code path
entirely, which is exactly why one quest worked and the next didn't.

**Fix.** `isNativeQuestContainerLabel()` covers every physical native-quest
container (Busted's chest + all Road Ahead ones), and the proximity scanner
exempts them from the `placed_by` skip and terrain-occlusion rejection. The
close-container facing contract tolerates normal swimming yaw drift, and
`nativeQuestGiverUsesEcsDialogue()` excludes every native quest container so a
snapshot `quest_giver` marker cannot suppress the real container modal.
Discovery widens only — the server still enforces authoritative range and step
validation on open.

**2026-07-26 direct-hit follow-up.** The first repair covered the proximity
scanner but missed overlay priority when the cursor ray landed directly on the
chest. In that pose the generic placed-container branch returned before the
Harthmere quest-container interaction could add its F shortcut. The direct-hit
branch now exempts native quest containers too. The focused E2E no longer
rewrites the chest's label, position, placeable item, or quest-giver marker
before checking the prompt; it first asserts those untouched snapshot
components and therefore cannot mask this class of regression again.

**2026-07-26 inventory-sync follow-up.** A live KeyF run then exposed the next
handoff race: the native-container HTTP request had successfully created and
filled the private ECS chest, but the modal opened before sync delivered its
`container_inventory` component to the browser. The result was a misleading
"0 storage slots" modal with no usable Take All action. Native opening now
waits on that authoritative client ECS component (bounded to 15 seconds) before
publishing the modal. A sync failure stays an explicit open error instead of
presenting an empty quest chest.

Regression guard: a player-placed `"my house chest"` / `"storage chest"` is
_not_ a quest container, so the proximity prompt doesn't start fighting the
aimed overlay everywhere.

## 4. HAR referenced

See the table above. Also worth noting for the record: the player was on Busted
**step 4 of 13** ("Recover some Muck Busters") when the run stopped — i.e. the
blocked step in issue 3 is precisely where progress ended, and every later
quest (including all of Chapter 1) was gated behind it.

## 5. Dedicated Quests menu

`QuestsTab.tsx` — a real quest log, **no map**:

- Filters (All / Active / Available / Failed / Completed) with live counts
- List sorted main-quest → active → available → failed → completed, then
  alphabetically, so polling refreshes never reshuffle the list
- Detail pane: description, **what must be done** (full objective list),
  reward, where to get required items, tool/vendor hints
- **Set as active quest** writes through the same main-quest selection the map
  uses
- "Show on map" deep-links to the Map tab rather than embedding a chart
- Falls back to the active mission log when nothing is selected

Wiring: new `quests` TabKey before `map` in the rail, code `QST`, and the
long-reserved **J** shortcut now opens this tab instead of the map (map keeps
M). The Map tab's descriptor was narrowed to geography, and the garden-hose tab
mapping moved `journal`/`quests` to the new tab.

It consumes the **same** `MapAdapter` the map tab does — no new backend reads,
no second copy of quest state, per the ECS source-of-truth rule that BiomesUI
panels project existing authority.

Live browser evidence:

- `1785051944333-63437-report.json`: green focused Busted run (37 scenarios).
  The untouched snapshot chest exposes `F Open Container`; KeyF opens the
  synced 16-slot private chest with the Water-logged Muck Buster; Take All
  advances `Recover some Muck Busters`; and every later authored Busted action,
  item consumption, recipe reward, crafting, placement, collection, delivery,
  and final quest transition passes.
- `1784962944155-29904-report.json`: real underwater F prompt, accessible
  Water-logged Muck Buster icon, real Take All, every later Busted action, and
  final chapter completion all pass. Its outer red status is only three local
  profile-image 404s; the runner now records those exact URL-pattern fallbacks
  as transients and keeps every other same-origin 4xx/5xx fatal.
- `1784963562747-35318-report.json`: green combined J-key Quests UI run in 33
  seconds, covering five filters, Failed count/list agreement, detail, no
  embedded map, 720px responsive stacking, and Show on Map with zero browser
  or network failures.

---

## Test coverage added

| Suite                           | Tests | Covers                                                                                                                                                                                     |
| ------------------------------- | ----- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `ch1_live_fixes.test.ts`        | 14    | Container label classification, chest selection from a swimming pose (incl. the exact failed browser pose), rehydration decisions, snapshot projection with corruption, analytics contract |
| `QuestsTabRegistration.test.ts` | 5     | Rail order, descriptor, J shortcut, no-map language, unique codes/shortcuts across all tabs                                                                                                |
| `QuestsTab.test.tsx`            | 4     | Filtering/ordering, counts, marker resolution                                                                                                                                              |

For future handoff, run `scripts/harthmere/t.sh gate` once. It combines the
quest/container/UI/client-config tests in one Mocha process, the exhaustive
browser contract check, and the scoped typecheck. Do not split that gate into
one-file reruns after each failure.

The current warm unified app was healthy after 49 minutes but used 12.8 GiB
RSS (plus 1.6 GiB Redis). The next rebuilt native-E2E stack uses the focused
six-service topology: Shim, Bikkie, Logic-with-embedded-Ask, Sync, Web, and
Trigger. Separate Ask, Chat, OOB, Sidefx, and Notify replicas are omitted only
in this opt-in local mode, removing about 6 GiB of duplicate process RSS by the
current process measurements. Production and full local rehearsals retain the
complete service set.

## HAR hardening status after integration

Cloud Save rehydration is now integrated, not deferred: the authenticated
save-list path decodes the current and legacy schemas, restores only an empty
durable live actor, and enriches future slot-0 writes with exact server state.
The non-guest HAR supplied the real slot/version/conflict shapes used by the
tests. The guest HAR is truncated JSON, but its recoverable validate/session
records still prove `user_id: null`, `guest: true`, and `cloud_save: false`.

Analytics emission remains separate work. The catalogue is data; send sites
must hook into the existing `requestGlitch` bridge at the server-confirmed
transitions named in each entry's `emittedOn`.

The chest round trip and remaining native robot-story chain are no longer
integration work: Road Ahead is successful in the HAR, the retained Get the
Muck Out / Muck vs. Machine browser report passes, and the focused Busted report
above completes every authored action. Keep those as locked evidence unless
their authority path changes.

## Final Cloud Save browser evidence

Saved at
`artifacts/glitch-cloud-save-e2e/1784993156433-report.json`.

- Stable-actor migration passed with Level 2 / 21 XP, 75 gold, 28 items, eight
  active quests, and `read-the-jobs-board` completed. Quest IDs were unchanged.
- Two real slot-0 saves returned HTTP 201 after migration.
- A real HTTP 409 paused autosave; no silent conflict resolution occurred.
- The guest install rotated to its deterministic guest Biomes user and emitted
  no `listSaves` or `storeSave` call.
- The destructive rollout simulation was safely rolled back because the live
  Glitch `listSaves` request timed out twice at the 10-second upstream timeout
  (HTTP 504). Both local actor records were restored from temporary Redis
  backups and the backup keys were deleted; no player data was lost.
