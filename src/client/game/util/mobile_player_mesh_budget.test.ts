import {
  MOBILE_NPC_MESH_LOAD_LIMIT,
  MOBILE_REMOTE_PLAYER_MESH_LOAD_LIMIT,
  npcMeshLoadLimitForDevice,
  preserveAllPuppetNpcsForDevice,
  remotePlayerMeshLoadLimitForDevice,
} from "@/client/game/util/mobile_player_mesh_budget";
import assert from "assert";

describe("mobile remote-player mesh budget", () => {
  it("caps crowded phone scenes before generated avatars are requested", () => {
    assert.equal(
      remotePlayerMeshLoadLimitForDevice(true, 30),
      MOBILE_REMOTE_PLAYER_MESH_LOAD_LIMIT
    );
  });

  it("respects a stricter configured render limit", () => {
    assert.equal(remotePlayerMeshLoadLimitForDevice(true, 4), 4);
    assert.equal(remotePlayerMeshLoadLimitForDevice(true, -1), 0);
  });

  it("does not alter the desktop preselection path", () => {
    assert.equal(remotePlayerMeshLoadLimitForDevice(false, 30), undefined);
  });

  it("caps player-like NPC mesh creation on phones only", () => {
    assert.equal(
      npcMeshLoadLimitForDevice(true, 30),
      MOBILE_NPC_MESH_LOAD_LIMIT
    );
    assert.equal(npcMeshLoadLimitForDevice(true, 4), 4);
    assert.equal(npcMeshLoadLimitForDevice(false, 30), 30);
  });

  it("keeps the whole puppet cast only on desktop or in an active cutscene", () => {
    assert.equal(preserveAllPuppetNpcsForDevice(false, false), true);
    assert.equal(preserveAllPuppetNpcsForDevice(true, true), true);
    assert.equal(preserveAllPuppetNpcsForDevice(true, false), false);
  });
});
