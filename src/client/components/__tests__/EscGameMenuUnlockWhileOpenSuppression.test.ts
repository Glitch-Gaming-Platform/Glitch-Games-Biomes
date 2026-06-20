/// <reference types="mocha" />
/// <reference types="node" />

// HARTHMERE_UI: structural test for EscGameMenu's suppression behavior
// when an "unlock-while-open" panel (Jobs Board, Home Console, Business
// Interface, Crafting Station) is open. Those panels intentionally release
// pointer lock so the player can use the mouse; the escape menu must NOT
// render its "Return to Game" / "Give Feedback" overlay on top of them.
//
// We use a structural (source-text) check because EscGameMenu has deep
// `useClientContext` / `usePointerLockManager` dependencies that make a
// full render harness brittle. The hook itself is covered by
// `pointerLockUnlockWhileOpenSubscribe.test.ts`.

import assert from "assert";
import { readFileSync } from "fs";
import path from "path";

const ESC_GAME_MENU_PATH = path.join(
  process.cwd(),
  "src/client/components/EscGameMenu.tsx"
);

const HOOK_PATH = path.join(
  process.cwd(),
  "src/client/components/contexts/usePointerLockUnlockWhileOpenActive.ts"
);

const POLICY_PATH = path.join(
  process.cwd(),
  "src/client/components/contexts/pointerLockModalPolicy.ts"
);

describe("EscGameMenu unlock-while-open suppression (V147)", () => {
  it("imports the unlock-while-open active hook", () => {
    const source = readFileSync(ESC_GAME_MENU_PATH, "utf8");
    assert.ok(
      source.includes("usePointerLockUnlockWhileOpenActive"),
      "EscGameMenu must import usePointerLockUnlockWhileOpenActive"
    );
  });

  it("invokes the hook inside the component body", () => {
    const source = readFileSync(ESC_GAME_MENU_PATH, "utf8");
    assert.ok(
      /const\s+unlockWhileOpenActive\s*=\s*usePointerLockUnlockWhileOpenActive\s*\(\s*\)\s*;/.test(
        source
      ),
      "EscGameMenu must call usePointerLockUnlockWhileOpenActive() and store the result"
    );
  });

  it("early-returns an empty fragment while a panel holds the unlock policy", () => {
    const source = readFileSync(ESC_GAME_MENU_PATH, "utf8");
    assert.ok(
      /if\s*\(\s*unlockWhileOpenActive\s*\)\s*\{[\s\S]*?return\s+<>\s*<\/>\s*;?\s*\}/.test(
        source
      ),
      "EscGameMenu must early-return an empty fragment when unlockWhileOpenActive is true"
    );
  });

  it("places the suppression guard before the escape-menu render block so no buttons leak", () => {
    const source = readFileSync(ESC_GAME_MENU_PATH, "utf8");
    const guardIndex = source.indexOf("if (unlockWhileOpenActive)");
    const escControlsIndex = source.indexOf('className="esc-game-controls select-none"');
    assert.notEqual(guardIndex, -1, "guard must be present");
    assert.notEqual(escControlsIndex, -1, "escape menu render must be present");
    assert.ok(
      guardIndex < escControlsIndex,
      "guard must run before the escape menu's main render block"
    );
  });

  it("the hook reads the policy's depth and subscribes to its updates", () => {
    const source = readFileSync(HOOK_PATH, "utf8");
    assert.ok(
      source.includes("isPointerLockUnlockWhileOpenActive"),
      "hook must read the policy's active flag"
    );
    assert.ok(
      source.includes("subscribePointerLockUnlockWhileOpen"),
      "hook must subscribe to policy depth transitions"
    );
    assert.ok(
      /React\.useEffect\(/.test(source),
      "hook must register the subscription inside a useEffect so it cleans up on unmount"
    );
  });

  it("the policy module exports a subscriber API for the hook to consume", () => {
    const source = readFileSync(POLICY_PATH, "utf8");
    assert.ok(
      /export\s+function\s+subscribePointerLockUnlockWhileOpen/.test(source),
      "policy must export subscribePointerLockUnlockWhileOpen"
    );
    assert.ok(
      source.includes("notifyPointerLockUnlockWhileOpenSubscribers"),
      "policy must invoke its subscriber notifier on depth changes"
    );
  });
});
