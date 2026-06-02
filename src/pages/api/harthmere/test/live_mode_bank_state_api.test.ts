import assert from "assert";
import { readHarthmereLiveModeBankStateForActorV1 } from "../live_mode_bank_state";
import {
  defaultHarthmereLiveModeBackendStateV1,
  harthmereLiveModePlayerStateKeyV1,
  parseHarthmereLiveModeBackendStateV1,
} from "@/shared/harthmere/live_mode_backend_v1";

const ACTOR = "player_api_bank_001";
const NOW_MS = 1_700_700_000_000;

describe("live_mode_bank_state API route integration", () => {
  it("persists loan consequences with WATCH so reads do not overwrite newer actor state", async () => {
    const staleState = defaultHarthmereLiveModeBackendStateV1(
      ACTOR,
      NOW_MS - 2 * 24 * 60 * 60 * 1000
    );
    staleState.inventory.gold = 1;
    staleState.banking.loans.loan_1 = {
      loanId: "loan_1",
      principalGold: 100,
      principalRemaining: 100,
      interestRateDaily: 0,
      issuedAtMs: NOW_MS - 2 * 24 * 60 * 60 * 1000,
      dueAtMs: NOW_MS - 1_000,
      status: "active",
      payments: [],
    } as any;

    const latestState = defaultHarthmereLiveModeBackendStateV1(
      ACTOR,
      NOW_MS - 2 * 24 * 60 * 60 * 1000
    );
    latestState.inventory.gold = 99;
    latestState.banking.loans.loan_1 = {
      ...staleState.banking.loans.loan_1,
    };

    const stateKey = harthmereLiveModePlayerStateKeyV1(ACTOR);
    const watched: string[][] = [];
    const reads = [JSON.stringify(staleState), JSON.stringify(latestState)];
    let stored = "";
    const redis = {
      primary: {
        get: async () => reads.shift() ?? stored,
        set: async (_key: string, value: string) => {
          stored = value;
        },
        watch: async (...keys: string[]) => {
          watched.push(keys);
        },
        unwatch: async () => {},
        multi: () => ({
          set: (_key: string, value: string) => {
            stored = value;
          },
          exec: async () => [],
        }),
      },
    };

    await readHarthmereLiveModeBankStateForActorV1({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    const persisted = parseHarthmereLiveModeBackendStateV1(
      stored,
      ACTOR,
      NOW_MS
    );
    assert.deepEqual(watched, [[stateKey]]);
    assert.equal(persisted.inventory.gold, 99);
    assert.equal(persisted.banking.loans.loan_1.status, "defaulted");
    assert.equal(persisted.law.flags.bank_credit_hold, true);
  });
});
