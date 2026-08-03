/// <reference types="mocha" />

import {
  harthmereProjectedNpcCandidates,
  harthmereProjectedNpcPresentation,
} from "@/client/game/scripts/harthmere_npc_projection";
import type { CutscenePuppetOverride } from "@/shared/cutscene/puppets";
import assert from "assert";
import { readFileSync } from "fs";
import path from "path";

type TestNpc = {
  id: number;
  label: string;
  position: [number, number, number];
};

const JACKIE_ID = 8_810_000_000_019_301;
const STARTER_POST: [number, number, number] = [485.54, 70, -140.52];
const ROADHOUSE_POST: [number, number, number] = [476, 70, -129];
const jackie: TestNpc = {
  id: JACKIE_ID,
  label: "Jackie",
  position: STARTER_POST,
};

function candidates(
  center: [number, number, number],
  overrides: CutscenePuppetOverride[],
  nearby: TestNpc[] = [jackie],
  projectedEntities: TestNpc[] = [jackie]
) {
  return harthmereProjectedNpcCandidates({
    nearby,
    projectedEntities,
    overrides,
    center,
    radius: 5,
    basePosition: (entity) => entity.position,
    baseLabel: (entity) => entity.label,
  });
}

describe("Harthmere per-player NPC projection", () => {
  it("shows exactly one starter Jackie before Chapter One", () => {
    const atStarter = candidates(STARTER_POST, []);
    assert.equal(atStarter.length, 1);
    assert.equal(atStarter[0].entity.id, JACKIE_ID);
    assert.deepEqual(atStarter[0].presentation.position, STARTER_POST);
    assert.equal(candidates(ROADHOUSE_POST, []).length, 0);
  });

  it("removes starter Jackie and exposes the same canonical entity at the active story post", () => {
    const override: CutscenePuppetOverride = {
      id: JACKIE_ID,
      at: ROADHOUSE_POST,
      yaw: 0,
      label: "Jackie",
    };
    assert.equal(candidates(STARTER_POST, [override]).length, 0);
    const atRoadhouse = candidates(ROADHOUSE_POST, [override], [], [jackie]);
    assert.equal(atRoadhouse.length, 1);
    assert.equal(atRoadhouse[0].entity.id, JACKIE_ID);
    assert.deepEqual(atRoadhouse[0].presentation.position, ROADHOUSE_POST);
  });

  it("removes an absent story actor from every presentation consumer", () => {
    const hidden: CutscenePuppetOverride = {
      id: JACKIE_ID,
      yaw: 0,
      label: "Jackie",
      hidden: true,
    };
    assert.equal(candidates(STARTER_POST, [hidden]).length, 0);
    assert.equal(candidates(ROADHOUSE_POST, [hidden]).length, 0);
  });

  it("keeps the projected label and location coupled to one override", () => {
    const override: CutscenePuppetOverride = {
      id: JACKIE_ID,
      at: ROADHOUSE_POST,
      yaw: 1,
      label: "Jackie at the Road-House",
    };
    const presentation = harthmereProjectedNpcPresentation(
      JACKIE_ID,
      STARTER_POST,
      "Starter Jackie",
      new Map([[JACKIE_ID, override]])
    );
    assert.equal(presentation.hidden, false);
    assert.deepEqual(presentation.position, ROADHOUSE_POST);
    assert.equal(presentation.label, "Jackie at the Road-House");
  });

  it("keeps projected Talk available when the shared body is outside the local subscription", () => {
    const overlaySource = readFileSync(
      path.join(process.cwd(), "src/client/game/scripts/overlays.ts"),
      "utf8"
    );
    const cursorSource = readFileSync(
      path.join(
        process.cwd(),
        "src/client/components/overlays/inspected/CursorInspectionOverlayComponent.tsx"
      ),
      "utf8"
    );
    assert.match(overlaySource, /projectedNpcOob/);
    assert.match(overlaySource, /oobFetchSingle\(override\.id as BiomesId\)/);
    assert.match(overlaySource, /projectedTalkable:/);
    assert.match(cursorSource, /canTalkToProjectedNpc/);
    assert.match(
      cursorSource,
      /canTalk \|\| canTalkToProjectedNpc \|\| isNativeDialogueQuestObject/
    );
  });
});
