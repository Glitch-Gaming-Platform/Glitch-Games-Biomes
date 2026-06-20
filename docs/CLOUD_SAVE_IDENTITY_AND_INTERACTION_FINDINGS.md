# Findings: Cloud Save Identity, Containers, Harvest, NPC Looks

Investigation against the uploaded `biomes_claude_2.har` (boot at 12:21, install
`25f687dd…`, user `blackmage`) and `www.glitch.fun-1780576288925.log`, plus the
Glitch Cloud Save developer docs.

Uploaded files (absolute paths, for any follow-up tooling):

- `…/local_8559fc71-…/uploads/www.glitch.fun-1780576288925.log`
- `…/local_8559fc71-…/uploads/biomes_claude_2.har`
  (The 11 screenshots were pasted inline in chat; they are not separate files on disk.)

---

## 2. Save / Load — ROOT CAUSE FOUND + FIX SHIPPED

### Saving works

`storeSave` calls return **200** and the slot version increments monotonically
(1515 → 1527 across the session). The payload genuinely contains the player's
state: `gold:75, level:2, inventoryItems:30`, plus the player-mesh keys
(`playerFace`, `playerBody`, `playerClothing`). The boot `listSaves`
response includes a valid `decoded_payload`, so the restore filter
(`save.decoded_payload.version === "harthmere-glitch-save"`) matches and
`applySnapshot` runs. The restore _policy_
(`shouldApplyHarthmereCloudSave`) now treats cloud saves as import/export
snapshots: they can restore only when no live-mode backend authority state
exists, so Cloud Save cannot become gameplay authority on boot.

### The real bug: the save SCOPE is volatile

The save data is keyed by a per-player scope (`activeUserScope` =
`identity.gameUserId`). That scope is derived from the **biomes user id** that
the server mints for the Glitch player:

- Save v1515 was written under `gameUserId = biomes:1786141876542625`.
- This session's `claimSession` / `autoLogin` returned
  `biomes_user_id = 103364691929551` → `gameUserId = biomes:103364691929551`.

Same install, same Glitch username (`blackmage`), **different biomes user id** →
the new session looks at a different scope and the prior progress appears wiped,
even though the Glitch cloud slot itself is intact.

### Why the biomes user id changes

The Glitch validate/claim/autoLogin responses contain **no stable Glitch user
UUID** — there is no `glitch_user_id`, `user_id`, or `user_email`. The only
stable human identifier returned is `user_name` ("blackmage"); everything else is
volatile (`biomes_user_id`, `biomes_username: "Glitchinstall25fe66b"`,
`auth_provider: "dev"`).

The server (`src/pages/api/glitch/harthmere.ts`) resolves the biomes user through
a foreign-auth link whose key was:

```
profile.id = `glitch:${titleId}:${identity.gameUserId || install:${installId}}`
```

…and `identity.gameUserId` was `glitch:<glitchUserId>` **only when** the validate
response happened to include a user id, and `install:<installId>` otherwise.
Because Glitch returns the user id inconsistently, `profile.id` **flipped between
two forms** across sessions → different link → different `user.id` → different
`biomes:<user.id>` save scope. (In production the link is keyed strictly by
`profile.id`, so this is the exact lever.)

### Fix (shipped, with tests)

New dependency-free module
`src/pages/api/glitch/harthmere_cloud_save_identity.ts`:

- `harthmereCloudSaveForeignAuthPrimaryId` — one deterministic key, preferring
  a real glitch id → stable `user_name` → install id. It never flips based on a
  field that comes and goes.
- `harthmereCloudSaveForeignAuthCandidateIds` — ordered legacy/secondary keys
  so an existing link is still found; the install form is **always** present (the
  anti-flip guarantee).

`createBiomesAuthForGlitchIdentity` now tries all candidate keys, reuses the
first existing link, and **back-fills** the stable primary key (pointing at the
same user) so the volatile-id flip can never orphan progress again. New users are
created under the stable primary key.

Tests: `src/pages/api/glitch/test/harthmere_cloud_save_identity.test.ts` —
**11 passing**, including the regression that the same (install, userName)
resolves to a stable key whether or not the volatile glitch id is present.

### Still recommended (not yet done)

- Server should also surface a stable `glitch_user_email`/`glitch_user_id` if a
  richer Glitch endpoint exposes it, and prefer it for the scope.
- Client refresh hardening: confirm leveling/inventory React state re-reads after
  an async restore that lands post-mount (events are dispatched; verify each
  consumer listens). Needs a live smoke test.

---

## 1. Containers — take/store panel verified + structurally proven (FIX SHIPPED)

The Harthmere container path is wired end-to-end and is **structurally identical
to the proven-working vendor panel**:
`OverlayView` routes `harthmere_object` → `CursorInspectionComponent`, whose F
shortcut calls `openHarthmereObjectContainer` (seeds container from a
label-driven loot table, dispatches `…_OPEN_EVENT` + writes a localStorage
open-request). `HarthmereObjectContainerPanel` listens and is **mounted in both
HUD branches**. Compared line-for-line against `HarthmereVendorTradePanel`
(the shop that works): same event+storage listeners, same `zIndex 2147483000`,
same `createPortal(panel, document.body)`. So the bespoke path itself is sound.

`harthmereObjectContainers.ts` makes containers act like an inventory: Take /
Take All routes items to the player via `grantHarthmereItem`; Store pulls from
the player via `consumeHarthmereItemByItemId`; contents persist in
localStorage and an emptied container is **not** re-seeded (no infinite loot).
The clothing-crate loot grants BOTH halves (`baker_apron` + `field_trousers`) so
The Road Ahead can complete from the crate.

Tests: `harthmereObjectContainers.transfer.test.ts` — **5 passing**
(seed/Take/Store/Take-All/no-reseed).

The remaining real-world gap is **routing/selection, not the panel**: authored
crates are rerouted to the `harthmere_object` prompt only when they carry a
`quest_giver` and their placeable item has no native interactive overlay
(`isAuthoredHarthmereWorldObjectPlaceable` in `client/game/scripts/overlays.ts`).
A real ECS `placeable` + `isContainer` chest instead hits the native
`ContainerOverlayComponent`, whose "Open Container" shortcut is gated on
`useUserCanAction(id, "destroy")` — so a world/seeded chest the player does not
own shows **no prompt and F does nothing**. That (and the facing-cone selection)
is the inconsistency seen in the screenshots and needs a live world to finish.

---

## 3. Harvest — in-world F-harvest now mounted (FIX SHIPPED)

`LocalDevHarthmereGatheringSystem` already had real nodes (`requiredTool`,
`requiredSkill`, yields, cooldown, authority gating) and the node-body renderer
`harthmere_gathering_node_markers` was registered. The missing piece was the
**F-prompt component**: `HarthmereGatheringNodeWorldInteraction` existed but
was never mounted, so walking up to a node and pressing F did nothing.

Fix: mounted `HarthmereGatheringNodeWorldInteraction` in **both** HUD branches
next to the jobs-board prompt. Now the closest in-range node shows
"Harvest <node>" with the tool/skill requirement, and F (or click) runs
`performHarthmereGather`, which grants the yield, awards XP, and puts the node on
cooldown. The "requires the correct gathering tool" message is the authority gate
(the screenshot case) — now surfaced as visible feedback instead of silence.

Tests: `harthmereGatheringNodeWorldInteraction.test.ts` — **4 passing**
(proximity in/out of range, tool-gating, successful yield, cooldown).

---

## 4. NPC looks — owners now get the staff-grade distinctive outfit (FIX SHIPPED)

Audit (from the screenshots + cosmetic code):

UNIQUE-look NPCs — explicit role clothing WITH a hat + Grove polish:

- Business **staff** (guard: `militia_halfhelm` + tabard; hunter: `hunter_cap`;
  clergy: cap/`mage_hood`; farmer: `straw_hat` + apron; merchant: `noble_cap` +
  coat) — `groveBusinessRoleClothing`.
- Business **customers** — role clothing + a per-id face/hair/eye/accessory
  spread (`customerSpecificAppearanceSpread`).
- Named Grove uniques (Billy Whisker, Donnie, Max) via
  `harthmereApplyGroveUniqueNpcPolish`.

BLAND NPCs — varied face but generic/hatless auto-derived outfit:

- Business **owners / shopkeepers** (Doctor Hana Greenlamp, the smith, the
  foreman, …). Root cause: the owner ECS seed called
  `makeHarthmereNpcAppearanceConfig` with **no `role` and no `clothing`**, so it
  fell back to the generic auto-derived clothing set (often no hat), while
  staff/customers pass explicit role clothing.

Difference in one line: **owners weren't handed the role-clothing table the rest
of the townsfolk use.**

Fix: new `harthmereBusinessOwnerRoleClothing` (exports the same
`roleForBusinessText` + `groveBusinessRoleClothing` the staff use); the owner
ECS seed now passes the derived `role` + hatted `clothing` into the appearance
config. Face/body still vary per entity id, so two same-role owners share an
outfit silhouette but not a face. This intentionally keeps the player/Grove
"rich avatar" design (NOT the blocky voxel NPC look).

Tests: `business_owner_npc_distinct_look.test.ts` — **6 passing** (role
mapping, every owner gets a hat+torso, Greenlamp→medic coat, hat variety across
owners, determinism, parity with the staff generator).
