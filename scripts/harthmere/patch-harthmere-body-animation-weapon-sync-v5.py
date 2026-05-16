#!/usr/bin/env python3
from __future__ import annotations
import re
import sys
from pathlib import Path

root = Path(sys.argv[1]).resolve()
player_path = root / "src/client/game/util/player_animations.ts"
hud_path = root / "src/client/components/challenges/HarthmereUnifiedHUD.tsx"
npcs_path = root / "src/client/game/resources/npcs.ts"

player = player_path.read_text(encoding="utf-8")
hud = hud_path.read_text(encoding="utf-8")
npcs = npcs_path.read_text(encoding="utf-8")

# -----------------------------------------------------------------------------
# Player body animation system: stabilize locomotion and make combat body poses
# upper-body authoritative while preserving lower-body locomotion.
# -----------------------------------------------------------------------------
if "HARTHMERE_BODY_ANIMATION_SYNC_VERSION_V5" not in player:
    marker = "const RUN_SPEED = 8;\n\n"
    insert = '''const RUN_SPEED = 8;\n\n// harthmere-body-animation-weapon-sync-v5\n// The weapon visual system now has deterministic timing. Body animation must\n// follow the same contract instead of fighting locomotion or restarting clips\n// from tiny velocity noise. These constants intentionally live next to the\n// player AnimationSystem because this is where weight/layer decisions happen.\nexport const HARTHMERE_BODY_ANIMATION_SYNC_VERSION_V5 = "harthmere-body-animation-weapon-sync-v5";\n\nexport const HARTHMERE_BODY_WEAPON_TIMING_PROFILES_V5 = {\n  basic: { windupMs: 150, impactMs: 220, recoveryMs: 340, bodyDurationS: 0.71 },\n  heavy: { windupMs: 260, impactMs: 360, recoveryMs: 520, bodyDurationS: 1.02 },\n  ranged: { windupMs: 180, impactMs: 300, recoveryMs: 420, bodyDurationS: 0.9 },\n  magic: { windupMs: 220, impactMs: 380, recoveryMs: 520, bodyDurationS: 1.12 },\n  block: { windupMs: 70, impactMs: 110, recoveryMs: 260, bodyDurationS: 0.44 },\n} as const;\n\nconst HARTHMERE_BODY_ATTACK_TIME_SCALE_V5 = {\n  attack1: 1.0,\n  attack2: 1.0,\n} as const;\n\nconst HARTHMERE_BODY_UPPER_BODY_RE = /(.*(arm|hand|tool|chest|spine|shoulder|clavicle|neck|head|finger|weapon).*)/i;\nconst HARTHMERE_BODY_LOCOMOTION_DEADZONE_SPEED = 0.08;\nconst HARTHMERE_BODY_MAX_BLEND_DT = 1 / 24;\n\n'''
    if marker not in player:
        raise SystemExit("Could not find RUN_SPEED marker in player_animations.ts")
    player = player.replace(marker, insert, 1)

player = player.replace(
    "const armsRe = /(.*(arm|hand|tool|chest).*)/i;",
    "const armsRe = HARTHMERE_BODY_UPPER_BODY_RE;",
    1,
)
player = re.sub(
    r"attack1:\s*\{\s*fileAnimationName:\s*\"Attack\"\s*\}",
    'attack1: { fileAnimationName: "Attack", timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE_V5.attack1 }',
    player,
    count=1,
)
player = re.sub(
    r"attack2:\s*\{\s*fileAnimationName:\s*\"HeavyAttack\",\s*backupFileAnimationNames:\s*\[\"Attack2\"\]\s*\}",
    'attack2: { fileAnimationName: "HeavyAttack", backupFileAnimationNames: ["Attack2"], timeScale: HARTHMERE_BODY_ATTACK_TIME_SCALE_V5.attack2 }',
    player,
    count=1,
)

if "function isHarthmereWeaponSyncedBodyEmoteV5" not in player:
    marker = "function getEmoteBasedWeights(\n"
    helper = '''function isHarthmereWeaponSyncedBodyEmoteV5(\n  emoteType: string,\n): emoteType is "attack1" | "attack2" {\n  return emoteType === "attack1" || emoteType === "attack2";\n}\n\nfunction getHarthmereWeaponSyncedEmoteWeightsV5(\n  player: Player,\n  toAnimationTime: ToAnimationTimeFunction,\n): PlayerAnimationAction | undefined {\n  if (!player.emoteInfo) {\n    return;\n  }\n\n  const { emoteStartTime, emoteType } = player.emoteInfo;\n  if (!isHarthmereWeaponSyncedBodyEmoteV5(emoteType)) {\n    return;\n  }\n\n  return {\n    weights: playerSystem.singleAnimationWeight(emoteType, 1),\n    state: {\n      repeat: { kind: "once" },\n      startTime: toAnimationTime("harthmereWeaponBody", emoteStartTime),\n      // The weapon trail/damage timing starts immediately. Keep the body\n      // action responsive, then let normal locomotion take the lower body.\n      easeInTime: 0.035,\n    },\n    layers: {\n      arms: "apply",\n      // This is the key anti-jitter behavior: weapon attacks own the upper\n      // body, while walking/running/jumping still own legs unless the player\n      // is idle. No more full-body attack pose fighting locomotion.\n      notArms: "ifIdle",\n    },\n  };\n}\n\nfunction getHarthmereStableAnimationVelocityV5(\n  velocity: Player["velocity"],\n): Player["velocity"] {\n  const horizontalSpeed = Math.hypot(velocity[0] ?? 0, velocity[2] ?? 0);\n  if (horizontalSpeed < HARTHMERE_BODY_LOCOMOTION_DEADZONE_SPEED) {\n    return [0, velocity[1] ?? 0, 0] as Player["velocity"];\n  }\n  return velocity;\n}\n\n'''
    if marker not in player:
        raise SystemExit("Could not find getEmoteBasedWeights marker")
    player = player.replace(marker, helper + marker, 1)

needle = '''  const { emoteStartTime, emoteType } = player.emoteInfo;\n'''
replacement = '''  const weaponSyncedWeights = getHarthmereWeaponSyncedEmoteWeightsV5(\n    player,\n    toAnimationTime,\n  );\n  if (weaponSyncedWeights) {\n    return weaponSyncedWeights;\n  }\n\n  const { emoteStartTime, emoteType } = player.emoteInfo;\n'''
if replacement not in player:
    if needle not in player:
        raise SystemExit("Could not find emote destructure marker")
    player = player.replace(needle, replacement, 1)

player = player.replace(
    "      velocity: player.velocity,",
    "      velocity: getHarthmereStableAnimationVelocityV5(player.velocity),",
    1,
)
apply_old = "  playerSystem.applyAccumulatedActionsToState(accum, animationState, dt);"
apply_new = '''  const animationBlendDt = Math.min(\n    Math.max(dt, 0),\n    HARTHMERE_BODY_MAX_BLEND_DT,\n  );\n  playerSystem.applyAccumulatedActionsToState(\n    accum,\n    animationState,\n    animationBlendDt,\n  );'''
if apply_new not in player:
    if apply_old not in player:
        raise SystemExit("Could not find animation apply marker")
    player = player.replace(apply_old, apply_new, 1)

# -----------------------------------------------------------------------------
# HUD bridge: derive body attack duration from weapon timing metadata.
# -----------------------------------------------------------------------------
if "HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE_V5" not in hud:
    marker = "function useHarthmereLocalPlayerAttackGestureBridge() {\n"
    helper = '''// harthmere-body-animation-weapon-sync-v5\ntype HarthmereBodyAnimationGestureDetailV5 = {\n  attack?: string;\n  at?: number;\n  windupMs?: number;\n  impactMs?: number;\n  recoveryMs?: number;\n  itemId?: string;\n};\n\nconst HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE_V5 = "harthmere-body-animation-gesture-bridge-v5";\n\nfunction harthmereBodyAttackTimingFromWeaponEventV5(\n  detail: HarthmereBodyAnimationGestureDetailV5 | undefined,\n  attack: "basic" | "heavy",\n) {\n  const defaults =\n    attack === "heavy"\n      ? { windupMs: 260, impactMs: 360, recoveryMs: 520 }\n      : { windupMs: 150, impactMs: 220, recoveryMs: 340 };\n  const windupMs = Math.max(0, detail?.windupMs ?? defaults.windupMs);\n  const impactMs = Math.max(windupMs, detail?.impactMs ?? defaults.impactMs);\n  const recoveryMs = Math.max(80, detail?.recoveryMs ?? defaults.recoveryMs);\n  return {\n    windupMs,\n    impactMs,\n    recoveryMs,\n    duration: Math.max(0.35, (impactMs + recoveryMs) / 1000),\n  };\n}\n\nfunction recordHarthmereBodyAnimationSyncDebugV5(\n  payload: Record<string, unknown>,\n) {\n  if (typeof window === "undefined") {\n    return;\n  }\n  const win = window as typeof window & {\n    __harthmereBodyAnimationSyncDebug?: unknown[];\n  };\n  win.__harthmereBodyAnimationSyncDebug = [\n    {\n      at: Date.now(),\n      bridge: HARTHMERE_BODY_ANIMATION_GESTURE_BRIDGE_V5,\n      upperBodyOnly: true,\n      lowerBodyLocomotionPreserved: true,\n      ...payload,\n    },\n    ...(win.__harthmereBodyAnimationSyncDebug ?? []),\n  ].slice(0, 100);\n}\n\n'''
    if marker not in hud:
        raise SystemExit("Could not find attack gesture bridge hook")
    hud = hud.replace(marker, helper + marker, 1)

hud = hud.replace(
    'const detail = (event as CustomEvent<{ attack?: string; at?: number }>).detail;',
    'const detail = (event as CustomEvent<HarthmereBodyAnimationGestureDetailV5>).detail;',
    1,
)
old_duration = '        const duration = attack === "heavy" ? 0.95 : 0.58;'
new_duration = '''        const bodyTiming = harthmereBodyAttackTimingFromWeaponEventV5(\n          detail,\n          attack,\n        );\n        const duration = bodyTiming.duration;'''
if old_duration in hud:
    hud = hud.replace(old_duration, new_duration, 1)
elif "const bodyTiming = harthmereBodyAttackTimingFromWeaponEventV5" not in hud:
    raise SystemExit("Could not patch HUD body attack duration")

after_emote_old = "        localPlayer.player.eagerEmote(events, resources, emoteType);\n"
after_emote_new = '''        localPlayer.player.eagerEmote(events, resources, emoteType);\n        recordHarthmereBodyAnimationSyncDebugV5({\n          attack,\n          emoteType,\n          desiredFileAnimationName,\n          duration,\n          bodyStartClock: clock.time,\n          weaponEventAt: detail?.at,\n          windupMs: bodyTiming.windupMs,\n          impactMs: bodyTiming.impactMs,\n          recoveryMs: bodyTiming.recoveryMs,\n          selectedItemId: selectedItem?.id,\n          source: "weapon_timing_synced_body_animation",\n        });\n'''
if after_emote_new not in hud:
    if after_emote_old not in hud:
        raise SystemExit("Could not find eagerEmote marker")
    hud = hud.replace(after_emote_old, after_emote_new, 1)

hud = hud.replace(
    '            duration,\n            selectedItemId: selectedItem?.id,',
    '            duration,\n            windupMs: bodyTiming.windupMs,\n            impactMs: bodyTiming.impactMs,\n            recoveryMs: bodyTiming.recoveryMs,\n            selectedItemId: selectedItem?.id,',
    1,
)

# -----------------------------------------------------------------------------
# NPC body animation: stabilize NPC locomotion noise and cap blend deltas so NPC
# body attacks align better with newly visible equipped weapon visuals.
# -----------------------------------------------------------------------------
if "HARTHMERE_NPC_BODY_ANIMATION_SYNC_VERSION_V5" not in npcs:
    marker = 'export const HARTHMERE_NPC_WALK_RUN_ANIMATION_VERSION =\n  "harthmere-npc-walk-run-animation-v19";\n'
    insert = marker + '''\n// harthmere-body-animation-weapon-sync-v5\nexport const HARTHMERE_NPC_BODY_ANIMATION_SYNC_VERSION_V5 =\n  "harthmere-npc-body-animation-weapon-sync-v5";\nconst HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED_V5 = 0.06;\nconst HARTHMERE_NPC_BODY_MAX_BLEND_DT_V5 = 1 / 24;\nconst HARTHMERE_NPC_BODY_ATTACK_TIME_SCALE_V5 = 1.0;\n'''
    if marker in npcs:
        npcs = npcs.replace(marker, insert, 1)
    else:
        npcs = npcs.replace(
            "export const npcSystem = new AnimationSystem(",
            '''// harthmere-body-animation-weapon-sync-v5\nexport const HARTHMERE_NPC_BODY_ANIMATION_SYNC_VERSION_V5 =\n  "harthmere-npc-body-animation-weapon-sync-v5";\nconst HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED_V5 = 0.06;\nconst HARTHMERE_NPC_BODY_MAX_BLEND_DT_V5 = 1 / 24;\nconst HARTHMERE_NPC_BODY_ATTACK_TIME_SCALE_V5 = 1.0;\n\nexport const npcSystem = new AnimationSystem(''',
            1,
        )

npcs = npcs.replace(
    '    attack: { fileAnimationName: "Attack" },',
    '    attack: { fileAnimationName: "Attack", timeScale: HARTHMERE_NPC_BODY_ATTACK_TIME_SCALE_V5 },',
    1,
)
if "function getHarthmereStableNpcAnimationVelocityV5" not in npcs:
    marker = "function getAttackAnimationAction(\n"
    helper = '''function getHarthmereStableNpcAnimationVelocityV5(\n  velocity: ReadonlyVec3,\n): ReadonlyVec3 {\n  const horizontalSpeed = Math.hypot(velocity[0] ?? 0, velocity[2] ?? 0);\n  if (horizontalSpeed < HARTHMERE_NPC_BODY_LOCOMOTION_DEADZONE_SPEED_V5) {\n    return [0, velocity[1] ?? 0, 0];\n  }\n  return velocity;\n}\n\n'''
    if marker not in npcs:
        raise SystemExit("Could not find NPC attack animation helper marker")
    npcs = npcs.replace(marker, helper + marker, 1)

npcs = npcs.replace(
    "        velocity: velocity,",
    "        velocity: getHarthmereStableNpcAnimationVelocityV5(velocity),",
    1,
)
npc_apply_old = '''    this.mixedMesh.animationSystem.applyAccumulatedActionsToState(\n      animAccum,\n      this.mixedMesh.animationSystemState,\n      dt\n    );'''
npc_apply_new = '''    const npcAnimationBlendDt = Math.min(\n      Math.max(dt, 0),\n      HARTHMERE_NPC_BODY_MAX_BLEND_DT_V5,\n    );\n    this.mixedMesh.animationSystem.applyAccumulatedActionsToState(\n      animAccum,\n      this.mixedMesh.animationSystemState,\n      npcAnimationBlendDt,\n    );'''
if npc_apply_new not in npcs:
    if npc_apply_old not in npcs:
        raise SystemExit("Could not find NPC animation apply marker")
    npcs = npcs.replace(npc_apply_old, npc_apply_new, 1)

player_path.write_text(player, encoding="utf-8")
hud_path.write_text(hud, encoding="utf-8")
npcs_path.write_text(npcs, encoding="utf-8")
print("PATCHED body animation weapon sync v5")
