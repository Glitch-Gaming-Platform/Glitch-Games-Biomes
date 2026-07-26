// HARTHMERE_CUTSCENE_OVERLAY
//
// Letterbox bars, subtitles, and the skip/advance prompts for a running
// cutscene. Subtitles always render (accessibility); ESC requests skip;
// Space/click requests dialogue advance only while a `playerInput` shot is
// actually accepting input.

import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { VoiceChat } from "@/client/components/system/VoiceChat";
import type { CutsceneSubtitle } from "@/client/game/resources/cutscene";
import React, { useEffect, useState } from "react";

const BAR_STYLE: React.CSSProperties = {
  position: "fixed",
  left: 0,
  right: 0,
  height: "12vh",
  background: "#000",
  zIndex: 900,
  pointerEvents: "none",
  transition: "transform 400ms ease-in-out",
};

export function nextCutsceneSpokenSubtitleForTest(input: {
  active: boolean;
  current?: CutsceneSubtitle;
  subtitle?: CutsceneSubtitle;
}) {
  if (!input.active) {
    return undefined;
  }
  if (input.subtitle) {
    // An explicit player/narration subtitle interrupts any prior NPC line.
    return input.subtitle.voice ? input.subtitle : undefined;
  }
  // A short clear gap between shots should not cut off an otherwise valid MP3.
  return input.current;
}

export const CutsceneOverlay: React.FunctionComponent = () => {
  const { reactResources } = useClientContext();
  const state = reactResources.use("/scene/cutscene");
  const [spokenSubtitle, setSpokenSubtitle] = useState<
    CutsceneSubtitle | undefined
  >();

  useEffect(() => {
    setSpokenSubtitle((current) =>
      nextCutsceneSpokenSubtitleForTest({
        active: state.active,
        current,
        subtitle: state.subtitle,
      })
    );
  }, [
    state.active,
    state.subtitle?.speaker,
    state.subtitle?.text,
    state.subtitle?.voice,
  ]);

  useEffect(() => {
    if (!state.active) {
      return;
    }
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat) {
        if (state.lockInput) {
          event.preventDefault();
          event.stopPropagation();
        }
        return;
      }
      if (event.code === "Escape") {
        reactResources.update("/scene/cutscene", (s) => {
          s.skipRequested = true;
        });
        event.preventDefault();
        event.stopPropagation();
      } else if (
        state.canAdvance &&
        (event.code === "Space" || event.code === "Enter")
      ) {
        reactResources.update("/scene/cutscene", (s) => {
          s.advanceRequested = true;
        });
        event.preventDefault();
        event.stopPropagation();
      } else if (state.lockInput) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    const onPointerDown = (event: PointerEvent) => {
      if (state.canAdvance) {
        reactResources.update("/scene/cutscene", (s) => {
          s.advanceRequested = true;
        });
      }
      if (state.canAdvance || state.lockInput) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    // Capture phase prevents gameplay/global shortcuts from observing input
    // while the cutscene owns controls.
    window.addEventListener("keydown", onKeyDown, true);
    window.addEventListener("pointerdown", onPointerDown, true);
    return () => {
      window.removeEventListener("keydown", onKeyDown, true);
      window.removeEventListener("pointerdown", onPointerDown, true);
    };
  }, [state.active, state.canAdvance, state.lockInput, reactResources]);

  if (!state.active) {
    return <></>;
  }

  return (
    <>
      {spokenSubtitle?.voice && (
        <VoiceChat
          text={spokenSubtitle.text}
          voice={spokenSubtitle.voice}
          playbackKey={`cutscene:${state.defId ?? "unknown"}:${
            spokenSubtitle.speaker ?? "npc"
          }:${spokenSubtitle.text}`}
        />
      )}
      {state.letterbox && (
        <>
          <div style={{ ...BAR_STYLE, top: 0 }} />
          <div style={{ ...BAR_STYLE, bottom: 0 }} />
        </>
      )}
      {state.subtitle && (
        <div
          role="status"
          aria-live="polite"
          aria-atomic="true"
          style={{
            position: "fixed",
            bottom: "14vh",
            left: 0,
            right: 0,
            textAlign: "center",
            zIndex: 901,
            pointerEvents: "none",
          }}
        >
          <span
            style={{
              display: "inline-block",
              maxWidth: "60vw",
              padding: "0.4em 1em",
              background: "rgba(0,0,0,0.65)",
              color: "#fff",
              borderRadius: "0.3em",
              fontSize: "1.1em",
              lineHeight: 1.4,
            }}
          >
            {state.subtitle.speaker ? (
              <strong style={{ color: "#ffd97a", marginRight: "0.5em" }}>
                {state.subtitle.speaker}:
              </strong>
            ) : null}
            {state.subtitle.text}
          </span>
        </div>
      )}
      {state.canSkip && (
        <div
          style={{
            position: "fixed",
            top: "2vh",
            right: "2vw",
            zIndex: 901,
            color: "rgba(255,255,255,0.7)",
            fontSize: "0.9em",
            pointerEvents: "none",
          }}
        >
          ESC to skip
        </div>
      )}
      {state.canAdvance && (
        <div
          style={{
            position: "fixed",
            bottom: state.subtitle ? "9vh" : "4vh",
            left: 0,
            right: 0,
            zIndex: 901,
            textAlign: "center",
            color: "rgba(255,255,255,0.75)",
            fontSize: "0.9em",
            pointerEvents: "none",
          }}
        >
          Space or click to continue
        </div>
      )}
      <div
        data-cutscene-fade="true"
        style={{
          position: "fixed",
          inset: 0,
          zIndex: 999,
          pointerEvents: "none",
          background: "#000",
          opacity: state.fadeOpacity,
          transition: `opacity ${state.fadeTransitionMs}ms linear`,
        }}
      />
    </>
  );
};
