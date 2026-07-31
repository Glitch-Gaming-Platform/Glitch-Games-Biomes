import * as THREE from "three";

export const HARTHMERE_SCRATCH_BOSS_DAMAGE_POSE_VERSION =
  "harthmere-scratch-boss-damage-pose-v1";

export function applyHarthmereScratchBossDamagePose(
  root: THREE.Object3D,
  bossId: unknown,
  rawHealthRatio: number,
  routeChoice?: string
): boolean {
  const healthRatio = THREE.MathUtils.clamp(rawHealthRatio, 0, 1);
  if (bossId === "vyrahel_vein_keeper") {
    const mercyChosen = routeChoice === "mercy" || routeChoice === "yield";
    const phase = mercyChosen
      ? "yielding"
      : healthRatio <= 0.18
      ? "mercy_window"
      : healthRatio <= 0.55
      ? "desperate"
      : "guarded";
    const shieldSpread =
      phase === "guarded" ? 0.18 : phase === "desperate" ? 0.46 : 0.72;
    for (const [name, side] of [
      ["VeinShield.L", -1],
      ["VeinShield.R", 1],
    ] as const) {
      const shield = root.getObjectByName(name);
      if (shield) {
        shield.rotation.x = phase === "yielding" ? -0.42 : 0;
        shield.rotation.y = side * shieldSpread;
        shield.rotation.z = side * shieldSpread * 0.42;
        shield.scale.setScalar(phase === "yielding" ? 0.78 : 1);
      }
    }
    for (const [name, side] of [
      ["Wing.L", -1],
      ["Wing.R", 1],
    ] as const) {
      const wing = root.getObjectByName(name);
      if (wing) {
        wing.rotation.y =
          side *
          (phase === "desperate"
            ? 0.38
            : phase === "mercy_window"
            ? 0.62
            : phase === "yielding"
            ? 0.14
            : 0.08);
      }
    }
    root
      .getObjectByName("Emitter")
      ?.scale.setScalar(
        phase === "desperate" ? 1.18 : phase === "mercy_window" ? 1.42 : 1
      );
    root.userData.harthmereBossDamagePose = {
      version: HARTHMERE_SCRATCH_BOSS_DAMAGE_POSE_VERSION,
      phase,
      healthRatio,
    };
    return true;
  }

  if (bossId === "alpha_mucker") {
    const phase =
      healthRatio <= 0.32
        ? "heart_exposed"
        : healthRatio <= 0.66
        ? "crown_broken"
        : "bark_armored";
    const canopyScale =
      phase === "bark_armored" ? 1 : phase === "crown_broken" ? 0.78 : 0.52;
    for (const [name, side] of [
      ["Canopy.L", -1],
      ["Canopy.R", 1],
    ] as const) {
      const canopy = root.getObjectByName(name);
      if (canopy) {
        canopy.scale.setScalar(canopyScale);
        canopy.rotation.x = phase === "heart_exposed" ? 0.24 : 0;
        canopy.rotation.z =
          side *
          (phase === "crown_broken"
            ? 0.16
            : phase === "heart_exposed"
            ? 0.31
            : 0);
      }
    }
    for (const [name, side] of [
      ["Branch.L", -1],
      ["Branch.R", 1],
    ] as const) {
      const branch = root.getObjectByName(name);
      if (branch) {
        branch.rotation.x = phase === "heart_exposed" ? -0.18 : 0;
        branch.rotation.z =
          side *
          (phase === "bark_armored"
            ? 0
            : phase === "crown_broken"
            ? 0.1
            : 0.22);
      }
    }
    root
      .getObjectByName("Heart")
      ?.scale.setScalar(
        phase === "bark_armored" ? 0.72 : phase === "crown_broken" ? 1.08 : 1.48
      );
    root
      .getObjectByName("Face")
      ?.scale.setScalar(phase === "heart_exposed" ? 1.08 : 1);
    root.userData.harthmereBossDamagePose = {
      version: HARTHMERE_SCRATCH_BOSS_DAMAGE_POSE_VERSION,
      phase,
      healthRatio,
    };
    return true;
  }

  if (bossId === "echo_singer") {
    const phase =
      healthRatio <= 0.3
        ? "resonance_overload"
        : healthRatio <= 0.64
        ? "fractured_copy"
        : "listening";
    const maskScales =
      phase === "listening"
        ? [1, 1, 1]
        : phase === "fractured_copy"
        ? [1.08, 0.72, 0.9]
        : [1.18, 0.38, 0.62];
    for (const [index, name] of [
      "Mask.Front",
      "Mask.Left",
      "Mask.Right",
    ].entries()) {
      const mask = root.getObjectByName(name);
      if (mask) {
        mask.scale.setScalar(maskScales[index]);
        mask.rotation.x = phase === "resonance_overload" ? 0.16 * index : 0;
        mask.rotation.z =
          phase === "listening"
            ? 0
            : (index - 1) * (phase === "fractured_copy" ? 0.18 : 0.34);
      }
    }
    for (const [name, side] of [
      ["Echo.A", -1],
      ["Echo.B", 1],
    ] as const) {
      const echo = root.getObjectByName(name);
      if (echo) {
        echo.scale.setScalar(
          phase === "listening" ? 0.62 : phase === "fractured_copy" ? 0.9 : 1.18
        );
        echo.rotation.y = side * (phase === "resonance_overload" ? 0.48 : 0.16);
      }
    }
    root
      .getObjectByName("TimeRing")
      ?.scale.setScalar(
        phase === "listening" ? 0.9 : phase === "fractured_copy" ? 1.16 : 1.46
      );
    root
      .getObjectByName("Emitter")
      ?.scale.setScalar(phase === "resonance_overload" ? 1.48 : 1);
    root.userData.harthmereBossDamagePose = {
      version: HARTHMERE_SCRATCH_BOSS_DAMAGE_POSE_VERSION,
      phase,
      healthRatio,
    };
    return true;
  }

  if (bossId === "failed_apprentice") {
    const phase =
      healthRatio <= 0.3
        ? "binding_torn"
        : healthRatio <= 0.66
        ? "bell_cracked"
        : "bound";
    for (const [name, side] of [
      ["BellShell.L", -1],
      ["BellShell.R", 1],
    ] as const) {
      const shell = root.getObjectByName(name);
      if (shell) {
        const opening =
          phase === "bound" ? 0 : phase === "bell_cracked" ? 0.34 : 0.7;
        shell.rotation.x = phase === "binding_torn" ? -0.2 : 0;
        shell.rotation.y = side * opening;
        shell.rotation.z = side * opening * 0.44;
      }
    }
    root
      .getObjectByName("Chain.L")
      ?.scale.setScalar(phase === "binding_torn" ? 0.18 : 1);
    root
      .getObjectByName("Chain.R")
      ?.scale.setScalar(
        phase === "bound" ? 1 : phase === "bell_cracked" ? 0.45 : 0.14
      );
    root
      .getObjectByName("ShardHalo")
      ?.scale.setScalar(
        phase === "bound" ? 0.82 : phase === "bell_cracked" ? 1.12 : 1.46
      );
    root
      .getObjectByName("Emitter")
      ?.scale.setScalar(phase === "binding_torn" ? 1.42 : 1);
    root.userData.harthmereBossDamagePose = {
      version: HARTHMERE_SCRATCH_BOSS_DAMAGE_POSE_VERSION,
      phase,
      healthRatio,
    };
    return true;
  }

  return false;
}
