import { connectToRedis } from "@/server/shared/redis/connection";
import { log } from "@/shared/logging";
import { exec as execWithCallback } from "child_process";
import { createHash, randomUUID } from "crypto";
import { mkdir, readFile, rename, rm, stat, writeFile } from "fs/promises";
import path from "path";
import { promisify } from "util";
import vm from "vm";
import type { GlitchMutableHotfixClientPayload } from "./mutable_hotfix_client";
import { decodeGlitchMutableHotfixClientPayload } from "./mutable_hotfix_client";

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
      expectedPreviousSha256?: string;
      expectedSha256?: string;
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
      expectedPreviousSha256?: string;
      expectedSha256?: string;
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
  expiresAt?: string;
  compatibleBuildIds?: string[];
  targetRoles?: Array<"unified" | "web" | "simulation">;
  operations: GlitchMutableHotfixOperation[];
  client?: GlitchMutableHotfixClientPayload;
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
  applied: boolean;
  version: string;
  hash: string;
  appliedAtMs: number;
  operations: GlitchMutableHotfixOperationResult[];
  skippedReason?: "expired" | "incompatible_build" | "incompatible_role";
  restartScheduled?: boolean;
}

export interface GlitchMutableHotfixCompatibility {
  applicable: boolean;
  reason?: GlitchMutableHotfixApplyResult["skippedReason"];
  buildId: string;
  role: string;
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

function stateFilePath() {
  return (
    process.env.GLITCH_MUTABLE_HOTFIX_STATE_FILE ||
    path.resolve(rootDir(), ".glitch-mutable-hotfix-state.json")
  );
}

function currentBuildId() {
  return String(
    process.env.BIOMES_BUILD_ID ?? process.env.BUILD_ID ?? "unknown"
  ).trim();
}

function currentRole() {
  return String(process.env.GLITCH_STACK_ROLE ?? "unified").trim();
}

function resolveMutableHotfixPath(targetPath: string) {
  return path.isAbsolute(targetPath)
    ? path.normalize(targetPath)
    : path.resolve(rootDir(), targetPath);
}

function stableManifestString(manifest: GlitchMutableHotfixManifest) {
  return JSON.stringify(manifest);
}

function sha256(value: string | Buffer) {
  return createHash("sha256").update(value).digest("hex");
}

export function hashGlitchMutableHotfixManifest(
  manifest: GlitchMutableHotfixManifest
) {
  return sha256(stableManifestString(manifest));
}

export function glitchMutableHotfixCompatibility(
  manifest: GlitchMutableHotfixManifest,
  options: { ignoreRole?: boolean } = {}
): GlitchMutableHotfixCompatibility {
  const buildId = currentBuildId();
  const role = currentRole();
  if (manifest.expiresAt) {
    const expiresAtMs = Date.parse(manifest.expiresAt);
    if (!Number.isFinite(expiresAtMs) || expiresAtMs <= Date.now()) {
      return { applicable: false, reason: "expired", buildId, role };
    }
  }
  if (
    manifest.compatibleBuildIds?.length &&
    !manifest.compatibleBuildIds.includes(buildId)
  ) {
    return {
      applicable: false,
      reason: "incompatible_build",
      buildId,
      role,
    };
  }
  if (
    !options.ignoreRole &&
    manifest.targetRoles?.length &&
    !manifest.targetRoles.includes(role as "unified" | "web" | "simulation")
  ) {
    return {
      applicable: false,
      reason: "incompatible_role",
      buildId,
      role,
    };
  }
  return { applicable: true, buildId, role };
}

export function assertGlitchMutableHotfixPersistable(
  manifest: GlitchMutableHotfixManifest
) {
  const compatibility = glitchMutableHotfixCompatibility(manifest, {
    ignoreRole: true,
  });
  if (!compatibility.applicable) {
    throw new Error(
      `mutable_hotfix_not_persistable:${compatibility.reason}:${compatibility.buildId}`
    );
  }
}

async function atomicWriteFile(
  target: string,
  content: string | Buffer,
  options: { encoding?: BufferEncoding; mode?: number } = {}
) {
  const temporary = `${target}.mutable-hotfix-${randomUUID()}.tmp`;
  try {
    await writeFile(temporary, content, options as any);
    await rename(temporary, target);
  } finally {
    await rm(temporary, { force: true }).catch(() => undefined);
  }
}

async function persistRuntimeState(result: GlitchMutableHotfixApplyResult) {
  const target = stateFilePath();
  await mkdir(path.dirname(target), { recursive: true });
  await atomicWriteFile(
    target,
    `${JSON.stringify(
      {
        version: result.version,
        hash: result.hash,
        result,
      },
      null,
      2
    )}\n`,
    { encoding: "utf8" }
  );
}

async function hydrateRuntimeState() {
  const state = runtimeState();
  try {
    const stored = JSON.parse(await readFile(stateFilePath(), "utf8")) as {
      version?: string;
      hash?: string;
      result?: GlitchMutableHotfixApplyResult;
    };
    if (
      stored.version &&
      stored.hash &&
      stored.result?.version === stored.version &&
      stored.result.hash === stored.hash
    ) {
      state.lastAppliedVersion = stored.version;
      state.lastAppliedHash = stored.hash;
      state.lastAppliedAtMs = stored.result.appliedAtMs;
      state.lastResult = stored.result;
    }
  } catch {
    // A fresh container has no state file. The startup apply will create it.
  }
}

function scheduleGlitchMutableHotfixRestart(
  manifest: GlitchMutableHotfixManifest,
  result: GlitchMutableHotfixApplyResult
) {
  if (!manifest.restart?.exitProcess || !result.applied) {
    return;
  }
  result.restartScheduled = true;
  const delayMs = Math.max(0, manifest.restart.delayMs ?? 250);
  const code = manifest.restart.code ?? 75;
  setTimeout(() => process.exit(code), delayMs).unref();
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

interface AppliedGlitchMutableHotfixOperation {
  result: GlitchMutableHotfixOperationResult;
  rollback?: () => Promise<void>;
  commit?: () => Promise<void>;
}

async function targetExists(target: string) {
  return stat(target)
    .then(() => true)
    .catch(() => false);
}

async function stageExistingTarget(target: string) {
  if (!(await targetExists(target))) {
    return {
      existed: false,
      rollback: async () => {
        await rm(target, { force: true, recursive: true });
      },
      commit: async () => {},
    };
  }
  const backup = `${target}.mutable-hotfix-${randomUUID()}.backup`;
  await rename(target, backup);
  return {
    existed: true,
    rollback: async () => {
      await rm(target, { force: true, recursive: true });
      await rename(backup, target);
    },
    commit: async () => {
      await rm(backup, { force: true, recursive: true });
    },
  };
}

function assertContentHash(
  label: "previous" | "result",
  expected: string | undefined,
  content: string | Buffer,
  target: string
) {
  if (!expected) {
    return;
  }
  const actual = sha256(content);
  if (actual !== expected) {
    throw new Error(
      `mutable_hotfix_${label}_hash_mismatch:${target}:expected_${expected}:actual_${actual}`
    );
  }
}

async function applyOperation(
  operation: GlitchMutableHotfixOperation,
  index: number
): Promise<AppliedGlitchMutableHotfixOperation> {
  switch (operation.type) {
    case "writeFile": {
      const target = resolveMutableHotfixPath(operation.path);
      await mkdir(path.dirname(target), { recursive: true });
      if (operation.expectedPreviousSha256 !== undefined) {
        const previous = await readFile(target);
        assertContentHash(
          "previous",
          operation.expectedPreviousSha256,
          previous,
          target
        );
      }
      const content = decodeHotfixContent(operation);
      assertContentHash("result", operation.expectedSha256, content, target);
      const staged = await stageExistingTarget(target);
      try {
        await atomicWriteFile(target, content, {
          encoding:
            operation.contentBase64 === undefined
              ? (operation.encoding ?? "utf8")
              : undefined,
          mode: operation.mode,
        });
      } catch (error) {
        await staged.rollback();
        throw error;
      }
      return {
        result: { index, type: operation.type, target, changed: true },
        rollback: staged.rollback,
        commit: staged.commit,
      };
    }
    case "replace": {
      const target = resolveMutableHotfixPath(operation.path);
      const before = await readFile(target, "utf8");
      assertContentHash(
        "previous",
        operation.expectedPreviousSha256,
        before,
        target
      );
      const { output, count } = replaceContent(before, operation);
      assertExpectedReplacementCount(operation, count);
      assertContentHash("result", operation.expectedSha256, output, target);
      if (output === before) {
        return {
          result: {
            index,
            type: operation.type,
            target,
            changed: false,
            count,
          },
        };
      }
      const staged = await stageExistingTarget(target);
      if (output !== before) {
        try {
          await atomicWriteFile(target, output, { encoding: "utf8" });
        } catch (error) {
          await staged.rollback();
          throw error;
        }
      }
      return {
        result: {
          index,
          type: operation.type,
          target,
          changed: true,
          count,
        },
        rollback: staged.rollback,
        commit: staged.commit,
      };
    }
    case "deleteFile": {
      const target = resolveMutableHotfixPath(operation.path);
      const exists = await targetExists(target);
      if (!exists && !operation.allowMissing) {
        throw new Error(`mutable_hotfix_delete_missing:${operation.path}`);
      }
      if (!exists) {
        return {
          result: { index, type: operation.type, target, changed: false },
        };
      }
      const staged = await stageExistingTarget(target);
      return {
        result: { index, type: operation.type, target, changed: true },
        rollback: staged.rollback,
        commit: staged.commit,
      };
    }
    case "mkdir": {
      const target = resolveMutableHotfixPath(operation.path);
      const exists = await targetExists(target);
      await mkdir(target, { recursive: true });
      return {
        result: {
          index,
          type: operation.type,
          target,
          changed: !exists,
        },
        rollback: exists
          ? undefined
          : async () => rm(target, { force: true, recursive: true }),
      };
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
        result: {
          index,
          type: operation.type,
          target: operation.command,
          changed: true,
          stdout,
          stderr,
        },
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
      return {
        result: { index, type: operation.type, changed: true },
      };
    }
    case "clearRequireCache": {
      const cleared = clearRequireCache(operation);
      return {
        result: {
          index,
          type: operation.type,
          target: operation.path ?? operation.match,
          changed: cleared > 0,
          cleared,
        },
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
  if (
    !manifest.version ||
    typeof manifest.version !== "string" ||
    manifest.version.length > 200 ||
    /[\r\n]/.test(manifest.version)
  ) {
    throw new Error("mutable_hotfix_manifest_invalid:missing_version");
  }
  if (!Array.isArray(manifest.operations)) {
    throw new Error("mutable_hotfix_manifest_invalid:missing_operations");
  }
  if (manifest.operations.length > 1_000) {
    throw new Error("mutable_hotfix_manifest_invalid:too_many_operations");
  }
  for (const [index, operation] of manifest.operations.entries()) {
    if (!operation || typeof operation !== "object") {
      throw new Error(
        `mutable_hotfix_manifest_invalid:operation_${index}_not_object`
      );
    }
    if (
      ![
        "writeFile",
        "replace",
        "deleteFile",
        "mkdir",
        "exec",
        "eval",
        "clearRequireCache",
      ].includes(operation.type)
    ) {
      throw new Error(
        `mutable_hotfix_manifest_invalid:operation_${index}_unknown`
      );
    }
  }
  if (
    manifest.compatibleBuildIds !== undefined &&
    (!Array.isArray(manifest.compatibleBuildIds) ||
      manifest.compatibleBuildIds.some((value) => typeof value !== "string"))
  ) {
    throw new Error("mutable_hotfix_manifest_invalid:compatible_build_ids");
  }
  if (
    manifest.targetRoles !== undefined &&
    (!Array.isArray(manifest.targetRoles) ||
      manifest.targetRoles.some(
        (value) => !["unified", "web", "simulation"].includes(value)
      ))
  ) {
    throw new Error("mutable_hotfix_manifest_invalid:target_roles");
  }
  if (
    manifest.expiresAt !== undefined &&
    typeof manifest.expiresAt !== "string"
  ) {
    throw new Error("mutable_hotfix_manifest_invalid:expires_at");
  }
  decodeGlitchMutableHotfixClientPayload(manifest);
  return manifest;
}

export async function applyGlitchMutableHotfixManifest(
  rawManifest: unknown,
  options: { force?: boolean; scheduleRestart?: boolean } = {}
): Promise<GlitchMutableHotfixApplyResult> {
  const manifest = normalizeGlitchMutableHotfixManifest(rawManifest);
  const state = runtimeState();
  await hydrateRuntimeState();
  const hash = hashGlitchMutableHotfixManifest(manifest);
  if (
    !options.force &&
    state.lastAppliedVersion === manifest.version &&
    state.lastAppliedHash === hash
  ) {
    return state.lastResult as GlitchMutableHotfixApplyResult;
  }
  const compatibility = glitchMutableHotfixCompatibility(manifest);
  if (!compatibility.applicable) {
    const result: GlitchMutableHotfixApplyResult = {
      ok: true,
      applied: false,
      version: manifest.version,
      hash,
      appliedAtMs: Date.now(),
      operations: [],
      skippedReason: compatibility.reason,
    };
    state.lastAppliedVersion = manifest.version;
    state.lastAppliedHash = hash;
    state.lastAppliedAtMs = result.appliedAtMs;
    state.lastError = undefined;
    state.lastResult = result;
    await persistRuntimeState(result);
    return result;
  }
  const operations: GlitchMutableHotfixOperationResult[] = [];
  const appliedOperations: AppliedGlitchMutableHotfixOperation[] = [];
  try {
    for (const [index, operation] of manifest.operations.entries()) {
      const applied = await applyOperation(operation, index);
      appliedOperations.push(applied);
      operations.push(applied.result);
    }
  } catch (error) {
    for (const applied of appliedOperations.reverse()) {
      await applied.rollback?.().catch((rollbackError) =>
        log.error("GLITCH_MUTABLE_HOTFIX_ROLLBACK_FAILED", {
          rollbackError,
          operation: applied.result,
        })
      );
    }
    state.lastError = error instanceof Error ? error.message : String(error);
    throw error;
  }
  for (const applied of appliedOperations) {
    await applied.commit?.().catch((commitError) =>
      log.warn("GLITCH_MUTABLE_HOTFIX_BACKUP_CLEANUP_FAILED", {
        commitError,
        operation: applied.result,
      })
    );
  }
  const result: GlitchMutableHotfixApplyResult = {
    ok: true,
    applied: true,
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
  await persistRuntimeState(result);
  log.warn("GLITCH_MUTABLE_HOTFIX_APPLIED", {
    version: result.version,
    hash: result.hash,
    operationCount: operations.length,
  });
  if (options.scheduleRestart !== false) {
    scheduleGlitchMutableHotfixRestart(manifest, result);
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
    stateFile: stateFilePath(),
    buildId: currentBuildId(),
    role: currentRole(),
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

export async function closeGlitchMutableHotfixRedis(
  reason = "Mutable hotfix command complete"
) {
  const redis = globalForMutableHotfix.__glitchMutableHotfixRedis;
  if (!redis) return;
  globalForMutableHotfix.__glitchMutableHotfixRedis = undefined;
  await redis.quit(reason);
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
  assertGlitchMutableHotfixPersistable(manifest);
  const redis = await mutableHotfixRedis();
  await redis.primary.set(redisKey, JSON.stringify(manifest));
  return {
    ok: true,
    redisKey,
    version: manifest.version,
    hash: hashGlitchMutableHotfixManifest(manifest),
  };
}

export async function applyAndPersistGlitchMutableHotfixManifest(
  rawManifest: unknown,
  options: {
    force?: boolean;
    scheduleRestart?: boolean;
    redisKey?: string;
    persist?: (
      manifest: GlitchMutableHotfixManifest,
      redisKey?: string
    ) => Promise<unknown>;
  } = {}
) {
  const manifest = normalizeGlitchMutableHotfixManifest(rawManifest);
  assertGlitchMutableHotfixPersistable(manifest);
  const result = await applyGlitchMutableHotfixManifest(manifest, {
    force: options.force,
    scheduleRestart: false,
  });
  const persisted = await (
    options.persist ?? persistGlitchMutableHotfixManifestToRedis
  )(manifest, options.redisKey);
  if (options.scheduleRestart !== false) {
    scheduleGlitchMutableHotfixRestart(manifest, result);
  }
  return { result, persisted };
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
    scheduleRestart?: boolean;
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
