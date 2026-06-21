import assert from "assert";
import { BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT } from "@/client/components/biomes_ui/adapters/playerStatusAdapter";
import {
  harthmereLiveModeEnvironmentDamageHeaders,
  harthmereLiveModeEnvironmentDamageUrl,
  submitHarthmereDrowningDamageLiveMode,
  submitHarthmereFallDamageLiveMode,
} from "../harthmere_live_environment_damage";

describe("Harthmere live environment damage client", () => {
  afterEach(() => {
    delete (globalThis as any).window;
    delete (globalThis as any).CustomEvent;
  });

  it("keeps Glitch install identity on fall-damage mutations", () => {
    assert.equal(
      harthmereLiveModeEnvironmentDamageUrl("?install_id=install with spaces"),
      "/api/harthmere/live_mode?install_id=install%20with%20spaces"
    );
    assert.equal(
      harthmereLiveModeEnvironmentDamageHeaders("?installId=install-123")[
        "X-Glitch-Install-Id"
      ],
      "install-123"
    );
  });

  it("posts fall distance and publishes the returned player status", async () => {
    const dispatched: Array<{ type: string; detail: any }> = [];
    (globalThis as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    (globalThis as any).window = {
      location: { search: "?install_id=install-abc" },
      dispatchEvent: (event: any) => {
        dispatched.push({ type: event.type, detail: event.detail });
      },
    };

    const calls: Array<{ url: string; init: any; body: any }> = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          playerStatusState: { combat: { hp: 168, maxHp: 240 } },
        }),
      };
    }) as any;

    await submitHarthmereFallDamageLiveMode(20, {
      fetchImpl,
      requestIdPrefix: "test_fall",
    });

    assert.equal(calls.length, 1);
    assert.equal(
      calls[0].url,
      "/api/harthmere/live_mode?install_id=install-abc"
    );
    assert.equal(
      new Headers(calls[0].init.headers).get("X-Glitch-Install-Id"),
      "install-abc"
    );
    assert.equal(calls[0].body.actionKind, "request_environment_damage");
    assert.equal(calls[0].body.subsystem, "combat");
    assert.deepEqual(calls[0].body.payload, {
      damageKind: "fall",
      fallBlocks: 20,
    });
    assert.deepEqual(dispatched, [
      {
        type: BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
        detail: { combat: { hp: 168, maxHp: 240 } },
      },
    ]);
  });

  it("posts drowning damage and publishes the returned player status", async () => {
    const dispatched: Array<{ type: string; detail: any }> = [];
    (globalThis as any).CustomEvent = class {
      type: string;
      detail: any;
      constructor(type: string, init?: { detail?: any }) {
        this.type = type;
        this.detail = init?.detail;
      }
    };
    (globalThis as any).window = {
      location: { search: "" },
      dispatchEvent: (event: any) => {
        dispatched.push({ type: event.type, detail: event.detail });
      },
    };

    const calls: Array<{ url: string; init: any; body: any }> = [];
    const fetchImpl = (async (url: string, init: any) => {
      calls.push({ url, init, body: JSON.parse(init.body) });
      return {
        ok: true,
        json: async () => ({
          ok: true,
          playerStatusState: { combat: { hp: 9, maxHp: 100 } },
        }),
      };
    }) as any;

    await submitHarthmereDrowningDamageLiveMode(5, {
      fetchImpl,
      requestIdPrefix: "test_drown",
    });

    assert.equal(calls.length, 1);
    assert.equal(calls[0].url, "/api/harthmere/live_mode");
    assert.deepEqual(calls[0].body.payload, {
      damageKind: "drowning",
      damage: 5,
    });
    assert.deepEqual(dispatched, [
      {
        type: BIOMES_UI_PLAYER_STATUS_UPDATED_EVENT,
        detail: { combat: { hp: 9, maxHp: 100 } },
      },
    ]);
  });
});
