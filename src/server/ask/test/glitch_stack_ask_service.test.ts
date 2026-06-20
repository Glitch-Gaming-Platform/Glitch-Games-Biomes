import assert from "assert";
import { readFileSync } from "fs";
import path from "path";

describe("Glitch production Ask service wiring", () => {
  const root = process.cwd();
  const runner = readFileSync(
    path.join(root, "scripts/glitch/run-glitch-local-game-stack.sh"),
    "utf8"
  );
  const dockerfile = readFileSync(path.join(root, "Dockerfile.biomes"), "utf8");

  it("starts a dedicated Ask RPC service in the one-container stack", () => {
    assert.match(
      runner,
      /export ASK_SERVICE_HOST="\$\{ASK_SERVICE_HOST:-127\.0\.0\.1\}"/
    );
    assert.match(
      runner,
      /export ASK_SERVICE_PORT="\$\{ASK_SERVICE_PORT:-3604\}"/
    );
    assert.match(
      runner,
      /start_bg ask 127\.0\.0\.1 3600 3604 3601 "\$APP_ROOT\/dist\/ask\.js"/
    );
    assert.match(runner, /wait_tcp 127\.0\.0\.1 3604 ask-rpc/);
  });

  it("keeps Ask off the shared sync RPC fallback port", () => {
    assert.match(dockerfile, /ENV ASK_SERVICE_HOST=127\.0\.0\.1/);
    assert.match(dockerfile, /ENV ASK_SERVICE_PORT=3604/);
    assert.doesNotMatch(dockerfile, /ENV ASK_SERVICE_PORT=4904/);
  });
});
