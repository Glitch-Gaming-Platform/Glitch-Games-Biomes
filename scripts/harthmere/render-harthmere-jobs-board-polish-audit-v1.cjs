#!/usr/bin/env node
"use strict";

process.env.TS_NODE_COMPILER_OPTIONS = JSON.stringify({
  module: "commonjs",
  moduleResolution: "node",
  jsx: "react",
});

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const THREE = require("three");

const {
  HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144,
  HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144,
  HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146,
  createHarthmereJobsBoardKioskMeshV144,
} = require("../../src/client/game/renderers/local_dev/harthmere_jobs_board_marker_v144");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const outDir = path.join(root, "artifacts", "harthmere-jobs-board-polish");
const htmlPath = path.join(outDir, "grove-jobs-board-polish-audit-v1.html");
const summaryPath = path.join(outDir, "summary.json");

const GROVE_FOUNTAIN_CENTER = { x: 496, y: 70, z: -126 };

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

function rounded(value) {
  return Number(value.toFixed(4));
}

function serializeJobsBoardMesh(location) {
  const mesh = createHarthmereJobsBoardKioskMeshV144(location);
  mesh.updateMatrixWorld(true);
  const boxes = [];
  const lights = [];
  const partCounts = {};

  mesh.traverse((child) => {
    const part = child.userData?.harthmereJobsBoardPart;
    if (typeof part === "string") {
      partCounts[part] = (partCounts[part] ?? 0) + 1;
    }

    if (child instanceof THREE.PointLight) {
      const position = new THREE.Vector3();
      child.getWorldPosition(position);
      lights.push({
        name: child.name,
        part,
        color: `#${new THREE.Color(child.color).getHexString()}`,
        intensity: child.intensity,
        distance: child.distance,
        position: [rounded(position.x), rounded(position.y), rounded(position.z)],
      });
      return;
    }

    if (!(child instanceof THREE.Mesh)) return;
    const params = child.geometry?.parameters;
    if (!params || !Number.isFinite(params.width)) return;
    const position = new THREE.Vector3();
    const quaternion = new THREE.Quaternion();
    child.getWorldPosition(position);
    child.getWorldQuaternion(quaternion);
    const material = Array.isArray(child.material)
      ? child.material[0]
      : child.material;
    boxes.push({
      name: child.name,
      part,
      polishVersion: child.userData.harthmereJobsBoardPolishVersion,
      animated: Boolean(child.userData.harthmereJobsBoardAnimatedBanner),
      size: [params.width, params.height, params.depth].map(rounded),
      position: [position.x, position.y, position.z].map(rounded),
      quaternion: [quaternion.x, quaternion.y, quaternion.z, quaternion.w].map(rounded),
      color: `#${material.color.getHexString()}`,
      opacity: material.opacity ?? 1,
    });
  });

  const box = new THREE.Box3().setFromObject(mesh);
  const size = new THREE.Vector3();
  box.getSize(size);

  return {
    location,
    markerVersion: mesh.userData.harthmereJobsBoardMarkerVersion,
    polishVersion: mesh.userData.harthmereJobsBoardPolishVersion,
    boxes,
    lights,
    partCounts,
    boundsSize: [size.x, size.y, size.z].map(rounded),
  };
}

function renderJobsBoardSvg(audit) {
  const width = 1280;
  const height = 720;
  const board = audit.location;
  const scale = Math.min(width / 13.8, height / 10.5);
  const centerX = width * 0.54;
  const centerY = height * 0.67;
  const partOrder = {
    stone_plinth_shadow: 1,
    stone_plinth: 2,
    front_access_step: 3,
    interaction_glow: 4,
    lantern_post: 5,
    lantern_cap: 6,
    lantern_glow: 7,
    side_post: 8,
    notice_board_back: 9,
    notice_board_face: 10,
    frame_rail: 11,
    roof_beam: 12,
    roof_trim: 13,
    title_plaque: 14,
    posted_notice: 15,
    notice_ink_line: 16,
    notice_pin: 17,
    side_ribbon: 18,
    title_letter_block: 19,
    pennant_pole: 20,
    animated_banner: 21,
  };

  const project = (position) => {
    const dx = position[0] - board.x;
    const dy = position[1] - board.y;
    const dz = position[2] - board.z;
    return {
      x: centerX + dx * scale + dz * scale * 0.2,
      y: centerY - dy * scale + dz * scale * 0.15,
      depth: dz + dy * 0.08,
    };
  };

  const shade = (hex, amount) => {
    const clean = String(hex || "#ffffff").replace("#", "");
    const value = Number.parseInt(clean, 16);
    const r = Math.max(0, Math.min(255, Math.round(((value >> 16) & 255) * amount)));
    const g = Math.max(0, Math.min(255, Math.round(((value >> 8) & 255) * amount)));
    const b = Math.max(0, Math.min(255, Math.round((value & 255) * amount)));
    return `rgb(${r},${g},${b})`;
  };

  const rotationFromQuaternion = (q) => {
    if (!Array.isArray(q)) return 0;
    return (2 * Math.atan2(q[2] || 0, q[3] || 1) * 180) / Math.PI;
  };

  const ellipse = (position, rx, ry, fill, stroke = "", extra = "") => {
    const p = project(position);
    return `<ellipse cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" rx="${(rx * scale).toFixed(2)}" ry="${(ry * scale).toFixed(2)}" fill="${esc(fill)}"${stroke ? ` stroke="${esc(stroke)}" stroke-width="${Math.max(1, scale * 0.04).toFixed(2)}"` : ""} ${extra}/>`;
  };

  const rect = (x, y, w, h, fill, extra = "") =>
    `<rect x="${x.toFixed(2)}" y="${y.toFixed(2)}" width="${w.toFixed(2)}" height="${h.toFixed(2)}" fill="${esc(fill)}" ${extra}/>`;

  const line = (from, to, color, strokeWidth, extra = "") => {
    const a = project(from);
    const b = project(to);
    return `<line x1="${a.x.toFixed(2)}" y1="${a.y.toFixed(2)}" x2="${b.x.toFixed(2)}" y2="${b.y.toFixed(2)}" stroke="${esc(color)}" stroke-width="${strokeWidth.toFixed(2)}" stroke-linecap="round" ${extra}/>`;
  };

  const shapes = [];
  shapes.push(`<rect width="1280" height="720" fill="url(#sky)"/>`);
  shapes.push(ellipse([board.x - 1.8, board.y - 0.05, board.z + 1.4], 13.5, 8.7, "#315847"));
  shapes.push(line([GROVE_FOUNTAIN_CENTER.x, board.y, GROVE_FOUNTAIN_CENTER.z], [board.x, board.y, board.z + 2.3], "#8d938c", scale * 1.05));
  shapes.push(line([GROVE_FOUNTAIN_CENTER.x + 0.1, board.y, GROVE_FOUNTAIN_CENTER.z + 0.16], [board.x - 0.42, board.y, board.z + 2.62], "#d7cb86", scale * 0.14));
  shapes.push(ellipse([GROVE_FOUNTAIN_CENTER.x, board.y + 0.32, GROVE_FOUNTAIN_CENTER.z], 2.65, 1.25, "#a8b3b4", "#69777a"));
  shapes.push(ellipse([GROVE_FOUNTAIN_CENTER.x, board.y + 0.52, GROVE_FOUNTAIN_CENTER.z], 1.96, 0.86, "#5fb4c8", "#daf5f7"));
  const spout = project([GROVE_FOUNTAIN_CENTER.x, board.y + 1.1, GROVE_FOUNTAIN_CENTER.z]);
  shapes.push(rect(spout.x - scale * 0.22, spout.y - scale * 0.58, scale * 0.44, scale * 0.9, "#c1c7c8"));
  shapes.push(rect(spout.x - scale * 0.06, spout.y - scale * 1.25, scale * 0.12, scale * 0.72, "rgba(216,247,255,0.82)"));
  shapes.push(`<text x="${(spout.x - scale * 1.75).toFixed(2)}" y="${(spout.y + scale * 1.84).toFixed(2)}" fill="#d6e2db" font-size="${Math.max(11, scale * 0.18).toFixed(2)}" font-weight="700">Grove fountain</text>`);

  const sorted = audit.boxes.slice().sort((a, b) => {
    const aOrder = partOrder[a.part] ?? 50;
    const bOrder = partOrder[b.part] ?? 50;
    if (aOrder !== bOrder) return aOrder - bOrder;
    return project(a.position).depth - project(b.position).depth;
  });

  for (const box of sorted) {
    const p = project(box.position);
    const w = Math.max(2, box.size[0] * scale);
    const h = Math.max(2, box.size[1] * scale);
    const d = Math.max(1, box.size[2] * scale * 0.42);
    const angle = rotationFromQuaternion(box.quaternion);
    if (box.part === "interaction_glow" || box.part === "lantern_glow") {
      shapes.push(`<ellipse cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" rx="${(Math.max(w, h) * 0.8).toFixed(2)}" ry="${(Math.max(w, h) * 0.55).toFixed(2)}" fill="${esc(box.color)}" opacity="0.28"/>`);
    }
    shapes.push(`<g transform="translate(${p.x.toFixed(2)} ${p.y.toFixed(2)}) rotate(${angle.toFixed(2)})" data-part="${esc(box.part)}" data-name="${esc(box.name)}">`);
    shapes.push(rect(-w / 2 + d, -h / 2 + d, w, h, shade(box.color, 0.58), 'opacity="0.9"'));
    shapes.push(rect(-w / 2, -h / 2, w, h, box.color));
    if (w > 8 && h > 8) {
      shapes.push(rect(-w / 2, -h / 2, w, h, "none", `stroke="rgba(19,24,25,0.34)" stroke-width="${Math.max(1, scale * 0.018).toFixed(2)}"`));
    }
    shapes.push("</g>");
  }

  const access = project([board.x, board.y + 0.95, board.z + 2.65]);
  const keyRadius = Math.max(12, scale * 0.25);
  shapes.push(`<circle cx="${access.x.toFixed(2)}" cy="${access.y.toFixed(2)}" r="${keyRadius.toFixed(2)}" fill="#101719" stroke="#f7f0dc" stroke-width="${Math.max(2, scale * 0.035).toFixed(2)}"/>`);
  shapes.push(`<text x="${access.x.toFixed(2)}" y="${(access.y + keyRadius * 0.38).toFixed(2)}" fill="#f7f0dc" font-size="${Math.max(13, scale * 0.28).toFixed(2)}" font-weight="800" text-anchor="middle">F</text>`);

  return `<svg id="scene" class="audit-scene" viewBox="0 0 ${width} ${height}" role="img" aria-label="3D visual audit of the polished Grove Jobs Board" preserveAspectRatio="xMidYMid meet">
    <defs>
      <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0" stop-color="#254b55"/>
        <stop offset="0.52" stop-color="#213c3a"/>
        <stop offset="1" stop-color="#203128"/>
      </linearGradient>
    </defs>
    ${shapes.join("\n    ")}
  </svg>`;
}

function renderHtml(audit) {
  const data = JSON.stringify(audit);
  return `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Grove Jobs Board Polish Audit</title>
  <style>
    :root {
      color-scheme: dark;
      font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
      background: #172326;
      color: #f7f0dc;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      overflow: hidden;
      background:
        radial-gradient(circle at 24% 30%, rgba(103, 156, 146, 0.24), transparent 24rem),
        linear-gradient(180deg, #20353a 0%, #121d22 100%);
    }
    .audit-scene {
      display: block;
      inline-size: 100vw;
      block-size: 100vh;
    }
    .audit-label {
      position: fixed;
      inset-block-start: 14px;
      inset-inline-start: 14px;
      max-width: min(440px, calc(100vw - 28px));
      padding: 12px 14px;
      border: 1px solid rgba(255, 224, 142, 0.35);
      border-radius: 8px;
      background: rgba(22, 27, 28, 0.74);
      box-shadow: 0 14px 40px rgba(0, 0, 0, 0.28);
      backdrop-filter: blur(10px);
    }
    .audit-label h1 {
      margin: 0;
      font-size: 15px;
      letter-spacing: 0;
      line-height: 1.25;
    }
    .audit-label p {
      margin: 5px 0 0;
      color: rgba(247, 240, 220, 0.78);
      font-size: 12px;
      line-height: 1.35;
    }
    .audit-chip-row {
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
      margin-block-start: 9px;
    }
    .audit-chip {
      padding: 4px 7px;
      border: 1px solid rgba(247, 240, 220, 0.18);
      border-radius: 999px;
      background: rgba(247, 240, 220, 0.08);
      color: rgba(247, 240, 220, 0.82);
      font-size: 11px;
      white-space: nowrap;
    }
    @media (max-width: 560px) {
      .audit-label {
        inset-block-start: auto;
        inset-block-end: 12px;
      }
      .audit-label h1 { font-size: 14px; }
      .audit-label p { font-size: 11px; }
    }
  </style>
</head>
<body data-harthmere-jobs-board-visual-audit="v1">
  <div class="audit-label" aria-label="Grove Jobs Board visual audit details">
    <h1>Grove Jobs Board at the Fountain</h1>
    <p>Current placement: ${esc(audit.location.x)}, ${esc(audit.location.y)}, ${esc(audit.location.z)}. Fountain center reference: ${esc(GROVE_FOUNTAIN_CENTER.x)}, ${esc(GROVE_FOUNTAIN_CENTER.y)}, ${esc(GROVE_FOUNTAIN_CENTER.z)}.</p>
    <div class="audit-chip-row">
      <span class="audit-chip">${esc(audit.boxes.length)} procedural pieces</span>
      <span class="audit-chip">${esc(audit.partCounts.posted_notice ?? 0)} posted notices</span>
      <span class="audit-chip">${esc(audit.partCounts.lantern_glow ?? 0)} lanterns</span>
      <span class="audit-chip">Access step visible</span>
    </div>
  </div>
  ${renderJobsBoardSvg(audit)}
  <script>
    const AUDIT = ${data};
    const FOUNTAIN = ${JSON.stringify(GROVE_FOUNTAIN_CENTER)};
    const scene = document.getElementById("scene");

    window.__harthmereJobsBoardPolishAuditV1 = {
      markerVersion: AUDIT.markerVersion,
      polishVersion: AUDIT.polishVersion,
      location: AUDIT.location,
      fountainCenter: FOUNTAIN,
      partCounts: AUDIT.partCounts,
      boundsSize: AUDIT.boundsSize,
      metrics() {
        return {
          markerVersion: AUDIT.markerVersion,
          polishVersion: AUDIT.polishVersion,
          location: AUDIT.location,
          fountainDistance: Math.hypot(AUDIT.location.x - FOUNTAIN.x, AUDIT.location.z - FOUNTAIN.z),
          boxes: AUDIT.boxes.length,
          postedNotices: AUDIT.partCounts.posted_notice || 0,
          lanterns: AUDIT.partCounts.lantern_glow || 0,
          accessStep: AUDIT.partCounts.front_access_step || 0,
          interactionGlow: AUDIT.partCounts.interaction_glow || 0,
          scene: {
            tagName: scene?.tagName,
            viewBox: scene?.getAttribute("viewBox"),
            clientWidth: scene?.clientWidth,
            clientHeight: scene?.clientHeight,
          },
        };
      },
    };
  </script>
</body>
</html>`;
}

function main() {
  const location = HARTHMERE_JOBS_BOARD_MARKER_LOCATIONS_V144.find(
    (candidate) => candidate.id === "harthmere_grove_market_jobs_board",
  );
  if (!location) {
    throw new Error("Grove Jobs Board procedural location was not found");
  }

  const audit = serializeJobsBoardMesh(location);
  const fountainDistance = Math.hypot(
    location.x - GROVE_FOUNTAIN_CENTER.x,
    location.z - GROVE_FOUNTAIN_CENTER.z,
  );
  if (audit.polishVersion !== HARTHMERE_JOBS_BOARD_PROCEDURAL_POLISH_VERSION_V146) {
    throw new Error("Jobs Board mesh did not carry the production polish version");
  }
  if (audit.markerVersion !== HARTHMERE_JOBS_BOARD_PROCEDURAL_MARKER_VERSION_V144) {
    throw new Error("Jobs Board mesh did not carry the procedural marker version");
  }
  if ((audit.partCounts.posted_notice ?? 0) < 10) {
    throw new Error("Jobs Board visual audit expected at least ten posted notices");
  }
  if ((audit.partCounts.front_access_step ?? 0) !== 1) {
    throw new Error("Jobs Board visual audit expected one front access step");
  }
  if (fountainDistance > 9) {
    throw new Error(`Jobs Board is too far from the Grove fountain visual context: ${fountainDistance}`);
  }

  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(htmlPath, renderHtml(audit));
  fs.writeFileSync(summaryPath, JSON.stringify({
    generatedAt: new Date().toISOString(),
    htmlPath,
    markerVersion: audit.markerVersion,
    polishVersion: audit.polishVersion,
    location,
    fountainCenter: GROVE_FOUNTAIN_CENTER,
    fountainDistance: rounded(fountainDistance),
    boundsSize: audit.boundsSize,
    boxes: audit.boxes.length,
    partCounts: audit.partCounts,
  }, null, 2));

  console.log(JSON.stringify({
    htmlPath,
    summaryPath,
    location,
    fountainDistance: rounded(fountainDistance),
    boxes: audit.boxes.length,
    partCounts: audit.partCounts,
  }, null, 2));
}

main();
