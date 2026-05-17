#!/usr/bin/env python3
import base64, json, math, os, struct, sys
from pathlib import Path

VERSION = "harthmere-body-weapon-aligned-clips-v8"
FRAME_COUNT = 30
FPS = 30

# These are deliberately restrained upper-body overlays. They use 30 keyframes,
# lock the hips/root, keep the chest nearly still, and move only arms/hands so
# locomotion can continue underneath without the body tumbling.
CLIPS = {
    "HarthmereBodyWeaponIdleDrawn_Aligned_30": {
        "duration": 1.0, "category": "melee_idle", "timing": {"windupMs": 0, "impactMs": 0, "recoveryMs": 0},
        "keys": [(0.0, {"RightArm": (-38, 2, -8), "RightHand": (-10, 8, 10), "LeftArm": (-24, 0, 8), "LeftHand": (-4, -4, -8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (1.0, {"RightArm": (-38, 2, -8), "RightHand": (-10, 8, 10), "LeftArm": (-24, 0, 8), "LeftHand": (-4, -4, -8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyWeaponBasic_Aligned_30": {
        "duration": 0.71, "category": "melee_basic", "timing": {"windupMs": 150, "impactMs": 220, "recoveryMs": 340},
        "keys": [(0.00, {"RightArm": (-40, 0, -10), "RightHand": (-10, 8, 14), "LeftArm": (-26,0,10), "LeftHand": (-5,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.20, {"RightArm": (-58, -6, -35), "RightHand": (-18, 20, 24), "LeftArm": (-28,0,14), "LeftHand": (-6,-6,-8), "Chest": (0,0,-2), "HipsT": (0,0,0)}), (0.34, {"RightArm": (-30, 6, 42), "RightHand": (-6, -18, -20), "LeftArm": (-30,2,18), "LeftHand": (-8,0,-10), "Chest": (0,0,2), "HipsT": (0,0,0)}), (0.64, {"RightArm": (-34, 4, 12), "RightHand": (-8, -4, -2), "LeftArm": (-25,0,12), "LeftHand": (-5,-4,-8), "Chest": (0,0,0.5), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-38, 2, -8), "RightHand": (-10, 8, 10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyWeaponHeavy_Aligned_30": {
        "duration": 1.02, "category": "melee_heavy", "timing": {"windupMs": 260, "impactMs": 360, "recoveryMs": 520},
        "keys": [(0.00, {"RightArm": (-40,0,-10), "RightHand": (-10,8,12), "LeftArm": (-30,2,14), "LeftHand": (-6,-5,-10), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.22, {"RightArm": (-78,-8,-42), "RightHand": (-22,22,34), "LeftArm": (-48,0,28), "LeftHand": (-12,-8,-18), "Chest": (-2,0,-3), "HipsT": (0,0,0)}), (0.36, {"RightArm": (-26,10,58), "RightHand": (-2,-22,-28), "LeftArm": (-36,4,28), "LeftHand": (-10,2,-16), "Chest": (2,0,3), "HipsT": (0,0,0)}), (0.70, {"RightArm": (-34,6,20), "RightHand": (-8,-8,-8), "LeftArm": (-28,2,18), "LeftHand": (-7,-4,-10), "Chest": (1,0,1), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-38,2,-8), "RightHand": (-10,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyWeaponDraw_Aligned_30": {
        "duration": 0.42, "category": "melee_draw", "timing": {"windupMs": 80, "impactMs": 220, "recoveryMs": 120},
        "keys": [(0.00, {"RightArm": (-8,14,-40), "RightHand": (18,30,45), "LeftArm": (-12,0,8), "LeftHand": (0,0,0), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.35, {"RightArm": (-44,8,-24), "RightHand": (-18,18,22), "LeftArm": (-20,0,10), "LeftHand": (-4,-4,-8), "Chest": (0,0,-1), "HipsT": (0,0,0)}), (0.75, {"RightArm": (-34,4,10), "RightHand": (-8,-8,-4), "LeftArm": (-24,0,12), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-38,2,-8), "RightHand": (-10,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyWeaponSheathe_Aligned_30": {
        "duration": 0.42, "category": "melee_sheathe", "timing": {"windupMs": 80, "impactMs": 180, "recoveryMs": 160},
        "keys": [(0.00, {"RightArm": (-38,2,-8), "RightHand": (-10,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.40, {"RightArm": (-30,8,-32), "RightHand": (10,24,38), "LeftArm": (-18,0,8), "LeftHand": (0,0,0), "Chest": (0,0,-1), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-8,14,-40), "RightHand": (18,30,45), "LeftArm": (-12,0,8), "LeftHand": (0,0,0), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyWeaponBlock_Aligned_30": {
        "duration": 0.44, "category": "block", "timing": {"windupMs": 70, "impactMs": 110, "recoveryMs": 260},
        "keys": [(0.0, {"RightArm": (-32,0,-8), "RightHand": (-8,0,8), "LeftArm": (-34,0,16), "LeftHand": (-12,0,-18), "Chest": (-1,0,0), "HipsT": (0,0,0)}), (0.25, {"RightArm": (-46,0,18), "RightHand": (-18,-8,-10), "LeftArm": (-62,-2,34), "LeftHand": (-20,-10,-32), "Chest": (-1,0,0), "HipsT": (0,0,0)}), (1.0, {"RightArm": (-46,0,18), "RightHand": (-18,-8,-10), "LeftArm": (-62,-2,34), "LeftHand": (-20,-10,-32), "Chest": (-1,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyShieldBash_Aligned_30": {
        "duration": 0.62, "category": "shield_bash", "timing": {"windupMs": 120, "impactMs": 220, "recoveryMs": 280},
        "keys": [(0.00, {"RightArm": (-34,0,0), "RightHand": (-4,0,0), "LeftArm": (-55,0,30), "LeftHand": (-15,-8,-26), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.32, {"RightArm": (-32,0,4), "RightHand": (-4,0,0), "LeftArm": (-74,0,18), "LeftHand": (-20,-6,-28), "Chest": (0,0,1), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-34,0,0), "RightHand": (-4,0,0), "LeftArm": (-55,0,30), "LeftHand": (-15,-8,-26), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyRangedDraw_Aligned_30": {
        "duration": 0.90, "category": "ranged_draw", "timing": {"windupMs": 180, "impactMs": 300, "recoveryMs": 420},
        "keys": [(0.00, {"RightArm": (-35,0,-10), "RightHand": (-8,0,8), "LeftArm": (-36,0,14), "LeftHand": (-8,0,-12), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.45, {"RightArm": (-50,-12,-48), "RightHand": (-12,20,32), "LeftArm": (-64,0,20), "LeftHand": (-18,-8,-18), "Chest": (0,0,-1), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-50,-12,-48), "RightHand": (-12,20,32), "LeftArm": (-64,0,20), "LeftHand": (-18,-8,-18), "Chest": (0,0,-1), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyRangedRelease_Aligned_30": {
        "duration": 0.72, "category": "ranged_release", "timing": {"windupMs": 80, "impactMs": 160, "recoveryMs": 420},
        "keys": [(0.00, {"RightArm": (-50,-12,-48), "RightHand": (-12,20,32), "LeftArm": (-64,0,20), "LeftHand": (-18,-8,-18), "Chest": (0,0,-1), "HipsT": (0,0,0)}), (0.22, {"RightArm": (-42,-4,-16), "RightHand": (-8,0,8), "LeftArm": (-62,0,18), "LeftHand": (-16,-6,-18), "Chest": (0,0,0), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-36,0,-8), "RightHand": (-6,0,4), "LeftArm": (-38,0,12), "LeftHand": (-8,-4,-10), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyRangedReload_Aligned_30": {
        "duration": 0.84, "category": "ranged_reload", "timing": {"windupMs": 160, "impactMs": 320, "recoveryMs": 360},
        "keys": [(0.00, {"RightArm": (-26,0,-20), "RightHand": (4,12,20), "LeftArm": (-36,0,16), "LeftHand": (-6,0,-10), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.44, {"RightArm": (-42,-8,-28), "RightHand": (-8,18,26), "LeftArm": (-46,0,22), "LeftHand": (-10,-4,-14), "Chest": (0,0,-1), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-34,0,-8), "RightHand": (-6,0,4), "LeftArm": (-36,0,12), "LeftHand": (-6,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyMagicCast_Aligned_30": {
        "duration": 1.12, "category": "magic_cast", "timing": {"windupMs": 220, "impactMs": 380, "recoveryMs": 520},
        "keys": [(0.00, {"RightArm": (-28,0,-8), "RightHand": (-6,8,8), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.34, {"RightArm": (-64,0,18), "RightHand": (-20,-12,-16), "LeftArm": (-54,0,-18), "LeftHand": (-16,12,16), "Chest": (-1,0,0), "HipsT": (0,0,0)}), (0.52, {"RightArm": (-54,8,34), "RightHand": (-12,-18,-22), "LeftArm": (-48,-8,-34), "LeftHand": (-12,18,22), "Chest": (0,0,0), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-30,0,-6), "RightHand": (-6,6,8), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyMagicChannel_Aligned_30": {
        "duration": 1.0, "category": "magic_channel", "timing": {"windupMs": 0, "impactMs": 0, "recoveryMs": 0},
        "keys": [(0.00, {"RightArm": (-56,0,20), "RightHand": (-15,-12,-18), "LeftArm": (-52,0,-20), "LeftHand": (-15,12,18), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.50, {"RightArm": (-58,2,22), "RightHand": (-16,-14,-20), "LeftArm": (-54,-2,-22), "LeftHand": (-16,14,20), "Chest": (-0.5,0,0), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-56,0,20), "RightHand": (-15,-12,-18), "LeftArm": (-52,0,-20), "LeftHand": (-15,12,18), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyToolUse_Aligned_30": {
        "duration": 0.92, "category": "tool_use", "timing": {"windupMs": 180, "impactMs": 360, "recoveryMs": 420},
        "keys": [(0.00, {"RightArm": (-38,0,-8), "RightHand": (-8,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.28, {"RightArm": (-88,-6,-22), "RightHand": (-25,18,28), "LeftArm": (-52,0,18), "LeftHand": (-14,-8,-12), "Chest": (-2,0,-2), "HipsT": (0,0,0)}), (0.46, {"RightArm": (-22,8,32), "RightHand": (0,-16,-22), "LeftArm": (-40,2,18), "LeftHand": (-8,0,-10), "Chest": (2,0,2), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-38,0,-8), "RightHand": (-8,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyToolHeavyUse_Aligned_30": {
        "duration": 1.08, "category": "tool_heavy_use", "timing": {"windupMs": 240, "impactMs": 440, "recoveryMs": 400},
        "keys": [(0.00, {"RightArm": (-38,0,-8), "RightHand": (-8,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.32, {"RightArm": (-94,-8,-32), "RightHand": (-30,22,34), "LeftArm": (-60,0,24), "LeftHand": (-18,-8,-16), "Chest": (-3,0,-3), "HipsT": (0,0,0)}), (0.52, {"RightArm": (-18,10,42), "RightHand": (2,-20,-28), "LeftArm": (-44,2,22), "LeftHand": (-10,0,-12), "Chest": (2,0,3), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-38,0,-8), "RightHand": (-8,8,10), "LeftArm": (-24,0,8), "LeftHand": (-4,-4,-8), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
    "HarthmereBodyItemUse_Aligned_30": {
        "duration": 0.72, "category": "item_use", "timing": {"windupMs": 120, "impactMs": 260, "recoveryMs": 300},
        "keys": [(0.00, {"RightArm": (-24,0,-8), "RightHand": (0,10,12), "LeftArm": (-16,0,4), "LeftHand": (0,0,0), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.36, {"RightArm": (-72,8,-6), "RightHand": (-24,18,8), "LeftArm": (-18,0,4), "LeftHand": (0,0,0), "Chest": (0,0,0), "HipsT": (0,0,0)}), (0.70, {"RightArm": (-56,4,-4), "RightHand": (-14,8,4), "LeftArm": (-18,0,4), "LeftHand": (0,0,0), "Chest": (0,0,0), "HipsT": (0,0,0)}), (1.00, {"RightArm": (-24,0,-8), "RightHand": (0,10,12), "LeftArm": (-16,0,4), "LeftHand": (0,0,0), "Chest": (0,0,0), "HipsT": (0,0,0)})],
    },
}

def smoothstep(x):
    x=max(0.0,min(1.0,x)); return x*x*(3-2*x)
def lerp(a,b,t): return a+(b-a)*t
def euler_to_quat(rx_deg, ry_deg, rz_deg):
    rx,ry,rz=[math.radians(v) for v in (rx_deg,ry_deg,rz_deg)]
    cx,sx=math.cos(rx/2),math.sin(rx/2); cy,sy=math.cos(ry/2),math.sin(ry/2); cz,sz=math.cos(rz/2),math.sin(rz/2)
    x=sx*cy*cz + cx*sy*sz; y=cx*sy*cz - sx*cy*sz; z=cx*cy*sz + sx*sy*cz; w=cx*cy*cz - sx*sy*sz
    l=math.sqrt(x*x+y*y+z*z+w*w) or 1.0
    return [x/l,y/l,z/l,w/l]
def interpolate_pose(keys,u):
    keys=sorted(keys,key=lambda k:k[0])
    if u<=keys[0][0]: return keys[0][1]
    if u>=keys[-1][0]: return keys[-1][1]
    for (u0,p0),(u1,p1) in zip(keys,keys[1:]):
        if u0<=u<=u1:
            t=smoothstep((u-u0)/(u1-u0 if u1!=u0 else 1)); out={}
            for name in set(p0)|set(p1):
                a=p0.get(name,p1.get(name)); b=p1.get(name,p0.get(name))
                out[name]=tuple(lerp(float(a[i]),float(b[i]),t) for i in range(3))
            return out
    return keys[-1][1]
def decode_buffer(buf):
    uri=buf.get('uri','')
    if uri.startswith('data:'): return bytearray(base64.b64decode(uri.split(',',1)[1]))
    raise RuntimeError('Only embedded data URI body-variant GLTFs are supported')
def encode_buffer(buf,data):
    buf['uri']='data:application/octet-stream;base64,'+base64.b64encode(bytes(data)).decode('ascii'); buf['byteLength']=len(data)
def align4(data):
    while len(data)%4: data.append(0)
def add_accessor(gltf,blob,floats,typ):
    align4(blob); offset=len(blob); blob.extend(struct.pack('<%df'%len(floats),*floats))
    gltf.setdefault('bufferViews',[]).append({'buffer':0,'byteOffset':offset,'byteLength':len(floats)*4})
    bv=len(gltf['bufferViews'])-1; comps={'SCALAR':1,'VEC3':3,'VEC4':4}[typ]; count=len(floats)//comps
    rows=[floats[i:i+comps] for i in range(0,len(floats),comps)]
    gltf.setdefault('accessors',[]).append({'bufferView':bv,'componentType':5126,'count':count,'type':typ,'min':[min(r[i] for r in rows) for i in range(comps)],'max':[max(r[i] for r in rows) for i in range(comps)]})
    return len(gltf['accessors'])-1
def node_index(gltf,name):
    for i,n in enumerate(gltf.get('nodes',[])):
        if n.get('name')==name: return i
    return None
def clip_arrays(spec):
    duration=float(spec['duration']); times=[duration*i/(FRAME_COUNT-1) for i in range(FRAME_COUNT)]; outputs={}
    for t in times:
        pose=interpolate_pose(spec['keys'],t/duration if duration else 0)
        for name,val in pose.items(): outputs.setdefault(name,[]).append(val)
    return times,outputs
def remove_existing(gltf):
    gltf['animations']=[a for a in gltf.get('animations',[]) if not (a.get('name','').startswith('HarthmereBody') and a.get('name','').endswith('_Aligned_30'))]
def add_clip(gltf,blob,name,spec):
    times,outs=clip_arrays(spec); time_acc=add_accessor(gltf,blob,times,'SCALAR'); channels=[]; samplers=[]
    for key,node_name,path in [('HipsT','Hips','translation'),('Chest','Chest','rotation'),('RightArm','RightArm','rotation'),('RightHand','RightHand','rotation'),('LeftArm','LeftArm','rotation'),('LeftHand','LeftHand','rotation')]:
        idx=node_index(gltf,node_name)
        if idx is None or key not in outs: continue
        vals=[]
        if path=='translation':
            for v in outs[key]: vals.extend(v)
            out_acc=add_accessor(gltf,blob,vals,'VEC3')
        else:
            for e in outs[key]: vals.extend(euler_to_quat(*e))
            out_acc=add_accessor(gltf,blob,vals,'VEC4')
        samplers.append({'input':time_acc,'output':out_acc,'interpolation':'LINEAR'})
        channels.append({'sampler':len(samplers)-1,'target':{'node':idx,'path':path}})
    impact_ms=spec['timing'].get('impactMs',0); impact_frame=round((impact_ms/1000)/spec['duration']*(FRAME_COUNT-1)) if spec['duration'] else 0
    gltf.setdefault('animations',[]).append({'name':name,'samplers':samplers,'channels':channels,'extras':{VERSION:True,'frameCount':FRAME_COUNT,'fps':FPS,'durationSeconds':spec['duration'],'category':spec['category'],'timing':spec['timing'],'impactFrame':max(0,min(FRAME_COUNT-1,impact_frame)),'bodyVariantCompatible':'all-size-and-color-variants','rootMotion':'locked','torsoPolicy':'stable-minimal-rotation'}})
def update_manifest(path):
    if not path.exists(): return
    data=json.load(open(path)); clips=list(data.get('clips',[]))
    for name in CLIPS:
        if name not in clips: clips.append(name)
    data['clips']=clips; data['clipCount']=len(clips); data['version']=VERSION; data['alignedBodyWeaponClipsV8']=list(CLIPS.keys()); data['alignedBodyWeaponFrameCount']=FRAME_COUNT
    path.write_text(json.dumps(data,indent=2),encoding='utf-8')
def main():
    root=Path(sys.argv[1] if len(sys.argv)>1 else os.getcwd()); variant_dir=root/'public/assets/harthmere/gltf/characters/player_body_variants'
    files=[p for p in sorted(variant_dir.glob('harthmere_player_*.gltf')) if 'manifest' not in p.name and 'action_animation' not in p.name]
    if not files: raise SystemExit(f'No player body variant GLTFs found under {variant_dir}')
    for p in files:
        gltf=json.load(open(p)); blob=decode_buffer(gltf['buffers'][0]); remove_existing(gltf)
        for name,spec in CLIPS.items(): add_clip(gltf,blob,name,spec)
        encode_buffer(gltf['buffers'][0],blob); gltf.setdefault('asset',{}).setdefault('extras',{})[VERSION]=True; gltf.setdefault('extras',{})[VERSION]={'clipCount':len(CLIPS),'frameCount':FRAME_COUNT,'fps':FPS}
        p.write_text(json.dumps(gltf,separators=(',',':')),encoding='utf-8')
    update_manifest(variant_dir/'harthmere_player_body_variants_manifest.json'); update_manifest(variant_dir/'harthmere_player_action_animation_manifest.json')
    print(f'PATCHED {len(files)} player body variants with {len(CLIPS)} aligned clips ({FRAME_COUNT} frames each).')
if __name__=='__main__': main()
