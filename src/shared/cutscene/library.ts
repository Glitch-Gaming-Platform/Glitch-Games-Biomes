// HARTHMERE_CUTSCENE_LIBRARY
//
// Registry of authored cutscenes plus the trigger queue. The queue enforces
// the "never overlap" rule: one active scene, later requests queue by
// priority, duplicate ids are deduped, and a preempt flag lets a
// higher-priority scene (e.g. boss intro) abort the current one safely.

import type { CutsceneDef } from "@/shared/cutscene/schema";
import { validateCutsceneDef } from "@/shared/cutscene/schema";

export class CutsceneLibrary {
  private defs = new Map<string, CutsceneDef>();

  register(raw: unknown): CutsceneDef {
    const result = validateCutsceneDef(raw);
    if (!result.ok) {
      throw new Error(
        `invalid cutscene: ${result.issues
          .map((i) => `${i.path}: ${i.message}`)
          .join("; ")}`
      );
    }
    this.defs.set(result.def.id, result.def);
    return result.def;
  }

  get(id: string): CutsceneDef | undefined {
    return this.defs.get(id);
  }

  list(): CutsceneDef[] {
    return [...this.defs.values()];
  }

  clear(): void {
    this.defs.clear();
  }
}

export interface CutsceneRequest {
  def: CutsceneDef;
  /** Preempt the currently active scene if our priority is higher. */
  preempt?: boolean;
}

export interface CutsceneQueueDelegate {
  /** Ask the active scene to skip (it will drain through its finish path). */
  skipActive?(): void;
  /** Hard preemption is an abort, so unskippable scenes cannot block priority. */
  preemptActive?(): void;
}

export class CutsceneQueue {
  static readonly MAX_PENDING = 64;
  private queue: CutsceneRequest[] = [];
  private active: CutsceneDef | undefined;

  get activeDef(): CutsceneDef | undefined {
    return this.active;
  }

  get pending(): readonly CutsceneRequest[] {
    return this.queue;
  }

  /**
   * Request a scene. Returns the def to start now (if any). Duplicate ids
   * (already active or queued) are dropped — a trigger firing twice can never
   * double-play a scene.
   */
  request(
    req: CutsceneRequest,
    delegate?: CutsceneQueueDelegate
  ): CutsceneDef | undefined {
    if (this.active?.id === req.def.id) {
      return undefined;
    }
    if (this.queue.some((q) => q.def.id === req.def.id)) {
      return undefined;
    }
    if (!this.active) {
      this.active = req.def;
      return req.def;
    }
    if (this.queue.length >= CutsceneQueue.MAX_PENDING) {
      return undefined;
    }
    this.queue.push(req);
    this.queue.sort((a, b) => b.def.priority - a.def.priority);
    if (req.preempt && req.def.priority > this.active.priority) {
      if (delegate?.preemptActive) {
        delegate.preemptActive();
      } else {
        delegate?.skipActive?.();
      }
    }
    return undefined;
  }

  /** The active scene finished; returns the next scene to start (if any). */
  onFinished(): CutsceneDef | undefined {
    this.active = undefined;
    const next = this.queue.shift();
    if (next) {
      this.active = next.def;
      return next.def;
    }
    return undefined;
  }

  clear(): void {
    this.queue = [];
    this.active = undefined;
  }
}
