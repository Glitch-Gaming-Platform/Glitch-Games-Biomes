#!/usr/bin/env node
const childProcess = require("child_process");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const HAR_PATH =
  process.env.BIOMES_PROD_CHAT_HAR_PATH ||
  "/Users/devindixon/Downloads/biomes_har.har";
const PROD_ORIGIN =
  process.env.BIOMES_PROD_ORIGIN ||
  "https://biomes-node-vnet.thankfulfield-9814940f.eastus.azurecontainerapps.io";
const REDIS_HOST =
  process.env.BIOMES_PROD_REDIS_HOST || process.env.REDIS_HOST || "20.127.78.175";
const REDIS_PORT =
  process.env.BIOMES_PROD_REDIS_PORT || process.env.REDIS_PORT || "6379";
const CHAT_DB = "4";
const CHAT_STREAM = "chat-delivery";
const PROD_GROUP = "redis-chat-distributor";
const LIVE_ROUTE = process.env.BIOMES_PROD_CHAT_ROUTE_TEST === "1";
const LIVE_TEMP_FANOUT =
  process.env.BIOMES_PROD_CHAT_TEMP_FANOUT_TEST === "1";
const EXPECT_PROD_GROUP =
  process.env.BIOMES_EXPECT_PROD_CHAT_DISTRIBUTOR === "1";

let failures = 0;
function ok(condition, message, detail) {
  if (condition) {
    console.log(`OK ${message}${detail ? ` :: ${detail}` : ""}`);
  } else {
    failures += 1;
    console.error(`FAIL ${message}${detail ? ` :: ${detail}` : ""}`);
  }
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), "utf8");
}

function redisCli(args, options = {}) {
  try {
    return childProcess.execFileSync(
      "redis-cli",
      ["-h", REDIS_HOST, "-p", REDIS_PORT, "-n", CHAT_DB, ...args],
      { encoding: "utf8", stdio: ["ignore", "pipe", options.quiet ? "ignore" : "pipe"] },
    );
  } catch (error) {
    if (options.allowFailure) {
      return `${error.stdout ?? ""}${error.stderr ?? ""}`;
    }
    throw error;
  }
}

function parseHar() {
  if (!fs.existsSync(HAR_PATH)) {
    throw new Error(`HAR not found: ${HAR_PATH}`);
  }
  const har = JSON.parse(fs.readFileSync(HAR_PATH, "utf8"));
  const entries = (har.log?.entries ?? []).filter((entry) =>
    String(entry.request?.url ?? "").includes("/api/chat/message"),
  );
  const successful = entries.filter((entry) => Number(entry.response?.status) === 200);
  const latest = successful.at(-1);
  if (!latest) {
    return { entries, successful, latest: undefined };
  }
  const body = JSON.parse(latest.request.postData?.text ?? "{}");
  const response = JSON.parse(latest.response.content?.text ?? "{}");
  const mail = response.delivery?.mail?.[0];
  return { entries, successful, latest, body, response, mail };
}

function headersFromHar(entry) {
  const headers = {};
  for (const { name, value } of entry.request.headers ?? []) {
    const lower = String(name).toLowerCase();
    if (
      lower.startsWith(":") ||
      lower === "content-length" ||
      lower === "host" ||
      lower === "accept-encoding"
    ) {
      continue;
    }
    headers[name] = value;
  }
  headers["content-type"] = "application/json";
  return headers;
}

async function postProductionChat(entry, body) {
  const response = await fetch(`${PROD_ORIGIN}/api/chat/message`, {
    method: "POST",
    headers: headersFromHar(entry),
    body: JSON.stringify(body),
  });
  const text = await response.text();
  let json;
  try {
    json = JSON.parse(text);
  } catch {
    json = undefined;
  }
  return { status: response.status, text, json };
}

async function runLiveTempFanout(entry, body) {
  require("ts-node/register/transpile-only");
  require("tsconfig-paths/register");
  const Redis = require("ioredis");
  const {
    EXTENDED_DELIVERY_FIELD_NAME,
    EXTENDED_DELIVERY_STREAM_KEY,
    deserializeSingleDelivery,
  } = require("@/server/shared/chat/redis/common");

  const nonce = crypto.randomBytes(5).toString("hex");
  const group = `codex-prod-chat-smoke-${nonce}`;
  const consumer = `codex-${nonce}`;
  const target = Number(`889${Date.now().toString().slice(-10)}`);
  const redis = new Redis({
    host: REDIS_HOST,
    port: Number(REDIS_PORT),
    db: Number(CHAT_DB),
    lazyConnect: true,
    maxRetriesPerRequest: 1,
  });
  let postedId;
  try {
    await redis.connect();
    await redis.xgroup("CREATE", CHAT_STREAM, group, "$", "MKSTREAM");
    const beforeTargetCount = await redis.hlen(`chats:${target}`);
    const routeResult = await postProductionChat(entry, body);
    ok(routeResult.status === 200, "live production chat POST succeeds before temp fanout", `status=${routeResult.status}`);
    postedId = routeResult.json?.delivery?.mail?.[0]?.id;
    ok(typeof postedId === "string" && postedId.length > 0, "live production chat POST returns echoed envelope id");

    const deadline = Date.now() + 8000;
    let matchedPacked;
    let matchedStreamId;
    while (Date.now() < deadline && !matchedPacked) {
      const result = await redis.xreadgroupBuffer(
        "GROUP",
        group,
        consumer,
        "COUNT",
        10,
        "BLOCK",
        1000,
        "STREAMS",
        EXTENDED_DELIVERY_STREAM_KEY,
        ">",
      );
      const items = result?.[0]?.[1] ?? [];
      for (const [streamId, fields] of items) {
        for (let i = 0; i < fields.length; i += 2) {
          if (!fields[i].equals(EXTENDED_DELIVERY_FIELD_NAME)) {
            continue;
          }
          const packed = fields[i + 1];
          const delivery = deserializeSingleDelivery(packed);
          if (delivery?.mail?.some((mail) => mail.id === postedId)) {
            matchedPacked = packed;
            matchedStreamId = streamId;
            break;
          }
        }
        if (matchedPacked) break;
      }
    }
    ok(Boolean(matchedPacked), "temporary production Redis consumer reads the route-created chat delivery");

    if (matchedPacked && postedId) {
      await redis.hsetBuffer(`chats:${target}`, postedId, matchedPacked);
      const delivered = await redis.hgetBuffer(`chats:${target}`, postedId);
      ok(
        Buffer.isBuffer(delivered) && delivered.equals(matchedPacked),
        "temporary fanout writes the exact packed delivery to a synthetic recipient hash",
      );
      await redis.hdel(`chats:${target}`, postedId);
      const afterTargetCount = await redis.hlen(`chats:${target}`);
      ok(
        afterTargetCount === beforeTargetCount,
        "temporary fanout cleanup removes the synthetic recipient delivery",
      );
    }
    if (matchedStreamId) {
      await redis.xack(CHAT_STREAM, group, matchedStreamId);
    }
  } finally {
    try {
      if (postedId) {
        await redis.hdel(`chats:${target}`, postedId);
      }
      await redis.xgroup("DESTROY", CHAT_STREAM, group);
    } catch {
      // Best-effort cleanup; the group name is unique and harmless if already gone.
    }
    redis.disconnect();
  }
}

async function main() {
  console.log("== Harthmere production world chat route current ==");
  console.log(`Root: ${root}`);
  console.log(`Production origin: ${PROD_ORIGIN}`);
  console.log(`Production chat Redis: ${REDIS_HOST}:${REDIS_PORT} db=${CHAT_DB}\n`);

  const har = parseHar();
  ok(har.entries.length >= 1, "HAR contains /api/chat/message requests", `count=${har.entries.length}`);
  ok(har.successful.length >= 1, "HAR shows production chat route returned HTTP 200", `count=${har.successful.length}`);
  ok(Array.isArray(har.body?.position), "HAR chat POST includes spatial position fallback");
  ok(har.body?.volume === "chat", "HAR chat POST uses global chat volume");
  ok(typeof har.mail?.from === "number", "HAR production response echoes authenticated sender id");
  ok(har.mail?.message?.kind === "text", "HAR production response echoes text mail");

  const stackRunner = read("scripts/glitch/run-glitch-local-game-stack.sh");
  ok(
    stackRunner.includes('start_bg chat 127.0.0.1 3300 3304 3301 "$APP_ROOT/dist/chat.js"'),
    "patched production stack starts bundled chat distributor service",
  );
  ok(
    stackRunner.includes("wait_http_ready 127.0.0.1 3301 chat"),
    "patched production stack waits for chat distributor readiness before web traffic",
  );
  ok(
    stackRunner.includes("wait_redis_stream_group 4 chat-delivery redis-chat-distributor chat-distributor"),
    "patched production stack waits for Redis chat distributor consumer group before web traffic",
  );

  const streamType = redisCli(["TYPE", CHAT_STREAM]).trim();
  ok(streamType === "stream", "production chat DB has chat-delivery stream", `type=${streamType}`);
  const streamLength = Number(redisCli(["XLEN", CHAT_STREAM]).trim());
  ok(streamLength >= har.successful.length, "production chat stream contains route-created spatial deliveries", `xlen=${streamLength}`);
  const groupsRaw = redisCli(["XINFO", "GROUPS", CHAT_STREAM], { allowFailure: true });
  const hasProdGroup = groupsRaw.includes(PROD_GROUP);
  if (EXPECT_PROD_GROUP) {
    ok(hasProdGroup, "production Redis has the redis-chat-distributor consumer group");
  } else {
    ok(
      !hasProdGroup,
      "diagnostic mode confirms current production is missing the redis-chat-distributor group before deploy",
    );
  }

  if (LIVE_ROUTE || LIVE_TEMP_FANOUT) {
    const baseBody = har.body ?? {};
    const nonce = crypto.randomBytes(4).toString("hex");
    const liveBody = {
      ...baseBody,
      localTime: Date.now(),
      volume: "chat",
      position: Array.isArray(baseBody.position) ? baseBody.position : [484.59, 68.5, -149.875],
      message: {
        kind: "text",
        content: `Codex prod chat route smoke ${new Date().toISOString()} ${nonce}`,
      },
    };
    if (LIVE_TEMP_FANOUT) {
      await runLiveTempFanout(har.latest, liveBody);
    } else {
      const beforeXlen = Number(redisCli(["XLEN", CHAT_STREAM]).trim());
      const result = await postProductionChat(har.latest, liveBody);
      ok(result.status === 200, "live production chat POST succeeds", `status=${result.status}`);
      const delivery = result.json?.delivery?.mail?.[0];
      ok(typeof delivery?.id === "string", "live production chat POST returns echoed delivery id");
      ok(delivery?.message?.content === liveBody.message.content, "live production route stores the requested test message content");
      const afterXlen = Number(redisCli(["XLEN", CHAT_STREAM]).trim());
      ok(afterXlen === beforeXlen + 1, "live production chat POST appends one spatial delivery stream entry", `before=${beforeXlen} after=${afterXlen}`);
      if (delivery?.from && delivery?.id) {
        const hashValue = redisCli(["HGET", `chats:${delivery.from}`, delivery.id], { allowFailure: true, quiet: true });
        ok(hashValue.length > 0, "live production chat POST writes immediate self echo to sender chat hash");
      }
    }
  } else {
    console.log("\nNOTE live route mutation skipped. Set BIOMES_PROD_CHAT_ROUTE_TEST=1 to POST one test chat message.");
    console.log("NOTE set BIOMES_PROD_CHAT_TEMP_FANOUT_TEST=1 to also create a temporary consumer group, prove delivery, and clean it up.");
  }

  if (failures > 0) {
    console.error("\nRESULT: FAIL");
    process.exit(1);
  }
  console.log("\nRESULT: PASS");
}

main().catch((error) => {
  console.error(error.stack || error.message || String(error));
  process.exit(1);
});
