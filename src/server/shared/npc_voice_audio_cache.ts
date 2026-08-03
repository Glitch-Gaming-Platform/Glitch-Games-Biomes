import { createHash } from "crypto";
import fs from "fs";
import path from "path";
import {
  canonicalSnapshotGroveNpcEntityId,
  snapshotGroveNpcStableVoiceEntityId,
} from "@/shared/harthmere/snapshot_grove_ids";
import type { BiomesId } from "@/shared/ids";

export const NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION =
  "npc-voice-audio-cache-v1";

export interface NpcVoiceAudioCacheKeyInput {
  provider: string;
  synthesisIdentity: string;
  text: string;
  voice: string;
  language?: string;
}

export interface NpcVoiceAudioManifestRecording {
  cacheKey: string;
  cacheKeys?: string[];
  path: string;
  actorKey?: string;
  actorId?: string;
  lineId?: string;
  voice?: string;
  voiceId?: string;
  textHash?: string;
  bytes?: number;
}

export interface NpcVoiceAudioManifest {
  version: string;
  provider: string;
  synthesisIdentity: string;
  generatedAt: string;
  recordings: NpcVoiceAudioManifestRecording[];
}

const runtimeWrites = new Map<string, Promise<string>>();
const runtimeGenerations = new Map<string, Promise<string>>();
interface StaticNpcVoiceManifestIndex {
  manifestPath: string;
  modifiedMs: number;
  provider: string;
  byCacheKey: Map<string, string>;
  byActorAndTextHash: Map<string, string>;
}

let staticManifestCache: StaticNpcVoiceManifestIndex | undefined;

function sha256(text: string) {
  return createHash("sha256").update(text).digest("hex");
}

export function npcVoiceAudioCacheKey(input: NpcVoiceAudioCacheKeyInput) {
  // Hash the final spoken text and every input that can change its sound. This
  // makes cached files safe to reuse without exposing dialogue in filenames.
  return sha256(
    JSON.stringify({
      version: NPC_VOICE_AUDIO_CACHE_MANIFEST_VERSION,
      provider: input.provider,
      synthesisIdentity: input.synthesisIdentity,
      text: input.text.trim(),
      voice: input.voice.trim(),
      language: input.language?.trim() ?? "",
    })
  );
}

export function npcVoiceTextHash(text: string) {
  return sha256(text.trim());
}

export function npcVoiceRuntimeRelativePath(input: {
  provider: string;
  cacheKey: string;
  extension?: string;
}) {
  const provider = input.provider.replace(/[^a-z0-9_-]+/gi, "-");
  const extension = (input.extension ?? "mp3").replace(/[^a-z0-9]+/gi, "");
  return `harthmere/voices/generated/runtime/${provider}/${input.cacheKey.slice(
    0,
    2
  )}/${input.cacheKey}.${extension}`;
}

export function npcVoicePublicUrl(relativePath: string) {
  return `/${relativePath.replace(/^\/+/, "")}`;
}

function publicRoot(root = process.cwd()) {
  return path.join(root, "public");
}

function staticManifestPath(root = process.cwd()) {
  return path.join(
    publicRoot(root),
    "harthmere/voices/generated/current/manifest.json"
  );
}

function actorKeyFromVoiceDescriptor(voice: string | undefined) {
  for (const part of voice?.split("|") ?? []) {
    const separator = part.indexOf("=");
    if (separator < 0 || part.slice(0, separator) !== "actor") {
      continue;
    }
    try {
      return decodeURIComponent(part.slice(separator + 1));
    } catch {
      return part.slice(separator + 1);
    }
  }
  return undefined;
}

function stableActorIdentity(actorKey: string | undefined) {
  const normalized = actorKey?.trim().toLocaleLowerCase();
  if (!normalized) {
    return undefined;
  }
  for (const token of normalized.split(":")) {
    if (!/^\d+$/.test(token)) {
      continue;
    }
    const entityId = Number(token);
    if (!Number.isSafeInteger(entityId)) {
      continue;
    }
    const canonical = Number(
      canonicalSnapshotGroveNpcEntityId(entityId as BiomesId)
    );
    const stable = Number(
      snapshotGroveNpcStableVoiceEntityId(entityId as BiomesId)
    );
    if (canonical !== entityId || stable !== entityId) {
      return `snapshot-grove-entity:${stable}`;
    }
  }
  return `actor-key:${normalized}`;
}

function actorAndTextHashKey(input: {
  actorKey: string | undefined;
  textHash: string | undefined;
}) {
  const actorIdentity = stableActorIdentity(input.actorKey);
  return actorIdentity && input.textHash
    ? `${actorIdentity}|${input.textHash}`
    : undefined;
}

function loadStaticManifest(root = process.cwd()) {
  const manifestPath = staticManifestPath(root);
  let stat: fs.Stats;
  try {
    stat = fs.statSync(manifestPath);
  } catch {
    return {
      manifestPath,
      modifiedMs: 0,
      provider: "",
      byCacheKey: new Map<string, string>(),
      byActorAndTextHash: new Map<string, string>(),
    } satisfies StaticNpcVoiceManifestIndex;
  }
  if (
    staticManifestCache?.manifestPath === manifestPath &&
    staticManifestCache.modifiedMs === stat.mtimeMs
  ) {
    return staticManifestCache;
  }
  try {
    const manifest = JSON.parse(
      fs.readFileSync(manifestPath, "utf8")
    ) as NpcVoiceAudioManifest;
    const byCacheKey = new Map<string, string>();
    const byActorAndTextHash = new Map<string, string>();
    for (const recording of manifest.recordings ?? []) {
      if (!recording.path) {
        continue;
      }
      // English dialogue may arrive with no language or with en-US depending
      // on the player's translation setting. Both keys intentionally point at
      // the same reviewed English recording.
      for (const cacheKey of [
        recording.cacheKey,
        ...(recording.cacheKeys ?? []),
      ]) {
        if (cacheKey) {
          byCacheKey.set(cacheKey, recording.path);
        }
      }
      const actorTextKey = actorAndTextHashKey({
        actorKey: recording.actorKey,
        textHash: recording.textHash,
      });
      if (actorTextKey && !byActorAndTextHash.has(actorTextKey)) {
        byActorAndTextHash.set(actorTextKey, recording.path);
      }
    }
    staticManifestCache = {
      manifestPath,
      modifiedMs: stat.mtimeMs,
      provider: manifest.provider,
      byCacheKey,
      byActorAndTextHash,
    };
    return staticManifestCache;
  } catch {
    // A missing or partially-written manifest must never break NPC dialogue;
    // the caller simply falls back to runtime synthesis and caching.
    return {
      manifestPath,
      modifiedMs: stat.mtimeMs,
      provider: "",
      byCacheKey: new Map<string, string>(),
      byActorAndTextHash: new Map<string, string>(),
    };
  }
}

function existingRelativePath(relativePath: string, root = process.cwd()) {
  const absolutePath = path.join(publicRoot(root), relativePath);
  return fs.existsSync(absolutePath) ? relativePath : undefined;
}

function audioDataUrl(audio: Buffer, extension = "mp3") {
  const contentType =
    extension === "wav"
      ? "audio/wav"
      : extension === "ogg" || extension === "opus"
        ? "audio/ogg"
        : "audio/mpeg";
  return `data:${contentType};base64,${audio.toString("base64")}`;
}

export function findCachedNpcVoiceAudio(input: {
  cacheKey: string;
  provider: string;
  text?: string;
  voice?: string;
  extension?: string;
  root?: string;
}) {
  const root = input.root ?? process.cwd();
  const staticManifest = loadStaticManifest(root);
  const staticPath =
    staticManifest.provider === input.provider
      ? (staticManifest.byCacheKey.get(input.cacheKey) ??
        staticManifest.byActorAndTextHash.get(
          actorAndTextHashKey({
            actorKey: actorKeyFromVoiceDescriptor(input.voice),
            textHash: input.text ? npcVoiceTextHash(input.text) : undefined,
          }) ?? ""
        ))
      : undefined;
  if (staticPath && existingRelativePath(staticPath, root)) {
    return npcVoicePublicUrl(staticPath);
  }
  const runtimePath = npcVoiceRuntimeRelativePath(input);
  const existingRuntimePath = existingRelativePath(runtimePath, root);
  if (!existingRuntimePath) {
    return undefined;
  }
  // Next's production static-file table is built at startup, and a subsequent
  // browser GET may land on a different container replica. Returning cached
  // runtime bytes directly avoids both sources of production-only 404s.
  return audioDataUrl(
    fs.readFileSync(path.join(publicRoot(root), existingRuntimePath)),
    input.extension
  );
}

export function findCommittedNpcVoiceAudio(input: {
  provider: string;
  text: string;
  voice: string;
  root?: string;
}) {
  const root = input.root ?? process.cwd();
  const staticManifest = loadStaticManifest(root);
  if (staticManifest.provider !== input.provider) {
    return undefined;
  }
  const actorTextKey = actorAndTextHashKey({
    actorKey: actorKeyFromVoiceDescriptor(input.voice),
    textHash: npcVoiceTextHash(input.text),
  });
  const staticPath = actorTextKey
    ? staticManifest.byActorAndTextHash.get(actorTextKey)
    : undefined;
  return staticPath && existingRelativePath(staticPath, root)
    ? npcVoicePublicUrl(staticPath)
    : undefined;
}

export async function writeCachedNpcVoiceAudio(input: {
  cacheKey: string;
  provider: string;
  audio: Buffer;
  extension?: string;
  root?: string;
}) {
  const root = input.root ?? process.cwd();
  const relativePath = npcVoiceRuntimeRelativePath(input);
  const absolutePath = path.join(publicRoot(root), relativePath);
  const existing = existingRelativePath(relativePath, root);
  if (existing) {
    return audioDataUrl(
      fs.readFileSync(path.join(publicRoot(root), existing)),
      input.extension
    );
  }

  const priorWrite = runtimeWrites.get(absolutePath);
  if (priorWrite) {
    return priorWrite;
  }
  const write = (async () => {
    await fs.promises.mkdir(path.dirname(absolutePath), { recursive: true });
    const temporaryPath = `${absolutePath}.${process.pid}.tmp`;
    await fs.promises.writeFile(temporaryPath, input.audio, { mode: 0o644 });
    try {
      await fs.promises.rename(temporaryPath, absolutePath);
    } catch (error) {
      await fs.promises.unlink(temporaryPath).catch(() => undefined);
      if (!fs.existsSync(absolutePath)) {
        throw error;
      }
    }
    return audioDataUrl(input.audio, input.extension);
  })();
  runtimeWrites.set(absolutePath, write);
  try {
    return await write;
  } finally {
    runtimeWrites.delete(absolutePath);
  }
}

export async function resolveNpcVoiceAudioUrl(input: {
  cacheKey: string;
  provider: string;
  text?: string;
  voice?: string;
  extension?: string;
  root?: string;
  generate: () => Promise<
    | {
        audio: Buffer;
        contentType: string;
      }
    | undefined
  >;
}) {
  // Serve committed catalog audio or a previous runtime recording before
  // contacting a paid provider. This is the normal path after the first play.
  const cached = findCachedNpcVoiceAudio(input);
  if (cached) {
    return cached;
  }

  // Collapse simultaneous requests for the same NPC line. React remounts,
  // multiple nearby clients, or a double-click should still spend one request.
  const generationIdentity = `${input.root ?? process.cwd()}|${
    input.provider
  }|${input.cacheKey}`;
  const priorGeneration = runtimeGenerations.get(generationIdentity);
  if (priorGeneration) {
    return priorGeneration;
  }
  const generation = (async () => {
    // Recheck after joining the generation queue because another request may
    // have completed between the first lookup and this promise starting.
    const newlyCached = findCachedNpcVoiceAudio(input);
    if (newlyCached) {
      return newlyCached;
    }
    const generated = await input.generate();
    if (!generated) {
      return "";
    }
    try {
      return await writeCachedNpcVoiceAudio({
        cacheKey: input.cacheKey,
        provider: input.provider,
        audio: generated.audio,
        extension: input.extension,
        root: input.root,
      });
    } catch {
      // A read-only or ephemeral deployment must not lose speech completely.
      // Return the generated audio once even though later requests may retry.
      return `data:${generated.contentType};base64,${generated.audio.toString(
        "base64"
      )}`;
    }
  })();
  runtimeGenerations.set(generationIdentity, generation);
  try {
    return await generation;
  } finally {
    runtimeGenerations.delete(generationIdentity);
  }
}

export function clearNpcVoiceAudioManifestCacheForTest() {
  staticManifestCache = undefined;
  runtimeGenerations.clear();
}
