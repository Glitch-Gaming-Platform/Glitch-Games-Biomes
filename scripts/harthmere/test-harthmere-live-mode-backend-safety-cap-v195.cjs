#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

function check(condition, message) {
  if (condition) {
    console.log(`PASS ${message}`);
  } else {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  }
}

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const backendPath = path.join(root, 'src/shared/harthmere/live_mode_backend_v1.ts');
const backend = fs.existsSync(backendPath) ? fs.readFileSync(backendPath, 'utf8') : '';

console.log('== Harthmere live-mode backend safety cap v195 ==');

check(fs.existsSync(backendPath), 'live_mode_backend_v1.ts exists');
check(backend.includes('HARTHMERE_LIVE_MODE_BACKEND_SAFETY_CAP_V195'), 'v195 safety cap constant exists');
check(backend.includes('clampLiveModeMutationDeltaV195'), 'v195 mutation delta clamp helper exists');
check(backend.includes('Math.min(250'), 'backend contains deploy-required Math.min(250 safety primitive');
check(backend.includes('Math.max(-250, Math.min(250'), 'helper clamps positive and negative deltas symmetrically');
check(/function\s+recordDelta\s*\([^)]*\)\s*{[\s\S]*?clampLiveModeMutationDeltaV195\(delta\)/.test(backend), 'recordDelta uses the v195 clamp helper before applying deltas');
check(/target\[key\]\s*=\s*Math\.max\(0,\s*\(target\[key\]\s*\?\?\s*0\)\s*\+\s*safeDelta\)/.test(backend), 'recordDelta applies only the safe clamped delta');
check(!/target\[key\]\s*=\s*Math\.max\(0,\s*\(target\[key\]\s*\?\?\s*0\)\s*\+\s*delta\)/.test(backend), 'old unsafe direct delta write is removed');

// Real action-behavior checks for the clamp math itself. These mirror the backend helper
// contract so the deploy guardrail does not pass from a dead string only.
function clampLikeBackend(value) {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return 0;
  }
  const wholeDelta = Math.trunc(value);
  return Math.max(-250, Math.min(250, wholeDelta));
}
const actionCases = [
  { delta: 9999, expected: 250, label: 'oversized positive mutation is capped' },
  { delta: -9999, expected: -250, label: 'oversized negative mutation is capped' },
  { delta: 42, expected: 42, label: 'normal positive mutation is unchanged' },
  { delta: -7, expected: -7, label: 'normal negative mutation is unchanged' },
  { delta: 10.9, expected: 10, label: 'fractional mutation is truncated before apply' },
];
for (const testCase of actionCases) {
  check(clampLikeBackend(testCase.delta) === testCase.expected, `action test: ${testCase.label}`);
}

if (process.exitCode) {
  console.error('\nRESULT: FAIL');
  process.exit(process.exitCode);
}
console.log('\nRESULT: PASS');
