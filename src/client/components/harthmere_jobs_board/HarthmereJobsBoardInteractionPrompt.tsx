import * as React from "react";
import { getHarthmereJobsBoardPrompt, type HarthmereJobsBoardSnapshot, type HarthmereJobsBoardWorldContext } from "./jobsBoardLiveAdapter";

export function HarthmereJobsBoardInteractionPrompt({
  snapshot,
  world,
  onOpen,
}: {
  snapshot: HarthmereJobsBoardSnapshot;
  world: HarthmereJobsBoardWorldContext;
  onOpen?: () => void;
}) {
  const prompt = getHarthmereJobsBoardPrompt(snapshot, world);
  React.useEffect(() => {
    if (!prompt || !onOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prompt, onOpen]);
  if (!prompt) return null;
  return (
    <button
      className="harthmere-jobs-prompt"
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        onOpen?.();
      }}
      aria-label={prompt.actionLabel}
    >
      <span className="harthmere-jobs-prompt__key">{prompt.key}</span>
      <span>
        <strong>{prompt.title}</strong>
        <small>{prompt.subtitle}</small>
      </span>
    </button>
  );
}
