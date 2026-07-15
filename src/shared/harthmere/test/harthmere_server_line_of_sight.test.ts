/**
 * HARTHMERE_SERVER_LINE_OF_SIGHT (audit fix, 2026-07-13)
 *
 * Covers the audit finding "server line-of-sight is a permissive stub":
 * `serverCheckLineOfSight` returned true unconditionally, letting NPC AI
 * target and hit through walls/terrain at any distance. These tests pin the
 * new behaviour: a hard distance cap, a real voxel-walk against an injectable
 * solidity sampler, and fail-open on sampler errors (never blind every NPC
 * because a shard read hiccuped).
 */

import assert from "assert";
import {
  HARTHMERE_SERVER_LOS_MAX_DISTANCE,
  harthmereVoxelWalkLineOfSight,
  registerHarthmereServerVoxelSolidSampler,
} from "../mmo_combat_authority";

const ORIGIN = { x: 0, y: 60, z: 0 };

describe("HARTHMERE_SERVER_LINE_OF_SIGHT", () => {
  afterEach(() => {
    // Never leak a sampler between tests (module-level registry).
    registerHarthmereServerVoxelSolidSampler(undefined);
  });

  it("refuses sight beyond the hard distance cap regardless of terrain", () => {
    const airEverywhere = () => false;
    const beyond = {
      x: HARTHMERE_SERVER_LOS_MAX_DISTANCE + 2,
      y: 60,
      z: 0,
    };
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(ORIGIN, beyond, airEverywhere),
      false
    );
  });

  it("grants sight across open air within range", () => {
    const airEverywhere = () => false;
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(ORIGIN, { x: 20, y: 60, z: 0 }, airEverywhere),
      true
    );
    // Diagonal with elevation change.
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(ORIGIN, { x: 12, y: 64, z: 9 }, airEverywhere),
      true
    );
  });

  it("blocks sight through a full-height wall between the actors", () => {
    // Solid wall plane at x === 10 (all y/z solid there).
    const wallAtX10 = (x: number) => x === 10;
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(ORIGIN, { x: 20, y: 60, z: 0 }, wallAtX10),
      false
    );
    // Same wall, but the target stands BEFORE it: sight is clear.
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(ORIGIN, { x: 8, y: 60, z: 0 }, wallAtX10),
      true
    );
  });

  it("checks sight at eye height, not feet height", () => {
    // A knee-high parapet: solid only at exactly y === 60 (the FEET level of
    // both actors). Eyes are at 61.5, so sight passes over it.
    const kneeWall = (x: number, y: number) => x === 10 && y === 60;
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(ORIGIN, { x: 20, y: 60, z: 0 }, kneeWall),
      true
    );
  });

  it("does not let the start or end voxel occlude the actors themselves", () => {
    // Actor stands inside a doorway voxel that reads solid.
    const startVoxelSolid = (x: number, y: number, z: number) =>
      x === Math.floor(ORIGIN.x) &&
      y === Math.floor(ORIGIN.y + 1.5) &&
      z === Math.floor(ORIGIN.z);
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(
        ORIGIN,
        { x: 6, y: 60, z: 0 },
        startVoxelSolid
      ),
      true
    );
  });

  it("fails open (within range) when the sampler throws", () => {
    const throwingSampler = () => {
      throw new Error("shard not loaded");
    };
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(
        ORIGIN,
        { x: 20, y: 60, z: 0 },
        throwingSampler
      ),
      true
    );
  });

  it("very close targets are always visible", () => {
    const solidEverywhere = () => true;
    assert.strictEqual(
      harthmereVoxelWalkLineOfSight(
        ORIGIN,
        { x: 0.5, y: 60, z: 0 },
        solidEverywhere
      ),
      true
    );
  });
});
