#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere server inventory authority tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("HARTHMERE_SERVER_AUTHORITY_CONTRACT_VERSION", source.includes("HARTHMERE_SERVER_AUTHORITY_CONTRACT_VERSION") || hud.includes("HARTHMERE_SERVER_AUTHORITY_CONTRACT_VERSION"));
check("itemOwnership", source.includes("itemOwnership") || hud.includes("itemOwnership"));
check("validateHarthmereServerInventoryAuthority", source.includes("validateHarthmereServerInventoryAuthority") || hud.includes("validateHarthmereServerInventoryAuthority"));
check("ownerId", source.includes("ownerId") || hud.includes("ownerId"));
check("escrowState", source.includes("escrowState") || hud.includes("escrowState"));
check("clientSuppliedFieldsRejected", source.includes("clientSuppliedFieldsRejected") || hud.includes("clientSuppliedFieldsRejected"));
finish();
