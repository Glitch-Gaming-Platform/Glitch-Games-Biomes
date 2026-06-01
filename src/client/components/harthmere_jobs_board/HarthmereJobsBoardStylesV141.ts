// HARTHMERE_JOBS_BOARD_STYLES_V141:
// Standalone CSS injection for the Jobs Board panel. The panel uses the same
// glass-clipped look as BiomesUI but lives in its own stylesheet so the Jobs
// Board can ship/be themed independently of the main BiomesUI tabs. All
// surface colors pull from the existing `--biomes-*` CSS variables exposed by
// `installBiomesUITheme()`, so calling `installBiomesUITheme()` before this is
// required.
//
// Mobile responsiveness:
//   - default (>= 720px wide): two-column card grid, top-aligned modal,
//     full keyboard nav.
//   - <= 720px: single-column card grid, panel fills the screen, tab strip
//     becomes a horizontally scrollable pill row, header collapses.
//   - <= 420px (small phones): tighter spacing, sticky tabs, oversized tap
//     targets for fingers.

export const HARTHMERE_JOBS_BOARD_STYLES_ID_V141 =
  "harthmere-jobs-board-styles-v141";

export const HARTHMERE_JOBS_BOARD_CSS_V141 = `
.harthmere-jobs-board__backdrop {
  position: fixed;
  inset: 0;
  z-index: 50;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 1.25rem 0.75rem 0.75rem;
  background: rgba(3, 7, 18, 0.55);
  backdrop-filter: blur(6px) saturate(120%);
  -webkit-backdrop-filter: blur(6px) saturate(120%);
  overflow-y: auto;
  pointer-events: auto;
  cursor: default;
}
@media (min-width: 720px) {
  .harthmere-jobs-board__backdrop {
    align-items: center;
    padding: 2rem;
  }
}

.harthmere-jobs-board {
  width: 100%;
  max-width: 64rem;
  display: flex;
  flex-direction: column;
  background: var(--biomes-bg-glass, rgba(13, 22, 44, 0.92));
  color: var(--biomes-fg, #e8f4ff);
  border: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.35));
  box-shadow:
    inset 0 0 24px rgba(74, 222, 255, 0.06),
    0 18px 40px rgba(0, 0, 0, 0.6);
  clip-path: var(--biomes-clip, polygon(12px 0, 100% 0, 100% calc(100% - 12px), calc(100% - 12px) 100%, 0 100%, 0 12px));
  backdrop-filter: blur(10px) saturate(115%);
  -webkit-backdrop-filter: blur(10px) saturate(115%);
  position: relative;
  font-family: inherit;
  max-height: calc(100dvh - 2rem);
}
.harthmere-jobs-board::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85)) 50%, transparent 100%);
  opacity: 0.8;
  pointer-events: none;
}

.harthmere-jobs-board__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.85rem 1rem 0.6rem;
  border-bottom: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.25));
}
.harthmere-jobs-board__header h2 {
  margin: 0;
  font-size: 1rem;
  font-weight: 700;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--biomes-fg, #e8f4ff);
}
.harthmere-jobs-board__header p {
  margin: 0.15rem 0 0;
  font-size: 0.72rem;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.65));
}
.harthmere-jobs-board__header button {
  appearance: none;
  background: rgba(7, 12, 26, 0.6);
  color: var(--biomes-fg, #e8f4ff);
  border: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.35));
  border-radius: 999px;
  width: 2rem;
  height: 2rem;
  font-size: 1.1rem;
  font-weight: 700;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: background 120ms ease, border-color 120ms ease;
}
.harthmere-jobs-board button,
.harthmere-jobs-board select,
.harthmere-jobs-board input,
.harthmere-jobs-board textarea {
  pointer-events: auto;
}
.harthmere-jobs-board__header button:hover,
.harthmere-jobs-board__header button:focus-visible {
  background: rgba(74, 222, 255, 0.18);
  border-color: var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
}

.harthmere-jobs-board__tabs {
  display: flex;
  flex-wrap: nowrap;
  overflow-x: auto;
  overscroll-behavior-x: contain;
  gap: 0.35rem;
  padding: 0.55rem 0.85rem;
  border-bottom: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.2));
  scrollbar-width: none;
}
.harthmere-jobs-board__tabs::-webkit-scrollbar { display: none; }
.harthmere-jobs-board__tabs button {
  appearance: none;
  flex: 0 0 auto;
  padding: 0.4rem 0.85rem;
  background: rgba(13, 22, 44, 0.5);
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.65));
  border: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.18));
  border-radius: 999px;
  font-size: 0.72rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 120ms ease, color 120ms ease, border-color 120ms ease;
  white-space: nowrap;
  min-height: 2rem;
}
.harthmere-jobs-board__tabs button.active {
  background: rgba(74, 222, 255, 0.16);
  color: var(--biomes-fg, #e8f4ff);
  border-color: var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.25);
}
.harthmere-jobs-board__tabs button:hover {
  color: var(--biomes-fg, #e8f4ff);
}
.harthmere-jobs-board__tabs button:focus-visible {
  outline: 2px solid var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  outline-offset: 2px;
}

.harthmere-jobs-board__content {
  flex: 1 1 auto;
  overflow-y: auto;
  padding: 0.9rem 1rem 1.1rem;
}

.harthmere-jobs-board__status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 0.72rem;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.65));
  margin-bottom: 0.6rem;
}
.harthmere-jobs-board__status[data-state="error"] {
  color: var(--biomes-warn-amber, rgba(255, 184, 68, 0.95));
}
.harthmere-jobs-board__status button {
  margin-left: auto;
  appearance: none;
  border: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.35));
  background: rgba(7, 12, 26, 0.6);
  color: var(--biomes-fg, #e8f4ff);
  padding: 0.3rem 0.7rem;
  border-radius: 999px;
  cursor: pointer;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.harthmere-jobs-board__status button:hover,
.harthmere-jobs-board__status button:focus-visible {
  background: rgba(74, 222, 255, 0.18);
}

.harthmere-jobs-grid {
  display: grid;
  gap: 0.7rem;
  grid-template-columns: 1fr;
}
@media (min-width: 720px) {
  .harthmere-jobs-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}
@media (min-width: 1024px) {
  .harthmere-jobs-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.harthmere-jobs-grid .empty,
.harthmere-jobs-board__content > .empty {
  grid-column: 1 / -1;
  text-align: center;
  padding: 1.4rem 0.5rem;
  border: 1px dashed var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.25));
  border-radius: var(--biomes-radius, 6px);
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.65));
  font-size: 0.78rem;
}

.harthmere-jobs-card {
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  padding: 0.85rem 0.9rem 0.95rem;
  background: linear-gradient(180deg, rgba(13, 22, 44, 0.78) 0%, rgba(7, 12, 26, 0.9) 100%);
  border: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.25));
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  position: relative;
  transition: transform 120ms ease, border-color 120ms ease, box-shadow 120ms ease;
}
.harthmere-jobs-card:hover,
.harthmere-jobs-card:focus-within {
  transform: translateY(-2px);
  border-color: var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  box-shadow: 0 0 18px rgba(74, 222, 255, 0.18);
}
.harthmere-jobs-card strong {
  font-size: 0.92rem;
  font-weight: 700;
  letter-spacing: 0.02em;
  color: var(--biomes-fg, #e8f4ff);
}
.harthmere-jobs-card span {
  font-size: 0.74rem;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.65));
  letter-spacing: 0.02em;
}
.harthmere-jobs-card small {
  font-size: 0.68rem;
  color: var(--biomes-fg-dim, rgba(232, 244, 255, 0.4));
  font-style: italic;
}
.harthmere-jobs-card em {
  color: var(--biomes-warn-amber, rgba(255, 184, 68, 0.95));
  font-style: normal;
  font-size: 0.7rem;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}
.harthmere-jobs-card button {
  appearance: none;
  align-self: stretch;
  margin-top: 0.45rem;
  padding: 0.6rem 0.9rem;
  background: linear-gradient(180deg, rgba(74, 222, 255, 0.22) 0%, rgba(74, 222, 255, 0.08) 100%);
  color: var(--biomes-fg, #e8f4ff);
  border: 1px solid var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  border-radius: var(--biomes-radius, 6px);
  font-size: 0.78rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  cursor: pointer;
  transition: background 120ms ease, transform 80ms ease;
  min-height: 2.5rem;
}
.harthmere-jobs-card button:hover:not(:disabled),
.harthmere-jobs-card button:focus-visible:not(:disabled) {
  background: linear-gradient(180deg, rgba(74, 222, 255, 0.3) 0%, rgba(74, 222, 255, 0.14) 100%);
}
.harthmere-jobs-card button:active:not(:disabled) {
  transform: scale(0.98);
}
.harthmere-jobs-card button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}

.harthmere-jobs-board__form {
  display: grid;
  gap: 0.55rem;
}
.harthmere-jobs-card--wide {
  grid-column: 1 / -1;
}
.harthmere-jobs-board__form-row {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(11rem, 1fr));
  gap: 0.55rem;
  align-items: end;
}
.harthmere-jobs-board__form label {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
  font-size: 0.7rem;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.7));
}
.harthmere-jobs-board__form input,
.harthmere-jobs-board__form select,
.harthmere-jobs-board__form textarea {
  appearance: none;
  background: rgba(3, 7, 18, 0.6);
  color: var(--biomes-fg, #e8f4ff);
  border: 1px solid var(--biomes-edge-cyan-soft, rgba(74, 222, 255, 0.25));
  border-radius: var(--biomes-radius, 6px);
  padding: 0.55rem 0.7rem;
  font: inherit;
  font-size: 0.85rem;
  letter-spacing: normal;
  text-transform: none;
  min-height: 2.4rem;
}
.harthmere-jobs-board__form textarea {
  min-height: 4.5rem;
  resize: vertical;
}
.harthmere-jobs-board__form input:focus-visible,
.harthmere-jobs-board__form select:focus-visible,
.harthmere-jobs-board__form textarea:focus-visible {
  outline: none;
  border-color: var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.25);
}
.harthmere-jobs-board__form-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 0.5rem;
  margin-top: 0.4rem;
}
.harthmere-jobs-board__template-grid,
.harthmere-jobs-board__requirements {
  display: flex;
  flex-wrap: wrap;
  gap: 0.45rem;
}
.harthmere-jobs-board__template-grid button,
.harthmere-jobs-board__requirements span,
.harthmere-jobs-board__requirements button {
  border: 1px solid rgba(74, 222, 255, 0.22);
  border-radius: 6px;
  background: rgba(8, 14, 32, 0.66);
  color: var(--biomes-fg, #e8f4ff);
  padding: 0.45rem 0.6rem;
  font: inherit;
  font-size: 0.72rem;
  text-align: left;
}
.harthmere-jobs-board__template-grid button {
  display: inline-flex;
  min-width: 10rem;
  flex-direction: column;
  gap: 0.15rem;
  cursor: pointer;
}
.harthmere-jobs-board__template-grid button.active {
  border-color: rgba(74, 222, 255, 0.85);
  background: rgba(74, 222, 255, 0.16);
}
.harthmere-jobs-board__template-grid button:focus-visible,
.harthmere-jobs-board__requirements button:focus-visible {
  outline: none;
  border-color: rgba(74, 222, 255, 0.85);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.25);
}

.harthmere-jobs-prompt {
  position: fixed;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  padding: 0.5rem 0.85rem 0.55rem;
  background: var(--biomes-bg-glass-strong, rgba(8, 14, 32, 0.92));
  color: var(--biomes-fg, #e8f4ff);
  border: 1px solid var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  border-radius: 999px;
  font: inherit;
  font-size: 0.78rem;
  cursor: pointer;
  z-index: 40;
  box-shadow: 0 0 18px rgba(74, 222, 255, 0.25);
}
.harthmere-jobs-prompt__key {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 1.5rem;
  height: 1.5rem;
  padding: 0 0.4rem;
  background: rgba(74, 222, 255, 0.22);
  border: 1px solid var(--biomes-edge-cyan, rgba(74, 222, 255, 0.85));
  border-radius: 6px;
  font-weight: 700;
  letter-spacing: 0.04em;
}
.harthmere-jobs-prompt strong {
  display: block;
  font-size: 0.8rem;
  letter-spacing: 0.02em;
}
.harthmere-jobs-prompt small {
  display: block;
  font-size: 0.66rem;
  color: var(--biomes-fg-muted, rgba(232, 244, 255, 0.65));
}

@media (max-width: 540px) {
  .harthmere-jobs-board__backdrop {
    padding: 0.5rem 0.4rem;
  }
  .harthmere-jobs-board {
    border-radius: 0;
    max-height: calc(100dvh - 1rem);
  }
  .harthmere-jobs-board__header {
    padding: 0.7rem 0.85rem 0.5rem;
  }
  .harthmere-jobs-board__tabs {
    position: sticky;
    top: 0;
    z-index: 1;
    background: var(--biomes-bg-glass-strong, rgba(8, 14, 32, 0.92));
  }
  .harthmere-jobs-card button {
    min-height: 2.75rem;
  }
}
`;

export function installHarthmereJobsBoardStylesV141(): void {
  if (typeof document === "undefined") return;
  if (document.getElementById(HARTHMERE_JOBS_BOARD_STYLES_ID_V141)) return;
  const style = document.createElement("style");
  style.id = HARTHMERE_JOBS_BOARD_STYLES_ID_V141;
  style.setAttribute("data-source", "harthmere_jobs_board");
  style.appendChild(document.createTextNode(HARTHMERE_JOBS_BOARD_CSS_V141));
  document.head.appendChild(style);
}
