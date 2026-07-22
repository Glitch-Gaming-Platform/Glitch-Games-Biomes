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
- jobs-board rejection/acceptance from the server-read native ECS position;
- authored gathering-node validation, native drop materialization, and pickup;
- server-calculated weapon damage against a native NPC;
- Anima retaliation into the player's native `Health`;
- a two-user race for one drop, proving exactly one `Acquisition`;
- harvest handler queueing followed by Gaia plant removal/drop materialization;
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
event queue and logic service.

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
HARTHMERE_E2E_URL=http://127.0.0.1:3000/at/Joe \
HARTHMERE_E2E_CONTROL_TOKEN="$HARTHMERE_E2E_CONTROL_TOKEN" \
yarn harthmere:test:native-ecs-e2e
```

For source, UI, and handler contracts without a running stack:

```bash
yarn harthmere:test:native-ecs-contracts
```

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
