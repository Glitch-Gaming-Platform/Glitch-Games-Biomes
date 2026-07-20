#!/usr/bin/env node
/*
 * HARTHMERE_INSTALL_ID_FLOW_UNIT
 *
 * Pure-node unit tests for the current install_id login flow. No browser, no
 * container, no network. Each phase of the flow is unit-tested in isolation,
 * so a regression at any one phase is caught before the E2E even runs.
 *
 * Tested units:
 *   1. resolveGlitchLocalSyncBaseUrl in client_config.ts
 *   2. findInstallId in harthmere_glitch_install_bootstrap.tsx
 *   3. normalizeIdentity in harthmere_glitch_install_bootstrap.tsx
 *   4. /api/glitch/harthmere autoLogin response shape (regex-level smoke test
 *      that critical fields are returned)
 */

const fs = require("fs");
const path = require("path");
const Module = require("module");
const ts = (() => {
  try {
    return require(path.resolve(
      process.argv[2] || process.cwd(),
      "node_modules",
      "typescript"
    ));
  } catch {
    return require("typescript");
  }
})();

const repo = path.resolve(process.argv[2] || process.cwd());
const failures = [];
function assert(cond, msg) {
  if (cond) {
    console.log(`OK ${msg}`);
  } else {
    console.error(`FAIL ${msg}`);
    failures.push(msg);
  }
}

function loadTsModule(rel, stubs = {}) {
  const src = fs.readFileSync(path.join(repo, rel), "utf8");
  // Strip the React/JSX bootstrap component shell because we only need the
  // pure exports. For .tsx we transpile the whole file using TS so JSX is
  // gone before we eval it.
  const transpiled = ts.transpileModule(src, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2020,
      jsx: ts.JsxEmit.React,
      esModuleInterop: true,
      isolatedModules: false,
    },
    fileName: rel,
  }).outputText;

  const wrapped = `(function(exports, require, module, __filename, __dirname){${transpiled}\n})`;
  const compiled = new Function("return " + wrapped)();
  const fakeModule = { exports: {} };
  const proxyAny = () =>
    new Proxy(function () {}, {
      get: (_t, name) => {
        if (name === "default") return proxyAny();
        if (name === Symbol.toPrimitive) return () => "";
        return proxyAny();
      },
      apply: () => undefined,
      construct: () => ({}),
    });
  const npmStubs = {
    react: { useEffect: () => {} },
    "detect-gpu": {
      getGPUTier: async () => ({
        tier: 1,
        gpu: "stub",
        isMobile: false,
        type: "FALLBACK",
      }),
    },
    lodash: {
      cloneDeep: (v) => JSON.parse(JSON.stringify(v)),
      includes: (a, b) =>
        Array.isArray(a) ? a.includes(b) : Object.values(a).includes(b),
    },
    "ua-parser-js": {
      UAParser: function () {
        this.getDevice = () => ({ type: "desktop" });
        this.getOS = () => ({ name: "Mac" });
        this.getBrowser = () => ({ name: "Chrome" });
      },
    },
    "wasm-feature-detect": { simd: async () => true },
    assert: {
      ok: (cond, msg) => {
        if (!cond) throw new Error(msg || "assert");
      },
    },
    zod: {
      z: {
        object: () => ({
          parse: () => ({}),
          safeParse: () => ({ success: true, data: undefined }),
        }),
        string: () => ({}),
        number: () => ({}),
      },
    },
  };
  const fakeRequire = (req) => {
    if (stubs[req]) return stubs[req];
    if (npmStubs[req]) return npmStubs[req];
    if (req.startsWith("@/")) {
      // Stub Biomes-internal modules. We only exercise the exported pure
      // functions, never the React component, so opaque stubs are safe.
      return proxyAny();
    }
    try {
      return require(req);
    } catch {
      return proxyAny();
    }
  };
  compiled(
    fakeModule.exports,
    fakeRequire,
    fakeModule,
    path.join(repo, rel),
    path.dirname(path.join(repo, rel))
  );
  return fakeModule.exports;
}

// ---------------------------------------------------------------------------
// Phase 1: resolveGlitchLocalSyncBaseUrl
// ---------------------------------------------------------------------------
console.log("--- Phase 1: resolveGlitchLocalSyncBaseUrl ---");
const clientConfig = loadTsModule("src/client/game/client_config.ts");
const resolve = clientConfig.resolveGlitchLocalSyncBaseUrl;

assert(
  typeof resolve === "function",
  "resolveGlitchLocalSyncBaseUrl is exported as a function"
);

// Scenario A: install_id playboot, no explicit env -> same-host fallback.
{
  const r = resolve({
    installIdInUrl: true,
    explicit: undefined,
    protocol: "http:",
    hostname: "127.0.0.1",
    port: "3017",
    href: "http://127.0.0.1:3017/at?install_id=abc",
  });
  assert(
    r.syncBaseUrl === "http://127.0.0.1:3018",
    "playboot with no explicit env -> falls back to same-host:3018"
  );
  assert(
    r.reason === "no_explicit_value_using_same_host_fallback",
    "playboot fallback uses the no_explicit_value reason"
  );
}

// Scenario B: install_id playboot, explicit points at local. Use it.
{
  const r = resolve({
    installIdInUrl: true,
    explicit: "http://127.0.0.1:3018",
    protocol: "http:",
    hostname: "127.0.0.1",
    port: "3017",
    href: "http://127.0.0.1:3017/at?install_id=abc",
  });
  assert(
    r.syncBaseUrl === "http://127.0.0.1:3018",
    "playboot with explicit local env -> uses explicit"
  );
  assert(
    r.reason === "explicit_is_local",
    "explicit local is reported as explicit_is_local"
  );
}

// Scenario C: install_id playboot, explicit points at *remote* azurecontainerapps.
// This is the regression case from the failure report. Must NOT use explicit.
{
  const r = resolve({
    installIdInUrl: true,
    explicit:
      "wss://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io:4900",
    protocol: "http:",
    hostname: "127.0.0.1",
    port: "3017",
    href: "http://127.0.0.1:3017/at?install_id=abc",
  });
  assert(
    r.syncBaseUrl === "http://127.0.0.1:3018",
    "playboot with stale azurecontainerapps env -> still uses local fallback"
  );
  assert(
    r.reason === "explicit_points_to_remote_but_install_id_local",
    "reason explains we overrode a remote explicit value"
  );
  assert(
    !/azurecontainerapps/.test(r.syncBaseUrl),
    "resolved URL does not contain azurecontainerapps"
  );
}

// Scenario D: public HTTPS install_id runtime must use same-origin WS proxy,
// not an external :4900 websocket URL that Azure Container Apps may not expose.
{
  const r = resolve({
    installIdInUrl: true,
    explicit:
      "wss://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io:4900",
    protocol: "https:",
    hostname:
      "biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io",
    port: "",
    href: "https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io/at?install_id=abc",
  });
  assert(
    r.syncBaseUrl ===
      "https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io",
    "public HTTPS playboot uses same-origin sync proxy instead of :4900"
  );
  assert(
    r.reason === "public_https_install_runtime_using_same_origin_ws_proxy",
    "public HTTPS playboot reports same-origin proxy reason"
  );
}

// Scenario D: no install_id, explicit points at prod. Use explicit (normal prod path).
{
  const r = resolve({
    installIdInUrl: false,
    explicit: "https://api.biomes.gg",
    protocol: "https:",
    hostname: "biomes.gg",
    port: "",
    href: "https://biomes.gg/at",
  });
  assert(
    r.syncBaseUrl === "https://api.biomes.gg",
    "non-playboot with explicit prod -> uses explicit"
  );
}

// Scenario E: install_id playboot served from port 3000 -> sync fallback 3002.
{
  const r = resolve({
    installIdInUrl: true,
    explicit: undefined,
    protocol: "http:",
    hostname: "127.0.0.1",
    port: "3000",
    href: "http://127.0.0.1:3000/at?install_id=abc",
  });
  assert(
    r.syncBaseUrl === "http://127.0.0.1:3002",
    "playboot from :3000 falls back to :3002"
  );
}

// Scenario F: explicit is localhost -> always honored.
{
  const r = resolve({
    installIdInUrl: true,
    explicit: "http://localhost:3018",
    protocol: "http:",
    hostname: "127.0.0.1",
    port: "3017",
    href: "http://127.0.0.1:3017/at?install_id=abc",
  });
  assert(
    /3018/.test(r.syncBaseUrl),
    "explicit http://localhost:3018 is honored"
  );
}

// ---------------------------------------------------------------------------
// Phase 2: findInstallId, normalizeIdentity (bootstrap.tsx)
// ---------------------------------------------------------------------------
console.log("--- Phase 2: bootstrap pure helpers ---");
let bootstrap;
{
  // Stub the writeHarthmereGlitchIdentity import so the TSX transpiles cleanly
  // when we eval it without the full Biomes registry context.
  const identityStub = {
    HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT:
      "biomes:harthmere-glitch-identity-changed",
    writeHarthmereGlitchIdentity: () => {},
  };
  bootstrap = loadTsModule(
    "src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx",
    { "@/client/game/glitch/harthmere_glitch_identity": identityStub }
  );
}

assert(
  typeof bootstrap.findInstallId === "function",
  "findInstallId is exported"
);
assert(
  typeof bootstrap.normalizeIdentity === "function",
  "normalizeIdentity is exported"
);

// Simulate browser globals for findInstallId.
function withWindow(href, storage = {}) {
  const orig = global.window;
  const url = new URL(href);
  global.window = {
    location: {
      href,
      search: url.search,
      hostname: url.hostname,
      port: url.port,
      protocol: url.protocol,
    },
    localStorage: {
      getItem: (k) => (k in storage ? storage[k] : null),
      setItem: (k, v) => {
        storage[k] = v;
      },
    },
  };
  return () => {
    global.window = orig;
  };
}

{
  const cleanup = withWindow("http://127.0.0.1:3017/at?install_id=abc-123");
  try {
    assert(
      bootstrap.findInstallId() === "abc-123",
      "findInstallId reads install_id query param"
    );
  } finally {
    cleanup();
  }
}

{
  const cleanup = withWindow(
    "http://127.0.0.1:3017/at?install_id=canonical-uuid&glitch_install_id=legacy-uuid&game_install_id=legacy-game"
  );
  try {
    assert(
      bootstrap.findInstallId() === "canonical-uuid",
      "findInstallId uses canonical install_id and ignores legacy duplicate params"
    );
  } finally {
    cleanup();
  }
}

{
  const storage = { "glitch.install.id": "from-storage-uuid" };
  const cleanup = withWindow("http://127.0.0.1:3017/at", storage);
  try {
    assert(
      bootstrap.findInstallId() === "from-storage-uuid",
      "findInstallId falls back to localStorage when no query param"
    );
  } finally {
    cleanup();
  }
}

{
  const cleanup = withWindow("http://127.0.0.1:3017/at");
  try {
    assert(
      bootstrap.findInstallId() === undefined,
      "findInstallId returns undefined when nothing is set"
    );
  } finally {
    cleanup();
  }
}

// normalizeIdentity
{
  const id = bootstrap.normalizeIdentity(
    {
      title_id: "title-1",
      glitch_user_id: "guser",
      user_name: "blackmage",
      license_type: "purchased",
    },
    "install-xyz"
  );
  assert(
    id.installId === "install-xyz",
    "normalizeIdentity preserves installId"
  );
  assert(
    id.glitchUserId === "guser",
    "normalizeIdentity reads glitch_user_id from response"
  );
  assert(
    id.gameUserId === "glitch:guser",
    "normalizeIdentity computes gameUserId when glitchUserId is present"
  );
  assert(
    id.userName === "blackmage",
    "normalizeIdentity reads user_name from response"
  );
  assert(
    id.licenseType === "purchased",
    "normalizeIdentity reads license_type from response"
  );
}

{
  const id = bootstrap.normalizeIdentity({}, "install-xyz");
  assert(
    id.gameUserId === "install:install-xyz",
    "normalizeIdentity falls back to install:<id> when no glitch user"
  );
  assert(
    id.userName === "glitch-install-",
    "normalizeIdentity synthesizes a userName from the installId prefix"
  );
}

// ---------------------------------------------------------------------------
// Phase 3: /api/glitch/harthmere autoLogin response contract
// ---------------------------------------------------------------------------
console.log("--- Phase 3: /api/glitch/harthmere autoLogin contract ---");
const handlerSrc = fs.readFileSync(
  path.join(repo, "src/pages/api/glitch/harthmere.ts"),
  "utf8"
);

assert(
  /op === "autoLogin"/.test(handlerSrc),
  "handler dispatches op=autoLogin"
);
assert(
  /createBiomesAuthForGlitchIdentity/.test(handlerSrc),
  "autoLogin creates Biomes auth for the validated identity"
);
assert(
  /setAuthCookies\(res,\s*session,\s*req\)/.test(handlerSrc),
  "createBiomesAuthForGlitchIdentity sets request-aware auth cookies on the response"
);
assert(
  /biomes_user_id:\s*auth\.userId/.test(handlerSrc),
  "autoLogin returns biomes_user_id"
);
assert(
  /biomes_session_id:\s*auth\.session\.id/.test(handlerSrc),
  "autoLogin returns a stateless Biomes session for cookie-free iframe auth"
);
assert(
  /biomes_auth_reused:\s*auth\.reused/.test(handlerSrc),
  "autoLogin reports whether the install-bound Biomes session was reused"
);
assert(
  /auto_login:\s*true/.test(handlerSrc),
  "autoLogin response carries auto_login:true"
);
assert(
  !/\/api\/auth\/dev\/login/.test(handlerSrc),
  "handler does NOT route through the broken /api/auth/dev/login path"
);
assert(
  /ensurePlayerExists/.test(handlerSrc),
  "handler ensures the ECS player row exists before sync starts"
);

if (failures.length) {
  console.error(`\nFAILURES: ${failures.length}`);
  for (const f of failures) console.error("  - " + f);
  process.exit(1);
}
console.log("\nHarthmere install_id flow unit tests current passed.");
