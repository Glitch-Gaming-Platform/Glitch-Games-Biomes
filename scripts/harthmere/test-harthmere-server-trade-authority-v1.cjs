#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere server trade authority tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("tradeSession", source.includes("tradeSession") || hud.includes("tradeSession"));
check("validateHarthmereServerTradeAuthority", source.includes("validateHarthmereServerTradeAuthority") || hud.includes("validateHarthmereServerTradeAuthority"));
check("confirmedByOtherPlayer", source.includes("confirmedByOtherPlayer") || hud.includes("confirmedByOtherPlayer"));
check("lockedOffer", source.includes("lockedOffer") || hud.includes("lockedOffer"));
check("requiresServerSession", source.includes("requiresServerSession") || hud.includes("requiresServerSession"));
check("idempotencyKey", source.includes("idempotencyKey") || hud.includes("idempotencyKey"));
finish();
