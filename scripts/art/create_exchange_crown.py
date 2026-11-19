"""Original enamel market arrow and minted coin for the main board exchanges."""
from pathlib import Path
from math import radians
import bpy
from mathutils import Vector

root = Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene = bpy.context.scene
def material(name, color):
    m = bpy.data.materials.new(name)
    m.diffuse_color = (*color, 1)
    m.use_nodes = True
    shader = m.node_tree.nodes.get('Principled BSDF')
    shader.inputs['Base Color'].default_value = m.diffuse_color
    shader.inputs['Roughness'].default_value = .34
    return m

gold = material('Honey gold', (.99,.52,.055))
enamel = material('Jade enamel', (.035,.55,.39))
ivory = material('Ivory inset', (1,.87,.53))

def finish(obj, name, mat, radius):
    obj.name = name
    obj.data.materials.append(mat)
    bevel = obj.modifiers.new('Rounded cast edges','BEVEL')
    bevel.width, bevel.segments = radius, 3
    obj.modifiers.new('Face normals','WEIGHTED_NORMAL')

def coin(name, r, y, depth, mat):
    bpy.ops.mesh.primitive_cylinder_add(vertices=48,radius=r,depth=depth,location=(0,y,.60),rotation=(radians(90),0,0))
    finish(bpy.context.object,name,mat,.025)

coin('Minted rim',.66,0,.22,gold)
for side in [-1,1]:
    coin('Inset face',.56,.12*side,.045,enamel)
    outline=[(-.40,.41),(-.20,.64),(-.03,.50),(.16,.72),(.06,.79),(.38,.86),(.35,.55),(.26,.64),(-.03,.34),(-.21,.48),(-.30,.32)]
    if side==1: outline=[(-x,z) for x,z in outline]
    verts=[(x,y*side,z) for y in [.15,.22] for x,z in outline]
    n=len(outline)
    faces=[tuple(reversed(range(n))),tuple(range(n,2*n))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
    mesh=bpy.data.meshes.new('Stepped arrow');mesh.from_pydata(verts,[],faces);mesh.update()
    obj=bpy.data.objects.new('Arrow',mesh);scene.collection.objects.link(obj)
    finish(obj,'Raised price arrow',ivory,.016)
bpy.ops.object.select_all(action='SELECT')
bpy.context.view_layer.objects.active=next(iter(scene.objects))
bpy.ops.object.convert(target='MESH')
bpy.ops.object.join()
crown=bpy.context.object;crown.name='exchange_crown'
bpy.ops.object.origin_set(type='ORIGIN_CURSOR')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/exchange-crown.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/exchange-crown.glb'),export_format='GLB',use_selection=True,export_yup=True)
scene.render.engine='BLENDER_WORKBENCH'
scene.display.shading.color_type='MATERIAL'
scene.display.shading.light='STUDIO'
scene.display.shading.show_shadows=True
scene.display.shading.show_cavity=True
scene.display.shading.background_type='VIEWPORT'
scene.display.shading.background_color=(.17,.23,.23)
scene.render.resolution_x=scene.render.resolution_y=360
scene.render.resolution_percentage=100
bpy.ops.object.camera_add()
scene.camera=bpy.context.object
scene.camera.data.type='ORTHO'
scene.camera.data.ortho_scale=1.8
for i,pos in enumerate([(1,-4,1.8),(3,-2,2),(-1,4,2)]):
    scene.camera.location=pos
    scene.camera.rotation_euler=(Vector((0,0,.60))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/dafuweng-exchange-{i}.png'
    bpy.ops.render.render(write_still=True)
