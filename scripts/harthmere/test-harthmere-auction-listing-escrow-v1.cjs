#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere auction listing and escrow tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx";
check("trade/auction module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("auction listings are implemented", src.includes("createHarthmereAuctionListing") && src.includes("HarthmereAuctionListing"));
check("listing fee is declared", src.includes("HARTHMERE_AUCTION_LISTING_FEE_RATE") && src.includes("listingFeeGold"));
check("listing removes item from seller backpack", src.includes("removeOwnedItem(nextSeller") && src.includes("Unable to escrow auction item"));
check("auction listing writes escrow record", src.includes("next.escrow[escrowId]") && src.includes("source: \"auction\""));
check("duplicate auction requests are rejected", src.includes("markTransaction") && src.includes("Duplicate transaction request rejected"));
check("bound quest locked escrowed items are rejected before listing", src.includes("isHarthmereTradeableItem(item)") && hasAll(src, ["accountBound", "questItem", "lockedInTrade", "escrowId"]));
check("buyer funds are checked before purchase", src.includes("Buyer lacks enough gold") && src.indexOf("Buyer lacks enough gold") < src.indexOf("buyer.wallet.gold ="));
check("auction purchase requires active non-expired listing", hasAll(src, ["listing.status !== \"active\"", "listing.expiresAt <= now()"]));
check("auction purchase consumes escrow exactly once", src.includes("delete next.escrow[listing.escrowId]") && src.includes("status = \"sold\""));
finish();
