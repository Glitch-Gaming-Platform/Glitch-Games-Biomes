import assert from "assert";
import {
  CH1_ENCOUNTER_SCHEDULER_LEASE_KEY,
  CH1_ENCOUNTER_SCHEDULER_LEASE_MS,
  holdsChapter1EncounterSchedulerLease,
  refreshChapter1EncounterSchedulerLease,
  type Chapter1EncounterSchedulerLeaseRedis,
} from "@/server/harthmere/ch1_encounter_scheduler_lease";

class FakeLeaseRedis implements Chapter1EncounterSchedulerLeaseRedis {
  value: string | undefined;
  expiresAt = 0;
  now = 1_000;

  readonly primary = {
    set: async (...args: any[]) => {
      const [key, ownerId, px, ttl, nx] = args;
      assert.equal(key, CH1_ENCOUNTER_SCHEDULER_LEASE_KEY);
      assert.equal(px, "PX");
      assert.equal(nx, "NX");
      this.expireIfNeeded();
      if (this.value !== undefined) return null;
      this.value = ownerId;
      this.expiresAt = this.now + Number(ttl);
      return "OK";
    },
    eval: async (...args: any[]) => {
      const [, keyCount, key, ownerId, ttl] = args;
      assert.equal(keyCount, 1);
      assert.equal(key, CH1_ENCOUNTER_SCHEDULER_LEASE_KEY);
      this.expireIfNeeded();
      if (this.value !== ownerId) return 0;
      this.expiresAt = this.now + Number(ttl);
      return 1;
    },
  };

  advance(ms: number) {
    this.now += ms;
    this.expireIfNeeded();
  }

  private expireIfNeeded() {
    if (this.value !== undefined && this.now >= this.expiresAt) {
      this.value = undefined;
      this.expiresAt = 0;
    }
  }
}

describe("Chapter 1 encounter scheduler lease", () => {
  it("allows only the first replica to acquire an unowned lease", async () => {
    const redis = new FakeLeaseRedis();
    assert.equal(
      await holdsChapter1EncounterSchedulerLease(redis, "web-a"),
      true
    );
    assert.equal(
      await holdsChapter1EncounterSchedulerLease(redis, "web-b"),
      false
    );
    assert.equal(redis.value, "web-a");
  });

  it("refreshes only the current owner without replacing its token", async () => {
    const redis = new FakeLeaseRedis();
    await holdsChapter1EncounterSchedulerLease(redis, "web-a");
    redis.advance(CH1_ENCOUNTER_SCHEDULER_LEASE_MS - 100);
    assert.equal(
      await refreshChapter1EncounterSchedulerLease(redis, "web-b"),
      false
    );
    assert.equal(redis.value, "web-a");
    assert.equal(
      await refreshChapter1EncounterSchedulerLease(redis, "web-a"),
      true
    );
    redis.advance(101);
    assert.equal(redis.value, "web-a", "the owner refresh must extend TTL");
  });

  it("lets another replica acquire only after the prior lease expires", async () => {
    const redis = new FakeLeaseRedis();
    await holdsChapter1EncounterSchedulerLease(redis, "web-a");
    redis.advance(CH1_ENCOUNTER_SCHEDULER_LEASE_MS);
    assert.equal(
      await holdsChapter1EncounterSchedulerLease(redis, "web-b"),
      true
    );
    assert.equal(redis.value, "web-b");
  });

  it("fails closed when atomic compare-and-refresh is unavailable", async () => {
    const redis: Chapter1EncounterSchedulerLeaseRedis = {
      primary: {
        set: async () => null,
      },
    };
    assert.equal(
      await holdsChapter1EncounterSchedulerLease(redis, "web-a"),
      false
    );
  });
});
