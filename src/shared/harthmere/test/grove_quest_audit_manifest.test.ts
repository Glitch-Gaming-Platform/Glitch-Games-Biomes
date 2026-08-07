/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  GROVE_QUEST_AUDIT_MANIFEST,
  groveQuestAuditTriggerKinds,
} from "../grove/grove_quest_audit_manifest";
import { GROVE_QUEST_CATALOG } from "../grove/grove_quest_catalog";
import { groveMarkerWorldPosition } from "../grove/grove_waypoints";

describe("Grove 51-quest pre-visual audit manifest", () => {
  it("covers all 51 quests and all 255 objective leaves exactly once", () => {
    assert.equal(GROVE_QUEST_CATALOG.length, 51);
    assert.equal(GROVE_QUEST_AUDIT_MANIFEST.length, 255);
    assert.equal(
      new Set(GROVE_QUEST_AUDIT_MANIFEST.map((row) => row.questId)).size,
      51
    );
    assert.equal(
      new Set(GROVE_QUEST_AUDIT_MANIFEST.map((row) => row.key)).size,
      255
    );
    for (const quest of GROVE_QUEST_CATALOG) {
      assert.equal(
        GROVE_QUEST_AUDIT_MANIFEST.filter((row) => row.questId === quest.id)
          .length,
        quest.steps.length,
        `${quest.id}: incomplete objective manifest`
      );
    }
  });

  it("records every authored trigger family before the visual pass", () => {
    assert.deepEqual(groveQuestAuditTriggerKinds(), [
      "choice",
      "collect",
      "combat",
      "craft",
      "destroy",
      "interact",
      "inventory_change",
      "item_grant",
      "item_use",
      "near_location",
      "open_jobs_board",
      "open_tab",
      "photo_post",
      "place_voxel",
      "talk_npc",
    ]);
  });

  it("gives every row exact native, map, authority, and screenshot evidence", () => {
    const failures: string[] = [];
    for (const row of GROVE_QUEST_AUDIT_MANIFEST) {
      if (!Number.isSafeInteger(row.nativeQuestId)) failures.push(`${row.key}:quest`);
      if (!Number.isSafeInteger(row.nativeStepId)) failures.push(`${row.key}:step`);
      if (!Number.isSafeInteger(row.giverEntityId)) failures.push(`${row.key}:giver`);
      if (!row.markerPosition.every(Number.isFinite)) failures.push(`${row.key}:pin`);
      if (!row.targetMarkerIds.length) failures.push(`${row.key}:targets`);
      if (row.targetMarkerPositions.length !== row.targetMarkerIds.length) {
        failures.push(`${row.key}:target_positions`);
      }
      if (!row.completionEventKinds.includes(String(row.primaryCompletionEvent.kind))) {
        failures.push(`${row.key}:event:${String(row.primaryCompletionEvent.kind)}`);
      }
      if (
        !row.exactMapPinRequired ||
        !row.nativeEcsEvidenceRequired ||
        !row.cloudSaveEvidenceRequired ||
        !row.synchronizedFrontendEvidenceRequired ||
        !row.currentScreenshotRequired ||
        !row.completedScreenshotRequired
      ) {
        failures.push(`${row.key}:evidence`);
      }
    }
    assert.deepEqual(failures, []);
  });

  it("requires the full signed interaction contract for every physical world row", () => {
    const failures = GROVE_QUEST_AUDIT_MANIFEST.flatMap((row) => {
      if (!row.signedWorldReceiptRequired) return [];
      return row.worldInteractionKind
        ? []
        : [`${row.key}:${row.markerLabel}:missing interaction semantics`];
    });
    assert.deepEqual(failures, []);
  });

  it("resolves every authored item, inventory requirement, and recipe to stable native identity", () => {
    const failures: string[] = [];
    for (const row of GROVE_QUEST_AUDIT_MANIFEST) {
      if (row.practiceItem && !Number.isSafeInteger(row.practiceItem.nativeItemId)) {
        failures.push(`${row.key}:practice:${row.practiceItem.itemId}`);
      }
      if (row.inventoryRequirement && !Number.isSafeInteger(row.inventoryRequirement.nativeItemId)) {
        failures.push(`${row.key}:inventory:${row.inventoryRequirement.itemId}`);
      }
      if (row.craft) {
        if (!Number.isSafeInteger(row.craft.nativeRecipeId)) {
          failures.push(`${row.key}:recipe:${row.craft.recipeId}`);
        }
        if (!Number.isSafeInteger(row.craft.nativeOutputItemId)) {
          failures.push(`${row.key}:output:${row.craft.outputItemId}`);
        }
      }
    }
    assert.deepEqual(failures, []);
  });

  it("gives every final objective an acknowledgement and structured one-time reward", () => {
    const failures: string[] = [];
    for (const quest of GROVE_QUEST_CATALOG) {
      const rows = GROVE_QUEST_AUDIT_MANIFEST.filter(
        (row) => row.questId === quest.id
      );
      const final = rows[rows.length - 1];
      if (final?.completionAcknowledgement !== `${quest.title} is handled.`) {
        failures.push(`${quest.id}:ack`);
      }
      if (final?.structuredReward?.questId !== quest.id) {
        failures.push(`${quest.id}:reward`);
      }
    }
    assert.deepEqual(failures, []);
  });

  it("applies target-scoped Chapter 1 precedence and release to every NPC objective", () => {
    const failures = GROVE_QUEST_AUDIT_MANIFEST.flatMap((row) => {
      if (row.markerKind !== "npc") return [];
      return row.chapter1DialoguePolicy ===
        "target_scoped_precedence_and_release"
        ? []
        : [`${row.key}:chapter1`];
    });
    assert.deepEqual(failures, []);
    assert.ok(
      GROVE_QUEST_AUDIT_MANIFEST.some((row) => row.chapter1SupplierOverlap),
      "the manifest must retain the known Chapter 1 Grove supplier overlap"
    );
  });

  it("keeps multi-target and sample geography distinct and away from the giver", () => {
    const failures: string[] = [];
    for (const row of GROVE_QUEST_AUDIT_MANIFEST) {
      const unique = new Set(row.targetMarkerPositions.map((position) => position.join(",")));
      if (row.targetMarkerIds.length > 1 && unique.size !== row.targetMarkerIds.length) {
        failures.push(`${row.key}:overlapping targets`);
      }
      // Only physical resource pickups are required to travel away from the
      // giver. A later "bring both samples to Doc's table" objective should
      // of course resolve at Doc, and Luis's bolt explicitly comes from the
      // cart beside him rather than pretending to be a remote forage node.
      if (
        !["sticky_medicine", "samples_for_the_chapel"].includes(row.questId) ||
        row.markerKind !== "resource" ||
        !["collect", "item_grant"].includes(row.trigger)
      ) {
        continue;
      }
      const giver = groveMarkerWorldPosition(`npc_${row.giverId}`);
      if (!giver) continue;
      const distance = Math.hypot(
        row.markerPosition[0] - giver[0],
        row.markerPosition[2] - giver[2]
      );
      if (distance < 6) failures.push(`${row.key}:sample only ${distance.toFixed(1)}m from giver`);
    }
    assert.deepEqual(failures, []);
  });

  it("verifies every authored GLB exists before visual confirmation", () => {
    const root = path.resolve(__dirname, "../../../..");
    const missing = GROVE_QUEST_AUDIT_MANIFEST.flatMap((row) => {
      const urls = [row.authoredAssetUrl, row.practiceItem?.assetUrl].filter(
        (url): url is string => Boolean(url)
      );
      return urls.flatMap((url) =>
        fs.existsSync(path.join(root, "public", url.replace(/^\//, "")))
          ? []
          : [`${row.key}:${url}`]
      );
    });
    assert.deepEqual(missing, []);
  });
});
