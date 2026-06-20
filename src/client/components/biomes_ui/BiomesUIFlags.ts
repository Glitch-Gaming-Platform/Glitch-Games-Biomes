import * as React from "react";

function truthy(value: string | undefined | null): boolean {
  return ["1", "true", "yes", "on"].includes(String(value ?? "").toLowerCase());
}

function falsy(value: string | undefined | null): boolean {
  return ["0", "false", "no", "off"].includes(
    String(value ?? "").toLowerCase()
  );
}

export function readBiomesUIReplaceLegacyFlag(): boolean {
  // BiomesUI is the only UI authority now. The legacy storage/env flags remain
  // readable for compatibility, but false values no longer re-enable old panels.
  if (typeof window !== "undefined") {
    const value = window.localStorage?.getItem("biomes_ui_replace_legacy");
    if (truthy(value)) return true;
    if (falsy(value)) return true;
  }

  if (typeof process !== "undefined") {
    if (truthy(process.env.NEXT_PUBLIC_BIOMES_UI_REPLACE_LEGACY)) return true;
    if (truthy(process.env.BIOMES_UI_REPLACE_LEGACY)) return true;
    if (falsy(process.env.NEXT_PUBLIC_BIOMES_UI_REPLACE_LEGACY)) return true;
    if (falsy(process.env.BIOMES_UI_REPLACE_LEGACY)) return true;
  }

  return true;
}

export function setBiomesUIReplaceLegacyFlag(enabled: boolean): void {
  if (typeof window === "undefined") return;
  void enabled;
  window.localStorage.setItem("biomes_ui_replace_legacy", "1");
  window.dispatchEvent(new Event("biomes-ui-flags-changed"));
}

export function useBiomesUIReplaceLegacyFlag(): boolean {
  const [enabled, setEnabled] = React.useState(readBiomesUIReplaceLegacyFlag);

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
