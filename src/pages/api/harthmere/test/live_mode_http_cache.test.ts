import assert from "assert";
import { readdirSync, readFileSync } from "fs";
import path from "path";
import {
  HARTHMERE_LIVE_MODE_NO_STORE_CACHE_CONTROL,
  disableHarthmereLiveModeHttpCaching,
} from "@/server/harthmere/live_mode_http_cache";

describe("live_mode HTTP cache guardrails", () => {
  it("sets no-store headers and removes validators from live Cloud Save responses", () => {
    const headers = new Map<string, string | readonly string[]>();
    const removed: string[] = [];

    disableHarthmereLiveModeHttpCaching({
      setHeader(name, value) {
        headers.set(name, value);
      },
      removeHeader(name) {
        removed.push(name);
      },
    });

    assert.equal(
      headers.get("Cache-Control"),
      HARTHMERE_LIVE_MODE_NO_STORE_CACHE_CONTROL
    );
    assert.equal(headers.get("CDN-Cache-Control"), "no-store");
    assert.equal(headers.get("Surrogate-Control"), "no-store");
    assert.equal(headers.get("Pragma"), "no-cache");
    assert.equal(headers.get("Expires"), "0");
    assert.deepEqual(headers.get("Vary"), ["Cookie", "X-Glitch-Install-Id"]);
    assert.deepEqual(removed, ["ETag", "Last-Modified"]);
  });

  it("keeps every live-mode API route behind the shared no-store helper", () => {
    const routeDir = path.join(process.cwd(), "src/pages/api/harthmere");
    const liveRouteFiles = readdirSync(routeDir)
      .filter(
        (file) => file === "live_mode.ts" || /^live_mode_.*_state\.ts$/.test(file)
      )
      .sort();

    assert.ok(liveRouteFiles.length >= 10);
    for (const file of liveRouteFiles) {
      const source = readFileSync(path.join(routeDir, file), "utf8");
      assert.match(
        source,
        /disableHarthmereLiveModeHttpCaching\(unsafeResponse\)/,
        `${file} must disable HTTP caching for Cloud Save state`
      );
    }
  });
});
