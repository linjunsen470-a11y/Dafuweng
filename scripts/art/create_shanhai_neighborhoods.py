"""Original Blue Bay neighborhood kit. No external art, textures or fonts.
Rebuild: blender -b -t 4 --python scripts/art/create_shanhai_neighborhoods.py
"""
import bpy, math, json
from pathlib import Path
from mathutils import Vector
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

# Harbor: elevated timber ticket house, slatted jetty, rope rails and life ring.
r=begin('harbor_boathouse')
for x in [-1.3,1.3]:
 for y in [-1.2,1.0]:cyl('pier post',(x,y,.29),.11,.58,'wood')
box('jetty deck',(0,0,.36),(3.1,2.7,.17),'wood')
for i in range(13):box('jetty plank seam',(-1.45+i*.24,0,.455),(.025,2.6,.012),'cream',0)
box('ticket house',(0,.30,1.10),(2.55,1.65,1.3),'cream')
for z in [.60,.85,1.10,1.35,1.60]:box('horizontal weatherboards',(0,-.545,z),(2.57,.035,.035),'wood',0)
window(-.66,-.59,1.15,.65,.6);box('teal entrance',(.61,-.60,.94),(.55,.08,1.02),'teal');box('door glass',(.61,-.65,1.15),(.34,.03,.37),'glass')
roof(1.78,3.0,2.25,.67)
for x in [-1.4,1.4]:
 beam('jetty rope post',(x,-1.25,.4),(x,-1.25,1.0),.06,'wood');beam('rope rail',(x,-1.25,.88),(x,.9,.88),.035,'cream')
bpy.ops.mesh.primitive_torus_add(major_radius=.25,minor_radius=.065,major_segments=16,minor_segments=6,location=(.03,-.65,1.22),rotation=(math.pi/2,0,0));reg(bpy.context.object,'life ring','coral')
box('ticket sign',(0,-.95,1.85),(.95,.11,.23),'teal');cyl('clock plaque',(-.06,-1.02,1.85),.07,.035,'gold').rotation_euler[0]=math.pi/2
finish(r)

# Market: arcade gallery with a distinctive clock turret and striped shopfront.
r=begin('market_clock_gallery');box('gallery plinth',(0,0,.10),(3.0,2.5,.20),'stone');box('upper gallery',(0,.18,1.42),(2.7,1.8,1.08),'cream')
for x in [-1.15,0,1.15]:box('arcade columns',(x,-.73,.65),(.18,.22,1.1),'cream_light')
box('rear shop wall',(0,.62,.65),(2.7,.20,1.1),'teal');box('arcade lintel',(0,-.73,1.14),(2.9,.26,.22),'cream_light')
for x in [-.76,0,.76]:window(x,-.76,1.52,.43,.55)
roof(2.0,3.05,2.2,.48,'teal')
for i in range(10):
 o=box('striped shop canvas',(-1.35+i*.30,-1.02,1.0),(.30,.72,.07),'cream_light' if i%2 else 'coral');o.rotation_euler[0]=.16
 box('awning valance',(-1.35+i*.30,-1.36,.86),(.30,.06,.21),'cream_light' if i%2 else 'coral')
box('clock tower',(0,.25,2.52),(.72,.73,1.15),'cream_light');cyl('clock blue dial',(0,-.15,2.70),.25,.055,'teal',24).rotation_euler[0]=math.pi/2
beam('clock minute hand',(0,-.192,2.70),(0,-.192,2.88),.018,'gold');beam('clock hour hand',(0,-.195,2.70),(.12,-.195,2.64),.021,'gold')
cyl('turret hat',(0,.25,3.22),.56,.47,'teal',8,.04);ball('clock finial',(0,.25,3.5),(.07,.07,.12),'gold')
finish(r)

# Garden: opaque stylized glazing avoids transparency sorting and overdraw.
r=begin('garden_conservatory');box('greenhouse foundation',(0,0,.13),(3.25,2.7,.26),'stone')
box('greenhouse glass walls',(0,0,.96),(2.9,2.35,1.45),'glass',.01);roof(1.70,3.1,2.5,.87,'leaf')
for x in [-1.46,-.73,0,.73,1.46]:
 for y in [-1.19,1.19]:box('greenhouse ivory mullion',(x,y,1.0),(.07,.07,1.55),'cream_light',0)
for y in [-1.17,-.58,0,.58,1.17]:
 for x in [-1.48,1.48]:box('side mullion',(x,y,1.0),(.07,.07,1.55),'cream_light',0)
for z in [.29,.89,1.72]:
 for y in [-1.20,1.20]:box('horizontal greenhouse rail',(0,y,z),(3,.07,.07),'cream_light',0)
box('wide garden door',(0,-1.27,.78),(.77,.12,1.14),'teal');window(0,-1.35,.92,.55,.64)
for x in [-1.0,1.0]:flowers(x,-1.52,.16)
beam('weather vane mast',(0,0,2.58),(0,0,3.12),.035,'gold');beam('weather vane arrow',(-.35,0,3.02),(.35,0,3.02),.04,'gold');ball('weather vane leaf',(.31,0,3.02),(.15,.06,.1),'leaf_light')
finish(r)

# Three small narrative prop clusters, readable at the oblique game camera.
r=begin('harbor_fishing_rack')
for x in [-.65,.65]:beam('drying rack pole',(x,0,0),(x,0,1.35),.05,'wood')
beam('rack crossbar',(-.75,0,1.25),(.75,0,1.25),.055,'wood')
for x in [-.4,0,.4]:
 beam('hanging line',(x,0,1.25),(x,0,.95),.012,'cream');ball('silver catch',(x,0,.73),(.09,.06,.25),'glass');mesh('fish tail',[(x,0,.53),(x-.11,0,.40),(x+.11,0,.40)],[(0,1,2)],'cream_light')
for x in [-.45,.4]:
 box('fish crate',(x,-.35,.18),(.55,.5,.36),'wood');box('crate top',(x,-.35,.38),(.45,.4,.04),'teal')
finish(r)
r=begin('market_cafe_set')
cyl('cafe tabletop',(0,0,.66),.45,.08,'wood',16);cyl('table pedestal',(0,0,.33),.06,.66,'iron')
for x in [-.7,.7]:
 cyl('cafe stool',(x,0,.36),.23,.08,'coral');cyl('stool foot',(x,0,.17),.045,.34,'iron')
cyl('parasol pole',(0,0,1.12),.035,2.24,'wood');cyl('eight sided parasol',(0,0,2.03),1.0,.42,'cream_light',8,.05)
for i in range(8):
 a=i*math.tau/8;b=(i+1)*math.tau/8
 if i%2==0:mesh('parasol coral panel',[(0,0,2.245),(math.cos(a),math.sin(a),1.82),(math.cos(b),math.sin(b),1.82)],[(0,1,2)],'coral')
cyl('coffee cup',(.2,0,.75),.065,.12,'white',10);finish(r)
r=begin('garden_flower_cart')
box('garden cart tray',(0,0,.52),(1.36,.72,.20),'wood')
for x in [-.5,.5]:
 for y in [-.4,.4]:
  o=cyl('cart wheel',(x,y,.22),.22,.10,'teal',12);o.rotation_euler[0]=math.pi/2
for x in [-.43,0,.43]:flowers(x,0,.62)
for x in [-.61,.61]:beam('cart handle',(x,.25,.55),(x,.8,.85),.035,'wood')
beam('handle grip',(-.61,.8,.85),(.61,.8,.85),.035,'wood');finish(r)
r=begin('garden_easel')
for x in [-.35,.35]:beam('easel leg',(x,-.1,0),(x*.6,0,1.35),.04,'wood')
beam('rear easel leg',(0,.5,0),(0,0,1.3),.035,'wood');box('canvas frame',(0,-.04,.97),(.85,.08,.83),'wood');box('painted canvas',(0,-.09,.97),(.75,.025,.73),'cream_light',0)
box('painted horizon',(0,-.107,.91),(.73,.012,.22),'teal',0);ball('painted sunshine',(.19,-.12,1.17),(.10,.02,.10),'gold')
mesh('painted island',[(-.31,-.12,.88),(.2,-.12,.88),(-.07,-.12,1.11)],[(0,1,2)],'leaf')
box('easel shelf',(0,-.15,.54),(1.02,.24,.08),'wood');finish(r)

bpy.ops.object.select_all(action='DESELECT')
manifest={'asset':'neighborhoods.glb','generator':'scripts/art/create_shanhai_neighborhoods.py','license':'Original project artwork; owner may use, modify and redistribute. No external assets, textures or fonts.','axes':'GLB Y-up, front +Z, origin ground center','prefabs':[]}
for r in roots:
 r.select_set(True)
 for o in r.children:
  o.select_set(True);o.data.calc_loop_triangles()
 coords=[r.matrix_world@o.matrix_local@Vector(v) for o in r.children for v in o.bound_box]
 manifest['prefabs'].append({'name':r.name,'triangles':sum(len(o.data.loop_triangles) for o in r.children),'size_xyz_blender':[round(max(v[i] for v in coords)-min(v[i] for v in coords),3) for i in range(3)]})
bpy.ops.export_scene.gltf(filepath=str(OUT/'neighborhoods.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
(OUT/'neighborhoods.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'neighborhoods.blend'))
print('NEIGHBORHOOD_ASSETS_COMPLETE',json.dumps(manifest))
