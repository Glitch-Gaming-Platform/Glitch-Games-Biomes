import { requestCutsceneScreenshot } from "@/client/game/cutscene/capture_service";
import { sleep } from "@/shared/util/async";
import { useEffect, useRef } from "react";

type PromoCaptureStatus =
  | { status: "pending" }
  | {
      status: "complete";
      dataUri: string;
      rawDataUri: string;
      filename: string;
      cameraPosition: [number, number, number];
      cameraOrientation: [number, number];
    }
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

async function addBiomesBrand(dataUri: string): Promise<string> {
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
  const titleSize = Math.round(width * 0.072);
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
  context.fillText("Biomes", margin, Math.round(height * 0.065));

  context.shadowBlur = Math.round(subtitleSize * 0.4);
  context.fillStyle = "rgba(220, 250, 255, 0.95)";
  context.font = `700 ${subtitleSize}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  context.fillText(
    "EXOTIC MATTER // ASHLINE CONTAINMENT WORKS",
    margin + Math.round(titleSize * 0.04),
    Math.round(height * 0.065) + Math.round(titleSize * 1.08)
  );
  context.shadowBlur = 0;
  return canvas.toDataURL("image/png");
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

/** Runs only for the explicit local promo query; normal gameplay is untouched. */
export function useCutscenePromoCapture(enabled: boolean): void {
  const started = useRef(false);
  useEffect(() => {
    if (!enabled || started.current || typeof window === "undefined") {
      return;
    }
    const params = new URLSearchParams(window.location.search);
    if (params.get("cutscenePromo") !== "exotic-matter") {
      return;
    }
    started.current = true;
    publishPromoCapture({ status: "pending" });
    void (async () => {
      try {
        await waitForEngineCaptureReady(120_000);
        // Give streamed ECS/placeable assets one extra beat after the renderer
        // readiness gate before the cutscene's own shard prewarm begins.
        await sleep(1_500);
        // captureAt is intentionally query-tunable: art direction can bracket
        // an animation's impact frame without recompiling or editing the scene.
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
        const dataUri = await addBiomesBrand(capture.dataUri);
        publishPromoCapture({
          status: "complete",
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
      }
    })();
  }, [enabled]);
}
