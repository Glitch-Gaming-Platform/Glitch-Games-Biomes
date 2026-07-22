import assert from "assert";
import { planHarthmereLiveMutationTelemetry } from "@/client/components/harthmere_live_fetch";
import {
  HARTHMERE_GLITCH_DASHBOARD_FUNNELS,
  resolveHarthmereGlitchEventText,
} from "@/client/game/glitch/harthmere_glitch_event_catalog";
import {
  HARTHMERE_GLITCH_GARDEN_HOSE_BEHAVIORS,
  HARTHMERE_GLITCH_LIVE_ACTION_BEHAVIORS,
  HARTHMERE_GLITCH_LIVE_OPERATION_BEHAVIORS,
  HARTHMERE_GLITCH_STATE_CHANGE_BEHAVIORS,
} from "@/client/game/glitch/harthmere_glitch_tracking_manifest";

function assertHumanReadable(value: string, context: string) {
  assert(value.trim().length > 0, `${context} should not be empty`);
  assert(!value.includes("_"), `${context} should not expose a raw key`);
}

describe("Harthmere Glitch behavior tracking manifest", () => {
  it("resolves human-readable text for every GardenHose behavior", () => {
    for (const [eventName, definition] of Object.entries(
      HARTHMERE_GLITCH_GARDEN_HOSE_BEHAVIORS
    )) {
      const text = resolveHarthmereGlitchEventText(
        definition.stepKey,
        definition.actionKey
      );
      assertHumanReadable(text.step_label, `${eventName} step label`);
      assertHumanReadable(
        text.step_description,
        `${eventName} step description`
      );
      assertHumanReadable(text.event_label, `${eventName} event label`);
      assertHumanReadable(
        text.event_description,
        `${eventName} event description`
      );
    }
  });

  it("resolves human-readable text for every persisted state signal", () => {
    for (const [
      eventName,
      stepKey,
      actionKey,
    ] of HARTHMERE_GLITCH_STATE_CHANGE_BEHAVIORS) {
      const text = resolveHarthmereGlitchEventText(stepKey, actionKey);
      assertHumanReadable(text.step_label, `${eventName} step label`);
      assertHumanReadable(text.event_label, `${eventName} event label`);
    }
  });

  it("covers every live action kind and excludes only autonomous server ticks", () => {
    const automated: string[] = [];
    for (const [actionKind, definition] of Object.entries(
      HARTHMERE_GLITCH_LIVE_ACTION_BEHAVIORS
    )) {
      const plan = planHarthmereLiveMutationTelemetry({
        method: "POST",
        body: JSON.stringify({
          actionKind,
          subsystem: definition.stepKey,
          payload: {},
        }),
      });
      if (!definition.playerBehavior) {
        automated.push(actionKind);
        assert.equal(plan, undefined);
        continue;
      }
      assert(plan, `${actionKind} should produce a telemetry plan`);
      assert.equal(plan.label, definition.label);
      assert.equal(plan.description, definition.description);
      assertHumanReadable(plan.label, `${actionKind} live action label`);
    }
    assert.deepEqual(automated.sort(), [
      "request_boss_tick",
      "request_npc_ai_tick",
    ]);
  });

  it("uses canonical action text that does not change between steps", () => {
    const combat = resolveHarthmereGlitchEventText("combat_action", "success");
    const crafting = resolveHarthmereGlitchEventText("crafting", "success");
    assert.equal(combat.event_label, crafting.event_label);
    assert.equal(combat.event_description, crafting.event_description);
  });

  it("uses one canonical label and description for each shared step_key", () => {
    const definitions = new Map<
      string,
      { label: string; description: string; source: string }
    >();
    const add = (
      stepKey: string,
      label: string,
      description: string,
      source: string
    ) => {
      const previous = definitions.get(stepKey);
      if (previous) {
        assert.equal(
          label,
          previous.label,
          `${stepKey} label differs between ${previous.source} and ${source}`
        );
        assert.equal(
          description,
          previous.description,
          `${stepKey} description differs between ${previous.source} and ${source}`
        );
      } else {
        definitions.set(stepKey, { label, description, source });
      }
    };

    for (const [eventName, definition] of Object.entries(
      HARTHMERE_GLITCH_GARDEN_HOSE_BEHAVIORS
    )) {
      const text = resolveHarthmereGlitchEventText(
        definition.stepKey,
        definition.actionKey
      );
      add(
        definition.stepKey,
        text.step_label,
        text.step_description,
        `GardenHose ${eventName}`
      );
    }
    for (const [
      eventName,
      stepKey,
      actionKey,
    ] of HARTHMERE_GLITCH_STATE_CHANGE_BEHAVIORS) {
      const text = resolveHarthmereGlitchEventText(stepKey, actionKey);
      add(stepKey, text.step_label, text.step_description, eventName);
    }
    for (const [actionKind, definition] of Object.entries(
      HARTHMERE_GLITCH_LIVE_ACTION_BEHAVIORS
    )) {
      add(
        definition.stepKey,
        definition.label,
        definition.description,
        actionKind
      );
    }
    for (const [operation, definition] of Object.entries(
      HARTHMERE_GLITCH_LIVE_OPERATION_BEHAVIORS
    )) {
      add(
        definition.stepKey,
        definition.label,
        definition.description,
        operation
      );
    }
  });

  it("defines dashboard funnels with labeled step_key objects", () => {
    assert(HARTHMERE_GLITCH_DASHBOARD_FUNNELS.length >= 5);
    for (const funnel of HARTHMERE_GLITCH_DASHBOARD_FUNNELS) {
      assert(funnel.name.trim());
      assert(funnel.description.trim());
      assert(funnel.steps.length >= 2);
      for (const step of funnel.steps) {
        assert(step.step_key.trim());
        assertHumanReadable(step.label, `${funnel.name} step label`);
        assertHumanReadable(
          step.description,
          `${funnel.name} step description`
        );
      }
    }
  });
});
