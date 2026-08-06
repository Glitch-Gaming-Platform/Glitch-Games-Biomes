import { requestCutsceneScreenshot } from "@/client/game/cutscene/capture_service";
import {
  waitForPromoCameraTerrainClearance,
  waitForPromoTerrainProofs,
  waitForPromoTerrainView,
} from "@/client/game/cutscene/promo_terrain_readiness";
import type { ClientContext } from "@/client/game/context";
import { sleep } from "@/shared/util/async";
import { useEffect, useRef } from "react";

type PromoCaptureRecord = {
  sceneId: string;
  cameraPreset: string;
  dataUri: string;
  rawDataUri: string;
  filename: string;
  cameraPosition: [number, number, number];
  cameraOrientation: [number, number];
};

type PromoCaptureStatus =
  | { status: "pending"; completed?: number; total?: number; current?: string }
  | ({
      status: "complete";
      captures?: PromoCaptureRecord[];
    } & PromoCaptureRecord)
  | { status: "error"; error: string };

declare global {
  interface Window {
    __biomesCaptureReady?: boolean;
    __biomesPromoCapture?: PromoCaptureStatus;
  }
}

function publishPromoCapture(state: PromoCaptureStatus): void {
  window.__biomesPromoCapture = state;
  let output = document.getElementById("biomes-promo-capture-output");
  if (!output) {
    output = document.createElement("script");
    output.id = "biomes-promo-capture-output";
    output.setAttribute("type", "application/json");
    document.documentElement.append(output);
  }
  output.textContent = JSON.stringify(state);
}

async function waitForEngineCaptureReady(timeoutMs: number): Promise<void> {
  const deadline = performance.now() + timeoutMs;
  while (!window.__biomesCaptureReady) {
    if (performance.now() >= deadline) {
      throw new Error("game renderer did not become capture-ready in time");
    }
    await sleep(100);
  }
}

async function loadCaptureImage(dataUri: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new Error("captured engine frame could not be decoded"));
    image.src = dataUri;
  });
}

async function addBiomesBrand(
  dataUri: string,
  brand: { title: string; subtitle: string; headline?: string }
): Promise<string> {
  const image = await loadCaptureImage(dataUri);
  const canvas = document.createElement("canvas");
  canvas.width = image.naturalWidth;
  canvas.height = image.naturalHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error(
      "2D canvas is unavailable for promotional title compositing"
    );
  }
  context.drawImage(image, 0, 0);

  const width = canvas.width;
  const height = canvas.height;
  const margin = Math.round(width * 0.055);
  const titleSize = Math.round(width * (brand.headline ? 0.042 : 0.072));
  const subtitleSize = Math.round(width * 0.014);
  const gradient = context.createLinearGradient(0, 0, 0, height * 0.45);
  gradient.addColorStop(0, "rgba(3, 8, 18, 0.68)");
  gradient.addColorStop(1, "rgba(3, 8, 18, 0)");
  context.fillStyle = gradient;
  context.fillRect(0, 0, width, height * 0.48);

  context.textBaseline = "top";
  context.shadowColor = "rgba(20, 220, 255, 0.9)";
  context.shadowBlur = Math.round(titleSize * 0.22);
  context.fillStyle = "#ffffff";
  context.font = `900 ${titleSize}px ui-rounded, system-ui, sans-serif`;
  context.fillText(
    brand.headline ?? brand.title,
    margin,
    Math.round(height * 0.065)
  );

  if (!brand.headline) {
    context.shadowBlur = Math.round(subtitleSize * 0.4);
    context.fillStyle = "rgba(220, 250, 255, 0.95)";
    context.font = `700 ${subtitleSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
    context.fillText(
      brand.subtitle,
      margin + Math.round(titleSize * 0.04),
      Math.round(height * 0.065) + Math.round(titleSize * 1.08)
    );
  }
  context.shadowBlur = 0;
  return canvas.toDataURL("image/png");
}

async function persistPromoStill(record: PromoCaptureRecord): Promise<void> {
  const rawFilename = record.filename.replace(/\.png$/i, "-raw.png");
  for (const [filename, dataUri] of [
    [record.filename, record.dataUri],
    [rawFilename, record.rawDataUri],
  ] as const) {
    const response = await fetch("/api/dev/cutscene_still", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ filename, dataUri }),
    });
    if (!response.ok) {
      throw new Error(
        `could not persist ${filename}: ${response.status} ${response.statusText}`
      );
    }
  }
}

type PromoLivePlayerDebug = {
  getPosition?: () => unknown;
  teleportTo?: (target: Record<string, unknown>) => unknown;
};

type PromoObserverStreamingDebug = {
  getPosition?: () => unknown;
  moveTo?: (position: [number, number, number]) => Promise<unknown>;
};

type PromoStreamingSnapshot =
  | { kind: "player"; position: [number, number, number] }
  | { kind: "observer"; position: [number, number, number] };

// Both the gameplay player script and `/at/` observer ClientIo publish this
// only after their authoritative streaming control has been installed. Keep
// renderer readiness separate: a drawable WebGL canvas says nothing about
// which terrain/ECS interest set the server is currently streaming.
const PROMO_STREAMING_READY_EVENT = "biomes:promo-streaming-ready";

function promoLivePlayerDebug(): PromoLivePlayerDebug | undefined {
  return (
    window as typeof window & {
      __harthmereLivePlayerDebug?: PromoLivePlayerDebug;
    }
  ).__harthmereLivePlayerDebug;
}

function promoObserverStreamingDebug():
  PromoObserverStreamingDebug | undefined {
  return (
    window as typeof window & {
      __biomesObserverStreamingDebug?: PromoObserverStreamingDebug;
    }
  ).__biomesObserverStreamingDebug;
}

function promoStreamingSnapshot(): PromoStreamingSnapshot | undefined {
  const observer = finiteVec3(promoObserverStreamingDebug()?.getPosition?.());
  if (observer) {
    return { kind: "observer", position: observer };
  }
  const player = finiteVec3(promoLivePlayerDebug()?.getPosition?.());
  return player ? { kind: "player", position: player } : undefined;
}

function finiteVec3(value: unknown): [number, number, number] | undefined {
  if (
    !Array.isArray(value) ||
    value.length < 3 ||
    !value.slice(0, 3).every((part) => Number.isFinite(Number(part)))
  ) {
    return undefined;
  }
  return [Number(value[0]), Number(value[1]), Number(value[2])];
}

function hasPromoStreamingHook(): boolean {
  return (
    typeof promoLivePlayerDebug()?.teleportTo === "function" ||
    typeof promoObserverStreamingDebug()?.moveTo === "function"
  );
}

/**
 * Wait for game authority, not elapsed wall time.
 *
 * Renderer readiness often wins the startup race. A fixed delay/timeout then
 * either captures an unloaded land or fails a healthy but slowly bootstrapping
 * stack. The owning player/observer controller publishes the event after its
 * real mutation hook exists. The external browser runner retains its normal
 * overall failure ceiling; that ceiling is not treated as a readiness signal.
 */
async function waitForPromoStreamingHook(): Promise<void> {
  if (hasPromoStreamingHook()) {
    return;
  }
  await new Promise<void>((resolve) => {
    const onReady = () => {
      if (!hasPromoStreamingHook()) {
        return;
      }
      window.removeEventListener(PROMO_STREAMING_READY_EVENT, onReady);
      resolve();
    };
    window.addEventListener(PROMO_STREAMING_READY_EVENT, onReady);
    // Close the assignment/listener race if authority published between the
    // first check and addEventListener.
    onReady();
  });
}

/**
 * Move the real local streaming observer before starting a distant capture.
 *
 * A client-puppet teleport moves only the cinematic actor. Terrain/ECS shard
 * subscriptions still follow the live player, so a warm batch that only moved
 * the cutscene camera eventually photographed unloaded sky. This capture-only
 * bridge moves the local observer first; the director's normal prewarm gate can
 * then wait on the correct shards without paying another page bootstrap.
 */
async function stagePromoStreamingObserver(
  position: [number, number, number]
): Promise<void> {
  await waitForPromoStreamingHook();
  const playerDebug = promoLivePlayerDebug();
  const observerDebug = promoObserverStreamingDebug();
  const observerPosition = finiteVec3(observerDebug?.getPosition?.());

  let landed = false;
  if (
    observerPosition !== undefined &&
    typeof observerDebug?.moveTo === "function"
  ) {
    const result = (await observerDebug.moveTo(position)) as
      { ok?: unknown; position?: unknown } | undefined;
    const after = finiteVec3(result?.position ?? observerDebug.getPosition?.());
    landed =
      result?.ok === true &&
      after !== undefined &&
      Math.abs(after[0] - position[0]) < 0.35 &&
      Math.abs(after[2] - position[2]) < 0.35;
  } else if (typeof playerDebug?.teleportTo === "function") {
    const result = playerDebug.teleportTo({
      x: position[0],
      y: position[1],
      z: position[2],
      name: "cutscenePromoStreamingObserver",
      reason: "Load the cinematic camera's terrain and ECS interest set",
    }) as { teleported?: unknown; after?: unknown } | undefined;
    const after = finiteVec3(result?.after ?? playerDebug.getPosition?.());
    landed =
      result?.teleported === true &&
      after !== undefined &&
      Math.abs(after[0] - position[0]) < 0.35 &&
      Math.abs(after[2] - position[2]) < 0.35;
  }
  if (!landed) {
    throw new Error(
      `could not stage promo streaming observer at ${position.join(",")}`
    );
  }

  // The player script publishes the new observer immediately, but one short
  // beat avoids starting the director before the subscription request leaves.
  await sleep(350);
}

type PromoRuntimeSceneryStatus = {
  origin?: unknown;
  selectedDistrictCounts?: Record<string, unknown>;
  loadedDistrictCounts?: Record<string, unknown>;
  failedDistrictCounts?: Record<string, unknown>;
};

async function waitForPromoRuntimeScenery(
  spec: { district: string; minLoadedPlacements: number } | undefined,
  expectedOrigin: [number, number, number],
  timeoutMs = 120_000
): Promise<void> {
  if (!spec) return;
  const deadline = performance.now() + timeoutMs;
  let lastStatus: PromoRuntimeSceneryStatus | undefined;
  while (performance.now() < deadline) {
    lastStatus = (
      window as typeof window & {
        __harthmereMobileRuntimeStreaming?: PromoRuntimeSceneryStatus;
      }
    ).__harthmereMobileRuntimeStreaming;
    const selected = Number(
      lastStatus?.selectedDistrictCounts?.[spec.district] ?? 0
    );
    const loaded = Number(
      lastStatus?.loadedDistrictCounts?.[spec.district] ?? 0
    );
    const failed = Number(
      lastStatus?.failedDistrictCounts?.[spec.district] ?? 0
    );
    const origin = finiteVec3(
      Array.isArray(lastStatus?.origin)
        ? [lastStatus.origin[0], expectedOrigin[1], lastStatus.origin[1]]
        : undefined
    );
    const originReady =
      origin !== undefined &&
      Math.abs(origin[0] - expectedOrigin[0]) < 1 &&
      Math.abs(origin[2] - expectedOrigin[2]) < 1;
    if (failed > 0) {
      throw new Error(
        `promo runtime scenery failed: ${JSON.stringify({ spec, lastStatus })}`
      );
    }
    if (
      originReady &&
      selected >= spec.minLoadedPlacements &&
      loaded >= selected &&
      loaded >= spec.minLoadedPlacements
    ) {
      return;
    }
    await sleep(100);
  }
  throw new Error(
    `promo runtime scenery timed out: ${JSON.stringify({ spec, lastStatus })}`
  );
}

async function restorePromoStreamingObserver(
  snapshot: PromoStreamingSnapshot | undefined
): Promise<void> {
  if (!snapshot) {
    return;
  }
  try {
    if (snapshot.kind === "player") {
      promoLivePlayerDebug()?.teleportTo?.({
        x: snapshot.position[0],
        y: snapshot.position[1],
        z: snapshot.position[2],
        name: "cutscenePromoStreamingObserverRestore",
        reason:
          "Restore the local player after non-authoritative promo capture",
      });
    } else {
      await promoObserverStreamingDebug()?.moveTo?.(snapshot.position);
    }
  } catch {
    // Capture completion must remain visible even if a disposable local test
    // page is closing while the best-effort restore runs.
  }
}

async function exoticMatterCreationScene() {
  // These production catalogues initialize terrain/building data and must not
  // enter Next's server-render graph through Game.tsx. Load them only after an
  // explicit browser capture request has mounted the real game client.
  const [{ BikkieIds }, ownerSeeds, stationSeeds] = await Promise.all([
    import("@/shared/bikkie/ids"),
    import("@/shared/harthmere/business_owner_npc_seed"),
    import("@/shared/harthmere/business_crafting_station_seed"),
  ]);
  const { HARTHMERE_BUSINESS_OWNER_NPC_SEEDS } = ownerSeeds;
  const { HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS } = stationSeeds;
  const ashlineOwner = HARTHMERE_BUSINESS_OWNER_NPC_SEEDS.find(
    (seed) => seed.outpostId === "outpost_refinery_ashline"
  );
  const ashlineStation = HARTHMERE_BUSINESS_CRAFTING_STATION_SEEDS.find(
    (seed) => seed.outpostId === "outpost_refinery_ashline"
  );
  if (!ashlineOwner || !ashlineStation) {
    throw new Error("Ashline refinery ECS seeds are unavailable");
  }
  const station = ashlineStation.position;
  // Stage the impact in Ashline's open work yard, while the cast and business
  // identity still come from the exact seeded owner/Thermoblaster records. The
  // actor remains the real Calla ECS entity, but clientPuppet mode keeps
  // Anima/Gaia authoritative state untouched for this local promotional frame.
  const workerAt: [number, number, number] = [
    ashlineOwner.position[0] + 1.8,
    station[1],
    ashlineOwner.position[2] - 11.7,
  ];
  const core: [number, number, number] = [
    ashlineOwner.position[0] + 0.5,
    station[1] + 1.2,
    ashlineOwner.position[2] - 10.5,
  ];
  return {
    id: "promo-exotic-matter-creation",
    name: "Exotic Matter Creation Promotional Still",
    version: 1,
    priority: 100_000,
    settings: {
      skippable: false,
      skipAfterSeconds: 20,
      lockPlayer: false,
      hideHud: true,
      letterbox: false,
      invulnerablePlayer: false,
      timeOfDay: 0.72,
      mode: "clientPuppet" as const,
      prewarmTimeoutSeconds: 10,
      commitOn: [],
      maxSceneDurationSeconds: 20,
    },
    cast: [
      {
        role: "worker",
        binding: {
          kind: "entity" as const,
          entityId: Number(ashlineOwner.entityId),
        },
        required: true,
      },
      {
        role: "matterCore",
        binding: {
          kind: "anchor" as const,
          position: core,
          height: 2.2,
          label: "Newly Stabilized Exotic Matter",
        },
      },
    ],
    shots: [
      {
        id: "creation",
        duration: 6,
        camera: {
          kind: "dolly" as const,
          waypoints: [
            { position: [core[0] + 6.2, core[1] + 1.8, core[2] + 5.6] },
            { position: [core[0] + 5.5, core[1] + 1.4, core[2] + 4.9] },
            { position: [core[0] + 4.8, core[1] + 1.1, core[2] + 4.2] },
          ],
          lookAtRole: "matterCore",
          easing: "easeInOut" as const,
        },
        actions: [
          { kind: "fov" as const, at: 0, fov: 34 },
          {
            kind: "teleport" as const,
            at: 0,
            role: "worker",
            to: workerAt,
          },
          {
            kind: "face" as const,
            at: 0,
            role: "worker",
            towards: { role: "matterCore" },
          },
          {
            kind: "holdItem" as const,
            at: 0,
            role: "worker",
            itemId: Number(BikkieIds.pickaxe),
          },
          {
            kind: "emote" as const,
            // Start the tool loop shortly before the energy burst so the
            // default capture lands near the authored mining-impact frame.
            at: 2.15,
            role: "worker",
            emote: "smithWork" as const,
          },
          {
            kind: "vfx" as const,
            at: 2.7,
            effect: "exoticMatterCreation" as const,
            atRole: "matterCore",
          },
          {
            kind: "shake" as const,
            at: 3.5,
            magnitude: 0.025,
            repeats: 4,
            durationMs: 650,
          },
        ],
      },
    ],
    onEnd: { placements: [], commits: [] },
  };
}

/**
 * Runs only for the explicit local promo query; normal gameplay is untouched.
 *
 * SCENE SELECTION IS DATA. `?cutscenePromo=<id>` is looked up in
 * `@/shared/cutscene/promo_scenes`. Adding a still means adding a registry
 * entry, not editing this hook — the previous version hardcoded the id,
 * subtitle, filename, shot id, and captureAt ceiling, so every new still was
 * a client code change. See promo_scenes.ts for the framing lessons.
 *
 * The legacy `exotic-matter` id keeps its bespoke builder below for
 * compatibility with the reference URLs already in docs/cutscenes.md.
 */
export function useCutscenePromoCapture(
  clientContext: ClientContext | null
): void {
  const started = useRef(false);
  useEffect(() => {
    if (!clientContext || started.current || typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    const promoId = params.get("cutscenePromo");
    const promoBatch = params.get("cutscenePromoBatch");
    if (!promoId && !promoBatch) {
      return;
    }
    started.current = true;
    publishPromoCapture({ status: "pending" });
    void (async () => {
      let initialStreamingObserver: PromoStreamingSnapshot | undefined;
      try {
        await waitForEngineCaptureReady(120_000);
        // Give streamed ECS/placeable assets one extra beat after the renderer
        // readiness gate before the cutscene's own shard prewarm begins.
        await sleep(1_500);
        initialStreamingObserver = promoStreamingSnapshot();

        const {
          promoSceneById,
          promoCaptureAt,
          promoSceneWithBossCameraPreset,
          promoSceneWithRecommendedBossCamera,
          promoScenesInGroup,
        } = await import("@/shared/cutscene/promo_scenes");
        const registeredBase = promoId ? promoSceneById(promoId) : undefined;
        const registered = registeredBase
          ? promoSceneWithBossCameraPreset(
              registeredBase,
              params.get("cameraPreset")
            )
          : undefined;

        const captureRegistered = async (
          scene: NonNullable<ReturnType<typeof promoSceneById>>,
          captureAtOverride: string | null
        ): Promise<PromoCaptureRecord> => {
          await stagePromoStreamingObserver(
            scene.streamingFocus ?? scene.observer.position
          );
          await waitForPromoRuntimeScenery(
            scene.runtimeScenery,
            scene.streamingFocus ?? scene.observer.position
          );
          await waitForPromoTerrainProofs(
            clientContext.resources,
            scene.terrainProofs
          );
          await waitForPromoTerrainView(
            clientContext.resources,
            scene.terrainView
          );
          await waitForPromoCameraTerrainClearance(
            clientContext.resources,
            scene.cameraClearance
          );
          const definition = await scene.build();
          const capture = await requestCutsceneScreenshot(definition, {
            shotId: scene.shotId,
            at: promoCaptureAt(scene, captureAtOverride),
            width: 1920,
            height: 1080,
            format: "image/png",
            filename: scene.filename,
            preempt: true,
            timeoutMs: 150_000,
          });
          return {
            sceneId: scene.id,
            cameraPreset: scene.cameraPreset ?? "baseline",
            dataUri: await addBiomesBrand(capture.dataUri, scene.brand),
            rawDataUri: capture.dataUri,
            filename: capture.filename,
            cameraPosition: capture.cameraPosition,
            cameraOrientation: capture.cameraOrientation,
          };
        };

        // --- warm-page batch path --------------------------------------
        // One game boot, one renderer, many cutscene captures. This is the
        // release-proof path for all sectors and avoids paying a full Next +
        // WebGL + ECS bootstrap seventeen times.
        if (promoBatch) {
          if (params.has("cameraPreset")) {
            throw new Error(
              "cameraPreset is a single-scene review control and cannot be used with cutscenePromoBatch"
            );
          }
          const bossCameraPlan = params.get("bossCameraPlan");
          if (bossCameraPlan && bossCameraPlan !== "recommended") {
            throw new Error(`unknown bossCameraPlan "${bossCameraPlan}"`);
          }
          const baseScenes = promoScenesInGroup(promoBatch);
          const scenes =
            bossCameraPlan === "recommended"
              ? baseScenes.map(promoSceneWithRecommendedBossCamera)
              : baseScenes;
          if (scenes.length === 0) {
            throw new Error(
              `unknown or empty cutscenePromoBatch "${promoBatch}"`
            );
          }
          const captures: PromoCaptureRecord[] = [];
          for (let index = 0; index < scenes.length; index += 1) {
            const scene = scenes[index]!;
            publishPromoCapture({
              status: "pending",
              completed: captures.length,
              total: scenes.length,
              current: scene.id,
            });
            const record = await captureRegistered(scene, null);
            await persistPromoStill(record);
            captures.push(record);
            // Let texture disposal, React, and streamed resources settle before
            // prewarming the next distant sector.
            await sleep(250);
          }
          const last = captures[captures.length - 1]!;
          publishPromoCapture({ status: "complete", ...last, captures });
          return;
        }

        // --- registry path ---------------------------------------------
        if (registered) {
          const record = await captureRegistered(
            registered,
            params.get("captureAt")
          );
          if (params.get("capturePersist") === "1") {
            await persistPromoStill(record);
          }
          publishPromoCapture({ status: "complete", ...record });
          return;
        }

        // --- legacy bespoke scene --------------------------------------
        if (promoId !== "exotic-matter") {
          throw new Error(
            `unknown cutscenePromo "${promoId}". Registered stills: ` +
              `see PROMO_SCENES in @/shared/cutscene/promo_scenes.`
          );
        }
        const captureAtParam = params.get("captureAt");
        // Number(null) is zero, so distinguish an omitted/blank query from an
        // intentional captureAt=0 before parsing and clamping the art override.
        const requestedCaptureAt =
          captureAtParam === null || captureAtParam.trim() === ""
            ? undefined
            : Number(captureAtParam);
        const captureAt =
          requestedCaptureAt !== undefined &&
          Number.isFinite(requestedCaptureAt)
            ? Math.min(5.9, Math.max(0, requestedCaptureAt))
            : 3.1;
        const capture = await requestCutsceneScreenshot(
          await exoticMatterCreationScene(),
          {
            shotId: "creation",
            at: captureAt,
            width: 1920,
            height: 1080,
            format: "image/png",
            filename: "biomes-exotic-matter-creation.png",
            preempt: true,
            timeoutMs: 150_000,
          }
        );
        const dataUri = await addBiomesBrand(capture.dataUri, {
          title: "Biomes",
          subtitle: "EXOTIC MATTER // ASHLINE CONTAINMENT WORKS",
        });
        publishPromoCapture({
          status: "complete",
          sceneId: "exotic-matter",
          cameraPreset: "legacy",
          dataUri,
          rawDataUri: capture.dataUri,
          filename: capture.filename,
          cameraPosition: capture.cameraPosition,
          cameraOrientation: capture.cameraOrientation,
        });
      } catch (error) {
        publishPromoCapture({
          status: "error",
          error: error instanceof Error ? error.message : String(error),
        });
      } finally {
        await restorePromoStreamingObserver(initialStreamingObserver);
      }
    })();
  }, [clientContext]);
}
