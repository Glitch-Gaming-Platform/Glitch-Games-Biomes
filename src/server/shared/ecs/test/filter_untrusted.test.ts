import {
  couldAffectPassing,
  emptyFilter,
  passes,
  zEntityFilter,
} from "@/server/shared/ecs/filter";
import { LazyEntity, LazyEntityDelta } from "@/server/shared/ecs/gen/lazy";
import {
  createSignedApplyRequest,
  validateSignedApplyRequest,
} from "@/server/shared/ecs/untrusted";
import type { ChangeToApply } from "@/shared/api/transaction";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";
import sinon from "sinon";

const USER_ID = 401 as BiomesId;

describe("native ECS filters", () => {
  it("validates, recognizes empty filters, and applies any/none component rules", () => {
    assert.deepEqual(
      zEntityFilter.parse({ anyOf: ["label"], noneOf: ["iced"] }),
      { anyOf: ["label"], noneOf: ["iced"] }
    );
    assert.equal(emptyFilter(), true);
    assert.equal(emptyFilter({}), true);
    assert.equal(emptyFilter({ noneOf: [] }), true);
    assert.equal(emptyFilter({ anyOf: [] }), false);

    const entity = LazyEntity.forDecoded({
      id: USER_ID,
      label: { text: "visible" },
    });
    assert.equal(passes(entity, {}), true);
    assert.equal(passes(entity, { anyOf: ["label", "size"] }), true);
    assert.equal(passes(entity, { anyOf: ["size"] }), false);
    assert.equal(passes(entity, { noneOf: ["iced"] }), true);
    assert.equal(passes(entity, { noneOf: ["label"] }), false);
    assert.equal(passes(entity, { anyOf: ["label"], noneOf: ["iced"] }), true);
  });

  it("detects any changed inclusion component in multi-component filters", () => {
    const labelDelta = {
      kind: "update",
      tick: 2,
      entity: LazyEntityDelta.forDecoded({
        id: USER_ID,
        label: { text: "changed" },
      }),
    } as const;
    assert.equal(
      couldAffectPassing(labelDelta, { anyOf: ["label", "size"] }),
      true
    );
    assert.equal(
      couldAffectPassing(labelDelta, { noneOf: ["label", "size"] }),
      true
    );
    assert.equal(
      couldAffectPassing(labelDelta, { noneOf: ["iced", "size"] }),
      false
    );
  });
});

describe("native ECS untrusted signed apply requests", () => {
  function transaction(): ChangeToApply {
    return {
      iffs: [[USER_ID, 7]],
      changes: [
        {
          kind: "update",
          entity: { id: USER_ID, label: { text: "signed" } },
        },
      ],
    };
  }

  it("normalizes optional transaction fields and validates the intended user and payload", () => {
    const request = createSignedApplyRequest(USER_ID, [transaction()]);
    const normalized = request.transactions[0];

    assert.deepEqual(normalized.events, []);
    assert.deepEqual(normalized.catchups, []);
    assert.equal(normalized.changes?.length, 1);
    assert.equal(validateSignedApplyRequest(USER_ID, request), true);
    assert.equal(validateSignedApplyRequest(999 as BiomesId, request), false);
  });

  it("rejects transaction tampering, malformed tokens, and expired signatures", () => {
    const clock = sinon.useFakeTimers({ now: 1_000 });
    try {
      const request = createSignedApplyRequest(USER_ID, [transaction()]);
      request.transactions[0].iffs = [];
      assert.equal(validateSignedApplyRequest(USER_ID, request), false);

      const malformed = createSignedApplyRequest(USER_ID, [transaction()]);
      malformed.token = "not-a-jwt";
      assert.equal(validateSignedApplyRequest(USER_ID, malformed), false);

      const expired = createSignedApplyRequest(USER_ID, [transaction()]);
      clock.setSystemTime(61_001);
      assert.equal(validateSignedApplyRequest(USER_ID, expired), false);
    } finally {
      clock.restore();
    }
  });
});
