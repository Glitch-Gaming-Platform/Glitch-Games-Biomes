/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_REQUEST_BOARD_FRONT_FLIP_YAW,
  HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS,
  HARTHMERE_REQUEST_BOARD_MARKER_VERSION,
  createHarthmereRequestBoardFallback,
} from "@/client/game/renderers/local_dev/harthmere_request_board_marker";
import {
  HARTHMERE_REQUEST_BOARD_GRAPHICS,
  HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY,
} from "@/shared/harthmere/world_interaction_graphics";
import { harthmereRequestBoardPhysicalPromptRecords } from "@/shared/harthmere/native_request_board_locations";
import * as THREE from "three";

describe("Harthmere request-board Blender markers", () => {
  it("renders all five physical boards with four category-specific graphics", () => {
    const prompts = harthmereRequestBoardPhysicalPromptRecords();
    assert.equal(prompts.length, 5);
    assert.equal(HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS.length, 5);
    assert.deepEqual(
      HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS.map((board) => board.id).sort(),
      prompts.map((board) => board.boardId).sort()
    );
    assert.deepEqual(Object.keys(HARTHMERE_REQUEST_BOARD_GRAPHICS).sort(), [
      "farming",
      "fishing",
      "industrial",
      "research",
    ]);
    assert.equal(
      HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS.filter(
        (board) => board.variant === "fishing"
      ).length,
      2
    );
  });

  it("ships two compressed texture-free LODs within browser budgets", () => {
    for (const [category, graphic] of Object.entries(
      HARTHMERE_REQUEST_BOARD_GRAPHICS
    )) {
      const bounds = graphic.bounds;
      assert.ok(bounds.max[0] - bounds.min[0] >= 6.0, `${category} width`);
      assert.ok(bounds.max[2] - bounds.min[2] >= 6.0, `${category} height`);
      for (const lod of ["lod0", "lod1"] as const) {
        const assetPath = path.join("public", graphic.assets[lod]);
        assert.equal(fs.existsSync(assetPath), true, `${assetPath} missing`);
        assert.equal(graphic.stats[lod].meshoptCompressed, true);
        assert.equal(graphic.stats[lod].textureCount, 0);
        assert.equal(graphic.stats[lod].imageCount, 0);
        assert.ok(
          graphic.stats[lod].primitiveCount <= 9,
          `${category} ${lod} has ${graphic.stats[lod].primitiveCount} primitives`
        );
        assert.ok(
          graphic.stats[lod].bytes < 65_000,
          `${category} ${lod} is ${graphic.stats[lod].bytes} bytes`
        );
      }
    }
    assert.deepEqual(HARTHMERE_REQUEST_BOARD_GRAPHIC_LOD_POLICY, {
      lod0MaxDistanceMeters: 22,
      lod1MaxDistanceMeters: 72,
      hiddenBeyondMeters: 110,
    });
  });

  it("keeps a large cheap fallback without runtime lights", () => {
    const fallback = createHarthmereRequestBoardFallback(
      HARTHMERE_REQUEST_BOARD_MARKER_LOCATIONS[0]
    );
    assert.equal(fallback.rotation.y, HARTHMERE_REQUEST_BOARD_FRONT_FLIP_YAW);
    const size = new THREE.Vector3();
    new THREE.Box3().setFromObject(fallback).getSize(size);
    assert.ok(size.x >= 6.4);
    assert.ok(size.y >= 6.2);
    let meshCount = 0;
    let lightCount = 0;
    fallback.traverse((child) => {
      if (child instanceof THREE.Mesh) meshCount += 1;
      if (child instanceof THREE.Light) lightCount += 1;
    });
    assert.ok(meshCount <= 9);
    assert.equal(lightCount, 0);
  });

  it("replaces only the legacy visual while F opens the native-authority request panel", () => {
    const rendererRegistry = fs.readFileSync(
      path.resolve("src/client/game/renderers/renderers.ts"),
      "utf8"
    );
    const placeables = fs.readFileSync(
      path.resolve("src/client/game/renderers/placeables.ts"),
      "utf8"
    );
    const npcs = fs.readFileSync(
      path.resolve("src/client/game/renderers/npcs.ts"),
      "utf8"
    );
    const interaction = fs.readFileSync(
      path.resolve(
        "src/client/components/harthmere_request_board/HarthmereRequestBoardWorldInteraction.tsx"
      ),
      "utf8"
    );
    const talkModal = fs.readFileSync(
      path.resolve("src/client/components/challenges/TalkDialogModal.tsx"),
      "utf8"
    );
    const camera = fs.readFileSync(
      path.resolve("src/client/game/scripts/camera.ts"),
      "utf8"
    );
    const talkScreen = fs.readFileSync(
      path.resolve("src/client/components/challenges/TalkToNPCScreen.tsx"),
      "utf8"
    );
    const requestPanel = fs.readFileSync(
      path.resolve(
        "src/client/components/harthmere_request_board/HarthmereRequestBoardLiveContainer.tsx"
      ),
      "utf8"
    );
    const mount = fs.readFileSync(
      path.resolve("src/client/components/biomes_ui/BiomesUIMount.tsx"),
      "utf8"
    );
    assert.ok(
      rendererRegistry.includes(
        "makeHarthmereRequestBoardMarkerRenderer(resources)"
      )
    );
    assert.ok(placeables.includes("isHarthmereRequestBoardEntityId"));
    assert.ok(npcs.includes("isHarthmereRequestBoardEntityId(rawEntity.id)"));
    assert.ok(interaction.includes('kind: "talk_to_npc"'));
    assert.ok(interaction.includes("player.talkingToNpcCameraDisabled = true"));
    assert.ok(talkModal.includes("isHarthmereRequestBoardEntityId(entityId)"));
    assert.ok(camera.includes("if (!npcPos || !entity || !size)"));
    assert.ok(talkScreen.includes("isHarthmereRequestBoardEntityId"));
    assert.ok(talkScreen.includes("HarthmereRequestBoardLiveContainer"));
    assert.ok(requestPanel.includes("nativeRequestBoardSnapshot"));
    assert.ok(requestPanel.includes("progressQuestAtEntity"));
    assert.ok(
      requestPanel.includes('data-testid="harthmere-request-board-panel"')
    );
    assert.ok(interaction.includes("WORLD_INTERACTION_PRIORITY.jobsBoard"));
    assert.ok(interaction.includes('keyCodes: ["KeyF", "KeyE"]'));
    assert.ok(
      interaction.includes('data-testid="harthmere-request-board-world-prompt"')
    );
    assert.ok(mount.includes("<HarthmereRequestBoardWorldInteraction"));
    assert.match(HARTHMERE_REQUEST_BOARD_MARKER_VERSION, /blender-lod/);
  });
});
