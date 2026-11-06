"""Original reclaimed-materials hall for existing company tile99, no external assets.
Run: blender -b -t 4 --python scripts/art/create_summit_yard.py
"""
import bpy, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
palette={'sand':'D9E0DB','ivory':'F3EDCF','coral':'B86F50','teal':'317D88','glass':'385D70','gold':'E7B552','stone':'BDC6C2','leaf':'638F62'}
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

# A compact materials showroom: twin sawtooth roofs, stone sample racks and timber frames.
box('yard base',(0,0,.1),(3.8,3.2,.2),'stone')
box('brick workshop',(0,.15,1.1),(3.2,2.55,1.8),'coral')
for y in [-1.14,1.44]:
 box('showroom glass',(0,y,1.15),(2.8,.08,1.35),'glass')
 for x in [-1.25,0,1.25]:box('timber frame',(x,y*1.03,1.15),(.12,.14,1.65),'ivory')
for x in [-.87,.87]:
 roof=box('sawtooth roof',(x,.1,2.25),(1.8,2.95,.17),'teal');roof.rotation_euler[1]=-.22
 box('clerestory',(x+.72,.1,2.3),(.1,2.6,.45),'glass')
for x in [-1.35,1.35]:
 box('sample rack',(x,-1.35,.55),(.55,.4,.55),'ivory')
 for z in [.38,.64]:box('reclaimed stone',(x,-1.4,z),(.42,.38,.16),'stone')
box('roof emblem base',(0,0,2.7),(.6,.6,.15),'ivory')
for x,z in [(-.17,2.95),(.17,3.12)]:
 stone=box('stone emblem',(x,0,z),(.33,.33,.33),'gold');stone.rotation_euler[1]=.35
finish('company_summit_yard')
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'summit-yard.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'summit-yard.blend'))
data={'asset':'summit-yard.glb','generator':'scripts/art/create_summit_yard.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'summit-yard.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
