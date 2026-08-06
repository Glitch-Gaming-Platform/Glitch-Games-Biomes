import { anItem } from "@/shared/game/item";
import { harthmereNativeBiomesIdForItemId } from "@/shared/harthmere/harthmere_native_item_ids";
import {
  HARTHMERE_MELEE_HIT_SOUND_DURATION_SECONDS,
  HARTHMERE_MELEE_HIT_SOUND_IDS,
  harthmereMeleeHitItem,
  harthmereMeleeHitSoundIdForItem,
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

  it("emits from both confirmed-hit renderer paths", () => {
    const npcRuntime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/resources/npcs.ts"),
      "utf8"
    );
    const playerRuntime = fs.readFileSync(
      path.join(process.cwd(), "src/client/game/renderers/players.ts"),
      "utf8"
    );
    for (const runtime of [npcRuntime, playerRuntime]) {
      assert.match(runtime, /shouldShowHarthmereMeleeHitSpark/);
      assert.match(runtime, /harthmereMeleeHitSoundIdForItem/);
      assert.match(runtime, /emitHarthmereSoundEffect/);
    }
  });
});
