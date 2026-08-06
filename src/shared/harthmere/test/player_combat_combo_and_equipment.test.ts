import {
  HARTHMERE_COMBAT_BASIC_AUTHORED_DURATION_SECS,
  HARTHMERE_COMBAT_COMBO_COOLDOWN_SECS,
  HARTHMERE_COMBAT_COMBO_MAX_HITS,
  HARTHMERE_COMBAT_BASIC_AUTHORED_CONTACT_SECS,
  HARTHMERE_COMBAT_HEAVY_AUTHORED_DURATION_SECS,
  HARTHMERE_COMBAT_HEAVY_AUTHORED_CONTACT_SECS,
  HARTHMERE_HEAVY_ATTACK_DAMAGE_MULTIPLIER,
  HARTHMERE_HEAVY_ATTACK_TIME_MULTIPLIER,
  HARTHMERE_PLAYER_ATTACK_TIMINGS,
  nextHarthmereCombatCombo,
  type HarthmereCombatComboState,
} from "@/shared/harthmere/deliberate_combat";
import {
  HARTHMERE_PLAYER_ANIMATION_RUNTIME_URL,
  harthmereMeleeComboAnimation,
} from "@/shared/harthmere/attack_variation_polish";
import assert from "assert";
import fs from "fs";
import path from "path";

const ROOT = process.cwd();

function source(relative: string) {
  return fs.readFileSync(path.join(ROOT, relative), "utf8");
}

function packagedAnimationJson() {
  const glb = fs.readFileSync(
    path.join(ROOT, "public", HARTHMERE_PLAYER_ANIMATION_RUNTIME_URL.slice(1))
  );
  assert.equal(glb.toString("ascii", 0, 4), "glTF");
  let offset = 12;
  while (offset < glb.length) {
    const length = glb.readUInt32LE(offset);
    const kind = glb.toString("ascii", offset + 4, offset + 8);
    if (kind === "JSON") {
      return JSON.parse(
        glb
          .toString("utf8", offset + 8, offset + 8 + length)
          .replace(/\u0000+$/g, "")
      ) as {
        animations: Array<{
          name: string;
          extras?: {
            impactSeconds?: number;
            durationSeconds?: number;
            direction?: string;
            weaponArc?: string;
            comboStep?: number;
            harthmereAnimationPolishVersion?: string;
            phases?: Array<{ name: string }>;
          };
        }>;
      };
    }
    offset += 8 + length;
  }
  assert.fail("packaged animation GLB has no JSON chunk");
}

describe("fight-only four-hit player combo", () => {
  it("shares one light/heavy budget, links after contact, and holds three seconds after hit four", () => {
    let state: HarthmereCombatComboState | undefined;
    const timingClasses = ["basic", "heavy", "basic", "heavy"] as const;
    const decisions = timingClasses.map((kind, index) => {
      const at = index === 0 ? 0 : state!.nextAttackAt;
      const decision = nextHarthmereCombatCombo(state, at, kind);
      assert.equal(decision.allowed, true);
      assert.ok(decision.allowed);
      state = decision.state;
      return decision.state;
    });

    assert.deepEqual(
      decisions.map(({ hit }) => hit),
      [1, 2, 3, 4]
    );
    assert.equal(
      new Set(decisions.map(({ variation }) => variation)).size,
      HARTHMERE_COMBAT_COMBO_MAX_HITS
    );
    assert.equal(
      decisions[0].nextAttackAt,
      HARTHMERE_PLAYER_ATTACK_TIMINGS.basic.impactMs / 1000
    );
    assert.ok(
      Math.abs(
        decisions[1].nextAttackAt -
          (HARTHMERE_COMBAT_BASIC_AUTHORED_CONTACT_SECS +
            HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.impactMs / 1000)
      ) < 1e-9
    );
    assert.ok(
      Math.abs(
        decisions[2].nextAttackAt -
          ((HARTHMERE_PLAYER_ATTACK_TIMINGS.basic.impactMs / 1000) * 2 +
            HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.impactMs / 1000)
      ) < 1e-9
    );

    const bodyClips = decisions.map((decision, index) =>
      harthmereMeleeComboAnimation(timingClasses[index], decision.variation)
    );
    assert.equal(new Set(bodyClips.map(({ clip }) => clip)).size, 4);
    assert.equal(new Set(bodyClips.map(({ emoteType }) => emoteType)).size, 4);
    assert.deepEqual(bodyClips.map(({ comboRole }) => comboRole).sort(), [
      "finisher",
      "opener",
      "power",
      "return",
    ]);

    const fourth = decisions[3];
    assert.equal(
      fourth.cooldownUntil,
      decisions[3].chainStartedAt +
        (HARTHMERE_PLAYER_ATTACK_TIMINGS.basic.impactMs / 1000) * 2 +
        HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.impactMs / 1000 +
        (HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.impactMs +
          HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.recoveryMs) /
          1000 +
        HARTHMERE_COMBAT_COMBO_COOLDOWN_SECS
    );
    const fifthEarly = nextHarthmereCombatCombo(
      fourth,
      fourth.cooldownUntil - 0.001,
      "basic"
    );
    assert.deepEqual(fifthEarly, {
      allowed: false,
      readyAt: fourth.cooldownUntil,
    });
    const nextChain = nextHarthmereCombatCombo(
      fourth,
      fourth.cooldownUntil,
      "basic"
    );
    assert.equal(nextChain.allowed, true);
    assert.ok(nextChain.allowed);
    assert.equal(nextChain.state.hit, 1);
    assert.notEqual(nextChain.state.variation, decisions[0].variation);
  });

  it("balances held heavy attacks at 1.5x damage on the authored clock", () => {
    assert.equal(HARTHMERE_HEAVY_ATTACK_DAMAGE_MULTIPLIER, 1.5);
    assert.equal(HARTHMERE_HEAVY_ATTACK_TIME_MULTIPLIER, 1);
    assert.equal(HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.impactMs, 417);
    assert.equal(HARTHMERE_PLAYER_ATTACK_TIMINGS.heavy.recoveryMs, 666);
  });

  it("keeps native magic release on the authored cast clip", () => {
    const localPlayer = source("src/client/game/resources/local_player.ts");
    assert.match(localPlayer, /case "magic":\s*return "magicCast"/);
    assert.match(
      localPlayer,
      /const attackEmote = harthmerePlayerAttackEmote\(timingClass\)/
    );
  });

  it("uses the exact packaged four-direction basic and heavy clips with authored phases", () => {
    const gltf = packagedAnimationJson();
    assert.ok(gltf.animations.length >= 133);
    assert.equal(
      new Set(gltf.animations.map(({ name }) => name)).size,
      gltf.animations.length,
      "the runtime animation set must not contain duplicate clip names"
    );
    const expectedPaths = [
      "horizontal_left_to_right",
      "horizontal_right_to_left",
      "vertical_overhead_to_low",
    ] as const;
    for (const family of ["Basic", "Heavy"] as const) {
      const expectedImpact = family === "Basic" ? 0.25 : 10 / 24;
      const expectedDuration = family === "Basic" ? 17 / 24 : 26 / 24;
      const directions = new Set<string>();
      for (let variation = 1; variation <= 4; variation += 1) {
        const name = `HarthmereBodyWeapon${family}_Variation${variation}_24`;
        const clip = gltf.animations.find(
          (candidate) => candidate.name === name
        );
        assert.ok(clip, `${name} missing from the exact published GLB`);
        assert.equal(clip.extras?.impactSeconds, expectedImpact, name);
        assert.equal(clip.extras?.durationSeconds, expectedDuration, name);
        assert.equal(clip.extras?.comboStep, variation, name);
        assert.equal(
          clip.extras?.weaponArc,
          variation <= 3
            ? expectedPaths[variation - 1]
            : family === "Basic"
              ? "diagonal_low_left_to_high_right"
              : "diagonal_low_right_to_high_left",
          `${name} weapon path`
        );
        assert.equal(
          clip.extras?.harthmereAnimationPolishVersion,
          "harthmere-player-combo-animation-polish-v4-trajectories",
          name
        );
        directions.add(String(clip.extras?.direction));
        assert.deepEqual(
          clip.extras?.phases?.map(({ name: phase }) => phase),
          ["anticipation", "strike", "impact", "followThrough", "recovery"],
          name
        );
      }
      assert.equal(directions.size, 4, `${family} directions repeat`);
    }
    assert.equal(HARTHMERE_COMBAT_BASIC_AUTHORED_CONTACT_SECS, 6 / 24);
    assert.equal(HARTHMERE_COMBAT_HEAVY_AUTHORED_CONTACT_SECS, 10 / 24);
    assert.equal(HARTHMERE_COMBAT_BASIC_AUTHORED_DURATION_SECS, 17 / 24);
    assert.equal(HARTHMERE_COMBAT_HEAVY_AUTHORED_DURATION_SECS, 26 / 24);
  });

  it("keeps variation state per Player and makes ItemAttachment the only equipped visual", () => {
    const players = source("src/client/game/resources/players.ts");
    const animations = source("src/client/game/util/player_animations.ts");
    const playerRenderer = source("src/client/game/renderers/players.ts");
    const runtimeRenderer = source(
      "src/client/game/renderers/local_dev/harthmere_assets.ts"
    );

    assert.match(players, /private harthmereAttackVariationIndex = 0/);
    assert.match(players, /attackVariationIndex\?: 1 \| 2 \| 3 \| 4/);
    assert.doesNotMatch(
      animations,
      /let harthmereLastAttackVariation(Index|Family)/
    );
    assert.match(
      playerRenderer,
      /playerMesh\.itemAttachment\.updateAttachedItem\([\s\S]*attachedItem/
    );
    assert.doesNotMatch(
      runtimeRenderer.match(/constructor\([\s\S]*?\n  draw\(/)?.[0] ?? "",
      /installHarthmerePlayerSwordVisuals\(\)/
    );
    assert.doesNotMatch(
      runtimeRenderer.match(/draw\([\s\S]*?\n  private /)?.[0] ?? "",
      /updateHarthmerePlayerSwordVisual\(\)/
    );
    assert.match(
      runtimeRenderer,
      /AUTHORITATIVE_EQUIPPED_ITEM_VISUAL =[\s\S]*player-item-attachment-tool-bone-v1/
    );
  });
});
