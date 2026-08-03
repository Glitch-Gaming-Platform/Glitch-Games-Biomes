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
   Mobile now uses a 256 MB Voxeloo reservation, quarter-sized resource/cache
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
