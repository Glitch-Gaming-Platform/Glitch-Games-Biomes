#!/usr/bin/env node
"use strict";

// Static release guard for the production-shaped browser suite. The live E2E
// still supplies the behavioral proof; this fast check prevents a future edit
// from silently reducing it back to one arbitrary jobs-board posting.
const fs = require("fs");
const path = require("path");

const root = path.resolve(process.argv[2] || process.cwd());
const read = (relativePath) =>
  fs.readFileSync(path.join(root, relativePath), "utf8");
const bridge = read("src/client/game/e2e/harthmere_native_ecs_e2e.ts");
const overlays = read("src/client/game/scripts/overlays.ts");
const runner = read(
  "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
);
const businessBrowserRunner = read(
  "scripts/harthmere/test-harthmere-business-live-browser.cjs"
);
const browserRuntimeLease = read("scripts/harthmere/browser-runtime-lease.cjs");
const releaseGate = read("scripts/harthmere/run-harthmere-native-ecs-e2e.sh");

let failures = 0;
function check(condition, label) {
  if (condition) {
    console.log(`OK ${label}`);
  } else {
    failures += 1;
    console.error(`FAIL ${label}`);
  }
}

check(
  bridge.includes("jobsBoardFrontendRoundTrip") &&
    bridge.includes("createHarthmereJobsBoardAdapter") &&
    bridge.includes("adapter.fetchState({ force: true })") &&
    bridge.includes("jobsBoardTrackableQuestsForBiomesUI") &&
    bridge.includes("jobsBoardAcceptedJobLandmarksForBiomesUI"),
  "browser bridge uses the real frontend adapter and frontend quest/marker projections"
);
check(
  runner.includes("HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES") &&
    runner.includes("installAllJobsBoardE2EFixtures") &&
    runner.includes("for (const expected of fixture.fixtures)"),
  "browser runner enumerates every executable production job template"
);
check(
  runner.includes('operation: "accept"') &&
    runner.includes('operation: "completeQuest"') &&
    runner.includes('operation: "complete"') &&
    runner.includes("authoritativeEntity(") &&
    runner.includes("native ECS board position"),
  "every job crosses frontend accept/objective/reward and authoritative native ECS readback"
);
check(
  runner.includes("frontend quest projection missing") &&
    runner.includes("frontend map marker missing") &&
    runner.includes("return-to-board marker missing") &&
    runner.includes("completed marker remained active"),
  "every job returns through objective, board-return, and completed frontend projections"
);
check(
  runner.includes("performJobsE2EFieldInteraction") &&
    runner.includes('keyboard.press("KeyF")') &&
    runner.includes("no visible F") &&
    runner.includes("[0, 0.65]") &&
    runner.includes("approachPosition,\n        0.9") &&
    runner.includes(
      "visible F interaction completes the accepted job objective"
    ),
  "registered field jobs face the prop body, prove the visible F prompt, and use player keyboard interaction"
);
check(
  overlays.includes("A player standing on a repair post") &&
    overlays.includes("nearbyHarthmereObjectOverlay") &&
    runner.includes("displacedRetainedActorIds") &&
    /startsWith\(\s*["']NativeECS-A-["']\s*\)/.test(runner) &&
    runner.includes("never delete or move an ordinary player"),
  "overlapping players cannot shadow a faced job prop, and retained E2E actors are safely displaced"
);
check(
  overlays.includes("harthmereFieldTargetGroundedFeetYByColumn") &&
    overlays.includes("harthmereGroundedFeetYWithMemory") &&
    overlays.includes(
      "The procedural renderer grounds these same permanent props"
    ) &&
    runner.includes("HARTHMERE_E2E_ALLOW_PRE_DYNAMIC_FIELD_TARGET_IMAGE") &&
    runner.includes("preDynamicFieldTargetFallbacks") &&
    runner.includes(
      "compatibility path requires a live-ground/authored-height mismatch"
    ) &&
    runner.includes("visible_prompt_no_receipt_after_three_keypresses") &&
    runner.includes("key attempt ${keyAttempt}/3"),
  "field-target overlays share renderer grounding, with an explicit reported old-image compatibility path"
);
check(
  runner.includes("Fixture writes bypass the player's Inventory UI") &&
    runner.includes("biomes.localDev.harthmere.inventoryState") &&
    runner.includes("biomes:harthmere-inventory-changed") &&
    runner.includes(
      "server still independently verifies the native selected item"
    ),
  "tool-gated fixture jobs align the client equipment projection while retaining native server authority"
);
check(
  runner.includes("HARTHMERE_E2E_ONLY_JOB_TEMPLATE_IDS") &&
    runner.includes("HARTHMERE_E2E_REAL_JOB_TOOL_PURCHASE") &&
    runner.includes("prepareJobsE2ERealToolPurchase") &&
    runner.includes("buyAndEquipJobsE2ERequiredTool") &&
    runner.includes("missing-tool job did not point to its exact vendor") &&
    runner.includes("name: `Buy ${tool.listing.toolName}`") &&
    runner.includes(
      "purchase advances beyond the vendor to the next job requirement"
    ) &&
    runner.includes('name: "Hotbar 1"') &&
    runner.includes("selected job tool has a visible held mesh") &&
    runner.includes("itemMeshInstance?.three") &&
    runner.includes("jobsBoardFieldToolUseScreenshots") &&
    runner.includes("field-interaction.png"),
  "focused repair/cleanup acceptance buys each real tool, follows the returning marker, equips a visible held mesh, and captures field use"
);
check(
  runner.includes("snapshotGroveLandmarkById") &&
    runner.includes("requiredInteractionCount") &&
    runner.includes("Number(requiredInteractionCount) > 1") &&
    runner.includes("serviceProgressCount") &&
    runner.includes('keyboard.press("KeyJ")') &&
    runner.includes("biomes-ui-quests-tab") &&
    runner.includes('name: "Show on map"') &&
    runner.includes("Show on map selects the jobs-board destination") &&
    runner.includes("server records interaction"),
  "Grove landmarks and repeated service-unit jobs prove every required visible F interaction"
);
check(
  runner.includes("jobs-board actor is normalized as a player") &&
    runner.includes("npc_metadata: null") &&
    runner.includes("npc_state: null"),
  "reused-snapshot Jobs Board actors are normalized before browser movement"
);
check(
  runner.includes(
    "await moveSnapshotGrovePlayer(first, safePosition, label)"
  ) &&
    runner.includes('bridgeCall(first.page, "groundedHarthmerePosition"') &&
    runner.includes("requireOpenSky: false") &&
    runner.includes("jobsCatalogOnly = jobsOnly || remainingJobsOnly") &&
    runner.includes("`${baseUrl}/api/harthmere/chapter1_story`") &&
    runner.includes("`${baseUrl}/api/harthmere/chapter1_gate?e2e=1`"),
  "all Jobs Board catalog warps ground their feet, use the stable live-player relocation path, and ignore only exact aborted background polls"
);
check(
  runner.includes("performJobsE2ERealDeliveryPickup") &&
    runner.includes("real F pickup creates parcel and advances marker") &&
    runner.includes("marker did not advance to drop-off") &&
    runner.includes("parcel was not created in native inventory") &&
    runner.includes("delivered parcel was not consumed natively") &&
    runner.includes("JOBS_BOARD_E2E_SECONDARY_DELIVERY_REQUIREMENTS"),
  "delivery E2E proves pickup, all secondary cargo, native parcel exchange, drop-off, and consumption"
);
check(
  runner.includes("server escort scheduler completed todo") &&
    runner.includes("scheduler materializes native escort ECS") &&
    runner.includes("Anima escort reaches supplied destination") &&
    runner.includes("destinationPosition: escortPosition") &&
    runner.includes("reward was not paid through native wallet"),
  "focused-stack escort proves native companion materialization, authoritative arrival, scheduler completion, and payout"
);
check(
  runner.includes("performJobsE2ENativeBountyKill") &&
    runner.includes("harthmereJobsBoardMuckBountyTargetForId") &&
    runner.includes("readHarthmereJobsBoardNativeKillLedger") &&
    runner.includes("exact ranked native bounty synchronizes alive") &&
    runner.includes("shared grounder resolves a safe attack approach") &&
    runner.includes("HARTHMERE_E2E_JOBS_RESUME_AT") &&
    runner.includes("native player kill receipt records exact ranked bounty") &&
    runner.includes("bounty submission") &&
    runner.includes("new UpdateNpcHealthEvent") &&
    runner.includes("attacker: first.userId"),
  "bounty jobs use a grounded approach, kill the exact ranked creature, prove the native receipt, and support batched resume"
);
check(
  releaseGate.includes("jobsBoardQuestMapAdapter.test.ts") &&
    releaseGate.includes("jobsBoardLiveAdapter.test.ts") &&
    releaseGate.includes("jobs_board_field_targets.test.ts") &&
    releaseGate.includes("mmo_jobs_board_business_outposts.test.ts") &&
    releaseGate.includes("test-harthmere-native-ecs-all-jobs-e2e-contract.cjs"),
  "native ECS release gate includes all-jobs frontend and physical-target contracts"
);
check(
  runner.includes("const urlLessResource429 =") &&
    runner.includes("if (urlLessResource429)") &&
    runner.includes("report.browser.transients.push(text)") &&
    runner.includes(
      "response.url().startsWith(baseUrl) && response.status() >= 400"
    ) &&
    runner.includes("report.browser.failures.push(diagnostic)"),
  "URL-less third-party 429 console noise is transient while exact same-origin HTTP failures remain fatal"
);
check(
  runner.includes("abortedJobsCatalogAudioTransition") &&
    runner.includes("asset_data\\/audio") &&
    runner.includes("harthmere\\/audio") &&
    runner.includes('errorText === "net::ERR_ABORTED"'),
  "jobs-only teardown tolerates cancelled background music while same-origin HTTP responses remain strict"
);
check(
  runner.includes("HARTHMERE_E2E_JOBS_KEEP_GOING") &&
    runner.includes("resetFailedJob") &&
    runner.includes("Jobs Board ${templateFamily} batch found") &&
    runner.includes("persistReportCheckpoint()"),
  "jobs catalog can collect every row failure, reset failed fixture state, and report once after the batch"
);
check(
  runner.includes("HARTHMERE_E2E_CLIENT_HOTFIX_SCRIPT") &&
    runner.includes("context.addInitScript({ path: clientHotfixScriptPath })"),
  "jobs catalog can acceptance-test a no-rebuild mutable client payload before the immutable app"
);
check(
  runner.includes("acquireBrowserRuntimeLease") &&
    businessBrowserRunner.includes("acquireBrowserRuntimeLease") &&
    browserRuntimeLease.includes("browserRuntimeLaneId") &&
    browserRuntimeLease.includes("genuinely different app/sync/Redis stacks"),
  "Jobs Board and business browser batches serialize shared fixture lanes while isolated browser groups remain concurrent"
);

if (failures) {
  console.error(
    `\n${failures} all-jobs native ECS E2E contract check(s) failed.`
  );
  process.exit(1);
}
console.log("\nAll-jobs native ECS E2E contract checks passed.");
