"""Rebuild all three optimized models with original sparse facial targets.
python3 scripts/art/create_shanhai_expressions.py
Reuses backed-up authored meshes; no Blender re-export or animation changes needed.
"""
import json
from optimize_shanhai_characters import optimize,SRC,OUT
results=[optimize(k,expressions=True) for k in ['courier','botanist','cartographer']]
(SRC/'expression-validation.json').write_text(json.dumps(results,indent=2)+'\n')
print(json.dumps([{k:v for k,v in r.items() if k!='clips'} for r in results],indent=2))

for filename in ['characters-manifest.json','cartographer-manifest.json']:
 p=OUT/filename;manifest=json.loads(p.read_text())
 for character in manifest['characters']:
  result=next(r for r in results if r['file']==character['file'])
  character['facialTargets']=result['facialTargets'];character['bytes']=result['bytes'];character['expressions']='Original sparse position morphs on the existing head; neutral geometry and body animation unchanged'
 p.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
