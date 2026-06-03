import assert from "assert";

import type { BiomesId } from "@/shared/ids";
import {
  addThreat,
  decayThreat,
  pickThreatPreferredTarget,
  topThreat,
  type ThreatTable,
} from "@/shared/npc/threat";

const id = (n: number) => n as BiomesId;

describe("threat table accumulation and decay", () => {
  it("accumulates threat and prunes non-positive entries", () => {
    const table: ThreatTable = {};
    addThreat(table, id(1), 10);
    addThreat(table, id(1), 5);
    assert.equal(table["1"], 15);

    addThreat(table, id(1), -100);
    assert.equal(table["1"], undefined);
  });

  it("topThreat returns the most-threatening id, or undefined when empty", () => {
    const table: ThreatTable = {};
    assert.equal(topThreat(table), undefined);

    addThreat(table, id(1), 10);
    addThreat(table, id(2), 30);
    addThreat(table, id(3), 20);
    assert.equal(topThreat(table), 2);
  });

  it("decays threat across elapsed time and prunes emptied entries", () => {
    const table: ThreatTable = {};
    addThreat(table, id(1), 100);
    addThreat(table, id(2), 4);

    // 2 seconds elapsed * 5 threat/sec = 10 decay.
    const lastDecayAt = decayThreat(table, 12, 10);
    assert.equal(lastDecayAt, 12);
    assert.equal(table["1"], 90);
    assert.equal(table["2"], undefined);
  });

  it("does not decay before the decay interval elapses", () => {
    const table: ThreatTable = { "1": 100 };
    const lastDecayAt = decayThreat(table, 10.5, 10);
    assert.equal(lastDecayAt, 10);
    assert.equal(table["1"], 100);
  });
});

describe("threat-preferred target selection", () => {
  it("returns undefined with no candidates", () => {
    assert.equal(pickThreatPreferredTarget([]), undefined);
  });

  it("falls back to the nearest candidate when none carry threat", () => {
    assert.equal(
      pickThreatPreferredTarget([
        { id: id(1), distanceSq: 100, threat: 0 },
        { id: id(2), distanceSq: 25, threat: 0 },
      ]),
      2
    );
  });

  it("REGRESSION: focuses the highest-threat candidate over a closer one", () => {
    assert.equal(
      pickThreatPreferredTarget([
        { id: id(1), distanceSq: 4, threat: 5 }, // closest
        { id: id(2), distanceSq: 400, threat: 50 }, // most threatening
      ]),
      2
    );
  });

  it("breaks threat ties by proximity", () => {
    assert.equal(
      pickThreatPreferredTarget([
        { id: id(1), distanceSq: 100, threat: 30 },
        { id: id(2), distanceSq: 9, threat: 30 },
      ]),
      2
    );
  });
});
