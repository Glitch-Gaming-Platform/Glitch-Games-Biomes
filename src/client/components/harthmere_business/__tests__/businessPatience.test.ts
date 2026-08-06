import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { HarthmereBusinessPatienceBar } from "../HarthmereBusinessPatienceBar";
import {
  harthmereBusinessCustomerDisplayName,
  harthmereBusinessPatienceDisplay,
} from "../harthmereBusinessPatience";

describe("Harthmere business customer patience display", () => {
  it("clamps authoritative patience into a player-readable countdown", () => {
    assert.deepEqual(harthmereBusinessPatienceDisplay(48, 36), {
      total: 48,
      remaining: 36,
      ratio: 0.75,
      percent: 75,
      urgency: "steady",
      label: "36 seconds left",
    });
    assert.equal(harthmereBusinessPatienceDisplay(48, 24).urgency, "warning");
    assert.equal(harthmereBusinessPatienceDisplay(48, 12).urgency, "critical");
    assert.deepEqual(harthmereBusinessPatienceDisplay(48, 0), {
      total: 48,
      remaining: 0,
      ratio: 0,
      percent: 0,
      urgency: "expired",
      label: "Out of patience",
    });
  });

  it("never exposes invalid or over-max countdown values", () => {
    assert.equal(harthmereBusinessPatienceDisplay(0, Number.NaN).total, 1);
    assert.equal(harthmereBusinessPatienceDisplay(20, 99).remaining, 20);
    assert.equal(harthmereBusinessPatienceDisplay(20, -5).remaining, 0);
  });

  it("turns internal customer ids into readable names", () => {
    assert.equal(
      harthmereBusinessCustomerDisplayName("customer_jessa_mint"),
      "Jessa Mint"
    );
  });

  it("renders a player-readable countdown bar from the authoritative values", () => {
    const html = renderToStaticMarkup(
      React.createElement(HarthmereBusinessPatienceBar, {
        customerName: "Jessa Mint",
        patience: harthmereBusinessPatienceDisplay(48, 12),
      })
    );
    assert.match(html, /role="progressbar"/);
    assert.match(html, /aria-label="Jessa Mint patience"/);
    assert.match(html, /aria-valuemax="48"/);
    assert.match(html, /aria-valuenow="12"/);
    assert.match(html, /aria-valuetext="12 seconds left"/);
    assert.match(html, /data-patience-urgency="critical"/);
    assert.match(html, /width:25%/);
    assert.match(html, />12 seconds left</);
  });
});
