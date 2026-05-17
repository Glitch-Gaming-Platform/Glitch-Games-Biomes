#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere overflow and recovery tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx";
check("storage/mail/recovery module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("overflow state exists", src.includes("overflow") && src.includes("HarthmereOverflowRecord"));
check("reward overflow function exists", src.includes("grantHarthmereRewardWithOverflow"));
check("overflow stores reward items when backpack full", src.includes("backpack_full_reward_items_stored_in_overflow") && src.includes("availableSlots"));
check("recovery state exists", src.includes("recovery") && src.includes("HarthmereRecoveryRecord"));
check("failed transaction recovery records item", src.includes("recordHarthmereFailedTransactionRecovery") && src.includes("failed_transaction_recorded_for_item_recovery"));
check("recovery protects against checksum mismatch", src.includes("Recovery checksum mismatch") && src.includes("checksumItem"));
check("recovery prevents double restore", src.includes("already restored") && src.includes("restoredAt"));
check("recovery remains available if backpack full", src.includes("Backpack full; recovery remains available"));
check("recovery handles server crash and failed trade/auction/mail/bank reasons", hasAll(src, ["server_crash", "failed_trade", "failed_auction", "failed_mail", "failed_bank"]));
finish();
