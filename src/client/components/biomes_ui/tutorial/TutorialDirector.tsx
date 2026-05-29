// TutorialDirector — listens to the mission state and emits highlight
// requests for the current step. Designed to be mounted ONCE at the top
// of the BiomesUI tree (or alongside it) — it does not render any UI of
// its own.
//
// Decouples cleanly: the director receives a `currentStep` (target, trigger)
// from whatever mission system the host uses. The Snapshot/Harthmere
// mission systems both already publish this; the host wires whichever
// one is active.

import * as React from "react";
import { useEffect, useRef } from "react";
import {
  clearHighlight,
  requestHighlight,
} from "../highlight/HighlightRegistry";
import type { BlinkCue, StepTarget, StepTrigger } from "./tutorialMissionMap";
import { cuesForStep } from "./tutorialMissionMap";

export interface CurrentStep {
  stepId: string;
  target: StepTarget;
  trigger: StepTrigger;
  cues?: BlinkCue[];
}

interface TutorialDirectorProps {
  /** The active step, or null when no tutorial step is in progress. */
  step: CurrentStep | null;
  /** Whether the user has opted out of tutorial highlights. */
  disabled?: boolean;
}

export const TutorialDirector: React.FC<TutorialDirectorProps> = ({ step, disabled }) => {
  const activeCuesRef = useRef<BlinkCue[]>([]);

  useEffect(() => {
    // Clear any cues from the previous step.
    for (const c of activeCuesRef.current) clearHighlight(c.uniqueId);
    activeCuesRef.current = [];

    if (disabled || !step) return;

    const cues = step.cues?.length
      ? step.cues
      : cuesForStep(step.target, step.trigger);
    activeCuesRef.current = cues;
    for (const cue of cues) {
      requestHighlight({
        uniqueId: cue.uniqueId,
        style: cue.style ?? "pulse",
        durationMs: cue.durationMs ?? 0,
        caption: cue.caption,
        source: `tutorial:${step.stepId}`,
      });
    }

    return () => {
      for (const c of cues) clearHighlight(c.uniqueId);
    };
  }, [step?.stepId, step?.target, step?.trigger, disabled]);

  return null;
};
