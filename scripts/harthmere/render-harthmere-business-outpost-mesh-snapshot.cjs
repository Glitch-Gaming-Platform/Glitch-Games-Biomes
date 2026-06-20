#!/usr/bin/env node

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("fs");
const path = require("path");
const sharp = require("sharp");
const THREE = require("three");

const repo = path.resolve(process.argv[2] || process.cwd());
const outpostId =
  process.env.HARTHMERE_BUSINESS_SNAPSHOT_OUTPOST_ID ||
  "outpost_refinery_ashline";
const outDir = path.join(repo, "artifacts", "harthmere-business-snapshots");

const {
  HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS,
} = require(path.join(
  repo,
  "src/shared/harthmere/business_customer_simulator"
));
const {
  createHarthmereBusinessOutpostBuildingMesh,
  HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION,
} = require(path.join(
  repo,
  "src/client/game/renderers/local_dev/harthmere_business_outpost_buildings"
));

const GUIDE_COLOR = {
  arch_wall_window_glass: "#a8d9e8",
  carved_limestone: "#c9c0ad",
  clean_stone_tile: "#8f969b",
  cobblestone: "#6f7478",
  dark_workshop_stone: "#59616a",
  dirt: "#4f7e45",
  green_roof_sod: "#4e7c43",
  oakLog: "#6a4527",
  purple_canvas: "#8d43c9",
  red_canvas: "#b34f47",
  red_clay_roof: "#8f453c",
  smallOakSign: "#8b642f",
  stone: "#8f969b",
  stone_foundation: "#6f7478",
  warm_wood_plank: "#b08458",
  white_canvas: "#e5dcc8",
  woodContainer: "#76502f",
  wood_floor: "#c39a61",
  woodenStepper: "#c9c0ad",
};

function hexToRgb(hex) {
  const clean = String(hex).replace(/^#/, "");
  return {
    r: Number.parseInt(clean.slice(0, 2), 16),
    g: Number.parseInt(clean.slice(2, 4), 16),
    b: Number.parseInt(clean.slice(4, 6), 16),
  };
}

function rgbToHex({ r, g, b }) {
  return `#${[r, g, b]
    .map((v) => Math.max(0, Math.min(255, Math.round(v))).toString(16).padStart(2, "0"))
    .join("")}`;
}

function shade(hex, amount) {
  const rgb = hexToRgb(hex);
  const target = amount >= 0 ? 255 : 0;
  const weight = Math.abs(amount);
  return rgbToHex({
    r: rgb.r * (1 - weight) + target * weight,
    g: rgb.g * (1 - weight) + target * weight,
    b: rgb.b * (1 - weight) + target * weight,
  });
}

function escapeXml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function materialTokenOf(object) {
  const material = Array.isArray(object.material)
    ? object.material[0]
    : object.material;
  return (
    object.userData?.harthmereGuideMaterialToken ||
    material?.userData?.harthmereGuideMaterialToken ||
    "stone"
  );
}

function collectCuboids(root, record) {
  const cuboids = [];
  const matrix = new THREE.Matrix4();
  root.updateMatrixWorld(true);
  root.traverse((object) => {
    const part = object.userData?.harthmereBusinessOutpostPart;
    if (!part || part === "guide_customer_queue_space") return;
    const token = materialTokenOf(object);
    const sourceAsset = object.userData?.harthmereGuideSourceAssetKey;
    if (object.isInstancedMesh) {
      for (let i = 0; i < object.count; i += 1) {
        object.getMatrixAt(i, matrix);
        const pos = new THREE.Vector3().setFromMatrixPosition(matrix);
        cuboids.push({
          part,
          sourceAsset,
          token,
          x: pos.x,
          y: pos.y,
          z: pos.z,
          sx: 1,
          sy: 1,
          sz: 1,
          translucent: part === "guide_retaining_foundation_supports",
        });
      }
      return;
    }
    if (object.isMesh && object.geometry?.parameters) {
      const p = object.geometry.parameters;
      cuboids.push({
        part,
        sourceAsset,
        token,
        x: object.position.x,
        y: object.position.y,
        z: object.position.z,
        sx: Number(p.width ?? 1) * object.scale.x,
        sy: Number(p.height ?? 1) * object.scale.y,
        sz: Number(p.depth ?? 1) * object.scale.z,
        translucent: token === "arch_wall_window_glass",
      });
    }
  });
  const floorY = record.origin.y - 1.2;
  return cuboids.filter((cube) => cube.y + cube.sy / 2 >= floorY);
}

function projectPoint(point, bounds, scale) {
  const x = point.x - bounds.centerX;
  const z = point.z - bounds.centerZ;
  const y = point.y - bounds.minY;
  return {
    x: bounds.screenCx + (x - z) * scale.x,
    y: bounds.screenCy + (x + z) * scale.y - y * scale.z,
  };
}

function polygon(points) {
  return points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
}

function cuboidFaces(cube, bounds, scale) {
  const x0 = cube.x - cube.sx / 2;
  const x1 = cube.x + cube.sx / 2;
  const y0 = cube.y - cube.sy / 2;
  const y1 = cube.y + cube.sy / 2;
  const z0 = cube.z - cube.sz / 2;
  const z1 = cube.z + cube.sz / 2;
  const P = (x, y, z) => projectPoint({ x, y, z }, bounds, scale);
  return {
    top: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y1, z1), P(x0, y1, z1)],
    left: [P(x0, y1, z0), P(x0, y1, z1), P(x0, y0, z1), P(x0, y0, z0)],
    right: [P(x1, y1, z0), P(x1, y1, z1), P(x1, y0, z1), P(x1, y0, z0)],
    front: [P(x0, y1, z0), P(x1, y1, z0), P(x1, y0, z0), P(x0, y0, z0)],
  };
}

function renderSvg(record, cuboids) {
  const width = 1600;
  const height = 1000;
  const visibleCuboids = cuboids.filter(
    (cube) =>
      !/fixture|station|counter|storage|dashboard|seating/i.test(cube.part)
  );
  const xs = visibleCuboids.flatMap((c) => [c.x - c.sx / 2, c.x + c.sx / 2]);
  const ys = visibleCuboids.flatMap((c) => [c.y - c.sy / 2, c.y + c.sy / 2]);
  const zs = visibleCuboids.flatMap((c) => [c.z - c.sz / 2, c.z + c.sz / 2]);
  const bounds = {
    minX: Math.min(...xs),
    maxX: Math.max(...xs),
    minY: Math.min(...ys),
    maxY: Math.max(...ys),
    minZ: Math.min(...zs),
    maxZ: Math.max(...zs),
  };
  bounds.centerX = (bounds.minX + bounds.maxX) / 2;
  bounds.centerZ = (bounds.minZ + bounds.maxZ) / 2;
  bounds.screenCx = width * 0.5;
  bounds.screenCy = height * 0.62;
  const footprint = Math.max(
    bounds.maxX - bounds.minX,
    bounds.maxZ - bounds.minZ,
    1
  );
  const scale = {
    x: Math.min(34, 500 / footprint),
    y: Math.min(18, 260 / footprint),
    z: Math.min(30, 250 / Math.max(1, bounds.maxY - bounds.minY)),
  };

  const renderPriority = (cube) => {
    if (/window|door|stair|awning|sign/i.test(cube.part)) return 80;
    if (/fixture|station|counter|storage|dashboard|jobs_board/i.test(cube.part))
      return 60;
    if (/exterior_dressing|notice/i.test(cube.part)) return 50;
    if (/roof/i.test(cube.part)) return 10;
    return 0;
  };
  const ordered = [...visibleCuboids].sort((a, b) => {
    const pa = renderPriority(a);
    const pb = renderPriority(b);
    if (pa !== pb) return pa - pb;
    const da = a.x + a.z + a.y * 0.03;
    const db = b.x + b.z + b.y * 0.03;
    return da - db;
  });
  const faces = [];
  for (const cube of ordered) {
    const base = GUIDE_COLOR[cube.token] ?? GUIDE_COLOR.stone;
    const alpha = cube.translucent ? 0.72 : 1;
    const stroke = shade(base, -0.28);
    const polys = cuboidFaces(cube, bounds, scale);
    const attrs = `stroke="${stroke}" stroke-width="0.65" stroke-linejoin="round" opacity="${alpha}"`;
    faces.push(`<polygon points="${polygon(polys.left)}" fill="${shade(base, -0.18)}" ${attrs}/>`); 
    faces.push(`<polygon points="${polygon(polys.right)}" fill="${shade(base, -0.27)}" ${attrs}/>`); 
    faces.push(`<polygon points="${polygon(polys.front)}" fill="${shade(base, -0.08)}" ${attrs}/>`); 
    faces.push(`<polygon points="${polygon(polys.top)}" fill="${shade(base, 0.12)}" ${attrs}/>`); 
  }

  const materialChips = Object.entries(record.buildingStyleKit)
    .filter(([key]) => /foundation|floor|wall|roof|trim|awning/i.test(key))
    .map(
      ([key, value]) =>
        `<tspan x="74" dy="22">${escapeXml(key)}: ${escapeXml(value)}</tspan>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#172128"/>
      <stop offset="1" stop-color="#0f1716"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <ellipse cx="800" cy="755" rx="620" ry="190" fill="#203329"/>
  <ellipse cx="800" cy="768" rx="520" ry="142" fill="#2c4734"/>
  <g filter="url(#softShadow)">
    ${faces.join("\n    ")}
  </g>
  <g font-family="Inter, ui-sans-serif, system-ui, sans-serif" fill="#f0f7ef">
    <text x="72" y="82" font-size="32" font-weight="700">${escapeXml(record.displayName)}</text>
    <text x="72" y="116" font-size="18" fill="#bbd0c1">${escapeXml(record.businessType)} · ${escapeXml(HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION)}</text>
    <text x="72" y="162" font-size="16" fill="#d6e5db">
      ${materialChips}
    </text>
    <text x="72" y="935" font-size="16" fill="#a8c3b2">Snapshot generated from the actual renderer mesh: guide materials only, no legacy shells.</text>
  </g>
</svg>`;
}

function frontPriority(cube) {
  if (/window_glass|door_glass/i.test(cube.part)) return 90;
  if (/window|door|stair|awning|sign|notice|jobs_board/i.test(cube.part)) return 80;
  if (/corner|sill|trim/i.test(cube.part)) return 70;
  if (/roof/i.test(cube.part)) return 30;
  return 0;
}

function visibleInFrontElevation(record, cube) {
  if (/fixture|station|counter|storage|dashboard|seating|customer_queue/i.test(cube.part)) {
    return false;
  }
  if (/retaining_foundation_supports/i.test(cube.part)) return false;
  const frontZ = record.origin.z + 1.05;
  if (cube.z <= frontZ) return true;
  if (/jobs_board|notice|exterior_dressing/i.test(cube.part)) {
    return cube.z <= record.origin.z + 4.5;
  }
  return false;
}

function renderFrontSvg(record, cuboids) {
  const width = 1600;
  const height = 1000;
  const visible = cuboids.filter((cube) => visibleInFrontElevation(record, cube));
  const xs = visible.flatMap((c) => [c.x - c.sx / 2, c.x + c.sx / 2]);
  const ys = visible.flatMap((c) => [c.y - c.sy / 2, c.y + c.sy / 2]);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const scale = Math.min(42, (width - 420) / Math.max(1, maxX - minX));
  const renderWidth = (maxX - minX) * scale;
  const renderHeight = (maxY - minY) * scale;
  const originX = (width - renderWidth) / 2 + 120;
  const originY = (height - renderHeight) / 2 + 96;
  const rectFor = (cube) => ({
    x: originX + (cube.x - cube.sx / 2 - minX) * scale,
    y: originY + (maxY - (cube.y + cube.sy / 2)) * scale,
    w: Math.max(1, cube.sx * scale),
    h: Math.max(1, cube.sy * scale),
  });
  const ordered = [...visible].sort((a, b) => {
    const pa = frontPriority(a);
    const pb = frontPriority(b);
    if (pa !== pb) return pa - pb;
    if (a.z !== b.z) return b.z - a.z;
    return a.y - b.y || a.x - b.x;
  });
  const rects = ordered.map((cube) => {
    const base = GUIDE_COLOR[cube.token] ?? GUIDE_COLOR.stone;
    const r = rectFor(cube);
    const opacity = cube.token === "arch_wall_window_glass" ? 0.86 : 1;
    return `<rect x="${r.x.toFixed(1)}" y="${r.y.toFixed(1)}" width="${r.w.toFixed(1)}" height="${r.h.toFixed(1)}" fill="${base}" stroke="${shade(base, -0.28)}" stroke-width="1" opacity="${opacity}"/>`;
  });
  const materialChips = Object.entries(record.buildingStyleKit)
    .filter(([key]) => /foundation|floor|wall|roof|trim|awning/i.test(key))
    .map(
      ([key, value]) =>
        `<tspan x="74" dy="22">${escapeXml(key)}: ${escapeXml(value)}</tspan>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="sky" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="#172128"/>
      <stop offset="1" stop-color="#0f1716"/>
    </linearGradient>
    <filter id="softShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="18" stdDeviation="10" flood-color="#000" flood-opacity="0.35"/>
    </filter>
  </defs>
  <rect width="1600" height="1000" fill="url(#sky)"/>
  <ellipse cx="875" cy="820" rx="560" ry="92" fill="#203329"/>
  <g filter="url(#softShadow)">
    ${rects.join("\n    ")}
  </g>
  <g font-family="Inter, ui-sans-serif, system-ui, sans-serif" fill="#f0f7ef">
    <text x="72" y="82" font-size="32" font-weight="700">${escapeXml(record.displayName)}</text>
    <text x="72" y="116" font-size="18" fill="#bbd0c1">${escapeXml(record.businessType)} · front elevation from renderer mesh</text>
    <text x="72" y="162" font-size="16" fill="#d6e5db">
      ${materialChips}
    </text>
    <text x="72" y="935" font-size="16" fill="#a8c3b2">Fresh snapshot generated from the actual renderer mesh: guide materials only, no legacy shells.</text>
  </g>
</svg>`;
}

async function main() {
  const record = HARTHMERE_BUSINESS_OUTPOST_PROCEDURAL_BUILDINGS[outpostId];
  if (!record) {
    throw new Error(`Unknown outpost id: ${outpostId}`);
  }
  fs.mkdirSync(outDir, { recursive: true });
  const root = createHarthmereBusinessOutpostBuildingMesh(record);
  const cuboids = collectCuboids(root, record);
  const svg = renderFrontSvg(record, cuboids);
  const slug = record.displayName.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
  const svgPath = path.join(outDir, `${slug}-guide-mesh-snapshot.svg`);
  const pngPath = path.join(outDir, `${slug}-guide-mesh-snapshot.png`);
  fs.writeFileSync(svgPath, svg);
  await sharp(Buffer.from(svg)).png().toFile(pngPath);
  const materialTokens = [...new Set(cuboids.map((cube) => cube.token))].sort();
  console.log(
    JSON.stringify(
      {
        outpostId,
        displayName: record.displayName,
        renderVersion: HARTHMERE_BUSINESS_OUTPOST_BUILDING_RENDER_VERSION,
        cuboids: cuboids.length,
        materialTokens,
        pngPath,
        svgPath,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
