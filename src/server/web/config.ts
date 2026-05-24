import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import type { BaseServerConfig } from "@/server/shared/server_config";
import { baseServerArgumentConfig } from "@/server/shared/server_config";

export type AssetServerMode = "none" | "lazy" | "local" | "proxy";

function useLocalAssetRuntime() {
  return (
    process.env.GLITCH_PLAYER_MESH_MODE === "local" ||
    process.env.GLITCH_FORCE_LOCAL_ASSET_EXPORTS === "1" ||
    process.env.GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER === "1" ||
    process.env.GLITCH_FORCE_LOCAL_PLAYER_MESH === "1" ||
    process.env.GLITCH_LOCAL_ASSETS === "1" ||
    process.env.NEXT_PUBLIC_GLITCH_LOCAL_ASSETS === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    process.env.LOCAL_GCS === "1" ||
    process.env.GCS_LOCAL_DISK === "1"
  );
}


export interface WebServerConfig extends BaseServerConfig {
  assetServerMode: AssetServerMode;
}

export async function registerWebServerConfig(): Promise<WebServerConfig> {
  return parseArgs<WebServerConfig>({
    ...baseServerArgumentConfig,
    assetServerMode: {
      type: stringLiteralCtor("none", "lazy", "local", "proxy"),
      // GLITCH_PROD_LOCAL_PARITY_V1:
      // In Glitch/Azure/Harthmere runtime, production must behave like local:
      // generate/load player meshes and bucket assets locally instead of
      // proxying to old upstream Biomes/GCS infrastructure.
      defaultValue: useLocalAssetRuntime()
        ? "lazy"
        : process.env.GLITCH_RUNTIME === "1" || !!process.env.GLITCH_TITLE_ID
        ? "proxy"
        : process.env.NODE_ENV === "production"
        ? "none"
        : "proxy",
      alias: "a",
    },
  });
}
