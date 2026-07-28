import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { harthmereJobsBoardPlayerPosition } from "@/client/components/harthmere_jobs_board/harthmereJobsBoardPosition";
import { Chapter1ContainmentTriage } from "@/client/components/challenges/Chapter1ContainmentTriage";
import {
  CHAPTER1_LATENT_SKILL_USED_EVENT,
  type Chapter1LatentSkillUsePresentation,
} from "@/client/components/challenges/chapter1LatentSkillPresentation";
import { setCh1AnchorReadUntilMs } from "@/client/game/renderers/ch1_world_phase";
import { CH1_FRACTURE_GATES } from "@/shared/harthmere/ch1_fracture_gates";
import { CH1_ANCHORS } from "@/shared/harthmere/ch1_ids";
import { nativeBiomesEcsAuthorityEnabled } from "@/shared/harthmere/native_road_ahead_contract";
import React, { useEffect, useMemo, useState } from "react";

const SKILL_PRESENTATION_MS = 20_000;
const STRESS_POINTS = [
  ["Mosslawn song stones", CH1_ANCHORS.mosslawn_song_stones],
  ["Biome anchor leak", CH1_ANCHORS.biome_anchor_leak],
  ["Old Wood aperture", CH1_ANCHORS.gate_desert],
  ["Cold Gate", CH1_ANCHORS.gate_winter],
  ["Fence line seam", CH1_ANCHORS.gate_fence_sighting],
] as const;

function distance3(a: readonly number[], b: readonly number[]) {
  return Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
}

export const Chapter1LatentSkillController: React.FunctionComponent = () => {
  const { reactResources } = useClientContext();
  const localPlayer = reactResources.use("/scene/local_player") as unknown;
  const camera = reactResources.use("/scene/camera") as unknown;
  const position = harthmereJobsBoardPlayerPosition(localPlayer, camera);
  const [use, setUse] = useState<Chapter1LatentSkillUsePresentation>();
  const [nowMs, setNowMs] = useState(Date.now());
  const [containmentOpen, setContainmentOpen] = useState(false);

  useEffect(() => {
    if (!nativeBiomesEcsAuthorityEnabled()) return;
    const onUsed = (event: Event) => {
      const detail = (event as CustomEvent<Chapter1LatentSkillUsePresentation>)
        .detail;
      if (!detail) return;
      setUse(detail);
      setNowMs(Date.now());
      if (detail.skillId === "ls_anchor_read") {
        setCh1AnchorReadUntilMs(detail.usedAtMs + SKILL_PRESENTATION_MS);
      }
      if (detail.skillId === "ls_containment_triage") {
        setContainmentOpen(true);
      }
    };
    window.addEventListener(CHAPTER1_LATENT_SKILL_USED_EVENT, onUsed);
    return () => {
      window.removeEventListener(CHAPTER1_LATENT_SKILL_USED_EVENT, onUsed);
      setCh1AnchorReadUntilMs(0);
    };
  }, []);

  useEffect(() => {
    if (!use) return;
    const timer = window.setInterval(() => setNowMs(Date.now()), 250);
    return () => window.clearInterval(timer);
  }, [use]);

  const point = position
    ? ([position.x, position.y ?? 0, position.z] as const)
    : undefined;
  const nearestStress = useMemo(
    () =>
      point
        ? STRESS_POINTS.map(([name, anchor]) => ({
            name,
            distance: distance3(point, anchor),
          }))
            .sort((a, b) => a.distance - b.distance)
            .slice(0, 3)
        : [],
    [point?.[0], point?.[1], point?.[2]]
  );
  const nearestGate = useMemo(
    () =>
      point
        ? CH1_FRACTURE_GATES.map((gate) => ({
            gate,
            distance: distance3(point, gate.position),
          })).sort((a, b) => a.distance - b.distance)[0]
        : undefined,
    [point?.[0], point?.[1], point?.[2]]
  );

  if (!nativeBiomesEcsAuthorityEnabled()) return null;
  const active = use && nowMs - use.usedAtMs <= SKILL_PRESENTATION_MS;

  return (
    <>
      {containmentOpen && (
        <Chapter1ContainmentTriage
          mode="reusable"
          onClose={() => setContainmentOpen(false)}
          onComplete={() => setContainmentOpen(false)}
        />
      )}
      {active && use.skillId !== "ls_containment_triage" && (
        <div
          className="rounded-xl border-cyan-100/35 bg-slate-950/92 pointer-events-none fixed left-1/2 top-20 z-[90] w-[min(34rem,88vw)] -translate-x-1/2 border p-4 text-white shadow-[0_0_42px_rgba(34,211,238,0.2)] backdrop-blur"
          role="status"
          aria-live="polite"
          data-chapter1-latent-skill-effect={use.skillId}
        >
          <div className="text-cyan-200/75 text-[10px] font-bold uppercase tracking-[0.2em]">
            Recognition before recall
          </div>
          {use.skillId === "ls_anchor_read" && (
            <div className="mt-2">
              <div className="text-cyan-50 font-semibold">
                Structural stress resolves across the ground.
              </div>
              <div className="mt-2 grid gap-1 font-mono text-xs text-white/70">
                {nearestStress.map((stress, index) => (
                  <div key={stress.name} className="flex justify-between gap-4">
                    <span>{stress.name}</span>
                    <span className={index === 0 ? "text-amber-200" : ""}>
                      {stress.distance.toFixed(0)}m ·{" "}
                      {index === 0 ? "primary load" : "displaced load"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
          {use.skillId === "ls_gate_timing" && (
            <div className="mt-2">
              <div className="text-cyan-50 font-semibold">
                {nearestGate?.gate.harthmereName ?? "No aperture"}
              </div>
              <div className="text-amber-100 mt-1 font-mono text-sm">
                {nearestGate?.gate.behavior === "transient"
                  ? `Collapse: ${
                      nearestGate.gate.openSeconds ?? 0
                    }s after opening, ±20s.`
                  : "No collapse cadence. The aperture is braced open."}
              </div>
              {nearestGate && (
                <div className="text-white/55 mt-1 text-xs">
                  {nearestGate.distance.toFixed(0)}m from current position.
                </div>
              )}
            </div>
          )}
          {use.skillId === "ls_field_calibration" && (
            <div className="mt-2">
              <div className="text-cyan-50 font-semibold">
                Local reference comparison
              </div>
              <div className="mt-2 grid grid-cols-[1fr_auto] gap-x-5 gap-y-1 font-mono text-xs text-white/70">
                <span>Local stone reference</span>
                <span>0.00</span>
                <span>Glass needle absolute</span>
                <span className="text-rose-200">+0.42 rejected</span>
                <span>Biome dial absolute</span>
                <span className="text-rose-200">+0.37 rejected</span>
                <span>Comparative differential</span>
                <span className="text-emerald-200">+0.05 trusted</span>
              </div>
            </div>
          )}
          <p className="mt-3 border-t border-white/10 pt-2 text-xs text-white/50">
            {use.result}
          </p>
        </div>
      )}
    </>
  );
};
