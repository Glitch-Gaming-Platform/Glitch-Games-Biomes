import { useClientContext } from "@/client/components/contexts/ClientContextReactContext";
import {
  HARTHMERE_PROJECTILE_VISUAL_EVENT,
  HARTHMERE_PROJECTILE_VISUALS,
} from "@/shared/harthmere/projectile_visual_manifest";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES,
  shouldShowHarthmereProjectileVisualAudit,
} from "@/client/components/challenges/harthmereProjectileVisualAudit";

type ProjectileRuntimeSnapshot = {
  version?: string;
  manifestCount?: number;
  loadedOrLoading?: number;
  loadedCount?: number;
  failedIds?: string[];
  active?: Array<{
    projectileId?: string;
    usingFallback?: boolean;
  }>;
  spawnedCount?: number;
  impactCount?: number;
};

function readProjectileRuntimeSnapshot():
  | ProjectileRuntimeSnapshot
  | undefined {
  if (typeof window === "undefined") {
    return undefined;
  }
  return (
    window as typeof window & {
      __harthmereProjectileVisuals?: ProjectileRuntimeSnapshot;
    }
  ).__harthmereProjectileVisuals;
}

function finitePosition(value: unknown): [number, number, number] | undefined {
  if (!Array.isArray(value) || value.length < 3) {
    return undefined;
  }
  const position: [number, number, number] = [
    Number(value[0]),
    Number(value[1]),
    Number(value[2]),
  ];
  return position.every(Number.isFinite) ? position : undefined;
}

function playerPose(localPlayer: unknown) {
  const localRecord = (localPlayer ?? {}) as Record<string, unknown>;
  const player = (localRecord.player ?? localPlayer ?? {}) as Record<
    string,
    unknown
  >;
  const position =
    finitePosition(player.position) ?? finitePosition(localRecord.position);
  const orientation = player.orientation;
  const yaw =
    Array.isArray(orientation) && orientation.length >= 2
      ? Number(orientation[1])
      : Number(player.yaw ?? player.theta ?? player.heading);
  const forward: [number, number] = Number.isFinite(yaw)
    ? [-Math.sin(yaw), -Math.cos(yaw)]
    : [0, -1];
  return { position, forward };
}

export const HarthmereProjectileVisualAuditPanel: React.FunctionComponent =
  () => {
    const { reactResources } = useClientContext();
    const localPlayer = reactResources.use("/scene/local_player") as unknown;
    const [runtime, setRuntime] = useState<ProjectileRuntimeSnapshot>();
    const [status, setStatus] = useState("Waiting for projectile renderer");
    const firingInterval = useRef<number>();
    const stopTimer = useRef<number>();
    const visible = useMemo(
      () =>
        typeof window !== "undefined" &&
        shouldShowHarthmereProjectileVisualAudit({
          hostname: window.location.hostname,
          search: window.location.search,
        }),
      []
    );

    useEffect(() => {
      if (!visible) {
        return;
      }
      const refresh = () => setRuntime(readProjectileRuntimeSnapshot());
      refresh();
      const interval = window.setInterval(refresh, 150);
      return () => window.clearInterval(interval);
    }, [visible]);

    useEffect(
      () => () => {
        if (firingInterval.current !== undefined) {
          window.clearInterval(firingInterval.current);
        }
        if (stopTimer.current !== undefined) {
          window.clearTimeout(stopTimer.current);
        }
      },
      []
    );

    if (!visible) {
      return null;
    }

    const stopFiring = () => {
      if (firingInterval.current !== undefined) {
        window.clearInterval(firingInterval.current);
        firingInterval.current = undefined;
      }
      if (stopTimer.current !== undefined) {
        window.clearTimeout(stopTimer.current);
        stopTimer.current = undefined;
      }
    };

    const fireBatch = (batchIndex: number) => {
      stopFiring();
      const batch = HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES[batchIndex];
      const pose = playerPose(localPlayer);
      if (!pose.position) {
        setStatus("Waiting for a finite local-player position");
        return;
      }
      const [px, py, pz] = pose.position;
      const [fx, fz] = pose.forward;
      const right: [number, number] = [-fz, fx];
      const result = batchIndex % 2 === 0 ? "hit" : "miss";
      const dispatch = () => {
        batch.ids.forEach((projectileVisualId, index) => {
          const centeredIndex = index - (batch.ids.length - 1) / 2;
          const lateral = centeredIndex * 2.15;
          const origin: [number, number, number] = [
            px + fx * 6.5 + right[0] * lateral,
            py + 1.6 + (index % 3) * 0.82,
            pz + fz * 6.5 + right[1] * lateral,
          ];
          const distance = 34 + index * 1.8;
          const targetPoint: [number, number, number] = [
            origin[0] + fx * distance,
            origin[1] + (index % 2 === 0 ? 0.15 : -0.15),
            origin[2] + fz * distance,
          ];
          window.dispatchEvent(
            new CustomEvent(HARTHMERE_PROJECTILE_VISUAL_EVENT, {
              detail: {
                projectileVisualId,
                origin,
                targetPoint,
                result,
                source: "harthmere_projectile_visual_browser_audit",
                auditBatch: batchIndex + 1,
              },
            })
          );
        });
      };
      dispatch();
      firingInterval.current = window.setInterval(dispatch, 520);
      stopTimer.current = window.setTimeout(() => {
        stopFiring();
        setStatus(`Batch ${batchIndex + 1} complete · ${result}`);
      }, 4200);
      setStatus(`Firing batch ${batchIndex + 1} · ${result}`);
    };

    const loadedCount = Number(runtime?.loadedCount ?? 0);
    const expectedCount = HARTHMERE_PROJECTILE_VISUALS.length;
    const ready =
      loadedCount === expectedCount && (runtime?.failedIds?.length ?? 0) === 0;
    const activeIds = [
      ...new Set(
        (runtime?.active ?? [])
          .map(({ projectileId }) => projectileId)
          .filter((id): id is string => Boolean(id))
      ),
    ];
    const fallbackIds = [
      ...new Set(
        (runtime?.active ?? [])
          .filter(({ usingFallback }) => usingFallback)
          .map(({ projectileId }) => projectileId)
          .filter((id): id is string => Boolean(id))
      ),
    ];

    return (
      <aside
        aria-label="Harthmere projectile visual audit"
        data-testid="harthmere-projectile-visual-audit"
        onMouseDown={(event) => event.stopPropagation()}
        style={{
          position: "fixed",
          top: 12,
          left: 12,
          zIndex: 100_000,
          width: 360,
          maxHeight: "calc(100vh - 24px)",
          overflow: "auto",
          padding: 12,
          border: "1px solid rgba(126, 238, 255, 0.7)",
          borderRadius: 8,
          background: "rgba(5, 10, 22, 0.9)",
          color: "#f7fbff",
          fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace",
          fontSize: 11,
          lineHeight: 1.35,
          boxShadow: "0 12px 36px rgba(0, 0, 0, 0.45)",
          pointerEvents: "auto",
        }}
      >
        <div style={{ fontSize: 14, fontWeight: 800, marginBottom: 6 }}>
          Projectile Visual Audit
        </div>
        <div data-testid="harthmere-projectile-audit-runtime">
          {runtime?.version ?? "runtime pending"} · Loaded {loadedCount}/
          {expectedCount} · Failed {runtime?.failedIds?.length ?? 0} · Spawned{" "}
          {runtime?.spawnedCount ?? 0} · Impacts {runtime?.impactCount ?? 0}
        </div>
        <div data-testid="harthmere-projectile-audit-status">{status}</div>
        <div data-testid="harthmere-projectile-audit-active">
          Active: {activeIds.join(", ") || "none"}
        </div>
        <div
          data-testid="harthmere-projectile-audit-fallbacks"
          style={{ color: fallbackIds.length > 0 ? "#ffb3a7" : "#9cf6b4" }}
        >
          Fallbacks: {fallbackIds.join(", ") || "none"}
        </div>
        <div style={{ display: "grid", gap: 7, marginTop: 10 }}>
          {HARTHMERE_PROJECTILE_VISUAL_AUDIT_BATCHES.map((batch, index) => (
            <button
              key={batch.label}
              type="button"
              data-testid={`harthmere-projectile-audit-batch-${index + 1}`}
              disabled={!ready}
              onClick={() => fireBatch(index)}
              style={{
                padding: "7px 9px",
                border: "1px solid rgba(126, 238, 255, 0.5)",
                borderRadius: 5,
                background: ready
                  ? "linear-gradient(180deg, #284c66, #173147)"
                  : "rgba(80, 90, 105, 0.45)",
                color: "white",
                textAlign: "left",
                cursor: ready ? "pointer" : "wait",
              }}
            >
              <strong>
                Batch {index + 1}: {batch.label}
              </strong>
              <br />
              <span style={{ opacity: 0.78 }}>{batch.ids.join(", ")}</span>
            </button>
          ))}
          <button type="button" onClick={stopFiring}>
            Stop firing
          </button>
        </div>
      </aside>
    );
  };
