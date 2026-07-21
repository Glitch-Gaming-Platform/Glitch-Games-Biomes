import type { IdGenerator } from "@/server/shared/ids/generator";
import { ExistingEntityAwareIdGenerator } from "@/server/shared/ids/generator";
import { IdPoolGenerator, IdPoolLoan } from "@/server/shared/ids/pool";
import type { BiomesId } from "@/shared/ids";
import assert from "assert";

class SequenceIdGenerator implements IdGenerator {
  private index = 0;

  constructor(private readonly ids: readonly BiomesId[]) {}

  async next(): Promise<BiomesId> {
    return (await this.batch(1))[0];
  }

  async batch(count: number): Promise<BiomesId[]> {
    const result = this.ids.slice(this.index, this.index + count);
    assert.equal(result.length, count, "test ID sequence exhausted");
    this.index += count;
    return [...result];
  }
}

describe("ID pool collision safety", () => {
  const ids = [101, 102, 103, 104] as BiomesId[];

  it("filters IDs already occupied by authoritative ECS entities", async () => {
    const checkedBatches: BiomesId[][] = [];
    const generator = new ExistingEntityAwareIdGenerator(
      new SequenceIdGenerator(ids),
      async (candidates) => {
        checkedBatches.push([...candidates]);
        return candidates.filter((id) => id === ids[0]);
      }
    );

    assert.deepEqual(await generator.batch(2), [ids[1], ids[2]]);
    assert.deepEqual(checkedBatches, [[ids[0], ids[1]], [ids[2]]]);
  });

  it("does not return a collision-discarded loan ID to the pool", async () => {
    const pool = new IdPoolGenerator(new SequenceIdGenerator(ids), () => 1);
    const loan = new IdPoolLoan(pool);
    const [collidingId] = await loan.borrow(1);

    loan.commit([], [collidingId]);

    assert.equal(await pool.next(), ids[1]);
  });
});
