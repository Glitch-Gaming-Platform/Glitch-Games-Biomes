import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import type { BaseServerConfig } from "@/server/shared/server_config";
import { baseServerArgumentConfig } from "@/server/shared/server_config";
import { log } from "@/shared/logging";

export type AssetServerMode = "none" | "lazy" | "local" | "proxy";

export interface WebServerConfig extends BaseServerConfig {
  assetServerMode: AssetServerMode;
}

function truthyEnv(name: string): boolean {
  const raw = process.env[name];
  return raw === "1" || raw === "true" || raw === "yes" || raw === "on";
}

export function shouldForceLocalAssetRuntime(): boolean {
  return (
    truthyEnv("GLITCH_LOCAL_ASSET_RUNTIME") ||
    truthyEnv("GLITCH_FORCE_LOCAL_PLAYER_MESH") ||
    truthyEnv("GLITCH_RUNTIME") ||
    truthyEnv("NEXT_PUBLIC_GLITCH_RUNTIME") ||
    truthyEnv("GLITCH_LOCAL_ASSETS") ||
    truthyEnv("NEXT_PUBLIC_GLITCH_LOCAL_ASSETS") ||
    truthyEnv("GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER") ||
    Boolean(process.env.GLITCH_TITLE_ID)
  );
}

export async function registerWebServerConfig(): Promise<WebServerConfig> {
  const config = await parseArgs<WebServerConfig>({
    ...baseServerArgumentConfig,
    assetServerMode: {
      type: stringLiteralCtor("none", "lazy", "local", "proxy"),
      // HARTHMERE_PROD_LOCAL_ASSET_PARITY_V161:
      // Local works because the browser hits /api/assets/player_mesh.glb and
      // the server computes that mesh through the lazy/local asset exporter.
      // Production must use that same path. Do not default to none/proxy.
      defaultValue: "lazy",
      alias: "a",
    },
  });

  if (shouldForceLocalAssetRuntime() && config.assetServerMode !== "lazy") {
    log.warn("Forcing lazy local asset server for Glitch runtime parity", {
      requestedAssetServerMode: config.assetServerMode,
      glitchLocalAssetRuntime: process.env.GLITCH_LOCAL_ASSET_RUNTIME,
      glitchForceLocalPlayerMesh: process.env.GLITCH_FORCE_LOCAL_PLAYER_MESH,
      glitchRuntime: process.env.GLITCH_RUNTIME,
      nextPublicGlitchRuntime: process.env.NEXT_PUBLIC_GLITCH_RUNTIME,
      glitchLocalAssets: process.env.GLITCH_LOCAL_ASSETS,
      nextPublicGlitchLocalAssets: process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS,
      glitchEnableSnapshotAssetServer:
        process.env.GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER,
      glitchTitleId: process.env.GLITCH_TITLE_ID,
    });
    config.assetServerMode = "lazy";
  }

  return config;
}
