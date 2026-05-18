#!/usr/bin/env node
/* eslint-disable no-console */

const crypto = require("crypto");

const baseUrl = (process.env.GLITCH_TEST_BASE_URL || "http://127.0.0.1:3017").replace(/\/+$/, "");
const titleId = process.env.GLITCH_TITLE_ID || "42de534c-600f-4228-af9e-b69faef94cce";
const installId = process.env.GLITCH_TEST_INSTALL_ID || "f7f602be-8d32-4fd6-9eba-2d3b7e6dafd7";
const strictOptional = process.env.STRICT_GLITCH_RUNTIME_TEST === "1";
const runFullFeatureTests = process.env.GLITCH_TEST_FULL_FEATURES !== "0";
const apiPath = "/api/glitch/harthmere";
const endpoint = `${baseUrl}${apiPath}`;
const sessionSuffix = `${Date.now()}-${crypto.randomUUID()}`;

let failed = false;
let warned = false;

function pass(message) {
  console.log(`OK ${message}`);
}

function warn(message) {
  warned = true;
  console.warn(`WARN ${message}`);
}

function fail(message) {
  failed = true;
  console.error(`FAIL ${message}`);
}

function assert(condition, message, details) {
  if (condition) {
    pass(message);
  } else {
    fail(`${message}${details ? ` :: ${details}` : ""}`);
  }
}

async function sleep(ms) {
  await new Promise((resolve) => setTimeout(resolve, ms));
}

async function post(op, payload = {}) {
  const response = await fetch(endpoint, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      op,
      title_id: titleId,
      install_id: installId,
      ...payload,
    }),
  });
  let json;
  const text = await response.text();
  try {
    json = text ? JSON.parse(text) : {};
  } catch {
    json = { raw: text };
  }
  return { response, status: response.status, json, text };
}

function printable(result) {
  return JSON.stringify(result.json ?? result, null, 2).slice(0, 2000);
}

function extractIdentity(json) {
  return {
    username: json?.username || json?.user_name,
    userId: json?.user_id || json?.glitch_user_id,
    gameUserId: json?.game_user_id,
    serverSessionId: json?.server_session_id,
  };
}

async function optionalPost(name, op, payload, requiredPredicate) {
  const result = await post(op, payload);
  const ok = result.response.ok && (!requiredPredicate || requiredPredicate(result.json));
  if (ok) {
    pass(`${name} works`);
    return result;
  }
  const message = `${name} returned HTTP ${result.status}: ${printable(result)}`;
  if (strictOptional) {
    fail(message);
  } else {
    warn(message);
  }
  return result;
}

async function main() {
  console.log(`Testing Glitch container: ${baseUrl}`);
  console.log(`Using title id: ${titleId}`);
  console.log(`Using install id: ${installId}`);

  const health = await fetch(`${baseUrl}/`);
  assert(health.status < 500, `web root responds without server error (${health.status})`);

  const config = await post("config", { install_id: installId });
  assert(config.response.ok && config.json?.ok === true, "Glitch proxy config responds", printable(config));
  assert(config.json?.enabled === true, "Glitch proxy has GLITCH_TITLE_TOKEN enabled", printable(config));
  assert(config.json?.title_id === titleId, "Glitch proxy reports the expected title id", printable(config));

  const firstSessionId = `docker-smoke-a-${sessionSuffix}`;
  const claimA = await post("claimSession", {
    session_id: firstSessionId,
    platform: "docker-smoke-test",
    fingerprint_id: `docker-fingerprint-a-${sessionSuffix}`,
  });
  const identityA = extractIdentity(claimA.json);
  assert(claimA.response.ok && claimA.json?.ok === true && claimA.json?.valid === true, "install validates and claims first session", printable(claimA));
  assert(Boolean(identityA.username), "validated Glitch username is returned", printable(claimA));
  assert(Boolean(identityA.userId), "validated Glitch user id is returned", printable(claimA));
  assert(Boolean(identityA.gameUserId) && String(identityA.gameUserId).startsWith("glitch:"), "game user id is derived from Glitch user id", printable(claimA));
  assert(Boolean(identityA.serverSessionId), "server session id is returned", printable(claimA));

  const heartbeatA = await post("heartbeatSession", {
    server_session_id: identityA.serverSessionId,
  });
  assert(heartbeatA.response.ok && heartbeatA.json?.ok === true && heartbeatA.json?.revoked === false, "first session heartbeat succeeds", printable(heartbeatA));

  // The container test runner sets GLITCH_IDLE_SESSION_MS=1000 by default. Give
  // the first session time to become idle, then claim a newer one for the same
  // Glitch install/user. The older session should be disconnected.
  await sleep(Number(process.env.GLITCH_TEST_IDLE_WAIT_MS || 1300));

  const secondSessionId = `docker-smoke-b-${sessionSuffix}`;
  const claimB = await post("claimSession", {
    session_id: secondSessionId,
    platform: "docker-smoke-test",
    fingerprint_id: `docker-fingerprint-b-${sessionSuffix}`,
  });
  const identityB = extractIdentity(claimB.json);
  assert(claimB.response.ok && claimB.json?.ok === true && claimB.json?.valid === true, "install validates and claims newer session", printable(claimB));
  assert(identityB.username === identityA.username, "newer session keeps same Glitch username", printable(claimB));
  assert(identityB.userId === identityA.userId, "newer session keeps same Glitch user id", printable(claimB));
  assert(identityB.gameUserId === identityA.gameUserId, "newer session keeps same game user id", printable(claimB));
  assert(Array.isArray(claimB.json?.disconnected_session_ids) && claimB.json.disconnected_session_ids.includes(identityA.serverSessionId), "newer login disconnects older idle session", printable(claimB));

  const heartbeatOld = await post("heartbeatSession", {
    server_session_id: identityA.serverSessionId,
  });
  assert(heartbeatOld.response.ok && heartbeatOld.json?.revoked === true, "older idle session is revoked on heartbeat", printable(heartbeatOld));

  const heartbeatNew = await post("heartbeatSession", {
    server_session_id: identityB.serverSessionId,
  });
  assert(heartbeatNew.response.ok && heartbeatNew.json?.ok === true && heartbeatNew.json?.revoked === false, "newer session heartbeat succeeds", printable(heartbeatNew));

  if (runFullFeatureTests) {
    const saveSnapshot = {
      version: "docker-smoke-save-v1",
      savedAt: new Date().toISOString(),
      identity: {
        username: identityB.username,
        userId: identityB.userId,
        gameUserId: identityB.gameUserId,
      },
      smoke: {
        installId,
        sessionId: secondSessionId,
        nonce: sessionSuffix,
      },
    };

    await optionalPost(
      "cloud save write",
      "storeSave",
      {
        server_session_id: identityB.serverSessionId,
        snapshot: saveSnapshot,
        save_type: "manual",
        slot_name: "Docker Smoke Test Save",
        metadata: { source: "docker-smoke-test", nonce: sessionSuffix },
        play_duration_seconds: 3,
      },
      (json) => json?.ok !== false,
    );

    await optionalPost(
      "cloud save list",
      "listSaves",
      {},
      (json) => Array.isArray(json?.saves),
    );

    await optionalPost(
      "progression submit",
      "submitProgression",
      {
        idempotency_key: `docker-smoke-${sessionSuffix}`,
        payload: {
          stats: {
            harthmere_playtime_seconds: 3,
            harthmere_player_level: 1,
            harthmere_xp_current: 0,
            harthmere_gold: 0,
            harthmere_completed_quests: 0,
            harthmere_inventory_items: 0,
            harthmere_enemies_defeated: 0,
          },
          leaderboards: {
            harthmere_highest_level: 1,
            harthmere_richest_traveler: 0,
            harthmere_quest_completion_score: 0,
            harthmere_playtime_score: 3,
          },
        },
        trust_level: "client",
        platform: "docker-smoke-test",
      },
      (json) => json?.ok !== false,
    );

    await optionalPost("player stats fetch", "playerStats", {}, (json) => json?.ok !== false);
    await optionalPost("player achievements fetch", "playerAchievements", {}, (json) => json?.ok !== false);
    await optionalPost(
      "leaderboard fetch",
      "leaderboard",
      { api_key: process.env.GLITCH_TEST_LEADERBOARD_API_KEY || "harthmere_highest_level" },
      (json) => json?.ok !== false,
    );
  }

  await post("releaseSession", {
    server_session_id: identityB.serverSessionId,
    reason: "docker_smoke_test_complete",
  });
  pass("newer session released");

  if (failed) {
    process.exit(1);
  }
  if (warned && strictOptional) {
    process.exit(1);
  }
  console.log("\nDocker Glitch runtime smoke test complete.");
}

main().catch((error) => {
  console.error(error?.stack || error?.message || String(error));
  process.exit(1);
});
