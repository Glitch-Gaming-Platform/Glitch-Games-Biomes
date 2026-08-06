import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { AnimatePresence, motion } from "framer-motion";
import * as React from "react";
import {
  HARTHMERE_QUEST_COMPLETED_EVENT,
  type HarthmereQuestCompletionCelebrationDetail,
} from "./questCompletionCelebrationState";

const QUEST_COMPLETION_CELEBRATION_MS = 4_200;

export const HarthmereQuestCompletionCelebration: React.FunctionComponent =
  () => {
    const { audioManager } = useClientContext();
    const [queue, setQueue] = React.useState<
      HarthmereQuestCompletionCelebrationDetail[]
    >([]);
    const recentlyQueued = React.useRef(new Set<string>());
    const active = queue[0];

    React.useEffect(() => {
      const onCompleted = (event: Event) => {
        const detail = (
          event as CustomEvent<HarthmereQuestCompletionCelebrationDetail>
        ).detail;
        if (
          !detail?.id ||
          !detail.title ||
          recentlyQueued.current.has(detail.id)
        ) {
          return;
        }
        recentlyQueued.current.add(detail.id);
        setQueue((current) => [...current, detail]);
      };
      window.addEventListener(HARTHMERE_QUEST_COMPLETED_EVENT, onCompleted);
      return () =>
        window.removeEventListener(
          HARTHMERE_QUEST_COMPLETED_EVENT,
          onCompleted
        );
    }, []);

    React.useEffect(() => {
      if (!active) return;
      audioManager.playSound("challenge_complete");
      const timer = window.setTimeout(() => {
        setQueue((current) => current.slice(1));
        window.setTimeout(
          () => recentlyQueued.current.delete(active.id),
          1_000
        );
      }, QUEST_COMPLETION_CELEBRATION_MS);
      return () => window.clearTimeout(timer);
    }, [active, audioManager]);

    return (
      <AnimatePresence>
        {active && (
          <motion.div
            key={active.id}
            className="biomes-ui-quest-complete"
            data-biomes-quest-complete={active.id}
            role="status"
            aria-live="assertive"
            initial={{ opacity: 0, x: "-50%", y: -34, scale: 0.72 }}
            animate={{ opacity: 1, x: "-50%", y: 0, scale: 1 }}
            exit={{ opacity: 0, x: "-50%", y: -22, scale: 1.08 }}
            transition={{ type: "spring", bounce: 0.38, duration: 0.72 }}
          >
            <span
              className="biomes-ui-quest-complete__burst"
              aria-hidden="true"
            />
            <span className="biomes-ui-quest-complete__eyebrow">
              Quest Complete
            </span>
            <span className="biomes-ui-quest-complete__title">
              {active.title}
            </span>
            {active.rewards && active.rewards.length > 0 && (
              <span className="biomes-ui-quest-complete__rewards">
                <strong>Rewards</strong>
                {active.rewards.map((reward) => (
                  <span key={reward}>{reward}</span>
                ))}
              </span>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    );
  };
