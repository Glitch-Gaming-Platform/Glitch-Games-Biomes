import {
  activeQuestVoiceContextForNpc,
  playerVoiceContextForNpcChat,
  questVoiceContextForStepBundle,
} from "@/client/components/challenges/helpers";
import assert from "assert";

describe("Harthmere NPC voice player context", () => {
  it("passes current location, worn items, and avatar visual data into NPC chat context", () => {
    const resources = {
      get(path: string) {
        if (path === "/scene/local_player") {
          return {
            player: {
              position: [486, 70, -209],
            },
          };
        }
        if (path === "/ecs/c/wearing") {
          return {
            items: {
              top: { displayName: "Mucky Top" },
              bottoms: { item: { displayName: "Mucky Skirt" } },
            },
          };
        }
        if (path === "/ecs/c/appearance_component") {
          return {
            appearance: {
              hair: "blue",
              skin: "ash",
              empty: "",
              missing: undefined,
            },
          };
        }
        return undefined;
      },
    };

    const context = playerVoiceContextForNpcChat({
      reactResources: resources as any,
      userId: 1 as any,
    });

    assert.match(context, /Position: 486, 70, -209/);
    assert.match(context, /Location: Grove Jobs Board/);
    assert.match(context, /honest work|urgent notices|courier contracts/i);
    assert.match(context, /Wearing: Mucky Top and Mucky Skirt/);
    assert.match(context, /Avatar visual data: hair=blue, skin=ash/);
    assert.doesNotMatch(context, /empty=/);
    assert.doesNotMatch(context, /missing=/);
  });

  it("keeps NPC chat context useful when player details are missing", () => {
    const resources = {
      get() {
        return undefined;
      },
    };

    const context = playerVoiceContextForNpcChat({
      reactResources: resources as any,
      userId: 1 as any,
    });

    assert.match(context, /Location: unknown part of Harthmere/);
    assert.match(context, /Wearing: no readable worn item names/);
    assert.match(context, /Avatar visual data: not available/);
  });

  it("prioritizes only active incomplete NPC quest context for voice responses", () => {
    const completed = {
      questBundle: {
        state: "in_progress",
        biscuit: { displayName: "Finished Favor" },
      },
      stepCompleted: true,
      step: { id: 1, description: "Already done." },
    };
    const available = {
      questBundle: {
        state: "available",
        biscuit: { displayName: "Available Favor" },
      },
      stepCompleted: false,
      step: { id: 2, description: "Not accepted yet." },
    };
    const active = {
      questBundle: {
        state: "in_progress",
        biscuit: { displayName: "Repair the Safe-Zone Fence" },
      },
      stepCompleted: false,
      acceptText: "I fixed it.",
      declineText: "Not yet.",
      step: {
        id: 3,
        description: "<text>Bring fence posts back to Othilia.</text>",
      },
    };

    const context = activeQuestVoiceContextForNpc([
      completed as any,
      available as any,
      active as any,
    ]);

    assert.match(context ?? "", /Quest: Repair the Safe-Zone Fence/);
    assert.match(context ?? "", /Quest state: in_progress/);
    assert.match(context ?? "", /Bring fence posts back to Othilia/);
    assert.match(context ?? "", /Primary action: I fixed it/);
    assert.doesNotMatch(context ?? "", /Finished Favor/);
    assert.doesNotMatch(context ?? "", /Available Favor/);
  });

  it("omits quest voice context once the NPC quest is no longer active", () => {
    assert.equal(
      activeQuestVoiceContextForNpc([
        {
          questBundle: {
            state: "completed",
            biscuit: { displayName: "Old Quest" },
          },
          stepCompleted: true,
          step: { id: 1, description: "Done." },
        } as any,
      ]),
      undefined
    );
    assert.match(
      questVoiceContextForStepBundle({
        questBundle: {
          state: "available",
          biscuit: { displayName: "Future Quest" },
        },
        stepCompleted: false,
        step: { id: 2, description: "Come back later." },
      } as any),
      /Quest: Future Quest/
    );
  });
});
