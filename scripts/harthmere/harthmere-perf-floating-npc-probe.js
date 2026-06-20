(() => {
  const audit = window.__harthmereTownAudit;
  const walk = window.__harthmereTownWalkDebug;
  if (!audit || typeof audit.objects !== "function") {
    console.warn("Harthmere audit globals are not ready yet. Load into the Harthmere scene, wait a few seconds, then run this again. Available Harthmere globals:", Object.keys(window).filter((k) => /harthmere/i.test(k)).sort());
    return undefined;
  }

  const actorText = /actor_or_npc|townsperson|animal_|monster_|guard|merchant|vendor|clerk|banker|auction|trainer|healer|priest|clergy|farmer|dockhand|smuggler|bandit|prisoner|courier|cat|dog|rat|crow|chicken|sheep|wolf|boar|bear|deer|npc/i;
  const round = (value, digits = 2) => Number.isFinite(Number(value)) ? Number(Number(value).toFixed(digits)) : value;
  const flagsText = (object) => Array.isArray(object?.flags) ? object.flags.join(" ") : "";
  const labelText = (object) => [object?.name, object?.asset, object?.district, flagsText(object)].join(" ");

  const objects = (includeMeshes = false) => {
    try {
      return audit.objects({ includeMeshes }).filter(Boolean);
    } catch (error) {
      console.warn("Unable to read __harthmereTownAudit.objects()", error);
      return [];
    }
  };

  const floatingNpcs = (thresholdY = 1.5, includeMeshes = false) => objects(includeMeshes)
    .filter((object) => {
      const text = labelText(object);
      const minY = Number(object?.box?.min?.[1]);
      const sizeY = Number(object?.box?.size?.[1]);
      const isActor = actorText.test(text);
      const alreadyFlaggedFloating = /floating|unsupported/i.test(flagsText(object));
      return isActor && Number.isFinite(minY) && Number.isFinite(sizeY) && sizeY > 0.2 && (minY > thresholdY || alreadyFlaggedFloating);
    })
    .sort((a, b) => Number(b?.box?.min?.[1] ?? 0) - Number(a?.box?.min?.[1] ?? 0))
    .map((object) => ({
      name: object.name,
      asset: object.asset,
      district: object.district,
      minY: round(object?.box?.min?.[1]),
      centerY: round(object?.box?.center?.[1]),
      height: round(object?.box?.size?.[1]),
      distanceToPlayer: round(object.distanceToPlayer),
      position: object.position,
      worldPosition: object.worldPosition,
      flags: object.flags,
      uuid: object.uuid,
    }));

  const frameStats = {
    running: false,
    raf: 0,
    startedAt: 0,
    last: 0,
    frames: 0,
    totalMs: 0,
    worstMs: 0,
    slowFrames: [],
  };

  const tick = (now) => {
    if (!frameStats.running) return;
    if (frameStats.last) {
      const dt = now - frameStats.last;
      frameStats.frames += 1;
      frameStats.totalMs += dt;
      frameStats.worstMs = Math.max(frameStats.worstMs, dt);
      if (dt >= 45) {
        frameStats.slowFrames.push({
          atMs: Math.round(now - frameStats.startedAt),
          frameMs: round(dt, 1),
          approxFps: round(1000 / dt, 1),
          player: typeof audit.where === "function" ? audit.where() : undefined,
        });
        frameStats.slowFrames = frameStats.slowFrames.slice(-80);
      }
    }
    frameStats.last = now;
    frameStats.raf = requestAnimationFrame(tick);
  };

  const start = (intervalMs = 1000) => {
    stop(false);
    frameStats.running = true;
    frameStats.startedAt = performance.now();
    frameStats.last = 0;
    frameStats.frames = 0;
    frameStats.totalMs = 0;
    frameStats.worstMs = 0;
    frameStats.slowFrames = [];
    frameStats.raf = requestAnimationFrame(tick);
    if (typeof audit.watch === "function") audit.watch(30, intervalMs);
    console.log("Harthmere perf/NPC probe started. Reproduce the slowdown/floating NPCs, then run __hmPerfNpcProbe.sample('note') or __hmPerfNpcProbe.download().");
    return true;
  };

  function stop(stopAudit = true) {
    if (frameStats.raf) cancelAnimationFrame(frameStats.raf);
    frameStats.running = false;
    frameStats.raf = 0;
    if (stopAudit && typeof audit.stopWatch === "function") audit.stopWatch();
    return summary();
  }

  const summary = () => ({
    url: location.href,
    capturedAt: new Date().toISOString(),
    frameStats: {
      running: frameStats.running,
      frames: frameStats.frames,
      averageFrameMs: round(frameStats.frames ? frameStats.totalMs / frameStats.frames : 0, 1),
      averageFps: round(frameStats.totalMs ? (frameStats.frames * 1000) / frameStats.totalMs : 0, 1),
      worstFrameMs: round(frameStats.worstMs, 1),
      slowFrames: frameStats.slowFrames,
    },
    player: typeof audit.where === "function" ? audit.where() : undefined,
    auditCounts: typeof audit.dump === "function" ? audit.dump({ includeOverlaps: 0 })?.counts : undefined,
    floatingNpcs: floatingNpcs(1.5, false),
    auditSuspects: typeof audit.suspects === "function" ? audit.suspects({ includeMeshes: false }).slice(0, 40) : [],
    overlaps: typeof audit.overlaps === "function" ? audit.overlaps(60, { includeMeshes: false }) : [],
    walkDebugSuspects: walk && typeof walk.suspects === "function" ? walk.suspects(80) : [],
  });

  const sample = (note = "manual perf/floating NPC sample") => {
    const result = summary();
    result.note = note;
    if (typeof audit.sample === "function") audit.sample(note);
    console.log("Harthmere perf/NPC probe sample:", result);
    console.table(result.floatingNpcs);
    console.table(result.frameStats.slowFrames.slice(-20));
    return result;
  };

  const download = (filename = `harthmere-perf-floating-npc-${Date.now()}.json`) => {
    const blob = new Blob([JSON.stringify(sample("download"), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
    return filename;
  };

  window.__hmPerfNpcProbe = {
    start,
    stop,
    sample,
    download,
    floatingNpcs,
    summary,
    rawObjects: objects,
  };

  return window.__hmPerfNpcProbe.sample("initial perf/floating NPC scan");
})();
