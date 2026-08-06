#!/usr/bin/env ts-node

import {
  HARTHMERE_SOUND_EFFECT_MANIFEST,
  HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION,
} from "@/shared/harthmere/sound_effect_manifest";
import { execFile } from "child_process";
import { promises as fs } from "fs";
import path from "path";
import { promisify } from "util";

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const GENERATED_ROOT = path.join(ROOT, "public/assets/harthmere/audio/sfx");

async function probe(filePath: string) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-show_entries",
    "format=duration,size:stream=codec_name,sample_rate,channels",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout) as {
    format?: { duration?: string; size?: string };
    streams?: Array<{
      codec_name?: string;
      sample_rate?: string;
      channels?: number;
    }>;
  };
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    bytes: Number(parsed.format?.size ?? 0),
    codec: parsed.streams?.[0]?.codec_name,
    sampleRate: Number(parsed.streams?.[0]?.sample_rate ?? 0),
    channels: Number(parsed.streams?.[0]?.channels ?? 0),
  };
}

async function main() {
  const failures: string[] = [];
  const expectedFiles = new Set<string>();
  for (const definition of HARTHMERE_SOUND_EFFECT_MANIFEST) {
    if (definition.source === "existing") {
      const existingPath = path.join(
        ROOT,
        "src/galois/data/audio",
        `${definition.path.replace(/^audio\//, "")}.webm`
      );
      try {
        await fs.access(existingPath);
      } catch {
        failures.push(
          `missing existing source ${definition.id}: ${existingPath}`
        );
      }
      continue;
    }
    const filename = `${definition.id}.webm`;
    expectedFiles.add(filename);
    const filePath = path.join(GENERATED_ROOT, filename);
    try {
      const actual = await probe(filePath);
      if (actual.bytes <= 1024)
        failures.push(`${definition.id}: file too small`);
      if (actual.codec !== "opus") {
        failures.push(`${definition.id}: expected opus, got ${actual.codec}`);
      }
      if (actual.sampleRate !== 48_000) {
        failures.push(
          `${definition.id}: expected 48000 Hz, got ${actual.sampleRate}`
        );
      }
      if (actual.channels !== 1) {
        failures.push(
          `${definition.id}: expected mono, got ${actual.channels}`
        );
      }
      if (
        Math.abs(actual.durationSeconds - definition.durationSeconds) > 0.12
      ) {
        failures.push(
          `${definition.id}: expected ${definition.durationSeconds}s, got ${actual.durationSeconds}s`
        );
      }
    } catch (error) {
      failures.push(
        `${definition.id}: ${String((error as Error)?.message ?? error)}`
      );
    }
    const mobileFilename = `${definition.id}.m4a`;
    const mobileFilePath = path.join(GENERATED_ROOT, mobileFilename);
    try {
      const actual = await probe(mobileFilePath);
      if (actual.bytes <= 1024)
        failures.push(`${definition.id}: mobile AAC file too small`);
      if (actual.codec !== "aac") {
        failures.push(
          `${definition.id}: expected mobile AAC, got ${actual.codec}`
        );
      }
      if (actual.sampleRate !== 48_000) {
        failures.push(
          `${definition.id}: expected mobile 48000 Hz, got ${actual.sampleRate}`
        );
      }
      if (actual.channels !== 1) {
        failures.push(
          `${definition.id}: expected mobile mono, got ${actual.channels}`
        );
      }
      if (
        Math.abs(actual.durationSeconds - definition.durationSeconds) > 0.12
      ) {
        failures.push(
          `${definition.id}: expected mobile ${definition.durationSeconds}s, got ${actual.durationSeconds}s`
        );
      }
    } catch (error) {
      failures.push(
        `${definition.id} mobile AAC: ${String(
          (error as Error)?.message ?? error
        )}`
      );
    }
  }

  const actualFiles = (await fs.readdir(GENERATED_ROOT)).filter((name) =>
    name.endsWith(".webm")
  );
  for (const filename of actualFiles) {
    if (!expectedFiles.has(filename)) failures.push(`orphan file: ${filename}`);
  }

  const publicManifest = JSON.parse(
    await fs.readFile(path.join(GENERATED_ROOT, "manifest.json"), "utf8")
  ) as { version?: string; effects?: unknown[] };
  if (publicManifest.version !== HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION) {
    failures.push("public manifest version is stale");
  }
  if (
    publicManifest.effects?.length !== HARTHMERE_SOUND_EFFECT_MANIFEST.length
  ) {
    failures.push("public manifest entry count is stale");
  }

  if (failures.length > 0) {
    process.stderr.write(`${failures.join("\n")}\n`);
    process.exitCode = 1;
    return;
  }
  process.stdout.write(
    `OK ${expectedFiles.size} generated and ${
      HARTHMERE_SOUND_EFFECT_MANIFEST.length - expectedFiles.size
    } existing sound effects (${HARTHMERE_SOUND_EFFECT_MANIFEST_VERSION})\n`
  );
}

void main().catch((error) => {
  process.stderr.write(`${String((error as Error)?.stack ?? error)}\n`);
  process.exitCode = 1;
});
