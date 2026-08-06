/// <reference types="mocha" />

import { HARTHMERE_CREATURE_STAGGER_RUNTIME_ASSET_URLS } from "@/shared/harthmere/muck_creature_assets";
import assert from "assert";
import fs from "fs";
import path from "path";

type AnimationDocument = {
  accessors: Array<{ max?: number[] }>;
  animations?: Array<{
    name?: string;
    channels: unknown[];
    samplers: Array<{ input: number }>;
    extras?: Record<string, unknown>;
  }>;
};

const SOURCE_FILES = [
  "mossy_mucker",
  "tree_mucker",
  "stone_mucker",
  "cobble_mucker",
  "big_mucker",
  "hexer",
  "cow",
  "sheep",
  "rabbit",
] as const;

const EXPECTED = [
  ["StaggerLight", "light", 10, 2],
  ["StaggerMedium", "medium", 23, 4],
  ["StaggerHeavy", "heavy", 52, 7],
] as const;

function duration(document: AnimationDocument, animationName: string) {
  const animation = document.animations?.find(
    ({ name }) => name === animationName
  );
  assert.ok(animation, `missing ${animationName}`);
  return {
    animation,
    seconds: Math.max(
      ...animation.samplers.map(
        ({ input }) => document.accessors[input]?.max?.[0] ?? 0
      )
    ),
  };
}

function parseGlb(filePath: string): AnimationDocument {
  const bytes = fs.readFileSync(filePath);
  assert.equal(bytes.toString("ascii", 0, 4), "glTF", `${filePath} magic`);
  const jsonLength = bytes.readUInt32LE(12);
  return JSON.parse(
    bytes.toString("utf8", 20, 20 + jsonLength).replace(/\0+$/g, "")
  ) as AnimationDocument;
}

describe("ordinary creature stagger animation polish", () => {
  it("authors light, medium, and heavy whole-body reactions on every source rig", () => {
    for (const file of SOURCE_FILES) {
      const document = JSON.parse(
        fs.readFileSync(
          path.join(
            process.cwd(),
            `src/galois/data/npcs/${file}_animations.gltf`
          ),
          "utf8"
        )
      ) as AnimationDocument;
      for (const [name, severity, frames, impactFrame] of EXPECTED) {
        const result = duration(document, name);
        assert.ok(result.animation.channels.length >= 12, `${file} ${name}`);
        assert.ok(
          Math.abs(result.seconds - frames / 24) < 0.002,
          `${file} ${name} duration`
        );
        assert.equal(
          result.animation.extras?.harthmereAnimationPolishVersion,
          "harthmere-creature-stagger-animation-polish-v1",
          `${file} ${name} version`
        );
        assert.equal(result.animation.extras?.harthmereSeverity, severity);
        assert.equal(
          result.animation.extras?.harthmereImpactFrame,
          impactFrame
        );
        assert.equal(
          result.animation.extras?.harthmereRuntimeExecutionEnabled,
          true
        );
      }
    }
  });

  it("packages all three reactions in every tracked Harthmere creature runtime asset", () => {
    for (const url of Object.values(
      HARTHMERE_CREATURE_STAGGER_RUNTIME_ASSET_URLS
    )) {
      const document = parseGlb(
        path.join(process.cwd(), "public", url.slice(1))
      );
      for (const [name, , frames] of EXPECTED) {
        const result = duration(document, name);
        assert.ok(
          Math.abs(result.seconds - frames / 24) < 0.002,
          `${url} ${name} duration`
        );
      }
    }
  });

  it("selects a severity-specific runtime state with HitReact fallback", () => {
    const runtime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    for (const [state, clip] of [
      ["creatureStaggerLight", "StaggerLight"],
      ["creatureStaggerMedium", "StaggerMedium"],
      ["creatureStaggerHeavy", "StaggerHeavy"],
    ]) {
      assert.match(
        runtime,
        new RegExp(
          `${state}:[\\s\\S]{0,160}fileAnimationName: "${clip}"[\\s\\S]{0,180}HitReact`
        )
      );
    }
    assert.match(
      runtime,
      /npcStaggerAnimationForKind\(stagger\.kind, isBoss\)/
    );
  });
});
