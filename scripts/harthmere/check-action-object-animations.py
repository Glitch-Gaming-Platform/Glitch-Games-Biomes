#!/usr/bin/env python3
from pathlib import Path
import json, sys
root = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else Path(__file__).resolve().parent
manifest = root / 'harthmere-action-object-animation-manifest.json'
data = json.loads(manifest.read_text())
expected = {'tools':16,'interactives':68,'creatures':64,'food':137}
counts = {k:0 for k in expected}
for e in data:
    counts[e['group']] = counts.get(e['group'],0)+1
    p = root / e['outputGltf']
    assert p.exists(), f'missing {p}'
    g = json.loads(p.read_text())
    anims = {a.get('name') for a in g.get('animations', [])}
    for a in e['animations']:
        assert a in anims, f'{e["id"]} missing {a}'
    # All generated clips should use 24 timestamps.
    for a in g.get('animations', []):
        if not a.get('name','').endswith('_24'):
            continue
        sampler = a['samplers'][0]
        acc = g['accessors'][sampler['input']]
        assert acc['count'] == 24, f'{e["id"]}:{a.get("name")} count={acc["count"]}'
assert counts == expected, f'counts mismatch {counts}'
print('OK manifest has expected category counts')
print('OK every output GLTF exists')
print('OK every generated animation uses 24 keyframes')
print('RESULT: PASS')
