"""Render the board's original residential progression and the LV5 purchase preview."""
import bpy
from pathlib import Path
from mathutils import Vector
root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
for pack in ['residences','harbor-tower']:
    bpy.ops.import_scene.gltf(filepath=str(root/f'public/shanhai/models/{pack}.glb'))
bpy.ops.import_scene.gltf(filepath=str(root/'public/assets/models/city-landmarks.glb'))
houses=[bpy.data.objects[key] for key in ['res_harbor_1','res_harbor_2','board_villa','board_apartment','res_harbor_5']]
for obj in bpy.context.scene.objects:
    if obj.type=='MESH':
        obj.hide_render=not any(obj == house or obj in house.children_recursive for house in houses)
for i,house in enumerate(houses):
    house.location.x=i*3.6
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_cavity=True
scene.display.shading.show_shadows=True
scene.render.resolution_percentage=100
def render(target,offset,scale,size,path):
    bpy.ops.object.camera_add(location=Vector(target)+Vector(offset))
    cam=bpy.context.object
    cam.rotation_euler=(-Vector(offset)).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale=scale
    scene.camera=cam
    scene.render.resolution_x,scene.render.resolution_y=size
    scene.render.filepath=path
    bpy.ops.render.render(write_still=True)
for i,offset in enumerate([(4,-18,9),(-3,-18,8)]):
    render((7.2,0,2.9),offset,19,(1000,450),f'/tmp/daf-houses-{i}.png')
for house in houses[:-1]:
    house.hide_render=True
    for obj in house.children_recursive: obj.hide_render=True
scene.render.film_transparent=True
render((14.4,0,3),(5,-9,5),7.3,(320,320),'/tmp/daf-tower-preview.png')
