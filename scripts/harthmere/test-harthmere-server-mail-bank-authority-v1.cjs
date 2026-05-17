#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere server mail/bank authority tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("bankMailStorage", source.includes("bankMailStorage") || hud.includes("bankMailStorage"));
check("validateHarthmereServerMailBankAuthority", source.includes("validateHarthmereServerMailBankAuthority") || hud.includes("validateHarthmereServerMailBankAuthority"));
check("attachmentDelivered", source.includes("attachmentDelivered") || hud.includes("attachmentDelivered"));
check("codPaid", source.includes("codPaid") || hud.includes("codPaid"));
check("sharedAccountOverride", source.includes("sharedAccountOverride") || hud.includes("sharedAccountOverride"));
check("requiresChecksum", source.includes("requiresChecksum") || hud.includes("requiresChecksum"));
finish();
