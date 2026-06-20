#!/usr/bin/env node
const fs = require('fs');
const path = require('path');

const root = path.resolve(process.argv[2] || process.cwd());
function read(rel) {
  const file = path.join(root, rel);
  if (!fs.existsSync(file)) {
    throw new Error(`Missing file: ${rel}`);
  }
  return fs.readFileSync(file, 'utf8');
}
function assert(condition, message) {
  if (!condition) {
    console.error(`FAIL ${message}`);
    process.exitCode = 1;
  } else {
    console.log(`OK ${message}`);
  }
}

const api = read('src/pages/api/glitch/harthmere.ts');
const bridge = read('src/client/game/glitch/harthmere_glitch_bridge.ts');
const bootstrap = read('src/client/game/glitch/harthmere_glitch_install_bootstrap.tsx');
const wake = read('src/client/components/WakeUpScreen.tsx');
const deploy = read('scripts/glitch/deploy-production-local-redis-smoke.sh');

assert(api.includes('looksLikeGuestIdentity'), 'API detects explicit Glitch guest/anonymous validation responses');
assert(api.includes('guestIdentity || isGuestLikeString(rawGlitchUserId)'), 'API does not trust guest-like user_id as a real Glitch user id');
assert(api.includes('`install:${installId}`'), 'API falls anonymous guests back to install-scoped gameUserId');
assert(api.includes('stableGuestUsernameSuffix'), 'API creates unique internal Biomes usernames for guest installs');
assert(api.includes('Guest${stableGuestUsernameSuffix(identity)}'), 'Guest username is unique per install, not shared as plain Guest');
assert(api.includes('createOrResumeInstallWithGlitch'), 'API creates/resumes Glitch install before validation and heartbeats');
assert(api.includes('user_install_id: installId'), 'API sends iframe install_id as user_install_id to Glitch installs endpoint');
assert(api.includes('op === "heartbeatInstall"'), 'API exposes heartbeatInstall proxy op');
assert(api.includes('/events/bulk`'), 'API still sends bulk behavioral events to Glitch');
assert(api.includes('game_install_id'), 'API event payload keeps required game_install_id');

assert(bridge.includes('GLITCH_INSTALL_HEARTBEAT_INTERVAL_MS = 60_000'), 'client uses the required 60-second Glitch install heartbeat cadence');
assert(bridge.includes('requestGlitch<any>("heartbeatInstall"'), 'client sends install heartbeats through server proxy');
assert(bridge.includes('await this.heartbeatInstall("start")'), 'client creates/resumes install immediately after validation');
assert(bridge.includes('recordEvents'), 'client sends funnel events through local server proxy');
assert(!bridge.includes('bulkCreateEvents'), 'client does not bypass server Title Token with browser SDK bulkCreateEvents');
assert(!bridge.includes('window.Glitch'), 'client no longer depends on public window.Glitch for telemetry submission');

assert(bootstrap.includes('isGuestLikeIdentity'), 'bootstrap keeps guest identity normalization aligned with API');
assert(bootstrap.includes('source: "glitch"'), 'bootstrap writes identity source for downstream scoping');
assert(wake.includes('getHarthmereGlitchUserName'), 'WakeUpScreen can prefill the name step from validated Glitch username');
assert(wake.includes('HARTHMERE_GLITCH_IDENTITY_CHANGED_EVENT'), 'WakeUpScreen reacts when Glitch identity arrives after mount');

assert(!deploy.includes('test-harthmere-character-builder-supported-voxel-features.cjs'), 'deploy guardrails no longer run stale current WakeUpScreen visual coverage test');

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log('PASS glitch-guest-identity-funnel');
