#!/usr/bin/env node
const { read, makeCheck, hasAll } = require("./harthmere-depth-systems-test-lib-v1.cjs");
const root = process.argv[2] || process.cwd();
const { check, finish } = makeCheck();
const source = read(root, "src/client/components/challenges/LocalDevHarthmereServerAuthorityContracts.tsx");
const hud = read(root, "src/client/components/challenges/HarthmereUnifiedHUD.tsx");
console.log("== Harthmere server auction authority tests v1 ==");
console.log("Root: " + root);
console.log("");
check("target module exists", source.length > 0);
check("auctionEscrow", source.includes("auctionEscrow") || hud.includes("auctionEscrow"));
check("validateHarthmereServerAuctionAuthority", source.includes("validateHarthmereServerAuctionAuthority") || hud.includes("validateHarthmereServerAuctionAuthority"));
check("escrowLocation", source.includes("escrowLocation") || hud.includes("escrowLocation"));
check("sellerPayout", source.includes("sellerPayout") || hud.includes("sellerPayout"));
check("taxPaid", source.includes("taxPaid") || hud.includes("taxPaid"));
check("requiresEscrowTransaction", source.includes("requiresEscrowTransaction") || hud.includes("requiresEscrowTransaction"));
finish();
