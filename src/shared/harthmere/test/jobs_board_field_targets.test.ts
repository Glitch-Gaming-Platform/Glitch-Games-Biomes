/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import {
  harthmereJobsBoardFieldTargetFeetY,
  harthmereJobsBoardFieldTargets,
  harthmereJobsBoardFieldTargetForId,
  harthmereJobsBoardFieldTargetsNearPosition,
  harthmereOutpostWorkStationForOutpost,
  isHarthmereJobsBoardFieldTargetId,
  validateHarthmereJobsBoardFieldTargets,
} from "../jobs_board_field_targets";
import {
  HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES,
  isKnownHarthmereJobsBoardExecutableItemId,
} from "../jobs_board_business_templates";
import { HARTHMERE_BUSINESS_OUTPOSTS } from "../business_customer_simulator";
import {
  harthmereObjectInteractionForLabel,
  isHarthmereNonLivingObjectLabel,
} from "../object_interaction_semantics";
import {
  harthmereJobsBoardQuestMarkerPositionForId,
  harthmereJobsBoardQuestMarkerRuntimePositionForId,
} from "../jobs_board_quest_marker_positions";
import { harthmereJobItemSourceGuidance } from "../harthmere_job_objective";
import { HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES } from "../mmo_jobs_board_authority";

// The world-object interaction kinds the server will issue a receipt for
// (HARTHMERE_AUTHORITATIVE_FALLBACK_INTERACTIONS in live_mode_backend).
const AUTHORITATIVE_RECEIPT_KINDS = new Set([
  "open_door",
  "open_gate",
  "read",
  "use",
  "repair",
  "recover",
  "tend",
  "practice",
  "check_outfit",
  "take_photo",
  "inspect",
  "gather",
]);

describe("jobs board field targets", () => {
  it("keeps permanent field props visible at authored Y while terrain streams", () => {
    assert.equal(harthmereJobsBoardFieldTargetFeetY(undefined, 47), 47);
    assert.equal(harthmereJobsBoardFieldTargetFeetY(52, 47), 52);
  });

  it("declares one physical target per business template and per outpost", () => {
    assert.deepEqual(validateHarthmereJobsBoardFieldTargets(), []);
    assert.equal(
      harthmereJobsBoardFieldTargets().length,
      HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES.length +
        HARTHMERE_BUSINESS_OUTPOSTS.length
    );
  });

  it("gives every field target an interactable label the server will accept", () => {
    for (const target of harthmereJobsBoardFieldTargets()) {
      assert.ok(
        isHarthmereNonLivingObjectLabel({ label: target.label }),
        `${target.targetId} label "${target.label}" is not an interactable world object`
      );
      const interaction = harthmereObjectInteractionForLabel({
        label: target.label,
      });
      assert.ok(interaction, `${target.targetId} resolves no interaction`);
      assert.ok(
        AUTHORITATIVE_RECEIPT_KINDS.has(interaction.kind),
        `${target.targetId} resolves to ${interaction.kind}, which issues no server receipt`
      );
    }
  });

  it("resolves every field target on the map by target id AND marker id", () => {
    for (const target of harthmereJobsBoardFieldTargets()) {
      for (const id of [target.targetId, target.mapMarkerId]) {
        const marker = harthmereJobsBoardQuestMarkerPositionForId(id);
        assert.ok(marker, `${id} has no jobs-board marker position`);
        const runtime = harthmereJobsBoardQuestMarkerRuntimePositionForId(id);
        assert.ok(runtime, `${id} has no runtime marker position`);
        assert.ok(
          runtime!.position.every((value) => Number.isFinite(value)),
          `${id} has a non-finite runtime position`
        );
        assert.deepEqual(
          runtime!.position,
          target.position,
          `${id} runtime marker drifted away from its physical prop`
        );
      }
      assert.ok(isHarthmereJobsBoardFieldTargetId(target.targetId));
      assert.ok(isHarthmereJobsBoardFieldTargetId(target.mapMarkerId));
    }
  });

  it("recovers the exact physical prop from a synthetic pin position without widening nearby targets", () => {
    const watchPost = harthmereJobsBoardFieldTargetForId("trade_route_watch")!;
    assert.deepEqual(
      harthmereJobsBoardFieldTargetsNearPosition(watchPost.position).map(
        (target) => target.targetId
      ),
      ["trade_route_watch"]
    );
    assert.deepEqual(
      harthmereJobsBoardFieldTargetsNearPosition(
        [
          watchPost.position[0] + 2,
          watchPost.position[1],
          watchPost.position[2],
        ],
        1.75
      ),
      []
    );
  });

  it("keeps each work station away from the outpost's own jobs board", () => {
    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const station = harthmereOutpostWorkStationForOutpost(outpost.outpostId);
      assert.ok(station, `${outpost.outpostId} has no work station`);
      assert.notEqual(station!.targetId, outpost.outpostId);
      assert.notEqual(station!.mapMarkerId, `${outpost.outpostId}_job_board`);
    }
  });

  it("matches every business template target to its declared prop", () => {
    for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
      const target = harthmereJobsBoardFieldTargetForId(template.targetId);
      assert.ok(target, `${template.templateId} has no field target`);
      assert.equal(target!.mapMarkerId, template.mapMarkerId);
      for (const req of template.requirements) {
        if (req.targetId) {
          assert.ok(
            harthmereJobsBoardFieldTargetForId(req.targetId),
            `${template.templateId} requirement target ${req.targetId} has no prop`
          );
        }
      }
    }
  });

  it("declares every physical repair target's required repair tool", () => {
    for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
      const target = harthmereJobsBoardFieldTargetForId(template.targetId);
      assert.ok(target, `${template.templateId} has no field target`);
      const interaction = harthmereObjectInteractionForLabel({
        label: target!.label,
      });
      if (interaction?.kind !== "repair") continue;
      assert.ok(
        template.requirements.some(
          (requirement) => requirement.requiredToolAction === "repair"
        ),
        `${template.templateId} uses a repair prompt without declaring the repair tool`
      );
      assert.match(
        template.description,
        /equip a repair tool/i,
        `${template.templateId} does not tell the player to equip the required tool`
      );
    }
  });

  it("gives every business template item requirement a real, guided source", () => {
    for (const template of HARTHMERE_JOBS_BOARD_BUSINESS_TEMPLATES) {
      for (const req of template.requirements) {
        if (!req.itemId) continue;
        assert.ok(
          isKnownHarthmereJobsBoardExecutableItemId(req.itemId),
          `${template.templateId}:${req.itemId} is not an executable job item`
        );
        const guidance = harthmereJobItemSourceGuidance({
          kind: template.kind,
          requirements: [req],
          inventoryItems: {},
        });
        assert.ok(
          guidance,
          `${template.templateId}:${req.itemId} produces no acquisition guidance`
        );
        // "unknown" is the generic "gathering, crafting, vendors, or loot"
        // non-answer: it means the item has no authored source.
        assert.notEqual(
          guidance!.sourceKind,
          "unknown",
          `${template.templateId}:${req.itemId} has no authored acquisition source`
        );
        if (guidance!.markerId) {
          assert.ok(
            harthmereJobsBoardQuestMarkerPositionForId(guidance!.markerId),
            `${template.templateId}:${
              req.itemId
            } points at unresolvable marker ${guidance!.markerId}`
          );
        }
      }
    }
  });

  it("gives every auto-seeded item job a locatable acquisition source", () => {
    for (const template of HARTHMERE_JOBS_BOARD_AUTO_SEED_TEMPLATES) {
      for (const req of template.requirements) {
        if (!req.itemId) continue;
        const guidance = harthmereJobItemSourceGuidance({
          kind: template.kind,
          requirements: [req],
          inventoryItems: {},
        });
        assert.ok(
          guidance,
          `${template.templateId}:${req.itemId} produces no acquisition guidance`
        );
        assert.notEqual(
          guidance!.sourceKind,
          "unknown",
          `${template.templateId}:${req.itemId} fell back to generic copy`
        );
        if (guidance!.sourceKind !== "quest_grant") {
          assert.ok(
            guidance!.markerId || guidance!.markerPosition,
            `${template.templateId}:${req.itemId} has no map destination`
          );
        } else {
          assert.match(guidance!.hint, /check your backpack/i);
        }
        if (guidance!.markerId && !guidance!.markerPosition) {
          assert.ok(
            harthmereJobsBoardQuestMarkerPositionForId(guidance!.markerId),
            `${template.templateId}:${req.itemId} points at unresolvable ${guidance!.markerId}`
          );
        }
      }
    }
  });
});
