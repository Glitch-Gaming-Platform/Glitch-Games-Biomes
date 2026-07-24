import assert from "assert";
import fs from "fs";
import path from "path";
import { npcCinematicPauseActive } from "@/shared/npc/logic";

function read(rel: string): string {
  return fs.readFileSync(path.join(process.cwd(), rel), "utf8");
}

describe("cutscene ECS / Anima / Gaia contracts", () => {
  it("serverShared NPC movement is admin-authorized server-side", () => {
    const source = read("src/server/logic/events/handlers/npc.ts");
    const handler = source.slice(source.indexOf("setNPCPositionEventHandler"));
    assert.match(handler, /player: q\.player\(event\.id\)/);
    assert.match(handler, /roles\(\).*has\("admin"\)/s);
  });

  it("shared positioning refreshes an Anima pause lease", () => {
    const handler = read("src/server/logic/events/handlers/npc.ts");
    const logic = read("src/shared/npc/logic.ts");
    const simulated = read("src/shared/npc/simulated.ts");
    assert.match(handler, /cinematicPauseUntil/);
    assert.match(logic, /npcCinematicPauseActive\(npc\.state/);
    assert.match(simulated, /npc_state: external\.npc_state/);
    assert.strictEqual(
      npcCinematicPauseActive({ cinematicPauseUntil: 11 }, 10),
      true
    );
    assert.strictEqual(
      npcCinematicPauseActive({ cinematicPauseUntil: 10 }, 10),
      false
    );
  });

  it("inline client definitions cannot request serverShared authority", () => {
    const service = read("src/client/game/cutscene/cutscene_service.ts");
    assert.match(service, /inline serverShared scenes are forbidden/);
  });

  it("Gaia time remains a client render tweak and is restored conditionally", () => {
    const director = read("src/client/game/scripts/cutscene_director.ts");
    assert.match(director, /overrideTimeOfDay/);
    assert.match(director, /lastAppliedTimeOfDay/);
    assert.doesNotMatch(director, /gaia.*publish/is);
  });

  it("headless screenshots wait on renderer readiness and honor output size", () => {
    const route = read("src/pages/api/screenshot.ts");
    const camera = read("src/server/shared/screenshots/camera.ts");
    assert.match(route, /SCREENSHOT_TIMEOUT_MS = 30_000/);
    assert.match(camera, /__biomesCaptureReady/);
    assert.match(camera, /setViewport\(\{ width, height/);
    assert.match(camera, /this\.browser = browser/);
    assert.doesNotMatch(camera, /sleep\(10_000\)/);
  });
});
