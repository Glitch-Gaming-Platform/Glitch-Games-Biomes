import * as React from "react";
import { getHarthmereJobsBoardPromptV1, type HarthmereJobsBoardSnapshotV1, type HarthmereJobsBoardWorldContextV1 } from "./jobsBoardLiveAdapter";

export function HarthmereJobsBoardInteractionPrompt({
  snapshot,
  world,
  onOpen,
}: {
  snapshot: HarthmereJobsBoardSnapshotV1;
  world: HarthmereJobsBoardWorldContextV1;
  onOpen?: () => void;
}) {
  const prompt = getHarthmereJobsBoardPromptV1(snapshot, world);
  React.useEffect(() => {
    if (!prompt || !onOpen) return;
    const handler = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() === "e") {
        event.preventDefault();
        onOpen();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prompt, onOpen]);
  if (!prompt) return null;
  return (
    <button className="harthmere-jobs-prompt" onClick={onOpen} aria-label={prompt.actionLabel}>
      <span className="harthmere-jobs-prompt__key">{prompt.key}</span>
      <span>
        <strong>{prompt.title}</strong>
        <small>{prompt.subtitle}</small>
      </span>
    </button>
  );
}
