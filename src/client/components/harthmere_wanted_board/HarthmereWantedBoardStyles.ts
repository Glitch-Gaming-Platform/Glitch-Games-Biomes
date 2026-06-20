import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";

export const HARTHMERE_WANTED_BOARD_STYLES_ID =
  "harthmere-wanted-board-styles";

export const HARTHMERE_WANTED_BOARD_CSS = `
.harthmere-wanted-board__backdrop {
  position: fixed;
  inset: 0;
  z-index: 52;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1rem 0.65rem;
  background: rgba(3, 7, 18, 0.58);
  backdrop-filter: blur(7px) saturate(120%);
  -webkit-backdrop-filter: blur(7px) saturate(120%);
  overflow-y: auto;
  pointer-events: auto;
  cursor: default;
}
@media (min-width: 760px) {
  .harthmere-wanted-board__backdrop {
    align-items: center;
    padding: 2rem;
  }
}

.harthmere-wanted-board {
  width: min(70rem, 100%);
  max-height: calc(100dvh - 2rem);
  display: flex;
  flex-direction: column;
  background: var(--biomes-bg-glass, rgba(13, 22, 44, 0.94));
  color: var(--biomes-fg, #e8f4ff);
  border: 1px solid rgba(255, 184, 68, 0.45);
  box-shadow:
    inset 0 0 24px rgba(74, 222, 255, 0.05),
    inset 0 0 18px rgba(255, 184, 68, 0.08),
    0 18px 42px rgba(0, 0, 0, 0.62);
  clip-path: var(--biomes-clip, polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px));
  backdrop-filter: blur(10px) saturate(116%);
  -webkit-backdrop-filter: blur(10px) saturate(116%);
  position: relative;
  font-family: inherit;
}
.harthmere-wanted-board::before {
  content: "";
  position: absolute;
  inset: 0 0 auto;
  height: 1px;
  background: linear-gradient(90deg, transparent, rgba(255, 184, 68, 0.92), rgba(74, 222, 255, 0.78), transparent);
  pointer-events: none;
}
.harthmere-wanted-board button {
  font: inherit;
}

.harthmere-wanted-board__header {
  display: grid;
  grid-template-columns: minmax(0, 1fr) auto;
  gap: 0.75rem;
  align-items: start;
  padding: 0.9rem 1rem 0.7rem;
  border-bottom: 1px solid rgba(74, 222, 255, 0.22);
}
.harthmere-wanted-board__header h2 {
  margin: 0;
  font-size: 1.02rem;
  font-weight: 800;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.harthmere-wanted-board__header p {
  margin: 0.18rem 0 0;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.66));
  font-size: 0.74rem;
}
.harthmere-wanted-board__close {
  appearance: none;
  width: 2rem;
  height: 2rem;
  border-radius: 6px;
  border: 1px solid rgba(74, 222, 255, 0.35);
  background: rgba(7, 12, 26, 0.66);
  color: var(--biomes-fg, #e8f4ff);
  cursor: pointer;
  font-weight: 900;
}
.harthmere-wanted-board__close:hover,
.harthmere-wanted-board__close:focus-visible {
  border-color: rgba(255, 184, 68, 0.9);
  background: rgba(255, 184, 68, 0.14);
  outline: none;
}

.harthmere-wanted-board__stats {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.45rem;
  padding: 0.65rem 1rem;
  border-bottom: 1px solid rgba(74, 222, 255, 0.16);
}
@media (min-width: 760px) {
  .harthmere-wanted-board__stats {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.harthmere-wanted-board__stat {
  display: grid;
  gap: 0.15rem;
  padding: 0.55rem 0.65rem;
  background: rgba(7, 12, 26, 0.52);
  border: 1px solid rgba(74, 222, 255, 0.2);
  border-radius: 6px;
}
.harthmere-wanted-board__stat span {
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.62));
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
.harthmere-wanted-board__stat strong {
  font-size: 0.94rem;
}

.harthmere-wanted-board__tabs {
  display: flex;
  flex-wrap: nowrap;
  gap: 0.35rem;
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid rgba(74, 222, 255, 0.18);
  overflow-x: auto;
  scrollbar-width: none;
}
.harthmere-wanted-board__tabs::-webkit-scrollbar { display: none; }
.harthmere-wanted-board__tabs button {
  appearance: none;
  flex: 0 0 auto;
  min-height: 2rem;
  padding: 0.38rem 0.8rem;
  border-radius: 999px;
  border: 1px solid rgba(74, 222, 255, 0.18);
  background: rgba(13, 22, 44, 0.56);
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.68));
  cursor: pointer;
  font-size: 0.72rem;
  font-weight: 800;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  white-space: nowrap;
}
.harthmere-wanted-board__tabs button.active {
  border-color: rgba(255, 184, 68, 0.9);
  background: rgba(255, 184, 68, 0.14);
  color: var(--biomes-fg, #e8f4ff);
  box-shadow: 0 0 14px rgba(255, 184, 68, 0.18);
}
.harthmere-wanted-board__tabs button:focus-visible {
  outline: 2px solid rgba(74, 222, 255, 0.85);
  outline-offset: 2px;
}

.harthmere-wanted-board__body {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.9rem 1rem 1.05rem;
}
.harthmere-wanted-board__status {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  margin-bottom: 0.75rem;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.66));
  font-size: 0.72rem;
}
.harthmere-wanted-board__status[data-state="error"] {
  color: var(--biomes-warn-amber, rgba(255, 184, 68, 0.95));
}

.harthmere-wanted-board__grid {
  display: grid;
  grid-template-columns: 1fr;
  gap: 0.7rem;
}
@media (min-width: 760px) {
  .harthmere-wanted-board__grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1080px) {
  .harthmere-wanted-board__grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.harthmere-wanted-card {
  display: flex;
  flex-direction: column;
  gap: 0.42rem;
  min-width: 0;
  padding: 0.85rem 0.9rem 0.95rem;
  background: linear-gradient(180deg, rgba(16, 24, 42, 0.82), rgba(7, 12, 26, 0.92));
  border: 1px solid rgba(74, 222, 255, 0.24);
  border-left-color: rgba(255, 184, 68, 0.72);
  border-radius: 6px;
}
.harthmere-wanted-card:focus-within,
.harthmere-wanted-card:hover {
  border-color: rgba(255, 184, 68, 0.82);
  box-shadow: 0 0 16px rgba(255, 184, 68, 0.14);
}
.harthmere-wanted-card__meta {
  display: flex;
  flex-wrap: wrap;
  gap: 0.35rem;
}
.harthmere-wanted-chip {
  display: inline-flex;
  align-items: center;
  min-height: 1.35rem;
  padding: 0.12rem 0.45rem;
  border: 1px solid rgba(74, 222, 255, 0.22);
  border-radius: 999px;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.7));
  font-size: 0.64rem;
  font-weight: 800;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.harthmere-wanted-chip[data-tone="gold"] {
  border-color: rgba(255, 184, 68, 0.55);
  color: rgba(255, 226, 143, 0.96);
}
.harthmere-wanted-card h3 {
  margin: 0;
  font-size: 0.96rem;
  line-height: 1.2;
}
.harthmere-wanted-card p {
  margin: 0;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.68));
  font-size: 0.75rem;
  line-height: 1.35;
}
.harthmere-wanted-card small {
  color: var(--biomes-fg-dim, rgba(232, 244, 255, 0.44));
  font-size: 0.68rem;
}
.harthmere-wanted-card em {
  color: var(--biomes-warn-amber, rgba(255, 184, 68, 0.95));
  font-style: normal;
  font-size: 0.7rem;
  font-weight: 800;
}
.harthmere-wanted-card button {
  appearance: none;
  margin-top: 0.35rem;
  min-height: 2.45rem;
  border-radius: 6px;
  border: 1px solid rgba(74, 222, 255, 0.78);
  background: linear-gradient(180deg, rgba(74, 222, 255, 0.22), rgba(74, 222, 255, 0.09));
  color: var(--biomes-fg, #e8f4ff);
  cursor: pointer;
  font-size: 0.76rem;
  font-weight: 900;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}
.harthmere-wanted-card button:hover:not(:disabled),
.harthmere-wanted-card button:focus-visible:not(:disabled) {
  border-color: rgba(255, 184, 68, 0.88);
  background: linear-gradient(180deg, rgba(255, 184, 68, 0.2), rgba(74, 222, 255, 0.1));
  outline: none;
}
.harthmere-wanted-card button:disabled {
  opacity: 0.46;
  cursor: not-allowed;
}
.harthmere-wanted-board__empty {
  grid-column: 1 / -1;
  padding: 1.4rem 0.7rem;
  border: 1px dashed rgba(74, 222, 255, 0.28);
  border-radius: 6px;
  text-align: center;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.64));
  font-size: 0.78rem;
}

.harthmere-wanted-board__law {
  display: grid;
  gap: 0.7rem;
}
.harthmere-wanted-board__law-row {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.55rem;
}
@media (min-width: 760px) {
  .harthmere-wanted-board__law-row {
    grid-template-columns: repeat(4, minmax(0, 1fr));
  }
}
.harthmere-wanted-board__law-note {
  padding: 0.75rem 0.8rem;
  border-radius: 6px;
  border: 1px solid rgba(74, 222, 255, 0.18);
  background: rgba(7, 12, 26, 0.46);
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.66));
  font-size: 0.72rem;
  line-height: 1.35;
}

@media (max-width: 540px) {
  .harthmere-wanted-board__backdrop {
    padding: 0.35rem;
  }
  .harthmere-wanted-board {
    max-height: calc(100dvh - 0.7rem);
  }
  .harthmere-wanted-board__header {
    padding: 0.75rem 0.8rem 0.6rem;
  }
  .harthmere-wanted-board__tabs {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--biomes-bg-glass-strong, rgba(8, 14, 32, 0.94));
  }
  .harthmere-wanted-board__stats {
    grid-template-columns: 1fr 1fr;
    padding: 0.55rem 0.8rem;
  }
}
`;

export function installHarthmereWantedBoardStyles(): void {
  if (typeof document === "undefined") return;
  installBiomesUITheme();
  if (document.getElementById(HARTHMERE_WANTED_BOARD_STYLES_ID)) return;
  const style = document.createElement("style");
  style.id = HARTHMERE_WANTED_BOARD_STYLES_ID;
  style.setAttribute("data-source", "harthmere_wanted_board");
  style.appendChild(document.createTextNode(HARTHMERE_WANTED_BOARD_CSS));
  document.head.appendChild(style);
}

