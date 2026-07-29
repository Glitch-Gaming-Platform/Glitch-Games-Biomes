#!/usr/bin/env node
// check-harthmere-dragon-quest-reachability.cjs (bible-wiring fix, 2026-07-14)
//
// Regression tripwire for the user requirement "the dragon quest and its
// town and assets and land are always reachable". The deep behavioral checks
// live in mocha (bible_quest_live_authority.test.ts — reachability contract;
// live_mode_bible_quests_backend.test.ts — end-to-end encounter); this plain
// node script guards the WIRING ITSELF, so a refactor that silently unplugs
// any link in the chain (catalog → backend branch → dialog hook → HUD mount →
// rendered boss → attackable target) fails loudly in any pipeline that runs
// the scripts/harthmere suite, without needing ts-node.

const fs = require("fs");
const path = require("path");
const root = process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

let failures = 0;
function ok(condition, message) {
  if (condition) console.log(`OK ${message}`);
  else {
    failures += 1;
    console.error(`FAIL ${message}`);
  }
}

const authority = read("src/shared/harthmere/bible_quest_live_authority.ts");
const backend = read("src/shared/harthmere/live_mode_backend.ts");
const talkDialog = read(
  "src/client/components/challenges/TalkToNPCDefaultDialog.tsx"
);
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");
const assets = read(
  "src/client/game/renderers/local_dev/harthmere_assets.ts"
);
const visibleTarget = read("src/shared/harthmere/visible_combat_target.ts");
const mapAdapter = read(
  "src/client/components/biomes_ui/adapters/mapLiveAdapter.ts"
);
const catalog = read("src/shared/harthmere/bible/bible_quest_catalog.ts");

// 1. The catalog still authors the dragon quest and its chain.
ok(
  catalog.includes("bellbound_q12_thaedryn_bellbound"),
  "catalog contains Q12 (Thaedryn the Bellbound)"
);

// 2. The shared authority declares the canonical arena anchor at the
//    renderer's dragon-chamber assets (authored 640,-268).
ok(
  /HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR[\s\S]{0,160}\[640, 64, -268\]/.test(
    authority
  ),
  "canonical arena anchor is authored (640, 64, -268) — grounded at the flat town level"
);
ok(
  authority.includes("validateHarthmereDragonQuestReachability"),
  "reachability contract validator exists"
);

// 3. Backend branch: bible operations reachable through live mode.
ok(
  backend.includes("HARTHMERE_BIBLE_QUEST_OPERATION_PREFIX"),
  "live_mode backend routes bible_quest_* operations"
);
ok(
  backend.includes("syncHarthmereThaedrynCombatSnapshot"),
  "backend seeds/syncs the Thaedryn combat snapshot"
);
ok(
  backend.includes("harthmereThaedrynDamageEventsForAttack"),
  "request_attack forwards damage into the Q12 boss machine"
);

// 4. Client: giver dialogue + HUD runtime mounted.
ok(
  talkDialog.includes("useHarthmereBibleQuestDialog"),
  "NPC talk dialog composes bible quest offers/objectives/turn-ins"
);
ok(
  hud.includes("HarthmereBibleQuestRuntimeController"),
  "unified HUD mounts the bible quest runtime controller (hidden triggers + encounter panel)"
);
ok(
  mapAdapter.includes("bibleQuestTrackableQuestsForBiomesUI"),
  "journal/map adapter surfaces accepted bible quests"
);

// 5. The dragon has a rendered, attackable body at the anchor.
ok(
  /AD\("townsperson_undead", 640\.0, -268\.0[\s\S]{0,120}"Thaedryn the Bellbound"/.test(
    assets
  ),
  "renderer places the Thaedryn actor at the arena anchor"
);
ok(
  visibleTarget.includes("HARTHMERE_THAEDRYN_VISIBLE_TARGET_ID"),
  "visible combat target maps the Thaedryn actor to the boss entity"
);
ok(
  visibleTarget.includes('"bible-boss:thaedryn_bellbound"') &&
    authority.includes('"bible-boss:thaedryn_bellbound"'),
  "renderer target id and backend combat entity id agree"
);

// 6. Land reachability: the anchor sits inside the district-bible town
//    envelope (authored X 300..800, Z -500..0 — matches the contract test).
const anchorMatch = authority.match(
  /HARTHMERE_THAEDRYN_ARENA_AUTHORED_ANCHOR[\s\S]{0,160}?\[\s*(-?\d+),\s*(-?\d+),\s*(-?\d+)\s*\]/
);
if (anchorMatch) {
  const x = Number(anchorMatch[1]);
  const z = Number(anchorMatch[3]);
  ok(
    x >= 300 && x <= 800 && z >= -500 && z <= 0,
    `arena anchor (${x},${z}) stays inside the Harthmere town envelope`
  );
} else {
  ok(false, "arena anchor coordinates are parseable");
}

if (failures) {
  console.error(`\nRESULT: FAIL (${failures} failures)`);
  process.exit(1);
}
console.log("\nRESULT: PASS dragon quest reachability wiring");
