#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const root = process.argv[2] || process.cwd();
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');
let failures = 0;
function ok(cond, msg) {
  if (cond) console.log(`OK: ${msg}`);
  else { console.error(`FAIL: ${msg}`); failures++; }
}
function notContains(src, needle, msg) { ok(!src.includes(needle), msg); }
function contains(src, needle, msg) { ok(src.includes(needle), msg); }

const bankingTab = read('src/client/components/biomes_ui/tabs/BankingTab.tsx');
const inventoryTab = read('src/client/components/biomes_ui/tabs/InventoryTab.tsx');
const adapter = read('src/client/components/biomes_ui/adapters/useBiomesUILiveAdapters.ts');
const backend = read('src/shared/harthmere/live_mode_backend_v1.ts');
const route = read('src/pages/api/harthmere/live_mode_bank_state.ts');

notContains(bankingTab, 'PLACEHOLDER_', 'BankingTab contains no placeholder banking arrays');
notContains(bankingTab, 'Gold", amount: 1240', 'BankingTab contains no fake gold balance');
contains(bankingTab, 'data-production-banking="true"', 'BankingTab marks production banking mode');
contains(bankingTab, 'depositAccount', 'BankingTab exposes shared account vault deposit');
contains(bankingTab, 'depositMaterial', 'BankingTab exposes material storage deposit');
contains(bankingTab, 'takeLoan', 'BankingTab exposes loan creation');
contains(bankingTab, 'repayLoan', 'BankingTab exposes loan repayment');
contains(bankingTab, 'upgradeSlots', 'BankingTab exposes bank slot upgrades');

notContains(inventoryTab, 'No description available from item metadata', 'InventoryTab does not render missing-metadata error copy');
notContains(inventoryTab, 'maxSlots: 32, usedSlots: 0', 'InventoryTab does not fall back to fake 32-slot inventory when adapter is missing');
contains(inventoryTab, 'Weight', 'InventoryTab displays carry weight');
contains(inventoryTab, 'overLimit', 'InventoryTab has overweight state');

contains(adapter, 'fetchBankingStateV1', 'Live adapter hydrates bank state from server');
contains(adapter, 'submitBankingLiveModeAction', 'Live adapter posts real bank actions');
contains(adapter, 'actionKind: "request_bank_transaction"', 'Live adapter uses backend bank action');
contains(adapter, 'getDepositCandidates', 'Live adapter supplies real inventory deposit candidates');
contains(adapter, 'itemWeight', 'Live adapter computes carry weight from real inventory slots');
contains(adapter, 'hasExplicitItemName', 'Live adapter filters fake currency labels');

contains(backend, 'HarthmereLiveModeBankingStateV1', 'Backend has production banking state');
contains(backend, 'accountBank', 'Backend implements shared account vault');
contains(backend, 'materialStorage', 'Backend implements material storage');
contains(backend, 'bank_slot_upgrade', 'Backend logs slot upgrades');
contains(backend, 'bank_loan_taken', 'Backend logs loan creation');
contains(backend, 'bank_loan_payment', 'Backend logs loan repayment');
contains(backend, 'HARTHMERE_LOAN_DAILY_INTEREST_RATE_V1', 'Backend has daily loan interest');
contains(backend, 'transactionLogs', 'Backend has banking transaction logs');

contains(route, 'method: "GET"', 'Bank state route hydrates with GET');
contains(route, 'createHarthmereLiveModeBankingClientSnapshotV1', 'Bank state route returns client banking snapshot');

if (failures) process.exit(1);
console.log('All BiomesUI banking/inventory production checks passed.');
