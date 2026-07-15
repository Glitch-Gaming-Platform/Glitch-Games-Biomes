#!/usr/bin/env node
// (dialogue fix D-2, 2026-07-14)
// Rewrites the dev/scaffolding "dialogue" that shipped on hostile-creature NPCs
// in npc_compendium.ts into in-world, creature-readable text. The old strings —
// "<Name> has hostile production barks: ...", "<Name> serves encounter
// readability: ...", etc. — are DESIGN NOTES, not dialogue, and rendered
// verbatim in the fallback path and fed the LLM prompt. Each dev template is an
// exact, name-substituted skeleton, so we match it precisely (name captured)
// and replace only that string value — no structural edits to the 992KB file.
//
// Idempotent: once rewritten, the dev templates are gone and nothing matches.
//
// Usage: node scripts/harthmere/fix-monster-dialogue-dev-language.cjs [--check]

const fs = require("fs");
const path = require("path");

const FILE = path.join(
  __dirname,
  "..",
  "..",
  "src",
  "shared",
  "harthmere",
  "npc_compendium.ts"
);

// Each entry: the exact dev template (with a %NAME% placeholder for the captured
// creature name) and the in-world replacement (also using %NAME%). Written so a
// combat creature "speaks" only in wordless, atmospheric tells — never an
// "I am ..." greeting and never dev jargon.
const REWRITES = [
  {
    field: "greeting",
    dev: "%NAME% has hostile production barks: silence, breath, scrape, or broken words tied to bells, graves, roots, and old violence.",
    live: "%NAME% offers no greeting — only breath, the scrape of movement, and the far echo of a bell under stone.",
  },
  {
    field: "service",
    dev: "%NAME% serves encounter readability: silhouette, threat type, spawn conditions, and loot/state reactions are explicit.",
    live: "Read %NAME% before it reads you: watch its silhouette, how it moves, and where it lingers — that is your only warning.",
  },
  {
    field: "rumor",
    dev: "Locals describe signs of %NAME% in rumors before the player meets it, so danger feels foreshadowed rather than random.",
    live: "Folk in Harthmere trade quiet warnings about %NAME% long before anyone sees it — cold air, wrong sounds, a bell that should be still.",
  },
  {
    field: "questOffer",
    dev: "%NAME% anchors a kill, cleanse, investigate, rescue, or public-event objective with a lore reason.",
    live: "%NAME% is the reason more than one Harthmere task ends in danger — something to put down, cleanse, or drive back.",
  },
  {
    field: "farewell",
    dev: "%NAME% resolves through death, dispersal, surrender-equivalent, or retreat depending on family rules.",
    live: "%NAME% will not be reasoned with. It ends when it is put down, scattered, or driven back into the dark.",
  },
];

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function main() {
  const checkOnly = process.argv.includes("--check");
  let text = fs.readFileSync(FILE, "utf8");
  let totalReplacements = 0;

  for (const rewrite of REWRITES) {
    // Build a regex that matches: "field": "<dev template with any name>"
    // capturing the creature name so it can be carried into the replacement.
    const parts = rewrite.dev.split("%NAME%");
    const pattern = new RegExp(
      `("${rewrite.field}":\\s*")` +
        parts.map(escapeRegExp).join("([^\"]+?)") +
        `(")`,
      "g"
    );
    text = text.replace(pattern, (match, open, name, close) => {
      totalReplacements += 1;
      const live = rewrite.live.replaceAll("%NAME%", name);
      return `${open}${live}${close}`;
    });
  }

  if (checkOnly) {
    console.log(
      `[check] ${totalReplacements} dev-language dialogue lines still present.`
    );
    process.exit(totalReplacements > 0 ? 1 : 0);
  }

  fs.writeFileSync(FILE, text, "utf8");
  console.log(
    `Rewrote ${totalReplacements} dev-language creature dialogue lines into in-world text.`
  );
}

main();
