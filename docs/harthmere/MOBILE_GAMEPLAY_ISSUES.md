# Mobile Gameplay Issue Log

This log is for phone/tablet-only gameplay findings. Desktop behavior must not
be changed to resolve entries here.

## 2026-08-04 frame-zero terrain loading freeze

Physical-device and native-Metal traces isolated the loading freeze to the
first call to `VisibilitySharder.scan()` inside `TerrainRenderer.draw()`.
Keeping the sharder constructor but disabling only `scan()` let the complete
frame return; running `scan()` with an empty callback still pinned the browser
main thread. This ruled out terrain-resource callbacks, missing assets, Redis,
authentication, WebGL context creation, and fixed startup delays.

The immediate cause was an invalid first-frame camera projection:

- `RendererController` creates an auto-starting `THREE.Clock`, whose first
  `getDelta()` is exactly zero.
- The camera far-plane fade is initialized at zero and therefore remains zero
  after that first zero-duration tick.
- `CameraScript` assigned `far = 0` while `near = 0.1`, producing a singular
  perspective projection matrix.
- Voxeloo's synchronous `FrustumSharder::get_positions()` inverted that matrix
  during `VisibilitySharder.scan()` and entered an invalid/huge bounds scan,
  pinning WebContent at frame zero.

The source fix keeps the proposed far plane strictly beyond the near plane.
Valid draw distances are returned unchanged, so normal desktop and mobile
rendering behavior is preserved; only the invalid transition frame is clamped.
A focused regression test verifies that the first fade frame has an invertible,
finite projection matrix and that normal 64 m / 256 m draw distances are
unchanged.

Physical iPhone acceptance against a fresh Safari origin with the real native
terrain scan restored passed after the fix: gameplay and the mobile HUD mounted,
CDP remained responsive beyond 2,315 rendered frames, Sync was ready and
bootstrapped with 2,996 table records, the live camera matrix was finite, and no
forbidden `biomes.gg`, Google, or Firebase resource request appeared. Evidence:
`artifacts/mobile-phone-acceptance-20260804-fix/safe-camera-far-plane-phone-20s.png`.

The same investigation found a separate startup amplification bug:
`LoginRelatedController` ran its asynchronous session check after every render.
It now runs once per mount (`[]` dependency list), eliminating the repeated
`/api/auth/check` burst without changing login behavior.

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
   clamped range instead of a hard pin. RAM/core signals may only _downgrade_ a
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
   fixed in the same pass and _not_ mobile-gated. Five call sites used
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

## 2026-08-04 final-build physical iPhone frame-zero blocker

Build `49bde1ef-assetperf-20260804-final` was loaded on the connected iPhone
12 mini (`iPhone13,1`, iOS 26.5.2) through a new LAN origin with `Cache-Control:
no-store`. This bypassed Safari's cached immutable chunk whose URL/hash had not
changed after the local particle fallback hotfix.

Confirmed fixed on the physical phone:

- The page and client telemetry both reported the exact final build ID.
- The previous `RGB byte length must be divisible by 3, received 4` particle
  fallback failure did not recur in device syslog or `/api/client_error`.
- Authentication, Bikkie, the retained world snapshot, and direct Sync reached
  ready state. The client received 1,001 bootstrap changes and a table of about
  2,998 entities.

New release blocker:

1. **Critical — Mobile Safari synchronously spins during renderer attachment
   before frame one.** Both the normal phone profile and the documented minimum
   diagnostic profile (`lowMemory=1`, resource capacity `0.25`, draw distance
   `16`, render scale `0.25`, graphics `low`) stopped at the same loading-bar
   position. Telemetry at the last responsive point reported Apple GPU WebGL2,
   an almost-empty 128 MB Voxeloo heap, zero resident terrain/texture/geometry,
   and `renderer.game.threejs.info.render.frame = 0`. Web Inspector then timed
   out on `Runtime.enable`, while iOS reported the foreground WebContent thread
   triggering its scheduler fail-safe for spinning at fixed priority.

   The CPU resource report
   `com.apple.WebKit.WebContent.cpu_resource-2026-08-04-140327.ips` records PID
   25044 using 90 seconds of CPU over 100 seconds (90% average). This is not a
   stale particle-cache failure, asset residency limit, draw-distance issue, or
   quality-ladder starting value.

   Source localization: `RendererController.attach()` completes WebGL creation
   and dynamic-setting setup, then synchronously calls
   `this.passRenderer!.render()` as `initialRender` before creating the Three
   clock, installing context listeners, or entering `renderFrame()`. Since
   `renderedFrames` remains zero and the last emitted client log is the
   unsupported GPU-timer-extension warning immediately before that call, the
   initial empty postprocessing render is the narrowest proven boundary. The
   next candidate should skip/defer that synchronous initial render on mobile
   only and let the first paced `renderFrame()` build scenes before rendering;
   it must then be rebuilt and retested on this physical phone. Do not change
   desktop's existing initial-render behavior for this phone-only symptom.

Blocked acceptance rows: the HUD never mounted, so real-touch joystick/history
gesture cancellation, hold-to-mine/place/attack/use, combat buttons, crouch,
jump, hotbar, BiomesUI, rotation transitions, 30 FPS pacing, ten-minute gameplay
stability, and WebGL restoration cannot be truthfully marked passed on this
build.

## 2026-08-04 physical iPhone acceptance — post-frame-zero findings

The camera/frustum and bounded-catalogue fixes cleared the frame-zero blocker
on the connected iPhone 12 mini. A fresh visual-auth session reached live
gameplay with a real `clientContext`, advancing rendered frames, the mobile
profile active, and direct LAN Sync ready.

### Physical real-touch rows that passed

- Jump raised the authoritative local player and released cleanly.
- Crouch stayed active for the duration of the touch and released cleanly.
- Primary and Secondary produced real `primary_hold` / `secondary_hold` state;
  neither was a mouse emulation or fixed pulse.
- Full joystick deflection produced `run=1`; partial/released input returned to
  zero. A hard-left thumb sweep kept the URL and history entry unchanged while
  `touchstart`/`touchmove` were canceled, so Safari Back did not fire.
- Holding one real touch on the game canvas and sliding through three successive
  horizontal moves rotated player yaw continuously without lifting. The events
  were `pointerType: "touch"`, and canvas `touchmove` was prevented.
- Menu, Recipes, and Invite opened from real touch. The mobile inventory overlay
  filled the phone viewport, Recipes opened the handcrafting screen, and Invite
  opened the in-game Play Together dialog.
- The source-equivalent portrait layout put F at viewport center, moved the
  joystick down and away from Safari's edge, aligned C/Jump/Primary/Place on one
  row, used a block glyph for Place, and stacked the compact utility rail beside
  the vitals panel.

### F interaction race found and fixed

The centered F control could appear at the edge of an NPC interaction radius,
receive `pointerdown`, then unmount before Safari delivered `pointerup`. The
real phone trace contained `pointerdown`/`touchstart` but no usable release, so
the selected world action never ran. F is discrete rather than holdable; the
mobile-only control now invokes the existing KeyF dispatcher on captured
pointer-down and uses release/cancel only for pointer bookkeeping. A physical
A/B at Jackie changed `talkingToNpc` from `null` to Jackie's entity id when the
same action was invoked on touch-down.

### Important: port 3205 is not a valid memory/stability acceptance origin

The temporary AAC phone proxy on port 3205 was created before the mobile `.m4a`
paths were wired into the game. It has two acceptance-invalidating behaviors:

1. it overwrites **every** upstream response with
   `Cache-Control: private, no-store, max-age=0`; and
2. it forwards HTTP only and does not proxy WebSocket `Upgrade`, so same-origin
   `/sync` connects and immediately receives a TCP FIN.

The no-store override forced the phone to refetch game subresources continuously.
Immediately before jetsam, WebKit resource ids advanced from roughly 35,700 to
38,300 in about 34 seconds. iOS then killed WebContent PID 30121 at 1,573,990 KB
after 401 seconds with `jetsam(1) memory-highwater(2)`. An earlier run killed PID
29933 at 1,578,518 KB after 575 seconds. These are real device crashes, but they
do **not** establish a production game memory leak because the test origin had
disabled the browser cache for all chunks, GLBs, textures, audio, and API data.

Mobile AAC is now selected by the game source itself, so physical acceptance
must use the normal LAN web origin and explicit direct Sync:

```text
http://192.168.0.204:3017/at?syncBaseUrl=http%3A%2F%2F192.168.0.204%3A4907&glitch_auto_play=1
```

Do not use port 3205 for stability, residency, reload, or crash acceptance. It
may be used only for a deliberately isolated cache-bypass experiment, and such
results must be labelled harness-induced. The remaining direct-origin phone
gate is: fresh load, portrait and physical landscape, hotbar scroll/selection,
authoritative mining/combat, F, and at least ten uninterrupted minutes of
movement with sysmon/syslog observation.

### iOS touch activation mistake: a trusted touch is not guaranteed to click

The current direct-origin physical pass exposed the same WebKit behavior on
four surfaces. BiomesUI Close, Handcrafting/Recipes Close, Invite Close, and a
hotbar slot each received trusted `pointerdown`, `touchstart`, `pointerup`, and
`touchend`, but Safari synthesized no click. The overlays remained open and the
hotbar selection did not change. In each live A/B, invoking the existing action
from the real touch sequence made the same touch work immediately.

The source fix is mobile-only: the three close surfaces act on contained touch
pointer-down, preserve desktop/keyboard `onClick`, and ignore a later non-keyboard
click to avoid double activation. The regression markers are
`MOBILE_BIOMES_UI_CLOSE_TOUCH`, `MOBILE_BIOMES_UI_SHOP_CLOSE_TOUCH`, and
`MOBILE_PLAYER_INVITE_CLOSE_TOUCH`. The read-only text-sign modal exposed by a
real centered-F interaction follows the same rule under
`MOBILE_TEXT_SIGN_CLOSE_TOUCH`. Hotbar selection uses
`MOBILE_HOTBAR_TOUCH_SELECT`: it selects on touch pointer-up only if movement
has stayed below the tap threshold, preserving the native horizontal pan.

Testing rule: never accept a phone button because `element.click()` works. Use
W3C `pointerType: "touch"`, inspect the trusted event sequence, and confirm the
actual UI/state transition. If SafariDriver itself stalls while releasing a
long gesture, independently inspect the page's WebContent PID before calling it
a game crash; in this pass the game continued rendering while only the Mac-side
automation bridge was wedged.

### Phone dialogue buttons inherited unusable desktop `vmin` heights

The centered F action successfully opened a real Sign interaction, proving the
world-interaction dispatcher ran on touch-down. The resulting Close action was
only 11.25 CSS pixels tall in a 375-pixel portrait viewport because the shared
dialog button rules use `3vmin`/`7vmin`. Coarse-pointer phone CSS now gives all
dialog button sizes a 44-pixel minimum target and a 16-pixel minimum font. The
override is media-gated; desktop dialog geometry is unchanged.

The same capture showed the centered F button and lower mobile action row above
the compact sign dialog, intercepting touch intended for Close. Mobile virtual
controls now unmount whenever `/game_modal` is non-empty and return when the
dialog closes. Desktop has no virtual joystick in this branch and is unchanged.

### Landscape must be accepted from its actual CSS width, not assumed from portrait

The connected iPhone's game viewport was `812 x 311` CSS pixels in
`landscape-secondary`. That width is greater than the generic `max-width: 768px`
phone breakpoint, so the phone class fell back to tablet/base declarations even
though the device was still running the mobile HUD. The result was a 320-by-281
vitals panel, the utility rail on top of it, the objective beneath the action
row, and a 548-pixel hotbar across the main view.

The mobile-only `max-height: 500px` landscape contract now repeats the compact
phone geometry explicitly: a 186-pixel vitals strip, a 34-pixel utility rail,
the objective beside that rail, a five-visible-slot horizontally scrollable
hotbar at bottom-right, and a lower joystick/action safe band. A physical live
CSS A/B on the same `812 x 311` viewport measured all regions inside the screen
with no overlap between the top HUD, action row, joystick, hotbar, or minimap.
Portrait and desktop declarations are outside this media query and unchanged.

Testing rule: never infer the landscape layout from portrait screenshots or a
desktop responsive preset. Rotate the connected phone, record `innerWidth`,
`innerHeight`, `screen.orientation.type`, and every HUD rectangle, then capture
the physical Safari screenshot. In particular, a landscape iPhone can exceed a
width-only phone breakpoint while remaining extremely short.

## 2026-08-05 mobile AAC expansion — speech, effects, and ambience

The original iPhone audio pass covered long-form music only. The additive
mobile catalogue now also covers every committed NPC voice line, every generated
Harthmere gameplay effect/ambience, and every packaged non-music core Biomes
sound:

- 2,164 NPC voice MP3s retain their originals and add AAC-LC `.m4a` variants.
- 840 Harthmere Opus/WebM effects retain their originals and add mono AAC-LC
  variants.
- 113 packaged core WebM/Opus sounds retain their originals and add AAC-LC
  variants under the tracked `audio/mobile/core` catalogue.

Six long-form core music sources are intentionally excluded because the prior
music pass already supplies dedicated mobile tracks. Keeping a second AAC copy
of those same music families would add about 26 MiB without changing playback.

The format policy is capability-based and mobile-only. iOS/iPadOS prefers AAC
for buffered effects because WebKit's WebM/Opus WebAudio support has varied by
release. Android keeps Opus when the browser reports support, because Opus is
already the better short-effect choice there, and falls back to AAC when Opus
is unavailable. Any AAC-capable mobile browser requests the smaller committed
AAC speech file. Desktop keeps the existing WebM/Opus and MP3 paths.

Variants are never authoritative replacements. A missing or stale AAC asset
falls back to the original automatically. Runtime-generated TTS also remains a
provider-native MP3/data response when no committed AAC line exists. Completed
mobile one-shots and stopped mobile loops invalidate their decoded resource
node so WebKit may reclaim PCM; desktop retains its existing hot sound cache.

This batch intentionally requires no physical-device acceptance. Codec shape,
duration, channel count, asset pairing, selection policy, fallback, API schema,
and TypeScript wiring are deterministic source/asset contracts. Do not create a
phone/browser requirement for a pure catalogue refresh unless playback policy
or WebAudio graph behavior changes later.

## 2026-08-05 NPC dialogue expression loop and Jackie memory-highwater crash

The connected iPhone 12 mini reproduced the reported Road Ahead failure on the
normal `3017` web / `4907` Sync origin. WebContent PID `41857` reached a
1,397,167,872-byte post-load footprint and was then killed at `1,573,590 KB`
after 242 seconds with `jetsam(1) memory-highwater(2)`. The app and Redis stayed
healthy with restart count zero. This establishes a real phone client crash,
not a Glitch/server failure.

Jackie was where the crash became visible, but was not the root allocation. The
same WebContent process was already under warning pressure before the dialogue.
Live inspection of the actual Three.js state found:

- every rendered NPC eagerly owned 119 actions, 5,712 cloned tracks, and the
  complete 71-expression catalogue while only `idle` had nonzero weight;
- every rendered player mesh eagerly owned 314 actions across two layers and
  7,536 cloned tracks; and
- the sampled phone scene retained five NPC render states and three player
  meshes before the user had selected most of those animations.

The fix is mobile-only. `AnimationSystem.newState()` can now retain one source
catalogue while deferring selected actions. NPC and player mobile meshes defer
every non-idle action, materialize it when its smoothed layer weight first
becomes visible, and uncache the cloned action after the weight returns to zero.
Desktop still constructs its action graph eagerly. This also bounds a long
conversation: expressions encountered on earlier lines do not remain resident
for the rest of the session.

The iOS loop was a separate completion-state edge case in the same action path.
Desktop Three.js sets `paused` when a clamped `LoopOnce` action finishes. The
iPhone could report the action as not running without that flag, causing the
old restart branch to call `reset()` again. Mobile now treats the authored
`mixer.time - startTime` duration as authoritative, pins the final frame, and
does not restart the completed expression.

Testing mistakes to avoid:

1. Do not attribute a phone crash to the newest dialogue click without first
   reading the exact WebContent PID and `killing_highwater_process` line.
2. Do not reuse an old Jetsam report. The pre-existing August 5 02:20 report
   killed `shazamd`, not the game. The live 11:26:58 syslog was the relevant
   evidence.
3. Do not enter an observer world and then authenticate in the same tab for a
   memory baseline. Safari may retain observer/auth documents in back-forward
   cache. Start from the lightweight visual-auth bridge into one fresh game
   navigation, and record `page_count`, `backforward_cache_page_count`, and
   `document_count` when diagnosing residency.
4. Record the live action and track counts from the real render states; GLB file
   size alone does not reveal cloned `AnimationClip`/`AnimationAction` cost.

### Fixed-build physical acceptance boundary

The source fix was then exercised on the same physical iPhone against build
`warm-ios-dialog-memory-20260805-r1`. Before dialogue, each sampled NPC had only
its `idle` action materialized instead of the previous 119 actions, and each
sampled player mesh had two idle-layer actions instead of 314. Jackie's
`relief` expression materialized on demand and, after its one-second authored
duration, remained at `time = 1`, `paused = true`, `isRunning() = false`, and
`clampWhenFinished = true`. A second sample more than three seconds later was
unchanged, so the iOS restart loop did not recur.

The fixed game WebContent process was PID `42371`. Its measured post-load
footprint was `1,040,994,880` bytes. Device syslog continued to report WebKit
memory-pressure notifications, but the bounded retest contained no
`killing_highwater_process`, RunningBoard memory-highwater exit, Safari reload,
or app/Redis restart. This is evidence that the eager character-action cause
was removed; it is not evidence that every remaining source of iOS residency
has been eliminated.

The exact multi-page Road Ahead dialogue was not completed before the test was
stopped. The test identity had The Road Ahead in progress, but that session's F
interaction opened Jackie's default first line rather than the long quest
sequence. Do not report the generic Jackie line as an end-to-end Road Ahead
pass, and do not report the bounded no-jetsam interval as the full ten-minute
stability row. The expression fix still covers the shared 71-expression action
path, but the specific quest-routing/soak row remains a separate acceptance
boundary.
