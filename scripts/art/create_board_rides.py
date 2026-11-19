"""Original main-board vehicles. Blender coordinates: forward -Y, up Z."""
import math
from pathlib import Path
import bpy
from mathutils import Vector
root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene

def paint(name, rgb, metal=0):
    m=bpy.data.materials.new(name)
    m.diffuse_color=(*rgb,1)
    m.use_nodes=True
    shader=m.node_tree.nodes['Principled BSDF']
    for k,v in [('Base Color',m.diffuse_color),('Metallic',metal),('Roughness',.34)]:
        shader.inputs[k].default_value=v
    return m

lagoon=paint('Lagoon enamel',(.03,.62,.51))
cherry=paint('Cherry lacquer',(.89,.105,.055))
cream=paint('Buttermilk',(.98,.80,.48))
brass=paint('Warm brass',(.92,.53,.16),.35)
rubber=paint('Tread',(.028,.04,.045))
leather=paint('Chestnut leather',(.20,.07,.036))
glass=paint('Aqua windscreen',(.21,.74,.79),.18)

def base(name):
    o=bpy.data.objects.new(name,None);scene.collection.objects.link(o)
    return o

def finish(o,name,p,m):
    o.name=name;o.parent=p;o.data.materials.append(m)
    for f in o.data.polygons:f.use_smooth=True
    return o

def oval(name,p,xyz,scale,m):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=10,location=xyz)
    o=bpy.context.object;o.scale=scale
    return finish(o,name,p,m)

def rod(name,p,a,b,r,m):
    delta=Vector(b)-Vector(a)
    bpy.ops.mesh.primitive_cylinder_add(vertices=12,radius=r,depth=delta.length,location=(Vector(a)+Vector(b))/2)
    o=bpy.context.object;o.rotation_euler=delta.to_track_quat('Z','Y').to_euler()
    return finish(o,name,p,m)

def shell(name,p,sections,m):
    # Cross sections give the nose, haunches and leg shield continuous curvature.
    v=[];faces=[];sides=20
    for y,z,w,h in sections:
        for j in range(sides):
            t=2*math.pi*j/sides
            v.append((w*math.cos(t),y,z+h*math.sin(t)))
    for i in range(len(sections)-1):
        for j in range(sides):
            a=i*sides+j;b=i*sides+(j+1)%sides
            faces.append((a,a+sides,b+sides,b))
    faces.extend([tuple(range(sides)),tuple(reversed(range(len(v)-sides,len(v))))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(v,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o)
    finish(o,name,p,m)
    bpy.context.view_layer.objects.active=o
    o.select_set(True)
    mod=o.modifiers.new('Sculpted shoulders','SUBSURF');mod.levels=1
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return o

def wheel(p,name,x,y,r,width):
    pivot=base(name);pivot.parent=p;pivot.location=(x,y,r)
    oval('Tire',pivot,(0,0,0),(width,r,r),rubber)
    for side in (-1,1):
        oval('Wheel rim',pivot,(side*width*.85,0,0),(width*.24,r*.67,r*.67),cream)
        for i in range(3):
            t=i*2*math.pi/3
            rod('Hub spoke',pivot,(side*width,0,0),(side*width,r*.52*math.sin(t),r*.52*math.cos(t)),.019,brass)
    return pivot

motor=base('MOTOR')
wheel(motor,'wheel_motor_front',0,-.88,.34,.14)
wheel(motor,'wheel_motor_rear',0,.78,.34,.16)
shell('Pearl side cowl',motor,[(.03,.55,.15,.13),(.24,.58,.38,.25),(.67,.60,.46,.31),(1.07,.55,.38,.24),(1.18,.51,.10,.12)],lagoon)
shell('Step through floor',motor,[(-.8,.48,.15,.13),(-.58,.35,.30,.09),(.14,.35,.30,.08),(.52,.49,.23,.16)],cream)
shell('Curved front apron',motor,[(-.88,.97,.18,.16),(-.80,.84,.31,.31),(-.71,.66,.35,.29),(-.60,.48,.28,.13)],lagoon)
oval('Piped saddle',motor,(0,.38,.90),(.38,.46,.12),cream)
oval('Leather seat',motor,(0,.38,.95),(.37,.45,.11),leather)
rod('Steering stem',motor,(0,-.77,.36),(0,-.69,1.27),.07,brass)
rod('Handlebars',motor,(-.43,-.68,1.26),(.43,-.68,1.26),.045,rubber)
oval('Chrome lamp',motor,(0,-.74,1.22),(.18,.16,.155),brass)
oval('Headlight',motor,(0,-.87,1.22),(.14,.045,.115),cream)
for side in [-1,1]:
    rod('Mirror stem',motor,(side*.30,-.68,1.27),(side*.43,-.72,1.49),.018,brass)
    oval('Mirror',motor,(side*.43,-.72,1.51),(.115,.035,.075),glass)
    rod('Running strip',motor,(side*.31,-.47,.39),(side*.32,.20,.40),.025,brass)

car=base('CAR')
for side in [-1,1]:
    for y,axle in [(-.78,'front'),(.74,'rear')]:
        wheel(car,f'wheel_car_{side}_{axle}',.68*side,y,.31,.17)
shell('Speedster hull',car,[(-1.42,.44,.25,.13),(-1.28,.48,.63,.22),(-.86,.57,.72,.26),(-.43,.56,.67,.24),(.04,.43,.65,.13),(.58,.46,.69,.19),(.90,.57,.73,.26),(1.24,.52,.60,.21),(1.34,.47,.30,.13)],cherry)
for side in [-1,1]:
    rail=oval('Swept door',car,(side*.64,.06,.57),(.12,.67,.20),cherry)
    rod('Door trim',car,(side*.69,-.45,.66),(side*.69,.51,.66),.03,cream)
    oval('Headlamp housing',car,(side*.48,-1.21,.60),(.15,.13,.13),brass)
    oval('Headlamp glass',car,(side*.48,-1.31,.61),(.12,.04,.095),cream)
    oval('Tail lamp',car,(side*.5,1.17,.59),(.09,.08,.07),cream)
oval('Seat base',car,(0,.25,.57),(.46,.38,.12),leather)
oval('Seat back',car,(0,.55,.79),(.47,.12,.32),leather)
oval('Dashboard cowl',car,(0,-.46,.79),(.58,.14,.12),cream)
rod('Screen surround',car,(-.54,-.49,.76),(-.47,-.39,1.02),.026,brass)
rod('Screen surround',car,(.54,-.49,.76),(.47,-.39,1.02),.026,brass)
oval('Curved windscreen',car,(0,-.43,.91),(.52,.037,.145),glass)
for x in [-.075,.075]:
    oval('Bonnet pinstripe',car,(x,-.95,.795),(.038,.38,.032),cream)
for x in [-.26,-.13,0,.13,.26]:
    rod('Grille bar',car,(x,-1.32,.41),(x,-1.32,.57),.022,brass)
bpy.ops.object.select_all(action='SELECT')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/board-rides.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/board-rides.glb'),export_format='GLB',export_yup=True)
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_cavity=True
scene.render.resolution_x=640;scene.render.resolution_y=400;scene.render.resolution_percentage=100
motor.location.x=-1.35;car.location.x=1.15
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=5.5
for i,pos in enumerate([(3,-6,3),(-3,5,3)]):
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.6))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/dafuweng-rides-{i}.png';bpy.ops.render.render(write_still=True)
