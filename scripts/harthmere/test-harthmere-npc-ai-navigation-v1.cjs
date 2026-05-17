#!/usr/bin/env node
const { createHarness, aiSource, planGridPath, steer } = require("./harthmere-npc-ai-test-lib-v1.cjs");
const h = createHarness("Harthmere NPC AI navigation tests v1"); const src = aiSource(h);
for (const token of ["planHarthmereGridPath", "blockedKeys", "cameFrom", "steerHarthmereNpcToward"]) h.ok(src.includes(token), `navigation source includes ${token}`);
const blocked=[{x:1,z:0},{x:1,z:1},{x:1,z:2}], path=planGridPath({x:0,z:0},{x:2,z:2},blocked);
h.ok(path.length>1,"A* returns multi-step path"); h.ok(path[0].x===0&&path[0].z===0,"path starts at origin"); h.ok(path.at(-1).x===2&&path.at(-1).z===2,"path reaches goal"); h.ok(path.every(p=>!blocked.some(b=>b.x===p.x&&b.z===p.z)),"path avoids blocked cells");
const v=steer({x:0,z:0},{x:3,z:0},[{x:0,z:1}]); h.ok(Number.isFinite(v.x)&&Number.isFinite(v.z),"steering vector finite"); h.ok(v.x>0,"steering moves toward waypoint"); h.done();
