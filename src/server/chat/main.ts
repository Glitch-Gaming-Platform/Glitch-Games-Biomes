import type { ChatServerContext } from "@/server/chat/context";
import { registerChatServer } from "@/server/chat/server";
import { registerPlayerSpatialObserver } from "@/server/shared/chat/player_observer";
import {
  registerRedisChatDistributor,
  shouldDisableChatPushContext,
} from "@/server/shared/chat/redis/distribution";
import { registerDiscordBot } from "@/server/shared/discord";
import { runServer } from "@/server/shared/main";
import { registerBaseServerConfig } from "@/server/shared/server_config";
import { registerBiomesStorage } from "@/server/shared/storage";
import { registerWorldApi } from "@/server/shared/world/register";
import { registerCacheClient } from "@/server/web/server_cache";
import { RegistryBuilder, type RegistryLoader } from "@/shared/registry";

function buildChatRegistry(signal: AbortSignal) {
  const builder = new RegistryBuilder<ChatServerContext>()
    .bind("config", registerBaseServerConfig)
    .bind("chatServer", registerChatServer)
    .bind("playerSpatialObserver", registerPlayerSpatialObserver)
    .bind("redisChatDistributor", registerRedisChatDistributor)
    .bind("worldApi", registerWorldApi({ signal }));

  if (!shouldDisableChatPushContext()) {
    builder
      .bind("db", registerBiomesStorage)
      .bind("discordBot", (loader) =>
        registerDiscordBot(
          loader as RegistryLoader<
            ChatServerContext & {
              db: NonNullable<ChatServerContext["db"]>;
            }
          >
        )
      )
      .bind("serverCache", registerCacheClient);
  }

  return builder.build();
}

void runServer(
  "chat",
  (signal) => buildChatRegistry(signal),
  async (context) => {
    await context.chatServer.start();
  }
);
