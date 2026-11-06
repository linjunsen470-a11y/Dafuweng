"""Original old-town exchange for the existing main-game stock tile 32.
Run: blender -b -t 4 --python scripts/art/create_old_town.py
All geometry and colors authored here; no external images, fonts or models.
"""
import bpy, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
palette={'sand':'DCC4A0','ivory':'FFF0CC','coral':'9D6449','teal':'526963','glass':'385D70','gold':'E7B552','stone':'BEBCA5'}
materials={};parts=[];manifest=[]
license='Original project artwork; owner may use, modify and redistribute. No external assets, textures or fonts.'
for name,color in palette.items():
 m=bpy.data.materials.new(name);m.use_nodes=True
 rgb=tuple(((int(color[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,)
 m.diffuse_color=rgb;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgb
 m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.8;materials[name]=m
def box(name,xyz,size,mat):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(materials[mat]);parts.append(o);return o
def cylinder(name,xyz,r,h,mat,vertices=12):
 bpy.ops.mesh.primitive_cylinder_add(vertices=vertices,radius=r,depth=h,location=xyz);o=bpy.context.object;o.name=name;o.data.materials.append(materials[mat]);parts.append(o);return o
def finish(name):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name=name+'_mesh'
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 root=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(root);mesh.parent=root;root['license']=license
 mesh.data.calc_loop_triangles();manifest.append({'prefab':name,'triangles':len(mesh.data.loop_triangles),'size_xyz_blender':list(mesh.dimensions)})
 parts.clear()

# Brick merchant hall with arcade and a small market clock.
box('stone hall base',(0,0,.09),(4.2,3.0,.18),'stone')
box('merchant hall walls',(0,.12,1.38),(3.8,2.5,2.4),'sand')
box('brick lower course',(0,.12,.37),(3.85,2.55,.36),'coral')
box('entry doors',(0,-1.15,1.18),(1.20,.05,1.75),'glass')
box('entry lintel',(0,-1.25,2.2),(1.5,.16,.15),'ivory')
for x in [-1.55,-.76,.76,1.55]:
 cylinder('arcade pillar',(x,-1.30,1.32),.105,2.15,'ivory')
 box('pillar foot',(x,-1.30,.29),(.32,.32,.20),'stone')
for x in [-1.35,1.35]:
 box('trading room window',(x,-1.15,1.32),(.65,.05,1.1),'glass')
 for z in [.8,1.32,1.84]:box('window bar',(x,-1.19,z),(.74,.04,.045),'ivory')
for x in [-1.93,1.93]:
 for y in [-.6,.35,.9]:box('side clerestory',(x,y,1.52),(.05,.46,.9),'glass')
box('brick cornice',(0,0,2.62),(4.15,2.85,.18),'coral')
data=bpy.data.meshes.new('hipped roof geometry')
verts=[(-2.075,-1.45,2.71),(2.075,-1.45,2.71),(2.075,1.45,2.71),(-2.075,1.45,2.71),(-1.3,-.8,3.19),(1.3,-.8,3.19),(1.3,.8,3.19),(-1.3,.8,3.19)]
data.from_pydata(verts,[],[(0,1,5,4),(1,2,6,5),(2,3,7,6),(3,0,4,7),(4,5,6,7),(3,2,1,0)]);data.update()
o=bpy.data.objects.new('patinated hipped roof',data);bpy.context.collection.objects.link(o);o.data.materials.append(materials['teal']);parts.append(o)
box('clock dormer',(0,-.98,3.42),(1.02,.62,1.12),'ivory')
box('clock cap',(0,-.98,4.02),(1.2,.78,.14),'teal')
o=cylinder('clock face',(0,-1.32,3.5),.32,.055,'glass',24);o.rotation_euler.x=math.pi/2
box('minute hand',(0,-1.36,3.61),(.035,.025,.22),'gold')
box('hour hand',(.09,-1.36,3.5),(.18,.025,.035),'gold')
finish('old_town_exchange')
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'old-town.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'old-town.blend'))
data={'asset':'old-town.glb','generator':'scripts/art/create_old_town.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'old-town.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
