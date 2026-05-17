import { sub, yaw } from "@/shared/math/linear";
import type { ReadonlyVec3 } from "@/shared/math/types";
import { getNpcBehavior, getNpcRunSpeed, idToNpcType } from "@/shared/npc/bikkie";
import type { Environment } from "@/shared/npc/environment";
import type { SimulatedNpc } from "@/shared/npc/simulated";

export const HARTHMERE_NPC_FLEE_FROM_THREAT_VERSION_V37 =
  "harthmere-npc-flee-from-threat-v37";

const DEFAULT_THREAT_RADIUS = 12;

function livingNpcPosition(env: Environment, id: number): ReadonlyVec3 | undefined {
  const entity = env.resources.get("/ecs/entity", id as any);
  if (!entity?.npc_metadata || !entity.position || (entity.health?.hp ?? 1) <= 0) {
    return undefined;
  }
  const behavior = getNpcBehavior(idToNpcType(entity.npc_metadata.type_id));
  if (!behavior.chaseAttack) {
    return undefined;
  }
  return entity.position.v;
}

export function fleeFromThreatTick(
  env: Environment,
  npc: SimulatedNpc,
  radius = DEFAULT_THREAT_RADIUS
): { forwardSpeed: number; threatPosition: ReadonlyVec3 } | undefined {
  let nearest: ReadonlyVec3 | undefined;
  let nearestDistSq = Infinity;
  for (const id of env.ecsMetaIndex.npc_selector.scanSphere({
    center: npc.position,
    radius,
  })) {
    if (id === npc.id) {
      continue;
    }
    const pos = livingNpcPosition(env, id as number);
    if (!pos) {
      continue;
    }
    const dx = pos[0] - npc.position[0];
    const dz = pos[2] - npc.position[2];
    const d2 = dx * dx + dz * dz;
    if (d2 < nearestDistSq) {
      nearestDistSq = d2;
      nearest = pos;
    }
  }
  if (!nearest) {
    return undefined;
  }

  const away = sub(npc.position, nearest);
  const awayAngle = yaw(away);
  if (npc.state.rotateTarget !== awayAngle) {
    npc.mutableState().rotateTarget = awayAngle;
  }
  return {
    forwardSpeed: Math.max(getNpcRunSpeed(npc.type), getNpcRunSpeed(npc.type) * 1.15),
    threatPosition: nearest,
  };
}
