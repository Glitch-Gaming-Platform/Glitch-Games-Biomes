import type { ClientContext } from "@/client/game/context";
import { zGetWithVersionResponse } from "@/pages/api/admin/ecs/get_with_version";
import {
  EntitySerde,
  EventSerde,
  SerializeForServer,
} from "@/shared/ecs/gen/json_serde";
import { ChangeSerde } from "@/shared/ecs/serde";
import { WrappedProposedChange } from "@/shared/ecs/zod";
import type { BiomesId } from "@/shared/ids";
import type { JSONable } from "@/shared/util/type_helpers";
import { jsonFetch, zjsonPost } from "@/shared/util/fetch_helpers";
import { z } from "zod";

type SerializedEntity = ReturnType<typeof EntitySerde.serialize>;

export interface HarthmereNativeEcsE2EBridge {
  readonly version: "native-ecs-e2e-v1";
  readonly userId: BiomesId;
  diagnostics(): {
    userId: BiomesId;
    tableTick: number;
    tableSize: number;
    publishedEvents: ReadonlyArray<{
      sequence: number;
      kind: string;
      startedAt: number;
      acceptedAt: number;
    }>;
  };
  publish(serializedEvent: JSONable): Promise<{ sequence: number }>;
  applyChanges(serializedChanges: JSONable[]): Promise<void>;
  getAuthoritative(
    ids: BiomesId[]
  ): Promise<Array<[number, SerializedEntity | undefined]>>;
  getLocal(id: BiomesId): [unknown, SerializedEntity | undefined];
  findLocalByComponent(component: string): Array<[unknown, SerializedEntity]>;
  allocateId(): Promise<BiomesId>;
}

declare global {
  /* eslint-disable no-var */
  var __harthmereNativeEcsE2E: HarthmereNativeEcsE2EBridge | undefined;
  /* eslint-enable no-var */
}

export function shouldInstallHarthmereNativeEcsE2E(input: {
  hostname: string;
  search: string;
}) {
  const localHost =
    input.hostname === "localhost" ||
    input.hostname === "127.0.0.1" ||
    input.hostname === "::1";
  return (
    localHost &&
    new URLSearchParams(input.search).get("harthmere_native_ecs_e2e") === "1"
  );
}

/**
 * Installs a deliberately narrow browser-side test adapter.  Gameplay still
 * travels through the normal client event queue, logic service, world API and
 * sync websocket.  The privileged methods only create deterministic fixtures
 * and read server versions through existing admin APIs; they never substitute
 * for a gameplay mutation or update the client table directly.
 */
export function installHarthmereNativeEcsE2E(
  context: ClientContext
): HarthmereNativeEcsE2EBridge | undefined {
  if (
    typeof window === "undefined" ||
    !shouldInstallHarthmereNativeEcsE2E(window.location)
  ) {
    return;
  }

  let sequence = 0;
  const publishedEvents: Array<{
    sequence: number;
    kind: string;
    startedAt: number;
    acceptedAt: number;
  }> = [];

  const bridge: HarthmereNativeEcsE2EBridge = {
    version: "native-ecs-e2e-v1",
    userId: context.userId,
    diagnostics: () => ({
      userId: context.userId,
      tableTick: context.table.tick,
      tableSize: context.table.recordSize,
      publishedEvents: [...publishedEvents],
    }),
    publish: async (serializedEvent) => {
      const event = EventSerde.deserialize(serializedEvent);
      const currentSequence = ++sequence;
      const startedAt = performance.now();
      await context.events.publish(event);
      publishedEvents.push({
        sequence: currentSequence,
        kind: event.kind,
        startedAt,
        acceptedAt: performance.now(),
      });
      return { sequence: currentSequence };
    },
    applyChanges: async (serializedChanges) => {
      const changes = serializedChanges.map(
        (change) =>
          new WrappedProposedChange(ChangeSerde.deserializeProposed(change))
      );
      await zjsonPost("/api/admin/apply_ecs_changes", changes, z.void());
    },
    getAuthoritative: async (ids) => {
      const result = await zjsonPost(
        "/api/admin/ecs/get_with_version",
        ids,
        zGetWithVersionResponse
      );
      return result.map(([version, wrapped]) => [
        version,
        wrapped?.prepareForZrpc(),
      ]);
    },
    getLocal: (id) => {
      const [version, entity] = context.table.getWithVersion(id);
      return [
        version,
        entity ? EntitySerde.serialize(SerializeForServer, entity) : undefined,
      ];
    },
    findLocalByComponent: (component) => {
      const matches: Array<[unknown, SerializedEntity]> = [];
      for (const entity of context.table.contents()) {
        if (
          (entity as unknown as Record<string, unknown>)[component] ===
          undefined
        ) {
          continue;
        }
        const [version] = context.table.getWithVersion(entity.id);
        matches.push([
          version,
          EntitySerde.serialize(SerializeForServer, entity)!,
        ]);
      }
      return matches;
    },
    allocateId: () => jsonFetch<BiomesId>("/api/admin/allocate_id"),
  };

  globalThis.__harthmereNativeEcsE2E = bridge;
  return bridge;
}
