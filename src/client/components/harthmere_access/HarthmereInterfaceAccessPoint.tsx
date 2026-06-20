import * as React from "react";

export type HarthmereInterfaceAccessPointKind =
  | "business_owner"
  | "business_customer"
  | "home_owner";

export interface HarthmereInterfaceAccessPointProps {
  kind: HarthmereInterfaceAccessPointKind;
  title: string;
  helper: string;
  keyLabel: string;
  eyebrow: string;
  ariaLabel: string;
  onClick?: () => void;
  dataAttributes?: Record<string, string | number | boolean | undefined>;
}

const KIND_ACCENT: Record<
  HarthmereInterfaceAccessPointKind,
  { edge: string; glow: string; fill: string; symbol: string }
> = {
  business_owner: {
    edge: "rgba(97, 226, 255, 0.82)",
    glow: "rgba(97, 226, 255, 0.28)",
    fill: "rgba(24, 72, 102, 0.56)",
    symbol: "counter",
  },
  business_customer: {
    edge: "rgba(255, 205, 105, 0.88)",
    glow: "rgba(255, 205, 105, 0.28)",
    fill: "rgba(92, 68, 26, 0.58)",
    symbol: "service",
  },
  home_owner: {
    edge: "rgba(134, 235, 170, 0.84)",
    glow: "rgba(134, 235, 170, 0.26)",
    fill: "rgba(28, 78, 58, 0.56)",
    symbol: "home",
  },
};

function accessIconBars(symbol: string) {
  if (symbol === "home") {
    return (
      <>
        <span style={{ ...iconLineStyle, left: 11, top: 17, width: 18, transform: "rotate(-34deg)", transformOrigin: "right center" }} />
        <span style={{ ...iconLineStyle, right: 11, top: 17, width: 18, transform: "rotate(34deg)", transformOrigin: "left center" }} />
        <span style={{ ...iconBlockStyle, left: 14, top: 25, width: 22, height: 17 }} />
        <span style={{ ...iconLineStyle, left: 22, top: 32, width: 6, height: 12, borderRadius: 2 }} />
      </>
    );
  }
  if (symbol === "service") {
    return (
      <>
        <span style={{ ...iconLineStyle, width: 28, transform: "translateY(-8px)" }} />
        <span style={{ ...iconBlockStyle, width: 30, height: 12, transform: "translateY(2px)" }} />
        <span style={{ ...iconLineStyle, width: 18, transform: "translateY(14px)" }} />
      </>
    );
  }
  return (
    <>
      <span style={{ ...iconBlockStyle, width: 30, height: 14, transform: "translateY(-6px)" }} />
      <span style={{ ...iconLineStyle, width: 24, transform: "translateY(7px)" }} />
      <span style={{ ...iconLineStyle, width: 16, transform: "translateY(16px)" }} />
    </>
  );
}

export const HarthmereInterfaceAccessPoint: React.FunctionComponent<
  HarthmereInterfaceAccessPointProps
> = ({
  kind,
  title,
  helper,
  keyLabel,
  eyebrow,
  ariaLabel,
  onClick,
  dataAttributes,
}) => {
  const accent = KIND_ACCENT[kind];
  const shortcut =
    keyLabel.length === 1 ? keyLabel.toLocaleUpperCase() : undefined;
  return (
    <button
      type="button"
      {...dataAttributes}
      data-harthmere-interface-access-point="true"
      data-access-point-kind={kind}
      data-access-point-polish="production"
      data-access-point-visible-target="bottom-center"
      data-access-point-min-height="82"
      data-access-point-key-size="46"
      aria-label={ariaLabel}
      aria-keyshortcuts={shortcut}
      onClick={(event) => {
        event.preventDefault();
        event.stopPropagation();
        event.nativeEvent.stopImmediatePropagation?.();
        onClick?.();
      }}
      style={{
        position: "fixed",
        left: "50%",
        bottom: "max(138px, calc(env(safe-area-inset-bottom) + 138px))",
        transform: "translateX(-50%)",
        zIndex: 1205,
        display: "grid",
        gridTemplateColumns: "54px minmax(0, 1fr) minmax(46px, auto)",
        alignItems: "center",
        gap: 12,
        width: "min(calc(100vw - 24px), 590px)",
        minHeight: 82,
        padding: "12px 14px",
        border: `1px solid ${accent.edge}`,
        borderRadius: 8,
        background:
          "linear-gradient(135deg, rgba(8, 14, 30, 0.96), rgba(17, 25, 43, 0.9))",
        boxShadow: `0 18px 38px rgba(0, 0, 0, 0.52), 0 0 28px ${accent.glow}, inset 0 0 24px rgba(255, 255, 255, 0.045)`,
        color: "var(--biomes-fg)",
        textAlign: "left",
        cursor: "pointer",
        pointerEvents: "auto",
        touchAction: "manipulation",
        outlineOffset: 4,
        WebkitBackdropFilter: "blur(14px) saturate(120%)",
        backdropFilter: "blur(14px) saturate(120%)",
        letterSpacing: 0,
      }}
    >
      <span
        aria-hidden="true"
        style={{
          position: "relative",
          display: "grid",
          placeItems: "center",
          width: 50,
          height: 50,
          borderRadius: 8,
          border: `1px solid ${accent.edge}`,
          background: accent.fill,
          boxShadow: `inset 0 0 18px rgba(255, 255, 255, 0.06), 0 0 18px ${accent.glow}`,
          overflow: "hidden",
        }}
      >
        {accessIconBars(accent.symbol)}
      </span>
      <span style={{ display: "grid", gap: 4, minWidth: 0 }}>
        <span
          style={{
            color: accent.edge,
            fontSize: 10,
            fontWeight: 800,
            lineHeight: 1,
            letterSpacing: 0,
            textTransform: "uppercase",
          }}
        >
          {eyebrow}
        </span>
        <strong
          style={{
            color: "var(--biomes-fg)",
            fontSize: 15,
            lineHeight: 1.15,
            letterSpacing: 0,
            overflowWrap: "anywhere",
          }}
        >
          {title}
        </strong>
        <span
          style={{
            color: "var(--biomes-fg-muted)",
            fontSize: 12,
            lineHeight: 1.25,
            letterSpacing: 0,
            overflowWrap: "anywhere",
          }}
        >
          {helper}
        </span>
      </span>
      <span
        aria-hidden="true"
        style={{
          display: "grid",
          placeItems: "center",
          minWidth: 46,
          height: 46,
          padding: keyLabel.length > 2 ? "0 10px" : 0,
          borderRadius: 7,
          border: `1px solid ${accent.edge}`,
          background: "rgba(255, 255, 255, 0.08)",
          color: "var(--biomes-fg)",
          fontWeight: 900,
          fontSize: keyLabel.length > 2 ? 12 : 18,
          letterSpacing: 0,
          whiteSpace: "nowrap",
        }}
      >
        {keyLabel}
      </span>
    </button>
  );
};

const iconLineStyle: React.CSSProperties = {
  position: "absolute",
  height: 3,
  borderRadius: 3,
  background: "rgba(255, 255, 255, 0.9)",
  boxShadow: "0 0 10px rgba(255, 255, 255, 0.35)",
};

const iconBlockStyle: React.CSSProperties = {
  position: "absolute",
  borderRadius: 4,
  border: "1px solid rgba(255, 255, 255, 0.7)",
  background: "rgba(255, 255, 255, 0.2)",
};
