"""Original civic street architecture for existing main-game tiles 57–68.
Run: blender -b -t 4 --python scripts/art/create_civic_street.py
All geometry and colors authored here; no external images, fonts or models.
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

# Four owned-home silhouettes: pavilion, courtyard block, setback apartments, slim crown.
for level,height in [(1,1.45),(2,2.65),(3,3.95),(4,5.45)]:
 box('property podium',(0,0,.1),(2.85,2.65,.2),'stone')
 box('ground shopfront',(0,0,.68),(2.65,2.35,1.1),'sand')
 box('entry glazing',(0,-1.19,.72),(1.55,.06,.9),'glass')
 box('rear glazing',(0,1.19,.72),(1.55,.06,.65),'glass')
 box('sheltered entry',(0,-1.33,1.28),(2.8,.30,.14),'teal')
 for x in [-1.16,1.16]:box('entry pier',(x,-1.19,.72),(.16,.17,1.15),'ivory')
 if level>1:
  width=2.55 if level==2 else 2.08 if level==3 else 1.72
  box('upper residence',(0,.13,(height+1.3)/2),(width,2.1,height-1.3),'sand')
  for z in [1.7+i*.78 for i in range(level)]:
   for x in [-width*.27,width*.27]:
    box('front apartment window',(x,-.94,z),(.54,.06,.48),'glass')
    box('rear apartment window',(x,1.20,z),(.54,.06,.48),'glass')
   for x in [-width/2-.025,width/2+.025]:box('side ribbon window',(x,.12,z),(.05,1.42,.48),'glass')
  box('slim vertical fin',(-width/2+.08,-1.0,(height+1.3)/2),(.16,.16,height-1.15),'teal')
 box('roof cornice',(0,.1,height),(2.85 if level==1 else width+.2,2.38,.16),'ivory')
 if level==4:
  box('stepped crown',(.30,.15,height+.32),(.8,1.25,.55),'teal')
  box('crown blade',(.30,.15,height+.67),(.18,.8,.20),'gold')
 else:
  box('roof garden',(.45,.20,height+.16),(.8,.75,.24),'leaf')
 finish(f'res_civic_{level}')

# Bank on existing tile 57: public hall with a recognisable circular vault emblem.
box('bank plaza base',(0,0,.12),(4.2,2.8,.24),'stone')
box('bank hall',(0,.15,1.48),(3.8,2.3,2.65),'sand')
box('bank curtain glazing',(0,-1.03,1.2),(3.3,.08,1.7),'glass')
box('bank rear clerestory',(0,1.32,1.65),(3.3,.08,1.1),'glass')
for x in [-1.94,1.94]:box('bank side windows',(x,.1,1.65),(.08,1.8,1.1),'glass')
for x in [-1.45,-.65,.65,1.45]:box('rear fins',(x,1.4,1.58),(.15,.2,1.95),'ivory')
for x in [-1.45,-.65,.65,1.45]:box('bank vertical pier',(x,-1.14,1.4),(.18,.26,2.38),'ivory')
box('bank entry canopy',(0,-1.15,2.70),(4.2,.5,.25),'teal')
box('bank roof rim',(0,.1,2.92),(4.2,2.65,.25),'ivory')
box('vault sign slab',(0,-.4,3.35),(1.3,.4,.75),'teal')
o=cylinder('vault emblem',(0,-.64,3.35),.25,.06,'gold',16);o.rotation_euler.x=math.pi/2
box('vault mark',(0,-.69,3.35),(.07,.04,.32),'glass')
finish('civic_bank')

# The existing chance tile's sheltered notice pavilion, not a new minigame.
box('notice plaza',(0,0,.08),(3.4,2.6,.16),'stone')
for x in [-1.25,1.25]:box('notice column',(x,.5,1.2),(.20,.20,2.3),'teal')
box('notice case',(0,.50,1.45),(2.45,.28,1.35),'ivory')
for x,z in [(-.65,1.66),(.05,1.66),(.65,1.66),(-.5,1.1),(.45,1.1)]:
 for y in [.34,.66]:box('abstract city notices',(x,y,z),(.46,.04,.35),'coral' if x<0 else 'glass')
box('notice shelter',(0,.15,2.48),(3.4,2.55,.22),'teal')
for x in [-.8,.8]:
 box('waiting bench',(x,-.60,.5),(.95,.45,.12),'coral')
 for dx in [-.32,.32]:box('bench support',(x+dx,-.60,.29),(.10,.33,.36),'glass')
finish('civic_notice')

# Low arcade building at the adjacent existing branch challenge tile 109.
box('arcade base',(0,0,.1),(3.6,2.7,.2),'stone')
box('arcade hall',(0,.15,1.05),(3.2,2.2,1.8),'sand')
for y in [-.98,1.28]:
 box('arcade glass frontage',(0,y,1.05),(2.7,.06,1.25),'glass')
 for x in [-.8,0,.8]:
  box('arcade screen',(x,y*1.04,1.18),(.48,.05,.44),'teal')
  box('arcade console',(x,y*1.06,.85),(.48,.16,.12),'coral')
box('arcade flying roof',(0,0,2.10),(3.6,2.7,.25),'teal')
box('arcade roof badge',(0,0,2.45),(.9,.45,.5),'ivory')
for x in [-.24,.24]:box('badge buttons',(x,-.25,2.45),(.15,.06,.15),'gold')
finish('civic_arcade')

bpy.ops.object.select_all(action='SELECT')
out=ROOT/'public/shanhai/models';src=ROOT/'art-source/shanhai'
bpy.ops.export_scene.gltf(filepath=str(out/'civic-street.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
bpy.ops.wm.save_as_mainfile(filepath=str(src/'civic-street.blend'))
data={'asset':'civic-street.glb','generator':'scripts/art/create_civic_street.py','license':license,'axes':'GLB Y-up, front +Z, origin ground center','models':manifest}
(out/'civic-street.manifest.json').write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n');print(json.dumps(data))
