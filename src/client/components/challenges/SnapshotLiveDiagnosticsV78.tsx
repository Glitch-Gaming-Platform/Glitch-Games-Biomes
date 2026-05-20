import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import { NpcMetadataSelector } from "@/shared/ecs/gen/selectors";
import type { ReadonlyEntity } from "@/shared/ecs/gen/entities";
import type { BiomesId } from "@/shared/ids";
import type { Vec3 } from "@/shared/math/types";
import {
  SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78,
  SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78,
  SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE_V78,
  SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78,
  SNAPSHOT_PERFORMANCE_WALKER_VERSION_V78,
  SNAPSHOT_REMAINING_PORT_AUDIT_VERSION_V78,
  SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78,
  snapshotAreaForPositionV78,
  snapshotIsLiveFloatingGroveNpcCandidateV78,
  snapshotLiveNpcAuditSummaryV78,
  snapshotLiveNpcFootClearanceV78,
  snapshotPointInBoundsV78,
  snapshotRemainingPortAuditV78,
  SNAPSHOT_GROVE_LIVE_BOUNDS_V78,
  type SnapshotLiveNpcAuditRecordV78,
  type SnapshotPerformanceSampleV78,
} from "@/shared/harthmere/snapshot_live_debug_v78";
import React, { useEffect, useMemo, useRef, useState } from "react";

export const SNAPSHOT_DIAGNOSTICS_PANEL_VERSION_V78 =
  "snapshot-diagnostics-panel-v78" as const;

function localPlayerPositionV78(ctx: ReturnType<typeof useClientContext>): Vec3 | undefined {
  try {
    const local = ctx.reactResources.get("/scene/local_player");
    const pos = local?.player?.position;
    return Array.isArray(pos) ? ([...pos] as Vec3) : undefined;
  } catch {
    return undefined;
  }
}

function entityLabelV78(entity: ReadonlyEntity) {
  return entity.label?.text ?? entity.npc_metadata?.type_id?.toString?.() ?? String(entity.id);
}

function entityDescriptionV78(entity: ReadonlyEntity) {
  return entity.entity_description?.text ?? "";
}

function collectLiveNpcAuditV78(ctx: ReturnType<typeof useClientContext>): SnapshotLiveNpcAuditRecordV78[] {
  const records: SnapshotLiveNpcAuditRecordV78[] = [];
  for (const entity of ctx.table.scan(NpcMetadataSelector.query.all())) {
    const position = entity.position?.v ? ([...entity.position.v] as Vec3) : undefined;
    const label = entityLabelV78(entity);
    const inGrove = snapshotPointInBoundsV78(position, SNAPSHOT_GROVE_LIVE_BOUNDS_V78);
    const inHarthmere = snapshotAreaForPositionV78(position) === "harthmere";
    const clearance = snapshotLiveNpcFootClearanceV78(position);
    const candidate = snapshotIsLiveFloatingGroveNpcCandidateV78({
      id: entity.id,
      label,
      position,
      entityDescription: entityDescriptionV78(entity),
    });
    const pass = !inGrove || candidate || clearance === undefined || Math.abs(clearance) <= 12;
    records.push({
      id: entity.id as BiomesId,
      label,
      position,
      inGrove,
      inHarthmere,
      clearance,
      pass,
      action: !position
        ? "missing_position"
        : candidate
          ? "visual_grounded"
          : pass
            ? "ok"
            : "needs_server_remap",
      reason: !position
        ? "NPC has no position component."
        : candidate
          ? "Original snapshot/Grove NPC is above the playable floor; renderer v78 grounds it visually and reports the ID for server remap."
          : pass
            ? "Foot clearance is acceptable for the current area or outside the Grove audit bounds."
            : "NPC is in the Grove and too far from the expected floor. Needs server-side position remap/delete.",
    });
  }
  return records;
}

function visibleResourceCountV78() {
  if (typeof performance === "undefined") return 0;
  return performance.getEntriesByType("resource").length;
}

function heapUsedMbV78() {
  const perf = performance as Performance & { memory?: { usedJSHeapSize?: number } };
  const used = perf.memory?.usedJSHeapSize;
  return typeof used === "number" ? Number((used / 1024 / 1024).toFixed(1)) : undefined;
}

function downloadJsonV78(filename: string, payload: unknown) {
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

export const SnapshotLiveDiagnosticsRuntimeControllerV78: React.FunctionComponent<{}> = () => {
  const ctx = useClientContext();
  const samplesRef = useRef<SnapshotPerformanceSampleV78[]>([]);
  const marksRef = useRef<Array<{ atMs: number; label: string; position?: Vec3; area: string }>>([]);
  const framesRef = useRef<number[]>([]);
  const lastFrameRef = useRef<number | undefined>(undefined);
  const runningRef = useRef(false);
  const longTaskCountRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);
  const intervalRef = useRef<number | undefined>(undefined);

  useEffect(() => {
    let observer: PerformanceObserver | undefined;
    if (typeof PerformanceObserver !== "undefined") {
      try {
        observer = new PerformanceObserver((list) => {
          longTaskCountRef.current += list.getEntries().length;
        });
        observer.observe({ entryTypes: ["longtask"] });
      } catch {
        // Safari/older browsers may not support longtask. FPS and frame spikes still work.
      }
    }
    return () => observer?.disconnect();
  }, []);

  useEffect(() => {
    const tick = (now: number) => {
      if (lastFrameRef.current !== undefined) {
        framesRef.current.push(now - lastFrameRef.current);
        framesRef.current = framesRef.current.slice(-120);
      }
      lastFrameRef.current = now;
      rafRef.current = requestAnimationFrame(tick);
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== undefined) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  const captureSample = () => {
    const frames = framesRef.current;
    const avgFrameMs = frames.length ? frames.reduce((a, b) => a + b, 0) / frames.length : 0;
    const maxFrameMs = frames.length ? Math.max(...frames) : 0;
    const fps = avgFrameMs > 0 ? 1000 / avgFrameMs : 0;
    const position = localPlayerPositionV78(ctx);
    const audit = collectLiveNpcAuditV78(ctx);
    const nearbyNpcCount = audit.filter((record) => {
      if (!record.position || !position) return false;
      const dx = record.position[0] - position[0];
      const dy = record.position[1] - position[1];
      const dz = record.position[2] - position[2];
      return Math.sqrt(dx * dx + dy * dy + dz * dz) <= 40;
    }).length;
    const sample: SnapshotPerformanceSampleV78 = {
      atMs: Date.now(),
      area: snapshotAreaForPositionV78(position),
      position,
      fps: Number(fps.toFixed(1)),
      avgFrameMs: Number(avgFrameMs.toFixed(2)),
      maxFrameMs: Number(maxFrameMs.toFixed(2)),
      longTaskCount: longTaskCountRef.current,
      heapUsedMb: heapUsedMbV78(),
      nearbyNpcCount,
      floatingNpcCount: audit.filter((record) => record.action === "visual_grounded" || record.action === "needs_server_remap").length,
      visibleResourceCount: visibleResourceCountV78(),
    };
    samplesRef.current = [...samplesRef.current, sample].slice(-1800);
    return sample;
  };

  const report = () => {
    const samples = samplesRef.current;
    const byArea = new Map<string, SnapshotPerformanceSampleV78[]>();
    for (const sample of samples) {
      byArea.set(sample.area, [...(byArea.get(sample.area) ?? []), sample]);
    }
    const areaReports = [...byArea.entries()].map(([area, areaSamples]) => {
      const avgFps = areaSamples.reduce((sum, sample) => sum + sample.fps, 0) / Math.max(1, areaSamples.length);
      const worst = [...areaSamples].sort((a, b) => b.maxFrameMs - a.maxFrameMs)[0];
      return {
        area,
        samples: areaSamples.length,
        avgFps: Number(avgFps.toFixed(1)),
        worstFrameMs: worst?.maxFrameMs ?? 0,
        worstPosition: worst?.position,
        floatingNpcCount: Math.max(...areaSamples.map((sample) => sample.floatingNpcCount), 0),
        nearbyNpcHighWater: Math.max(...areaSamples.map((sample) => sample.nearbyNpcCount), 0),
      };
    });
    const resources = performance.getEntriesByType("resource")
      .map((entry) => ({ name: entry.name, duration: Number(entry.duration.toFixed(1)), startTime: Number(entry.startTime.toFixed(1)) }))
      .sort((a, b) => b.duration - a.duration)
      .slice(0, 25);
    return {
      version: SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78,
      running: runningRef.current,
      samples: samples.length,
      marks: marksRef.current,
      areas: areaReports,
      slowResources: resources,
      floatingAudit: snapshotLiveNpcAuditSummaryV78(collectLiveNpcAuditV78(ctx)),
      navigation: performance.getEntriesByType("navigation")[0]?.toJSON?.() ?? undefined,
    };
  };

  useEffect(() => {
    const start = () => {
      runningRef.current = true;
      if (intervalRef.current === undefined) {
        intervalRef.current = window.setInterval(() => {
          if (runningRef.current) captureSample();
        }, 1000);
      }
      return report();
    };
    const stop = () => {
      runningRef.current = false;
      return report();
    };
    const mark = (label = "manual") => {
      const position = localPlayerPositionV78(ctx);
      const entry = { atMs: Date.now(), label, position, area: snapshotAreaForPositionV78(position) };
      marksRef.current = [entry, ...marksRef.current].slice(0, 250);
      return entry;
    };
    const clear = () => {
      samplesRef.current = [];
      marksRef.current = [];
      longTaskCountRef.current = 0;
      return report();
    };
    const win = window as typeof window & {
      __snapshotPerfV78?: unknown;
      __snapshotDiagnosticsV78?: unknown;
    };
    win.__snapshotPerfV78 = {
      version: SNAPSHOT_WALK_PERFORMANCE_PROFILER_VERSION_V78,
      start,
      stop,
      mark,
      clear,
      sample: captureSample,
      samples: () => samplesRef.current,
      report,
      tools: SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78,
      download: (filename = `snapshot-perf-walk-v78-${Date.now()}.json`) => downloadJsonV78(filename, report()),
    };
    win.__snapshotDiagnosticsV78 = {
      version: SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78,
      runFloatingAudit: () => collectLiveNpcAuditV78(ctx),
      floatingSummary: () => snapshotLiveNpcAuditSummaryV78(collectLiveNpcAuditV78(ctx)),
      remainingPortAudit: snapshotRemainingPortAuditV78,
      performanceTools: SNAPSHOT_PERFORMANCE_DEBUG_TOOLS_V78,
      performanceReport: report,
      downloadFloatingAudit: (filename = `snapshot-floating-npc-audit-v78-${Date.now()}.json`) =>
        downloadJsonV78(filename, collectLiveNpcAuditV78(ctx)),
    };
    return () => {
      if (intervalRef.current !== undefined) window.clearInterval(intervalRef.current);
    };
  }, [ctx]);

  return <span className="hidden" data-snapshot-live-debug-player-scope-v78={SNAPSHOT_LIVE_DEBUG_PLAYER_SCOPE_VERSION_V78} />;
};

export const SnapshotLiveGroundingAuditPanelV78: React.FunctionComponent<{}> = () => {
  const ctx = useClientContext();
  const [audit, setAudit] = useState<SnapshotLiveNpcAuditRecordV78[]>(() => collectLiveNpcAuditV78(ctx));

  useEffect(() => {
    const interval = window.setInterval(() => setAudit(collectLiveNpcAuditV78(ctx)), 1500);
    return () => window.clearInterval(interval);
  }, [ctx]);

  const summary = useMemo(() => snapshotLiveNpcAuditSummaryV78(audit), [audit]);
  const flagged = audit.filter((entry) => entry.action === "visual_grounded" || entry.action === "needs_server_remap");

  return (
    <div className="rounded border border-red-200/20 bg-red-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Live NPC Foot Audit</div>
      <div className="text-[10px] uppercase tracking-wide text-red-100/80">
        {SNAPSHOT_LIVE_NPC_GROUNDING_VERSION_V78}
      </div>
      <div className="mt-1 text-xs text-white/75">
        {summary.total} live NPCs scanned · visually grounded {summary.visualGrounded} · server remap {summary.needsServerRemap}
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Tolerance ≤ {SNAPSHOT_LIVE_NPC_MAX_FOOT_CLEARANCE_V78}m for Grove-authored NPCs. Floating snapshot originals are grounded visually and reported by ID.
      </div>
      {!!flagged.length && (
        <div className="mt-1 text-[11px] text-red-100">
          {flagged.slice(0, 4).map((entry) => `${entry.label}: y=${entry.position?.[1]?.toFixed?.(2) ?? "?"}`).join(" · ")}
        </div>
      )}
    </div>
  );
};

export const SnapshotPerformanceWalkerPanelV78: React.FunctionComponent<{}> = () => {
  const [report, setReport] = useState<any>(() => undefined);
  useEffect(() => {
    const refresh = () => {
      const perf = (window as any).__snapshotPerfV78;
      if (perf?.report) setReport(perf.report());
    };
    refresh();
    const interval = window.setInterval(refresh, 1500);
    return () => window.clearInterval(interval);
  }, []);
  const latest = report?.areas?.[0];
  return (
    <div className="rounded border border-lime-200/20 bg-lime-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Walk Performance Profiler</div>
      <div className="text-[10px] uppercase tracking-wide text-lime-100/80">
        {SNAPSHOT_PERFORMANCE_WALKER_VERSION_V78}
      </div>
      <div className="mt-1 text-xs text-white/75">
        Console: window.__snapshotPerfV78.start(), mark(&quot;bad-collision&quot;), stop(), report(), download()
      </div>
      <div className="mt-1 text-[11px] text-white/60">
        Samples: {report?.samples ?? 0} · Worst area: {latest?.area ?? "none"} · Worst frame: {latest?.worstFrameMs ?? 0}ms · Floating NPCs: {report?.floatingAudit?.visualGrounded ?? 0}
      </div>
    </div>
  );
};

export const SnapshotRemainingPortAuditPanelV78: React.FunctionComponent<{}> = () => {
  const audit = snapshotRemainingPortAuditV78();
  return (
    <div className="rounded border border-zinc-200/20 bg-zinc-950/30 p-2 text-white">
      <div className="text-sm font-semibold">Remaining Snapshot Port Audit</div>
      <div className="text-[10px] uppercase tracking-wide text-zinc-100/80">
        {SNAPSHOT_REMAINING_PORT_AUDIT_VERSION_V78}
      </div>
      <div className="mt-1 text-xs text-white/75">{audit.openCount} follow-up production QA items remain.</div>
      <div className="mt-1 text-[11px] text-white/60">
        {audit.items.slice(0, 3).map((item) => `${item.area}: ${item.status}`).join(" · ")}
      </div>
    </div>
  );
};
