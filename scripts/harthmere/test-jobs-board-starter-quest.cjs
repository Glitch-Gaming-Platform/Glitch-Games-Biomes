#!/usr/bin/env node
/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const read = (rel) => fs.readFileSync(path.join(root, rel), "utf8");

const files = {
  quests: "src/client/components/challenges/LocalDevHarthmereQuests.tsx",
  panel: "src/client/components/harthmere_jobs_board/HarthmereJobsBoardPanel.tsx",
  live: "src/shared/harthmere/live_mode_backend.ts",
};

for (const rel of Object.values(files)) {
  if (!fs.existsSync(path.join(root, rel))) {
    throw new Error(`Missing expected file: ${rel}`);
  }
}

const quests = read(files.quests);
const panel = read(files.panel);
const live = read(files.live);

let failures = 0;
function check(name, condition) {
  if (!condition) {
    failures += 1;
    console.error(`FAIL: ${name}`);
    return;
  }
  console.log(`PASS: ${name}`);
}
function includes(source, needle) {
  return source.includes(needle);
}
function indexBefore(source, a, b) {
  const ia = source.indexOf(a);
  const ib = source.indexOf(b);
  return ia >= 0 && ib >= 0 && ia < ib;
}

console.log("== Harthmere Jobs Board starter quest regression current ==");

// Base cases: the starter quest exists, has a real objective, has a map target,
// and is assigned without a manual board/NPC accept step.
// Audit fix (2026-07-14): these two checks matched an exact NEWLINE-WRAPPED
// source layout ('… =\n  "read-the-jobs-board"'). A formatter later joined
// the declarations onto one line, so the checks failed even though the
// constants exist and are wired — the script reported false failures. Match
// the declaration with flexible whitespace instead of a frozen wrap style.
check("defines stable Read the Jobs Board quest id", /HARTHMERE_READ_JOBS_BOARD_QUEST_ID\s*=\s*"read-the-jobs-board"/.test(quests));
check("defines user-facing Read the Jobs Board title", /HARTHMERE_READ_JOBS_BOARD_TITLE\s*=\s*"Read the Jobs Board"/.test(quests));
check("defines a dedicated synthetic jobs board target offset", includes(quests, "HARTHMERE_JOBS_BOARD_TARGET_OFFSET = 140_041"));
check("Read the Jobs Board quest is in QUESTS", includes(quests, "id: HARTHMERE_READ_JOBS_BOARD_QUEST_ID"));
check("Read the Jobs Board quest appears before Mira so it can be one of the first assigned quests", indexBefore(quests, "id: HARTHMERE_READ_JOBS_BOARD_QUEST_ID", "id: BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId"));
check("Read the Jobs Board quest has no NPC giver dependency", includes(quests, "giverOffsets: []"));
check("Read the Jobs Board quest does not duplicate giverOffsets", (quests.match(/giverOffsets: \[\]/g) || []).length >= 1 && !quests.includes("giverOffsets: [],\n    giverOffsets: []"));
check("Read the Jobs Board quest is not merely listed on another board", includes(quests, "boardListed: false"));
check("Read the Jobs Board quest objective points at the jobs board", includes(quests, 'objective: "Read the Jobs Board."'));
check("Read the Jobs Board quest has a single-step completion message", includes(quests, "You read the Jobs Board. It lists town, guild, business, NPC, and player work"));
check("jobs board quest target is mapped for HUD/map routing", includes(quests, "[HARTHMERE_JOBS_BOARD_TARGET_OFFSET]:"));
check("jobs board quest target uses the real board location", includes(quests, "pos: [501.99486179104775, 70, -132.00350672753194]"));
check("jobs board quest target is visibly labeled", includes(quests, 'label: "Jobs Board"'));
check("jobs board tutorial pulses the Jobs HUD slot, not only the quest journal", includes(quests, 'labels.add("Jobs")') && !includes(quests, "/journal|quest log|read the.*board|jobs board|market board/"));
check("physical jobs board offset is recognized as a board interaction target", includes(quests, "isHarthmereJobsBoardOffset") && includes(quests, "offset === 41 || offset === HARTHMERE_JOBS_BOARD_TARGET_OFFSET"));
check("jobs board dialog exposes the live Jobs Board panel", includes(quests, 'name: "Open Jobs Board"') && includes(quests, "HARTHMERE_JOBS_BOARD_OPEN_EVENT"));
check("jobs board open action completes the starter quest", includes(quests, 'completeHarthmereJobsBoardReadQuest("jobs_board_panel_opened")'));
check("jobs board action is prioritized before generic quest actions", indexBefore(quests, 'action.name === "Open Jobs Board"', 'action.name.startsWith("Complete:")'));

// Autostart and migration: fresh players get the quest, older localStorage saves
// get migrated, and completed saves are not reactivated.
check("autostart list includes only the jobs board starter quest", includes(quests, "HARTHMERE_AUTOSTART_QUEST_IDS") && includes(quests, "HARTHMERE_READ_JOBS_BOARD_QUEST_ID,"));
check("starter state function assigns autostart quests as active", includes(quests, "createHarthmereStarterQuestState") && includes(quests, "Object.fromEntries"));
check("fresh localStorage returns starter quest state", includes(quests, "if (!raw) {\n      return createHarthmereStarterQuestState();\n    }"));
check("malformed localStorage safely returns starter quest state", includes(quests, "} catch {\n    return createHarthmereStarterQuestState();\n  }"));
check("normalizer migrates old saves by adding missing autostart quests", includes(quests, "if (!completed.includes(questId) && active[questId] === undefined)"));
check("normalizer does not reactivate completed starter quest", includes(quests, "!completed.includes(questId)"));
check("normalizer filters unknown active quest ids", includes(quests, "if (!quest) {\n      continue;\n    }"));
check("normalizer clamps invalid active step indexes", includes(quests, "Math.min(quest.steps.length - 1, Math.trunc(numericStep))"));
check("normalizer filters unknown completed quest ids", includes(quests, "QUESTS.some((entry) => entry.id === questId)"));
check("writeHarthmereQuestState persists normalized state", includes(quests, "const normalized = normalizeHarthmereQuestState(state)") && includes(quests, "JSON.stringify(normalized)"));

// Completion base/edge cases: reading the board completes the quest exactly once
// and does not crash SSR/non-browser paths.
check("exports jobs board read completion helper", includes(quests, "export function completeHarthmereJobsBoardReadQuest"));
check("completion helper is safe outside the browser", includes(quests, 'return { changed: false, reason: "not_browser" as const }'));
check("completion helper handles a missing quest definition", includes(quests, 'return { changed: false, reason: "missing_quest" as const }'));
check("completion helper is idempotent after completion", includes(quests, 'return { changed: false, reason: "already_completed" as const }'));
check("completion helper removes the quest from active state", includes(quests, "delete next.active[HARTHMERE_READ_JOBS_BOARD_QUEST_ID]"));
check("completion helper records the quest as completed", includes(quests, "HARTHMERE_READ_JOBS_BOARD_QUEST_ID,") && includes(quests, "completed: ["));
check("completion helper writes the state change", includes(quests, "writeQuestState(next)"));
check("completion helper records a mission event", includes(quests, "recordMissionEvent(\n    \"completed\","));
check("completion helper records quest-step completion", includes(quests, "recordHarthmereQuestStepCompleted("));
check("completion helper awards quest XP", includes(quests, "awardHarthmereQuestXp(quest.id, quest.title, true)"));
check("completion helper grants the quest inventory reward once through idempotent completion", includes(quests, "grantHarthmereQuestInventoryReward(quest.id, quest.title)"));
check("local-dev quest reset now reassigns starter quests", includes(quests, "const resetState = createHarthmereStarterQuestState()"));
check("reset copy tells testers starter quests are re-assigned", includes(quests, "starter quests were re-assigned"));

// Jobs board UI integration: opening/reading a real jobs board panel completes
// the starter quest; invalid boards must not falsely complete it.
check("jobs board panel imports the completion helper", includes(panel, "completeHarthmereJobsBoardReadQuest"));
check("jobs board panel resolves board before completion", panel.indexOf("const board = snapshot.boards[boardId]") >= 0 && panel.indexOf("const board = snapshot.boards[boardId]") < panel.lastIndexOf("completeHarthmereJobsBoardReadQuest"));
check("jobs board panel does not complete quest for an invalid board", includes(panel, "if (!board) return;"));
check("jobs board panel completes the quest when opened", includes(panel, 'completeHarthmereJobsBoardReadQuest("jobs_board_panel_opened")'));
check("jobs board panel effect is scoped to board identity", includes(panel, "}, [board, boardId]);"));

// Live backend defaults: production/live-mode state also starts with this quest
// alongside the existing Mira starter quest.
check("live backend exports jobs board starter quest id", includes(live, "HARTHMERE_READ_JOBS_BOARD_QUEST_ID"));
check("live backend exports jobs board starter step id", includes(live, "HARTHMERE_READ_JOBS_BOARD_STEP_ID"));
check("live backend assigns jobs board quest by default", includes(live, "[HARTHMERE_READ_JOBS_BOARD_QUEST_ID]:"));
check("live backend quest starts at zero progress", includes(live, "stepId: HARTHMERE_READ_JOBS_BOARD_STEP_ID,\n          progress: 0"));
check("live backend keeps Mira starter quest active too", includes(live, "[BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId]:"));
check("jobs board starter is before Mira in live defaults", indexBefore(live, "[HARTHMERE_READ_JOBS_BOARD_QUEST_ID]:", "[BUILDING_SYSTEM_MIRA_INTRO_QUEST.questId]:"));

if (failures) {
  console.error(`\nRESULT: FAIL (${failures} failure${failures === 1 ? "" : "s"})`);
  process.exit(1);
}
console.log("\nRESULT: PASS");
