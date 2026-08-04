require("ts-node/register/transpile-only");
require("tsconfig-paths/register");
process.env.IS_SERVER = "1";
process.env.BIOMES_TERRAIN_SEED_MODE = "preserve-overlays";
const path=require("path"), fs=require("fs");
const { loadVoxeloo } = require(path.join(process.cwd(),"src/server/shared/voxeloo"));
const { loadBlockWrapper } = require(path.join(process.cwd(),"src/shared/wasm/biomes"));
const { getTerrainName } = require(path.join(process.cwd(),"src/shared/asset_defs/terrain"));
function loadBuilder(){
  const bundlePath=path.join(process.cwd(),"dist/shim.js");
  const marker='void (0, main_1.runServer)("shim",';
  const src=fs.readFileSync(bundlePath,"utf8");
  const inst=src.replace(marker,'globalThis.__B={localDevTerrainShardSpecs,makeLocalDevTerrainShard}; false && (0, main_1.runServer)("shim",');
  new Function("require","module","exports","__filename","__dirname",inst)(require,module,module.exports,bundlePath,path.dirname(bundlePath));
  const b=globalThis.__B; delete globalThis.__B; return b;
}
(async()=>{
  const vox=await loadVoxeloo();
  const B=loadBuilder();
  const specs=B.localDevTerrainShardSpecs();
  console.log("canonical shards:",specs.length);
  const byKey=new Map(specs.map(s=>[`${s.shardX}:${s.shardY}:${s.shardZ}`,s]));
  const cache=new Map();
  function surfaceAt(x,z,yTop=90,yBot=30){
    for(let y=yTop;y>=yBot;y--){
      const sx=Math.floor(x/32), sy=Math.floor(y/32), sz=Math.floor(z/32);
      const k=`${sx}:${sy}:${sz}`; const spec=byKey.get(k); if(!spec) continue;
      let blk=cache.get(k);
      if(blk===undefined){
        const ch=B.makeLocalDevTerrainShard(vox,"update",spec.id,sx,sy,sz,1,false);
        const b=new vox.VolumeBlock_U32(); loadBlockWrapper(vox,b,ch.entity.shard_seed);
        blk=b; cache.set(k,b);
      }
      const id=Number(blk.get(((x%32)+32)%32, ((y%32)+32)%32, ((z%32)+32)%32)??0);
      if(id) return {y,id,name:getTerrainName?getTerrainName(id):id};
    }
    return undefined;
  }
  console.log("\n--- seam profile along the connector road line, world Z=-209 ---");
  for(let x=1792;x<=1900;x+=4){
    const s=surfaceAt(x,-209);
    console.log(`  x=${x} (authored ${x-1600})  ${s?`surface Y=${s.y} ${s.name??s.id}`:"NO TERRAIN"}`);
  }
})().catch(e=>{console.error(e.stack||e);process.exit(1);});
