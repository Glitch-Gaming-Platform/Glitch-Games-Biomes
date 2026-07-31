import assert from "assert";
import { tickHarthmereEnergyWeaponStatuses } from "@/shared/npc/logic";

describe("Anima energy weapon status timing", () => {
  it("emits one Native ECS burn transaction only when the stored tick is due", () => {
    const damage: unknown[][] = [];
    const npc = {
      hp: 100,
      state: {
        energyWeapon: {
          burn: {
            source: 77,
            weaponId: "helix_projector",
            tickDamage: 6,
            ticksRemaining: 4,
            nextTickAtMs: 2_000,
          },
        },
      },
      damage(...args: unknown[]) {
        damage.push(args);
      },
    } as any;

    assert.equal(tickHarthmereEnergyWeaponStatuses(npc, 1_999), false);
    assert.equal(damage.length, 0);
    assert.equal(tickHarthmereEnergyWeaponStatuses(npc, 2_000), true);
    assert.deepEqual(damage, [
      [6, { kind: "attack", attacker: 77, dir: undefined }],
    ]);
  });

  it("does not tick dead targets or exhausted burns", () => {
    const npc = {
      hp: 0,
      state: {
        energyWeapon: {
          burn: {
            source: 77,
            weaponId: "helix_projector",
            tickDamage: 6,
            ticksRemaining: 0,
            nextTickAtMs: 0,
          },
        },
      },
      damage() {
        throw new Error("should not emit");
      },
    } as any;
    assert.equal(tickHarthmereEnergyWeaponStatuses(npc, 9_999), false);
  });
});
