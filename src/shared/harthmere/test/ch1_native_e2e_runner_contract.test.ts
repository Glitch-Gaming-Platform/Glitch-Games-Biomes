/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";

// `__dirname` is undefined when mocha loads these .ts files as ES modules,
// which is what `.mocharc.fast.json` does (package.json declares no "type" and
// the file parses as ESM). That made this contract silently unloadable —
// `ReferenceError: __dirname is not defined in ES module scope` aborts the whole
// run before any assertion. Mocha is always invoked from the repo root.
const REPO_ROOT = path.resolve(process.cwd());
const read = (relativePath: string) =>
  fs.readFileSync(path.join(REPO_ROOT, relativePath), "utf8");

describe("Chapter 1 native browser-runner contracts", () => {
  const runner = read(
    "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
  );
  const bridge = read("src/client/game/e2e/harthmere_native_ecs_e2e.ts");
  const fastGuide = read("docs/harthmere/TESTING_FASTER.md");

  it("captures cutscenes at their authored story stage after terrain readiness", () => {
    assert.match(runner, /chapter1PrepareCutsceneAudit/);
    assert.match(runner, /story-staged-cast-interaction-offset/);
    assert.match(runner, /focused terrain synchronized/);
    assert.match(runner, /rows\?\.\[0\]\?\.terrainEntityId/);
    assert.match(bridge, /__chapter1E2ECutsceneProjection/);
    assert.match(bridge, /activeStepId: "the_whole_plan"/);
    assert.match(bridge, /"ch1_gate_fence_sighting"/);
    assert.match(bridge, /"ch1_gate_desert"/);
    assert.match(runner, /chapter1GateRendererFocus/);
    assert.match(
      runner,
      /focusKind = preferredFocus \? "authored-gate-renderer"/
    );
    assert.match(
      runner,
      /if \(prepared\.activeGateIds\.length > 0\) \{[\s\S]*holdChapter1AuditGates\([\s\S]*focus\.focus/
    );
    assert.match(
      runner,
      /production gate prompt republishes the saved-world gate set/
    );
    assert.match(runner, /resources\?\.update\("\/scene\/local_player"/);
    assert.match(runner, /resources\?\.update\("\/sim\/player", userId/);
    assert.match(
      fastGuide,
      /Direct cutscene-catalog playback must install the scene's story projection/
    );
    assert.match(
      fastGuide,
      /Exact-image gate captures must hold the audit gate and renderer focus/
    );
  });

  it("isolates cutscene evidence from stale focused-run player avatars", () => {
    assert.match(runner, /const extraHiddenPlayerIds = new Set\(\)/);
    assert.match(runner, /entity\?\.player_status/);
    assert.match(runner, /id !== Number\(userId\)/);
    assert.match(runner, /resources\?\.cached\("\/scene\/player\/mesh", id\)/);
    assert.match(runner, /mesh\.three\.visible = false/);
    assert.match(runner, /const playerIsolationTimer = setInterval/);
    assert.match(runner, /clearInterval\(playerIsolationTimer\)/);
    assert.match(
      runner,
      /await isolateChapter1CatalogProjection\(first, focus\.focus\);\s*auditProjectionHold = true;/
    );
    assert.match(runner, /async function chapter1HumanRenderDiagnostics/);
    assert.match(runner, /uniforms\.spatialLighting\?\.value/);
    assert.match(runner, /uniforms\.light\?\.value/);
    assert.match(
      runner,
      /renderDiagnostics: await chapter1HumanRenderDiagnostics\(first\)/
    );
  });

  it("accepts collision-grounded marker warps without flattening hilly coordinates", () => {
    assert.match(runner, /CHAPTER1_E2E_WARP_VERTICAL_TOLERANCE_METERS = 3\.25/);
    assert.match(runner, /distanceXZ\(actual, target\)/);
    assert.match(
      runner,
      /Math\.abs\(Number\(actual\[1\]\) - Number\(target\[1\]\)\)/
    );
    assert.ok(
      (runner.match(/chapter1WarpSettled\(/g) ?? []).length >= 5,
      "objective, gate-entry, local gate-entry, and gate-exit warps must share the bounded settlement rule"
    );
  });

  it("documents the environment variable the runner actually reads", () => {
    assert.match(
      runner,
      /process\.env\.HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO === "1"/
    );
    assert.doesNotMatch(fastGuide, /^HARTHMERE_E2E_SKIP_VIDEO=1 \\/gm);
    assert.ok(
      (fastGuide.match(/HARTHMERE_E2E_CHAPTER_1_SKIP_VIDEO=1/g) ?? []).length >=
        3,
      "every Chapter 1 fast-run example must disable video with the effective variable"
    );
  });

  it("gives exact-image completion responses a bounded non-performance budget", () => {
    assert.match(
      runner,
      /const responseTimeoutMs = Math\.max\(\s*40_000,\s*20_000 \+ dialoguePages \* 2_000\s*\)/
    );
    assert.match(runner, /signed native progress/);
    assert.match(
      fastGuide,
      /allows 40 seconds for that response, then still requires\s+the exact signed native progress/
    );
  });

  it("acquires external materials without fixtures or hidden Chapter 1 grants", () => {
    assert.match(runner, /chapter1PriorAuthoredInventoryBalance/);
    assert.match(runner, /chapter1ExternallySourcedInventoryRequirements/);
    assert.match(runner, /step\.consumeInventoryRequirements/);
    assert.match(runner, /for \(const itemId of step\.grants \?\? \[\]\)/);
    assert.match(
      runner,
      /ensureChapter1ExternalInventoryRequirements\(first, quest, step\)/
    );
    assert.match(runner, /harthmereNativeBiomesIdForItemId/);
    assert.match(runner, /proveChapter1MaterialGuidance/);
    assert.match(runner, /bridgeCall\(first\.page, "vendorPurchase"/);
    assert.match(runner, /const bundlePurchases = Math\.ceil/);
    assert.match(runner, /missing \/ vendorRoute\.bundleCount/);
    assert.match(runner, /quantity: vendorRoute\.bundleCount/);
    assert.match(runner, /chapter1UsableItemCount/);
    assert.match(runner, /harthmere_material_storage\?\.items/);
    assert.match(runner, /CH1_E2E_RETAINED_PREREQUISITE_GOLD = 75/);
    assert.match(runner, /CH1_E2E_GROVE_JOB_REWARD_GOLD = 25/);
    assert.match(runner, /kind: "jobs_board_reward"/);
    assert.match(runner, /replaceChapter1FixtureNativeGold/);
    assert.match(runner, /paid job rewards reach the native wallet/);
    assert.match(runner, /if \(step\.id === "take_jobs"\)/);
    assert.match(runner, /CH1_GROVE_JOB_TEMPLATE_IDS\[index\]/);
    assert.match(runner, /candidate\.templateId === templateId/);
    assert.match(runner, /if \(step\.id === "meet_the_suppliers"\)/);
    assert.match(runner, /state\.economy\.vendorTransactions/);
    assert.match(runner, /initialSupplierCount/);
    assert.match(runner, /visitedSupplierIds/);
    assert.match(runner, /candidate\.label === body\.targetLabel/);
    assert.doesNotMatch(
      runner,
      /response\.body\.requirement\?\.current === index/
    );
    assert.match(runner, /nativeGold\(entity\) === BigInt\(checkpoint\.gold\)/);
    assert.doesNotMatch(
      runner,
      /Chapter 1 external inventory fixture installed/
    );
    assert.match(runner, /chapter1ProvisioningObjectiveInventoryRequirements/);
    assert.match(runner, /ch1ProvisioningFor/);
    assert.match(runner, /food: "road_ration"/);
    assert.match(runner, /cold_gear: "patched_cloak"/);
    assert.ok(
      (runner.match(/chapter1ExternallySourcedInventoryRequirements\(/g) ?? [])
        .length >= 3,
      "live provisioning and resume replay must share the same source-aware rule"
    );
    assert.match(
      fastGuide,
      /acquire external objective\s+inputs through real vendor transactions, but never replace chapter-authored grants/
    );
    assert.match(
      fastGuide,
      /Provisioning objectives derive their inventory from the gate contract/
    );
    assert.match(
      fastGuide,
      /reconstructs the retained 75-gold starter wallet and the paid\s+Work the Board job rewards/
    );
  });

  it("fails fast on Redis transport and preserves promoted cast identity", () => {
    assert.match(runner, /function assertRedisTransportReady\(\)/);
    assert.match(
      runner,
      /\["-h", host, "-p", String\(port\), "--raw", "PING"\]/
    );
    assert.match(runner, /REDIS PREFLIGHT PONG/);
    assert.match(
      runner,
      /member\.key === "augur9" \? "Mucked Robot" : member\.displayName/
    );
    assert.match(runner, /await holdChapter1AuditGates\(first, gateIds\)/);
    assert.match(runner, /candidate\.visible &&\s+candidate\.open > 0/);
    assert.match(
      runner,
      /finally \{\s+await releaseChapter1AuditGates\(first\)/
    );
    assert.match(fastGuide, /Docker Desktop does not route host\s+traffic/);
    assert.match(fastGuide, /nonzero\s+supplier progress/);
    assert.match(fastGuide, /authoritative ECS label remains `Mucked Robot`/);
  });

  it("can require a desktop-only HUD in a headless desktop viewport", () => {
    assert.match(runner, /HARTHMERE_E2E_DESKTOP_CONTROLS_ONLY/);
    assert.match(runner, /if \(!desktopControlsOnly\) \{/);
    assert.match(runner, /data-biomes-mobile-controls/);
    assert.match(runner, /data-biomes-mobile-hotbar/);
    assert.match(runner, /wakeUpBeforeInput/);
    assert.match(runner, /desktop screenshot: Grove center/);
    assert.match(fastGuide, /pointerless desktop fallback/);
  });

  it("leaves Jobs Board and vendor-owned interactions in control", () => {
    assert.match(runner, /satisfyChapter1ExternalSystemRequirement/);
    assert.match(runner, /requirement\?\.blocksChapterInteraction/);
    assert.match(runner, /requirement\?\.autoCompleteWhenReady/);
    assert.match(runner, /harthmere-jobs-board-world-prompt/);
    assert.match(runner, /button\[aria-label="Read Jobs Board"\]/);
    assert.match(runner, /installChapter1CompletedGroveJobEvidence/);
    assert.match(runner, /CH1_GROVE_SUPPLIER_ROUTE\.find\(/);
    assert.match(runner, /Trade with \$\{supplier\.label\}/);
    assert.match(runner, /data-harthmere-vendor-trade-panel/);
    assert.match(runner, /request_vendor_transaction/);
    assert.match(runner, /real supplier transaction advanced after/);
    assert.match(runner, /data-biomes-ui-active-minimap-pin/);
    assert.doesNotMatch(runner, /installChapter1SupplierTransactionEvidence/);
    assert.match(runner, /external evidence reaches Chapter 1/);
    assert.match(runner, /state\.body\.requirement\?\.ready === true/);
    assert.match(
      runner,
      /step\.trigger !== "near_location" && !externalSystemOwned/
    );
    assert.match(
      fastGuide,
      /Do not make Chapter 1 steal `F` from the system that owns the evidence/
    );
  });

  it("routes every active Chapter 1 NPC phase through story dialogue", () => {
    assert.match(runner, /async function invokeChapter1ObjectiveInteraction/);
    assert.match(runner, /\["talk_npc", "dialogue_choice"\]/);
    assert.match(runner, /state\.value\.body\.targetEntityId/);
    assert.match(runner, /kind: "talk_to_npc"/);
    assert.match(runner, /stock\/default quest surface/);
    assert.ok(
      (
        runner.match(
          /invokeChapter1ObjectiveInteraction\(first, state, step\)/g
        ) ?? []
      ).length >= 4,
      "normal dialogue, choices, deferrals, and special interactions must share NPC routing"
    );
  });

  it("normalizes reused snapshot actors before Chapter 1 subscribes", () => {
    assert.match(runner, /FOCUSED_E2E_SAFE_START/);
    assert.match(
      runner,
      /if \(\s*chapter1Only \|\|\s*chapter1CaptureOnly \|\|\s*chapter1NpcAuditOnly \|\|\s*robotStoryOnly \|\|\s*jobsOnly \|\|\s*remainingJobsOnly \|\|\s*remainingQuestsOnly \|\|\s*escortOnly \|\|\s*hoePurchaseOnly\s*\) \{\s*\/\/ A freshly allocated visual-test id can collide with a live snapshot NPC/
    );
    assert.match(
      runner,
      /serializedChange\(\{\s*kind: "delete",\s*id: auth\.userId/
    );
    assert.match(runner, /focused actor pre-navigation eviction failed/);
    assert.match(runner, /post-bootstrap E2E admin restore failed/);
    assert.match(runner, /post-bootstrap E2E admin role was not restored/);
    assert.match(runner, /waitForAdminWorldRole/);
    assert.match(runner, /post-bootstrap E2E admin role reaches middleware/);
    assert.match(runner, /api\/admin\/ecs\/get_with_version/);
    assert.match(runner, /post-bootstrap-e2e-admin-restored/);
    assert.match(runner, /label: Label\.create\(\{ text: username \}\)/);
    assert.match(runner, /entity\?\.player_status\?\.init === true/);
    assert.match(runner, /appearance_component: AppearanceComponent\.create/);
    assert.match(runner, /skin_color_id: "skin_color_4"/);
    assert.match(runner, /BikkieIds\.muckyTop/);
    assert.match(runner, /BikkieIds\.muckySkirt/);
    assert.match(
      runner,
      /await reassertNormalizedChapter1Actor\(page, userId, username, label\)/
    );
    assert.match(
      runner,
      /resources\.invalidate\("\/scene\/player\/mesh", id\)/
    );
    assert.match(runner, /npc_metadata: null/);
    assert.match(runner, /icing: null/);
    assert.match(runner, /group_preview_reference: null/);
    assert.match(runner, /warping_to: null/);
    assert.doesNotMatch(runner, /normalized Chapter 1 actor is synchronized/);
    assert.match(
      runner,
      /A reused snapshot id may still have one queued Anima write/
    );
    assert.match(runner, /chapter1ActorIsNormalized\(authoritative\.entity/);
    assert.match(runner, /chapter1ActorIsNormalized\(local\.entity/);
    assert.match(runner, /Date\.now\(\) - lastApplyAt >= 2_000/);
    assert.match(runner, /post-load Chapter 1 actor remains normalized/);
    assert.match(runner, /post-load robot-story actor is stable/);
    assert.match(runner, /reloaded-after-stale-wakeup-bootstrap-race/);
    assert.match(runner, /stale Wake Up recovery changed actor identity/);
    assert.match(runner, /page\.goto\(gameUrl\(\)/);
    assert.match(runner, /staleWakeUpScreen\.waitFor/);
    assert.match(runner, /isolatedChapter1LegacyRobotStoryNavigationTarget/);
    assert.match(runner, /entityId:8997551883502307/);
    assert.match(runner, /entityId:7976997825186729/);
    assert.match(runner, /HARTHMERE_E2E_GIMME_SOPHIA_HANDOFF_ONLY/);
    assert.match(runner, /Sophia-only post-Muck fixture synchronizes/);
    assert.match(
      runner,
      /Gimme Shelter Sophia-only handoff reaches robot placement/
    );
    assert.match(runner, /Defaulting to three\./);
    assert.match(
      runner,
      /delayed player-mesh\/bootstrap createPlayer row finishes/
    );
    assert.match(runner, /abortedChapter1ReadOnlyPoll/);
    assert.match(runner, /chapter1ReadOnlyAction === "state"/);
    assert.match(
      fastGuide,
      /Normalize Chapter 1 actors before page navigation, not after the quest/
    );
    assert.match(
      fastGuide,
      /reapply the complete normalized player row until authoritative and local\s+state agree/
    );
    assert.match(fastGuide, /Clear pending native warp state too/);
    assert.match(
      fastGuide,
      /loading wrapper to clear and reassert the normalized actor/
    );
    assert.match(runner, /post-load robot-story actor is stable/);
    assert.match(
      fastGuide,
      /Fast seeded robot-story runs must wait out the real player bootstrap/
    );
  });

  it("does not confuse an offline third-party HLS embed with Chapter 1 media", () => {
    assert.match(runner, /unavailableEmbeddedMediaPlaylist/);
    assert.match(runner, /Player stopping playback/);
    assert.match(runner, /MasterPlaylist/);
    assert.match(runner, /ErrorNotAvailable code 404/);
    assert.match(
      fastGuide,
      /An unavailable third-party HLS embed is not a Chapter 1 media failure/
    );
  });

  it("keeps Chapter 1 escort acceptance under Anima authority", () => {
    assert.doesNotMatch(runner, /LockedInPlace/);
    assert.match(runner, /completes the live escort route/);
    assert.match(
      runner,
      /distance3\(entity\.position\.v, escort\.target\) <= 22/
    );
    assert.match(
      fastGuide,
      /Do not lock or teleport Chapter 1 companions for release acceptance/
    );
  });

  it("waits for every server-projected objective dialogue before choices", () => {
    assert.match(runner, /timeout: options\.required \? 20_000 : 1_500/);
    assert.match(
      runner,
      /server projected \$\{mode\} dialogue but it did not render/
    );
    assert.match(runner, /required: dialoguePages > 0/);
    assert.match(runner, /\.npc-quest-view \.npc-quest-dialog-container/);
    assert.match(runner, /\.text-shadow-bordered\.fixed\.bottom-2/);
    assert.match(
      runner,
      /dialog\.getAttribute\("data-chapter1-dialogue-page"\)/
    );
    assert.match(
      runner,
      /root\.getAttribute\("data-chapter1-dialogue-page"\) !== before/
    );
    assert.doesNotMatch(
      runner,
      /querySelector\("\[data-chapter1-dialogue-page\]"\)/
    );
    assert.match(runner, /await originalTalkSurface\.click\(\)/);
    assert.doesNotMatch(runner, /data-chapter1-dialogue-next/);
    assert.match(
      fastGuide,
      /A projected dialogue is mandatory, not a 1\.5-second optional probe/
    );
  });

  it("can use direct HybridWorld fixtures when a packaged admin page is absent", () => {
    assert.match(runner, /HARTHMERE_E2E_DIRECT_WORLD_FIXTURES/);
    assert.match(runner, /new HybridWorldApi/);
    assert.match(runner, /applyDirectFixtureChanges/);
    assert.match(runner, /directFixtureWorld\?\.stop/);
  });

  it("budgets the complete remaining Act 6 consolidation sequence", () => {
    assert.match(runner, /CH1_CONSOLIDATION_PLAYBACK_SEQUENCE/);
    assert.match(runner, /chapter1RemainingCutsceneBudgetMs/);
    assert.match(
      runner,
      /CH1_CONSOLIDATION_PLAYBACK_SEQUENCE\.slice\(sequenceIndex\)\.reduce/
    );
    assert.match(
      fastGuide,
      /Budget chained cutscenes as one uninterrupted sequence/
    );
  });

  it("performs the authored thin-ice load decision before winter crossings", () => {
    assert.match(runner, /CH1_E2E_THIN_ICE_CARRY_LIMIT_BY_STEP/);
    assert.match(runner, /d2_whale_road: 55/);
    assert.match(runner, /d2_the_breaking_year: 45/);
    assert.match(runner, /satisfyChapter1ThinIceCarryLimit/);
    assert.match(runner, /experience\?\.phase,\s*"cracking"/);
    assert.match(runner, /experience\?\.phase === "holding"/);
    assert.match(runner, /CH1_E2E_THIN_ICE_PRESERVED_ITEMS/);
    assert.match(runner, /Chapter 1 thin-ice load decision synchronized/);
    assert.match(
      fastGuide,
      /Thin-ice objectives require an explicit load decision/
    );
  });

  it("rotates cutscene capture pages without creating a stale same-user session", () => {
    assert.match(runner, /intentionallyClosingPages\.add\(previous\)/);
    assert.match(
      runner,
      /await previous\.close\(\)[\s\S]*await openSameUserPeer\(first/
    );
    assert.match(runner, /A local-user Sync session is exclusive/);
    assert.match(runner, /biomes-promo-capture-output/);
    assert.match(
      runner,
      /capturePage\.waitForFunction\([\s\S]*status === "complete"/
    );
    assert.match(
      fastGuide,
      /Close a same-user capture page before opening its replacement/
    );
  });

  it("drives every intentionally incremental routed conversation", () => {
    assert.match(runner, /chapter1IncrementalObjectiveRoute/);
    assert.match(runner, /CH1_TESTIMONY_ROUTE/);
    assert.match(runner, /CH1_THREE_ANSWER_ROUTE/);
    assert.match(runner, /completeChapter1IncrementalObjectiveThroughProduct/);
    assert.match(runner, /native leaf fired before the final routed visit/);
    assert.match(runner, /partial progress reason lost its routed count/);
    assert.match(
      fastGuide,
      /Incremental Chapter 1 leaves are supposed to reject before their final/
    );
    assert.match(runner, /error instanceof Ch1ObjectiveIncomplete/);
    assert.match(
      runner,
      /resume checkpoint stayed incomplete after its final routed visit/
    );
    assert.match(
      runner,
      /resume checkpoint completed before its final routed visit/
    );
    assert.match(
      fastGuide,
      /Resume replay must reconstruct every durable partial visit/
    );
  });

  it("records the gate-overlap interaction incident", () => {
    assert.match(
      fastGuide,
      /Story conversations staged at a Fracture Gate must outrank gate entry/
    );
  });

  it("uses timed live frames for no-build cutscene iteration", () => {
    assert.match(runner, /HARTHMERE_E2E_CHAPTER_1_CAPTURE_FORMAT/);
    assert.match(runner, /chapter1RuntimeInject \? "frames" : "video"/);
    assert.match(runner, /captureChapter1FrameSequence/);
    assert.match(runner, /chapter1StartCutscene/);
    assert.match(runner, /chapter1CutsceneSnapshot/);
    assert.match(runner, /first\.page\.screenshot/);
    assert.match(runner, /Date\.now\(\) - startedAt <= ceilingMs/);
    assert.match(runner, /frame sequence did not finish/);
    assert.match(runner, /-contact-sheet\.png/);
    assert.match(runner, /holdChapter1AuditGates/);
    assert.match(runner, /chapter1RuntimeInject \? 1 : 2/);
    assert.match(runner, /clientContext\?\.table\?\.contents/);
    assert.match(runner, /CH1 CUTSCENE ISOLATION/);
    assert.match(runner, /settleChapter1CaptureActor/);
    assert.match(runner, /local cutscene actor is synchronized/);
    assert.match(runner, /ch1\.reviseLedgerEntry/);
    assert.match(runner, /expectedDialogueTexts/);
    assert.match(runner, /seenDialogueTexts/);
    assert.match(runner, /frame sequence missed authored visual checkpoints/);
    assert.match(
      fastGuide,
      /Use live frame sequences for iterative cutscene composition/
    );
    assert.match(
      fastGuide,
      /Compare captured cutscene dialogue by authored text/
    );
  });

  it("frames every held plot item from its live mesh bounds instead of a guessed torso point", () => {
    assert.match(runner, /heldItemWorldBounds/);
    assert.match(runner, /itemMeshInstance\?\.three/);
    assert.match(runner, /geometry\.computeBoundingBox\?\.\(\)/);
    assert.match(runner, /child\.matrixWorld\?\.elements/);
    assert.match(runner, /snapshot\.vertexCount > 0/);
    assert.match(
      runner,
      /const reviewTarget = \[\.\.\.bounds\.value\.center\]/
    );
    assert.match(
      runner,
      /const maxExtent = Math\.max\(\.\.\.bounds\.value\.size\)/
    );
    assert.match(runner, /maxExtent \* 2\.35/);
    assert.match(runner, /heldWorldBounds = bounds\.value/);
    assert.match(runner, /heldReviewCamera/);
    assert.match(runner, /setHeldItemDetailIsolation/);
    assert.match(
      runner,
      /detail review could not isolate the live attached mesh/
    );
    assert.match(runner, /heldDetailIsolation/);
    assert.match(runner, /button: "middle"/);
    assert.match(
      fastGuide,
      /Frame held-item review cameras from the live attached mesh bounds/
    );
  });

  it("does not require a world map pin when the next objective is Recovered UI", () => {
    assert.match(
      runner,
      /const nextStepUiOwned = nextStep\.id === "open_the_tab"/
    );
    assert.match(runner, /const exactNativeStep/);
    assert.match(runner, /const correctSurface = nextStepUiOwned/);
  });

  it("requires a reused Chapter 1 quest anchor to refresh to the active step", () => {
    const pins = read(
      "src/client/components/biomes_ui/adapters/mapPinnedDestination.ts"
    );
    assert.match(pins, /const objectiveChanged/);
    assert.match(
      pins,
      /input\.existingPin\?\.ownerStepId !== input\.quest\.currentStepId/
    );
    assert.match(pins, /const labelChanged/);
    assert.match(pins, /const destinationChanged/);
    assert.match(pins, /Math\.hypot\(/);
    assert.match(pins, /ownerQuestId: input\.quest\.questId/);
    assert.match(pins, /ownerStepId: input\.quest\.currentStepId/);
    assert.match(
      runner,
      /const activeQuestMarker = projection\.markers\?\.find/
    );
    assert.match(runner, /marker\.label === projection\.activeMapPin\?\.label/);
    assert.match(runner, /distanceXZ\(/);
    assert.match(runner, /\) <= CHAPTER1_E2E_WARP_VERTICAL_TOLERANCE_METERS/);
    assert.match(runner, /Boolean\(activeQuestMarker\)/);
    assert.match(
      fastGuide,
      /A repeated quest-level marker id does not make the persisted destination\s+current/
    );
  });

  it("releases only the failed test actor's dungeon slot before a checkpoint rerun", () => {
    assert.match(runner, /async function releaseFailedChapter1DungeonFixture/);
    assert.match(
      runner,
      /await releaseCh1Slot\(redis, dungeonId, partyId, actorId\)/
    );
    assert.match(runner, /activeDungeonRunId: undefined/);
    assert.match(runner, /chapter1-test-dungeon-slot-released/);
    assert.match(runner, /if \(questScenario\.status === "fail"\)/);
    assert.match(
      fastGuide,
      /Release a failed focused actor's Chapter 1 slot before launching its checkpoint\s+continuation/
    );
  });

  it("treats a canceled unmounted quest icon as transient during the Chapter 1 campaign", () => {
    assert.match(runner, /const abortedChapter1UnmountedQuestIcon/);
    assert.match(runner, /chapter1Features\.has\("quests"\)/);
    assert.match(runner, /quest-main\\\.\[a-f0-9\]\+\\\.png/);
  });

  it("allows only the canceled canonical world theme during a Chapter 1 audio transition", () => {
    assert.match(runner, /const abortedChapter1WorldMusicTransition/);
    assert.match(runner, /\(\?:music-1\|muck-music-1\)/);
    assert.match(
      runner,
      /chapter1Features\.has\("cutscenes"\) \|\|\s+chapter1Features\.has\("quests"\)/
    );
    assert.match(runner, /errorText === "net::ERR_ABORTED"/);
  });

  it("runs the authored long escort through Anima instead of teleporting companions", () => {
    assert.match(runner, /completes the live escort route/);
    assert.match(runner, /180_000,\s+180_000/);
    assert.match(
      runner,
      /distance3\(entity\.position\.v, escort\.target\) <= 22/
    );
    assert.doesNotMatch(
      runner,
      /position: Position\.create\(\{ v: escort\.position \}\)/
    );
    assert.match(
      fastGuide,
      /A 400-metre escort is not a 40-second interaction transition/
    );
  });

  it("classifies the exact unsupported-extension opaque console payload only", () => {
    assert.match(runner, /unsupportedExtensionOpaqueMessage/);
    assert.match(runner, /\{target: X, data: 150\}/);
  });

  it("finishes the real containment procedure before awaiting completion", () => {
    assert.match(runner, /step\.id === "the_procedure"/);
    assert.match(runner, /data-chapter1-containment-triage="objective"/);
    assert.match(runner, /data-chapter1-containment-control/);
    assert.match(runner, /containment procedure lost an authored stage/);
    assert.match(
      fastGuide,
      /Custom Chapter 1 interfaces own completion until their interaction\s+finishes/
    );
  });
});
