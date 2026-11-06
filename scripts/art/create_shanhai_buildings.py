"""Original 山海都市岛 architecture. Blender 4.3+, no external assets."""
import bpy, math, random, json, os
from mathutils import Vector, Matrix
from pathlib import Path
ROOT=Path(__file__).resolve().parents[2]
OUT=ROOT/'public/shanhai/models'; SRC=ROOT/'art-source/shanhai'
OUT.mkdir(parents=True,exist_ok=True); SRC.mkdir(parents=True,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
random.seed(28)
M={}
for n,c in {'cream':'F5E5BD','cream_light':'FFF2D5','coral':'D66D50','tile_light':'ED956E','teal':'377F79','glass':'466B78','wood':'996342','gold':'E8B95F','stone':'C6C5AD','soil':'786D4E','jade':'368A65','leaf':'69AD66','leaf_light':'9AC779','pink':'EF87A2','yellow':'FFD86A','iron':'405C61','white':'F9F1DD'}.items():
 m=bpy.data.materials.new(n); m.diffuse_color=tuple(((int(c[i:i+2],16)/255+.055)/1.055)**2.4 for i in (0,2,4))+(1,); m.use_nodes=True; bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=m.diffuse_color; bs.inputs['Roughness'].default_value=.78; M[n]=m
parts=[]; roots=[]
def reg(o,n,mat):
 o.name=n; o.data.materials.append(M[mat]); parts.append(o); return o
def box(n,loc,dim,mat,bevel=.025):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc); o=reg(bpy.context.object,n,mat); o.dimensions=dim; bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 if bevel:
  mod=o.modifiers.new('soft crafted edges','BEVEL'); mod.width=bevel; mod.segments=2; bpy.context.view_layer.objects.active=o; bpy.ops.object.modifier_apply(modifier=mod.name)
  o.modifiers.new('weighted corner normals','WEIGHTED_NORMAL')
 return o
def cyl(n,loc,r,depth,mat,verts=12,r2=None):
 bpy.ops.mesh.primitive_cone_add(vertices=verts,radius1=r,radius2=r if r2 is None else r2,depth=depth,location=loc); return reg(bpy.context.object,n,mat)
def sphere(n,loc,scale,mat,sub=1):
 bpy.ops.mesh.primitive_ico_sphere_add(subdivisions=sub,radius=1,location=loc); o=reg(bpy.context.object,n,mat); o.scale=scale
 for p in o.data.polygons:p.use_smooth=True
 return o
def beam(n,a,b,r,mat):
 d=Vector(b)-Vector(a); o=cyl(n,(Vector(a)+Vector(b))/2,r,d.length,mat,8); o.rotation_euler=d.to_track_quat('Z','Y').to_euler(); return o
def mesh(n,v,f,mat):
 d=bpy.data.meshes.new(n); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(n,d); bpy.context.collection.objects.link(o); return reg(o,n,mat)
def start(n):
 global parts; parts=[]; o=bpy.data.objects.new(n,None); bpy.context.collection.objects.link(o); roots.append(o); return o
def end(root):
 if root.name in ['property_level1','property_level2','property_level3','property_level4']:
  level=int(root.name[-1]); wall=[0,.74,.84,.94,.96][level]
  for z in {1:[.65],2:[.56,1.40],3:[.60,1.51],4:[.66,1.57,2.40]}[level]:
   for y in ([-.05] if level==1 else [-.16,.61]):
    before=len(parts); window(y,-wall,z,.28,.34,False)
    for o in parts[before:]:o.matrix_world=Matrix.Rotation(math.pi/2,4,'Z') @ o.matrix_world
 bpy.ops.object.select_all(action='DESELECT')
 for o in parts:o.select_set(True)
 bpy.context.view_layer.objects.active=parts[0]; bpy.ops.object.convert(target='MESH'); bpy.ops.object.join(); o=bpy.context.object; o.name=root.name+'_mesh'; o.parent=root
 bpy.context.scene.cursor.location=(0,0,0); bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
 root['source']='Original procedural Blender sculpture for 山海都市岛'; return root

def roof(x,y,z,w,d,h):
 # Thick gabled silhouette, overhang, individually articulated terracotta rolls.
 v=[(x-w/2,y-d/2,z),(x+w/2,y-d/2,z),(x,y-d/2,z+h),(x-w/2,y+d/2,z),(x+w/2,y+d/2,z),(x,y+d/2,z+h)]
 mesh('terracotta gable',v,[(0,1,2),(3,5,4),(0,3,4,1),(0,2,5,3),(1,4,5,2)],'coral')
 for side in [-1,1]:
  for i in range(11):
   yy=y-d/2+d*i/10
   beam('rounded tile channel',(x,yy,z+h+.025),(x+side*w/2,yy,z+.025),.025,'tile_light')
 beam('rounded ridge',(x,y-d/2-.035,z+h+.045),(x,y+d/2+.035,z+h+.045),.065,'coral')
 for xx in [x-w/2,x+w/2]:box('deep cream eave',(xx,y,z-.03),(.085,d+.1,.10),'cream_light')
def window(x,y,z,w=.36,h=.42,shutters=True):
 box('recessed window surround',(x,y,z),(w+.10,.075,h+.10),'cream_light',.035)
 box('blue reflective pane',(x,y-.045,z),(w,.035,h),'glass',.02)
 box('window mullion',(x,y-.075,z),(.025,.025,h),'gold',.006)
 box('window crossbar',(x,y-.075,z),(w,.025,.025),'gold',.005)
 box('window sill',(x,y-.075,z-h/2-.045),(w+.16,.18,.07),'cream_light')
 if shutters:
  for s in [-1,1]:
   box('teal wooden shutter',(x+s*(w/2+.105),y-.025,z),(.13,.06,h+.04),'teal',.015)
   for q in [-1,0,1]:box('shutter slat',(x+s*(w/2+.105),y-.062,z+q*h/4),(.10,.018,.018),'leaf_light',.003)
def door(x,y,z,h=.65):
 box('arched door frame',(x,y,z+h/2),(.43,.11,h+.08),'cream_light',.075)
 box('wooden entrance',(x,y-.065,z+h/2),(.32,.055,h),'wood',.055)
 box('door top glass',(x,y-.10,z+h*.74),(.21,.025,h*.27),'glass',.025)
 sphere('brass door knob',(x+.10,y-.115,z+h*.39),(.026,.026,.026),'gold')
 box('doorstep',(x,y-.16,z+.025),(.50,.37,.08),'stone')
def planter(x,y,z,w=.45):
 box('terracotta planter',(x,y,z+.08),(w,.23,.16),'coral',.04)
 for i in [-1,0,1]:
  sphere('planter leaves',(x+i*w*.28,y,z+.20),(.13,.14,.14),'jade')
  sphere('sunny flowers',(x+i*w*.28,y-.04,z+.28),(.065,.065,.065),'pink' if i else 'yellow')
def awning(x,y,z,w):
 # Slanted alternating canvas strips with rounded hanging valance.
 for i in range(7):
  xx=x-w/2+w*(i+.5)/7; o=box('striped canvas awning',(xx,y-.28,z),(w/7+.008,.63,.07),'teal' if i%2==0 else 'cream_light',.018); o.rotation_euler[0]=.18
  box('scalloped valance',(xx,y-.59,z-.11),(w/7+.008,.055,.17),'teal' if i%2==0 else 'cream_light',.045)
def balcony(x,y,z,w):
 box('balcony slab',(x,y-.22,z),(w,.62,.10),'cream_light',.06)
 for xx in [x-w/2+.05,x+w/2-.05]:beam('balcony corner',(xx,y-.46,z),(xx,y-.46,z+.36),.025,'teal')
 for i in range(7):beam('balcony baluster',(x-w/2+.07+i*(w-.14)/6,y-.46,z+.06),(x-w/2+.07+i*(w-.14)/6,y-.46,z+.34),.015,'teal')
 beam('wood balcony handrail',(x-w/2,y-.46,z+.36),(x+w/2,y-.46,z+.36),.03,'wood')
def foundation(w=2.25,d=2):box('rounded limestone plinth',(0,0,.06),(w,d,.12),'stone',.07)
# Vacant garden plot.
r=start('property_level0'); foundation();box('garden bed',(0,0,.14),(1.97,1.72,.12),'leaf_light',.10)
for x in [-.82,.82]:
 for y in [.55,.78]:box('low garden fence',(x,y,.28),(.07,.07,.35),'white')
 box('garden fence rail',(x,.66,.35),(.065,.44,.06),'white')
box('survey plaque',(0,.40,.26),(.45,.08,.27),'wood'); planter(-.60,-.58,.20);end(r)
# Level 1 fishing cottage.
r=start('property_level1');foundation();box('cozy plaster cottage',(0,.15,.54),(1.45,1.25,.90),'cream',.07);roof(0,.15,1.03,1.75,1.52,.43);door(-.35,-.50,.14);window(.40,-.51,.66,.30,.35);planter(.45,-.73,.15);box('chimney',(.45,.52,1.32),(.22,.24,.48),'cream');box('chimney cap',(.45,.52,1.57),(.30,.31,.10),'coral');end(r)
# Level2 shop-home with canopy and side wing.
r=start('property_level2');foundation();box('shop home',(0,.16,.91),(1.65,1.34,1.62),'cream',.07);roof(0,.16,1.72,1.92,1.55,.40);door(-.47,-.55,.13,.68);window(.35,-.55,.55,.56,.51,False);awning(0,-.56,1.03,1.75);window(-.40,-.55,1.40,.32,.35);window(.40,-.55,1.40,.32,.35);planter(.40,-.73,.99);box('shop sign',(0,-.67,1.10),(.75,.09,.20),'wood');cyl('shop emblem',(0,-.74,1.10),.07,.035,'gold').rotation_euler[0]=math.pi/2;end(r)
# Level3 asymmetric terraced apartments.
r=start('property_level3');foundation();box('apartment lower',(0,.18,1.02),(1.84,1.44,1.84),'cream',.09);box('recessed penthouse',(-.30,.33,2.15),(1.20,1.13,.63),'cream_light',.07);roof(-.30,.33,2.48,1.42,1.35,.32);door(-.53,-.57,.12);window(.32,-.57,.59,.49,.48);window(-.45,-.57,1.51);window(.45,-.57,1.51);balcony(0,-.57,1.15,1.90);window(-.30,-.25,2.16,.42,.37);box('roof terrace',(.62,.20,2.00),(.63,1.40,.12),'stone');planter(.60,-.35,2.07,.45);beam('terrace rail',(.9,-.48,2.08),(.9,.82,2.08),.04,'teal');planter(.55,-.78,.13);end(r)
# Level4 boutique stepped midrise.
r=start('property_level4');foundation();box('boutique main',(0,.22,1.42),(1.88,1.45,2.66),'cream',.10);box('rooftop suite',(-.30,.30,3.01),(1.13,1.17,.62),'cream_light',.09);roof(-.30,.30,3.30,1.36,1.38,.29);door(0,-.55,.13,.76)
for z in [.66,1.57,2.40]:
 for x in [-.58,.58]:window(x,-.54,z,.32,.44,False)
 if z>1:balcony(0,-.55,z-.35,2.00)
for z in [1.05,1.94,2.78]:box('cornice',(0,.20,z),(2.02,1.58,.10),'cream_light',.04)
window(-.30,-.30,3.04,.46,.35,False);planter(.62,-.13,2.85);awning(0,-.55,1.0,.70);planter(-.78,-.74,.12,.32);end(r)
# Market hall: domed turret, arcade and striped stalls.
r=start('market');foundation(2.95,2.60);box('market hall',(0,.30,.73),(2.50,1.60,1.22),'cream',.08);roof(0,.30,1.35,2.80,1.93,.60)
for x in [-.86,0,.86]:
 door(x,-.54,.15,.78);awning(x,-.56,1.14,.78);box('produce counter',(x,-.92,.33),(.65,.36,.35),'wood',.04)
 for q in range(4):sphere('market fruit',(x-.22+q*.145,-.93,.56),(.08,.08,.08),'yellow' if q%2 else 'coral')
cyl('market cupola',(0,.30,2.02),.32,.40,'cream_light',12);cyl('turret teal roof',(0,.30,2.35),.44,.35,'teal',12,.03);sphere('roof finial',(0,.30,2.57),(.06,.06,.10),'gold');planter(1.23,-.9,.13,.31);end(r)
# Signature harbor lighthouse.
r=start('lighthouse');cyl('round stone foundation',(0,0,.12),.86,.24,'stone',20);cyl('tapered ivory tower',(0,0,1.55),.55,2.85,'cream_light',20,.36)
for z in [.56,1.45,2.32]:cyl('coral tower band',(0,0,z),.54-(z/3)*.18,.18,'coral',20)
door(0,-.50,.18,.66)
for z in [1.28,2.12]:window(0,-(.53-z*.055),z,.18,.30,False)
cyl('lantern walkway',(0,0,2.96),.64,.13,'teal',20);cyl('gold lantern glass',(0,0,3.25),.37,.52,'gold',12)
for i in range(8):
 a=i*math.tau/8;beam('lantern mullion',(.38*math.cos(a),.38*math.sin(a),3),(.38*math.cos(a),.38*math.sin(a),3.52),.025,'iron')
cyl('lantern roof',(0,0,3.63),.57,.36,'teal',20,.04);sphere('beacon finial',(0,0,3.89),(.06,.06,.10),'gold');end(r)
# Round broadleaf tree.
r=start('tree_round');cyl('tree trunk',(0,0,.61),.10,1.22,'wood',9,.07)
for a in [0,2.1,4.2]:beam('tree branch',(0,0,.65),(.36*math.cos(a),.36*math.sin(a),1.18),.055,'wood')
for loc,sc,ma in [((0,0,1.47),(.65,.62,.65),'jade'),((-.37,-.15,1.30),(.43,.46,.45),'leaf'),((.35,.05,1.48),(.42,.43,.48),'leaf'),((0,.05,1.85),(.40,.41,.35),'leaf_light')]:sphere('rounded living canopy',loc,sc,ma,2)
end(r)
r=start('palm')
for i in range(9):cyl('curving ringed palm trunk',(.025*i*i/9,0,.12+i*.18),.10-i*.003,.21,'wood',9,.085-i*.003)
for k in range(7):
 a=k*math.tau/7; v=[]
 for i in range(6):
  t=i/5; rad=t*1.04; z=1.65+math.sin(t*math.pi)*.39-t*.24; wid=math.sin(t*math.pi)*.19
  for s in [-1,1]:v.append((.18+math.cos(a)*rad+math.cos(a+math.pi/2)*wid*s,math.sin(a)*rad+math.sin(a+math.pi/2)*wid*s,z))
 mesh('curved palm frond',v,[(2*i,2*i+1,2*i+3,2*i+2) for i in range(5)],'jade' if k%2 else 'leaf')
for a in [0,2,4]:sphere('coconut',(.18+.13*math.cos(a),.13*math.sin(a),1.60),(.10,.10,.12),'wood')
end(r)
r=start('shrub')
for x,y,z,s in [(-.23,0,.28,.31),(.20,0,.32,.36),(0,.18,.36,.32)]:sphere('rounded shrub',(x,y,z),(s,s,s),'leaf',2)
end(r)
r=start('flower_planter');planter(0,0,0,.65);end(r)
r=start('bench')
for x in [-.43,.43]:
 for y in [-.15,.16]:box('bench iron legs',(x,y,.20),(.055,.055,.40),'iron',.01)
 beam('back support',(x,.17,.25),(x,.27,.75),.025,'iron')
for y in [-.16,0,.16]:box('seat wooden slat',(0,y,.43),(1.07,.12,.07),'wood',.02)
for z in [.60,.75]:box('back wooden slat',(0,.25,z),(1.07,.06,.10),'wood',.02)
end(r)
r=start('streetlight');cyl('lamp foot',(0,0,.07),.16,.14,'iron');cyl('lamp pole',(0,0,.76),.045,1.45,'iron');cyl('lantern lower',(0,0,1.48),.17,.08,'teal');sphere('warm lamp',(0,0,1.67),(.14,.14,.21),'yellow',2);cyl('lamp cap',(0,0,1.89),.22,.16,'teal',12,.025);end(r)
# All prefabs are at origin for clone-based consumers. Export roots only.
bpy.ops.object.select_all(action='DESELECT')
for r in roots:
 r.select_set(True)
 for c in r.children:c.select_set(True)
bpy.ops.export_scene.gltf(filepath=str(OUT/'buildings.glb'),export_format='GLB',use_selection=True,export_yup=True,export_apply=True)
manifest={'asset':'buildings.glb','generator':'scripts/art/create_shanhai_buildings.py','license':'Original project artwork. No third-party models, textures, fonts or game assets. Project owner may use, modify and redistribute.','axes':'GLB Y-up; front faces +Z; origin at ground center','prefabs':[]}
for r in roots:
 tris=0
 for c in r.children:c.data.calc_loop_triangles();tris+=len(c.data.loop_triangles)
 coords=[r.matrix_world@c.matrix_local@Vector(v) for c in r.children for v in c.bound_box]
 lo=[min(p[i] for p in coords) for i in range(3)];hi=[max(p[i] for p in coords) for i in range(3)]
 manifest['prefabs'].append({'name':r.name,'triangles':tris,'size_xyz_blender':[round(hi[i]-lo[i],3) for i in range(3)]})
(OUT/'buildings.manifest.json').write_text(json.dumps(manifest,ensure_ascii=False,indent=2))
bpy.ops.wm.save_as_mainfile(filepath=str(SRC/'buildings.blend'))
# Contact sheet diorama: export is untouched, only visual inspection scene is rearranged.
for i,r in enumerate(roots):r.location=((i%5-2)*3.7,(i//5)*4.0,0)
parts=[];box('presentation ground',(0,3.3,-.18),(21,15,.25),'cream',.15)
world=bpy.context.scene.world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.55,.70,.78,1);world.node_tree.nodes['Background'].inputs[1].default_value=.7
bpy.ops.object.light_add(type='AREA',location=(-6,-5,13));bpy.context.object.data.energy=1900;bpy.context.object.data.shape='DISK';bpy.context.object.data.size=8
bpy.ops.object.camera_add(location=(15,-23,22));cam=bpy.context.object;cam.rotation_euler=(Vector((0,3,0.8))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=23;bpy.context.scene.camera=cam
sc=bpy.context.scene;sc.render.engine='CYCLES';sc.cycles.samples=32;sc.cycles.use_denoising=False;sc.render.resolution_x=1800;sc.render.resolution_y=1300;sc.render.resolution_percentage=100;sc.view_settings.view_transform='AgX';sc.render.image_settings.file_format='PNG';sc.render.filepath=str(SRC/'buildings-contact-sheet.png');bpy.ops.render.render(write_still=True)
print('BUILDING_ASSETS_COMPLETE',json.dumps(manifest))
