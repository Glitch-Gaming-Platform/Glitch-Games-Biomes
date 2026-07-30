import { requestBiomesUILocateOnMap } from "@/client/components/biomes_ui/adapters/mapPinnedDestination";
import {
  harthmereMaterialAcquisitionPlan,
  type HarthmereMaterialAcquisitionRoute,
} from "@/shared/harthmere/material_acquisition_guidance";
import * as React from "react";

const KIND_LABEL: Record<HarthmereMaterialAcquisitionRoute["kind"], string> = {
  buy: "Buy",
  craft: "Craft",
  gather: "Gather",
};

export const HarthmereMaterialAcquisitionGuide: React.FunctionComponent<{
  itemId: string | number | undefined;
  itemName?: string;
  count?: number;
  compact?: boolean;
}> = ({ itemId, itemName, count = 1, compact = false }) => {
  const plan = harthmereMaterialAcquisitionPlan({ itemId, itemName, count });
  if (!plan || plan.routes.length === 0) return null;

  return (
    <details
      className="harthmere-material-guide"
      data-material-guide-item-id={plan.itemId}
      style={{
        width: "100%",
        marginTop: compact ? 5 : 8,
        padding: compact ? "5px 7px" : "7px 9px",
        boxSizing: "border-box",
        border: "1px solid rgba(109, 196, 255, 0.32)",
        borderRadius: 6,
        background: "rgba(12, 26, 44, 0.72)",
        color: "rgba(235, 245, 255, 0.94)",
        fontSize: compact ? 10 : 11,
      }}
    >
      <summary style={{ cursor: "pointer", fontWeight: 800 }}>
        How to get {plan.quantity} {plan.itemName}
      </summary>
      <div
        style={{
          display: "grid",
          gap: compact ? 5 : 7,
          marginTop: 7,
        }}
      >
        {plan.routes.map((route) => (
          <div
            key={route.id}
            data-material-route-kind={route.kind}
            data-material-route-id={route.id}
            style={{
              display: "grid",
              gridTemplateColumns: "auto minmax(0, 1fr) auto",
              alignItems: "start",
              gap: 7,
              padding: compact ? 5 : 7,
              borderRadius: 5,
              background: "rgba(255, 255, 255, 0.045)",
            }}
          >
            <strong style={{ color: "#9cd8ff" }}>
              {KIND_LABEL[route.kind]}
            </strong>
            <span style={{ minWidth: 0 }}>
              <span style={{ display: "block", fontWeight: 700 }}>
                {route.title}
              </span>
              <span
                style={{
                  display: "block",
                  marginTop: 2,
                  color: "rgba(220, 232, 244, 0.78)",
                  lineHeight: 1.3,
                }}
              >
                {route.description}
                {route.purpose ? ` ${route.purpose}.` : ""}
              </span>
            </span>
            {route.markerPosition ? (
              <button
                type="button"
                className="biomes-ui-tab"
                aria-label={`Show ${route.sourceName} on map`}
                onClick={() =>
                  requestBiomesUILocateOnMap({
                    markerId:
                      route.markerId ??
                      `material_source:${route.kind}:${route.itemId}:${route.id}`,
                    label: route.sourceName,
                    kind: route.kind === "buy" ? "store" : "resource",
                    worldPosition: [...route.markerPosition!],
                    description: route.description,
                    setAtMs: Date.now(),
                  })
                }
                style={{ whiteSpace: "nowrap", fontSize: compact ? 9 : 10 }}
              >
                Show on map
              </button>
            ) : null}
          </div>
        ))}
      </div>
    </details>
  );
};
