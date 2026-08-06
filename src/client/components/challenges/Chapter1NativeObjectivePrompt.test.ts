/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

describe("Chapter1NativeObjectivePrompt input ownership", () => {
  const source = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/components/challenges/Chapter1NativeObjectivePrompt.tsx"
    ),
    "utf8"
  );
  const npcRendererSource = fs.readFileSync(
    path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
    "utf8"
  );
  const talkScreenSource = fs.readFileSync(
    path.join(
      process.cwd(),
      "src/client/components/challenges/TalkToNPCScreen.tsx"
    ),
    "utf8"
  );

  it("registers one highest-priority story action with the central dispatcher", () => {
    assert.match(source, /useWorldInteractionCandidate\(worldCandidate\)/);
    assert.match(source, /WORLD_INTERACTION_PRIORITY\.chapter1Story/);
    assert.doesNotMatch(source, /window\.addEventListener\("keydown"/);
  });

  it("routes alternate NPC Talk entry points back to the active Chapter 1 objective", () => {
    assert.match(source, /CHAPTER1_OBJECTIVE_INTERACT_EVENT/);
    assert.match(source, /interactWithObjective/);
    assert.match(talkScreenSource, /readChapter1ObjectiveWorldProjection/);
    assert.match(talkScreenSource, /ch1ObjectiveOwnsNpcInteraction/);
    assert.match(
      talkScreenSource,
      /new CustomEvent\(CHAPTER1_OBJECTIVE_INTERACT_EVENT\)/
    );
    assert.match(
      talkScreenSource,
      /if \(chapter1OwnsThisNpc\)[\s\S]*onClose\(\)[\s\S]*return/
    );
  });

  it("replaces normal supplier chatter with one explicit Chapter 1 trade action", () => {
    assert.match(talkScreenSource, /ch1ObjectiveDelegatesToNpcTrade/);
    assert.match(talkScreenSource, /Chapter1SupplierTalkDialog/);
    assert.match(talkScreenSource, /Trade with \$\{supplierLabel\}/);
    assert.match(talkScreenSource, /one real purchase or sale/);
    assert.match(
      talkScreenSource,
      /map marker will then move to the next supplier/
    );
  });

  it("registers only active, in-range, non-proximity objectives", () => {
    assert.match(source, /state\?\.status === "active"/);
    assert.match(source, /state\.withinRange/);
    assert.match(source, /state\.trigger !== "near_location"/);
    assert.match(source, /!state\.requirement\?\.blocksChapterInteraction/);
    assert.match(source, /disabled:\s*busy/);
    assert.match(source, /blocksChapterInteraction/);
    assert.match(
      source,
      /ch1InteractionSurfaceForStep\(state\.authoredStepId\) === "world"/
    );
  });

  it("routes the Recovered objective through highlighted BiomesUI controls", () => {
    assert.match(source, /UI_IDS\.HUD_PROMPT_OPEN_MENU/);
    assert.match(source, /UI_IDS\.TAB_RECOVERED/);
    assert.match(source, /Press J to open BiomesUI/);
    assert.match(source, /Select MEM — Recovered/);
    assert.match(source, /readChapter1RecoveredTabVisibility/);
    assert.match(source, /CHAPTER1_RECOVERED_TAB_VISIBILITY_EVENT/);
  });

  it("publishes the authenticated dynamic target through the standard map manager", () => {
    assert.match(source, /mapManager\.addNavigationAid/);
    assert.match(source, /kind: "quest"/);
    assert.match(source, /challengeId: state\.challengeId/);
    assert.match(source, /triggerId: state\.stepId/);
    assert.match(source, /kind: "entity"/);
    assert.match(source, /id: state\.targetEntityId as BiomesId/);
    assert.match(source, /position: \[\.\.\.state\.targetPosition\]/);
    assert.match(source, /publishChapter1ObjectiveWorldProjection/);
    assert.match(source, /label: state\.targetLabel \|\| state\.objective/);
    assert.match(source, /ch1ObjectiveUsesDynamicRouteDestination/);
    assert.match(source, /chapter1_route:\$\{state\.challengeId\}/);
    assert.match(source, /writeActiveBiomesUIMapPin\(pin\)/);
  });

  it("coalesces state polls and synchronously excludes completion races", () => {
    assert.match(source, /refreshInFlight\.current/);
    assert.match(source, /if \(refreshInFlight\.current\) return/);
    assert.match(source, /lastStateSignature\.current/);
    assert.match(source, /signature !== lastStateSignature\.current/);
    assert.match(source, /busyRef\.current = true/);
    assert.match(source, /!busyRef\.current/);
  });

  it("exposes authored choice ids for the production browser gate", () => {
    assert.match(source, /data-chapter1-choice-objective=/);
    assert.match(source, /data-chapter1-choice=/);
    assert.match(source, /option\.id === "not_yet"/);
  });

  it("paginates active dialogue before choices or completion", () => {
    assert.match(source, /data-chapter1-dialogue-objective=/);
    assert.match(source, /data-chapter1-dialogue-page=/);
    assert.match(source, /data-chapter1-dialogue-final=/);
    assert.match(source, /<TalkDialogModal/);
    assert.match(source, /<GenericTalkDialogModalStep/);
    assert.match(source, /onClose=\{advanceDialogue\}/);
    assert.doesNotMatch(source, /data-chapter1-dialogue-next/);
    assert.doesNotMatch(source, /aria-label=\{dialogue\.sequence\.title\}/);
    assert.match(source, /state\.dialogue/);
    assert.match(source, /dialogue\.mode === "objective"/);
    assert.match(source, /createPortal\(/);
    assert.match(source, /focusCamera=\{false\}/);
    assert.match(source, /extraClassNames="chapter1-story-dialogue"/);
    assert.match(source, /chapter1-choice-dialog/);
    assert.match(source, /data-chapter1-choice-next/);
  });

  it("publishes each authored human expression to the exact speaking NPC", () => {
    assert.match(source, /expression\?: HarthmereCinematicExpression/);
    assert.match(source, /activeDialogueVoice\.kind !== "human"/);
    assert.match(source, /resolveHarthmereNpcDialogueActor/);
    assert.match(source, /NpcMetadataSelector\.query\.all\(\)/);
    assert.match(source, /preferredActorId: activeDialogueVoice\.entityId/);
    assert.match(source, /publishHarthmereNpcDialogueExpression/);
    assert.match(source, /clearHarthmereNpcDialogueExpression/);
    assert.match(source, /data-chapter1-dialogue-expression/);
    assert.match(source, /data-chapter1-dialogue-actor-id/);

    assert.match(npcRendererSource, /readHarthmereNpcDialogueExpression/);
    assert.match(npcRendererSource, /dialogueExpressionCue\.expression/);
    assert.match(npcRendererSource, /source: "dialogue"|"dialogue" : "script"/);
    assert.match(npcRendererSource, /cutsceneNpcAnimationAction/);
  });

  it("keeps a blocked story interaction from falling through to nearby stations", () => {
    assert.match(source, /disabled:\s*busy \|\| sleepTransition/);
    assert.doesNotMatch(
      source,
      /disabled:[^\n]*Boolean\(state\.requirement && !state\.requirement\.ready\)/
    );
    assert.match(source, /Required item missing/);
    assert.match(source, /setError\(next\.ok \? undefined : next\.reason\)/);
  });

  it("pauses background state polling while story modals are open", () => {
    assert.match(source, /modalOpenRef\.current = modalOpen/);
    assert.match(source, /!modalOpenRef\.current/);
  });

  it("runs containment as a no-fail expert interface and prepares combat routes before progress", () => {
    assert.match(source, /Chapter1ContainmentTriage/);
    assert.match(source, /state\.authoredStepId === "the_procedure"/);
    assert.match(source, /action: "prepare"/);
    assert.match(source, /prepareEncounter\(option\.id\)/);
    assert.match(source, /state\.preparedChoice/);
  });

  it("launches authored cinematics from normal objective completion", () => {
    assert.match(source, /requestChapter1CutsceneById\(next\.cutsceneId/);
    assert.match(source, /state\?\.introCutsceneId/);
    assert.match(source, /biomes\.chapter1\.cutscene/);
  });

  it("treats sleeping as a visible transition instead of an instant F receipt", () => {
    assert.match(source, /beginSleepTransition/);
    assert.match(source, /data-chapter1-sleep-transition="active"/);
    assert.match(source, /The road-house goes quiet/);
  });
});
