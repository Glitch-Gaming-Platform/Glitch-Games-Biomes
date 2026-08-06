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

export interface HarthmereNativeEcsE2EQuestProjection {
  ecs: {
    available: string[];
    inProgress: string[];
    complete: string[];
  };
  activeQuestId?: string;
  mainQuestId?: string;
  activeMapPin?: {
    markerId: string;
    label: string;
    worldPosition: [number, number, number];
  };
  markers: Array<{
    id: string;
    label: string;
    questId: string;
    triggerId: string;
    worldPosition: [number, number, number];
  }>;
  quests: Array<{
    questId: string;
    title: string;
    status: string;
    objective?: string;
    currentStepId?: string;
    steps: Array<{
      id: string;
      objective: string;
      done: boolean;
    }>;
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
  skillProgressionSnapshot(): Promise<{
    initialized: boolean;
    skills: Array<{
      id: string;
      level: number;
      xp: number;
      nextLevel: number;
      totalXp: number;
      trainingActions: readonly string[];
    }>;
  }>;
  audioDiagnostics(): BackgroundMusicDiagnostics;
  resumeAudio(): Promise<BackgroundMusicDiagnostics>;
  combatRenderSnapshot(): {
    bridgeAt?: number;
    liveCreatureRecords: Array<{
      id: number;
      at: [number, number, number];
      yaw: number;
      label: string;
    }>;
    combatActors: Record<
      string,
      {
        offset?: number;
        targetId?: string;
        liveModeTargetId?: string;
        label?: string;
        world?: [number, number, number];
      }
    >;
    animationAudits: Record<
      string,
      {
        selectedState?: string;
        animationMoving?: boolean;
        hasMatchingClip?: boolean;
        horizontalSpeed?: number;
        position?: [number, number, number];
        velocity?: [number, number, number];
      }
    >;
  };
  publish(serializedEvent: JSONable): Promise<{ sequence: number }>;
  applyChanges(serializedChanges: JSONable[]): Promise<void>;
  getAuthoritative(
    ids: BiomesId[]
  ): Promise<Array<[number, SerializedEntity | undefined]>>;
  getLocal(id: BiomesId): [unknown, SerializedEntity | undefined];
  findLocalByComponent(component: string): Array<[unknown, SerializedEntity]>;
  allocateId(): Promise<BiomesId>;
  farmingFrontendSnapshot(): Promise<unknown>;
  farmingMapFrontendSnapshot(): Promise<unknown>;
  farmingHoeQuestSnapshot(
    operation: "read" | "reset" | "accept" | "reconcile"
  ): Promise<unknown>;
  vendorPurchase(input: {
    offset: number;
    itemId: string;
    quantity: number;
    reason?: string;
  }): Promise<unknown>;
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
    operation:
      "fetch" | "accept" | "pickup" | "completeQuest" | "complete" | "abandon";
    jobId?: string;
    boardId?: string;
    questTodoId?: string;
    completedTargetId?: string;
    requestId?: string;
  }): Promise<HarthmereNativeEcsE2EJobsBoardProjection>;
  robotFrontendSnapshot(robotId: BiomesId): Promise<{
    id: string;
    label?: string;
    isRobot: boolean;
    meshAssetKey?: string;
    position?: [number, number, number];
  }>;
  groundedHarthmerePosition(input: {
    position: readonly [number, number, number];
    requireOpenSky?: boolean;
  }): Promise<{
    status: "grounded" | "no-surface" | "not-loaded";
    position?: [number, number, number];
  }>;
  nativeQuestFrontendSnapshot(): Promise<HarthmereNativeEcsE2EQuestProjection>;
  refreshBibleQuestFrontendSnapshot(): Promise<unknown>;
  /** Execute the complete Chapter 1 progression contract in this browser bundle. */
  chapter1RuntimeAudit(): Promise<unknown>;
  /** Verify Chapter 1 Bikkie challenges reached the live browser catalogue. */
  chapter1NativeQuestCatalog(): Promise<unknown>;
  /** Return every registered Chapter 1 scene and its authored running time. */
  chapter1CutsceneCatalog(): Promise<
    Array<{ id: string; shots: number; authoredSeconds: number }>
  >;
  /** Install the same per-player cast/gate projection as the scene's story beat. */
  chapter1PrepareCutsceneAudit(id: string): Promise<{
    activeGateIds: string[];
    staging: Array<{
      entityId: number;
      displayName: string;
      present: boolean;
      useSeededBody: boolean;
      position?: [number, number, number];
      activity: string;
    }>;
  }>;
  /** Source-backed matrix for every distinct Chapter 1 NPC stage and absence. */
  chapter1NpcAuditCatalog(): Promise<unknown>;
  /** Install one exact story-state projection from the NPC acceptance matrix. */
  chapter1PrepareNpcAudit(id: string): Promise<unknown>;
  /** Read the projected overrides and the actual live render records together. */
  chapter1NpcPresentationSnapshot(): Promise<unknown>;
  chapter1ClearNpcAudit(): Promise<void>;
  /** Request a real registered cutscene through the production director queue. */
  chapter1StartCutscene(id: string): Promise<{ accepted: boolean }>;
  chapter1StopCutscene(): void;
  /** Record and persist one real Chapter 1 cutscene without returning base64 over Playwright. */
  chapter1CaptureCutsceneVideo(input: {
    id: string;
    promoId?: string;
    filename: string;
    frameRate?: number;
    videoBitsPerSecond?: number;
    timeoutMs?: number;
  }): Promise<{
    id: string;
    filename: string;
    width: number;
    height: number;
    frameRate: number;
    durationSeconds: number;
    finishReason: string;
    hasAudio: boolean;
    authoredSeconds: number;
  }>;
  /** Read the actual cutscene UI resource driven by the renderer/director. */
  chapter1CutsceneSnapshot(): {
    active: boolean;
    defId?: string;
    subtitle?: { speaker?: string; text: string };
    canSkip: boolean;
    lockInput: boolean;
    fadeOpacity: number;
  };
  /** Publish the server-selected gate set to the production gate renderer. */
  chapter1SetActiveGates(ids: string[]): Promise<void>;
  /** Read frame-level diagnostics produced by the real gate renderer. */
  chapter1GateRenderSnapshot(): Promise<unknown>;
  /** Probe canonical terrain and water tensors currently synchronized to the client. */
  chapter1TerrainSnapshot(
    samples: Array<{ label: string; position: [number, number, number] }>
  ): Promise<unknown>;
  /** Read the ten Chapter 1 cast entities from the synchronized ECS table. */
  chapter1NpcSnapshot(): Promise<unknown>;
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
    skillProgressionSnapshot: async () => {
      const [combat, skills] = await Promise.all([
        import("@/shared/harthmere/harthmere_native_combat"),
        import("@/shared/harthmere/harthmere_skill_progression"),
      ]);
      const triggerState = context.table.get(context.userId)?.trigger_state;
      const character =
        combat.readHarthmereNativeCombatProgression(triggerState);
      return {
        initialized: skills.hasHarthmereNativeSkillProgression(triggerState),
        skills: skills.HARTHMERE_SKILL_IDS.map((skillId) => {
          if (skillId === "character_level") {
            return {
              id: skillId,
              level: character.level,
              xp: character.xp,
              nextLevel: combat.harthmereNativeXpForNextLevel(character.level),
              totalXp: character.xp,
              trainingActions:
                skills.HARTHMERE_SKILL_ACTION_COVERAGE[skillId] ?? [],
            };
          }
          const progress = skills.readHarthmereNativeSkillProgress(
            triggerState,
            skillId
          )!;
          return {
            id: skillId,
            level: progress.level,
            xp: progress.xp,
            nextLevel: progress.nextLevel,
            totalXp: progress.totalXp,
            trainingActions:
              skills.HARTHMERE_SKILL_ACTION_COVERAGE[skillId] ?? [],
          };
        }),
      };
    },
    audioDiagnostics: () =>
      context.audioManager.getBackgroundMusicDiagnostics(),
    resumeAudio: async () => {
      await context.audioManager.resumeAudio();
      return context.audioManager.getBackgroundMusicDiagnostics();
    },
    combatRenderSnapshot: () => {
      const browserWindow = window as typeof window & {
        __harthmereLiveCreatureEcsBridge?: {
          at?: number;
          records?: Array<{
            id: number;
            at: [number, number, number];
            yaw: number;
            label: string;
          }>;
        };
        __harthmereCombatActorPositions?: Record<
          string,
          {
            offset?: number;
            targetId?: string;
            liveModeTargetId?: string;
            label?: string;
            world?: [number, number, number];
          }
        >;
        __harthmereVoxelNpcAnimationAudit?: Record<
          string,
          {
            selectedState?: string;
            animationMoving?: boolean;
            hasMatchingClip?: boolean;
            horizontalSpeed?: number;
            position?: [number, number, number];
            velocity?: [number, number, number];
          }
        >;
      };
      return {
        bridgeAt: browserWindow.__harthmereLiveCreatureEcsBridge?.at,
        liveCreatureRecords: [
          ...(browserWindow.__harthmereLiveCreatureEcsBridge?.records ?? []),
        ],
        combatActors: {
          ...(browserWindow.__harthmereCombatActorPositions ?? {}),
        },
        animationAudits: {
          ...(browserWindow.__harthmereVoxelNpcAnimationAudit ?? {}),
        },
      };
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
      const { buildNativeFarmingInterfaceModel } =
        await import("@/client/components/biomes_ui/adapters/nativeFarmingInterfaceAdapter");
      const playerPosition = context.resources.get("/scene/local_player").player
        .position;
      return buildNativeFarmingInterfaceModel({
        userId: context.userId,
        inventory: context.table.get(context.userId)?.inventory,
        entities: context.table.contents(),
        playerPosition,
      });
    },
    farmingMapFrontendSnapshot: async () => {
      const [{ buildNativeFarmingInterfaceModel }, farmingMapQuest] =
        await Promise.all([
          import("@/client/components/biomes_ui/adapters/nativeFarmingInterfaceAdapter"),
          import("@/client/components/biomes_ui/adapters/farmingMapQuest"),
        ]);
      const playerPosition = context.resources.get("/scene/local_player").player
        .position;
      const model = buildNativeFarmingInterfaceModel({
        userId: context.userId,
        inventory: context.table.get(context.userId)?.inventory,
        entities: context.table.contents(),
        playerPosition,
      });
      return {
        plants: model.plants,
        markers: farmingMapQuest.harthmereNativeCropMapLandmarks(model),
      };
    },
    vendorPurchase: async (input) => {
      const { submitHarthmereVendorPurchaseToLiveModeForTest } =
        await import("@/client/components/challenges/LocalDevHarthmereInventorySystem");
      return submitHarthmereVendorPurchaseToLiveModeForTest(
        input.offset,
        input.itemId,
        input.quantity,
        input.reason ?? "Native ECS browser E2E vendor purchase"
      );
    },
    nativeQuestFrontendSnapshot: async () => {
      const [
        nativeAdapter,
        navAidResolver,
        mainQuestSelection,
        mapPinnedDestination,
      ] = await Promise.all([
        import("@/client/components/biomes_ui/adapters/nativeQuestMapAdapter"),
        import("@/client/components/biomes_ui/adapters/nativeQuestNavAidResolver"),
        import("@/client/components/biomes_ui/adapters/mainQuestSelection"),
        import("@/client/components/biomes_ui/adapters/mapPinnedDestination"),
      ]);
      const challenges = context.resources.get(
        "/ecs/c/challenges",
        context.userId
      );
      const bundles = context.resources.get("/challenges/all");
      const resolveNavAidPosition =
        navAidResolver.buildNativeQuestNavAidResolver({
          navigationAids: context.mapManager.localNavigationAids,
          questBundles: bundles,
          npcTypePosition: (npcTypeId) => {
            const playerPosition = context.table.get(context.userId)?.position
              ?.v;
            let best:
              | {
                  distanceSquared: number;
                  position: [number, number, number];
                }
              | undefined;
            for (const entity of context.table.contents()) {
              if (
                Number(entity.npc_metadata?.type_id) !== Number(npcTypeId) ||
                !entity.position?.v
              ) {
                continue;
              }
              const [x, y, z] = entity.position.v.map(Number);
              const dx = x - Number(playerPosition?.[0] ?? x);
              const dz = z - Number(playerPosition?.[2] ?? z);
              const distanceSquared = dx * dx + dz * dz;
              if (!best || distanceSquared < best.distanceSquared) {
                best = { distanceSquared, position: [x, y, z] };
              }
            }
            return best?.position;
          },
          fallbackPosition: () =>
            context.table.get(context.userId)?.position?.v,
        });
      const quests = nativeAdapter.nativeQuestTrackableQuests(
        bundles,
        resolveNavAidPosition
      );
      // Expose the same inferred native markers consumed by the real Map tab.
      // Position-routed combat objectives need no async NPC resolver, so this
      // is a deterministic live-browser assertion without opening a second
      // renderer or duplicating map logic in the E2E runner.
      const markers = nativeAdapter.nativeQuestMapMarkers(
        bundles,
        resolveNavAidPosition
      );
      const active = nativeAdapter.activeNativeQuest(bundles);
      const main =
        mainQuestSelection.defaultMainQuestFromTrackableQuestsForTest(quests);
      const activeMapPin = mapPinnedDestination.readActiveBiomesUIMapPin();
      return {
        ecs: {
          available: [...(challenges?.available ?? [])].map(String),
          inProgress: [...(challenges?.in_progress ?? [])].map(String),
          complete: [...(challenges?.complete ?? [])].map(String),
        },
        activeQuestId: active ? String(active.biscuit.id) : undefined,
        mainQuestId: main?.questId,
        activeMapPin: activeMapPin?.worldPosition
          ? {
              markerId: activeMapPin.markerId,
              label: activeMapPin.label,
              worldPosition: [...activeMapPin.worldPosition] as [
                number,
                number,
                number,
              ],
            }
          : undefined,
        markers: markers.flatMap((marker) => {
          if (!marker.worldPosition) return [];
          const [, questId = "", triggerId = ""] = marker.id.split(":");
          return [
            {
              id: marker.id,
              label: marker.label,
              questId,
              triggerId,
              worldPosition: [...marker.worldPosition] as [
                number,
                number,
                number,
              ],
            },
          ];
        }),
        quests: quests.map((quest) => {
          const bundle = bundles.find(
            (candidate) => String(candidate.biscuit.id) === quest.questId
          );
          const steps = nativeAdapter.nativeQuestMissionSteps(bundle);
          const currentStep = steps.find((step) => !step.done);
          return {
            questId: quest.questId,
            title: quest.title,
            status: quest.status,
            objective: quest.objective,
            materialRequirements: quest.materialRequirements,
            currentStepId: currentStep?.id.split(":").at(-1),
            steps: steps.map((step) => ({
              id: step.id.split(":").at(-1) ?? step.id,
              objective: step.objective,
              done: step.done,
            })),
          };
        }),
      };
    },
    robotFrontendSnapshot: async (robotId) => {
      const routing =
        await import("@/shared/harthmere/snapshot_grove_npc_mesh_routing");
      const entity = context.table.get(robotId);
      const position = entity?.position?.v;
      return {
        id: String(robotId),
        label: entity?.label?.text,
        isRobot: Boolean(entity?.robot_component),
        meshAssetKey: routing.snapshotGroveNpcAssetKeyForEntity(
          robotId,
          entity?.label?.text,
          { isRobot: Boolean(entity?.robot_component) }
        ),
        position: position
          ? ([...position] as [number, number, number])
          : undefined,
      };
    },
    groundedHarthmerePosition: async ({ position, requireOpenSky = true }) => {
      const { groundHarthmereLiveEntityFeetYWithStatus } =
        await import("@/client/game/util/harthmere_entity_grounding");
      const result = groundHarthmereLiveEntityFeetYWithStatus(
        context.resources,
        position[0],
        position[2],
        position[1],
        requireOpenSky
      );
      return {
        status: result.status,
        position:
          result.status === "grounded" && result.feetY !== undefined
            ? [position[0], result.feetY, position[2]]
            : undefined,
      };
    },
    refreshBibleQuestFrontendSnapshot: async () => {
      const adapter =
        await import("@/client/components/challenges/bibleQuestLiveAdapter");
      // Redis fixtures used by the catalog batch must invalidate the shared
      // 14-second read cache before React is asked to rebuild NPC actions.
      adapter.resetHarthmereBibleQuestReadCacheForTest();
      window.dispatchEvent(
        new CustomEvent(adapter.HARTHMERE_BIBLE_QUEST_EVENT)
      );
      return adapter.readHarthmereBibleQuestSnapshot({ maxAgeMs: 0 });
    },
    chapter1RuntimeAudit: async () => {
      const { ch1RunBrowserAudit } =
        await import("@/shared/harthmere/ch1_browser_audit");
      return ch1RunBrowserAudit();
    },
    chapter1NativeQuestCatalog: async () => {
      const [{ CH1_QUESTS }, nativeQuests, bikkie] = await Promise.all([
        import("@/shared/harthmere/ch1_quests"),
        import("@/shared/harthmere/ch1_native_quests"),
        import("@/shared/bikkie/active"),
      ]);
      // /challenges/all intentionally contains only available, active, and
      // completed quests for this player. A catalog audit must inspect the
      // browser's decoded Bikkie runtime directly or every locked quest looks
      // missing even though it shipped successfully.
      const bundles = context.resources.get("/challenges/all");
      return CH1_QUESTS.map((quest) => {
        const id = nativeQuests.ch1NativeQuestId(quest.id)!;
        const bundle = bundles.find((candidate) => candidate.biscuit.id === id);
        const biscuit = bikkie.BikkieRuntime.get().getBiscuitOnlyIfExists(id);
        return {
          authoredId: quest.id,
          nativeId: String(id),
          title: quest.title,
          present: Boolean(biscuit?.isQuest),
          state: bundle?.state,
          questGiver: biscuit?.questGiver
            ? String(biscuit.questGiver)
            : undefined,
          triggerKind: biscuit?.trigger?.kind,
          stepCount:
            biscuit?.trigger?.kind === "seq"
              ? biscuit.trigger.triggers.length
              : 0,
        };
      });
    },
    chapter1CutsceneCatalog: async () => {
      const { ch1AllScenes } = await import("@/shared/cutscene/ch1_scenes");
      return ch1AllScenes().map((scene) => ({
        id: scene.id,
        shots: scene.shots.length,
        authoredSeconds: scene.shots.reduce(
          (total, shot) => total + (shot.until?.maxDuration ?? shot.duration),
          0
        ),
      }));
    },
    chapter1PrepareCutsceneAudit: async (id) => {
      const [scenes, ids, stagingModule, projectionModule, puppets, gates] =
        await Promise.all([
          import("@/shared/cutscene/ch1_scenes"),
          import("@/shared/harthmere/ch1_ids"),
          import("@/shared/harthmere/ch1_staging"),
          import("@/client/components/challenges/Chapter1WorldProjectionController"),
          import("@/shared/cutscene/puppets"),
          import("@/client/game/renderers/ch1_fracture_gate"),
        ]);
      const { CH1_SCENE_IDS } = scenes;
      const { CH1_FLAGS } = ids;
      const storyBeatByScene = new Map<
        string,
        Parameters<typeof stagingModule.ch1StageDirections>[0]
      >([
        [
          CH1_SCENE_IDS.firstGate,
          { flags: [CH1_FLAGS.started], activeStepId: "the_seam" },
        ],
        [
          CH1_SCENE_IDS.theFlinch,
          {
            flags: [CH1_FLAGS.started, CH1_FLAGS.gatePersistentOpen],
            activeStepId: "the_flinch",
          },
        ],
        [
          CH1_SCENE_IDS.confrontation,
          { flags: [CH1_FLAGS.started], activeStepId: "confront" },
        ],
        [
          CH1_SCENE_IDS.sorrelDoor,
          {
            flags: [CH1_FLAGS.act4Complete],
            activeStepId: "d2_sorrels_camp",
          },
        ],
        [
          CH1_SCENE_IDS.theCase,
          { flags: [CH1_FLAGS.act5Complete], activeStepId: "hear_him_out" },
        ],
        [
          CH1_SCENE_IDS.consolidationRevision,
          { flags: [CH1_FLAGS.act5Complete], activeStepId: "the_word" },
        ],
        [
          CH1_SCENE_IDS.tooLate,
          { flags: [CH1_FLAGS.act5Complete], activeStepId: "watch_him_go" },
        ],
        [
          CH1_SCENE_IDS.theWatchHouse,
          {
            flags: [CH1_FLAGS.act5Complete, CH1_FLAGS.jackieReported],
            activeStepId: "the_whole_plan",
          },
        ],
      ]);
      const staging = stagingModule.ch1StageDirections(
        storyBeatByScene.get(id) ?? { flags: [CH1_FLAGS.started] }
      );
      const projection = {
        staging: staging.map((row) => ({
          ...row,
          position: row.position
            ? ([...row.position] as [number, number, number])
            : undefined,
        })),
        worldPhase: [],
        isolateCutsceneCast: true,
      };
      window.__chapter1E2ECutsceneProjection = projection;
      puppets.publishChapter1PuppetOverrides(
        projectionModule.chapter1ProjectionPuppetOverrides(projection)
      );
      const activeGateIds =
        id === CH1_SCENE_IDS.firstGate
          ? ["ch1_gate_fence_sighting"]
          : id === CH1_SCENE_IDS.persistentGate
            ? ["ch1_gate_desert"]
            : [];
      gates.setCh1ActiveGateIds(activeGateIds);
      return {
        activeGateIds,
        staging: projection.staging,
      };
    },
    chapter1NpcAuditCatalog: async () => {
      const { ch1NpcLiveAuditCatalog } =
        await import("@/shared/harthmere/ch1_npc_live_audit");
      return ch1NpcLiveAuditCatalog();
    },
    chapter1PrepareNpcAudit: async (id) => {
      const [audit, projectionModule, puppets] = await Promise.all([
        import("@/shared/harthmere/ch1_npc_live_audit"),
        import("@/client/components/challenges/Chapter1WorldProjectionController"),
        import("@/shared/cutscene/puppets"),
      ]);
      const scenario = audit.ch1NpcLiveAuditScenario(id);
      if (!scenario) {
        throw new Error(`Unknown Chapter 1 NPC audit scenario: ${id}`);
      }
      const projection = {
        staging: audit.ch1NpcLiveAuditStaging(scenario.input).map((row) => ({
          ...row,
          position: row.position
            ? ([...row.position] as [number, number, number])
            : undefined,
        })),
        worldPhase: [],
      };
      window.__chapter1E2ECutsceneProjection = projection;
      puppets.publishChapter1PuppetOverrides(
        projectionModule.chapter1ProjectionPuppetOverrides(projection)
      );
      return { ...scenario, staging: projection.staging };
    },
    chapter1NpcPresentationSnapshot: async () => {
      const puppets = await import("@/shared/cutscene/puppets");
      const browserWindow = window as typeof window & {
        __harthmereLiveCreatureEcsBridge?: {
          at?: number;
          records?: unknown[];
        };
      };
      return {
        overrides: puppets.readChapter1PuppetOverrides(),
        bridgeAt: browserWindow.__harthmereLiveCreatureEcsBridge?.at,
        records: [
          ...(browserWindow.__harthmereLiveCreatureEcsBridge?.records ?? []),
        ],
      };
    },
    chapter1ClearNpcAudit: async () => {
      const puppets = await import("@/shared/cutscene/puppets");
      delete window.__chapter1E2ECutsceneProjection;
      puppets.clearChapter1PuppetOverrides();
    },
    chapter1StartCutscene: async (id) => {
      const cutsceneService =
        await import("@/client/game/cutscene/cutscene_service");
      const source = cutsceneService.cutsceneLibrary.get(id);
      if (!source) {
        return { accepted: false, defId: id };
      }
      // Catalog playback is a render/lifecycle audit, not a story mutation.
      // Register a unique high-priority clone with all end-state authority
      // removed. Increasing priority guarantees that the next catalog scene
      // hard-aborts the previous sandbox instead of waiting for a long authored
      // dialogue hold, while the production definition remains untouched for
      // normal gameplay.
      const serial = Number(
        (window as typeof window & { __ch1E2ECutsceneSerial?: number })
          .__ch1E2ECutsceneSerial ?? 0
      );
      (
        window as typeof window & { __ch1E2ECutsceneSerial?: number }
      ).__ch1E2ECutsceneSerial = serial + 1;
      const suffix = `-e2e-${serial}`;
      const defId = `${source.id.slice(0, 128 - suffix.length)}${suffix}`;
      cutsceneService.registerCutscene({
        ...source,
        id: defId,
        name: `${source.name} E2E Sandbox`,
        priority: 900_000 + Math.min(serial, 99_999),
        settings: {
          ...source.settings,
          mode: "clientPuppet",
          commitOn: [],
        },
        onEnd: { placements: [], commits: [] },
      });
      return {
        accepted: cutsceneService.requestCutsceneById(defId, {
          preempt: true,
        }),
        defId,
      };
    },
    chapter1StopCutscene: () => {
      context.resources.update("/scene/cutscene", (state) => {
        state.skipRequested = true;
      });
      delete window.__chapter1E2ECutsceneProjection;
      void Promise.all([
        import("@/shared/cutscene/puppets").then((module) =>
          module.clearChapter1PuppetOverrides()
        ),
        import("@/client/game/renderers/ch1_fracture_gate").then((module) =>
          module.setCh1ActiveGateIds(undefined)
        ),
      ]);
    },
    chapter1CaptureCutsceneVideo: async (input) => {
      const [{ requestCutsceneVideoById }, cutsceneService] = await Promise.all(
        [
          import("@/client/game/cutscene/video_capture_service"),
          import("@/client/game/cutscene/cutscene_service"),
        ]
      );
      let captureId = input.id;
      if (input.promoId) {
        const { promoSceneById } =
          await import("@/shared/cutscene/promo_scenes");
        const promo = promoSceneById(input.promoId);
        if (!promo) {
          throw new Error(`unknown Chapter 1 promo scene ${input.promoId}`);
        }
        const definition = await promo.build();
        cutsceneService.registerCutscene(definition);
        captureId = definition.id;
      }
      const definition = cutsceneService.cutsceneLibrary.get(captureId);
      if (!definition) {
        throw new Error(`unknown Chapter 1 cutscene ${captureId}`);
      }
      const authoredSeconds = definition.shots.reduce(
        (total, shot) => total + (shot.until?.maxDuration ?? shot.duration),
        0
      );
      const result = await requestCutsceneVideoById(
        context.resources,
        context.audioManager,
        captureId,
        {
          frameRate: input.frameRate ?? 30,
          videoBitsPerSecond: input.videoBitsPerSecond ?? 4_000_000,
          filename: input.filename,
          preempt: true,
          timeoutMs:
            input.timeoutMs ?? Math.max(180_000, authoredSeconds * 4_000),
        }
      );
      // The local sink keeps multi-megabyte WebM payloads out of the browser
      // automation protocol. This is materially faster and avoids exhausting
      // Playwright's serialization memory during an eighteen-scene batch.
      const response = await fetch("/api/dev/cutscene_video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: captureId,
          filename: result.filename,
          dataUri: result.dataUri,
        }),
      });
      if (!response.ok) {
        throw new Error(
          `local cutscene video save failed (${response.status})`
        );
      }
      return {
        id: captureId,
        filename: result.filename,
        width: result.width,
        height: result.height,
        frameRate: result.frameRate,
        durationSeconds: result.durationSeconds,
        finishReason: result.finishReason,
        hasAudio: result.hasAudio,
        authoredSeconds,
      };
    },
    chapter1CutsceneSnapshot: () => {
      const state = context.resources.get("/scene/cutscene");
      return {
        active: state.active,
        defId: state.defId,
        subtitle: state.subtitle
          ? {
              speaker: state.subtitle.speaker,
              text: state.subtitle.text,
            }
          : undefined,
        canSkip: state.canSkip,
        lockInput: state.lockInput,
        fadeOpacity: state.fadeOpacity,
      };
    },
    chapter1SetActiveGates: async (ids) => {
      const { setCh1ActiveGateIds } =
        await import("@/client/game/renderers/ch1_fracture_gate");
      setCh1ActiveGateIds(ids);
    },
    chapter1GateRenderSnapshot: async () => {
      const { ch1FractureGateRenderSnapshot } =
        await import("@/client/game/renderers/ch1_fracture_gate");
      return ch1FractureGateRenderSnapshot();
    },
    chapter1TerrainSnapshot: async (samples) => {
      const [{ voxelShard, blockPos }, { terrainIdToBlock }] =
        await Promise.all([
          import("@/shared/game/shard"),
          import("@/shared/bikkie/terrain"),
        ]);
      return samples.map(({ label, position }) => {
        const shardId = voxelShard(...position);
        const local = blockPos(...position);
        const terrainId =
          context.resources.get("/terrain/volume", shardId)?.get(...local) ?? 0;
        const water =
          context.resources.get("/water/tensor", shardId)?.get(...local) ?? 0;
        const terrainEntity = context.resources.get("/ecs/terrain", shardId);
        return {
          label,
          position,
          shardId,
          terrainEntityId: terrainEntity?.id,
          hasShardSeed: Boolean(terrainEntity?.shard_seed),
          hasShardWater: Boolean(terrainEntity?.shard_water),
          terrainId,
          terrainName: terrainIdToBlock(terrainId)?.name,
          water,
        };
      });
    },
    chapter1NpcSnapshot: async () => {
      const { CH1_NEW_CAST } = await import("@/shared/harthmere/ch1_cast");
      return CH1_NEW_CAST.map((member) => {
        const entity = context.table.get(member.entityId);
        return {
          key: member.key,
          entityId: String(member.entityId),
          expectedName: member.displayName,
          introducedAct: member.introducedAct,
          present: Boolean(entity),
          label: entity?.label?.text,
          position: entity?.position?.v,
          npcTypeId: entity?.npc_metadata?.type_id
            ? String(entity.npc_metadata.type_id)
            : undefined,
          questGiver: Boolean(entity?.quest_giver),
        };
      });
    },
    farmingHoeQuestSnapshot: async (operation) => {
      const [{ buildNativeFarmingInterfaceModel }, farmingMapQuest] =
        await Promise.all([
          import("@/client/components/biomes_ui/adapters/nativeFarmingInterfaceAdapter"),
          import("@/client/components/biomes_ui/adapters/farmingMapQuest"),
        ]);
      const model = buildNativeFarmingInterfaceModel({
        userId: context.userId,
        inventory: context.table.get(context.userId)?.inventory,
        entities: context.table.contents(),
      });
      const state =
        operation === "reset"
          ? farmingMapQuest.resetHarthmereHoeQuestForTest(context.userId)
          : operation === "accept"
            ? farmingMapQuest.acceptHarthmereHoeQuest(context.userId)
            : operation === "reconcile"
              ? farmingMapQuest.reconcileHarthmereHoeQuestState(
                  context.userId,
                  model.hasHoe
                )
              : farmingMapQuest.readHarthmereHoeQuestState(context.userId);
      return {
        state,
        hasHoe: model.hasHoe,
        markers: farmingMapQuest.harthmereHoeQuestMapLandmarks(state),
        quests: farmingMapQuest.harthmereHoeQuestTrackableQuests(state),
      };
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
      const {
        createHarthmereJobsBoardAdapter,
        submitHarthmereJobsBoardMutation,
      } =
        await import("@/client/components/harthmere_jobs_board/jobsBoardLiveAdapter");
      const adapter = createHarthmereJobsBoardAdapter(fetch);
      let snapshot;
      if (input.operation === "fetch") {
        // E2E fixtures are installed after the page has booted. Bypass the
        // normal short-lived UI cache so each assertion observes the current
        // authoritative jobs-board state instead of the boot snapshot.
        snapshot = await adapter.fetchState({ force: true });
      } else {
        if (!input.jobId || !input.boardId) {
          throw new Error("jobs_board_e2e_missing_job_or_board");
        }
        switch (input.operation) {
          case "accept":
            snapshot = await adapter.acceptJob(
              input.jobId,
              input.boardId,
              input.requestId
            );
            break;
          case "pickup":
            snapshot = await submitHarthmereJobsBoardMutation(
              "pickup_delivery_parcel",
              {
                jobId: input.jobId,
                boardId: input.boardId,
                questTodoId: input.questTodoId,
                completedTargetId: input.completedTargetId,
              },
              {
                fetchImpl: fetch,
                boardId: input.boardId,
                requestId: input.requestId,
              }
            );
            break;
          case "completeQuest":
            snapshot = await adapter.completeJobQuest(
              input.jobId,
              input.boardId,
              {
                questTodoId: input.questTodoId,
                completedTargetId: input.completedTargetId,
              },
              input.requestId
            );
            break;
          case "complete":
            snapshot = await adapter.completeJob(
              input.jobId,
              input.boardId,
              input.requestId
            );
            break;
          case "abandon":
            snapshot = await adapter.abandonJob(
              input.jobId,
              input.boardId,
              input.requestId
            );
            break;
          default:
            throw new Error(
              `jobs_board_e2e_unknown_operation:${input.operation}`
            );
        }
      }
      return projectJobsBoardFrontendState(snapshot);
    },
  };

  globalThis.__harthmereNativeEcsE2E = bridge;
  return bridge;
}
