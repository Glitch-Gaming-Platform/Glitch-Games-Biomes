import {
  probeWebGpuSupport,
  type WebGpuProbeOptions,
} from "@/client/renderer/webgpu_probe";
import assert from "assert";

function fakeAdapter(): GPUAdapter {
  return {
    features: new Set(["timestamp-query"]),
    info: {
      architecture: "test-arch",
      description: "Test GPU",
      device: "test-device",
      vendor: "test-vendor",
    },
  } as unknown as GPUAdapter;
}

function fakeGpu(adapter: GPUAdapter | null): GPU {
  return {
    requestAdapter: async () => adapter,
  } as unknown as GPU;
}

describe("WebGPU capability probe", () => {
  it("reports unsupported and insecure contexts without importing Three", async () => {
    assert.deepEqual(
      await probeWebGpuSupport({ secureContext: true }),
      { status: "unsupported", available: false }
    );
    assert.deepEqual(
      await probeWebGpuSupport({
        secureContext: false,
        gpu: fakeGpu(fakeAdapter()),
      }),
      { status: "insecure-context", available: false }
    );
  });

  it("reports a missing high-performance adapter", async () => {
    assert.deepEqual(
      await probeWebGpuSupport({ secureContext: true, gpu: fakeGpu(null) }),
      { status: "no-adapter", available: false }
    );
  });

  it("captures adapter capabilities without changing the active renderer", async () => {
    const result = await probeWebGpuSupport({
      secureContext: true,
      gpu: fakeGpu(fakeAdapter()),
    });
    assert.deepEqual(result, {
      status: "available",
      available: true,
      adapter: {
        architecture: "test-arch",
        description: "Test GPU",
        device: "test-device",
        vendor: "test-vendor",
        features: ["timestamp-query"],
      },
    });
  });

  it("requires an actual Three WebGPU backend for the opt-in smoke", async () => {
    let disposed = 0;
    class FakeRenderer {
      backend = { isWebGPUBackend: true };
      async init() {}
      setSize() {}
      render() {}
      dispose() {
        disposed += 1;
      }
    }
    class Disposable {
      dispose() {
        disposed += 1;
      }
    }
    class Scene {
      add() {}
    }
    class PerspectiveCamera {
      position = { z: 0 };
    }
    const fakeThree = {
      WebGPURenderer: FakeRenderer,
      BoxGeometry: Disposable,
      MeshBasicMaterial: Disposable,
      Scene,
      PerspectiveCamera,
      Mesh: class {},
    } as unknown as Awaited<
      ReturnType<NonNullable<WebGpuProbeOptions["loadThreeWebGpu"]>>
    >;

    const result = await probeWebGpuSupport({
      secureContext: true,
      gpu: fakeGpu(fakeAdapter()),
      smokeRender: true,
      createCanvas: () => ({}) as HTMLCanvasElement,
      loadThreeWebGpu: async () => fakeThree,
    });
    assert.equal(result.status, "smoke-passed");
    assert.equal(result.available, true);
    assert.equal(disposed, 3);
  });
});
