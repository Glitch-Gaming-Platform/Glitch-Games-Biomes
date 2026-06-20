import type * as React from "react";
import { resolveAssetUrlUntyped } from "@/galois/interface/asset_paths";
import type { HarthmereResolvedBikkieVisual } from "@/shared/harthmere/bikkie_visual_resolver";

export function harthmereBikkieVisualImageUrl(
  visual: HarthmereResolvedBikkieVisual | undefined
) {
  if (!visual?.iconAssetPath) return undefined;
  return resolveAssetUrlUntyped(visual.iconAssetPath);
}

export function harthmereBikkieVisualTileStyle(
  visual: HarthmereResolvedBikkieVisual | undefined,
  size = 42
): React.CSSProperties {
  return {
    width: size,
    height: size,
    minWidth: size,
    borderRadius: 8,
    display: "grid",
    placeItems: "center",
    position: "relative",
    overflow: "hidden",
    background:
      visual?.cssGradient ??
      "linear-gradient(135deg, #4a5567, #222a38 58%, #8390a0)",
    boxShadow:
      visual?.cssShadow ??
      "0 0 0 1px rgba(255,255,255,0.16), 0 10px 18px rgba(0,0,0,0.26)",
  };
}

export const harthmereBikkieVisualGlyphStyle: React.CSSProperties = {
  position: "relative",
  zIndex: 1,
  color: "rgba(255,255,255,0.92)",
  fontSize: 11,
  fontWeight: 800,
  lineHeight: 1,
  textShadow: "0 1px 2px rgba(0,0,0,0.45)",
  letterSpacing: 0,
};

export const harthmereBikkieVisualImageStyle: React.CSSProperties = {
  position: "absolute",
  inset: 4,
  width: "calc(100% - 8px)",
  height: "calc(100% - 8px)",
  objectFit: "contain",
  imageRendering: "pixelated",
};
