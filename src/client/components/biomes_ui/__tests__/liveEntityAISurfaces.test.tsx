/// <reference types="mocha" />

import assert from "assert";
import * as React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { harthmereMuckCreatureAssetKeyForLabel } from "@/shared/harthmere/muck_creature_assets";
import {
  createHarthmereLiveEntityCombatSnapshotsFromEcsRecords,
} from "@/shared/harthmere/live_entity_ecs_bridge";
import {
  HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS,
  HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS,
} from "@/shared/harthmere/live_entity_production_seed";
import { robotTalkDialogSectionsWithLiveEntityHelper } from "@/client/components/modals/robot/liveEntityRobotDialogPresentation";

const FORBIDDEN_VISIBLE_COPY = [
  "npc_metadata",
  "entityKind",
  "combatProtection",
  "request_",
  "serverAction",
  "muck_monster",
  "ambient_muck_monster",
  "robot_sentinel",
  "undefined",
  "NaN",
];

function visibleText(html: string) {
  return html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&#x27;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();
}

function playerKindLabel(kind: string) {
  if (kind === "mux" || kind === "hex" || kind === "monster") {
    return "Hostile creature";
  }
  if (kind === "robot") {
    return "Robot sentinel";
  }
  if (kind === "animal") {
    return "Animal companion";
  }
  if (kind === "object") {
    return "World object";
  }
  return "Townsperson";
}

function LiveEntityAISurfaceAuditPanel({
  rows,
}: {
  rows: Array<{
    id: string;
    label: string;
    kind: string;
    protected?: boolean;
    assetKey?: string;
  }>;
}) {
  return (
    <section aria-label="Live entities">
      <h1>Live Entities</h1>
      {rows.map((row) => (
        <article key={row.id} data-asset={row.assetKey ?? "generated"}>
          <h2>{row.label}</h2>
          <p>{playerKindLabel(row.kind)}</p>
          <strong>
            {row.protected
              ? "Protected"
              : row.assetKey
              ? "Creature model ready"
              : "Generated character ready"}
          </strong>
        </article>
      ))}
    </section>
  );
}

describe("live entity AI frontend and SSR surfaces", () => {
  it("SSR-renders representative live entity families with player-facing copy and creature asset hooks", () => {
    const muckSeed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
      (seed) => seed.displayName.includes("Road Muckwad")
    );
    const hexSeed = HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS.find(
      (seed) => seed.displayName.includes("Gravewood Pale Hexer")
    );
    assert.ok(muckSeed);
    assert.ok(hexSeed);
    const muck = muckSeed;
    const hex = hexSeed;
    const robotSeed = HARTHMERE_LIVE_ENTITY_ROBOT_SENTINEL_SEEDS[0];
    assert.ok(robotSeed);

    const snapshots = createHarthmereLiveEntityCombatSnapshotsFromEcsRecords({
      billy: {
        npc_metadata: { type_id: 1, spawn_position: [500, 53, -120] },
        position: { v: [500, 53, -120] },
        health: { hp: 100, maxHp: 100 },
        label: { text: "Billy Rhodes" },
      },
      muckwad: {
        npc_metadata: { type_id: 2, spawn_position: muck.position },
        position: { v: muck.position },
        health: { hp: muck.combatHp, maxHp: muck.combatHp },
        label: { text: muck.displayName },
      },
      hexer: {
        npc_metadata: { type_id: 3, spawn_position: hex.position },
        position: { v: hex.position },
        health: { hp: hex.combatHp, maxHp: hex.combatHp },
        label: { text: hex.displayName },
      },
      robot: {
        npc_metadata: {
          type_id: 4,
          spawn_position: robotSeed.position,
        },
        position: { v: robotSeed.position },
        robot_component: { internal_battery_charge: 80 },
        health: { hp: 140, maxHp: 140 },
        label: {
          text: robotSeed.displayName,
        },
      },
      nina: {
        npc_metadata: { type_id: 5, spawn_position: [30, 53, -10] },
        position: { v: [30, 53, -10] },
        health: { hp: 30, maxHp: 30 },
        label: { text: "Nina" },
        species: "pet fox",
      },
    });

    const html = renderToStaticMarkup(
      <LiveEntityAISurfaceAuditPanel
        rows={[
          {
            id: "billy",
            label: "Billy Rhodes",
            kind: snapshots.billy.entityKind ?? "npc",
          },
          {
            id: "muckwad",
            label: muck.displayName,
            kind: snapshots.muckwad.entityKind ?? "npc",
            assetKey: harthmereMuckCreatureAssetKeyForLabel(muck.displayName),
          },
          {
            id: "hexer",
            label: hex.displayName,
            kind: snapshots.hexer.entityKind ?? "npc",
            assetKey: harthmereMuckCreatureAssetKeyForLabel(hex.displayName),
          },
          {
            id: "robot",
            label: robotSeed.displayName,
            kind: snapshots.robot.entityKind ?? "npc",
          },
          {
            id: "nina",
            label: "Nina",
            kind: snapshots.nina.entityKind ?? "npc",
          },
        ]}
      />
    );
    const text = visibleText(html);

    assert.match(text, /Billy Rhodes/);
    assert.match(text, /Road Muckwad/);
    assert.match(text, /Gravewood Pale Hexer/);
    assert.match(text, /Creature model ready/);
    assert.match(text, /Robot sentinel/);
    assert.match(text, /Animal companion/);
    assert.ok(html.includes('data-asset="npcs/seedy_muckling"'));
    assert.ok(html.includes('data-asset="npcs/purple_hexer"'));
    for (const token of FORBIDDEN_VISIBLE_COPY) {
      assert.equal(
        text.includes(token),
        false,
        `internal live entity copy leaked into SSR surface: ${token}`
      );
    }
  });

  it("keeps robot helper dialogue ahead of normal transmissions without leaking server internals", () => {
    const sections = robotTalkDialogSectionsWithLiveEntityHelper({
      transmissionText: "No transmissions",
      transmissionActions: [],
      liveEntityHelperDialog: {
        dialogText:
          "<text>Robot charge is low. Bring Stabilized Exotic Matter to restore the shield.</text>",
        actions: [{ name: "Recharge Robot", onPerformed: () => {} }],
      },
    });
    const html = renderToStaticMarkup(
      <section>
        {sections.map((section, index) => (
          <article key={index}>
            <p>{section.text.replace(/<[^>]*>/g, "")}</p>
            {(section.actions ?? []).map((action) => (
              <button key={action.name}>{action.name}</button>
            ))}
          </article>
        ))}
      </section>
    );
    const text = visibleText(html);

    assert.match(text, /Robot charge is low/);
    assert.match(text, /Recharge Robot/);
    assert.ok(text.indexOf("Robot charge is low") < text.indexOf("No transmissions"));
    for (const token of FORBIDDEN_VISIBLE_COPY) {
      assert.equal(
        text.includes(token),
        false,
        `internal robot helper copy leaked into SSR surface: ${token}`
      );
    }
  });
});
