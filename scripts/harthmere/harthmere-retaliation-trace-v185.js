/*
 * Harthmere retaliation trace v185
 * Paste this whole file into the browser DevTools Console on the Biomes play page.
 * Then run: __harthmereRetaliationTrace.start(); attack an NPC; __harthmereRetaliationTrace.download();
 */
(function installHarthmereRetaliationTraceV185() {
  "use strict";

  const VERSION = "harthmere-retaliation-trace-v185";
  const STATE_KEY = "biomes.localDev.harthmere.combatState.v1";
  const DEBUG_KEY = "biomes.localDev.harthmere.combatDebug";
  const STATE_EVENT = "biomes:harthmere-combat-changed";
  const DEBUG_EVENT = "biomes:harthmere-combat-debug";
  const EFFECT_EVENT = "biomes:harthmere-combat-effect";
  const PLAYER_NAMES = new Set(["You", "Player"]);

  const w = window;

  function now() {
    return Date.now();
  }

  function round(value, places = 3) {
    const n = Number(value);
    if (!Number.isFinite(n)) return undefined;
    const factor = Math.pow(10, places);
    return Math.round(n * factor) / factor;
  }

  function safeJsonParse(text, fallback) {
    try {
      return JSON.parse(text);
    } catch (_err) {
      return fallback;
    }
  }

  function clone(value) {
    if (value === undefined) return undefined;
    try {
      return JSON.parse(JSON.stringify(value));
    } catch (_err) {
      return value;
    }
  }

  function readState() {
    return safeJsonParse(localStorage.getItem(STATE_KEY) || "{}", {});
  }

  function readRuntime() {
    const runtimeFromGlobal = w.__harthmereForwardArcRuntime;
    if (runtimeFromGlobal) return clone(runtimeFromGlobal);
    const bridge = w.__harthmereCombatDebug;
    if (bridge && typeof bridge.runtime === "function") {
      try {
        return clone(bridge.runtime());
      } catch (_err) {
        return undefined;
      }
    }
    return undefined;
  }

  function readRawActors() {
    const actorsFromGlobal = w.__harthmereCombatActorPositions;
    if (actorsFromGlobal && typeof actorsFromGlobal === "object") return actorsFromGlobal;
    const bridge = w.__harthmereCombatDebug;
    if (bridge && typeof bridge.actors === "function") {
      try {
        return bridge.actors() || {};
      } catch (_err) {
        return {};
      }
    }
    return {};
  }

  function playerPos2(runtime = readRuntime()) {
    const pos = runtime && Array.isArray(runtime.position) ? runtime.position : undefined;
    if (!pos || pos.length < 3) return undefined;
    const x = Number(pos[0]);
    const y = Number(pos[1]);
    const z = Number(pos[2]);
    if (!Number.isFinite(x) || !Number.isFinite(z)) return undefined;
    return { x, y: Number.isFinite(y) ? y : undefined, z };
  }

  function actorPos2(actor) {
    if (!actor || typeof actor !== "object") return undefined;
    const pos = Array.isArray(actor.pos) ? actor.pos : undefined;
    if (pos && pos.length >= 2) {
      const x = Number(pos[0]);
      const z = Number(pos[1]);
      if (Number.isFinite(x) && Number.isFinite(z)) return { x, z };
    }
    const world = actor.world;
    if (world && typeof world === "object") {
      const x = Number(world.x);
      const z = Number(world.z);
      if (Number.isFinite(x) && Number.isFinite(z)) return { x, z };
    }
    return undefined;
  }

  function distance2(a, b) {
    if (!a || !b) return undefined;
    const dx = Number(a.x) - Number(b.x);
    const dz = Number(a.z) - Number(b.z);
    if (!Number.isFinite(dx) || !Number.isFinite(dz)) return undefined;
    return Math.sqrt(dx * dx + dz * dz);
  }

  function displayNameFor(offset, state, actor) {
    const npc = state && state.npcs ? state.npcs[String(offset)] : undefined;
    const actorLabel = actor && actor.label ? String(actor.label) : undefined;
    const stateName = npc && npc.name ? String(npc.name) : undefined;
    return actorLabel || stateName || `NPC ${offset}`;
  }

  function normalizeActorEntry(offset, actor, state, runtime) {
    const npc = state && state.npcs ? state.npcs[String(offset)] : undefined;
    const p = playerPos2(runtime);
    const a = actorPos2(actor);
    const stateName = npc && npc.name ? String(npc.name) : undefined;
    const actorLabel = actor && actor.label ? String(actor.label) : undefined;
    const mismatch = Boolean(actorLabel && stateName && actorLabel !== stateName);
    return {
      offset: Number(offset),
      label: actorLabel,
      stateName,
      name: displayNameFor(offset, state, actor),
      nameMismatch: mismatch,
      hp: npc && Number.isFinite(Number(npc.hp)) ? Number(npc.hp) : undefined,
      maxHp: npc && Number.isFinite(Number(npc.maxHp)) ? Number(npc.maxHp) : undefined,
      attackable: npc && typeof npc.attackable !== "undefined" ? Boolean(npc.attackable) : actor && typeof actor.attackable !== "undefined" ? Boolean(actor.attackable) : undefined,
      behavior: npc && npc.behavior ? String(npc.behavior) : actor && actor.behavior ? String(actor.behavior) : undefined,
      species: npc && npc.species ? String(npc.species) : actor && actor.species ? String(actor.species) : undefined,
      combatState: npc && npc.combatState ? String(npc.combatState) : undefined,
      attackPoints: npc && Number.isFinite(Number(npc.attackPoints)) ? Number(npc.attackPoints) : undefined,
      attackRange: npc && Number.isFinite(Number(npc.attackRange)) ? Number(npc.attackRange) : undefined,
      radius: actor && Number.isFinite(Number(actor.radius)) ? Number(actor.radius) : undefined,
      pos: a ? { x: round(a.x), z: round(a.z) } : undefined,
      distanceToPlayer: round(distance2(a, p), 3),
      screen: actor && actor.screen ? clone(actor.screen) : undefined,
      asset: actor && actor.asset ? String(actor.asset) : undefined,
      district: actor && actor.district ? String(actor.district) : undefined,
      actorAt: actor && actor.at,
    };
  }

  function collectActors(state = readState(), runtime = readRuntime()) {
    const rawActors = readRawActors();
    const entries = [];
    for (const [key, actor] of Object.entries(rawActors || {})) {
      const offset = Number(key);
      if (!Number.isFinite(offset)) continue;
      entries.push(normalizeActorEntry(offset, actor, state, runtime));
    }
    entries.sort((a, b) => {
      const da = Number.isFinite(a.distanceToPlayer) ? a.distanceToPlayer : 999999;
      const db = Number.isFinite(b.distanceToPlayer) ? b.distanceToPlayer : 999999;
      return da - db;
    });
    return entries;
  }

  function collectNpcs(state = readState(), runtime = readRuntime()) {
    const rawActors = readRawActors();
    const offsets = new Set([
      ...Object.keys((state && state.npcs) || {}),
      ...Object.keys(rawActors || {}),
    ]);
    const npcs = {};
    for (const key of offsets) {
      const offset = Number(key);
      if (!Number.isFinite(offset)) continue;
      const npc = state && state.npcs ? state.npcs[String(offset)] : undefined;
      const actor = rawActors[String(offset)];
      const actorInfo = normalizeActorEntry(offset, actor, state, runtime);
      npcs[String(offset)] = {
        ...actorInfo,
        rawNpc: clone(npc),
      };
    }
    return npcs;
  }

  function latestForwardDebug(events) {
    const forwardHits = [];
    let forwardStart;
    let forwardNearest;
    for (const e of events) {
      if (!e || typeof e !== "object") continue;
      if (e.stage === "forward_arc.hit") forwardHits.push(e);
      if (e.stage === "forward_arc.start" && !forwardStart) forwardStart = e;
      if (e.stage === "forward_arc.nearest" && !forwardNearest) forwardNearest = e;
    }
    return { forwardHits, forwardStart, forwardNearest };
  }

  function snapshot(reason = "sample") {
    const state = readState();
    const runtime = readRuntime();
    const actors = collectActors(state, runtime);
    const snap = {
      at: now(),
      reason,
      url: location.href,
      stateRevision: state && state.rulesetRevision,
      selectedNpcOffset: state && state.selectedNpcOffset,
      player: clone(state && state.player),
      runtime: clone(runtime),
      playerPos: playerPos2(runtime),
      actors,
      nearestActors: actors.slice(0, 15),
      npcs: collectNpcs(state, runtime),
      npcBrains: clone((state && state.npcBrains) || {}),
      recent: clone(((state && state.recent) || []).slice(0, 30)),
      lastNpcAttackAt: clone((state && state.lastNpcAttackAt) || {}),
    };
    return snap;
  }

  function hpLosses(before, after) {
    if (!before || !after) return [];
    const offsets = new Set([
      ...Object.keys(before.npcs || {}),
      ...Object.keys(after.npcs || {}),
    ]);
    const losses = [];
    for (const key of offsets) {
      const b = before.npcs[key];
      const a = after.npcs[key];
      if (!b || !a) continue;
      const beforeHp = Number(b.hp);
      const afterHp = Number(a.hp);
      if (!Number.isFinite(beforeHp) || !Number.isFinite(afterHp)) continue;
      if (afterHp < beforeHp) {
        const actorNow = (after.actors || []).find((actor) => String(actor.offset) === String(key));
        losses.push({
          offset: Number(key),
          name: (actorNow && actorNow.name) || a.name || b.name,
          actorLabel: (actorNow && actorNow.label) || a.label || b.label,
          stateName: (actorNow && actorNow.stateName) || a.stateName || b.stateName,
          nameMismatch: Boolean((actorNow && actorNow.nameMismatch) || a.nameMismatch || b.nameMismatch),
          beforeHp,
          afterHp,
          hpLost: round(beforeHp - afterHp, 3),
          maxHp: a.maxHp,
          behavior: a.behavior,
          species: a.species,
          combatState: a.combatState,
          attackable: a.attackable,
          attackPoints: a.attackPoints,
          attackRange: a.attackRange,
          pos: a.pos,
          distanceToPlayer: a.distanceToPlayer,
          screen: a.screen,
          asset: a.asset,
          district: a.district,
        });
      }
    }
    losses.sort((a, b) => b.hpLost - a.hpLost);
    return losses;
  }

  function recentEventsSince(t, stages) {
    const list = trace.debugEvents.filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      if (Number(entry.at || 0) < t) return false;
      if (stages && stages.length && !stages.includes(entry.stage)) return false;
      return true;
    });
    return list.slice(-200).reverse();
  }

  function recentInputsSince(t) {
    return trace.inputs.filter((entry) => Number(entry.at || 0) >= t).slice(-20);
  }

  function matchesOffset(entry, offset) {
    if (!entry || typeof entry !== "object") return false;
    const o = Number(offset);
    const candidates = [
      entry.offset,
      entry.targetOffset,
      entry.attackerOffset,
      entry.chosenOffset,
      entry.selectedNpcOffset,
    ];
    return candidates.some((value) => Number(value) === o);
  }

  function recentCombatEntriesForOffset(snap, offset, since) {
    const o = Number(offset);
    return ((snap && snap.recent) || []).filter((entry) => {
      if (!entry || typeof entry !== "object") return false;
      const at = Number(entry.at || 0);
      if (since && Number.isFinite(since) && at < since) return false;
      return Number(entry.targetOffset) === o || Number(entry.attackerOffset) === o;
    });
  }

  function playerHpDrop(beforeSnap, afterSnap) {
    const beforeHp = Number(beforeSnap && beforeSnap.player && beforeSnap.player.hp);
    const afterHp = Number(afterSnap && afterSnap.player && afterSnap.player.hp);
    if (!Number.isFinite(beforeHp) || !Number.isFinite(afterHp)) return 0;
    return Math.max(0, beforeHp - afterHp);
  }

  function inferBlockers(loss, snap, record, offsetDebugEvents, offsetCombatEntries) {
    const blockers = [];
    const npc = snap && snap.npcs ? snap.npcs[String(loss.offset)] : undefined;
    const brain = snap && snap.npcBrains ? snap.npcBrains[String(loss.offset)] : undefined;
    const actor = (snap.actors || []).find((item) => Number(item.offset) === Number(loss.offset));
    const runtime = snap && snap.runtime;
    const latestCounterSkip = offsetDebugEvents.find((entry) => entry.stage === "combat.counter_skip");
    const latestRangeSkip = offsetDebugEvents.find((entry) => entry.stage === "combat.ai.range_skip");
    const latestCounterCheck = offsetDebugEvents.find((entry) => entry.stage === "combat.countercheck");
    const latestRetaliate = offsetDebugEvents.find((entry) => entry.stage === "fight.ai.retaliate");

    if (!npc) blockers.push("no combat-state NPC entry exists for this offset");
    if (npc && npc.attackable === false) blockers.push("target.attackable is false");
    if (npc && Number(npc.hp) <= 0) blockers.push("target is dead after the hit");
    if (npc && ["dead", "respawning"].includes(String(npc.combatState))) blockers.push(`target combatState is ${npc.combatState}`);
    if (npc && Number(npc.attackPoints) <= 0) blockers.push("target.attackPoints is 0");
    if (npc && ["training_dummy", "quest_anchor", "passive"].includes(String(npc.behavior))) blockers.push(`behavior ${npc.behavior} is not allowed to retaliate`);
    if (!runtime || !Array.isArray(runtime.position)) blockers.push("player runtime position is missing");
    if (!actor) blockers.push("renderer actor was not registered for this offset during final inspection");
    if (!brain) blockers.push("no npcBrains entry was created for this offset after the hit");
    if (latestCounterSkip && latestCounterSkip.reason) blockers.push(`counter skip: ${latestCounterSkip.reason}`);
    if (latestRangeSkip && latestRangeSkip.skipped) blockers.push("AI range skip exists; inspect skipped[] for distance/reach reason");
    if (latestCounterCheck && latestCounterCheck.canCounterattack === false && latestCounterCheck.reachCheck && latestCounterCheck.reachCheck.reason) {
      blockers.push(`countercheck failed: ${latestCounterCheck.reachCheck.reason}`);
    }
    if (loss.nameMismatch) blockers.push(`visual/combat name mismatch: actor label "${loss.actorLabel}" but combat state says "${loss.stateName}"`);

    const retaliatedByLog = offsetCombatEntries.some((entry) => {
      const attackerOffset = Number(entry.attackerOffset);
      const target = String(entry.target || "").toLowerCase();
      return attackerOffset === Number(loss.offset) && (PLAYER_NAMES.has(entry.target) || /you|player/.test(target));
    });
    const playerDamage = playerHpDrop(record.afterAttackSnap, snap);
    const retaliated = Boolean(retaliatedByLog || latestRetaliate || playerDamage > 0);

    return {
      blockers,
      retaliated,
      retaliatedByLog,
      playerDamage,
      brain,
      latestCounterSkip,
      latestRangeSkip,
      latestCounterCheck,
      latestRetaliate,
    };
  }

  function assessTargetCorrectness(record, loss) {
    const hitOffsets = (record.forward.forwardHits || []).map((entry) => Number(entry.offset)).filter(Number.isFinite);
    const candidateOffsets = record.forward.forwardStart && Array.isArray(record.forward.forwardStart.candidateOffsets)
      ? record.forward.forwardStart.candidateOffsets.map(Number).filter(Number.isFinite)
      : [];
    if (hitOffsets.includes(Number(loss.offset))) {
      return "YES: the NPC that lost HP matches forward_arc.hit.";
    }
    if (candidateOffsets.includes(Number(loss.offset))) {
      return "PARTIAL: HP loss is in the forward-arc candidate list, but no matching forward_arc.hit event was captured.";
    }
    if (hitOffsets.length > 0) {
      return `NO: HP loss offset ${loss.offset} does not match forward_arc.hit offsets [${hitOffsets.join(", ")}].`;
    }
    return "UNKNOWN: no forward_arc.hit event was captured; compare nearestActors and input timing.";
  }

  function finalizeRecord(record, delayLabel) {
    const finalSnap = snapshot(`finalize:${delayLabel}`);
    record.finalSnapshots.push(finalSnap);
    record.results = record.results || [];

    const result = {
      at: now(),
      delayLabel,
      playerHpDropSinceAttack: playerHpDrop(record.afterAttackSnap, finalSnap),
      losses: [],
      nearestActorsNow: finalSnap.nearestActors,
    };

    for (const loss of record.losses) {
      const offsetDebugEvents = recentEventsSince(record.beforeSnap.at - 1500).filter((entry) => matchesOffset(entry, loss.offset));
      const offsetCombatEntries = recentCombatEntriesForOffset(finalSnap, loss.offset, record.beforeSnap.at - 1500);
      const inference = inferBlockers(loss, finalSnap, record, offsetDebugEvents, offsetCombatEntries);
      result.losses.push({
        ...loss,
        targetCorrectness: assessTargetCorrectness(record, loss),
        retaliated: inference.retaliated,
        playerDamageAfterHit: inference.playerDamage,
        likelyCause: inference.retaliated
          ? "NPC retaliated; check the player HP drop and combat log entry."
          : inference.blockers.length
            ? inference.blockers.join("; ")
            : "No obvious blocker. The hit reduced HP but no counterattack, no AI attack, and no explicit skip reason was captured.",
        blockers: inference.blockers,
        brain: inference.brain,
        latestCounterSkip: inference.latestCounterSkip,
        latestRangeSkip: inference.latestRangeSkip,
        latestCounterCheck: inference.latestCounterCheck,
        latestRetaliate: inference.latestRetaliate,
        combatEntries: offsetCombatEntries,
        debugEvents: offsetDebugEvents.slice(0, 40),
      });
    }

    record.results.push(result);
    trace.lastRecord = record;

    console.groupCollapsed(`[${VERSION}] retaliation result after ${delayLabel}`);
    console.table(result.losses.map((item) => ({
      offset: item.offset,
      visual: item.actorLabel || item.name,
      combatName: item.stateName,
      hpLost: item.hpLost,
      retaliated: item.retaliated,
      playerDamageAfterHit: item.playerDamageAfterHit,
      targetCorrectness: item.targetCorrectness,
      likelyCause: item.likelyCause,
      x: item.pos && item.pos.x,
      z: item.pos && item.pos.z,
      distance: item.distanceToPlayer,
    })));
    console.log("Full result", result);
    console.log("Full record", record);
    console.groupEnd();
    return result;
  }

  function handleLosses(beforeSnap, afterSnap, losses) {
    const eventWindowStart = beforeSnap.at - 1500;
    const events = recentEventsSince(eventWindowStart);
    const forward = latestForwardDebug(events);
    const record = {
      id: `${VERSION}-${now()}-${trace.records.length + 1}`,
      version: VERSION,
      at: now(),
      url: location.href,
      beforeSnap,
      afterAttackSnap: afterSnap,
      losses,
      inputEvents: recentInputsSince(eventWindowStart),
      forward,
      debugEventsAroundAttack: events.slice(0, 120),
      nearestActorsAtAttack: afterSnap.nearestActors,
      finalSnapshots: [],
      results: [],
    };
    trace.records.push(record);
    trace.lastRecord = record;

    console.groupCollapsed(`[${VERSION}] HP loss detected: ${losses.map((l) => `${l.actorLabel || l.name || l.offset}(${l.offset}) -${l.hpLost}`).join(", ")}`);
    console.table(losses.map((loss) => ({
      offset: loss.offset,
      visual: loss.actorLabel || loss.name,
      combatName: loss.stateName,
      mismatch: loss.nameMismatch,
      beforeHp: loss.beforeHp,
      afterHp: loss.afterHp,
      hpLost: loss.hpLost,
      behavior: loss.behavior,
      attackable: loss.attackable,
      attackPoints: loss.attackPoints,
      x: loss.pos && loss.pos.x,
      z: loss.pos && loss.pos.z,
      distance: loss.distanceToPlayer,
      targetCorrectness: assessTargetCorrectness(record, loss),
    })));
    if (losses.some((loss) => loss.nameMismatch)) {
      console.warn(`[${VERSION}] Visual/combat-name mismatch detected. This is exactly the class of bug where the screen shows a Mucker/Hexer/etc but the combat model says Wolf/Bandit/etc.`, losses.filter((loss) => loss.nameMismatch));
    }
    console.log("Forward arc debug around attack", forward);
    console.log("Nearest actors at attack", afterSnap.nearestActors);
    console.log("Full attack record", record);
    console.groupEnd();

    setTimeout(() => finalizeRecord(record, "1.6s"), 1600);
    setTimeout(() => finalizeRecord(record, "3.4s"), 3400);
  }

  const trace = {
    version: VERSION,
    started: false,
    pollTimer: undefined,
    lastSnap: undefined,
    records: [],
    samples: [],
    debugEvents: [],
    inputs: [],
    lastRecord: undefined,
    listenersInstalled: false,
  };

  function onDebugEvent(event) {
    const detail = event && event.detail ? clone(event.detail) : { at: now(), stage: "unknown_debug_event" };
    if (!detail.at) detail.at = now();
    trace.debugEvents.push(detail);
    if (trace.debugEvents.length > 1500) trace.debugEvents.splice(0, trace.debugEvents.length - 1500);
  }

  function onInputEvent(event) {
    trace.inputs.push({
      at: now(),
      type: event.type,
      key: event.key,
      code: event.code,
      button: event.button,
      buttons: event.buttons,
      clientX: event.clientX,
      clientY: event.clientY,
      targetTag: event.target && event.target.tagName,
    });
    if (trace.inputs.length > 300) trace.inputs.splice(0, trace.inputs.length - 300);
  }

  function tick(reason = "poll") {
    const current = snapshot(reason);
    if (trace.lastSnap) {
      const losses = hpLosses(trace.lastSnap, current);
      if (losses.length > 0) {
        handleLosses(trace.lastSnap, current, losses);
      }
    }
    trace.lastSnap = current;
    return current;
  }

  function installListeners() {
    if (trace.listenersInstalled) return;
    trace.listenersInstalled = true;
    w.addEventListener(DEBUG_EVENT, onDebugEvent);
    w.addEventListener(EFFECT_EVENT, onDebugEvent);
    w.addEventListener(STATE_EVENT, () => tick("state_event"));
    w.addEventListener("keydown", onInputEvent, true);
    w.addEventListener("mousedown", onInputEvent, true);
    w.addEventListener("pointerdown", onInputEvent, true);
  }

  function removeListeners() {
    if (!trace.listenersInstalled) return;
    trace.listenersInstalled = false;
    w.removeEventListener(DEBUG_EVENT, onDebugEvent);
    w.removeEventListener(EFFECT_EVENT, onDebugEvent);
    w.removeEventListener("keydown", onInputEvent, true);
    w.removeEventListener("mousedown", onInputEvent, true);
    w.removeEventListener("pointerdown", onInputEvent, true);
  }

  function start(options = {}) {
    const pollMs = Math.max(50, Number(options.pollMs || 100));
    localStorage.setItem(DEBUG_KEY, "1");
    if (w.__harthmereCombatDebug && typeof w.__harthmereCombatDebug.enable === "function") {
      try { w.__harthmereCombatDebug.enable(); } catch (_err) {}
    }
    installListeners();
    if (trace.pollTimer) clearInterval(trace.pollTimer);
    trace.started = true;
    trace.lastSnap = snapshot("start");
    trace.samples.push(trace.lastSnap);
    trace.pollTimer = setInterval(() => tick("poll"), pollMs);
    console.info(`[${VERSION}] started. Attack one NPC normally. I will log which exact offset/visual actor loses HP, its coordinates, whether it matches forward_arc.hit, and why retaliation did or did not happen.`);
    console.table(trace.lastSnap.nearestActors.slice(0, 12).map((actor) => ({
      offset: actor.offset,
      visual: actor.label || actor.name,
      combatName: actor.stateName,
      mismatch: actor.nameMismatch,
      hp: actor.hp,
      x: actor.pos && actor.pos.x,
      z: actor.pos && actor.pos.z,
      distance: actor.distanceToPlayer,
      screenVisible: actor.screen && actor.screen.visible,
    })));
    return status();
  }

  function stop() {
    if (trace.pollTimer) clearInterval(trace.pollTimer);
    trace.pollTimer = undefined;
    trace.started = false;
    removeListeners();
    console.info(`[${VERSION}] stopped.`);
    return status();
  }

  function status() {
    const snap = snapshot("status");
    return {
      version: VERSION,
      started: trace.started,
      recordCount: trace.records.length,
      debugEventCount: trace.debugEvents.length,
      inputEventCount: trace.inputs.length,
      hasCombatDebugBridge: Boolean(w.__harthmereCombatDebug),
      hasRuntime: Boolean(snap.runtime && snap.runtime.position),
      actorCount: snap.actors.length,
      selectedNpcOffset: snap.selectedNpcOffset,
      nearestActors: snap.nearestActors.slice(0, 8),
      lastRecord: trace.lastRecord,
    };
  }

  function nearest(limit = 15) {
    const snap = snapshot("nearest");
    const rows = snap.nearestActors.slice(0, Math.max(1, Number(limit) || 15));
    console.table(rows.map((actor) => ({
      offset: actor.offset,
      visual: actor.label || actor.name,
      combatName: actor.stateName,
      mismatch: actor.nameMismatch,
      hp: actor.hp,
      maxHp: actor.maxHp,
      behavior: actor.behavior,
      attackable: actor.attackable,
      attackPoints: actor.attackPoints,
      x: actor.pos && actor.pos.x,
      z: actor.pos && actor.pos.z,
      distance: actor.distanceToPlayer,
      screenVisible: actor.screen && actor.screen.visible,
    })));
    return rows;
  }

  function sample(note = "manual") {
    const snap = tick(`manual:${note}`);
    trace.samples.push(snap);
    console.info(`[${VERSION}] sample: ${note}`, snap);
    nearest(12);
    return snap;
  }

  function report() {
    return {
      version: VERSION,
      url: location.href,
      generatedAt: new Date().toISOString(),
      status: status(),
      records: trace.records,
      samples: trace.samples.slice(-25),
      debugEvents: trace.debugEvents.slice(-300),
      inputs: trace.inputs.slice(-100),
      finalSnapshot: snapshot("report"),
    };
  }

  function download(filename = `harthmere-retaliation-trace-${new Date().toISOString().replace(/[:.]/g, "-")}.json`) {
    const data = JSON.stringify(report(), null, 2);
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    console.info(`[${VERSION}] downloaded ${filename}`);
    return { filename, bytes: data.length };
  }

  function reset() {
    trace.records = [];
    trace.samples = [];
    trace.debugEvents = [];
    trace.inputs = [];
    trace.lastRecord = undefined;
    trace.lastSnap = snapshot("reset");
    console.info(`[${VERSION}] reset.`);
    return status();
  }

  function help() {
    return {
      start: "__harthmereRetaliationTrace.start(); then attack an NPC normally",
      nearest: "__harthmereRetaliationTrace.nearest(); shows nearest visible combat actors and visual/combat-name mismatches",
      sample: "__harthmereRetaliationTrace.sample('note'); captures current coordinates and nearest actors",
      report: "__harthmereRetaliationTrace.report(); returns all records",
      download: "__harthmereRetaliationTrace.download(); downloads JSON for upload/debugging",
      stop: "__harthmereRetaliationTrace.stop(); stops polling/listeners",
      important: "If the screen says Seedling Mucker but combatName says Wolf, the bug is offset/visual actor mapping, not the retaliation rule itself.",
    };
  }

  w.__harthmereRetaliationTrace = {
    version: VERSION,
    start,
    stop,
    status,
    nearest,
    sample,
    report,
    download,
    reset,
    help,
    _trace: trace,
  };

  console.info(`[${VERSION}] installed. Run __harthmereRetaliationTrace.start(); then attack the NPC. Run __harthmereRetaliationTrace.download(); after the result prints.`);
  console.info(help());
})();
