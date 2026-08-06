import * as React from "react";
import type { HarthmereBusinessPatienceDisplay } from "./harthmereBusinessPatience";

export function HarthmereBusinessPatienceBar({
  customerName,
  patience,
}: {
  customerName: string;
  patience: HarthmereBusinessPatienceDisplay;
}) {
  const urgent =
    patience.urgency === "critical" || patience.urgency === "expired";
  return (
    <>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          gap: 8,
          marginBottom: 5,
          color: urgent
            ? "#ff9d94"
            : patience.urgency === "warning"
              ? "#ffd58a"
              : "#b7efc0",
          fontSize: 11,
          fontWeight: 800,
        }}
      >
        <span>Patience</span>
        <span data-harthmere-business-patience-label="true">
          {patience.label}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={`${customerName} patience`}
        aria-valuemin={0}
        aria-valuemax={patience.total}
        aria-valuenow={patience.remaining}
        aria-valuetext={patience.label}
        data-harthmere-business-patience="true"
        data-patience-urgency={patience.urgency}
        style={{
          height: 8,
          overflow: "hidden",
          borderRadius: 999,
          border: "1px solid rgba(255,255,255,.16)",
          background: "rgba(0,0,0,.48)",
        }}
      >
        <div
          data-harthmere-business-patience-fill="true"
          style={{
            width: `${patience.percent}%`,
            height: "100%",
            minWidth: patience.remaining > 0 ? 3 : 0,
            borderRadius: 999,
            background: urgent
              ? "linear-gradient(90deg, #ff6b6b, #ff9f2f)"
              : patience.urgency === "warning"
                ? "linear-gradient(90deg, #ffc857, #ff9f2f)"
                : "linear-gradient(90deg, #59d98e, #b6ef67)",
            transition: "width 0.5s linear, background 0.25s ease",
          }}
        />
      </div>
    </>
  );
}
