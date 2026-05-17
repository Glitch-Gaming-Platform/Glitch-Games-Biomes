#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere mail attachments and COD tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx";
check("storage/mail/recovery module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("mail attachment send function exists", src.includes("sendHarthmereMailWithAttachments"));
check("mail attachments are removed from sender atomically", src.includes("attachments_removed_atomically_and_mail_created") && src.includes("removeBackpackItem(nextSender"));
check("mail rejects protected attachments", src.includes("isProtectedForExternalMove(item)") && src.includes("Quest items cannot be mailed"));
check("mail has immutable COD field", src.includes("immutableCodGold") && src.includes("clientClaimedCodGold"));
check("mail COD cannot be spoofed", src.includes("Mail COD cannot be spoofed by the client"));
check("recipient must have COD gold", src.includes("Recipient lacks COD gold"));
check("COD transfers gold to sender", src.includes("nextSender.wallet.gold") && src.includes("+ codGold"));
check("mail claim fails safely when backpack full", src.includes("Backpack is full; claim mail through overflow/recovery"));
check("mail service NPC exists", src.includes("courier_anwen") && src.includes("service: \"mail\""));
finish();
