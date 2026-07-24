# Native ECS end-to-end testing

This is the release gate for Harthmere gameplay that crosses the browser,
backend services, the authoritative native ECS, and world sync. It is designed
to catch the class of failure where a UI button or HTTP endpoint reports
success while the shared world did not change.

The suite never deploys. Run it against a production-image stack on localhost
before uploading a deployment candidate.

## What the gate proves

Every browser mutation uses the same evidence chain:

1. The frontend publishes exactly one normal Biomes event.
2. Logic accepts the authenticated actor and server-side validation.
3. The authoritative entity/component changes in the world API.
4. The originating browser receives that change through sync.
5. A second session for the same user or a second world client receives the
   appropriate synchronized result.
6. Reload reconstructs the result without localStorage or a Redis/UI mirror.

The browser round-trip currently covers:

- visual-test identity and a separately token-gated E2E admin grant;
- world bootstrap and client context hydration;
- inventory-to-wearing swaps for both Mucky clothing pieces;
- inventory/hotbar conservation;
- throwing a voxel stack and observing the native `GrabBag`;
- private native container transfer using the Road Ahead container contract;
- native `Health` damage propagation;
- food, health-item, and mana-item debit/recovery transactions;
- all 20 executable production jobs-board templates, each accepted through the
  real frontend adapter, rejected away from the board by the server-read native
  ECS position, and projected back into the frontend as the exact todo, quest,
  and map marker;
- authored gathering-node validation, native drop materialization, and pickup;
- server-calculated weapon damage against a native NPC;
- Anima retaliation into the player's native `Health`;
- a two-user race for one drop, proving exactly one `Acquisition`;
- harvest handler queueing followed by Gaia plant removal/drop materialization;
- physical farming through selected native hotbar refs: till a voxel, consume a
  seed into a new ECS plant, water it with a mutable can, time-advance growth in
  Gaia, project the synchronized crop into the JavaScript Farming tab, and
  harvest the resulting native world drop;
- same-user reconnect readback.

The release script also runs the existing visible browser tests and handler/
authority suites for F routing, jobs-board priority, inventory controls,
containers, quest inventory triggers, gathering, combat, vitals, respawn,
building/placeables, jobs, and Glitch Cloud Save identity. This is intentional:
component-only browser tests cannot prove ECS persistence, while a raw event
round-trip cannot prove the visible button routed to the correct action.

## Production-shaped service topology

The unified stack must run and readiness-check all of these services:

- shim/world, Bikkie, logic, ask, chat, OOB, side effects, sync, and web;
- trigger and notification firehose workers;
- Anima for authoritative NPC simulation/retaliation;
- Gaia for farming, growth, decay, restoration, water, and terrain simulation.

Gaia is mandatory. `HarvestPlantEvent` only appends a native player action;
Gaia consumes that action and creates the harvest drop. A stack without Gaia
can acknowledge harvest forever without completing it.

Anima and Gaia use Redis discovery plus distributed shard ownership. This keeps
multiple replicas from processing the same NPC or world shard twice.

## Security model

The ordinary visual test login remains controlled by
`HARTHMERE_VISUAL_TEST_AUTH`. Native-ECS fixture/read access adds two independent
requirements:

- `HARTHMERE_NATIVE_ECS_E2E=1` on the local stack;
- an exact `X-Harthmere-E2E-Token` header matching
  `HARTHMERE_E2E_CONTROL_TOKEN`.

The browser helper is installed only on `localhost`, `127.0.0.1`, or `::1` and
only when `?harthmere_native_ecs_e2e=1` is present. It cannot be enabled by a
normal production URL. The helper does not edit the client ECS table. Fixture
setup uses existing admin world APIs; gameplay still uses the normal client
event queue and logic service. The all-jobs case writes exact auto-job fixtures
only into the isolated local E2E Redis world; every accept, objective
completion, parcel exchange, escort tick, and reward claim still travels
through the production frontend/API/native-ECS path before the browser verifies
the returned quest and marker state.

Do not put the control token in a URL, committed environment file, screenshot,
or artifact.

## Running locally

Start the same production image and Redis snapshot intended for deployment,
with these additional local-only environment values:

```bash
HARTHMERE_VISUAL_TEST_AUTH=1
HARTHMERE_NATIVE_ECS_E2E=1
HARTHMERE_E2E_CONTROL_TOKEN="$(openssl rand -hex 32)"
GLITCH_ENABLE_ANIMA=1
GLITCH_ENABLE_GAIA=1
GLITCH_ENABLE_STREAM_WORKERS=1
```

Then run:

```bash
HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3000 \
HARTHMERE_E2E_URL=http://127.0.0.1:3000/at \
HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
yarn harthmere:test:native-ecs-e2e
```

Use the canonical `/at` route so the local-only E2E query parameters survive
initial navigation. Named `/at/<username>` routes can redirect and drop those
parameters before the browser bridge installs.

For source, UI, and handler contracts without a running stack:

```bash
yarn harthmere:test:native-ecs-contracts
```

### Reliable local chase gate

The production image is `linux/amd64`. On an Apple Silicon development machine,
Anima can need several minutes to hydrate the full snapshot under emulation.
Do not start the browser round-trip merely because the web route responds. The
test stack is ready only after both Anima and Gaia return HTTP 200 from their
`/ready` endpoints.

Build and keep the production-shaped stack running with the native-ECS test
bridge enabled. The extended readiness allowance prevents the stack runner
from killing a healthy but still-hydrating Anima process at the default
120-second boundary:

```bash
export HARTHMERE_NATIVE_ECS_E2E=1
export HARTHMERE_E2E_CONTROL_TOKEN="$(openssl rand -hex 32)"
export GLITCH_STACK_HTTP_READY_WAIT_TRIES=600
export GLITCH_IDLE_SESSION_MS=900000
export SMOKE_TIMEOUT_SECONDS=1800
export HARTHMERE_SKIP_LIVE_ENTITY_BROWSER_SMOKE=1

bash scripts/glitch/deploy-production-local-redis-smoke.sh \
  --local-smoke \
  --keep-local \
  --tag "native-ecs-chase-$(date -u +%Y%m%d%H%M%S)"
```

`HARTHMERE_SKIP_LIVE_ENTITY_BROWSER_SMOKE=1` skips the separate robot-marker
visual tour. That tour is useful as a broad render smoke, but it is not the
native chase release gate and can add several minutes or fail independently on
a screenshot/navigation timeout. Run it separately when changing robot or
marker rendering.

`SMOKE_TIMEOUT_SECONDS=1800` covers both the one-time snapshot import and the
production service hydration cost under AMD64 emulation. The local smoke
harness also waits for Anima and Gaia automatically whenever
`HARTHMERE_NATIVE_ECS_E2E=1`; a web-only HTTP 200 is not considered sufficient
for native-ECS browser testing.

The complete release suite still requires Gaia. For the focused chase-only
scenario on a Docker Desktop VM with roughly 16-17 GiB of memory, Gaia and the
unrelated firehose workers may be disabled because neither participates in the
NPC chase path. This avoids Docker OOM-killing Redis while preserving the real
web, sync, logic, Redis, ECS, and Anima path:

```bash
export GLITCH_ENABLE_GAIA=0
export GLITCH_ENABLE_STREAM_WORKERS=0
```

Do not use that reduced topology for farming, decay, restoration, water, plant
growth, harvest, or the complete native-ECS release gate.

Before starting the chase test, verify the native workers in the kept local
container:

```bash
docker exec biomes-prod-smoke-app /bin/sh -lc '
  curl -fsS http://127.0.0.1:4101/ready >/dev/null
'

# Required for the complete release suite; omit only for the documented
# chase-only reduced topology.
docker exec biomes-prod-smoke-app \
  curl -fsS http://127.0.0.1:4201/ready >/dev/null
```

Then run the focused browser → backend → native ECS/Anima → sync → rendered
frontend chase scenario. Reuse the control token from the running container so
it is not printed or copied into a committed file:

```bash
export HARTHMERE_E2E_CONTROL_TOKEN="$(
  docker inspect biomes-prod-smoke-app \
    --format '{{range .Config.Env}}{{println .}}{{end}}' |
    sed -n 's/^HARTHMERE_E2E_CONTROL_TOKEN=//p'
)"

HARTHMERE_E2E_BASE_URL=http://127.0.0.1:3017 \
HARTHMERE_E2E_SYNC_BASE_URL=http://127.0.0.1:4907 \
HARTHMERE_E2E_URL=http://127.0.0.1:3017/at \
HARTHMERE_E2E_EXPECTED_SYNC_HOST=127.0.0.1 \
HARTHMERE_E2E_CHASE_ONLY=1 \
HARTHMERE_E2E_TIMEOUT_MS=180000 \
STRICT_RENDER=1 \
HEADLESS=1 \
node scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs
```

Port `3017` is the local web route and port `4907` is the directly published
native sync websocket. Using `HARTHMERE_E2E_SYNC_BASE_URL` avoids mistaking a
same-origin development proxy timeout for an NPC locomotion failure while
still exercising the real sync server and frontend ECS ingestion. A normal
production deployment continues to use its same-origin `/sync` proxy.

Interpret failures at the boundary where they occur:

- `ERROR anima not ready` or an exited local app container means the native
  simulation never became test-ready; no chase conclusion can be drawn.
- A timeout waiting for `clientContext` means browser/sync bootstrap failed
  before the chase fixture ran.
- A chase-gate failure after fixture creation is a gameplay failure. The report
  must show whether the NPC missed the minimum effective speed, failed to climb
  the step fixtures, failed to enter authoritative combat state, or failed to
  render that synchronized state in the frontend.

When reusing an already-built image, `--skip-build` is acceptable only if the
`.next`, `dist`, and Docker image were built after the locomotion changes. A
source-only test run does not refresh the production image.

The browser run writes JSON timing/network diagnostics and screenshots under
`artifacts/harthmere-native-ecs-e2e/`. A production candidate should preserve
that directory with its build evidence.

## Latency gates

Defaults are intentionally strict enough to catch the delayed-HUD failure:

- browser event acceptance: 2,000 ms;
- authoritative commit to originating browser: 1,000 ms;
- authoritative commit to second client/session: 1,500 ms.

Override only for a documented diagnostic run:

```bash
HARTHMERE_E2E_ACCEPTANCE_GATE_MS=3000
HARTHMERE_E2E_ORIGIN_SYNC_GATE_MS=1500
HARTHMERE_E2E_SECOND_SYNC_GATE_MS=2500
```

Raising a gate does not make a deployment candidate acceptable; it identifies
which boundary is slow in the JSON report.

## Edge cases

The combined suite covers or has a dedicated contract for:

- two users racing one item;
- two tabs for one user and reload/reconnect;
- full/overflow inventory behavior and give-or-throw handling;
- repeated pickup of an already acquired drop;
- out-of-range and unauthorized container/harvest/combat requests;
- wrong tool, wrong item, wrong quest phase, and invalid equipment slot;
- optimistic ECS edit conflicts and retry reconstruction;
- Redis-to-ECS transaction replay/idempotency;
- Cloud Save account/install/guest identity separation;
- jobs board priority over an overlapping NPC;
- Gaia/Anima/trigger/notify topology absence.

No release should be approved from unit tests alone. The browser round-trip is
required because it is the only gate that observes both the authoritative ECS
and the synchronized frontend in one test.
