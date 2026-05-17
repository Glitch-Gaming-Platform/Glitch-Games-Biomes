#!/usr/bin/env node
const {
  economySource,
  exists,
  read,
  checkFactory,
} = require("./harthmere-economy-optimization-test-lib-v1.cjs");

const root = process.argv[2] || process.cwd();
const { check, finish } = checkFactory();

console.log("== test-harthmere-tax-fee-rounding-v1 ==");
console.log(`Root: ${root}`);
console.log("");

const src = exists(root, "src/client/components/challenges/LocalDevHarthmereEconomyOptimizationSystem.tsx")
  ? economySource(root)
  : "";
const suite = exists(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  ? read(root, "scripts/harthmere/test-harthmere-town-placement-suite-v1.cjs")
  : "";


for (const field of [
  "auctionListingFeePercent",
  "auctionSaleTaxPercent",
  "luxuryItemTaxPercent",
  "blackMarketCutPercent",
  "tradeTaxPercent",
  "mailAttachmentFeeCopper",
  "codFeePercent",
  "craftingStationFeePercent",
  "minimumAuctionTaxCopper",
  "minimumListingFeeCopper",
  "ceil_to_copper",
  "transparentBeforeConfirm",
]) {
  check(`tax/fee policy includes ${field}`, src.includes(field));
}
check("minimum fee helper exists", src.includes("calculateHarthmereMinimumFee"));
check("auction tax helper exists", src.includes("calculateHarthmereAuctionTax"));
check("listing fee helper exists", src.includes("calculateHarthmereListingFee"));
check("tax calculations use ceil/minimum to avoid tiny transaction bypass", src.includes("Math.ceil") && src.includes("Math.max(minimumCopper"));


finish();
