/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import fs from "fs";
import path from "path";

const read = (relativePath: string) =>
  fs.readFileSync(path.join(process.cwd(), relativePath), "utf8");

describe("Chapter 1 existing-system integration", () => {
  it("uses the stock talk state to hide HUD without enabling remote-speaker camera tracking", () => {
    const modal = read("src/client/components/challenges/TalkDialogModal.tsx");
    const chrome = read("src/client/components/BiomesChrome.tsx");
    const hotbar = read("src/client/components/inventory/HotBar.tsx");
    const camera = read("src/client/game/scripts/camera.ts");
    assert.match(modal, /localPlayer\.talkingToNpc = entityId/);
    assert.match(
      modal,
      /localPlayer\.talkingToNpcCameraDisabled = !focusCamera/
    );
    assert.match(chrome, /localPlayer\.talkingToNpc !== undefined/);
    assert.match(hotbar, /localPlayer\.talkingToNpc !== undefined/);
    assert.match(camera, /!localPlayer\.talkingToNpcCameraDisabled/);
  });

  it("keeps Chapter 1 objective and repair grants out of invisible overflow", () => {
    const handler = read(
      "src/server/logic/events/handlers/harthmere_inventory_transaction.ts"
    );
    assert.match(handler, /startsWith\("chapter1:objective:"\)/);
    assert.match(handler, /startsWith\("chapter1:inventory-reconcile:"\)/);
    assert.match(
      handler,
      /event\.gold_delta < 0n \|\| mustRemainInUsableInventory/
    );
    assert.match(handler, /player\.inventory\.giveOrThrow\(event\.give\)/);
  });

  it("uses high-contrast stock dialogue and choice surfaces", () => {
    const prompt = read(
      "src/client/components/challenges/Chapter1NativeObjectivePrompt.tsx"
    );
    const css = read("src/client/styles/hud.css");
    assert.match(prompt, /chapter1-story-dialogue/);
    assert.match(prompt, /chapter1-choice-dialog/);
    assert.match(css, /\.chapter1-story-dialogue[\s\S]*rgb\(7 13 27 \/ 97%\)/);
    assert.match(css, /\.chapter1-choice-dialog[\s\S]*rgb\(8 15 31 \/ 98%\)/);
    assert.match(css, /font-size: clamp\(18px, 1\.6vw, 24px\)/);
  });

  it("reconciles Chapter 1 content without colliding with NPC type ids", () => {
    const shim = read("src/server/shim/main.ts");
    assert.match(
      shim,
      /LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID = 8_810_000_000_029_001/
    );
    assert.match(
      shim,
      /LOCAL_DEV_NPC_COSMETIC_MARKER_ID = 8_810_000_000_029_002/
    );
    assert.doesNotMatch(
      shim,
      /LOCAL_DEV_RUNTIME_CONTENT_MARKER_ID = 8_810_000_000_020_001/
    );
    const branchStart = shim.indexOf("if (!shouldSeedLocalDevTerrain())");
    const branchEnd = shim.indexOf(
      "\n    return;\n  }\n\n  const firstExtensionTerrainId",
      branchStart
    );
    assert.ok(branchStart >= 0 && branchEnd > branchStart);
    const terrainDisabledBranch = shim.slice(branchStart, branchEnd);
    const additiveTownBlockEnd = terrainDisabledBranch.indexOf(
      "// Elsewhen is a detached, portal-only region"
    );
    assert.ok(additiveTownBlockEnd >= 0, "missing detached Elsewhen seed boundary");
    assert.ok(
      terrainDisabledBranch.indexOf(
        "seedMissingChapter1TerrainIntoExistingWorld(service, worldApi);"
      ) > additiveTownBlockEnd,
      "Elsewhen terrain repair must run after and outside the optional additive-town block"
    );
    assert.match(
      terrainDisabledBranch,
      /seedMissingChapter1TerrainIntoExistingWorld\(service, worldApi\);[\s\S]*reconcileLocalDevRuntimeContent\(service, worldApi\);[\s\S]*reconcileLocalDevPlayerLikeNpcCosmetics/
    );
  });
});
