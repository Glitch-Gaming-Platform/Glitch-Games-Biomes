// CHAPTER_1_CUTSCENE_PLAYBACK
//
// Most objectives play one scene. Act 6's consolidation is deliberately a
// three-scene sequence: ledger revision, the exact fair-play corridor re-render,
// then the fourteen-hour intake memory. This small client coordinator advances
// only after a scene genuinely completes; accessibility skip cancels the rest
// of the sequence instead of trapping the player in two more cinematics.

import { requestCutsceneById } from "@/client/game/cutscene/cutscene_service";
import { subscribeCutscenePlayback } from "@/client/game/cutscene/playback_events";
import {
  CH1_CONSOLIDATION_PLAYBACK_SEQUENCE,
  CH1_SCENE_IDS,
} from "@/shared/cutscene/ch1_scenes";
import { log } from "@/shared/logging";

let activeSequenceToken = 0;

export function chapter1CutscenePlaybackIds(id: string): readonly string[] {
  return id === CH1_SCENE_IDS.consolidationRevision
    ? CH1_CONSOLIDATION_PLAYBACK_SEQUENCE
    : [id];
}

export function requestChapter1CutsceneById(
  id: string,
  opts: { preempt?: boolean } = {}
): boolean {
  const ids = chapter1CutscenePlaybackIds(id);
  if (ids.length === 1) {
    activeSequenceToken += 1;
    return requestCutsceneById(ids[0], opts);
  }

  const token = ++activeSequenceToken;
  let index = 0;
  let unsubscribe = () => {};
  const requestCurrent = () => {
    const accepted = requestCutsceneById(ids[index], {
      preempt: index === 0 ? opts.preempt : false,
    });
    if (!accepted) {
      unsubscribe();
      log.warn("Chapter 1 cutscene sequence could not continue", {
        id: ids[index],
        sequence: ids,
      });
    }
    return accepted;
  };

  unsubscribe = subscribeCutscenePlayback((event) => {
    if (
      token !== activeSequenceToken ||
      event.kind !== "finished" ||
      event.defId !== ids[index]
    ) {
      return;
    }
    if (event.reason !== "completed" || index >= ids.length - 1) {
      unsubscribe();
      return;
    }
    index += 1;
    requestCurrent();
  });

  return requestCurrent();
}
