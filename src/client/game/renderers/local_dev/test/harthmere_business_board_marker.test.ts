/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

import {
  HARTHMERE_BUSINESS_BOARD_INTERACTION_RADIUS,
  HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS,
  HARTHMERE_BUSINESS_BOARD_PROCEDURAL_POLISH_VERSION,
  HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION,
  createHarthmereBusinessBoardMarkerMesh,
  makeHarthmereBusinessBoardMarkerRenderer,
  nearestHarthmereBusinessBoardPhysicalPrompt,
} from "@/client/game/renderers/local_dev/harthmere_business_board_marker";
import { createNewScenes } from "@/client/game/renderers/scenes";
import {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
} from "@/shared/harthmere/business_customer_simulator";
import * as THREE from "three";

describe("Harthmere business board procedural markers current", () => {
  it("creates one visible procedural business-board marker for every production business outpost", () => {
    assert.equal(
      HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS.length,
      HARTHMERE_BUSINESS_OUTPOSTS.length,
    );
    assert.equal(HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS.length, 19);

    for (const outpost of HARTHMERE_BUSINESS_OUTPOSTS) {
      const location = HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS.find(
        (candidate) => candidate.outpostId === outpost.outpostId,
      );
      assert.ok(location, `${outpost.outpostId} should have a procedural business board`);
      const dashboard =
        HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId]
          .dashboardAccessPoint.position;
      assert.equal(location?.x, dashboard.x, `${outpost.outpostId} board x`);
      assert.equal(location?.y, dashboard.y, `${outpost.outpostId} board y`);
      assert.equal(location?.z, dashboard.z, `${outpost.outpostId} board z`);
      assert.equal(
        location?.businessId,
        `business_${outpost.outpostId}`,
        `${outpost.outpostId} board should carry the exact business id it opens`,
      );
      assert.equal(
        location?.yaw,
        outpost.position.rot,
        `${outpost.outpostId} board should face the same direction as the business fixture`,
      );
    }
  });

  it("draws the Greenlamp clinic board at the exact dashboard access point", () => {
    const location = HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.outpostId === "outpost_clinic_greenlamp",
    );
    assert.ok(location, "Greenlamp clinic board location must exist");
    assert.equal(location?.label, "Greenlamp Walk-In Clinic Business Board");
    assert.equal(location?.x, 652);
    assert.equal(location?.y, 65);
    assert.equal(location?.z, -179);

    const mesh = createHarthmereBusinessBoardMarkerMesh(location!);
    assert.equal(mesh.position.x, 652);
    assert.equal(mesh.position.y, 65);
    assert.equal(mesh.position.z, -179);
    assert.equal(mesh.rotation.y, location?.yaw);
    assert.equal(
      mesh.userData.harthmereBusinessBoardMarkerVersion,
      HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION,
    );
  });

  it("uses a compact visible service-list board instead of the giant jobs-board graphic", () => {
    const location = HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS[0];
    const mesh = createHarthmereBusinessBoardMarkerMesh(location);
    const bounds = new THREE.Box3().setFromObject(mesh);
    const size = new THREE.Vector3();
    bounds.getSize(size);
    assert.ok(size.x >= 3.5 && size.x <= 4.5, `business board width should be compact, got ${size.x}`);
    assert.ok(size.y >= 3 && size.y <= 3.6, `business board height should be compact, got ${size.y}`);
    assert.ok(size.z >= 1 && size.z <= 1.9, `business board depth should be compact, got ${size.z}`);

    let meshCount = 0;
    const partCounts = new Map<string, number>();
    mesh.traverse((child) => {
      const part = child.userData.harthmereBusinessBoardPart;
      if (typeof part === "string") {
        partCounts.set(part, (partCounts.get(part) ?? 0) + 1);
      }
      if (!(child instanceof THREE.Mesh)) return;
      meshCount += 1;
      assert.equal(
        child.material instanceof THREE.MeshBasicMaterial,
        true,
        `${child.name} should use an unlit material so business boards remain visible indoors`,
      );
      assert.equal(child.frustumCulled, false, `${child.name} should not be frustum culled near the player`);
      assert.equal(
        child.userData.harthmereBusinessBoardPolishVersion,
        HARTHMERE_BUSINESS_BOARD_PROCEDURAL_POLISH_VERSION,
      );
    });
    assert.ok(meshCount >= 20, `business board should be made of many visible pieces, got ${meshCount}`);
    assert.equal(partCounts.get("service_row"), 5, "business board should show a readable list of services/jobs");
    assert.equal(partCounts.get("service_checkbox"), 5, "each listed service should have a checkbox/status marker");
    assert.equal(partCounts.get("status_chip"), 5, "each listed service should have a status/payout chip");
    assert.equal(partCounts.get("use_f_tile"), 1, "business board should visibly advertise the F interaction key");
  });

  it("uses the physical board itself to drive the F prompt radius", () => {
    const location = HARTHMERE_BUSINESS_BOARD_MARKER_LOCATIONS.find(
      (candidate) => candidate.outpostId === "outpost_clinic_greenlamp",
    );
    assert.ok(location, "Greenlamp clinic board location must exist");
    const prompt = nearestHarthmereBusinessBoardPhysicalPrompt({
      x: location!.x,
      y: location!.y,
      z: location!.z + HARTHMERE_BUSINESS_BOARD_INTERACTION_RADIUS - 0.25,
    });
    assert.ok(prompt, "standing at the visible board should show the F prompt");
    assert.equal(prompt?.displayName, "Greenlamp Walk-In Clinic Business Board");
    assert.equal(prompt?.businessId, "business_outpost_clinic_greenlamp");
    assert.equal(prompt?.position.x, location?.x);
    assert.equal(prompt?.position.y, location?.y);
    assert.equal(prompt?.position.z, location?.z);

    const tooFar = nearestHarthmereBusinessBoardPhysicalPrompt({
      x: location!.x,
      y: location!.y,
      z: location!.z + HARTHMERE_BUSINESS_BOARD_INTERACTION_RADIUS + 0.25,
    });
    assert.equal(tooFar, undefined);
  });

  it("reattaches the procedural business boards after scene recreation", () => {
    const renderer = makeHarthmereBusinessBoardMarkerRenderer();
    const firstScenes = createNewScenes();
    renderer.draw(firstScenes, 0.016);
    const firstRoot = firstScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION),
    );
    assert.ok(firstRoot, "business board root must attach to the first scene");

    const secondScenes = createNewScenes();
    renderer.draw(secondScenes, 0.016);
    const secondRoot = secondScenes.three.children.find((child) =>
      child.name.includes(HARTHMERE_BUSINESS_BOARD_PROCEDURAL_MARKER_VERSION),
    );
    assert.ok(secondRoot, "business board root must attach to a recreated scene");
    assert.equal(secondRoot, firstRoot);
    assert.equal(firstScenes.three.children.includes(firstRoot!), false);
  });

  it("registers the business-board renderer so runtime placement filters cannot remove it", () => {
    const renderersSource = fs.readFileSync(
      path.join(__dirname, "../../renderers.ts"),
      "utf8",
    );
    assert.ok(
      renderersSource.includes("makeHarthmereBusinessBoardMarkerRenderer"),
      "renderer list must include the dedicated business-board marker renderer",
    );

    const assetsSource = fs.readFileSync(
      path.join(__dirname, "../harthmere_assets.ts"),
      "utf8",
    );
    assert.equal(
      assetsSource.includes("BIG BUSINESS BOARD open menu shift terminal hard to miss"),
      false,
      "business-board access must not depend on filtered obj_kiosk runtime placements",
    );

    const hudSource = fs.readFileSync(
      path.join(
        __dirname,
        "../../../../components/challenges/HarthmereUnifiedHUD.tsx",
      ),
      "utf8",
    );
    assert.ok(
      hudSource.includes("nearestHarthmereBusinessBoardPhysicalPrompt"),
      "business boards must use a Jobs Board-style physical prompt helper",
    );
    assert.ok(
      hudSource.includes('data-harthmere-business-board-world-prompt="bottom"'),
      "business boards must render the same always-visible bottom F prompt pattern as the Jobs Board",
    );
    assert.ok(
      hudSource.includes("worldContext={businessWorldContext}"),
      "business board activation must pass the selected business into the interface container instead of rediscovering proximity",
    );
  });
});
