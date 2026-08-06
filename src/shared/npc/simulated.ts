import { applyProposedChange } from "@/shared/ecs/change";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import type {
  Emote,
  Health,
  ReadonlyMovementState,
} from "@/shared/ecs/gen/components";
import {
  MovementState,
  NpcCombatState,
  NpcMetadata,
  NpcState,
  Orientation,
  Position,
  RigidBody,
  Size,
} from "@/shared/ecs/gen/components";
import type { Delta, DeltaWith } from "@/shared/ecs/gen/delta";
import { PatchableEntity } from "@/shared/ecs/gen/delta";
import type { AsDelta, Npc, ReadonlyEntity } from "@/shared/ecs/gen/entities";
import {
  UpdateNpcHealthEvent,
  UpdatePlayerHealthEvent,
  type AnyEvent,
} from "@/shared/ecs/gen/events";
import type { OptionalDamageSource } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { Vec2, Vec3 } from "@/shared/math/types";
import { getNpcBehavior, idToNpcType } from "@/shared/npc/bikkie";
import { killNpc } from "@/shared/npc/modify_health";
import { finiteNpcOrientation } from "@/shared/npc/motion_safety";
import type { DeserializedNpcState } from "@/shared/npc/serde";
import {
  deserializeNpcCustomState,
  serializeNpcCustomState,
} from "@/shared/npc/serde";
import { TickUpdates } from "@/shared/npc/updates";
import { removeFalsyInPlace } from "@/shared/util/object";
import type { DeepReadonly } from "@/shared/util/type_helpers";

type BusinessCustomerSnapshot = DeepReadonly<
  NonNullable<DeserializedNpcState["businessCustomer"]>
>;

function cloneBusinessCustomerVec3(value: DeepReadonly<Vec3>): Vec3 {
  return [value[0], value[1], value[2]];
}

function shouldPreserveLocalBusinessCustomerProgress(
  current: BusinessCustomerSnapshot | undefined,
  external: BusinessCustomerSnapshot | undefined
) {
  if (!current || !external || current.progressAtSeconds === undefined) {
    return false;
  }
  return (
    current.sessionId === external.sessionId &&
    current.ticketId === external.ticketId &&
    current.phase === external.phase &&
    (external.progressAtSeconds === undefined ||
      current.progressAtSeconds >= external.progressAtSeconds)
  );
}

export class SimulatedNpc {
  public type;
  private readonly events: AnyEvent[] = [];
  private patchableEntity: PatchableEntity;
  private deserializedNpcState: DeserializedNpcState | undefined;
  private npcStateMaybeModified = false;

  constructor(entity: Npc) {
    this.patchableEntity = new PatchableEntity(entity);
    this.type = idToNpcType(this.entity.npcMetadata().type_id);
  }

  updateFromExternal(external: ReadonlyEntity) {
    const currentEntity = this.patchableEntity.asReadonlyEntity();
    const currentState = this.state;
    const externalState = deserializeNpcCustomState(external.npc_state?.data);
    const preserveBusinessProgress =
      shouldPreserveLocalBusinessCustomerProgress(
        currentState.businessCustomer,
        externalState.businessCustomer
      );
    if (preserveBusinessProgress) {
      const currentBusiness = currentState.businessCustomer!;
      externalState.businessCustomer = {
        ...externalState.businessCustomer!,
        waypoints: currentBusiness.waypoints.map(cloneBusinessCustomerVec3),
        waypointIndex: currentBusiness.waypointIndex,
        pathfinding: currentBusiness.pathfinding
          ? {
              position: cloneBusinessCustomerVec3(
                currentBusiness.pathfinding.position
              ),
              searchTime: currentBusiness.pathfinding.searchTime,
              path: {
                nodes: currentBusiness.pathfinding.path.nodes.map((node) => ({
                  position: cloneBusinessCustomerVec3(node.position),
                })),
              },
            }
          : undefined,
        progressPosition: currentBusiness.progressPosition
          ? cloneBusinessCustomerVec3(currentBusiness.progressPosition)
          : undefined,
        progressAtSeconds: currentBusiness.progressAtSeconds,
      };
      externalState.rotateTarget = currentState.rotateTarget;
    }
    this.patchableEntity = new PatchableEntity(
      removeFalsyInPlace({
        ...currentEntity,
        health: external.health,
        npc_metadata: NpcMetadata.clone(external?.npc_metadata),
        position: preserveBusinessProgress
          ? Position.clone(currentEntity.position)
          : external.position
            ? Position.clone(external.position)
            : undefined,
        orientation: preserveBusinessProgress
          ? Orientation.clone(currentEntity.orientation)
          : external.orientation
            ? Orientation.clone(external.orientation)
            : undefined,
        rigid_body: preserveBusinessProgress
          ? RigidBody.clone(currentEntity.rigid_body)
          : external.rigid_body
            ? RigidBody.clone(external.rigid_body)
            : undefined,
        size: external.size ? Size.clone(external.size) : undefined,
        movement_state: external.movement_state
          ? MovementState.clone(external.movement_state)
          : undefined,
        npc_combat_state: external.npc_combat_state
          ? NpcCombatState.clone(external.npc_combat_state)
          : undefined,
        npc_state: preserveBusinessProgress
          ? NpcState.create({ data: serializeNpcCustomState(externalState) })
          : external.npc_state
            ? NpcState.clone(external.npc_state)
            : undefined,
      }) as Npc
    );
    // A live HybridWorld create can be observed first through a partial view
    // and completed by the next regular-ECS update. Refresh the type alongside
    // the authoritative metadata so a newly spawned NPC cannot remain cached
    // forever with fallback movement/turning values.
    this.type = idToNpcType(this.entity.npcMetadata().type_id);
    this.deserializedNpcState = undefined;
  }

  get id(): BiomesId {
    return this.patchableEntity.id;
  }

  private get entity(): DeltaWith<keyof Npc> {
    return this.patchableEntity as Delta as DeltaWith<keyof Npc>;
  }

  // Read-only state access.
  get lockedInPlace(): boolean {
    return Boolean(this.entity.lockedInPlace());
  }

  get questGiver(): boolean {
    return Boolean(
      getNpcBehavior(this.type).questGiver || this.entity.questGiver()
    );
  }

  get playerOwned(): boolean {
    return Boolean(this.patchableEntity.createdBy());
  }

  get health(): DeepReadonly<Health> {
    return this.entity.health();
  }

  get hp() {
    return this.health.hp;
  }

  get size(): DeepReadonly<Vec3> {
    return this.entity.size().v;
  }

  get position(): DeepReadonly<Vec3> {
    return this.entity.position().v;
  }

  get orientation(): DeepReadonly<Vec2> {
    return this.entity.orientation().v;
  }

  get velocity(): DeepReadonly<Vec3> {
    return this.entity.rigidBody().velocity;
  }

  get metadata(): DeepReadonly<NpcMetadata> {
    return this.entity.npcMetadata();
  }

  get movementState(): ReadonlyMovementState | undefined {
    return this.patchableEntity.movementState();
  }

  get label(): string {
    return this.entity.label().text;
  }

  get state(): DeepReadonly<DeserializedNpcState> {
    if (this.deserializedNpcState === undefined) {
      this.deserializedNpcState = deserializeNpcCustomState(
        this.entity.npcState()!.data
      );
    }
    return this.deserializedNpcState;
  }

  // Mutators.
  setEmote(emote: Emote) {
    this.entity.setEmote(emote);
  }

  setMovementState(state: MovementState) {
    this.patchableEntity.setMovementState(state);
  }

  setPosition(position: Vec3) {
    this.entity.setPosition({ v: position });
  }

  setOrientation(orientation: Vec2) {
    const fallback = finiteNpcOrientation(
      this.orientation,
      this.metadata.spawn_orientation
    );
    this.entity.setOrientation({
      v: finiteNpcOrientation(orientation, fallback),
    });
  }

  setVelocity(velocity: Vec3) {
    this.entity.setRigidBody({ velocity });
  }

  mutableState(): DeserializedNpcState {
    this.npcStateMaybeModified = true;
    return this.state as DeserializedNpcState;
  }

  setPublicCombatTarget(target: BiomesId | undefined) {
    const current = this.patchableEntity.npcCombatState()?.attack_target;
    if (current === target) {
      return;
    }
    if (target === undefined) {
      if (this.patchableEntity.npcCombatState()) {
        this.patchableEntity.clearNpcCombatState();
      }
      return;
    }
    this.patchableEntity.setNpcCombatState(
      NpcCombatState.create({ attack_target: target })
    );
  }

  private syncPublicCombatPresentation() {
    const current = this.patchableEntity.npcCombatState();
    const attackTarget =
      this.state.chaseAttack?.attackTarget ?? current?.attack_target;
    const privateRangedAttack = this.state.chaseAttack?.rangedAttack;
    const rangedAttack =
      privateRangedAttack?.targetId === attackTarget
        ? privateRangedAttack
        : undefined;
    const aimPoint = rangedAttack?.aimPoint;
    const stagger = this.state.damageReaction?.stagger;
    const poise = this.state.damageReaction?.poise;
    const poiseMax = this.state.damageReaction?.poiseMax;
    if (
      attackTarget === undefined &&
      rangedAttack === undefined &&
      stagger === undefined &&
      poiseMax === undefined
    ) {
      if (current) this.patchableEntity.clearNpcCombatState();
      return;
    }
    const unchanged =
      current?.attack_target === attackTarget &&
      current?.ranged_attack_ability_id === rangedAttack?.abilityId &&
      current?.ranged_attack_projectile_visual_id ===
        rangedAttack?.projectileVisualId &&
      current?.ranged_attack_cast_time === rangedAttack?.castTime &&
      current?.ranged_attack_charge_time_secs ===
        rangedAttack?.chargeTimeSecs &&
      current?.ranged_attack_release_time === rangedAttack?.releaseTime &&
      current?.ranged_attack_result === rangedAttack?.result &&
      current?.stagger_kind === stagger?.kind &&
      current?.stagger_start_time === stagger?.startTime &&
      current?.stagger_expiry_time === stagger?.expiryTime &&
      current?.stagger_sequence === this.state.damageReaction?.sequence &&
      current?.poise === poise &&
      current?.poise_max === poiseMax &&
      (current?.stagger_direction === undefined
        ? stagger?.direction === undefined
        : stagger?.direction !== undefined &&
          current.stagger_direction[0] === stagger.direction[0] &&
          current.stagger_direction[1] === stagger.direction[1] &&
          current.stagger_direction[2] === stagger.direction[2]) &&
      (current?.ranged_attack_aim_point === undefined
        ? aimPoint === undefined
        : aimPoint !== undefined &&
          current.ranged_attack_aim_point[0] === aimPoint[0] &&
          current.ranged_attack_aim_point[1] === aimPoint[1] &&
          current.ranged_attack_aim_point[2] === aimPoint[2]);
    if (unchanged) {
      return;
    }
    this.patchableEntity.setNpcCombatState(
      NpcCombatState.create({
        attack_target: attackTarget,
        ranged_attack_ability_id: rangedAttack?.abilityId,
        ranged_attack_projectile_visual_id: rangedAttack?.projectileVisualId,
        ranged_attack_cast_time: rangedAttack?.castTime,
        ranged_attack_charge_time_secs: rangedAttack?.chargeTimeSecs,
        ranged_attack_release_time: rangedAttack?.releaseTime,
        ranged_attack_aim_point: aimPoint ? [...aimPoint] : undefined,
        ranged_attack_result: rangedAttack?.result,
        stagger_kind: stagger?.kind,
        stagger_start_time: stagger?.startTime,
        stagger_expiry_time: stagger?.expiryTime,
        stagger_direction: stagger ? [...stagger.direction] : undefined,
        stagger_sequence: this.state.damageReaction?.sequence,
        poise,
        poise_max: poiseMax,
      })
    );
  }

  attack(
    target: ReadonlyEntity,
    damage: number,
    attack?: {
      attackAbilityId?: string;
      attackTime: number;
      impactPoint: Readonly<Vec3>;
    }
  ) {
    log.debug(`NPC ${this.id} attacks ${target.id} for ${damage} damage.`);
    if (target.npc_metadata) {
      this.events.push(
        new UpdateNpcHealthEvent({
          id: target.id,
          hp: -damage,
          damageSource: {
            kind: "attack",
            attacker: this.id,
            dir: undefined,
          },
          attackTime: attack?.attackTime,
        })
      );
      return;
    }
    this.events.push(
      new UpdatePlayerHealthEvent({
        id: target.id,
        hpDelta: -damage,
        damageSource: {
          kind: "attack",
          attacker: this.id,
          dir: undefined,
        },
        attackAbilityId: attack?.attackAbilityId,
        attackTime: attack?.attackTime,
        impactPoint: attack?.impactPoint,
      })
    );
  }

  damage(damage: number, damageSource: OptionalDamageSource) {
    if (damage <= 0 || this.hp <= 0) {
      return;
    }
    this.events.push(
      new UpdateNpcHealthEvent({ id: this.id, hp: -damage, damageSource })
    );
  }

  kill(damageSource: OptionalDamageSource) {
    killNpc(this.entity, damageSource, secondsSinceEpoch());
  }

  finish(): TickUpdates | undefined {
    if (this.npcStateMaybeModified) {
      const stateToSerialize =
        this.deserializedNpcState ??
        deserializeNpcCustomState(this.entity.npcState()?.data);
      const serialized = serializeNpcCustomState(stateToSerialize);
      if (Buffer.compare(this.entity.npcState()?.data, serialized) !== 0) {
        this.patchableEntity.setNpcState(NpcState.create({ data: serialized }));
      }
    }
    this.syncPublicCombatPresentation();
    const delta = this.patchableEntity.finish() as AsDelta<Npc>;
    if (!delta && this.events.length === 0) {
      return;
    }
    if (delta) {
      this.patchableEntity = new PatchableEntity(
        applyProposedChange(this.patchableEntity.asReadonlyEntity(), {
          kind: "update",
          entity: delta,
        }) as Npc
      );
    }
    return new TickUpdates(
      delta ? [delta] : [],
      this.events.splice(0, this.events.length)
    );
  }
}
