import { strict as assert } from "assert";
import {
  HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES,
  shouldShowHarthmereProjectileVisualAudit,
} from "@/client/components/challenges/harthmereProjectileVisualAudit";
import { HARTHMERE_PROJECTILE_VISUALS } from "@/shared/harthmere/projectile_visual_manifest";

describe("HarthmereProjectileVisualAuditPanel", () => {
  it("covers every projectile exactly once in bounded browser batches", () => {
    const ids = HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES.flatMap(
      ({ ids }) => ids
    );
    assert.equal(ids.length, HARTHMERE_PROJECTILE_VISUALS.length);
    assert.equal(new Set(ids).size, ids.length);
    assert.deepEqual(
      ids,
      HARTHMERE_PROJECTILE_VISUALS.map(({ id }) => id)
    );
    assert.ok(
      HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES.every(
        ({ ids: batchIds }) => batchIds.length <= 6
      )
    );
  });

  it("is available only on a local native-ECS audit URL", () => {
    assert.equal(
      shouldShowHarthmereProjectileVisualAudit({
        hostname: "127.0.0.1",
        search:
          "?harthmere_native_ecs_e2e=1&harthmere_projectile_visual_audit=1",
      }),
      true
    );
    assert.equal(
      shouldShowHarthmereProjectileVisualAudit({
        hostname: "example.com",
        search:
          "?harthmere_native_ecs_e2e=1&harthmere_projectile_visual_audit=1",
      }),
      false
    );
    assert.equal(
      shouldShowHarthmereProjectileVisualAudit({
        hostname: "localhost",
        search: "?harthmere_projectile_visual_audit=1",
      }),
      false
    );
  });
});
