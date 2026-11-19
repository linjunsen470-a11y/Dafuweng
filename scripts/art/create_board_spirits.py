"""Eight original floating board spirits. Blender Z-up, facing -Y."""
import bpy, math
from mathutils import Vector
from pathlib import Path
from math import sin,cos,pi
root=Path(__file__).resolve().parents[2]
bpy.ops.wm.read_factory_settings(use_empty=True)
scene=bpy.context.scene
def mat(name,hexcolor):
    rgb=tuple(((int(hexcolor[k:k+2],16)/255+.055)/1.055)**2.4 for k in (0,2,4))
    m=bpy.data.materials.new(name);m.diffuse_color=(*rgb,1);m.use_nodes=True
    m.node_tree.nodes.get('Principled BSDF').inputs['Base Color'].default_value=m.diffuse_color
    return m
gold=mat('Hammered gold','F8C050');cream=mat('Rice silk','FFF1CC');ink=mat('Ink','332D40');skin=mat('Warm clay','EFB48C')
red=mat('Vermilion','D44937');green=mat('Jade','399984');plum=mat('Aubergine','705182');silver=mat('Moon silver','AFC9D5')
brown=mat('Walnut','885431');pink=mat('Peony','F590A1');blue=mat('Storm','587491')
parts=[]
def piece(o,name,m):
    o.name=name;o.data.materials.append(m);parts.append(o);return o
def oval(name,p,scale,m,tilt=0):
    bpy.ops.mesh.primitive_uv_sphere_add(segments=16,ring_count=10,location=p)
    o=piece(bpy.context.object,name,m);o.scale=scale;o.rotation_euler.y=tilt
    for f in o.data.polygons:f.use_smooth=True
    return o
def loft(name,rings,m,n=20):
    verts=[];faces=[]
    for z,x,y,w,d in rings:
        for i in range(n):
            t=i*2*pi/n;verts.append((x+w*cos(t),y+d*sin(t),z))
    for k in range(len(rings)-1):
        for i in range(n):
            j=(i+1)%n;faces.append((k*n+i,k*n+j,(k+1)*n+j,(k+1)*n+i))
    faces.extend([tuple(reversed(range(n))),tuple(range(len(verts)-n,len(verts)))])
    mesh=bpy.data.meshes.new(name);mesh.from_pydata(verts,[],faces);mesh.update()
    o=bpy.data.objects.new(name,mesh);scene.collection.objects.link(o);piece(o,name,m)
    for f in mesh.polygons:f.use_smooth=True
    return o
def line(name,points,r,m):
    curve=bpy.data.curves.new(name,'CURVE');curve.dimensions='3D';curve.bevel_depth=r;curve.bevel_resolution=2
    spl=curve.splines.new('BEZIER');spl.bezier_points.add(len(points)-1)
    for point,xyz in zip(spl.bezier_points,points):point.co=xyz;point.handle_left_type=point.handle_right_type='AUTO'
    o=bpy.data.objects.new(name,curve);scene.collection.objects.link(o)
    bpy.context.view_layer.objects.active=o;o.select_set(True);bpy.ops.object.convert(target='MESH');piece(o,name,m)
def halo(z):
    bpy.ops.mesh.primitive_torus_add(major_radius=.32,minor_radius=.032,major_segments=32,minor_segments=8,location=(0,0,z))
    piece(bpy.context.object,'Floating nimbus',gold)
def ingot(x,y,z):
    loft('Folded ingot',[(z,x,y,.10,.07),(z+.05,x,y,.22,.13),(z+.10,x,y,.27,.11)],gold)
    oval('Ingot heart',(x,y,z+.11),(.135,.10,.115),gold)
    for side in [-1,1]:oval('Ingot ears',(x+side*.19,y,z+.11),(.08,.07,.08),gold,side*.6)
def wing(side,bat=False):
    if bat:
        pts=[(.18,.67),(.40,.98),(.71,1.10),(.64,.87),(.75,.68),(.54,.72),(.47,.53),(.37,.65),(.25,.53)]
        verts=[(side*x,y,z) for y in [.02,.12] for x,z in pts];n=len(pts)
        faces=[tuple(range(n)),tuple(reversed(range(n,n*2)))]+[(i,(i+1)%n,(i+1)%n+n,i+n) for i in range(n)]
        mesh=bpy.data.meshes.new('Wing');mesh.from_pydata(verts,[],faces);o=bpy.data.objects.new('Wing',mesh);scene.collection.objects.link(o);piece(o,'Scalloped wing',plum)
        line('Wing rib',[(side*.24,0,.66),(side*.40,0,.93),(side*.68,.01,1.08)],.027,ink)
    else:
        for i in range(4):oval('Flight feather',(side*(.32+i*.085),.07,.69+i*.087),(.09,.065,.25-i*.018),cream,-side*.53)
roles=[('FORTUNE',green),('GREAT_FORTUNE',red),('LUCK',pink),('EARTH',brown),('MISFORTUNE',blue),('BAD',plum),('ANGEL',cream),('DEMON',plum)]
models=[]
for idx,(name,cloth) in enumerate(roles):
    parts=[]
    # The hem flows up on one side; the tapered silhouette floats clear of tiles.
    loft('Swept robe',[(.04,.12,.05,.04,.06),(.12,0,.04,.24,.17),(.20,-.03,0,.33,.22),(.39,0,0,.24,.20),(.60,0,0,.28,.21),(.67,0,0,.19,.15)],cloth)
    for side in [-1,1]:
        oval('Turned cuff',(side*.23,-.075,.49),(.12,.13,.20),cloth,-side*.45)
        oval('Mitten',(side*.255,-.16,.40),(.09,.08,.095),skin)
    line('Embroidered collar',[(-.16,-.12,.66),(-.025,-.22,.51),(.17,-.15,.61)],.023,gold if idx!=4 else silver)
    oval('Face',(0,-.02,.83),(.265,.219,.245),skin)
    for side in [-1,1]:
        oval('Eye',(side*.092,-.221,.845),(.027,.017,.037),ink)
        oval('Glint',(side*.092-.005,-.236,.856),(.008,.006,.011),cream)
        oval('Blush',(side*.164,-.193,.777),(.043,.016,.024),pink)
    oval('Nose',(0,-.233,.79),(.032,.025,.034),skin)
    for side in [-1,1]:oval('Ear',(side*.248,-.03,.81),(.046,.045,.071),skin)
    corners=.729 if idx in (4,5,7) else .759
    line('Expression',[(-.051,-.217,corners),(0,-.228,.743),(.051,-.217,corners)],.009,ink)
    if idx in (0,1):
        loft('Minister cap',[(1.00,0,0,.275,.20),(1.08,0,0,.28,.20),(1.16,0,.02,.18,.15)],cloth)
        for side in [-1,1]:oval('Hat wing',(side*(.32 if idx else .24),0,1.07),(.17,.055,.047),gold,-side*.22)
        ingot(0,-.24,.32)
        if idx:
            for side in [-1,1]:oval('Moustache',(side*.07,-.222,.739),(.084,.027,.032),ink,side*.21)
            loft('Imperial crown',[(1.14,0,0,.14,.11),(1.25,0,0,.12,.09),(1.29,0,0,.05,.05)],gold)
    elif idx==2:
        for i in range(6):
            t=i*pi/3;oval('Lotus petal',(.17*cos(t),.12*sin(t),1.05),(.09,.065,.145),pink,-.55*cos(t))
        oval('Lotus heart',(0,0,1.10),(.11,.105,.11),gold)
        line('Wish ribbon',[(-.23,.04,.46),(-.4,.04,.32),(-.48,-.02,.50),(-.43,-.04,.62)],.038,red)
    elif idx==3:
        loft('Earthwarden straw hat',[(.99,0,0,.36,.30),(1.02,0,0,.39,.32),(1.19,0,0,.035,.035)],gold)
        loft('Long beard',[(.49,0,-.18,.02,.025),(.63,0,-.18,.13,.07),(.75,0,-.16,.18,.06)],cream)
        line('Root staff',[(.35,-.12,.12),(.34,-.14,.70),(.38,-.13,1.00),(.32,-.12,1.12)],.033,brown)
        oval('Budding leaf',(.39,-.13,1.08),(.045,.035,.105),green,-.62)
    elif idx==4:
        loft('Patched hood',[(.97,0,.04,.28,.20),(1.08,-.06,.04,.25,.19),(1.16,-.15,.03,.13,.11),(1.12,-.29,.02,.025,.03)],blue)
        oval('Empty purse',(0,-.22,.34),(.16,.10,.15),brown)
        for i in range(3):oval('Loose penny',(.09*i-.07,-.235,.17-i*.05),(.043,.02,.04),gold)
    elif idx==5:
        for i in range(4):
            oval('Thunder cloud',((i-1.5)*.112,.025,1.035+.05*sin(i*1.8)),(.14,.15,.10),blue)
        line('Lightning bolt',[(.24,-.09,1.06),(.17,-.12,.99),(.23,-.13,.98),(.18,-.13,.90)],.028,gold)
        for side in [-1,1]:oval('Drooping brow',(side*.10,-.207,.91),(.075,.02,.021),ink,side*.25)
    elif idx==6:
        halo(1.22)
        for side in [-1,1]:wing(side)
        oval('Pearl',(0,-.22,.52),(.057,.045,.057),pink)
    else:
        for side in [-1,1]:
            loft('Swept horn',[(.98,side*.16,.03,.096,.08),(1.11,side*.22,.03,.068,.055),(1.24,side*.19,.03,.008,.01)],red)
            wing(side,True)
        line('Curled tail',[(.15,.08,.17),(.40,.09,.13),(.44,.08,.39)],.028,red)
    bpy.ops.object.select_all(action='DESELECT')
    for o in parts:o.select_set(True)
    bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();o=bpy.context.object;o.name=name
    bpy.ops.object.origin_set(type='ORIGIN_CURSOR');models.append(o)
bpy.ops.object.select_all(action='SELECT')
bpy.context.preferences.filepaths.save_version=0
bpy.ops.wm.save_as_mainfile(filepath=str(root/'art-source/main/board-spirits.blend'),compress=True)
bpy.ops.export_scene.gltf(filepath=str(root/'public/assets/models/board-spirits.glb'),export_format='GLB',export_yup=True)
for i,o in enumerate(models):o.location=((i%4-1.5)*1.65,0,(1-i//4)*1.5)
scene.render.engine='BLENDER_WORKBENCH';scene.display.shading.color_type='MATERIAL';scene.display.shading.show_cavity=True
scene.render.resolution_x=1000;scene.render.resolution_y=540;scene.render.resolution_percentage=100
bpy.ops.object.camera_add();cam=bpy.context.object;scene.camera=cam;cam.data.type='ORTHO';cam.data.ortho_scale=6.7
for i,p in enumerate([(1,-10,2.6),(4,-9,3.3)]):
    cam.location=p;cam.rotation_euler=(Vector((0,0,1.4))-cam.location).to_track_quat('-Z','Y').to_euler()
    scene.render.filepath=f'/tmp/dafuweng-spirits-{i}.png';bpy.ops.render.render(write_still=True)
