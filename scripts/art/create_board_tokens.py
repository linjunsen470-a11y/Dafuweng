"""Original wind-up toy and cartoon road markers for the main board."""
from pathlib import Path
import bpy
import math
from mathutils import Vector

root=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
paints={}
for name,value in {'tomato':'ea6251','cream':'fff1cf','ocean':'268d98','ink':'364557','brass':'f5bb52','lamp':'ff9462'}.items():
    material=bpy.data.materials.new(name)
    material.diffuse_color=tuple((int(value[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,)
    paints[name]=material
def part(name,pos,color):
    obj=bpy.context.object
    obj.name=name
    obj.location=pos
    obj.data.materials.append(paints[color])
    pieces.append(obj)
    return obj
def box(name,pos,size,color):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj=part(name,pos,color)
    obj.dimensions=size
    bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
    bevel=obj.modifiers.new('toy edges','BEVEL')
    bevel.width=.055
    bevel.segments=3
    bpy.ops.object.modifier_apply(modifier=bevel.name)
    return obj
def round_part(name,pos,size,color):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
    obj=part(name,pos,color)
    obj.scale=size
    return obj
def ring(name,pos,r,color):
    bpy.ops.mesh.primitive_torus_add(major_segments=20,minor_segments=8,major_radius=r,minor_radius=.045)
    obj=part(name,pos,color)
    obj.rotation_euler.x=math.pi/2
    return obj
models=[]
for key in ['barrier','mine','timer','robot']:
    pieces=[]
    if key=='barrier':
        for x in [-.71,.71]:
            for sign in [-1,1]:
                foot=box('folding trestle',(x,sign*.16,.44),(.17,.13,.87),'ocean')
                foot.rotation_euler.x=sign*.38
        box('striped gate',(0,-.06,.72),(1.94,.23,.41),'cream')
        for x in [-.67,-.22,.23,.68]:
            stripe=box('candy stripe',(x,-.185,.72),(.19,.035,.38),'tomato')
            stripe.rotation_euler.y=-.35
        for x in [-.7,.7]: round_part('amber reflector',(x,-.03,1.04),(.12,.09,.12),'brass')
    elif key=='mine':
        round_part('jelly shell',(0,0,.35),(.59,.59,.29),'ocean')
        for i in range(6):
            a=i*math.tau/6
            round_part('rubber bumper',(.49*math.cos(a),.49*math.sin(a),.23),(.15,.15,.12),'brass')
        round_part('warning lens',(0,0,.66),(.21,.21,.18),'lamp')
        for x in [-.15,.15]: round_part('sleepy eye',(x,-.48,.39),(.055,.04,.07),'ink')
    elif key=='timer':
        box('alarm clock case',(0,0,.53),(.89,.46,.90),'tomato')
        face=round_part('clock dial',(0,-.235,.58),(.35,.065,.35),'cream')
        for a in range(12):
            t=math.tau*a/12
            round_part('minute dots',(.28*math.sin(t),-.293,.58+.28*math.cos(t)),(.027,.018,.027),'ink')
        box('minute hand',(0,-.31,.7),(.045,.03,.25),'ink')
        hand=box('hour hand',(.07,-.315,.6),(.16,.03,.045),'ink')
        hand.rotation_euler.y=-.35
        for x in [-.36,.36]:
            round_part('clock bell',(x,0,1.02),(.22,.20,.14),'brass')
            box('clock foot',(x,0,.13),(.20,.39,.19),'ink')
        round_part('warning lens',(0,0,1.09),(.09,.09,.12),'lamp')
    else:
        for x in [-.21,.21]:
            box('boot',(x,-.09,.15),(.29,.52,.25),'brass')
            box('short leg',(x,0,.36),(.16,.21,.26),'ink')
            round_part('mitten',(x*2.2,-.07,.59),(.16,.16,.19),'tomato')
        box('tin torso',(0,0,.66),(.68,.43,.54),'ocean')
        box('toy head',(0,-.025,1.19),(.75,.53,.57),'cream')
        box('smiling faceplate',(0,-.30,1.21),(.61,.045,.32),'ink')
        for x in [-.17,.17]: round_part('curious eye',(x,-.34,1.24),(.07,.03,.08),'brass')
        box('winding shaft',(0,.18,1.52),(.075,.09,.28),'brass')
        for x in [-.11,.11]: ring('winding key',(x,.18,1.68),.1,'brass')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in pieces: obj.select_set(True)
    bpy.context.view_layer.objects.active=pieces[0]
    bpy.ops.object.join()
    model=bpy.context.object
    model.name='token_'+key
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    models.append(model)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/board-tokens.glb'),export_format='GLB')
for i,model in enumerate(models): model.location.x=(i-1.5)*2.55
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/board-tokens.blend'))
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_cavity=True
scene.render.resolution_x=950
scene.render.resolution_y=275
scene.render.resolution_percentage=100
for i,offset in enumerate([(2,-12,6),(-2,-12,4)]):
    bpy.ops.object.camera_add(location=offset)
    cam=bpy.context.object
    cam.rotation_euler=(Vector((0,0,.8))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale=10.2
    scene.camera=cam
    scene.render.filepath=f'/tmp/daf-tokens-{i}.png'
    bpy.ops.render.render(write_still=True)
