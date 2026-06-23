/* eslint-disable @next/next/no-assign-module-variable */
import wasmLoader from "@/gen/shared/cpp_ext/voxeloo-simd/wasm";
import { log, setVoxelooForExceptionReporting } from "@/shared/logging";
import { makeWasmMemory } from "@/shared/wasm/memory";
import type { VoxelooModule } from "@/shared/wasm/types";
import { readFile } from "fs/promises";
import path from "path";

const DEFAULT_SERVER_WASM_MEMORY = 1048;

function getWasmMemoryMb() {
  if (process.env.WASM_MEMORY) {
    return parseInt(process.env.WASM_MEMORY);
  } else {
    return DEFAULT_SERVER_WASM_MEMORY;
  }
}

let loadedVoxeloo: VoxelooModule | undefined;

async function readFirstExistingWasmFile(paths: string[]) {
  let lastError: unknown;
  for (const wasmFile of paths) {
    try {
      return await readFile(wasmFile);
    } catch (error: any) {
      if (error?.code !== "ENOENT") {
        throw error;
      }
      lastError = error;
    }
  }
  throw lastError;
}

export async function loadVoxeloo(): Promise<VoxelooModule> {
  if (loadedVoxeloo) {
    return loadedVoxeloo;
  }
  const wasmFile = path.resolve(
    __dirname,
    "../../gen/shared/cpp_ext/voxeloo-simd/wasm.wasm"
  );
  const packagedWasmFile = path.resolve(
    process.cwd(),
    "src/gen/shared/cpp_ext/voxeloo-simd/wasm.wasm"
  );
  const distWasmFile = path.resolve(
    process.cwd(),
    "dist/gen/shared/cpp_ext/voxeloo-simd/wasm.wasm"
  );

  const module = await wasmLoader({
    // Next's server bundle can execute from .next/server, making the original
    // relative path resolve to /app/.next/gen. The packaged Glitch image keeps
    // the generated wasm under /app/src/gen, while the standalone server build
    // keeps it under /app/dist/gen.
    wasmBinary: await readFirstExistingWasmFile([
      wasmFile,
      packagedWasmFile,
      distWasmFile,
    ]),
    wasmMemory: makeWasmMemory(getWasmMemoryMb()),
    printErr: (error: string) => {
      log.error(`ERROR[Voxeloo]: "${error}"`, { error });
    },
  });
  setVoxelooForExceptionReporting(module);

  module.registerErrorLogger((error: string) => {
    log.error(`Error in voxeloo: "${error}"`);
  });
  log.info("Loaded WASM");
  loadedVoxeloo = module as VoxelooModule;
  return module as VoxelooModule;
}
