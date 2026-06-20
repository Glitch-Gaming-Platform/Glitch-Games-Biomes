import assert from "assert";
import {
  BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS,
  biomesUIIsNonGameplayScreenVisible,
} from "../BiomesUIOpenPrompt";

interface FakeElement extends Element {
  styleForTest: Pick<CSSStyleDeclaration, "display" | "visibility">;
}

function fakeElement({
  display = "block",
  visibility = "visible",
  width = 200,
  height = 100,
}: {
  display?: string;
  visibility?: string;
  width?: number;
  height?: number;
} = {}): FakeElement {
  return {
    styleForTest: { display, visibility },
    getBoundingClientRect: () =>
      ({
        x: 0,
        y: 0,
        top: 0,
        left: 0,
        right: width,
        bottom: height,
        width,
        height,
        toJSON: () => ({}),
      } as DOMRect),
  } as FakeElement;
}

function fakeRoot(
  elementsBySelector: Partial<
    Record<
      (typeof BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS)[number],
      Element
    >
  >
) {
  return {
    querySelector: (selector: string) =>
      elementsBySelector[
        selector as (typeof BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS)[number]
      ] ?? null,
  };
}

function readFakeStyle(element: Element) {
  return (element as FakeElement).styleForTest;
}

describe("BiomesUIOpenPrompt non-gameplay suppression", () => {
  it("treats the loading screen as a non-gameplay screen", () => {
    assert.ok(
      BIOMES_UI_NON_GAMEPLAY_SCREEN_SELECTORS.includes(".loading-wrapper")
    );

    assert.equal(
      biomesUIIsNonGameplayScreenVisible(
        fakeRoot({ ".loading-wrapper": fakeElement() }),
        readFakeStyle
      ),
      true
    );
  });

  it("does not suppress the prompt when the loading wrapper is absent or hidden", () => {
    assert.equal(
      biomesUIIsNonGameplayScreenVisible(fakeRoot({}), readFakeStyle),
      false
    );

    assert.equal(
      biomesUIIsNonGameplayScreenVisible(
        fakeRoot({ ".loading-wrapper": fakeElement({ display: "none" }) }),
        readFakeStyle
      ),
      false
    );

    assert.equal(
      biomesUIIsNonGameplayScreenVisible(
        fakeRoot({ ".loading-wrapper": fakeElement({ width: 0 }) }),
        readFakeStyle
      ),
      false
    );
  });
});
