import type { BDB } from "@/server/shared/storage";
import { createBdb, createStorageBackend } from "@/server/shared/storage";
import { getUserOrCreateIfNotExists } from "@/server/web/db/users";
import {
  findByUID,
  normalizeUsernameForFirebaseUnique,
} from "@/server/web/db/users_fetch";
import { createUser } from "@/server/web/test/test_helpers";
import { toStoredEntityId } from "@/shared/ids";
import { generateTestId } from "@/shared/test_helpers";
import assert from "assert";

describe("DB", () => {
  let db: BDB;
  beforeEach(async () => {
    db = createBdb(await createStorageBackend("memory"));
  });

  it("should support user writes", async () => {
    const userCreate = await createUser(db, "tommyd");
    const user = await findByUID(db, userCreate.id);
    assert.ok(user && user.username === "tommyd");
  });

  it("repairs a dangling username pointer by recreating the missing user document", async () => {
    const uid = generateTestId();
    const username = "blackmage";
    await db
      .collection("usernames")
      .doc(normalizeUsernameForFirebaseUnique(username))
      .set({ userId: uid });

    const repaired = await getUserOrCreateIfNotExists(db, uid, username);

    assert.equal(repaired.id, uid);
    assert.equal(repaired.username, username);
    assert.equal((await findByUID(db, uid))?.username, username);
    assert.equal(
      (await db.collection("users").doc(toStoredEntityId(uid)).get()).exists,
      true
    );
  });
});
