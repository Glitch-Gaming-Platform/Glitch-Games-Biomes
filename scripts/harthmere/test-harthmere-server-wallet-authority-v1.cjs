#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere server wallet authority tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("wallet", source.includes("wallet") || hud.includes("wallet"));
check("validateHarthmereServerWalletAuthority", source.includes("validateHarthmereServerWalletAuthority") || hud.includes("validateHarthmereServerWalletAuthority"));
check("serverDeltaRequired", source.includes("serverDeltaRequired") || hud.includes("serverDeltaRequired"));
check("amount", source.includes("amount") || hud.includes("amount"));
check("balance", source.includes("balance") || hud.includes("balance"));
check("delta", source.includes("delta") || hud.includes("delta"));
finish();
