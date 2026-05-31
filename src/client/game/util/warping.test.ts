import { createOrJoinMinigame } from "@/client/game/util/warping";
import type { MinigameType } from "@/shared/ecs/gen/types";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

describe("createOrJoinMinigame", () => {
  const userId = 123 as BiomesId;
  const minigameId = 456 as BiomesId;

  let originalFetch: typeof globalThis.fetch;
  let fetchCalls: { input: RequestInfo | URL; init?: RequestInit }[];
  let publishedEvents: any[];
  let chatMessages: any[];

  beforeEach(() => {
    originalFetch = globalThis.fetch;
    fetchCalls = [];
    publishedEvents = [];
    chatMessages = [];
    globalThis.fetch = async (input, init) => {
      fetchCalls.push({ input, init });
      return new Response(JSON.stringify({}), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      });
    };
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  function deps(resourceMinigameType?: MinigameType) {
    return {
      userId,
      events: {
        publish: async (event: any) => {
          publishedEvents.push(event);
        },
      },
      chatIo: {
        sendMessage: async (channel: string, message: any) => {
          chatMessages.push({ channel, message });
        },
      },
      resources: {
        get: (path: string, id?: BiomesId) => {
          if (
            path === "/ecs/c/minigame_component" &&
            id === minigameId &&
            resourceMinigameType
          ) {
            return { metadata: { kind: resourceMinigameType } };
          }
        },
      },
    } as any;
  }

  it("starts known simple races through the client event channel", async () => {
    await createOrJoinMinigame(deps(), minigameId, "simple_race");

    assert.equal(fetchCalls.length, 0);
    assert.equal(publishedEvents.length, 1);
    assert.equal(publishedEvents[0].kind, "startSimpleRaceMinigameEvent");
    assert.equal(publishedEvents[0].id, userId);
    assert.equal(publishedEvents[0].minigame_id, minigameId);
    assert.deepEqual(chatMessages, [
      {
        channel: "chat",
        message: { kind: "minigame_join", minigameId },
      },
    ]);
  });

  it("starts simple races from cached ECS metadata when type is not supplied", async () => {
    await createOrJoinMinigame(deps("simple_race"), minigameId);

    assert.equal(fetchCalls.length, 0);
    assert.equal(publishedEvents.length, 1);
    assert.equal(publishedEvents[0].kind, "startSimpleRaceMinigameEvent");
  });

  it("keeps non-race minigames on the existing web join API", async () => {
    await createOrJoinMinigame(deps(), minigameId, "spleef");

    assert.equal(publishedEvents.length, 0);
    assert.equal(fetchCalls.length, 1);
    assert.equal(fetchCalls[0].input, "/api/minigames/create_or_join");
    assert.deepEqual(JSON.parse(fetchCalls[0].init?.body as string), {
      minigameId,
    });
    assert.deepEqual(chatMessages, [
      {
        channel: "chat",
        message: { kind: "minigame_join", minigameId },
      },
    ]);
  });
});
