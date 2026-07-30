#!/usr/bin/env node
require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = process.env.IS_SERVER || "1";
const { Redis } = require("ioredis");
const { deserializeRedisEntityState } = require("../../src/server/shared/world/lua/serde");

const redis = new Redis({ host: process.env.REDIS_HOST || "127.0.0.1", port: Number(process.env.REDIS_PORT || 6379), lazyConnect: true });
function decode(id, raw) { try { return raw ? deserializeRedisEntityState(id, raw)[1] : undefined; } catch { return undefined; } }
async function main() {
  await redis.connect();
  let cursor="0", scanned=0; const rows=[];
  do {
    const [next,keys]=await redis.scan(cursor,"MATCH","b:*","COUNT",2500); cursor=next; scanned+=keys.length;
    const vals=keys.length?await redis.mgetBuffer(keys):[];
    for(let i=0;i<keys.length;i++){
      const id=Number(keys[i].slice(2)); const e=decode(id,vals[i]);
      if(!e?.hasBox?.()||!e?.hasShardSeed?.())continue;
      const box=e.box(); const sx=Math.floor(box.v0[0]/32), sy=Math.floor(box.v0[1]/32), sz=Math.floor(box.v0[2]/32);
      if(sx<60||sx>66||sz<-10||sz>-6||sy<0||sy>2)continue;
      rows.push({id,shard:[sx,sy,sz],v0:box.v0,v1:box.v1,bytes:{seed:e.shardSeed()?.buffer?.length||0,diff:e.hasShardDiff?.()?e.shardDiff()?.buffer?.length||0:0,sky:e.hasShardSkyOcclusion?.()?e.shardSkyOcclusion()?.buffer?.length||0:0},components:{diff:Boolean(e.hasShardDiff?.()),sky:Boolean(e.hasShardSkyOcclusion?.()),irradiance:Boolean(e.hasShardIrradiance?.()),water:Boolean(e.hasShardWater?.()),muck:Boolean(e.hasShardMuck?.())}});
    }
  } while(cursor!=="0");
  const groups={}; for(const r of rows)(groups[r.shard.join(",")]??=[]).push(r);
  console.log(JSON.stringify({scanned,groups,duplicates:Object.fromEntries(Object.entries(groups).filter(([,v])=>v.length>1))},null,2)); redis.disconnect();
}
main().catch(e=>{console.error(e);process.exit(1)});
