"""An original wind-riding fox with paper-kite wings and a flame-tipped brush."""
from pathlib import Path
from math import cos, sin, tau
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def paint(name, rgb):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*rgb, 1)
    m.use_nodes = True
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value = m.diffuse_color
    return m

fur = paint('Persimmon', (.80,.18,.045))
cream = paint('Porcelain', (.99,.78,.47))
ink = paint('Indigo', (.028,.055,.085))
jade = paint('Lagoon silk', (.015,.39,.36))
gold = paint('Saffron', (.96,.53,.065))

def sculpt(name, rings, material, sides=16):
    verts = [(x+w*cos(i*tau/sides), y+d*sin(i*tau/sides), z)
             for x,y,z,w,d in rings for i in range(sides)]
    faces = [tuple(reversed(range(sides)))]
    for k in range(len(rings)-1):
        for i in range(sides):
            a=k*sides+i; b=k*sides+(i+1)%sides
            faces.append((a,b,b+sides,a+sides))
    faces.append(tuple(range(len(verts)-sides,len(verts))))
    mesh=bpy.data.meshes.new(name); mesh.from_pydata(verts,[],faces); mesh.update()
    obj=bpy.data.objects.new(name,mesh);scene.collection.objects.link(obj)
    mesh.materials.append(material)
    for face in mesh.polygons: face.use_smooth=True

def oval(name, center, scale, material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=center)
    obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.data.materials.append(material)
    for face in obj.data.polygons: face.use_smooth=True

sculpt('Pouncing body',[(0,.08,.15,.19,.24),(0,.20,.44,.41,.56),(0,.12,.78,.49,.63),(0,-.06,1.06,.36,.41)],fur)
sculpt('Snow chest',[(0,-.38,.42,.06,.04),(0,-.40,.72,.26,.14),(0,-.38,.97,.30,.15)],cream)
sculpt('Broad cheek mask',[(0,-.38,.96,.20,.20),(0,-.41,1.14,.49,.38),(0,-.39,1.40,.51,.40),(0,-.34,1.55,.34,.26)],fur)
oval('Muzzle',(0,-.72,1.12),(.27,.21,.14),cream)
oval('Nose',(0,-.90,1.19),(.095,.061,.057),ink)
for sign in [-1,1]:
    s=sign
    sculpt('Tufted ear',[(s*.31,-.33,1.42,.21,.14),(s*.39,-.32,1.65,.14,.09),(s*.49,-.29,1.90,.012,.012)],fur)
    sculpt('Ear lining',[(s*.37,-.424,1.50,.105,.035),(s*.40,-.40,1.65,.075,.032),(s*.46,-.35,1.80,.01,.01)],ink)
    oval('Cheek ruff',(s*.35,-.65,1.16),(.19,.082,.098),cream)
    oval('Eye',(s*.23,-.742,1.32),(.079,.045,.091),ink)
    oval('Eye glint',(s*.23-.017,-.779,1.35),(.024,.012,.026),cream)
    for y,z in [(-.27,.14),(.50,.20)]:
        sculpt('Booted paw',[(s*.28,y-.07,z,.13,.19),(s*.31,y,z+.10,.145,.16),(s*.32,y+.07,z+.34,.10,.13)],ink)
    for i in range(3):
        reach=1.23-i*.17; sweep=.00+i*.25
        sculpt('Kite feather',[(s*.31,.04,.80,.12,.18),(s*.57,.18+sweep,1.02,.22,.23),
               (s*(reach-.17),.22+sweep,1.24,.15,.16),(s*reach,.29+sweep,1.54-i*.11,.01,.012)],jade if i!=1 else gold,8)
sculpt('Swept brush',[(0,.54,.46,.14,.16),(.23,.83,.56,.22,.23),(.48,1.02,.75,.27,.28),(.66,1.11,.98,.26,.24)],fur)
sculpt('Flame tail tip',[(.66,1.11,.98,.26,.24),(.78,1.13,1.17,.21,.18),(.83,1.08,1.32,.13,.12),(.82,.97,1.53,.012,.015)],cream)

bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.join()
bpy.context.object.name='Kite Fox'
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/kite-fox.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/kite-fox.glb'),export_format='GLB')
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
scene.render.resolution_x=scene.render.resolution_y=360;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=3.05
for i,pos in enumerate([(2,-4,2.2),(-3,2.5,2.1)]):
    cam.location=pos;cam.rotation_euler=(Vector((0,.05,.95))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/kite-fox-{i}.png';bpy.ops.render.render(write_still=True)
