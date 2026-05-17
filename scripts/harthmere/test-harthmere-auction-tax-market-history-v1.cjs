#!/usr/bin/env node
const { read, exists, checkFactory, hasAll } = require("./harthmere-trade-storage-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();
console.log("== Harthmere auction tax and market history tests v1 ==");
console.log(`Root: ${root}`); console.log("");
const rel = "src/client/components/challenges/LocalDevHarthmereTradeAuctionSystem.tsx";
check("trade/auction module exists", exists(root, rel));
const src = exists(root, rel) ? read(root, rel) : "";
check("sale tax rate is declared", src.includes("HARTHMERE_AUCTION_SALE_TAX_RATE") && src.includes("saleTaxRate"));
check("seller payout subtracts auction tax", src.includes("const sellerPayout") && src.includes("listing.priceGold - taxGold"));
check("auction tax is recorded as gold sink", src.includes("auction_tax_sink") && src.includes("taxGold"));
check("listing fee is recorded as gold sink", src.includes("listing_fee_sink") && src.includes("feeGold"));
check("market history exists", src.includes("marketHistory") && src.includes("appendMarketHistory"));
check("market history records listed sold expired cancelled", hasAll(src, ["event: \"listed\"", "event: \"sold\"", "event: \"expired\"", "event: \"cancelled\""]));
check("auction item is delivered through mail after sale", src.includes("Auction won") && src.includes("source: \"auction_purchase\""));
check("buyer cannot buy own listing", src.includes("buyerId === listing.sellerId"));
finish();
