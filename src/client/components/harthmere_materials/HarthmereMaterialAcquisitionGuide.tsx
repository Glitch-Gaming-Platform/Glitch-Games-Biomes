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
  ownerQuestId?: string;
  ownerStepId?: string;
}> = ({
  itemId,
  itemName,
  count = 1,
  compact = false,
  ownerQuestId,
  ownerStepId,
}) => {
  const plan = harthmereMaterialAcquisitionPlan({ itemId, itemName, count });
  if (!plan || plan.routes.length === 0) return null;

  return (
    <details
      className="harthmere-material-guide"
      data-material-guide-item-id={plan.itemId}
      data-material-guide-layout="stacked"
      data-material-guide-owner-quest={ownerQuestId}
      data-material-guide-owner-step={ownerStepId}
      style={{
        width: "100%",
        minWidth: 0,
        flex: "0 0 100%",
        marginTop: compact ? 5 : 8,
        padding: compact ? "5px 7px" : "7px 9px",
        boxSizing: "border-box",
        border: "1px solid rgba(109, 196, 255, 0.32)",
        borderRadius: 6,
        background: "rgba(12, 26, 44, 0.72)",
        color: "rgba(235, 245, 255, 0.94)",
        fontSize: compact ? 10 : 11,
        lineHeight: 1.35,
      }}
    >
      <summary
        style={{
          cursor: "pointer",
          fontWeight: 800,
          overflowWrap: "break-word",
        }}
      >
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
            data-material-route-layout="readable"
            style={{
              display: "grid",
              gridTemplateColumns: "max-content minmax(0, 1fr)",
              alignItems: "start",
              gap: 7,
              minWidth: 0,
              padding: compact ? 5 : 7,
              borderRadius: 5,
              background: "rgba(255, 255, 255, 0.045)",
            }}
          >
            <strong style={{ color: "#9cd8ff" }}>
              {KIND_LABEL[route.kind]}
            </strong>
            <span
              style={{
                minWidth: 0,
                overflowWrap: "break-word",
                wordBreak: "normal",
              }}
            >
              <span
                style={{ display: "block", fontWeight: 700, lineHeight: 1.25 }}
              >
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
                    ownerQuestId,
                    ownerStepId,
                    setAtMs: Date.now(),
                  })
                }
                style={{
                  gridColumn: "1 / -1",
                  width: "100%",
                  minWidth: 0,
                  whiteSpace: "normal",
                  fontSize: compact ? 9 : 10,
                  lineHeight: 1.2,
                }}
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
