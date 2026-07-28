import { ecsCollisionSafeIdGenerator } from "@/pages/api/admin/allocate_id";
import type { IdGenerator } from "@/server/shared/ids/generator";
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

describe("admin ECS ID allocation", () => {
  it("rejects occupied world IDs before returning a fixture ID", async () => {
    const occupied = 3276660734166736 as BiomesId;
    const available = 3276660734166737 as BiomesId;
    const checked: BiomesId[][] = [];
    const generator = ecsCollisionSafeIdGenerator(
      new SequenceIdGenerator([occupied, available]),
      {
        has: async (ids: BiomesId[]) => {
          checked.push([...ids]);
          return ids.filter((id) => id === occupied);
        },
      }
    );

    assert.equal(await generator.next(), available);
    assert.deepEqual(checked, [[occupied], [available]]);
  });
});
