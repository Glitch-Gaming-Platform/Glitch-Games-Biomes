import assert from "assert";
import { readHarthmereLiveModeBankStateForActor } from "../live_mode_bank_state";
import { defaultHarthmereLiveModeBackendState } from "@/shared/harthmere/live_mode_backend";

const ACTOR = "player_api_bank_001";
const NOW_MS = 1_700_700_000_000;

describe("live_mode_bank_state API route integration", () => {
  it("projects loan consequences on read without writing backend state", async () => {
    const backend = defaultHarthmereLiveModeBackendState(
      ACTOR,
      NOW_MS - 2 * 24 * 60 * 60 * 1000
    );
    backend.inventory.gold = 1;
    backend.banking.loans.loan_1 = {
      loanId: "loan_1",
      principalGold: 100,
      principalRemaining: 100,
      interestRateDaily: 0,
      issuedAtMs: NOW_MS - 2 * 24 * 60 * 60 * 1000,
      dueAtMs: NOW_MS - 1_000,
      status: "active",
      payments: [],
    } as any;

    const stored = JSON.stringify(backend);
    const writes: string[] = [];
    const redis = {
      primary: {
        get: async () => stored,
        set: async (_key: string, value: string) => {
          writes.push(value);
        },
      },
    };

    const snapshot = await readHarthmereLiveModeBankStateForActor({
      redis,
      actorId: ACTOR,
      nowMs: NOW_MS,
    });

    assert.equal(writes.length, 0);
    assert.equal(
      (snapshot as any).loans.find((loan: any) => loan.loanId === "loan_1")
        ?.status,
      "defaulted"
    );
    assert.equal(JSON.parse(stored).banking.loans.loan_1.status, "active");
  });
});
