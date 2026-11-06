"""Original computing courtyard for existing company tile89, no external assets.
Run: blender -b -t 4 --python scripts/art/create_company_court.py
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

# Public service hall: glass arcade, paired server fins and a circuit roof badge.
box('stone forecourt',(0,0,.10),(3.8,3.2,.20),'stone')
box('company hall',(0,.15,1.15),(3.35,2.55,2.0),'sand')
for y in [-1.15,1.45]:
 box('glazed frontage',(0,y,1.2),(2.75,.08,1.55),'glass')
 for x in [-1.1,0,1.1]:box('glazing mullion',(x,y*1.035,1.2),(.12,.13,1.7),'ivory')
for x in [-1.72,1.72]:box('server-side window',(x,.15,1.2),(.08,1.8,1.3),'glass')
box('floating canopy',(0,-.1,2.3),(3.8,3.0,.24),'teal')
for x in [-1.22,1.22]:
 box('server fin',(x,.4,2.8),(.44,1.6,.85),'teal')
 for z in [2.55,2.8,3.05]:box('cooling slit',(x,-.43,z),(.3,.06,.07),'gold')
box('roof circuit slab',(0,.15,2.5),(1.3,1.55,.18),'ivory')
for x in [-.4,0,.4]:
 box('circuit trace',(x,.15,2.61),(.07,1.1,.035),'teal')
 cylinder('circuit node',(x,-.32,2.65),.13,.07,'gold',8)
finish('company_cloud_court')
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'company-court.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'company-court.blend'))
data={'asset':'company-court.glb','generator':'scripts/art/create_company_court.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'company-court.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
