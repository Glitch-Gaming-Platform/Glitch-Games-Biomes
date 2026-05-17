#!/usr/bin/env node
const { createHarness, aiSource, planGoal } = require("./harthmere-npc-ai-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC AI GOAP tests v1"); const src=aiSource(h); for (const token of ["planHarthmereNpcGoal","preconditions","effects","cost"]) h.ok(src.includes(token), `GOAP includes ${token}`);
const restock=planGoal({shopRestocked:true},{hasSupplier:false,hasMaterials:false,atShop:false}); h.ok(restock.join(">").includes("find_supplier>buy_materials>walk_to_shop>restock_shelves"),"restock plan has supplier/material/shop/shelf steps");
const repair=planGoal({buildingRepaired:true},{damageKnown:false,hasSupplier:false,hasMaterials:false,atSite:false}); for (const step of ["inspect_damage","buy_materials","walk_to_site","repair_building"]) h.ok(repair.includes(step), `repair plan includes ${step}`);
const report=planGoal({crimeReported:true},{crimeKnown:false}); h.ok(report.join(">").includes("see_crime>call_watch>make_report"),"crime report plan escalates correctly"); h.done();
