import * as React from "react";

function truthy(value: string | undefined | null): boolean {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function falsy(value: string | undefined | null): boolean {
  return ["0", "false", "no", "off"].includes(String(value ?? "").toLowerCase());
}

export function readBiomesUIReplaceLegacyFlag(): boolean {
  if (typeof window !== "undefined") {
    const value = window.localStorage?.getItem("biomes_ui_replace_legacy");
    if (truthy(value)) return true;
    if (falsy(value)) return false;
  }

  if (typeof process !== "undefined") {
    if (truthy(process.env.NEXT_PUBLIC_BIOMES_UI_REPLACE_LEGACY)) return true;
    if (truthy(process.env.BIOMES_UI_REPLACE_LEGACY)) return true;
    if (falsy(process.env.NEXT_PUBLIC_BIOMES_UI_REPLACE_LEGACY)) return false;
    if (falsy(process.env.BIOMES_UI_REPLACE_LEGACY)) return false;
  }

  return true;
}

export function setBiomesUIReplaceLegacyFlag(enabled: boolean): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem("biomes_ui_replace_legacy", enabled ? "1" : "0");
  window.dispatchEvent(new Event("biomes-ui-flags-changed"));
}

export function useBiomesUIReplaceLegacyFlag(): boolean {
  const [enabled, setEnabled] = React.useState(false);

  React.useEffect(() => {
    const update = () => setEnabled(readBiomesUIReplaceLegacyFlag());
    update();

    window.addEventListener("storage", update);
    window.addEventListener("biomes-ui-flags-changed", update);

    return () => {
      window.removeEventListener("storage", update);
      window.removeEventListener("biomes-ui-flags-changed", update);
    };
  }, []);

  return enabled;
}
