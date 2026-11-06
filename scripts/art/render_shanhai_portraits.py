"""Render transparent portraits directly from original Shanhai character GLBs.
Run: blender -b --python scripts/art/render_shanhai_portraits.py
No post-processing or external artwork.
"""
import bpy,sys
from pathlib import Path
from mathutils import Vector
R=Path(__file__).resolve().parents[2];out=R/'public/shanhai/portraits';out.mkdir(parents=True,exist_ok=True)
for kind,name in ([('builder','taoning')] if '--builder-only' in sys.argv else [('cartographer','xingluo')] if '--cartographer-only' in sys.argv else [('courier','ayu'),('botanist','qinghe')]):
 bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
 bpy.ops.import_scene.gltf(filepath=str(R/f'public/shanhai/models/character-{kind}.glb'))
 for o in bpy.context.scene.objects:
  if o.animation_data:
   o.animation_data.action=None
   for t in o.animation_data.nla_tracks:t.mute=True
 bpy.ops.object.camera_add(location=(1.1,-4,2.05));cam=bpy.context.object;target=Vector((0,-.025,1.30));cam.rotation_euler=(target-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=1.25 if kind=='cartographer' else 1.02;bpy.context.scene.camera=cam
 for loc,power,size in [((-3,-4,6),550,4),((4,-2,4),350,4),((0,3,4),500,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.size=size;l.rotation_euler=(target-l.location).to_track_quat('-Z','Y').to_euler()
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64 if kind=='cartographer' else 128;s.cycles.use_denoising=False;s.world.color=(.3,.3,.3);s.view_settings.view_transform='AgX';s.render.film_transparent=True;s.render.resolution_x=320;s.render.resolution_y=320;s.render.resolution_percentage=100;s.render.image_settings.file_format='PNG';s.render.image_settings.color_mode='RGBA';s.render.filepath=str(out/f'{name}.png');s.frame_set(0);bpy.ops.render.render(write_still=True)
