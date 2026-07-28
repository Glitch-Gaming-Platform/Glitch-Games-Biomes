import { useHarthmereLevelingState } from "@/client/components/challenges/LocalDevHarthmereLevelingSystem";
import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { readHarthmereNativeCombatProgression } from "@/shared/harthmere/harthmere_native_combat";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import {
  effectiveLevelForCelebrationForTest,
  HARTHMERE_LEVEL_UP_SOUND_PATH,
  levelUpCelebrationTransitionForTest,
} from "./levelUpCelebrationState";

const LEVEL_UP_CELEBRATION_MS = 3_400;

export const HarthmereLevelUpCelebration: React.FunctionComponent = () => {
  const { audioManager, reactResources, userId } = useClientContext();
  const nativeTriggerState = reactResources.use("/ecs/c/trigger_state", userId);
  const legacyLeveling = useHarthmereLevelingState();
  const nativeProgression =
    readHarthmereNativeCombatProgression(nativeTriggerState);
  const currentLevel = effectiveLevelForCelebrationForTest({
    nativeAuthority: nativeBiomesEcsAuthorityEnabled(),
    nativeMigrationVersion: nativeProgression.migrationVersion,
    nativeLevel: nativeProgression.level,
    legacyLevel: legacyLeveling.level,
  });
  const previousLevelRef = React.useRef<number | undefined>(undefined);
  const hideTimerRef = React.useRef<number | undefined>(undefined);
  const soundRef = React.useRef<HTMLAudioElement | undefined>(undefined);
  const [celebration, setCelebration] = React.useState<
    { id: number; level: number } | undefined
  >(undefined);

  React.useEffect(() => {
    const sound = new Audio(HARTHMERE_LEVEL_UP_SOUND_PATH);
    sound.preload = "auto";
    soundRef.current = sound;
    return () => {
      sound.pause();
      sound.removeAttribute("src");
      sound.load();
      soundRef.current = undefined;
    };
  }, []);

  React.useEffect(() => {
    const transition = levelUpCelebrationTransitionForTest(
      previousLevelRef.current,
      currentLevel
    );
    previousLevelRef.current = transition.nextPreviousLevel;
    if (transition.celebrationLevel === undefined) return;

    const level = transition.celebrationLevel;
    setCelebration({ id: Date.now(), level });
    const sound = soundRef.current;
    if (sound) {
      sound.currentTime = 0;
      sound.volume = audioManager.getVolume("settings.volume.effects");
      void sound.play().catch(() => undefined);
    }
    if (hideTimerRef.current !== undefined) {
      window.clearTimeout(hideTimerRef.current);
    }
    hideTimerRef.current = window.setTimeout(
      () => setCelebration(undefined),
      LEVEL_UP_CELEBRATION_MS
    );
  }, [audioManager, currentLevel]);

  React.useEffect(
    () => () => {
      if (hideTimerRef.current !== undefined) {
        window.clearTimeout(hideTimerRef.current);
      }
    },
    []
  );

  return (
    <AnimatePresence>
      {celebration && (
        <motion.div
          key={celebration.id}
          className="biomes-ui-level-up"
          data-biomes-level-up={celebration.level}
          role="status"
          aria-live="assertive"
          initial={{ opacity: 0, x: "-50%", y: -28, scale: 0.72 }}
          animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
          exit={{ opacity: 0, x: "-50%", y: -18, scale: 1.08 }}
          transition={{ type: "spring", bounce: 0.42, duration: 0.7 }}
        >
          <span className="biomes-ui-level-up__burst" aria-hidden="true" />
          <span className="biomes-ui-level-up__eyebrow">
            Level {celebration.level}
          </span>
          <span className="biomes-ui-level-up__title">Leveled Up!</span>
          <span className="biomes-ui-level-up__subtitle">
            Your power has increased
          </span>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
