/// <reference types="mocha" />

import assert from "assert";
import fs from "fs";
import path from "path";

function source(name: string) {
  return fs.readFileSync(
    path.join(process.cwd(), "src/client/components/challenges", `${name}.tsx`),
    "utf8"
  );
}

describe("Chapter 1 polling performance contracts", () => {
  it("deduplicates unchanged gate responses before publishing React/renderer state", () => {
    const gate = source("Chapter1FractureGatePrompt");
    assert.match(gate, /lastStateSignature/);
    assert.match(gate, /signature === lastStateSignature\.current/);
    assert.match(gate, /setCh1ActiveGateIds/);
    assert.match(gate, /setCh1ActiveDungeonRunId/);
  });

  it("uses story events for immediate refresh and a slower reconciliation poll", () => {
    const projection = source("Chapter1WorldProjectionController");
    assert.match(projection, /chapter1ProjectionSignature/);
    assert.match(
      projection,
      /addEventListener\("chapter1-story-updated", onStoryUpdated\)/
    );
    assert.match(projection, /setInterval\(\(\) => void refresh\(\), 2_000\)/);
    assert.match(projection, /signature === lastPublishedSignature/);
  });
});
