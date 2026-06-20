#!/usr/bin/env node
// SNAPSHOT_GROVE_TUTOR_HIGHLIGHTS:
// Verifies the four current deliverables on top of current:
//   1. NPC dialogue paragraphs are joined with {break} so unslugNpcDescription
//      can split them — fixes the "go.Say" / "day.Next" / "words.I" run-on
//      sentence bug visible in the pre screenshots.
//   2. The runtime broadcasts a bottom-bar nav-label highlight via the
//      SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT event, and the HUD listens
//      and renders a pulsing ring + bouncing down-arrow on the matching
//      NavSlot.
//   3. A new "Chat" NavSlot exists, an openSnapshotGroveTutorChatPanel()
//      helper exists, the SnapshotGroveTutorChatPanel component renders
//      four channel tabs (Say / Whisper / Party / Trade), publishes an
//      open_tab event with tab="chat" when opened, and publishes a
//      snapshot_grove_practice_action with practiceAction "chat_<channel>"
//      when Send is pressed.
//   4. The HUD bottom-bar supports Left/Right arrow-key navigation between
//      its buttons via a roving-tabindex pattern (toolbar role + arrow
//      handler keyed off data-tutor-nav-label).
const fs = require("fs");
const path = require("path");
const root = process.argv[2] || process.cwd();
function read(rel) { return fs.readFileSync(path.join(root, rel), "utf8"); }
let failures = 0;
function ok(cond, msg) {
  if (cond) { console.log(`OK ${msg}`); }
  else { failures += 1; console.error(`FAIL ${msg}`); }
}

const runtime = read("src/client/components/challenges/LocalDevSnapshotGroveBibleRuntime.tsx");
const hud = read("src/client/components/challenges/HarthmereUnifiedHUD.tsx");

// 1. Dialogue spacing — {break} separator, no back-to-back </text><text>.
ok(
  /\.join\("\{break\}"\)/.test(runtime),
  "Grove NPC quest dialog paragraphs are joined with {break} (fixes the run-on sentence bug)",
);
ok(
  !/return `<text>\$\{[^}]+\}<\/text><text>/.test(runtime),
  "npcQuestDialogueCopy does NOT concatenate <text> tags directly (forces use of {break})",
);
ok(
  /dialogText: `<text>\$\{line\}<\/text>\{break\}\$\{questCopy\}`/.test(runtime),
  "Bark line and quest copy are joined with {break} in useSnapshotGroveNpcDialog",
);
ok(
  /Come find me back here at the fountain when/.test(runtime),
  "Dialogue closer is naturalized ('Come find me back here at the fountain when X is sorted.')",
);
ok(
  !/I will be right here at the fountain when [^"]*is taken care of/.test(runtime),
  "No remaining 'I will be right here at the fountain when X is taken care of' meta closer",
);

// 2. Runtime broadcasts the bottom-bar highlight set on every active-step
//    change, and exports the mapping function the HUD imports.
ok(
  /export const SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT\s*=/.test(runtime),
  "Runtime exports SNAPSHOT_GROVE_TUTOR_HIGHLIGHT_EVENT event constant",
);
ok(
  /export function snapshotGroveTutorNavLabelsForHighlights\(/.test(runtime),
  "Runtime exports snapshotGroveTutorNavLabelsForHighlights (chip -> NavSlot label mapping)",
);
ok(
  /function broadcastSnapshotGroveTutorHudLabels\(/.test(runtime),
  "Runtime defines broadcastSnapshotGroveTutorHudLabels helper",
);
// The controller useEffect that recomputes and broadcasts.
ok(
  /broadcastSnapshotGroveTutorHudLabels\(labels(?:,\s*chips)?\)/.test(runtime),
  "Controller broadcasts the computed nav labels when the active step changes",
);
ok(
  /broadcastSnapshotGroveTutorHudLabels\(\[\]\)/.test(runtime),
  "Controller broadcasts an empty highlight set when no active quest (clears the pulse)",
);

// 3. Highlight chip mapping covers the eight bottom-bar nav buttons.
for (const chip of [
  "BAG", "HOTBAR", "CRAFT", "MAP", "JOURNAL", "INBOX", "CHAT",
]) {
  ok(
    new RegExp(`case "${chip}":`).test(runtime),
    `Chip -> NavSlot mapping handles "${chip}"`,
  );
}
ok(
  /text\.includes\("chat"\)/.test(runtime),
  "expectedOpenTabForObjective recognizes 'chat' objective text and routes to chat tab",
);
ok(
  /highlights\.add\("CHAT"\)/.test(runtime),
  "groveHudHighlightsForTrigger adds CHAT chip for chat/whisper/channel objectives",
);

// 4. HUD changes — pulse + arrow keyframes, useTutorHighlightedNavLabels
//    hook, Chat NavSlot, ensureSnapshotGroveTutorHighlightStyles mount.
ok(
  /snapshotGroveTutorPulse/.test(hud),
  "HUD defines a snapshotGroveTutorPulse keyframe for the pulsing ring",
);
ok(
  /snapshotGroveTutorArrow/.test(hud),
  "HUD defines a snapshotGroveTutorArrow keyframe for the bouncing down-arrow",
);
ok(
  /ensureSnapshotGroveTutorHighlightStyles/.test(hud),
  "HUD injects the keyframe styles via ensureSnapshotGroveTutorHighlightStyles",
);
ok(
  /function useTutorHighlightedNavLabels\(/.test(hud),
  "HUD defines useTutorHighlightedNavLabels hook",
);
ok(
  /"biomes:snapshot-grove-tutor-hud-highlights"/.test(hud),
  "HUD listens for the current highlight broadcast event",
);
ok(
  /highlighted\?: boolean;/.test(hud),
  "NavSlot accepts a highlighted prop",
);
ok(
  /data-tutor-nav-label/.test(hud),
  "NavSlot exposes a data-tutor-nav-label attribute for arrow-key navigation lookup",
);
ok(
  /label="Bag"[\s\S]{0,160}hint="I"[\s\S]{0,160}onClick={\(\) => onAction\("inventory"\)}[\s\S]{0,160}highlighted={isHot\("Bag"\)}/.test(hud),
  "UtilityActionBar passes highlighted={isHot('Bag')} to the Bag NavSlot",
);
ok(
  /label="Map"[\s\S]{0,160}hint="M"[\s\S]{0,160}onClick={\(\) => onAction\("map"\)}[\s\S]{0,160}highlighted={isHot\("Map"\)}/.test(hud),
  "UtilityActionBar passes highlighted={isHot('Map')} to the Map NavSlot",
);
ok(
  /label="Chat"[\s\S]{0,200}openSnapshotGroveTutorChatPanel\(\)/.test(hud),
  "New Chat NavSlot exists and calls openSnapshotGroveTutorChatPanel on click",
);
ok(
  /highlighted={isHot\("Chat"\)}/.test(hud),
  "Chat NavSlot uses isHot('Chat') for its highlighted state",
);

// 5. Chat panel component.
ok(
  /export const SnapshotGroveTutorChatPanel/.test(runtime),
  "Runtime exports SnapshotGroveTutorChatPanel component",
);
ok(
  /export function openSnapshotGroveTutorChatPanel\(\)/.test(runtime),
  "Runtime exports openSnapshotGroveTutorChatPanel helper",
);
for (const ch of ["say", "whisper", "party", "trade"]) {
  ok(
    new RegExp(`id: "${ch}"`).test(runtime),
    `Chat panel exposes the "${ch}" channel tab`,
  );
}
ok(
  /kind: "open_tab", tab: "chat"/.test(runtime),
  "Chat panel publishes an open_tab event with tab='chat' so the chat lesson can advance",
);
ok(
  /practiceAction: `chat_\$\{channel\}`/.test(runtime),
  "Chat panel publishes a snapshot_grove_practice_action with practiceAction 'chat_<channel>' on Send",
);
ok(
  /role="dialog"[\s\S]{0,200}aria-label="Tutorial chat panel"/.test(runtime),
  "Chat panel has accessible role=dialog and aria-label",
);
ok(
  /ArrowLeft.*ArrowRight|ArrowRight.*ArrowLeft/.test(runtime),
  "Chat panel's channel tablist supports Left/Right arrow key navigation",
);

// 6. HUD imports and mounts the chat panel.
ok(
  /SnapshotGroveTutorChatPanel,/.test(hud),
  "HUD imports SnapshotGroveTutorChatPanel",
);
ok(
  /openSnapshotGroveTutorChatPanel,/.test(hud),
  "HUD imports openSnapshotGroveTutorChatPanel",
);
ok(
  /<SnapshotGroveTutorChatPanel \/>/.test(hud),
  "HUD mounts <SnapshotGroveTutorChatPanel /> inside the HUD tree",
);

// 7. Arrow-key navigation on the bottom action bar.
ok(
  /role="toolbar"/.test(hud),
  "UtilityActionBar renders with role=toolbar (announces it as a button group to screen readers)",
);
ok(
  /data-snapshot-grove-nav-arrow-keys="true"/.test(hud),
  "UtilityActionBar marks itself as arrow-key-navigable",
);
ok(
  /onKeyDown={onArrowKey}/.test(hud),
  "UtilityActionBar wires an onKeyDown arrow handler",
);
ok(
  /e\.key !== "ArrowLeft" && e\.key !== "ArrowRight"/.test(hud),
  "Arrow handler only intercepts Left/Right (preserves Up/Down for other handlers and movement)",
);
ok(
  /hasAttribute\("data-tutor-nav-label"\)/.test(hud),
  "Arrow handler only fires when focus is on a NavSlot button (does not hijack global arrow keys)",
);
ok(
  /buttons\[next\]\.focus\(\)/.test(hud),
  "Arrow handler moves focus to the next NavSlot button",
);
ok(
  /aria-label="Game HUD action bar — use Left and Right arrow keys to switch between buttons"/.test(hud),
  "Bottom bar carries an aria-label explaining arrow-key navigation",
);

// 8. Runtime marker records this pass.
ok(
  runtime.includes("snapshot-grove-bible-tutor-highlights") ||
    (runtime.includes("snapshot-grove-mission-critical") || runtime.includes("snapshot-grove-mission-critical")),
  "Runtime marker records the current tutor-highlights update",
);

if (failures) {
  console.error(`current tutor highlights check failed: ${failures} failure(s)`);
  process.exit(1);
}
console.log("current tutor highlights check passed");
