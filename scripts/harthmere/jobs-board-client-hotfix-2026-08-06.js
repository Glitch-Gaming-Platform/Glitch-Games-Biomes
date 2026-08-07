(() => {
  "use strict";

  const VERSION = "harthmere-jobs-board-client-hotfix-2026-08-06-v2";
  const priorCleanup = window.__harthmereJobsBoardClientHotfixCleanup;
  if (typeof priorCleanup === "function") {
    priorCleanup();
  }

  const TARGETS = [
    {
      objectId: "farm_supply_crate",
      markerId: "farm_supply_crate_marker",
      label: "Farm Supply Crate",
      kind: "use",
      title: "Deliver Crop Bundles",
      position: [1726.2893328285693, 49, -575.4317928761343],
      fieldTarget: true,
    },
    {
      objectId: "forge_material_bin",
      markerId: "forge_marker",
      label: "Forge Material Bin",
      kind: "use",
      title: "Deliver Iron Ore",
      position: [1633.4656864624603, 42, -766.3120794973495],
      fieldTarget: true,
    },
    {
      objectId: "safe_ruin_cache",
      markerId: "safe_ruin_cache_marker",
      label: "Safe Ruin Cache",
      kind: "gather",
      title: "Recover Relic Fragment",
      position: [1729.8806120121526, 26, -894.0236258204618],
      fieldTarget: true,
    },
    {
      objectId: "property_material_crate",
      markerId: "property_material_marker",
      label: "Property Material Crate",
      kind: "use",
      title: "Deliver Building Materials",
      position: [1232.486784706693, 53, -777.1263381042988],
      fieldTarget: true,
    },
    {
      objectId: "trader_ration_crate",
      markerId: "trader_ration_crate_marker",
      label: "Trader Ration Crate",
      kind: "use",
      title: "Stock Rations",
      position: [988.8755482322824, 52, -921.8141827281337],
      fieldTarget: true,
    },
    {
      objectId: "sanitation_barrels",
      markerId: "sanitation_barrels_marker",
      label: "Sanitation Barrels",
      kind: "use",
      title: "Return Mixed Waste",
      position: [437.9102350827924, 44, -334.4819172551751],
      fieldTarget: true,
    },
    {
      objectId: "clinic_lockbox",
      markerId: "clinic_lockbox_marker",
      label: "Clinic Delivery Lockbox",
      kind: "use",
      title: "Deliver Sealed Package",
      position: [754.2301218122271, 46, -537.3216277478082],
      fieldTarget: true,
    },
    {
      objectId: "inn_linen_shelf",
      markerId: "inn_linen_marker",
      label: "Inn Linen Shelf",
      kind: "use",
      title: "Deliver Linen Bundles",
      position: [608.8795568653649, 47, -470.62449044213434],
      fieldTarget: true,
    },
    {
      objectId: "outpost_tools_cinderlane_work_station",
      markerId: "outpost_tools_cinderlane_work_station_marker",
      label: "Tool Order Bin",
      kind: "use",
      title: "Fill Tool Orders",
      position: [1626.9656864624603, 42, -766.3120794973495],
      fieldTarget: true,
    },
    {
      objectId: "econ_gus_loaf_tray",
      markerId: "econ_gus_loaf_tray",
      label: "Gus's Marked Loaf Basket",
      kind: "gather",
      title: "Pick Up",
      position: [487, 71, -125],
      fieldTarget: false,
    },
    {
      objectId: "econ_rin_basket",
      markerId: "econ_rin_basket",
      label: "Rin's Forage Basket",
      kind: "gather",
      title: "Gather Mushrooms",
      position: [511, 71, -156],
      fieldTarget: false,
    },
    {
      objectId: "coop_supply_box",
      markerId: "coop_supply_box",
      label: "Old Supply Box",
      kind: "inspect",
      title: "Pick Up Sealed Package",
      // The immutable landmark was authored at Y=71, but production terrain
      // and the active map pin resolve this box to the real surface at Y=59.
      // Keep the no-build prompt at the same grounded pose.
      position: [384, 59, -198],
      fieldTarget: false,
      deliveryPickup: true,
    },
  ];
  const TARGET_BY_LABEL = new Map(
    TARGETS.map((target) => [target.label.toLowerCase(), target])
  );
  const DELIVERY_DROPOFFS = {
    grove_mail_bank_satchel: {
      label: "Mail and Bank Satchel",
      position: [488, 71, -122],
    },
  };
  const cleanupCallbacks = [];
  let stopped = false;
  let busyTargetId;
  let patchedRenderer;
  let originalDraw;
  let patchedPermissionsManager;
  let originalItemActionAllowed;
  let patchedBikkieRuntime;
  let originalMuckRakeBiscuit;
  const originalFetch = window.fetch.bind(window);
  let rememberedInventoryItems = {};
  let activeDeliveryTodoId;
  let activeDeliveryJobId;
  let activeDeliveryTitle;
  let activeDeliveryObjective;
  let patchedObjectiveElement;
  let patchedObjectiveText;
  const PROTECTED_VISIBLE_JOB_TOOL_IDS = new Set([
    8668696029471666, // Muck Rake
    8664740698822359, // Repair Mallet
  ]);
  const MUCK_RAKE_ITEM_ID = 8668696029471666;
  const WOODEN_HOE_PRESENTATION_ID = 1534621126189388;
  const PRESENTATION_ATTRIBUTES = [
    "attachmentTransform",
    "galoisPath",
    "icon",
    "iconSettings",
    "mesh",
    "meshGaloisPath",
    "paletteColor",
    "vox",
    "voxWithHatVariant",
    "worldMesh",
  ];

  function normalize(value) {
    return String(value ?? "")
      .trim()
      .replace(/\s+/g, " ")
      .toLowerCase();
  }

  function installId() {
    const params = new URLSearchParams(window.location.search);
    return params.get("install_id") ?? params.get("installId") ?? undefined;
  }

  function liveModeUrl(endpoint = "/api/harthmere/live_mode") {
    const id = installId();
    return id ? `${endpoint}?install_id=${encodeURIComponent(id)}` : endpoint;
  }

  function requestHeaders() {
    const headers = { "Content-Type": "application/json" };
    const id = installId();
    if (id) headers["X-Glitch-Install-Id"] = id;
    return headers;
  }

  function setActiveDeliveryObjective(objective) {
    if (activeDeliveryObjective === objective) return;
    activeDeliveryObjective = objective;
    window.dispatchEvent(new Event("storage"));
  }

  function ensureDeliveryObjectiveText() {
    const element = document.querySelector(
      ".biomes-ui-current-objective-hud__text"
    );
    if (!activeDeliveryObjective) {
      if (
        patchedObjectiveElement &&
        patchedObjectiveElement.isConnected &&
        patchedObjectiveElement.textContent === patchedObjectiveText
      ) {
        window.dispatchEvent(new Event("storage"));
      }
      patchedObjectiveElement = undefined;
      patchedObjectiveText = undefined;
      return;
    }
    if (!element) return;
    if (element.textContent !== activeDeliveryObjective) {
      element.textContent = activeDeliveryObjective;
    }
    patchedObjectiveElement = element;
    patchedObjectiveText = activeDeliveryObjective;
  }

  function writeDeliveryUiPin(input) {
    if (!activeDeliveryTodoId || !activeDeliveryJobId) return;
    const questId = `jobs_board:${activeDeliveryTodoId}`;
    const pin = {
      markerId: `jobs_board_marker:${activeDeliveryTodoId}`,
      label: activeDeliveryTitle || "Run the Coop Food Parcel",
      kind: "objective",
      worldPosition: [...input.position],
      description: input.objective,
      ownerQuestId: questId,
      worldObjectId: input.worldObjectId,
      interactionTargetId: input.interactionTargetId,
      setAtMs: Date.now(),
    };
    const mainQuest = {
      questId,
      title: activeDeliveryTitle || "Run the Coop Food Parcel",
      firstMarkerId: pin.markerId,
      objective: input.objective,
      setAtMs: Date.now(),
    };
    try {
      window.localStorage?.setItem(
        "biomes_ui_active_map_pin",
        JSON.stringify(pin)
      );
      window.localStorage?.setItem(
        "biomes_ui_main_quest",
        JSON.stringify(mainQuest)
      );
    } catch {
      // Events still update the in-memory UI when storage is unavailable.
    }
    window.dispatchEvent(
      new CustomEvent("biomes-ui-active-map-pin", { detail: pin })
    );
    window.dispatchEvent(
      new CustomEvent("biomes-ui-main-quest", { detail: mainQuest })
    );
  }

  function clearDeliveryUiHandoff() {
    const todoId = activeDeliveryTodoId;
    activeDeliveryTodoId = undefined;
    activeDeliveryJobId = undefined;
    activeDeliveryTitle = undefined;
    setActiveDeliveryObjective(undefined);
    if (!todoId) return;
    try {
      const rawPin = window.localStorage?.getItem("biomes_ui_active_map_pin");
      const pin = rawPin ? JSON.parse(rawPin) : undefined;
      if (pin?.markerId === `jobs_board_marker:${todoId}`) {
        window.localStorage?.removeItem("biomes_ui_active_map_pin");
        window.dispatchEvent(
          new CustomEvent("biomes-ui-active-map-pin", { detail: undefined })
        );
      }
      const rawQuest = window.localStorage?.getItem("biomes_ui_main_quest");
      const quest = rawQuest ? JSON.parse(rawQuest) : undefined;
      if (quest?.questId === `jobs_board:${todoId}`) {
        window.localStorage?.removeItem("biomes_ui_main_quest");
        window.dispatchEvent(
          new CustomEvent("biomes-ui-main-quest", { detail: undefined })
        );
      }
    } catch {
      // The storage event below still asks mounted UI surfaces to refresh.
    }
    window.dispatchEvent(new Event("storage"));
  }

  function installDeliveryHandoff(todo, job, requirement) {
    const markerId = requirement?.mapMarkerId;
    const destination = markerId ? DELIVERY_DROPOFFS[markerId] : undefined;
    if (!todo?.todoId || !job?.jobId || !markerId || !destination) return;
    activeDeliveryTodoId = todo.todoId;
    activeDeliveryJobId = job.jobId;
    activeDeliveryTitle = job.title || todo.title || "Run the Coop Food Parcel";
    const objective = `Deliver Sealed Package to ${destination.label}. Stand at the drop-off and press F.`;
    setActiveDeliveryObjective(objective);
    writeDeliveryUiPin({
      position: destination.position,
      objective,
      worldObjectId: markerId,
      interactionTargetId: requirement.targetId ?? markerId,
    });
  }

  function refreshDeliveryHandoffPhase(snapshot) {
    if (!activeDeliveryTodoId || !activeDeliveryJobId) return;
    const todo = (snapshot?.myTodos ?? []).find(
      (candidate) => candidate.todoId === activeDeliveryTodoId
    );
    const job = (snapshot?.myAcceptedJobs ?? []).find(
      (candidate) => candidate.jobId === activeDeliveryJobId
    );
    if (!todo || !job || job.status === "completed") {
      clearDeliveryUiHandoff();
      return;
    }
    if (todo.status === "completed") {
      const objective =
        "Delivered. Return to the jobs board to collect your reward.";
      setActiveDeliveryObjective(objective);
      writeDeliveryUiPin({
        position: [501.99486179104775, 70, -132.00350672753194],
        objective,
        worldObjectId: "harthmere_market_posting_board",
        interactionTargetId: "harthmere_grove_market_jobs_board",
      });
    }
  }

  let deliveryPhaseRefreshBusy = false;
  async function refreshActiveDeliveryPhaseFromServer() {
    if (!activeDeliveryTodoId || deliveryPhaseRefreshBusy) return;
    deliveryPhaseRefreshBusy = true;
    try {
      const response = await originalFetch(
        liveModeUrl("/api/harthmere/live_mode_jobs_board_state"),
        { credentials: "same-origin", cache: "no-store" }
      );
      if (!response.ok) return;
      const body = await response.json();
      refreshDeliveryHandoffPhase(body?.jobsBoardState);
    } catch {
      // Keep the last known handoff during a transient poll failure.
    } finally {
      deliveryPhaseRefreshBusy = false;
    }
  }

  async function fetchWithDeliveryInventoryHandoff(input, init) {
    const response = await originalFetch(input, init);
    const url =
      typeof input === "string"
        ? input
        : input instanceof URL
          ? input.href
          : input?.url;
    const method = String(init?.method ?? input?.method ?? "GET").toUpperCase();
    if (
      method !== "GET" ||
      !String(url ?? "").includes("/api/harthmere/live_mode_jobs_board_state") ||
      !response.ok ||
      Object.keys(rememberedInventoryItems).length === 0
    ) {
      return response;
    }
    try {
      const body = await response.clone().json();
      const snapshot = body?.jobsBoardState;
      if (!snapshot || typeof snapshot !== "object") return response;
      snapshot.inventoryItems = {
        ...(snapshot.inventoryItems ?? {}),
        ...rememberedInventoryItems,
      };
      refreshDeliveryHandoffPhase(snapshot);
      const headers = new Headers(response.headers);
      headers.delete("content-length");
      headers.delete("content-encoding");
      return new Response(JSON.stringify(body), {
        status: response.status,
        statusText: response.statusText,
        headers,
      });
    } catch (error) {
      console.error("Jobs Board delivery inventory handoff failed", error);
      return response;
    }
  }

  window.fetch = fetchWithDeliveryInventoryHandoff;
  cleanupCallbacks.push(() => {
    if (window.fetch === fetchWithDeliveryInventoryHandoff) {
      window.fetch = originalFetch;
    }
  });

  function playerPosition() {
    return window.clientContext?.resources?.get("/scene/local_player")?.player
      ?.position;
  }

  function nearestTarget(position, maxDistance = 6.5) {
    if (!position) return undefined;
    let best;
    for (const target of TARGETS) {
      const dx = Number(position[0]) - target.position[0];
      const dy = Number(position[1]) - target.position[1];
      const dz = Number(position[2]) - target.position[2];
      const horizontal = Math.hypot(dx, dz);
      if (horizontal > maxDistance || Math.abs(dy) > 10) continue;
      if (!best || horizontal < best.distance) {
        best = { target, distance: horizontal };
      }
    }
    return best?.target;
  }

  function currentTarget() {
    const resources = window.clientContext?.resources;
    const inspectable = resources?.get("/overlays")?.get("inspectable");
    const byLabel = TARGET_BY_LABEL.get(normalize(inspectable?.label));
    if (byLabel) return byLabel;
    return nearestTarget(playerPosition());
  }

  function forceMarkerVisible(scenes, target) {
    if (!target?.fieldTarget || !scenes?.three) return;
    let marker;
    scenes.three.traverse((object) => {
      if (
        !marker &&
        object?.userData?.harthmereQuestObjectMarkerId === target.markerId
      ) {
        marker = object;
      }
    });
    if (!marker) return;
    marker.visible = true;
    marker.position.y = target.position[1];
  }

  function ensureInspectableOverlay() {
    const resources = window.clientContext?.resources;
    const target = nearestTarget(playerPosition());
    if (!resources || !target) return;
    const overlays = resources.get("/overlays");
    const inspectable = overlays?.get("inspectable");
    if (
      inspectable?.kind === "harthmere_object" &&
      inspectable?.objectId === target.objectId &&
      inspectable?.label === target.label
    ) {
      return;
    }
    resources.update("/overlays", (next) => {
      next.set("inspectable", {
        kind: "harthmere_object",
        key: `inspect:harthmere_object:jobs-hotfix:${target.objectId}`,
        entityId: 0,
        objectId: target.objectId,
        label: target.label,
        pos: [...target.position],
      });
    });
  }

  function patchQuestMarkerRenderer() {
    const controller = window.clientContext?.rendererController;
    const renderers = controller?.renderers;
    const renderer = Array.isArray(renderers)
      ? renderers.find((candidate) =>
          String(candidate?.name ?? "").includes(
            "harthmere-quest-object-marker"
          )
        )
      : undefined;
    if (!renderer || renderer === patchedRenderer) return;
    patchedRenderer = renderer;
    originalDraw = renderer.draw;
    renderer.draw = function (scenes, dt) {
      const result = originalDraw.call(this, scenes, dt);
      forceMarkerVisible(scenes, nearestTarget(playerPosition()));
      return result;
    };
  }

  function patchProtectedJobToolVisibility() {
    const permissionsManager = window.clientContext?.permissionsManager;
    if (
      !permissionsManager ||
      permissionsManager === patchedPermissionsManager ||
      typeof permissionsManager.itemActionAllowed !== "function"
    ) {
      return;
    }
    patchedPermissionsManager = permissionsManager;
    originalItemActionAllowed = permissionsManager.itemActionAllowed;
    permissionsManager.itemActionAllowed = function (item, ...acls) {
      if (PROTECTED_VISIBLE_JOB_TOOL_IDS.has(Number(item?.id))) {
        return true;
      }
      return originalItemActionAllowed.call(this, item, ...acls);
    };
  }

  function patchMuckRakePresentation() {
    const runtime = window.bikkieRuntime;
    if (
      !runtime ||
      typeof runtime.getBiscuitOnlyIfExists !== "function" ||
      typeof runtime.registerBiscuits !== "function"
    ) {
      return;
    }
    const current = runtime.getBiscuitOnlyIfExists(MUCK_RAKE_ITEM_ID);
    const donor = runtime.getBiscuitOnlyIfExists(WOODEN_HOE_PRESENTATION_ID);
    if (!current || !donor) return;
    if (
      patchedBikkieRuntime === runtime &&
      current.galoisPath === donor.galoisPath &&
      current.meshGaloisPath === donor.meshGaloisPath
    ) {
      return;
    }
    if (!originalMuckRakeBiscuit) {
      originalMuckRakeBiscuit = { ...current };
    }
    const patched = { ...current };
    for (const attribute of PRESENTATION_ATTRIBUTES) {
      delete patched[attribute];
    }
    for (const attribute of ["attachmentTransform", "galoisPath"]) {
      if (donor[attribute] !== undefined) {
        patched[attribute] = donor[attribute];
      }
    }
    patched.id = current.id;
    patched.name = current.name;
    patched.displayName = current.displayName;
    runtime.registerBiscuits(new Map([[MUCK_RAKE_ITEM_ID, patched]]));
    patchedBikkieRuntime = runtime;
    const resources = window.clientContext?.resources;
    if (resources) {
      resources.invalidate("/scene/item/mesh", {
        toString: () => `${MUCK_RAKE_ITEM_ID}:undefined`,
      });
      const localPlayerId = resources.get("/scene/local_player")?.player?.id;
      if (localPlayerId) {
        resources.invalidate("/scene/player/mesh", localPlayerId);
      }
    }
    window.__harthmereMuckRakePresentationHotfix = {
      version: VERSION,
      itemId: MUCK_RAKE_ITEM_ID,
      donorId: WOODEN_HOE_PRESENTATION_ID,
      galoisPath: donor.galoisPath,
      meshGaloisPath: donor.meshGaloisPath,
    };
  }

  async function submitWorldObjectInteraction(target) {
    const requestId = `jobs_board_hotfix_world_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const response = await fetch(liveModeUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: requestHeaders(),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        actionKind: "request_care_loop_action",
        subsystem: "care",
        actorEntityVersion: 1,
        zoneId: "harthmere",
        clientSentAtMs: Date.now(),
        payload: {
          operation: "world_object_interaction",
          objectId: target.objectId,
          label: target.label,
          interactionKind: target.kind,
        },
        clientClaims: {},
      }),
    });
    const body = await response.json();
    const warnings = Array.isArray(body?.backendMutation?.warnings)
      ? body.backendMutation.warnings.map(String)
      : [];
    if (
      !response.ok ||
      body?.ok === false ||
      warnings.some((warning) =>
        warning.startsWith("world_object_rejected:")
      )
    ) {
      throw new Error(
        `jobs_board_hotfix_world_rejected:${warnings.join(",") || response.status}`
      );
    }
    window.dispatchEvent(new Event("biomes:harthmere-inventory-changed"));
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-world-object-interaction", {
        detail: {
          entityId: 0,
          objectId: target.objectId,
          label: target.label,
          kind: target.kind,
          title: target.title,
          serverAuthoritativePickup: target.kind === "gather",
        },
      })
    );
    return body;
  }

  function aliasesForTodo(todo, job) {
    const aliases = new Set();
    for (const value of [
      todo?.mapMarkerId,
      todo?.targetId,
      job?.mapMarkerId,
      job?.targetId,
    ]) {
      if (value) aliases.add(normalize(value));
    }
    for (const requirement of job?.requirements ?? []) {
      for (const value of [
        requirement?.pickupMarkerId,
        requirement?.mapMarkerId,
        requirement?.targetId,
        requirement?.targetName,
        requirement?.recipientNpcId,
      ]) {
        if (value) aliases.add(normalize(value));
      }
    }
    return aliases;
  }

  async function completeJobsBoardObjective(target) {
    if (!target.fieldTarget && !target.deliveryPickup) return;
    const stateResponse = await fetch(
      liveModeUrl("/api/harthmere/live_mode_jobs_board_state"),
      { credentials: "same-origin", cache: "no-store" }
    );
    const stateBody = await stateResponse.json();
    const snapshot = stateBody?.jobsBoardState;
    if (!stateResponse.ok || !stateBody?.ok || !snapshot) {
      throw new Error("jobs_board_hotfix_state_failed");
    }
    const jobsById = new Map(
      (snapshot.myAcceptedJobs ?? []).map((job) => [job.jobId, job])
    );
    const targetAliases = new Set([
      normalize(target.objectId),
      normalize(target.markerId),
      normalize(target.label),
    ]);
    const todo = (snapshot.myTodos ?? []).find((candidate) => {
      if (candidate.status !== "active") return false;
      const aliases = aliasesForTodo(candidate, jobsById.get(candidate.jobId));
      return [...targetAliases].some((alias) => aliases.has(alias));
    });
    if (!todo) return;
    const job = jobsById.get(todo.jobId);
    const matchedRequirement = (job?.requirements ?? []).find((requirement) =>
      [
        requirement?.pickupMarkerId,
        requirement?.mapMarkerId,
        requirement?.targetId,
        requirement?.targetName,
        requirement?.recipientNpcId,
      ].some((value) => value && targetAliases.has(normalize(value)))
    );
    const completedTargetId =
      matchedRequirement?.targetId ??
      matchedRequirement?.pickupMarkerId ??
      matchedRequirement?.mapMarkerId ??
      todo.targetId ??
      todo.mapMarkerId ??
      target.objectId;
    const requestId = `jobs_board_hotfix_complete_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const response = await fetch(liveModeUrl(), {
      method: "POST",
      credentials: "same-origin",
      headers: requestHeaders(),
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        targetId: todo.boardId,
        actionKind: "request_jobs_board_mutation",
        subsystem: "jobs",
        actorEntityVersion: 1,
        targetEntityVersion: 1,
        zoneId: "harthmere_grove",
        payload: {
          jobId: todo.jobId,
          boardId: todo.boardId,
          questTodoId: todo.todoId,
          completedTargetId,
          interactionTargetId: todo.boardId,
          operation: target.deliveryPickup
            ? "pickup_delivery_parcel"
            : "complete_job_quest",
        },
      }),
    });
    const body = await response.json();
    if (!response.ok || body?.ok === false) {
      throw new Error(`jobs_board_hotfix_completion_failed:${response.status}`);
    }
    const nextSnapshot =
      body.jobsBoardState ?? body.economyState?.jobsBoardState;
    if (nextSnapshot) {
      const freshItems = body.inventoryLootState?.actor?.items;
      if (freshItems && typeof freshItems === "object") {
        rememberedInventoryItems = {
          ...rememberedInventoryItems,
          ...freshItems,
        };
      }
      // Native inventory snapshots can be keyed by numeric Bikkie ids while
      // the Jobs Board requirement uses its durable logical item id. Record
      // that exact requirement too so every mounted-client map/HUD adapter
      // observes the parcel immediately instead of retaining the pickup hint.
      if (target.deliveryPickup && matchedRequirement?.itemId) {
        const requiredCount = Math.max(
          1,
          Math.floor(Number(matchedRequirement.count ?? 1))
        );
        rememberedInventoryItems = {
          ...rememberedInventoryItems,
          [matchedRequirement.itemId]: Math.max(
            requiredCount,
            Number(
              rememberedInventoryItems[matchedRequirement.itemId] ?? 0
            )
          ),
        };
      }
      nextSnapshot.inventoryItems = {
        ...(nextSnapshot.inventoryItems ?? {}),
        ...rememberedInventoryItems,
      };
      window.dispatchEvent(
        new CustomEvent("biomes:harthmere-jobs-board-state-updated", {
          detail: { jobsBoardState: nextSnapshot },
        })
      );
      if (target.deliveryPickup) {
        installDeliveryHandoff(todo, job, matchedRequirement);
      }
    }
  }

  async function perform(target) {
    if (!target || busyTargetId) return;
    busyTargetId = target.objectId;
    try {
      await submitWorldObjectInteraction(target);
      await completeJobsBoardObjective(target);
      window.dispatchEvent(
        new CustomEvent("biomes:harthmere-jobs-board-client-hotfix-used", {
          detail: { version: VERSION, objectId: target.objectId },
        })
      );
    } catch (error) {
      console.error("Jobs Board client hotfix interaction failed", error);
    } finally {
      busyTargetId = undefined;
    }
  }

  function onKeyDown(event) {
    if (
      event.defaultPrevented ||
      event.repeat ||
      String(event.code || event.key).toLowerCase() !== "keyf"
    ) {
      return;
    }
    const target = currentTarget();
    if (!target) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    void perform(target);
  }

  function installAgainstClientContext() {
    if (stopped) return;
    patchQuestMarkerRenderer();
    patchProtectedJobToolVisibility();
    patchMuckRakePresentation();
    ensureInspectableOverlay();
    ensureDeliveryObjectiveText();
  }

  window.addEventListener("keydown", onKeyDown, true);
  cleanupCallbacks.push(() =>
    window.removeEventListener("keydown", onKeyDown, true)
  );
  const interval = window.setInterval(installAgainstClientContext, 16);
  cleanupCallbacks.push(() => window.clearInterval(interval));
  const deliveryPhaseInterval = window.setInterval(
    () => void refreshActiveDeliveryPhaseFromServer(),
    500
  );
  cleanupCallbacks.push(() => window.clearInterval(deliveryPhaseInterval));

  const cleanup = () => {
    if (stopped) return;
    stopped = true;
    for (const callback of cleanupCallbacks.splice(0).reverse()) {
      try {
        callback();
      } catch (error) {
        console.error("Jobs Board client hotfix cleanup failed", error);
      }
    }
    if (patchedRenderer && originalDraw) {
      patchedRenderer.draw = originalDraw;
    }
    if (patchedPermissionsManager && originalItemActionAllowed) {
      patchedPermissionsManager.itemActionAllowed = originalItemActionAllowed;
    }
    if (patchedBikkieRuntime && originalMuckRakeBiscuit) {
      patchedBikkieRuntime.registerBiscuits(
        new Map([[MUCK_RAKE_ITEM_ID, originalMuckRakeBiscuit]])
      );
    }
    patchedRenderer = undefined;
    originalDraw = undefined;
    patchedPermissionsManager = undefined;
    originalItemActionAllowed = undefined;
    patchedBikkieRuntime = undefined;
    originalMuckRakeBiscuit = undefined;
    rememberedInventoryItems = {};
    activeDeliveryTodoId = undefined;
    activeDeliveryJobId = undefined;
    activeDeliveryTitle = undefined;
    activeDeliveryObjective = undefined;
    patchedObjectiveElement = undefined;
    patchedObjectiveText = undefined;
    delete window.__harthmereMuckRakePresentationHotfix;
    if (window.__harthmereJobsBoardClientHotfixCleanup === cleanup) {
      delete window.__harthmereJobsBoardClientHotfixCleanup;
    }
  };
  window.__harthmereJobsBoardClientHotfixCleanup = cleanup;
  window.__biomesGlitchMutableHotfix?.registerCleanup?.(cleanup);
})();
