import { maybeUseExistingMiniPhoneContext } from "@/client/components/system/mini_phone/MiniPhoneContext";
import { usePointerLockManager } from "@/client/components/contexts/PointerLockContext";
import { installBiomesUITheme } from "@/client/components/biomes_ui/theme/biomesUITheme";
import {
  clampBiomesUIShopAmount,
  nextBiomesUIShopAmount,
} from "@/client/components/inventory/shopBiomesUIModel";
import type { PropsWithChildren, ReactNode } from "react";
import React, { useCallback, useEffect, useRef, useState } from "react";

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

export interface BiomesUIShopPointerLockLike {
  isLocked(): boolean;
  unlock(): void;
  focusAndLock(): void;
}

export interface BiomesUIShopPointerLockReturnRef {
  current: boolean;
}

export function openBiomesUIShopPointerLock(
  pointerLockManager: BiomesUIShopPointerLockLike,
  shouldReturnPointerLockRef: BiomesUIShopPointerLockReturnRef
) {
  shouldReturnPointerLockRef.current = pointerLockManager.isLocked();
  pointerLockManager.unlock();
}

export function closeBiomesUIShopPointerLock(
  pointerLockManager: BiomesUIShopPointerLockLike,
  shouldReturnPointerLockRef: BiomesUIShopPointerLockReturnRef
) {
  if (!shouldReturnPointerLockRef.current) {
    return;
  }
  shouldReturnPointerLockRef.current = false;
  pointerLockManager.focusAndLock();
}

export const BiomesUIShopChrome: React.FunctionComponent<
  PropsWithChildren<{
    title: string;
    eyebrow: string;
    subtitle?: ReactNode;
    variant: "container" | "npc-buyer" | "vendor";
    actions?: ReactNode;
    footer?: ReactNode;
    onClose?: () => void;
  }>
> = ({
  title,
  eyebrow,
  subtitle,
  variant,
  actions,
  footer,
  onClose,
  children,
}) => {
  const miniPhone = maybeUseExistingMiniPhoneContext();
  const pointerLockManager = usePointerLockManager();
  const shouldReturnPointerLockRef = useRef(false);
  const dialogRef = useRef<HTMLElement | null>(null);
  const closeShop = useCallback(() => {
    if (onClose) {
      onClose();
      return;
    }
    miniPhone?.close();
  }, [miniPhone, onClose]);

  useEffect(() => installBiomesUITheme(), []);

  useEffect(() => {
    openBiomesUIShopPointerLock(pointerLockManager, shouldReturnPointerLockRef);
    return () =>
      closeBiomesUIShopPointerLock(
        pointerLockManager,
        shouldReturnPointerLockRef
      );
  }, [pointerLockManager]);

  useEffect(() => {
    const handle = window.setTimeout(() => {
      dialogRef.current
        ?.querySelector<HTMLElement>("[data-biomes-ui-shop-initial-focus]")
        ?.focus({ preventScroll: true });
    }, 0);
    return () => window.clearTimeout(handle);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !isTypingInInput()) {
        closeShop();
      }
    }
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [closeShop]);

  return (
    <section
      ref={dialogRef}
      className="biomes-ui-shop-screen biomes-ui-panel"
      data-biomes-ui-shop={variant}
      data-pointer-lock-policy="unlock-while-open"
      data-mouse-policy="show-while-open"
      data-keyboard-navigation="roving-grid-and-enter"
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
            onClick={closeShop}
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

export function isBiomesUIShopIconImageSource(icon?: string) {
  if (!icon) {
    return false;
  }
  return /^(?:https?:\/\/|\/|data:image\/|blob:)/i.test(icon.trim());
}

function shopIconFallback(label: string, fallbackGlyph?: string) {
  if (fallbackGlyph?.trim()) {
    return fallbackGlyph;
  }
  const letters = label.match(/[A-Za-z0-9]/g)?.join("") ?? "";
  return (letters.slice(0, 2).toUpperCase() || "?").padEnd(2, " ");
}

export const BiomesUIShopItemIcon: React.FunctionComponent<{
  icon?: string;
  label: string;
  fallbackGlyph?: string;
}> = ({ icon, label, fallbackGlyph }) => {
  const [imageFailed, setImageFailed] = useState(false);
  const imageSource = isBiomesUIShopIconImageSource(icon);

  useEffect(() => setImageFailed(false), [icon]);

  return (
    <div className="biomes-ui-shop-item-icon" aria-label={`${label} icon`}>
      {imageSource && !imageFailed ? (
        <img
          src={icon}
          alt=""
          draggable={false}
          onError={() => setImageFailed(true)}
        />
      ) : (
        <span aria-hidden>
          {icon && !imageSource ? icon : shopIconFallback(label, fallbackGlyph)}
        </span>
      )}
    </div>
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
  const safeValue = clampBiomesUIShopAmount(value, min, max);
  const changeBy = (delta: number) => {
    onChange(nextBiomesUIShopAmount(safeValue, delta, min, max));
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
