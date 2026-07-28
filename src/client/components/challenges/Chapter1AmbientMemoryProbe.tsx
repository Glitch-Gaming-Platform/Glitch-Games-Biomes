// CHAPTER_1_AMBIENT_MEMORY_PROBE
//
// The client half of the ambient fragment trigger system.
//
// Chapter 1's memory model is that fragments arrive because of where you are,
// what you are holding, what your hands just did, or how close you came to
// dying — not because a quest step completed. The authored table lives in
// ch1_fragment_triggers.ts and the DECISION lives on the server: this component
// only reports "a place/sleep/stress trigger may have fired near me", and the
// authenticated route re-reads real position, health, inventory, and flags
// before delivering anything.
//
// Deliberate properties:
//   * single-flight, and at most one candidate report per tick, so a player
//     standing in a radius does not spam the route;
//   * silent on refusal — "you are not standing where this happened" is the
//     normal case and is never surfaced as an error;
//   * no local ledger state at all, so a lying client gains nothing.

import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { defaultHarthmereLiveFetch } from "@/client/components/harthmere_live_fetch";
import { harthmereJobsBoardPlayerPosition } from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import {
  CH1_AMBIENT_FRAGMENT_TRIGGERS,
  CH1_AMBIENT_TRIGGER_RADIUS,
  CH1_STRESS_HEALTH_FRACTION,
  type Ch1AmbientTriggerKind,
} from "@/shared/harthmere/ch1_fragment_triggers";
import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import React, { useCallback, useEffect, useRef } from "react";

const PROBE_INTERVAL_MS = 4_000;

/** Kinds this component can honestly observe from the client. */
const OBSERVABLE_KINDS: readonly Ch1AmbientTriggerKind[] = [
  "place",
  "sound",
  "face",
  "object",
  "stress",
];

function distance3(
  a: readonly [number, number, number],
  b: readonly [number, number, number]
) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

async function reportTrigger(fragmentId: string, kind: Ch1AmbientTriggerKind) {
  const response = await defaultHarthmereLiveFetch(
    "/api/harthmere/chapter1_story",
    {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ action: "trigger", fragmentId, kind }),
    cache: "no-store",
    }
  );
  if (!response.ok) return false;
  const payload = (await response.json()) as {
    ok?: boolean;
    ledger?: { entries?: Array<{ fragmentId: string }> };
    augur9?: { availableLogs?: Array<{ fragmentId: string }> };
  };
  return (
    payload.ok === true &&
    ((payload.ledger?.entries ?? []).some(
      (entry) => entry.fragmentId === fragmentId
    ) ||
      (payload.augur9?.availableLogs ?? []).some(
        (entry) => entry.fragmentId === fragmentId
      ))
  );
}

export const Chapter1AmbientMemoryProbe: React.FunctionComponent = () => {
  const { reactResources, userId } = useClientContext();
  const inFlight = useRef(false);
  // Fragments this session has already reported successfully. The server is
  // idempotent regardless; this only avoids pointless requests.
  const delivered = useRef(new Set<string>());
  const attempted = useRef(new Map<string, number>());

  const probe = useCallback(async () => {
    if (inFlight.current) return;
    const point = harthmereJobsBoardPlayerPosition(
      reactResources.get("/scene/local_player") as unknown,
      reactResources.get("/scene/camera") as unknown
    );
    if (!point) return;
    const position: [number, number, number] = [point.x, point.y ?? 0, point.z];

    const health = reactResources.get("/ecs/c/health", userId);
    const maxHp = Number(health?.maxHp ?? 0);
    const healthFraction =
      health && maxHp > 0 ? Number(health.hp) / maxHp : undefined;

    const now = Date.now();
    const candidate = CH1_AMBIENT_FRAGMENT_TRIGGERS.find((trigger) => {
      if (!OBSERVABLE_KINDS.includes(trigger.kind)) return false;
      if (delivered.current.has(trigger.fragmentId)) return false;
      // Back off after a refusal: most refusals are "you have not reached this
      // part of the story", which will not change in the next four seconds.
      const lastTry = attempted.current.get(trigger.fragmentId) ?? 0;
      if (now - lastTry < 60_000) return false;
      if (trigger.kind === "stress") {
        const threshold =
          trigger.maxHealthFraction ?? CH1_STRESS_HEALTH_FRACTION;
        return healthFraction !== undefined && healthFraction <= threshold;
      }
      if (!trigger.anchors || trigger.anchors.length === 0) {
        // Object/skill triggers have no place; the server decides entirely.
        return true;
      }
      const radius = trigger.radius ?? CH1_AMBIENT_TRIGGER_RADIUS;
      return trigger.anchors.some(
        (anchor) => distance3(position, CH1_ANCHORS[anchor]) <= radius
      );
    });
    if (!candidate) return;

    inFlight.current = true;
    attempted.current.set(candidate.fragmentId, now);
    try {
      if (await reportTrigger(candidate.fragmentId, candidate.kind)) {
        delivered.current.add(candidate.fragmentId);
        window.dispatchEvent(new CustomEvent("chapter1-story-updated"));
      }
    } catch {
      // A refusal or a dropped request is the normal case. Stay silent.
    } finally {
      inFlight.current = false;
    }
  }, [reactResources, userId]);

  useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") void probe();
    }, PROBE_INTERVAL_MS);
    return () => window.clearInterval(timer);
  }, [probe]);

  if (!nativeBiomesEcsAuthorityEnabled()) return null;
  return <span className="hidden" data-chapter1-ambient-probe="ready" />;
};
