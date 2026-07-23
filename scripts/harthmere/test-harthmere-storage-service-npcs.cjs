#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere storage service NPC and HUD tests current ==");
console.log(`Root: ${root}`); console.log("");
const storageRel = "src/client/components/challenges/LocalDevHarthmereStorageMailRecoverySystem.tsx";
const tradeRel = "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx";
const hudRel = "src/client/components/challenges/HarthmereUnifiedHUD.tsx";
check("storage/mail/recovery module exists", exists(root, storageRel));
check("trade/auction module exists", exists(root, tradeRel));
const storage = exists(root, storageRel) ? read(root, storageRel) : "";
const hud = exists(root, hudRel) ? read(root, hudRel) : "";
check("service NPCs include bank mail storage auction escrow", hasAll(storage, ["banker_merl_voss", "courier_anwen", "storage_steward", "auction_clerk_pell"]));
check("storage debug bridge exposes bank/mail/recovery actions", hasAll(storage, ["__harthmereStorageMailRecovery", "depositBankItem", "sendMailWithAttachments", "restoreRecoveryItem"]));
check("trade debug bridge exposes trade and auction actions", read(root, tradeRel).includes("__harthmereTradeAuction"));
check("Unified HUD imports trade auction panel", hud.includes("HarthmereTradeAuctionMenuPanel"));
check("Unified HUD imports storage mail recovery panel", hud.includes("HarthmereStorageMailRecoveryMenuPanel"));
check("legacy Unified HUD retires duplicate storage/trade panels in favor of BiomesUI", hasAll(hud, [
  "HARTHMERE_LEGACY_BIOMES_SYSTEMS_PANEL_RETIRED",
  "The replacement BiomesUI now owns Journal/Inventory/Map/Bank/Skills/etc.",
  "return null;",
]));
finish();
