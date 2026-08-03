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
