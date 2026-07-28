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
const backend = read('src/shared/harthmere/live_mode_backend.ts');
const bankRoute = read('src/pages/api/harthmere/live_mode_bank_state.ts');
const groveContent = read('src/shared/harthmere/snapshot_grove_content.ts');
const groveRuntime = read('src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx');
const reducerTests = read('src/shared/harthmere/test/live_mode_backend.test.ts');

notContains(bankingTab, 'PLACEHOLDER_', 'BankingTab contains no placeholder banking arrays');
notContains(bankingTab, 'Gold", amount: 1240', 'BankingTab contains no fake gold balance');
contains(bankingTab, 'data-production-banking="true"', 'BankingTab marks production banking mode');
contains(bankingTab, 'Consequence active: credit hold', 'BankingTab explains active loan consequences');
contains(inventoryTab, 'Weight', 'InventoryTab displays carry weight');
contains(adapter, 'fetchBankingState', 'Live adapter hydrates bank state from server');
contains(adapter, 'submitBankingLiveModeAction', 'Live adapter posts real bank actions');
contains(adapter, 'itemWeight', 'Live adapter computes carry weight from real inventory slots');

contains(groveContent, 'id: "grove_banker_merl"', 'Grove has a real banker NPC id');
contains(groveContent, 'Merl Voss, Grove Banker', 'Grove banker NPC has player-facing name');
contains(groveContent, 'idOffset: 9316', 'Grove banker NPC uses a unique seeded id offset');
contains(groveRuntime, 'groveBankerProgressiveQuestionActions', 'Grove banker has progressive Q&A actions');
contains(groveRuntime, 'What can I store here?', 'Grove banker teaches storage');
contains(groveRuntime, 'Does weight limit my backpack?', 'Grove banker teaches soft carry-weight encumbrance');
contains(groveRuntime, 'How do loans work?', 'Grove banker teaches loans');
contains(groveRuntime, 'What happens if I do not repay?', 'Grove banker teaches loan consequences');

contains(backend, 'HARTHMERE_CARRY_WEIGHT_LIMIT', 'Backend has server carry-weight limit');
contains(backend, 'harthmereInventoryCarryWeight', 'Backend computes inventory carry weight');
notContains(backend, 'wouldExceedCarryWeight', 'Backend does not reject incoming items by weight');
notContains(backend, 'wouldDirectInventoryPayloadExceedCarryWeight', 'Backend does not reject direct inventory deltas by weight');
notContains(backend, 'wouldCraftExceedCarryWeight', 'Backend does not reject crafting output by weight');
notContains(backend, 'carry_weight_limit_exceeded', 'Backend emits no carry-weight capacity rejection');
contains(backend, 'applyHarthmereBankLoanConsequences', 'Backend applies loan consequences');
contains(backend, 'bank_loan_defaulted', 'Backend logs loan defaults');
contains(backend, 'HARTHMERE_BANK_CREDIT_HOLD_FLAG', 'Backend enforces bank credit hold');
contains(backend, 'credit_hold_until_defaulted_loan_paid', 'Backend blocks new loans while in credit hold');
contains(backend, 'defaultPenaltyGold', 'Backend records default penalties');
contains(bankRoute, 'state.updatedAtMs = input.nowMs', 'Bank state GET uses current server time for loan consequences');
contains(bankRoute, 'applyHarthmereBankLoanConsequences', 'Bank state GET applies overdue loan consequences');

contains(reducerTests, 'soft carry-weight encumbrance', 'Reducer tests cover soft carry-weight behavior');
contains(reducerTests, 'loan default consequences', 'Reducer tests cover loan consequences');
contains(reducerTests, 'allows personal, account, and material withdrawals while overweight', 'Tests verify overweight bank withdrawals succeed');
contains(reducerTests, 'bank_rejected:credit_hold_until_defaulted_loan_paid', 'Tests verify credit hold blocks new loans');

if (failures) process.exit(1);
console.log('All Biomes banking weight/loan/NPC current checks passed.');
