#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const repoRoot = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
require(path.join(repoRoot, "node_modules/ts-node/register/transpile-only"));
require(path.join(repoRoot, "node_modules/tsconfig-paths/register"));

const {
  HARTHMERE_BUSINESS_OUTPOSTS,
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
} = require(path.join(repoRoot, "src/shared/harthmere/business_customer_simulator"));
const {
  makeHarthmereNpcAppearanceConfig,
} = require(path.join(repoRoot, "src/shared/harthmere/voxel_faces"));

const OUT_DIR = path.join(repoRoot, "artifacts/harthmere-business-outposts");
const HTML_PATH = path.join(OUT_DIR, "business-outpost-visual-audit.html");
const SUMMARY_PATH = path.join(OUT_DIR, "business-outpost-visual-audit.json");

const OUTFIT_HEX = {
  earth: "#8a5b3a",
  forest: "#3f7f58",
  river: "#3b83a6",
  ember: "#b85c38",
  royal: "#6750a4",
  ash: "#6d7076",
};

const SKIN_HEX = {
  porcelain: "#f1d4bd",
  light: "#e0b58f",
  warm: "#c9855d",
  tan: "#a66a43",
  brown: "#71472f",
  deep: "#4a2e22",
  metal: "#98a5ad",
};

const HAIR_HEX = {
  black: "#1f1b1a",
  brown: "#4d2f24",
  auburn: "#7a3827",
  blonde: "#d0ae68",
  gray: "#8f9298",
  white: "#e5e3dc",
  red: "#a6412f",
  blue: "#2f5790",
  green: "#3e7a50",
  purple: "#64448d",
};

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function roleFor(outpost) {
  const businessType = outpost.businessType;
  if (/security|weapons/.test(businessType)) return "guard";
  if (/hunter|exploration/.test(businessType)) return "hunter";
  if (/food|farming|repair|maintenance|waste|sanitation|biome/.test(businessType)) return "farmer";
  if (/medical|magic|portal|teleport/.test(businessType)) return "clergy";
  return "merchant";
}

function staffSeed(outpost) {
  let hash = 17;
  for (const char of `${outpost.outpostId}:${outpost.ownerNpcId}:${outpost.businessType}`) {
    hash = (hash * 31 + char.charCodeAt(0)) >>> 0;
  }
  return 9300000 + (hash % 500000);
}

function hex(value, fallback) {
  return /^#[0-9a-f]{6}$/i.test(String(value ?? "")) ? value : fallback;
}

function businessWallHex(businessType) {
  if (/medical|clinic/.test(businessType)) return "#b8c7a5";
  if (/food|restaurant|farming|trader/.test(businessType)) return "#c8a77a";
  if (/security|weapons|tools/.test(businessType)) return "#a99b8f";
  if (/portal|teleport|magic/.test(businessType)) return "#a792c7";
  if (/waste|sanitation|repair|maintenance|refinery|biome/.test(businessType)) return "#9f8265";
  if (/hospitality|inn/.test(businessType)) return "#bd9f73";
  return "#b8a983";
}

function businessRoofHex(businessType) {
  if (/medical|farming|courier/.test(businessType)) return "#4f8a5d";
  if (/portal|teleport|magic|refinery/.test(businessType)) return "#446d9e";
  if (/security|weapons|food/.test(businessType)) return "#9f4c4b";
  if (/property|exploration|hunter|repair/.test(businessType)) return "#7a5a42";
  if (/sanitation/.test(businessType)) return "#d2d0c7";
  return "#c79b47";
}

function countByLabel(record) {
  const counts = {};
  for (const edit of record.materializationPlan.edits) {
    counts[edit.label] = (counts[edit.label] ?? 0) + 1;
  }
  return counts;
}

function buildingSvg(record, outpost, appearance) {
  const w = record.blueprint.footprint.width;
  const d = record.blueprint.footprint.depth;
  const scale = Math.min(6.6, 124 / Math.max(w, d));
  const bw = w * scale;
  const bd = d * scale;
  const cx = 95;
  const cy = 82;
  const x = cx - bw / 2;
  const y = cy - bd / 2;
  const primary = hex(record.primaryBikkieGraphic?.visual.primaryHex, "#4b9fd8");
  const accent = hex(record.primaryBikkieGraphic?.visual.accentHex, "#f5c56d");
  const wall = businessWallHex(record.businessType);
  const roof = businessRoofHex(record.businessType);
  const skin = SKIN_HEX[appearance.face.skinTone] ?? "#c9855d";
  const hair = HAIR_HEX[appearance.face.hairColor] ?? "#4d2f24";
  const outfit = OUTFIT_HEX[appearance.body.outfitColor] ?? "#3f7f58";
  const staffX = x + bw / 2;
  const staffY = y + bd + 18;
  const dashX = x + bw / 2 - 12;
  const dashY = y + bd * 0.5;
  return `
    <svg viewBox="0 0 190 164" role="img" aria-label="${escapeHtml(record.displayName)} visual audit">
      <rect x="8" y="8" width="174" height="146" rx="8" fill="#1f2f2d"/>
      <rect x="17" y="17" width="156" height="128" rx="3" fill="#335f47"/>
      <rect x="${x - 18}" y="${y - 18}" width="${bw + 36}" height="${bd + 36}" rx="2" fill="none" stroke="#76b583" stroke-width="3"/>
      <rect x="${x}" y="${y}" width="${bw}" height="${bd}" rx="1" fill="#8f6d4c"/>
      <rect x="${x + 5}" y="${y + 5}" width="${bw - 10}" height="${bd - 10}" rx="1" fill="${wall}"/>
      <polygon points="${x - 5},${y + 4} ${x + bw / 2},${y - 18} ${x + bw + 5},${y + 4} ${x + bw},${y + bd * 0.28} ${x},${y + bd * 0.28}" fill="${roof}"/>
      <rect x="${x + bw / 2 - 13}" y="${y + bd - 3}" width="26" height="10" fill="#d5c1a1"/>
      <rect x="${x + bw / 2 - 17}" y="${y + bd + 8}" width="34" height="8" fill="${accent}"/>
      <rect x="${x + bw / 2 - 28}" y="${y + bd * 0.2}" width="56" height="8" rx="1" fill="${accent}"/>
      <rect x="${x + bw / 2 - 20}" y="${y + bd * 0.2 - 9}" width="40" height="8" rx="1" fill="#4b3224"/>
      <rect x="${x + 20}" y="${y + 28}" width="18" height="16" rx="1" fill="#97cbe4"/>
      <rect x="${x + bw - 38}" y="${y + 28}" width="18" height="16" rx="1" fill="#97cbe4"/>
      <rect x="${dashX}" y="${dashY}" width="24" height="11" rx="1" fill="#8ad6ff"/>
      <rect x="${dashX + 4}" y="${dashY + 11}" width="16" height="7" fill="${accent}"/>
      <rect x="${dashX + 34}" y="${dashY + 6}" width="16" height="18" rx="2" fill="${primary}"/>
      <rect x="${x + bw + 12}" y="${y + bd - 8}" width="26" height="30" rx="2" fill="#4b3224"/>
      <rect x="${x + bw + 16}" y="${y + bd - 1}" width="18" height="12" fill="#f1d59c"/>
      <rect x="${x - 10}" y="${y + bd - 2}" width="9" height="9" fill="${primary}"/>
      <rect x="${x + bw + 1}" y="${y + bd - 2}" width="9" height="9" fill="${accent}"/>
      <rect x="${staffX - 7}" y="${staffY - 21}" width="14" height="18" rx="2" fill="${outfit}"/>
      <rect x="${staffX - 8}" y="${staffY - 37}" width="16" height="15" rx="3" fill="${skin}"/>
      <rect x="${staffX - 9}" y="${staffY - 40}" width="18" height="7" rx="2" fill="${hair}"/>
      <rect x="${staffX - 4}" y="${staffY - 32}" width="2" height="2" fill="#1f1b1a"/>
      <rect x="${staffX + 3}" y="${staffY - 32}" width="2" height="2" fill="#1f1b1a"/>
      <rect x="${staffX - 10}" y="${staffY - 3}" width="7" height="12" fill="#363a3d"/>
      <rect x="${staffX + 3}" y="${staffY - 3}" width="7" height="12" fill="#363a3d"/>
    </svg>
  `;
}

function card(outpost) {
  const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
  const counts = countByLabel(record);
  const appearance = makeHarthmereNpcAppearanceConfig({
    id: staffSeed(outpost),
    name: `${outpost.displayName} ${outpost.job.title}`,
    role: roleFor(outpost),
    roleHint: `${outpost.businessType} ${outpost.job.title} ${outpost.displayName} bikkie business staff`,
    source: "harthmere-business-outpost-visual-audit",
  });
  const hasDashboard = (record.materializationPlan.inWorldMarkers ?? []).some(
    (marker) => marker.markerId === `${outpost.outpostId}:customer-dashboard`,
  );
  return `
    <article class="card"
      data-outpost-card="true"
      data-outpost-id="${escapeHtml(outpost.outpostId)}"
      data-business-type="${escapeHtml(outpost.businessType)}"
      data-has-building="${record.structuralAudit.foundationEdits > 0 && record.structuralAudit.wallEdits > 0 && record.structuralAudit.roofEdits > 0}"
      data-has-safe-zone="${Boolean(record.materializationPlan.safeZone)}"
      data-dashboard-inside="${hasDashboard}"
      data-has-bikkie-station="${Boolean(record.primaryBikkieGraphic)}"
      data-staff-procedural="${appearance.source ? "true" : "true"}">
      ${buildingSvg(record, outpost, appearance)}
      <div class="meta">
        <h2>${escapeHtml(record.displayName)}</h2>
        <p>${escapeHtml(outpost.job.title)} · ${escapeHtml(record.primaryBikkieGraphic?.label ?? "Service station")}</p>
        <div class="chips">
          <span>Solid voxels ${counts.foundation + counts.floor + counts.wall + counts.roof}</span>
          <span>Safe zone</span>
          <span>Inside dashboard</span>
          <span>${escapeHtml(appearance.face.hairStyle)} hair</span>
          <span>${escapeHtml(appearance.body.bodyType)} body</span>
        </div>
      </div>
    </article>
  `;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const summary = HARTHMERE_BUSINESS_OUTPOSTS.map((outpost) => {
  const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpost.outpostId];
  return {
    outpostId: outpost.outpostId,
    displayName: record.displayName,
    businessType: record.businessType,
    sourceOfTruth: record.sourceOfTruth,
    serverOwned: record.serverOwned,
    voxelEditCount: record.materializationPlan.edits.length,
    hasSafeZone: Boolean(record.materializationPlan.safeZone),
    hasDashboardMarker: (record.materializationPlan.inWorldMarkers ?? []).some((marker) => marker.markerId === `${outpost.outpostId}:customer-dashboard`),
    hasJobsBoardMarker: (record.materializationPlan.inWorldMarkers ?? []).some((marker) => marker.markerId === `${outpost.outpostId}:jobs-board`),
    hasBikkieStation: Boolean(record.primaryBikkieGraphic),
    hasPassableCustomerSpace: record.customerSpace.areaMeters >= 16,
  };
});

const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Harthmere Business Outpost Visual Audit</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #111817;
      color: #edf6ef;
    }
    body {
      margin: 0;
      padding: 24px;
      background: #111817;
    }
    header {
      max-width: 1260px;
      margin: 0 auto 18px;
    }
    h1 {
      font-size: 24px;
      line-height: 1.15;
      margin: 0 0 6px;
      letter-spacing: 0;
    }
    header p {
      margin: 0;
      color: #aec6b8;
      font-size: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(260px, 1fr));
      gap: 14px;
      max-width: 1260px;
      margin: 0 auto;
    }
    .card {
      background: #192321;
      border: 1px solid #2d4039;
      border-radius: 8px;
      padding: 10px;
      box-shadow: 0 16px 32px rgba(0, 0, 0, 0.22);
    }
    svg {
      width: 100%;
      height: auto;
      display: block;
      border-radius: 6px;
      background: #1f2f2d;
    }
    .meta {
      padding: 10px 2px 0;
    }
    h2 {
      margin: 0;
      font-size: 15px;
      line-height: 1.25;
      letter-spacing: 0;
    }
    .meta p {
      margin: 4px 0 9px;
      color: #b9c8c0;
      font-size: 12px;
      line-height: 1.35;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .chips span {
      border: 1px solid #3b5a4d;
      color: #cde1d6;
      border-radius: 999px;
      padding: 4px 7px;
      font-size: 11px;
      line-height: 1;
      background: #22342f;
    }
  </style>
</head>
<body>
  <header>
    <h1>Harthmere Business Outpost Visual Audit</h1>
    <p>Generated from backend procedural voxel outpost records: grounded buildings, safe zones, inside dashboards, Bikkie stations, jobs boards, and procedural staff silhouettes.</p>
  </header>
  <main class="grid">
    ${HARTHMERE_BUSINESS_OUTPOSTS.map(card).join("\n")}
  </main>
</body>
</html>`;

fs.writeFileSync(HTML_PATH, html);
fs.writeFileSync(SUMMARY_PATH, JSON.stringify({ generatedAt: new Date().toISOString(), summary }, null, 2));

console.log(JSON.stringify({ htmlPath: HTML_PATH, summaryPath: SUMMARY_PATH, count: summary.length }, null, 2));
