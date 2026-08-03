import {
  HarthmerePlayerInviteError,
  MemoryHarthmerePlayerInviteStore,
  createHarthmerePlayerInvite,
  formatHarthmerePlayerInviteCode,
  harthmerePlayerInvitePlayUrl,
  joinHarthmerePlayerInvite,
  normalizeHarthmerePlayerInviteCode,
  type HarthmerePlayerInviteSnapshot,
} from "@/server/glitch/harthmere_player_invites";
import assert from "assert";

const TITLE_ID = "42de534c-600f-4228-af9e-b69faef94cce";

function randomBytes() {
  return new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
}

describe("Harthmere player invite lifecycle", () => {
  it("creates a Glitch-hosted code and warps a friend to the inviter's current coordinates", async () => {
    const store = new MemoryHarthmerePlayerInviteStore();
    const players = new Map<string, HarthmerePlayerInviteSnapshot>([
      [
        "101",
        {
          playerId: "101",
          name: "Jackie",
          position: [500, 70, -120],
          orientation: [0.1, 1.2],
        },
      ],
      [
        "202",
        { playerId: "202", name: "New Friend", position: [496, 70, -126] },
      ],
    ]);
    const created = await createHarthmerePlayerInvite({
      titleId: TITLE_ID,
      inviterPlayerId: "101",
      store,
      readPlayer: async (id) => players.get(id),
      randomBytes,
      nowMs: 1_000,
    });

    assert.equal(created.record.code.length, 8);
    assert.match(
      created.playUrl,
      /^https:\/\/www\.glitch\.fun\/games\/42de534c-600f-4228-af9e-b69faef94cce\/play\?invite_code=/
    );
    assert.ok(
      created.playUrl.includes(
        formatHarthmerePlayerInviteCode(created.record.code)
      )
    );

    players.set("101", {
      playerId: "101",
      name: "Jackie",
      position: [777.25, 81, -42.5],
      orientation: [0.25, 2.5],
    });
    const warps: Array<{
      id: string;
      position: [number, number, number];
      orientation?: [number, number];
    }> = [];
    const joined = await joinHarthmerePlayerInvite({
      titleId: TITLE_ID,
      inviteePlayerId: "202",
      code: formatHarthmerePlayerInviteCode(created.record.code),
      store,
      readPlayer: async (id) => players.get(id),
      publishWarp: async (id, position, orientation) => {
        warps.push({ id, position, orientation });
      },
      nowMs: 2_000,
    });

    assert.equal(joined.alreadyJoined, false);
    assert.deepEqual(warps, [
      {
        id: "202",
        position: [777.25, 81, -42.5],
        orientation: [0.25, 2.5],
      },
    ]);

    const repeated = await joinHarthmerePlayerInvite({
      titleId: TITLE_ID,
      inviteePlayerId: "202",
      code: created.record.code,
      store,
      readPlayer: async (id) => players.get(id),
      publishWarp: async (id, position, orientation) => {
        warps.push({ id, position, orientation });
      },
      nowMs: 2_500,
    });
    assert.equal(repeated.alreadyJoined, true);
    assert.equal(warps.length, 1, "a reload must not re-warp the same friend");
  });

  it("normalizes invite codes and includes them in the Glitch URL", () => {
    assert.equal(normalizeHarthmerePlayerInviteCode("ab-cd ef12"), "ABCDEF12");
    assert.equal(formatHarthmerePlayerInviteCode("abcdef12"), "ABCD-EF12");
    const url = harthmerePlayerInvitePlayUrl(TITLE_ID, "ABCDEF12");
    assert.equal(new URL(url).host, "www.glitch.fun");
    assert.equal(new URL(url).pathname, `/games/${TITLE_ID}/play`);
    assert.equal(new URL(url).searchParams.get("invite_code"), "ABCD-EF12");
  });

  it("revokes a prior code when the inviter requests a new one", async () => {
    const store = new MemoryHarthmerePlayerInviteStore();
    const players = new Map<string, HarthmerePlayerInviteSnapshot>([
      ["1", { playerId: "1", name: "Inviter", position: [1, 2, 3] }],
      ["2", { playerId: "2", name: "Friend", position: [4, 5, 6] }],
    ]);
    let seed = 0;
    const create = (rotate = false) =>
      createHarthmerePlayerInvite({
        titleId: TITLE_ID,
        inviterPlayerId: "1",
        store,
        readPlayer: async (id) => players.get(id),
        randomBytes: () =>
          new Uint8Array([++seed, seed, seed, seed, seed, seed, seed, seed]),
        nowMs: 100 + seed,
        rotate,
      });

    const first = await create();
    const second = await create(true);
    assert.notEqual(first.record.code, second.record.code);
    await assert.rejects(
      () =>
        joinHarthmerePlayerInvite({
          titleId: TITLE_ID,
          inviteePlayerId: "2",
          code: first.record.code,
          store,
          readPlayer: async (id) => players.get(id),
          publishWarp: async () => undefined,
          nowMs: 200,
        }),
      (error: unknown) =>
        error instanceof HarthmerePlayerInviteError &&
        error.code === "INVITE_NOT_FOUND"
    );
  });

  it("claims a player/code atomically and releases the claim after a failed warp", async () => {
    const store = new MemoryHarthmerePlayerInviteStore();
    const players = new Map<string, HarthmerePlayerInviteSnapshot>([
      ["1", { playerId: "1", name: "Inviter", position: [1, 2, 3] }],
      ["2", { playerId: "2", name: "Friend", position: [4, 5, 6] }],
    ]);
    const created = await createHarthmerePlayerInvite({
      titleId: TITLE_ID,
      inviterPlayerId: "1",
      store,
      readPlayer: async (id) => players.get(id),
      randomBytes,
      nowMs: 10,
    });
    let warpCalls = 0;
    const join = (publishWarp: () => Promise<void>) =>
      joinHarthmerePlayerInvite({
        titleId: TITLE_ID,
        inviteePlayerId: "2",
        code: created.record.code,
        store,
        readPlayer: async (id) => players.get(id),
        publishWarp: async () => {
          warpCalls += 1;
          await publishWarp();
        },
        nowMs: 20,
      });

    const [first, duplicate] = await Promise.all([
      join(async () => new Promise((resolve) => setTimeout(resolve, 5))),
      join(async () => undefined),
    ]);
    assert.equal(warpCalls, 1);
    assert.deepEqual([first.alreadyJoined, duplicate.alreadyJoined].sort(), [
      false,
      true,
    ]);

    const secondStore = new MemoryHarthmerePlayerInviteStore();
    const retryInvite = await createHarthmerePlayerInvite({
      titleId: TITLE_ID,
      inviterPlayerId: "1",
      store: secondStore,
      readPlayer: async (id) => players.get(id),
      randomBytes,
      nowMs: 10,
    });
    const retryJoin = (fail: boolean) =>
      joinHarthmerePlayerInvite({
        titleId: TITLE_ID,
        inviteePlayerId: "2",
        code: retryInvite.record.code,
        store: secondStore,
        readPlayer: async (id) => players.get(id),
        publishWarp: async () => {
          if (fail) throw new Error("WARP_FAILED");
        },
        nowMs: 20,
      });
    await assert.rejects(() => retryJoin(true), /WARP_FAILED/);
    assert.equal((await retryJoin(false)).alreadyJoined, false);
  });

  it("rejects expired, self, unready, and restricted-destination joins", async () => {
    const store = new MemoryHarthmerePlayerInviteStore();
    const players = new Map<string, HarthmerePlayerInviteSnapshot>([
      ["1", { playerId: "1", name: "Inviter", position: [1, 2, 3] }],
      ["2", { playerId: "2", name: "Friend", position: [4, 5, 6] }],
    ]);
    const created = await createHarthmerePlayerInvite({
      titleId: TITLE_ID,
      inviterPlayerId: "1",
      store,
      readPlayer: async (id) => players.get(id),
      randomBytes,
      nowMs: 10,
    });

    await assert.rejects(
      () =>
        joinHarthmerePlayerInvite({
          titleId: TITLE_ID,
          inviteePlayerId: "1",
          code: created.record.code,
          store,
          readPlayer: async (id) => players.get(id),
          publishWarp: async () => undefined,
          nowMs: 20,
        }),
      (error: unknown) =>
        error instanceof HarthmerePlayerInviteError &&
        error.code === "CANNOT_JOIN_OWN_INVITE"
    );

    players.delete("2");
    await assert.rejects(
      () =>
        joinHarthmerePlayerInvite({
          titleId: TITLE_ID,
          inviteePlayerId: "2",
          code: created.record.code,
          store,
          readPlayer: async (id) => players.get(id),
          publishWarp: async () => undefined,
          nowMs: 20,
        }),
      (error: unknown) =>
        error instanceof HarthmerePlayerInviteError &&
        error.code === "INVITE_PLAYER_NOT_READY"
    );

    players.set("2", { playerId: "2", position: [4, 5, 6] });
    players.set("1", { playerId: "1", position: [99, 2, 3] });
    await assert.rejects(
      () =>
        joinHarthmerePlayerInvite({
          titleId: TITLE_ID,
          inviteePlayerId: "2",
          code: created.record.code,
          store,
          readPlayer: async (id) => players.get(id),
          publishWarp: async () => undefined,
          destinationAllowed: (position) => position[0] < 50,
          nowMs: 20,
        }),
      (error: unknown) =>
        error instanceof HarthmerePlayerInviteError &&
        error.code === "INVITE_DESTINATION_UNAVAILABLE"
    );

    await assert.rejects(
      () =>
        joinHarthmerePlayerInvite({
          titleId: TITLE_ID,
          inviteePlayerId: "2",
          code: created.record.code,
          store,
          readPlayer: async (id) => players.get(id),
          publishWarp: async () => undefined,
          nowMs: created.record.expiresAtMs + 1,
        }),
      (error: unknown) =>
        error instanceof HarthmerePlayerInviteError &&
        error.code === "INVITE_EXPIRED"
    );
  });
});
