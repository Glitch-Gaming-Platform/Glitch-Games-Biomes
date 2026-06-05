import type { PermissionsManager } from "@/client/game/context_managers/permissions_manager";
import type { ClientTable } from "@/client/game/game";
import { traceBlueprints } from "@/client/game/helpers/blueprint";
import { MarchHelper } from "@/client/game/helpers/march";
import { occupancyAt } from "@/client/game/helpers/occupancy";
import type { Cursor } from "@/client/game/resources/cursor";
import {
  attackableEntitiesInAttackRegion,
  canAttackFilter,
  shouldAddCrosshairMeleeTargetV1,
} from "@/client/game/resources/melee_attack_region";
import type { ClientResources } from "@/client/game/resources/types";
import type { Script } from "@/client/game/scripts/script_controller";
import type { TerrainHit } from "@/shared/game/spatial";
import { traceEntities } from "@/shared/game/spatial";
import { TerrainHelper } from "@/shared/game/terrain_helper";
import { terrainMarch } from "@/shared/game/terrain_march";
import type { BiomesId } from "@/shared/ids";
import { cross } from "@/shared/math/linear";
import type { VoxelooModule } from "@/shared/wasm/types";
import { compact, isEqual, last } from "lodash";

const MAX_CURSOR_DISTANCE = 32;

export class CursorScript implements Script {
  readonly name = "cursor";

  constructor(
    readonly userId: BiomesId,
    readonly resources: ClientResources,
    readonly permissionsManager: PermissionsManager,
    readonly table: ClientTable,
    readonly voxeloo: VoxelooModule
  ) {}

  getCursorHit(): Cursor {
    const ray = MarchHelper.getPlayerRay(this.resources, MAX_CURSOR_DISTANCE);
    const source = ray.source.toArray();
    const direction = ray.direction.toArray();
    const maxDistance = MAX_CURSOR_DISTANCE;
    // Check entities hit by the ray.

    const entityHits = traceEntities(this.table, source, direction, {
      maxDistance,
      entityFilter: (e) =>
        !e.gremlin &&
        e.id !== this.userId &&
        (!e.health || e.health.hp > 0) &&
        !e.protection && // TODO: Add an "interactable" component to entities the user can interact with.
        !e.blueprint_component,
    });
    let entityHit = last(entityHits);

    const terrainHelper = TerrainHelper.fromResources(
      this.voxeloo,
      this.resources
    );
    // Check terrain hit by the ray.
    let terrainHit: TerrainHit | undefined;
    terrainMarch(
      this.voxeloo,
      this.resources,
      source,
      direction,
      maxDistance,
      (hit) => {
        terrainHit = {
          kind: "terrain",
          pos: hit.pos,
          face: hit.face,
          terrainId: hit.terrainId,
          distance: hit.distance,
          terrainSample: {
            dye: terrainHelper.getDye(hit.pos),
            muck: terrainHelper.getMuck(hit.pos),
            moisture: terrainHelper.getMoisture(hit.pos),
            terrainId: hit.terrainId,
          },
        };
        return false;
      }
    );
    if (terrainHit) {
      // Augment terrain hit with group occupancy.
      terrainHit.groupId = occupancyAt(this.resources, terrainHit.pos);
    }

    // Check blueprint voxels hit by the ray.

    const blueprintHit = traceBlueprints(
      { resources: this.resources, table: this.table },
      source,
      direction,
      MAX_CURSOR_DISTANCE
    );
    if (
      blueprintHit &&
      terrainHit &&
      isEqual(blueprintHit.pos, terrainHit.pos)
    ) {
      // Augment blueprint hit with terrain hit if they are the same position.
      blueprintHit.terrainId = terrainHit?.terrainId;
      blueprintHit.face = terrainHit?.face;
      entityHit = undefined;
    }

    // Determine which hit is closest.

    let hit = last(
      compact([entityHit, terrainHit, blueprintHit]).sort(
        (a, b) =>
          (b?.distance ?? Number.POSITIVE_INFINITY) -
          (a?.distance ?? Number.POSITIVE_INFINITY)
      )
    );

    if (
      hit === terrainHit &&
      terrainHit &&
      blueprintHit &&
      isEqual(terrainHit.pos, blueprintHit.pos)
    ) {
      // All things equal, prefer blueprint hit over terrain hit.
      hit = blueprintHit;
    }

    // Check attackable entities in the region.

    const player = this.resources.get("/scene/local_player");
    const attackableEntities = attackableEntitiesInAttackRegion(
      this,
      player.id
    );

    // HARTHMERE_VOXEL_REACH_ATTACK_V1:
    // The native melee cone (combat.meleeAttackRegion.far = 3.5) is far shorter
    // than the world-interaction voxel break/change reach
    // (building.changeRadius = 8.78). Because a left click is shared between
    // "break the block" and "attack", aiming at a mucker/animal/player that is
    // 4-8 units away landed the block break but never registered the creature as
    // a melee target -- the reported "blocks break but they don't get hit" bug.
    // Treat whatever the crosshair ray is actually pointing at as an attackable
    // target out to the same reach used to break blocks, so the same swing that
    // breaks the block also damages the thing it is aimed at. This rides the
    // proven native handleAttackInteraction -> Update{Npc,Player}HealthEvent path
    // (server-authoritative) and covers players, NPCs (muckers/hexes/muxes) and
    // animals uniformly.
    if (entityHit && entityHit.kind === "entity") {
      const reach =
        this.resources.get("/tweaks").building.changeRadius +
        this.resources.get("/player/modifiers").reach.increase;
      const target = entityHit.entity;
      const ruleSet = this.resources.get("/ruleset/current");
      const me = this.resources.get("/ecs/entity", player.id);
      const aclAllowsPlayers = this.permissionsManager.clientActionAllowedAt(
        "pvp",
        target.position?.v ?? entityHit.pos
      );
      const canAttack = canAttackFilter(ruleSet, aclAllowsPlayers, me, target);
      if (
        shouldAddCrosshairMeleeTargetV1({
          hasEntityHit: true,
          distance: entityHit.distance,
          reach,
          targetId: target.id,
          playerId: player.id,
          alreadyIncludedIds: attackableEntities.map((e) => e.id),
          canAttack,
        })
      ) {
        attackableEntities.push(target);
      }
    }

    const right = cross([0, -1, 0], direction);

    return {
      startPos: source,
      dir: direction,
      right,
      hit,
      attackableEntities,
    };
  }

  tick(_dt: number) {
    // Update cursor.
    const prev = this.resources.get("/scene/cursor");
    const curr = this.getCursorHit();

    if (curr.hit) {
      // Use rough distance so that we don't invalidate resources that depend on this needlessly.
      curr.hit.distance = Math.floor(curr.hit.distance);
    }

    if (!isEqual(curr, prev)) {
      this.resources.update("/scene/cursor", (cursor) => {
        Object.assign(cursor, curr);
      });
    }
  }
}
