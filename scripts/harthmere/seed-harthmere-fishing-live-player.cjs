#!/usr/bin/env node
"use strict";

require("ts-node/register/transpile-only");
require("tsconfig-paths/register");

const assert = require("assert");
const {
  Inventory,
  Orientation,
  Position,
  SelectedItem,
} = require("../../src/shared/ecs/gen/components");
const { SerializeForServer } = require("../../src/shared/ecs/gen/json_serde");
const { ChangeSerde } = require("../../src/shared/ecs/serde");
const { countOf } = require("../../src/shared/game/items");
const {
  PLAYER_HOTBAR_SLOTS,
  PLAYER_INVENTORY_SLOTS,
} = require("../../src/shared/game/inventory");
const {
  harthmereNativeBiomesIdForItemId,
} = require("../../src/shared/harthmere/harthmere_native_item_ids");
const { zrpcWebSerialize } = require("../../src/shared/zrpc/serde");

const BASE_URL = process.env.HARTHMERE_E2E_BASE_URL || "http://127.0.0.1:3047";
const CONTROL_TOKEN = process.env.HARTHMERE_E2E_CONTROL_TOKEN || "";
const USERNAME = process.env.HARTHMERE_E2E_USERNAME || "NativeECS-A-1050377428";
const QUAY_POSITION = [2213, 53, -174];
const QUAY_ORIENTATION = [-0.6986598247214637, 4.71238898038469];

assert(CONTROL_TOKEN, "HARTHMERE_E2E_CONTROL_TOKEN is required");

function serializedChange(change) {
  return ChangeSerde.serializeProposed(SerializeForServer, change);
}

async function authenticate() {
  const url = new URL("/api/harthmere/visual_test_auth", BASE_URL);
  url.searchParams.set("usernameOrId", USERNAME);
  url.searchParams.set("e2eAdmin", "1");
  const response = await fetch(url, {
    headers: { "x-harthmere-e2e-token": CONTROL_TOKEN },
  });
  if (!response.ok) {
    throw new Error(
      `Visual auth failed HTTP ${response.status}: ${await response.text()}`
    );
  }
  const auth = await response.json();
  assert.equal(auth.e2eAdmin, true, "Visual auth did not grant E2E admin");
  assert(auth.userId && auth.sessionId, "Visual auth did not return a session");
  return {
    userId: auth.userId,
    cookie: `BUID=${auth.userId}; BSID=${auth.sessionId}`,
  };
}

async function main() {
  const rodId = harthmereNativeBiomesIdForItemId("simple_fishing_rod");
  assert(rodId, "Native Simple Fishing Rod id is missing");
  const hotbar = new Array(PLAYER_HOTBAR_SLOTS);
  hotbar[0] = countOf(rodId, 1n);
  const inventory = Inventory.create({
    items: new Array(PLAYER_INVENTORY_SLOTS),
    hotbar,
    currencies: new Map(),
    overflow: new Map(),
    selected: { kind: "hotbar", idx: 0 },
  });
  const auth = await authenticate();
  const response = await fetch(
    new URL("/api/admin/apply_ecs_changes", BASE_URL),
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: auth.cookie,
      },
      body: JSON.stringify({
        z: zrpcWebSerialize([
          serializedChange({
            kind: "update",
            entity: {
              id: auth.userId,
              position: Position.create({ v: QUAY_POSITION }),
              orientation: Orientation.create({ v: QUAY_ORIENTATION }),
              inventory,
              selected_item: SelectedItem.create({ item: hotbar[0] }),
            },
          }),
        ]),
      }),
    }
  );
  if (!response.ok) {
    throw new Error(
      `Fishing player fixture failed HTTP ${
        response.status
      }: ${await response.text()}`
    );
  }
  console.log(
    JSON.stringify(
      {
        ok: true,
        version: "harthmere-fishing-live-player-v1",
        username: USERNAME,
        userId: auth.userId,
        position: QUAY_POSITION,
        orientation: QUAY_ORIENTATION,
        rodId,
      },
      null,
      2
    )
  );
}

main().catch((error) => {
  console.error(error?.stack || error);
  process.exitCode = 1;
});
