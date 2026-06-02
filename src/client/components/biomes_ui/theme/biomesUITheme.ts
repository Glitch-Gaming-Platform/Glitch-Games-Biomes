// BiomesUI theme — exported as a string and injected at runtime via a
// <style id="biomes-ui-theme"> tag. We do this instead of `import "*.css"`
// because Next.js bans global CSS imports outside of pages/_app, and this
// module is supposed to be drop-in (no _app changes).
//
// `installBiomesUITheme()` is idempotent — calling it multiple times only
// installs the tag once. It's a no-op in non-browser environments
// (SSR safe).

export const BIOMES_UI_THEME_CSS = `
:root {
  --biomes-bg-deep: rgba(7, 12, 26, 0.92);
  --biomes-bg-glass: rgba(13, 22, 44, 0.78);
  --biomes-bg-glass-strong: rgba(8, 14, 32, 0.92);
  --biomes-edge-cyan: rgba(74, 222, 255, 0.85);
  --biomes-edge-cyan-soft: rgba(74, 222, 255, 0.35);
  --biomes-edge-magenta: rgba(255, 84, 196, 0.8);
  --biomes-edge-magenta-soft: rgba(255, 84, 196, 0.32);
  --biomes-warn-amber: rgba(255, 184, 68, 0.95);
  --biomes-fg: #e8f4ff;
  --biomes-fg-muted: rgba(232, 244, 255, 0.65);
  --biomes-fg-dim: rgba(232, 244, 255, 0.4);
  --biomes-radius: 6px;
  --biomes-clip: polygon(
    12px 0,
    100% 0,
    100% calc(100% - 12px),
    calc(100% - 12px) 100%,
    0 100%,
    0 12px
  );
}

.biomes-ui-panel {
  background: var(--biomes-bg-glass);
  color: var(--biomes-fg);
  border: 1px solid var(--biomes-edge-cyan-soft);
  box-shadow:
    inset 0 0 24px rgba(74, 222, 255, 0.06),
    0 0 22px rgba(0, 0, 0, 0.55);
  clip-path: var(--biomes-clip);
  backdrop-filter: blur(10px) saturate(115%);
  -webkit-backdrop-filter: blur(10px) saturate(115%);
  position: relative;
}
.biomes-ui-panel::before {
  content: "";
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent 0%, var(--biomes-edge-cyan) 50%, transparent 100%);
  opacity: 0.7;
}

.biomes-ui-slot {
  width: 56px;
  height: 56px;
  background: linear-gradient(180deg, rgba(13, 22, 44, 0.78) 0%, rgba(7, 12, 26, 0.92) 100%);
  border: 1px solid var(--biomes-edge-cyan-soft);
  clip-path: polygon(8px 0, calc(100% - 8px) 0, 100% 8px, 100% calc(100% - 8px), calc(100% - 8px) 100%, 8px 100%, 0 calc(100% - 8px), 0 8px);
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  color: var(--biomes-fg);
  cursor: pointer;
  transition: transform 80ms ease, border-color 120ms ease, box-shadow 120ms ease;
  outline: none;
}
.biomes-ui-slot:focus-visible,
.biomes-ui-slot[data-focused="true"] {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.45);
}
.biomes-ui-slot[data-selected="true"] {
  border-color: var(--biomes-edge-magenta);
  box-shadow:
    0 0 14px rgba(255, 84, 196, 0.55),
    inset 0 0 18px rgba(255, 84, 196, 0.15);
}
.biomes-ui-slot:hover {
  transform: translateY(-2px);
}

.biomes-ui-slot-key {
  position: absolute;
  bottom: 2px;
  right: 4px;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.06em;
  color: var(--biomes-fg-muted);
  text-shadow: 0 0 4px rgba(0, 0, 0, 0.65);
  pointer-events: none;
}

.biomes-ui-tab {
  position: relative;
  padding: 8px 14px;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  background: transparent;
  border: 0;
  cursor: pointer;
  outline: none;
}
.biomes-ui-tab:hover,
.biomes-ui-tab:focus-visible,
.biomes-ui-tab[data-focused="true"] { color: var(--biomes-fg); }
.biomes-ui-tab[aria-selected="true"] { color: #fff; }
.biomes-ui-tab[aria-selected="true"]::after {
  content: "";
  position: absolute;
  left: 12px; right: 12px; bottom: 2px;
  height: 2px;
  background: linear-gradient(90deg, var(--biomes-edge-cyan) 0%, var(--biomes-edge-magenta) 100%);
  box-shadow: 0 0 10px rgba(74, 222, 255, 0.5);
}

.biomes-ui-card {
  background: linear-gradient(180deg, rgba(232, 244, 255, 0.94) 0%, rgba(198, 226, 238, 0.88) 100%);
  color: #101622;
  border: 1px solid rgba(74, 222, 255, 0.32);
  border-radius: 6px;
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.62),
    0 9px 20px rgba(0, 0, 0, 0.24);
  box-sizing: border-box;
  overflow: hidden;
}

button.biomes-ui-card {
  font: inherit;
  border: 1px solid rgba(74, 222, 255, 0.32);
  appearance: none;
  -webkit-appearance: none;
}

button.biomes-ui-card:hover:not(:disabled),
button.biomes-ui-card:focus-visible,
button.biomes-ui-card[data-focused="true"] {
  transform: translateY(-1px);
  border-color: var(--biomes-edge-cyan);
  box-shadow:
    inset 0 1px 0 rgba(255, 255, 255, 0.66),
    0 0 14px rgba(74, 222, 255, 0.28),
    0 11px 22px rgba(0, 0, 0, 0.28);
}

button.biomes-ui-card:disabled {
  cursor: not-allowed;
}

.mini-phone.shop-container,
.mini-phone.item-buyer {
  background: rgba(5, 10, 22, 0.62);
  border: 1px solid rgba(74, 222, 255, 0.22);
  box-shadow: 0 18px 50px rgba(0, 0, 0, 0.58);
}

.mini-phone.shop-container .mini-phone-screen-wrap,
.mini-phone.item-buyer .mini-phone-screen-wrap {
  min-height: 0;
}

.biomes-ui-shop-screen {
  width: 100%;
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  box-sizing: border-box;
  overflow: hidden;
}

.biomes-ui-shop-screen__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
  min-width: 0;
}

.biomes-ui-shop-screen__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.biomes-ui-shop-screen__eyebrow {
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: var(--biomes-edge-cyan);
}

.biomes-ui-shop-screen h2 {
  margin: 0;
  font-size: 18px;
  line-height: 1.05;
  color: var(--biomes-fg);
  overflow-wrap: anywhere;
}

.biomes-ui-shop-screen__subtitle {
  margin: 0;
  max-width: 58ch;
  font-size: 12px;
  line-height: 1.35;
  color: var(--biomes-fg-muted);
}

.biomes-ui-shop-screen__actions {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 6px;
}

.biomes-ui-shop-screen__close,
.biomes-ui-action-button {
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 5px;
  background: rgba(7, 12, 26, 0.78);
  color: var(--biomes-fg);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  padding: 7px 10px;
  outline: none;
}

.biomes-ui-shop-screen__close {
  display: inline-flex;
  align-items: center;
  gap: 7px;
}

.biomes-ui-shop-screen__close span {
  display: inline-grid;
  place-items: center;
  min-width: 26px;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255,255,255,0.2);
  color: var(--biomes-fg-muted);
  background: rgba(255,255,255,0.08);
}

.biomes-ui-shop-screen__close:hover,
.biomes-ui-shop-screen__close:focus-visible,
.biomes-ui-action-button:hover,
.biomes-ui-action-button:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.26);
}

.biomes-ui-action-button:disabled,
.biomes-ui-shop-stepper button:disabled {
  opacity: 0.45;
  cursor: not-allowed;
  box-shadow: none;
}

.biomes-ui-shop-screen__body {
  min-height: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(230px, 0.86fr) minmax(350px, 1.24fr);
  grid-template-rows: minmax(0, 1fr) auto;
  gap: 10px;
}

.biomes-ui-shop-section {
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  padding: 10px;
  border: 1px solid rgba(74, 222, 255, 0.24);
  background:
    radial-gradient(circle at 12% 0%, rgba(74, 222, 255, 0.12), transparent 35%),
    linear-gradient(180deg, rgba(13, 22, 44, 0.68), rgba(7, 12, 26, 0.84));
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}

.biomes-ui-shop-section__header {
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
  min-width: 0;
}

.biomes-ui-shop-section__header h3 {
  margin: 0;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}

.biomes-ui-shop-section__header span {
  min-width: 0;
  color: var(--biomes-fg-dim);
  font-size: 11px;
  text-align: right;
  overflow-wrap: anywhere;
}

.biomes-ui-shop-section--inventory {
  grid-row: span 2;
  overflow: hidden;
}

.biomes-ui-shop-section--summary {
  grid-column: 1 / -1;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
}

.biomes-ui-shop-merchant {
  display: flex;
  align-items: center;
  gap: 10px;
  min-width: 0;
}

.biomes-ui-shop-merchant .avatar,
.biomes-ui-shop-merchant img {
  width: 44px;
  height: 44px;
  border-radius: 999px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  object-fit: cover;
}

.biomes-ui-shop-merchant .avatar {
  flex: 0 0 auto;
  background:
    radial-gradient(circle at 50% 35%, rgba(232, 244, 255, 0.22), transparent 30%),
    linear-gradient(180deg, rgba(74, 222, 255, 0.2), rgba(7, 12, 26, 0.86));
}

.biomes-ui-shop-merchant__copy {
  min-width: 0;
}

.biomes-ui-shop-merchant__copy strong {
  display: block;
  font-size: 13px;
  color: var(--biomes-fg);
  overflow-wrap: anywhere;
}

.biomes-ui-shop-merchant__copy span,
.biomes-ui-shop-muted {
  color: var(--biomes-fg-muted);
  font-size: 12px;
  line-height: 1.35;
}

.biomes-ui-shop-grid {
  display: grid;
  gap: 6px;
  align-content: start;
  overflow: auto;
  padding: 1px;
}

.biomes-ui-shop-grid [role="row"] {
  gap: 6px !important;
  flex-wrap: nowrap;
}

.biomes-ui-shop-slot-button {
  width: 72px;
  min-height: 92px;
  padding: 6px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 5px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 6px;
  color: var(--biomes-fg);
  outline: none;
  cursor: pointer;
}

.biomes-ui-shop-slot-button .cell {
  width: 52px;
  height: 52px;
  flex: 0 0 auto;
}

.biomes-ui-shop-slot-button:focus-visible,
.biomes-ui-shop-slot-button[data-focused="true"] {
  border-color: var(--biomes-edge-cyan);
  background: rgba(74, 222, 255, 0.08);
  box-shadow: 0 0 12px rgba(74, 222, 255, 0.24);
}

.biomes-ui-shop-slot-button[data-selected="true"] {
  border-color: var(--biomes-edge-magenta);
  background: rgba(255, 84, 196, 0.1);
  box-shadow: inset 0 0 16px rgba(255, 84, 196, 0.12);
}

.biomes-ui-shop-slot-button__label {
  width: 100%;
  min-height: 28px;
  display: flex;
  flex-direction: column;
  gap: 2px;
  text-align: center;
  font-size: 10px;
  line-height: 1.15;
  color: var(--biomes-fg-muted);
  overflow-wrap: anywhere;
}

.biomes-ui-shop-slot-button__label strong {
  color: var(--biomes-fg);
  font-size: 11px;
}

.biomes-ui-shop-stepper {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 5px;
  outline: none;
}

.biomes-ui-shop-stepper:focus-visible {
  box-shadow: 0 0 0 2px var(--biomes-edge-cyan-soft);
}

.biomes-ui-shop-stepper__label {
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.biomes-ui-shop-stepper button,
.biomes-ui-shop-stepper output {
  min-width: 34px;
  min-height: 28px;
  display: inline-grid;
  place-items: center;
  border-radius: 5px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: rgba(7, 12, 26, 0.72);
  color: var(--biomes-fg);
  font-size: 11px;
  font-weight: 800;
}

.biomes-ui-shop-stepper button {
  cursor: pointer;
}

.biomes-ui-shop-stepper output {
  min-width: 48px;
  border-color: rgba(255, 184, 68, 0.3);
  color: rgba(255, 231, 170, 0.96);
}

.biomes-ui-shop-total {
  color: var(--biomes-fg);
  font-size: 13px;
  font-weight: 800;
}

.biomes-ui-shop-total span {
  color: rgba(255, 231, 170, 0.96);
}

.biomes-ui-shop-inventory-pane {
  --inventory-cell-gap: 3px;
  --inventory-divider-size: 8px;
  --cell-width: clamp(34px, 4.8vmin, 42px);
  --cell-height: var(--cell-width);
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  width: 100%;
  overflow: auto;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 2px 0 4px;
}

.biomes-ui-shop-inventory-pane .inventory-cells.normal {
  width: calc((var(--cell-width) * 9) + (var(--inventory-cell-gap) * 8));
  min-width: calc((var(--cell-width) * 9) + (var(--inventory-cell-gap) * 8));
  justify-content: flex-start;
  align-content: flex-start;
  margin: 0 auto;
}

.biomes-ui-shop-inventory-pane .inventory-cells.normal .break-medium {
  height: var(--inventory-divider-size);
}

.biomes-ui-shop-inventory-pane .cell {
  flex: 0 0 auto;
}

.biomes-ui-shop-inventory-pane .cell.cash {
  padding: 0 8px;
}

.biomes-ui-shop-inventory-pane .cell.cash span {
  font-size: 12px;
}

.biomes-ui-shop-inventory-pane .cell.cash img {
  left: 5px;
}

@keyframes biomes-ui-pulse {
  0%, 100% { box-shadow: 0 0 0 0 rgba(74, 222, 255, 0.0), inset 0 0 0 0 rgba(74, 222, 255, 0.0); }
  50%      { box-shadow: 0 0 18px 4px rgba(74, 222, 255, 0.75), inset 0 0 12px 0 rgba(74, 222, 255, 0.45); }
}
.biomes-ui-blink-pulse { animation: biomes-ui-pulse 1.2s ease-in-out infinite; }

@keyframes biomes-ui-ring {
  0%, 100% { outline-color: rgba(255, 184, 68, 0.0); }
  50%      { outline-color: rgba(255, 184, 68, 0.95); }
}
.biomes-ui-blink-ring {
  outline: 2px solid transparent;
  outline-offset: 3px;
  animation: biomes-ui-ring 1s ease-in-out infinite;
}

@keyframes biomes-ui-shimmer {
  0%   { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.biomes-ui-blink-shimmer { position: relative; overflow: hidden; }
.biomes-ui-blink-shimmer::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(100deg, transparent 30%, rgba(74, 222, 255, 0.4) 50%, transparent 70%);
  background-size: 200% 100%;
  animation: biomes-ui-shimmer 1.6s linear infinite;
  pointer-events: none;
}

@keyframes biomes-ui-arrow-bob {
  0%, 100% { transform: translate(-50%, 0); }
  50%      { transform: translate(-50%, -6px); }
}
.biomes-ui-blink-arrow { position: relative; }
.biomes-ui-blink-arrow::before {
  content: "\\25BC";
  position: absolute;
  left: 50%;
  bottom: 100%;
  color: var(--biomes-warn-amber);
  font-size: 18px;
  text-shadow: 0 0 8px rgba(255, 184, 68, 0.85);
  animation: biomes-ui-arrow-bob 0.8s ease-in-out infinite;
  pointer-events: none;
}

@media (max-width: 768px) {
  .biomes-ui-slot { width: 44px; height: 44px; }
  .biomes-ui-tab { font-size: 10px; padding: 6px 8px; letter-spacing: 0.08em; }
  .biomes-ui-shop-screen { padding: 10px; overflow: auto; }
  .biomes-ui-shop-screen__header { flex-direction: column; }
  .biomes-ui-shop-screen__actions { justify-content: flex-start; }
  .biomes-ui-shop-screen__body {
    display: flex;
    flex-direction: column;
    overflow: visible;
  }
  .biomes-ui-shop-section--inventory { min-height: 360px; }
  .biomes-ui-shop-inventory-pane {
    --cell-width: clamp(32px, 10vw, 40px);
    justify-content: flex-start;
  }
  .biomes-ui-shop-section--summary { flex-direction: column; align-items: stretch; }
  .biomes-ui-shop-slot-button { width: 64px; min-height: 86px; }
}
@media (max-width: 480px) {
  .biomes-ui-slot { width: 38px; height: 38px; }
  .biomes-ui-shop-screen h2 { font-size: 16px; }
  .biomes-ui-shop-section { padding: 9px; }
  .biomes-ui-shop-stepper { align-items: stretch; }
  .biomes-ui-shop-stepper button,
  .biomes-ui-shop-stepper output { flex: 1 1 36px; }
  .biomes-ui-shop-inventory-pane { --cell-width: 32px; }
}

.biomes-ui-open-prompt {
  position: fixed;
  right: 18px;
  top: 50%;
  transform: translateY(-50%);
  z-index: 10020;
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 13px;
  border: 1px solid rgba(105, 231, 255, 0.35);
  border-radius: 16px;
  background:
    radial-gradient(circle at 20% 20%, rgba(105, 231, 255, 0.22), transparent 38%),
    linear-gradient(135deg, rgba(6, 12, 28, 0.88), rgba(18, 23, 45, 0.76));
  box-shadow:
    0 0 22px rgba(105, 231, 255, 0.18),
    inset 0 0 18px rgba(105, 231, 255, 0.08);
  color: rgba(238, 250, 255, 0.96);
  pointer-events: none;
  backdrop-filter: blur(12px);
  animation: biomes-ui-open-prompt-breathe 1.8s ease-in-out infinite;
}

.biomes-ui-open-prompt__key {
  min-width: 34px;
  min-height: 34px;
  display: grid;
  place-items: center;
  border-radius: 10px;
  border: 1px solid rgba(255, 221, 130, 0.55);
  background: rgba(255, 221, 130, 0.13);
  color: #ffe28a;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 0 14px rgba(255, 221, 130, 0.25);
}

.biomes-ui-open-prompt__text {
  display: flex;
  flex-direction: column;
  line-height: 1.05;
}

.biomes-ui-open-prompt__label {
  font-size: 12px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-ui-open-prompt__hint {
  margin-top: 3px;
  font-size: 11px;
  color: rgba(180, 225, 255, 0.8);
}

@keyframes biomes-ui-open-prompt-breathe {
  0%, 100% {
    opacity: 0.86;
    transform: translateY(-50%) scale(1);
  }
  50% {
    opacity: 1;
    transform: translateY(-50%) scale(1.035);
  }
}

@media (max-width: 768px) {
  .biomes-ui-open-prompt {
    right: 10px;
    top: auto;
    bottom: 98px;
    transform: none;
  }

  @keyframes biomes-ui-open-prompt-breathe {
    0%, 100% {
      opacity: 0.86;
      transform: scale(1);
    }
    50% {
      opacity: 1;
      transform: scale(1.035);
    }
  }
}


.biomes-ui-vitals-panel {
  position: fixed;
  left: 12px;
  top: 12px;
  z-index: 1088;
  width: min(18rem, calc(100vw - 1rem));
  pointer-events: none;
  user-select: none;
  color: var(--biomes-fg);
  border: 1px solid rgba(74, 222, 255, 0.28);
  background:
    radial-gradient(circle at 14% 0%, rgba(74, 222, 255, 0.16), transparent 32%),
    radial-gradient(circle at 88% 12%, rgba(255, 84, 196, 0.11), transparent 34%),
    linear-gradient(180deg, rgba(13, 22, 44, 0.84), rgba(7, 12, 26, 0.92));
  box-shadow:
    0 10px 28px rgba(0, 0, 0, 0.5),
    inset 0 0 22px rgba(74, 222, 255, 0.06);
  clip-path: var(--biomes-clip);
  backdrop-filter: blur(12px) saturate(118%);
  -webkit-backdrop-filter: blur(12px) saturate(118%);
  padding: 10px 11px 11px;
}

.biomes-ui-vitals-panel::before {
  content: "";
  position: absolute;
  left: 10px;
  right: 10px;
  top: 0;
  height: 1px;
  background: linear-gradient(90deg, transparent, var(--biomes-edge-cyan), var(--biomes-edge-magenta), transparent);
  opacity: 0.78;
}

.biomes-ui-vitals-panel__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 8px;
}

.biomes-ui-vitals-panel__identity {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.biomes-ui-vitals-panel__game {
  max-width: 11.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
  color: rgba(232, 244, 255, 0.96);
  text-shadow: 0 0 10px rgba(74, 222, 255, 0.3);
}

.biomes-ui-vitals-panel__title {
  max-width: 12.5rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 10px;
  font-style: italic;
  color: rgba(232, 244, 255, 0.62);
}

.biomes-ui-vitals-panel__state {
  flex: 0 0 auto;
  max-width: 5.75rem;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  border: 1px solid rgba(255, 184, 68, 0.26);
  background: rgba(255, 184, 68, 0.08);
  color: rgba(255, 231, 170, 0.9);
  border-radius: 7px;
  padding: 3px 6px;
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-ui-vitals-panel__bars {
  display: flex;
  flex-direction: column;
  gap: 7px;
}

.biomes-ui-vitals-bar__meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
  margin-bottom: 3px;
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
  color: rgba(232, 244, 255, 0.7);
}

.biomes-ui-vitals-bar__value {
  font-variant-numeric: tabular-nums;
  color: rgba(232, 244, 255, 0.92);
}

.biomes-ui-vitals-bar__track {
  position: relative;
  height: 10px;
  overflow: hidden;
  border-radius: 999px;
  border: 1px solid rgba(232, 244, 255, 0.12);
  background: rgba(0, 0, 0, 0.42);
  box-shadow: inset 0 0 8px rgba(0, 0, 0, 0.65);
}

.biomes-ui-vitals-bar__track::after {
  content: "";
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, rgba(255,255,255,0.08) 0 1px, transparent 1px 12px);
  opacity: 0.55;
  pointer-events: none;
}

.biomes-ui-vitals-bar__fill {
  position: absolute;
  inset: 0 auto 0 0;
  border-radius: 999px;
  transition: width 180ms ease;
}

.biomes-ui-vitals-bar__fill--health {
  background: linear-gradient(90deg, #ff426d, #ff876d, #ffd0a0);
  box-shadow: 0 0 14px rgba(255, 66, 109, 0.42);
}

.biomes-ui-vitals-bar__fill--mana {
  background: linear-gradient(90deg, #3edbff, #7c8dff, #c276ff);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.44);
}

.biomes-ui-vitals-bar__fill--stamina {
  background: linear-gradient(90deg, #35e68a, #b7ef5f, #ffd56b);
  box-shadow: 0 0 14px rgba(92, 240, 139, 0.42);
}

.biomes-ui-vitals-panel__standing {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 6px;
  margin-top: 9px;
}

.biomes-ui-vitals-panel__footer {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(0, 1fr);
  gap: 6px;
  margin-top: 8px;
}

.biomes-ui-vitals-chip {
  min-width: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 2px;
  border: 1px solid rgba(232, 244, 255, 0.12);
  background: rgba(8, 14, 32, 0.72);
  border-radius: 8px;
  padding: 5px 4px;
}

.biomes-ui-vitals-chip__label {
  font-size: 8px;
  font-weight: 800;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: rgba(232, 244, 255, 0.52);
}

.biomes-ui-vitals-chip__value {
  max-width: 100%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  font-size: 11px;
  font-weight: 900;
  font-variant-numeric: tabular-nums;
  color: rgba(232, 244, 255, 0.94);
}

.biomes-ui-vitals-chip__track {
  width: 100%;
  height: 3px;
  overflow: hidden;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.48);
}

.biomes-ui-vitals-chip__fill {
  display: block;
  height: 100%;
  border-radius: 999px;
  transition: width 180ms ease;
}

.biomes-ui-vitals-chip[data-tone="like"] .biomes-ui-vitals-chip__fill {
  background: linear-gradient(90deg, #5dffad, #baff7f);
  box-shadow: 0 0 8px rgba(93, 255, 173, 0.35);
}

.biomes-ui-vitals-chip[data-tone="law"] .biomes-ui-vitals-chip__fill {
  background: linear-gradient(90deg, #70b7ff, #b4d6ff);
  box-shadow: 0 0 8px rgba(112, 183, 255, 0.35);
}

.biomes-ui-vitals-chip[data-tone="notoriety"] .biomes-ui-vitals-chip__fill {
  background: linear-gradient(90deg, #ffb86b, #ff5fc8);
  box-shadow: 0 0 8px rgba(255, 184, 107, 0.35);
}

.biomes-ui-vitals-chip[data-tone="level"] {
  border-color: rgba(255, 213, 107, 0.22);
  background: rgba(24, 20, 34, 0.74);
}


.biomes-building-system {
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-width: 0;
}

.biomes-building-hero {
  display: grid;
  grid-template-columns: minmax(0, 1fr) minmax(220px, 320px);
  gap: 14px;
  align-items: stretch;
  padding: 12px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background:
    radial-gradient(circle at 18% 0%, rgba(74, 222, 255, 0.14), transparent 34%),
    radial-gradient(circle at 88% 14%, rgba(255, 84, 196, 0.1), transparent 32%),
    var(--biomes-bg-glass);
  clip-path: var(--biomes-clip);
}

.biomes-building-eyebrow {
  margin-bottom: 4px;
  color: var(--biomes-edge-cyan);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.18em;
  text-transform: uppercase;
}

.biomes-building-title {
  margin: 0;
  color: var(--biomes-fg);
  font-size: 18px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-copy,
.biomes-building-panel-header p,
.biomes-building-card p {
  margin: 6px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 12px;
  line-height: 1.5;
}

.biomes-building-status {
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 4px;
  padding: 10px 12px;
  border: 1px solid rgba(255, 184, 68, 0.26);
  background: rgba(255, 184, 68, 0.08);
  color: var(--biomes-fg-muted);
  font-size: 11px;
  min-width: 0;
}

.biomes-building-status strong {
  color: var(--biomes-fg);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-status span:last-child {
  overflow-wrap: anywhere;
}

.biomes-building-status__label {
  color: var(--biomes-warn-amber);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.16em;
  text-transform: uppercase;
}

.biomes-building-step-rail {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  padding: 7px 10px;
}

.biomes-building-step {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.biomes-building-step span {
  display: inline-flex;
  min-width: 30px;
  justify-content: center;
  border: 1px solid rgba(232, 244, 255, 0.16);
  border-radius: 3px;
  padding: 1px 4px;
  font-size: 9px;
  opacity: 0.68;
}

.biomes-building-layout {
  display: grid;
  grid-template-columns: minmax(220px, 280px) minmax(0, 1fr);
  gap: 14px;
  align-items: start;
}

.biomes-building-sidebar,
.biomes-building-main {
  min-width: 0;
}

.biomes-building-card {
  width: 100%;
  box-sizing: border-box;
  padding: 11px 12px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: var(--biomes-bg-glass);
  color: var(--biomes-fg);
  clip-path: var(--biomes-clip);
}

.biomes-building-select-card {
  display: block;
  min-height: 138px;
  text-align: left;
  cursor: pointer;
  outline: none;
}

.biomes-building-select-card:hover,
.biomes-building-select-card:focus-visible,
.biomes-building-select-card[data-focused="true"] {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 16px rgba(74, 222, 255, 0.32);
}

.biomes-building-select-card[data-selected="true"] {
  border-color: var(--biomes-edge-magenta);
  box-shadow:
    0 0 14px rgba(255, 84, 196, 0.44),
    inset 0 0 18px rgba(255, 84, 196, 0.1);
}

.biomes-building-card-title,
.biomes-building-panel-header .biomes-building-card-title {
  margin: 0;
  color: var(--biomes-fg);
  font-size: 15px;
  letter-spacing: 0.1em;
  text-transform: uppercase;
}

.biomes-building-card-title-row {
  display: flex;
  justify-content: space-between;
  gap: 10px;
  align-items: flex-start;
  margin-bottom: 4px;
}

.biomes-building-card-title-row strong {
  font-size: 13px;
  letter-spacing: 0.06em;
  text-transform: uppercase;
}

.biomes-building-card-title-row span {
  flex: 0 0 auto;
  color: var(--biomes-warn-amber);
  font-size: 10px;
  font-weight: 900;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-muted {
  color: var(--biomes-fg-muted);
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-quote {
  margin: 8px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 13px;
  line-height: 1.55;
  font-style: italic;
}

.biomes-building-actions {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 12px;
}

.biomes-building-actions .biomes-ui-tab {
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: rgba(74, 222, 255, 0.06);
}

.biomes-building-actions .biomes-ui-tab:disabled,
.biomes-building-actions .biomes-ui-tab[aria-disabled="true"] {
  cursor: not-allowed;
  opacity: 0.45;
}

.biomes-building-grid {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.biomes-building-grid [role="row"] {
  gap: 8px !important;
}

.biomes-building-grid [role="row"] > * {
  flex: 1 1 0;
  min-width: 0;
}

.biomes-building-chip-row {
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  margin-top: 10px;
}

.biomes-building-chip {
  border: 1px solid rgba(232, 244, 255, 0.14);
  background: rgba(8, 14, 32, 0.72);
  border-radius: 999px;
  padding: 3px 7px;
  color: var(--biomes-fg-muted);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-panel-header {
  margin-bottom: 10px;
}

.biomes-building-stage-list {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 8px;
}

.biomes-building-stage {
  display: grid;
  grid-template-columns: 34px minmax(0, 1fr);
  gap: 9px;
  align-items: center;
  padding: 9px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: var(--biomes-bg-glass);
  clip-path: var(--biomes-clip);
}

.biomes-building-stage[data-active="true"] {
  border-color: var(--biomes-warn-amber);
  box-shadow: 0 0 12px rgba(255, 184, 68, 0.18);
}

.biomes-building-stage[data-complete="true"] {
  border-color: rgba(93, 255, 173, 0.45);
}

.biomes-building-stage__marker {
  display: grid;
  place-items: center;
  width: 30px;
  height: 30px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 50%;
  color: var(--biomes-fg);
  font-weight: 900;
}

.biomes-building-stage strong {
  display: block;
  color: var(--biomes-fg);
  font-size: 12px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}

.biomes-building-stage span {
  display: block;
  margin-top: 2px;
  color: var(--biomes-fg-muted);
  font-size: 10px;
  line-height: 1.35;
}

.biomes-building-property-grid {
  display: grid;
  grid-template-columns: repeat(4, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}

.biomes-building-metric {
  padding: 8px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background: rgba(8, 14, 32, 0.72);
}

.biomes-building-metric span {
  display: block;
  color: var(--biomes-fg-dim);
  font-size: 9px;
  font-weight: 800;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.biomes-building-metric strong {
  display: block;
  margin-top: 4px;
  color: var(--biomes-fg);
  font-size: 12px;
  overflow-wrap: anywhere;
}

.biomes-building-summary dl {
  display: grid;
  gap: 6px;
  margin: 10px 0 0;
}

.biomes-building-summary-row {
  display: grid;
  grid-template-columns: 78px minmax(0, 1fr);
  gap: 8px;
  align-items: baseline;
  border-bottom: 1px solid rgba(232, 244, 255, 0.08);
  padding-bottom: 5px;
}

.biomes-building-summary-row dt {
  color: var(--biomes-fg-dim);
  font-size: 9px;
  font-weight: 900;
  letter-spacing: 0.12em;
  text-transform: uppercase;
}

.biomes-building-summary-row dd {
  margin: 0;
  color: var(--biomes-fg);
  font-size: 11px;
  overflow-wrap: anywhere;
}

@media (max-width: 860px) {
  .biomes-building-hero,
  .biomes-building-layout {
    grid-template-columns: 1fr;
  }

  .biomes-building-sidebar {
    order: 2;
  }

  .biomes-building-main {
    order: 1;
  }

  .biomes-building-property-grid,
  .biomes-building-stage-list {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
}

@media (max-width: 520px) {
  .biomes-building-title {
    font-size: 15px;
  }

  .biomes-building-step-rail {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }

  .biomes-building-step {
    justify-content: center;
    width: 100%;
  }

  .biomes-building-grid [role="row"] {
    flex-direction: column;
  }

  .biomes-building-property-grid,
  .biomes-building-stage-list {
    grid-template-columns: 1fr;
  }

  .biomes-building-actions .biomes-ui-tab {
    width: 100%;
  }
}

@media (max-width: 768px) {
  .biomes-ui-vitals-panel {
    left: 8px;
    top: 8px;
    width: min(16.25rem, calc(100vw - 1rem));
    padding: 8px 9px 9px;
  }
  .biomes-ui-vitals-panel__game { font-size: 11px; }
  .biomes-ui-vitals-panel__title { font-size: 9px; }
  .biomes-ui-vitals-panel__state { font-size: 8px; max-width: 4.75rem; }
  .biomes-ui-vitals-bar__track { height: 8px; }
  .biomes-ui-vitals-panel__standing { gap: 4px; }
}
/* Production inventory layout */
.biomes-ui-inventory {
  display: grid;
  grid-template-columns: 240px minmax(360px, 1fr) 280px;
  gap: 16px;
  min-height: 420px;
}
.biomes-ui-inventory__sidebar,
.biomes-ui-inventory__main,
.biomes-ui-inventory__details {
  min-width: 0;
}
.biomes-ui-inventory__toolbar {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 10px;
  margin-bottom: 12px;
}
.biomes-ui-inventory__search {
  display: flex;
  flex-direction: column;
  gap: 4px;
  min-width: 220px;
  color: var(--biomes-fg-muted);
  font-size: 10px;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.biomes-ui-inventory__search input {
  min-height: 34px;
  padding: 6px 10px;
  color: var(--biomes-fg);
  background: var(--biomes-bg-glass-strong);
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 4px;
  outline: none;
}
.biomes-ui-inventory__search input:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 12px rgba(74, 222, 255, 0.32);
}
.biomes-ui-inventory__filters {
  display: flex;
  flex-wrap: wrap;
  gap: 2px;
  justify-content: flex-end;
}
.biomes-ui-inventory__slot {
  position: relative;
}
.biomes-ui-inventory__count {
  position: absolute;
  right: 4px;
  top: 2px;
  font-size: 10px;
  font-weight: 800;
  color: #fff;
  text-shadow: 0 0 4px rgba(0,0,0,0.8);
}
.biomes-ui-inventory__durability {
  position: absolute;
  left: 4px;
  right: auto;
  bottom: 3px;
  height: 3px;
  background: linear-gradient(90deg, var(--biomes-edge-cyan), var(--biomes-edge-magenta));
  border-radius: 3px;
}
.biomes-ui-inventory__currency-list,
.biomes-ui-inventory__details-card,
.biomes-ui-inventory__contract-note {
  padding: 10px;
  background: var(--biomes-bg-glass);
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 6px;
}
.biomes-ui-inventory__currency-row {
  display: grid;
  grid-template-columns: 24px 1fr auto;
  gap: 8px;
  align-items: center;
  padding: 4px 0;
  font-size: 12px;
}
.biomes-ui-inventory__details-heading {
  display: grid;
  grid-template-columns: 42px 1fr;
  gap: 8px;
  align-items: center;
  margin-bottom: 8px;
}
.biomes-ui-inventory__details-heading p {
  margin: 2px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.biomes-ui-inventory__actions {
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 6px;
  margin-top: 10px;
}
.biomes-ui-action-button,
.biomes-ui-inventory__actions button {
  padding: 7px 8px;
  color: var(--biomes-fg);
  background: rgba(74, 222, 255, 0.08);
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 4px;
  font-size: 11px;
  cursor: pointer;
}
.biomes-ui-action-button:hover,
.biomes-ui-action-button:focus-visible,
.biomes-ui-inventory__actions button:hover,
.biomes-ui-inventory__actions button:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 12px rgba(74, 222, 255, 0.22);
}
.biomes-ui-inventory__actions button:disabled {
  opacity: 0.42;
  cursor: not-allowed;
}
.biomes-ui-inventory__contract-note {
  margin-top: 10px;
  color: var(--biomes-fg-muted);
  font-size: 11px;
  line-height: 1.4;
}
.biomes-ui-guild-building-guide {
  margin-top: 14px;
  padding: 10px;
  border: 1px solid var(--biomes-edge-magenta-soft);
  background: rgba(255, 84, 196, 0.08);
  border-radius: 6px;
  font-size: 12px;
}
.biomes-ui-guild-building-guide ol {
  margin: 8px 0 0 18px;
  padding: 0;
  color: var(--biomes-fg-muted);
}

/* Player profile dialog */
.mini-phone.profile {
  --mini-phone-width: min(1120px, calc(100vw - 32px));
  --mini-phone-height: min(720px, calc(100vh - 32px));
  width: var(--mini-phone-width);
  height: var(--mini-phone-height);
  background: transparent !important;
  border: 0 !important;
  box-shadow: none !important;
  overflow: visible;
}
.mini-phone.profile .mini-phone-screen-wrap {
  width: 100%;
  height: 100%;
  overflow: visible;
}
.biomes-profile-screen {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
  padding: 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  overflow: hidden;
}
.biomes-profile-screen__header,
.biomes-profile-sheet__header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
  flex: 0 0 auto;
}
.biomes-profile-screen__identity {
  min-width: 0;
}
.biomes-profile-screen__eyebrow {
  display: block;
  margin-bottom: 4px;
  color: var(--biomes-edge-cyan);
  font-size: 10px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.biomes-profile-screen h2,
.biomes-profile-sheet h3 {
  margin: 0;
  color: var(--biomes-fg);
  line-height: 1.05;
  overflow-wrap: anywhere;
}
.biomes-profile-screen h2 {
  font-size: 22px;
}
.biomes-profile-sheet h3 {
  font-size: 18px;
}
.biomes-profile-screen__identity p {
  margin: 4px 0 0;
  color: var(--biomes-fg-muted);
  font-size: 12px;
}
.biomes-profile-screen__close {
  flex: 0 0 auto;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  padding: 7px 10px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 5px;
  background: rgba(7, 12, 26, 0.78);
  color: var(--biomes-fg);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  outline: none;
}
.biomes-profile-screen__close span {
  min-width: 26px;
  display: inline-grid;
  place-items: center;
  padding: 2px 5px;
  border-radius: 4px;
  border: 1px solid rgba(255, 255, 255, 0.2);
  color: var(--biomes-fg-muted);
  background: rgba(255, 255, 255, 0.08);
}
.biomes-profile-screen__close:hover,
.biomes-profile-screen__close:focus-visible,
.biomes-profile-action:hover,
.biomes-profile-action:focus-visible,
.biomes-profile-summary__team-badge:hover,
.biomes-profile-summary__team-badge:focus-visible,
.biomes-profile-post:hover,
.biomes-profile-post:focus-visible,
.biomes-profile-load-more:hover,
.biomes-profile-load-more:focus-visible {
  border-color: var(--biomes-edge-cyan);
  box-shadow: 0 0 14px rgba(74, 222, 255, 0.28);
}
.biomes-profile-screen__body {
  min-height: 0;
  flex: 1 1 auto;
  display: grid;
  grid-template-columns: minmax(210px, 0.72fr) minmax(340px, 1.12fr) minmax(260px, 0.92fr);
  gap: 10px;
}
.biomes-profile-screen__summary,
.biomes-profile-screen__avatar-panel,
.biomes-profile-screen__posts-panel {
  min-width: 0;
  min-height: 0;
  border: 1px solid rgba(74, 222, 255, 0.24);
  background:
    radial-gradient(circle at 12% 0%, rgba(74, 222, 255, 0.12), transparent 35%),
    linear-gradient(180deg, rgba(13, 22, 44, 0.68), rgba(7, 12, 26, 0.84));
  clip-path: polygon(10px 0, 100% 0, 100% calc(100% - 10px), calc(100% - 10px) 100%, 0 100%, 0 10px);
}
.biomes-profile-screen__summary {
  overflow: auto;
}
.biomes-profile-screen__avatar-panel,
.biomes-profile-screen__posts-panel {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 10px;
  box-sizing: border-box;
}
.biomes-profile-screen__posts-panel {
  overflow: auto;
}
.biomes-profile-summary {
  min-height: 100%;
  padding: 12px;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}
.biomes-profile-summary__avatar {
  position: relative;
  width: min(132px, 62%);
  aspect-ratio: 1;
  flex: 0 0 auto;
}
.biomes-profile-summary__avatar-image {
  width: 100%;
  height: 100%;
  border-radius: 999px;
  overflow: hidden;
  border: 1px solid var(--biomes-edge-cyan-soft);
  background:
    radial-gradient(circle at 50% 35%, rgba(232, 244, 255, 0.2), transparent 30%),
    linear-gradient(180deg, rgba(74, 222, 255, 0.18), rgba(7, 12, 26, 0.86));
}
.biomes-profile-summary__avatar-image img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.biomes-profile-summary__team-badge {
  position: absolute;
  right: 0;
  bottom: 0;
  padding: 2px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 999px;
  background: rgba(7, 12, 26, 0.86);
  cursor: pointer;
  outline: none;
}
.biomes-profile-summary__copy {
  width: 100%;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
  align-items: center;
  text-align: center;
}
.biomes-profile-summary__copy strong {
  max-width: 100%;
  color: var(--biomes-fg);
  font-size: 16px;
  overflow-wrap: anywhere;
}
.biomes-profile-summary__copy span,
.biomes-profile-empty {
  color: var(--biomes-fg-muted);
  font-size: 12px;
  line-height: 1.4;
}
.biomes-profile-actions {
  width: 100%;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 7px;
}
.biomes-profile-action {
  min-width: 0;
  min-height: 54px;
  padding: 8px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 3px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 5px;
  background: rgba(74, 222, 255, 0.08);
  color: var(--biomes-fg);
  cursor: pointer;
  outline: none;
  text-align: left;
}
.biomes-profile-action span {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  overflow-wrap: anywhere;
}
.biomes-profile-action strong {
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 600;
  overflow-wrap: anywhere;
}
.biomes-profile-action[data-tone="primary"] {
  border-color: var(--biomes-edge-magenta-soft);
  background: rgba(255, 84, 196, 0.12);
}
.biomes-profile-action[data-tone="danger"] {
  border-color: rgba(255, 120, 120, 0.34);
  color: #ffd6d6;
  background: rgba(255, 90, 90, 0.08);
}
.biomes-profile-action[aria-disabled="true"] {
  opacity: 0.48;
  cursor: default;
}
.biomes-profile-section-heading {
  flex: 0 0 auto;
  min-width: 0;
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  gap: 8px;
}
.biomes-profile-section-heading span {
  color: var(--biomes-fg-muted);
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.14em;
  text-transform: uppercase;
}
.biomes-profile-section-heading strong {
  color: var(--biomes-fg);
  font-size: 12px;
  overflow-wrap: anywhere;
  text-align: right;
}
.biomes-profile-avatar-stage {
  min-height: 0;
  flex: 1 1 auto;
  display: flex;
  align-items: stretch;
  justify-content: center;
}
.biomes-profile-avatar-stage .inventory-cells.wearables {
  --cell-width: clamp(36px, 4.3vmin, 50px);
  --cell-height: var(--cell-width);
  width: 100%;
  max-width: 560px;
  flex-wrap: nowrap;
  align-items: stretch;
  justify-content: center;
}
.biomes-profile-avatar-stage .wearables-center {
  min-width: 0;
  flex: 1 1 auto;
  width: auto;
}
.biomes-profile-avatar-stage .wearables-col {
  flex: 0 0 auto;
}
.biomes-profile-avatar-stage .avatar-viewer-wrap {
  height: 100%;
  min-height: 280px;
  background:
    radial-gradient(circle at 50% 38%, rgba(74, 222, 255, 0.12), transparent 34%),
    rgba(7, 12, 26, 0.56);
  border: 1px solid rgba(74, 222, 255, 0.16);
  box-shadow: inset 0 0 20px rgba(74, 222, 255, 0.05);
}
.biomes-profile-avatar-stage .avatar-viewer {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
}
.biomes-profile-avatar-stage .three-object-preview-wrapper {
  height: 92%;
  width: 100%;
}
.biomes-profile-post-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 7px;
}
.biomes-profile-post {
  width: 100%;
  aspect-ratio: 1;
  padding: 0;
  overflow: hidden;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 6px;
  background: rgba(7, 12, 26, 0.76);
  cursor: pointer;
  outline: none;
}
.biomes-profile-post img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
.biomes-profile-load-more {
  min-height: 34px;
  padding: 8px 10px;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 5px;
  background: rgba(74, 222, 255, 0.08);
  color: var(--biomes-fg);
  cursor: pointer;
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  outline: none;
}
.biomes-profile-sheet-backdrop {
  position: absolute;
  inset: 0;
  z-index: 8;
  display: grid;
  place-items: center;
  padding: 16px;
  background: rgba(2, 6, 14, 0.64);
}
.biomes-profile-sheet {
  width: min(520px, 100%);
  max-height: min(560px, 100%);
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px;
  box-sizing: border-box;
}
.biomes-profile-sheet__body {
  min-height: 0;
  overflow: auto;
  border: 1px solid var(--biomes-edge-cyan-soft);
  border-radius: 6px;
  background: rgba(7, 12, 26, 0.54);
}
.biomes-profile-sheet__body .load-more-row {
  color: var(--biomes-fg);
}
.biomes-profile-sheet .follow-list-users .user {
  outline: none;
}
.biomes-profile-sheet .follow-list-users .user:focus-visible {
  background: rgba(74, 222, 255, 0.12);
  box-shadow: inset 0 0 0 1px var(--biomes-edge-cyan);
}
.biomes-profile-screen .slideover-bg {
  left: 0;
  width: 100%;
  height: 100%;
}
.biomes-profile-screen .slideover {
  width: min(520px, 100%);
  height: 100%;
  background: var(--biomes-bg-glass-strong);
  color: var(--biomes-fg);
  border: 1px solid var(--biomes-edge-cyan-soft);
}
@media (max-width: 980px) {
  .biomes-ui-inventory {
    grid-template-columns: 1fr;
  }
  .biomes-ui-inventory__toolbar {
    align-items: stretch;
    flex-direction: column;
  }
  .biomes-ui-inventory__filters {
    justify-content: flex-start;
  }
  .mini-phone.profile {
    --mini-phone-width: calc(100vw - 16px);
    --mini-phone-height: calc(100vh - 16px);
  }
  .biomes-profile-screen {
    padding: 10px;
  }
  .biomes-profile-screen__body {
    grid-template-columns: 1fr;
    overflow: auto;
    padding-right: 2px;
  }
  .biomes-profile-screen__summary,
  .biomes-profile-screen__avatar-panel,
  .biomes-profile-screen__posts-panel {
    min-height: auto;
    overflow: visible;
  }
  .biomes-profile-summary {
    min-height: 0;
  }
  .biomes-profile-avatar-stage {
    min-height: 380px;
  }
  .biomes-profile-screen__posts-panel {
    overflow: visible;
  }
}
@media (max-width: 560px) {
  .biomes-ui-inventory {
    gap: 12px;
    min-height: auto;
  }
  .biomes-ui-inventory__actions {
    grid-template-columns: 1fr;
  }
  .biomes-profile-post-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}
@media (max-width: 520px) {
  .biomes-profile-screen__header,
  .biomes-profile-sheet__header {
    flex-direction: column;
  }
  .biomes-profile-screen__close {
    align-self: flex-start;
  }
  .biomes-profile-actions {
    grid-template-columns: 1fr;
  }
  .biomes-profile-avatar-stage {
    min-height: 320px;
  }
  .biomes-profile-avatar-stage .inventory-cells.wearables {
    --cell-width: clamp(30px, 10vw, 40px);
  }
  .biomes-profile-post-grid {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .biomes-profile-sheet-backdrop {
    padding: 8px;
  }
}
`;

export const BIOMES_UI_THEME_ID = "biomes-ui-theme";

/** Inject the BiomesUI stylesheet once. Safe to call any number of times. */
export function installBiomesUITheme(): void {
  if (typeof document === "undefined") return; // SSR no-op
  if (document.getElementById(BIOMES_UI_THEME_ID)) return; // already installed
  const style = document.createElement("style");
  style.id = BIOMES_UI_THEME_ID;
  style.setAttribute("data-source", "biomes_ui");
  style.appendChild(document.createTextNode(BIOMES_UI_THEME_CSS));
  document.head.appendChild(style);
}
