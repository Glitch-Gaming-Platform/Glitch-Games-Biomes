/// <reference types="mocha" />
/// <reference types="node" />
import assert from "assert";
import {
  ch1ConfidenceIsNotTruth,
  ch1FragmentTruth,
  ch1OnlyReconstructionsLie,
  ch1PlaybacksNeverLie,
  ch1ProjectFragmentForClient,
  ch1RevisionsOnlyCorrectErrors,
  ch1TruthTableIsComplete,
  ch1ValidateFairPlay,
} from "../ch1_fragment_authority";
import { CH1_FRAGMENTS } from "@/shared/harthmere/ch1_fragment_ledger";

describe("ch1 fragment authority - the fair-play contract", () => {
  it("passes every fair-play rule", () => {
    assert.deepEqual(ch1ValidateFairPlay(), []);
  });

  it("assigns a truth value to every fragment and no orphans", () => {
    assert.deepEqual(ch1TruthTableIsComplete(), []);
  });

  it("RULE 1: playbacks never lie", () => {
    assert.deepEqual(ch1PlaybacksNeverLie(), []);
    for (const frag of CH1_FRAGMENTS.filter((f) => f.type === "playback")) {
      assert.equal(
        ch1FragmentTruth(frag.id),
        "true",
        `${frag.id} is the player's evidence baseline and must be accurate`
      );
    }
  });

  it("RULE 2: only reconstructions confabulate", () => {
    assert.deepEqual(ch1OnlyReconstructionsLie(), []);
    const liars = CH1_FRAGMENTS.filter(
      (f) => ch1FragmentTruth(f.id) === "false"
    );
    assert.ok(liars.length >= 2, "the chapter needs at least two big lies");
    for (const frag of liars) {
      assert.equal(frag.type, "reconstruction");
    }
  });

  it("RULE 3: confidence is not a truth oracle", () => {
    assert.deepEqual(ch1ConfidenceIsNotTruth(), []);
    // The corridor is the chapter's centrepiece deception and must be one of
    // the most confident things in the ledger.
    assert.equal(ch1FragmentTruth("frag_a3_recon_corridor"), "false");
    const corridor = CH1_FRAGMENTS.find(
      (f) => f.id === "frag_a3_recon_corridor"
    );
    assert.ok((corridor?.confidence ?? 0) >= 85);
    // And the truest thing the player is told is nearly inaudible.
    assert.equal(ch1FragmentTruth("frag_a5_echo_the_name"), "true");
    const theName = CH1_FRAGMENTS.find((f) => f.id === "frag_a5_echo_the_name");
    assert.ok((theName?.confidence ?? 100) <= 25);
  });

  it("RULE 4: revisions only correct things the player got wrong", () => {
    assert.deepEqual(ch1RevisionsOnlyCorrectErrors(), []);
  });

  it("Lou's rescue is PARTIAL, not false — he really did carry them out", () => {
    assert.equal(
      ch1FragmentTruth("frag_a2_overlay_ive_got_you"),
      "partial",
      "if this becomes false, the reveal stops being a re-reading and starts " +
        "being a retcon"
    );
  });

  it("the arrival reconstruction is false even though every source is true", () => {
    assert.equal(ch1FragmentTruth("frag_a2_recon_arrival"), "false");
  });
});

describe("ch1 fragment authority - client projection", () => {
  it("never emits a truth field", () => {
    for (const frag of CH1_FRAGMENTS) {
      const view = ch1ProjectFragmentForClient({
        fragmentId: frag.id,
        revised: false,
        linkingUnlocked: true,
      });
      assert.ok(view);
      assert.ok(
        !("truth" in (view as unknown as Record<string, unknown>)),
        `${frag.id} projection leaked a truth value to the client`
      );
      // Belt and braces: serialize it the way the wire would.
      const wire = JSON.parse(JSON.stringify(view)) as Record<string, unknown>;
      assert.ok(!("truth" in wire));
      for (const value of Object.values(wire)) {
        if (typeof value === "string") {
          assert.ok(
            !/\b(partial|confabulat)/i.test(value) ||
              !/"truth"/.test(value),
            `${frag.id} projection body hints at the truth table`
          );
        }
      }
    }
  });

  it("withholds confidence until linking is unlocked", () => {
    const locked = ch1ProjectFragmentForClient({
      fragmentId: "frag_a3_recon_corridor",
      revised: false,
      linkingUnlocked: false,
    });
    assert.equal(locked?.confidence, undefined);
    const unlocked = ch1ProjectFragmentForClient({
      fragmentId: "frag_a3_recon_corridor",
      revised: false,
      linkingUnlocked: true,
    });
    assert.equal(unlocked?.confidence, 91);
  });

  it("serves revised copy after consolidation", () => {
    const before = ch1ProjectFragmentForClient({
      fragmentId: "frag_a3_recon_corridor",
      revised: false,
      linkingUnlocked: true,
    });
    const after = ch1ProjectFragmentForClient({
      fragmentId: "frag_a3_recon_corridor",
      revised: true,
      linkingUnlocked: true,
    });
    assert.notEqual(before?.body, after?.body);
    assert.equal(after?.confidence, 12);
    assert.equal(after?.revised, true);
  });

  it("returns undefined for unknown fragments", () => {
    assert.equal(
      ch1ProjectFragmentForClient({
        fragmentId: "nope",
        revised: false,
        linkingUnlocked: true,
      }),
      undefined
    );
  });
});
