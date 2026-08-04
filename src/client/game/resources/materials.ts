import type { ClientContext } from "@/client/game/context";
import breakingAnimation from "@/client/game/resources/breaking_animation.json";
import shapingAnimation from "@/client/game/resources/shaping_animation.json";
import type { ClientResourcesBuilder } from "@/client/game/resources/types";
import { decodeBase64Bytes } from "@/client/game/util/mobile_atlas_decode";
import { makeColorMapArray } from "@/client/game/util/textures";
import type { RegistryLoader } from "@/shared/registry";
import type * as THREE from "three";

export interface AnimatedMaterial {
  texture: THREE.DataArrayTexture;
  numFrames: number;
}

export interface AnimatingMaterialData {
  shape: [number, number, number, 4];
  blob: string;
}

async function loadAnimatedMaterial(config: AnimatingMaterialData) {
  // HARTHMERE_ATLAS_BASE64_DECODE (2026-08-04 mobile audit, item 6).
  // Was `new Uint8Array(Buffer.from(config.blob, "base64").buffer)`, which
  // discards byteOffset/byteLength and therefore reads neighbouring bytes out
  // of Node's shared Buffer pool. It only worked in the browser because the
  // browserify polyfill happens to allocate exactly. See
  // `mobile_atlas_decode.ts` for the full explanation.
  const data = decodeBase64Bytes(config.blob);
  return {
    texture: makeColorMapArray(data, ...config.shape),
    numFrames: config.shape[0],
  };
}

export function addMaterialsResources(
  loader: RegistryLoader<ClientContext>,
  builder: ClientResourcesBuilder
) {
  builder.add("/materials/destroying_material", () =>
    loadAnimatedMaterial(breakingAnimation as AnimatingMaterialData)
  );
  builder.add("/materials/shaping_material", () =>
    loadAnimatedMaterial(shapingAnimation as AnimatingMaterialData)
  );
}
