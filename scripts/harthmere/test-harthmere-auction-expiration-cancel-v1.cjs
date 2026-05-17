#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere auction expiration and cancellation tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx";
check("trade/auction module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("auction cancellation function exists", src.includes("cancelHarthmereAuctionListing"));
check("only seller can cancel active listing", src.includes("Only the seller can cancel an active listing"));
check("cancelled auction returns item by mail", src.includes("Auction cancelled") && src.includes("source: \"auction_return\""));
check("cancelled listing fee is not refunded", src.includes("Listing fees are not refunded"));
check("expired auction handler exists", src.includes("expireHarthmereAuctionListings"));
check("expired auction returns item to seller mailbox", src.includes("Auction expired") && src.includes("expired"));
check("missing escrow on expiry logs recovery-needed failure", src.includes("auction_expire_recovery_needed") && src.includes("recovery_required"));
check("expiration and cancellation both delete escrow after return", (src.match(/delete next\.escrow\[listing\.escrowId\]/g) || []).length >= 2);
check("market history records expired and cancelled events", hasAll(src, ["event: \"expired\"", "event: \"cancelled\""]));
finish();
