/// <reference types="mocha" />

import {
  HARTHMERE_FUTURE_BOSS_STAGGER_CLIPS,
  HARTHMERE_FUTURE_NPC_STAGGER_CLIPS,
  HARTHMERE_FUTURE_STAGGER_RUNTIME_EXECUTION,
} from "@/shared/harthmere/future_stagger_animation_assets";
import assert from "assert";
import fs from "fs";
import path from "path";

interface GltfAccessor {
  max?: number[];
}

interface GltfAnimation {
  name?: string;
  channels: unknown[];
  samplers: Array<{ input: number }>;
  extras?: Record<string, unknown>;
}

interface GltfDocument {
  accessors: GltfAccessor[];
  animations?: GltfAnimation[];
}

function parseGlb(filePath: string): GltfDocument {
  const data = fs.readFileSync(filePath);
  assert.equal(data.toString("ascii", 0, 4), "glTF", `${filePath} magic`);
  let offset = 12;
  while (offset + 8 <= data.length) {
    const length = data.readUInt32LE(offset);
    const type = data.readUInt32LE(offset + 4);
    offset += 8;
    if (type === 0x4e4f534a) {
      return JSON.parse(
        data
          .subarray(offset, offset + length)
          .toString("utf8")
          .replace(/\0+$/g, "")
      ) as GltfDocument;
    }
    offset += length;
  }
  throw new Error(`${filePath} has no JSON chunk`);
}

function animationDuration(document: GltfDocument, animation: GltfAnimation) {
  return Math.max(
    ...animation.samplers.map(
      ({ input }) => document.accessors[input]?.max?.[0] ?? 0
    )
  );
}

function requireAnimation(document: GltfDocument, name: string) {
  const animation = document.animations?.find(
    (candidate) => candidate.name === name
  );
  assert.ok(animation, `missing animation ${name}`);
  return animation;
}

function assertFutureAnimationMetadata(
  animation: GltfAnimation,
  family: "npc" | "boss",
  severity: "light" | "medium" | "heavy"
) {
  assert.equal(animation.extras?.harthmereFamily, family);
  assert.equal(animation.extras?.harthmereSeverity, severity);
  assert.equal(animation.extras?.harthmereAuthoredFps, 24);
  assert.equal(animation.extras?.harthmereRuntimeExecutionEnabled, false);
}

describe("future NPC and boss stagger animation assets", () => {
  it("packages three distinct full-body humanoid NPC reactions", () => {
    const document = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "src/galois/data/animations/character-animations.gltf"
        ),
        "utf8"
      )
    ) as GltfDocument;
    const expectedDurations = [0.5, 28 / 24, 54 / 24];

    HARTHMERE_FUTURE_NPC_STAGGER_CLIPS.forEach((name, index) => {
      const animation = requireAnimation(document, name);
      assert.ok(
        animation.channels.length >= 48,
        `${name} must animate the complete 16-bone body/tool rig`
      );
      assert.ok(
        Math.abs(
          animationDuration(document, animation) - expectedDurations[index]
        ) < 0.002,
        `${name} duration`
      );
      assertFutureAnimationMetadata(
        animation,
        "npc",
        ["light", "medium", "heavy"][index] as "light" | "medium" | "heavy"
      );
      assert.equal(typeof animation.extras?.harthmereImpactFrame, "number");
    });
  });

  it("packages three rig-aware reactions on every live boss GLB", () => {
    const bossRoot = path.join(
      process.cwd(),
      "public/assets/harthmere/glb/bosses"
    );
    const manifest = JSON.parse(
      fs.readFileSync(path.join(bossRoot, "manifest.json"), "utf8")
    ) as { bosses: Array<{ id: string; clips: string[] }> };
    assert.equal(manifest.bosses.length, 11);
    const expectedDurations = [14 / 24, 30 / 24, 58 / 24];

    for (const boss of manifest.bosses) {
      for (const suffix of [".glb", "_world.glb"]) {
        const document = parseGlb(path.join(bossRoot, `${boss.id}${suffix}`));
        HARTHMERE_FUTURE_BOSS_STAGGER_CLIPS.forEach((name, index) => {
          assert.ok(
            boss.clips.includes(name),
            `${boss.id} manifest lacks ${name}`
          );
          const animation = requireAnimation(document, name);
          assert.ok(
            animation.channels.length >= 27,
            `${boss.id} ${name} must animate multiple whole-body rig parts`
          );
          assert.ok(
            Math.abs(
              animationDuration(document, animation) - expectedDurations[index]
            ) < 0.002,
            `${boss.id} ${name} duration`
          );
          assertFutureAnimationMetadata(
            animation,
            "boss",
            ["light", "medium", "heavy"][index] as "light" | "medium" | "heavy"
          );
        });
      }
    }
  });

  it("enables boss execution while keeping humanoid NPC clips reserved", () => {
    assert.deepEqual(HARTHMERE_FUTURE_STAGGER_RUNTIME_EXECUTION, {
      npc: false,
      boss: true,
    });
    const runtimeSources = [
      "src/client/game/resources/npcs.ts",
      "src/client/game/renderers/local_dev/harthmere_assets.ts",
    ].map((relativePath) =>
      fs.readFileSync(path.join(process.cwd(), relativePath), "utf8")
    );
    for (const clip of HARTHMERE_FUTURE_NPC_STAGGER_CLIPS) {
      assert.ok(
        runtimeSources.every((source) => !source.includes(`"${clip}"`)),
        `${clip} must remain an asset-only future humanoid clip`
      );
    }
    for (const clip of HARTHMERE_FUTURE_BOSS_STAGGER_CLIPS) {
      assert.ok(
        runtimeSources.some((source) => source.includes(`"${clip}"`)),
        `${clip} must be selected by the boss runtime`
      );
    }
  });
});
