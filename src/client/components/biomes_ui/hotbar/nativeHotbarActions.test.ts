import {
  activateNativeHotbarPrimaryAction,
  throwOneNativeHotbarItem,
} from "@/client/components/biomes_ui/hotbar/nativeHotbarActions";
import assert from "assert";

describe("native hotbar actions", () => {
  it("routes authored actions through the shared primary-hold input", async () => {
    const pulses: unknown[][] = [];
    await activateNativeHotbarPrimaryAction({
      gameInput: {
        pulseMotion: async (...args: unknown[]) => {
          pulses.push(args);
        },
      } as any,
      item: { id: 1, action: "wand" } as any,
      slotIndex: 2,
      waitForSelection: async () => undefined,
    });
    assert.deepEqual(pulses, [["primary_hold", 350, "biomes-ui-hotbar:2"]]);
  });

  it("throws exactly one native stack item", async () => {
    let captured: unknown[] | undefined;
    await throwOneNativeHotbarItem(
      {} as any,
      123 as any,
      2,
      async (...args: unknown[]) => {
        captured = args;
      }
    );
    assert.deepEqual(captured?.slice(1), [123, { kind: "hotbar", idx: 2 }, 1n]);
  });
});
