"""Original Blue Bay commercial properties. No external art, textures or fonts.
Rebuild: blender -b -t 4 --python scripts/art/create_shanhai_commerce.py
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector, Matrix
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/shanhai/models'; SRC=ROOT/'art-source/shanhai'
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version=0
# Exact shared colors/names from the original coastal architecture pack.
palette={'cream':'F5E5BD','cream_light':'FFF2D5','coral':'D66D50','tile_light':'ED956E','teal':'377F79','glass':'466B78','wood':'996342','gold':'E8B95F','stone':'C6C5AD','jade':'368A65','leaf':'69AD66','leaf_light':'9AC779','pink':'EF87A2','yellow':'FFD86A','iron':'405C61','white':'F9F1DD'}
M={}; roots=[]; parts=[]
for name,hexcolor in palette.items():
 m=bpy.data.materials.new(name); m.use_nodes=True
 m.diffuse_color=tuple(((int(hexcolor[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,)
 m.node_tree.nodes['Principled BSDF'].inputs['Base Color'].default_value=m.diffuse_color
 m.node_tree.nodes['Principled BSDF'].inputs['Roughness'].default_value=.78; M[name]=m

def reg(o,name,mat):
 o.name=name; o.data.materials.append(M[mat]); parts.append(o); return o

def box(name,loc,size,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=reg(bpy.context.object,name,mat); o.dimensions=size
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('handcrafted edge','BEVEL');mod.width=bevel;mod.segments=1
  bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 return o

def cyl(name,loc,r,h,mat,vertices=12,top=None):
 bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=r if top is None else top,depth=h,location=loc)
 return reg(bpy.context.object,name,mat)

def beam(name,a,b,r,mat):
 d=Vector(b)-Vector(a);o=cyl(name,(Vector(a)+Vector(b))/2,r,d.length,mat,8);o.rotation_euler=d.to_track_quat('Z','Y').to_euler();return o

def ball(name,loc,scale,mat):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=1,radius=1,location=loc);o=reg(bpy.context.object,name,mat);o.scale=scale;return o

def mesh(name,verts,faces,mat):
 data=bpy.data.meshes.new(name);data.from_pydata(verts,[],faces);data.update()
 o=bpy.data.objects.new(name,data);bpy.context.collection.objects.link(o);return reg(o,name,mat)

def begin(name):
 global parts;parts=[];r=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(r);roots.append(r);return r

def finish(r):
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 bpy.ops.object.join();o=bpy.context.object;o.name=r.name+'_mesh';o.parent=r
 bpy.context.scene.cursor.location=(0,0,0);bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 r['license']='Original project artwork; owner may use, modify and redistribute.'

def roof(z,w,d,h,mat='coral'):
 mesh('folded pitched roof',[(-w/2,-d/2,z),(w/2,-d/2,z),(0,-d/2,z+h),(-w/2,d/2,z),(w/2,d/2,z),(0,d/2,z+h)],[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],mat)
 for i in range(9):
  y=-d/2+d*i/8
  for side in [-1,1]:beam('raised roof seams',(0,y,z+h+.025),(side*w/2,y,z+.025),.025,'tile_light' if mat=='coral' else 'cream_light')
 beam('ridge',(0,-d/2,z+h+.03),(0,d/2,z+h+.03),.045,'cream_light')

def window(x,y,z,w=.6,h=.65):
 box('recessed blue window',(x,y,z),(w,.08,h),'glass')
 for dx in [-w/2,0,w/2]:box('window upright',(x+dx,y-.05,z),(.045,.05,h+.09),'cream_light',0)
 for dz in [-h/2,h/2]:box('window lintel',(x,y-.05,z+dz),(w+.08,.05,.045),'cream_light',0)

def flowers(x,y,z):
 cyl('flower pot',(x,y,z+.14),.20,.28,'coral',10,.25)
 for i in range(3):
  a=i*math.tau/3;xx=x+.16*math.cos(a);yy=y+.16*math.sin(a)
  ball('leaves',(xx,yy,z+.38),(.18,.16,.18),'leaf')
  ball('flower',(xx,yy,z+.53),(.09,.09,.09),'pink' if i else 'yellow')

def shifted_roof(x,y,z,w,d,h,mat='coral'):
 before=len(parts);roof(z,w,d,h,mat)
 for o in parts[before:]:o.location.x+=x;o.location.y+=y

def floor_windows(w,d,z,front=True):
 if front:
  for x in [-w*.27,w*.27]:window(x,-d/2-.04,z,.32,.33)
 for angle,wall in [(math.pi/2,w/2),(-math.pi/2,w/2),(math.pi,d/2)]:
  before=len(parts);window(0,-wall-.035,z,.38,.34)
  for o in parts[before:]:o.matrix_world=Matrix.Rotation(angle,4,'Z')@o.matrix_world

def terrace(z,w=1.85):
 box('projecting balcony',(0,-.73,z),(w,.51,.10),'cream_light')
 for x in [-w/2+.06,0,w/2-.06]:beam('balcony posts',(x,-.93,z),(x,-.93,z+.32),.025,'teal')
 beam('balcony rail',(-w/2,-.93,z+.32),(w/2,-.93,z+.32),.03,'wood')

def entry(z=.16):
 box('entrance door',(0,-.71,z+.29),(.35,.07,.58),'teal');box('door inset glass',(0,-.76,z+.39),(.22,.02,.22),'glass',0)

def base():box('limestone property foundation',(0,0,.07),(2.25,2.05,.14),'stone')

# Each level has a distinct silhouette, with one compact merged mesh per prefab.
for level in range(5):
 r=begin(f'commerce_mall_{level}');base()
 if level==0:
  for x in [-.55,.55]:
   box('produce counter',(x,-.18,.44),(.87,.72,.55),'wood')
   for y in [-.55,.32]:
    for xx in [x-.37,x+.37]:beam('canopy upright',(xx,y,.16),(xx,y,1.13),.035,'teal')
   for i in range(4):box('striped market canopy',(x-.39+i*.26,-.12,1.16),(.26,1.06,.10),'coral' if i%2 else 'cream_light')
   for i in range(3):ball('fresh fruit',(x-.24+i*.24,-.37,.79),(.11,.11,.11),'yellow' if i%2 else 'pink')
  flowers(.83,.74,.14)
 else:
  for floor in range(level):
   zz=.16+floor*.65;setback=floor>=2;w=1.30 if setback else 1.96;cx=-.28 if setback else 0
   box('market hall',(cx,0,zz+.325),(w,1.40,.65),'cream')
   box('broad cornice',(cx,0,zz+.65),(w+.15,1.56,.12),'cream_light')
   for x in [cx-w*.27,cx+w*.27]:window(x,-.735,zz+.32,.44,.39)
   for side in [-1,1]:
    before=len(parts);window(0,-w/2-.04,zz+.32,.55,.37)
    for o in parts[before:]:o.matrix_world=Matrix.Translation(Vector((cx,0,0)))@Matrix.Rotation(side*math.pi/2,4,'Z')@o.matrix_world
  for x in [-.84,0,.84]:box('arcade pier',(x,-.87,.47),(.13,.21,.62),'teal')
  for i in range(8):box('striped entrance awning',(-.91+i*.26,-.88,.91),(.26,.53,.10),'coral' if i%2 else 'cream_light')
  top=.16+level*.65
  if level<=2:shifted_roof(0,0,top+.07,2.23,1.72,.35,'teal')
  else:
   shifted_roof(-.28,0,top+.05,1.50,1.65,.34,'teal')
   box('open roof terrace',(.78,0,1.51),(.52,1.59,.12),'wood')
   flowers(.78,.36,1.57)
  if level==4:
   cyl('clock turret',(-.28,.18,top+.55),.30,.70,'cream_light',12)
   cyl('turret cap',(-.28,.18,top+1.02),.43,.30,'coral',12,.02)
   clock=cyl('clock dial',(-.28,-.135,top+.61),.19,.05,'gold',16);clock.rotation_euler[0]=math.pi/2
   beam('clock minute',(-.28,-.17,top+.61),(-.28,-.17,top+.75),.018,'iron')
   beam('clock hour',(-.28,-.17,top+.61),(-.17,-.17,top+.61),.018,'iron')
  box('shop sign',(0,-.98,.99),(.52,.08,.20),'gold')
 finish(r)

for level in range(2):
 r=begin(f'commerce_park_{level}');base()
 box('garden lawn',(0,0,.16),(2.12,1.90,.12),'leaf')
 box('cross garden path',(0,-.14,.24),(.40,1.66,.06),'cream_light')
 for x in [-.73,.73]:
  box('wooden bench',(x,-.45,.43),(.48,.39,.09),'wood')
  for xx in [x-.16,x+.16]:box('bench leg',(xx,-.45,.32),(.06,.25,.18),'teal',0)
  box('bench back',(x,-.27,.61),(.48,.06,.34),'wood')
 flowers(-.75,.61,.22);flowers(.75,-.77,.22)
 if level==0:
  cyl('round flower bed',(.58,.42,.29),.33,.15,'stone',12)
  for i in range(5):
   a=i*math.tau/5;ball('flower bed foliage',(.58+math.cos(a)*.22,.42+math.sin(a)*.22,.49),(.18,.18,.22),'leaf_light')
   ball('flower bed blossom',(.58+math.cos(a)*.22,.42+math.sin(a)*.22,.68),(.10,.10,.10),'pink')
 else:
  for x in [-.43,.43]:
   for y in [-.02,.76]:beam('shade pavilion post',(x,y,.22),(x,y,1.26),.045,'wood')
  shifted_roof(0,.37,1.27,1.15,1.17,.39,'teal')
  beam('shade tree trunk',(-.77,.39,.22),(-.77,.39,1.55),.08,'wood')
  for dx,dy,dz in [(-.13,0,0),(.09,.10,.18),(.14,-.10,.02)]:ball('tree canopy',(-.77+dx,.39+dy,1.56+dz),(.32,.35,.40),'leaf_light' if dy>0 else 'jade')
 finish(r)

bpy.ops.object.select_all(action='DESELECT')
manifest={'asset':'commerce.glb','generator':'scripts/art/create_shanhai_commerce.py','license':'Original project artwork; owner may use, modify and redistribute. No external assets, textures or fonts.','axes':'GLB Y-up, entrance +Z, origin ground center','prefabs':[]}
for r in roots:
 r.select_set(True)
 for o in r.children:o.select_set(True);o.data.calc_loop_triangles()
 coords=[r.matrix_world@o.matrix_local@Vector(v) for o in r.children for v in o.bound_box]
 manifest['prefabs'].append({'name':r.name,'triangles':sum(len(o.data.loop_triangles) for o in r.children),'size_xyz_blender':[round(max(v[i] for v in coords)-min(v[i] for v in coords),3) for i in range(3)]})
bpy.ops.export_scene.gltf(filepath=str(OUT/'commerce.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
(OUT/'commerce.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'commerce.blend'))
print('COMMERCE_COMPLETE',json.dumps(manifest))
