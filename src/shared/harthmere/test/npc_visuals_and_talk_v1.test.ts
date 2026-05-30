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

  it("upgrades placeholder NPC chatter into a useful two-option conversation", () => {
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

    assert.ok(text.includes("Phoebe Van Dam"));
    assert.ok(/Grove|Biomes economy law|Harthmere/.test(text));
    assert.equal(options.length, 2);
    assert.ok(options.every((option) => option.followUpText.length > 60));
    assert.ok(options.every((option) => option.likeability > 0));
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
