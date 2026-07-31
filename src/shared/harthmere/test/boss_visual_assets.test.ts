/// <reference types="mocha" />

import {
  HARTHMERE_BOSS_REQUIRED_ANIMATION_CLIPS,
  HARTHMERE_BOSS_VISUAL_ASSETS,
  harthmereBossAttackClipForEvent,
  harthmereBossStaticAssetKeyForLabel,
  harthmereBossVisualForEntity,
  harthmereBossVisualForLabel,
} from "@/shared/harthmere/boss_visual_assets";
import assert from "assert";
import fs from "fs";
import path from "path";

const EXPECTED_BOSSES = [
  "Muck-Scarred Helix",
  "The Gilded Bull",
  "The Ninth Winter",
  "The Failed Apprentice",
  "The First Choir",
  "The Echo-Singer",
  "Vyrahel, the Vein-Keeper",
  "Thaedryn the Bellbound",
  "Hex Wraith",
  "Alpha Mucker",
  "The Root-Crowned Dead",
] as const;

describe("Harthmere boss visual assets", () => {
  it("defines one unique live asset for every requested boss", () => {
    assert.equal(HARTHMERE_BOSS_VISUAL_ASSETS.length, EXPECTED_BOSSES.length);
    assert.deepEqual(
      HARTHMERE_BOSS_VISUAL_ASSETS.map((visual) => visual.displayName),
      EXPECTED_BOSSES
    );
    assert.equal(
      new Set(HARTHMERE_BOSS_VISUAL_ASSETS.map((visual) => visual.assetUrl))
        .size,
      EXPECTED_BOSSES.length
    );
    assert.equal(
      new Set(HARTHMERE_BOSS_VISUAL_ASSETS.map((visual) => visual.voxSource))
        .size,
      EXPECTED_BOSSES.length
    );
  });

  it("uses only the rebuilt Sun Court guardian for the Gilded Bull", () => {
    const bull = HARTHMERE_BOSS_VISUAL_ASSETS.find(
      (visual) => visual.id === "gilded_bull"
    );
    assert.ok(bull);
    assert.deepEqual(bull.worldSize, [3.9, 2.7, 5.6]);
    assert.deepEqual(bull.attackClips, [
      "HeavyAttack",
      "RangedAttack",
      "AreaAttack",
    ]);
    assert.deepEqual(bull.specialClips, [
      "PatrolScan",
      "Charge",
      "PillarCrash",
      "HornBreak",
      "SunCoreBeam",
      "HoofQuake",
      "Unbalanced",
      "CoreRupture",
    ]);
    const generator = fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/harthmere/generate_boss_voxel_assets.py"
      ),
      "utf8"
    );
    assert.ok(generator.includes("build_sun_court_guardian"));
    const generated = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "public/assets/harthmere/glb/bosses/manifest.json"
        ),
        "utf8"
      )
    ) as {
      bosses: Array<{
        id: string;
        voxelCount: number;
        surfaceTriangleCount: number;
      }>;
    };
    const generatedBull = generated.bosses.find(
      (entry) => entry.id === "gilded_bull"
    );
    assert.ok(generatedBull);
    assert.ok(generatedBull.voxelCount >= 10_000);
    assert.ok(generatedBull.surfaceTriangleCount >= 30_000);
  });

  it("uses scratch-built bodies and lore-scale contracts for Helix, Winter, and Thaedryn", () => {
    const generator = fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/harthmere/generate_boss_voxel_assets.py"
      ),
      "utf8"
    );
    const generated = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "public/assets/harthmere/glb/bosses/manifest.json"
        ),
        "utf8"
      )
    ) as {
      bosses: Array<{
        id: string;
        voxelCount: number;
        surfaceTriangleCount: number;
      }>;
    };
    const rebuilt = [
      {
        id: "muck_scarred_helix",
        builder: "build_breach_helix_aberration",
        worldSize: [6.8, 4.8, 8.4],
        specialClips: [
          "BreachStalk",
          "MaulCrush",
          "SiphonVolley",
          "HelixPulse",
          "SporeCast",
          "Burrow",
          "Rupture",
          "BreachCollapse",
        ],
        minVoxels: 18_000,
        minTriangles: 35_000,
      },
      {
        id: "ninth_winter",
        builder: "build_failed_year_colossus",
        worldSize: [14, 13, 8],
        specialClips: [
          "HearthFails",
          "Blizzard",
          "TimeLoop",
          "RoofbeamSweep",
          "YearBreaks",
          "Shatter",
          "Rainfall",
          "MeltDeath",
        ],
        minVoxels: 30_000,
        minTriangles: 50_000,
      },
      {
        id: "thaedryn_bellbound",
        builder: "build_bellbound_river_dragon",
        worldSize: [20, 14, 58],
        specialClips: [
          "SleeperSweep",
          "SoundCloud",
          "RiverBreath",
          "ChainBreak",
          "HalfWake",
          "WingGust",
          "VeinSummon",
          "BellboundRise",
          "Greeting",
          "Rebind",
          "Slay",
          "Wake",
        ],
        minVoxels: 65_000,
        minTriangles: 100_000,
      },
    ] as const;

    for (const expected of rebuilt) {
      const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
        (candidate) => candidate.id === expected.id
      );
      assert.ok(visual);
      assert.deepEqual(visual.worldSize, expected.worldSize);
      assert.deepEqual(visual.specialClips, expected.specialClips);
      assert.ok(generator.includes(expected.builder));

      const output = generated.bosses.find(
        (candidate) => candidate.id === expected.id
      );
      assert.ok(output);
      assert.ok(output.voxelCount >= expected.minVoxels);
      assert.ok(output.surfaceTriangleCount >= expected.minTriangles);
    }

    const nativeSeedSource = fs.readFileSync(
      path.join(process.cwd(), "src/server/harthmere/live_entity_ecs_seed.ts"),
      "utf8"
    );
    assert.ok(
      (nativeSeedSource.match(
        /size: Size\.create\(\{ v: harthmereLiveEntitySizeForSeed\(seed\) \}\)/g
      )?.length ?? 0) >= 2,
      "Helix and Thaedryn must use the lore-sized boss visual contract"
    );
  });

  it("uses only the clean-room Vyrahel, Alpha, Echo-Singer, and Apprentice rebuilds", () => {
    const generator = fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/harthmere/generate_boss_voxel_assets.py"
      ),
      "utf8"
    );
    const scratchRebuilds = fs.readFileSync(
      path.join(process.cwd(), "scripts/harthmere/four_boss_rebuilds.py"),
      "utf8"
    );
    const generated = JSON.parse(
      fs.readFileSync(
        path.join(
          process.cwd(),
          "public/assets/harthmere/glb/bosses/manifest.json"
        ),
        "utf8"
      )
    ) as {
      bosses: Array<{
        id: string;
        voxelCount: number;
        surfaceTriangleCount: number;
      }>;
    };
    const rebuilt = [
      {
        id: "vyrahel_vein_keeper",
        builder: "build_amber_vein_wyrmling",
        worldSize: [3.8, 2.6, 6.4],
        combatSpecialClips: [
          "TailFeint",
          "VeinBreath",
          "WingBurst",
          "BurrowRush",
          "CrystalGuard",
        ],
        specialClips: [
          "VeinProwl",
          "CrystalGuard",
          "VeinBreath",
          "BurrowRush",
          "TailFeint",
          "WingBurst",
          "MercyWindow",
          "Yield",
          "VeinFade",
        ],
        minVoxels: 22_000,
        minTriangles: 40_000,
      },
      {
        id: "alpha_mucker",
        builder: "build_muckheart_walking_tree",
        worldSize: [12, 14, 11],
        combatSpecialClips: [
          "BranchSlam",
          "SeedBarrage",
          "RoadUproot",
          "RootCage",
          "MuckheartPulse",
          "CanopyRage",
        ],
        specialClips: [
          "RootMarch",
          "BranchSlam",
          "RoadUproot",
          "SeedBarrage",
          "RootCage",
          "MuckheartPulse",
          "CanopyRage",
          "HeartExposed",
          "Timberfall",
        ],
        minVoxels: 100_000,
        minTriangles: 90_000,
      },
      {
        id: "echo_singer",
        builder: "build_reflection_predator",
        worldSize: [6.2, 5.6, 5.8],
        combatSpecialClips: [
          "CopyMelee",
          "CopyRanged",
          "CopyGuard",
          "EchoDelay",
          "MirrorStep",
          "ResonanceOverload",
        ],
        specialClips: [
          "Listen",
          "CopyMelee",
          "CopyRanged",
          "CopyGuard",
          "EchoDelay",
          "EssenceDive",
          "MirrorStep",
          "ResonanceOverload",
          "Silence",
        ],
        minVoxels: 12_000,
        minTriangles: 25_000,
      },
      {
        id: "failed_apprentice",
        builder: "build_broken_bell_apprentice",
        worldSize: [4.8, 5.6, 3.8],
        combatSpecialClips: [
          "BellFist",
          "ShardCast",
          "FailedWard",
          "WrongNote",
          "LastLesson",
        ],
        specialClips: [
          "ChainLurch",
          "BellFist",
          "ShardCast",
          "FailedWard",
          "WrongNote",
          "BellCrack",
          "BindingTear",
          "LastLesson",
          "BellCollapse",
        ],
        minVoxels: 10_000,
        minTriangles: 22_000,
      },
    ] as const;

    assert.ok(generator.includes("from four_boss_rebuilds import DEFINITIONS"));
    for (const expected of rebuilt) {
      const visual = HARTHMERE_BOSS_VISUAL_ASSETS.find(
        (candidate) => candidate.id === expected.id
      );
      assert.ok(visual);
      assert.deepEqual(visual.worldSize, expected.worldSize);
      assert.deepEqual(visual.combatSpecialClips, expected.combatSpecialClips);
      assert.deepEqual(visual.specialClips, expected.specialClips);
      assert.ok(scratchRebuilds.includes(expected.builder));

      const output = generated.bosses.find(
        (candidate) => candidate.id === expected.id
      );
      assert.ok(output);
      assert.ok(output.voxelCount >= expected.minVoxels);
      assert.ok(output.surfaceTriangleCount >= expected.minTriangles);
    }

    const removedBuilderNames = [
      ["build", "vyrahel"],
      ["build", "alpha", "mucker"],
      ["build", "echo", "singer"],
      ["build", "failed", "apprentice"],
    ].map((parts) => parts.join("_"));
    for (const removedBuilderName of removedBuilderNames) {
      assert.ok(!generator.includes(removedBuilderName));
      assert.ok(!scratchRebuilds.includes(removedBuilderName));
    }

    const alpha = HARTHMERE_BOSS_VISUAL_ASSETS.find(
      (visual) => visual.id === "alpha_mucker"
    );
    assert.ok(alpha?.silhouette.includes("evil walking tree"));
    assert.deepEqual(alpha?.entityIds, [8_810_000_000_019_509]);
  });

  it("routes canonical encounter, jobs-board, and quest labels", () => {
    for (const label of EXPECTED_BOSSES) {
      const visual = harthmereBossVisualForLabel(label);
      assert.ok(visual, `${label} should route to a custom boss visual`);
      assert.equal(
        harthmereBossStaticAssetKeyForLabel(label),
        `boss_${visual.id}`
      );
    }
    assert.equal(
      harthmereBossVisualForLabel("Hex Wraith Bounty")?.id,
      "hex_wraith"
    );
    assert.equal(
      harthmereBossVisualForLabel("Alpha Mucker Bounty")?.id,
      "alpha_mucker"
    );
    assert.equal(
      harthmereBossVisualForLabel("First Choir Crone")?.id,
      "first_choir"
    );
    assert.equal(
      harthmereBossVisualForEntity(
        "Gravewood Pale Hexer 7",
        8_810_000_000_019_543
      )?.id,
      "hex_wraith"
    );
    assert.equal(
      harthmereBossVisualForEntity("Old Wood Mucker 1", 8_810_000_000_019_509)
        ?.id,
      "alpha_mucker"
    );
  });

  it("has lore-sized bodies, varied attacks, and generated runtime/source files", () => {
    const manifestPath = path.join(
      process.cwd(),
      "public/assets/harthmere/glb/bosses/manifest.json"
    );
    const generated = JSON.parse(fs.readFileSync(manifestPath, "utf8")) as {
      bosses: Array<{
        id: string;
        clips: string[];
        voxelCount: number;
        surfaceTriangleCount: number;
      }>;
    };
    assert.equal(generated.bosses.length, EXPECTED_BOSSES.length);
    for (const visual of HARTHMERE_BOSS_VISUAL_ASSETS) {
      assert.ok(visual.worldSize.every((dimension) => dimension > 0));
      assert.ok(visual.attackClips.length >= 3);
      assert.ok(visual.specialClips.length >= 2);
      assert.ok(
        fs.existsSync(
          path.join(process.cwd(), "public", visual.assetUrl.slice(1))
        ),
        `${visual.displayName} is missing ${visual.assetUrl}`
      );
      assert.ok(
        fs.existsSync(
          path.join(
            process.cwd(),
            "public/assets/harthmere/glb/bosses",
            `${visual.id}_world.glb`
          )
        ),
        `${visual.displayName} is missing its static world-scale GLB`
      );
      assert.ok(
        fs.existsSync(path.join(process.cwd(), visual.voxSource)),
        `${visual.displayName} is missing ${visual.voxSource}`
      );
      const entry = generated.bosses.find((boss) => boss.id === visual.id);
      assert.ok(
        entry,
        `${visual.displayName} is missing from generated manifest`
      );
      assert.ok(entry.voxelCount >= 300, `${visual.displayName} is too sparse`);
      assert.ok(
        entry.surfaceTriangleCount >= 500,
        `${visual.displayName} surface is too simple`
      );
      for (const clip of HARTHMERE_BOSS_REQUIRED_ANIMATION_CLIPS) {
        assert.ok(
          entry.clips.includes(clip),
          `${visual.displayName} lacks ${clip}`
        );
      }
      for (const clip of visual.specialClips) {
        assert.ok(
          entry.clips.includes(clip),
          `${visual.displayName} lacks ${clip}`
        );
      }
    }
  });

  it("cycles each boss's authored attack vocabulary deterministically", () => {
    const label = "The Ninth Winter";
    assert.equal(harthmereBossAttackClipForEvent(label, 0), "RangedAttack");
    assert.equal(harthmereBossAttackClipForEvent(label, 1), "AreaAttack");
    assert.equal(harthmereBossAttackClipForEvent(label, 2), "Summon");
    assert.equal(harthmereBossAttackClipForEvent(label, 3), "RangedAttack");
  });

  it("is connected to both native ECS rendering and the missing static encounter anchors", () => {
    const npcResource = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    assert.ok(npcResource.includes("makeHarthmereBossNpcAssetMesh"));
    assert.ok(npcResource.includes("harthmereBossVisualForEntity"));

    const localRenderer = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/renderers/local_dev/harthmere_assets.ts"
      ),
      "utf8"
    );
    assert.ok(localRenderer.includes("combatSpecialClips"));
    assert.ok(localRenderer.includes("harthmereBossSpecialAttackIndex"));
    assert.ok(localRenderer.includes("harthmereBossObservedMaxHp"));
    for (const bossId of [
      "failed_apprentice",
      "first_choir",
      "echo_singer",
      "vyrahel_vein_keeper",
      "thaedryn_bellbound",
      "root_crowned_dead",
    ]) {
      assert.ok(
        localRenderer.includes(`"boss_${bossId}"`),
        `${bossId} is missing its physical encounter placement`
      );
    }

    const damagePoseSource = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/renderers/harthmere_boss_damage_pose.ts"
      ),
      "utf8"
    );
    for (const bossId of [
      "failed_apprentice",
      "echo_singer",
      "vyrahel_vein_keeper",
      "alpha_mucker",
    ]) {
      assert.ok(
        damagePoseSource.includes(`bossId === "${bossId}"`),
        `${bossId} is missing its live damage-phase body presentation`
      );
      assert.ok(
        npcResource.includes(`visual.id === "${bossId}"`),
        `${bossId} is missing uniform lore-scale rendering`
      );
    }
  });
});
