#!/usr/bin/env ts-node

import {
  HARTHMERE_SOUND_EFFECT_MANIFEST,
  HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION,
  type HarthmereSoundEffectDefinition,
} from "@/shared/harthmere/sound_effect_manifest";
import { createHash } from "crypto";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const OUTPUT_ROOT = path.join(ROOT, "public/assets/harthmere/audio/sfx");
const TEMP_ROOT = path.join(ROOT, "artifacts/harthmere-sound-effects-temp");
const DEFAULT_CONCURRENCY = 3;
const ELEVENLABS_API_PATH = "/v1/sound-generation";
const OUTPUT_FORMAT = "mp3_44100_128";

interface GenerationRecord {
  id: string;
  path: string;
  promptHash: string;
  requestedDurationSeconds: number;
  actualDurationSeconds: number;
  bytes: number;
  loop: boolean;
  generatedAt: string;
}

function readArg(name: string) {
  const prefix = `--${name}=`;
  return process.argv
    .find((arg) => arg.startsWith(prefix))
    ?.slice(prefix.length);
}

function hasArg(name: string) {
  return process.argv.includes(`--${name}`);
}

async function loadDotEnv(filePath: string) {
  let text: string;
  try {
    text = await fs.readFile(filePath, "utf8");
  } catch {
    return;
  }
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;
    const equals = line.indexOf("=");
    if (equals <= 0) continue;
    const key = line.slice(0, equals).trim();
    let value = line.slice(equals + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

function promptHash(definition: HarthmereSoundEffectDefinition) {
  return createHash("sha256")
    .update(
      JSON.stringify({
        version: HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION,
        prompt: definition.prompt,
        durationSeconds: definition.durationSeconds,
        promptInfluence: definition.promptInfluence,
        loop: definition.loop,
      })
    )
    .digest("hex");
}

async function probe(filePath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
  };
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    bytes: Number(parsed.format?.size ?? 0),
  };
}

async function transcode(
  mp3Path: string,
  webmPath: string,
  durationSeconds: number
) {
  await fs.mkdir(path.dirname(webmPath), { recursive: true });
  await execFileAsync("ffmpeg", [
    "-y",
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    mp3Path,
    "-t",
    String(durationSeconds),
    "-af",
    "loudnorm=I=-18:TP=-1.5:LRA=11",
    "-ac",
    "1",
    "-ar",
    "48000",
    "-c:a",
    "libopus",
    "-b:a",
    "96k",
    webmPath,
  ]);
}

async function generateMp3(
  definition: HarthmereSoundEffectDefinition,
  apiKey: string
) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);
  try {
    const url = new URL(
      ELEVENLABS_API_PATH,
      process.env.ELEVENLABS_API_BASE_URL?.trim() || "https://api.elevenlabs.io"
    );
    url.searchParams.set("output_format", OUTPUT_FORMAT);
    const response = await fetch(url, {
      method: "POST",
      signal: controller.signal,
      headers: {
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
        "xi-api-key": apiKey,
      },
      body: JSON.stringify({
        text: definition.prompt,
        duration_seconds: definition.durationSeconds,
        prompt_influence: definition.promptInfluence,
        loop: definition.loop,
      }),
    });
    if (!response.ok) {
      const body = await response.text();
      throw new Error(`ElevenLabs ${response.status}: ${body.slice(0, 1000)}`);
    }
    return Buffer.from(await response.arrayBuffer());
  } finally {
    clearTimeout(timeout);
  }
}

async function generateWithRetry(
  definition: HarthmereSoundEffectDefinition,
  apiKey: string
) {
  let lastError: unknown;
  for (let attempt = 1; attempt <= 4; attempt += 1) {
    try {
      return await generateMp3(definition, apiKey);
    } catch (error) {
      lastError = error;
      const message = String((error as Error)?.message ?? error);
      if (!/429|500|502|503|504|AbortError/i.test(message) || attempt === 4) {
        throw error;
      }
      await new Promise((resolve) =>
        setTimeout(resolve, 750 * Math.pow(2, attempt - 1))
      );
    }
  }
  throw lastError;
}

async function generateOne(
  definition: HarthmereSoundEffectDefinition,
  apiKey: string,
  force: boolean
): Promise<GenerationRecord | undefined> {
  const relativePath = definition.path.replace(/^\//, "");
  const webmPath = path.join(
    ROOT,
    "public",
    relativePath.replace(/^assets\//, "assets/")
  );
  if (!force) {
    try {
      const current = await probe(webmPath);
      if (current.bytes > 1024 && current.durationSeconds > 0.1) {
        process.stdout.write(`skip ${definition.id}\n`);
        return undefined;
      }
    } catch {
      // Missing or invalid output; generate it.
    }
  }

  process.stdout.write(`generate ${definition.id}\n`);
  const mp3 = await generateWithRetry(definition, apiKey);
  const mp3Path = path.join(TEMP_ROOT, `${definition.id}.mp3`);
  await fs.mkdir(TEMP_ROOT, { recursive: true });
  await fs.writeFile(mp3Path, mp3);
  await transcode(mp3Path, webmPath, definition.durationSeconds);
  const actual = await probe(webmPath);
  if (actual.bytes <= 1024 || actual.durationSeconds <= 0.1) {
    throw new Error(`Generated file failed validation: ${definition.id}`);
  }
  if (
    Math.abs(actual.durationSeconds - definition.durationSeconds) >
    Math.max(0.2, definition.durationSeconds * 0.18)
  ) {
    throw new Error(
      `Generated duration mismatch for ${definition.id}: requested ${definition.durationSeconds}s, got ${actual.durationSeconds}s`
    );
  }
  await fs.rm(mp3Path, { force: true });
  return {
    id: definition.id,
    path: definition.path,
    promptHash: promptHash(definition),
    requestedDurationSeconds: definition.durationSeconds,
    actualDurationSeconds: actual.durationSeconds,
    bytes: actual.bytes,
    loop: definition.loop,
    generatedAt: new Date().toISOString(),
  };
}

async function runPool<T>(
  values: readonly T[],
  concurrency: number,
  worker: (value: T) => Promise<void>
) {
  let index = 0;
  const runners = Array.from(
    { length: Math.min(concurrency, values.length) },
    async () => {
      for (;;) {
        const current = index++;
        if (current >= values.length) return;
        await worker(values[current]);
      }
    }
  );
  await Promise.all(runners);
}

async function main() {
  await loadDotEnv(path.join(ROOT, ".env.local"));
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey && !hasArg("dry-run")) {
    throw new Error(
      "Missing ELEVENLABS_API_KEY in the environment or .env.local."
    );
  }

  const only = new Set(
    (readArg("only") ?? "")
      .split(",")
      .map((value) => value.trim())
      .filter(Boolean)
  );
  const limit = Math.max(0, Number(readArg("limit") ?? 0));
  const concurrency = Math.max(
    1,
    Math.min(6, Number(readArg("concurrency") ?? DEFAULT_CONCURRENCY))
  );
  const force = hasArg("force");
  let definitions = HARTHMERE_SOUND_EFFECT_MANIFEST.filter(
    (definition) =>
      definition.source === "elevenlabs" &&
      definition.prompt &&
      (only.size === 0 || only.has(definition.id))
  );
  if (limit > 0) definitions = definitions.slice(0, limit);

  const duplicateIds = definitions.filter(
    (definition, index) =>
      definitions.findIndex((entry) => entry.id === definition.id) !== index
  );
  if (duplicateIds.length > 0) {
    throw new Error(
      `Duplicate sound ids: ${duplicateIds.map((entry) => entry.id).join(", ")}`
    );
  }

  await fs.mkdir(OUTPUT_ROOT, { recursive: true });
  await fs.writeFile(
    path.join(OUTPUT_ROOT, "manifest.json"),
    `${JSON.stringify(
      {
        version: HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION,
        effects: HARTHMERE_SOUND_EFFECT_MANIFEST,
      },
      null,
      2
    )}\n`
  );

  process.stdout.write(
    `manifest ${HARTHMERE_SOUND_EFFECT_MANIFEST.length} total, ${definitions.length} selected\n`
  );
  if (hasArg("dry-run")) return;

  const records: GenerationRecord[] = [];
  const failures: Array<{ id: string; error: string }> = [];
  await runPool(definitions, concurrency, async (definition) => {
    try {
      const record = await generateOne(definition, apiKey!, force);
      if (record) records.push(record);
    } catch (error) {
      const message = String((error as Error)?.message ?? error);
      failures.push({ id: definition.id, error: message });
      process.stderr.write(`failed ${definition.id}: ${message}\n`);
    }
  });

  const verifiedRecords: GenerationRecord[] = [];
  for (const definition of definitions) {
    const relativePath = definition.path.replace(/^\//, "");
    const webmPath = path.join(
      ROOT,
      "public",
      relativePath.replace(/^assets\//, "assets/")
    );
    try {
      const actual = await probe(webmPath);
      verifiedRecords.push({
        id: definition.id,
        path: definition.path,
        promptHash: promptHash(definition),
        requestedDurationSeconds: definition.durationSeconds,
        actualDurationSeconds: actual.durationSeconds,
        bytes: actual.bytes,
        loop: definition.loop,
        generatedAt:
          records.find((record) => record.id === definition.id)?.generatedAt ??
          new Date().toISOString(),
      });
    } catch {
      if (!failures.some((failure) => failure.id === definition.id)) {
        failures.push({ id: definition.id, error: "generated_file_missing" });
      }
    }
  }

  await fs.writeFile(
    path.join(OUTPUT_ROOT, "generation-report.json"),
    `${JSON.stringify(
      {
        version: HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION,
        generatedAt: new Date().toISOString(),
        selected: definitions.length,
        generated: verifiedRecords.length,
        newlyGenerated: records.length,
        failed: failures.length,
        records: verifiedRecords.sort((a, b) => a.id.localeCompare(b.id)),
        failures,
      },
      null,
      2
    )}\n`
  );

  if (failures.length > 0) {
    throw new Error(`${failures.length} sound effect generation(s) failed.`);
  }
}

void main().catch((error) => {
  process.stderr.write(`${String((error as Error)?.stack ?? error)}\n`);
  process.exitCode = 1;
});
