#!/usr/bin/env node
"use strict";
/*
HARTHMERE_E2E_JUMP — cut the browser-test loop from minutes to seconds.

The slow part of live browser testing is not the browser. It is:
  (a) rebuilding/restarting the stack between iterations, and
  (b) REPLAYING the whole quest chain to reach the step you actually changed.

The runbook's serial full-chain walk is the right *release gate*, but it is the
wrong inner loop. This tool gives you the inner loop:

  node scripts/harthmere/e2e-jump.cjs list
  node scripts/harthmere/e2e-jump.cjs url busted_chest
  node scripts/harthmere/e2e-jump.cjs cloud-save-url <install-id>
  node scripts/harthmere/e2e-jump.cjs promo-batch-url chapter1-visual-repair
  node scripts/harthmere/e2e-jump.cjs ready
  node scripts/harthmere/e2e-jump.cjs seed busted_chest --print

Every checkpoint is a real authored anchor from the shipped contracts, so the
coordinates cannot drift away from the content they test.

USAGE NOTES
  * `url` emits an /at/<x>/<y>/<z>/<pitch>/<yaw> deep link. The observer route
    parses the first three slug segments as coordinates, so you spawn AT the
    thing under test instead of walking there.
  * `ready` requires lifecycle-ready web/logic/sync/trigger services, a real
    web HTTP response, and a sync TCP connection. The sync port is
    WebSocket-only and is NEVER sent an HTTP request: an early listening socket
    appears roughly forty seconds before `sync now running` on the large local
    snapshot, and starting Chromium in that gap produces handshake-reset loops.
  * `seed` prints the live-mode payload that advances quest state directly.
    Review it before sending; it is deliberately print-only by default.
*/

const net = require("net");
const http = require("http");
const https = require("https");
const { spawnSync } = require("child_process");

const DEFAULT_ORIGIN = process.env.HARTHMERE_E2E_URL || "http://localhost:3000";

function configuredPort(urlValue, fallback) {
  try {
    const url = new URL(urlValue);
    if (url.port) return Number(url.port);
    return url.protocol === "https:" ? 443 : 80;
  } catch {
    return fallback;
  }
}

const DEFAULT_WEB_PORT = Number(
  process.env.HARTHMERE_E2E_WEB_PORT || configuredPort(DEFAULT_ORIGIN, 3000)
);
const DEFAULT_SYNC_PORT = Number(
  process.env.HARTHMERE_E2E_SYNC_PORT ||
    (process.env.HARTHMERE_E2E_SYNC_BASE_URL
      ? configuredPort(process.env.HARTHMERE_E2E_SYNC_BASE_URL, 3100)
      : DEFAULT_WEB_PORT === 3017
      ? 4907
      : 3100)
);
const DEFAULT_SYNC_BASE_URL =
  process.env.HARTHMERE_E2E_SYNC_BASE_URL ||
  (() => {
    const origin = new URL(DEFAULT_ORIGIN);
    return `${origin.protocol}//${origin.hostname}:${DEFAULT_SYNC_PORT}`;
  })();
const DEFAULT_REDIS_PORT = Number(
  process.env.HARTHMERE_E2E_REDIS_PORT ||
    process.env.GLITCH_REDIS_PORT ||
    process.env.REDIS_PORT ||
    (DEFAULT_WEB_PORT === 3017 ? 6390 : 6379)
);
const DEFAULT_STACK_CONTAINER =
  process.env.HARTHMERE_E2E_STACK_CONTAINER || "biomes-prod-smoke-app";
const REQUIRED_STACK_SERVICES = String(
  process.env.HARTHMERE_E2E_READY_SERVICES ||
    "web logic sync trigger shim bikkie"
)
  .split(/\s+/)
  .filter(Boolean);
// Every server publishes readiness on its metrics port only after its registry
// and initializer finish. Probe these endpoints inside the current container
// instead of scraping unbounded Docker logs; asset-heavy browser runs can add
// tens of megabytes of request logs and used to overflow the readiness helper's
// buffer even though the stack itself was healthy.
const STACK_SERVICE_READY_PORTS = Object.freeze({
  web: 3001,
  shim: 3101,
  bikkie: 3401,
  logic: 3501,
  trigger: 3701,
  notify: 3801,
  anima: 4101,
  gaia: 4201,
  sync: 4901,
});
// Web is already proven through the externally mapped HTTP origin in ready().
// Requiring its in-container metrics endpoint as a second, same-process probe
// only adds a false negative when the production image is busy serving assets.
const EXTERNALLY_PROBED_STACK_SERVICES = new Set(["web"]);

// ---------------------------------------------------------------------------
// Checkpoints — authored anchors, kept in sync with the shipped contracts.
// ---------------------------------------------------------------------------

const CHECKPOINTS = {
  // --- prologue chain (the chain that gates everything else) ---------------
  grove_start: {
    pos: [496, 71, -126],
    look: [-0.15, 0.1],
    what: "Jackie at the Grove road-house. Road Ahead step 1.",
    source: "production_terrain_placement_map: jobs_board_marker:npc_jackie",
  },
  billy: {
    pos: [500, 71, -140],
    look: [-0.15, 0.0],
    what: "Billy / Old Grove Road Post. Road Ahead mid-chain.",
    source: "production_terrain_placement_map",
  },
  busted_chest: {
    // NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC.position, viewed from just above
    // the waterline so the dive is one keypress.
    pos: [528.5, 67, -96.5],
    look: [-0.85, 0.0],
    what:
      "Busted: sunken chest holding the Water-logged Muck Buster. THE step " +
      "that blocked the 2026-07-25 session — verify the F prompt appears.",
    source:
      "native_road_ahead_contract: NATIVE_BUSTED_UNDERWATER_CONTAINER_SPEC",
  },
  muckwad_patch: {
    pos: [512, 71, -152],
    look: [-0.2, 0.0],
    what: "Road Ahead / Get the Muck Out: muckwad breaking.",
    source: "production_terrain_placement_map",
  },

  // --- Chapter 1 ------------------------------------------------------------
  ch1_fence_gate: {
    pos: [514, 73, -198],
    look: [-0.15, 0.1],
    what: "Act 1 close: the 90-second fence-line seam. Portal visual check.",
    source: "ch1_ids: CH1_ANCHORS.gate_fence_sighting",
  },
  ch1_greenlamp: {
    pos: [656, 67, -182],
    look: [-0.1, 0.0],
    what: "Act 2: Greenlamp clinic, first meeting with Dr. Ardan.",
    source: "ch1_ids: CH1_ANCHORS.greenlamp_clinic",
  },
  ch1_desert_gate: {
    pos: [648, 59, -462],
    look: [-0.1, 0.0],
    what: "Act 3: the persistent Old Wood aperture. Desert dungeon entrance.",
    source: "ch1_ids: CH1_ANCHORS.gate_desert",
  },
  ch1_ashline: {
    pos: [674, 69, -44],
    look: [-0.15, 0.0],
    what: "Act 4: Ashline containment sequence (the 31-second set piece).",
    source: "ch1_ids: CH1_ANCHORS.ashline_containment_works",
  },
  ch1_winter_gate: {
    pos: [232, 56, -506],
    look: [-0.1, 0.0],
    what: "Act 5: the cold gate. Winter dungeon entrance.",
    source: "ch1_ids: CH1_ANCHORS.gate_winter",
  },
  ch1_bridge_rook: {
    pos: [904, 73, -209],
    look: [-0.1, 0.0],
    what: "Halden Rook at the Harthmere bridge. Gate-timing beat.",
    source: "ch1_ids: CH1_ANCHORS.harthmere_bridge_center",
  },

  // --- dungeon interiors (Elsewhen band; warp-only in play) -----------------
  desert_arrival: {
    pos: [2672, 83, -52],
    look: [-0.2, 0.0],
    what:
      "Desert dungeon arrival (Dune Threshold). ADMIN ONLY — players reach " +
      "this by gate warp; ch1AdmitToElsewhen evicts anyone without a run.",
    source: "ch1_elsewhen_region: slot 0 arrival",
  },
  winter_arrival: {
    pos: [3176, 65, -88],
    look: [-0.1, 0.0],
    what: "Winter dungeon arrival (Ice Shelf Landing). ADMIN ONLY.",
    source: "ch1_elsewhen_region: slot 1 arrival",
  },
};

// ---------------------------------------------------------------------------

function deepLink(name, origin = DEFAULT_ORIGIN, extra = {}) {
  const cp = CHECKPOINTS[name];
  if (!cp) {
    throw new Error(`unknown checkpoint: ${name}`);
  }
  const [x, y, z] = cp.pos;
  const [pitch, yaw] = cp.look;
  const params = new URLSearchParams({
    hideChrome: "1",
    allowSoftwareWebGL: "1",
    ...extra,
  });
  return `${origin.replace(
    /\/+$/,
    ""
  )}/at/${x}/${y}/${z}/${pitch}/${yaw}?${params}`;
}

function cloudSaveUrl(installId, origin = DEFAULT_ORIGIN, extra = {}) {
  if (!installId || !String(installId).trim()) {
    throw new Error("cloud-save-url requires a Glitch install id");
  }
  const url = new URL("/at", origin);
  // These are a unit for local Cloud Save testing. Omitting the native-ECS
  // switch or sync override makes the browser fall back to the web port + 1,
  // which produced a long WebSocket-1006 reconnect loop on the 3017 stack.
  url.search = new URLSearchParams({
    hideChrome: "1",
    allowSoftwareWebGL: "1",
    install_id: String(installId).trim(),
    harthmere_native_ecs_e2e: "1",
    syncBaseUrl: DEFAULT_SYNC_BASE_URL,
    glitch_auto_play: "1",
    ...extra,
  }).toString();
  return url.toString();
}

function tcpReady(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    const done = (ok) => {
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => done(true));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

function redisReady(host, port, timeoutMs = 1500) {
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let response = "";
    let settled = false;
    const done = (ok) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve(ok);
    };
    socket.setTimeout(timeoutMs);
    socket.once("connect", () => {
      // RESP PING distinguishes a live Redis server from a TCP proxy whose
      // upstream disappeared. The latter accepts connections, then drops them;
      // a TCP-only readiness check let Chromium wait three minutes on a stack
      // that could no longer create its player or load live state.
      socket.write("*1\r\n$4\r\nPING\r\n");
    });
    socket.on("data", (chunk) => {
      response += chunk.toString("utf8");
      if (response.includes("\r\n")) {
        done(response.startsWith("+PONG"));
      }
    });
    socket.once("end", () => done(false));
    socket.once("timeout", () => done(false));
    socket.once("error", () => done(false));
    socket.connect(port, host);
  });
}

function httpReady(urlValue, timeoutMs = 10_000) {
  return new Promise((resolve) => {
    const url = new URL("/api/auth/check", urlValue);
    const transport = url.protocol === "https:" ? https : http;
    const request = transport.get(url, (response) => {
      response.resume();
      // Local authenticated routes normally answer 401 without a cookie. A
      // 200 or 403 also proves the HTTP application is serving; 5xx does not.
      resolve([200, 401, 403].includes(response.statusCode));
    });
    request.setTimeout(timeoutMs, () => {
      request.destroy();
      resolve(false);
    });
    request.on("error", () => resolve(false));
  });
}

function lifecycleReady(containerName) {
  const inspect = spawnSync(
    "docker",
    ["inspect", "-f", "{{.State.Running}}", containerName],
    { encoding: "utf8" }
  );
  if (inspect.error || inspect.status !== 0) {
    return {
      available: false,
      ready: false,
      missing: REQUIRED_STACK_SERVICES,
    };
  }
  const running = inspect.stdout.trim();
  if (running !== "true") {
    return {
      available: true,
      ready: false,
      missing: ["container-running"],
    };
  }
  const requestedServices = REQUIRED_STACK_SERVICES.flatMap((name) => {
    if (EXTERNALLY_PROBED_STACK_SERVICES.has(name)) {
      return [];
    }
    const port = STACK_SERVICE_READY_PORTS[name];
    return port ? [{ name, port }] : [];
  });
  const unknownServices = REQUIRED_STACK_SERVICES.filter(
    (name) =>
      !EXTERNALLY_PROBED_STACK_SERVICES.has(name) &&
      !STACK_SERVICE_READY_PORTS[name]
  );
  const probeScript = `
const http = require("http");
const services = JSON.parse(process.argv[1]);
Promise.all(services.map(({ name, port }) => new Promise((resolve) => {
  const request = http.get({ host: "127.0.0.1", port, path: "/ready", timeout: 5000 }, (response) => {
    response.resume();
    resolve([name, response.statusCode === 200]);
  });
  request.on("timeout", () => {
    request.destroy();
    resolve([name, false]);
  });
  request.on("error", () => resolve([name, false]));
}))).then((rows) => process.stdout.write(JSON.stringify(rows)));
`;
  const probes = spawnSync(
    "docker",
    [
      "exec",
      containerName,
      "node",
      "-e",
      probeScript,
      JSON.stringify(requestedServices),
    ],
    // Docker exec startup itself can take several seconds while Chromium and
    // the emulated amd64 server are busy. Keep the probe bounded, but do not
    // confuse host scheduling delay with a dead stack.
    { encoding: "utf8", timeout: 20000, maxBuffer: 1024 * 1024 }
  );
  if (probes.error || probes.status !== 0) {
    return {
      available: true,
      ready: false,
      missing: ["container-ready-probes"],
    };
  }
  let rows;
  try {
    rows = JSON.parse(probes.stdout);
  } catch {
    return {
      available: true,
      ready: false,
      missing: ["container-ready-probe-output"],
    };
  }
  const readyServices = new Set(
    rows.filter(([, ready]) => ready).map(([name]) => name)
  );
  for (const service of EXTERNALLY_PROBED_STACK_SERVICES) {
    readyServices.add(service);
  }
  const missing = [
    ...unknownServices,
    ...requestedServices
      .map(({ name }) => name)
      .filter((service) => !readyServices.has(service)),
  ];
  return { available: true, ready: missing.length === 0, missing };
}

async function ready() {
  const webHttpReady = await httpReady(DEFAULT_ORIGIN);
  const redisPingReady = await redisReady("127.0.0.1", DEFAULT_REDIS_PORT);
  // The sync port is intentionally probed by TCP only. Its internal metrics
  // `/ready` endpoint proves registry/bootstrap completion; TCP proves the
  // external mapping works without sending HTTP to the WebSocket listener.
  const services = [
    {
      name: "web",
      port: DEFAULT_WEB_PORT,
      note: "HTTP 200/401/403",
      up: webHttpReady,
    },
    {
      name: "sync",
      port: DEFAULT_SYNC_PORT,
      note: "WebSocket — TCP probe only, never curl",
    },
    {
      name: "redis",
      port: DEFAULT_REDIS_PORT,
      note: "RESP PING",
      up: redisPingReady,
    },
  ];
  let allUp = true;
  for (const svc of services) {
    const up = svc.up ?? (await tcpReady("127.0.0.1", svc.port));
    allUp = allUp && up;
    console.log(
      `${up ? "UP  " : "DOWN"} ${svc.name.padEnd(6)} :${svc.port}  (${
        svc.note
      })`
    );
  }
  const lifecycle = lifecycleReady(DEFAULT_STACK_CONTAINER);
  if (lifecycle.available) {
    console.log(
      `${
        lifecycle.ready ? "UP  " : "DOWN"
      } lifecycle ${DEFAULT_STACK_CONTAINER}  (${
        lifecycle.ready
          ? REQUIRED_STACK_SERVICES.join(", ")
          : `missing: ${lifecycle.missing.join(", ")}`
      })`
    );
    allUp = allUp && lifecycle.ready;
  } else {
    const allowPortOnly =
      process.env.HARTHMERE_E2E_ALLOW_PORT_ONLY_READY === "1";
    console.log(
      `${
        allowPortOnly ? "WARN" : "DOWN"
      } lifecycle ${DEFAULT_STACK_CONTAINER}  (Docker container unavailable)`
    );
    allUp = allUp && allowPortOnly;
  }
  console.log("");
  console.log(
    allUp
      ? "Stack is release-gate ready. Chromium may now start; still wait for\n" +
          "the in-page client-context signal before gameplay assertions."
      : "Stack not ready. Do not launch Chromium yet."
  );
  process.exitCode = allUp ? 0 : 1;
}

function seedPayload(name) {
  // Quest-state advancement goes through the live-mode writer, never a GET.
  // This prints the shape; it does not send. Review, then POST it yourself.
  const map = {
    busted_chest: {
      why: "Skip Road Ahead + the first three Busted steps.",
      completedQuestTitles: ["Road Ahead"],
      activeQuest: "Busted",
      completedStepIds: [
        310783173745175, // Talk to Jackie
        859994236864492, // Meet with Doc
        3346948724689018, // Talk to Doc
      ],
      nextStepId: 6798640337192760, // the chest claim
    },
    ch1_desert_gate: {
      why: "Skip Acts 1-2 to test the desert gate and dungeon.",
      flags: ["ch1_started", "ch1_act1_complete", "ch1_act2_complete"],
    },
    ch1_winter_gate: {
      why: "Skip Acts 1-4 to test the winter gate and dungeon.",
      flags: [
        "ch1_started",
        "ch1_act1_complete",
        "ch1_act2_complete",
        "ch1_act3_complete",
        "ch1_act4_complete",
      ],
    },
    ch1_ashline: {
      why: "Skip to Act 4 for the containment set piece.",
      flags: [
        "ch1_started",
        "ch1_act1_complete",
        "ch1_act2_complete",
        "ch1_act3_complete",
      ],
    },
  };
  return map[name];
}

function loadPromoRegistry() {
  // Keep the ordinary readiness/deep-link commands cheap. Pay ts-node startup
  // only when generating a promo URL from the TypeScript scene registry.
  require("ts-node/register/transpile-only");
  require("tsconfig-paths/register");
  return require("../../src/shared/cutscene/promo_scenes.ts");
}

// ---------------------------------------------------------------------------

const [, , cmd, arg, ...rest] = process.argv;

(async () => {
  switch (cmd) {
    case "list": {
      const width = Math.max(...Object.keys(CHECKPOINTS).map((k) => k.length));
      for (const [name, cp] of Object.entries(CHECKPOINTS)) {
        console.log(`${name.padEnd(width)}  ${cp.what}`);
        console.log(
          `${" ".repeat(width)}  [${cp.pos.join(", ")}]  <- ${cp.source}`
        );
      }
      break;
    }
    case "url": {
      if (!arg) {
        console.error("usage: e2e-jump.cjs url <checkpoint>");
        process.exit(2);
      }
      const extra = {};
      for (const r of rest) {
        const [k, v] = r.replace(/^--/, "").split("=");
        if (k) extra[k] = v ?? "1";
      }
      console.log(deepLink(arg, DEFAULT_ORIGIN, extra));
      break;
    }
    case "all-urls": {
      for (const name of Object.keys(CHECKPOINTS)) {
        console.log(`# ${name}: ${CHECKPOINTS[name].what}`);
        console.log(deepLink(name));
        console.log("");
      }
      break;
    }
    case "cloud-save-url": {
      if (!arg) {
        console.error("usage: e2e-jump.cjs cloud-save-url <install-id>");
        process.exit(2);
      }
      const extra = {};
      for (const r of rest) {
        const [k, v] = r.replace(/^--/, "").split("=");
        if (k) extra[k] = v ?? "1";
      }
      console.log(cloudSaveUrl(arg, DEFAULT_ORIGIN, extra));
      break;
    }
    case "promo-batch-url": {
      if (!arg) {
        console.error("usage: e2e-jump.cjs promo-batch-url <group>");
        process.exit(2);
      }
      const extra = {};
      for (const r of rest) {
        const [k, v] = r.replace(/^--/, "").split("=");
        if (k) extra[k] = v ?? "1";
      }
      const registry = loadPromoRegistry();
      console.log(
        registry.promoBatchCaptureAuthUrl(arg, DEFAULT_ORIGIN, extra)
      );
      break;
    }
    case "ready":
      await ready();
      break;
    case "seed": {
      const payload = seedPayload(arg);
      if (!payload) {
        console.error(
          `no seed recipe for "${arg}". Available: ` +
            "busted_chest, ch1_ashline, ch1_desert_gate, ch1_winter_gate"
        );
        process.exit(2);
      }
      console.log(`# ${payload.why}`);
      console.log(
        "# Send through the live-mode WRITER (POST). A GET must never mutate."
      );
      console.log(JSON.stringify(payload, null, 2));
      break;
    }
    default:
      console.log(
        [
          "usage:",
          "  e2e-jump.cjs list                 # every checkpoint",
          "  e2e-jump.cjs url <checkpoint>     # deep link that spawns you there",
          "  e2e-jump.cjs cloud-save-url <id>  # local Cloud Save URL with native sync",
          "  e2e-jump.cjs promo-batch-url <g>  # authenticated warm promo batch",
          "  e2e-jump.cjs all-urls             # every deep link, paste-ready",
          "  e2e-jump.cjs ready                # lifecycle + HTTP + sync TCP",
          "  e2e-jump.cjs seed <checkpoint>    # print quest-state skip payload",
          "",
          `origin: ${DEFAULT_ORIGIN}  (override with HARTHMERE_E2E_URL)`,
        ].join("\n")
      );
      process.exit(cmd ? 2 : 0);
  }
})();
