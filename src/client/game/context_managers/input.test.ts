/// <reference types="mocha" />

import {
  Bindings,
  Input,
  defaultBindings,
} from "@/client/game/context_managers/input";
import assert from "assert";

class FakeEventTarget {
  private readonly listeners = new Map<string, Set<(event: any) => void>>();

  addEventListener(name: string, fn: (event: any) => void) {
    const listeners = this.listeners.get(name) ?? new Set();
    listeners.add(fn);
    this.listeners.set(name, listeners);
  }

  removeEventListener(name: string, fn: (event: any) => void) {
    this.listeners.get(name)?.delete(fn);
  }

  listenerCount(name: string) {
    return this.listeners.get(name)?.size ?? 0;
  }

  emit(name: string, event: any = {}) {
    for (const fn of this.listeners.get(name) ?? []) {
      fn(event);
    }
  }
}

function fakeKeyboardEvent(
  code: string,
  target?: unknown,
  options: { repeat?: boolean } = {}
) {
  return {
    code,
    target,
    repeat: options.repeat ?? false,
    ctrlKey: false,
    altKey: false,
    metaKey: false,
    shiftKey: false,
  };
}

function fakeInputSetup() {
  const documentTarget = new FakeEventTarget() as FakeEventTarget & {
    defaultView: FakeEventTarget;
  };
  const windowTarget = new FakeEventTarget();
  const canvasTarget = new FakeEventTarget() as FakeEventTarget & {
    ownerDocument: FakeEventTarget & { defaultView: FakeEventTarget };
  };
  documentTarget.defaultView = windowTarget;
  canvasTarget.ownerDocument = documentTarget;

  const bindings = new Bindings<"forward" | "jump" | "run">();
  bindings.bindKey("KeyW").toMotion("forward", 1);
  bindings.bindKey("KeyW").toAction("jump");
  bindings.bindKey("ShiftLeft").toMotion("run", 1);
  bindings.bindVirtualJoyconMove("left", "y").toMotion("forward", 1, "render");
  const input = new Input(bindings);
  input.attach(canvasTarget as unknown as HTMLElement);

  return { canvasTarget, documentTarget, input, windowTarget };
}

function fakeDefaultInputSetup() {
  const documentTarget = new FakeEventTarget() as FakeEventTarget & {
    defaultView: FakeEventTarget;
  };
  const windowTarget = new FakeEventTarget();
  const canvasTarget = new FakeEventTarget() as FakeEventTarget & {
    ownerDocument: FakeEventTarget & { defaultView: FakeEventTarget };
  };
  documentTarget.defaultView = windowTarget;
  canvasTarget.ownerDocument = documentTarget;
  const input = new Input(defaultBindings({}));
  input.attach(canvasTarget as unknown as HTMLElement);
  return { canvasTarget, documentTarget, input, windowTarget };
}

describe("Input", () => {
  it("binds Z to crouch, E to dodge, and Q to evade", () => {
    const { documentTarget, input } = fakeDefaultInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyZ"));
    assert.equal(input.motion("crouch"), 1);
    documentTarget.emit("keyup", fakeKeyboardEvent("KeyZ"));
    assert.equal(input.motion("crouch"), 0);

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyE"));
    assert.equal(input.action("dodge"), true);
    assert.equal(input.action("evade"), false);
    documentTarget.emit("keyup", fakeKeyboardEvent("KeyE"));
    assert.equal(input.action("dodge"), false);

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyQ"));
    assert.equal(input.action("evade"), true);
    assert.equal(input.action("dodge"), false);
    documentTarget.emit("keyup", fakeKeyboardEvent("KeyQ"));
    assert.equal(input.action("evade"), false);
  });

  it("does not repeat dodge or evade while their key remains held", () => {
    const { documentTarget, input } = fakeDefaultInputSetup();
    let dodges = 0;
    let evades = 0;
    input.emitter.on("dodge", () => (dodges += 1));
    input.emitter.on("evade", () => (evades += 1));

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyE"));
    documentTarget.emit(
      "keydown",
      fakeKeyboardEvent("KeyE", undefined, { repeat: true })
    );
    documentTarget.emit("keydown", fakeKeyboardEvent("KeyQ"));
    documentTarget.emit(
      "keydown",
      fakeKeyboardEvent("KeyQ", undefined, { repeat: true })
    );
    assert.equal(dodges, 1);
    assert.equal(evades, 1);
  });

  it("latches a quick desktop dodge or evade tap until the script consumes it", () => {
    const { documentTarget, input } = fakeDefaultInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyE"));
    documentTarget.emit("keyup", fakeKeyboardEvent("KeyE"));
    assert.equal(input.action("dodge"), false);
    assert.equal(input.consumeActionPress("dodge"), true);
    assert.equal(input.consumeActionPress("dodge"), false);

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyQ"));
    documentTarget.emit("keyup", fakeKeyboardEvent("KeyQ"));
    assert.equal(input.action("evade"), false);
    assert.equal(input.consumeActionPress("evade"), true);
    assert.equal(input.consumeActionPress("evade"), false);
  });

  it("does not queue another one-shot action while its key remains held", () => {
    const { documentTarget, input } = fakeDefaultInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyE"));
    assert.equal(input.consumeActionPress("dodge"), true);
    documentTarget.emit(
      "keydown",
      fakeKeyboardEvent("KeyE", undefined, { repeat: true })
    );
    assert.equal(input.consumeActionPress("dodge"), false);

    documentTarget.emit("keyup", fakeKeyboardEvent("KeyE"));
    documentTarget.emit("keydown", fakeKeyboardEvent("KeyE"));
    assert.equal(input.consumeActionPress("dodge"), true);
  });

  it("does not steal modified Z, E, or Q browser shortcuts", () => {
    const { documentTarget, input } = fakeDefaultInputSetup();

    documentTarget.emit("keydown", {
      ...fakeKeyboardEvent("KeyZ"),
      metaKey: true,
    });
    documentTarget.emit("keydown", {
      ...fakeKeyboardEvent("KeyE"),
      ctrlKey: true,
    });
    documentTarget.emit("keydown", {
      ...fakeKeyboardEvent("KeyQ"),
      altKey: true,
    });

    assert.equal(input.motion("crouch"), 0);
    assert.equal(input.action("dodge"), false);
    assert.equal(input.action("evade"), false);
  });

  it("translates the mobile movement joystick into forward motion", () => {
    const { input } = fakeInputSetup();

    input.moveVirtualJoycon("left", 0, 0.75);
    assert.equal(input.motion("forward"), 0.75);

    input.tick("render");
    assert.equal(input.motion("forward"), 0);
  });

  it("combines independent synthetic motion sources with physical input", () => {
    const { documentTarget, input } = fakeInputSetup();

    input.setSyntheticMotion("forward", "hotbar", 1);
    assert.equal(input.motion("forward"), 1);

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 2);

    input.setSyntheticMotion("forward", "hotbar", 0);
    assert.equal(input.motion("forward"), 1);
  });

  it("can isolate one named synthetic source from the combined motion", () => {
    const { documentTarget, input } = fakeInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("ShiftLeft"));
    input.setSyntheticMotion("run", "mobile-joystick", -1);
    input.setSyntheticMotion("run", "accessibility", 0.5);

    assert.equal(input.syntheticMotion("run", "mobile-joystick"), -1);
    assert.equal(
      input.motionWithoutSyntheticSource("run", "mobile-joystick"),
      1.5
    );
  });

  it("pulses a synthetic motion and releases it after the requested duration", async () => {
    const { input } = fakeInputSetup();

    const pulse = input.pulseMotion("forward", 1, "hotbar");
    assert.equal(input.motion("forward"), 1);
    await pulse;
    assert.equal(input.motion("forward"), 0);
  });

  it("combines independent synthetic action sources without releasing physical input", () => {
    const { documentTarget, input } = fakeDefaultInputSetup();
    let emitted = 0;
    input.emitter.on("evade", () => (emitted += 1));

    input.setSyntheticAction("evade", "mobile-a", true);
    input.setSyntheticAction("evade", "mobile-a", true);
    input.setSyntheticAction("evade", "mobile-b", true);
    assert.equal(input.action("evade"), true);
    assert.equal(emitted, 1);

    input.setSyntheticAction("evade", "mobile-a", false);
    assert.equal(input.action("evade"), true);
    input.setSyntheticAction("evade", "mobile-b", false);
    assert.equal(input.action("evade"), false);

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyQ"));
    input.setSyntheticAction("evade", "mobile-a", true);
    input.setSyntheticAction("evade", "mobile-a", false);
    assert.equal(input.action("evade"), true);
    documentTarget.emit("keyup", fakeKeyboardEvent("KeyQ"));
    assert.equal(input.action("evade"), false);
  });

  it("pulses a synthetic action and releases it after the requested duration", async () => {
    const { input } = fakeDefaultInputSetup();

    const pulse = input.pulseAction("evade", 1, "mobile-joystick");
    assert.equal(input.action("evade"), true);
    await pulse;
    assert.equal(input.action("evade"), false);
    assert.equal(input.consumeActionPress("evade"), true);
    assert.equal(input.consumeActionPress("evade"), false);
  });

  it("clears synthetic motion when input state is detached", () => {
    const { input } = fakeInputSetup();

    input.setSyntheticMotion("forward", "hotbar", 1);
    input.detach();

    assert.equal(input.motion("forward"), 0);
  });

  it("clears synthetic actions when input state is detached", () => {
    const { input } = fakeDefaultInputSetup();

    input.setSyntheticAction("evade", "mobile-joystick", true);
    input.detach();

    assert.equal(input.action("evade"), false);
    assert.equal(input.consumeActionPress("evade"), false);
  });

  it("captures keyboard motion from the owner document while attached to a canvas", () => {
    const { documentTarget, input } = fakeInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 1);

    documentTarget.emit("keyup", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 0);
  });

  it("captures keyboard motion when focus is on a non-text UI control", () => {
    const { documentTarget, input } = fakeInputSetup();

    documentTarget.emit(
      "keydown",
      fakeKeyboardEvent("KeyW", { tagName: "BUTTON" })
    );
    assert.equal(input.motion("forward"), 1);
  });

  for (const target of [
    { tagName: "INPUT" },
    { tagName: "TEXTAREA" },
    { tagName: "SELECT" },
    { tagName: "DIV", isContentEditable: true },
  ]) {
    it(`does not start keyboard motion from ${target.tagName.toLowerCase()} targets`, () => {
      const { documentTarget, input } = fakeInputSetup();

      documentTarget.emit("keydown", fakeKeyboardEvent("KeyW", target));
      assert.equal(input.motion("forward"), 0);
    });
  }

  it("still clears keyboard motion when keyup occurs after focus moves to text entry", () => {
    const { documentTarget, input } = fakeInputSetup();

    documentTarget.emit(
      "keydown",
      fakeKeyboardEvent("KeyW", { tagName: "BUTTON" })
    );
    assert.equal(input.motion("forward"), 1);

    documentTarget.emit(
      "keyup",
      fakeKeyboardEvent("KeyW", { tagName: "INPUT" })
    );
    assert.equal(input.motion("forward"), 0);
  });

  it("clears active keyboard motion when the window blurs", () => {
    const { documentTarget, input, windowTarget } = fakeInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 1);

    windowTarget.emit("blur");
    assert.equal(input.motion("forward"), 0);
  });

  it("clears active keyboard motion when the document visibility changes", () => {
    const { documentTarget, input } = fakeInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 1);

    documentTarget.emit("visibilitychange");
    assert.equal(input.motion("forward"), 0);
  });

  it("allows the same key to become active again after blur clears downKeys", () => {
    const { documentTarget, input, windowTarget } = fakeInputSetup();

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 1);

    windowTarget.emit("blur");
    assert.equal(input.motion("forward"), 0);

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 1);
  });

  it("does not emit repeat actions until the key is released", () => {
    const { documentTarget, input } = fakeInputSetup();
    let actions = 0;
    input.emitter.on("jump", () => {
      actions += 1;
    });

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    documentTarget.emit(
      "keydown",
      fakeKeyboardEvent("KeyW", undefined, { repeat: true })
    );
    assert.equal(actions, 1);

    documentTarget.emit("keyup", fakeKeyboardEvent("KeyW"));
    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(actions, 2);
  });

  it("recovers action keys when a keyup was missed before a fresh keydown", () => {
    const { documentTarget, input } = fakeInputSetup();
    let actions = 0;
    input.emitter.on("jump", () => {
      actions += 1;
    });

    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));

    assert.equal(actions, 2);
  });

  it("keeps movement active when a modifier key is held", () => {
    const { documentTarget, input } = fakeInputSetup();

    documentTarget.emit("keydown", {
      ...fakeKeyboardEvent("ShiftLeft"),
      shiftKey: true,
    });
    documentTarget.emit("keydown", {
      ...fakeKeyboardEvent("KeyW"),
      shiftKey: true,
    });

    assert.equal(input.motion("run"), 1);
    assert.equal(input.motion("forward"), 1);
  });

  it("removes document and window listeners when detached", () => {
    const { documentTarget, input, windowTarget } = fakeInputSetup();
    assert.equal(documentTarget.listenerCount("keydown"), 1);
    assert.equal(documentTarget.listenerCount("keyup"), 1);
    assert.equal(windowTarget.listenerCount("blur"), 1);

    input.detach();

    assert.equal(documentTarget.listenerCount("keydown"), 0);
    assert.equal(documentTarget.listenerCount("keyup"), 0);
    assert.equal(windowTarget.listenerCount("blur"), 0);
    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(input.motion("forward"), 0);
  });

  it("does not duplicate listeners after detach and reattach", () => {
    const { canvasTarget, documentTarget, input } = fakeInputSetup();
    let actions = 0;
    input.emitter.on("jump", () => {
      actions += 1;
    });

    input.detach();
    input.attach(canvasTarget as unknown as HTMLElement);

    assert.equal(documentTarget.listenerCount("keydown"), 1);
    documentTarget.emit("keydown", fakeKeyboardEvent("KeyW"));
    assert.equal(actions, 1);
  });
});
