#!/usr/bin/env node
process.env.TS_NODE_PROJECT = process.env.TS_NODE_PROJECT || "tsconfig.json";
process.env.TS_NODE_TRANSPILE_ONLY = process.env.TS_NODE_TRANSPILE_ONLY || "true";
process.env.TS_NODE_COMPILER_OPTIONS =
  process.env.TS_NODE_COMPILER_OPTIONS ||
  '{"module":"commonjs","moduleResolution":"node","jsx":"react"}';

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const fs = require("node:fs");
const path = require("node:path");
const React = require("react");
const { renderToStaticMarkup } = require("react-dom/server");
const {
  BIOMES_UI_THEME_CSS,
} = require("../../src/client/components/biomes_ui/theme/biomesUITheme");
const {
  HarthmereInterfaceAccessPoint,
} = require("../../src/client/components/harthmere_access/HarthmereInterfaceAccessPoint");

const root = process.argv[2] || process.cwd();
const outDir = path.join(root, "artifacts", "harthmere-interface-access");
fs.mkdirSync(outDir, { recursive: true });

const scenes = [
  {
    file: "business-owner-access-point.html",
    title: "Business Owner Access Point",
    props: {
      kind: "business_owner",
      title: "Press E to manage Redpot Kitchen",
      helper: "Clients, orders, money, staff, licenses, and todos",
      keyLabel: "E",
      eyebrow: "Business owner access",
      ariaLabel: "Press E to manage Redpot Kitchen",
      dataAttributes: {
        "data-harthmere-business-prompt": "true",
        "data-business-id": "business_redpot_kitchen",
        "data-business-mode": "owner",
      },
    },
  },
  {
    file: "business-customer-access-point.html",
    title: "Business Customer Access Point",
    props: {
      kind: "business_customer",
      title: "Press F to use Grove Clinic",
      helper: "Order services, check status, and browse inventory",
      keyLabel: "F",
      eyebrow: "Customer service access",
      ariaLabel: "Press F to use Grove Clinic",
      dataAttributes: {
        "data-harthmere-business-prompt": "true",
        "data-business-id": "business_grove_clinic",
        "data-business-mode": "customer",
      },
    },
  },
  {
    file: "home-owner-access-point.html",
    title: "Home Owner Access Point",
    props: {
      kind: "home_owner",
      title: "Home Console",
      helper: "Press F to manage furniture, decorating, storage, gardens, and utilities.",
      keyLabel: "F",
      eyebrow: "Home owner access",
      ariaLabel: "Open home console",
      dataAttributes: {
        "data-harthmere-home-console-prompt": "true",
        "data-home-console-access": "owner-only",
        "data-home-console-marker-kind": "home_console",
        "data-home-console-property-id": "property_grove_muckstead_cottage_lot",
      },
    },
  },
];

function page(scene) {
  const prompt = renderToStaticMarkup(
    React.createElement(HarthmereInterfaceAccessPoint, scene.props)
  );
  return `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${scene.title}</title>
    <style>
      ${BIOMES_UI_THEME_CSS}
      html, body { margin: 0; min-height: 100%; background: #0b111d; }
      body {
        min-height: 100vh;
        color: var(--biomes-fg);
        font-family: Inter, Arial, sans-serif;
        overflow: hidden;
        background:
          linear-gradient(180deg, rgba(8, 14, 25, 0.12), rgba(8, 14, 25, 0.72)),
          repeating-linear-gradient(90deg, rgba(255,255,255,0.035) 0 1px, transparent 1px 64px),
          repeating-linear-gradient(0deg, rgba(255,255,255,0.028) 0 1px, transparent 1px 64px),
          radial-gradient(circle at 50% 42%, rgba(70, 222, 255, 0.16), transparent 36%),
          #0b111d;
      }
      .world {
        position: fixed;
        inset: 0;
        display: grid;
        place-items: center;
      }
      .doorway {
        width: min(72vw, 760px);
        height: 58vh;
        border: 1px solid rgba(166, 209, 225, 0.2);
        border-radius: 8px;
        background:
          linear-gradient(90deg, rgba(255,255,255,0.04), transparent 16%, transparent 84%, rgba(255,255,255,0.04)),
          linear-gradient(180deg, rgba(27, 39, 58, 0.92), rgba(13, 20, 34, 0.94));
        box-shadow: inset 0 -32px 64px rgba(0, 0, 0, 0.36), 0 24px 70px rgba(0, 0, 0, 0.38);
      }
      .floor {
        position: fixed;
        left: 0;
        right: 0;
        bottom: 0;
        height: 30vh;
        background: linear-gradient(180deg, rgba(54, 69, 89, 0.34), rgba(13, 17, 27, 0.9));
      }
    </style>
  </head>
  <body data-harthmere-access-visual-audit="v1" data-scene="${scene.file.replace(/\\.html$/, "")}">
    <div class="world" aria-hidden="true"><div class="doorway"></div></div>
    <div class="floor" aria-hidden="true"></div>
    ${prompt}
  </body>
</html>`;
}

for (const scene of scenes) {
  fs.writeFileSync(path.join(outDir, scene.file), page(scene));
}

fs.writeFileSync(
  path.join(outDir, "summary.json"),
  JSON.stringify(
    {
      version: "harthmere-interface-access-point-audit-v1",
      sceneCount: scenes.length,
      files: scenes.map((scene) => scene.file),
      generatedAt: new Date().toISOString(),
    },
    null,
    2
  )
);

console.log(`Wrote ${scenes.length} access-point audit pages to ${outDir}`);
