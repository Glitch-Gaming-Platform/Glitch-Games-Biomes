/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_GATHERING_AUTHORITY_NODES,
  resolveHarthmereGatheringAuthorityAttempt,
} from "@/shared/harthmere/gathering_node_authority";
import {
  HARTHMERE_GATHERING_NODE_GRAPHICS,
  HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY,
  HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS,
  harthmereGatheringNodeGrowInTransform,
  harthmereGatheringNodeGraphic,
  harthmereWorldInteractionGraphicLod,
  validateHarthmereWorldInteractionGraphicsManifest,
} from "@/shared/harthmere/world_interaction_graphics";

describe("Harthmere world-interaction Blender graphics", () => {
  it("provides one distinct optimized two-LOD graphic for all 29 authoritative nodes", () => {
    assert.deepEqual(validateHarthmereWorldInteractionGraphicsManifest(), []);
    assert.equal(HARTHMERE_GATHERING_AUTHORITY_NODES.length, 29);
    assert.equal(HARTHMERE_GATHERING_NODE_GRAPHICS.length, 29);
    assert.deepEqual(
      HARTHMERE_GATHERING_NODE_GRAPHICS.map((record) => record.nodeId).sort(),
      HARTHMERE_GATHERING_AUTHORITY_NODES.map((node) => node.id).sort()
    );
    assert.equal(
      new Set(
        HARTHMERE_GATHERING_NODE_GRAPHICS.map((record) => record.assets.lod0)
      ).size,
      29
    );
    for (const node of HARTHMERE_GATHERING_AUTHORITY_NODES) {
      const graphic = harthmereGatheringNodeGraphic(node.id);
      assert.ok(graphic, `${node.id} graphic missing`);
      assert.equal(graphic!.displayName, node.name);
      assert.equal(graphic!.profession, node.profession);
      for (const lod of ["lod0", "lod1"] as const) {
        assert.equal(graphic!.stats[lod].meshoptCompressed, true);
        assert.equal(graphic!.stats[lod].textureCount, 0);
        assert.equal(graphic!.stats[lod].imageCount, 0);
        assert.ok(graphic!.stats[lod].primitiveCount <= 7);
        assert.ok(graphic!.stats[lod].bytes < 35_000);
      }
    }
  });

  it("keeps distance LOD selection bounded for browser performance", () => {
    assert.deepEqual(HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY, {
      lod0MaxDistanceMeters: 18,
      lod1MaxDistanceMeters: 64,
      hiddenBeyondMeters: 96,
    });
    assert.equal(
      harthmereWorldInteractionGraphicLod(
        18,
        HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY
      ),
      "lod0"
    );
    assert.equal(
      harthmereWorldInteractionGraphicLod(
        18.01,
        HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY
      ),
      "lod1"
    );
    assert.equal(
      harthmereWorldInteractionGraphicLod(
        64.01,
        HARTHMERE_GATHERING_NODE_GRAPHIC_LOD_POLICY
      ),
      "hidden"
    );
  });

  it("uses one bounded presentation-only grow-in for every gathering group", () => {
    assert.equal(HARTHMERE_GATHERING_NODE_GROW_IN_SECONDS, 0.9);
    assert.deepEqual(harthmereGatheringNodeGrowInTransform(-1), {
      y: -0.46,
      scaleXZ: 0.72,
      scaleY: 0.08,
    });
    const middle = harthmereGatheringNodeGrowInTransform(0.5);
    assert.ok(middle.y > -0.46 && middle.y < 0);
    assert.ok(middle.scaleXZ > 0.72 && middle.scaleXZ < 1.04);
    assert.ok(middle.scaleY > 0.08 && middle.scaleY < 1);
    assert.deepEqual(harthmereGatheringNodeGrowInTransform(2), {
      y: 0,
      scaleXZ: 1,
      scaleY: 1,
    });
  });

  it("preserves authoritative tool and skill constraints for every graphic", () => {
    const nowMs = 1_900_000_000_000;
    for (const node of HARTHMERE_GATHERING_AUTHORITY_NODES) {
      const base = {
        nodeId: node.id,
        actorPosition: {
          x: node.position[0],
          y: node.position[1],
          z: node.position[2],
        },
        equippedItemIds: node.requiredTool ? [node.requiredTool] : [],
        professionLevel: node.requiredSkill,
        nowMs,
        randomSeed: `graphics-contract:${node.id}`,
      };
      assert.equal(
        resolveHarthmereGatheringAuthorityAttempt(base).ok,
        true,
        `${node.id} should accept its authored requirements`
      );
      if (node.requiredTool) {
        assert.deepEqual(
          resolveHarthmereGatheringAuthorityAttempt({
            ...base,
            equippedItemIds: [],
          }),
          {
            ok: false,
            reason: `required_tool_missing:${node.requiredTool}`,
          },
          `${node.id} must still reject a missing ${node.requiredTool}`
        );
      }
      assert.deepEqual(
        resolveHarthmereGatheringAuthorityAttempt({
          ...base,
          professionLevel: node.requiredSkill - 1,
        }),
        {
          ok: false,
          reason: `profession_level_too_low:${node.profession}:${node.requiredSkill}`,
        },
        `${node.id} must still enforce ${node.profession} ${node.requiredSkill}`
      );
    }
  });

  it("keeps the F prompt and server submission independent from presentation", () => {
    const interactionSource = fs.readFileSync(
      path.resolve(
        "src/client/components/challenges/HarthmereGatheringNodeWorldInteraction.tsx"
      ),
      "utf8"
    );
    const rendererSource = fs.readFileSync(
      path.resolve(
        "src/client/game/renderers/local_dev/harthmere_gathering_node_markers.ts"
      ),
      "utf8"
    );
    const liveAuthoritySource = fs.readFileSync(
      path.resolve(
        "src/client/components/challenges/harthmereGatheringLiveAuthority.ts"
      ),
      "utf8"
    );
    assert.ok(
      interactionSource.includes("submitHarthmereGatheringNode(prompt.id)")
    );
    assert.ok(
      interactionSource.includes('className="harthmere-jobs-prompt__key">F</')
    );
    assert.ok(interactionSource.includes("requirementLabel(prompt)"));
    assert.ok(rendererSource.includes("loadGltf"));
    assert.ok(rendererSource.includes("frustumCulled = true"));
    assert.ok(rendererSource.includes("GROW_IN_SECONDS"));
    assert.ok(rendererSource.includes("growInComplete"));
    assert.ok(
      rendererSource.includes("HARTHMERE_GATHERING_NODE_VISUAL_RESPAWN_EVENT")
    );
    assert.ok(liveAuthoritySource.includes("nativeEcsMaterializationPlans"));
    assert.ok(liveAuthoritySource.includes("expiresAtMs"));
    assert.equal(rendererSource.includes("PointLight"), false);
    assert.equal(rendererSource.includes("farming_plant_component"), false);
    assert.equal(rendererSource.includes("Gaia"), false);
  });
});
