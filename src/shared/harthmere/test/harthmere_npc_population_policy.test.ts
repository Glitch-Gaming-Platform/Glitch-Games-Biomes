import assert from "assert";

import {
  HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS,
  isGenericHarthmereTownspersonLabel,
  shouldRetireGenericHarthmereTownsperson,
} from "@/shared/harthmere/harthmere_npc_population_policy";
import type { BiomesId } from "@/shared/ids";
import {
  LOCAL_DEV_HUMAN_NPC_TYPE_ID,
  LOCAL_DEV_WALKER_NPC_TYPE_ID,
} from "@/shared/npc/bikkie";

describe("Harthmere NPC population policy", () => {
  const id = 123 as BiomesId;

  it("recognizes only fallback/generic townsperson labels", () => {
    assert.ok(isGenericHarthmereTownspersonLabel(undefined));
    assert.ok(isGenericHarthmereTownspersonLabel("Local Dev Townsperson"));
    assert.ok(isGenericHarthmereTownspersonLabel("Townsperson"));
    assert.ok(!isGenericHarthmereTownspersonLabel("Mira Vale"));
  });

  it("pins the complete audited production generic crowd without collisions", () => {
    assert.strictEqual(HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS.length, 14);
    assert.strictEqual(
      new Set(HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS).size,
      HARTHMERE_RETIRED_GENERIC_TOWNSPERSON_IDS.length
    );
  });

  it("retires stale generic human and walker rows inside shifted Harthmere", () => {
    for (const typeId of [
      LOCAL_DEV_HUMAN_NPC_TYPE_ID,
      LOCAL_DEV_WALKER_NPC_TYPE_ID,
    ]) {
      assert.ok(
        shouldRetireGenericHarthmereTownsperson(
          {
            id,
            typeId,
            label: "Local Dev Townsperson",
            position: [2148, 53, -205],
          },
          1600,
          0
        )
      );
    }
  });

  it("preserves named, canonical, player, outside-town, and non-human rows", () => {
    const base = {
      id,
      typeId: LOCAL_DEV_HUMAN_NPC_TYPE_ID,
      label: "Local Dev Townsperson",
      position: [2148, 53, -205] as const,
    };
    assert.ok(
      !shouldRetireGenericHarthmereTownsperson(
        { ...base, label: "Harthmere Resident" },
        1600,
        0
      )
    );
    assert.ok(
      !shouldRetireGenericHarthmereTownsperson(
        { ...base, isCanonicalPersistentNpc: true },
        1600,
        0
      )
    );
    assert.ok(
      !shouldRetireGenericHarthmereTownsperson(
        { ...base, isPlayer: true },
        1600,
        0
      )
    );
    assert.ok(
      !shouldRetireGenericHarthmereTownsperson(
        { ...base, position: [1700, 53, -205] },
        1600,
        0
      )
    );
    assert.ok(
      !shouldRetireGenericHarthmereTownsperson(
        { ...base, typeId: 999 as BiomesId },
        1600,
        0
      )
    );
  });
});
