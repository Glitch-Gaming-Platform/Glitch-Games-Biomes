import { maybeUseExistingMiniPhoneContext } from "@/client/components/system/mini_phone/MiniPhoneContext";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import {
  clampBiomesUIShopAmountV1,
  nextBiomesUIShopAmountV1,
} from "@/client/components/inventory/shopBiomesUIModel";
import type { PropsWithChildren, ReactNode } from "react";
import React, { useEffect } from "react";

function isTypingInInput() {
  if (typeof document === "undefined") {
    return false;
  }
  const active = document.activeElement as HTMLElement | null;
  if (!active) {
    return false;
  }
  const tag = active.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || active.isContentEditable;
}

export const BiomesUIShopChrome: React.FunctionComponent<
  PropsWithChildren<{
    title: string;
    eyebrow: string;
    subtitle?: ReactNode;
    variant: "container" | "npc-buyer";
    actions?: ReactNode;
    footer?: ReactNode;
  }>
> = ({ title, eyebrow, subtitle, variant, actions, footer, children }) => {
  const miniPhone = maybeUseExistingMiniPhoneContext();

  useEffect(() => installBiomesUITheme(), []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isTypingInInput()) {
        miniPhone?.close();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [miniPhone]);

  return (
    <section
      className="biomes-ui-shop-screen biomes-ui-panel"
      data-biomes-ui-shop={variant}
      role="dialog"
      aria-label={title}
    >
      <header className="biomes-ui-shop-screen__header">
        <div className="biomes-ui-shop-screen__identity">
          <span className="biomes-ui-shop-screen__eyebrow">{eyebrow}</span>
          <h2>{title}</h2>
          {subtitle ? (
            <p className="biomes-ui-shop-screen__subtitle">{subtitle}</p>
          ) : null}
        </div>
        <div className="biomes-ui-shop-screen__actions">
          {actions}
          <button
            type="button"
            className="biomes-ui-shop-screen__close"
            aria-label="Close shop"
            onClick={() => miniPhone?.close()}
          >
            <span aria-hidden>Esc</span>
            Close
          </button>
        </div>
      </header>
      <div className="biomes-ui-shop-screen__body">{children}</div>
      {footer ? (
        <footer className="biomes-ui-shop-screen__footer">{footer}</footer>
      ) : null}
    </section>
  );
};

export const BiomesUIShopSection: React.FunctionComponent<
  PropsWithChildren<{
    title: string;
    meta?: ReactNode;
    className?: string;
    ariaLabel?: string;
  }>
> = ({ title, meta, className, ariaLabel, children }) => (
  <section
    className={`biomes-ui-shop-section ${className ?? ""}`}
    aria-label={ariaLabel ?? title}
  >
    <div className="biomes-ui-shop-section__header">
      <h3>{title}</h3>
      {meta ? <span>{meta}</span> : null}
    </div>
    {children}
  </section>
);

export const BiomesUIShopAmountStepper: React.FunctionComponent<{
  label: string;
  value: number;
  min: number;
  max: number;
  onChange: (value: number) => void;
  step?: number;
  largeStep?: number;
  disabled?: boolean;
}> = ({
  label,
  value,
  min,
  max,
  onChange,
  step = 1,
  largeStep = 10,
  disabled,
}) => {
  const safeValue = clampBiomesUIShopAmountV1(value, min, max);
  const changeBy = (delta: number) => {
    onChange(nextBiomesUIShopAmountV1(safeValue, delta, min, max));
  };

  return (
    <div
      className="biomes-ui-shop-stepper"
      role="group"
      aria-label={label}
      tabIndex={disabled ? -1 : 0}
      onKeyDown={(event) => {
        if (disabled) {
          return;
        }
        switch (event.key) {
          case "ArrowLeft":
          case "ArrowDown":
            event.preventDefault();
            changeBy(-step);
            break;
          case "ArrowRight":
          case "ArrowUp":
            event.preventDefault();
            changeBy(step);
            break;
          case "PageDown":
            event.preventDefault();
            changeBy(-largeStep);
            break;
          case "PageUp":
            event.preventDefault();
            changeBy(largeStep);
            break;
          case "Home":
            event.preventDefault();
            onChange(min);
            break;
          case "End":
            event.preventDefault();
            onChange(max);
            break;
        }
      }}
    >
      <span className="biomes-ui-shop-stepper__label">{label}</span>
      <button
        type="button"
        aria-label={`Decrease ${label} by ${largeStep}`}
        disabled={disabled || safeValue <= min}
        onClick={() => changeBy(-largeStep)}
      >
        -{largeStep}
      </button>
      <button
        type="button"
        aria-label={`Decrease ${label}`}
        disabled={disabled || safeValue <= min}
        onClick={() => changeBy(-step)}
      >
        -
      </button>
      <output aria-live="polite">{safeValue.toLocaleString()}</output>
      <button
        type="button"
        aria-label={`Increase ${label}`}
        disabled={disabled || safeValue >= max}
        onClick={() => changeBy(step)}
      >
        +
      </button>
      <button
        type="button"
        aria-label={`Increase ${label} by ${largeStep}`}
        disabled={disabled || safeValue >= max}
        onClick={() => changeBy(largeStep)}
      >
        +{largeStep}
      </button>
    </div>
  );
};
