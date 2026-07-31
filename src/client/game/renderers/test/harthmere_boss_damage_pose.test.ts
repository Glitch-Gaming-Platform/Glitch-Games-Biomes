/// <reference types="mocha" />

import { applyHarthmereScratchBossDamagePose } from "@/client/game/renderers/harthmere_boss_damage_pose";
import assert from "assert";
import * as THREE from "three";

function bossRig(names: readonly string[]) {
  const root = new THREE.Group();
  for (const name of names) {
    const part = new THREE.Object3D();
    part.name = name;
    root.add(part);
  }
  return root;
}

describe("Harthmere scratch boss damage poses", () => {
  it("opens Vyrahel's shields for the mercy window and can reset them", () => {
    const root = bossRig([
      "VeinShield.L",
      "VeinShield.R",
      "Wing.L",
      "Wing.R",
      "Emitter",
    ]);
    assert.equal(
      applyHarthmereScratchBossDamagePose(root, "vyrahel_vein_keeper", 0.1),
      true
    );
    assert.equal(root.userData.harthmereBossDamagePose.phase, "mercy_window");
    assert.ok(root.getObjectByName("VeinShield.R")!.rotation.y > 0.7);
    assert.ok(root.getObjectByName("Emitter")!.scale.x > 1.4);

    applyHarthmereScratchBossDamagePose(root, "vyrahel_vein_keeper", 1);
    assert.equal(root.userData.harthmereBossDamagePose.phase, "guarded");
    assert.equal(root.getObjectByName("Emitter")!.scale.x, 1);
  });

  it("breaks Alpha Mucker's canopy and exposes the Muckheart", () => {
    const root = bossRig([
      "Canopy.L",
      "Canopy.R",
      "Branch.L",
      "Branch.R",
      "Heart",
      "Face",
    ]);
    applyHarthmereScratchBossDamagePose(root, "alpha_mucker", 0.2);
    assert.equal(root.userData.harthmereBossDamagePose.phase, "heart_exposed");
    assert.ok(root.getObjectByName("Canopy.L")!.scale.x < 0.6);
    assert.ok(root.getObjectByName("Heart")!.scale.x > 1.4);
  });

  it("fractures the Echo-Singer's copied masks into overload", () => {
    const root = bossRig([
      "Mask.Front",
      "Mask.Left",
      "Mask.Right",
      "Echo.A",
      "Echo.B",
      "TimeRing",
      "Emitter",
    ]);
    applyHarthmereScratchBossDamagePose(root, "echo_singer", 0.25);
    assert.equal(
      root.userData.harthmereBossDamagePose.phase,
      "resonance_overload"
    );
    assert.ok(root.getObjectByName("Mask.Left")!.scale.x < 0.4);
    assert.ok(root.getObjectByName("TimeRing")!.scale.x > 1.4);
  });

  it("tears the Failed Apprentice's bell binding and chains", () => {
    const root = bossRig([
      "BellShell.L",
      "BellShell.R",
      "Chain.L",
      "Chain.R",
      "ShardHalo",
      "Emitter",
    ]);
    applyHarthmereScratchBossDamagePose(root, "failed_apprentice", 0.2);
    assert.equal(root.userData.harthmereBossDamagePose.phase, "binding_torn");
    assert.ok(root.getObjectByName("BellShell.R")!.rotation.y > 0.65);
    assert.ok(root.getObjectByName("Chain.R")!.scale.x < 0.2);
    assert.ok(root.getObjectByName("ShardHalo")!.scale.x > 1.4);
  });
});
