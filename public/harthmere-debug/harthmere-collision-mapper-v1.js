(() => {
  const VERSION = "harthmere-collision-mapper-v1";

  const state = {
    version: VERSION,
    startedAt: null,
    timer: null,
    intervalMs: 250,
    samples: [],
    collisionEvents: [],
    minDistancesByObstacle: new Map(),
    lastReason: "unknown",
    lastHitKey: "",
    hud: null,
    hudTimer: null,
    config: {
      playerRadius: 0.24,
      verticalTolerance: 0.05,
      nearestLimit: 12,
      eventDistanceWindow: 2.5,
    },
  };

  function now() {
    return Date.now();
  }

  function round(n, places = 3) {
    if (!Number.isFinite(n)) return n;
    const f = 10 ** places;
    return Math.round(n * f) / f;
  }

  function arr3(v) {
    if (!v) return undefined;
    if (Array.isArray(v)) return [Number(v[0]), Number(v[1]), Number(v[2])];
    if (typeof v === "object") {
      if (Array.isArray(v.position)) return arr3(v.position);
      if ("x" in v && "y" in v && "z" in v) return [Number(v.x), Number(v.y), Number(v.z)];
    }
    return undefined;
  }

  function getStats() {
    return window.__harthmereHorizontalPlayerTownCollisionStats ||
      window.__harthmerePlayerTownCollisionStats ||
      null;
  }

  function getPlayerPosition() {
    const stats = getStats();
    const fromStats =
      arr3(stats?.resolvedPosition) ||
      arr3(stats?.desiredPosition) ||
      arr3(stats?.previousPosition);
    if (fromStats) {
      return { source: "collisionStats", position: fromStats };
    }

    try {
      const where = window.__harthmereTownAudit?.where?.();
      const pos = arr3(where?.position || where);
      if (pos) return { source: "townAudit", position: pos };
    } catch {
      // Ignore optional helper failures.
    }

    return { source: "missing", position: undefined };
  }

  function getObstacles() {
    const raw = window.__harthmereNpcCollisionObstacles ||
      window.__harthmereTownCollisionObstacles ||
      [];
    if (!Array.isArray(raw)) return [];
    return raw
      .map((o, index) => normalizeObstacle(o, index))
      .filter(Boolean);
  }

  function normalizeObstacle(o, index) {
    if (!o || typeof o !== "object") return null;
    const cx = Number(o.cx ?? o.centerX ?? o.x ?? o.position?.[0] ?? o.position?.x);
    const cz = Number(o.cz ?? o.centerZ ?? o.z ?? o.position?.[2] ?? o.position?.z);
    const halfX = Number(o.playerHalfX ?? o.halfX ?? o.widthHalf ?? o.halfWidth ?? o.radius ?? 0);
    const halfZ = Number(o.playerHalfZ ?? o.halfZ ?? o.depthHalf ?? o.halfDepth ?? o.radius ?? 0);
    if (!Number.isFinite(cx) || !Number.isFinite(cz) || !Number.isFinite(halfX) || !Number.isFinite(halfZ)) {
      return null;
    }
    const padding = Number(o.playerPadding ?? 0);
    const rot = Number(o.rot ?? o.rotation ?? o.yaw ?? 0);
    const minY = Number(o.minY ?? o.playerMinY ?? o.yMin ?? 52);
    const maxY = Number(o.maxY ?? o.playerMaxY ?? o.yMax ?? 58);
    return {
      index,
      name: String(o.name ?? o.label ?? o.id ?? `obstacle_${index}`),
      district: String(o.district ?? o.districtId ?? "unknown"),
      cx,
      cz,
      halfX: Math.max(0, halfX),
      halfZ: Math.max(0, halfZ),
      rot: Number.isFinite(rot) ? rot : 0,
      padding: Number.isFinite(padding) ? padding : 0,
      minY: Number.isFinite(minY) ? minY : 52,
      maxY: Number.isFinite(maxY) ? maxY : 58,
      collisionProfile: String(o.collisionProfile ?? o.profile ?? "unknown"),
      collisionHardness: String(o.collisionHardness ?? o.hardness ?? "unknown"),
      playerCanWalkThrough: Boolean(o.playerCanWalkThrough),
      npcCanWalkThrough: Boolean(o.npcCanWalkThrough),
      jumpable: Boolean(o.jumpable),
      raw: o,
    };
  }

  function obbMetrics(position, obstacle, radiusOverride) {
    const [px, py, pz] = position;
    const dx = px - obstacle.cx;
    const dz = pz - obstacle.cz;
    const c = Math.cos(-obstacle.rot);
    const s = Math.sin(-obstacle.rot);
    const lx = dx * c - dz * s;
    const lz = dx * s + dz * c;
    const ax = Math.abs(lx);
    const az = Math.abs(lz);
    const edgeDx = ax - obstacle.halfX;
    const edgeDz = az - obstacle.halfZ;
    const outsideX = Math.max(edgeDx, 0);
    const outsideZ = Math.max(edgeDz, 0);
    const edgeDistance = Math.hypot(outsideX, outsideZ);
    const signedEdgeDistance = Math.max(edgeDx, edgeDz);
    const playerRadius = Number(radiusOverride ?? window.__harthmereHorizontalPlayerTownCollisionRadius ?? state.config.playerRadius);
    const touchDistance = edgeDistance - playerRadius - Math.max(0, obstacle.padding || 0);
    const expandedHalfX = obstacle.halfX + playerRadius + Math.max(0, obstacle.padding || 0);
    const expandedHalfZ = obstacle.halfZ + playerRadius + Math.max(0, obstacle.padding || 0);
    const expandedInside = ax <= expandedHalfX && az <= expandedHalfZ;
    const insideVisualFootprint = ax <= obstacle.halfX && az <= obstacle.halfZ;
    const verticalGapBelow = obstacle.minY - py;
    const verticalGapAbove = py - obstacle.maxY;
    const verticalRelevant = py >= obstacle.minY - state.config.verticalTolerance && py <= obstacle.maxY + state.config.verticalTolerance;
    const jumpCleared = obstacle.jumpable && py > obstacle.maxY + state.config.verticalTolerance;

    return {
      localX: round(lx),
      localZ: round(lz),
      edgeDistance: round(edgeDistance),
      signedEdgeDistance: round(signedEdgeDistance),
      touchDistance: round(touchDistance),
      expandedInside,
      insideVisualFootprint,
      verticalRelevant,
      verticalGapBelow: round(verticalGapBelow),
      verticalGapAbove: round(verticalGapAbove),
      jumpCleared,
      playerRadius: round(playerRadius),
      expandedHalfX: round(expandedHalfX),
      expandedHalfZ: round(expandedHalfZ),
    };
  }

  function nearest(limit = state.config.nearestLimit) {
    const player = getPlayerPosition();
    if (!player.position) {
      return { player, obstacles: [], error: "No player position available yet." };
    }
    const obstacles = getObstacles()
      .filter((o) => !o.playerCanWalkThrough)
      .map((o) => ({ ...o, metrics: obbMetrics(player.position, o) }))
      .sort((a, b) => {
        const ad = a.metrics.verticalRelevant || a.metrics.jumpCleared ? a.metrics.touchDistance : a.metrics.edgeDistance + 1000;
        const bd = b.metrics.verticalRelevant || b.metrics.jumpCleared ? b.metrics.touchDistance : b.metrics.edgeDistance + 1000;
        return ad - bd;
      })
      .slice(0, limit)
      .map(compactObstacle);
    return { player, obstacles };
  }

  function compactObstacle(o) {
    return {
      index: o.index,
      name: o.name,
      district: o.district,
      collisionProfile: o.collisionProfile,
      collisionHardness: o.collisionHardness,
      playerCanWalkThrough: o.playerCanWalkThrough,
      npcCanWalkThrough: o.npcCanWalkThrough,
      jumpable: o.jumpable,
      cx: round(o.cx),
      cz: round(o.cz),
      halfX: round(o.halfX),
      halfZ: round(o.halfZ),
      padding: round(o.padding),
      minY: round(o.minY),
      maxY: round(o.maxY),
      metrics: o.metrics,
    };
  }

  function sample(label = "manual") {
    const stats = getStats();
    const hitNames = Array.isArray(stats?.hitNames) ? [...stats.hitNames] : [];
    const n = nearest(state.config.nearestLimit);
    const event = {
      at: now(),
      label,
      player: n.player,
      collisionStats: stats ? JSON.parse(JSON.stringify(stats)) : null,
      nearest: n.obstacles,
    };
    state.samples.push(event);
    for (const o of n.obstacles) {
      const key = `${o.name}|${o.district}`;
      const prev = state.minDistancesByObstacle.get(key);
      const touchDistance = o.metrics?.touchDistance;
      if (Number.isFinite(touchDistance) && (!prev || touchDistance < prev.touchDistance)) {
        state.minDistancesByObstacle.set(key, {
          name: o.name,
          district: o.district,
          touchDistance,
          edgeDistance: o.metrics.edgeDistance,
          at: event.at,
          player: n.player.position,
          profile: o.collisionProfile,
          halfX: o.halfX,
          halfZ: o.halfZ,
          padding: o.padding,
          minY: o.minY,
          maxY: o.maxY,
        });
      }
    }
    console.info(`[${VERSION}] sample: ${label}`, event);
    return event;
  }

  function tick() {
    const stats = getStats();
    const reason = String(stats?.reason ?? "missing");
    const hitNames = Array.isArray(stats?.hitNames) ? stats.hitNames.join("|") : "";
    const resolved = Boolean(stats?.resolved) || reason !== "clear";

    if (resolved && (reason !== state.lastReason || hitNames !== state.lastHitKey)) {
      const event = sample(`auto-stop:${reason || "unknown"}`);
      event.auto = true;
      event.hitNames = Array.isArray(stats?.hitNames) ? [...stats.hitNames] : [];
      state.collisionEvents.push(event);
    }
    state.lastReason = reason;
    state.lastHitKey = hitNames;
  }

  function start(intervalMs = 250) {
    stop();
    state.startedAt = now();
    state.intervalMs = Number(intervalMs) || 250;
    state.timer = window.setInterval(tick, state.intervalMs);
    console.info(`[${VERSION}] started. intervalMs=${state.intervalMs}`);
    return status();
  }

  function stop() {
    if (state.timer) window.clearInterval(state.timer);
    state.timer = null;
    return status();
  }

  function clear() {
    state.samples = [];
    state.collisionEvents = [];
    state.minDistancesByObstacle = new Map();
    state.lastReason = "unknown";
    state.lastHitKey = "";
    console.info(`[${VERSION}] cleared samples.`);
    return status();
  }

  function status() {
    return {
      version: VERSION,
      running: Boolean(state.timer),
      intervalMs: state.intervalMs,
      samples: state.samples.length,
      collisionEvents: state.collisionEvents.length,
      obstacleCount: getObstacles().length,
      player: getPlayerPosition(),
      currentStats: getStats(),
    };
  }

  function minDistances(limit = 50) {
    return [...state.minDistancesByObstacle.values()]
      .sort((a, b) => a.touchDistance - b.touchDistance)
      .slice(0, limit);
  }

  function report() {
    return {
      version: VERSION,
      generatedAt: new Date().toISOString(),
      url: location.href,
      status: status(),
      nearest: nearest(20),
      collisionEvents: state.collisionEvents,
      samples: state.samples,
      minDistances: minDistances(200),
    };
  }

  function download(filename = `harthmere-collision-mapper-${Date.now()}.json`) {
    const blob = new Blob([JSON.stringify(report(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return filename;
  }

  function showHud(intervalMs = 150) {
    hideHud();
    const div = document.createElement("div");
    div.id = "harthmere-collision-mapper-hud";
    div.style.cssText = [
      "position:fixed",
      "left:12px",
      "bottom:12px",
      "z-index:2147483647",
      "max-width:520px",
      "max-height:45vh",
      "overflow:auto",
      "font:12px/1.35 monospace",
      "background:rgba(0,0,0,0.82)",
      "color:#e8fff2",
      "border:1px solid rgba(255,255,255,0.25)",
      "border-radius:8px",
      "padding:10px",
      "white-space:pre-wrap",
      "pointer-events:none",
    ].join(";");
    document.body.appendChild(div);
    state.hud = div;
    state.hudTimer = window.setInterval(() => {
      const stats = getStats();
      const n = nearest(5);
      const lines = [];
      lines.push(`${VERSION}`);
      lines.push(`reason=${stats?.reason ?? "?"} resolved=${Boolean(stats?.resolved)} radius=${Number(window.__harthmereHorizontalPlayerTownCollisionRadius ?? state.config.playerRadius)}`);
      lines.push(`player=${JSON.stringify(n.player.position?.map((v) => round(v, 2)) ?? null)}`);
      for (const o of n.obstacles) {
        lines.push(`${o.metrics.touchDistance}m touch | ${o.metrics.edgeDistance}m edge | y[${o.minY},${o.maxY}] | ${o.name} (${o.district})`);
      }
      div.textContent = lines.join("\n");
    }, Number(intervalMs) || 150);
    return status();
  }

  function hideHud() {
    if (state.hudTimer) window.clearInterval(state.hudTimer);
    state.hudTimer = null;
    if (state.hud?.parentNode) state.hud.parentNode.removeChild(state.hud);
    state.hud = null;
    return status();
  }

  function configure(next = {}) {
    Object.assign(state.config, next || {});
    return { ...state.config };
  }

  function help() {
    const commands = {
      start: "__harthmereCollisionMapper.start(250) // auto-record stop/slide events",
      stop: "__harthmereCollisionMapper.stop()",
      nearest: "__harthmereCollisionMapper.nearest(10) // distance to nearest blockers",
      sample: "__harthmereCollisionMapper.sample('bad stall stop')",
      hud: "__harthmereCollisionMapper.showHud() // live distance HUD",
      hideHud: "__harthmereCollisionMapper.hideHud()",
      minDistances: "__harthmereCollisionMapper.minDistances(50)",
      report: "__harthmereCollisionMapper.report()",
      download: "__harthmereCollisionMapper.download('collision-map.json')",
      clear: "__harthmereCollisionMapper.clear()",
      tuneRadius: "window.__harthmereHorizontalPlayerTownCollisionRadius = 0.20",
      disableCollision: "window.__harthmereDisableHorizontalPlayerTownCollision = true",
      enableCollision: "window.__harthmereDisableHorizontalPlayerTownCollision = false",
    };
    console.table(commands);
    return commands;
  }

  window.__harthmereCollisionMapper = {
    version: VERSION,
    help,
    configure,
    status,
    start,
    stop,
    clear,
    nearest,
    sample,
    minDistances,
    report,
    download,
    showHud,
    hideHud,
  };

  console.info(`[${VERSION}] installed. Run __harthmereCollisionMapper.help()`);
})();
