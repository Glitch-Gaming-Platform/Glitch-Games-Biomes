/// <reference types="mocha" />
/// <reference types="node" />
//
// BIBLE_QUEST_GATE_MATRIX
//
// The gate is the whole of what native `Challenges` cannot express, so every
// branch gets a test — including the repeatable cadence, which the retired
// runtime authored on 21 quests and enforced on none.

import assert from "assert";
import {
  BIBLE_QUEST_CATALOG,
  bibleQuest,
  bibleQuestsByCategory,
} from "../bible/bible_quest_catalog";
import {
  bibleCadenceOnCooldown,
  bibleDailyPeriod,
  bibleQuestGate,
  bibleQuestGateReasons,
  bibleWeeklyPeriod,
  type BibleGateContext,
} from "../bible/bible_quest_gate";
import type { BibleQuestDef } from "../bible/bible_quest_schema";

const MONDAY_NOON_UTC = Date.UTC(2026, 6, 27, 12, 0, 0);

function context(overrides: Partial<BibleGateContext> = {}): BibleGateContext {
  return {
    // Deliberately low: the soft maximum is `levelBand.max + 10`, so a blanket
    // high level would fail most quests for a reason the test is not about.
    playerLevel: 1,
    hour: 12,
    timeOfDay: "day",
    weather: "clear",
    completedQuestIds: new Set<string>(),
    flags: new Set<string>(),
    lastCompletedAtMs: {},
    nowMs: MONDAY_NOON_UTC,
    ...overrides,
  };
}

const Q1 = bibleQuest("bellbound_q01_cracks_in_bridge") as BibleQuestDef;
const Q2 = bibleQuest("bellbound_q02_whispers_at_well") as BibleQuestDef;

describe("Bible quest gate — level band", () => {
  it("blocks a player below the minimum", () => {
    const result = bibleQuestGate(Q1, context({ playerLevel: 1 }));
    assert.equal(result.ok, false);
    assert(
      bibleQuestGateReasons(result).includes("player_level_below_minimum")
    );
  });

  it("allows a player inside the band", () => {
    assert.equal(bibleQuestGate(Q1, context({ playerLevel: 7 })).ok, true);
  });

  it("allows the ten-level soft-maximum headroom, then blocks past it", () => {
    const max = Q1.gate.levelBand.max;
    assert.equal(
      bibleQuestGate(Q1, context({ playerLevel: max + 10 })).ok,
      true
    );
    const over = bibleQuestGate(Q1, context({ playerLevel: max + 11 }));
    assert.equal(over.ok, false);
    assert(
      bibleQuestGateReasons(over).includes("player_far_above_soft_maximum")
    );
  });
});

describe("Bible quest gate — prerequisites", () => {
  it("blocks a gated quest until its prerequisite is complete", () => {
    const blocked = bibleQuestGate(Q2, context());
    assert.equal(blocked.ok, false);
    const failure = blocked.failures.find(
      (item) => item.reason === "missing_prerequisite"
    );
    assert.equal(failure?.detail, "bellbound_q01_cracks_in_bridge");
  });

  it("opens once the prerequisite is complete", () => {
    const open = bibleQuestGate(
      Q2,
      context({
        playerLevel: Q2.gate.levelBand.min,
        completedQuestIds: new Set(["bellbound_q01_cracks_in_bridge"]),
      })
    );
    assert.deepEqual(open.failures, []);
  });

  it("does not gate a quest with no prerequisite", () => {
    assert.equal(
      bibleQuestGate(Q1, context({ playerLevel: Q1.gate.levelBand.min })).ok,
      true
    );
  });
});

describe("Bible quest gate — time, hour, weather", () => {
  const timeGated = BIBLE_QUEST_CATALOG.filter(
    (quest) => quest.gate.timeOfDay.length > 0
  );
  const weatherGated = BIBLE_QUEST_CATALOG.filter(
    (quest) => quest.gate.weather.length > 0
  );

  it("has the measured number of genuinely gated quests", () => {
    // The converter collapses a complete authored set to [] ("any"), so a
    // non-empty list means a real gate. 9 time-gated, minus the 3 rows whose
    // inert "fog" token was the only extra value, leaves 9 real time gates.
    assert.equal(timeGated.length, 9);
    assert.equal(weatherGated.length, 2);
  });

  it("blocks the wrong time of day and allows a listed one", () => {
    for (const quest of timeGated) {
      const allowed = quest.gate.timeOfDay[0];
      const forbidden = (["dawn", "day", "dusk", "night"] as const).find(
        (value) => !quest.gate.timeOfDay.includes(value)
      );
      assert(forbidden, `${quest.id} lists every time of day`);
      assert.equal(
        bibleQuestGate(
          quest,
          context({
            playerLevel: quest.gate.levelBand.min,
            timeOfDay: allowed,
            hour: quest.gate.activeHours[0] ?? 12,
            weather: quest.gate.weather[0] ?? "clear",
            completedQuestIds: prerequisiteSet(quest),
          })
        ).ok,
        true,
        `${quest.id} rejected its own allowed time`
      );
      const blocked = bibleQuestGate(
        quest,
        context({
          playerLevel: quest.gate.levelBand.min,
          timeOfDay: forbidden,
          completedQuestIds: prerequisiteSet(quest),
        })
      );
      assert(
        bibleQuestGateReasons(blocked).includes("wrong_time_of_day"),
        quest.id
      );
    }
  });

  // No AUTHORED quest currently restricts hours — every row lists all 24, so
  // the converter collapses them to "any". The gate implements hour matching
  // anyway, and the flooring branch is exactly where the old implementation
  // had a bug (an unfloored 12.5 matched no integer hour and locked out every
  // hour-gated quest). Testing it needs a synthetic quest; testing the GATE is
  // the point, and asserting "no authored quest has hours" separately keeps
  // the data claim honest.
  it("has no hour-restricted quest in the authored catalog", () => {
    assert.equal(
      BIBLE_QUEST_CATALOG.filter((quest) => quest.gate.activeHours.length > 0)
        .length,
      0
    );
  });

  it("floors a fractional game clock before matching an hour", () => {
    const nightWatch: BibleQuestDef = {
      ...Q1,
      gate: { ...Q1.gate, activeHours: [22, 23, 0, 1] },
    };
    const inWindow = bibleQuestGate(
      nightWatch,
      context({ playerLevel: Q1.gate.levelBand.min, hour: 22.5 })
    );
    assert(
      !bibleQuestGateReasons(inWindow).includes("wrong_hour"),
      "a game clock of 22.5 must match hour 22"
    );
    const outOfWindow = bibleQuestGate(
      nightWatch,
      context({ playerLevel: Q1.gate.levelBand.min, hour: 12.5 })
    );
    assert(bibleQuestGateReasons(outOfWindow).includes("wrong_hour"));
  });

  it("ignores time and weather entirely for ungated quests", () => {
    assert.equal(Q1.gate.timeOfDay.length, 0);
    assert.equal(Q1.gate.weather.length, 0);
    for (const timeOfDay of ["dawn", "day", "dusk", "night"] as const) {
      for (const weather of [
        "clear",
        "rain",
        "storm",
        "fog",
        "snow",
      ] as const) {
        assert.equal(
          bibleQuestGate(
            Q1,
            context({
              playerLevel: Q1.gate.levelBand.min,
              timeOfDay,
              weather,
            })
          ).ok,
          true
        );
      }
    }
  });
});

describe("Bible quest gate — completion and cadence", () => {
  it("blocks re-accepting a once-only quest", () => {
    const result = bibleQuestGate(
      Q1,
      context({ completedQuestIds: new Set([Q1.id]) })
    );
    assert.equal(result.ok, false);
    assert(bibleQuestGateReasons(result).includes("already_completed_once"));
  });

  it("does not block a repeatable with already_completed_once", () => {
    const daily = bibleQuestsByCategory("repeatable").find(
      (quest) => quest.repeatability === "daily"
    ) as BibleQuestDef;
    const result = bibleQuestGate(
      daily,
      context({
        playerLevel: daily.gate.levelBand.min,
        completedQuestIds: new Set([daily.id]),
        timeOfDay: daily.gate.timeOfDay[0] ?? "day",
        hour: daily.gate.activeHours[0] ?? 12,
        weather: daily.gate.weather[0] ?? "clear",
      })
    );
    assert(!bibleQuestGateReasons(result).includes("already_completed_once"));
  });

  // THE BUG THIS MIGRATION FIXES.
  //
  // 21 quests are authored daily/weekly and the cadence was enforced nowhere:
  // `acceptHarthmereQuest` only blocked re-accept for `once`, and
  // `completeHarthmereQuest` keys the grant id per cycle so repeatables
  // re-grant. A player could farm any daily unbounded times per day.
  it("blocks a daily already completed in the same UTC day", () => {
    const daily = bibleQuestsByCategory("repeatable").find(
      (quest) => quest.repeatability === "daily"
    ) as BibleQuestDef;
    const result = bibleQuestGate(
      daily,
      context({
        playerLevel: daily.gate.levelBand.min,
        timeOfDay: daily.gate.timeOfDay[0] ?? "day",
        hour: daily.gate.activeHours[0] ?? 12,
        weather: daily.gate.weather[0] ?? "clear",
        lastCompletedAtMs: { [daily.id]: MONDAY_NOON_UTC - 3_600_000 },
      })
    );
    assert(
      bibleQuestGateReasons(result).includes("cadence_cooldown"),
      "a daily completed an hour ago must not be re-acceptable"
    );
  });

  it("releases a daily after the UTC day boundary", () => {
    const daily = bibleQuestsByCategory("repeatable").find(
      (quest) => quest.repeatability === "daily"
    ) as BibleQuestDef;
    const result = bibleQuestGate(
      daily,
      context({
        playerLevel: daily.gate.levelBand.min,
        timeOfDay: daily.gate.timeOfDay[0] ?? "day",
        hour: daily.gate.activeHours[0] ?? 12,
        weather: daily.gate.weather[0] ?? "clear",
        lastCompletedAtMs: { [daily.id]: MONDAY_NOON_UTC - 86_400_000 },
      })
    );
    assert(!bibleQuestGateReasons(result).includes("cadence_cooldown"));
  });

  it("uses Monday-aligned weeks for weeklies", () => {
    const weekly = bibleQuestsByCategory("repeatable").find(
      (quest) => quest.repeatability === "weekly"
    ) as BibleQuestDef;
    // Sunday is the SAME week as the preceding Monday; the next Monday is not.
    const sunday = MONDAY_NOON_UTC + 6 * 86_400_000;
    const nextMonday = MONDAY_NOON_UTC + 7 * 86_400_000;
    assert.equal(bibleWeeklyPeriod(MONDAY_NOON_UTC), bibleWeeklyPeriod(sunday));
    assert.notEqual(
      bibleWeeklyPeriod(MONDAY_NOON_UTC),
      bibleWeeklyPeriod(nextMonday)
    );
    assert.equal(
      bibleCadenceOnCooldown(weekly, MONDAY_NOON_UTC, sunday),
      true,
      "same week must stay on cooldown"
    );
    assert.equal(
      bibleCadenceOnCooldown(weekly, MONDAY_NOON_UTC, nextMonday),
      false,
      "the next Monday must release it"
    );
  });

  it("treats a never-completed repeatable as available", () => {
    const daily = bibleQuestsByCategory("repeatable")[0];
    assert.equal(
      bibleCadenceOnCooldown(daily, undefined, MONDAY_NOON_UTC),
      false
    );
  });

  it("keeps daily periods aligned to UTC midnight", () => {
    const justBefore = Date.UTC(2026, 6, 27, 23, 59, 59);
    const justAfter = Date.UTC(2026, 6, 28, 0, 0, 1);
    assert.notEqual(bibleDailyPeriod(justBefore), bibleDailyPeriod(justAfter));
  });
});

describe("Bible quest gate — edge cases", () => {
  it("reports unknown_quest rather than throwing", () => {
    const result = bibleQuestGate(undefined, context());
    assert.equal(result.ok, false);
    assert.deepEqual(bibleQuestGateReasons(result), ["unknown_quest"]);
  });

  it("accumulates every failing reason instead of stopping at the first", () => {
    const result = bibleQuestGate(
      Q2,
      context({ playerLevel: 1, completedQuestIds: new Set() })
    );
    const reasons = bibleQuestGateReasons(result);
    assert(reasons.includes("player_level_below_minimum"));
    assert(reasons.includes("missing_prerequisite"));
    assert(reasons.length >= 2, "the gate must report all failures at once");
  });

  it("passes every quest at its own authored best case", () => {
    // If a quest cannot pass its own gate under ideal conditions it is
    // unreachable content. This is the cheapest possible check for that.
    for (const quest of BIBLE_QUEST_CATALOG) {
      const result = bibleQuestGate(
        quest,
        context({
          playerLevel: quest.gate.levelBand.min,
          timeOfDay: quest.gate.timeOfDay[0] ?? "day",
          hour: quest.gate.activeHours[0] ?? 12,
          weather: quest.gate.weather[0] ?? "clear",
          completedQuestIds: prerequisiteSet(quest),
        })
      );
      assert.equal(
        result.ok,
        true,
        `${quest.id} cannot pass its own gate: ${JSON.stringify(
          result.failures
        )}`
      );
    }
  });
});

function prerequisiteSet(quest: BibleQuestDef): Set<string> {
  return quest.start.kind === "after"
    ? new Set([quest.start.questId])
    : new Set<string>();
}
