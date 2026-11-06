"""Original harbor level-five silhouette. No external art, textures or fonts.
blender -b -t 4 --python scripts/art/create_harbor_tower.py
"""
import bpy, json, math
from pathlib import Path
from mathutils import Vector
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
palette={'sand':'F5E5BD','ivory':'FFF2D5','coral':'D66D50','teal':'377F79','glass':'466B78','gold':'E8B95F','stone':'C6C5AD'}
materials={};parts=[]
for name,color in palette.items():
 m=bpy.data.materials.new(name);m.use_nodes=True
 rgb=tuple(((int(color[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,)
 m.diffuse_color=rgb;m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=rgb
 m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.7;materials[name]=m

def box(name,xyz,size,material):
 bpy.ops.mesh.primitive_cube_add(size=1,location=xyz);o=bpy.context.object;o.name=name;o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(materials[material]);parts.append(o);return o

def cone(name,xyz,r,h,material,top=0,vertices=8):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=top,depth=h,location=xyz)
 o=bpy.context.object;o.name=name;o.data.materials.append(materials[material]);parts.append(o);return o

# Three setbacks and a sail-like crown distinguish this from the four pitched-roof homes.
box('quayside plinth',(0,0,.08),(2.6,2.35,.16),'stone')
box('colonnade base',(0,0,.65),(2.35,2.05,1.15),'sand')
box('glazed entrance',(0,-1.04,.65),(1.65,.05,.85),'glass')
for x in [-1,-.5,0,.5,1]:box('arcade pilaster',(x,-1.1,.65),(.12,.15,1.15),'ivory')
box('terrace cornice',(0,0,1.27),(2.55,2.25,.16),'coral')
box('main tower',(0,0,2.7),(1.8,1.65,2.7),'sand')
for floor in range(5):
 z=1.55+floor*.5
 for x in [-.6,-.2,.2,.6]:
  box('front glazing',(x,-.835,z),(.27,.035,.32),'glass')
  box('rear glazing',(x,.835,z),(.27,.035,.32),'glass')
 for y in [-.5,0,.5]:
  for x in [-.915,.915]:box('side glazing',(x,y,z),(.035,.3,.32),'glass')
box('sky terrace',(0,0,4.10),(2.0,1.85,.18),'teal')
box('upper lantern',(0,.12,4.71),(1.15,1.1,1.10),'ivory')
for x in [-.38,0,.38]:box('lantern glazing',(x,-.445,4.71),(.23,.035,.80),'glass')
for x in [-.59,.59]:box('lantern side glazing',(x,.12,4.71),(.035,.72,.8),'glass')
cone('folded copper crown',(0,.12,5.52),.92,.7,'teal',vertices=4).rotation_euler.z=math.pi/4
cone('gold mast',(0,.12,6.05),.035,.55,'gold',top=.035)
cone('wind jewel',(0,.12,6.34),.12,.18,'gold',vertices=4)
# A small terrace rail makes the lower platform readable from the board camera.
for x in [-1.18,1.18]:box('terrace railing',(x,0,1.46),(.055,2.05,.23),'ivory')
for y in [-1.03,1.03]:box('terrace railing',(0,y,1.46),(2.35,.055,.23),'ivory')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();mesh=bpy.context.object;mesh.name='res_harbor_5_mesh'
bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
root=bpy.data.objects.new('res_harbor_5',None);bpy.context.collection.objects.link(root);mesh.parent=root;root.select_set(True)
license='Original project artwork; owner may use, modify and redistribute. No external assets, textures or fonts.'
root['license']=license
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'harbor-tower.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'harbor-tower.blend'))
mesh.data.calc_loop_triangles()
manifest={'asset':'harbor-tower.glb','generator':'scripts/art/create_harbor_tower.py','license':license,'prefab':'res_harbor_5','triangles':len(mesh.data.loop_triangles),'axes':'GLB Y-up, front +Z, origin ground center','size_xyz_blender':[2.6,2.35,6.43]}
(out/'harbor-tower.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n');print(json.dumps(manifest))
