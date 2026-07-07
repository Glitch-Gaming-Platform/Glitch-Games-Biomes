/// <reference types="mocha" />
import assert from "assert";
const g = global as any;
if (typeof g.window === "undefined") g.window = g;
g.window.addEventListener ??= () => {};
g.window.removeEventListener ??= () => {};
g.window.dispatchEvent ??= () => true;
const ls = new Map<string,string>();
g.window.localStorage ??= { getItem:(k:string)=>ls.get(k)??null, setItem:(k:string,v:string)=>ls.set(k,String(v)), removeItem:(k:string)=>ls.delete(k), clear:()=>ls.clear() };
import { buildBiomesUIMapAdapterForTest } from "@/client/components/biomes_ui/adapters/mapLiveAdapter";
describe("dbg", () => {
  it("dump", () => {
    g.window.localStorage.setItem("biomes.localDev.snapshotMissionState", JSON.stringify({accepted:true,active:{snapshot_road_ahead_full_chain:1},currentStepIndex:1,completedStepIds:["meet_jackie_in_grove"],completed:[],pinned:["snapshot_road_ahead_full_chain"],rewards:[]}));
    const a = buildBiomesUIMapAdapterForTest(1);
    const all = a.getTrackableQuests().filter((q:any)=>q.questId==="snapshot_road_ahead_full_chain");
    console.log(JSON.stringify(all.map((q:any)=>({id:q.questId,status:q.status,kind:q.kind})),null,2));
    console.log("TOTAL", a.getTrackableQuests().length);
  });
});
