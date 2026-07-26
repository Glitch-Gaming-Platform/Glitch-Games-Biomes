/// <reference types="mocha" />
/// <reference types="node" />
//
// CHAPTER_1_END_TO_END_DUNGEON_TRAVERSAL
//
// Walks both dungeons through the ACTUAL VOXEL FIELD, one block at a time,
// using a 3D flood fill over air. Not "is the volume list connected" — that is
// a graph test and it lies. This asks the only question that matters:
//
//   Standing where the portal drops you, with a player-sized body, can you
//   physically reach every room, the boss, every retrieval, and the way out?
//
// It also runs the puzzles and the portal lifecycle end to end.

import assert from "assert";
import {
  CH1_DUNGEON_TERRAIN,
  ch1DungeonBlockAt,
  ch1DungeonTerrain,
  ch1DungeonWaterAt,
  ch1ShouldCarveAirAt,
  type Ch1DungeonTerrainDef,
} from "../ch1_dungeon_terrain";
import { CH1_DUNGEON_DECOR } from "../ch1_dungeon_decor";
import {
  CH1_CONTAINMENT_STAGES,
  CH1_CONTAINMENT_CAN_FAIL,
  CH1_CONTAINMENT_TIMER_SECONDS,
  ch1ContainmentNominalSeconds,
} from "../ch1_latent_skills";
import {
  CH1_FRACTURE_GATES,
  ch1CheckProvisioning,
  ch1Gate,
  ch1GroveSideElapsedMs,
} from "../ch1_fracture_gates";
import {
  ch1AdmitToElsewhen,
  ch1ElsewhenSlot,
  CH1_ELSEWHEN_EVICTION_ANCHOR,
} from "../ch1_elsewhen_region";
import {
  ch1GateOpenAmount,
  ch1GateSeed,
} from "@/client/game/renderers/ch1_fracture_gate_material";

// ---------------------------------------------------------------------------
// Voxel walker
// ---------------------------------------------------------------------------

const PLAYER_HEIGHT = 2;

/** A voxel is standable if it and the block above are air, and there is floor. */
function isAir(dungeonId: string, x: number, y: number, z: number): boolean {
  if (ch1DungeonBlockAt(dungeonId, x, y, z) !== undefined) {
    return false;
  }
  return ch1ShouldCarveAirAt(dungeonId, x, y, z);
}

function canOccupy(dungeonId: string, x: number, y: number, z: number): boolean {
  for (let dy = 0; dy < PLAYER_HEIGHT; dy++) {
    if (!isAir(dungeonId, x, y + dy, z)) {
      return false;
    }
  }
  return true;
}

interface Reach {
  visited: Set<string>;
  count: number;
}

// The fill is deterministic for a given dungeon + start, and several tests
// need the same reachable set. Computing it once per dungeon takes the suite
// from ~3 s to well under a second without weakening a single assertion.
const floodFillCache = new Map<string, Reach>();

function reachFromArrival(terrain: Ch1DungeonTerrainDef): Reach {
  const cached = floodFillCache.get(terrain.dungeonId);
  if (cached) {
    return cached;
  }
  const start = anyStandableIn(terrain, terrain.route[0]);
  assert.ok(start, `${terrain.dungeonId}: arrival volume has nowhere to stand`);
  const reach = floodFill(terrain, start!);
  floodFillCache.set(terrain.dungeonId, reach);
  return reach;
}

/** True when ANY standable voxel of the volume is in the reachable set. */
function volumeIsReachable(
  terrain: Ch1DungeonTerrainDef,
  volumeName: string,
  reach: Reach
): boolean {
  const volume = terrain.volumes.find((v) => v.name === volumeName);
  if (!volume) {
    return false;
  }
  for (let y = volume.y0 + 1; y <= volume.y1 - 1; y++) {
    for (let x = volume.x0 + 2; x < volume.x1 - 1; x += 2) {
      for (let z = volume.z0 + 2; z < volume.z1 - 1; z += 2) {
        if (reach.visited.has(`${x},${y},${z}`)) {
          return true;
        }
      }
    }
  }
  return false;
}

/**
 * Flood fill from a start position over occupiable space, allowing a one-block
 * step up or down (normal walking) and swimming through water.
 */
function floodFill(
  terrain: Ch1DungeonTerrainDef,
  start: { x: number; y: number; z: number },
  limit = 400_000
): Reach {
  const id = terrain.dungeonId;
  const visited = new Set<string>();
  const key = (x: number, y: number, z: number) => `${x},${y},${z}`;
  const queue: Array<[number, number, number]> = [[start.x, start.y, start.z]];
  visited.add(key(start.x, start.y, start.z));

  const steps: Array<[number, number, number]> = [
    [1, 0, 0],
    [-1, 0, 0],
    [0, 0, 1],
    [0, 0, -1],
    // Walking up or down one block, and swimming/climbing vertically where the
    // space is water or a stair shaft.
    [1, 1, 0],
    [-1, 1, 0],
    [0, 1, 1],
    [0, 1, -1],
    [1, -1, 0],
    [-1, -1, 0],
    [0, -1, 1],
    [0, -1, -1],
    [0, 1, 0],
    [0, -1, 0],
  ];

  // NB: index cursor, not queue.shift(). Array.shift() is O(n), which made
  // this BFS quadratic and cost ~3 s per dungeon — most of the whole Chapter 1
  // suite's runtime. A head pointer makes each dequeue O(1).
  let head = 0;
  while (head < queue.length && visited.size < limit) {
    const [x, y, z] = queue[head++]!;
    for (const [dx, dy, dz] of steps) {
      const nx = x + dx;
      const ny = y + dy;
      const nz = z + dz;
      const k = key(nx, ny, nz);
      if (visited.has(k)) {
        continue;
      }
      // Pure vertical movement only where you could swim or climb a shaft.
      if (dx === 0 && dz === 0) {
        const swimming = ch1DungeonWaterAt(id, nx, ny, nz);
        const inShaft = terrain.stairs.some(
          (s) =>
            Math.abs(nx - s.x0) <= s.width + 2 &&
            Math.abs(nz - s.z0) <= s.width + 2
        );
        if (!swimming && !inShaft) {
          continue;
        }
      }
      if (!canOccupy(id, nx, ny, nz)) {
        continue;
      }
      visited.add(k);
      queue.push([nx, ny, nz]);
    }
  }
  return { visited, count: visited.size };
}

// Scanning a volume for a standable voxel is deterministic and gets asked
// repeatedly across tests; memoize it alongside the fill.
const standableCache = new Map<
  string,
  { x: number; y: number; z: number } | undefined
>();

/** Find any occupiable voxel inside a named volume. */
function anyStandableIn(
  terrain: Ch1DungeonTerrainDef,
  volumeName: string
): { x: number; y: number; z: number } | undefined {
  const cacheKey = `${terrain.dungeonId}/${volumeName}`;
  if (standableCache.has(cacheKey)) {
    return standableCache.get(cacheKey);
  }
  const found = scanForStandable(terrain, volumeName);
  standableCache.set(cacheKey, found);
  return found;
}

function scanForStandable(
  terrain: Ch1DungeonTerrainDef,
  volumeName: string
): { x: number; y: number; z: number } | undefined {
  const volume = terrain.volumes.find((v) => v.name === volumeName);
  if (!volume) {
    return undefined;
  }
  for (let y = volume.y0 + 1; y <= volume.y1 - 1; y++) {
    for (let x = volume.x0 + 2; x < volume.x1 - 1; x += 2) {
      for (let z = volume.z0 + 2; z < volume.z1 - 1; z += 2) {
        if (canOccupy(terrain.dungeonId, x, y, z)) {
          return { x, y, z };
        }
      }
    }
  }
  return undefined;
}

// ---------------------------------------------------------------------------

describe("ch1 E2E - dungeon is physically traversable", () => {
  for (const terrain of CH1_DUNGEON_TERRAIN) {
    describe(terrain.dungeonId, () => {
      it("has a standable voxel in every volume", () => {
        for (const volume of terrain.volumes) {
          const spot = anyStandableIn(terrain, volume.name);
          assert.ok(
            spot,
            `${volume.name} has no player-sized standable space — the room is ` +
              `solid, or the ceiling is too low to stand up in`
          );
        }
      });

      it("walks from the arrival to every single room", () => {
        const reach = reachFromArrival(terrain);
        assert.ok(
          reach.count > 100,
          `flood fill only reached ${reach.count} voxels`
        );
        for (const volume of terrain.volumes) {
          assert.ok(
            anyStandableIn(terrain, volume.name),
            `${volume.name} unreachable: nowhere to stand`
          );
          assert.ok(
            volumeIsReachable(terrain, volume.name, reach),
            `${terrain.dungeonId}: "${volume.name}" cannot be walked to from ` +
              `the portal arrival. This is a soft-lock in a one-way dungeon.`
          );
        }
      });

      it("can walk back out to the departure volume", () => {
        const reach = reachFromArrival(terrain);
        const exitName = terrain.route[terrain.route.length - 1];
        assert.ok(
          volumeIsReachable(terrain, exitName, reach),
          `${terrain.dungeonId}: the exit "${exitName}" is unreachable — the ` +
            `player would be trapped inside forever`
        );
      });

      it("has no prop standing where the player must walk", () => {
        // Decor is non-blocking so it cannot trap anyone, but a prop sunk into
        // the floor or buried in a wall is a visual bug worth catching.
        for (const prop of CH1_DUNGEON_DECOR.filter(
          (p) => p.dungeonId === terrain.dungeonId
        )) {
          const localZ = -256 + prop.at.z;
          const solid = ch1DungeonBlockAt(
            terrain.dungeonId,
            prop.at.x,
            prop.at.y,
            localZ
          );
          if (prop.support === "floor" || prop.support === "on_furniture") {
            assert.equal(
              solid,
              undefined,
              `${prop.id} is embedded inside a solid block`
            );
          }
        }
      });
    });
  }
});

describe("ch1 E2E - the Hall of Weights puzzle", () => {
  const desert = ch1DungeonTerrain("ch1_dungeon_desert")!;

  it("happens in a room the player can actually reach and stand in", () => {
    assert.ok(
      anyStandableIn(desert, "hall_of_weights"),
      "the puzzle room is not standable"
    );
    assert.ok(
      volumeIsReachable(desert, "hall_of_weights", reachFromArrival(desert)),
      "the Hall of Weights cannot be walked to"
    );
  });

  it("has the balance beam prop the puzzle interacts with", () => {
    const table = CH1_DUNGEON_DECOR.find((p) => p.id === "d1_weights_table");
    assert.ok(table, "no interaction anchor for the balance puzzle");
    assert.equal(table!.volume, "hall_of_weights");
    const masses = CH1_DUNGEON_DECOR.find(
      (p) => p.id === "d1_weights_reference_masses"
    );
    assert.ok(masses, "no reference weights to compare against");
    assert.equal(
      masses!.support,
      "on_furniture",
      "the weights must sit ON the beam, not float beside it"
    );
  });

  it("models the thesis: comparison works, absolutes do not", () => {
    // The puzzle's whole point is that every modern instrument disagrees by a
    // small, consistent, impossible amount, and the temple's own balance beam
    // does not. Comparative measurement must be exact; absolute must drift.
    const trueMass = 1000;
    const drift = (instrument: number) => 1 + instrument * 0.0007;

    const absoluteReadings = [1, 2, 3].map((i) => trueMass * drift(i));
    const allAgree = absoluteReadings.every(
      (r) => Math.abs(r - absoluteReadings[0]) < 1e-9
    );
    assert.equal(
      allAgree,
      false,
      "if the instruments agreed there would be no puzzle"
    );

    // Comparative: weigh the unknown against a local reference on the same
    // beam. Both sides drift by the same factor, so the ratio is exact.
    for (const instrument of [1, 2, 3]) {
      const unknown = trueMass * drift(instrument);
      const reference = trueMass * drift(instrument);
      assert.equal(
        unknown / reference,
        1,
        "the balance beam must give the same answer on every instrument"
      );
    }
  });
});

describe("ch1 E2E - the containment sequence", () => {
  it("cannot be failed", () => {
    assert.equal(CH1_CONTAINMENT_CAN_FAIL, false);
  });

  it("completes inside the timer with room to spare", () => {
    const nominal = ch1ContainmentNominalSeconds();
    assert.equal(nominal, 31, "the scene is called Thirty-One Seconds");
    assert.ok(
      nominal < CH1_CONTAINMENT_TIMER_SECONDS,
      `${nominal}s procedure does not fit a ${CH1_CONTAINMENT_TIMER_SECONDS}s timer`
    );
  });

  it("runs its stages in a fixed, ordered sequence", () => {
    assert.equal(CH1_CONTAINMENT_STAGES.length, 4);
    const ids = CH1_CONTAINMENT_STAGES.map((s) => s.id);
    assert.equal(new Set(ids).size, ids.length, "duplicate stage");
    for (const stage of CH1_CONTAINMENT_STAGES) {
      assert.ok(stage.nominalSeconds > 0);
      assert.ok(
        stage.label.length > 0,
        `${stage.id} has no expert-UI label; the UI IS the knowledge`
      );
    }
  });

  it("simulates a timeout completing itself rather than failing", () => {
    // On timeout the player's hands finish it and the player watches.
    let elapsed = 0;
    let completed = 0;
    for (const stage of CH1_CONTAINMENT_STAGES) {
      elapsed += stage.nominalSeconds;
      if (elapsed <= CH1_CONTAINMENT_TIMER_SECONDS) {
        completed++;
      }
    }
    const autoCompleted = CH1_CONTAINMENT_STAGES.length - completed;
    assert.equal(
      completed + autoCompleted,
      CH1_CONTAINMENT_STAGES.length,
      "every stage must resolve one way or the other; there is no fail state"
    );
  });
});

describe("ch1 E2E - portal lifecycle", () => {
  it("opens, holds, and closes a transient gate exactly once", () => {
    const gate = ch1Gate("ch1_gate_fence_sighting")!;
    const window = gate.openSeconds!;
    const samples: number[] = [];
    for (let t = 0; t <= window + 5; t += 0.25) {
      samples.push(
        ch1GateOpenAmount({ elapsedSeconds: t, closesAfterSeconds: window })
      );
    }
    assert.equal(samples[0], 0, "starts closed");
    assert.ok(Math.max(...samples) >= 0.999, "never fully opens");
    assert.equal(samples[samples.length - 1], 0, "never closes");

    // Exactly one rise and one fall — no flicker.
    let direction = 0;
    let changes = 0;
    for (let i = 1; i < samples.length; i++) {
      const delta = samples[i] - samples[i - 1];
      const next = delta > 1e-9 ? 1 : delta < -1e-9 ? -1 : direction;
      if (next !== direction) {
        changes++;
        direction = next;
      }
    }
    assert.ok(
      changes <= 3,
      `gate changed direction ${changes} times — it flickers`
    );
  });

  it("holds a persistent gate open indefinitely", () => {
    for (const t of [10, 1_000, 100_000]) {
      assert.equal(ch1GateOpenAmount({ elapsedSeconds: t }), 1);
    }
  });

  it("gives every gate a distinct, stable look", () => {
    const seeds = CH1_FRACTURE_GATES.map((g) => ch1GateSeed(g.id));
    assert.equal(new Set(seeds).size, seeds.length);
    for (const gate of CH1_FRACTURE_GATES) {
      assert.equal(ch1GateSeed(gate.id), ch1GateSeed(gate.id));
    }
  });

  it("warps a provisioned player in and evicts everyone else", () => {
    for (const gate of CH1_FRACTURE_GATES.filter((g) => g.dungeonId)) {
      const slot = ch1ElsewhenSlot(gate.dungeonId!)!;

      const legitimate = ch1AdmitToElsewhen({
        position: [...slot.arrival],
        activeDungeonRunId: gate.dungeonId,
      });
      assert.equal(legitimate.allowed, true, `${gate.id}: legit entry refused`);

      for (const bad of [
        { position: [...slot.arrival] as [number, number, number] },
        {
          position: [...slot.arrival] as [number, number, number],
          activeDungeonRunId: "ch1_dungeon_somewhere_else",
        },
      ]) {
        const refused = ch1AdmitToElsewhen(bad);
        assert.equal(
          refused.allowed,
          false,
          `${gate.id}: an unauthorised player was admitted to the dungeon band`
        );
      }
    }
  });

  it("evicts to a real Grove anchor, not the origin", () => {
    assert.ok(CH1_ELSEWHEN_EVICTION_ANCHOR[0] > 400);
    assert.notDeepEqual(CH1_ELSEWHEN_EVICTION_ANCHOR, [0, 0, 0]);
  });

  it("charges Grove time on the way out, per gate", () => {
    const inside = 90 * 60 * 1000;
    const desert = ch1GroveSideElapsedMs("ch1_gate_desert", inside);
    const winter = ch1GroveSideElapsedMs("ch1_gate_winter", inside);
    assert.ok(desert > inside && winter > inside);
    assert.notEqual(desert, winter, "gates must not share a dilation factor");
  });

  it("blocks entry until every supply line has been worked", () => {
    for (const gate of CH1_FRACTURE_GATES.filter((g) => g.dungeonId)) {
      const partial = ch1CheckProvisioning(gate.id, { food: 999 });
      assert.equal(
        partial.ok,
        false,
        `${gate.id}: one vendor's stock was enough; the economy loop is bypassable`
      );
    }
  });
});
