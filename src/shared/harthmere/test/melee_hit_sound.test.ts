import { anItem } from "@/shared/game/item";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS,
  HARTHMERE_MELEE_HIT_SOUND_IDS,
  harthmereMeleeHitItem,
  harthmereMeleeHitSoundIdForItem,
  isHarthmereMeleeHitSoundItem,
} from "@/shared/harthmere/melee_hit_sound";
import { getHarthmereSoundEffect } from "@/shared/harthmere/sound_effect_manifest";
import assert from "assert";
import fs from "fs";
import path from "path";

describe("confirmed melee hit sounds", () => {
  it("selects slap, wood chop, and metal clink by held item class", () => {
    const tool = anItem(harthmereNativeBiomesIdForItemId("rusty_pickaxe")!);
    const weapon = anItem(harthmereNativeBiomesIdForItemId("iron_longsword")!);
    assert.equal(
      harthmereMeleeHitSoundIdForItem(undefined),
      HARTHMERE_MELEE_HIT_SOUND_IDS.unarmed
    );
    assert.equal(
      harthmereMeleeHitSoundIdForItem(tool),
      HARTHMERE_MELEE_HIT_SOUND_IDS.tool
    );
    assert.equal(
      harthmereMeleeHitSoundIdForItem(weapon),
      HARTHMERE_MELEE_HIT_SOUND_IDS.weapon
    );
  });

  it("prefers the attack emote item so equipment changes cannot desync a hit", () => {
    const attackItem = anItem(
      harthmereNativeBiomesIdForItemId("iron_longsword")!
    );
    const newlySelectedTool = anItem(
      harthmereNativeBiomesIdForItemId("rusty_pickaxe")!
    );
    assert.equal(
      harthmereMeleeHitItem(
        {
          emote_type: "attack1",
          emote_start_time: 10,
          emote_expiry_time: 11,
          emote_nonce: 1,
          rich_emote_components: {
            fishing_info: undefined,
            throw_info: undefined,
            item_override: attackItem,
          },
        },
        newlySelectedTool
      )?.id,
      attackItem.id
    );
  });

  it("accepts only unarmed, melee, heavy, and tool contact profiles", () => {
    const tool = anItem(harthmereNativeBiomesIdForItemId("rusty_pickaxe")!);
    const weapon = anItem(
      harthmereNativeBiomesIdForItemId("iron_longsword")!
    );
    const bow = anItem(harthmereNativeBiomesIdForItemId("hunter_bow")!);
    assert.equal(isHarthmereMeleeHitSoundItem(undefined), true);
    assert.equal(isHarthmereMeleeHitSoundItem(tool), true);
    assert.equal(isHarthmereMeleeHitSoundItem(weapon), true);
    assert.equal(isHarthmereMeleeHitSoundItem(bow), false);
  });

  it("registers all three ElevenLabs effects at exactly 0.15 seconds", () => {
    assert.equal(HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS, 0.15);
    for (const id of Object.values(HARTHMERE_MELEE_HIT_SOUND_IDS)) {
      const definition = getHarthmereSoundEffect(id);
      assert.equal(definition?.source, "elevenlabs", id);
      assert.equal(definition?.durationSeconds, 0.15, id);
      assert.equal(
        definition?.mobilePath,
        `/assets/harthmere/audio/sfx/${id}.m4a`
      );
    }
  });

  it("plays from the replicated health-change script while both renderer paths retain the spark", () => {
    const npcRuntime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    const playerRuntime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/renderers/players.ts"),
      "utf8"
    );
    const soundRuntime = fs.readFileSync(
      path.join(
        process.cwd(),
        "src/client/game/scripts/harthmere_sound_effects.ts"
      ),
      "utf8"
    );
    for (const runtime of [npcRuntime, playerRuntime]) {
      assert.match(runtime, /shouldShowHarthmereMeleeHitSpark/);
      assert.doesNotMatch(runtime, /harthmereMeleeHitSoundIdForItem/);
    }
    assert.match(soundRuntime, /lastMeleeDamageTimes/);
    assert.match(soundRuntime, /isHarthmereMeleeHitSoundItem/);
    assert.match(soundRuntime, /harthmereMeleeHitSoundIdForItem/);
    assert.match(soundRuntime, /HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS/);
  });

  it("keeps live combat acceptance bridge-first and sound-observable", () => {
    const runner = fs.readFileSync(
      path.join(
        process.cwd(),
        "scripts/harthmere/test-harthmere-native-player-attack-live-browser.cjs"
      ),
      "utf8"
    );
    const preNavigationPose = runner.indexOf(
      "await applyPreNavigationPlayerFixture(context, auth.userId);"
    );
    const pageCreation = runner.indexOf("page = await context.newPage();");
    const bridgeReady = runner.indexOf("await waitForClientBridge(page);");
    const safePose = runner.indexOf(
      "const loadingPlayer = await authoritativeEntity"
    );
    const gameplayReady = runner.indexOf("await waitForStableGameplay(page);");

    assert(
      preNavigationPose >= 0 && preNavigationPose < pageCreation,
      "live runner does not place the authoritative actor before page creation"
    );
    assert(bridgeReady >= 0, "live runner does not wait for the ECS bridge");
    assert(safePose > bridgeReady, "live runner does not establish a safe pose");
    assert(
      gameplayReady > safePose,
      "live runner waits for the loading overlay before placing the actor"
    );
    assert.match(runner, /confirmedMeleeHitCount/);
    assert.match(runner, /lastRequestedId === "melee_hit_weapon_clink"/);
    assert.match(runner, /projectile audio/);
    assert.match(runner, /pendingRequestCount/);
    assert.match(runner, /HARTHMERE_E2E_ATTACK_PROJECTILE_AUDIO_ONLY/);
    assert.match(runner, /projectile audit could not unlock Web Audio/);
    assert.match(runner, /const basePosition = \[895, 62, -197\]/);
  });
});
