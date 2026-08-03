#!/usr/bin/env node

// Static release-contract audit for the expensive browser round trip. This does
// not replace execution; it prevents the gate from silently regressing back to
// direct ECS events that bypass prompts, panels, or frontend synchronization.
const fs = require("fs");
const path = require("path");

// The snapshot is the authored source of truth for step counts and trigger
// kinds. Loading it here makes the inexpensive contract fail when new content
// is added without a corresponding browser action implementation.
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
const { iterBackupEntriesFromFile } = require("../../src/server/backup/serde");
const { BikkieRuntime } = require("../../src/shared/bikkie/active");
const {
  deserializeTrigger,
} = require("../../src/server/shared/triggers/serde");

const root = path.resolve(process.argv[2] || process.cwd());
const runner = fs.readFileSync(
  path.join(
    root,
    "scripts/harthmere/test-harthmere-native-ecs-roundtrip-e2e.cjs"
  ),
  "utf8"
);
const gate = fs.readFileSync(
  path.join(root, "scripts/harthmere/run-harthmere-native-ecs-e2e.sh"),
  "utf8"
);
const cameraModeActions = fs.readFileSync(
  path.join(root, "src/client/components/inventory/cameraModeActions.ts"),
  "utf8"
);
const cameraHotBar = fs.readFileSync(
  path.join(root, "src/client/components/inventory/HotBar.tsx"),
  "utf8"
);

function requireText(text, label) {
  if (!runner.includes(text)) {
    throw new Error(`Missing exhaustive robot-story proof: ${label}`);
  }
  process.stdout.write(`OK ${label}\n`);
}

function triggerChildren(trigger) {
  return ["seq", "all", "any", "variant"].includes(trigger?.kind)
    ? (trigger.triggers ?? [])
    : [];
}

function triggerLeaves(trigger, output = []) {
  const children = triggerChildren(trigger);
  if (children.length === 0) output.push(trigger);
  for (const child of children) triggerLeaves(child, output);
  return output;
}

async function main() {
  for (const [text, label] of [
    [
      "NATIVE_ROBOT_STORY_EXHAUSTIVE_QUEST_IDS",
      "all four robot-story chapters",
    ],
    ["executeRobotStoryTriggerNode", "recursive authored-trigger traversal"],
    ['case "challengeClaimRewards"', "NPC and reward claims"],
    ['case "inventoryHas"', "inventory quantity requirements"],
    ['case "collectType"', "typed resource collection"],
    ['case "craft"', "recipe crafting"],
    ['case "event"', "place, combat, and race events"],
    ['case "mapBeam"', "Road Ahead destination arrival"],
    ['case "collect"', "Road Ahead exact Muckwad collection"],
    ['case "wearType"', "Road Ahead clothing equipment"],
    [
      "waitForOpenContainerPrompt(first.page, label)",
      "visible underwater F prompt",
    ],
    ['keyboard.press("KeyF")', "real F-key interaction"],
    [
      'name: "Water-logged Muck Buster"',
      "exact accessible quest item in container UI",
    ],
    [
      "did not render exactly one accessible quest-item icon",
      "unique visible native storage item",
    ],
    [
      'getByRole("button", { name: "Take All" })',
      "real container Take All action",
    ],
    [
      "browser Take All reaches authoritative inventory and quest state",
      "frontend-to-authority claim",
    ],
    [
      "browser transfer returns to the originating frontend",
      "authority-to-frontend synchronization",
    ],
    [
      "next authored objective reaches the frontend",
      "post-claim objective projection",
    ],
    [
      "chapter completion and automatic continuation",
      "chapter-to-chapter continuation",
    ],
    ["every authored action completed", "per-chapter exhaustive report"],
    [
      "NATIVE_ROBOT_STORY_CRATE_DIALOG_SPECS",
      "authored Busted/Get-the-Muck-Out crate identities",
    ],
    [
      "NATIVE_GET_THE_MUCK_OUT_INSCRIPTION_SPECS",
      "canonical Get-the-Muck-Out inscription identities",
    ],
    [
      "visible F Read prompt targets canonical grouped plate",
      "real grouped inscription F/Read prompt",
    ],
    [
      "HARTHMERE_E2E_GET_MUCK_OUT_INSCRIPTIONS_ONLY",
      "focused grouped-inscription browser checkpoint",
    ],
    [
      "visible F Open prompt targets shipped crate",
      "real prompt on both crate-shaped reward props",
    ],
    [
      "clickTalkDialogButton(first, spec.acceptText",
      "real crate reward dialogue action",
    ],
    [
      "F/dialogue grants reward and advances quest",
      "crate UI reaches authoritative reward and progress",
    ],
    ["Snapshot Grove browser batch found", "non-fail-fast lesson batch"],
    ["Robot-story browser batch found", "non-fail-fast chapter batch"],
    ["road-ahead-selfie.png", "rendered Road Ahead selfie evidence"],
    ["selfie upload and X camera exit", "camera post and recovery key proof"],
    ["__harthmereCameraKeyProbe", "physical camera-key delivery diagnostics"],
    [
      "__harthmereCameraResourceProbe",
      "camera exit hotbar resource-write diagnostics",
    ],
    [
      "actor continuity lost before trigger progression",
      "immediate actor-state replacement diagnosis",
    ],
    [
      "claim target and player are within talking distance",
      "authoritative NPC-claim proximity gate",
    ],
    [
      "Take All transfers every authored item",
      "complete clothing crate transfer",
    ],
    [
      "response.status() >= 400",
      "URL-bearing same-origin HTTP error diagnostics",
    ],
    [
      "missingLocalProfilePicture",
      "local profile-picture fallback classification",
    ],
    [
      "abortedLocalProfilePicture",
      "aborted local profile-picture fallback classification",
    ],
    [
      "robot naming completes setup and advances Gimme Shelter",
      "robot naming preserves the remaining Gimme Shelter objectives",
    ],
  ]) {
    requireText(text, label);
  }

  if (
    !cameraModeActions.includes('reactResources.get("/scene/local_player")')
  ) {
    throw new Error(
      "Camera input action must read the local player without invoking React hooks"
    );
  }
  if (cameraModeActions.includes("reactResources.use(")) {
    throw new Error(
      "Camera input action must not invoke ReactResources.use outside render"
    );
  }
  if (!cameraHotBar.includes("inventory/cameraModeActions")) {
    throw new Error(
      "Camera hotbar must consume the dependency-light event action module"
    );
  }
  process.stdout.write("OK camera actions are hook-free outside render\n");

  if (
    !gate.includes("HARTHMERE_E2E_ROBOT_STORY_EXHAUSTIVE=1") ||
    !gate.includes("test-harthmere-native-ecs-roundtrip-e2e.cjs")
  ) {
    throw new Error(
      "Native ECS release gate does not execute exhaustive robot story"
    );
  }
  process.stdout.write(
    "OK release gate executes exhaustive robot-story browser round trip\n"
  );

  const expectedLeaves = new Map([
    [6193612340426932, 17],
    [7405046529843322, 21],
    [817959262145055, 14],
    [5739496793885069, 3],
  ]);
  const supportedKinds = new Set([
    "challengeClaimRewards",
    "inventoryHas",
    "collectType",
    "craft",
    "event",
    "mapBeam",
    "collect",
    "wearType",
  ]);
  const supportedEventKinds = new Set([
    "place",
    "npcKilled",
    "minigame_simple_race_finish",
    "postPhoto",
  ]);
  let audited = false;
  for await (const [version, entry] of iterBackupEntriesFromFile(
    path.join(root, "snapshot_backup.json")
  )) {
    if (version !== "bikkie") continue;
    for (const [questId, expectedLeafCount] of expectedLeaves) {
      const quest = entry.baked.contents.get(questId);
      if (!quest?.trigger) throw new Error(`Missing authored quest ${questId}`);
      const leaves = triggerLeaves(quest.trigger);
      if (leaves.length !== expectedLeafCount) {
        throw new Error(
          `${quest.displayName} has ${leaves.length} leaves; expected ${expectedLeafCount}`
        );
      }
      for (const leaf of leaves) {
        if (!supportedKinds.has(leaf.kind)) {
          throw new Error(
            `No exhaustive action family for ${quest.displayName} ${leaf.kind}:${leaf.id}`
          );
        }
        if (leaf.kind === "event" && !supportedEventKinds.has(leaf.eventKind)) {
          throw new Error(
            `No exhaustive event action for ${quest.displayName} ${leaf.eventKind}:${leaf.id}`
          );
        }
      }
      process.stdout.write(
        `OK ${quest.displayName}: ${leaves.length} authored leaves have browser action families\n`
      );
    }
    const gimmeShelter = entry.baked.contents.get(3741112749915015);
    if (!gimmeShelter?.trigger) {
      throw new Error("Missing authored Gimme Shelter quest");
    }
    const workbenchSteps = triggerLeaves(gimmeShelter.trigger).filter(
      (leaf) => leaf?.kind === "blueprintBuilt"
    );
    if (
      workbenchSteps.length !== 1 ||
      workbenchSteps[0].id !== 6556766958076032 ||
      workbenchSteps[0].blueprint !== 7539420629350159
    ) {
      throw new Error(
        `Gimme Shelter Workbench trigger drifted: ${JSON.stringify(workbenchSteps)}`
      );
    }
    const workbenchBlueprint = entry.baked.contents.get(
      workbenchSteps[0].blueprint
    );
    if (workbenchBlueprint?.turnsInto !== 1534621126189448) {
      throw new Error(
        `Gimme Shelter Workbench blueprint no longer builds Workbench: ${workbenchBlueprint?.turnsInto}`
      );
    }
    process.stdout.write(
      "OK Gimme Shelter: authored Workbench blueprint leaf still targets the shipped Workbench relation\n"
    );

    const previousRuntime = global.bikkieRuntime;
    try {
      const runtime = new BikkieRuntime();
      runtime.registerBiscuits(entry.baked.contents);
      global.bikkieRuntime = runtime;

      const states = new Map([
        [gimmeShelter.trigger.id, { payload: workbenchSteps[0].id }],
      ]);
      const trigger = deserializeTrigger(gimmeShelter.trigger);
      const advanced = trigger.update({
        entity: {},
        events: [
          {
            kind: "blueprintBuilt",
            entityId: 1,
            // Exercise the observed compatibility boundary: the completed
            // placeable identity rather than the consumed blueprint identity.
            blueprint: workbenchBlueprint.turnsInto,
            position: [0, 0, 0],
          },
        ],
        rootId: gimmeShelter.id,
        publish: () => undefined,
        updateState: (id, _schema, update) => {
          const next = update(states.get(id) ?? {});
          states.set(id, next);
          return next;
        },
        clearState: (id) => states.delete(id),
      });
      if (advanced !== false || !states.get(workbenchSteps[0].id)?.firedAt) {
        throw new Error(
          `Gimme Shelter Workbench leaf did not persist: ${JSON.stringify([
            advanced,
            states.get(workbenchSteps[0].id),
          ])}`
        );
      }
      if (states.get(gimmeShelter.trigger.id)?.payload !== 4268272678757220) {
        throw new Error(
          `Gimme Shelter did not advance to lumber/home objective: ${JSON.stringify(
            states.get(gimmeShelter.trigger.id)
          )}`
        );
      }
      process.stdout.write(
        "OK Gimme Shelter: real trigger engine advances Workbench completion to lumber/home\n"
      );
    } finally {
      if (previousRuntime) {
        global.bikkieRuntime = previousRuntime;
      } else {
        delete global.bikkieRuntime;
      }
    }
    audited = true;
    break;
  }
  if (!audited) throw new Error("snapshot_backup.json contains no Bikkie tray");

  process.stdout.write(
    "\nNative robot-story browser E2E contract checks passed.\n"
  );
}

void main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exitCode = 1;
});
