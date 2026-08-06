#!/usr/bin/env node

const fs = require("fs");
const path = require("path");
const { execFile } = require("child_process");
const { promisify } = require("util");

const execFileAsync = promisify(execFile);
const ROOT = path.resolve(__dirname, "../..");
const VOICE_MANIFEST = path.join(
  ROOT,
  "public/harthmere/voices/generated/current/manifest.json"
);
const SFX_ROOT = path.join(ROOT, "public/assets/harthmere/audio/sfx");
const CORE_AUDIO_ROOT = path.join(
  ROOT,
  "public/buckets/biomes-static/asset_data/audio"
);
const CORE_MOBILE_ROOT = path.join(
  ROOT,
  "public/assets/harthmere/audio/mobile/core"
);
const CORE_LONG_FORM_MUSIC_BASENAME =
  /^(?:music-1|muck-music-1|cave-music-loop)\.[^.]+\.webm$/i;
const REPORT_PATH = path.join(
  ROOT,
  "artifacts/mobile-audio-variants-report.json"
);

const args = new Set(process.argv.slice(2));
const checkOnly = args.has("--check");
const force = args.has("--force");
const selectedKinds = new Set(
  ["voices", "sfx", "core"].filter(
    (kind) =>
      args.has("--all") ||
      args.has(`--${kind}`) ||
      !["voices", "sfx", "core"].some((candidate) => args.has(`--${candidate}`))
  )
);
const concurrencyArg = process.argv.find((arg) =>
  arg.startsWith("--concurrency=")
);
const concurrency = Math.max(
  1,
  Math.min(16, Number(concurrencyArg?.split("=")[1] ?? 8))
);

function walkFiles(root, extension) {
  if (!fs.existsSync(root)) return [];
  const output = [];
  const todo = [root];
  while (todo.length) {
    const directory = todo.pop();
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolute = path.join(directory, entry.name);
      if (entry.isDirectory()) todo.push(absolute);
      else if (entry.isFile() && entry.name.toLowerCase().endsWith(extension)) {
        output.push(absolute);
      }
    }
  }
  return output.sort();
}

function mobilePathFor(source) {
  return source.replace(/\.(?:mp3|webm)$/i, ".m4a");
}

function isCoreLongFormMusic(source) {
  return CORE_LONG_FORM_MUSIC_BASENAME.test(path.basename(source));
}

function coreMobilePathFor(source) {
  return path.join(CORE_MOBILE_ROOT, `${path.basename(source, ".webm")}.m4a`);
}

function pruneRedundantCoreMusicVariants() {
  let removed = 0;
  for (const source of walkFiles(CORE_AUDIO_ROOT, ".webm")) {
    if (!isCoreLongFormMusic(source)) continue;
    const mobile = coreMobilePathFor(source);
    if (fs.existsSync(mobile)) {
      fs.rmSync(mobile);
      removed += 1;
    }
  }
  return removed;
}

function isLfsPointer(filePath) {
  return fs
    .readFileSync(filePath)
    .subarray(0, 80)
    .toString("utf8")
    .startsWith("version https://git-lfs.github.com/spec/v1");
}

function jobs() {
  const result = [];
  if (selectedKinds.has("sfx")) {
    for (const source of walkFiles(SFX_ROOT, ".webm")) {
      result.push({ kind: "sfx", source, output: mobilePathFor(source) });
    }
  }
  if (selectedKinds.has("core")) {
    for (const source of walkFiles(CORE_AUDIO_ROOT, ".webm").filter(
      (source) => !isCoreLongFormMusic(source)
    )) {
      result.push({
        kind: "core",
        source,
        output: coreMobilePathFor(source),
      });
    }
  }
  if (selectedKinds.has("voices")) {
    const manifest = JSON.parse(fs.readFileSync(VOICE_MANIFEST, "utf8"));
    for (const recording of manifest.recordings ?? []) {
      const source = path.join(ROOT, "public", recording.path);
      const mobilePath = recording.path.replace(/\.mp3$/i, ".m4a");
      result.push({
        kind: "voice",
        source,
        output: path.join(ROOT, "public", mobilePath),
        recording,
        mobilePath,
      });
    }
  }
  return result;
}

async function probe(filePath) {
  const { stdout } = await execFileAsync("ffprobe", [
    "-v",
    "error",
    "-select_streams",
    "a:0",
    "-show_entries",
    "format=duration,size:stream=codec_name,profile,sample_rate,channels",
    "-of",
    "json",
    filePath,
  ]);
  const parsed = JSON.parse(stdout);
  const stream = parsed.streams?.[0] ?? {};
  return {
    durationSeconds: Number(parsed.format?.duration ?? 0),
    bytes: Number(parsed.format?.size ?? 0),
    codec: stream.codec_name,
    profile: stream.profile,
    sampleRate: Number(stream.sample_rate ?? 0),
    channels: Number(stream.channels ?? 0),
  };
}

async function transcode(job) {
  fs.mkdirSync(path.dirname(job.output), { recursive: true });
  const mono = job.kind !== "core" || (await probe(job.source)).channels <= 1;
  const temporary = `${job.output}.${process.pid}.tmp.m4a`;
  await execFileAsync("ffmpeg", [
    "-y",
    "-nostdin",
    "-hide_banner",
    "-loglevel",
    "error",
    "-i",
    job.source,
    "-vn",
    "-map_metadata",
    "-1",
    ...(mono ? ["-ac", "1"] : []),
    "-ar",
    "48000",
    "-c:a",
    "aac",
    "-profile:a",
    "aac_low",
    "-b:a",
    mono ? "64k" : "96k",
    "-movflags",
    "+faststart",
    temporary,
  ]);
  fs.renameSync(temporary, job.output);
}

async function runPool(values, worker) {
  let index = 0;
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, async () => {
      for (;;) {
        const current = index++;
        if (current >= values.length) return;
        await worker(values[current], current + 1);
      }
    })
  );
}

async function main() {
  if (selectedKinds.has("core") && !checkOnly) {
    const removed = pruneRedundantCoreMusicVariants();
    if (removed) {
      process.stdout.write(
        `removed ${removed} redundant core music AAC variant(s)\n`
      );
    }
  }
  const work = jobs();
  const failures = [];
  let generated = 0;
  let skipped = 0;

  if (!checkOnly) {
    await runPool(work, async (job, completed) => {
      try {
        if (!fs.existsSync(job.source)) {
          throw new Error("source missing");
        }
        if (isLfsPointer(job.source)) {
          throw new Error("source is a Git LFS pointer");
        }
        if (
          !force &&
          fs.existsSync(job.output) &&
          fs.statSync(job.output).size > 512
        ) {
          skipped += 1;
        } else {
          await transcode(job);
          generated += 1;
        }
        if (completed % 100 === 0 || completed === work.length) {
          process.stdout.write(
            `mobile audio ${completed}/${work.length} generated=${generated} skipped=${skipped}\n`
          );
        }
      } catch (error) {
        failures.push({
          path: path.relative(ROOT, job.source),
          error: String(error?.message ?? error),
        });
      }
    });
  }

  const records = [];
  await runPool(work, async (job, completed) => {
    try {
      if (!fs.existsSync(job.source) || !fs.existsSync(job.output)) {
        throw new Error("source or mobile variant missing");
      }
      const [source, mobile] = await Promise.all([
        probe(job.source),
        probe(job.output),
      ]);
      if (mobile.codec !== "aac" || mobile.profile !== "LC") {
        throw new Error(
          `expected AAC-LC, got ${mobile.codec ?? "unknown"}/${mobile.profile ?? "unknown"}`
        );
      }
      if (mobile.sampleRate !== 48000) {
        throw new Error(`expected 48000 Hz, got ${mobile.sampleRate}`);
      }
      const expectedChannels = job.kind === "core" ? source.channels : 1;
      if (mobile.channels !== expectedChannels) {
        throw new Error(
          `expected ${expectedChannels} channel(s), got ${mobile.channels}`
        );
      }
      if (
        Math.abs(source.durationSeconds - mobile.durationSeconds) >
        Math.max(0.12, source.durationSeconds * 0.01)
      ) {
        throw new Error(
          `duration mismatch ${source.durationSeconds} vs ${mobile.durationSeconds}`
        );
      }
      records.push({
        kind: job.kind,
        source: path.relative(ROOT, job.source),
        mobile: path.relative(ROOT, job.output),
        sourceBytes: source.bytes,
        mobileBytes: mobile.bytes,
        durationSeconds: mobile.durationSeconds,
      });
      if (job.recording) {
        job.recording.mobilePath = job.mobilePath;
        job.recording.mobileBytes = mobile.bytes;
      }
      if (completed % 250 === 0 || completed === work.length) {
        process.stdout.write(
          `audit mobile audio ${completed}/${work.length}\n`
        );
      }
    } catch (error) {
      failures.push({
        path: path.relative(ROOT, job.output),
        error: String(error?.message ?? error),
      });
    }
  });

  if (selectedKinds.has("voices") && failures.length === 0) {
    const manifest = JSON.parse(fs.readFileSync(VOICE_MANIFEST, "utf8"));
    const byPath = new Map(
      work
        .filter((job) => job.recording)
        .map((job) => [job.recording.path, job.recording])
    );
    manifest.recordings = (manifest.recordings ?? []).map(
      (recording) => byPath.get(recording.path) ?? recording
    );
    const temporary = `${VOICE_MANIFEST}.${process.pid}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(manifest, null, 2)}\n`);
    fs.renameSync(temporary, VOICE_MANIFEST);
  }

  const totals = records.reduce(
    (result, record) => {
      result.sourceBytes += record.sourceBytes;
      result.mobileBytes += record.mobileBytes;
      result.byKind[record.kind] ??= {
        count: 0,
        sourceBytes: 0,
        mobileBytes: 0,
      };
      result.byKind[record.kind].count += 1;
      result.byKind[record.kind].sourceBytes += record.sourceBytes;
      result.byKind[record.kind].mobileBytes += record.mobileBytes;
      return result;
    },
    { sourceBytes: 0, mobileBytes: 0, byKind: {} }
  );
  fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
  fs.writeFileSync(
    REPORT_PATH,
    `${JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        selectedKinds: [...selectedKinds],
        generated,
        skipped,
        failures,
        totals,
        records,
      },
      null,
      2
    )}\n`
  );
  process.stdout.write(
    `mobile audio variants=${records.length} source=${(
      totals.sourceBytes / 1048576
    ).toFixed(2)}MiB mobile=${(totals.mobileBytes / 1048576).toFixed(
      2
    )}MiB failures=${failures.length}\n`
  );
  if (failures.length) {
    process.stderr.write(`${JSON.stringify(failures.slice(0, 20), null, 2)}\n`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  process.stderr.write(`${String(error?.stack ?? error)}\n`);
  process.exitCode = 1;
});
