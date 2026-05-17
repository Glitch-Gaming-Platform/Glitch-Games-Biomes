#!/usr/bin/env node
const fs = require("fs");
const path = require("path");
function check(label, condition) { if (condition) console.log(`OK ${label}`); else { console.error(`FAIL ${label}`); process.exitCode = 1; } }
const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const src = fs.readFileSync(path.join(root, "src/shared/harthmere/quest_runtime_v47.ts"), "utf8");
check("client cannot advance or grant quest state", src.includes("client_cannot_advance_or_grant_quest_state"));
check("reward grant id is namespaced", /reward:\$\{questId\}/.test(src));
check("rewards granted once", src.includes("reward_already_granted") && src.includes("reward_already_granted_idempotent"));
check("server-authoritative once policy in reward payload", src.includes('authority: "server"') && src.includes("idempotent: true"));
check("stale event rejected", src.includes("stale_event_tick"));
check("actor mismatch rejected", src.includes("actor_mismatch"));
check("event id must be quest namespaced", src.includes("event_id_must_be_namespaced_to_quest"));
if (process.exitCode) process.exit(process.exitCode);
console.log("RESULT: PASS quest runtime rewards authority v47");
