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
    async function has(id: BiomesId): Promise<BiomesId | undefined>;
    async function has(ids: BiomesId[]): Promise<BiomesId[]>;
    async function has(
      idsOrId: BiomesId | BiomesId[]
    ): Promise<BiomesId | undefined | BiomesId[]> {
      const ids = Array.isArray(idsOrId) ? idsOrId : [idsOrId];
      checked.push([...ids]);
      const matches = ids.filter((id) => id === occupied);
      return Array.isArray(idsOrId) ? matches : matches[0];
    }
    const generator = ecsCollisionSafeIdGenerator(
      new SequenceIdGenerator([occupied, available]),
      { has }
    );

    assert.equal(await generator.next(), available);
    assert.deepEqual(checked, [[occupied], [available]]);
  });
});
