"""Original tide-routing pavilion for the existing main-game mechanism at tile 79.
Run: blender -b -t 4 --python scripts/art/create_return_gate.py
No external assets, fonts or textures.
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

# Low public pavilion with a split-arrow dial, canal-blue blades and a tide gauge.
box('stone apron',(0,0,.10),(3.4,3.1,.20),'stone')
box('routing hall',(0,.15,.9),(2.8,2.4,1.6),'sand')
for y in [-1.08,1.38]:
 box('public display',(0,y,1.05),(2.3,.06,.95),'glass')
 for x in [-.75,0,.75]:box('route marks',(x,y*1.02,1.05),(.12,.04,.55),'gold')
for x in [-1.46,1.46]:box('side glazing',(x,.15,1.05),(.06,1.8,.9),'glass')
box('shelter roof',(0,.1,1.86),(3.4,2.9,.22),'teal')
box('dial tower',(0,.5,2.6),(1.3,1.1,1.4),'ivory')
for y in [-.08,1.08]:
 o=cylinder('route dial',(0,y,2.7),.48,.08,'teal',16);o.rotation_euler.x=math.pi/2
 for sign in [-1,1]:
  arm=box('split arrow',(sign*.15,y*1.05,2.72),(.09,.12,.46),'gold');arm.rotation_euler.y=sign*-.6
box('crown beam',(0,.5,3.38),(1.65,1.45,.18),'teal')
for x in [-.55,0,.55]:box('tidal fins',(x,.5,3.65),(.16,1.2,.4),'gold')
finish('return_tide_gate')
bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'return-gate.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'return-gate.blend'))
data={'asset':'return-gate.glb','generator':'scripts/art/create_return_gate.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'return-gate.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
