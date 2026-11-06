"""Original Tao Ning repairer, using the project's articulated toy-character base.
blender -b --python scripts/art/create_shanhai_builder.py
Optimize with optimize('builder',expressions=True); render both portrait scripts with --builder-only.
All geometry, colors and animations are authored in this project; no third-party artwork.
"""
import sys,os,json
sys.path.insert(0,os.path.dirname(__file__))
from create_shanhai_characters import character,OUT,SRC,bpy
root,meta=character('builder')
json.dump({'originalAuthorship':'Original project repairer, helmet, tools, outfit and shared original articulated base. No external artwork.','characters':[meta]},open(os.path.join(OUT,'builder-manifest.json'),'w'),ensure_ascii=False,indent=2)
bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC,'builder.blend'))
