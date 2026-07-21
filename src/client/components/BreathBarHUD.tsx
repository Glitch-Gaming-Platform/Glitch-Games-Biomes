import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  DROWN_DELAY_IN_TICKS,
  MILLISECONDS_PER_TICK,
} from "@/client/game/scripts/player";
import { useAnimation } from "@/client/util/animation";
import { secondsSinceEpoch } from "@/shared/ecs/config";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { readHarthmereNativeVitals } from "@/shared/harthmere/harthmere_native_vitals";
import { motion, useMotionValue, useTransform } from "framer-motion";
import React, { useEffect, useState } from "react";

// HARTHMERE_BREATH_BAR
// Underwater air meter. The legacy HotBar's breath bar is disabled in the
// BiomesUI/Harthmere HUD (replaceLegacyBiomesUI defaults on), so the player had
// no visible breath feedback. This bar appears near the bottom-center ONLY while
// submerged: it starts full and depletes over the same grace window the engine
// uses before drowning (DROWN_DELAY_IN_TICKS). When it empties, drown damage has
// begun (player.ts updateDrowningHealth). Surfacing hides and resets it.
const BREATH_DURATION_S = (DROWN_DELAY_IN_TICKS * MILLISECONDS_PER_TICK) / 1000;

export const BreathBarHUD: React.FunctionComponent = () => {
  const { reactResources, userId } = useClientContext();
  const localPlayer = reactResources.get("/scene/local_player");
  const triggerState = reactResources.use("/ecs/c/trigger_state", userId);
  const nativeVitals = readHarthmereNativeVitals(triggerState);
  const useNativeBreath =
    nativeBiomesEcsAuthorityEnabled() && nativeVitals.migrationVersion > 0;
  const canBreathe = reactResources.useSubset(
    (q) => q.canBreathe,
    "/players/possible_terrain_actions",
    localPlayer.id
  );

  const scaleX = useMotionValue(1);
  const [expiration, setExpiration] = useState<number | undefined>(undefined);

  // Treat only an explicit `false` as "underwater". An undefined value during
  // resource init must not flash the bar on land.
  const underwater = canBreathe === false;

  useEffect(() => {
    if (useNativeBreath) {
      setExpiration(undefined);
      return;
    }
    if (!underwater) {
      setExpiration(undefined);
      return;
    }
    // Entered (or still) underwater — start a fresh 15s breath countdown.
    setExpiration(secondsSinceEpoch() + BREATH_DURATION_S);
  }, [underwater, useNativeBreath]);

  useAnimation(() => {
    if (useNativeBreath) {
      const elapsed = nativeVitals.underwater
        ? Math.max(0, Date.now() - nativeVitals.lastTickMs) / 1000
        : 0;
      const remaining = nativeVitals.underwater
        ? Math.max(0, nativeVitals.breath - elapsed)
        : nativeVitals.maxBreath;
      scaleX.set(Math.max(0, Math.min(1, remaining / nativeVitals.maxBreath)));
      return;
    }
    if (!underwater || expiration === undefined) {
      scaleX.set(1);
      return;
    }
    const remaining = expiration - secondsSinceEpoch();
    scaleX.set(Math.max(0, Math.min(1, remaining / BREATH_DURATION_S)));
  });

  // Fill goes water-blue -> red as the last of the air runs out.
  const fillColor = useTransform(
    scaleX,
    [0, 0.25, 1],
    ["#ff4d4d", "#ff7a4d", "#39a0ff"]
  );

  // Only visible while underwater.
  if (!underwater) {
    return null;
  }

  return (
    <div
      style={{
        position: "fixed",
        bottom: "13vh",
        left: "50%",
        transform: "translateX(-50%)",
        zIndex: 60,
        pointerEvents: "none",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        gap: "4px",
      }}
    >
      <div
        style={{
          fontFamily: "var(--font-vt, monospace)",
          fontSize: "11px",
          letterSpacing: "0.08em",
          color: "rgba(255,255,255,0.85)",
          textShadow: "0 1px 2px rgba(0,0,0,0.6)",
          textTransform: "uppercase",
        }}
      >
        Breath
      </div>
      <div
        style={{
          width: "220px",
          height: "12px",
          borderRadius: "6px",
          background: "rgba(0,0,0,0.55)",
          border: "1px solid rgba(255,255,255,0.25)",
          boxShadow: "0 2px 6px rgba(0,0,0,0.45)",
          overflow: "hidden",
        }}
      >
        <motion.div
          style={{
            scaleX,
            backgroundColor: fillColor,
            transformOrigin: "left",
            height: "100%",
            width: "100%",
            borderRadius: "6px",
          }}
        />
      </div>
    </div>
  );
};
