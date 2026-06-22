import assert from "assert";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  maybeIdToNpcType,
} from "@/shared/npc/bikkie";
import {
  harthmereFallbackNpcDialogText,
  harthmereFallbackNpcOptions,
  isHarthmerePlaceholderNpcDialog,
} from "../npc_dialog_fallback";
import {
  SNAPSHOT_GROVE_NPCS,
  snapshotGroveNpcEntityId,
} from "../snapshot_grove_content";
import {
  makeHarthmereNpcAppearanceConfig,
  HARTHMERE_APPEARANCE_BUILDER_FIELDS,
  parseHarthmereAppearanceMarker,
  withHarthmereAppearanceMarker,
} from "../voxel_faces";
import { snapshotLiveNpcLoreForDialog } from "../snapshot_live_npc_bible";

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
    assert.equal(
      (npcType?.npcDefaultDialog ?? "").includes(
        "Welcome to the local dev starter town"
      ),
      false
    );
  });

  it("upgrades placeholder NPC chatter into useful first-person relationship choices", () => {
    assert.equal(
      isHarthmerePlaceholderNpcDialog("I'm a little busy right now..."),
      true
    );
    assert.equal(isHarthmerePlaceholderNpcDialog("What's up"), true);
    assert.equal(
      isHarthmerePlaceholderNpcDialog(
        "The Grove is watching the job board and the fountain today."
      ),
      false
    );

    const text = harthmereFallbackNpcDialogText({
      name: "Phoebe Van Dam",
      description: "merchant near The Muck",
    });
    const options = harthmereFallbackNpcOptions({
      name: "Phoebe Van Dam",
      description: text,
    });
    const guardOptions = harthmereFallbackNpcOptions({
      name: "Sergeant Bram Holt",
      description: "guard near the north gate",
    });

    assert.ok(/Grove|Biomes economy law|Harthmere/.test(text));
    assert.equal(options.length, 3);
    assert.ok(options.every((option) => option.followUpText.length > 60));
    assert.equal(
      options.some((option) => option.name === "Offer a hand"),
      false
    );
    assert.ok(options.some((option) => option.likeability > 0));
    assert.ok(options.some((option) => option.likeability < 0));
    assert.ok(options.some((option) => option.type === "destructive"));
    assert.notDeepEqual(
      options.map((option) => option.name),
      guardOptions.map((option) => option.name)
    );
  });

  it("does not collapse unknown Grove NPC chatter to one repeated economy-law line", () => {
    const lines = ["Andriana", "Julienne", "Coretta", "Patsy"].map((name) =>
      harthmereFallbackNpcDialogText({
        name,
        description: "Grove local near the Jobs Board",
      })
    );

    assert.ok(new Set(lines).size > 1);
    assert.ok(
      lines.every(
        (line) => !line.includes("works under the Biomes economy law")
      )
    );
  });

  it("gives every lore NPC three distinct first-person responses matched to their own name", () => {
    const { SNAPSHOT_LIVE_NPC_LORE } = require("../snapshot_live_npc_bible");
    for (const lore of SNAPSHOT_LIVE_NPC_LORE) {
      // All motivation fields must now be written in first person (starting with "I")
      assert.ok(
        /^I\b/.test(lore.motivation),
        `${
          lore.displayName
        } motivation must start with "I", got: "${lore.motivation.slice(
          0,
          60
        )}"`
      );
      // No motivation should still use the NPC's own name in place of "I"
      const first =
        lore.displayName.split(/[\s,]/).find(Boolean) ?? lore.displayName;
      assert.equal(
        lore.motivation.startsWith(first),
        false,
        `${lore.displayName} motivation must not start with the NPC's own name (3rd person)`
      );
      // The three extraLines must all be distinct
      const extraSet = new Set(lore.extraLines);
      assert.equal(
        extraSet.size,
        lore.extraLines.length,
        `${lore.displayName} extraLines must all be distinct`
      );
      // No extraLine should duplicate the opening line
      for (const extra of lore.extraLines) {
        assert.notEqual(
          extra,
          lore.line,
          `${lore.displayName} extraLine must not duplicate the opening line`
        );
      }
    }
  });

  it("enriches screenshot-visible Andriana and Julienne with distinct live NPC lore", () => {
    const andriana = snapshotLiveNpcLoreForDialog({ label: "Andriana" });
    const julienne = snapshotLiveNpcLoreForDialog({ label: "Julienne" });

    assert.equal(andriana?.displayName, "Andriana");
    assert.equal(julienne?.displayName, "Julienne");
    assert.notEqual(andriana?.line, julienne?.line);
    assert.equal(andriana?.line.includes("Biomes economy law"), false);
    assert.equal(julienne?.line.includes("Biomes economy law"), false);
  });

  it("keeps Gus the Baker on his seeded baker appearance instead of the generic purple fallback", () => {
    const gus = SNAPSHOT_GROVE_NPCS.find((npc) => npc.id === "gus_the_baker");
    assert.ok(gus, "Gus the Baker should be seeded into the Grove cast");
    assert.equal(gus!.seedServerNpc, true);
    assert.equal(snapshotGroveNpcEntityId(gus!), 8810000000019320);

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

    const marked = withHarthmereAppearanceMarker(
      "Gus bakes for the Grove.",
      appearance
    );
    const parsed = parseHarthmereAppearanceMarker(marked);
    assert.equal(parsed?.body.outfitColor, "ember");
    assert.equal(parsed?.clothing.torso?.id, "work_apron");
  });

  it("uses the Grove helper robot skin for bot and sentential living-entity labels", () => {
    for (const name of ["Mucked Restoro Bot", "Archive Sentential"]) {
      const appearance = makeHarthmereNpcAppearanceConfig({
        id: 8_810_000_001_200 + name.length,
        name,
        roleHint: `${name} living entity helper`,
        forwardAxis: "minusZ",
      });

      assert.equal(appearance.face.skinTone, "metal", name);
      assert.equal(appearance.face.faceShape, "soft", name);
      assert.equal(appearance.face.eyeColor, "blue", name);
      assert.equal(appearance.body.bodyType, "broad", name);
      assert.equal(appearance.body.legLength, "short", name);
    }
  });
});
