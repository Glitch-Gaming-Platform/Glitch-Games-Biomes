# Harthmere Business Customer Simulation Issues

This log records reproducible native-ECS/Anima defects found while validating
the in-world customer-service simulation. Add the exact runtime topology,
artifact, observed authoritative state, source fix, and focused retest result.
Do not replace failed live evidence with source-contract or UI-only evidence.

## 2026-08-03 — Routed native customer remains stationary outside Ashline

Status: **fix implemented; focused browser retest pending**

Runtime topology:

- Web/Logic/Sync/Shim/Bikkie: `harthmere-final-minigames-app`, web `3417`,
  sync `5307`, image
  `sha256:ad179c40f10687a5e874777536e549a0d1605fc6db94a31bc831bcb2437b8881`,
  mounted build `npc-fixes-20260803`.
- Redis: `harthmere-final-minigames-redis`, host port `6493`, literal `PONG`,
  340,395 keys at preflight.
- Same-world Anima: `harthmere-final-combat-anima-r8`, image
  `sha256:b547e86d89f6ad6f3e5a2402f07cf2663ee425e3a22e21e150871c8b386d2547`,
  `ANIMA_HFC_WRITES=1`, `/ready` returned `OK`.
- All three containers had `RestartCount=0` and `OOMKilled=false` before and
  after the attempt.

Artifact:

- `artifacts/harthmere-business-live-browser/1785726637310-56551-report.json`
- `artifacts/harthmere-business-live-browser/01-outpost_refinery_ashline-failure.png`

Observed authoritative behavior:

- A real session-only ECS customer was created as local-dev human entity
  `8812001040901246` at `[671.9, 67, -65]`.
- Anima consumed the entity and repeatedly authored a valid A* path through the
  real Ashline entrance toward the protected counter aisle. The path search
  timestamp advanced, proving that this was not a web-only or missing-Anima
  fixture.
- The customer remained in phase `entering` for the full 120-second acceptance
  window. Authoritative position stayed `[671.9, 67, -65]`, orientation stayed
  `[0, 0]`, and rigid-body velocity stayed `[0, 0, 0]`.
- The first attempted correction converted the business route's authored m/s
  pace with `horizontalForceForTargetSpeed`. Its focused contract passed, but
  live movement still failed. Therefore force-unit conversion alone is not the
  complete cause; the remaining defect is at the route-result to shared
  orientation/physics boundary or the spawn collision/grounding boundary.

Confirmed root causes and source fixes:

- Focused probes confirmed the healthy simulator uses a 100 ms fixed interval
  (`dtSecs=0.1`). `NpcTicker` now validates the global interval and captures one
  interval/duration pair per generated batch so a config reload cannot split
  fixed-tick accounting from its physics delta.
- Two previously aborted test sessions still had eight ECS customers. Their
  economy tickets correctly said `cancelled`, but the materializer wrote the
  updated `npc_state` into regular ECS while Anima's stale `npc_state` remained
  in HFC and won every merged read. The stale customers therefore remained in
  phase `entering`, overlapped the later session's exterior lanes, and triggered
  collision-escape motion instead of the authored route.
- Business-customer updates are now partitioned explicitly: `npc_state`,
  `emote`, movement, and other HFC components go to HFC; `expires` and regular
  components go to RC; creates/deletes keep their normal HybridWorldApi path.
  A focused contract proves a cancelled update cannot be submitted as one
  mixed RC/HFC write.

Testing lesson:

- A changing Anima path/search timestamp is proof that the simulator owns the
  entity, but it is not proof of locomotion. Acceptance must require changing
  authoritative position, finite non-zero motion while entering, arrival at
  the exact customer point, and later departure through the real exit.
- Run only the Ashline smoke while this issue is open. Do not launch the other
  18 browser rows or replay already-green original mini-games until Ashline
  completes entrance, service, departure, and safe off-screen despawn.
- Anima `/ready` can precede completion of its HFC bootstrap on a loaded warm
  world. Browser preflight must require both `/ready=OK` and an explicit HFC
  bootstrap-complete signal before creating a session; otherwise initial
  customer state can be observed before the simulator owns the HFC half.

Resolution artifact: pending. Mark closed only after Ashline and then the
failed-ID/all-19 serial matrix prove entrance, service, departure, and safe
off-screen cleanup with restart-zero/OOM-false lifecycle evidence.
