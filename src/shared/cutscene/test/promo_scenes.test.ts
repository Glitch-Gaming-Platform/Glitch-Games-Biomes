/// <reference types="mocha" />
/// <reference types="node" />
//
// Promo stills are the one cutscene class whose output can only be judged in a
// browser with a GPU. That makes everything ELSE about them worth checking
// here, so a broken still fails in 1 second instead of after a stack boot.

import assert from "assert";
import fs from "fs";
import path from "path";
import {
  CH1_DUNGEON_SECTOR_PROOFS,
  PROMO_SCENES,
  promoBatchCaptureAuthUrl,
  promoCaptureAt,
  promoCaptureAuthUrl,
  promoCaptureUrl,
  promoSceneById,
  promoScenesInGroup,
  validatePromoScenes,
} from "../promo_scenes";
import { validateCutsceneDef } from "../schema";

const REPO_ROOT = path.resolve(__dirname, "../../../..");

describe("promo scenes - registry", () => {
  it("passes structural validation", async () => {
    assert.deepEqual(await validatePromoScenes(), []);
  });

  it("registers the dungeon portal still", () => {
    const scene = promoSceneById("dungeon-portal");
    assert.ok(scene, "the dungeon portal promo still is not registered");
    assert.equal(scene!.brand.title, "Biomes");
    assert.equal(scene!.brand.headline, "Biomes");
    assert.equal(scene!.filename, "biomes-gate-traversal.png");
  });

  it("builds a valid cutscene for every registered still", async () => {
    for (const scene of PROMO_SCENES) {
      const def = await scene.build();
      const result = validateCutsceneDef(def);
      assert.ok(
        result.ok,
        `${scene.id}: ${
          result.ok
            ? ""
            : result.issues.map((i) => `${i.path}: ${i.message}`).join("; ")
        }`
      );
      for (const member of def.cast) {
        assert.notEqual(
          member.binding.kind,
          "ghost",
          `${scene.id}: present-day marketing must render the real player/ECS cast`
        );
      }
    }
  });

  it("registers one warm-batch proof for every authored Chapter 1 sector", () => {
    assert.equal(CH1_DUNGEON_SECTOR_PROOFS.length, 14);
    assert.equal(promoScenesInGroup("chapter1-sectors").length, 14);
    assert.equal(promoScenesInGroup("chapter1-marketing").length, 3);
    assert.equal(promoScenesInGroup("chapter1-finish").length, 16);
    assert.equal(promoScenesInGroup("chapter1-all").length, 17);
    assert.equal(promoScenesInGroup("chapter1-visual-repair").length, 15);
    assert.equal(promoScenesInGroup("chapter1-winter-final-resume").length, 3);
    assert.ok(
      !promoScenesInGroup("chapter1-visual-repair").some(
        (scene) =>
          scene.id === "dungeon-portal" || scene.id === "sector-d1-dune-threshold"
      ),
      "repair batches must not re-test the already-passed gate or dune proof"
    );
    assert.deepEqual(
      promoScenesInGroup("chapter1-winter-final-resume").map(
        (scene) => scene.id
      ),
      [
        "sector-d2-sorrels-camp",
        "sector-d2-ash-hall",
        "sector-d2-breaking-year",
      ],
      "the final resume batch must contain only the three unfinished shots"
    );
  });

  it("returns undefined for an unknown id rather than throwing", () => {
    assert.equal(promoSceneById("nope"), undefined);
  });

  it("moves the live streaming observer before each warm-page capture", () => {
    const captureSource = fs.readFileSync(
      path.join(REPO_ROOT, "src/client/game/cutscene/promo_capture.ts"),
      "utf8"
    );
    const ioSource = fs.readFileSync(
      path.join(
        REPO_ROOT,
        "src/client/game/context_managers/client_io.ts"
      ),
      "utf8"
    );
    const playerSource = fs.readFileSync(
      path.join(REPO_ROOT, "src/client/game/scripts/player.ts"),
      "utf8"
    );
    assert.match(captureSource, /stagePromoStreamingObserver/);
    assert.match(
      captureSource,
      /await stagePromoStreamingObserver\(scene\.observer\.position\)/,
      "a cinematic camera alone does not move the terrain/ECS interest set"
    );
    assert.match(
      captureSource,
      /restorePromoStreamingObserver\(initialStreamingObserver\)/,
      "capture must restore the route's starting streaming position"
    );
    assert.match(captureSource, /promoObserverStreamingDebug/);
    assert.match(captureSource, /waitForPromoStreamingHook/);
    assert.doesNotMatch(
      captureSource,
      /performance\.now\(\) \+ 30_000/,
      "streaming readiness must not be inferred from a fixed timeout"
    );
    assert.match(ioSource, /__biomesObserverStreamingDebug/);
    assert.match(
      ioSource,
      /await this\.swapSyncTarget\(target\)/,
      "authenticated /at pages are observers and must move their sync target"
    );
    assert.match(ioSource, /biomes:promo-streaming-ready/);
    assert.match(playerSource, /biomes:promo-streaming-ready/);
  });
});

describe("promo scenes - captureAt bracketing", () => {
  const scene = promoSceneById("dungeon-portal")!;

  it("uses the authored default when no override is given", () => {
    assert.equal(promoCaptureAt(scene, null), scene.captureAt);
    assert.equal(promoCaptureAt(scene, ""), scene.captureAt);
    assert.equal(promoCaptureAt(scene, "   "), scene.captureAt);
  });

  it("honours an explicit zero — art direction may want frame one", () => {
    // Number(null) is 0, which is why the blank/omitted case must be checked
    // BEFORE parsing. A regression here silently ignores captureAt=0.
    assert.equal(promoCaptureAt(scene, "0"), 0);
  });

  it("clamps to the scene's own window, not a global constant", () => {
    assert.equal(promoCaptureAt(scene, "999"), scene.captureAtMax);
    assert.equal(promoCaptureAt(scene, "-5"), 0);
  });

  it("falls back to the default for garbage input", () => {
    assert.equal(promoCaptureAt(scene, "abc"), scene.captureAt);
  });
});

describe("promo scenes - capture URL", () => {
  const scene = promoSceneById("dungeon-portal")!;

  it("emits an observer deep link that selects this still", () => {
    const url = promoCaptureUrl(scene);
    assert.ok(url.includes("/at/"), "must use the observer route");
    assert.ok(url.includes("cutscenePromo=dungeon-portal"));
    assert.ok(url.includes("hideChrome=1"));
    assert.ok(
      url.includes("allowSoftwareWebGL=1"),
      "software WebGL is required on headless capture hosts"
    );
    assert.ok(url.includes("captureRun=1"));
  });

  it("supports bracketing without editing code", () => {
    const url = promoCaptureUrl(scene, "http://localhost:3000", {
      captureAt: "3.8",
      captureRun: "2",
    });
    assert.ok(url.includes("captureAt=3.8"));
    assert.ok(url.includes("captureRun=2"));
  });

  it("does not double a trailing slash on the origin", () => {
    assert.ok(
      promoCaptureUrl(scene, "http://localhost:3000/").includes("3000/at/")
    );
  });

  it("wraps new browser sessions in the gated visual-auth bridge", () => {
    const url = new URL(promoCaptureAuthUrl(scene));
    assert.equal(url.pathname, "/dev/harthmere-visual-auth");
    assert.equal(url.searchParams.get("username"), "Chapter1Marketing");
    const next = url.searchParams.get("next") ?? "";
    assert.ok(next.startsWith("/at/"));
    assert.ok(next.includes("cutscenePromo=dungeon-portal"));
  });

  it("generates an authenticated warm-batch URL with no single-scene selector", () => {
    const url = new URL(
      promoBatchCaptureAuthUrl("chapter1-visual-repair", undefined, {
        captureRun: "9",
      })
    );
    assert.equal(url.pathname, "/dev/harthmere-visual-auth");
    const next = url.searchParams.get("next") ?? "";
    assert.ok(next.includes("cutscenePromoBatch=chapter1-visual-repair"));
    assert.ok(next.includes("captureRun=9"));
    assert.ok(!next.includes("cutscenePromo="));
  });
});

describe("promo scenes - framing contract", () => {
  it("keeps the portal still framed the way a portal reads", async () => {
    const def = await promoSceneById("dungeon-portal")!.build();
    const shot = def.shots.find((s) => s.id === "portal-crossing")!;

    // Narrow FOV: at 70+ the player drifts off the aperture and the shot
    // stops reading as "standing before a portal".
    const fov = shot.actions.find((a) => a.kind === "fov") as
      | { fov: number }
      | undefined;
    assert.ok(fov && fov.fov <= 45, "promo portal FOV must stay compressed");

    // The camera must look at the gate, not at the player.
    assert.equal(shot.camera.kind, "dolly");
    if (shot.camera.kind === "dolly") {
      assert.equal(shot.camera.lookAtRole, "gate");
      assert.equal(
        shot.camera.waypoints.length,
        2,
        "a push-in keeps every bracketed frame composed"
      );
    }

    // Camera below the gate's centre so it looks slightly UP. Looking down at
    // a portal makes it read as a puddle.
    const gate = def.cast.find((c) => c.role === "gate")!;
    assert.equal(gate.binding.kind, "anchor");
    if (gate.binding.kind === "anchor" && shot.camera.kind === "dolly") {
      const gateY = gate.binding.position[1];
      for (const waypoint of shot.camera.waypoints) {
        assert.ok(
          waypoint.position[1] < gateY,
          "camera must sit below the aperture centre and look up"
        );
      }
    }

    // Dusk: the gate is the only strong light source in frame.
    assert.ok(
      (def.settings.timeOfDay ?? 0.5) > 0.7,
      "promo portal wants a dark sky so the emissive shader carries the frame"
    );
    assert.ok(
      shot.actions.some(
        (action) => action.kind === "moveTo" && action.role === "player"
      ),
      "the gate marketing frame must show traversal, not a static pose"
    );
  });

  it("never risks the live world for a screenshot", async () => {
    for (const scene of PROMO_SCENES) {
      const def = await scene.build();
      assert.equal(def.settings.mode, "clientPuppet");
      assert.deepEqual(def.settings.commitOn, []);
      assert.deepEqual(def.onEnd.placements, []);
      assert.deepEqual(def.onEnd.commits, []);
      assert.ok(
        def.priority >= 100_000,
        "a promo still must preempt ambient scenes"
      );
    }
  });

  it("stages the Chapter 1 stills with the real cast and restrained off-axis action", async () => {
    for (const id of ["ch1-sand-that-remembers", "ch1-long-winter-mouth"]) {
      const scene = promoSceneById(id)!;
      const def = await scene.build();
      const shot = def.shots.find(
        (candidate) => candidate.id === scene.shotId
      )!;
      assert.ok(
        def.cast.some((member) => member.binding.kind === "player"),
        `${id}: action still must use the real authenticated player`
      );
      assert.ok(
        !def.cast.some((member) => member.binding.kind === "ghost"),
        `${id}: never substitute a generic humanoid when a distant ECS NPC is not streamed`
      );
      assert.ok(
        shot.actions.some(
          (action) => action.kind === "vfx" && action.scale >= 2
        ),
        `${id}: action still needs one readable environmental impact`
      );
      assert.ok(
        !shot.actions.some(
          (action) =>
            action.kind === "vfx" && action.effect === "exoticMatterCreation"
        ),
        `${id}: do not cover every landscape with centre-frame sparkling dust`
      );
    }
  });

  it("keeps the requested marketing lockups exact", () => {
    assert.equal(
      promoSceneById("ch1-sand-that-remembers")!.brand.headline,
      "The Sand That Remembers | Biomes"
    );
    assert.equal(
      promoSceneById("ch1-long-winter-mouth")!.brand.headline,
      "The Long Winter Mouth | Biomes"
    );
  });
});
