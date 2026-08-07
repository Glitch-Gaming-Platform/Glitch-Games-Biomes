(() => {
  const VERSION = "harthmere-grove-quest-guidance-hotfix-2026-08-07-v12";
  if (window.__harthmereGroveExactMapPinHotfixVersion === VERSION) return;

  const nativeQuestIds = {
    fountain_buttons_first: "8760000000000002",
    painted_path_language: "8760000000000003",
    road_ready_bag_check: "8760000000000004",
    tools_before_treasure: "8760000000000005",
    safe_sparring_not_pvp: "8760000000000006",
    ready_check_at_fountain: "8760000000000007",
    lost_found_and_mail: "8760000000000008",
    fountain_chat_channels: "8760000000000026",
    fountain_food_keeps_you_moving: "8760000000000027",
    fountain_first_aid_before_road: "8760000000000028",
    fountain_hotbar_and_dropping: "8760000000000029",
    fountain_first_recipe_torch: "8760000000000030",
    fountain_trade_table_promises: "8760000000000031",
    grove_road_graduation: "8760000000000032",
    intro_alexis_lovely_locks: "8760000000000033",
    intro_luis_crossroads_cart: "8760000000000034",
    intro_jane_mosslawn_edge: "8760000000000035",
    "read-the-jobs-board": "8760000000000000",
    building_system_intro_talk_to_mira: "8760000000000001",
    road_signs_and_small_lies: "8760000000000009",
    build_repair_claim_lesson: "8760000000000010",
    guilds_are_promises: "8760000000000011",
    color_that_still_points_home: "8760000000000012",
    cart_that_forgot_its_wheel: "8760000000000013",
    road_ready_not_fancy: "8760000000000014",
    moss_that_went_quiet: "8760000000000015",
    songline_under_the_lawn: "8760000000000016",
    sticky_medicine: "8760000000000017",
    cove_keeps_pictures: "8760000000000018",
    coops_key_hen: "8760000000000019",
    tower_with_a_headache: "8760000000000020",
    letter_for_the_north_gate: "8760000000000021",
    antlers_for_the_watch: "8760000000000022",
    toll_ledger_problem: "8760000000000023",
    samples_for_the_chapel: "8760000000000024",
    tone_beneath_the_road: "8760000000000025",
    econ_billys_lost_lunch_pail: "8760000000000036",
    econ_billys_roof_patch_run: "8760000000000037",
    econ_billys_map_pin_run: "8760000000000038",
    econ_merls_coin_sorting: "8760000000000039",
    econ_merls_vault_inventory: "8760000000000040",
    econ_gus_fresh_loaves_to_fountain: "8760000000000041",
    econ_gus_grain_run: "8760000000000042",
    econ_fern_water_the_sprout_beds: "8760000000000043",
    econ_fern_berry_patch_harvest: "8760000000000044",
    econ_kit_letters_around_fountain: "8760000000000045",
    econ_kit_heavy_parcel_to_crossroads: "8760000000000046",
    econ_mel_bench_repair: "8760000000000047",
    econ_mel_broken_hinge_hunt: "8760000000000048",
    econ_rin_mushroom_pickup: "8760000000000049",
    econ_carlo_festival_skewers: "8760000000000050",
  };
  const storageKey = "biomes_ui_active_map_pin";
  const eventName = "biomes-ui-active-map-pin";
  const questStateKey = "biomes.localDev.snapshotGroveQuestState";
  const questStateEvent = "biomes:local-dev-snapshot-grove-quest-state";
  const questSyncEvent = "biomes:snapshot-grove-live-quest-state-sync";
  const tutorHighlightEvent =
    "biomes:snapshot-grove-tutor-hud-highlights";
  const contextualCardSelector =
    "[data-harthmere-grove-contextual-hotfix='true']";
  const objectiveHudSelector =
    "[data-harthmere-grove-objective-hotfix='true']";
  const jobsOfferSelector =
    "[data-harthmere-grove-jobs-offer-hotfix='true']";
  const completionAcknowledgementSelector =
    "[data-harthmere-grove-completion-acknowledgement-hotfix='true']";
  const tutorPromptSelector =
    "[data-harthmere-grove-tutor-hotfix='true']";
  const sourceTutorPromptSelector =
    "[data-snapshot-grove-tutor-prompt='visible']";
  const worldObjectPromptSelector =
    "[data-harthmere-grove-world-object-hotfix='true']";
  const docSamplePositions = {
    doc_clean_root_sample: [503, 71, -148],
    doc_mucked_root_sample: [522, 71, -162],
    doc_sealed_muck_sample: [505, 71, -160],
  };
  const originalSetItem = Storage.prototype.setItem;
  const originalRemoveItem = Storage.prototype.removeItem;
  const originalDispatchEvent = EventTarget.prototype.dispatchEvent;
  const originalFetch = window.fetch?.bind?.(window);
  let lastExactPin;
  let lastTalkBridgeKey;
  let talkBridgeCandidateKey;
  let talkBridgeCandidateSince = 0;
  let hiddenSourceTutorPrompt;
  let hiddenSourceTutorPromptDisplay = "";
  const cloudQuestRepairInFlight = new Set();
  const cloudQuestRepairDone = new Set();
  const cloudQuestRepairRetryAt = new Map();

  const parse = (value) => {
    try {
      return value ? JSON.parse(value) : undefined;
    } catch {
      return undefined;
    }
  };
  const shouldPreserve = (current, next) => {
    const nextIsNativeQuest = String(next?.markerId ?? "").startsWith(
      "native_quest:"
    );
    return Boolean(
      current?.ownerStepId &&
      !String(current.markerId ?? "").startsWith("native_quest:") &&
      nativeQuestIds[current.ownerQuestId] &&
      nextIsNativeQuest
    );
  };
  const currentPin = () => parse(localStorage.getItem(storageKey));
  const activeGroveQuest = () => {
    const state = parse(localStorage.getItem(questStateKey));
    const questId = String(state?.activeQuestId ?? "");
    return nativeQuestIds[questId] &&
      !state?.completedQuestIds?.includes?.(questId)
      ? questId
      : undefined;
  };
  const shouldBlockNative = (next) =>
    Boolean(
      activeGroveQuest() &&
      String(next?.markerId ?? "").startsWith("native_quest:")
    );

  const activeGroveContext = () => {
    const questId = activeGroveQuest();
    const runtime = window.__snapshotGrove;
    const state = parse(localStorage.getItem(questStateKey));
    const quest = runtime?.quests?.find?.((candidate) => candidate.id === questId);
    if (!questId || !quest || !state) return undefined;
    const indexed = Number(state.objectiveIndexByQuestId?.[questId]);
    const objectiveIndex = Number.isFinite(indexed)
      ? Math.max(0, Math.trunc(indexed))
      : Math.max(0, Math.trunc(Number(state.activeObjectiveIndex) || 0));
    const markerId = quest.markerIds?.[objectiveIndex];
    const marker = runtime.landmarks?.find?.(
      (candidate) => candidate.id === markerId
    );
    const hotfixPosition = docSamplePositions[markerId];
    if (marker && hotfixPosition) {
      marker.position = [...hotfixPosition];
      marker.worldPosition = [...hotfixPosition];
    }
    const chapelStone = runtime.landmarks?.find?.(
      (candidate) => candidate.id === "harthmere_chapel_stone"
    );
    if (chapelStone) chapelStone.npcId = "father_aldren_mell";
    return {
      state,
      quest,
      questId,
      objectiveIndex,
      trigger: quest.triggers?.[objectiveIndex],
      markerId,
      marker,
    };
  };

  const exactPinForActiveQuest = () => {
    const context = activeGroveContext();
    if (!context) return undefined;
    if (
      lastExactPin?.ownerQuestId === context.questId &&
      !String(lastExactPin.markerId ?? "").startsWith("native_quest:")
    ) {
      return lastExactPin;
    }
    const { marker, markerId, questId, objectiveIndex } = context;
    const position = marker?.worldPosition ?? marker?.position;
    if (
      !markerId ||
      !Array.isArray(position) ||
      position.length < 3 ||
      !position.every((value) => Number.isFinite(Number(value)))
    ) {
      return undefined;
    }
    return {
      markerId,
      label: marker?.label ?? markerId,
      kind: marker?.kind ?? "objective",
      worldPosition: position.slice(0, 3).map(Number),
      description: `${marker?.area ?? "The Grove"} - ${
        marker?.kind ?? "objective"
      }`,
      ownerQuestId: questId,
      ownerStepId: `${questId}:${objectiveIndex}`,
      setAtMs: Date.now(),
    };
  };

  const restoreExactPin = () => {
    const activeQuestId = activeGroveQuest();
    if (!activeQuestId) return;
    const current = currentPin();
    if (
      current &&
      !String(current.markerId ?? "").startsWith("native_quest:")
    ) {
      if (current.ownerQuestId === activeQuestId) lastExactPin = current;
      return;
    }
    const exact = exactPinForActiveQuest();
    if (!exact) return;
    originalSetItem.call(localStorage, storageKey, JSON.stringify(exact));
    originalDispatchEvent.call(
      window,
      new CustomEvent(eventName, { detail: exact })
    );
  };

  const contextualButtonLabels = {
    choice: "Pick practice answer",
    collect: "Pick up marked item",
    craft: "Craft practice item",
    photo_post: "Take practice photo",
    item_grant: "Take practice item",
    status_check: "Confirm ready state",
    item_use: "Use practice item",
    item_update: "Update practice item",
    escort: "Guide practice target",
    carry: "Carry practice load",
    interact: "Use marked object",
  };

  const playerDistanceTo = (position) => {
    const player = window.clientContext?.resources?.get?.(
      "/scene/local_player"
    )?.player;
    const playerPosition = player?.position;
    if (!Array.isArray(position) || !Array.isArray(playerPosition)) {
      return undefined;
    }
    return Math.hypot(
      Number(position[0]) - Number(playerPosition[0]),
      Number(position[2]) - Number(playerPosition[2])
    );
  };

  const removeContextualCard = () =>
    document.querySelector(contextualCardSelector)?.remove();
  const removeTutorPrompt = () =>
    document.querySelector(tutorPromptSelector)?.remove();
  const restoreSourceTutorPrompt = () => {
    if (!hiddenSourceTutorPrompt) return;
    hiddenSourceTutorPrompt.style.display = hiddenSourceTutorPromptDisplay;
    hiddenSourceTutorPrompt = undefined;
    hiddenSourceTutorPromptDisplay = "";
  };
  const hideSourceTutorPrompt = (prompt) => {
    if (!prompt || prompt === hiddenSourceTutorPrompt) return;
    restoreSourceTutorPrompt();
    hiddenSourceTutorPrompt = prompt;
    hiddenSourceTutorPromptDisplay = prompt.style.display;
    prompt.style.display = "none";
  };
  const removeWorldObjectPrompt = () =>
    document.querySelector(worldObjectPromptSelector)?.remove();
  let hiddenNativeObjectiveHud;
  let hiddenNativeObjectiveHudDisplay = "";

  const removeObjectiveHud = () => {
    document.querySelector(objectiveHudSelector)?.remove();
    if (hiddenNativeObjectiveHud) {
      hiddenNativeObjectiveHud.style.display = hiddenNativeObjectiveHudDisplay;
      hiddenNativeObjectiveHud = undefined;
      hiddenNativeObjectiveHudDisplay = "";
    }
  };

  const refreshObjectiveHud = () => {
    const context = activeGroveContext();
    if (!context) {
      removeObjectiveHud();
      return;
    }
    const nativeHud = document.querySelector(
      ".biomes-ui-current-objective-hud"
    );
    if (nativeHud && nativeHud !== hiddenNativeObjectiveHud) {
      if (hiddenNativeObjectiveHud) {
        hiddenNativeObjectiveHud.style.display = hiddenNativeObjectiveHudDisplay;
      }
      hiddenNativeObjectiveHud = nativeHud;
      hiddenNativeObjectiveHudDisplay = nativeHud.style.display;
      nativeHud.style.display = "none";
    }
    let card = document.querySelector(objectiveHudSelector);
    if (!card) {
      card = document.createElement("aside");
      card.dataset.harthmereGroveObjectiveHotfix = "true";
      card.setAttribute?.("aria-label", "Current Grove objective");
      card.style.cssText =
        "position:fixed;right:18px;bottom:110px;z-index:45;width:min(260px,calc(100vw - 36px));border:1px solid rgba(190,242,100,.45);background:rgba(8,18,12,.94);border-radius:10px;padding:10px 12px;color:white;box-shadow:0 8px 24px rgba(0,0,0,.35);pointer-events:none;";
      card.innerHTML =
        "<div data-role='objective-label' style='color:#d9f99d;font-size:9px;font-weight:900;letter-spacing:.12em;text-transform:uppercase'>Grove objective</div>" +
        "<div data-role='objective-copy' style='margin-top:4px;font-size:12px;font-weight:750;line-height:1.35'></div>";
      document.body?.append?.(card);
    }
    const copy = card.querySelector("[data-role='objective-copy']");
    const nextCopy =
      context.quest.objectives?.[context.objectiveIndex] ?? context.quest.title;
    if (copy && copy.textContent !== nextCopy) copy.textContent = nextCopy;
  };

  const refreshDocSampleWorldObjects = () => {
    const scene = window.clientContext?.rendererController?.scenes?.three;
    if (!scene?.traverse) return;
    scene.traverse((object) => {
      const markerId = object?.userData?.harthmereQuestObjectMarkerId;
      const position = docSamplePositions[markerId];
      if (!position || !object.position?.set) return;
      // Quest-object groups sit at feet/ground Y, while their map pins hover
      // one block above. Moving the real rendered/raycast group here keeps the
      // r2 warm candidate aligned with the back-ported authored positions.
      object.position.set(position[0], position[1] - 1, position[2]);
      object.updateMatrixWorld?.(true);
    });
  };

  const tutorTargetForContext = (context) => {
    if (!context || context.trigger !== "open_tab") return undefined;
    const text = String(
      context.quest.objectives?.[context.objectiveIndex] ?? ""
    ).toLowerCase();
    if (/mail|storage|recovery|inbox/.test(text)) {
      return { label: "Mail", tab: "inbox", key: "KeyV" };
    }
    if (/map|marker/.test(text)) {
      return { label: "Map", tab: "map", key: "KeyM" };
    }
    if (/inventory|bag|clothing|hotbar/.test(text)) {
      return { label: "Bag", tab: "inventory", key: "KeyI" };
    }
    if (/quest|journal/.test(text)) {
      return { label: "Quests", tab: "quests", key: "KeyJ" };
    }
    if (/recipe|craft/.test(text)) {
      return { label: "Craft", tab: "crafting", key: "KeyR" };
    }
    if (/chat|say|whisper/.test(text)) {
      return { label: "Chat", tab: "chat" };
    }
    return undefined;
  };

  const refreshTutorPrompt = () => {
    const context = activeGroveContext();
    const target = tutorTargetForContext(context);
    const sourcePrompt = document.querySelector(sourceTutorPromptSelector);
    if (!target) {
      removeTutorPrompt();
      // The retained r2 build derived nav pulses from words like "sample" and
      // "item", so collect objectives left a stale Open Bag prompt covering
      // the screen. A world pickup has no HUD tab to open.
      hideSourceTutorPrompt(sourcePrompt);
      return;
    }
    restoreSourceTutorPrompt();
    const sourceTarget = sourcePrompt?.querySelector?.(
      `[data-snapshot-grove-tutor-target="${target.label}"]`
    );
    if (sourceTarget) {
      removeTutorPrompt();
      return;
    }
    if (sourcePrompt) hideSourceTutorPrompt(sourcePrompt);
    let prompt = document.querySelector(tutorPromptSelector);
    if (prompt?.dataset?.target === target.label) return;
    prompt?.remove();
    prompt = document.createElement("aside");
    prompt.dataset.harthmereGroveTutorHotfix = "true";
    prompt.dataset.target = target.label;
    prompt.setAttribute?.("aria-label", "Grove tutorial HUD guidance");
    prompt.style.cssText =
      "position:fixed;right:18px;bottom:208px;z-index:1080;width:min(250px,calc(100vw - 36px));padding:10px;border:1px solid rgba(217,249,157,.8);border-radius:12px;background:rgba(8,18,12,.96);color:white;box-shadow:0 0 28px rgba(190,242,100,.45);display:grid;gap:8px;pointer-events:auto;";
    const eyebrow = document.createElement("div");
    eyebrow.textContent = "Open this next";
    eyebrow.style.cssText =
      "color:#d9f99d;font-size:10px;font-weight:900;letter-spacing:.13em;text-transform:uppercase;";
    const button = document.createElement("button");
    button.type = "button";
    button.setAttribute?.("aria-label", `Tutorial target: ${target.label}`);
    button.dataset.snapshotGroveTutorTarget = target.label;
    button.textContent = `Open ${target.label}${target.key ? ` (${target.key.slice(-1)})` : ""}`;
    button.style.cssText =
      "border:1px solid rgba(217,249,157,.9);border-radius:9px;background:rgba(190,242,100,.28);color:#f7fee7;padding:10px 12px;text-align:left;font-size:13px;font-weight:850;cursor:pointer;box-shadow:0 0 20px rgba(190,242,100,.75);animation:harthmereGroveTutorPulse 1.15s ease-in-out infinite;";
    button.addEventListener("click", () => {
      if (target.tab === "chat") {
        window.dispatchEvent(
          new CustomEvent("biomes:snapshot-grove-tutor-chat-panel-open")
        );
      } else if (target.key) {
        document.dispatchEvent(
          new KeyboardEvent("keydown", {
            code: target.key,
            key: target.key.slice(-1).toLowerCase(),
            bubbles: true,
          })
        );
      }
      window.clientContext?.gardenHose?.publish?.({
        kind: "open_tab",
        tab: target.tab,
        questId: context.questId,
        objectiveIndex: context.objectiveIndex,
        markerId: context.markerId,
      });
    });
    prompt.append?.(eyebrow);
    prompt.append?.(button);
    if (!document.getElementById?.("harthmere-grove-tutor-hotfix-style")) {
      const style = document.createElement("style");
      style.id = "harthmere-grove-tutor-hotfix-style";
      style.textContent =
        "@keyframes harthmereGroveTutorPulse{0%,100%{transform:translateY(0);box-shadow:0 0 14px rgba(190,242,100,.55)}50%{transform:translateY(-2px);box-shadow:0 0 30px rgba(190,242,100,1)}}";
      document.head?.append?.(style);
    }
    document.body?.append?.(prompt);
  };

  const worldObjectTriggers = new Set(["collect", "item_grant", "interact"]);
  const worldObjectInteractionForContext = (context) => {
    if (context.trigger === "collect" || context.trigger === "item_grant") {
      return { kind: "gather", title: "Gather" };
    }
    const label = String(context.marker?.label ?? "").toLowerCase();
    if (/campfire|camp fire|cooking fire|cookpot|cook pot|oven|stove/.test(label)) {
      return { kind: "cook", title: "Cook" };
    }
    if (/table|desk|pot\b/.test(label)) {
      return { kind: "use", title: "Use" };
    }
    if (/stone|sample|satchel|office|tower|corner/.test(label)) {
      return { kind: "inspect", title: "Inspect" };
    }
    if (/board|post|ledger|note|sign/.test(label)) {
      return { kind: "read", title: "Read" };
    }
    return { kind: "practice", title: "Use" };
  };
  const worldObjectActionLabel = (trigger, label) => {
    switch (trigger) {
      case "collect":
        return `Pick Up ${label}`;
      case "item_grant":
        return `Take ${label}`;
      default:
        return `Use ${label}`;
    }
  };
  const matchingNativeInspectable = (context) => {
    const inspectable = window.clientContext?.resources
      ?.get?.("/overlays")
      ?.get?.("inspectable");
    return Boolean(
      inspectable &&
        (inspectable.objectId === context.markerId ||
          inspectable.label === context.marker?.label)
    );
  };
  const dispatchLiveModeResponse = (body) => {
    window.dispatchEvent(new Event("biomes:harthmere-inventory-changed"));
    const inventoryLootState =
      body?.inventoryLootState ?? body?.snapshots?.inventoryLootState;
    if (inventoryLootState) {
      for (const type of [
        "biomes:harthmere-business-inventory-loot-updated",
        "biomes:harthmere-live-inventory-sync",
      ]) {
        window.dispatchEvent(
          new CustomEvent(type, { detail: { inventoryLootState, body } })
        );
      }
    }
  };
  const publishWorldObjectAction = async () => {
    const context = activeGroveContext();
    if (!context || !worldObjectTriggers.has(context.trigger)) return;
    const position = context.marker?.worldPosition ?? context.marker?.position;
    const distance = playerDistanceTo(position);
    if (distance === undefined || distance > 6.5) return;
    const interaction = worldObjectInteractionForContext(context);
    let serverAuthoritativePickup = false;
    if (interaction.kind !== "cook") {
      const requestId = `grove_hotfix_world_object_${Date.now()}_${Math.random()
        .toString(36)
        .slice(2)}`;
      const response = await fetch("/api/harthmere/live_mode", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
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
            objectId: context.markerId,
            label: context.marker.label,
            interactionKind: interaction.kind,
          },
          clientClaims: {},
        }),
      });
      const body = await response.json().catch(() => undefined);
      const warnings = body?.backendMutation?.warnings ?? [];
      if (
        !response.ok ||
        body?.ok === false ||
        warnings.some?.((warning) =>
          String(warning).startsWith("world_object_rejected:")
        )
      ) {
        throw new Error(
          warnings.find?.((warning) =>
            String(warning).startsWith("world_object_rejected:")
          ) ?? "World object interaction failed"
        );
      }
      dispatchLiveModeResponse(body);
      serverAuthoritativePickup = interaction.kind === "gather";
    }
    window.dispatchEvent(
      new CustomEvent("biomes:harthmere-world-object-interaction", {
        detail: {
          objectId: context.markerId,
          label: context.marker.label,
          kind: interaction.kind,
          title: interaction.title,
          serverAuthoritativePickup,
        },
      })
    );
    // Retained no-build clients predate the shared world-object adapter for a
    // few authored trigger kinds. Mirror the exact GardenHose event shape only
    // after the signed receipt succeeds; quest/objective/marker context keeps
    // it from satisfying any neighboring lesson.
    const exactLessonEvent =
      context.trigger === "item_grant"
        ? {
            kind: "inventory_change",
            questId: context.questId,
            objectiveIndex: context.objectiveIndex,
            trigger: context.trigger,
            markerId: context.markerId,
          }
        : context.trigger === "interact"
          ? {
              kind: "inspect_frame",
              questId: context.questId,
              objectiveIndex: context.objectiveIndex,
              trigger: context.trigger,
              markerId: context.markerId,
            }
          : undefined;
    if (exactLessonEvent) {
      window.clientContext?.gardenHose?.publish?.(exactLessonEvent);
    }
    // The signed care-loop receipt above owns the world mutation. Publish the
    // matching GardenHose lesson evidence as well so native Challenges and the
    // local Grove runtime advance from the same authenticated interaction.
    window.clientContext?.gardenHose?.publish?.({
      kind: "snapshot_grove_practice_action",
      questId: context.questId,
      objectiveIndex: context.objectiveIndex,
      trigger: context.trigger,
      markerId: context.markerId,
    });
  };
  const refreshWorldObjectPrompt = () => {
    const context = activeGroveContext();
    const markerPosition =
      context?.marker?.worldPosition ?? context?.marker?.position;
    const distance = playerDistanceTo(markerPosition);
    if (
      !context ||
      !worldObjectTriggers.has(context.trigger) ||
      !context.markerId ||
      !context.marker?.label ||
      distance === undefined ||
      distance > 6.5 ||
      matchingNativeInspectable(context)
    ) {
      removeWorldObjectPrompt();
      return;
    }
    let prompt = document.querySelector(worldObjectPromptSelector);
    if (
      prompt?.dataset?.markerId === context.markerId &&
      prompt?.dataset?.objectiveIndex === String(context.objectiveIndex)
    ) {
      return;
    }
    prompt?.remove();
    prompt = document.createElement("button");
    prompt.type = "button";
    prompt.className = "inspect-overlay";
    prompt.dataset.harthmereGroveWorldObjectHotfix = "true";
    prompt.dataset.markerId = context.markerId;
    prompt.dataset.objectiveIndex = String(context.objectiveIndex);
    prompt.dataset.worldInteractionCandidateId = context.markerId;
    prompt.dataset.worldInteractionPriority = "quest";
    prompt.dataset.worldInteractionOwner = context.questId;
    prompt.setAttribute?.("aria-label", `Interact with ${context.marker.label}`);
    prompt.textContent = `F ${worldObjectActionLabel(
      context.trigger,
      context.marker.label
    )}`;
    prompt.style.cssText =
      "position:fixed;left:50%;bottom:150px;transform:translateX(-50%);z-index:1075;border:1px solid rgba(255,255,255,.75);border-radius:8px;background:rgba(8,13,24,.92);color:white;padding:8px 12px;font-size:13px;font-weight:850;letter-spacing:.01em;box-shadow:0 6px 22px rgba(0,0,0,.45);cursor:pointer;opacity:1;visibility:visible;display:block;";
    prompt.addEventListener("click", () => {
      prompt.disabled = true;
      publishWorldObjectAction().catch((error) => {
        prompt.disabled = false;
        prompt.textContent = String(error?.message ?? error);
      });
    });
    document.body?.append?.(prompt);
  };

  const onWorldObjectKeyDown = (event) => {
    const context = activeGroveContext();
    const hasExactHotfixPrompt = Boolean(
      document.querySelector(worldObjectPromptSelector)
    );
    const hasMatchingNativePrompt = Boolean(
      context && matchingNativeInspectable(context)
    );
    if (
      event?.code !== "KeyF" ||
      !context ||
      !worldObjectTriggers.has(context.trigger) ||
      (!hasExactHotfixPrompt && !hasMatchingNativePrompt)
    ) {
      return;
    }
    event.preventDefault?.();
    event.stopPropagation?.();
    event.stopImmediatePropagation?.();
    publishWorldObjectAction().catch(() => undefined);
  };
  window.addEventListener("keydown", onWorldObjectKeyDown, true);

  const postCloudQuestProjection = async (
    runtimeQuest,
    { completed, progress, objectiveIndex, evidenceTrigger, reason }
  ) => {
    const stepIndex = completed
      ? Math.max(0, runtimeQuest.objectives.length - 1)
      : Math.max(
          0,
          Math.min(runtimeQuest.objectives.length - 1, progress - 1)
        );
    const requestId = `grove_hotfix_projection_${runtimeQuest.id}_${
      completed ? "complete" : progress
    }_${Date.now()}_${Math.random().toString(36).slice(2)}`;
    const response = await fetch("/api/harthmere/live_mode", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        clientSentAtMs: Date.now(),
        actionKind: "request_quest_state_update",
        subsystem: "quest",
        actorEntityVersion: 1,
        zoneId: "the_grove",
        payload: {
          questId: runtimeQuest.id,
          source: "snapshot_grove",
          title: runtimeQuest.title,
          completed,
          stepId: `${runtimeQuest.id}:${stepIndex}:${
            runtimeQuest.triggers?.[stepIndex] ?? "step"
          }`,
          progress,
          objectiveIndex,
          evidenceTrigger,
          reason,
        },
        clientClaims: {},
      }),
    });
    const body = await response.json().catch(() => undefined);
    const warnings = body?.backendMutation?.warnings ?? [];
    if (
      !response.ok ||
      body?.ok === false ||
      warnings.some?.((warning) =>
        String(warning).startsWith("snapshot_grove_quest_rejected:")
      )
    ) {
      throw new Error(
        warnings.find?.((warning) =>
          String(warning).startsWith("snapshot_grove_quest_rejected:")
        ) ?? "Grove Cloud Save projection repair failed"
      );
    }
    if (body?.questState) {
      window.dispatchEvent(
        new CustomEvent(questSyncEvent, {
          detail: { questState: body.questState },
        })
      );
    }
    return body?.questState;
  };

  const repairCloudQuestProjection = async (
    questId,
    localObjectiveIndex,
    completed
  ) => {
    const signature = `${questId}:${completed ? "complete" : localObjectiveIndex}`;
    if (
      cloudQuestRepairDone.has(signature) ||
      cloudQuestRepairInFlight.has(signature) ||
      Date.now() < Number(cloudQuestRepairRetryAt.get(signature) ?? 0)
    ) {
      return;
    }
    const runtimeQuest = window.__snapshotGrove?.quests?.find?.(
      (quest) => quest.id === questId
    );
    if (!runtimeQuest) return;
    cloudQuestRepairInFlight.add(signature);
    try {
      const stateResponse = await fetch(
        "/api/harthmere/live_mode_quest_state",
        { credentials: "same-origin", cache: "no-store" }
      );
      const stateBody = await stateResponse.json().catch(() => undefined);
      let live = stateBody?.questState;
      if (!live) return;
      if (live.completed?.[questId]) {
        cloudQuestRepairDone.add(signature);
        return;
      }

      let active = live.active?.[questId];
      if (!active) {
        live =
          (await postCloudQuestProjection(runtimeQuest, {
            completed: false,
            progress: 1,
            objectiveIndex: undefined,
            evidenceTrigger: undefined,
            reason: "accepted",
          })) ?? live;
        active = live.active?.[questId] ?? { progress: 1 };
      }

      const targetProgress = completed
        ? runtimeQuest.objectives.length
        : Math.max(
            1,
            Math.min(
              runtimeQuest.objectives.length,
              Math.trunc(Number(localObjectiveIndex) || 0) + 1
            )
          );
      let liveProgress = Math.max(1, Math.trunc(Number(active.progress) || 1));
      while (liveProgress < targetProgress) {
        const completedObjectiveIndex = liveProgress - 1;
        const requestedProgress = liveProgress + 1;
        live =
          (await postCloudQuestProjection(runtimeQuest, {
            completed: false,
            progress: requestedProgress,
            objectiveIndex: completedObjectiveIndex,
            evidenceTrigger:
              runtimeQuest.triggers?.[completedObjectiveIndex],
            reason: "hotfix_progress_repair",
          })) ?? live;
        liveProgress = Math.max(
          requestedProgress,
          Math.trunc(Number(live.active?.[questId]?.progress) || 0)
        );
      }

      if (completed && !live.completed?.[questId]) {
        const finalObjectiveIndex = Math.max(
          0,
          runtimeQuest.objectives.length - 1
        );
        live =
          (await postCloudQuestProjection(runtimeQuest, {
            completed: true,
            progress: runtimeQuest.objectives.length,
            objectiveIndex: finalObjectiveIndex,
            evidenceTrigger: runtimeQuest.triggers?.[finalObjectiveIndex],
            reason: "hotfix_completion_repair",
          })) ?? live;
      }
      if (completed ? live.completed?.[questId] : liveProgress >= targetProgress) {
        cloudQuestRepairDone.add(signature);
        cloudQuestRepairRetryAt.delete(signature);
      }
    } catch (error) {
      cloudQuestRepairRetryAt.set(signature, Date.now() + 5_000);
      throw error;
    } finally {
      cloudQuestRepairInFlight.delete(signature);
    }
  };

  const refreshCloudQuestRepairs = () => {
    const state = parse(localStorage.getItem(questStateKey));
    for (const questId of state?.completedQuestIds ?? []) {
      repairCloudQuestProjection(questId, Number.MAX_SAFE_INTEGER, true).catch(
        () => undefined
      );
    }
    const activeQuestId = String(state?.activeQuestId ?? "");
    if (
      nativeQuestIds[activeQuestId] &&
      state?.acceptedQuestIds?.includes?.(activeQuestId) &&
      !state?.completedQuestIds?.includes?.(activeQuestId)
    ) {
      const localObjectiveIndex = Number(
        state.objectiveIndexByQuestId?.[activeQuestId] ??
          state.activeObjectiveIndex ??
          0
      );
      repairCloudQuestProjection(
        activeQuestId,
        localObjectiveIndex,
        false
      ).catch(() => undefined);
    }
  };

  const refreshTalkNpcBridge = () => {
    const context = activeGroveContext();
    if (
      !context ||
      context.trigger !== "talk_npc" ||
      context.objectiveIndex >= context.quest.objectives.length - 1
    ) {
      lastTalkBridgeKey = undefined;
      talkBridgeCandidateKey = undefined;
      talkBridgeCandidateSince = 0;
      return;
    }
    const modal = window.clientContext?.resources?.get?.("/game_modal");
    if (modal?.kind !== "talk_to_npc") {
      lastTalkBridgeKey = undefined;
      talkBridgeCandidateKey = undefined;
      talkBridgeCandidateSince = 0;
      return;
    }
    // Chapter 1 owns normal NPC copy only while its exact target is current.
    // The source build exposes that projection directly; the retained r2
    // candidate also exposes the supplier objective in the mounted prompt.
    const chapter1 = window.__chapter1ObjectiveWorldProjection;
    const chapter1OwnsModal = Boolean(
      chapter1 &&
        Number(chapter1.targetEntityId) === Number(modal.talkingToNPCId) &&
        ["talk_npc", "dialogue_choice"].includes(chapter1.trigger)
    );
    const chapter1SupplierActive = Boolean(
      document.querySelector(
        "[data-chapter1-native-objective='meet_the_suppliers']"
      )
    );
    // Chapter 1 still owns the visible words for its exact NPC/phase. This
    // bridge publishes only the overlapping Grove talk evidence in the
    // background, so a connector handoff can progress without replacing the
    // Chapter 1 dialogue the player is supposed to read.
    const expectedNpcId = context.marker?.npcId;
    if (!expectedNpcId) return;
    const grounding = window.__snapshotGrove?.dumpGrounding?.() ?? [];
    const expectedEntityIds = grounding
      .filter?.((row) => row.id === expectedNpcId)
      .flatMap?.((row) => [row.seededEntityId, row.entityId].filter(Boolean));
    if (
      expectedEntityIds?.length &&
      !expectedEntityIds.some(
        (entityId) => Number(entityId) === Number(modal.talkingToNPCId)
      )
    ) {
      return;
    }
    const key = `${context.questId}:${context.objectiveIndex}:${modal.talkingToNPCId}`;
    if (key === lastTalkBridgeKey) return;
    if (key !== talkBridgeCandidateKey) {
      talkBridgeCandidateKey = key;
      talkBridgeCandidateSince = Date.now();
      return;
    }
    // Give TalkToNPCScreen's Chapter 1 ownership effect time to close the
    // stock modal before bridging a Grove handoff intercepted by native text.
    const bridgeDelayMs = chapter1OwnsModal || chapter1SupplierActive ? 900 : 600;
    if (Date.now() - talkBridgeCandidateSince < bridgeDelayMs) return;
    lastTalkBridgeKey = key;
    talkBridgeCandidateKey = undefined;
    talkBridgeCandidateSince = 0;
    window.clientContext?.gardenHose?.publish?.({
      kind: "talk_npc",
      npcId: expectedNpcId,
      questId: context.questId,
      objectiveIndex: context.objectiveIndex,
      markerId: context.markerId,
    });
  };

  const nativeInventoryCount = (nativeId) => {
    const userId = window.clientContext?.userId;
    const inventory = userId
      ? window.clientContext?.resources?.get?.("/ecs/c/inventory", userId)
      : undefined;
    let count = 0;
    for (const stack of [
      ...(inventory?.items ?? []),
      ...(inventory?.hotbar ?? []),
    ]) {
      if (String(stack?.item?.id) === String(nativeId)) {
        count += Number(stack.count ?? 0);
      }
    }
    return Math.max(0, count);
  };

  if (originalFetch) {
    window.fetch = async (...args) => {
      const response = await originalFetch(...args);
      const url = String(args[0]?.url ?? args[0] ?? "");
      if (
        !url.includes("/api/harthmere/live_mode_farming_food_state") ||
        !response.ok
      ) {
        return response;
      }
      const body = await response.clone().json().catch(() => undefined);
      const farmingFoodState = body?.farmingFoodState;
      if (!farmingFoodState) return response;
      let changed = false;
      const nowMs = Date.now();
      for (const station of farmingFoodState.cookingStations ?? []) {
        for (const job of station.jobs ?? []) {
          if (
            job?.status === "cooking" &&
            Number(job.readyAtMs) <= nowMs
          ) {
            job.status = "ready";
            job.progress = 1;
            changed = true;
          }
        }
      }
      if (changed) {
        farmingFoodState.updatedAtMs = Math.max(
          Number(farmingFoodState.updatedAtMs) || 0,
          nowMs
        );
      }
      const nativeIngredients = nativeInventoryCount("8690000000000010");
      if (nativeIngredients > 0) {
        farmingFoodState.inventory = {
          ...(farmingFoodState.inventory ?? {}),
          grove_festival_skewer_ingredients: nativeIngredients,
        };
        changed = true;
      }
      if (!changed) return response;
      return new Response(JSON.stringify(body), {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    };
  }

  const removeJobsOffer = () =>
    document.querySelector(jobsOfferSelector)?.remove();

  const removeCompletionAcknowledgement = () =>
    document.querySelector(completionAcknowledgementSelector)?.remove();

  const refreshCompletionAcknowledgement = () => {
    const state = parse(localStorage.getItem(questStateKey));
    const questId = [...(state?.completedQuestIds ?? [])]
      .reverse()
      .find((candidate) => candidate !== "read-the-jobs-board");
    const runtimeQuest = window.__snapshotGrove?.quests?.find?.(
      (quest) => quest.id === questId
    );
    const modal = window.clientContext?.resources?.get?.("/game_modal");
    if (!runtimeQuest || modal?.kind !== "talk_to_npc") {
      removeCompletionAcknowledgement();
      return;
    }

    const grounding = window.__snapshotGrove?.dumpGrounding?.() ?? [];
    const giverEntityIds = grounding
      .filter?.((row) => row.id === runtimeQuest.giverNpcId)
      .flatMap?.((row) => [row.seededEntityId, row.entityId].filter(Boolean));
    if (
      !giverEntityIds?.length ||
      !giverEntityIds.some(
        (entityId) => Number(entityId) === Number(modal.talkingToNPCId)
      )
    ) {
      removeCompletionAcknowledgement();
      return;
    }

    const chapter1 = window.__chapter1ObjectiveWorldProjection;
    const chapter1OwnsModal = Boolean(
      chapter1 &&
        Number(chapter1.targetEntityId) === Number(modal.talkingToNPCId) &&
        ["talk_npc", "dialogue_choice"].includes(chapter1.trigger)
    );
    if (chapter1OwnsModal) {
      removeCompletionAcknowledgement();
      return;
    }

    const acknowledgement = `${runtimeQuest.title} is handled.`;
    let panel = document.querySelector(completionAcknowledgementSelector);
    if (panel?.dataset?.questId === runtimeQuest.id) return;
    panel?.remove();
    panel = document.createElement("div");
    panel.dataset.harthmereGroveCompletionAcknowledgementHotfix = "true";
    panel.dataset.questId = runtimeQuest.id;
    panel.setAttribute?.("role", "status");
    panel.style.cssText =
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1100;width:min(430px,calc(100vw - 32px));border:1px solid rgba(217,249,157,.8);background:rgba(20,13,48,.97);border-radius:10px;padding:11px 13px;color:white;font-size:13px;font-weight:750;line-height:1.35;box-shadow:0 8px 28px rgba(0,0,0,.5);display:grid;gap:5px;";
    const copy = document.createElement("div");
    copy.textContent = acknowledgement;
    panel.append?.(copy);
    if (runtimeQuest.reward) {
      const reward = document.createElement("div");
      reward.textContent = runtimeQuest.reward;
      reward.style.cssText = "color:#d9f99d;font-size:12px;font-weight:650;";
      panel.append?.(reward);
    }
    document.body?.append?.(panel);
  };

  const submitJobsBoardQuest = async (button, completed) => {
    const runtimeQuest = window.__snapshotGrove?.quests?.find?.(
      (quest) => quest.id === "read-the-jobs-board"
    );
    if (!runtimeQuest) throw new Error("Jobs Board Grove quest is unavailable");
    const objectiveIndex = completed
      ? Math.max(0, runtimeQuest.objectives.length - 1)
      : 0;
    button.disabled = true;
    button.textContent = completed
      ? "Completing Read the Jobs Board…"
      : "Starting Read the Jobs Board…";
    const requestPhase = completed ? "complete" : "accept";
    const requestId = `snapshot_grove_quest_read-the-jobs-board_${requestPhase}_${Date.now()}_${Math.random()
      .toString(36)
      .slice(2)}`;
    const response = await fetch("/api/harthmere/live_mode", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        requestId,
        idempotencyKey: requestId,
        clientSentAtMs: Date.now(),
        actionKind: "request_quest_state_update",
        subsystem: "quest",
        actorEntityVersion: 1,
        zoneId: "the_grove",
        payload: {
          questId: runtimeQuest.id,
          source: "snapshot_grove",
          title: runtimeQuest.title,
          completed,
          stepId: `${runtimeQuest.id}:${objectiveIndex}:${
            runtimeQuest.triggers?.[objectiveIndex] ?? "step"
          }`,
          progress: completed ? runtimeQuest.objectives.length : 1,
          objectiveIndex: completed ? objectiveIndex : undefined,
          evidenceTrigger: completed
            ? runtimeQuest.triggers?.[objectiveIndex]
            : undefined,
          reason: completed ? "completion_turn_in" : "accepted",
        },
        clientClaims: {},
      }),
    });
    const body = await response.json().catch(() => undefined);
    const rejected =
      !response.ok ||
      !body ||
      body.ok === false ||
      body.warnings?.some?.((warning) =>
        String(warning).startsWith("snapshot_grove_quest_rejected:")
    );
    if (rejected) {
      throw new Error(
        completed
          ? "Read the Jobs Board could not be completed"
          : "Read the Jobs Board could not be started"
      );
    }
    const state = parse(localStorage.getItem(questStateKey)) ?? {};
    const acceptedQuestIds = [
      ...new Set([...(state.acceptedQuestIds ?? []), runtimeQuest.id]),
    ];
    const objectiveIndexByQuestId = {
      ...(state.objectiveIndexByQuestId ?? {}),
    };
    const objectiveProgressByQuestId = {
      ...(state.objectiveProgressByQuestId ?? {}),
    };
    if (completed) {
      delete objectiveIndexByQuestId[runtimeQuest.id];
    } else {
      objectiveIndexByQuestId[runtimeQuest.id] = 0;
    }
    delete objectiveProgressByQuestId[runtimeQuest.id];
    const completedQuestIds = completed
      ? [
          ...new Set([
            ...(state.completedQuestIds ?? []),
            runtimeQuest.id,
          ]),
        ]
      : (state.completedQuestIds ?? []);
    const nextActiveQuestId = completed
      ? acceptedQuestIds.find(
          (questId) =>
            questId !== runtimeQuest.id && !completedQuestIds.includes(questId)
        )
      : runtimeQuest.id;
    const next = {
      ...state,
      acceptedQuestIds,
      activeQuestId: nextActiveQuestId,
      activeObjectiveIndex: 0,
      objectiveIndexByQuestId,
      objectiveProgressByQuestId,
      completedQuestIds,
      completedObjectiveIds: completed
        ? [
            ...new Set([
              ...(state.completedObjectiveIds ?? []),
              `${runtimeQuest.id}:${objectiveIndex}:completion_turn_in`,
            ]),
          ]
        : (state.completedObjectiveIds ?? []),
      rewards: completed
        ? [
            ...new Set([
              ...(state.rewards ?? []),
              `${runtimeQuest.title}: ${runtimeQuest.reward}`,
            ]),
          ]
        : (state.rewards ?? []),
      updatedAt: Date.now(),
    };
    localStorage.setItem(questStateKey, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(questStateEvent));
    if (body.questState) {
      window.dispatchEvent(
        new CustomEvent(questSyncEvent, {
          detail: { questState: body.questState },
        })
      );
    }
  };

  const refreshJobsOffer = () => {
    const modal = window.clientContext?.resources?.get?.("/game_modal");
    const talkingToNPCId = Number(modal?.talkingToNPCId);
    const state = parse(localStorage.getItem(questStateKey)) ?? {};
    const runtimeQuest = window.__snapshotGrove?.quests?.find?.(
      (quest) => quest.id === "read-the-jobs-board"
    );
    const isJackieTalk =
      modal?.kind === "talk_to_npc" &&
      [8810000000019301, 8997551883502307].includes(talkingToNPCId);
    if (!isJackieTalk || !runtimeQuest) {
      removeJobsOffer();
      return;
    }
    const accepted = state.acceptedQuestIds?.includes?.(runtimeQuest.id);
    const completed = state.completedQuestIds?.includes?.(runtimeQuest.id);
    const objectiveIndex = Number(
      state.objectiveIndexByQuestId?.[runtimeQuest.id] ??
        (state.activeQuestId === runtimeQuest.id
          ? state.activeObjectiveIndex
          : -1)
    );
    const mode = completed
      ? "handled"
      : state.activeQuestId === runtimeQuest.id &&
          objectiveIndex >= runtimeQuest.objectives.length - 1
        ? "complete"
        : !accepted && !activeGroveQuest()
          ? "accept"
          : undefined;
    if (!mode) {
      removeJobsOffer();
      return;
    }
    let panel = document.querySelector(jobsOfferSelector);
    if (panel?.dataset?.mode === mode) return;
    panel?.remove();
    panel = document.createElement("div");
    panel.dataset.harthmereGroveJobsOfferHotfix = "true";
    panel.dataset.mode = mode;
    panel.style.cssText =
      "position:fixed;left:50%;bottom:18px;transform:translateX(-50%);z-index:1000;width:min(390px,calc(100vw - 32px));border:1px solid rgba(217,249,157,.8);background:rgba(20,13,48,.97);border-radius:10px;padding:10px 12px;color:white;font-size:12px;font-weight:700;box-shadow:0 8px 28px rgba(0,0,0,.5);display:grid;gap:8px;";
    const copy = document.createElement("div");
    copy.textContent =
      mode === "handled"
        ? "Read the Jobs Board is handled."
        : mode === "complete"
          ? runtimeQuest.reward
          : "The Jobs Board is where Harthmere posts real public work.";
    panel.append?.(copy);
    if (mode !== "handled") {
      const button = document.createElement("button");
      button.type = "button";
      button.textContent =
        mode === "complete"
          ? "Complete Read the Jobs Board"
          : "Start Read the Jobs Board";
      button.style.cssText =
        "border:1px solid rgba(217,249,157,.8);background:#7c5ce5;border-radius:8px;padding:10px 14px;color:white;font-size:13px;font-weight:850;";
      button.addEventListener("click", () => {
        submitJobsBoardQuest(button, mode === "complete").catch((error) => {
          button.disabled = false;
          button.textContent = String(error?.message ?? error);
        });
      });
      panel.append?.(button);
    }
    document.body?.append?.(panel);
  };

  const refreshContextualCard = () => {
    const panel = document.querySelector("section[aria-label='Map panels']");
    const context = activeGroveContext();
    const buttonLabel = contextualButtonLabels[context?.trigger];
    if (!panel || !context || !buttonLabel) {
      removeContextualCard();
      return;
    }
    let card = panel.querySelector(contextualCardSelector);
    if (!card) {
      card = document.createElement("div");
      card.dataset.harthmereGroveContextualHotfix = "true";
      card.style.cssText =
        "border:1px solid rgba(190,242,100,.55);background:rgba(8,18,12,.96);border-radius:12px;padding:12px;color:white;box-shadow:0 0 18px rgba(190,242,100,.18);display:grid;gap:8px;";
      card.innerHTML =
        "<div data-role='eyebrow' style='color:#d9f99d;font-size:10px;font-weight:800;letter-spacing:.16em;text-transform:uppercase'>The Grove</div>" +
        "<div data-role='title' style='font-size:14px;font-weight:800'></div>" +
        "<div data-role='objective' style='font-size:12px;line-height:1.35;color:rgba(255,255,255,.82)'></div>" +
        "<button data-role='action' type='button' style='border:1px solid rgba(217,249,157,.65);background:rgba(190,242,100,.25);border-radius:8px;padding:8px 10px;color:#f7fee7;font-size:12px;font-weight:800;text-align:left'></button>";
      panel.prepend(card);
      card.querySelector("[data-role='action']").addEventListener("click", () => {
        const latest = activeGroveContext();
        if (!latest || contextualButtonLabels[latest.trigger] == null) return;
        const position = latest.marker?.worldPosition ?? latest.marker?.position;
        const distance = playerDistanceTo(position);
        if (distance !== undefined && distance > 10) return;
        window.clientContext?.gardenHose?.publish?.({
          kind: "snapshot_grove_practice_action",
          questId: latest.questId,
          objectiveIndex: latest.objectiveIndex,
          trigger: latest.trigger,
          markerId: latest.markerId,
        });
      });
    }
    const position = context.marker?.worldPosition ?? context.marker?.position;
    const distance = playerDistanceTo(position);
    const inRange = distance === undefined || distance <= 10;
    const title = card.querySelector("[data-role='title']");
    const objective = card.querySelector("[data-role='objective']");
    const action = card.querySelector("[data-role='action']");
    if (title.textContent !== context.quest.title) {
      title.textContent = context.quest.title;
    }
    const objectiveText = context.quest.objectives?.[context.objectiveIndex] ?? "";
    if (objective.textContent !== objectiveText) {
      objective.textContent = objectiveText;
    }
    const actionText = inRange
      ? buttonLabel
      : `Walk to ${context.marker?.label ?? "the marker"} first`;
    if (action.textContent !== actionText) action.textContent = actionText;
    action.disabled = !inRange;
    action.style.opacity = inRange ? "1" : ".55";
    action.style.cursor = inRange ? "pointer" : "not-allowed";
  };

  Storage.prototype.setItem = function groveExactPinSetItem(key, value) {
    if (this === localStorage && key === storageKey) {
      const next = parse(String(value));
      if (
        next?.ownerQuestId &&
        nativeQuestIds[next.ownerQuestId] &&
        !String(next.markerId ?? "").startsWith("native_quest:")
      ) {
        lastExactPin = next;
      }
      if (shouldBlockNative(next) || shouldPreserve(currentPin(), next)) {
        restoreExactPin();
        return;
      }
    }
    return originalSetItem.call(this, key, value);
  };

  Storage.prototype.removeItem = function groveExactPinRemoveItem(key) {
    if (this === localStorage && key === storageKey && activeGroveQuest()) {
      restoreExactPin();
      return;
    }
    return originalRemoveItem.call(this, key);
  };

  EventTarget.prototype.dispatchEvent = function groveExactPinDispatch(event) {
    if (
      this === window &&
      event?.type === eventName &&
      ((!event.detail && activeGroveQuest()) ||
        shouldBlockNative(event.detail) ||
        shouldPreserve(currentPin(), event.detail))
    ) {
      restoreExactPin();
      return true;
    }
    return originalDispatchEvent.call(this, event);
  };

  const refresh = () => {
    restoreExactPin();
    refreshContextualCard();
    refreshObjectiveHud();
    refreshJobsOffer();
    refreshCompletionAcknowledgement();
    refreshTutorPrompt();
    refreshWorldObjectPrompt();
    refreshTalkNpcBridge();
    refreshCloudQuestRepairs();
    refreshDocSampleWorldObjects();
  };
  const scheduleRefresh = () => window.setTimeout(refresh, 0);
  window.addEventListener(questStateEvent, scheduleRefresh);
  window.addEventListener(questSyncEvent, scheduleRefresh);
  window.addEventListener(tutorHighlightEvent, scheduleRefresh);
  let observer;
  const installDomObserver = () => {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver(() => {
      refreshContextualCard();
      refreshObjectiveHud();
      refreshJobsOffer();
      refreshCompletionAcknowledgement();
      refreshTutorPrompt();
      refreshWorldObjectPrompt();
      refreshTalkNpcBridge();
      refreshCloudQuestRepairs();
      refreshDocSampleWorldObjects();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
    });
    refreshContextualCard();
    refreshObjectiveHud();
    refreshJobsOffer();
    refreshCompletionAcknowledgement();
    refreshTutorPrompt();
    refreshWorldObjectPrompt();
    refreshTalkNpcBridge();
    refreshCloudQuestRepairs();
    refreshDocSampleWorldObjects();
  };
  if (document.readyState === "loading") {
    window.addEventListener("DOMContentLoaded", installDomObserver, {
      once: true,
    });
  } else {
    installDomObserver();
  }
  const refreshTimer = window.setInterval(refresh, 250);
  scheduleRefresh();

  const cleanup = () => {
    Storage.prototype.setItem = originalSetItem;
    Storage.prototype.removeItem = originalRemoveItem;
    EventTarget.prototype.dispatchEvent = originalDispatchEvent;
    window.removeEventListener(questStateEvent, scheduleRefresh);
    window.removeEventListener(questSyncEvent, scheduleRefresh);
    window.removeEventListener(tutorHighlightEvent, scheduleRefresh);
    window.removeEventListener("keydown", onWorldObjectKeyDown, true);
    window.removeEventListener("DOMContentLoaded", installDomObserver);
    observer?.disconnect();
    window.clearInterval(refreshTimer);
    removeContextualCard();
    removeObjectiveHud();
    removeJobsOffer();
    removeCompletionAcknowledgement();
    removeTutorPrompt();
    restoreSourceTutorPrompt();
    removeWorldObjectPrompt();
    document.getElementById?.("harthmere-grove-tutor-hotfix-style")?.remove?.();
    if (originalFetch) window.fetch = originalFetch;
    delete window.__harthmereGroveExactMapPinHotfixVersion;
  };
  window.__harthmereGroveExactMapPinHotfixVersion = VERSION;
  window.__biomesGlitchMutableHotfix?.registerCleanup?.(cleanup);
})();
