# Mobile Gameplay Issue Log

This log is for phone/tablet-only gameplay findings. Desktop behavior must not
be changed to resolve entries here.

## 2026-08-02 connected iPhone audit

Device evidence:

- Device: iPhone13,1 running iOS 26.5.2.
- At 23:45:58 local time, the active game WebContent process (PID 68636) was
  terminated after 80.31 seconds with `JETSAM_REASON_MEMORY_HIGHWATER`.
- The repeated Stripe, Clarity, ad-safe-frame, and cross-origin iframe console
  messages came from the Glitch host page. They are noisy but were not the
  termination reason reported by iOS.

Product issues found and addressed in source:

1. **Critical — phone WebContent exceeded its per-process memory limit.**
   Mobile now uses a 128 MB Voxeloo reservation, eighth-sized resource/cache
   capacity, a 0.5 startup render scale, and low graphics unless an explicit
   diagnostic URL override is supplied. Desktop and non-mobile low-memory
   profiles retain their existing settings.
2. **High — hidden ambient video/HLS/Twitch providers mounted during phone
   gameplay.** Phone gameplay now skips hidden spatial media players and shows
   static thumbnails for CSS3D TVs. Desktop keeps live media playback.
3. **High — movement controls lacked a jump button.** Crouch and Jump are now
   touch-safe, independently holdable buttons directly below the movement
   joystick. Both release on pointer cancellation, blur, visibility loss, and
   unmount.
4. **High — critical HUD geometry depended on scaled `rem` values.** Mobile
   joystick/action controls, hotbar reservation, hotbar slots, objective card,
   and menu targets now use pixel/viewport/safe-area geometry. Portrait and
   short-landscape layouts remain separate from desktop CSS.
5. **Medium — BiomesUI wrapped all tabs into multiple rows on short phone
   screens.** Mobile BiomesUI now uses a single horizontal touch-scroll rail,
   safe-area padding, a 44 px close target, and an independently scrollable
   content panel. These layout gates use the explicit mobile-device flag so a
   pointerless desktop browser keeps its prior desktop presentation.

Retest required after an explicitly authorized candidate build/deployment:

- Run the documented mobile smoke at 390x844 and 844x390.
- On the connected iPhone, play for at least ten minutes in both orientations
  and confirm no new `JETSAM_REASON_MEMORY_HIGHWATER` event.
- Verify simultaneous joystick + crouch/jump input, hotbar scrolling and
  selection, Menu/Recipes/Invite, objective scrolling, and every BiomesUI tab.
- Developer Mode is currently disabled on the connected phone, so automated
  device screenshots and direct Web Inspector evaluation were unavailable.
  Syslog and crash/jetsam diagnostics were still collected successfully.

## 2026-08-03 live Glitch browser audit

The public Glitch play page and its production game iframe were exercised at
390x844 and 844x390 while the connected iPhone remained attached for device-log
correlation.

Additional findings:

1. **Critical — the deployed build crashes before gameplay in both
   orientations.** The game reports `Cannot read properties of undefined
(reading 'contentWindow')` from `reactPlayerTwitch` and shuts the client down
   before the joystick or hotbar can mount. The pending source changes skip
   hidden Twitch/HLS/spatial media providers on phones, but those changes are
   not present in the current public build.
2. **Critical — the public build is still using the previous mobile memory
   profile.** Live diagnostics reported `lowMemory: true`, a 512 MB Voxeloo
   reservation, automatic graphics quality, and no explicit mobile-device
   configuration flag. The new 256 MB/low-quality profile and Jump control
   therefore cannot be validated against the public URL until deployment.
3. **High — Glitch blocks the first gameplay view with an advertisement.** The
   ad occupies the bottom of the game viewport for roughly 16 seconds and can
   cover controls during startup.
4. **High — the Glitch host discourages portrait play.** A persistent `Rotate
for better gameplay` overlay appears in portrait before and during game
   launch even though portrait is a supported requirement.
5. **High — Glitch capture controls consume scarce landscape space.** The
   Clip Studio, Help, Add Camera, Wide Mode, and Screenshot rail occupies a
   large bottom-right region and is likely to overlap the game action/HUD on
   short landscape screens.

Physical-device automation remains blocked by disabled Developer Mode: Core
Device rejected remote Safari launch, the screenshot service was unavailable,
and the legacy Web Inspector proxy could list the open Glitch tab but could not
evaluate or control it. No new jetsam termination was observed during this
audit window, but the phone could not be driven through a complete post-change
gameplay session because the updated build is not deployed.

## 2026-08-03 updated-build physical iPhone audit

Developer Mode was enabled and the updated public game iframe was inspected
directly over USB on the connected iPhone 12 mini. This pass excluded Glitch
ads, capture controls, rotation prompts, and the host-page launch gate.

Confirmed in the deployed game runtime:

- `clientConfig.mobileDevice` and the virtual joystick path are active.
- Voxeloo starts with a 256 MB reservation instead of the previous 512 MB.
- The renderer starts at 0.5 scale with low entity/flora quality and expensive
  postprocessing disabled.
- The previous Twitch `contentWindow` startup crash is no longer present.
- The game initially rendered beyond 3,000 frames during the inspected
  portrait onboarding session, allowing full HUD and control inspection. A
  longer run later reproduced the high-water termination described below.

Additional game-side issues found and fixed in source:

1. **High — gameplay controls remained active behind first-run onboarding.**
   The live phone DOM showed the full-screen wake-up flow together with an
   active movement joystick, Crouch, Jump, hotbar, vitals, and objective HUD.
   Phones now suppress the virtual controls and replacement BiomesUI while a
   non-gameplay/onboarding screen is visible. The guard is explicitly
   `mobileDevice`-only, so desktop behavior is unchanged.
2. **High — the deployed low-quality phone preset still rendered 96m.** The
   live dynamic graphics resource reported `drawDistance: 96`, exceeding the
   intended 64m phone ceiling. Mobile low quality now maps to the existing
   `veryLow` 64m tier; desktop low quality remains 96m and explicit diagnostic
   URL overrides still win.
3. **High — the required name form was too small for a phone.** On the real
   375x664 CSS viewport, the username field and Set Name button were each only
   about 94x26 CSS pixels. Focusing that undersized input also triggered iOS
   Safari's automatic text-field zoom, reducing the visible page viewport to
   roughly 185x328 CSS pixels and shifting gameplay controls off-screen. The
   phone-only onboarding layout now uses a near-full-width form, an explicit
   16px input font, and 44px minimum input/button targets, preventing the iOS
   focus zoom without disabling user pinch zoom globally.
4. **High — the first-run character builder used a desktop-height workspace on
   phones.** The existing fixed preview/options heights and 30px chips could
   make required controls and Create Hero unreachable on short portrait or
   landscape screens. Phones now use one safe-area-aware outer scroller, a
   compact preview, 44px option targets, and a reachable sticky Create Hero
   action. Desktop keeps the original fixed two-column workspace.
5. **Medium — restored navigation aids could target deleted entities.** The
   updated live console exposed a stale entity navigation aid. Missing entity
   targets on phones now remove their provisional aid instead of leaving a
   world-origin beam. Desktop retains its prior diagnostics and behavior.
6. **Critical — the 256 MB phone profile still reached Safari's 1,536 MB
   WebContent limit.** The game page's WebContent PID 2043 started at 06:00:33
   and iOS killed it at 06:15:15 with `memory-highwater` after its physical
   footprint crossed 1,572,870 KB. A replacement game process reached
   1,461,999,616 bytes of physical footprint and 124% CPU before it was stopped
   to cool the phone. Live runtime inspection showed Voxeloo had reserved 256
   MB but was using only 29,964,912 bytes, while the renderer still used a 96m
   draw/sync radius. The phone profile now reserves 128 MB, scales resource
   capacity to one eighth, reuses one Voxeloo module across overlapping mobile
   client remounts, and uses the 64m phone-only terrain/sync tier. Desktop WASM,
   cache, and draw-distance behavior is unchanged.
7. **High — the phone vitals, menu, and objective obscured too much gameplay.**
   On the 375x664 viewport, vitals measured 202.5x267 CSS pixels, the menu was a
   96x144 column, and the objective overlapped the Jump control. A live CSS/DOM
   prototype on the attached phone reduced vitals to 172.5x130, changed the
   menu to a 164x44 three-action rail with 44px targets, and moved the objective
   to x=183.25 so it clears Jump by more than 10px. The source implementation
   uses phone-only classes and keeps the full desktop panel/menu unchanged.
8. **High — text-heavy phone action buttons consumed space and left-thumb
   drags could invoke Safari Back.** Menu, Recipes, Invite, Crouch, and Jump now
   render as 44-48px icon-only phone controls while retaining their accessible
   names. The smaller Crouch/Jump pair and joystick start outside Safari's
   edge-swipe activation area, honor the landscape notch safe area, and own
   `touchstart`/`touchmove` through a document-capture non-passive guard so
   Safari cannot reinterpret the active left-thumb gesture as history
   navigation. A mobile-only same-document history sentinel also consumes an
   iOS Back action if the browser recognizes the gesture before JavaScript can
   cancel it. This fixes the physical-phone failure that navigated the live game
   from `/at/devin%20dixon?...` to bare `/at`, which looked like a crash because
   the unauthenticated loader stalled there. The cluster is also aligned farther
   left and 28px lower to open the main view, while full joystick deflection
   explicitly produces running in all four cardinal directions. Non-mobile
   controls and desktop labels are unchanged.
9. **Critical — starting audio decoded the entire sound catalog and all eight
   background tracks on iPhone.** The physical release process reached roughly
   1.3 GB and 191% CPU, then WebContent PID 8942 exited while movement was
   active. Its final trace showed the background-music gain-node burst and more
   than 21,000 resource loads. Phones now skip the 110-file eager sound prefetch,
   lazy-load player sounds on first use, and retain only the requested music
   track. Desktop keeps the existing full audio preload and crossfade behavior.
10. **Critical — the rebuilt-world renderer decoded every authored model before
    any of them became visible.** An exact-source physical-phone run confirmed
    the earlier helper-renderer reductions were active (one of 624 quest
    markers, zero of 19 business-board helpers, zero of 19 outpost audit
    guides, and no distant business interiors), but iOS still jetsam-killed the
    gameplay WebContent process after about four and a half minutes. At the
    time, the visible scene was small and the rebuilt-town root had not mounted,
    proving the memory growth occurred during its unconditional all-world
    GLTF/FBX/OBJ prototype preload. Phones now skip that preload and retain at
    most 24 decoded nearby prototypes and 180 nearby placements inside an 82m
    radius. Four new prototypes are admitted per refresh, distant clones are
    removed, unused geometry/materials/textures are disposed, and projectile
    models load on first use. Desktop retains the original eager full-world
    loader and projectile prefetch.
11. **High — holding and sliding on the game view did not reliably turn the
    camera while the movement thumb stayed down.** The old canvas listener read
    the first global touch, so a joystick touch could be mistaken for the look
    touch, and touches landing on the open game root rather than the negative
    z-index canvas were missed. Phones now capture the exact touch identifier
    that begins on a non-interactive part of the game view and continuously
    feed its deltas into the existing touchscreen camera binding until that
    same finger ends or cancels. Joystick, Crouch, Jump, F, menu, hotbar,
    BiomesUI, dialog, input, and chat targets are excluded. The capture listener
    is non-passive so iOS owns the held drag instead of browser navigation.
    Non-mobile canvas and pointer-lock behavior is unchanged.
12. **High — some valid talk/world interactions had no reachable F control on
    phone.** Phones now subscribe to the global world-interaction dispatcher
    and show one icon-only 48px F button whenever a KeyF candidate wins the
    existing priority system. Tapping it invokes the exact same candidate as a
    keyboard F press, so NPC talk, stations, containers, gathering, jobs boards,
    and Chapter 1 prompts keep their existing authority order. The button is
    safe-area positioned and hidden when no interaction is available. Desktop
    keeps its existing keyboard prompt and behavior.

Verification completed for these source changes:

- 132 focused mobile/control/input/audio/renderer regression tests pass.
- The scoped client typecheck passes.
- The 23-test performance lane and its production guardrails pass.

The twelve fixes above require another deployment before their final physical
phone acceptance pass. The currently deployed build was the evidence source
for the defects, not the build containing these newest corrections.

## 2026-08-04 source audit and mobile optimization batch

A source audit was run against the state described above, looking for what was
still missing rather than re-deriving what had already been fixed. Full
findings and file:line evidence: `HARTHMERE_MOBILE_OPTIMIZATION_AUDIT_2026-08-04.md`.

The memory work from 2026-08-02/03 was verified as genuinely present in
source (Voxeloo 128 MB, ⅛ resource capacity, shared module across remounts,
audio prefetch skip, bounded prototype streaming, phone `low` quality, 64 m
tier). The remaining gaps were reachability and adaptivity, not more trimming.

Fixed in this batch. Every item is gated on `clientConfig.mobileDevice` or on a
clamp set that is `undefined` on desktop, so no desktop behaviour changes.

1. **Critical — a phone could not mine, place, or fight.** `primary`,
   `primary_hold`, `secondary`, and `secondary_hold` are bound through
   `bindMouseClick` and driven by `mousedown`/`mouseup`, so no touch path
   reached them. The only route in was tapping a hotbar slot, which pulses
   `primary_hold` for a fixed 350 ms — so a block that takes longer than 350 ms
   to mine could not be mined, and `secondary` had no mobile invocation at all.
   Separately, the Harthmere combat verbs (draw/sheathe, cycle target, basic,
   heavy, spark) are dispatched from a `keydown` handler keyed on
   `HARTHMERE_COMBAT_KEY_BINDINGS`, so all five were unreachable without a
   keyboard.

   Phones now render a right-thumb action cluster: a **hold-capable** Primary
   (labelled from the selected item — Mine/Attack/Place/Cast/Use), a
   hold-capable Secondary, and Draw, Target, Heavy and Spark. Hold means
   press→`setSyntheticMotion(…, 1)` and release→`0`, which is what makes mining
   a slow block work; it is deliberately not `pulseMotion`. The combat buttons
   call the existing combat entry points (`toggleHarthmereWeaponDrawn`,
   `cycleHarthmereCombatTarget`, `performHarthmereKeyedAttack`) rather than
   reimplementing them, so a phone press and a keyboard press produce the same
   animation, the same `UpdateNpcHealthEvent`, the same server range/item
   validation, and the same Anima retaliation. Combat controls appear only in
   native ECS authority mode, and Target/Heavy/Spark only once the weapon is
   drawn, matching the keyboard flow. Blocked reasons come verbatim from
   `getHarthmereMultiplayerAttackDisabledReason`, so the phone HUD cannot drift
   from the desktop rules. Primary and secondary are never disabled by combat
   state — the rules that block an attack do not block chopping a tree.
   The cluster is a separate component mounted only for `mobileDevice`, so its
   combat/hotbar subscriptions do not exist on a touch-capable desktop, and it
   is excluded from the camera look-drag capture so holding to mine cannot
   also spin the view.

2. **High — `viewport-fit=cover` was missing, so every safe-area inset was 0.**
   The game page shipped `width=device-width, initial-scale=1.0`. Without
   `viewport-fit=cover` iOS reports `env(safe-area-inset-*)` as `0px`, so every
   phone HUD rule relying on them collapsed to its literal fallback — landscape
   left padding was 24 px where a notched iPhone needs ~44 px, putting the
   movement cluster under the sensor housing. Portrait at 390x844 looked fine,
   which is why the earlier smoke missed it. Pinch zoom is still allowed; the
   iOS focus-zoom problem remains solved by the 16 px inputs.

3. **High — phones had no dynamic quality adaptation at all.**
   `forceRenderScale = 0.5` short-circuits `computeRenderScale` before its
   `dynamic` branch, and `low` quality hard-coded a fixed 64 m draw distance —
   so the whole `DynamicSettingsUpdater` ladder was bypassed on phones. This is
   the same failure finding 13 of the 2026-08-03 render audit fixed for desktop
   ("a struggling client had no lever at all"), reintroduced for the device
   class that needs it most: a phone over budget at 0.5 could not fall to 0.3,
   and a fast phone could never climb.

   Phones are now classified once at boot from `detect-gpu` tier plus
   `navigator.deviceMemory` / `hardwareConcurrency`, and the ladder is handed a
   clamped range instead of a hard pin. RAM/core signals may only *downgrade* a
   device, because `deviceMemory` is absent on iOS and a missing signal must
   never read as "weak". The `standard` class starts at exactly 0.5 / 64 m —
   the profile validated on the physical iPhone 12 mini — so nothing starts
   anywhere new. No class may exceed 96 m, the radius the jetsam sessions were
   running. Clamping is applied both where the value is generated and where the
   ladder proposes it, so a proposal that clamps back onto the current value is
   dropped instead of burning a pacing interval.

4. **High — the frame loop was uncapped.** `Loop.tick` rendered on every
   `requestAnimationFrame`. Phones now render at a 30 FPS target. Only
   rendering is paced: ECS flush, clock, the fixed-rate simulation ticker and
   event publishing still run every animation frame, so input latency, physics
   and networking are unchanged. This halves per-frame CPU on the bottleneck
   every prior investigation identified, and reduces the sustained thermal load
   behind the 124–191% CPU readings.

5. **High — WebGL context loss was fatal with no restore path.**
   `preventDefault()` was called on `webglcontextlost` — the browser's contract
   for "this application will restore the context" — but nothing anywhere
   listened for `webglcontextrestored`, so the game stayed dead until a page
   reload. iOS discards GL contexts under exactly the memory pressure this game
   operates near, and Safari drops them after a backgrounded tab, so "came back
   to a black screen" was indistinguishable from a crash. Phones now stop the
   frame loop on loss (rendering into a lost context throws, which `Loop.tick`
   escalates to `log.fatal` and a cancelled animation frame — turning a
   recoverable event into an unrecoverable one) and rebuild via the existing
   `reattach()` on restore. The loss report is downgraded from fatal to a
   warning only on the path that can actually recover. Desktop keeps the
   original fatal report.

6. **Medium — 2.65 MB of base64-in-JSON atlases decoded on the main thread.**
   Phones now release each ~1 MB payload string as it is consumed, so peak boot
   footprint is one payload instead of all three. **Partial:** the real remedy
   is to stop shipping base64-in-JSON (raw `.bin` plus a shape sidecar,
   expanded in a worker or pre-expanded in Galois); that is an asset-pipeline
   change and remains open.

   Writing the test for this uncovered a **latent bug affecting all platforms**,
   fixed in the same pass and *not* mobile-gated. Five call sites used
   `new Uint8Array(Buffer.from(data, "base64").buffer)`, which discards
   `byteOffset`/`byteLength`. Node pools sub-4 KiB `Buffer` allocations, so
   that expression returns a view over the whole 8 KiB pool from byte 0 —
   neighbouring bytes, not the payload. It was correct in the shipped browser
   client only because the browserify polyfill happens to allocate exactly.
   All five now route through one `decodeBase64Bytes` that prefers native
   `atob` and honours offset/length in the `Buffer` fallback, so both branches
   agree. Two of the five were outside the atlases: the breaking/shaping
   animation in `materials.ts`, and the **GLB** path in `item_mesh.ts`, which
   handed the parser the whole backing buffer with the offset discarded — a GLB
   parser reads a magic header at byte 0, so outside the browser it was parsing
   from the wrong byte entirely. This is a no-op for the shipped browser client
   and a correctness fix everywhere else.

7. **Low — PWA manifest declared no orientation.** Now `"orientation": "any"`,
   consistent with portrait being a supported requirement.

Deliberately not attempted in this batch, and still open:

- **KTX2 / gltfpack over the NPC assets.** `find public -name "*.ktx2"` is
  still 0 files, and `big_mucker.….gltf` is still 15.5 MB of JSON. The
  decoder infrastructure and the `assets:install-gltfpack` script exist; this
  is an asset rebuild, not a client change.
- **`useWorker: false`.** The worker still uses the non-SIMD build with a
  16 MB heap and offloads only `toBlockGeometry`. Enabling it on phones needs
  the SIMD artifact and buffer transfer first, and a measurement.
- **Binary atlas format** (see item 6 above).

Verification for this batch:

- 57 focused tests pass: `mobile_device_profile`, `mobile_frame_pacing`,
  `mobile_action_controls`, `mobile_atlas_decode`, plus the existing
  `graphics_settings`, `dynamic_settings_updater` and `client_config` suites.
  The decode suite asserts both the native and `Buffer` branches produce
  identical bytes, that neither ever returns a view over a larger backing
  buffer, and covers payloads on both sides of Node's 4 KiB pooling boundary.
- Physical-device acceptance has **not** been performed. Every item above is a
  code-path argument plus unit coverage; none of it has been measured on the
  connected iPhone, and none of it is deployed.
