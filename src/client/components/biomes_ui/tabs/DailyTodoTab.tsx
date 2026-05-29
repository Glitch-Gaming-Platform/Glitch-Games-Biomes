import * as React from "react";
import type { DailyTodoAdapterV1, DailyTodoItemV1 } from "../adapters/dailyTodoAdapter";
import { dailyTodoProgressForTest } from "../adapters/dailyTodoAdapter";

function RewardPills({ task }: { task: DailyTodoItemV1 }) {
  const rewards: string[] = [];
  if (task.reward.gold) rewards.push(`${task.reward.gold} gold`);
  if (task.reward.xp) rewards.push(`${task.reward.xp} XP`);
  for (const item of task.reward.items ?? []) {
    rewards.push(`${item.count} ${item.name}`);
  }
  if (task.reward.townCare) rewards.push(task.reward.townCare);
  return (
    <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
      {rewards.map((reward) => (
        <span
          key={reward}
          style={{
            border: "1px solid rgba(122,215,255,0.22)",
            borderRadius: 999,
            padding: "3px 8px",
            color: "var(--biomes-fg-muted)",
            fontSize: 11,
            background: "rgba(122,215,255,0.05)",
          }}
        >
          {reward}
        </span>
      ))}
    </div>
  );
}

export const DailyTodoTab: React.FunctionComponent<{
  adapter?: DailyTodoAdapterV1;
}> = ({ adapter }) => {
  if (!adapter || !adapter.isHydrated()) {
    return (
      <section
        style={{
          border: "1px solid var(--biomes-edge-cyan-soft)",
          padding: 16,
          color: "var(--biomes-fg-muted)",
        }}
      >
        Gathering today&apos;s list...
      </section>
    );
  }

  const tasks = adapter.getTasks();
  const progress = adapter.getProgress?.() ?? dailyTodoProgressForTest(tasks);
  const streak = adapter.getStreak?.() ?? 0;

  return (
    <section style={{ display: "grid", gap: 14 }}>
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
          gap: 10,
        }}
      >
        <div className="biomes-ui-panel" style={{ padding: 12 }}>
          <div style={{ color: "var(--biomes-fg-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Today&apos;s Progress
          </div>
          <div style={{ marginTop: 6, color: "var(--biomes-fg)", fontSize: 24, fontWeight: 900 }}>
            {progress.completed}/{progress.total}
          </div>
        </div>
        <div className="biomes-ui-panel" style={{ padding: 12 }}>
          <div style={{ color: "var(--biomes-fg-muted)", fontSize: 11, textTransform: "uppercase", letterSpacing: "0.14em" }}>
            Check-In Streak
          </div>
          <div style={{ marginTop: 6, color: "var(--biomes-fg)", fontSize: 24, fontWeight: 900 }}>
            {streak} {streak === 1 ? "day" : "days"}
          </div>
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fit, minmax(240px, 1fr))",
          gap: 10,
        }}
      >
        {tasks.map((task) => (
          <article
            key={task.id}
            data-completed={task.completed ? "true" : "false"}
            data-claimed={task.claimed ? "true" : "false"}
            style={{
              display: "grid",
              gap: 10,
              minHeight: 190,
              alignContent: "space-between",
              border: `1px solid ${task.completed ? "rgba(155,255,199,0.38)" : "var(--biomes-edge-cyan)"}`,
              background: task.completed
                ? "linear-gradient(180deg, rgba(41,90,68,0.32), rgba(9,16,34,0.82))"
                : "rgba(9,16,34,0.76)",
              padding: 14,
              boxShadow: task.completed ? "0 0 20px rgba(87,255,165,0.08)" : undefined,
            }}
          >
            <div style={{ display: "grid", gap: 7 }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 10,
                }}
              >
                <h3 style={{ margin: 0, color: "var(--biomes-fg)", fontSize: 15 }}>
                  {task.title}
                </h3>
                <span
                  aria-label={task.completed ? "Completed" : "Available"}
                  style={{
                    width: 18,
                    height: 18,
                    borderRadius: 999,
                    display: "inline-grid",
                    placeItems: "center",
                    border: "1px solid rgba(255,255,255,0.25)",
                    color: task.completed ? "#abffd1" : "var(--biomes-fg-muted)",
                    fontSize: 12,
                    fontWeight: 900,
                  }}
                >
                  {task.completed ? "✓" : ""}
                </span>
              </div>
              <p style={{ margin: 0, color: "var(--biomes-fg-muted)", fontSize: 12, lineHeight: 1.45 }}>
                {task.description}
              </p>
              <RewardPills task={task} />
            </div>
            <button
              type="button"
              disabled={task.claimed || !task.claimable}
              onClick={() => {
                if (!task.claimed && task.claimable) {
                  void adapter.claim(task.activityId);
                }
              }}
              style={{
                width: "100%",
                minHeight: 38,
                border: "1px solid var(--biomes-edge-cyan)",
                borderRadius: 4,
                background: task.claimed
                  ? "rgba(155,255,199,0.09)"
                  : "linear-gradient(135deg, rgba(40,145,190,0.42), rgba(255,84,196,0.22))",
                color: task.claimed || !task.claimable ? "rgba(232,244,255,0.58)" : "var(--biomes-fg)",
                fontWeight: 900,
                cursor: task.claimed || !task.claimable ? "default" : "pointer",
              }}
            >
              {task.actionLabel}
            </button>
          </article>
        ))}
      </div>
    </section>
  );
};
