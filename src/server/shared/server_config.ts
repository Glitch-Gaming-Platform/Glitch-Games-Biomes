import { parseArgs, stringLiteralCtor } from "@/server/shared/args";
import type { BiscuitMode } from "@/server/shared/bikkie/storage/register";
import type { ChatApiMode } from "@/server/shared/chat/register";
import type { FirehoseMode } from "@/server/shared/firehose/register";
import type { StorageMode } from "@/server/shared/storage";
import type { WorldApiMode } from "@/server/shared/world/register";
import type { ArgumentConfig } from "ts-command-line-args";

export type CacheMode = "none" | "local" | "redis";

export interface BaseServerConfig {
  copyOnWriteSnapshot: string;
  storageMode: StorageMode;
  firehoseMode: FirehoseMode;
  biscuitMode: BiscuitMode;
  chatApiMode: ChatApiMode;
  worldApiMode: WorldApiMode;
  bikkieCacheMode: CacheMode;
  serverCacheMode: CacheMode;
}

export const baseServerArgumentConfig: ArgumentConfig<BaseServerConfig> = {
  storageMode: {
    type: stringLiteralCtor(
      "copy-on-write",
      "firestore",
      "memory",
      "snapshot",
      "shim"
    ),
    defaultValue: "copy-on-write",
    alias: "s",
  },
  firehoseMode: {
    type: stringLiteralCtor("memory", "shim", "redis"),
    defaultValue: "memory",
  },
  biscuitMode: {
    type: stringLiteralCtor("memory", "shim", "redis2"),
    defaultValue: "memory",
  },
  chatApiMode: {
    type: stringLiteralCtor("shim", "redis"),
    defaultValue: "shim",
  },
  copyOnWriteSnapshot: {
    type: String,
    defaultValue: "",
  },
  worldApiMode: {
    type: stringLiteralCtor("shim", "redis", "hfc-hybrid"),
    defaultValue: "shim",
  },
  bikkieCacheMode: {
    type: stringLiteralCtor("local", "redis"),
    defaultValue: "local",
  },
  serverCacheMode: {
    type: stringLiteralCtor("local", "redis"),
    defaultValue: "local",
  },
} as const;

function isGlitchRuntime() {
  return (
    process.env.GLITCH_RUNTIME === "1" ||
    process.env.GLITCH_DISABLE_GCP === "1" ||
    !!process.env.GLITCH_TITLE_ID
  );
}

function chooseGlitchStorageMode(current: StorageMode): StorageMode {
  const requested = process.env.GLITCH_STORAGE_MODE as StorageMode | undefined;
  if (requested && ["memory", "snapshot", "shim"].includes(requested)) {
    return requested;
  }

  // Never let Glitch/local fall into Firestore or copy-on-write production storage.
  if (current === "copy-on-write" || current === "firestore") {
    return "memory";
  }

  return current;
}

function chooseGlitchFirehoseMode(current: FirehoseMode): FirehoseMode {
  const requested = process.env.GLITCH_FIREHOSE_MODE as FirehoseMode | undefined;
  if (requested && ["memory", "shim", "redis"].includes(requested)) {
    return requested;
  }
  return "memory";
}

function chooseGlitchBiscuitMode(current: BiscuitMode): BiscuitMode {
  const requested = process.env.GLITCH_BISCUIT_MODE as BiscuitMode | undefined;
  if (requested && ["memory", "shim", "redis2"].includes(requested)) {
    return requested;
  }
  return "memory";
}

function chooseGlitchChatApiMode(current: ChatApiMode): ChatApiMode {
  const requested = process.env.GLITCH_CHAT_API_MODE as ChatApiMode | undefined;
  if (requested && ["shim", "redis"].includes(requested)) {
    return requested;
  }
  return "shim";
}

function chooseGlitchWorldApiMode(current: WorldApiMode): WorldApiMode {
  const requested = process.env.GLITCH_WORLD_API_MODE as WorldApiMode | undefined;
  if (requested && ["shim", "redis", "hfc-hybrid"].includes(requested)) {
    return requested;
  }
  return "shim";
}

export function applyGlitchRuntimeDefaults<T extends BaseServerConfig>(config: T): T {
  if (!isGlitchRuntime()) {
    return config;
  }

  return {
    ...config,
    storageMode: chooseGlitchStorageMode(config.storageMode),
    firehoseMode: chooseGlitchFirehoseMode(config.firehoseMode),
    biscuitMode: chooseGlitchBiscuitMode(config.biscuitMode),
    chatApiMode: chooseGlitchChatApiMode(config.chatApiMode),
    worldApiMode: chooseGlitchWorldApiMode(config.worldApiMode),
    bikkieCacheMode:
      process.env.GLITCH_BIKKIE_CACHE_MODE === "redis" ? "redis" : "local",
    serverCacheMode:
      process.env.GLITCH_SERVER_CACHE_MODE === "redis" ? "redis" : "local",
  };
}

export async function registerBaseServerConfig(): Promise<BaseServerConfig> {
  return applyGlitchRuntimeDefaults(
    await parseArgs<BaseServerConfig>(baseServerArgumentConfig)
  );
}
