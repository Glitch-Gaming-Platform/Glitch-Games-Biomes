import { connectToRedis } from "@/server/shared/redis/connection";
import { log } from "@/shared/logging";
import { exec as execWithCallback } from "child_process";
import { createHash } from "crypto";
import { mkdir, readFile, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import vm from "vm";

const exec = promisify(execWithCallback);

export const GLITCH_MUTABLE_HOTFIX_REDIS_KEY = "glitch:mutable_hotfix:current";

type JsonMap = Record<string, any>;

export type GlitchMutableHotfixOperation =
  | {
      type: "writeFile";
      path: string;
      content?: string;
      contentBase64?: string;
      encoding?: BufferEncoding;
      mode?: number;
    }
  | {
      type: "replace";
      path: string;
      search: string;
      replace: string;
      searchMode?: "literal" | "regex";
      flags?: string;
      expectCount?: number;
      minCount?: number;
      allowNoop?: boolean;
    }
  | { type: "deleteFile"; path: string; allowMissing?: boolean }
  | { type: "mkdir"; path: string }
  | {
      type: "exec";
      command: string;
      cwd?: string;
      timeoutMs?: number;
      env?: Record<string, string>;
    }
  | {
      type: "eval";
      code: string;
      filename?: string;
      timeoutMs?: number;
    }
  | {
      type: "clearRequireCache";
      match?: string;
      path?: string;
    };

export interface GlitchMutableHotfixManifest {
  version: string;
  description?: string;
  createdAt?: string;
  operations: GlitchMutableHotfixOperation[];
  restart?: {
    exitProcess?: boolean;
    delayMs?: number;
    code?: number;
  };
}

export interface GlitchMutableHotfixOperationResult {
  index: number;
  type: string;
  target?: string;
  changed?: boolean;
  count?: number;
  stdout?: string;
  stderr?: string;
  cleared?: number;
}

export interface GlitchMutableHotfixApplyResult {
  ok: true;
  version: string;
  hash: string;
  appliedAtMs: number;
  operations: GlitchMutableHotfixOperationResult[];
  restartScheduled?: boolean;
}

interface GlitchMutableHotfixRuntimeState {
  lastAppliedVersion?: string;
  lastAppliedHash?: string;
  lastAppliedAtMs?: number;
  lastCheckedRedisAtMs?: number;
  lastError?: string;
  lastResult?: GlitchMutableHotfixApplyResult;
  applying?: Promise<GlitchMutableHotfixApplyResult | undefined>;
}

const globalForMutableHotfix = globalThis as typeof globalThis & {
  __glitchMutableHotfixState?: GlitchMutableHotfixRuntimeState;
  __glitchMutableHotfixRedis?: Awaited<ReturnType<typeof connectToRedis>>;
};

function runtimeState() {
  return (globalForMutableHotfix.__glitchMutableHotfixState ??= {});
}

export function glitchMutableHotfixEnabled() {
  return (
    process.env.GLITCH_MUTABLE_HOTFIX_ENABLED === "1" ||
    process.env.GLITCH_MUTABLE_HOTFIX_OPEN === "1"
  );
}

function rootDir() {
  return process.env.GLITCH_MUTABLE_HOTFIX_ROOT || process.cwd();
}

function resolveMutableHotfixPath(targetPath: string) {
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.resolve(rootDir(), targetPath);
}

function stableManifestString(manifest: GlitchMutableHotfixManifest) {
  return JSON.stringify(manifest);
}

export function hashGlitchMutableHotfixManifest(
  manifest: GlitchMutableHotfixManifest
) {
  return createHash("sha256")
    .update(stableManifestString(manifest))
    .digest("hex");
}

function decodeHotfixContent(operation: {
  content?: string;
  contentBase64?: string;
  encoding?: BufferEncoding;
}) {
  if (operation.contentBase64 !== undefined) {
    return Buffer.from(operation.contentBase64, "base64");
  }
  return operation.content ?? "";
}

function replaceLiteralAll(input: string, search: string, replacement: string) {
  if (!search) {
    throw new Error("mutable_hotfix_replace_rejected:empty_literal_search");
  }
  const parts = input.split(search);
  const count = parts.length - 1;
  const output = parts.join(replacement);
  return { output, count };
}

function replaceContent(
  input: string,
  operation: Extract<GlitchMutableHotfixOperation, { type: "replace" }>
) {
  if (operation.searchMode === "regex") {
    const flags = operation.flags ?? "g";
    const regex = new RegExp(operation.search, flags);
    let count = 0;
    const output = input.replace(regex, () => {
      count += 1;
      return operation.replace;
    });
    return { output, count };
  }

  return replaceLiteralAll(input, operation.search, operation.replace);
}

function assertExpectedReplacementCount(
  operation: Extract<GlitchMutableHotfixOperation, { type: "replace" }>,
  count: number
) {
  if (operation.expectCount !== undefined && count !== operation.expectCount) {
    throw new Error(
      `mutable_hotfix_replace_count_mismatch:${operation.path}:expected_${operation.expectCount}:actual_${count}`
    );
  }
  if (operation.minCount !== undefined && count < operation.minCount) {
    throw new Error(
      `mutable_hotfix_replace_count_below_min:${operation.path}:min_${operation.minCount}:actual_${count}`
    );
  }
  if (
    !operation.allowNoop &&
    operation.expectCount === undefined &&
    count <= 0
  ) {
    throw new Error(`mutable_hotfix_replace_noop:${operation.path}`);
  }
}

function runtimeRequireCache() {
  return typeof require === "function" ? require.cache : undefined;
}

function clearRequireCache(
  operation: Extract<
    GlitchMutableHotfixOperation,
    { type: "clearRequireCache" }
  >
) {
  const cache = runtimeRequireCache();
  if (!cache) return 0;
  const matchPath = operation.path
    ? resolveMutableHotfixPath(operation.path)
    : undefined;
  const matchText = operation.match;
  let cleared = 0;
  for (const key of Object.keys(cache)) {
    if (matchPath && path.normalize(key) !== matchPath) continue;
    if (matchText && !key.includes(matchText)) continue;
    if (!matchPath && !matchText) continue;
    delete cache[key];
    cleared += 1;
  }
  return cleared;
}

async function applyOperation(
  operation: GlitchMutableHotfixOperation,
  index: number
): Promise<GlitchMutableHotfixOperationResult> {
  switch (operation.type) {
    case "writeFile": {
      const target = resolveMutableHotfixPath(operation.path);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, decodeHotfixContent(operation), {
        encoding:
          operation.contentBase64 === undefined
            ? operation.encoding ?? "utf8"
            : undefined,
        mode: operation.mode,
      } as any);
      return { index, type: operation.type, target, changed: true };
    }
    case "replace": {
      const target = resolveMutableHotfixPath(operation.path);
      const before = await readFile(target, "utf8");
      const { output, count } = replaceContent(before, operation);
      assertExpectedReplacementCount(operation, count);
      if (output !== before) {
        await writeFile(target, output, "utf8");
      }
      return {
        index,
        type: operation.type,
        target,
        changed: output !== before,
        count,
      };
    }
    case "deleteFile": {
      const target = resolveMutableHotfixPath(operation.path);
      const exists = await stat(target)
        .then(() => true)
        .catch(() => false);
      if (!exists && !operation.allowMissing) {
        throw new Error(`mutable_hotfix_delete_missing:${operation.path}`);
      }
      if (exists) {
        await rm(target, { force: true, recursive: true });
      }
      return { index, type: operation.type, target, changed: exists };
    }
    case "mkdir": {
      const target = resolveMutableHotfixPath(operation.path);
      await mkdir(target, { recursive: true });
      return { index, type: operation.type, target, changed: true };
    }
    case "exec": {
      const { stdout, stderr } = await exec(operation.command, {
        cwd: operation.cwd
          ? resolveMutableHotfixPath(operation.cwd)
          : rootDir(),
        timeout: operation.timeoutMs ?? 30_000,
        env: { ...process.env, ...(operation.env ?? {}) },
        maxBuffer: 10 * 1024 * 1024,
      });
      return {
        index,
        type: operation.type,
        target: operation.command,
        changed: true,
        stdout,
        stderr,
      };
    }
    case "eval": {
      const sandbox: JsonMap = {
        Buffer,
        console,
        globalThis,
        process,
        require,
        setInterval,
        setTimeout,
        clearInterval,
        clearTimeout,
        __dirname: rootDir(),
      };
      vm.runInNewContext(operation.code, sandbox, {
        filename: operation.filename ?? `glitch-mutable-hotfix-${index}.js`,
        timeout: operation.timeoutMs ?? 10_000,
      });
      return { index, type: operation.type, changed: true };
    }
    case "clearRequireCache": {
      const cleared = clearRequireCache(operation);
      return {
        index,
        type: operation.type,
        target: operation.path ?? operation.match,
        changed: cleared > 0,
        cleared,
      };
    }
    default:
      throw new Error(
        `mutable_hotfix_unknown_operation:${(operation as any).type}`
      );
  }
}

export function normalizeGlitchMutableHotfixManifest(
  input: unknown
): GlitchMutableHotfixManifest {
  if (!input || typeof input !== "object") {
    throw new Error("mutable_hotfix_manifest_invalid:not_object");
  }
  const manifest = input as GlitchMutableHotfixManifest;
  if (!manifest.version || typeof manifest.version !== "string") {
    throw new Error("mutable_hotfix_manifest_invalid:missing_version");
  }
  if (!Array.isArray(manifest.operations)) {
    throw new Error("mutable_hotfix_manifest_invalid:missing_operations");
  }
  return manifest;
}

export async function applyGlitchMutableHotfixManifest(
  rawManifest: unknown,
  options: { force?: boolean } = {}
): Promise<GlitchMutableHotfixApplyResult> {
  const manifest = normalizeGlitchMutableHotfixManifest(rawManifest);
  const state = runtimeState();
  const hash = hashGlitchMutableHotfixManifest(manifest);
  if (
    !options.force &&
    state.lastAppliedVersion === manifest.version &&
    state.lastAppliedHash === hash
  ) {
    return state.lastResult as GlitchMutableHotfixApplyResult;
  }
  const operations: GlitchMutableHotfixOperationResult[] = [];
  for (const [index, operation] of manifest.operations.entries()) {
    operations.push(await applyOperation(operation, index));
  }
  const result: GlitchMutableHotfixApplyResult = {
    ok: true,
    version: manifest.version,
    hash,
    appliedAtMs: Date.now(),
    operations,
  };
  state.lastAppliedVersion = manifest.version;
  state.lastAppliedHash = hash;
  state.lastAppliedAtMs = result.appliedAtMs;
  state.lastError = undefined;
  state.lastResult = result;
  log.warn("GLITCH_MUTABLE_HOTFIX_APPLIED", {
    version: result.version,
    hash: result.hash,
    operationCount: operations.length,
  });
  if (manifest.restart?.exitProcess) {
    result.restartScheduled = true;
    const delayMs = Math.max(0, manifest.restart.delayMs ?? 250);
    const code = manifest.restart.code ?? 75;
    setTimeout(() => process.exit(code), delayMs).unref();
  }
  return result;
}

export function getGlitchMutableHotfixStatus() {
  const state = runtimeState();
  return {
    enabled: glitchMutableHotfixEnabled(),
    redisKey:
      process.env.GLITCH_MUTABLE_HOTFIX_REDIS_KEY ??
      GLITCH_MUTABLE_HOTFIX_REDIS_KEY,
    root: rootDir(),
    lastAppliedVersion: state.lastAppliedVersion,
    lastAppliedHash: state.lastAppliedHash,
    lastAppliedAtMs: state.lastAppliedAtMs,
    lastCheckedRedisAtMs: state.lastCheckedRedisAtMs,
    lastError: state.lastError,
    lastResult: state.lastResult,
  };
}

async function mutableHotfixRedis() {
  return (globalForMutableHotfix.__glitchMutableHotfixRedis ??=
    await connectToRedis("firehose"));
}

export async function readGlitchMutableHotfixManifestFromRedis(
  redisKey = process.env.GLITCH_MUTABLE_HOTFIX_REDIS_KEY ??
    GLITCH_MUTABLE_HOTFIX_REDIS_KEY
) {
  const redis = await mutableHotfixRedis();
  const raw = await redis.primary.get(redisKey);
  if (!raw) return undefined;
  return normalizeGlitchMutableHotfixManifest(JSON.parse(raw));
}

export async function persistGlitchMutableHotfixManifestToRedis(
  manifest: GlitchMutableHotfixManifest,
  redisKey = process.env.GLITCH_MUTABLE_HOTFIX_REDIS_KEY ??
    GLITCH_MUTABLE_HOTFIX_REDIS_KEY
) {
  normalizeGlitchMutableHotfixManifest(manifest);
  const redis = await mutableHotfixRedis();
  await redis.primary.set(redisKey, JSON.stringify(manifest));
  return {
    ok: true,
    redisKey,
    version: manifest.version,
    hash: hashGlitchMutableHotfixManifest(manifest),
  };
}

export async function clearGlitchMutableHotfixManifestFromRedis(
  redisKey = process.env.GLITCH_MUTABLE_HOTFIX_REDIS_KEY ??
    GLITCH_MUTABLE_HOTFIX_REDIS_KEY
) {
  const redis = await mutableHotfixRedis();
  await redis.primary.del(redisKey);
  return { ok: true, redisKey };
}

export async function loadGlitchMutableHotfixManifestFromUrl(url: string) {
  const response = await fetch(url, { cache: "no-store" });
  if (!response.ok) {
    throw new Error(`mutable_hotfix_url_failed:${response.status}`);
  }
  return normalizeGlitchMutableHotfixManifest(await response.json());
}

export function decodeGlitchMutableHotfixManifestBase64(value: string) {
  return normalizeGlitchMutableHotfixManifest(
    JSON.parse(Buffer.from(value, "base64").toString("utf8"))
  );
}

export async function applyConfiguredGlitchMutableHotfix(
  options: {
    force?: boolean;
  } = {}
) {
  if (!glitchMutableHotfixEnabled()) return undefined;
  const state = runtimeState();
  if (state.applying) return state.applying;
  state.applying = (async () => {
    try {
      const manifest = process.env.GLITCH_MUTABLE_HOTFIX_MANIFEST_BASE64
        ? decodeGlitchMutableHotfixManifestBase64(
            process.env.GLITCH_MUTABLE_HOTFIX_MANIFEST_BASE64
          )
        : process.env.GLITCH_MUTABLE_HOTFIX_MANIFEST_URL
        ? await loadGlitchMutableHotfixManifestFromUrl(
            process.env.GLITCH_MUTABLE_HOTFIX_MANIFEST_URL
          )
        : await readGlitchMutableHotfixManifestFromRedis();
      state.lastCheckedRedisAtMs = Date.now();
      if (!manifest) return undefined;
      return await applyGlitchMutableHotfixManifest(manifest, options);
    } catch (error) {
      state.lastError = error instanceof Error ? error.message : String(error);
      log.error("GLITCH_MUTABLE_HOTFIX_APPLY_FAILED", { error });
      throw error;
    } finally {
      state.applying = undefined;
    }
  })();
  return state.applying;
}

export async function maybeApplyGlitchMutableHotfixFromRedis() {
  if (!glitchMutableHotfixEnabled()) return undefined;
  const state = runtimeState();
  const pollMs = Math.max(
    250,
    Number(process.env.GLITCH_MUTABLE_HOTFIX_POLL_MS ?? 5_000)
  );
  if (
    state.lastCheckedRedisAtMs &&
    Date.now() - state.lastCheckedRedisAtMs < pollMs
  ) {
    return state.lastResult;
  }
  return applyConfiguredGlitchMutableHotfix();
}
