/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

describe("Harthmere jobs board kiosk placements V141", () => {
  it("keeps both jobs boards wired as large voxel kiosks with nearby wayfinding pieces", () => {
    const source = fs.readFileSync(
      path.join(__dirname, "../harthmere_assets.ts"),
      "utf8",
    );

    assert.ok(source.includes("createGroveJobsBoardKioskPlacementV141()"));
    assert.ok(source.includes("createHarthmereTownJobsBoardKioskPlacementV141()"));
    assert.ok(source.includes("\"Grove Jobs Board Monitor\""));
    assert.ok(source.includes("\"Grove Jobs Board Hut\""));
    assert.ok(source.includes("\"Harthmere Town Jobs Board\""));
    assert.ok(source.includes("\"obj_shop_simple\""));
    assert.ok(source.includes("\"obj_kiosk\""));
    assert.ok(source.includes("\"obj_sign_post\""));
    assert.ok(source.includes("\"obj_flag_large_blue\""));
    assert.ok(source.includes("\"scroll_1_fp\""));
    assert.ok(source.includes("\"obj_lamp_ground_small\""));
    assert.ok(source.includes("1.95"));
    assert.ok(source.includes("0.95"));
  });
});
