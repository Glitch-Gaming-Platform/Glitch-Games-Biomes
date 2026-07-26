/// <reference types="mocha" />
/// <reference types="node" />
//
// Tests for the two systems the full-chapter audit found missing:
//   * AUGUR-9's core charge state machine (existed only as constants)
//   * MMO party support for dungeons (left open in journal §13.3 #2)
// Plus the Hallr-choice recording gap.

import assert from "assert";
import {
  CH1_AUGUR9_INITIAL_CHARGE,
  ch1Augur9Alive,
  ch1Augur9EnvironmentalDrain,
  ch1Augur9Initial,
  ch1Augur9LostLogs,
  ch1Augur9ObtainableRecharge,
  ch1Augur9PlayLog,
  ch1Augur9Recharge,
  ch1Augur9WorstCaseLogCost,
} from "../ch1_augur9";
import {
  CH1_SOLO_BEATS,
  ch1BeatIsSolo,
  ch1PartyEnterGate,
  ch1PartyExitGate,
  ch1PartyMemberDowned,
  ch1PartyMemberLeaves,
  ch1PartyMemberRevived,
  ch1PartyWiped,
  type Ch1PartyMember,
} from "../ch1_party";
import {
  ch1HallrChoiceMade,
  ch1InitialPlayerState,
  ch1RecordHallrChoice,
} from "../ch1_chapter";
import { CH1_FLAGS } from "../ch1_ids";
import { CH1_PROVISIONING } from "../ch1_fracture_gates";
import { CH1_FRAGMENTS } from "../ch1_fragment_ledger";
import { CH1_SCENE_FACTORIES } from "@/shared/cutscene/ch1_scenes";

// ---------------------------------------------------------------------------

describe("ch1 AUGUR-9 - the cost of remembering", () => {
  it("charges for a first playback and never for a replay", () => {
    const first = ch1Augur9PlayLog(
      ch1Augur9Initial(),
      "frag_a1_play_run_it_again"
    );
    assert.ok(first.ok);
    if (first.ok) {
      assert.equal(first.chargeSpent, 6);
      assert.equal(first.state.charge, CH1_AUGUR9_INITIAL_CHARGE - 6);
      const replay = ch1Augur9PlayLog(first.state, "frag_a1_play_run_it_again");
      assert.ok(replay.ok);
      if (replay.ok) {
        assert.equal(replay.chargeSpent, 0, "replays are free — the recording is already in the ledger");
        assert.equal(replay.state.charge, first.state.charge);
      }
    }
  });

  it("refuses to play a reconstruction — only logs live in the robot", () => {
    const result = ch1Augur9PlayLog(ch1Augur9Initial(), "frag_a3_recon_corridor");
    assert.equal(result.ok, false);
  });

  it("plays the final log in full, then shuts down", () => {
    // Drain to exactly one log's worth. He finishes the sentence. Then stops.
    let state = { ...ch1Augur9Initial(), charge: 6 };
    const last = ch1Augur9PlayLog(state, "frag_a2_play_the_ninth_signature");
    assert.ok(last.ok);
    if (last.ok) {
      assert.equal(last.state.charge, 0);
      assert.equal(last.state.shutDown, true);
      assert.equal(ch1Augur9Alive(last.state), false);
    }
  });

  it("refuses a log it cannot afford rather than dying mid-playback", () => {
    const state = { ...ch1Augur9Initial(), charge: 3 };
    const result = ch1Augur9PlayLog(state, "frag_a4_play_twenty_two");
    assert.equal(result.ok, false);
    assert.equal(state.charge, 3, "a refused log costs nothing");
  });

  it("loses the unplayed logs when he shuts down", () => {
    let state = ch1Augur9Initial();
    const played = ch1Augur9PlayLog(state, "frag_a1_play_run_it_again");
    assert.ok(played.ok);
    if (played.ok) {
      const dead = { ...played.state, charge: 0, shutDown: true };
      const lost = ch1Augur9LostLogs(dead);
      assert.ok(lost.length > 0, "shutdown must cost something");
      assert.ok(!lost.includes("frag_a1_play_run_it_again"), "played logs are kept");
      assert.ok(lost.includes("frag_a4_play_twenty_two"));
    }
  });

  it("drains 3x in the desert heat and half-speed in the cold", () => {
    const start = ch1Augur9Initial();
    const grove = ch1Augur9EnvironmentalDrain(start, { hours: 4, environment: "grove" });
    const desert = ch1Augur9EnvironmentalDrain(start, { hours: 4, environment: "desert" });
    const winter = ch1Augur9EnvironmentalDrain(start, { hours: 4, environment: "winter" });
    assert.ok(desert.charge < grove.charge, "heat is punishing");
    assert.ok(winter.charge > grove.charge, "cold is the fjord's one mercy");
    assert.equal(start.charge - desert.charge, (start.charge - grove.charge) * 3);
  });

  it("recharges from a cell and from the Bull's core, capped at max", () => {
    const low = { ...ch1Augur9Initial(), charge: 4, shutDown: false };
    const cell = ch1Augur9Recharge(low, "item_augur9_core_cell");
    assert.equal(cell.charge, 22);
    const bull = ch1Augur9Recharge(cell, "item_bulls_core");
    assert.equal(bull.charge, 70);
    const over = ch1Augur9Recharge({ ...bull, charge: 95 }, "item_bulls_core");
    assert.equal(over.charge, 100, "capped");
    assert.throws(() => ch1Augur9Recharge(low, "item_grey_card"));
  });

  it("makes full completion possible: recharges cover the worst case", () => {
    // A completionist must be able to play EVERY log. If authored costs ever
    // exceed initial charge + obtainable recharges, the chapter has an
    // impossible wall and this fails at author time, not in a player report.
    const worstCase = ch1Augur9WorstCaseLogCost();
    const available = CH1_AUGUR9_INITIAL_CHARGE + ch1Augur9ObtainableRecharge();
    assert.ok(
      worstCase <= available,
      `logs cost ${worstCase} but only ${available} charge is obtainable`
    );
    // And the tension must be real: the desert's 3x drain has to be able to
    // threaten a shutdown, so the margin should not be enormous.
    assert.ok(
      available - worstCase < 100,
      "the charge economy has no tension left"
    );
  });
});

// ---------------------------------------------------------------------------

function provisionedMember(
  playerId: string,
  gateIndex: 0 | 1,
  flags: string[]
): Ch1PartyMember {
  const carried: Record<string, number> = {};
  for (const r of CH1_PROVISIONING[gateIndex].requirements) {
    carried[r.key] = r.quantity;
  }
  return { playerId, flags, carried };
}

const DESERT_READY = [CH1_FLAGS.started, CH1_FLAGS.act2Complete];

describe("ch1 party - MMO dungeon runs", () => {
  it("admits a full, provisioned, story-ready party of four", () => {
    const members = ["a", "b", "c", "d"].map((id) =>
      provisionedMember(id, 0, DESERT_READY)
    );
    const result = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members,
      leaderId: "a",
      activeRunsByPlayer: {},
      nowMs: 1000,
      runId: "run-1",
    });
    assert.ok(result.ok, JSON.stringify(result));
    if (result.ok) {
      assert.equal(result.run.memberIds.length, 4);
      assert.equal(result.run.leaderId, "a");
    }
  });

  it("names EVERY blocker, not the first", () => {
    const members = [
      provisionedMember("ready", 0, DESERT_READY),
      { playerId: "unready", flags: [CH1_FLAGS.started], carried: {} },
      { ...provisionedMember("busy", 0, DESERT_READY), playerId: "busy" },
    ];
    const result = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members,
      leaderId: "ready",
      activeRunsByPlayer: { busy: "ch1_dungeon_winter" },
      nowMs: 0,
      runId: "run-2",
    });
    assert.equal(result.ok, false);
    if (!result.ok) {
      const blocked = new Set(result.blockers.map((b) => b.playerId));
      assert.ok(blocked.has("unready"), "story-gating must protect the friend being carried");
      assert.ok(blocked.has("busy"));
      assert.ok(!blocked.has("ready"));
      // The unready member is blocked for story AND provisioning.
      assert.ok(
        result.blockers.filter((b) => b.playerId === "unready").length >= 2
      );
    }
  });

  it("refuses to double-book the slot — the terrain has one Iris", () => {
    const members = [provisionedMember("a", 0, DESERT_READY)];
    const result = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members,
      leaderId: "a",
      activeRunsByPlayer: {},
      slotOccupiedByRunId: "someone-elses-run",
      nowMs: 0,
      runId: "run-3",
    });
    assert.equal(result.ok, false);
  });

  it("refuses a party of five and a leaderless party", () => {
    const five = ["a", "b", "c", "d", "e"].map((id) =>
      provisionedMember(id, 0, DESERT_READY)
    );
    assert.equal(
      ch1PartyEnterGate({
        gateId: "ch1_gate_desert",
        members: five,
        leaderId: "a",
        activeRunsByPlayer: {},
        nowMs: 0,
        runId: "r",
      }).ok,
      false
    );
    assert.equal(
      ch1PartyEnterGate({
        gateId: "ch1_gate_desert",
        members: [provisionedMember("a", 0, DESERT_READY)],
        leaderId: "not-here",
        activeRunsByPlayer: {},
        nowMs: 0,
        runId: "r",
      }).ok,
      false
    );
  });

  it("handles death without breaking the one-way rule", () => {
    const entry = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members: ["a", "b"].map((id) => provisionedMember(id, 0, DESERT_READY)),
      leaderId: "a",
      activeRunsByPlayer: {},
      nowMs: 0,
      runId: "run-4",
    });
    assert.ok(entry.ok);
    if (!entry.ok) return;

    let run = ch1PartyMemberDowned(entry.run, "a");
    assert.deepEqual(run.downedIds, ["a"]);
    assert.equal(ch1PartyWiped(run), false);
    run = ch1PartyMemberDowned(run, "a"); // idempotent
    assert.deepEqual(run.downedIds, ["a"]);

    run = ch1PartyMemberDowned(run, "b");
    assert.equal(ch1PartyWiped(run), true, "both down is a wipe");

    run = ch1PartyMemberRevived(run, "a");
    assert.equal(ch1PartyWiped(run), false);
    assert.throws(() => ch1PartyMemberDowned(run, "stranger"));
  });

  it("survives disconnects and transfers leadership; last one out ends the run", () => {
    const entry = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members: ["a", "b"].map((id) => provisionedMember(id, 0, DESERT_READY)),
      leaderId: "a",
      activeRunsByPlayer: {},
      nowMs: 0,
      runId: "run-5",
    });
    assert.ok(entry.ok);
    if (!entry.ok) return;

    const afterLeader = ch1PartyMemberLeaves(entry.run, "a");
    assert.equal(afterLeader.kind, "run_continues");
    if (afterLeader.kind === "run_continues") {
      assert.equal(afterLeader.newLeaderId, "b", "leadership transfers");
      const last = ch1PartyMemberLeaves(afterLeader.run, "b");
      assert.equal(last.kind, "run_ends");
      if (last.kind === "run_ends") {
        assert.deepEqual(
          last.evictedIds,
          ["b"],
          "the server must evict lingering bodies — nobody squats the past"
        );
      }
    }
  });

  it("gives story credit only to members whose own story earned it", () => {
    const entry = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members: ["a", "b"].map((id) => provisionedMember(id, 0, DESERT_READY)),
      leaderId: "a",
      activeRunsByPlayer: {},
      nowMs: 0,
      runId: "run-6",
    });
    assert.ok(entry.ok);
    if (!entry.ok) return;

    const outcome = ch1PartyExitGate({
      run: entry.run,
      members: [
        provisionedMember("a", 0, DESERT_READY),
        // b somehow lost story eligibility (admin rollback, future bug):
        { playerId: "b", flags: [CH1_FLAGS.started], carried: {} },
      ],
      carriedOut: ["item_first_grain", "npc_iris_fen"],
    });
    assert.ok(outcome.ok);
    assert.ok(outcome.memberFlags["a"].includes(CH1_FLAGS.irisRescued));
    assert.deepEqual(
      outcome.memberFlags["b"],
      [],
      "no story credit without the story"
    );
  });

  it("still refuses to leave without the retrievals, even as a party", () => {
    const entry = ch1PartyEnterGate({
      gateId: "ch1_gate_desert",
      members: [provisionedMember("a", 0, DESERT_READY)],
      leaderId: "a",
      activeRunsByPlayer: {},
      nowMs: 0,
      runId: "run-7",
    });
    assert.ok(entry.ok);
    if (!entry.ok) return;
    const outcome = ch1PartyExitGate({
      run: entry.run,
      members: [provisionedMember("a", 0, DESERT_READY)],
      carriedOut: ["item_first_grain"],
    });
    assert.equal(outcome.ok, false);
  });

  it("declares the story-critical solo beats, and they all exist", () => {
    assert.ok(CH1_SOLO_BEATS.length >= 4);
    for (const beat of CH1_SOLO_BEATS) {
      assert.ok(
        CH1_SCENE_FACTORIES.has(beat),
        `solo beat "${beat}" is not a registered cutscene`
      );
    }
    assert.equal(ch1BeatIsSolo("ch1-sorrel-door"), true);
    assert.equal(ch1BeatIsSolo("ch1-first-gate"), false);
  });

  it("supports winter parties too", () => {
    const ready = [CH1_FLAGS.started, CH1_FLAGS.act4Complete];
    const result = ch1PartyEnterGate({
      gateId: "ch1_gate_winter",
      members: ["a", "b", "c"].map((id) => provisionedMember(id, 1, ready)),
      leaderId: "c",
      activeRunsByPlayer: {},
      nowMs: 0,
      runId: "run-8",
    });
    assert.ok(result.ok, JSON.stringify(result));
  });
});

// ---------------------------------------------------------------------------

describe("ch1 Hallr choice - recorded for Chapter 2", () => {
  it("records exactly one choice and refuses to overwrite it", () => {
    let state = ch1InitialPlayerState();
    assert.equal(ch1HallrChoiceMade(state), undefined);
    state = ch1RecordHallrChoice(state, "let_run");
    assert.equal(ch1HallrChoiceMade(state), "let_run");
    // Neither option is revocable. The year ran. It does not un-run.
    state = ch1RecordHallrChoice(state, "hold_stall");
    assert.equal(ch1HallrChoiceMade(state), "let_run");
    assert.throws(() =>
      ch1RecordHallrChoice(ch1InitialPlayerState(), "mercy" as never)
    );
  });
});

// ---------------------------------------------------------------------------

describe("ch1 audit - playback fragments all belong to AUGUR-9's economy", () => {
  it("every playback has an explicit, affordable charge cost", () => {
    for (const frag of CH1_FRAGMENTS.filter((f) => f.type === "playback")) {
      assert.ok(
        (frag.chargeCost ?? 0) > 0,
        `${frag.id}: playbacks must cost core charge — remembering is not free`
      );
    }
    for (const frag of CH1_FRAGMENTS.filter((f) => f.type !== "playback")) {
      assert.equal(
        frag.chargeCost,
        undefined,
        `${frag.id}: only AUGUR-9 logs draw on the core`
      );
    }
  });
});
