"""Original Blue Bay regional residences. No external art, textures or fonts.
Rebuild: blender -b -t 4 --python scripts/art/create_shanhai_residences.py
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

for level in range(1,5):
 r=begin(f'res_harbor_{level}');base();w=1.3+level*.12;h=.64*level+.12;z=.32
 for x in [-.82,.82]:
  for y in [-.65,.65]:cyl('short timber piles',(x,y,.23),.075,.32,'wood',8)
 box('raised wooden porch',(0,0,.29),(2.05,1.85,.14),'wood')
 box('wood boarded sea home',(0,0,z+h/2),(w,1.30,h),'cream')
 for floor in range(level):
  zz=z+.32+floor*.64;floor_windows(w,1.3,zz)
  for band in [zz-.22,zz+.22]:
   box('horizontal weatherboard',(0,-.667,band),(w+.03,.03,.03),'wood',0)
   for x in [-w/2-.015,w/2+.015]:box('side weatherboard',(x,0,band),(.03,1.32,.03),'wood',0)
  if floor>0:terrace(z+floor*.64-.05,w+.25)
 entry(z);shifted_roof(0,0,z+h+.04,w+.35,1.70,.43)
 if level>=3:
  # Lookout dormer changes the upper silhouette without a larger footprint.
  box('harbor lookout',(-.38,.23,z+h+.33),(.48,.59,.5),'cream_light')
  window(-.38,-.09,z+h+.35,.28,.28);shifted_roof(-.38,.23,z+h+.60,.65,.76,.18,'teal')
 if level==4:
  box('second lookout',(.42,.25,z+h+.29),(.38,.48,.42),'cream');shifted_roof(.42,.25,z+h+.52,.53,.63,.16)
 cyl('porch barrel',(.76,-.70,.48),.14,.30,'wood',10)
 finish(r)

for level in range(1,5):
 r=begin(f'res_market_{level}');base();w=1.82;d=1.40;z=.16
 for floor in range(level):
  top=floor==level-1 and level>=3;fw=1.18 if top else w;cx=-.28 if top else 0;zz=z+floor*.70
  box('stepped gallery residence',(cx,0,zz+.35),(fw,d,.70),'cream')
  # Setback floor is separately framed; lower floors form a continuous arcade.
  if top:
   window(cx,-.74,zz+.37,.68,.39)
   box('roof terrace',(.70,0,zz+.05),(.55,1.55,.12),'cream_light');flowers(.7,.18,zz+.11)
  else:floor_windows(w,d,zz+.36,floor>0)
  box('horizontal cream cornice',(cx,0,zz+.67),(fw+.20,d+.18,.09),'cream_light')
  if floor==0:
   box('shopfront glazing',(0,-.735,.46),(1.50,.055,.51),'glass',0)
   for x in [-.78,0,.78]:box('arcade stone column',(x,-.80,.46),(.13,.15,.62),'cream_light')
   for i in range(6):
    xx=-.75+i*.30;strip=box('striped shop canopy',(xx,-.83,.88),(.30,.53,.055),'coral' if i%2==0 else 'cream_light');strip.rotation_euler[0]=.15
    box('canvas valance',(xx,-1.08,.78),(.30,.05,.15),'coral' if i%2==0 else 'cream_light')
 if level<=2:
  box('flat roof cap',(0,0,z+level*.70+.07),(2.08,1.65,.14),'coral')
  for x in [-.95,.95]:box('parapet return',(x,0,z+level*.70+.23),(.10,1.65,.22),'cream_light')
 else:
  shifted_roof(-.28,0,z+level*.70+.03,1.42,1.65,.28)
  if level==4:
   cyl('corner rooftop turret',(-.55,.30,z+level*.70+.4),.24,.38,'cream_light',12)
   cyl('turret roof',(-.55,.30,z+level*.70+.72),.34,.28,'coral',12,.025)
 finish(r)

for level in range(1,5):
 r=begin(f'res_garden_{level}');base();z=.16;w=1.64;d=1.36
 for floor in range(level):
  fw=w if floor<2 else 1.20;cx=0 if floor<2 else -.20;zz=z+floor*.64
  box('terraced garden residence',(cx,0,zz+.32),(fw,d,.64),'cream_light')
  if floor<2:floor_windows(fw,d,zz+.33,floor>0)
  else:window(cx,-.72,zz+.33,.72,.36)
  if floor>0:
   terrace(zz-.04,fw+.24)
   box('built in balcony planter',(cx,-.96,zz+.15),(fw*.8,.18,.16),'teal')
   for x in [-.32,0,.32]:ball('balcony planting',(cx+x,-.96,zz+.31),(.17,.13,.17),'leaf')
 entry(z)
 # A glazed garden porch and open timber trellis remain recognizable at every tier.
 for x in [-.84,.84]:beam('pergola posts',(x,-.91,.16),(x,-.91,.91),.035,'wood')
 for i in range(6):box('pergola rafters',(-.80+i*.32,-.78,.94),(.045,.63,.06),'wood',0)
 window(.54,-.73,.48,.35,.38)
 if level<=2:shifted_roof(0,0,z+level*.64+.03,w+.40,d+.35,.4)
 else:
  # Roof conservatory grows into a taller pavilion at level four.
  top=z+level*.64;box('roof garden platform',(0,0,top+.07),(2.0,1.7,.14),'teal')
  box('rooftop sunroom',(-.30,.12,top+.34),(.95,1.06,.50),'glass')
  window(-.30,-.44,top+.36,.77,.38);shifted_roof(-.30,.12,top+.61,1.15,1.25,.25)
  flowers(.68,.25,top+.13)
  if level==4:
   beam('garden pavilion finial',(-.3,.12,top+.85),(-.3,.12,top+1.13),.025,'gold')
   ball('finial leaf',(-.3,.12,top+1.13),(.13,.08,.08),'leaf')
 finish(r)

bpy.ops.object.select_all(action='DESELECT')
manifest={'asset':'residences.glb','generator':'scripts/art/create_shanhai_residences.py','license':'Original project artwork; owner may use, modify and redistribute. No external assets, textures or fonts.','axes':'GLB Y-up, entrance +Z, origin ground center','prefabs':[]}
for r in roots:
 r.select_set(True)
 for o in r.children:o.select_set(True);o.data.calc_loop_triangles()
 coords=[r.matrix_world@o.matrix_local@Vector(v) for o in r.children for v in o.bound_box]
 manifest['prefabs'].append({'name':r.name,'triangles':sum(len(o.data.loop_triangles) for o in r.children),'size_xyz_blender':[round(max(v[i] for v in coords)-min(v[i] for v in coords),3) for i in range(3)]})
bpy.ops.export_scene.gltf(filepath=str(OUT/'residences.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
(OUT/'residences.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'residences.blend'))
print('RESIDENCES_COMPLETE',json.dumps(manifest))
