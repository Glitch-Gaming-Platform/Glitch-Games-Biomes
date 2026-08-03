import {
  isMobileDeviceDescription,
  lowMemoryScaleForDevice,
  resolveGlitchLocalSyncBaseUrl,
  shouldShowVirtualJoystick,
} from "@/client/game/client_config";
import assert from "assert";

describe("Glitch runtime sync URL resolution", () => {
  it("lets a trusted focused-E2E query override a stale production build URL", () => {
    assert.deepEqual(
      resolveGlitchLocalSyncBaseUrl({
        installIdInUrl: false,
        runtimeOverride: "http://127.0.0.1:4907",
        explicit: "https://biomes-node-vnet.example.azurecontainerapps.io",
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3017",
        href: "http://127.0.0.1:3017/at?harthmere_native_ecs_e2e=1",
      }),
      {
        syncBaseUrl: "http://127.0.0.1:4907",
        reason: "trusted_runtime_e2e_override",
        fallback: "http://127.0.0.1:3018",
      }
    );
  });

  it("refuses a remote runtime query override", () => {
    assert.deepEqual(
      resolveGlitchLocalSyncBaseUrl({
        installIdInUrl: false,
        runtimeOverride: "https://untrusted.example",
        explicit: undefined,
        protocol: "http:",
        hostname: "127.0.0.1",
        port: "3017",
        href: "http://127.0.0.1:3017/at?harthmere_native_ecs_e2e=1",
      }),
      {
        syncBaseUrl: "http://127.0.0.1:3018",
        reason: "runtime_e2e_override_is_remote",
        fallback: "http://127.0.0.1:3018",
      }
    );
  });
});

describe("mobile control selection", () => {
  it("uses a phone-specific WASM/resource budget without changing desktop low-memory mode", () => {
    assert.equal(lowMemoryScaleForDevice(true), 0.25);
    assert.equal(lowMemoryScaleForDevice(false), 0.5);
  });

  it("recognizes mobile operating systems even when UA device classification is missing", () => {
    assert.equal(
      isMobileDeviceDescription({ deviceType: undefined, osName: "iOS" }),
      true
    );
    assert.equal(
      isMobileDeviceDescription({ deviceType: undefined, osName: "Android" }),
      true
    );
    assert.equal(
      isMobileDeviceDescription({ deviceType: undefined, osName: "macOS" }),
      false
    );
  });

  it("uses the virtual joystick on touch devices even when Pointer Lock exists", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: true,
        touchDevice: true,
        deviceType: "mobile",
        osName: "Android",
      }),
      true
    );
  });

  it("uses the virtual joystick for iPhone and iPad user agents", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: true,
        touchDevice: false,
        deviceType: "tablet",
        osName: "iOS",
      }),
      true
    );
  });

  it("keeps Pointer Lock controls on a desktop browser", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: true,
        touchDevice: false,
        deviceType: undefined,
        osName: "macOS",
      }),
      false
    );
  });

  it("keeps mobile-only controls off a pointerless desktop embed", () => {
    assert.equal(
      shouldShowVirtualJoystick({
        pointerLockSupported: false,
        touchDevice: false,
        deviceType: undefined,
        osName: "macOS",
      }),
      false
    );
  });
});
