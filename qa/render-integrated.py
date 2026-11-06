import bpy,math
from mathutils import Vector
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.ops.import_scene.gltf(filepath='/workspace/scratch/c0e87b647ae3/dafuweng-shanhai-slice/qa/shanhai-integrated-scene.glb')
scene=bpy.context.scene
world=bpy.data.worlds.new('Sea air');scene.world=world;world.use_nodes=True;world.node_tree.nodes['Background'].inputs[0].default_value=(.73,.85,.8,1);world.node_tree.nodes['Background'].inputs[1].default_value=.6
bpy.ops.object.light_add(type='AREA',location=(-18,-15,30));sun=bpy.context.object;sun.data.energy=2400;sun.data.shape='DISK';sun.data.size=12;sun.rotation_euler=(Vector((0,0,0))-sun.location).to_track_quat('-Z','Y').to_euler()
bpy.ops.object.camera_add(location=(26,-35,34));cam=bpy.context.object;cam.rotation_euler=(Vector((0,0,0))-cam.location).to_track_quat('-Z','Y').to_euler();cam.data.type='ORTHO';cam.data.ortho_scale=48.8;scene.camera=cam
scene.render.engine='CYCLES';scene.cycles.samples=40;scene.cycles.use_denoising=False;scene.render.resolution_x=1096;scene.render.resolution_y=875;scene.render.resolution_percentage=100;scene.view_settings.view_transform='AgX';scene.render.image_settings.file_format='PNG';scene.render.filepath='/workspace/scratch/c0e87b647ae3/dafuweng-shanhai-slice/qa/shanhai-integrated-offline.png';bpy.ops.render.render(write_still=True)
