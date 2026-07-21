import assert from "assert";
import {
  HARTHMERE_CONNECTOR_ROUTE_ANCHORS,
  HARTHMERE_CONNECTOR_WEST_GATE_LANDING,
  planHarthmereConnectorRoute,
  validateHarthmereConnectorRoutePlan,
  type HarthmereConnectorColumn,
} from "@/shared/harthmere/harthmere_connector_route";

function syntheticSample(input?: {
  blocked?: (x: number, z: number) => boolean;
  surfaceY?: (x: number, z: number) => number;
}) {
  return (x: number, z: number): HarthmereConnectorColumn => ({
    surfaceY:
      x === HARTHMERE_CONNECTOR_WEST_GATE_LANDING[0] &&
      z === HARTHMERE_CONNECTOR_WEST_GATE_LANDING[1]
        ? 56
        : input?.surfaceY?.(x, z) ??
          (x >= 890 && x <= HARTHMERE_CONNECTOR_ROUTE_ANCHORS.at(-1)![0]
            ? 64 - Math.floor((x - 890) / 3)
            : 64),
    blocked: input?.blocked?.(x, z) ?? false,
    canTraverse: true,
    canResurface: true,
  });
}

describe("harthmere protected connector route", () => {
  it("finds a continuous player route and builds the west-gate stair", () => {
    const sample = syntheticSample();
    const plan = planHarthmereConnectorRoute({ sample });

    assert.deepEqual(validateHarthmereConnectorRoutePlan(plan, sample), []);
    assert.ok(plan.path.length > 300);
    assert.ok(plan.edits.some((edit) => edit.label === "road_center"));
    assert.ok(plan.edits.some((edit) => edit.label === "stair_cap"));
    assert.ok(plan.edits.some((edit) => edit.label === "stair_carve"));
    const stairCenterline = plan.edits
      .filter((edit) => edit.label === "stair_cap" && edit.position[2] === -209)
      .sort((a, b) => a.position[0] - b.position[0]);
    assert.ok(
      stairCenterline.every(
        (edit, index) =>
          index === 0 ||
          Math.abs(edit.position[1] - stairCenterline[index - 1].position[1]) <=
            1
      )
    );
    assert.equal(stairCenterline.at(-1)?.position[1], 56);
  });

  it("detours around a building footprint instead of editing through it", () => {
    const blocked = (x: number, z: number) =>
      x >= 700 && x <= 714 && z >= -216 && z <= -202;
    const sample = syntheticSample({ blocked });
    const plan = planHarthmereConnectorRoute({ sample });

    assert.deepEqual(validateHarthmereConnectorRoutePlan(plan, sample), []);
    assert.ok(plan.path.every(([x, z]) => !blocked(x, z)));
    assert.ok(
      plan.edits.every((edit) => !blocked(edit.position[0], edit.position[2]))
    );
  });

  it("fails closed when a protected wall spans the full connector bounds", () => {
    const sample = syntheticSample({
      blocked: (x) => x === 700,
    });
    const plan = planHarthmereConnectorRoute({ sample });

    assert.equal(plan.edits.length, 0);
    assert.ok(
      plan.failures.some((failure) =>
        failure.includes("no building-safe walkable segment")
      )
    );
  });

  it("rejects a route whose terrain grade exceeds one block", () => {
    const sample = syntheticSample({
      surfaceY: (x) => (x >= 720 ? 66 : 64),
    });
    const plan = planHarthmereConnectorRoute({ sample });

    assert.equal(plan.edits.length, 0);
    assert.ok(plan.failures.length > 0);
  });
});
