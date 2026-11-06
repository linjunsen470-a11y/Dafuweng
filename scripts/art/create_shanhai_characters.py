"""Original procedural toy characters for 山海都市岛. Author: OpenAI for this project.
Original project assets. No third-party artwork, textures, or geometry sources. No separate third-party license granted. Run: blender -b --python scripts/art/create_shanhai_characters.py
"""
import bpy, math, os, json, struct
from mathutils import Vector
ROOT=os.path.abspath(os.path.join(os.path.dirname(__file__),'../..'))
OUT=os.path.join(ROOT,'public/shanhai/models'); SRC=os.path.join(ROOT,'art-source/shanhai')
os.makedirs(OUT,exist_ok=True); os.makedirs(SRC,exist_ok=True)
bpy.context.scene.render.fps=30; bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
colors={'skin':'F5BE91','blush':'EF8C78','cream':'FFF0D4','coral':'ED684A','coralDark':'A94439','teal':'258C86','tealDark':'174B50','hair':'4A302A','hairLight':'83533B','eye':'233E46','sole':'DEB68B','brass':'F8C55C','leaf':'6DAC67','leafLight':'B6D576','soil':'73513C','violet':'7960B0','violetDark':'403958','sand':'DAB16D','workBlue':'477C9C','workDark':'284D64'}
def mat(key):
 if key in M:return M[key]
 h=colors[key]; m=bpy.data.materials.new(key); m.diffuse_color=tuple((int(h[i:i+2],16)/255)**2.2 for i in (0,2,4))+(1,); m.use_nodes=True; p=m.node_tree.nodes.get('Principled BSDF'); p.inputs['Base Color'].default_value=m.diffuse_color;p.inputs['Roughness'].default_value=.72;M[key]=m;return m
def parent(o,p):
 if p:o.parent=p;o.matrix_parent_inverse=p.matrix_world.inverted()
 return o
def empty(name,loc,p=None):
 o=bpy.data.objects.new(name,None);bpy.context.collection.objects.link(o);o.location=loc;bpy.context.view_layer.update();return parent(o,p)
def uv(name,loc,scale,color,p=None,segments=16,rings=10):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=segments,ring_count=rings,location=loc);o=bpy.context.object;o.name=name;o.scale=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat(color));
 for f in o.data.polygons:f.use_smooth=True
 return parent(o,p)
def box(name,loc,scale,color,p=None,bev=.04):
 bpy.ops.mesh.primitive_cube_add(size=1,location=loc);o=bpy.context.object;o.name=name;o.dimensions=scale;bpy.ops.object.transform_apply(location=False,rotation=False,scale=True);o.data.materials.append(mat(color)); mod=o.modifiers.new('Soft tailored edges','BEVEL');mod.width=bev;mod.segments=3;bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name);mod=o.modifiers.new('Weighted corner normals','WEIGHTED_NORMAL');bpy.ops.object.modifier_apply(modifier=mod.name);return parent(o,p)
def tube(name,a,b,r,color,p=None):
 d=Vector(b)-Vector(a);bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=d.length,location=(Vector(a)+Vector(b))/2);o=bpy.context.object;o.name=name;o.rotation_euler=d.to_track_quat('Z','Y').to_euler();o.data.materials.append(mat(color));
 for f in o.data.polygons:f.use_smooth=True
 return parent(o,p)
def character(kind):
 courier=kind=='courier'; cartographer=kind=='cartographer'; builder=kind=='builder'; prefix=kind+'_'; root=empty(prefix+'root',(0,0,0)); body=empty(prefix+'body',(0,0,.62),root); head=empty(prefix+'head',(0,0,1.2),body); arms=[];legs=[]; col='coral' if courier else 'violet' if cartographer else 'workBlue' if builder else 'teal'; dark='coralDark' if courier else 'violetDark' if cartographer else 'workDark' if builder else 'tealDark'
 uv(prefix+'jacket',(0,0,.79),(.25,.17,.31),col,body)
 box(prefix+'collar',(0,-.02,1.025),(.26,.23,.09),'cream',body,.035)
 box(prefix+'shirt',(0,-.154,.89),(.105,.025,.21),'cream',body,.012)
 tube(prefix+'zipper',(0,-.177,.61),(0,-.184,.91),.009,'brass',body)
 box(prefix+'waistband',(0,.0,.555),(.39,.28,.075),dark,body,.025)
 for side in [-1,1]:
  uv(prefix+'jacket_pocket'+str(side),(side*.14,-.145,.69),(.067,.025,.065),dark,body)
  box(prefix+'pocket_stitch'+str(side),(side*.14,-.17,.72),(.085,.009,.01),'cream',body,.003)
  leg=empty(prefix+('leg_L' if side<0 else 'leg_R'),(side*.115,0,.55),body);legs.append(leg)
  box(prefix+'trouser'+str(side),(side*.115,.0,.36),(.17,.20,.33),'tealDark',leg,.07)
  box(prefix+'sock'+str(side),(side*.115,-.008,.185),(.145,.165,.09),'cream',leg,.025)
  box(prefix+'shoe'+str(side),(side*.115,-.05,.105),(.19,.30,.15),dark,leg,.055)
  box(prefix+'sole'+str(side),(side*.115,-.05,.027),(.20,.31,.054),'sole',leg,.022)
  for z in [0,.035]:box(prefix+'lace'+str(side)+str(z),(side*.115,-.135+z,.17),(.115,.012,.012),'cream',leg,.004)
  arm=empty(prefix+('arm_L' if side<0 else 'arm_R'),(side*.235,0,.96),body);arms.append(arm)
  uv(prefix+'sleeve'+str(side),(side*.285,0,.80),(.105,.115,.19),col,arm)
  box(prefix+'cuff'+str(side),(side*.30,-.012,.65),(.16,.18,.075),'cream',arm,.027)
  uv(prefix+'hand'+str(side),(side*.31,-.025,.59),(.082,.076,.095),'skin',arm)
  uv(prefix+'thumb'+str(side),(side*.25,-.063,.60),(.035,.035,.055),'skin',arm)
 # Oversize friendly head, sculpted layered hair cap and fringe.
 uv(prefix+'hair_mass',(0,.015,1.32),(.318,.266,.315),'hair' if courier else 'hairLight',head,24,16)
 uv(prefix+'face',(0,-.043,1.285),(.295,.25,.288),'skin',head,24,16)
 for s in [-1,1]:
  uv(prefix+'ear'+str(s),(s*.29,-.015,1.27),(.058,.053,.084),'skin',head)
  uv(prefix+'ear_inner'+str(s),(s*.315,-.055,1.27),(.025,.012,.04),'blush',head)
  uv(prefix+'eye'+str(s),(s*.105,-.276,1.31),(.028,.014,.044),'eye',head)
  uv(prefix+'spark'+str(s),(s*.113,-.288,1.325),(.009,.006,.012),'cream',head)
  uv(prefix+'cheek'+str(s),(s*.185,-.252,1.235),(.045,.011,.023),'blush',head)
  brow=uv(prefix+'brow'+str(s),(s*.108,-.270,1.38),(.049,.015,.013),'hair',head);brow.rotation_euler.y=s*.12
 uv(prefix+'nose',(0,-.296,1.26),(.035,.028,.029),'skin',head)
 # A shallow smile made from a curved tube, not a flat decal.
 for i in range(8):
  x=-.053+i*.01325;x2=x+.01325;z=1.198+3.5*x*x;z2=1.198+3.5*x2*x2;tube(prefix+'smile'+str(i),(x,-.275,z),(x2,-.275,z2),.006,'hair',head)
 for i in range(7):
  x=(i-3)*.072; o=uv(prefix+'fringe'+str(i),(x,-.212,1.49-abs(x)*.19),(.064,.071,.09+(.02 if i%2 else 0)),'hair' if courier else 'hairLight',head);o.rotation_euler.y=-.3
 if courier:
  uv(prefix+'cap',(0,.015,1.54),(.325,.267,.16),'coral',head,24,12)
  uv(prefix+'cap_brim',(0,-.242,1.49),(.29,.18,.037),'coralDark',head,24,8)
  box(prefix+'cap_badge',(0,-.253,1.59),(.105,.02,.08),'cream',head,.02)
  box(prefix+'badge_mail',(0,-.267,1.59),(.065,.009,.04),'brass',head,.008)
  # Slant satchel strap plus rectangular mail satchel on the hip.
  tube(prefix+'satchel_strap',(-.20,-.17,1.01),(.24,-.19,.56),.025,'sole',body)
  box(prefix+'satchel',(.25,.02,.59),(.21,.23,.24),'sole',body,.035)
  box(prefix+'satchel_flap',(.25,-.105,.64),(.22,.04,.13),'hairLight',body,.025)
  box(prefix+'satchel_clasp',(.25,-.13,.60),(.035,.015,.05),'brass',body,.008)
  box(prefix+'parcel',(0,.24,.84),(.32,.22,.34),'sole',body,.025)
  box(prefix+'parcel_tape',(0,.356,.84),(.06,.012,.34),'cream',body,.004)
  box(prefix+'parcel_label',(-.075,.363,.86),(.07,.012,.08),'coral',body,.004)
 elif cartographer:
  # Wide travel hat, round spectacles, chart tube and a compass make a new silhouette.
  uv(prefix+'hat_crown',(0,.02,1.56),(.31,.26,.18),'sand',head,24,12)
  uv(prefix+'hat_brim',(0,-.01,1.48),(.43,.35,.035),'sand',head,24,8)
  uv(prefix+'hat_band',(0,.01,1.53),(.317,.267,.038),'violetDark',head,24,8)
  for side in [-1,1]:
   for i in range(16):
    a=i*math.tau/16;b=(i+1)*math.tau/16
    tube(prefix+'spectacle'+str(side)+'_'+str(i),(side*.105+.074*math.cos(a),-.302,1.31+.069*math.sin(a)),(side*.105+.074*math.cos(b),-.302,1.31+.069*math.sin(b)),.009,'brass',head)
  tube(prefix+'glasses_bridge',(-.03,-.303,1.32),(.03,-.303,1.32),.009,'brass',head)
  box(prefix+'scarf',(0,-.14,1.015),(.24,.10,.08),'brass',body,.025)
  tail=box(prefix+'scarf_tail',(-.16,-.18,.91),(.09,.04,.23),'brass',body,.025);tail.rotation_euler.y=.25
  tube(prefix+'case_strap',(-.2,-.18,1.0),(.23,-.18,.57),.023,'sand',body)
  tube(prefix+'chart_case',(.24,.21,.54),(.24,.21,1.15),.09,'violetDark',body)
  for z in [.55,1.13]:uv(prefix+'case_end'+str(z),(.24,.21,z),(.105,.105,.045),'brass',body)
  box(prefix+'field_notebook',(-.27,.14,.65),(.16,.22,.28),'cream',body,.02)
  box(prefix+'book_spine',(-.35,.14,.65),(.025,.22,.28),'sand',body,.01)
  uv(prefix+'compass_case',(.13,-.183,.86),(.066,.024,.066),'brass',body)
  tube(prefix+'compass_needle',(.13,-.21,.82),(.13,-.21,.90),.009,'violetDark',body)
 elif builder:
  # Original work helmet, ear guards, broad bib and tools give a distinct repairer silhouette.
  uv(prefix+'helmet',(0,.015,1.56),(.33,.28,.19),'brass',head,24,12)
  uv(prefix+'helmet_rim',(0,-.02,1.48),(.36,.32,.027),'sand',head,24,8)
  box(prefix+'helmet_ridge',(0,.015,1.725),(.045,.37,.055),'cream',head,.018)
  box(prefix+'helmet_badge',(0,-.258,1.59),(.12,.025,.075),'workDark',head,.015)
  for side in [-1,1]:
   uv(prefix+'ear_guard'+str(side),(side*.32,.015,1.34),(.052,.075,.10),'workDark',head)
   tube(prefix+'vest_stripe'+str(side),(side*.17,-.16,.95),(side*.12,-.19,.59),.018,'brass',body)
  box(prefix+'work_bib',(0,-.18,.72),(.28,.05,.25),'workDark',body,.025)
  box(prefix+'tool_pocket',(.055,-.216,.70),(.15,.035,.10),'sand',body,.018)
  tube(prefix+'spanner_handle',(.075,-.245,.73),(.075,-.245,.90),.014,'cream',body)
  tube(prefix+'spanner_fork_a',(.075,-.245,.90),(.045,-.245,.935),.013,'cream',body)
  tube(prefix+'spanner_fork_b',(.075,-.245,.90),(.105,-.245,.935),.013,'cream',body)
  box(prefix+'belt',(0,0,.58),(.42,.30,.065),'hairLight',body,.018)
  box(prefix+'buckle',(0,-.16,.58),(.08,.025,.07),'brass',body,.012)
  box(prefix+'tool_case',(-.26,.04,.64),(.19,.22,.28),'workDark',body,.025)
  box(prefix+'case_latch',(-.26,-.082,.68),(.055,.018,.06),'brass',body,.008)
  tube(prefix+'hammer_handle',(.14,.23,.64),(.14,.23,1.12),.025,'sole',body)
  box(prefix+'hammer_head',(.14,.23,1.13),(.26,.09,.09),'workDark',body,.018)
 else:
  # Asymmetric bun and botanical hair clip distinguish silhouette.
  uv(prefix+'bun',(.23,.11,1.56),(.17,.16,.16),'hairLight',head)
  uv(prefix+'bun_tie',(.24,.045,1.53),(.14,.025,.055),'brass',head)
  for i in range(3):
   o=uv(prefix+'leaf_clip'+str(i),(.26+i*.025,-.08,1.57+i*.045),(.045,.025,.105),'leafLight' if i%2 else 'leaf',head);o.rotation_euler.y=-.65+i*.65
  box(prefix+'apron',(0,-.158,.71),(.32,.055,.29),'cream',body,.045)
  box(prefix+'apron_pocket',(0,-.194,.69),(.16,.028,.10),'teal',body,.022)
  tube(prefix+'trowel_handle',(.06,-.215,.72),(.06,-.215,.83),.014,'sole',body)
  uv(prefix+'trowel_blade',(.06,-.215,.845),(.032,.012,.045),'brass',body)
  box(prefix+'backpack',(0,.20,.79),(.35,.20,.32),'sole',body,.065)
  box(prefix+'backpack_flap',(0,.30,.88),(.34,.055,.13),'tealDark',body,.035)
  for s in [-1,1]:tube(prefix+'pack_strap'+str(s),(s*.15,-.13,1.0),(s*.15,-.13,.79),.023,'sole',body)
  tube(prefix+'plant_stem',(.10,.22,.92),(.10,.22,1.16),.012,'leaf',body)
  for s in [-1,1]:
   o=uv(prefix+'pack_leaf'+str(s),(.10+s*.065,.22,1.09),(.087,.025,.045),'leaf',body);o.rotation_euler.y=s*-.5
  box(prefix+'seed_packet',(-.085,-.216,.775),(.085,.025,.13),'brass',body,.008)
  uv(prefix+'seed_emblem',(-.085,-.234,.80),(.025,.008,.034),'leaf',body)
  for i in range(5):
   angle=i*2*math.pi/5
   uv(prefix+'flower_pin'+str(i),(-.16+.031*math.cos(angle),-.18,.94+.031*math.sin(angle)),(.025,.014,.025),'coral',body,12,8)
  uv(prefix+'flower_center',(-.16,-.197,.94),(.018,.012,.018),'brass',body,12,8)
 objs=[root]+list(root.children_recursive)
 # Every moving object gets one NLA track of the same name per clip; exporter merges tracks.
 moving=[body,head]+arms+legs
 bases={o.name:(o.location.copy(),o.rotation_euler.copy()) for o in moving}
 durations={'idle':2.4,'walk':.8,'celebrate':1.6,'disappointed':1.8,'ability':1.2,'notice':1.0}
 for clip,duration in durations.items():
  end=round(duration*30)
  for o in moving:
   o.animation_data_create();act=bpy.data.actions.new(prefix+o.name+'_'+clip);o.animation_data.action=act
   for f in range(0,end+1,2):
    t=f/end;w=math.sin(t*2*math.pi);o.location=bases[o.name][0];o.rotation_euler=bases[o.name][1]
    if clip=='idle':
     if o==body:o.location.z+=.012*w
     if o==head:o.rotation_euler.z=.035*w
     if o in arms:o.rotation_euler.x=.035*w
    elif clip=='walk':
     if o in legs:o.rotation_euler.x=(.72 if courier else .60 if cartographer else .48)*w*(1 if o==legs[0] else -1)
     if o in arms:o.rotation_euler.x=(.55 if courier else .40 if cartographer else .32)*w*(-1 if o==arms[0] else 1)
     if o==body:o.location.z+=(.032 if courier else .018)*(1-math.cos(t*4*math.pi));o.rotation_euler.y=.045*w
    elif clip=='celebrate':
     lift=math.sin(math.pi*t)**2
     if o in arms:o.rotation_euler.y=(1 if o==arms[0] else -1)*2.5*lift;o.rotation_euler.x=.20*w
     if o==body:o.location.z+=.18*(math.sin(2*math.pi*t)**2)
     if o==head:o.rotation_euler.z=.12*w
    elif clip=='disappointed':
     droop=math.sin(math.pi*t)**2
     if o==head:o.rotation_euler.x=.32*droop
     if o==body:o.location.z-=.05*droop;o.rotation_euler.x=.10*droop
     if o in arms:o.rotation_euler.y=(1 if o==arms[0] else -1)*.12*droop
    elif clip=='ability':
     lift=math.sin(math.pi*t)**2
     if o in arms:o.rotation_euler.x=(-1.15 if courier else -.8)*lift;o.rotation_euler.y=(1 if o==arms[0] else -1)*(.18 if courier else .55)*lift
     if o==body:o.rotation_euler.z=(.18 if courier else -.10)*lift
     if o==head:o.rotation_euler.x=(.18 if cartographer else -.12)*lift
     if cartographer and o==arms[1]:o.rotation_euler.x=-1.1*lift;o.rotation_euler.z=-.2*lift
    elif clip=='notice':
     lift=math.sin(math.pi*t)**2
     if o==head:o.rotation_euler.x=-.22*lift
     if o in arms:o.rotation_euler.y=(1 if o==arms[0] else -1)*.35*lift
    o.keyframe_insert('location',frame=f);o.keyframe_insert('rotation_euler',frame=f)
   for fc in act.fcurves:
    for k in fc.keyframe_points:k.interpolation='LINEAR'
   o.animation_data.action=None;track=o.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,0,act)
  for o in moving:o.location=bases[o.name][0];o.rotation_euler=bases[o.name][1]
 bpy.ops.object.select_all(action='DESELECT')
 for o in objs:o.select_set(True)
 bpy.context.view_layer.objects.active=root
 bpy.context.scene.frame_set(0)
 bpy.ops.export_scene.gltf(filepath=os.path.join(OUT,'character-'+kind+'.glb'),use_selection=True,export_format='GLB',export_animation_mode='NLA_TRACKS',export_nla_strips=True,export_frame_range=False,export_force_sampling=True,export_yup=True)
 mesh=[o for o in objs if o.type=='MESH'];pts=[o.matrix_world@Vector(c) for o in mesh for c in o.bound_box]
 return root,{'file':'character-'+kind+'.glb','boundsYUp':{'min':[round(min(p[i] for p in pts),4) for i in [0,2]]+[round(-max(p.y for p in pts),4)],'max':[round(max(p[i] for p in pts),4) for i in [0,2]]+[round(-min(p.y for p in pts),4)]},'height':round(max(p.z for p in pts)-min(p.z for p in pts),3),'triangles':sum(sum(len(f.vertices)-2 for f in o.data.polygons) for o in mesh),'meshCount':len(mesh),'clips':durations,'forward':'+Z','up':'+Y','rightsStatement':'Original project asset; no separate third-party license granted','animation':'Articulated rigid meshes; named object-transform NLA clips'}
if __name__=='__main__':
 a,ma=character('courier');b,mb=character('botanist')
 json.dump({'originalAuthorship':'Original procedural designs created for 山海都市岛. No third-party artwork, textures, or geometry sources. No separate third-party license granted.','characters':[ma,mb]},open(os.path.join(OUT,'characters-manifest.json'),'w'),ensure_ascii=False,indent=2)
 a.location.x=-.65;b.location.x=.65
 # Warm studio presentation, source file contains the complete scene and animations.
 bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Preview floor';floor.data.materials.append(mat('cream'))
 bpy.ops.object.camera_add(location=(3,-6,3));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=3.2;bpy.context.scene.camera=cam
 for loc,power,size in [((-3,-4,6),700,5),((4,-1,4),500,4),((0,3,5),800,3)]:
  bpy.ops.object.light_add(type='AREA',location=loc);l=bpy.context.object;l.data.energy=power;l.data.shape='DISK';l.data.size=size;l.rotation_euler=(Vector((0,0,1))-l.location).to_track_quat('-Z','Y').to_euler()
 s=bpy.context.scene;s.render.engine='CYCLES';s.cycles.samples=64;s.cycles.use_denoising=False;s.render.resolution_x=1200;s.render.resolution_y=1000;s.render.resolution_percentage=100;s.world.color=(.35,.35,.35);s.view_settings.view_transform='AgX';s.render.image_settings.file_format='PNG';s.render.filepath=os.path.join(SRC,'characters-preview.png');s.render.fps=30;s.frame_set(0)
 bpy.ops.wm.save_as_mainfile(filepath=os.path.join(SRC,'characters.blend'));bpy.ops.render.render(write_still=True)
 print('CHARACTER_MANIFEST',json.dumps([ma,mb]))
