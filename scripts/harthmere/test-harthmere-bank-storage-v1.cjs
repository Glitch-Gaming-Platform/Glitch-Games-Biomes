#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere banking and storage tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx";
check("storage/mail/recovery module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("bank vault state exists", src.includes("bankVaults") && src.includes("HarthmereBankVault"));
check("bank deposit validates ownership", src.includes("Bank deposit validates item ownership") || src.includes("item!.ownerId !== player.playerId"));
check("bank withdraw validates ownership", src.includes("Bank withdraw validates ownership"));
check("bank enforces vault capacity", src.includes("Bank vault is full"));
check("withdraw checks backpack capacity", src.includes("Backpack is full; withdraw blocked"));
check("bank deposit and withdraw log high-value movements", src.includes("HARTHMERE_HIGH_VALUE_STORAGE_LOG_THRESHOLD") && src.includes("highValue"));
check("service NPC registry includes banker", src.includes("banker_merl_voss") && src.includes("service: \"bank\""));
finish();
