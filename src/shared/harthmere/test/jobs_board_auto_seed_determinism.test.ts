/// <reference types="mocha" />
/// <reference types="node" />
//
// HARTHMERE_JOBS_BOARD_SEED_DETERMINISM
//
// A job id must denote the SAME job everywhere it is observed.
//
// This is not an abstract property. `live_mode_jobs_board_state.ts` runs the
// auto-seed reducer on every GET and returns the result WITHOUT persisting it,
// which is correct — the ECS source-of-truth rule forbids a GET from writing.
// Job ids, however, come from the durable `nextJobNumber` counter. So if the
// template draw depends on anything the read does not share with the write, the
// same id names a different job each time it is produced:
//
//   read at T      harthmere_auto_1 = Bounty: Elite Mucker, 1959g
//   read at T+3.5s harthmere_auto_1 = Run the Coop Food Parcel, 51g
//
// `acceptJobPosting` binds by job id alone, and the accept-time repair in
// `live_mode_backend.ts` re-seeds with the WRITER's clock when the requested id
// is not durable yet — so the player clicked one job and got another. In one
// direction that is a disappointment; in the other it is a gold exploit.
//
// WHY THE EXISTING SUITE DID NOT COVER THIS. Every other jobs-board test seeds
// and asserts inside a single reducer call with a single `nowMs`, and the
// browser E2E installs exact fixtures into an isolated Redis world. Neither
// crosses the read -> accept boundary with two clocks, which is the only place
// the bug is visible. These cases exist to cross it.

import assert from "assert";
import {
  HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
  HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
  defaultHarthmereJobsBoardState,
  reduceHarthmereJobsBoardMutation,
  type HarthmereJobsBoardState,
} from "../mmo_jobs_board_authority";

const T0 = 1_700_000_000_000;

interface SeededJob {
  jobId: string;
  templateId?: string;
  rewardGold: number;
  kind: string;
  targetId?: string;
  mapMarkerId?: string;
}

function seedBoard(input: {
  nowMs: number;
  boardId?: string;
  state?: HarthmereJobsBoardState;
}): { state: HarthmereJobsBoardState; jobs: SeededJob[] } {
  const boardId = input.boardId ?? HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID;
  const result = reduceHarthmereJobsBoardMutation(
    input.state ?? defaultHarthmereJobsBoardState(input.nowMs),
    {
      requestId: `auto_seed_determinism:${input.nowMs}`,
      actorId: "determinism-actor",
      nowMs: input.nowMs,
      operation: "economy_auto_seed_jobs",
      boardId,
    } as never,
    {
      actorGold: 0,
      actorInventoryItems: {},
      actorGuildId: undefined,
    } as never
  );
  return {
    state: result.jobsBoard,
    jobs: Object.values(result.jobsBoard.postings)
      .filter((job) => job.boardId === boardId)
      .map((job) => ({
        jobId: job.jobId,
        templateId: job.templateId,
        rewardGold: job.rewardGold,
        kind: job.kind,
        targetId: job.targetId,
        mapMarkerId: job.mapMarkerId,
      }))
      .sort((a, b) => a.jobId.localeCompare(b.jobId)),
  };
}

/** The identity a player is shown and then accepts by id. */
function identity(job: SeededJob) {
  return [
    job.jobId,
    job.templateId ?? "",
    String(job.rewardGold),
    job.kind,
    job.targetId ?? "",
    job.mapMarkerId ?? "",
  ].join("|");
}

describe("Jobs Board auto-seed is a function of durable state, not the clock", () => {
  it("produces byte-identical jobs one poll apart", () => {
    // 3.5 seconds is roughly one client poll of the state endpoint. This is the
    // exact interval that used to swap a 1959g bounty for a 51g delivery.
    const first = seedBoard({ nowMs: T0 });
    const second = seedBoard({ nowMs: T0 + 3_500 });
    assert.deepEqual(
      second.jobs.map(identity),
      first.jobs.map(identity),
      "the same board seeded one poll apart produced different jobs — a job id " +
        "no longer denotes one job, so accept-by-id binds the wrong posting"
    );
  });

  it("produces byte-identical jobs across widely separated reads", () => {
    // Guards the whole class rather than one interval: an hour, a day, and a
    // week must all agree. A per-second bucket passes the 3.5s case above and
    // fails here, which is how the previous rotation helper behaved.
    const baseline = seedBoard({ nowMs: T0 }).jobs.map(identity);
    for (const offset of [
      60_000,
      60 * 60_000,
      4 * 60 * 60_000,
      24 * 60 * 60_000,
      7 * 24 * 60 * 60_000,
    ]) {
      assert.deepEqual(
        seedBoard({ nowMs: T0 + offset }).jobs.map(identity),
        baseline,
        `seeding ${offset}ms later produced different jobs`
      );
    }
  });

  it("agrees between an unpersisted read projection and the durable write", () => {
    // This is the real failure shape. The GET seeds a projection and throws it
    // away; the player accepts; the writer finds the id missing and re-seeds
    // from the SAME durable state but its own clock. Both must land on the
    // same posting for accept-by-id to be sound.
    const durable = defaultHarthmereJobsBoardState(T0);
    const projection = seedBoard({ nowMs: T0, state: durable });

    const writer = seedBoard({
      nowMs: T0 + 12_000,
      state: defaultHarthmereJobsBoardState(T0),
    });

    for (const shown of projection.jobs) {
      const materialized = writer.jobs.find(
        (job) => job.jobId === shown.jobId
      );
      assert(
        materialized,
        `${shown.jobId} was shown to the player but the writer never issued it`
      );
      assert.equal(
        identity(materialized),
        identity(shown),
        `${shown.jobId} was shown as ${shown.templateId} for ${shown.rewardGold}g ` +
          `but the writer materialized ${materialized.templateId} for ` +
          `${materialized.rewardGold}g`
      );
    }
  });

  it("still varies once the durable counter advances", () => {
    // Determinism must not become "the board is frozen forever". The seed basis
    // is the job number about to be issued, so a batch that actually persists
    // moves the counter and the next batch draws differently.
    const first = seedBoard({ nowMs: T0 });
    const drained = JSON.parse(
      JSON.stringify(first.state)
    ) as HarthmereJobsBoardState;
    for (const jobId of Object.keys(drained.postings)) {
      delete drained.postings[jobId];
    }
    drained.issuerOpenJobIds = {};

    const second = seedBoard({ nowMs: T0 + 60_000, state: drained });
    assert(second.jobs.length > 0, "the second batch seeded nothing");
    assert.notDeepEqual(
      second.jobs.map((job) => job.jobId),
      first.jobs.map((job) => job.jobId),
      "the counter did not advance — job ids repeated across batches"
    );
    assert.notDeepEqual(
      second.jobs.map((job) => `${job.templateId}|${job.rewardGold}`),
      first.jobs.map((job) => `${job.templateId}|${job.rewardGold}`),
      "the board is frozen: advancing the counter produced an identical batch"
    );
  });

  it("keeps the two physical boards drawing independently", () => {
    // The board id must stay in the seed. Without it both boards surface the
    // same Mucker hunt slot, which is what the board-id mix was added for.
    const grove = seedBoard({
      nowMs: T0,
      boardId: HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID,
    });
    const town = seedBoard({
      nowMs: T0,
      boardId: HARTHMERE_JOBS_BOARD_HARTHMERE_BOARD_ID,
    });
    if (grove.jobs.length && town.jobs.length) {
      assert.notDeepEqual(
        town.jobs.map((job) => job.templateId),
        grove.jobs.map((job) => job.templateId),
        "both boards drew the same templates on the same tick"
      );
    }
  });
});
