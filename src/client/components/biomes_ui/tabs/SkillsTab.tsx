// SkillsTab — mastery progression across disciplines.
import * as React from "react";
import { Highlightable } from "../highlight/HighlightOverlay";
import { UI_IDS } from "../uniqueIds";

interface Skill { id: string; name: string; category: string; level: number; xp: number; nextLevel: number; title: string }
interface SkillsAdapter { getSkills?: () => Skill[] }

const PLACEHOLDER: Skill[] = [
  { id: "sword", name: "Sword", category: "Weapon", level: 18, xp: 320, nextLevel: 480, title: "Apprentice" },
  { id: "unarmed", name: "Unarmed", category: "Weapon", level: 11, xp: 180, nextLevel: 240, title: "Novice" },
  { id: "endurance", name: "Endurance", category: "Survival", level: 22, xp: 410, nextLevel: 560, title: "Apprentice" },
  { id: "exotic_handling", name: "Exotic Handling", category: "Singularity", level: 4, xp: 30, nextLevel: 90, title: "Untrained" },
  { id: "temporal_sense", name: "Temporal Sense", category: "Singularity", level: 1, xp: 5, nextLevel: 50, title: "Untrained" },
  { id: "biome_engineering", name: "Biome Engineering", category: "Profession", level: 7, xp: 90, nextLevel: 160, title: "Novice" },
];

export const SkillsTab: React.FunctionComponent<{ adapter?: SkillsAdapter }> = ({ adapter }) => {
  const skills = adapter?.getSkills?.() ?? PLACEHOLDER;
  const grouped: Record<string, Skill[]> = {};
  for (const s of skills) (grouped[s.category] ||= []).push(s);

  return (
    <div>
      {Object.entries(grouped).map(([cat, list]) => (
        <section key={cat} aria-label={`${cat} skills`} style={{ marginBottom: 16 }}>
          <h3 style={titleStyle}>{cat}</h3>
          {list.map((s) => (
            <Highlightable key={s.id} uniqueId={UI_IDS.SKILL_ROW(s.id)} showCaption>
              <div
                role="group"
                aria-label={`${s.name} skill — level ${s.level}, ${s.title}, ${s.xp} of ${s.nextLevel} xp`}
                tabIndex={0}
                style={{ padding: "8px 10px", marginBottom: 4, background: "var(--biomes-bg-glass)",
                  border: "1px solid var(--biomes-edge-cyan-soft)", borderRadius: 4 }}
              >
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
                  <strong style={{ fontSize: 13 }}>{s.name}</strong>
                  <span style={{ fontSize: 11, color: "var(--biomes-fg-muted)" }}>
                    Lvl {s.level} · {s.title}
                  </span>
                </div>
                <div style={{ marginTop: 4, height: 6, background: "rgba(255,255,255,0.08)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${Math.min(100, (s.xp / s.nextLevel) * 100)}%`, height: "100%",
                    background: "linear-gradient(90deg, var(--biomes-edge-cyan), var(--biomes-edge-magenta))" }} />
                </div>
                <div style={{ marginTop: 3, fontSize: 10, color: "var(--biomes-fg-dim)" }}>
                  {s.xp} / {s.nextLevel} xp
                </div>
              </div>
            </Highlightable>
          ))}
        </section>
      ))}
    </div>
  );
};
const titleStyle: React.CSSProperties = { margin: "0 0 8px", fontSize: 11, letterSpacing: "0.18em", textTransform: "uppercase", color: "var(--biomes-fg-muted)" };
