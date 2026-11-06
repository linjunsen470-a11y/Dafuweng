"""Original Xingluo cartographer, using this project's articulated toy-character base.
blender -b --python scripts/art/create_shanhai_cartographer.py
Then optimize_shanhai_characters.py --cartographer-only, and render portraits with
blender -b --python scripts/art/render_shanhai_portraits.py -- --cartographer-only.
No third-party models, textures or samples.
"""
import sys,os,json
sys.path.insert(0,os.path.dirname(__file__))
from create_shanhai_characters import character,OUT,SRC,bpy
root,meta=character('cartographer')
json.dump({'originalAuthorship':'Original project cartographer; shared original base mesh and authored accessories/animation. No third-party source assets.','characters':[meta]},open(os.path.join(OUT,'cartographer-manifest.json'),'w'),ensure_ascii=False,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC,'cartographer.blend'))
