export const BIOMES_UI_ACTIVE_MINIMAP_PIN_STYLE_ID =
  "biomes-ui-active-minimap-pin";

export const BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS =
  "biomes-ui-active-minimap-pin";
export const BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS =
  "biomes-ui-active-minimap-pin--edge";
export const BIOMES_UI_ACTIVE_MINIMAP_PIN_Z_INDEX = 8;

export function biomesUIActiveMiniMapPinLabel(label: string): string {
  const normalized = String(label ?? "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) {
    return "Marked destination";
  }
  return normalized.length > 64
    ? `${normalized.slice(0, 61).trimEnd()}...`
    : normalized;
}

export function biomesUIActiveMiniMapPinHasFinitePosition(
  position: unknown
): position is [number, number, number] {
  if (!Array.isArray(position) || position.length < 3) {
    return false;
  }
  return [position[0], position[1], position[2]].every(
    (value) => typeof value === "number" && Number.isFinite(value)
  );
}

export function biomesUIActiveMiniMapPinDistanceLabelForTest(
  markerPosition: unknown,
  playerPosition: unknown
): string | undefined {
  if (
    !biomesUIActiveMiniMapPinHasFinitePosition(markerPosition) ||
    !biomesUIActiveMiniMapPinHasFinitePosition(playerPosition)
  ) {
    return undefined;
  }
  const dx = markerPosition[0] - playerPosition[0];
  const dz = markerPosition[2] - playerPosition[2];
  return `${Math.max(0, Math.round(Math.hypot(dx, dz)))}m`;
}

export function biomesUIActiveMiniMapPinClassName(
  isClippedToEdge: boolean
): string {
  return [
    BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS,
    isClippedToEdge ? BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS : "",
  ]
    .filter(Boolean)
    .join(" ");
}

export function biomesUIActiveMiniMapPinCss(): string {
  return `
@keyframes biomesUIActiveMiniMapPinPulse {
  0%, 100% { transform: scale(0.86); opacity: 0.42; }
  50% { transform: scale(1.16); opacity: 0.82; }
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS} {
  --pin-core: #8be8ff;
  --pin-edge: #f6c85f;
  --pin-shadow: rgba(95, 220, 255, 0.55);
  display: block;
  height: 1rem;
  position: relative;
  width: 1rem;
  filter: drop-shadow(0 0 0.26rem var(--pin-shadow));
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__halo {
  animation: biomesUIActiveMiniMapPinPulse 1.25s ease-in-out infinite;
  background: radial-gradient(circle, rgba(139, 232, 255, 0.42) 0%, rgba(139, 232, 255, 0.16) 48%, rgba(139, 232, 255, 0) 72%);
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 9999px;
  height: 0.95rem;
  left: 0.025rem;
  position: absolute;
  top: 0.025rem;
  width: 0.95rem;
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__tail {
  background: linear-gradient(180deg, rgba(139, 232, 255, 0.95), rgba(139, 232, 255, 0));
  border-radius: 9999px;
  height: 0.34rem;
  left: 0.44rem;
  position: absolute;
  top: 0.62rem;
  width: 0.12rem;
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__core {
  background: linear-gradient(135deg, #d9fbff 0%, var(--pin-core) 52%, #2fb5d0 100%);
  border: 1px solid rgba(255, 255, 255, 0.9);
  box-shadow: 0 0 0 1px rgba(5, 18, 32, 0.5), 0 0 0.35rem rgba(139, 232, 255, 0.7);
  height: 0.42rem;
  left: 0.29rem;
  position: absolute;
  top: 0.25rem;
  transform: rotate(45deg);
  width: 0.42rem;
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__dot {
  background: rgba(4, 12, 24, 0.86);
  border-radius: 9999px;
  display: block;
  height: 0.14rem;
  left: 0.13rem;
  position: absolute;
  top: 0.13rem;
  width: 0.14rem;
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS} {
  --pin-core: var(--pin-edge);
  --pin-shadow: rgba(246, 200, 95, 0.6);
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_EDGE_CLASS} .${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__tail {
  background: linear-gradient(180deg, rgba(246, 200, 95, 0.95), rgba(246, 200, 95, 0));
}

.${BIOMES_UI_ACTIVE_MINIMAP_PIN_ROOT_CLASS}__distance {
  background: rgba(4, 12, 24, 0.84);
  border: 1px solid rgba(255, 255, 255, 0.74);
  border-radius: 0.24rem;
  color: #f7fbff;
  font-size: 0.5rem;
  font-weight: 800;
  left: 50%;
  line-height: 1;
  min-width: 1.35rem;
  padding: 0.12rem 0.18rem;
  position: absolute;
  text-align: center;
  top: -0.52rem;
  transform: translate(-50%, -50%);
  white-space: nowrap;
}
`;
}
