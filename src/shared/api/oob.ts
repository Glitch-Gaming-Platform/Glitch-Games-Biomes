import type { Entity } from "@/shared/ecs/gen/entities";
import { zEntity } from "@/shared/ecs/zod";
import type { BiomesId } from "@/shared/ids";
import { zBiomesId } from "@/shared/ids";
import { log } from "@/shared/logging";
import { binaryPost } from "@/shared/util/fetch_helpers";
import { asyncBackoffOnAllErrors } from "@/shared/util/retry_helpers";
import { zrpcDeserialize } from "@/shared/zrpc/serde";
import { z } from "zod";

export const zOobRequest = z.object({
  ids: zBiomesId.array().max(1000),
});

export type OobRequest = z.infer<typeof zOobRequest>;

export const zOobResponse = z.object({
  entities: z.tuple([z.number(), zEntity.optional()]).array(),
});

export type OobResponse = z.infer<typeof zOobResponse>;
export type OobVersionAndEntity = [number, Entity | undefined];

export interface OobFetcher {
  fetch(ids: BiomesId[]): Promise<OobVersionAndEntity[]>;
}

export interface RemoteOobFetchUrlOptionsV1 {
  hostname: string;
  nodeEnv: string | undefined;
  oobPort: string | undefined;
  userId: BiomesId;
  glitchRuntime?: string;
  glitchDisableGcp?: string;
  nextPublicGlitchRuntime?: string;
  nextPublicGlitchLocalAssets?: string;
  nextPublicGlitchDisableGcp?: string;
  biomesSnapshotMergeMode?: string;
  nextPublicBiomesSnapshotMergeMode?: string;
}

function truthyEnv(value: string | undefined) {
  return (
    value === "1" ||
    value?.toLowerCase() === "true" ||
    value?.toLowerCase() === "yes"
  );
}

export function useSameOriginOobFetchV1(
  options: RemoteOobFetchUrlOptionsV1
) {
  return (
    options.nodeEnv === "production" ||
    truthyEnv(options.glitchRuntime) ||
    truthyEnv(options.glitchDisableGcp) ||
    truthyEnv(options.nextPublicGlitchRuntime) ||
    truthyEnv(options.nextPublicGlitchLocalAssets) ||
    truthyEnv(options.nextPublicGlitchDisableGcp) ||
    truthyEnv(options.biomesSnapshotMergeMode) ||
    truthyEnv(options.nextPublicBiomesSnapshotMergeMode)
  );
}

export function resolveRemoteOobFetchUrlV1(
  options: RemoteOobFetchUrlOptionsV1
) {
  if (options.nodeEnv === "production") {
    return "/sync/oob";
  }
  if (useSameOriginOobFetchV1(options)) {
    return `/sync/oob?u=${options.userId}`;
  }
  return `http://${options.hostname}:${options.oobPort}/sync/oob?u=${options.userId}`;
}

export class RemoteOobFetcher implements OobFetcher {
  private readonly url: string;

  constructor(userId: BiomesId) {
    this.url = resolveRemoteOobFetchUrlV1({
      hostname: window.location.hostname,
      nodeEnv: process.env.NODE_ENV,
      oobPort: process.env.OOB_PORT,
      userId,
      glitchRuntime: process.env.GLITCH_RUNTIME,
      glitchDisableGcp: process.env.GLITCH_DISABLE_GCP,
      nextPublicGlitchRuntime: process.env.NEXT_PUBLIC_GLITCH_RUNTIME,
      nextPublicGlitchLocalAssets: process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS,
      nextPublicGlitchDisableGcp: process.env.NEXT_PUBLIC_GLITCH_DISABLE_GCP,
      biomesSnapshotMergeMode: process.env.BIOMES_SNAPSHOT_MERGE_MODE,
      nextPublicBiomesSnapshotMergeMode:
        process.env.NEXT_PUBLIC_BIOMES_SNAPSHOT_MERGE_MODE,
    });
  }

  async fetch(ids: BiomesId[]): Promise<OobVersionAndEntity[]> {
    if (ids.length === 0) {
      return [];
    }
    // It's very important that OOB succeeds as it is part of sync and
    // other critical functionality, as such add a retry for it.
    try {
      return await asyncBackoffOnAllErrors(
        async () => {
          const response = await binaryPost<OobRequest>(this.url, { ids });
          const { entities } = zrpcDeserialize(response, zOobResponse);
          return entities.map(([tick, wrapped]) => [tick, wrapped?.entity]);
        },
        {
          baseMs: 500,
          exponent: 2,
          maxMs: 5000,
          jitter: 500,
        }
      );
    } catch (error) {
      log.error("oobFetch failed", { error });
      throw error;
    }
  }
}
