"""Generate a skinned main-board character; pass its catalog key after -- (default afei)."""
import bpy
import sys
from math import radians, sin, cos, pi
from mathutils import Matrix, Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
catalog = {
    'xiaoman': ('courier','coral',(.85,.08,.18)),
    'tianye': ('cartographer','violet',(.44,.29,.09)),
    'jingjing': ('cartographer','violet',(.43,.13,.65)),
    'baroque': ('builder','workBlue',(.55,.19,.05)),
    'lan': ('courier','coral',(.035,.16,.43)),
    'miya': ('botanist','teal',(.03,.47,.31)),
    'hawk': ('builder','workBlue',(.52,.065,.035)),
    'afei': ('courier','coral',None),
}
hero=sys.argv[sys.argv.index('--')+1] if '--' in sys.argv else 'afei'
source,cloth_name,tint=catalog[hero]
prefix=source+'_'
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(root/f'art-source/shanhai/character-{source}-unmerged.glb'))
for o in list(scene.objects):
    o.animation_data_clear()
bpy.context.view_layer.update()
# Reuse the original jacket, shoes, sculpted face and baseball cap. Replace the
# courier package with a turned ash bat and stitched baseball for this profile.
def material(name,color):
    m=bpy.data.materials.new(name);m.diffuse_color=(*color,1);m.use_nodes=True
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color
    return m
ash=material('Honey ash',(.73,.38,.13))
thread=material('Red seam',(.73,.045,.03))
leather=material('Baseball leather',(1,.87,.63))
meshes=[]
parents={}
for o in list(scene.objects):
    if o.type!='MESH':continue
    omit=['bag','strap','parcel']
    if hero!='afei':omit+=['cap','helmet','hat_','hardhat','lamp','goggle','pencil','compass','map_roll']
    if hero not in ['jingjing','tianye']:omit+=['spectacle']
    if any(x in o.name.lower() for x in omit):
        bpy.data.objects.remove(o,do_unlink=True);continue
    parent=o.parent
    while parent and parent.name.split(prefix)[-1] not in ['body','head','arm_L','arm_R','leg_L','leg_R']:
        parent=parent.parent
    parents[o.name]=parent.name.split(prefix)[-1] if parent else 'body'
    meshes.append(o)

def attach(o,bone,mat):
    o.data.materials.append(mat);parents[o.name]=bone;meshes.append(o)
if hero=='afei':
    bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,radius=.10,location=(-.33,-.10,.54))
    ball=bpy.context.object;ball.name='Stitched ball';attach(ball,'arm_L',leather)
    for side in [-1,1]:
        for i in range(5):
            bpy.ops.mesh.primitive_uv_sphere_add(segments=8,ring_count=5,location=(-.33+side*(.035+.005*abs(i-2)),-.19,.51+i*.014))
            stitch=bpy.context.object;stitch.scale=(.013,.008,.006);attach(stitch,'arm_L',thread)
    # Revolved sporting bat with a flared knob, narrow grip and round barrel.
    from math import sin,cos,pi
    rings=[(0,.032),(.025,.055),(.06,.03),(.27,.034),(.40,.055),(.64,.082),(.70,.077),(.73,.045),(.74,.009)]
    verts=[(r*cos(i*pi/10),r*sin(i*pi/10),z) for z,r in rings for i in range(20)]
    faces=[(k*20+i,k*20+(i+1)%20,(k+1)*20+(i+1)%20,(k+1)*20+i) for k in range(len(rings)-1) for i in range(20)]
    mesh=bpy.data.meshes.new('Turned maple');mesh.from_pydata(verts,[],faces);mesh.update()
    bat=bpy.data.objects.new('Bat',mesh);scene.collection.objects.link(bat);bat.location=(.31,-.02,.55);bat.rotation_euler=(radians(-32),radians(27),0);attach(bat,'arm_R',ash)
else:
    cloth=bpy.data.materials[cloth_name]
    cloth.diffuse_color=(*tint,1)
    cloth.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=cloth.diffuse_color
    silk=material('Silk trim',(.98,.69,.31))
    navy=material('Ink velvet',(.045,.062,.09))
    hair=bpy.data.materials['hair']
    def oval(name,xyz,scale,mat,bone='head',tilt=0):
        bpy.ops.mesh.primitive_uv_sphere_add(segments=20,ring_count=12,location=xyz)
        obj=bpy.context.object;obj.name=name;obj.scale=scale;obj.rotation_euler.y=tilt
        for f in obj.data.polygons:f.use_smooth=True
        attach(obj,bone,mat)
    def cut(name,xyz,r1,r2,depth,mat,bone='head',vertices=12):
        bpy.ops.mesh.primitive_cone_add(vertices=vertices,radius1=r1,radius2=r2,depth=depth,location=xyz)
        obj=bpy.context.object;obj.name=name;attach(obj,bone,mat);return obj
    if hero=='xiaoman':
        for side in [-1,1]:
            oval('Braided bun',(side*.27,.03,1.53),(.16,.15,.16),hair)
            oval('Ribbon loop',(side*.14,-.13,1.57),(.14,.07,.067),cloth,tilt=side*.38)
        oval('Bow knot',(0,-.15,1.58),(.055,.06,.06),silk)
        cut('Pleated coat skirt',(0,0,.55),.30,.205,.23,cloth,'body',14)
    elif hero in ('hawk','tianye'):
        straw=material('Tanned brim',(.67,.36,.13) if hero=='hawk' else (.85,.62,.29))
        oval('Swept brim',(0,.035,1.50),(.46,.36,.055),straw,tilt=.12 if hero=='hawk' else -.07)
        cut('Felt crown',(0,.025,1.59),.30,.235,.23,straw)
        cut('Woven band',(0,.025,1.53),.303,.292,.05,navy)
        if hero=='hawk':
            oval('Bandana neck',(0,-.04,1.035),(.23,.17,.075),cloth,'body')
            cut('Bandana point',(0,-.18,.94),.015,.13,.19,cloth,'body',3)
        else:
            for side in [-1,1]:
                oval('Denim bib brace',(side*.13,-.158,.89),(.041,.04,.18),navy,'body',tilt=side*.22)
    elif hero=='jingjing':
        oval('Side swept bob',(-.24,.025,1.27),(.12,.19,.27),hair,tilt=.16)
        for side in [-1,1]:
            cut('Crystal earring',(side*.315,-.06,1.20),.008,.064,.135,cloth,vertices=6)
        cut('Crystal hair comb',(.22,-.14,1.54),.08,.008,.17,silk,vertices=5)
    elif hero=='baroque':
        for i in range(3):
            oval('Twisted turban',(0,.015,1.51+i*.066),(.36-i*.026,.28-i*.014,.105),leather,tilt=(-1)**i*.16)
        oval('Plume',(.17,.035,1.79),(.073,.042,.205),cloth,tilt=-.32)
        cut('Turban jewel',(0,-.24,1.57),.07,.01,.10,silk,vertices=6)
        for side in [-1,1]:oval('Waxed moustache',(side*.054,-.292,1.22),(.067,.02,.025),hair,tilt=side*.28)
    elif hero=='lan':
        oval('Storm hood',(0,.045,1.40),(.334,.266,.292),navy)
        oval('Face wrap',(0,-.202,1.205),(.285,.108,.099),cloth)
        oval('Headband',(0,-.04,1.45),(.33,.245,.055),cloth)
        for i in range(2):oval('Trailing scarf',(.19+i*.07,.19,1.30-i*.10),(.058,.07,.21),cloth,tilt=-.40)
    elif hero=='miya':
        flower=material('Hibiscus',(.91,.14,.21))
        for i in range(5):
            t=i*2*pi/5
            oval('Hibiscus petal',(.24+.077*cos(t),-.155,1.48+.077*sin(t)),(.081,.034,.066),flower,tilt=t)
        oval('Pollen',(.24,-.192,1.48),(.044,.023,.044),silk)
        for i in range(9):
            t=i*pi/8;oval('Shell lei',(.18*cos(t),-.13-.05*sin(t),1.03-.12*sin(t)),(.037,.028,.044),leather,'body',tilt=t)
bpy.context.view_layer.update()
pivots={name:bpy.data.objects[prefix+name].matrix_world.translation.copy() for name in ['body','head','arm_L','arm_R','leg_L','leg_R']}
# Store garment geometry in model space. Every vertex has a deterministic
# attachment to its authored body part; skinning preserves solid accessories.
for o in meshes:
    world=o.matrix_world.copy();o.parent=None
    o.data=o.data.copy();o.data.transform(world);o.matrix_world=Matrix.Identity(4)
    component=o.name.removeprefix(prefix)
    if component.startswith(('eye','spark')):parents[o.name]='eyes'
    elif component.startswith('brow'):parents[o.name]='brows'
    elif component.startswith('smile'):parents[o.name]='mouth'
    vg=o.vertex_groups.new(name=parents[o.name]);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
for o in list(scene.objects):
    if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();skin=bpy.context.object;skin.name=hero+'_uniform'
arm=bpy.data.armatures.new('Board skeleton');rig=bpy.data.objects.new(hero,arm);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
pivots.update(eyes=Vector((0,-.274,1.31)),brows=Vector((0,-.270,1.38)),mouth=Vector((0,-.275,1.20)))
for name,pivot in pivots.items():
    b=arm.edit_bones.new(name);b.head=pivot;b.tail=pivot+Vector((0,0,.22))
    if name!='body':b.parent=arm.edit_bones['head' if name in ('eyes','brows','mouth') else 'body']
bpy.ops.object.mode_set(mode='OBJECT')
skin.parent=rig;modifier=skin.modifiers.new('Tailored skin','ARMATURE');modifier.object=rig
scene.render.fps=24;rig.animation_data_create()
# Angles are authored in the common local bone frame. Independent NLA tracks
# export as named glTF clips and can be blended by THREE.AnimationMixer.
for clip,end in [('Idle',48),('Walk',24),('Ride',36),('Cheer',28),('Shock_Hit',22),('Cast',24),('Sad',40)]:
    action=bpy.data.actions.new(clip);rig.animation_data.action=action
    times=[0,.25,.5,.75,1] if clip!='Idle' else [0,.25,.5,.75,.80,.86,1]
    for phase in times:
        f=1+round((end-1)*phase);wave=sin(phase*2*pi);pulse=sin(phase*pi)
        for bone in rig.pose.bones:
            bone.rotation_mode='XYZ';bone.location=(0,0,0);bone.rotation_euler=(0,0,0)
            arm_side=1 if bone.name=='arm_R' else -1 if bone.name=='arm_L' else 0
            leg_side=1 if bone.name=='leg_R' else -1 if bone.name=='leg_L' else 0
            if clip=='Idle' and bone.name=='head':bone.rotation_euler.y=radians(5)*wave
            if clip=='Walk':bone.rotation_euler.x=radians(34*wave*(leg_side-arm_side))
            if clip=='Ride':bone.rotation_euler.x=radians(-60*abs(leg_side)-57*abs(arm_side))
            if clip=='Cheer':
                bone.rotation_euler.z=radians(140*pulse*arm_side)
                if bone.name=='body':bone.location.y=.16*pulse
            if clip=='Shock_Hit' and bone.name in ['body','head']:bone.rotation_euler.x=radians(-28)*pulse
            if clip=='Cast' and bone.name=='arm_R':bone.rotation_euler.x=radians(-115)*pulse
            if clip=='Sad' and bone.name=='head':bone.rotation_euler.x=radians(25+3*wave)
            bone.scale=(1,1,1)
            if bone.name=='eyes':
                opened=.14 if clip=='Idle' and phase==.80 else 1
                if clip=='Shock_Hit':opened+=.46*pulse
                elif clip=='Cheer':opened-=.54*pulse
                bone.scale.y=opened
            if bone.name=='brows':
                bone.location.y=(.046 if clip=='Shock_Hit' else .019 if clip=='Cheer' else -.027 if clip=='Sad' else 0)*pulse
                if clip=='Sad':bone.rotation_euler.z=.13*pulse
            if bone.name=='mouth':
                bone.scale.x=1+(.30 if clip=='Cheer' else -.22 if clip=='Sad' else 0)*pulse
                if clip=='Sad':bone.rotation_euler.x=.28*pulse
            for path in ['rotation_euler','location','scale']:bone.keyframe_insert(path,frame=f,group=bone.name)
    track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/f'art-source/main/{hero}.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/f'public/assets/models/{hero}.glb'),export_format='GLB',export_yup=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_cavity=True
scene.render.resolution_x=scene.render.resolution_y=350;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.15
for i,(clip,frame,pos) in enumerate([('Idle',1,(.9,-4,1.5)),('Walk',7,(-2,-3,1.6)),('Ride',1,(2,-2,1.65)),('Cheer',14,(0,-3,1.5))]):
    rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame)
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/dafuweng-{hero}-{i}.png';bpy.ops.render.render(write_still=True)
