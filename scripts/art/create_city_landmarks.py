"""Original main-board landmarks. Run with blender -b --python scripts/art/create_city_landmarks.py."""
import bpy
import math
from pathlib import Path
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
bpy.ops.object.select_all(action='SELECT')
bpy.ops.object.delete(use_global=False)
bpy.context.preferences.filepaths.save_version = 0
palette = {}
for name, color in {'cream':'fff1cc','brick':'c95b47','gold':'f5bd49','sea':'258c91','glass':'32617a','leaf':'72ad58','blue':'80dce6','iron':'465968','stone':'cabe9e'}.items():
    mat = bpy.data.materials.new(name)
    mat.diffuse_color = tuple((int(color[i:i+2],16)/255)**2.2 for i in (0,2,4)) + (1,)
    palette[name] = mat

def part(name, pos, material):
    obj = bpy.context.object
    obj.name = name
    obj.location = pos
    obj.data.materials.append(palette[material])
    parts.append(obj)
    return obj

def box(name, pos, size, material):
    bpy.ops.mesh.primitive_cube_add(size=1)
    obj = part(name,pos,material)
    obj.dimensions = size
    bpy.ops.object.transform_apply(location=False, rotation=False, scale=True)
    mod = obj.modifiers.new('rounded trim','BEVEL')
    mod.width = .035
    mod.segments = 2
    bpy.ops.object.modifier_apply(modifier=mod.name)
    return obj

def cone(name,pos,r,top,height,material,vertices=24):
    bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r,radius2=top,depth=height)
    return part(name,pos,material)

def dome(name,pos,size,material):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=8)
    obj = part(name,pos,material)
    obj.scale = size
    return obj

models = []
for kind in ['hotel','gas_station','lab','news','fountain','clinic','prison','magic','villa','apartment']:
    parts = []
    moving = []
    if kind != 'fountain':
        box('paved forecourt',(0,0,.07),(3,2.45,.14),'stone')
    if kind == 'hotel':
        box('hotel lobby',(0,0,.8),(2.75,1.92,1.45),'cream')
        for floor in range(4):
            z = 1.75 + .46*floor
            box('terraced suites',(0,.17,z),(2.12,1.63,.52),'glass')
            box('balcony parapet',(0,.17,z+.23),(2.32,1.78,.12),'cream')
            for x in [-.8,-.4,0,.4,.8]:
                box('window mullion',(x,-.65,z),(.06,.06,.36),'gold')
        cone('copper cupola',(0,.18,3.67),.76,.2,.55,'sea')
        cone('revolving glass door',(0,-.94,.52),.42,.42,.82,'glass')
        moving=[parts[-1],box('glass door blades',(0,-.94,.52),(.77,.05,.75),'gold')]
        box('entrance canopy',(0,-.98,1.12),(1.55,.62,.14),'brick')
        for i in range(5):
            star = cone('five gold lights',((i-2)*.28,-1,1.4),.09,.04,.1,'gold')
            star.rotation_euler.x = math.pi/2
    elif kind == 'gas_station':
        box('cashier kiosk',(0,.65,.64),(2.45,.77,1.05),'cream')
        box('kiosk glazing',(0,.247,.7),(1.85,.06,.52),'glass')
        for x in [-.91,.91]:
            box('column',(x,-.26,1),(.13,.13,1.8),'sea')
            box('pump housing',(x,-.55,.52),(.5,.38,.84),'brick')
            box('pump display',(x,-.75,.69),(.31,.05,.25),'glass')
            dome('hose loop',(x+.28,-.55,.43),(.08,.07,.25),'iron')
        box('floating canopy',(0,-.17,1.88),(3.09,1.65,.23),'sea')
        box('canopy stripe',(0,-1.01,1.88),(3.03,.04,.09),'gold')
    elif kind == 'lab':
        cone('laboratory drum',(0,0,.83),1.05,1.05,1.4,'cream')
        cone('observation windows',(0,0,1.27),1.08,1.08,.45,'glass')
        dome('observatory dome',(0,0,1.55),(1.11,1.11,.91),'sea')
        cone('radar pivot',(.58,.15,2.23),.12,.07,.76,'gold')
        dish=cone('tilted radar dish',(.58,.15,2.58),.09,.49,.24,'cream')
        dish.rotation_euler.y=.67
        receiver=dome('radar receiver',(.75,.15,2.83),(.08,.08,.08),'gold')
        moving=[dish,receiver]
    elif kind == 'villa':
        box('landscaped garden',(0,0,.18),(2.92,2.37,.16),'leaf')
        for x,y,w,d,h in [(-.47,.26,1.38,1.37,1.72),(.62,.39,.98,1.12,1.12)]:
            box('stucco wing',(x,y,.23+h/2),(w,d,h),'cream')
            cap=cone('hipped roof',(x,y,.36+h),w*.79,.15,.45,'brick',4)
            cap.rotation_euler.z=math.pi/4
            for dx in [-.32,.32]:
                box('french windows',(x+dx,y-d/2-.025,.83),(.35,.05,.73),'glass')
        for x in [-1,-.44,.12]:
            box('veranda pier',(x,-.64,.77),(.09,.09,1.07),'cream')
        box('veranda eaves',(-.44,-.54,1.34),(1.55,.59,.14),'sea')
        for x in [.44,.83,1.2]:
            dome('flowering hedge',(x,-.79,.43),(.25,.22,.19),'leaf')
            dome('blossom',(x,-.83,.61),(.09,.08,.09),'brick')
    elif kind == 'apartment':
        for i in range(5):
            z=.51+i*.58
            x=.1 if i%2 else -.1
            box('apartment floor',(x,.07,z),(2.02,1.62,.60),'cream')
            box('wraparound glazing',(x,-.76,z), (1.72,.07,.41),'glass')
            box('side glazing',(x+1.02,.02,z),(.045,1.12,.40),'glass')
            box('cantilever balcony',(x,-.78,z-.22),(2.19,.49,.1),'sea')
            for end in [-.89,.89]:
                box('balcony screen',(x+end,-.90,z),(.09,.29,.41),'brick')
        box('roof garden',(0,.07,3.20),(2.17,1.87,.13),'leaf')
        box('rooftop lift',(-.45,.29,3.5),(.69,.72,.55),'cream')
        for y in [-.47,.44]: dome('planter shrub',(.6,y,3.46),(.24,.20,.22),'leaf')
    elif kind == 'clinic':
        box('treatment wing',(-.33,.16,.99),(1.9,1.92,1.72),'cream')
        box('roof cornice',(-.33,.16,1.9),(2.04,2.04,.19),'sea')
        for x in [-.86,-.38,.1]:
            box('ward window',(x,-.82,1.34),(.36,.05,.44),'glass')
        box('emergency door',(-.35,-.84,.54),(.56,.08,.75),'glass')
        box('red cross vertical',(-.35,-.87,2.12),(.18,.13,.6),'brick')
        box('red cross horizontal',(-.35,-.87,2.12),(.58,.13,.18),'brick')
        box('ambulance cabin',(.98,-.10,.51),(.69,1.35,.53),'cream')
        box('windscreen',(.98,-.67,.72),(.57,.23,.24),'glass')
        box('rescue stripe',(.98,-.10,.47),(.71,1.36,.09),'brick')
        for x in [.62,1.34]:
            for y in [-.46,.3]:
                wheel=cone('ambulance tyre',(x,y,.3),.16,.16,.08,'iron')
                wheel.rotation_euler.y=math.pi/2
        dome('blue ambulance beacon',(.98,.04,.84),(.15,.09,.08),'blue')
    elif kind == 'prison':
        box('custody block',(0,.14,.89),(2.33,1.81,1.53),'stone')
        box('roof coping',(0,.14,1.69),(2.55,2.01,.17),'iron')
        for x in [-.66,.65]:
            box('recessed cell',(x,-.79,.96),(.69,.06,.63),'glass')
            for dx in [-.23,0,.23]:
                box('iron grille',(x+dx,-.85,.96),(.05,.06,.68),'iron')
        box('watch tower',(-.83,.47,1.88),(.78,.88,1.48),'cream')
        cone('watch tower canopy',(-.83,.47,2.68),.66,.39,.33,'sea')
        cone('shield over gate',(0,-.88,1.57),.21,.21,.08,'gold').rotation_euler.x=math.pi/2
    elif kind == 'magic':
        cone('octagonal tower',(-.25,.14,1.16),.91,.74,2.05,'cream')
        cone('witch hat eaves',(-.25,.14,2.35),1.14,.68,.44,'sea')
        cone('hat spire',(-.25,.14,2.97),.68,.04,.86,'sea')
        dome('moon finial',(-.25,.14,3.54),(.22,.13,.22),'gold')
        cone('side turret',(.75,-.23,.7),.44,.4,1.22,'brick')
        cone('turret roof',(.75,-.23,1.52),.57,.03,.55,'sea')
        for x,z in [(-.51,1.4),(-.10,1.66),(.02,1.21)]:
            dome('celestial lights',(x,-.64,z),(.09,.04,.09),'gold')
    elif kind == 'news':
        box('radio studio',(0,0,.63),(2.02,1.6,1.05),'cream')
        box('studio window',(0,-.82,.7),(1.45,.05,.5),'glass')
        for i in range(3):
            z=1.44+i*.66
            cone('transmission mast',(0,.12,z),.53-i*.11,.38-i*.11,.7,'brick')
            cone('maintenance deck',(0,.12,z+.3),.53-i*.11,.53-i*.11,.09,'cream')
        cone('aerial',(0,.12,3.53),.05,.03,.78,'iron')
        dome('signal lamp',(0,.12,3.95),(.11,.11,.11),'gold')
    else:
        cone('fountain basin',(0,0,.14),.54,.61,.21,'cream')
        cone('blue water',(0,0,.25),.53,.53,.04,'blue')
        cone('fountain stem',(0,0,.42),.13,.07,.36,'stone')
        cone('upper basin',(0,0,.64),.12,.33,.14,'cream')
        dome('water plume',(0,0,.91),(.10,.10,.23),'blue')
    bpy.ops.object.select_all(action='DESELECT')
    for obj in parts:
        obj.select_set(obj not in moving)
    bpy.context.view_layer.objects.active = parts[0]
    bpy.ops.object.join()
    obj=bpy.context.object
    obj.name='board_'+kind
    bpy.context.scene.cursor.location=(0,0,0)
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
    if moving:
        bpy.ops.object.select_all(action='DESELECT')
        for piece in moving: piece.select_set(True)
        bpy.context.view_layer.objects.active=moving[0]
        bpy.ops.object.join()
        rotor=bpy.context.object
        rotor.name='radar_rotor' if kind=='lab' else 'lobby_door'
        rotor.parent=obj
    models.append(obj)

bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/city-landmarks.glb'),export_format='GLB')
for i, obj in enumerate(models):
    obj.location.x=(i%5-2)*3.7
    obj.location.y=(i//5-.5)*4.3
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/city-landmarks.blend'))
scene=bpy.context.scene
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.render.resolution_x=1100
scene.render.resolution_y=640
scene.render.resolution_percentage=100
for i, offset in enumerate([(3,-18,14),(-4,-18,14)]):
    bpy.ops.object.camera_add(location=offset)
    cam=bpy.context.object
    cam.rotation_euler=(Vector((0,0,1.4))-cam.location).to_track_quat('-Z','Y').to_euler()
    cam.data.type='ORTHO'
    cam.data.ortho_scale=21
    scene.camera=cam
    scene.render.filepath='/tmp/dafuweng-landmarks-'+str(i)+'.png'
    bpy.ops.render.render(write_still=True)
