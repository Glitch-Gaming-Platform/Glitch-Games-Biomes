import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import type { BaseServerConfig } from "@/server/shared/server_config";
import { baseServerArgumentConfig } from "@/server/shared/server_config";

export type AssetServerMode = "none" | "lazy" | "local" | "proxy";

export interface WebServerConfig extends BaseServerConfig {
  assetServerMode: AssetServerMode;
}

export async function registerWebServerConfig(): Promise<WebServerConfig> {
  return parseArgs<WebServerConfig>({
    ...baseServerArgumentConfig,
    assetServerMode: {
      type: stringLiteralCtor("none", "lazy", "local", "proxy"),
      // SNAPSHOT_RICH_NPC_APPEARANCE_V69 assetServerMode default:
      // Use lazy local generation for snapshot appearance meshes when the
      // snapshot merge enables GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER.
      defaultValue:
        process.env.GLITCH_PLAYER_MESH_MODE === "local" ||
        process.env.GLITCH_FORCE_LOCAL_ASSET_EXPORTS === "1" ||
        process.env.GLITCH_ENABLE_SNAPSHOT_ASSET_SERVER === "1"
          ? "lazy"
          : process.env.GLITCH_RUNTIME === "1" ||
            process.env.GLITCH_DISABLE_GCP === "1" ||
            !!process.env.GLITCH_TITLE_ID
          ? "proxy"
          : process.env.NODE_ENV === "production"
          ? "none"
          : "proxy",
      alias: "a",
    },
  });
}
