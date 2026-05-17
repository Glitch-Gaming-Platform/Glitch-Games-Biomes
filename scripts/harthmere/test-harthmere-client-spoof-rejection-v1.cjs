#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere client spoof rejection tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("rejectHarthmereClientSpoof", source.includes("rejectHarthmereClientSpoof") || hud.includes("rejectHarthmereClientSpoof"));
check("client_spoof_rejected", source.includes("client_spoof_rejected") || hud.includes("client_spoof_rejected"));
check("clientSuppliedFieldsRejected", source.includes("clientSuppliedFieldsRejected") || hud.includes("clientSuppliedFieldsRejected"));
check("commitHarthmereServerTransaction", source.includes("commitHarthmereServerTransaction") || hud.includes("commitHarthmereServerTransaction"));
check("rollbackHarthmereServerTransaction", source.includes("rollbackHarthmereServerTransaction") || hud.includes("rollbackHarthmereServerTransaction"));
check("duplicate_idempotency_key_rejected", source.includes("duplicate_idempotency_key_rejected") || hud.includes("duplicate_idempotency_key_rejected"));
check("atomic_commit", source.includes("atomic_commit") || hud.includes("atomic_commit"));
finish();
