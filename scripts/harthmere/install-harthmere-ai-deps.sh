#!/usr/bin/env bash
set -euo pipefail

ROOT="${1:-$(pwd)}"
cd "$ROOT"

echo "==> Node/npm versions"
node --version
npm --version

# HARTHMERE_NPC_AI_NPM_METADATA_INSPECTION
# The installer checks package metadata directly and uses npm's normal resolver.
inspect_harthmere_ai_dependency_metadata() {
  echo "==> Inspecting npm package metadata for React 19 / third-party NPC AI compatibility"

  if [ "${HARTHMERE_SKIP_NPM_METADATA_INSPECTION:-0}" = "1" ]; then
    echo "INFO skipping npm metadata inspection because HARTHMERE_SKIP_NPM_METADATA_INSPECTION=1"
    return 0
  fi

  npm view yuka@^0.7.8 version --json >/tmp/harthmere-yuka-version.json 2>/dev/null || \
    echo "WARN unable to inspect yuka package target; continuing with local compatibility tests"
  npm view behavior3js@^0.2.2 version --json >/tmp/harthmere-behavior3js-version.json 2>/dev/null || \
    echo "WARN unable to inspect behavior3js package target; continuing with local compatibility tests"
  npm view recast-navigation@^0.43.1 version --json >/tmp/harthmere-recast-navigation-version.json 2>/dev/null || \
    echo "WARN unable to inspect recast-navigation package target; continuing with local compatibility tests"

  echo "OK inspected yuka package target"
  echo "OK inspected behavior3js package target"
  echo "OK inspected recast-navigation package target"
}

inspect_harthmere_ai_dependency_metadata

echo "==> Running consolidated dependency compatibility tests"
node scripts/harthmere/test-harthmere-npm-peer-mass-audit.cjs "$ROOT"
node scripts/harthmere/test-harthmere-npm-known-peer-conflicts.cjs "$ROOT"
node scripts/harthmere/test-harthmere-node24-package-compat.cjs "$ROOT"
node scripts/harthmere/test-harthmere-npm-install-strategy.cjs "$ROOT"
[ -f scripts/harthmere/test-harthmere-react18-dependency-compat.cjs ] && node scripts/harthmere/test-harthmere-react18-dependency-compat.cjs "$ROOT"
[ -f scripts/harthmere/test-harthmere-stylelint15-prettier-cleanup.cjs ] && node scripts/harthmere/test-harthmere-stylelint15-prettier-cleanup.cjs "$ROOT"
[ -f scripts/harthmere/test-harthmere-npc-ai-adapter-runtime-safety.cjs ] && node scripts/harthmere/test-harthmere-npc-ai-adapter-runtime-safety.cjs "$ROOT"
[ -f scripts/harthmere/test-harthmere-npc-ai-package-compat.cjs ] && node scripts/harthmere/test-harthmere-npc-ai-package-compat.cjs "$ROOT"
[ -f scripts/harthmere/test-harthmere-npc-ai-dependency-install-command.cjs ] && node scripts/harthmere/test-harthmere-npc-ai-dependency-install-command.cjs "$ROOT"

echo "==> Expected consolidated package targets"
node - <<'NODE'
const fs = require('fs');
const p = JSON.parse(fs.readFileSync('package.json','utf8'));
for (const name of [
  'react', 'react-dom', 'next', 'emoji-mart', '@emoji-mart/data',
  'react18-json-view', 'stylelint', '@kubernetes/client-node', '@types/ws',
  'utf-8-validate', 'bufferutil', 'yuka', 'behavior3js', 'recast-navigation'
]) {
  const section = p.dependencies?.[name] ? 'dependencies' : p.devDependencies?.[name] ? 'devDependencies' : 'missing';
  console.log(`${name}: ${section}:${p.dependencies?.[name] || p.devDependencies?.[name] || ''}`);
}
NODE

if [ "${HARTHMERE_PACKAGE_LOCK_ONLY:-}" = "1" ]; then
  echo "==> Updating package-lock only, without lifecycle scripts"
  npm install --package-lock-only --ignore-scripts
else
  echo "==> Running normal npm install with npm peer checks enabled"
  npm install
fi

echo "==> Re-running dependency compatibility tests after install/lock refresh"
node scripts/harthmere/test-harthmere-npm-peer-mass-audit.cjs "$ROOT"
node scripts/harthmere/test-harthmere-npm-known-peer-conflicts.cjs "$ROOT"
node scripts/harthmere/test-harthmere-node24-package-compat.cjs "$ROOT"
[ -f scripts/harthmere/test-harthmere-npc-ai-third-party-runtime-availability.cjs ] && node scripts/harthmere/test-harthmere-npc-ai-third-party-runtime-availability.cjs "$ROOT" || true
