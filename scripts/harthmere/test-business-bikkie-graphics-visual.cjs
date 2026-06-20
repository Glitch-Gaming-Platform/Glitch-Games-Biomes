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
const { resolvePlaywright } = require("./harthmere-live-runtime-probe.cjs");

const {
  HARTHMERE_BUSINESS_BIKKIE_GRAPHICS,
  HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS,
  HARTHMERE_BUSINESS_CUSTOMER_NPCS,
  HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS,
  validateHarthmereBusinessBikkieGraphics,
} = require("../../src/shared/harthmere/business_customer_simulator");
const {
  createHarthmereBusinessServiceProceduralClip,
  renderHarthmereBusinessServiceFrameSvg,
} = require("../../src/shared/harthmere/business_service_procedural_animations");
const {
  HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID,
} = require("../../src/shared/harthmere/mmo_farming_food_stamina");
const {
  HARTHMERE_EXOTIC_MATTER_BLOCK_ITEM_IDS,
  HARTHMERE_EXOTIC_MATTER_ITEM_IDS,
  ensureHarthmereProductionCraftingCatalogue,
} = require("../../src/shared/harthmere/mmo_crafting_catalogue");
const {
  getHarthmereItemDefinition,
} = require("../../src/shared/harthmere/mmo_inventory_authority");
const {
  harthmereResolveBikkieVisual,
} = require("../../src/shared/harthmere/bikkie_visual_resolver");

const root = process.argv[2] ? path.resolve(process.argv[2]) : process.cwd();
const outDir = process.env.HARTHMERE_SCREENSHOT_OUT || path.join(root, "artifacts", "harthmere");
const timeoutMs = Number(process.env.HARTHMERE_E2E_TIMEOUT_MS || 60000);
const htmlPath = path.join(outDir, "business-bikkie-graphics-visual-audit.html");
const desktopPng = path.join(outDir, "business-bikkie-graphics-visual-audit-desktop.png");
const mobilePng = path.join(outDir, "business-bikkie-graphics-visual-audit-mobile.png");
const summaryPath = path.join(outDir, "business-bikkie-graphics-visual-audit.json");

let ok = true;
function pass(label) {
  console.log(`OK ${label}`);
}
function fail(label, detail) {
  ok = false;
  console.log(`FAIL ${label}`);
  if (detail) {
    for (const line of (Array.isArray(detail) ? detail : String(detail).split("\n")).filter(Boolean)) {
      console.log(`  - ${line}`);
    }
  }
}

function esc(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;",
  }[char]));
}

function displayLabel(value) {
  return String(value ?? "")
    .replace(/([a-z])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

function cssColorFor(label, index) {
  const text = String(label ?? "").toLowerCase();
  if (/#([0-9a-f]{6})/i.test(text)) return text.match(/#([0-9a-f]{6})/i)[0];
  if (/red|meat|magenta|ember/.test(text)) return "#c65a4d";
  if (/orange|carrot|copper|amber|brass/.test(text)) return "#c9833f";
  if (/yellow|gold|wheat|tan|seed|twine|paper|cream|white|linen/.test(text)) return "#d7bd78";
  if (/green|leaf|soil|muck|seaweed/.test(text)) return "#5f9a68";
  if (/blue|water|glass|cyan|electric|screen|home/.test(text)) return "#4d8fcb";
  if (/violet|purple/.test(text)) return "#8a68c4";
  if (/black|coal|charcoal|dark/.test(text)) return "#303541";
  if (/gray|grey|silver|stone|iron|metal|scale/.test(text)) return "#949daa";
  if (/brown|wood|oak|log|chestnut|coffee|hide/.test(text)) return "#8a6246";
  const fallback = ["#7aa7c7", "#b986c7", "#8fc983", "#d19b65", "#c7c06d"][index % 5];
  return fallback;
}

function visualBadge(visual, label, className = "visual-badge") {
  const colors = visual?.hexColors?.length ? visual.hexColors : ["#4a5567", "#8390a0"];
  const primary = visual?.primaryHex || colors[0];
  const accent = visual?.accentHex || colors[1] || "#8390a0";
  return `
    <div
      class="${className}"
      data-bikkie-visual="true"
      data-visual-source="${esc(visual?.source)}"
      data-visual-kind="${esc(visual?.shape)}"
      data-visual-id="${esc(visual?.visualId)}"
      data-icon-asset-path="${esc(visual?.iconAssetPath ?? "")}"
      style="--visual-primary:${esc(primary)};--visual-accent:${esc(accent)};background:${esc(visual?.cssGradient ?? `linear-gradient(135deg, ${primary}, ${accent})`)}"
      aria-label="${esc(visual?.ariaLabel ?? `${label} visual`)}"
    >
      <span>${esc(visual?.glyph ?? displayLabel(label).slice(0, 2).toUpperCase())}</span>
    </div>
  `;
}

function fixtureCard(graphic, index) {
  const sizeLabel = graphic.boxSize ? `${graphic.boxSize[0]}x${graphic.boxSize[1]}x${graphic.boxSize[2]}` : displayLabel(graphic.kind);
  const swatches = graphic.colors.map((color, colorIndex) =>
    `<span class="swatch" title="${esc(color)}" style="background:${esc(graphic.visual.hexColors[colorIndex] ?? cssColorFor(color, colorIndex))}"></span>`
  ).join("");
  const footprintStyle = graphic.boxSize
    ? `--item-w:${28 + graphic.boxSize[0] * 8}px;--item-h:${28 + graphic.boxSize[1] * 8}px;`
    : "";
  return `
    <article class="fixture-card" data-bikkie-graphic-id="${esc(graphic.graphicId)}" data-bikkie-id="${graphic.bikkieId}" data-kind="${esc(graphic.kind)}" data-role="${esc(graphic.role)}" data-box-size="${esc(sizeLabel)}" data-visual-source="${esc(graphic.visual.source)}" data-visual-kind="${esc(graphic.visual.shape)}">
      <div style="${footprintStyle}">${visualBadge(graphic.visual, graphic.label, "visual-badge fixture-icon")}</div>
      <div class="fixture-body">
        <h3 class="fixture-title">${esc(graphic.label)}</h3>
        <p class="fixture-meta">${esc(displayLabel(graphic.role))} / ${esc(displayLabel(graphic.kind))} / ${esc(sizeLabel)}</p>
        <p class="fixture-use">${esc(graphic.businessUse)}</p>
        <p class="fixture-detail">id ${graphic.bikkieId}${graphic.galoisPath ? ` / ${esc(graphic.galoisPath)}` : ""}</p>
        <div class="swatches" aria-label="${esc(graphic.label)} colors">${swatches}</div>
      </div>
    </article>
  `;
}

function businessSection([typeId, graphics], index) {
  const definition = HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS[typeId];
  return `
    <section class="business-section" data-business-type="${esc(typeId)}" data-bikkie-business-fixtures="true">
      <header class="business-header">
        <div>
          <h2>${esc(displayLabel(typeId))}</h2>
          <p>${esc(definition.interfaceTitle)} / ${esc(definition.counterLabel)}</p>
        </div>
        <span class="business-count">${graphics.length} fixtures</span>
      </header>
      <div class="fixture-grid">${graphics.map((graphic, itemIndex) => fixtureCard(graphic, index * 10 + itemIndex)).join("")}</div>
    </section>
  `;
}

function servicePropCards() {
  const rows = [];
  for (const definition of Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS)) {
    for (const offer of definition.offers) {
      const clip = createHarthmereBusinessServiceProceduralClip({
        cueId: offer.animationCue,
        customerNpc: HARTHMERE_BUSINESS_CUSTOMER_NPCS[0],
        sampleCount: 3,
      });
      const frame = clip.frames[1];
      const svg = renderHarthmereBusinessServiceFrameSvg(clip, frame, { width: 220, height: 150 });
      rows.push(`
        <article class="prop-card" data-service-cue="${esc(offer.animationCue)}" data-prop-source="${esc(frame.prop.source)}" data-visual-source="${esc(frame.prop.visual.source)}" data-visual-kind="${esc(frame.prop.visual.shape)}" data-bikkie-id="${frame.prop.bikkieId ?? ""}" data-graphic-id="${esc(frame.prop.graphicId ?? "")}">
          ${svg}
          <h3>${esc(offer.label)}</h3>
          <p>${esc(displayLabel(definition.typeId))} / ${esc(frame.prop.bikkieName ?? frame.prop.label)}</p>
        </article>
      `);
    }
  }
  return rows.join("");
}

function foodCatalogVisualCards() {
  return Object.entries(HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID)
    .sort((a, b) => String(a[1].displayName).localeCompare(String(b[1].displayName)))
    .map(([itemId, metadata]) => {
      const visual = harthmereResolveBikkieVisual({
        id: itemId,
        bikkieId: metadata.bikkieId,
        label: metadata.displayName,
        kind: metadata.category,
        galoisPath: metadata.galoisPath,
        visualAsset: metadata.visualAsset,
      });
      return `
        <article class="compact-card" data-catalog-visual-card="food" data-item-id="${esc(itemId)}" data-visual-source="${esc(visual.source)}" data-visual-kind="${esc(visual.shape)}">
          ${visualBadge(visual, metadata.displayName)}
          <div>
            <h3>${esc(metadata.displayName)}</h3>
            <p>${esc(metadata.category ?? "Item")} / ${esc(metadata.action ?? "view")} / ${esc(itemId)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function exoticMatterVisualCards() {
  ensureHarthmereProductionCraftingCatalogue();
  const ids = Object.values(HARTHMERE_EXOTIC_MATTER_ITEM_IDS);
  const blockIds = new Set(HARTHMERE_EXOTIC_MATTER_BLOCK_ITEM_IDS);
  return ids
    .map((itemId) => {
      const item = getHarthmereItemDefinition(itemId);
      const visual = harthmereResolveBikkieVisual({
        id: itemId,
        label: item?.displayName ?? itemId,
        kind: item?.category,
        objectMetadata: item?.objectMetadata,
        bikkieGraphicHints: item?.objectMetadata?.bikkieGraphicHints,
      });
      return `
        <article class="compact-card" data-catalog-visual-card="exotic" data-item-id="${esc(itemId)}" data-exotic-block="${blockIds.has(itemId) ? "true" : "false"}" data-visual-source="${esc(visual.source)}" data-visual-kind="${esc(visual.shape)}">
          ${visualBadge(visual, item?.displayName ?? itemId)}
          <div>
            <h3>${esc(item?.displayName ?? displayLabel(itemId))}</h3>
            <p>${esc(item?.category ?? "exotic matter")} / ${esc(item?.objectMetadata?.physicalForm ?? "item")} / ${esc(itemId)}</p>
          </div>
        </article>
      `;
    })
    .join("");
}

function mapMarkerVisualCards() {
  return HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS
    .map((marker) => `
      <article class="compact-card" data-catalog-visual-card="map" data-marker-id="${esc(marker.markerId)}" data-visual-source="${esc(marker.primaryBikkieVisual?.source)}" data-visual-kind="${esc(marker.primaryBikkieVisual?.shape)}">
        ${visualBadge(marker.primaryBikkieVisual, marker.primaryBikkieGraphic?.label ?? marker.label)}
        <div>
          <h3>${esc(marker.label)}</h3>
          <p>${esc(marker.primaryBikkieGraphic?.label ?? "Bikkie marker")} / ${esc(displayLabel(marker.businessType))}</p>
        </div>
      </article>
    `)
    .join("");
}

function renderHtml() {
  const entries = Object.entries(HARTHMERE_BUSINESS_BIKKIE_GRAPHICS);
  const fixtureCount = entries.reduce((sum, [, graphics]) => sum + graphics.length, 0);
  const foodCatalogCount = Object.keys(HARTHMERE_BIKKIE_ITEM_METADATA_BY_ID).length;
  const exoticCount = Object.keys(HARTHMERE_EXOTIC_MATTER_ITEM_IDS).length;
  const mapMarkerCount = HARTHMERE_BUSINESS_OUTPOST_MAP_MARKERS.length;
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8"/>
  <meta name="viewport" content="width=device-width, initial-scale=1"/>
  <title>Harthmere Business Bikkie Graphics Visual Audit</title>
  <style>
    * { box-sizing: border-box; }
    body { margin: 0; background: #0e141c; color: #e8eef7; font-family: Inter, Arial, sans-serif; }
    main { width: min(1480px, 100%); margin: 0 auto; padding: 24px; display: grid; gap: 18px; }
    h1, h2, h3, p { margin: 0; }
    .hero { display: grid; gap: 8px; padding: 20px; background: #151f2b; border: 1px solid #31465e; border-radius: 8px; }
    .hero h1 { font-size: 28px; letter-spacing: 0; }
    .hero p, .business-header p, .fixture-meta, .fixture-detail, .prop-card p { color: #aeb9c7; font-size: 12px; line-height: 1.45; }
    .summary { display: flex; gap: 8px; flex-wrap: wrap; margin-top: 6px; }
    .summary span, .business-count { display: inline-flex; min-height: 24px; align-items: center; border: 1px solid #48627e; border-radius: 4px; padding: 4px 8px; color: #d8e9ff; background: #192638; font-size: 12px; }
    .business-section, .prop-section { padding: 14px; border: 1px solid #31465e; border-radius: 8px; background: #121b27; }
    .business-header { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 12px; align-items: start; margin-bottom: 12px; }
    .business-header h2 { font-size: 18px; letter-spacing: 0; }
    .fixture-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 10px; }
    .fixture-card { min-height: 156px; display: grid; grid-template-columns: 64px minmax(0, 1fr); gap: 10px; padding: 10px; border: 1px solid #3a526c; border-radius: 6px; background: #172334; overflow: visible; }
    .visual-badge { width: 52px; height: 52px; min-width: 52px; align-self: start; display: grid; place-items: center; border-radius: 6px; border: 2px solid rgba(255,255,255,.42); box-shadow: inset 0 -14px 0 rgba(0,0,0,.18), 0 10px 18px rgba(0,0,0,.22); color: #fff; overflow: hidden; }
    .visual-badge span { color: #fff; font-size: 12px; font-weight: 800; letter-spacing: 0; text-shadow: 0 1px 3px rgba(0,0,0,.48); }
    .fixture-icon { width: 52px; height: 52px; }
    .fixture-title { font-size: 14px; line-height: 1.25; letter-spacing: 0; }
    .fixture-use { color: #d7e2ef; font-size: 12px; line-height: 1.35; margin-top: 5px; }
    .fixture-detail { margin-top: 5px; overflow-wrap: anywhere; }
    .swatches { display: flex; gap: 4px; margin-top: 8px; flex-wrap: wrap; }
    .swatch { width: 16px; height: 16px; border-radius: 3px; border: 1px solid rgba(255,255,255,.58); }
    .prop-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 10px; margin-top: 12px; }
    .prop-card { border: 1px solid #3a526c; border-radius: 6px; background: #101826; overflow: hidden; }
    .prop-card svg { display: block; width: 100%; height: auto; background: #101722; }
    .prop-card h3 { font-size: 12px; line-height: 1.3; padding: 8px 10px 0; }
    .prop-card p { padding: 3px 10px 10px; }
    .compact-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 8px; margin-top: 12px; }
    .compact-card { min-height: 78px; display: grid; grid-template-columns: 52px minmax(0, 1fr); gap: 10px; align-items: center; padding: 10px; border: 1px solid #3a526c; border-radius: 6px; background: #172334; }
    .compact-card h3 { font-size: 13px; line-height: 1.2; }
    .compact-card p { margin-top: 4px; color: #aeb9c7; font-size: 11px; line-height: 1.35; overflow-wrap: anywhere; }
    @media (max-width: 560px) {
      main { padding: 12px; }
      .hero h1 { font-size: 22px; }
      .fixture-grid, .prop-grid, .compact-grid { grid-template-columns: 1fr; }
      .business-header { grid-template-columns: 1fr; }
      .fixture-card { grid-template-columns: 58px minmax(0, 1fr); }
    }
  </style>
</head>
<body data-business-count="${entries.length}" data-fixture-count="${fixtureCount}">
  <main>
    <section class="hero">
      <h1>Harthmere Business Bikkie Graphics Visual Audit</h1>
      <p>Every business fixture below is sourced from the shared Bikkie graphics metadata table and rendered with label, size, color, path, and business-use metadata.</p>
      <div class="summary">
        <span>${entries.length} business types</span>
        <span>${fixtureCount} business fixture assignments</span>
        <span>${Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS).flatMap((definition) => definition.offers).length} service prop frames</span>
        <span>${foodCatalogCount} food, seed, and recipe visuals</span>
        <span>${exoticCount} Exotic Matter visuals</span>
        <span>${mapMarkerCount} Bikkie map markers</span>
      </div>
    </section>
    ${entries.map(businessSection).join("")}
    <section class="prop-section" data-service-prop-audit="true">
      <header class="business-header">
        <div>
          <h2>Service Animation Props</h2>
          <p>Representative frame from every business service cue, including Bikkie prop metadata embedded in the SVG.</p>
        </div>
      </header>
      <div class="prop-grid">${servicePropCards()}</div>
    </section>
    <section class="prop-section" data-catalog-visual-section="food">
      <header class="business-header">
        <div>
          <h2>Food, Seeds, And Recipe Items</h2>
          <p>All Bikkie farming/food/cooking catalog rows have a visual contract, including Galois icons, drive assets, and procedural fallbacks.</p>
        </div>
        <span class="business-count">${foodCatalogCount} visuals</span>
      </header>
      <div class="compact-grid">${foodCatalogVisualCards()}</div>
    </section>
    <section class="prop-section" data-catalog-visual-section="exotic">
      <header class="business-header">
        <div>
          <h2>Exotic Matter Crafting Materials</h2>
          <p>Antimatter components, Exotic Matter blocks, fuel cells, and power cores render from item object metadata.</p>
        </div>
        <span class="business-count">${exoticCount} visuals</span>
      </header>
      <div class="compact-grid">${exoticMatterVisualCards()}</div>
    </section>
    <section class="prop-section" data-catalog-visual-section="map">
      <header class="business-header">
        <div>
          <h2>Business Map Marker Bikkie Identity</h2>
          <p>World and HUD map markers preserve each outpost's primary Bikkie graphic.</p>
        </div>
        <span class="business-count">${mapMarkerCount} markers</span>
      </header>
      <div class="compact-grid">${mapMarkerVisualCards()}</div>
    </section>
  </main>
</body>
</html>`;
}

async function auditViewport(page, name, viewport, screenshotPath, expectedFixtureCount, expectedBusinessCount, expectedPropCount) {
  await page.setViewportSize(viewport);
  await page.goto(`file://${htmlPath}`, { waitUntil: "domcontentloaded", timeout: timeoutMs });
  await page.waitForLoadState("load", { timeout: timeoutMs }).catch(() => null);
  await page.screenshot({ path: screenshotPath, fullPage: true });
  const report = await page.evaluate(() => {
    const rectOf = (element) => {
      const rect = element.getBoundingClientRect();
      return { x: rect.x, y: rect.y, width: rect.width, height: rect.height, right: rect.right, bottom: rect.bottom };
    };
    const intersects = (a, b) => {
      const x = Math.max(0, Math.min(a.right, b.right) - Math.max(a.x, b.x));
      const y = Math.max(0, Math.min(a.bottom, b.bottom) - Math.max(a.y, b.y));
      return x * y;
    };
    const sections = Array.from(document.querySelectorAll("[data-bikkie-business-fixtures]"));
    const cards = Array.from(document.querySelectorAll("[data-bikkie-graphic-id]"));
    const props = Array.from(document.querySelectorAll(".prop-card"));
    const visualBadges = Array.from(document.querySelectorAll("[data-bikkie-visual='true']"));
    const catalogCards = Array.from(document.querySelectorAll("[data-catalog-visual-card]"));
    const hiddenCards = [];
    const blankCards = [];
    const missingSwatches = [];
    const missingPrimary = [];
    const clippedText = [];
    const overlaps = [];
    const missingBikkieProps = [];
    const missingVisuals = [];
    const missingCatalogVisuals = [];
    const exoticBlockIssues = [];
    for (const section of sections) {
      if (!section.querySelector("[data-role='primary_station']")) missingPrimary.push(section.getAttribute("data-business-type"));
      const localCards = Array.from(section.querySelectorAll("[data-bikkie-graphic-id]")).map((element) => ({ element, rect: rectOf(element) }));
      for (let i = 0; i < localCards.length; i += 1) {
        for (let j = i + 1; j < localCards.length; j += 1) {
          if (intersects(localCards[i].rect, localCards[j].rect) > 1) {
            overlaps.push(`${localCards[i].element.getAttribute("data-bikkie-graphic-id")} overlaps ${localCards[j].element.getAttribute("data-bikkie-graphic-id")}`);
          }
        }
      }
    }
    for (const card of cards) {
      const rect = rectOf(card);
      const id = card.getAttribute("data-bikkie-graphic-id");
      const style = getComputedStyle(card);
      if (style.display === "none" || style.visibility === "hidden" || rect.width < 180 || rect.height < 80) hiddenCards.push(id);
      if (!card.textContent || card.textContent.trim().length < 30) blankCards.push(id);
      if (!card.querySelector(".swatch")) missingSwatches.push(id);
      for (const textElement of card.querySelectorAll(".fixture-title,.fixture-meta,.fixture-use,.fixture-detail")) {
        if (textElement.scrollWidth > textElement.clientWidth + 2 && getComputedStyle(textElement).whiteSpace === "nowrap") clippedText.push(`${id}:${textElement.className}`);
      }
    }
    for (const prop of props) {
      const source = prop.getAttribute("data-prop-source");
      const bikkieId = prop.getAttribute("data-bikkie-id");
      const visualSource = prop.getAttribute("data-visual-source");
      const svg = prop.querySelector("svg");
      const rect = svg ? rectOf(svg) : { width: 0, height: 0 };
      if (source !== "bikkie" || !bikkieId || !visualSource || rect.width < 120 || rect.height < 80) {
        missingBikkieProps.push(prop.getAttribute("data-service-cue"));
      }
    }
    for (const badge of visualBadges) {
      const rect = rectOf(badge);
      const source = badge.getAttribute("data-visual-source");
      const kind = badge.getAttribute("data-visual-kind");
      const text = badge.textContent?.trim() ?? "";
      if (!source || !kind || rect.width < 32 || rect.height < 32 || text.length < 1) {
        missingVisuals.push(badge.getAttribute("data-visual-id") || badge.closest("[data-item-id],[data-bikkie-graphic-id]")?.getAttribute("data-item-id") || "unknown");
      }
    }
    for (const card of catalogCards) {
      const source = card.getAttribute("data-visual-source");
      const kind = card.getAttribute("data-visual-kind");
      if (!source || !kind) missingCatalogVisuals.push(card.getAttribute("data-item-id") || card.getAttribute("data-marker-id"));
      if (card.getAttribute("data-exotic-block") === "true" && (kind !== "block" || source !== "procedural_voxel")) {
        exoticBlockIssues.push(`${card.getAttribute("data-item-id")}:${source}:${kind}`);
      }
    }
    return {
      businessCount: sections.length,
      fixtureCount: cards.length,
      propCount: props.length,
      visualBadgeCount: visualBadges.length,
      catalogCardCount: catalogCards.length,
      scrollWidth: document.documentElement.scrollWidth,
      viewportWidth: window.innerWidth,
      horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      hiddenCards,
      blankCards,
      missingSwatches,
      missingPrimary,
      clippedText,
      overlaps,
      missingBikkieProps,
      missingVisuals,
      missingCatalogVisuals,
      exoticBlockIssues,
    };
  });
  const failures = [];
  if (report.businessCount !== expectedBusinessCount) failures.push(`expected ${expectedBusinessCount} businesses, found ${report.businessCount}`);
  if (report.fixtureCount !== expectedFixtureCount) failures.push(`expected ${expectedFixtureCount} fixtures, found ${report.fixtureCount}`);
  if (report.propCount !== expectedPropCount) failures.push(`expected ${expectedPropCount} service props, found ${report.propCount}`);
  if (report.horizontalOverflow) failures.push(`${name} horizontal overflow ${report.scrollWidth}px > ${report.viewportWidth}px`);
  if (report.visualBadgeCount < expectedFixtureCount + expectedPropCount) failures.push(`expected rich visual badges, found ${report.visualBadgeCount}`);
  if (report.catalogCardCount < 100) failures.push(`expected broad catalog visual coverage, found ${report.catalogCardCount}`);
  for (const key of ["hiddenCards", "blankCards", "missingSwatches", "missingPrimary", "clippedText", "overlaps", "missingBikkieProps", "missingVisuals", "missingCatalogVisuals", "exoticBlockIssues"]) {
    if (report[key].length) failures.push(`${key}: ${report[key].slice(0, 12).join(", ")}`);
  }
  return { name, screenshotPath, report, failures };
}

(async () => {
  console.log("== Harthmere business Bikkie graphics Playwright visual audit current ==");
  console.log(`Root: ${root}`);
  console.log(`Output: ${outDir}`);
  fs.mkdirSync(outDir, { recursive: true });

  const metadataAudit = validateHarthmereBusinessBikkieGraphics();
  if (metadataAudit.ok) pass("Bikkie business graphics metadata validates");
  else fail("Bikkie business graphics metadata validates", JSON.stringify(metadataAudit, null, 2));

  const playwright = resolvePlaywright(root);
  if (!playwright) {
    fail("Playwright is installed", "Run: npm install --save-dev playwright --legacy-peer-deps");
    console.log("\nRESULT: FAIL");
    process.exit(1);
  }
  pass("Playwright is installed");

  const html = renderHtml();
  fs.writeFileSync(htmlPath, html, "utf8");
  pass("visual audit HTML was generated");

  const expectedBusinessCount = Object.keys(HARTHMERE_BUSINESS_BIKKIE_GRAPHICS).length;
  const expectedFixtureCount = Object.values(HARTHMERE_BUSINESS_BIKKIE_GRAPHICS).reduce((sum, graphics) => sum + graphics.length, 0);
  const expectedPropCount = Object.values(HARTHMERE_BUSINESS_MINIGAME_DEFINITIONS).flatMap((definition) => definition.offers).length;
  const browser = await playwright.chromium.launch({ headless: process.env.HARTHMERE_E2E_HEADLESS !== "0" });
  const page = await browser.newPage({ viewport: { width: 1600, height: 1200 } });
  page.setDefaultTimeout(timeoutMs);
  const browserErrors = [];
  page.on("pageerror", (error) => browserErrors.push(error.stack || error.message));
  page.on("console", (message) => {
    if (message.type() === "error") browserErrors.push(message.text());
  });

  const results = [];
  try {
    results.push(await auditViewport(page, "desktop", { width: 1600, height: 1200 }, desktopPng, expectedFixtureCount, expectedBusinessCount, expectedPropCount));
    results.push(await auditViewport(page, "mobile", { width: 390, height: 844 }, mobilePng, expectedFixtureCount, expectedBusinessCount, expectedPropCount));
  } catch (error) {
    fail("Playwright visual audit completed without unhandled exception", error.stack || String(error));
  } finally {
    await browser.close().catch(() => null);
  }

  if (browserErrors.length) fail("browser console has no runtime errors", browserErrors.slice(0, 10));
  else pass("browser console has no runtime errors");

  for (const result of results) {
    if (result.failures.length) fail(`${result.name} visual layout passes`, result.failures);
    else pass(`${result.name} visual layout passes`);
  }

  const summary = {
    ok,
    htmlPath,
    screenshots: { desktop: desktopPng, mobile: mobilePng },
    expectedBusinessCount,
    expectedFixtureCount,
    expectedPropCount,
    metadataAudit,
    results,
    browserErrors,
  };
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2), "utf8");
  pass("visual audit summary was written");

  console.log(ok ? "\nRESULT: PASS" : "\nRESULT: FAIL");
  process.exit(ok ? 0 : 1);
})();
