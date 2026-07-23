import type { ClientContext } from "@/client/game/context";
import type { BackgroundMusicDiagnostics } from "@/client/game/context_managers/audio_manager";
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

export interface HarthmereNativeEcsE2EJobsBoardProjection {
  actorId: string;
  openJobs: Array<{
    jobId: string;
    boardId: string;
    templateId?: string;
    title: string;
    kind: string;
  }>;
  acceptedJobs: Array<{
    jobId: string;
    boardId: string;
    templateId?: string;
    title: string;
    kind: string;
  }>;
  todos: Array<{
    todoId: string;
    jobId: string;
    title: string;
    kind: string;
    status: string;
    mapMarkerId?: string;
  }>;
  quests: Array<{
    questId: string;
    title: string;
    kind?: string;
    status: string;
    firstMarkerId?: string;
    objective?: string;
  }>;
  markers: Array<{
    id: string;
    label: string;
    jobsBoardTodoId: string;
    jobsBoardJobId: string;
    mapMarkerId: string;
    position: [number, number, number];
  }>;
}

async function projectJobsBoardFrontendState(
  snapshot: unknown
): Promise<HarthmereNativeEcsE2EJobsBoardProjection> {
  const [{ normalizeHarthmereJobsBoardSnapshot }, mapAdapter] =
    await Promise.all([
      import("@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter"),
      import("@/client/components/biomes_ui/adapters/jobsBoardQuestMapAdapter"),
    ]);
  const normalized = normalizeHarthmereJobsBoardSnapshot(snapshot);
  const quests = mapAdapter.jobsBoardTrackableQuestsForBiomesUI(normalized);
  const markers =
    mapAdapter.jobsBoardAcceptedJobLandmarksForBiomesUI(normalized);
  const jobSummary = (job: (typeof normalized.openJobs)[number]) => ({
    jobId: job.jobId,
    boardId: job.boardId,
    templateId: job.templateId,
    title: job.title,
    kind: job.kind,
  });
  return {
    actorId: normalized.actorId,
    openJobs: normalized.openJobs.map(jobSummary),
    acceptedJobs: normalized.myAcceptedJobs.map(jobSummary),
    todos: normalized.myTodos.map((todo) => ({
      todoId: todo.todoId,
      jobId: todo.jobId,
      title: todo.title,
      kind: todo.kind,
      status: todo.status,
      mapMarkerId: todo.mapMarkerId,
    })),
    quests: quests.map((quest) => ({
      questId: quest.questId,
      title: quest.title,
      kind: quest.kind,
      status: quest.status,
      firstMarkerId: quest.firstMarkerId,
      objective: quest.objective,
    })),
    markers: markers.map((marker) => ({
      id: marker.id,
      label: marker.label,
      jobsBoardTodoId: marker.jobsBoardTodoId,
      jobsBoardJobId: marker.jobsBoardJobId,
      mapMarkerId: marker.mapMarkerId,
      position: [...marker.position] as [number, number, number],
    })),
  };
}

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
  audioDiagnostics(): BackgroundMusicDiagnostics;
  resumeAudio(): Promise<BackgroundMusicDiagnostics>;
  publish(serializedEvent: JSONable): Promise<{ sequence: number }>;
  applyChanges(serializedChanges: JSONable[]): Promise<void>;
  getAuthoritative(
    ids: BiomesId[]
  ): Promise<Array<[number, SerializedEntity | undefined]>>;
  getLocal(id: BiomesId): [unknown, SerializedEntity | undefined];
  findLocalByComponent(component: string): Array<[unknown, SerializedEntity]>;
  allocateId(): Promise<BiomesId>;
  farmingFrontendSnapshot(): Promise<unknown>;
  findTillableVoxelNear(
    origin: readonly [number, number, number],
    radius?: number
  ): Promise<
    | {
        position: [number, number, number];
        terrainEntityId: BiomesId;
        occupancyId?: BiomesId;
      }
    | undefined
  >;
  farmingVoxelSnapshot(position: readonly [number, number, number]): Promise<{
    terrainId: number;
    farmingId?: BiomesId;
    isTillable: boolean;
  }>;
  jobsBoardFrontendRoundTrip(input: {
    operation: "fetch" | "accept" | "abandon";
    jobId?: string;
    boardId?: string;
    requestId?: string;
  }): Promise<HarthmereNativeEcsE2EJobsBoardProjection>;
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
    audioDiagnostics: () =>
      context.audioManager.getBackgroundMusicDiagnostics(),
    resumeAudio: async () => {
      await context.audioManager.resumeAudio();
      return context.audioManager.getBackgroundMusicDiagnostics();
    },
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
    farmingFrontendSnapshot: async () => {
      const { buildNativeFarmingInterfaceModel } = await import(
        "@/client/components/biomes_ui/adapters/nativeFarmingInterfaceAdapter"
      );
      const playerPosition = context.resources.get("/scene/local_player").player
        .position;
      return buildNativeFarmingInterfaceModel({
        userId: context.userId,
        inventory: context.table.get(context.userId)?.inventory,
        entities: context.table.contents(),
        playerPosition,
      });
    },
    findTillableVoxelNear: async (origin, radius = 5) => {
      const [{ voxelShard, blockPos }, { terrainIdToBlock }] =
        await Promise.all([
          import("@/shared/game/shard"),
          import("@/shared/bikkie/terrain"),
        ]);
      const [ox, oy, oz] = origin.map(Math.floor) as [number, number, number];
      for (let ring = 0; ring <= radius; ring++) {
        for (let dx = -ring; dx <= ring; dx++) {
          for (let dz = -ring; dz <= ring; dz++) {
            if (ring > 0 && Math.abs(dx) !== ring && Math.abs(dz) !== ring)
              continue;
            for (let dy = 1; dy >= -2; dy--) {
              const position: [number, number, number] = [
                ox + dx,
                oy + dy,
                oz + dz,
              ];
              const shardId = voxelShard(...position);
              const local = blockPos(...position);
              const terrainId =
                context.resources
                  .get("/terrain/volume", shardId)
                  ?.get(...local) ?? 0;
              if (!terrainIdToBlock(terrainId)?.isTillable) continue;
              const terrainEntity = context.resources.get(
                "/ecs/terrain",
                shardId
              );
              if (!terrainEntity) continue;
              const occupancyId = context.resources
                .get("/terrain/occupancy", shardId)
                ?.get(...local) as BiomesId | undefined;
              return {
                position,
                terrainEntityId: terrainEntity.id,
                occupancyId: occupancyId || undefined,
              };
            }
          }
        }
      }
      return undefined;
    },
    farmingVoxelSnapshot: async (position) => {
      const [{ voxelShard, blockPos }, { terrainIdToBlock }] =
        await Promise.all([
          import("@/shared/game/shard"),
          import("@/shared/bikkie/terrain"),
        ]);
      const shardId = voxelShard(...position);
      const local = blockPos(...position);
      const terrainId =
        context.resources.get("/terrain/volume", shardId)?.get(...local) ?? 0;
      const farmingId = context.resources
        .get("/terrain/farming", shardId)
        ?.get(...local) as BiomesId | undefined;
      return {
        terrainId,
        farmingId: farmingId || undefined,
        isTillable: Boolean(terrainIdToBlock(terrainId)?.isTillable),
      };
    },
    jobsBoardFrontendRoundTrip: async (input) => {
      const { createHarthmereJobsBoardAdapter } = await import(
        "@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter"
      );
      const adapter = createHarthmereJobsBoardAdapter(fetch);
      let snapshot;
      if (input.operation === "fetch") {
        snapshot = await adapter.fetchState();
      } else {
        if (!input.jobId || !input.boardId) {
          throw new Error("jobs_board_e2e_missing_job_or_board");
        }
        snapshot =
          input.operation === "accept"
            ? await adapter.acceptJob(
                input.jobId,
                input.boardId,
                input.requestId
              )
            : await adapter.abandonJob(
                input.jobId,
                input.boardId,
                input.requestId
              );
      }
      return projectJobsBoardFrontendState(snapshot);
    },
  };

  globalThis.__harthmereNativeEcsE2E = bridge;
  return bridge;
}
