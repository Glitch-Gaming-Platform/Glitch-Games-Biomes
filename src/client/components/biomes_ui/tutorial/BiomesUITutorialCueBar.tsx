import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

const CUES: readonly { id: string; label: string; hint: string }[] = [
  { id: UI_IDS.CUE_SPRINT, label: "Sprint", hint: "Shift" },
  { id: UI_IDS.CUE_JUMP, label: "Jump", hint: "Space" },
  { id: UI_IDS.HUD_CHAT_BUTTON, label: "Chat", hint: "Enter" },
  { id: UI_IDS.CAMERA_BUTTON, label: "Camera", hint: "Photo" },
  { id: UI_IDS.CAMERA_SELFIE_MODE, label: "Selfie", hint: "Flip" },
  { id: UI_IDS.RECIPE_LIST, label: "Recipes", hint: "Craft" },
  { id: UI_IDS.RECIPE_MUCK_BUSTER, label: "Muck Buster", hint: "Recipe" },
];

export const BiomesUITutorialCueBar: React.FunctionComponent<{}> = () => {
  return (
    <div
      className="biomes-ui-panel"
      style={{
        position: "fixed",
        left: 12,
        bottom: 110,
        zIndex: 1088,
        display: "flex",
        flexDirection: "column",
        gap: 6,
        padding: 8,
        pointerEvents: "auto",
        maxWidth: "min(15rem, calc(100vw - 1.5rem))",
      }}
      aria-label="Tutorial action cues"
    >
      {CUES.map((cue) => (
        <Highlightable key={cue.id} uniqueId={cue.id} showCaption>
          <button
            type="button"
            className="biomes-ui-tab"
            style={{
              display: "flex",
              justifyContent: "space-between",
              gap: 10,
              border: "1px solid var(--biomes-edge-cyan-soft)",
              background: "rgba(7, 12, 26, 0.72)",
              borderRadius: 4,
            }}
            aria-label={`${cue.label} tutorial cue`}
          >
            <span>{cue.label}</span>
            <span style={{ color: "var(--biomes-fg-muted)", fontSize: 10 }}>{cue.hint}</span>
          </button>
        </Highlightable>
      ))}
    </div>
  );
};
