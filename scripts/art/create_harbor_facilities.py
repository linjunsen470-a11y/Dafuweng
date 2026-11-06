"""Original public service street for the main game's existing tiles 7, 9, 12.
Run: blender -b -t 4 --python scripts/art/create_harbor_facilities.py
All geometry and colors authored here; no external images, fonts or models.
"""
import bpy, json, math
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT');bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
palette={'sand':'F1DEB6','ivory':'FFF0CC','coral':'C96E55','teal':'367E77','glass':'385D70','gold':'E7B552','stone':'BEBCA5'}
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

# Bank: broad stepped cornice, two portico columns and an original coin crest.
box('stone entry',(0,0,.09),(3.6,2.8,.18),'stone')
box('bank walls',(0,.13,1.2),(3.2,2.25,2.1),'sand')
box('lower step',(0,-1.19,.18),(2.35,.42,.18),'ivory')
box('glazed banking hall',(0,-1.015,1.1),(1.65,.04,1.6),'glass')
for x in [-1.28,1.28]:
 cylinder('portico column',(x,-1.13,1.12),.14,1.85,'ivory')
 box('capital',(x,-1.13,2.06),(.4,.4,.16),'ivory')
for x in [-1.62,1.62]:
 for y in [-.5,.35,.9]:box('side window',(x,y,1.25),(.04,.45,.88),'glass')
box('shadow cornice',(0,0,2.23),(3.55,2.65,.18),'coral')
box('teal parapet',(0,0,2.43),(3.3,2.42,.25),'teal')
box('roof ledge',(0,0,2.60),(3.5,2.6,.10),'ivory')
box('crest backing',(0,-.9,2.83),(.94,.18,.65),'teal')
coin=cylinder('coin crest',(0,-1.025,2.84),.24,.08,'gold');coin.rotation_euler.x=math.pi/2
box('coin slit',(0,-1.08,2.84),(.055,.035,.29),'sand')
finish('harbor_bank')

# Lottery: compact hexagonal canopy, ticket hatch and three gold number discs.
box('kiosk base',(0,0,.08),(2.65,2.35,.16),'stone')
box('ticket booth',(0,.15,1.04),(2.05,1.9,1.8),'ivory')
box('service hatch',(0,-.82,1.26),(1.65,.04,.85),'glass')
box('ticket counter',(0,-1.0,.84),(2.22,.55,.17),'teal')
for x in [-1.06,1.06]:box('coral corner',(x,.1,1.06),(.12,2.0,1.82),'coral')
bpy.ops.mesh.primitive_cone_add(vertices=4,radius1=1.87,radius2=.9,depth=.53,location=(0,.05,2.12),rotation=(0,0,math.pi/4))
o=bpy.context.object;o.name='folded kiosk roof';o.data.materials.append(materials['coral']);parts.append(o)
for x in [-.52,0,.52]:
 o=cylinder('number disc',(x,-1.0,2.25),.19,.08,'gold');o.rotation_euler.x=math.pi/2
box('ticket display',(.71,-.86,1.18),(.31,.06,.43),'sand')
box('ticket perforation',(.71,-.9,1.18),(.32,.02,.025),'coral')
finish('harbor_lottery')
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'harbor-facilities.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'harbor-facilities.blend'))
data={'asset':'harbor-facilities.glb','generator':'scripts/art/create_harbor_facilities.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'harbor-facilities.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
