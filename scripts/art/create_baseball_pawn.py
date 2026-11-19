"""Rig A-Fei for the main board from the project's original courier tailoring."""
import bpy
from math import radians
from mathutils import Matrix, Vector
from pathlib import Path
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
bpy.ops.import_scene.gltf(filepath=str(root/'art-source/shanhai/character-courier-unmerged.glb'))
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
    if any(x in o.name.lower() for x in ['bag','strap','parcel']):
        bpy.data.objects.remove(o,do_unlink=True);continue
    parent=o.parent
    while parent and parent.name.split('courier_')[-1] not in ['body','head','arm_L','arm_R','leg_L','leg_R']:
        parent=parent.parent
    parents[o.name]=parent.name.split('courier_')[-1] if parent else 'body'
    meshes.append(o)

def attach(o,bone,mat):
    o.data.materials.append(mat);parents[o.name]=bone;meshes.append(o)
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
bpy.context.view_layer.update()
pivots={name:bpy.data.objects['courier_'+name].matrix_world.translation.copy() for name in ['body','head','arm_L','arm_R','leg_L','leg_R']}
# Store garment geometry in model space. Every vertex has a deterministic
# attachment to its authored body part; skinning preserves solid accessories.
for o in meshes:
    world=o.matrix_world.copy();o.parent=None
    o.data=o.data.copy();o.data.transform(world);o.matrix_world=Matrix.Identity(4)
    vg=o.vertex_groups.new(name=parents[o.name]);vg.add(list(range(len(o.data.vertices))),1,'REPLACE')
for o in list(scene.objects):
    if o.type=='EMPTY':bpy.data.objects.remove(o,do_unlink=True)
bpy.ops.object.select_all(action='DESELECT')
for o in meshes:o.select_set(True)
bpy.context.view_layer.objects.active=meshes[0];bpy.ops.object.join();skin=bpy.context.object;skin.name='Afei_uniform'
arm=bpy.data.armatures.new('Board skeleton');rig=bpy.data.objects.new('Afei',arm);scene.collection.objects.link(rig)
bpy.context.view_layer.objects.active=rig;rig.select_set(True);bpy.ops.object.mode_set(mode='EDIT')
for name,pivot in pivots.items():
    b=arm.edit_bones.new(name);b.head=pivot;b.tail=pivot+Vector((0,0,.22))
    if name!='body':b.parent=arm.edit_bones['body']
bpy.ops.object.mode_set(mode='OBJECT')
skin.parent=rig;modifier=skin.modifiers.new('Tailored skin','ARMATURE');modifier.object=rig
scene.render.fps=24;rig.animation_data_create()
# Angles are authored in the common local bone frame. Independent NLA tracks
# export as named glTF clips and can be blended by THREE.AnimationMixer.
for clip,end in [('Idle',48),('Walk',24),('Ride',36),('Cheer',28),('Shock_Hit',22),('Cast',24),('Sad',40)]:
    action=bpy.data.actions.new(clip);rig.animation_data.action=action
    for step in range(5):
        f=1+round((end-1)*step/4);wave=sin(step*pi/2);pulse=sin(step*pi/4)
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
            for path in ['rotation_euler','location']:bone.keyframe_insert(path,frame=f,group=bone.name)
    track=rig.animation_data.nla_tracks.new();track.name=clip;track.strips.new(clip,1,action);track.mute=True
rig.animation_data.action=None
for b in rig.pose.bones:b.matrix_basis=Matrix.Identity(4)
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/afei.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/afei.glb'),export_format='GLB',export_yup=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True)
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_cavity=True
scene.render.resolution_x=scene.render.resolution_y=350;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=2.15
for i,(clip,frame,pos) in enumerate([('Idle',1,(.9,-4,1.5)),('Walk',7,(-2,-3,1.6)),('Ride',1,(2,-2,1.65)),('Cheer',14,(0,-3,1.5))]):
    rig.animation_data.action=bpy.data.actions[clip];scene.frame_set(frame)
    cam.location=pos;cam.rotation_euler=(Vector((0,0,.9))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/dafuweng-afei-{i}.png';bpy.ops.render.render(write_still=True)
