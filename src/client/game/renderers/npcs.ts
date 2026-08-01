import type { ClientConfig } from "@/client/game/client_config";
import type { ClientTable } from "@/client/game/game";
import { nearestKEntitiesInFrustum } from "@/client/game/renderers/cull_entities";
import type { Renderer } from "@/client/game/renderers/renderer_controller";
import type { Scenes } from "@/client/game/renderers/scenes";
import { drawLimitValueWithTweak } from "@/client/game/resources/graphics_settings";
import { harthmereEnsureRenderableNpcEntity } from "@/client/game/resources/harthmere_npc_render_compat";
import type { ClientResources } from "@/client/game/resources/types";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import type { BiomesId } from "@/shared/ids";
import {
  readRenderablePuppetOverrides,
  type CutscenePuppetOverride,
} from "@/shared/cutscene/puppets";
import type { Vec3 } from "@/shared/math/types";
import { Cval } from "@/shared/util/cvals";

const numNpcsCval = new Cval({
  path: ["renderer", "npcs", "numNpcs"],
  help: "The total number of NPCs this client renderer is aware of last frame.",
  initialValue: 0,
});

const numNpcsRenderedCval = new Cval({
  path: ["renderer", "npcs", "numRenderedNpcs"],
  help: "The total number of NPCs rendered in the last frame.",
  initialValue: 0,
});

export const makeNpcsRenderer = (
  clientConfig: ClientConfig,
  table: ClientTable,
  resources: ClientResources
): Renderer => {
  let frameNumber = 0;
  return {
    name: "npcs",
    draw(scenes: Scenes, dt: number) {
      const tweaks = resources.get("/tweaks");
      if (!tweaks.showNpcs) {
        return;
      }
      const camera = resources.get("/scene/camera");

      const clock = resources.get("/clock");

      numNpcsCval.value = 0;
      numNpcsRenderedCval.value = 0;

      const becomeNpc = resources.get("/scene/npc/become_npc");
      const puppetOverrides = readRenderablePuppetOverrides();
      let puppetOverrideById: Map<BiomesId, CutscenePuppetOverride> | undefined;
      let hiddenNpcIds: Set<number> | undefined;
      let cutsceneNpcIds: Set<BiomesId> | undefined;
      for (const override of puppetOverrides) {
        if (override.id <= 0) {
          continue;
        }
        const entityId = override.id as BiomesId;
        (puppetOverrideById ??= new Map()).set(entityId, override);
        if (override.hidden) {
          (hiddenNpcIds ??= new Set()).add(override.id);
        } else {
          (cutsceneNpcIds ??= new Set()).add(entityId);
        }
      }
      let mustKeepNpcIds = cutsceneNpcIds ? new Set(cutsceneNpcIds) : undefined;
      if (becomeNpc.kind === "active") {
        (mustKeepNpcIds ??= new Set()).add(becomeNpc.entityId);
      }
      const skyParams = resources.get("/scene/sky_params");
      const sunDirection = skyParams.sunDirection.toArray() as Vec3;

      const entities = nearestKEntitiesInFrustum(
        camera,
        (q) => table.scan(q),
        NpcMetadataSelector,
        drawLimitValueWithTweak(
          resources,
          tweaks.clientRendering.npcRenderLimit
        ),
        {
          mustKeep: mustKeepNpcIds,
        }
      );
      for (let i = entities.length - 1; i >= 0; i -= 1) {
        if (hiddenNpcIds?.has(Number(entities[i].id))) entities.splice(i, 1);
      }
      if (
        becomeNpc.kind === "active" &&
        !entities.find((x) => x.id === becomeNpc.entityId)
      ) {
        // If the player is currently the NPC, always render it since due to
        // client/server position differences, it may not be reported as being
        // in the frustum.
        const entity = table.get(NpcMetadataSelector.point(becomeNpc.entityId));
        if (entity) {
          entities.push(entity);
        }
      }
      for (const entityId of cutsceneNpcIds ?? []) {
        if (entities.some((entity) => Number(entity.id) === entityId)) {
          continue;
        }
        const entity = table.get(NpcMetadataSelector.point(entityId));
        if (entity) {
          entities.push(entity);
        }
      }
      for (const rawEntity of entities) {
        // HARTHMERE_NPC_RENDER_COMPONENT_COMPAT: fill safe defaults for NPCs
        // missing combat components (health/size/orientation/rigid_body) so
        // they render a body instead of just a floating nameplate.
        const entity = harthmereEnsureRenderableNpcEntity(rawEntity);
        if (!entity) {
          continue;
        }

        ++numNpcsCval.value;

        const renderState = resources.cached(
          "/scene/npc/render_state",
          entity.id
        );
        if (!renderState) {
          continue;
        }

        ++numNpcsRenderedCval.value;
        renderState.tick(
          entity,
          dt,
          frameNumber,
          clock.time,
          sunDirection,
          tweaks,
          resources,
          puppetOverrideById?.get(entity.id) ?? null
        );
        renderState.addToScene(scenes, clock.time);
      }

      ++frameNumber;
    },
  };
};
