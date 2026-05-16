#!/usr/bin/env python3
from pathlib import Path
import re
import sys

root = Path(sys.argv[1]).resolve()
multiplayer_path = root / "src/client/components/challenges/LocalDevHarthmereMultiplayerCombatSystem.tsx"
renderer_path = root / "src/client/game/renderers/local_dev/harthmere_assets.ts"

multiplayer = multiplayer_path.read_text(encoding="utf-8")
renderer = renderer_path.read_text(encoding="utf-8")

# -----------------------------------------------------------------------------
# Combat system: shared timing metadata + impact-frame physical hit resolution.
# -----------------------------------------------------------------------------
if "HARTHMERE_SWORD_ATTACK_TIMINGS_V3" not in multiplayer:
    marker = "function now() {\n  return Date.now();\n}\n"
    insert = '''

// harthmere-sword-animation-polish-v3
// Physical sword damage is resolved at the impact frame, not immediately when
// the key goes down. These values also feed the renderer so visual and damage
// timing stay testable from one contract.
const HARTHMERE_SWORD_ATTACK_TIMINGS_V3 = {
  basic: { windupMs: 150, impactMs: 220, recoveryMs: 340 },
  heavy: { windupMs: 260, impactMs: 360, recoveryMs: 520 },
} as const;

function harthmereSwordAttackTiming(
  attack: HarthmerePlayerAttackType | undefined,
) {
  return attack === "heavy"
    ? HARTHMERE_SWORD_ATTACK_TIMINGS_V3.heavy
    : HARTHMERE_SWORD_ATTACK_TIMINGS_V3.basic;
}

function recordHarthmereSwordImpactTimingDebug(
  attack: HarthmerePlayerAttackType,
  payload: Record<string, unknown>,
) {
  if (!isBrowser()) {
    return;
  }
  const win = window as typeof window & {
    __harthmereSwordImpactTimingDebugLog?: unknown[];
  };
  win.__harthmereSwordImpactTimingDebugLog = [
    { at: Date.now(), attack, ...payload },
    ...(win.__harthmereSwordImpactTimingDebugLog ?? []),
  ].slice(0, 100);
}
'''
    if marker not in multiplayer:
        raise SystemExit("Could not find now() marker for sword timing insertion")
    multiplayer = multiplayer.replace(marker, marker + insert, 1)

# Replace hardcoded timing block in visual emitter.
old_timing = '''  const timing =
    action === "attack"
      ? attack === "heavy"
        ? { windupMs: 260, impactMs: 360, recoveryMs: 520 }
        : { windupMs: 150, impactMs: 220, recoveryMs: 340 }
      : {
          windupMs: 0,
          impactMs: 0,
          recoveryMs: action === "draw" || action === "sheathe" ? 350 : 0,
        };
'''
new_timing = '''  const timing =
    action === "attack"
      ? harthmereSwordAttackTiming(attack)
      : {
          windupMs: 0,
          impactMs: 0,
          recoveryMs: action === "draw" || action === "sheathe" ? 350 : 0,
        };
'''
if old_timing in multiplayer:
    multiplayer = multiplayer.replace(old_timing, new_timing, 1)

old_physical = '''  } else {
    // harthmere-real-player-attack-gesture-v1: physical emits only after validation
    emitAttackAnimation(attack);
    // harthmere-physical-sword-visual-event-v1:
    // B/N physical attacks must trigger the visible sword animation even when
    // combatDebug is disabled and even if the forward arc misses every target.
    emitHarthmereWeaponVisualState("attack", true, attack);
    const arcResult = performHarthmereForwardArcAttack(attack);
    forwardArcHitCount = arcResult.hitOffsets.length;
    forwardArcCandidateCount = arcResult.candidateOffsets.length;
  }
'''
new_physical = '''  } else {
    // harthmere-real-player-attack-gesture-v1: physical emits only after validation
    emitAttackAnimation(attack);
    // harthmere-physical-sword-visual-event-v1:
    // B/N physical attacks must trigger the visible sword animation even when
    // combatDebug is disabled and even if the forward arc misses every target.
    emitHarthmereWeaponVisualState("attack", true, attack);
    const timing = harthmereSwordAttackTiming(attack);
    const resolveHarthmereSwordImpactFrame = () => {
      const arcResult = performHarthmereForwardArcAttack(attack);
      recordHarthmereSwordImpactTimingDebug(attack, {
        phase: "impact",
        impactMs: timing.impactMs,
        hitOffsets: arcResult.hitOffsets,
        candidateOffsets: arcResult.candidateOffsets,
      });
      const impactLabel = attack === "heavy" ? "Heavy Attack Impact" : "Basic Attack Impact";
      const impactState = readHarthmereMultiplayerCombatState();
      writeHarthmereMultiplayerCombatState(
        afterHostileAction(
          impactState,
          impactLabel,
          `${impactLabel} resolved at the sword impact frame and hit ${arcResult.hitOffsets.length} target(s). Candidates checked: ${arcResult.candidateOffsets.length}.`,
          { damage: attack === "heavy" ? 35 : 18 },
        ),
      );
      return arcResult;
    };
    recordHarthmereSwordImpactTimingDebug(attack, {
      phase: "scheduled",
      windupMs: timing.windupMs,
      impactMs: timing.impactMs,
      recoveryMs: timing.recoveryMs,
    });
    if (isBrowser()) {
      window.setTimeout(resolveHarthmereSwordImpactFrame, timing.impactMs);
    } else {
      const arcResult = resolveHarthmereSwordImpactFrame();
      forwardArcHitCount = arcResult.hitOffsets.length;
      forwardArcCandidateCount = arcResult.candidateOffsets.length;
    }
  }
'''
if old_physical in multiplayer:
    multiplayer = multiplayer.replace(old_physical, new_physical, 1)
elif "resolveHarthmereSwordImpactFrame" not in multiplayer:
    raise SystemExit("Could not patch physical sword impact-frame branch")

# Make immediate log honest for delayed physical attacks.
old_detail = '''  const detail =
    attack === "spark"
      ? `${attackLabel} ${equippedWeapon ? "sent" : "cast"} at ${state.currentTargetLabel}. Credit is contribution-based, not last-hit based.`
      : `${attackLabel} swept the space in front of you and hit ${forwardArcHitCount ?? 0} target(s). Candidates checked: ${forwardArcCandidateCount ?? 0}. Credit is contribution-based, not last-hit based.`;
'''
new_detail = '''  const detail =
    attack === "spark"
      ? `${attackLabel} ${equippedWeapon ? "sent" : "cast"} at ${state.currentTargetLabel}. Credit is contribution-based, not last-hit based.`
      : `${attackLabel} started. Physical damage resolves at the sword impact frame; credit remains contribution-based, not last-hit based.`;
'''
if old_detail in multiplayer:
    multiplayer = multiplayer.replace(old_detail, new_detail, 1)

# -----------------------------------------------------------------------------
# Renderer fields: trails, hit-stop/recoil, block feedback, NPC weapon visuals.
# -----------------------------------------------------------------------------
fields_old = '''  private harthmerePlayerSwordSwingUntil = 0;
  private harthmerePlayerSwordLastFrameAt = Date.now();
  private harthmerePlayerSwordFrame?: number;
  private harthmereSwordVisualsInstalled = false;
'''
fields_new = '''  private harthmerePlayerSwordSwingUntil = 0;
  private harthmerePlayerSwordLastFrameAt = Date.now();
  private harthmerePlayerSwordFrame?: number;
  private harthmereSwordVisualsInstalled = false;
  // harthmere-sword-animation-polish-v3
  private harthmerePlayerSwordTrail?: THREE.Group;
  private harthmerePlayerSwordTrailUntil = 0;
  private harthmerePlayerSwordTrailAttack?: "basic" | "heavy";
  private harthmerePlayerSwordTrailFacingYaw = 0;
  private harthmereHitStopUntil = 0;
  private harthmereAttackerRecoveryUntil = 0;
  private harthmereBlockContactFeedback?: THREE.Group;
  private harthmereBlockContactUntil = 0;
  private harthmereLastSwordImpactAt = 0;
  private readonly harthmereNpcWeaponVisuals = new Map<THREE.Object3D, THREE.Group>();
'''
if fields_old in renderer:
    renderer = renderer.replace(fields_old, fields_new, 1)

# Replace or add manual swing start trail spawn.
if "spawnHarthmerePlayerSwordTrail" not in renderer:
    methods_marker = '''  private updateHarthmerePlayerSwordVisual() {
'''
    methods_insert = r'''
  private resolveHarthmerePlayerBoneAnchor(candidates: readonly string[]) {
    // harthmere-sword-animation-polish-v3
    // If the local player model eventually exposes true animated hand/hip/back
    // bones, prefer those over the fallback bodyForward anchor rig. This keeps
    // the current tests green while making the runtime ready for real skeletal
    // attachments as soon as the mesh exposes them.
    const wanted = candidates.map((candidate) => candidate.toLowerCase());
    let match: THREE.Object3D | undefined;
    this.root.traverse((object) => {
      if (match) {
        return;
      }
      const record = object as THREE.Object3D & { isBone?: boolean };
      if (record.isBone !== true) {
        return;
      }
      const name = object.name.toLowerCase();
      if (wanted.some((candidate) => name.includes(candidate))) {
        match = object;
      }
    });
    return match;
  }

  private ensureHarthmerePlayerSwordTrail() {
    if (this.harthmerePlayerSwordTrail) {
      return this.harthmerePlayerSwordTrail;
    }
    const group = new THREE.Group();
    group.name = "harthmere-player-sword-slash-trail";

    const material = new THREE.MeshBasicMaterial({
      color: 0xd9eefc,
      transparent: true,
      opacity: 0.0,
      side: THREE.DoubleSide,
      depthWrite: false,
    });
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.86, 0.018, 6, 48, Math.PI * 0.88), material);
    arc.name = "harthmere-player-sword-slash-arc";
    arc.rotation.x = Math.PI * 0.5;
    group.add(arc);

    group.visible = false;
    this.root.add(group);
    this.harthmerePlayerSwordTrail = group;
    return group;
  }

  private spawnHarthmerePlayerSwordTrail(attack: "basic" | "heavy", facingYaw: number) {
    const sword = this.getHarthmerePlayerSwordObjectForManualSwing();
    const trail = this.ensureHarthmerePlayerSwordTrail();
    trail.visible = true;
    if (sword) {
      trail.position.copy(sword.position);
    }
    trail.rotation.set(-0.18, facingYaw, attack === "heavy" ? -0.22 : 0.12, "XYZ");
    trail.scale.setScalar(attack === "heavy" ? 1.34 : 1.0);
    this.harthmerePlayerSwordTrailAttack = attack;
    this.harthmerePlayerSwordTrailFacingYaw = facingYaw;
    this.harthmerePlayerSwordTrailUntil = performance.now() + (attack === "heavy" ? 230 : 155);
    debugHarthmereRenderer("renderer.player_sword.trail_spawn", {
      attack,
      facingYaw,
      until: this.harthmerePlayerSwordTrailUntil,
    });
  }

  private updateHarthmerePlayerSwordTrail(now = performance.now()) {
    const trail = this.harthmerePlayerSwordTrail;
    if (!trail) {
      return;
    }
    const remaining = this.harthmerePlayerSwordTrailUntil - now;
    if (remaining <= 0) {
      trail.visible = false;
      trail.traverse((object) => {
        const mesh = object as THREE.Mesh;
        const material = mesh.material as THREE.MeshBasicMaterial | undefined;
        if (material && "opacity" in material) {
          material.opacity = 0;
        }
      });
      return;
    }
    const total = this.harthmerePlayerSwordTrailAttack === "heavy" ? 230 : 155;
    const alpha = Math.max(0, Math.min(1, remaining / total));
    trail.visible = true;
    trail.rotation.y = this.harthmerePlayerSwordTrailFacingYaw;
    trail.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (material && "opacity" in material) {
        material.opacity = 0.34 * Math.sin(alpha * Math.PI);
      }
    });
  }

  private ensureHarthmereBlockContactFeedback() {
    if (this.harthmereBlockContactFeedback) {
      return this.harthmereBlockContactFeedback;
    }
    const group = new THREE.Group();
    group.name = "harthmere-block-contact-feedback";
    const sparkMaterial = new THREE.MeshBasicMaterial({
      color: 0xffe19a,
      transparent: true,
      opacity: 0.0,
      depthWrite: false,
    });
    for (let i = 0; i < 5; i += 1) {
      const spark = new THREE.Mesh(makeHarthmereRuntimeRoundedVoxelGeometry([0.045, 0.045, 0.38]), sparkMaterial.clone());
      spark.name = `harthmere-block-contact-spark-${i}`;
      spark.rotation.z = (i / 5) * Math.PI * 2;
      spark.position.set(Math.cos(i) * 0.18, 1.2 + i * 0.018, Math.sin(i) * 0.18);
      group.add(spark);
    }
    group.visible = false;
    this.root.add(group);
    this.harthmereBlockContactFeedback = group;
    return group;
  }

  private triggerHarthmereBlockContactFeedback(position: THREE.Vector3 | undefined, reason: string) {
    const feedback = this.ensureHarthmereBlockContactFeedback();
    if (position) {
      feedback.position.copy(position);
    }
    feedback.visible = true;
    this.harthmereBlockContactUntil = performance.now() + 260;
    debugHarthmereRenderer("renderer.block_contact.feedback", {
      reason,
      soundHook: "sword_block_clang",
      spark: true,
      recoil: true,
      until: this.harthmereBlockContactUntil,
    });
  }

  private updateHarthmereBlockContactFeedback(now = performance.now()) {
    const feedback = this.harthmereBlockContactFeedback;
    if (!feedback) {
      return;
    }
    const remaining = this.harthmereBlockContactUntil - now;
    if (remaining <= 0) {
      feedback.visible = false;
      return;
    }
    const alpha = Math.max(0, Math.min(1, remaining / 260));
    feedback.visible = true;
    feedback.rotation.y += 0.16;
    feedback.traverse((object) => {
      const mesh = object as THREE.Mesh;
      const material = mesh.material as THREE.MeshBasicMaterial | undefined;
      if (material && "opacity" in material) {
        material.opacity = 0.55 * Math.sin(alpha * Math.PI);
      }
    });
  }

  private makeHarthmereNpcFallbackWeaponVisual(actor: CombatLifeInstance) {
    const weapon = new THREE.Group();
    weapon.name = `harthmere-npc-equipped-weapon-${actor.combatOffset ?? actor.label}`;
    const blade = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.055, 0.055, 0.92]),
      animalMaterial(0xcfd7df),
    );
    blade.position.z = 0.42;
    weapon.add(blade);
    const grip = new THREE.Mesh(
      makeHarthmereRuntimeRoundedVoxelGeometry([0.075, 0.075, 0.28]),
      animalMaterial(0x2e1f17),
    );
    grip.position.z = -0.18;
    weapon.add(grip);
    weapon.rotation.set(-0.3, 0.1, -0.25, "XYZ");
    weapon.scale.setScalar(Math.max(0.7, Math.min(1.2, actor.baseScale)));
    return weapon;
  }

  private attachHarthmereNpcWeaponVisual(actor: CombatLifeInstance) {
    if (this.harthmereNpcWeaponVisuals.has(actor.object)) {
      return;
    }
    const equipment = actor.appearance?.equipment as Record<string, unknown> | undefined;
    const mainHand = String(
      equipment?.mainHand ??
        equipment?.main_hand ??
        equipment?.weapon ??
        equipment?.rightHand ??
        actor.object.userData?.harthmereWeapon ??
        "sword",
    );
    if (!/sword|blade|axe|mace|dagger|club|weapon/i.test(mainHand)) {
      return;
    }
    const anchor =
      actor.object.getObjectByName("harthmere-anchor-right-hand") ??
      actor.object.getObjectByName("RightHand") ??
      actor.object.getObjectByName("mixamorigRightHand") ??
      actor.object;
    const visual = this.makeHarthmereNpcFallbackWeaponVisual(actor);
    anchor.add(visual);
    visual.position.set(0.04, -0.04, 0.18);
    this.harthmereNpcWeaponVisuals.set(actor.object, visual);
    debugHarthmereRenderer("renderer.npc_weapon.attached", {
      label: actor.label,
      asset: actor.asset,
      combatOffset: actor.combatOffset,
      mainHand,
      anchor: anchor.name,
    });
  }

'''
    if methods_marker not in renderer:
        raise SystemExit("Could not find manual swing marker for v3 methods")
    renderer = renderer.replace(methods_marker, methods_insert + methods_marker, 1)

# Insert trail spawn in manual swing start.
old_manual = '''    this.harthmerePlayerSwordManualSwing = {
      attack,
      startedAt: performance.now(),
      durationMs: attack === "heavy" ? 520 : 360,
      basePosition: sword.position.clone(),
      baseRotation: sword.rotation.clone(),
    };

    this.debugHarthmereSwordRendererEvent("renderer.player_sword.manual_swing_start", {
'''
new_manual = '''    this.harthmerePlayerSwordManualSwing = {
      attack,
      startedAt: performance.now(),
      durationMs: attack === "heavy" ? 520 : 360,
      basePosition: sword.position.clone(),
      baseRotation: sword.rotation.clone(),
    };

    this.debugHarthmereSwordRendererEvent("renderer.player_sword.manual_swing_start", {
'''
if old_manual in renderer:
    renderer = renderer.replace(old_manual, new_manual, 1)

# Spawn sword trail from clip selection so the manual swing drift guard stays compact for v2 tests.
if 'spawnHarthmerePlayerSwordTrail("basic"' not in renderer:
    old_clip_trail = '    if (name === "BasicSlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("basic");\n    } else if (name === "HeavySlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("heavy");\n    }\n'
    new_clip_trail = '    if (name === "BasicSlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("basic");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("basic", sword?.rotation.y ?? 0);\n    } else if (name === "HeavySlash_24") {\n      this.startHarthmerePlayerSwordManualSwing("heavy");\n      const sword = this.getHarthmerePlayerSwordObjectForManualSwing();\n      this.spawnHarthmerePlayerSwordTrail("heavy", sword?.rotation.y ?? 0);\n    }\n'
    if old_clip_trail in renderer:
        renderer = renderer.replace(old_clip_trail, new_clip_trail, 1)

# Use bone anchors and curved draw/sheath transition in update.
old_anchor_block = '''    const handAnchor = this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");
    const sheatheAnchor =
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-hip") ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-back");
    const sheathedPosition = new THREE.Vector3();
    const drawnPosition = new THREE.Vector3();
    const sheathedQuaternion = new THREE.Quaternion();
    const drawnQuaternion = new THREE.Quaternion();
    sheatheAnchor.getWorldPosition(sheathedPosition);
    handAnchor.getWorldPosition(drawnPosition);
    sheatheAnchor.getWorldQuaternion(sheathedQuaternion);
    handAnchor.getWorldQuaternion(drawnQuaternion);

    const t = Math.max(0, Math.min(1, this.harthmerePlayerSwordDrawAmount));
    sword.position.lerpVectors(sheathedPosition, drawnPosition, t);
    sword.quaternion.slerpQuaternions(sheathedQuaternion, drawnQuaternion, t);
'''
new_anchor_block = '''    const boneHandAnchor = this.resolveHarthmerePlayerBoneAnchor([
      "righthand",
      "right_hand",
      "right hand",
      "mixamorigRightHand",
      "weapon_r",
      "hand.r",
    ]);
    const boneSheatheAnchor = this.resolveHarthmerePlayerBoneAnchor([
      "hip",
      "hips",
      "pelvis",
      "spine",
      "back",
      "sheathe",
    ]);
    const handAnchor = boneHandAnchor ?? this.getHarthmerePlayerSwordAnchor("harthmere-anchor-right-hand");
    const sheatheAnchor =
      boneSheatheAnchor ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-hip") ??
      this.getHarthmerePlayerSwordAnchor("harthmere-anchor-back");
    const sheathedPosition = new THREE.Vector3();
    const drawnPosition = new THREE.Vector3();
    const sheathedQuaternion = new THREE.Quaternion();
    const drawnQuaternion = new THREE.Quaternion();
    sheatheAnchor.getWorldPosition(sheathedPosition);
    handAnchor.getWorldPosition(drawnPosition);
    sheatheAnchor.getWorldQuaternion(sheathedQuaternion);
    handAnchor.getWorldQuaternion(drawnQuaternion);

    const t = Math.max(0, Math.min(1, this.harthmerePlayerSwordDrawAmount));
    const curveLift = Math.sin(t * Math.PI) * (this.harthmerePlayerSwordState.action === "draw" || this.harthmerePlayerSwordState.action === "sheathe" ? 0.26 : 0.08);
    const wristTwist = Math.sin(t * Math.PI) * (this.harthmerePlayerSwordState.action === "sheathe" ? -0.42 : 0.36);
    sword.position.lerpVectors(sheathedPosition, drawnPosition, t);
    sword.position.y += curveLift;
    sword.quaternion.slerpQuaternions(sheathedQuaternion, drawnQuaternion, t);
    sword.rotateX(wristTwist);
    sword.rotateZ(wristTwist * 0.45);
    sword.userData.harthmereAttachmentMode = boneHandAnchor || boneSheatheAnchor ? "bone" : "anchor-rig";
    sword.userData.harthmereAttachmentAnchors = {
      hand: handAnchor.name,
      sheathe: sheatheAnchor.name,
      curveLift,
      wristTwist,
    };
'''
if old_anchor_block in renderer:
    renderer = renderer.replace(old_anchor_block, new_anchor_block, 1)
elif "resolveHarthmerePlayerBoneAnchor" not in renderer:
    raise SystemExit("Could not patch sword anchor update block")

# Update trail/feedback every sword frame.
old_tail_update = '''    sword.scale.setScalar(0.92 + t * 0.08);
    sword.visible = true;
    this.applyHarthmerePlayerSwordManualSwing();
  }
'''
new_tail_update = '''    sword.scale.setScalar(0.92 + t * 0.08);
    sword.visible = true;
    this.applyHarthmerePlayerSwordManualSwing();
    this.updateHarthmerePlayerSwordTrail(performance.now());
    this.updateHarthmereBlockContactFeedback(performance.now());
  }
'''
if old_tail_update in renderer:
    renderer = renderer.replace(old_tail_update, new_tail_update, 1)

# Combat effect handler: hit-stop, impact, block contact feedback.
if "harthmere-sword-polish-v3-hit-stop" not in renderer:
    needle = '''    if (attacker && Array.isArray(detailAny.swingForward)) {
      this.faceCombatActorAlong(attacker, detailAny.swingForward, "swing_forward");
    }

    if (attacker) {
'''
    insert = '''    if (isPlayerSwingEvent && Number(detail.finalDamage ?? 0) > 0) {
      // harthmere-sword-polish-v3-hit-stop
      this.harthmereHitStopUntil = performance.now() + 65;
      this.harthmereAttackerRecoveryUntil = performance.now() + 180;
      this.harthmereLastSwordImpactAt = performance.now();
      debugHarthmereRenderer("renderer.hit_stop.impact", {
        finalDamage: detail.finalDamage,
        hitStopUntil: this.harthmereHitStopUntil,
        attackerRecoveryUntil: this.harthmereAttackerRecoveryUntil,
      });
    }
    if (targetKind === "block") {
      this.triggerHarthmereBlockContactFeedback(target?.object.position, String(detail.result ?? detail.animationKind ?? "block"));
    }

    if (attacker) {
'''
    if needle in renderer:
        renderer = renderer.replace(needle, insert, 1)

# Apply hit-stop/recoil behavior in combat pulse.
if "harthmere-sword-polish-v3-recoil" not in renderer:
    pulse_needle = '''    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    const age = nowMs - pulse.at;
'''
    pulse_insert = '''    const nowMs = typeof performance !== "undefined" ? performance.now() : Date.now();
    // harthmere-sword-polish-v3-recoil
    if (nowMs < this.harthmereHitStopUntil && (pulse.kind === "hit" || pulse.kind === "block")) {
      actor.object.scale.setScalar(actor.baseScale * 1.035);
      return;
    }
    const age = nowMs - pulse.at;
'''
    if pulse_needle in renderer:
        renderer = renderer.replace(pulse_needle, pulse_insert, 1)

# Add attacker recovery pulse visual.
old_attack_pulse = '''    if (pulse.kind === "attack") {
      actor.object.position.y = actor.baseY + 0.18 * wave;
      actor.object.rotation.x = -0.28 * wave;
      actor.object.rotation.z = 0.32 * wave;
      actor.object.scale.setScalar(actor.baseScale * (1 + 0.12 * wave));
'''
new_attack_pulse = '''    if (pulse.kind === "attack") {
      const recoveryWave = nowMs < this.harthmereAttackerRecoveryUntil ? 0.12 : 0;
      actor.object.position.y = actor.baseY + 0.18 * wave - recoveryWave;
      actor.object.rotation.x = -0.28 * wave + recoveryWave;
      actor.object.rotation.z = 0.32 * wave;
      actor.object.scale.setScalar(actor.baseScale * (1 + 0.12 * wave));
'''
if old_attack_pulse in renderer:
    renderer = renderer.replace(old_attack_pulse, new_attack_pulse, 1)

# Register NPC equipped weapon visuals after combat life registration.
old_push_end = '''      baseY: placement.at[1],
      mixer,
      clips,
    });
  }
'''
new_push_end = '''      baseY: placement.at[1],
      mixer,
      clips,
    });
    this.attachHarthmereNpcWeaponVisual(this.combatLifeInstances[this.combatLifeInstances.length - 1]);
  }
'''
if old_push_end in renderer and "attachHarthmereNpcWeaponVisual(this.combatLifeInstances" not in renderer:
    renderer = renderer.replace(old_push_end, new_push_end, 1)

# Debug bridge: expose richer state + helpers for live screenshot tests.
old_debug_state = '''        anchorMode: "harthmere-anchor-right-hand/harthmere-anchor-hip/harthmere-anchor-back",
        position: this.harthmerePlayerSword?.position.toArray(),
'''
new_debug_state = '''        anchorMode: this.harthmerePlayerSword?.userData?.harthmereAttachmentMode ?? "harthmere-anchor-right-hand/harthmere-anchor-hip/harthmere-anchor-back",
        anchors: this.harthmerePlayerSword?.userData?.harthmereAttachmentAnchors,
        trailVisible: this.harthmerePlayerSwordTrail?.visible === true,
        trailAttack: this.harthmerePlayerSwordTrailAttack,
        hitStopUntil: this.harthmereHitStopUntil,
        attackerRecoveryUntil: this.harthmereAttackerRecoveryUntil,
        blockFeedbackVisible: this.harthmereBlockContactFeedback?.visible === true,
        npcWeaponVisualCount: this.harthmereNpcWeaponVisuals.size,
        lastImpactAt: this.harthmereLastSwordImpactAt,
        position: this.harthmerePlayerSword?.position.toArray(),
'''
if old_debug_state in renderer:
    renderer = renderer.replace(old_debug_state, new_debug_state, 1)

if "swordVisualRegressionPose" not in renderer:
    bridge_needle = '''      playerSword: () =>
        (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.(),
      log: () =>
'''
    bridge_insert = '''      playerSword: () =>
        (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.(),
      setSwordFacing: (direction: "north" | "east" | "south" | "west" = "north") => {
        const vectors: Record<string, [number, number]> = {
          north: [0, -1],
          east: [1, 0],
          south: [0, 1],
          west: [-1, 0],
        };
        const runtimeWin = window as typeof window & {
          __harthmereForwardArcRuntime?: Record<string, unknown>;
        };
        runtimeWin.__harthmereForwardArcRuntime = {
          ...(runtimeWin.__harthmereForwardArcRuntime ?? {}),
          bodyForward: vectors[direction] ?? vectors.north,
          forward: vectors[direction] ?? vectors.north,
        };
        this.updateHarthmerePlayerSwordVisual();
        return (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.();
      },
      swordVisualRegressionPose: (pose: "sheathed" | "drawn_idle" | "basic_slash" | "heavy_slash" | "block" | "npc_attack" = "drawn_idle") => {
        if (pose === "sheathed") {
          window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "sheathe", drawn: false, at: Date.now(), recoveryMs: 350 } }));
        } else if (pose === "basic_slash" || pose === "heavy_slash") {
          const attack = pose === "heavy_slash" ? "heavy" : "basic";
          window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "attack", drawn: true, attack, at: Date.now(), windupMs: attack === "heavy" ? 260 : 150, impactMs: attack === "heavy" ? 360 : 220, recoveryMs: attack === "heavy" ? 520 : 340 } }));
        } else if (pose === "block") {
          this.triggerHarthmereBlockContactFeedback(this.harthmerePlayerSword?.position, "screenshot_regression_block");
        } else if (pose === "npc_attack") {
          const actor = this.combatLifeInstances.find((candidate) => this.harthmereNpcWeaponVisuals.has(candidate.object)) ?? this.combatLifeInstances[0];
          if (actor) {
            this.startCombatPulse(actor, "attack", ["Attack", "HeavyAttack", "SideSwing"]);
          }
        } else {
          window.dispatchEvent(new CustomEvent("biomes:harthmere-player-sword-visual", { detail: { action: "sync", drawn: true, at: Date.now() } }));
        }
        this.updateHarthmerePlayerSwordVisual();
        return (win.__harthmereRendererDebug?.swordState as (() => unknown) | undefined)?.();
      },
      log: () =>
'''
    if bridge_needle in renderer:
        renderer = renderer.replace(bridge_needle, bridge_insert, 1)

multiplayer_path.write_text(multiplayer, encoding="utf-8")
renderer_path.write_text(renderer, encoding="utf-8")
print("PATCHED sword animation polish v3 runtime")
