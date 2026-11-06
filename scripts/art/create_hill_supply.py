"""Original mountain supply pavilion for existing card shop102, no external assets.
Run: blender -b -t 4 --python scripts/art/create_hill_supply.py
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

# A low timber supply shop with a shaded card counter and paired sloping roofs.
box('stone terrace',(0,0,.12),(3.8,3.2,.24),'stone')
box('supply room',(0,.4,1.1),(2.9,2.0,1.8),'ivory')
box('counter',(0,-.75,.85),(2.6,.5,.8),'coral')
for x in [-1.55,1.55]:box('veranda post',(x,-1.25,1.22),(.16,.16,2.25),'coral')
for x in [-.85,.85]:
 roof=box('sloped green roof',(x,0,2.45),(1.9,3.1,.18),'teal');roof.rotation_euler[1]=(-1 if x<0 else 1)*.20
for x in [-.8,0,.8]:
 box('card display',(x,-1.03,1.55),(.4,.08,.55),'glass')
 box('card emblem',(x,-1.08,1.57),(.16,.03,.22),'gold')
box('rear window',(0,1.43,1.3),(1.6,.08,.8),'glass')
for x in [-.6,.6]:box('roof ridge cap',(x,.1,2.7),(.8,.45,.12),'ivory')
box('supply crate',(1.3,.95,.45),(.65,.7,.65),'coral')
box('crate strap',(1.3,.95,.79),(.15,.72,.05),'gold')
finish('hill_supply_pavilion')
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'hill-supply.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'hill-supply.blend'))
data={'asset':'hill-supply.glb','generator':'scripts/art/create_hill_supply.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'hill-supply.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
