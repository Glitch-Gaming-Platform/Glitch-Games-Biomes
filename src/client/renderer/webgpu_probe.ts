export type WebGpuProbeStatus =
  | "unsupported"
  | "insecure-context"
  | "no-adapter"
  | "available"
  | "smoke-passed"
  | "failed";

export interface WebGpuProbeResult {
  status: WebGpuProbeStatus;
  available: boolean;
  adapter?: {
    architecture?: string;
    description?: string;
    device?: string;
    vendor?: string;
    features: string[];
  };
  error?: string;
}

type ThreeWebGpuModule = typeof import("three/webgpu");

export interface WebGpuProbeOptions {
  smokeRender?: boolean;
  secureContext?: boolean;
  gpu?: GPU;
  createCanvas?: () => HTMLCanvasElement;
  loadThreeWebGpu?: () => Promise<ThreeWebGpuModule>;
}

function adapterDetails(adapter: GPUAdapter) {
  const info = adapter.info;
  return {
    architecture: info?.architecture || undefined,
    description: info?.description || undefined,
    device: info?.device || undefined,
    vendor: info?.vendor || undefined,
    features: [...adapter.features].map(String).sort(),
  };
}

export async function probeWebGpuSupport(
  options: WebGpuProbeOptions = {}
): Promise<WebGpuProbeResult> {
  const secureContext = options.secureContext ?? globalThis.isSecureContext;
  const gpu =
    options.gpu ??
    (typeof navigator === "undefined" ? undefined : navigator.gpu);

  if (!gpu) {
    return { status: "unsupported", available: false };
  }
  if (!secureContext) {
    return { status: "insecure-context", available: false };
  }

  try {
    const adapter = await gpu.requestAdapter({
      powerPreference: "high-performance",
    });
    if (!adapter) {
      return { status: "no-adapter", available: false };
    }

    const details = adapterDetails(adapter);
    if (!options.smokeRender) {
      return { status: "available", available: true, adapter: details };
    }

    const three = await (options.loadThreeWebGpu ??
      (() => import("three/webgpu")))();
    const canvas = (options.createCanvas ??
      (() => document.createElement("canvas")))();
    const renderer = new three.WebGPURenderer({
      alpha: true,
      antialias: false,
      canvas,
      powerPreference: "high-performance",
    });
    const geometry = new three.BoxGeometry(1, 1, 1);
    const material = new three.MeshBasicMaterial({ color: 0x80a0ff });
    try {
      await renderer.init();
      if (
        !(renderer.backend as unknown as { isWebGPUBackend?: boolean })
          .isWebGPUBackend
      ) {
        throw new Error("Three.js initialized a non-WebGPU fallback backend");
      }
      renderer.setSize(2, 2, false);
      const scene = new three.Scene();
      const camera = new three.PerspectiveCamera(60, 1, 0.1, 10);
      camera.position.z = 2;
      scene.add(new three.Mesh(geometry, material));
      renderer.render(scene, camera);
    } finally {
      geometry.dispose();
      material.dispose();
      renderer.dispose();
    }

    return { status: "smoke-passed", available: true, adapter: details };
  } catch (error) {
    return {
      status: "failed",
      available: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
