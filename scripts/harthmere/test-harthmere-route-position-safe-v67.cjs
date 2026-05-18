#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = process.argv[2] || process.cwd();
const assetsPath = path.join(root, 'src/client/game/renderers/local_dev/harthmere_assets.ts');
const src = fs.readFileSync(assetsPath, 'utf8');

let failures = 0;
function check(label, condition) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

check('v67 route-position-safe marker exists', src.includes('harthmere-route-position-safe-negative-progress-v67'));
check('route helper rejects non-finite progress', /!Number\.isFinite\(progress\)/.test(src));
check('route helper uses positive modulo for negative progress', /\(\(floorProgress % route\.length\) \+ route\.length\) % route\.length/.test(src));
check('route helper validates missing or malformed route points', /isHarthmereValidRoutePointV67/.test(src) && /firstHarthmereValidRoutePointV67/.test(src));
check('old negative modulo route indexing was removed', !/const segment = Math\.floor\(progress\) % route\.length;/.test(src));

// Runtime reproduction for the exact crash shape:
// progress = -0.25 used to produce segment -1, then route[-1] === undefined.
function routePosition(route, progress) {
  if (route.length === 0) return [0, 0];
  if (!Number.isFinite(progress)) return route.find((p) => Array.isArray(p) && Number.isFinite(p[0]) && Number.isFinite(p[1])) || [0, 0];
  if (route.length === 1) return route[0];
  const floorProgress = Math.floor(progress);
  const segment = ((floorProgress % route.length) + route.length) % route.length;
  const t = progress - floorProgress;
  const a = route[segment];
  const b = route[(segment + 1) % route.length];
  return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
}
const sample = [[10, 10], [20, 10], [20, 20], [10, 20]];
const p = routePosition(sample, -0.25);
check('negative startup progress resolves to a valid wrapped segment', Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= 10 && p[0] <= 20 && p[1] >= 10 && p[1] <= 20);

if (failures > 0) {
  process.exit(1);
}
