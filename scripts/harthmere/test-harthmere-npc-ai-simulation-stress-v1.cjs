#!/usr/bin/env node
const { createHarness, planGridPath, score, transition, emptyMemory, updateMemory } = require("./harthmere-npc-ai-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC AI simulation stress tests v1"); const kinds=["merchant","guard","civilian","peasant","thief","priest","noble","creature"]; let decisions=0;
for(let i=0;i<1000;i++){const kind=kinds[i%kinds.length]; const bb={hour:i%24,dangerLevel:i%17===0?95:i%40,playerWantsTrade:i%11===0,crimeWitnessed:i%13===0,hostileVisible:i%19===0,legalStanding:(i%200)-100,likeability:(i%300)-150}; const state=transition(kind,bb), top=score(kind,bb)[0], path=planGridPath({x:0,z:0},{x:3,z:3},[{x:1,z:0},{x:1,z:1}]), mem=updateMemory(emptyMemory(i),[{type:"conversation",playerId:`p${i%5}`,reputationDelta:1,timestamp:i}],i+1); if(state&&top&&path.length>1&&mem.lastUpdatedAt===i+1) decisions++;}
h.ok(decisions===1000,"1000 deterministic NPC AI ticks complete"); h.done();
