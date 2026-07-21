#!/usr/bin/env node
"use strict";

const fs = require("fs");
const vm = require("vm");

const nativeVitalsPath =
  "/app/.next/server/pages/api/harthmere/native_vitals.js";
const apiMiddlewarePath = "/app/.next/server/chunks/2325.js";

function literalCount(input, search) {
  return input.split(search).length - 1;
}

function replaceExact(input, search, replacement, label) {
  const count = literalCount(input, search);
  if (count !== 1) {
    throw new Error(`${label}:expected_1:actual_${count}`);
  }
  return input.replace(search, replacement);
}

function replaceRegexExact(input, regex, replacement, label) {
  const matches = input.match(regex) ?? [];
  if (matches.length !== 1) {
    throw new Error(`${label}:expected_1:actual_${matches.length}`);
  }
  return input.replace(regex, replacement);
}

let nativeVitals = fs.readFileSync(nativeVitalsPath, "utf8");
let apiMiddleware = fs.readFileSync(apiMiddlewarePath, "utf8");
let nativeChanged = false;
let middlewareChanged = false;

if (!nativeVitals.includes("HARTHMERE_ECS_HOTFIX_UNDERWATER")) {
  nativeVitals = replaceExact(
    nativeVitals,
    "    const editor = worldApi.edit();",
    `    // HARTHMERE_ECS_HOTFIX_UNDERWATER: keep slow Ask/voxel work outside the optimistic edit window.
    let hotfixHeartbeatUnderwater = false;
    if (body.action === "heartbeat") {
        const hotfixSnapshot = await worldApi.get(auth.userId);
        const hotfixPosition = hotfixSnapshot?.position()?.v;
        hotfixHeartbeatUnderwater = await (0,_server_harthmere_native_vitals_environment__WEBPACK_IMPORTED_MODULE_1__/* .serverDerivedHarthmereUnderwater */ .S)({
            askApi,
            voxeloo,
            position: hotfixPosition && hotfixPosition.length >= 3 ? [
                hotfixPosition[0],
                hotfixPosition[1],
                hotfixPosition[2]
            ] : undefined,
            height: hotfixSnapshot?.size()?.v[1]
        });
    }
    const editor = worldApi.edit();`,
    "native_vitals_editor_anchor"
  );
  nativeVitals = replaceRegexExact(
    nativeVitals,
    /const underwater = await \(0,_server_harthmere_native_vitals_environment__WEBPACK_IMPORTED_MODULE_1__\/\* \.serverDerivedHarthmereUnderwater \*\/ \.S\)\(\{[\s\S]*?height: player\.size\(\)\?\.v\[1\][\s\S]*?\}\);/g,
    "const underwater = hotfixHeartbeatUnderwater;",
    "native_vitals_underwater_lookup"
  );
  nativeChanged = true;
}

if (!apiMiddleware.includes("HARTHMERE_ECS_HOTFIX_RETRY")) {
  apiMiddleware = replaceExact(
    apiMiddleware,
    "        const response = await handler({",
    `        // HARTHMERE_ECS_HOTFIX_RETRY: replay only audited Harthmere handlers after an optimistic ECS conflict.
        const response = await (async () => {
            let hotfixLastConflict;
            for (let hotfixAttempt = 1; hotfixAttempt <= 24; hotfixAttempt += 1) {
                try {
                    return await handler({`,
    "api_middleware_handler_anchor"
  );
  apiMiddleware = replaceRegexExact(
    apiMiddleware,
    /unsafeRequest: req,\s*unsafeResponse: res\s*\}\);\s*if \(config\.response === undefined\) \{/g,
    `unsafeRequest: req,
                        unsafeResponse: res
                    });
                } catch (error) {
                    // HARTHMERE_ECS_HOTFIX_RETRY_GLITCH: autoLogin also ensures the native ECS player.
                    const hotfixUrl = String(req.url ?? "");
                    const hotfixRetryable = (hotfixUrl.startsWith("/api/harthmere/") || hotfixUrl.startsWith("/api/glitch/harthmere")) && error instanceof Error && error.message.includes("Failed to apply change to world");
                    if (!hotfixRetryable || hotfixAttempt >= 24) {
                        throw error;
                    }
                    hotfixLastConflict = error;
                    const hotfixCap = Math.min(250, 10 * 2 ** Math.min(hotfixAttempt - 1, 5));
                    const hotfixDelay = Math.floor(hotfixCap / 2 + Math.random() * hotfixCap / 2);
                    await new Promise((resolve) => setTimeout(resolve, hotfixDelay));
                }
            }
            throw hotfixLastConflict;
        })();
        if (config.response === undefined) {`,
    "api_middleware_handler_close"
  );
  middlewareChanged = true;
}

// Upgrade replicas that already received the first version of this mutable
// patch. Fresh replicas take the expanded branch above; existing replicas have
// the original marker but still need the audited Glitch bootstrap endpoint.
if (!apiMiddleware.includes("HARTHMERE_ECS_HOTFIX_RETRY_GLITCH")) {
  apiMiddleware = replaceExact(
    apiMiddleware,
    '                    const hotfixRetryable = String(req.url ?? "").startsWith("/api/harthmere/") && error instanceof Error && error.message.includes("Failed to apply change to world");',
    `                    // HARTHMERE_ECS_HOTFIX_RETRY_GLITCH: autoLogin also ensures the native ECS player.
                    const hotfixUrl = String(req.url ?? "");
                    const hotfixRetryable = (hotfixUrl.startsWith("/api/harthmere/") || hotfixUrl.startsWith("/api/glitch/harthmere")) && error instanceof Error && error.message.includes("Failed to apply change to world");`,
    "api_middleware_glitch_scope_upgrade"
  );
  middlewareChanged = true;
}

new vm.Script(nativeVitals, { filename: nativeVitalsPath });
new vm.Script(apiMiddleware, { filename: apiMiddlewarePath });

if (nativeChanged) fs.writeFileSync(nativeVitalsPath, nativeVitals);
if (middlewareChanged) fs.writeFileSync(apiMiddlewarePath, apiMiddleware);

console.log(
  JSON.stringify({
    ok: true,
    nativeChanged,
    middlewareChanged,
    nativeMarker: nativeVitals.includes("HARTHMERE_ECS_HOTFIX_UNDERWATER"),
    middlewareMarker: apiMiddleware.includes("HARTHMERE_ECS_HOTFIX_RETRY"),
    glitchMiddlewareMarker: apiMiddleware.includes(
      "HARTHMERE_ECS_HOTFIX_RETRY_GLITCH"
    ),
  })
);
