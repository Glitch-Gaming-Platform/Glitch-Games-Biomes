#!/usr/bin/env node
"use strict";

const fs = require("fs");

const GENERATED_TARGET_HOTFIX = `
(function hotfixPopulateGeneratedMuckBountyTargets() {
    if (HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.some((target)=>String(target.targetId).includes("ambient_muck_monster"))) {
        return;
    }
    function hotfixSafeMuckBountyIdPart(value) {
        return String(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 80);
    }
    function hotfixGeneratedMuckBountyTargetFromSeed(input) {
        const id = \`muck_bounty_\${input.monsterId}_\${input.monsterTier}_\${hotfixSafeMuckBountyIdPart(input.seed.seedId)}\`;
        const tierLabel = input.monsterTier === "boss" ? "Boss" : "Elite";
        const monsterLabel = input.monsterId === "hex" ? "Hex" : "Mucker";
        return targetFromSeed({
            targetId: id,
            markerId: \`\${id}_marker\`,
            targetName: \`\${tierLabel} \${input.seed.displayName}\`,
            label: \`\${tierLabel} \${monsterLabel}: \${input.seed.areaLabel}\`,
            monsterId: input.monsterId,
            monsterTier: input.monsterTier,
            seed: input.seed
        });
    }
    for (const seed of _shared_harthmere_live_entity_production_seed__WEBPACK_IMPORTED_MODULE_0__/* .HARTHMERE_LIVE_ENTITY_MUCK_MONSTER_SEEDS */ .x2){
        const monsterId = seed.combatKind === "hex" ? "hex" : "mucker";
        const tiers = monsterId === "hex" ? [
            "boss"
        ] : [
            "elite",
            "boss"
        ];
        for (const monsterTier of tiers){
            const target = hotfixGeneratedMuckBountyTargetFromSeed({
                monsterId,
                monsterTier,
                seed
            });
            if (!HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.some((existing)=>existing.targetId === target.targetId || existing.markerId === target.markerId)) {
                HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS.push(target);
            }
        }
    }
})();`;

const RANDOMIZED_REQUIREMENTS_HOTFIX = `
const HOTFIX_HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS = [
    "old_grove_road_post",
    "coop_supply_box",
    "grove_tool_crate",
    "grove_resource_basket",
    "econ_kit_mailbag",
    "econ_grove_supply_chest",
    "harthmere_orchard_softwood",
    "doc_field_table"
];
const HOTFIX_HARTHMERE_GROVE_DELIVERY_DROPOFF_MARKERS = [
    "grove_mail_bank_satchel",
    "old_grove_road_post",
    "econ_grove_supply_chest",
    "doc_field_table"
];
const HOTFIX_HARTHMERE_TOWN_DELIVERY_DROPOFF_MARKERS = [
    "harthmere_bridge_center",
    "harthmere_market_office",
    "harthmere_chapel_stone",
    "harthmere_connector"
];
function hotfixBusinessOutpostMapMarkers() {
    return _business_customer_simulator__WEBPACK_IMPORTED_MODULE_2__/* .HARTHMERE_BUSINESS_OUTPOSTS.map */ .mz.map((outpost)=>(0,_business_customer_simulator__WEBPACK_IMPORTED_MODULE_2__/* .harthmereBusinessOutpostMapMarkerId */ .NE)(outpost.outpostId));
}
function hotfixBusinessOwnerDropoffs() {
    return _business_customer_simulator__WEBPACK_IMPORTED_MODULE_2__/* .HARTHMERE_BUSINESS_OUTPOSTS.map */ .mz.map((outpost)=>({
            markerId: \`\${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}\${outpost.ownerNpcId}\`,
            recipientNpcId: outpost.ownerNpcId,
            targetName: outpost.displayName
        }));
}
function hotfixRepeatableDeliveryPickupMarkersForBoard(boardId) {
    const outpostMarkers = hotfixBusinessOutpostMapMarkers();
    if (boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID) {
        return [
            ...HOTFIX_HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS,
            ...outpostMarkers
        ];
    }
    return [
        "harthmere_bridge_center",
        "harthmere_market_office",
        "harthmere_chapel_stone",
        "harthmere_connector",
        ...outpostMarkers,
        ...HOTFIX_HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS
    ];
}
function hotfixRepeatableDeliveryDropoffCandidatesForBoard(input) {
    const ownerDrops = hotfixBusinessOwnerDropoffs();
    if (input.personOnly) {
        return ownerDrops;
    }
    const placeMarkers = input.boardId === HARTHMERE_JOBS_BOARD_DEFAULT_BOARD_ID ? HOTFIX_HARTHMERE_GROVE_DELIVERY_DROPOFF_MARKERS : [
        ...HOTFIX_HARTHMERE_TOWN_DELIVERY_DROPOFF_MARKERS,
        ...HOTFIX_HARTHMERE_GROVE_DELIVERY_DROPOFF_MARKERS
    ];
    return placeMarkers.map((markerId)=>({
            markerId,
            targetId: markerId
        }));
}
function hotfixRandomCandidate(candidates, rng) {
    if (!candidates.length) return undefined;
    return candidates[Math.min(candidates.length - 1, Math.floor(rng() * candidates.length))];
}
function hotfixRandomRepeatableDeliveryPickupMarker(input) {
    const avoid = new Set((input.avoidMarkerIds ?? []).filter((id)=>Boolean(id)));
    return hotfixRandomCandidate(hotfixRepeatableDeliveryPickupMarkersForBoard(input.boardId).filter((markerId)=>!avoid.has(markerId)), input.rng);
}
function hotfixRandomRepeatableDeliveryDropoff(input) {
    const avoid = new Set((input.avoidMarkerIds ?? []).filter((id)=>Boolean(id)));
    return hotfixRandomCandidate(hotfixRepeatableDeliveryDropoffCandidatesForBoard({
        boardId: input.boardId,
        personOnly: input.personOnly
    }).filter((candidate)=>!avoid.has(candidate.markerId)), input.rng);
}
function hotfixRandomMuckBountyTarget(input) {
    const generated = _jobs_board_muck_bounty_targets__WEBPACK_IMPORTED_MODULE_4__/* .HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS */ .wh.filter((target)=>target.monsterId === input.monsterId && (!input.monsterTier || target.monsterTier === input.monsterTier) && String(target.targetId).includes("ambient_muck_monster"));
    const fallback = _jobs_board_muck_bounty_targets__WEBPACK_IMPORTED_MODULE_4__/* .HARTHMERE_JOBS_BOARD_MUCK_BOUNTY_TARGETS */ .wh.filter((target)=>target.monsterId === input.monsterId && (!input.monsterTier || target.monsterTier === input.monsterTier));
    return hotfixRandomCandidate(generated.length ? generated : fallback, input.rng);
}
function hotfixAutoSeedRotationBucket(nowMs) {
    const value = Number(nowMs);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value / HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS));
}
function hotfixStringSeed(value) {
    let seed = 0;
    value = String(value);
    for(let i = 0; i < value.length; i += 1){
        seed = seed * 31 + value.charCodeAt(i) | 0;
    }
    return seed >>> 0;
}
function hotfixRotateAutoSeedEntries(entries, input) {
    if (entries.length <= 1) return [
        ...entries
    ];
    const nowSeed = Math.floor(Math.max(0, Number(input.nowMs) || 0) / 1000);
    const offset = (hotfixAutoSeedRotationBucket(input.nowMs) + hotfixStringSeed(\`\${input.boardId}:\${input.salt}:\${nowSeed}\`)) % entries.length;
    return entries.map((entry, index)=>({
            entry,
            order: (index - offset + entries.length) % entries.length
        })).sort((a, b)=>a.order - b.order).map(({ entry })=>entry);
}
function hotfixIsRepeatablePlacementTemplate(template) {
    return template.kind === "delivery" || Boolean(template.monsterId);
}
function hotfixRandomizedAutoSeedRequirements(input) {
    const requirements = input.template.requirements.map((req)=>({
            ...req
        }));
    let mapMarkerId = input.template.mapMarkerId;
    let targetId = input.template.targetId;
    const logs = [];
    if (input.template.monsterId) {
        const target = hotfixRandomMuckBountyTarget({
            monsterId: input.template.monsterId,
            monsterTier: input.template.monsterTier,
            rng: input.rng
        });
        if (target) {
            mapMarkerId = target.markerId;
            targetId = target.targetId;
            for (const req of requirements){
                if (req.targetId || req.mapMarkerId) {
                    req.targetId = target.targetId;
                    req.targetName = target.targetName;
                    req.mapMarkerId = target.markerId;
                }
            }
            logs.push(\`muck_bounty_target:\${target.seedId}:\${target.areaId}\`);
        }
    }
    if (input.template.kind === "delivery") {
        const firstDeliveryReq = requirements.find((req)=>req.itemId);
        if (firstDeliveryReq) {
            const dropoff = hotfixRandomRepeatableDeliveryDropoff({
                boardId: input.boardId,
                rng: input.rng,
                personOnly: Boolean(firstDeliveryReq.recipientNpcId)
            });
            if (dropoff) {
                firstDeliveryReq.mapMarkerId = dropoff.markerId;
                firstDeliveryReq.targetId = dropoff.targetId;
                firstDeliveryReq.targetName = dropoff.targetName;
                firstDeliveryReq.recipientNpcId = dropoff.recipientNpcId;
                mapMarkerId = dropoff.markerId;
                targetId = dropoff.targetId;
                logs.push(\`delivery_dropoff:\${dropoff.markerId}\`);
            }
            const pickupMarkerId = hotfixRandomRepeatableDeliveryPickupMarker({
                boardId: input.boardId,
                rng: input.rng,
                avoidMarkerIds: [
                    firstDeliveryReq.mapMarkerId,
                    firstDeliveryReq.targetId,
                    firstDeliveryReq.recipientNpcId ? \`\${HARTHMERE_BUSINESS_OWNER_MARKER_PREFIX}\${firstDeliveryReq.recipientNpcId}\` : undefined,
                    mapMarkerId,
                    targetId
                ]
            });
            if (pickupMarkerId) {
                firstDeliveryReq.pickupMarkerId = pickupMarkerId;
                logs.push(\`delivery_pickup:\${pickupMarkerId}\`);
            }
        }
    }
    return {
        requirements,
        mapMarkerId,
        targetId,
        logs
    };
}
function hotfixRandomizedBusinessTemplateRequirements(input) {
    return hotfixRandomizedAutoSeedRequirements({
        template: {
            kind: input.template.kind,
            requirements: input.template.requirements,
            mapMarkerId: input.template.mapMarkerId,
            targetId: input.template.targetId
        },
        boardId: input.boardId,
        rng: input.rng
    });
}`;

const REPEATABLE_FAIRNESS_HELPERS_HOTFIX = `
function hotfixAutoSeedRotationBucket(nowMs) {
    const value = Number(nowMs);
    if (!Number.isFinite(value)) return 0;
    return Math.max(0, Math.floor(value / HARTHMERE_JOBS_BOARD_AUTO_SEED_DEADLINE_MS));
}
function hotfixStringSeed(value) {
    let seed = 0;
    value = String(value);
    for(let i = 0; i < value.length; i += 1){
        seed = seed * 31 + value.charCodeAt(i) | 0;
    }
    return seed >>> 0;
}
function hotfixRotateAutoSeedEntries(entries, input) {
    if (entries.length <= 1) return [
        ...entries
    ];
    const offset = (hotfixAutoSeedRotationBucket(input.nowMs) + hotfixStringSeed(\`\${input.boardId}:\${input.salt}\`)) % entries.length;
    return entries.map((entry, index)=>({
            entry,
            order: (index - offset + entries.length) % entries.length
        })).sort((a, b)=>a.order - b.order).map(({ entry })=>entry);
}
function hotfixIsRepeatablePlacementTemplate(template) {
    return template.kind === "delivery" || Boolean(template.monsterId);
}`;

const PICKUP_DELIVERY_PARCEL_HOTFIX = `
function pickupDeliveryParcel(result, request, context) {
    const job = request.jobId ? result.next.postings[request.jobId] : undefined;
    if (!job) return reject(result, "jobs_board_rejected:job_not_found");
    if (job.kind !== "delivery") return reject(result, "jobs_board_rejected:not_delivery_job");
    if (job.status !== "active") return reject(result, "jobs_board_rejected:job_not_active");
    if (job.acceptedByActorId !== request.actorId) return reject(result, "jobs_board_rejected:job_not_accepted_by_actor");
    const todo = todoForJobAndActor(result.next, job.jobId, request.actorId, request.questTodoId);
    if (!todo) return reject(result, "jobs_board_rejected:quest_todo_required");
    if (todo.status !== "active") return reject(result, \`jobs_board_rejected:quest_not_active:\${todo.status}\`);
    if (job.deadlineAtMs <= request.nowMs) {
        job.status = "expired";
        todo.status = "expired";
        return reject(result, "jobs_board_rejected:job_expired");
    }
    const plan = harthmereDeliveryPlan(job);
    if (!plan?.pickupMarkerId || !plan.parcelItemId) return reject(result, "jobs_board_rejected:delivery_pickup_not_required");
    if (request.completedTargetId !== plan.pickupMarkerId && request.completedTargetId !== undefined) {
        return reject(result, \`jobs_board_rejected:wrong_delivery_pickup:\${plan.pickupMarkerId}\`);
    }
    const currentCount = Math.max(0, Math.floor(Number(context.actorInventoryItems[plan.parcelItemId] ?? 0)));
    const grantCount = Math.max(0, plan.parcelCount - currentCount);
    if (grantCount > 0) {
        recordItemDelta(result.itemDeltas, plan.parcelItemId, grantCount);
    }
    job.logs.push(\`delivery_parcel_picked_up:\${plan.parcelItemId}:\${grantCount}:\${plan.pickupMarkerId}:\${request.nowMs}\`);
    pushAudit(result, request, {
        id: request.requestId,
        kind: "job_delivery_parcel_picked_up",
        jobId: job.jobId,
        boardId: job.boardId,
        issuerKind: job.issuerKind,
        issuerId: job.issuerId,
        reason: plan.pickupMarkerId
    });
    result.touched.add("jobs_board_delivery_parcel");
    result.touched.add("jobs_board_quest_todo");
    result.shared.add(sharedTodoKey(todo.todoId));
    result.shared.add(sharedJobKey(job.jobId));
}`;

function replaceOnce(text, search, replacement, label, expected = 1) {
  const count = text.split(search).length - 1;
  if (count !== expected) {
    throw new Error(`${label}: expected ${expected} replacement(s), found ${count}`);
  }
  return text.split(search).join(replacement);
}

function patchBundle(file) {
  if (!fs.existsSync(file)) {
    console.log(JSON.stringify({ file, skipped: "missing" }));
    return;
  }
  let text = fs.readFileSync(file, "utf8");
  const before = text;

  if (!text.includes("hotfixPopulateGeneratedMuckBountyTargets")) {
    text = replaceOnce(
      text,
      `        seed: alphaMuckerSeed\n    })\n];\nfunction harthmereJobsBoardMuckBountyTargetForId(id) {`,
      `        seed: alphaMuckerSeed\n    })\n];\n${GENERATED_TARGET_HOTFIX}\nfunction harthmereJobsBoardMuckBountyTargetForId(id) {`,
      `${file}:generated-targets`
    );
  }

  if (!text.includes("HOTFIX_HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS")) {
    text = replaceOnce(
      text,
      `function countOpenAutoPostings(state, boardId) {`,
      `${RANDOMIZED_REQUIREMENTS_HOTFIX}\nfunction countOpenAutoPostings(state, boardId) {`,
      `${file}:randomized-requirement-helpers`
    );
  }

  if (!text.includes("function hotfixAutoSeedRotationBucket")) {
    text = replaceOnce(
      text,
      `function hotfixRandomizedAutoSeedRequirements(input) {`,
      `${REPEATABLE_FAIRNESS_HELPERS_HOTFIX}\nfunction hotfixRandomizedAutoSeedRequirements(input) {`,
      `${file}:repeatable-fairness-helpers`
    );
  }

  if (text.includes("hotfixStringSeed(`${input.boardId}:${input.salt}`)")) {
    text = replaceOnce(
      text,
      `    const offset = (hotfixAutoSeedRotationBucket(input.nowMs) + hotfixStringSeed(\`${"${input.boardId}:${input.salt}"}\`)) % entries.length;`,
      `    const nowSeed = Math.floor(Math.max(0, Number(input.nowMs) || 0) / 1000);\n    const offset = (hotfixAutoSeedRotationBucket(input.nowMs) + hotfixStringSeed(\`${"${input.boardId}:${input.salt}:${nowSeed}"}\`)) % entries.length;`,
      `${file}:repeatable-fairness-time-seed`
    );
  }

  if (!text.includes("hotfixRandomizedBusinessTemplateRequirements({")) {
    text = replaceOnce(
      text,
      `        business.balanceGold -= rewardGold;\n        let jobId = \`${"${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX}${result.next.nextJobNumber++}"}\`;`,
      `        business.balanceGold -= rewardGold;\n        let businessSeed = 0;\n        const businessSeedKey = \`${"${board.boardId}:${business.businessId}:${template.templateId}"}\`;\n        for(let i = 0; i < businessSeedKey.length; i += 1){\n            businessSeed = businessSeed * 31 + businessSeedKey.charCodeAt(i) | 0;\n        }\n        const businessRng = autoSeedRng((request.nowMs ^ businessSeed) >>> 0);\n        const randomized = hotfixRandomizedBusinessTemplateRequirements({\n            template,\n            boardId: board.boardId,\n            rng: businessRng\n        });\n        let jobId = \`${"${HARTHMERE_JOBS_BOARD_AUTO_SEED_ISSUER_PREFIX}${result.next.nextJobNumber++}"}\`;`,
      `${file}:business-randomized-seed`
    );
  }

  if (!text.includes("business-rotation")) {
    text = replaceOnce(
      text,
      `    const businesses = Object.values(result.economy?.businesses ?? {}).filter((business)=>business.status === "open" && (business.townId === board.townId || business.regionId === board.regionId)).sort((a, b)=>a.businessId.localeCompare(b.businessId));\n    for (const business of businesses){`,
      `    const businessCandidates = Object.values(result.economy?.businesses ?? {}).filter((business)=>business.status === "open" && (business.townId === board.townId || business.regionId === board.regionId)).sort((a, b)=>a.businessId.localeCompare(b.businessId));\n    let businessOrderSeed = 0;\n    const businessOrderSeedKey = \`${"${board.boardId}:business-rotation"}\`;\n    for(let i = 0; i < businessOrderSeedKey.length; i += 1){\n        businessOrderSeed = businessOrderSeed * 31 + businessOrderSeedKey.charCodeAt(i) | 0;\n    }\n    const businessOrderRng = autoSeedRng((request.nowMs ^ businessOrderSeed) >>> 0);\n    const businessRotationIndex = businessCandidates.length ? (hotfixAutoSeedRotationBucket(request.nowMs) + (businessOrderSeed >>> 0)) % businessCandidates.length : 0;\n    const businesses = businessCandidates.map((business, index)=>({\n            business,\n            order: (index - businessRotationIndex + businessCandidates.length) % businessCandidates.length + businessOrderRng() * 0.001\n        })).sort((a, b)=>a.order - b.order).map((entry)=>entry.business);\n    for (const business of businesses){`,
      `${file}:business-rotation`
    );
  }

  if (!text.includes("businessRotationIndex")) {
    text = replaceOnce(
      text,
      `    const businessOrderRng = autoSeedRng((request.nowMs ^ businessOrderSeed) >>> 0);\n    const businesses = businessCandidates.map((business)=>({\n            business,\n            order: businessOrderRng()\n        })).sort((a, b)=>a.order - b.order).map((entry)=>entry.business);`,
      `    const businessOrderRng = autoSeedRng((request.nowMs ^ businessOrderSeed) >>> 0);\n    const businessRotationIndex = businessCandidates.length ? (hotfixAutoSeedRotationBucket(request.nowMs) + (businessOrderSeed >>> 0)) % businessCandidates.length : 0;\n    const businesses = businessCandidates.map((business, index)=>({\n            business,\n            order: (index - businessRotationIndex + businessCandidates.length) % businessCandidates.length + businessOrderRng() * 0.001\n        })).sort((a, b)=>a.order - b.order).map((entry)=>entry.business);`,
      `${file}:business-rotation-index`
    );
  }

  if (!text.includes("desiredRewardGold")) {
    text = replaceOnce(
      text,
      `        const rewardGold = Math.max(HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD, Math.min(HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD, template.defaultRewardGold));\n        if (business.balanceGold < rewardGold) continue;\n        business.balanceGold -= rewardGold;`,
      `        const desiredRewardGold = Math.max(HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD, Math.min(HARTHMERE_JOBS_BOARD_MAX_REWARD_GOLD, template.defaultRewardGold));\n        const affordableGold = Math.max(0, Math.trunc(business.balanceGold ?? 0));\n        const rewardGold = Math.min(desiredRewardGold, affordableGold);\n        if (business.balanceGold < rewardGold) continue;\n        if (rewardGold < HARTHMERE_JOBS_BOARD_MIN_REWARD_GOLD) continue;\n        business.balanceGold -= rewardGold;`,
      `${file}:business-affordable-reward`
    );
  }

  if (!text.includes("repeatablePlacementTemplates")) {
    text = replaceOnce(
      text,
      `    const shouldPrimeExoticMatterMining = exoticMatterTemplates.length > 0 && !hasOpenExoticMatterMiningJob(result.next, boardId);`,
      `    const shouldPrimeExoticMatterMining = exoticMatterTemplates.length > 0 && !hasOpenExoticMatterMiningJob(result.next, boardId);\n    const repeatablePlacementTemplates = templates.filter((template)=>hotfixIsRepeatablePlacementTemplate(template));\n    const repeatablePlacementLimit = Math.min(Math.max(0, slotsToFill - (shouldPrimeExoticMatterMining ? 1 : 0)), repeatablePlacementTemplates.length);`,
      `${file}:repeatable-placement-pool`
    );
  }

  if (text.includes("const repeatablePlacementLimit = Math.min(slotsToFill, repeatablePlacementTemplates.length);")) {
    text = replaceOnce(
      text,
      `    const repeatablePlacementLimit = Math.min(slotsToFill, repeatablePlacementTemplates.length);`,
      `    const repeatablePlacementLimit = Math.min(Math.max(0, slotsToFill - (shouldPrimeExoticMatterMining ? 1 : 0)), repeatablePlacementTemplates.length);`,
      `${file}:repeatable-placement-exotic-slot`
    );
  }

  if (!text.includes("shouldPrimeRepeatablePlacement")) {
    text = replaceOnce(
      text,
      `        const baseTemplatePool = shouldPrimeExoticMatterMining && produced === 0 ? exoticMatterTemplates : templates;\n        const distinctTemplatePool = baseTemplatePool.filter((template)=>!usedTemplateIds.has(template.templateId) && (!openTemplateIds.has(template.templateId) || openTemplateIds.size >= templates.length));\n        const diverseKindPool = distinctTemplatePool.filter((template)=>!openKinds.has(template.kind) && !usedKinds.has(template.kind));\n        const templatePool = diverseKindPool.length > 0 ? diverseKindPool : distinctTemplatePool.length > 0 ? distinctTemplatePool : baseTemplatePool;\n        const template = templatePool[Math.floor(rng() * templatePool.length)];`,
      `        const missingRepeatablePlacementPool = repeatablePlacementTemplates.filter((template)=>!usedTemplateIds.has(template.templateId) && (!openTemplateIds.has(template.templateId) || openTemplateIds.size >= templates.length));\n        const shouldPrimeExotic = shouldPrimeExoticMatterMining && produced === 0;\n        const shouldPrimeRepeatablePlacement = !shouldPrimeExotic && produced < repeatablePlacementLimit && missingRepeatablePlacementPool.length > 0;\n        const baseTemplatePool = shouldPrimeExotic ? exoticMatterTemplates : shouldPrimeRepeatablePlacement ? hotfixRotateAutoSeedEntries(missingRepeatablePlacementPool, {\n            boardId,\n            nowMs: request.nowMs,\n            salt: \"repeatable-placement\"\n        }) : templates;\n        const distinctTemplatePool = baseTemplatePool.filter((template)=>!usedTemplateIds.has(template.templateId) && (!openTemplateIds.has(template.templateId) || openTemplateIds.size >= templates.length));\n        const diverseKindPool = distinctTemplatePool.filter((template)=>!openKinds.has(template.kind) && !usedKinds.has(template.kind));\n        const templatePool = shouldPrimeRepeatablePlacement ? distinctTemplatePool.length > 0 ? distinctTemplatePool : baseTemplatePool : diverseKindPool.length > 0 ? diverseKindPool : distinctTemplatePool.length > 0 ? distinctTemplatePool : baseTemplatePool;\n        const template = shouldPrimeRepeatablePlacement ? templatePool[0] : templatePool[Math.floor(rng() * templatePool.length)];`,
      `${file}:repeatable-placement-priority`
    );
  }

  if (!text.includes("const shouldPrimeExotic = shouldPrimeExoticMatterMining")) {
    text = replaceOnce(
      text,
      `        const missingRepeatablePlacementPool = repeatablePlacementTemplates.filter((template)=>!usedTemplateIds.has(template.templateId) && (!openTemplateIds.has(template.templateId) || openTemplateIds.size >= templates.length));\n        const shouldPrimeRepeatablePlacement = produced < repeatablePlacementLimit && missingRepeatablePlacementPool.length > 0;\n        const baseTemplatePool = shouldPrimeRepeatablePlacement ? hotfixRotateAutoSeedEntries(missingRepeatablePlacementPool, {\n            boardId,\n            nowMs: request.nowMs,\n            salt: \"repeatable-placement\"\n        }) : shouldPrimeExoticMatterMining && produced === 0 ? exoticMatterTemplates : templates;`,
      `        const missingRepeatablePlacementPool = repeatablePlacementTemplates.filter((template)=>!usedTemplateIds.has(template.templateId) && (!openTemplateIds.has(template.templateId) || openTemplateIds.size >= templates.length));\n        const shouldPrimeExotic = shouldPrimeExoticMatterMining && produced === 0;\n        const shouldPrimeRepeatablePlacement = !shouldPrimeExotic && produced < repeatablePlacementLimit && missingRepeatablePlacementPool.length > 0;\n        const baseTemplatePool = shouldPrimeExotic ? exoticMatterTemplates : shouldPrimeRepeatablePlacement ? hotfixRotateAutoSeedEntries(missingRepeatablePlacementPool, {\n            boardId,\n            nowMs: request.nowMs,\n            salt: \"repeatable-placement\"\n        }) : templates;`,
      `${file}:repeatable-placement-exotic-priority`
    );
  }

  if (!text.includes("hotfixRandomizedAutoSeedRequirements({\n            template,\n            boardId,")) {
    text = replaceOnce(
      text,
      `        const flags = [];\n        if (hasSuspiciousText(\`${"${template.title} ${template.description}"}\`)) {`,
      `        const randomized = hotfixRandomizedAutoSeedRequirements({\n            template,\n            boardId,\n            rng\n        });\n        const flags = [];\n        if (hasSuspiciousText(\`${"${template.title} ${template.description}"}\`)) {`,
      `${file}:auto-randomized-seed`
    );
  }

  text = text.replaceAll(
    `requirements: template.requirements.map((req)=>({\n                    ...req\n                })),`,
    `requirements: randomized.requirements,`
  );
  text = text.replaceAll(
    `mapMarkerId: template.mapMarkerId,\n            targetId: template.targetId,`,
    `mapMarkerId: randomized.mapMarkerId,\n            targetId: randomized.targetId,`
  );
  text = text.replaceAll(
    `logs: [\n                \`auto_seeded_business:\${template.templateId}:\${request.nowMs}\`\n            ],`,
    `logs: [\n                \`auto_seeded_business:\${template.templateId}:\${request.nowMs}\`,\n                ...randomized.logs\n            ],`
  );
  text = text.replaceAll(
    `logs: [\n                \`auto_seeded:\${template.templateId}:\${request.nowMs}\`\n            ],`,
    `logs: [\n                \`auto_seeded:\${template.templateId}:\${request.nowMs}\`,\n                ...randomized.logs\n            ],`
  );

  if (!text.includes("function pickupDeliveryParcel(result, request, context)")) {
    text = replaceOnce(
      text,
      `function completeJobQuest(result, request, context) {`,
      `${PICKUP_DELIVERY_PARCEL_HOTFIX}\nfunction completeJobQuest(result, request, context) {`,
      `${file}:pickup-delivery-parcel`
    );
  }

  if (!text.includes('case "pickup_delivery_parcel":')) {
    text = replaceOnce(
      text,
      `        case "complete_job_quest":\n            completeJobQuest(result, request, context);\n            break;\n        case "cancel_job":`,
      `        case "complete_job_quest":\n            completeJobQuest(result, request, context);\n            break;\n        case "pickup_delivery_parcel":\n            pickupDeliveryParcel(result, request, context);\n            break;\n        case "cancel_job":`,
      `${file}:pickup-switch`
    );
  }

  if (text !== before) {
    fs.copyFileSync(file, `${file}.repeatable-placement-hotfix.bak`);
    fs.writeFileSync(file, text, "utf8");
  }
  console.log(
    JSON.stringify({
      file,
      changed: text !== before,
      generatedTargets: text.includes("hotfixPopulateGeneratedMuckBountyTargets"),
      randomizedRequirements: text.includes("HOTFIX_HARTHMERE_GROVE_DELIVERY_PICKUP_MARKERS"),
      pickupOperation: text.includes('case "pickup_delivery_parcel":'),
    })
  );
}

const files = process.argv.slice(2);
if (!files.length) {
  throw new Error("Usage: apply-repeatable-placement-bundle-hotfix.cjs <bundle.js> [...]");
}
for (const file of files) {
  patchBundle(file);
}
