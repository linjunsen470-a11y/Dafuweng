"""Render optimized runtime GLBs using the source studio lighting."""
import bpy,os
from pathlib import Path
R=Path(__file__).resolve().parents[2]
bpy.ops.wm.open_mainfile(filepath=str(R/'art-source/shanhai/characters.blend'))
for o in list(bpy.data.objects):
 if o.name.startswith(('courier_','botanist_')):bpy.data.objects.remove(o,do_unlink=True)
for kind,x in [('courier',-.65),('botanist',.65)]:
 before=set(bpy.data.objects);bpy.ops.import_scene.gltf(filepath=str(R/f'public/shanhai/models/character-{kind}.glb'))
 imported=set(bpy.data.objects)-before
 for o in imported:
  if o.parent is None:o.location.x+=x
  if o.animation_data:
   o.animation_data.action=None
   for track in o.animation_data.nla_tracks:track.mute=True
s=bpy.context.scene;s.frame_set(0);s.cycles.samples=32;s.render.filepath=str(R/'art-source/shanhai/characters-optimized-preview.png');bpy.ops.render.render(write_still=True)
