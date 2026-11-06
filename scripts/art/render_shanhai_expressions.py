"""Original expression portraits rendered from the game's exact facial morphs.
blender -b --python scripts/art/render_shanhai_expressions.py
"""
import bpy,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];out=R/'public/shanhai/portraits'
for kind,name in ([('builder','taoning')] if '--builder-only' in sys.argv else [('courier','ayu'),('botanist','qinghe'),('cartographer','xingluo')]):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(R/f'public/shanhai/models/character-{kind}.glb'))
 for o in bpy.context.scene.objects:
  if o.animation_data:
   o.animation_data.action=None
   for t in o.animation_data.nla_tracks:t.mute=True
 faces=[o for o in bpy.context.scene.objects if o.type=='MESH' and o.data.shape_keys]
 assert faces and all(all(m in o.data.shape_keys.key_blocks for m in ['happy','concern','surprise']) for o in faces)
 bpy.ops.object.camera_add(location=(.5,-4,1.85));cam=bpy.context.object;target=Vector((0,-.025,1.30));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.18 if kind=='cartographer' else 1.0;bpy.context.scene.camera=cam
 for loc,power,size in [((-3,-4,6),550,4),((4,-2,4),350,4),((0,3,4),500,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.size=size;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False;s.world.color=(.3,.3,.3);s.view_settings.view_transform='AgX';s.render.film_transparent=True;s.render.resolution_x=256;s.render.resolution_y=256;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.frame_set(0)
 for mood in ['happy','concern','surprise']:
  for o in faces:
   for m in ['happy','concern','surprise']:o.data.shape_keys.key_blocks[m].value=float(m==mood)
  s.render.filepath=str(out/f'{name}-{mood}.png');bpy.ops.render.render(write_still=True)
print('Rendered original expression portraits from runtime models.')
