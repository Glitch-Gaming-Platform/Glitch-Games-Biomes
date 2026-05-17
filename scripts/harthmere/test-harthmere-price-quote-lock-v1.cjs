#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-price-quote-lock-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const term of ["HarthmerePriceQuote", "quoteId", "quotedCopper", "createdAt", "expiresAt", "createHarthmereVendorPriceQuote", "isHarthmerePriceQuoteValid"]) {
  check(`price quote lock includes ${term}`, src.includes(term));
}
check("quote TTL is short and explicit", src.includes("ttlMs") && src.includes("30_000"));
check("quoted price remains non-negative", src.includes("Math.max(0, Math.round(input.baseCopper))"));
check("quote validity checks created/expires window", src.includes("now >= quote.createdAt") && src.includes("now <= quote.expiresAt"));
check("price quote lock has versioned localStorage key", src.includes("priceQuotes.v1"));


finish();
