#!/usr/bin/env node
const fs = require("fs");
const path = require("path");

const root = process.argv[2] || process.cwd();
const authPath = path.join(root, "src/client/game/context_managers/auth_manager.ts");
const wsPath = path.join(root, "src/server/shared/zrpc/websocket/server.ts");
const auth = fs.readFileSync(authPath, "utf8");
const ws = fs.readFileSync(wsPath, "utf8");

let ok = true;
function check(label, condition) {
  if (condition) console.log(`OK ${label}`);
  else { ok = false; console.error(`FAIL ${label}`); }
}

check("auth manager no longer hard-asserts local dev user mismatch", !auth.includes('ok(userId === profile.user.id, "User ID mismatch")'));
check("auth manager keeps production mismatch failure", auth.includes('process.env.NODE_ENV === "production"') && auth.includes("throw new Error"));
check("auth manager recovers in development using self_profile", auth.includes("Development auth profile user mismatch") && auth.includes("profile.user.id"));
check("auth manager no longer imports assert ok", !auth.includes('from "assert"'));
check("websocket auth rejection uses validated request closeWithError", ws.includes('req.closeWithError(res, "unauthorized")'));
check("websocket auth rejection does not call missing HttpResponse closeWithError", !ws.includes('res.closeWithError(res, "unauthorized")'));

if (!ok) process.exit(1);
