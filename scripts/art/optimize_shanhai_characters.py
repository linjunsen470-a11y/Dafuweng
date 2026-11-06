"""Losslessly merge static mesh/material islands under animated ancestors.
Run after create_shanhai_characters.py. Original runtime GLBs are backed up outside public.
No external assets or additional third-party license granted.
"""
from pathlib import Path
import json, struct, copy, shutil
import numpy as np
ROOT=Path(__file__).resolve().parents[2]; OUT=ROOT/'public/shanhai/models'; SRC=ROOT/'art-source/shanhai'
DT={5126:'<f4',5125:'<u4',5123:'<u2',5121:'u1'}; DIMS={'SCALAR':1,'VEC2':2,'VEC3':3,'VEC4':4,'MAT4':16}
def read(p):
 d=p.read_bytes();n=struct.unpack_from('<I',d,12)[0];return json.loads(d[20:20+n]),d[n+28:]
def values(j,b,i):
 a=j['accessors'][i];v=j['bufferViews'][a['bufferView']];dt=np.dtype(DT[a['componentType']]);dim=DIMS[a['type']];off=v.get('byteOffset',0)+a.get('byteOffset',0);step=v.get('byteStride',dim*dt.itemsize)
 return np.ndarray((a['count'],dim),dtype=dt,buffer=b,offset=off,strides=(step,dt.itemsize)).copy()
def mat(node):
 if 'matrix' in node:return np.array(node['matrix']).reshape(4,4).T
 x,y,z,w=node.get('rotation',[0,0,0,1]);r=np.array([[1-2*(y*y+z*z),2*(x*y-z*w),2*(x*z+y*w)],[2*(x*y+z*w),1-2*(x*x+z*z),2*(y*z-x*w)],[2*(x*z-y*w),2*(y*z+x*w),1-2*(x*x+y*y)]])
 m=np.eye(4);m[:3,:3]=r@np.diag(node.get('scale',[1,1,1]));m[:3,3]=node.get('translation',[0,0,0]);return m
def optimize(kind,expressions=False):
 from shanhai_face_shapes import MOODS,face_delta
 p=OUT/f'character-{kind}.glb';backup=SRC/f'character-{kind}-unmerged.glb'
 j0,b0=read(p)
 if j0.get('extras',{}).get('staticIslandMerged'):j0,b0=read(backup)
 else:shutil.copyfile(p,backup)
 j=copy.deepcopy(j0);nodes=j['nodes'];parents={c:i for i,n in enumerate(nodes) for c in n.get('children',[])};animated={c['target']['node'] for a in j['animations'] for c in a['channels']};world={}
 def wm(i):
  if i not in world:world[i]=(wm(parents[i]) if i in parents else np.eye(4))@mat(nodes[i])
  return world[i]
 groups={};oldcalls=0;maxerr=0;tris=0
 for i,n in enumerate(nodes):
  if 'mesh' not in n:continue
  ancestor=i
  while ancestor not in animated and ancestor in parents:ancestor=parents[ancestor]
  transform=np.linalg.inv(wm(ancestor))@wm(i)
  for prim in j0['meshes'][n['mesh']]['primitives']:
   oldcalls+=1;key=(ancestor,prim.get('material',-1));g=groups.setdefault(key,{'POSITION':[],'NORMAL':[],'TEXCOORD_0':[],'indices':[],'vertices':0})
   pos=values(j0,b0,prim['attributes']['POSITION']);ph=np.column_stack((pos,np.ones(len(pos))));pnew=(ph@transform.T)[:,:3].astype('<f4')
   oldworld=ph@wm(i).T;newworld=np.column_stack((pnew,np.ones(len(pnew))))@wm(ancestor).T;maxerr=max(maxerr,float(abs(oldworld-newworld).max()))
   normals=values(j0,b0,prim['attributes']['NORMAL'])@np.linalg.inv(transform[:3,:3]);normals/=np.linalg.norm(normals,axis=1)[:,None]
   inds=values(j0,b0,prim['indices']).reshape(-1).astype('<u4')+g['vertices'];g['indices'].append(inds);tris+=len(inds)//3
   if expressions and nodes[ancestor]['name'].endswith('_head'):
    for mood in MOODS:g.setdefault(mood,[]).append(face_delta(n['name'],pnew,mood))
   g['POSITION'].append(pnew);g['NORMAL'].append(normals.astype('<f4'));g['TEXCOORD_0'].append(values(j0,b0,prim['attributes']['TEXCOORD_0']));g['vertices']+=len(pos)
  del n['mesh']
 # Rebuild compact binary containing unchanged animation values plus merged geometry.
 data=bytearray();j['accessors']=[];j['bufferViews']=[];j['meshes']=[]
 def add(arr,typ,component=5126,target=None):
  arr=np.asarray(arr,dtype=DT[component]);data.extend(b'\0'*((-len(data))%4));offset=len(data);data.extend(arr.tobytes());v={'buffer':0,'byteOffset':offset,'byteLength':arr.nbytes}
  if target:v['target']=target
  vi=len(j['bufferViews']);j['bufferViews'].append(v);a={'bufferView':vi,'componentType':component,'count':len(arr),'type':typ}
  if typ=='VEC3' or typ=='SCALAR':a['min']=arr.reshape(len(arr),-1).min(axis=0).tolist();a['max']=arr.reshape(len(arr),-1).max(axis=0).tolist()
  ai=len(j['accessors']);j['accessors'].append(a);return ai
 remap={}
 for a in j['animations']:
  for s in a['samplers']:
   for field in ['input','output']:
    i=s[field]
    if i not in remap:
     old=j0['accessors'][i];remap[i]=add(values(j0,b0,i),old['type'],old['componentType'])
    s[field]=remap[i]
 byancestor={}
 for (ancestor,material),g in groups.items():
  attrs={name:add(np.concatenate(g[name]),'VEC2' if name=='TEXCOORD_0' else 'VEC3',target=34962) for name in ['POSITION','NORMAL','TEXCOORD_0']};pr={'attributes':attrs,'indices':add(np.concatenate(g['indices']),'SCALAR',5123 if g['vertices']<=65535 else 5125,34963),'mode':4}
  if expressions and nodes[ancestor]['name'].endswith('_head'):
   pr['targets']=[]
   for mood in MOODS:
    delta=np.concatenate(g[mood]);indices=np.flatnonzero(np.any(delta!=0,axis=1)).astype('<u4');accessor={'componentType':5126,'count':len(delta),'type':'VEC3','min':delta.min(axis=0).tolist(),'max':delta.max(axis=0).tolist()}
    if len(indices):
     ai=add(indices,'SCALAR',5125);av=add(delta[indices],'VEC3');accessor['sparse']={'count':len(indices),'indices':{'bufferView':j['accessors'][ai]['bufferView'],'componentType':5125},'values':{'bufferView':j['accessors'][av]['bufferView']}}
    target=len(j['accessors']);j['accessors'].append(accessor);pr['targets'].append({'POSITION':target})
  if material>=0:pr['material']=material
  byancestor.setdefault(ancestor,[]).append(pr)
 for ancestor,prims in byancestor.items():
  nodes[ancestor]['mesh']=len(j['meshes']);mesh={'name':nodes[ancestor]['name']+'_merged','primitives':prims}
  if expressions and nodes[ancestor]['name'].endswith('_head'):mesh.update(weights=[0,0,0],extras={'targetNames':list(MOODS)})
  j['meshes'].append(mesh)
 j['buffers']=[{'byteLength':len(data)}];j.setdefault('extras',{})['staticIslandMerged']=True
 jb=json.dumps(j,separators=(',',':')).encode();jb+=b' '*((-len(jb))%4);data.extend(b'\0'*((-len(data))%4));p.write_bytes(struct.pack('<III',0x46546c67,2,28+len(jb)+len(data))+struct.pack('<II',len(jb),0x4e4f534a)+jb+struct.pack('<II',len(data),0x004e4942)+data)
 # Compare all output animation samples exactly, plus verify seamless endpoints.
 clips=[]
 for a0,a in zip(j0['animations'],j['animations']):
  assert a0['channels']==a['channels']
  for s0,s in zip(a0['samplers'],a['samplers']):
   for field in ['input','output']:assert np.array_equal(values(j0,b0,s0[field]),values(j,data,s[field]))
  clips.append({'name':a['name'],'duration':max(float(values(j,data,s['input'])[-1,0]) for s in a['samplers']),'channels':len(a['channels']),'animationSamplesUnchanged':True,'loopSeamMaxError':max(float(abs(values(j,data,s['output'])[0]-values(j,data,s['output'])[-1]).max()) for s in a['samplers'])})
 assert maxerr<1e-6
 return {'file':p.name,'bytes':p.stat().st_size,'originalDrawCalls':oldcalls,'drawCallsPerNormalPass':len(groups),'meshCount':len(byancestor),'triangles':tris,'maxWorldVertexError':maxerr,'clips':clips,'facialTargets':list(MOODS) if expressions else []}
if __name__=='__main__':
 import sys
 kinds=['cartographer'] if '--cartographer-only' in sys.argv else ['courier','botanist']
 results=[optimize(k) for k in kinds]
 manifest_path=OUT/('cartographer-manifest.json' if len(kinds)==1 else 'characters-manifest.json')
 manifest=json.loads(manifest_path.read_text())
 for c,r in zip(manifest['characters'],results):
  c['originalMeshCount']=r['originalDrawCalls'];c['meshCount']=r['meshCount'];c['drawCallsPerNormalPass']=r['drawCallsPerNormalPass'];c['optimization']='Static geometry merged by nearest animated ancestor and material; animations unchanged'
 manifest_path.write_text(json.dumps(manifest,ensure_ascii=False,indent=2)+'\n')
 (SRC/('cartographer-validation.json' if len(kinds)==1 else 'character-validation.json')).write_text(json.dumps(results,indent=2)+'\n')
 print(json.dumps(results,indent=2))
