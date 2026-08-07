#!/usr/bin/env node
"use strict";

const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const sharp = require("sharp");

const ROOT = path.resolve(__dirname, "../..");
const DEFAULT_MANIFEST = path.join(
  ROOT,
  "artifacts/grove-quest-audit-manifest-2026-08-07.json"
);

function parseArgs(argv) {
  const options = {
    artifactsDir: undefined,
    reportPath: undefined,
    manifestPath: DEFAULT_MANIFEST,
    outputDir: undefined,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    switch (arg) {
      case "--artifacts-dir":
        options.artifactsDir = path.resolve(argv[++index]);
        break;
      case "--report":
        options.reportPath = path.resolve(argv[++index]);
        break;
      case "--manifest":
        options.manifestPath = path.resolve(argv[++index]);
        break;
      case "--output-dir":
        options.outputDir = path.resolve(argv[++index]);
        break;
      default:
        throw new Error(`Unknown argument: ${arg}`);
    }
  }
  if (!options.reportPath && !options.artifactsDir) {
    throw new Error("Provide --report or --artifacts-dir");
  }
  return options;
}

function readJson(filename) {
  return JSON.parse(fs.readFileSync(filename, "utf8"));
}

function newestReport(artifactsDir) {
  const reports = fs
    .readdirSync(artifactsDir)
    .filter((name) => name.endsWith("-report.json"))
    .map((name) => path.join(artifactsDir, name))
    .sort(
      (left, right) =>
        fs.statSync(right).mtimeMs - fs.statSync(left).mtimeMs
    );
  assert(reports.length > 0, `No report JSON found in ${artifactsDir}`);
  return reports[0];
}

function escapeXml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

async function frameMetrics(filename) {
  const image = sharp(filename, { failOn: "error" });
  const [metadata, stats, raw] = await Promise.all([
    image.metadata(),
    image.stats(),
    image
      .clone()
      .removeAlpha()
      .resize({ width: 160, height: 90, fit: "fill" })
      .raw()
      .toBuffer({ resolveWithObject: true }),
  ]);
  let darkPixels = 0;
  let brightPixels = 0;
  let luminanceTotal = 0;
  const { data, info } = raw;
  for (let offset = 0; offset < data.length; offset += info.channels) {
    const red = data[offset] ?? 0;
    const green = data[offset + 1] ?? red;
    const blue = data[offset + 2] ?? green;
    const luminance = 0.2126 * red + 0.7152 * green + 0.0722 * blue;
    luminanceTotal += luminance;
    if (luminance < 8) darkPixels += 1;
    if (luminance > 247) brightPixels += 1;
  }
  const pixels = info.width * info.height;
  return {
    filename,
    width: metadata.width ?? 0,
    height: metadata.height ?? 0,
    format: metadata.format,
    meanLuminance: luminanceTotal / pixels,
    darkRatio: darkPixels / pixels,
    brightRatio: brightPixels / pixels,
    entropy: Math.min(...stats.channels.slice(0, 3).map((channel) => channel.entropy)),
    sha256: crypto.createHash("sha256").update(fs.readFileSync(filename)).digest("hex"),
    raw: { data, info },
  };
}

function pairDifference(left, right) {
  assert.equal(left.raw.info.width, right.raw.info.width);
  assert.equal(left.raw.info.height, right.raw.info.height);
  assert.equal(left.raw.info.channels, right.raw.info.channels);
  let total = 0;
  let changed = 0;
  for (let index = 0; index < left.raw.data.length; index += 1) {
    const delta = Math.abs(left.raw.data[index] - right.raw.data[index]);
    total += delta;
    if (delta >= 8) changed += 1;
  }
  return {
    meanAbsoluteChannelDelta: total / left.raw.data.length,
    changedChannelRatio: changed / left.raw.data.length,
  };
}

function publicMetrics(metrics) {
  const { raw: _raw, ...result } = metrics;
  return result;
}

async function buildQuestContactSheet(outputPath, questTitle, objectiveRows) {
  const tileWidth = 400;
  const tileHeight = 225;
  const labelHeight = 42;
  const headerHeight = 56;
  const rowHeight = tileHeight + labelHeight;
  const canvasWidth = tileWidth * 2;
  const canvasHeight = headerHeight + rowHeight * objectiveRows.length;
  const composites = [];

  composites.push({
    input: Buffer.from(
      `<svg width="${canvasWidth}" height="${headerHeight}">
        <rect width="100%" height="100%" fill="#091525"/>
        <text x="18" y="36" fill="#ffffff" font-size="24" font-family="Arial, sans-serif">${escapeXml(
          questTitle
        )}</text>
      </svg>`
    ),
    left: 0,
    top: 0,
  });

  for (let index = 0; index < objectiveRows.length; index += 1) {
    const row = objectiveRows[index];
    const top = headerHeight + index * rowHeight;
    for (const [column, phase] of ["current", "completed"].entries()) {
      const filename = row[phase].filename;
      composites.push({
        input: await sharp(filename)
          .resize(tileWidth, tileHeight, { fit: "cover" })
          .png()
          .toBuffer(),
        left: column * tileWidth,
        top,
      });
      composites.push({
        input: Buffer.from(
          `<svg width="${tileWidth}" height="${labelHeight}">
            <rect width="100%" height="100%" fill="#10243a"/>
            <text x="10" y="17" fill="#8bdcff" font-size="13" font-family="Arial, sans-serif">Objective ${
              row.objectiveIndex + 1
            } — ${escapeXml(phase)}</text>
            <text x="10" y="34" fill="#ffffff" font-size="11" font-family="Arial, sans-serif">${escapeXml(
              row.objective.length > 67
                ? `${row.objective.slice(0, 64)}...`
                : row.objective
            )}</text>
          </svg>`
        ),
        left: column * tileWidth,
        top: top + tileHeight,
      });
    }
  }

  await sharp({
    create: {
      width: canvasWidth,
      height: canvasHeight,
      channels: 3,
      background: "#07111e",
    },
  })
    .composite(composites)
    .png()
    .toFile(outputPath);
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const reportPath =
    options.reportPath ?? newestReport(options.artifactsDir);
  const report = readJson(reportPath);
  const manifest = readJson(options.manifestPath);
  const artifactsDir = options.artifactsDir ?? path.dirname(reportPath);
  const outputDir =
    options.outputDir ?? path.join(artifactsDir, `${report.runId}-visual-audit`);
  fs.mkdirSync(outputDir, { recursive: true });

  const physicalPassIds = new Set(
    report.scenarios
      .filter(
        (scenario) =>
          scenario.status === "pass" &&
          (scenario.verdict === "physical_pass" ||
            scenario.verdict === "visual_state_pass")
      )
      .map((scenario) => scenario.questId)
  );
  assert(
    physicalPassIds.size > 0,
    "The report has no physical_pass quest scenarios"
  );

  const selectedRows = manifest.rows.filter((row) =>
    physicalPassIds.has(row.questId)
  );
  const failures = [];
  const rows = [];

  for (const row of selectedRows) {
    const stem = `${report.runId}-${row.questId}-objective-${String(
      row.objectiveIndex + 1
    ).padStart(2, "0")}`;
    const currentPath = path.join(artifactsDir, `${stem}-current.png`);
    const completedPath = path.join(artifactsDir, `${stem}-completed.png`);
    for (const [phase, filename] of [
      ["current", currentPath],
      ["completed", completedPath],
    ]) {
      if (!fs.existsSync(filename)) {
        failures.push(`${row.key}: missing ${phase} frame ${filename}`);
      }
    }
    if (!fs.existsSync(currentPath) || !fs.existsSync(completedPath)) {
      continue;
    }

    const [current, completed] = await Promise.all([
      frameMetrics(currentPath),
      frameMetrics(completedPath),
    ]);
    for (const [phase, metrics] of [
      ["current", current],
      ["completed", completed],
    ]) {
      if (metrics.width < 640 || metrics.height < 480) {
        failures.push(
          `${row.key}: ${phase} frame is only ${metrics.width}x${metrics.height}`
        );
      }
      if (metrics.meanLuminance < 6 || metrics.darkRatio > 0.985) {
        failures.push(
          `${row.key}: ${phase} frame is effectively black (mean=${metrics.meanLuminance.toFixed(
            2
          )}, dark=${metrics.darkRatio.toFixed(4)})`
        );
      }
      if (metrics.meanLuminance > 250 || metrics.brightRatio > 0.995) {
        failures.push(
          `${row.key}: ${phase} frame is effectively blank/white (mean=${metrics.meanLuminance.toFixed(
            2
          )}, bright=${metrics.brightRatio.toFixed(4)})`
        );
      }
      if (metrics.entropy < 0.25) {
        failures.push(
          `${row.key}: ${phase} frame has implausibly low visual entropy ${metrics.entropy.toFixed(
            3
          )}`
        );
      }
    }

    const difference = pairDifference(current, completed);
    if (
      difference.meanAbsoluteChannelDelta < 0.3 &&
      difference.changedChannelRatio < 0.005
    ) {
      failures.push(
        `${row.key}: current/completed frames are effectively unchanged (delta=${difference.meanAbsoluteChannelDelta.toFixed(
          3
        )}, changed=${difference.changedChannelRatio.toFixed(4)})`
      );
    }

    rows.push({
      key: row.key,
      questId: row.questId,
      questTitle: row.questTitle,
      objectiveIndex: row.objectiveIndex,
      objective: row.objective,
      trigger: row.trigger,
      markerId: row.markerId,
      current: publicMetrics(current),
      completed: publicMetrics(completed),
      difference,
    });
  }

  const questGroups = new Map();
  for (const row of rows) {
    const group = questGroups.get(row.questId) ?? [];
    group.push(row);
    questGroups.set(row.questId, group);
  }
  const contactSheets = [];
  for (const [questId, questRows] of questGroups) {
    questRows.sort((left, right) => left.objectiveIndex - right.objectiveIndex);
    const outputPath = path.join(outputDir, `${questId}-contact-sheet.png`);
    await buildQuestContactSheet(outputPath, questRows[0].questTitle, questRows);
    contactSheets.push({ questId, path: outputPath });
  }

  const result = {
    version: "grove-quest-visual-audit-v1",
    reportPath,
    reportRunId: report.runId,
    candidate: report.candidate,
    questCount: physicalPassIds.size,
    objectiveCount: selectedRows.length,
    expectedFrameCount: selectedRows.length * 2,
    auditedFrameCount: rows.length * 2,
    contactSheets,
    failures,
    rows,
    status: failures.length === 0 ? "pass" : "fail",
    generatedAt: new Date().toISOString(),
  };
  const outputPath = path.join(outputDir, "visual-audit.json");
  fs.writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`);
  console.log(
    `${result.status.toUpperCase()} Grove visual audit: ${result.questCount} quests, ${result.objectiveCount} objectives, ${result.auditedFrameCount}/${result.expectedFrameCount} frames`
  );
  console.log(`REPORT ${outputPath}`);
  if (failures.length) {
    for (const failure of failures) console.error(`FAIL ${failure}`);
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(`FAIL ${error?.stack || error}`);
  process.exitCode = 1;
});
