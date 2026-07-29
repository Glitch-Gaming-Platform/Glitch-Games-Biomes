// SkillsTab — mastery progression across disciplines.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { biomesPlayerTitle } from "../playerFacingText";
import { UI_IDS } from "../uniqueIds";

interface Skill {
  id: string;
  name: string;
  category: string;
  level: number;
  xp: number;
  nextLevel: number;
  title: string;
  description?: string;
  trainingActions?: readonly string[];
}
interface CharacterStats {
  level: number;
  strength: number;
  dexterity: number;
  intelligence: number;
  defense: number;
  armor: number;
  evasion: number;
  accuracy: number;
  criticalChance: number;
  spellPower: number;
  healingPower: number;
  movementSpeed: number;
  carryCapacity: number;
  inventorySlots: number;
}
interface SkillsAdapter {
  isHydrated?: () => boolean;
  getSkills?: () => Skill[];
  getCharacterStats?: () => CharacterStats | undefined;
}

const CHARACTER_STAT_ROWS: ReadonlyArray<{
  key: keyof CharacterStats;
  label: string;
  format?: (value: number) => string;
}> = [
  { key: "strength", label: "Strength" },
  { key: "dexterity", label: "Dexterity" },
  { key: "intelligence", label: "Intelligence" },
  { key: "defense", label: "Defense" },
  { key: "armor", label: "Armor" },
  { key: "evasion", label: "Evasion" },
  { key: "accuracy", label: "Accuracy" },
  {
    key: "criticalChance",
    label: "Critical chance",
    format: (value) => `${(value * 100).toFixed(1)}%`,
  },
  { key: "spellPower", label: "Spell power" },
  { key: "healingPower", label: "Healing power" },
  {
    key: "movementSpeed",
    label: "Movement speed",
    format: (value) => `${Math.round(value * 100)}%`,
  },
  { key: "carryCapacity", label: "Carry capacity" },
  { key: "inventorySlots", label: "Backpack slots" },
];

function CharacterStatsPanel({ stats }: { stats: CharacterStats }) {
  return (
    <section
      aria-label={`Level ${stats.level} character stats`}
      style={statsPanelStyle}
    >
      <div style={statsHeaderStyle}>
        <div>
          <h3 style={{ ...titleStyle, marginBottom: 4 }}>Character Stats</h3>
          <div style={statsHintStyle}>
            Your character level determines these base stats.
          </div>
        </div>
        <strong style={levelPillStyle}>Level {stats.level}</strong>
      </div>
      <div style={statsGridStyle}>
        {CHARACTER_STAT_ROWS.map(({ key, label, format }) => (
          <div key={key} style={statCellStyle}>
            <span style={statLabelStyle}>{label}</span>
            <strong>{format ? format(stats[key]) : stats[key]}</strong>
          </div>
        ))}
      </div>
    </section>
  );
}

export const SkillsTab: React.FunctionComponent<{
  adapter?: SkillsAdapter;
}> = ({ adapter }) => {
  const skills = adapter?.getSkills?.() ?? [];
  const characterStats = adapter?.getCharacterStats?.();
  const grouped: Record<string, Skill[]> = {};
  for (const s of skills) (grouped[s.category] ||= []).push(s);

  if (skills.length === 0 && !characterStats) {
    return (
      <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>
        {adapter?.isHydrated?.()
          ? "No skills are available yet."
          : "Finding your skills..."}
      </p>
    );
  }

  return (
    <div>
      {characterStats && <CharacterStatsPanel stats={characterStats} />}
      {skills.length === 0 && (
        <p style={{ color: "var(--biomes-fg-muted)", fontSize: 12 }}>
          {adapter?.isHydrated?.()
            ? "No skills are available yet."
            : "Finding your skills..."}
        </p>
      )}
      {Object.entries(grouped).map(([cat, list]) => (
        <section
          key={cat}
          aria-label={`${biomesPlayerTitle(cat)} skills`}
          style={{ marginBottom: 16 }}
        >
          <h3 style={titleStyle}>{biomesPlayerTitle(cat)}</h3>
          {list.map((s) => (
            <Highlightable
              key={s.id}
              uniqueId={UI_IDS.SKILL_ROW(s.id)}
              showCaption
            >
              <div
                role="group"
                aria-label={`${s.name} skill — level ${s.level}, ${s.title}, ${s.xp} of ${s.nextLevel} experience points`}
                tabIndex={0}
                style={{
                  padding: "8px 10px",
                  marginBottom: 4,
                  background: "var(--biomes-bg-glass)",
                  border: "1px solid var(--biomes-edge-cyan-soft)",
                  borderRadius: 4,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "baseline",
                  }}
                >
                  <strong style={{ fontSize: 13 }}>{s.name}</strong>
                  <span
                    style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}
                  >
                    Level {s.level} · {s.title}
                  </span>
                </div>
                <div
                  style={{
                    marginTop: 4,
                    height: 6,
                    background: "rgba(255,255,255,0.08)",
                    borderRadius: 3,
                    overflow: "hidden",
                  }}
                >
                  <div
                    style={{
                      width: `${Math.min(100, (s.xp / s.nextLevel) * 100)}%`,
                      height: "100%",
                      background:
                        "linear-gradient(90deg, var(--biomes-edge-cyan), var(--biomes-edge-magenta))",
                    }}
                  />
                </div>
                <div
                  style={{
                    marginTop: 3,
                    fontSize: 10,
                    color: "var(--biomes-fg-dim)",
                  }}
                >
                  {s.xp} / {s.nextLevel} XP
                </div>
                {s.trainingActions && s.trainingActions.length > 0 && (
                  <div
                    data-skill-training-actions={s.id}
                    style={{
                      marginTop: 5,
                      fontSize: 10,
                      color: "var(--biomes-fg-muted)",
                    }}
                  >
                    How to improve: {s.trainingActions.join(" · ")}
                  </div>
                )}
              </div>
            </Highlightable>
          ))}
        </section>
      ))}
    </div>
  );
};
const titleStyle: React.CSSProperties = {
  margin: "0 0 8px",
  fontSize: 11,
  letterSpacing: "0.18em",
  textTransform: "uppercase",
  color: "var(--biomes-fg-muted)",
};
const statsPanelStyle: React.CSSProperties = {
  marginBottom: 18,
  padding: 12,
  border: "1px solid var(--biomes-edge-magenta)",
  borderRadius: 6,
  background: "rgba(255, 84, 196, 0.08)",
};
const statsHeaderStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
  gap: 12,
  marginBottom: 10,
};
const statsHintStyle: React.CSSProperties = {
  color: "var(--biomes-fg-muted)",
  fontSize: 11,
};
const levelPillStyle: React.CSSProperties = {
  border: "1px solid var(--biomes-edge-magenta)",
  borderRadius: 4,
  padding: "4px 7px",
  fontSize: 11,
};
const statsGridStyle: React.CSSProperties = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fit, minmax(120px, 1fr))",
  gap: 6,
};
const statCellStyle: React.CSSProperties = {
  display: "flex",
  justifyContent: "space-between",
  gap: 8,
  padding: "6px 8px",
  border: "1px solid var(--biomes-edge-cyan-soft)",
  borderRadius: 4,
  background: "var(--biomes-bg-glass)",
  fontSize: 11,
};
const statLabelStyle: React.CSSProperties = {
  color: "var(--biomes-fg-muted)",
};
