/// <reference types="mocha" />
/// <reference types="node" />

import assert from "assert";
import { robotTalkDialogSectionsWithLiveEntityHelperV1 } from "./liveEntityRobotDialogPresentationV1";

describe("liveEntityRobotDialogPresentationV1", () => {
  it("shows live-entity helper dialogue before robot transmission options", () => {
    const helperAction = {
      name: "Recharge Robot",
      onPerformed: () => {},
    };
    const transmissionAction = {
      name: "Old Transmission",
      onPerformed: () => {},
    };

    const sections = robotTalkDialogSectionsWithLiveEntityHelperV1({
      transmissionText: "Transmissions",
      transmissionActions: [transmissionAction],
      liveEntityHelperDialog: {
        dialogText:
          "<text>Robot charge: [----------] depleted. Needs 1 Stabilized Exotic Matter.</text>",
        actions: [helperAction],
      },
    });

    assert.equal(sections.length, 2);
    assert.match(sections[0].text, /Robot charge/);
    assert.deepEqual(sections[0].actions, [helperAction]);
    assert.equal(sections[1].text, "Transmissions");
    assert.deepEqual(sections[1].actions, [transmissionAction]);
  });

  it("keeps the normal robot transmission screen when no helper quest exists", () => {
    const sections = robotTalkDialogSectionsWithLiveEntityHelperV1({
      transmissionText: "No transmissions",
      transmissionActions: [],
    });

    assert.deepEqual(sections, [
      {
        text: "No transmissions",
        actions: [],
      },
    ]);
  });
});
