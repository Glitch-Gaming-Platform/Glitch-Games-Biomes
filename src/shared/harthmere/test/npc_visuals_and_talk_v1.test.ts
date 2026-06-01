import assert from "assert";
import { LOCAL_DEV_HUMAN_NPC_TYPE_ID, maybeIdToNpcType } from "@/shared/npc/bikkie";
import {
  harthmereFallbackNpcDialogTextV143,
  harthmereFallbackNpcOptionsV143,
  isHarthmerePlaceholderNpcDialogV143,
} from "../npc_dialog_fallback_v143";
import {
  makeHarthmereNpcAppearanceConfig,
  HARTHMERE_APPEARANCE_BUILDER_FIELDS,
  parseHarthmereAppearanceMarker,
  withHarthmereAppearanceMarker,
} from "../voxel_faces";
import { snapshotLiveNpcLoreForDialogV79 } from "../snapshot_live_npc_bible_v79";

const NPC_VISUAL_AUDIT_NAMES = [
  "Gus the Baker",
  "Nana",
  "Wanda",
  "Charis",
  "Andriana",
  "Rosalyn",
  "Nia, Guild Clerk",
  "Jackie",
  "Kit the Courier",
  "Fern the Grower",
  "Grover",
  "Coretta",
  "Patsy",
  "Gizela",
  "Julienne",
] as const;

describe("Harthmere NPC visuals and talk affordances", () => {
  it("uses the same shared character-builder fields for named Grove NPC appearances", () => {
    assert.ok(HARTHMERE_APPEARANCE_BUILDER_FIELDS.includes("skinTone"));
    assert.ok(HARTHMERE_APPEARANCE_BUILDER_FIELDS.includes("hairStyle"));
    assert.ok(HARTHMERE_APPEARANCE_BUILDER_FIELDS.includes("outfitColor"));

    const signatures = NPC_VISUAL_AUDIT_NAMES.map((name, index) => {
      const appearance = makeHarthmereNpcAppearanceConfig({
        id: 8_810_000_001_000 + index,
        name,
        roleHint: `${name} Grove local`,
      });
      return [
        appearance.face.skinTone,
        appearance.face.faceShape,
        appearance.face.eyeShape,
        appearance.face.eyeColor,
        appearance.face.hairStyle,
        appearance.face.hairColor,
        appearance.face.accessory,
        appearance.body.bodyType,
        appearance.body.bodyHeight,
        appearance.body.outfitColor,
      ].join(":");
    });

    assert.equal(new Set(signatures).size, NPC_VISUAL_AUDIT_NAMES.length);
  });

  it("keeps local-dev townspeople talkable through natural default dialog", () => {
    const npcType = maybeIdToNpcType(LOCAL_DEV_HUMAN_NPC_TYPE_ID);
    assert.equal(npcType?.isPlayerLikeAppearance, true);
    assert.equal(typeof npcType?.npcDefaultDialog, "string");
    assert.ok((npcType?.npcDefaultDialog ?? "").length > 40);
    assert.equal((npcType?.npcDefaultDialog ?? "").includes("Welcome to the local dev starter town"), false);
  });

  it("upgrades placeholder NPC chatter into useful first-person relationship choices", () => {
    assert.equal(isHarthmerePlaceholderNpcDialogV143("I'm a little busy right now..."), true);
    assert.equal(isHarthmerePlaceholderNpcDialogV143("What's up"), true);
    assert.equal(
      isHarthmerePlaceholderNpcDialogV143("The Grove is watching the job board and the fountain today."),
      false,
    );

    const text = harthmereFallbackNpcDialogTextV143({
      name: "Phoebe Van Dam",
      description: "merchant near The Muck",
    });
    const options = harthmereFallbackNpcOptionsV143({
      name: "Phoebe Van Dam",
      description: text,
    });
    const guardOptions = harthmereFallbackNpcOptionsV143({
      name: "Sergeant Bram Holt",
      description: "guard near the north gate",
    });

    assert.ok(/Grove|Biomes economy law|Harthmere/.test(text));
    assert.equal(options.length, 3);
    assert.ok(options.every((option) => option.followUpText.length > 60));
    assert.equal(options.some((option) => option.name === "Offer a hand"), false);
    assert.ok(options.some((option) => option.likeability > 0));
    assert.ok(options.some((option) => option.likeability < 0));
    assert.ok(options.some((option) => option.type === "destructive"));
    assert.notDeepEqual(
      options.map((option) => option.name),
      guardOptions.map((option) => option.name),
    );
  });

  it("does not collapse unknown Grove NPC chatter to one repeated economy-law line", () => {
    const lines = ["Andriana", "Julienne", "Coretta", "Patsy"].map((name) =>
      harthmereFallbackNpcDialogTextV143({
        name,
        description: "Grove local near the Jobs Board",
      }),
    );

    assert.ok(new Set(lines).size > 1);
    assert.ok(lines.every((line) => !line.includes("works under the Biomes economy law")));
  });

  it("gives every lore NPC three distinct first-person responses matched to their own name", () => {
    const { SNAPSHOT_LIVE_NPC_LORE_V79 } = require("../snapshot_live_npc_bible_v79");
    for (const lore of SNAPSHOT_LIVE_NPC_LORE_V79) {
      // All motivation fields must now be written in first person (starting with "I")
      assert.ok(
        /^I\b/.test(lore.motivation),
        `${lore.displayName} motivation must start with "I", got: "${lore.motivation.slice(0, 60)}"`,
      );
      // No motivation should still use the NPC's own name in place of "I"
      const first = lore.displayName.split(/[\s,]/).find(Boolean) ?? lore.displayName;
      assert.equal(
        lore.motivation.startsWith(first),
        false,
        `${lore.displayName} motivation must not start with the NPC's own name (3rd person)`,
      );
      // The three extraLines must all be distinct
      const extraSet = new Set(lore.extraLines);
      assert.equal(
        extraSet.size,
        lore.extraLines.length,
        `${lore.displayName} extraLines must all be distinct`,
      );
      // No extraLine should duplicate the opening line
      for (const extra of lore.extraLines) {
        assert.notEqual(
          extra,
          lore.line,
          `${lore.displayName} extraLine must not duplicate the opening line`,
        );
      }
    }
  });

  it("enriches screenshot-visible Andriana and Julienne with distinct live NPC lore", () => {
    const andriana = snapshotLiveNpcLoreForDialogV79({ label: "Andriana" });
    const julienne = snapshotLiveNpcLoreForDialogV79({ label: "Julienne" });

    assert.equal(andriana?.displayName, "Andriana");
    assert.equal(julienne?.displayName, "Julienne");
    assert.notEqual(andriana?.line, julienne?.line);
    assert.equal(andriana?.line.includes("Biomes economy law"), false);
    assert.equal(julienne?.line.includes("Biomes economy law"), false);
  });

  it("keeps Gus the Baker on his seeded baker appearance instead of the generic purple fallback", () => {
    const appearance = makeHarthmereNpcAppearanceConfig({
      id: 8_810_000_001_104,
      name: "Gus the Baker",
      roleHint: "Grove baker food vendor",
      forwardAxis: "minusZ",
      source: "test:gus-seed",
    });

    assert.equal(appearance.face.skinTone, "warm");
    assert.equal(appearance.face.hairColor, "black");
    assert.equal(appearance.body.outfitColor, "ember");
    assert.equal(appearance.clothing.torso?.id, "work_apron");
    assert.notEqual(appearance.face.skinTone, "violet");
    assert.notEqual(appearance.body.outfitColor, "royal");

    const marked = withHarthmereAppearanceMarker("Gus bakes for the Grove.", appearance);
    const parsed = parseHarthmereAppearanceMarker(marked);
    assert.equal(parsed?.body.outfitColor, "ember");
    assert.equal(parsed?.clothing.torso?.id, "work_apron");
  });
});
