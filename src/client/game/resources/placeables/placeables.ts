import type { ClientContext } from "@/client/game/context";
import {
  makeBasicAnimatedPlaceableMesh,
  makeBasicPlaceableMesh,
  makeCampfirePlaceableMesh,
} from "@/client/game/resources/placeables/basic";
import {
  getPlaceableSpatialLighting,
  loadPlaceableTypeMesh,
  setPlaceableOrientation,
} from "@/client/game/resources/placeables/helpers";
import { updateMountContentsInfo } from "@/client/game/resources/placeables/mounts";
import { makeMuckBusterReduxMesh } from "@/client/game/resources/placeables/muck_buster";
import {
  makePlaceableFrameMesh,
  updatePictureFrameInfo,
} from "@/client/game/resources/placeables/picture_frame";
import { updatePunchthroughInfo } from "@/client/game/resources/placeables/punchthrough";
import { makePlaceableShopContainerMesh } from "@/client/game/resources/placeables/shop";
import { updateSimpleRaceInfo } from "@/client/game/resources/placeables/simple_race";
import type { AnimatedPlaceableMesh } from "@/client/game/resources/placeables/types";
import {
  makeECSWearablesUrl,
  makePlayerLikeAppearanceMesh,
} from "@/client/game/resources/player_mesh";
import type {
  ClientResourceDeps,
  ClientResourcesBuilder,
} from "@/client/game/resources/types";
import { shopParticleMaterials } from "@/client/game/util/particles_systems";
import type { AudioAssetType } from "@/galois/assets/audio";
import type { AssetPath } from "@/galois/interface/asset_paths";
import { BikkieIds } from "@/shared/bikkie/ids";
import { makeDisposable } from "@/shared/disposable";
import { anItem } from "@/shared/game/item";
import { HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS } from "@/shared/harthmere/sound_effect_manifest";
import type { BiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import type { RegistryLoader } from "@/shared/registry";
import { ok } from "assert";
import { Box3, Group, PositionalAudio } from "three";

async function genPlaceableAudio(deps: ClientResourceDeps, id: BiomesId) {
  const { listener: audioListener, manager: audioManager } = deps.get("/audio");
  if (!audioListener || !audioManager) {
    return;
  }

  const placeableComponent = deps.get("/ecs/c/placeable_component", id);
  ok(placeableComponent);

  const makeAudio = async (
    assetPath: AssetPath,
    assetType: AudioAssetType,
    options: {
      autoplay?: boolean;
      maxDistance?: number;
      volumeSetting?: "settings.volume.effects" | "settings.volume.media";
    } = {}
  ) => {
    const buffer = await deps.get("/audio/buffer", assetPath);
    if (!buffer) {
      return;
    }
    const audio = new PositionalAudio(audioListener);
    audio.setBuffer(buffer);
    audio.setDistanceModel("exponential");
    audio.setRolloffFactor(2);
    audio.setRefDistance(5);
    audio.setMaxDistance(options.maxDistance ?? 64);
    audio.setLoop(true);
    if (options.autoplay ?? true) {
      audio.play();
    }
    audio.setVolume(
      audioManager.getVolume(
        options.volumeSetting ?? "settings.volume.media",
        assetType
      )
    );
    return makeDisposable(audio, () => {
      audio.stop();
    });
  };

  if (placeableComponent.item_id === BikkieIds.boombox) {
    return makeAudio("audio/disco", "disco");
  } else if (placeableComponent.item_id === BikkieIds.arcadeMachine) {
    return makeAudio("audio/arcade", "arcade");
  } else if (placeableComponent.item_id === BikkieIds.campfire) {
    return makeAudio("audio/campfire", "campfire", {
      autoplay: false,
      maxDistance: HARTHMERE_CAMPFIRE_AMBIENCE_RADIUS_METERS,
      volumeSetting: "settings.volume.effects",
    });
  }
}

async function makePlaceableMesh(
  context: ClientContext,
  deps: ClientResourceDeps,
  id: BiomesId
): Promise<AnimatedPlaceableMesh> {
  const placeableComponent = deps.get("/ecs/c/placeable_component", id);
  try {
    if (!placeableComponent) {
      return makeFallbackPlaceableMesh(deps, id, "missing_placeable_component");
    }
    const placeableItem = anItem(placeableComponent.item_id);

    if (placeableItem.isFrame) {
      return await makePlaceableFrameMesh(context, deps, id);
    }

    if (placeableItem.isShopContainer) {
      return await makePlaceableShopContainerMesh(context, deps, id);
    }

    if (placeableItem.id === BikkieIds.campfire) {
      return await makeCampfirePlaceableMesh(context, deps, id);
    }

    if (placeableItem.id === BikkieIds.muckBusterRedux) {
      return await makeMuckBusterReduxMesh(context, deps, id);
    }

    if (placeableItem.isPlayerLikeAppearance) {
      const mesh = await makePlayerLikeAppearanceMesh(deps, id);
      return await makeBasicAnimatedPlaceableMesh(deps, id, [], {
        gltf: mesh,
        noBreakableMaterial: true,
        meshUrl: makeECSWearablesUrl(deps, id),
      });
    }

    return await makeBasicPlaceableMesh(context, deps, id);
  } catch (error) {
    return makeFallbackPlaceableMesh(deps, id, error);
  }
}

function makeFallbackPlaceableMesh(
  deps: ClientResourceDeps,
  id: BiomesId,
  error: unknown
): AnimatedPlaceableMesh {
  const group = new Group();
  group.name = `fallback-placeable-${id}`;
  const position = deps.get("/ecs/c/position", id);
  const orientation = deps.get("/ecs/c/orientation", id);
  const placeableComponent = deps.get("/ecs/c/placeable_component", id);
  if (position) {
    group.position.fromArray(position.v);
  }
  setPlaceableOrientation(group, orientation?.v);
  log.warn("PLACEABLE_MESH_FALLBACK", {
    id,
    itemId: placeableComponent?.item_id,
    error,
  });
  return makeDisposable(
    {
      placeableId: id,
      three: group,
      spatialLighting: getPlaceableSpatialLighting(deps, id),
      url: `fallback-placeable:${id}`,
    },
    () => {
      group.clear();
    }
  );
}

async function updatePlaceableMesh(
  context: ClientContext,
  deps: ClientResourceDeps,
  placeableMesh: Promise<AnimatedPlaceableMesh>
) {
  // In most cases we want to ignore this update so that animation state is preserved
  const mesh = await placeableMesh;

  // Always update position and orientation
  const orientation = deps.get("/ecs/c/orientation", mesh.placeableId);
  const position = deps.get("/ecs/c/position", mesh.placeableId);
  const placeableComponent = deps.get(
    "/ecs/c/placeable_component",
    mesh.placeableId
  );
  const meshUrl = makeECSWearablesUrl(deps, mesh.placeableId);
  const item = anItem(placeableComponent?.item_id);

  if (item?.isPlayerLikeAppearance && mesh.url !== meshUrl) {
    Object.assign(
      mesh,
      await makePlaceableMesh(context, deps, mesh.placeableId)
    );
    return;
  }

  const rotationY = mesh.three.rotation.y;
  setPlaceableOrientation(mesh.three, orientation?.v);
  if (rotationY !== mesh.three.rotation.y) {
    mesh.three.matrixWorldNeedsUpdate = true;
  }
  if (position) {
    mesh.three.position.fromArray(position.v);
    mesh.three.matrixWorldNeedsUpdate = true;
  }
  mesh.spatialLighting = getPlaceableSpatialLighting(deps, mesh.placeableId);
  if (mesh.spatialMesh) {
    const spatialBox = new Box3();
    spatialBox.setFromObject(mesh.spatialMesh);
    const renderBox = new Box3();
    renderBox.setFromObject(mesh.three);
  }

  await updatePictureFrameInfo(context, deps, mesh);
  await updateMountContentsInfo(context, deps, mesh);
  await updatePunchthroughInfo(context, deps, mesh);
  await updateSimpleRaceInfo(context, deps, mesh);
  mesh.particleSystems?.forEach((system) => {
    setPlaceableOrientation(system.three, orientation?.v);
  });
}

export function addPlaceableResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  builder.add(
    "/scene/placeable/shop_particle_materials",
    shopParticleMaterials
  );
  builder.add(
    "/scene/placeable/type_mesh",
    loader.provide((_context, _deps, placeableItemId) =>
      loadPlaceableTypeMesh(anItem(placeableItemId))
    )
  );
  builder.addDynamic(
    "/scene/placeable/mesh",
    loader.provide(makePlaceableMesh),
    loader.provide(updatePlaceableMesh)
  );
  builder.add("/scene/placeable/audio", genPlaceableAudio);
  builder.addDynamic(
    "/scene/css3d_element",
    () => ({}),
    () => undefined
  );
}
