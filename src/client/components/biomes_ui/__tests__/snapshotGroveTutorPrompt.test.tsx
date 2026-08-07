import assert from "assert";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import {
  SnapshotGroveTutorPrompt,
  snapshotGroveTutorLabelForTabForTest,
  snapshotGroveTutorTargetForLabelForTest,
} from "../SnapshotGroveTutorPrompt";

describe("Snapshot Grove replacement tutor prompt", () => {
  it("maps the lost-and-found storage lesson to the real Inbox tab", () => {
    assert.deepEqual(snapshotGroveTutorTargetForLabelForTest("Mail"), {
      label: "Mail",
      tab: "inbox",
      shortcut: "V",
    });
    assert.equal(snapshotGroveTutorLabelForTabForTest("inbox"), "Mail");
  });

  it("renders a visible pulsing target only while labels are active", () => {
    const html = renderToStaticMarkup(
      <SnapshotGroveTutorPrompt
        labels={new Set(["Mail"])}
        onOpenTab={() => {}}
        onOpenRecipes={() => {}}
        onOpenChat={() => {}}
      />
    );
    assert.ok(html.includes('aria-label="Tutorial target: Mail"'));
    assert.ok(html.includes("Open Mail (V)"));
    assert.ok(html.includes("snapshotGroveReplacementTutorPulse"));

    assert.equal(
      renderToStaticMarkup(
        <SnapshotGroveTutorPrompt
          labels={new Set()}
          onOpenTab={() => {}}
          onOpenRecipes={() => {}}
          onOpenChat={() => {}}
        />
      ),
      ""
    );
  });
});
