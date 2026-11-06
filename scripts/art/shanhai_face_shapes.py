"""Original toy-face deformations in the existing animated head's local coordinates.
No external art. Neutral geometry is untouched; the three shapes reuse its topology.
"""
import numpy as np
MOODS=('happy','concern','surprise')
def face_delta(name,positions,mood):
 p=positions.copy();out=p.copy();part=name.split('_',1)[-1];kind=name.split('_',1)[0]
 side=-1 if p[:,0].mean()<0 else 1
 if part.startswith(('eye','spark')):
  center=np.array([side*.105,.11,.276]);f={'happy':(.32 if kind=='courier' else .48),'concern':.72,'surprise':1.3}[mood]
  out[:,1]=center[1]+(p[:,1]-center[1])*f
  if mood=='happy':out[:,0]=center[0]+(p[:,0]-center[0])*1.18;out[:,1]+=.006
 elif part.startswith('brow'):
  center=p.mean(axis=0);angle=(.42 if kind!='cartographer' else .30)*-side if mood=='concern' else -.1*side if mood=='happy' else 0
  x=p[:,0]-center[0];y=p[:,1]-center[1];out[:,0]=center[0]+x*np.cos(angle)-y*np.sin(angle);out[:,1]=center[1]+x*np.sin(angle)+y*np.cos(angle)+{'happy':.014,'concern':.012,'surprise':.038}[mood]
 elif part.startswith('smile'):
  if mood=='happy':out[:,0]*=1.3;out[:,1]=(p[:,1]+.002)*1.8-.014
  elif mood=='concern':out[:,1]=.013-(p[:,1]+.002)*1.4
  else:
   angle=(p[:,0]+.053)/.106*2*np.pi
   thickness=p[:,1]-(-.002+3.5*p[:,0]**2)
   out[:,0]=(.028+thickness)*np.sin(angle);out[:,1]=(.035+thickness)*np.cos(angle)-.006;out[:,2]+=.025
 elif part.startswith('cheek') and mood=='happy':
  c=p.mean(axis=0);out[:,0]=c[0]+(p[:,0]-c[0])*1.1;out[:,1]=c[1]+(p[:,1]-c[1])*1.25+.006
 return (out-p).astype('<f4')
