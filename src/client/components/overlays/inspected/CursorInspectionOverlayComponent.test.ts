import { mergeInspectShortcutLayers } from "@/client/components/overlays/inspected/inspectShortcutOrdering";
import assert from "assert";

describe("cursor inspection F-action precedence", () => {
  const action = (title: string) => ({ title, onKeyDown: () => undefined });

  it("keeps typed capabilities ahead of inferred object and dialogue actions", () => {
    const ordered = mergeInspectShortcutLayers(
      [action("Move")],
      [action("Open Container")],
      [action("Sell"), action("Talk")]
    );
    assert.deepEqual(
      ordered.map((entry) => entry.title),
      ["Move", "Open Container", "Sell", "Talk"]
    );
  });

  it("lets a container own F when no more specific typed action exists", () => {
    const ordered = mergeInspectShortcutLayers(
      [],
      [action("Open Container")],
      [action("Talk")]
    );
    assert.equal(ordered[0].title, "Open Container");
  });
});
