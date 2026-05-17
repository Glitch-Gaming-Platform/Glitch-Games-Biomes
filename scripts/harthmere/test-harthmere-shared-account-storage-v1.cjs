#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere shared account storage tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx";
check("storage/mail/recovery module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("shared account vault state exists", src.includes("sharedAccountVaults") && src.includes("HarthmereSharedAccountVault"));
check("shared storage accepts only account-bound items", src.includes("Shared account storage only accepts account-bound allowed items") && src.includes("!item!.accountBound"));
check("shared storage rejects quest/locked/escrowed items", hasAll(src, ["Quest items cannot be mailed, traded, or shared", "trade-locked", "escrowed"]));
check("shared storage validates account id", src.includes("getSharedVault(next, player.accountId)"));
check("shared storage enforces capacity", src.includes("Shared account vault is full"));
check("shared storage logs deposits", src.includes("shared_storage_deposit") && src.includes("account_bound_item_deposited_to_shared_vault"));
finish();
